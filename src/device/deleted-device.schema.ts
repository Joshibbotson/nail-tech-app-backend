import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DeletedDeviceDocument = HydratedDocument<DeletedDevice>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class DeletedDevice {
  @Prop({ required: true, unique: true, index: true })
  deviceUUID: string;
}

export const DeletedDeviceSchema = SchemaFactory.createForClass(DeletedDevice);
