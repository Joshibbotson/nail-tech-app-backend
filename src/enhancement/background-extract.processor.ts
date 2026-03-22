import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { CustomBackground } from '../background/background.schema';
import { StorageService } from './storage.service';
import { TokenService } from '../token/token.service';
import { TransactionContext } from '../token/transaction.schema';
import { BackgroundExtractJobData } from './enhancement.types';

@Processor('background-extract')
export class BackgroundExtractProcessor extends WorkerHost {
  private readonly logger = new Logger(BackgroundExtractProcessor.name);

  constructor(
    @InjectModel(CustomBackground.name)
    private readonly backgroundModel: Model<any>,
    private readonly storageService: StorageService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<BackgroundExtractJobData>): Promise<void> {
    const { sourceImageUrl, deviceId, deviceUUID, backgroundName } = job.data;

    this.logger.log(`Extracting background for device ${deviceUUID}`);

    try {
      const { fal } = await import('@fal-ai/client');
      fal.config({ credentials: this.config.get<string>('fal.key', '') });

      const result = await fal.subscribe('fal-ai/nano-banana/edit', {
        input: {
          image_urls: [sourceImageUrl],
          prompt:
            'Remove the hands and nails from this image completely. Fill in the area where the hands were with the surrounding background and surface, seamlessly continuing the texture and pattern. The result should look like a natural photograph of just the background/surface with no hands visible at all.',
        },
        logs: true,
      });

      const falImageUrl = result.data?.images?.[0]?.url;
      if (!falImageUrl) {
        throw new Error('No image returned from fal.ai');
      }

      // Download and persist to S3
      const imageResponse = await fetch(falImageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download result: ${imageResponse.status}`);
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const contentType =
        imageResponse.headers.get('content-type') || 'image/png';
      const extension = contentType.includes('jpeg') ? 'jpg' : 'png';
      const imageKey = `backgrounds/${deviceUUID}/${Date.now()}.${extension}`;

      await this.storageService.uploadBuffer(
        imageKey,
        imageBuffer,
        contentType,
      );

      // Create background record
      const background = new this.backgroundModel({
        deviceId: new Types.ObjectId(deviceId),
        name: backgroundName,
        imageKey,
        sortOrder: 0,
      });

      await background.save();

      this.logger.log(`Background extracted and saved: ${imageKey}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Background extraction failed: ${errorMessage}`);

      // Refund the token
      try {
        await this.tokenService.credit(
          deviceId,
          1,
          TransactionContext.REFUND_FAILED,
          { reason: 'background_extraction_failed', error: errorMessage },
        );
        this.logger.log(
          `Refunded 1 token for failed background extraction (device ${deviceUUID})`,
        );
      } catch (refundError) {
        this.logger.error(`Failed to refund token: ${refundError}`);
      }
    }
  }
}
