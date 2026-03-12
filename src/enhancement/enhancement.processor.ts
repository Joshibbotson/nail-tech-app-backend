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

export interface EnhancementJobData {
  enhancementId: string;
  originalImageUrl: string;
  prompt: string;
  deviceUUID: string;
}

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
    const { enhancementId, originalImageUrl, prompt, deviceUUID } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing enhancement ${enhancementId}`);

    // Mark as processing
    await this.enhancementModel.findByIdAndUpdate(enhancementId, {
      status: EnhancementStatus.PROCESSING,
    });

    try {
      // Dynamic import for ESM @fal-ai/client
      const { fal } = await import('@fal-ai/client');

      fal.config({
        credentials: this.config.get<string>('fal.key', ''),
      });

      // Call Nano Banana via fal.ai (edit endpoint for image-to-image)
      const result = await fal.subscribe('fal-ai/nano-banana/edit', {
        input: {
          image_urls: [originalImageUrl],
          prompt,
        },
        logs: true,
      });

      const falImageUrl = result.data?.images?.[0]?.url;

      if (!falImageUrl) {
        throw new Error('No image returned from fal.ai');
      }

      // Download the fal.ai result (temporary URL) and persist to S3
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
      });

      this.logger.log(
        `Enhancement ${enhancementId} completed in ${processingTimeMs}ms, stored at ${permanentKey}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Enhancement ${enhancementId} failed: ${errorMessage}`);

      await this.enhancementModel.findByIdAndUpdate(enhancementId, {
        status: EnhancementStatus.FAILED,
        error: errorMessage,
      });

      // TODO: Refund tokens on failure via TokenService
    }
  }
}
