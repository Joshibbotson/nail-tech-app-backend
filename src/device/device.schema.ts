import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DeviceDocument = HydratedDocument<Device>;

@Schema({ timestamps: true })
export class Device {
  createdAt: Date;

  @Prop({ required: true, unique: true, index: true })
  deviceUUID: string;

  @Prop({ default: 10 })
  tokenBalance: number;

  @Prop({ type: String, default: null })
  revenueCatAppUserId: string | null;

  @Prop({ type: String, default: null })
  watermarkText: string | null;

  @Prop({
    type: {
      defaultStyle: { type: String, default: null },
      defaultResolution: {
        type: String,
        default: 'standard',
        enum: ['standard', 'hd'],
      },
    },
    default: () => ({ defaultStyle: null, defaultResolution: 'standard' }),
  })
  settings: {
    defaultStyle: string | null;
    defaultResolution: 'standard' | 'hd';
  };
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
