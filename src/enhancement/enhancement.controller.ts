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
import { EnhancementService } from './enhancement.service';
import { CreateEnhancementDto } from './dto/create-enhancement.dto';
import { DeviceDocument } from '../device/device.schema';
import { CurrentDevice } from 'src/common/CurrentDevice.decorator';

@Controller('enhancements')
export class EnhancementController {
  constructor(private readonly enhancementService: EnhancementService) {}

  @Post('upload-url')
  async getUploadUrl(@CurrentDevice() device: DeviceDocument) {
    return this.enhancementService.generateUploadUrl(device.deviceUUID);
  }

  @Post()
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

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentDevice() device: DeviceDocument,
  ) {
    await this.enhancementService.delete(id, device._id.toString());
    return { deleted: true };
  }
}
