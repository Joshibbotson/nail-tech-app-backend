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
      prompt,
      deviceUUID,
    } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing enhancement ${enhancementId}`);

    await this.enhancementModel.findByIdAndUpdate(enhancementId, {
      status: EnhancementStatus.PROCESSING,
    });

    try {
      // ═══════════════════════════════════════════════════════════
      // PASS 1: Analyse the nail photo using Gemini Flash (vision → JSON)
      // ═══════════════════════════════════════════════════════════

      this.logger.log(
        `Pass 1: Analysing nail photo with Gemini for ${enhancementId}`,
      );

      let analysis: NailAnalysis | null = null;

      try {
        analysis = await this.analyseWithGemini(originalImageUrl);
        this.logger.log(
          `Pass 1 complete: ${analysis.nails.count} nails, ${analysis.nails.shape}, ` +
            `${analysis.nails.colour}, art: ${analysis.nails.art}`,
        );
      } catch (analysisError) {
        this.logger.warn(
          `Pass 1 failed, falling back to single-pass: ${analysisError}`,
        );
      }

      // ═══════════════════════════════════════════════════════════
      // PASS 2: Enhance using Nano Banana via fal.ai
      // ═══════════════════════════════════════════════════════════

      this.logger.log(`Pass 2: Generating enhanced image for ${enhancementId}`);

      const { fal } = await import('@fal-ai/client');
      fal.config({
        credentials: this.config.get<string>('fal.key', ''),
      });

      // Build the prompt — use analysis if available, otherwise fall back to original
      let enhancementPrompt: string;
      if (analysis) {
        enhancementPrompt = backgroundImageUrl
          ? buildCustomBackgroundPrompt(prompt)
          : buildEnhancementPrompt(prompt);
      } else {
        enhancementPrompt = prompt;
      }

      const imageUrls = [originalImageUrl];
      if (backgroundImageUrl) {
        imageUrls.push(backgroundImageUrl);
        this.logger.log(
          `Pass 2: Using custom background (${imageUrls.length} images)`,
        );
      } else {
        this.logger.log(`Pass 2: Using style preset (1 image)`);
      }

      this.logger.log(
        `Pass 2: Prompt length: ${enhancementPrompt.length} chars`,
      );

      const result = await fal.subscribe('fal-ai/nano-banana/edit', {
        input: {
          image_urls: imageUrls,
          prompt: enhancementPrompt,
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
        throw new Error(
          `Failed to download result image: ${imageResponse.status}`,
        );
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
        `Enhancement ${enhancementId} completed in ${processingTimeMs}ms ` +
          `(${analysis ? 'two-pass' : 'single-pass'}), stored at ${permanentKey}`,
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
  // Gemini Vision Analysis
  // ═══════════════════════════════════════════════════════════════

  private async analyseWithGemini(imageUrl: string): Promise<NailAnalysis> {
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
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
              {
                type: 'text',
                text: ANALYSIS_PROMPT,
              },
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

    if (!textContent) {
      throw new Error('No text response from OpenAI');
    }

    const jsonStr = this.extractJson(textContent);
    return JSON.parse(jsonStr) as NailAnalysis;
  }

  private extractJson(text: string): string {
    // Strip markdown code fences if present
    const cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        return match[0];
      }
      throw new Error(`No JSON found in response: ${text.substring(0, 200)}`);
    }
  }
}
