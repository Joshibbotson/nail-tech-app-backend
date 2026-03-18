import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomBackground, CustomBackgroundSchema } from './background.schema';
import { BackgroundService } from './background.service';
import { BackgroundController } from './background.controller';
import { EnhancementModule } from '../enhancement/enhancement.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomBackground.name, schema: CustomBackgroundSchema },
    ]),
    EnhancementModule, // For StorageService
  ],
  controllers: [BackgroundController],
  providers: [BackgroundService],
  exports: [BackgroundService],
})
export class BackgroundModule {}
