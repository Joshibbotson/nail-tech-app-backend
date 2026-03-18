import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DeviceService } from 'src/device/device.service';

// Extend Express Request to include the resolved device
declare global {
  namespace Express {
    interface Request {
      device?: import('src/device/device.schema').DeviceDocument;
    }
  }
}

@Injectable()
export class DeviceMiddleware implements NestMiddleware {
  constructor(private readonly deviceService: DeviceService) {}

  // Paths that don't require device authentication
  private readonly excludedPaths = [
    '/api/v1/devices/register',
    '/api/v1/tokens/webhook',
  ];

  async use(req: Request, _res: Response, next: NextFunction) {
    // Skip middleware for excluded paths
    if (this.excludedPaths.some((path) => req.originalUrl.startsWith(path))) {
      return next();
    }

    const deviceUUID = req.headers['x-device-id'] as string;

    if (!deviceUUID) {
      throw new UnauthorizedException('X-Device-Id header is required');
    }

    const device = await this.deviceService.findByUUID(deviceUUID);

    if (!device) {
      throw new UnauthorizedException(
        'Unknown device. Register first via POST /devices/register',
      );
    }

    req.device = device;
    next();
  }
}
