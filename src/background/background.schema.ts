import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CustomBackgroundDocument = HydratedDocument<CustomBackground>;

@Schema({ timestamps: true })
export class CustomBackground {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  deviceId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  imageKey: string;

  @Prop({ default: 0 })
  sortOrder: number;
}

export const CustomBackgroundSchema =
  SchemaFactory.createForClass(CustomBackground);
