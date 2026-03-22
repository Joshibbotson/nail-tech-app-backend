import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Enhancement, EnhancementSchema } from './enhancement.schema';
import {
  CustomBackground,
  CustomBackgroundSchema,
} from '../background/background.schema';
import { EnhancementService } from './enhancement.service';
import { EnhancementController } from './enhancement.controller';
import { EnhancementProcessor } from './enhancement.processor';
import { StorageService } from './storage.service';
import { TokenModule } from '../token/token.module';
import { StyleModule } from '../style/style.module';
import { BackgroundExtractProcessor } from './background-extract.processor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Enhancement.name, schema: EnhancementSchema },
      { name: CustomBackground.name, schema: CustomBackgroundSchema },
    ]),
    BullModule.registerQueue({ name: 'enhancement' }),
    BullModule.registerQueue({ name: 'background-extract' }),
    TokenModule,
    StyleModule,
  ],
  controllers: [EnhancementController],
  providers: [
    EnhancementService,
    EnhancementProcessor,
    BackgroundExtractProcessor,
    StorageService,
  ],
  exports: [EnhancementService, StorageService],
})
export class EnhancementModule {}
