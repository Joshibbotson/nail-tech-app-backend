import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CustomBackground,
  CustomBackgroundDocument,
} from './background.schema';
import { CreateBackgroundDto, UpdateBackgroundDto } from './dto/background.dto';
import { StorageService } from '../enhancement/storage.service';

@Injectable()
export class BackgroundService {
  constructor(
    @InjectModel(CustomBackground.name)
    private readonly backgroundModel: Model<CustomBackgroundDocument>,
    private readonly storageService: StorageService,
  ) {}

  async generateUploadUrl(deviceUUID: string) {
    const imageKey = `backgrounds/${deviceUUID}/${Date.now()}.jpg`;

    // Reuse the storage service but with a custom key path
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    // We need direct access to the S3 client — for now use the storage service's upload method
    // and generate a presigned URL via the same pattern
    return this.storageService.generateUploadUrl(deviceUUID);
  }

  async create(
    deviceId: string,
    dto: CreateBackgroundDto,
  ): Promise<CustomBackgroundDocument> {
    const background = new this.backgroundModel({
      deviceId: new Types.ObjectId(deviceId),
      name: dto.name,
      imageKey: dto.imageKey,
      sortOrder: dto.sortOrder ?? 0,
    });

    return background.save();
  }

  async countForDevice(deviceId: string): Promise<number> {
    return this.backgroundModel.countDocuments({
      deviceId: new Types.ObjectId(deviceId),
    });
  }

  async findAll(
    deviceId: string,
  ): Promise<
    Array<{
      _id: string;
      name: string;
      imageKey: string;
      imageUrl: string;
      sortOrder: number;
    }>
  > {
    const backgrounds = await this.backgroundModel
      .find({ deviceId: new Types.ObjectId(deviceId) })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    return Promise.all(
      backgrounds.map(async (bg) => ({
        _id: bg._id.toString(),
        name: bg.name,
        imageKey: bg.imageKey,
        sortOrder: bg.sortOrder,
        imageUrl: await this.storageService.getSignedReadUrl(bg.imageKey),
      })),
    );
  }

  async findById(
    backgroundId: string,
    deviceId: string,
  ): Promise<{
    _id: string;
    name: string;
    imageKey: string;
    imageUrl: string;
    sortOrder: number;
  }> {
    const background = await this.backgroundModel
      .findOne({
        _id: backgroundId,
        deviceId: new Types.ObjectId(deviceId),
      })
      .lean();

    if (!background) {
      throw new NotFoundException('Background not found');
    }

    return {
      _id: background._id.toString(),
      name: background.name,
      imageKey: background.imageKey,
      sortOrder: background.sortOrder,
      imageUrl: await this.storageService.getSignedReadUrl(background.imageKey),
    };
  }

  async update(
    backgroundId: string,
    deviceId: string,
    dto: UpdateBackgroundDto,
  ) {
    const background = await this.backgroundModel.findOneAndUpdate(
      { _id: backgroundId, deviceId: new Types.ObjectId(deviceId) },
      { $set: dto },
      { new: true },
    );

    if (!background) {
      throw new NotFoundException('Background not found');
    }

    return background;
  }

  async delete(backgroundId: string, deviceId: string): Promise<void> {
    const background = await this.backgroundModel
      .findOne({
        _id: backgroundId,
        deviceId: new Types.ObjectId(deviceId),
      })
      .lean();

    if (!background) {
      throw new NotFoundException('Background not found');
    }

    // Delete image from S3
    await this.storageService.deleteImage(background.imageKey);
    await this.backgroundModel.findByIdAndDelete(backgroundId);
  }
}
