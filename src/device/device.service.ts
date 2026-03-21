import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Device, DeviceDocument } from './device.schema';
import { DeletedDevice, DeletedDeviceDocument } from './deleted-device.schema';
import { Enhancement } from '../enhancement/enhancement.schema';
import { Transaction } from '../token/transaction.schema';
import { CustomBackground } from '../background/background.schema';
import { StorageService } from '../enhancement/storage.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);
  private readonly STARTING_TOKENS_AMOUNT = 3;
  constructor(
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(DeletedDevice.name)
    private readonly deletedDeviceModel: Model<DeletedDeviceDocument>,
    @InjectModel(Enhancement.name)
    private readonly enhancementModel: Model<any>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<any>,
    @InjectModel(CustomBackground.name)
    private readonly backgroundModel: Model<any>,
    private readonly storageService: StorageService,
  ) {}

  async register(dto: RegisterDeviceDto): Promise<DeviceDocument> {
    const existing = await this.deviceModel.findOne({
      deviceUUID: dto.deviceUUID,
    });

    if (existing) {
      return existing;
    }

    // Check if this device previously deleted their account — no free tokens
    const wasPreviouslyDeleted = await this.deletedDeviceModel.exists({
      deviceUUID: dto.deviceUUID,
    });

    const device = new this.deviceModel({
      deviceUUID: dto.deviceUUID,
      tokenBalance: wasPreviouslyDeleted ? 0 : this.STARTING_TOKENS_AMOUNT,
    });

    return device.save();
  }

  async findByUUID(deviceUUID: string): Promise<DeviceDocument | null> {
    return this.deviceModel.findOne({ deviceUUID });
  }

  async findById(id: string): Promise<DeviceDocument | null> {
    return this.deviceModel.findById(id);
  }

  async deleteAccount(
    device: DeviceDocument,
  ): Promise<{ enhancements: number; backgrounds: number }> {
    const deviceId = device._id;
    const deviceObjId = new Types.ObjectId(deviceId);

    this.logger.log(`Deleting all data for device ${device.deviceUUID}`);

    // 1. Delete S3 images from enhancements
    const enhancements = await this.enhancementModel
      .find({ deviceId: deviceObjId })
      .select('originalImageKey enhancedImageKey')
      .lean();

    for (const e of enhancements) {
      if (e.originalImageKey) {
        try {
          await this.storageService.deleteImage(e.originalImageKey);
        } catch {}
      }
      if (e.enhancedImageKey) {
        try {
          await this.storageService.deleteImage(e.enhancedImageKey);
        } catch {}
      }
    }

    // 2. Delete S3 images from custom backgrounds
    const backgrounds = await this.backgroundModel
      .find({ deviceId: deviceObjId })
      .select('imageKey')
      .lean();

    for (const bg of backgrounds) {
      if (bg.imageKey) {
        try {
          await this.storageService.deleteImage(bg.imageKey);
        } catch {}
      }
    }

    // 3. Record this UUID so they don't get free tokens on re-register
    await this.deletedDeviceModel.findOneAndUpdate(
      { deviceUUID: device.deviceUUID },
      { deviceUUID: device.deviceUUID },
      { upsert: true },
    );

    // 4. Delete all database records
    await Promise.all([
      this.enhancementModel.deleteMany({ deviceId: deviceObjId }),
      this.transactionModel.deleteMany({ deviceId: deviceObjId }),
      this.backgroundModel.deleteMany({ deviceId: deviceObjId }),
      this.deviceModel.findByIdAndDelete(deviceId),
    ]);

    this.logger.log(
      `Deleted device ${device.deviceUUID}: ${enhancements.length} enhancements, ${backgrounds.length} backgrounds`,
    );

    return {
      enhancements: enhancements.length,
      backgrounds: backgrounds.length,
    };
  }
}
