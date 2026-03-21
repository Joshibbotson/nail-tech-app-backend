import { Controller, Post, Get, Delete, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DeviceService } from './device.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { DeviceDocument } from './device.schema';
import { CurrentDevice } from 'src/common/CurrentDevice.decorator';

@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post('register')
  @Throttle({
    short: { limit: 1, ttl: 1000 }, // 1 per second
    medium: { limit: 5, ttl: 3600000 }, // 5 per hour per IP
  })
  async register(@Body() dto: RegisterDeviceDto) {
    const device = await this.deviceService.register(dto);
    return {
      id: device._id,
      deviceUUID: device.deviceUUID,
      tokenBalance: device.tokenBalance,
      settings: device.settings,
      createdAt: device.createdAt,
    };
  }

  @Get('me')
  async me(@CurrentDevice() device: DeviceDocument) {
    return {
      id: device._id,
      deviceUUID: device.deviceUUID,
      tokenBalance: device.tokenBalance,
      watermarkText: device.watermarkText,
      settings: device.settings,
      createdAt: device.createdAt,
    };
  }

  @Delete('account')
  async deleteAccount(@CurrentDevice() device: DeviceDocument) {
    await this.deviceService.deleteAccount(device);
    return { deleted: true };
  }
}
