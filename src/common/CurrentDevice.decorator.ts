import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DeviceDocument } from 'src/device/device.schema';

export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceDocument => {
    const request = ctx.switchToHttp().getRequest();
    return request.device;
  },
);
