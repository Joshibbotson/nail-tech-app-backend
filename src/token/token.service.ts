import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
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
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async getBalance(deviceId: string) {
    const device = await this.deviceModel.findById(deviceId).lean();
    const transactions = await this.transactionModel
      .find({ deviceId: new Types.ObjectId(deviceId) })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return {
      balance: device?.tokenBalance ?? 0,
      transactions,
    };
  }

  /**
   * Debit tokens atomically using a MongoDB transaction.
   * Returns the transaction record, or throws if insufficient balance.
   */
  async debit(
    deviceId: string,
    amount: number,
    context: TransactionContext,
    enhancementId?: string,
  ): Promise<TransactionDocument> {
    return await this.connection.transaction(async () => {
      try {
        // Atomic findOneAndUpdate with balance check in the query filter.
        // If tokenBalance < amount, this returns null (no match).
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
          enhancementId: enhancementId
            ? new Types.ObjectId(enhancementId)
            : null,
        });

        await transaction.save();

        return transaction;
      } catch (error) {
        throw error;
      }
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
  ): Promise<TransactionDocument> {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      await this.deviceModel.findByIdAndUpdate(
        deviceId,
        { $inc: { tokenBalance: amount } },
        { session },
      );

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

      await transaction.save({ session });
      await session.commitTransaction();

      return transaction;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
