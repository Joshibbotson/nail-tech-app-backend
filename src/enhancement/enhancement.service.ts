import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import {
  Enhancement,
  EnhancementDocument,
  EnhancementStatus,
} from './enhancement.schema';
import { CreateEnhancementDto } from './dto/create-enhancement.dto';
import { StorageService } from './storage.service';
import { TokenService } from '../token/token.service';
import { TransactionContext } from '../token/transaction.schema';
import { StyleService } from '../style/style.service';
import {
  EnhancementJobData,
  BackgroundExtractJobData,
} from './enhancement.types';

@Injectable()
export class EnhancementService {
  constructor(
    @InjectModel(Enhancement.name)
    private readonly enhancementModel: Model<EnhancementDocument>,
    @InjectQueue('enhancement') private readonly enhancementQueue: Queue,
    @InjectQueue('background-extract') private readonly bgExtractQueue: Queue,
    private readonly storageService: StorageService,
    private readonly tokenService: TokenService,
    private readonly styleService: StyleService,
  ) {}

  async generateUploadUrl(deviceUUID: string) {
    return this.storageService.generateUploadUrl(deviceUUID);
  }

  async create(
    deviceId: string,
    deviceUUID: string,
    dto: CreateEnhancementDto,
  ) {
    // Guard: limit concurrent pending/processing enhancements per device
    const pendingCount = await this.enhancementModel.countDocuments({
      deviceId: new Types.ObjectId(deviceId),
      status: {
        $in: [EnhancementStatus.PENDING, EnhancementStatus.PROCESSING],
      },
    });

    if (pendingCount >= 3) {
      throw new BadRequestException(
        'Too many enhancements in progress. Please wait for current ones to complete.',
      );
    }

    // Daily cap: 50 enhancements per device per day
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyCount = await this.enhancementModel.countDocuments({
      deviceId: new Types.ObjectId(deviceId),
      createdAt: { $gte: dayAgo },
    });

    if (dailyCount >= 50) {
      throw new BadRequestException(
        'Daily enhancement limit reached. Try again tomorrow.',
      );
    }

    // 1. Build prompt — either from style preset or custom background
    let prompt: string;
    let backgroundImageUrl: string | undefined;

    if (dto.backgroundId) {
      // Custom background — use a generic prompt and pass the background as a reference image
      prompt =
        'Enhance this nail salon photograph for Instagram. ' +
        'Use the second reference image as the background/surface setting. ' +
        'Place the hands naturally in that environment. ' +
        'Do not remove any human body parts' +
        'Do not change the size of the hand' +
        'Smooth the skin subtly and naturally. ' +
        'CRITICAL: preserve the exact nail art, polish colour, and nail shape with zero modifications. ' +
        'Match the lighting and colour tone of the background. ' +
        'Soft bokeh background. Professional beauty photography.';

      // Fetch the background's S3 key and generate a signed URL
      const { BackgroundService } =
        await import('../background/background.service');
      // We can't inject BackgroundService here due to circular deps,
      // so we'll look up the background directly
      const bgDoc = await this.enhancementModel.db
        .collection('custombackgrounds')
        .findOne({
          _id: new Types.ObjectId(dto.backgroundId),
          deviceId: new Types.ObjectId(deviceId),
        });

      if (!bgDoc) {
        throw new BadRequestException('Background not found');
      }

      backgroundImageUrl = await this.storageService.getSignedReadUrl(
        bgDoc.imageKey,
      );
    } else {
      // Style preset
      const style = this.styleService.findById(dto.styleId);
      if (!style) {
        throw new BadRequestException(`Unknown style: ${dto.styleId}`);
      }
      prompt = style.buildPrompt();
    }

    // 2. Token cost is always 1
    const tokenCost = 1;

    // 3. Debit tokens FIRST — this is atomic and will throw if insufficient
    //    We debit before creating the enhancement so we never have an
    //    unpaid enhancement record sitting in the DB.
    const transaction = await this.tokenService.debit(
      deviceId,
      tokenCost,
      TransactionContext.ENHANCEMENT,
    );

    // 4. Generate a signed URL so fal.ai can download the original image
    const originalSignedUrl = await this.storageService.getSignedReadUrl(
      dto.imageKey,
    );

    // 5. Create enhancement record (tokens already secured)
    const enhancement = new this.enhancementModel({
      deviceId: new Types.ObjectId(deviceId),
      status: EnhancementStatus.PENDING,
      styleId: dto.backgroundId ? `custom:${dto.backgroundId}` : dto.styleId,
      resolution: dto.resolution,
      tokensCharged: tokenCost,
      originalImageUrl: originalSignedUrl,
      originalImageKey: dto.imageKey,
      prompt,
      transactionId: transaction._id,
    });

    await enhancement.save();

    // Update the transaction with the enhancement ID for traceability
    await this.tokenService.linkTransaction(
      transaction._id.toString(),
      enhancement._id.toString(),
    );

    // 6. Dispatch to BullMQ
    const jobData: EnhancementJobData = {
      enhancementId: enhancement._id.toString(),
      originalImageUrl: originalSignedUrl,
      backgroundImageUrl,
      styleId: dto.backgroundId ? `custom:${dto.backgroundId}` : dto.styleId,
      resolution: dto.resolution,
      prompt,
      deviceUUID,
    };

    await this.enhancementQueue.add('process', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return enhancement;
  }

  async findById(enhancementId: string, deviceId: string) {
    const enhancement = await this.enhancementModel
      .findOne({
        _id: enhancementId,
        deviceId: new Types.ObjectId(deviceId),
      })
      .lean();

    if (!enhancement) {
      throw new NotFoundException('Enhancement not found');
    }

    return this.hydrateUrls(enhancement);
  }

  async findAll(deviceId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [enhancements, total] = await Promise.all([
      this.enhancementModel
        .find({ deviceId: new Types.ObjectId(deviceId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.enhancementModel.countDocuments({
        deviceId: new Types.ObjectId(deviceId),
      }),
    ]);

    const items = await Promise.all(
      enhancements.map((e) => this.hydrateUrls(e)),
    );

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async delete(enhancementId: string, deviceId: string): Promise<void> {
    const enhancement = await this.enhancementModel
      .findOne({
        _id: enhancementId,
        deviceId: new Types.ObjectId(deviceId),
      })
      .lean();

    if (!enhancement) {
      throw new NotFoundException('Enhancement not found');
    }

    // Delete images from S3 using stored keys
    if (enhancement.originalImageKey) {
      await this.storageService.deleteImage(enhancement.originalImageKey);
    }
    if (enhancement.enhancedImageKey) {
      await this.storageService.deleteImage(enhancement.enhancedImageKey);
    }

    await this.enhancementModel.findByIdAndDelete(enhancementId);
  }

  async extractBackground(
    enhancementId: string,
    deviceId: string,
    deviceUUID: string,
  ): Promise<void> {
    const enhancement = await this.enhancementModel
      .findOne({
        _id: enhancementId,
        deviceId: new Types.ObjectId(deviceId),
        status: EnhancementStatus.COMPLETED,
      })
      .lean();

    if (!enhancement) {
      throw new NotFoundException('Completed enhancement not found');
    }

    if (!enhancement.enhancedImageKey) {
      throw new BadRequestException('No enhanced image available');
    }

    // Debit 1 token
    await this.tokenService.debit(
      deviceId,
      1,
      TransactionContext.ENHANCEMENT,
      enhancementId,
    );

    // Generate signed URL for the enhanced image
    const sourceImageUrl = await this.storageService.getSignedReadUrl(
      enhancement.enhancedImageKey,
    );

    const jobData: BackgroundExtractJobData = {
      sourceImageUrl,
      sourceImageKey: enhancement.enhancedImageKey,
      deviceId,
      deviceUUID,
      backgroundName: `Extracted Background`,
    };

    await this.bgExtractQueue.add('extract', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  /**
   * Generate fresh signed URLs for any S3 keys stored on the enhancement.
   * Falls back to the stored URL if no key exists (for older records / test endpoint).
   */
  private async hydrateUrls(enhancement: Record<string, any>) {
    const result = { ...enhancement };

    if (enhancement.originalImageKey) {
      result.originalImageUrl = await this.storageService.getSignedReadUrl(
        enhancement.originalImageKey,
      );
    }

    if (enhancement.enhancedImageKey) {
      result.enhancedImageUrl = await this.storageService.getSignedReadUrl(
        enhancement.enhancedImageKey,
      );
    }

    return result;
  }
}
