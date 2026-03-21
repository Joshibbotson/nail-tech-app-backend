import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Device, DeviceDocument } from '../device/device.schema';
import {
  Transaction,
  TransactionDocument,
  TransactionType,
  TransactionContext,
} from './transaction.schema';

@Injectable()
export class TokenService {
  constructor(
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  async getBalance(deviceId: string) {
    const device = await this.deviceModel.findById(deviceId).lean();

    return {
      balance: device?.tokenBalance ?? 0,
    };
  }

  async getTransactions(deviceId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find({ deviceId: new Types.ObjectId(deviceId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.transactionModel.countDocuments({
        deviceId: new Types.ObjectId(deviceId),
      }),
    ]);

    return {
      items: transactions,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Debit tokens atomically.
   * The query filter ensures tokenBalance >= amount before decrementing,
   * so it's impossible to go negative even without a transaction.
   */
  async debit(
    deviceId: string,
    amount: number,
    context: TransactionContext,
    enhancementId?: string,
  ): Promise<TransactionDocument> {
    const device = await this.deviceModel.findOneAndUpdate(
      { _id: deviceId, tokenBalance: { $gte: amount } },
      { $inc: { tokenBalance: -amount } },
      { new: true },
    );

    if (!device) {
      throw new BadRequestException('Insufficient token balance');
    }

    const transaction = new this.transactionModel({
      deviceId: new Types.ObjectId(deviceId),
      type: TransactionType.SPEND,
      amount: -amount,
      context,
      enhancementId: enhancementId ? new Types.ObjectId(enhancementId) : null,
    });

    await transaction.save();
    return transaction;
  }

  /**
   * Link a transaction to an enhancement after creation.
   */
  async linkTransaction(
    transactionId: string,
    enhancementId: string,
  ): Promise<void> {
    await this.transactionModel.findByIdAndUpdate(transactionId, {
      enhancementId: new Types.ObjectId(enhancementId),
    });
  }

  /**
   * Credit tokens (for purchases, refunds, bonuses).
   */
  async credit(
    deviceId: string,
    amount: number,
    context: TransactionContext,
    metadata?: Record<string, any>,
  ): Promise<TransactionDocument | null> {
    // Webhook replay protection: check if this RevenueCat event was already processed
    if (metadata?.revenueCatEventId) {
      const existing = await this.transactionModel.findOne({
        'metadata.revenueCatEventId': metadata.revenueCatEventId,
      });
      if (existing) {
        return null; // Already processed, skip
      }
    }

    await this.deviceModel.findByIdAndUpdate(deviceId, {
      $inc: { tokenBalance: amount },
    });

    const transaction = new this.transactionModel({
      deviceId: new Types.ObjectId(deviceId),
      type:
        context === TransactionContext.REFUND_FAILED
          ? TransactionType.REFUND
          : TransactionType.PURCHASE,
      amount,
      context,
      metadata,
    });

    await transaction.save();

    return transaction;
  }
}
