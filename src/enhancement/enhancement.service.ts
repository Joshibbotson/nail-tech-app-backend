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
import { EnhancementJobData } from './enhancement.processor';

@Injectable()
export class EnhancementService {
  constructor(
    @InjectModel(Enhancement.name)
    private readonly enhancementModel: Model<EnhancementDocument>,
    @InjectQueue('enhancement') private readonly enhancementQueue: Queue,
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
    // 1. Validate style exists
    const style = this.styleService.findById(dto.styleId);
    if (!style) {
      throw new BadRequestException(`Unknown style: ${dto.styleId}`);
    }

    // 2. Calculate token cost
    const tokenCost = dto.resolution === 'hd' ? 2 : 1;

    // 3. Debit tokens (atomic — throws if insufficient)
    // We create the enhancement record first so we can link the transaction
    const enhancement = new this.enhancementModel({
      deviceId: new Types.ObjectId(deviceId),
      status: EnhancementStatus.PENDING,
      styleId: dto.styleId,
      resolution: dto.resolution,
      tokensCharged: tokenCost,
      originalImageUrl: this.storageService.getPublicUrl(dto.imageKey),
      prompt: style.buildPrompt(),
    });

    await enhancement.save();

    try {
      await this.tokenService.debit(
        deviceId,
        tokenCost,
        TransactionContext.ENHANCEMENT,
        enhancement._id.toString(),
      );
    } catch (error) {
      // Debit failed — clean up the enhancement record
      await this.enhancementModel.findByIdAndDelete(enhancement._id);
      throw error;
    }

    // 4. Dispatch to BullMQ for async processing
    const jobData: EnhancementJobData = {
      enhancementId: enhancement._id.toString(),
      originalImageUrl: enhancement.originalImageUrl,
      prompt: enhancement.prompt!,
      deviceUUID,
    };

    await this.enhancementQueue.add('process', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return enhancement;
  }

  /**
   * Test-only: create an enhancement using a direct public image URL
   * instead of an R2 presigned upload. Remove before shipping.
   */
  async createWithUrl(
    deviceId: string,
    deviceUUID: string,
    styleId: string,
    resolution: 'standard' | 'hd',
    imageUrl: string,
  ) {
    const style = this.styleService.findById(styleId);
    if (!style) {
      throw new BadRequestException(`Unknown style: ${styleId}`);
    }

    const tokenCost = resolution === 'hd' ? 2 : 1;

    const enhancement = new this.enhancementModel({
      deviceId: new Types.ObjectId(deviceId),
      status: EnhancementStatus.PENDING,
      styleId,
      resolution,
      tokensCharged: tokenCost,
      originalImageUrl: imageUrl,
      prompt: style.buildPrompt(),
    });

    await enhancement.save();

    try {
      await this.tokenService.debit(
        deviceId,
        tokenCost,
        TransactionContext.ENHANCEMENT,
        enhancement._id.toString(),
      );
    } catch (error) {
      await this.enhancementModel.findByIdAndDelete(enhancement._id);
      throw error;
    }

    const jobData: EnhancementJobData = {
      enhancementId: enhancement._id.toString(),
      originalImageUrl: imageUrl,
      prompt: enhancement.prompt!,
      deviceUUID,
    };

    await this.enhancementQueue.add('process', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return enhancement;
  }

  async findById(
    enhancementId: string,
    deviceId: string,
  ): Promise<EnhancementDocument> {
    const enhancement = await this.enhancementModel.findOne({
      _id: enhancementId,
      deviceId: new Types.ObjectId(deviceId),
    });

    if (!enhancement) {
      throw new NotFoundException('Enhancement not found');
    }

    return enhancement;
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

    return {
      items: enhancements,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async delete(enhancementId: string, deviceId: string): Promise<void> {
    const enhancement = await this.findById(enhancementId, deviceId);

    // Delete images from R2
    if (enhancement.originalImageUrl) {
      const originalKey = this.extractKeyFromUrl(enhancement.originalImageUrl);
      if (originalKey) await this.storageService.deleteImage(originalKey);
    }

    if (enhancement.enhancedImageUrl) {
      const enhancedKey = this.extractKeyFromUrl(enhancement.enhancedImageUrl);
      if (enhancedKey) await this.storageService.deleteImage(enhancedKey);
    }

    await this.enhancementModel.findByIdAndDelete(enhancementId);
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.slice(1); // Remove leading /
    } catch {
      return null;
    }
  }
}
