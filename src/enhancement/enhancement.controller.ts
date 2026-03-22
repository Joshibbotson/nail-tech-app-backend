import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { EnhancementService } from './enhancement.service';
import { CreateEnhancementDto } from './dto/create-enhancement.dto';
import { DeviceDocument } from '../device/device.schema';
import { CurrentDevice } from 'src/common/CurrentDevice.decorator';

@Controller('enhancements')
export class EnhancementController {
  constructor(private readonly enhancementService: EnhancementService) {}

  @Post('upload-url')
  @Throttle({ short: { limit: 3, ttl: 1000 } }) // 3 per second
  async getUploadUrl(@CurrentDevice() device: DeviceDocument) {
    return this.enhancementService.generateUploadUrl(device.deviceUUID);
  }

  @Post()
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 10, ttl: 60000 },
  }) // 2/s, 10/min
  async create(
    @CurrentDevice() device: DeviceDocument,
    @Body() dto: CreateEnhancementDto,
  ) {
    const enhancement = await this.enhancementService.create(
      device._id.toString(),
      device.deviceUUID,
      dto,
    );

    return {
      id: enhancement._id,
      status: enhancement.status,
      styleId: enhancement.styleId,
      resolution: enhancement.resolution,
      tokensCharged: enhancement.tokensCharged,
      createdAt: enhancement.createdAt,
    };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentDevice() device: DeviceDocument,
  ) {
    return this.enhancementService.findById(id, device._id.toString());
  }

  @Get()
  async findAll(
    @CurrentDevice() device: DeviceDocument,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.enhancementService.findAll(device._id.toString(), page, limit);
  }

  @Post(':id/extract-background')
  @SkipThrottle()
  async extractBackground(
    @Param('id') id: string,
    @CurrentDevice() device: DeviceDocument,
  ) {
    await this.enhancementService.extractBackground(
      id,
      device._id.toString(),
      device.deviceUUID,
    );
    return { queued: true };
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentDevice() device: DeviceDocument,
  ) {
    await this.enhancementService.delete(id, device._id.toString());
    return { deleted: true };
  }
}
