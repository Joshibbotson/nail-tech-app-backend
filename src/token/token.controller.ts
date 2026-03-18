import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { DeviceService } from '../device/device.service';
import { DeviceDocument } from '../device/device.schema';
import { TransactionContext } from './transaction.schema';
import { CurrentDevice } from 'src/common/CurrentDevice.decorator';

// RevenueCat webhook event types we care about
const PACK_MAP: Record<
  string,
  { tokens: number; context: TransactionContext }
> = {
  nailtech_starter_20: { tokens: 20, context: TransactionContext.IAP_PACK_20 },
  nailtech_popular_50: { tokens: 50, context: TransactionContext.IAP_PACK_50 },
  nailtech_best_150: { tokens: 150, context: TransactionContext.IAP_PACK_150 },
};

@Controller('tokens')
export class TokenController {
  private readonly logger = new Logger(TokenController.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly deviceService: DeviceService,
    private readonly configService: ConfigService,
  ) {}

  @Get('balance')
  async getBalance(@CurrentDevice() device: DeviceDocument) {
    return this.tokenService.getBalance(device._id.toString());
  }

  @Post('webhook')
  async revenueCatWebhook(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ) {
    // Verify webhook secret.
    // RevenueCat sends the Authorization header value exactly as configured
    // in their dashboard. If you set "Bearer mysecret", they send "Bearer mysecret".
    const secret = this.configService.get<string>('revenueCat.webhookSecret');
    if (secret && authHeader !== secret) {
      this.logger.warn(
        `Webhook auth failed. Expected: ${secret?.substring(0, 10)}..., Got: ${authHeader?.substring(0, 10)}...`,
      );
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const event = body?.event;
    if (!event) {
      this.logger.warn('Received webhook with no event body');
      return { received: true };
    }

    this.logger.log(
      `RevenueCat webhook: ${event.type} for ${event.app_user_id}`,
    );

    // We only handle successful purchases (INITIAL_PURCHASE and RENEWAL for consumables)
    if (
      event.type !== 'INITIAL_PURCHASE' &&
      event.type !== 'NON_RENEWING_PURCHASE'
    ) {
      return { received: true, handled: false };
    }

    const productId = event.product_id;
    const pack = PACK_MAP[productId];

    if (!pack) {
      this.logger.warn(`Unknown product ID: ${productId}`);
      return { received: true, handled: false };
    }

    // RevenueCat app_user_id maps to our device UUID
    const deviceUUID = event.app_user_id;
    const device = await this.deviceService.findByUUID(deviceUUID);

    if (!device) {
      this.logger.error(`Webhook for unknown device: ${deviceUUID}`);
      return { received: true, handled: false };
    }

    // Credit the tokens
    await this.tokenService.credit(
      device._id.toString(),
      pack.tokens,
      pack.context,
      {
        revenueCatEventId: event.id,
        productId,
        priceInPurchasedCurrency: event.price_in_purchased_currency,
        currency: event.currency,
      },
    );

    this.logger.log(`Credited ${pack.tokens} tokens to device ${deviceUUID}`);

    return { received: true, handled: true };
  }
}
