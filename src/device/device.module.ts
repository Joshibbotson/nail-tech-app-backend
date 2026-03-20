import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Device, DeviceSchema } from './device.schema';
import { DeletedDevice, DeletedDeviceSchema } from './deleted-device.schema';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import {
  Enhancement,
  EnhancementSchema,
} from '../enhancement/enhancement.schema';
import { Transaction, TransactionSchema } from '../token/transaction.schema';
import {
  CustomBackground,
  CustomBackgroundSchema,
} from '../background/background.schema';
import { EnhancementModule } from '../enhancement/enhancement.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Device.name, schema: DeviceSchema },
      { name: DeletedDevice.name, schema: DeletedDeviceSchema },
      { name: Enhancement.name, schema: EnhancementSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: CustomBackground.name, schema: CustomBackgroundSchema },
    ]),
    forwardRef(() => EnhancementModule),
  ],
  controllers: [DeviceController],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule {}
