import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EnhancementDocument = HydratedDocument<Enhancement>;

export enum EnhancementStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Enhancement {
  createdAt: Date;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  deviceId: Types.ObjectId;

  @Prop({
    required: true,
    enum: EnhancementStatus,
    default: EnhancementStatus.PENDING,
  })
  status: EnhancementStatus;

  @Prop({ required: true })
  styleId: string;

  @Prop({ required: true, enum: ['standard', 'hd'], type: String })
  resolution: 'standard' | 'hd';

  @Prop({ required: true })
  tokensCharged: number;

  @Prop({ required: true })
  originalImageUrl: string;

  @Prop({ type: String, default: null })
  originalImageKey: string | null;

  @Prop({ type: String, default: null })
  enhancedImageUrl: string | null;

  @Prop({ type: String, default: null })
  enhancedImageKey: string | null;

  @Prop({ type: String, default: null })
  prompt: string | null;

  @Prop({ type: String, default: null })
  falRequestId: string | null;

  @Prop({ type: Number, default: null })
  processingTimeMs: number | null;

  @Prop({ type: String, default: null })
  error: string | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Object, default: null })
  metadata: Record<string, any> | null;
}

export const EnhancementSchema = SchemaFactory.createForClass(Enhancement);
