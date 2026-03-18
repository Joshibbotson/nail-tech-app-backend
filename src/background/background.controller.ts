import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { BackgroundService } from './background.service';
import { CreateBackgroundDto, UpdateBackgroundDto } from './dto/background.dto';
import { DeviceDocument } from '../device/device.schema';
import { StorageService } from '../enhancement/storage.service';
import { CurrentDevice } from 'src/common/CurrentDevice.decorator';

@Controller('backgrounds')
export class BackgroundController {
  constructor(
    private readonly backgroundService: BackgroundService,
    private readonly storageService: StorageService,
  ) {}

  @Post('upload-url')
  async getUploadUrl(@CurrentDevice() device: DeviceDocument) {
    return this.storageService.generateUploadUrl(device.deviceUUID);
  }

  @Post()
  async create(
    @CurrentDevice() device: DeviceDocument,
    @Body() dto: CreateBackgroundDto,
  ) {
    return this.backgroundService.create(device._id.toString(), dto);
  }

  @Get()
  async findAll(@CurrentDevice() device: DeviceDocument) {
    return this.backgroundService.findAll(device._id.toString());
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentDevice() device: DeviceDocument,
  ) {
    return this.backgroundService.findById(id, device._id.toString());
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentDevice() device: DeviceDocument,
    @Body() dto: UpdateBackgroundDto,
  ) {
    return this.backgroundService.update(id, device._id.toString(), dto);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentDevice() device: DeviceDocument,
  ) {
    await this.backgroundService.delete(id, device._id.toString());
    return { deleted: true };
  }
}
