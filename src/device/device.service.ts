import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from './device.schema';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DeviceService {
  constructor(
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
  ) {}

  async register(dto: RegisterDeviceDto): Promise<DeviceDocument> {
    const existing = await this.deviceModel.findOne({
      deviceUUID: dto.deviceUUID,
    });

    if (existing) {
      throw new ConflictException('Device already registered');
    }

    const device = new this.deviceModel({
      deviceUUID: dto.deviceUUID,
      tokenBalance: 10, // Free tokens on registration
    });

    return device.save();
  }

  async findByUUID(deviceUUID: string): Promise<DeviceDocument | null> {
    return this.deviceModel.findOne({ deviceUUID });
  }

  async findById(id: string): Promise<DeviceDocument | null> {
    return this.deviceModel.findById(id);
  }
}
