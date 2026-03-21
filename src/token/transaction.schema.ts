import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

export enum TransactionType {
  PURCHASE = 'purchase',
  SPEND = 'spend',
  BONUS = 'bonus',
  REFUND = 'refund',
}

export enum TransactionContext {
  SIGNUP_BONUS = 'signup_bonus',
  IAP_PACK_20 = 'iap_pack_20',
  IAP_PACK_50 = 'iap_pack_50',
  IAP_PACK_150 = 'iap_pack_150',
  ENHANCEMENT = 'enhancement',
  REFUND_FAILED = 'refund_failed',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Transaction {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  deviceId: Types.ObjectId;

  @Prop({ required: true, enum: TransactionType })
  type: TransactionType;

  @Prop({ required: true })
  amount: number; // positive = credit, negative = debit

  @Prop({ required: true, enum: TransactionContext })
  context: TransactionContext;

  @Prop({ type: Types.ObjectId, default: null })
  enhancementId: Types.ObjectId | null;

  @Prop({ type: Object, default: null })
  metadata: Record<string, any> | null;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Index for webhook replay protection
TransactionSchema.index({ 'metadata.revenueCatEventId': 1 }, { sparse: true });
