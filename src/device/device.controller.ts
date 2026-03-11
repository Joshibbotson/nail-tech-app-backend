import { Controller, Post, Get, Body } from '@nestjs/common';
import { DeviceService } from './device.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { CurrentDevice } from 'src/common/CurrentDevice.decorator';
import { DeviceDocument } from './device.schema';

@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post('register')
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
}
