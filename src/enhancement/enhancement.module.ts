import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Enhancement, EnhancementSchema } from './enhancement.schema';
import { EnhancementService } from './enhancement.service';
import { EnhancementController } from './enhancement.controller';
import { TokenModule } from '../token/token.module';
import { StyleModule } from 'src/style/style.module';
import { EnhancementProcessor } from './enhancement.processor';
import { StorageService } from './storage.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Enhancement.name, schema: EnhancementSchema },
    ]),
    BullModule.registerQueue({ name: 'enhancement' }),
    TokenModule,
    StyleModule,
  ],
  controllers: [EnhancementController],
  providers: [EnhancementService, EnhancementProcessor, StorageService],
  exports: [EnhancementService],
})
export class EnhancementModule {}
