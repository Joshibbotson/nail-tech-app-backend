import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import {
  Enhancement,
  EnhancementDocument,
  EnhancementStatus,
} from './enhancement.schema';
import { StorageService } from './storage.service';
import { EnhancementJobData } from './enhancement.types';
import {
  NailAnalysis,
  ANALYSIS_PROMPT,
  STYLE_SCENE_OVERRIDES,
  buildModifiedJson,
  buildEnhancementPrompt,
  buildCustomBackgroundPrompt,
} from './nail-analysis';

@Processor('enhancement')
export class EnhancementProcessor extends WorkerHost {
  private readonly logger = new Logger(EnhancementProcessor.name);

  constructor(
    @InjectModel(Enhancement.name)
    private readonly enhancementModel: Model<EnhancementDocument>,
    private readonly storageService: StorageService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<EnhancementJobData>): Promise<void> {
    const {
      enhancementId,
      originalImageUrl,
      backgroundImageUrl,
      styleId,
      prompt,
      deviceUUID,
    } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `Processing enhancement ${enhancementId} (style: ${styleId})`,
    );

    await this.enhancementModel.findByIdAndUpdate(enhancementId, {
      status: EnhancementStatus.PROCESSING,
    });

    try {
      // ═══════════════════════════════════════════════════════════
      // PASS 1: Describe the image as JSON (OpenAI GPT-4o-mini)
      // ═══════════════════════════════════════════════════════════

      this.logger.log(`Pass 1: Analysing photo for ${enhancementId}`);

      let analysis: NailAnalysis | null = null;

      try {
        analysis = await this.analyseImage(originalImageUrl);
        this.logger.log(`═══ PASS 1 RESULT ═══`);
        this.logger.log(JSON.stringify(analysis, null, 2));
        this.logger.log(`═══ END PASS 1 ═══`);
      } catch (analysisError) {
        this.logger.warn(
          `Pass 1 failed, falling back to single-pass: ${analysisError}`,
        );
      }

      // ═══════════════════════════════════════════════════════════
      // PASS 2: Modify scene JSON → send back to image model
      // ═══════════════════════════════════════════════════════════

      this.logger.log(`Pass 2: Generating image for ${enhancementId}`);

      const { fal } = await import('@fal-ai/client');
      fal.config({ credentials: this.config.get<string>('fal.key', '') });

      let pass2Prompt: string;
      const imageUrls = [originalImageUrl];

      if (analysis) {
        const isCustomBackground = styleId.startsWith('custom:');

        if (isCustomBackground && backgroundImageUrl) {
          const sceneOverride = {
            background: 'Match the background from the second reference image',
            surface: 'Match the surface from the second reference image',
            lighting: 'Match the lighting from the second reference image',
          };
          this.logger.log(`═══ SCENE OVERRIDE (custom background) ═══`);
          this.logger.log(JSON.stringify(sceneOverride, null, 2));

          const modifiedJson = buildModifiedJson(analysis, sceneOverride);
          this.logger.log(`═══ MODIFIED JSON ═══`);
          this.logger.log(modifiedJson);
          this.logger.log(`═══ END MODIFIED JSON ═══`);

          imageUrls.push(backgroundImageUrl);
          pass2Prompt = buildCustomBackgroundPrompt(modifiedJson);
        } else {
          const sceneOverride = STYLE_SCENE_OVERRIDES[styleId] || {};
          this.logger.log(`═══ SCENE OVERRIDE (style: ${styleId}) ═══`);
          this.logger.log(JSON.stringify(sceneOverride, null, 2));

          const modifiedJson = buildModifiedJson(analysis, sceneOverride);
          this.logger.log(`═══ MODIFIED JSON ═══`);
          this.logger.log(modifiedJson);
          this.logger.log(`═══ END MODIFIED JSON ═══`);

          pass2Prompt = buildEnhancementPrompt(modifiedJson);
        }
      } else {
        // Fallback: no analysis available, use the old-style prompt
        if (backgroundImageUrl) {
          imageUrls.push(backgroundImageUrl);
        }
        pass2Prompt = prompt;
        this.logger.log(`═══ NO ANALYSIS — using fallback prompt ═══`);
      }

      this.logger.log(`═══ FULL PASS 2 PROMPT ═══`);
      this.logger.log(pass2Prompt);
      this.logger.log(`═══ END PROMPT ═══`);
      this.logger.log(`Pass 2: Sending ${imageUrls.length} image(s) to fal.ai`);

      const result = await fal.subscribe('fal-ai/nano-banana/edit', {
        input: {
          image_urls: imageUrls,
          prompt: pass2Prompt,
        },
        logs: true,
      });

      const falImageUrl = result.data?.images?.[0]?.url;
      if (!falImageUrl) {
        throw new Error('No image returned from fal.ai');
      }

      // Persist to S3
      const imageResponse = await fetch(falImageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download result: ${imageResponse.status}`);
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const contentType =
        imageResponse.headers.get('content-type') || 'image/png';
      const extension = contentType.includes('jpeg') ? 'jpg' : 'png';
      const permanentKey = `enhanced/${deviceUUID}/${enhancementId}.${extension}`;

      await this.storageService.uploadBuffer(
        permanentKey,
        imageBuffer,
        contentType,
      );

      const processingTimeMs = Date.now() - startTime;

      await this.enhancementModel.findByIdAndUpdate(enhancementId, {
        status: EnhancementStatus.COMPLETED,
        enhancedImageKey: permanentKey,
        falRequestId: result.requestId,
        processingTimeMs,
        completedAt: new Date(),
        metadata: analysis ? { nailAnalysis: analysis } : null,
      });

      this.logger.log(
        `Enhancement ${enhancementId} completed in ${processingTimeMs}ms (${analysis ? 'two-pass' : 'single-pass'})`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Enhancement ${enhancementId} failed: ${errorMessage}`);

      await this.enhancementModel.findByIdAndUpdate(enhancementId, {
        status: EnhancementStatus.FAILED,
        error: errorMessage,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Pass 1: Image Analysis via OpenAI
  // ═══════════════════════════════════════════════════════════════

  private async analyseImage(imageUrl: string): Promise<NailAnalysis> {
    const apiKey = this.config.get<string>('openai.apiKey');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text', text: ANALYSIS_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || '';

    this.logger.log(`═══ RAW OPENAI RESPONSE ═══`);
    this.logger.log(textContent);
    this.logger.log(`═══ END RAW OPENAI RESPONSE ═══`);

    if (!textContent) {
      throw new Error('No text response from OpenAI');
    }

    const jsonStr = this.extractJson(textContent);

    this.logger.log(`═══ EXTRACTED JSON ═══`);
    this.logger.log(jsonStr);
    this.logger.log(`═══ END EXTRACTED JSON ═══`);

    return JSON.parse(jsonStr) as NailAnalysis;
  }

  private extractJson(text: string): string {
    const cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return match[0];
      throw new Error(`No JSON found in response: ${text.substring(0, 200)}`);
    }
  }
}
