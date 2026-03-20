import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Device, DeviceSchema } from '../device/device.schema';
import { Transaction, TransactionSchema } from './transaction.schema';
import { TokenService } from './token.service';
import { TokenController } from './token.controller';
import { DeviceModule } from '../device/device.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Device.name, schema: DeviceSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    forwardRef(() => DeviceModule),
  ],
  controllers: [TokenController],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
