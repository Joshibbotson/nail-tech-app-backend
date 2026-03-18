import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import {
  appConfig,
  mongoConfig,
  redisConfig,
  s3Config,
  falConfig,
  openaiConfig,
  revenueCatConfig,
} from './config/config';
import { DeviceModule } from './device/device.module';
import { TokenModule } from './token/token.module';
import { EnhancementModule } from './enhancement/enhancement.module';
import { StyleModule } from './style/style.module';
import { BackgroundModule } from './background/background.module';
import { DeviceMiddleware } from './common/Device.middleware';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        mongoConfig,
        redisConfig,
        s3Config,
        falConfig,
        openaiConfig,
        revenueCatConfig,
      ],
    }),

    // MongoDB
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongo.uri'),
      }),
    }),

    // BullMQ (Redis-backed job queue for async enhancement processing)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
        },
      }),
    }),

    // Feature modules
    DeviceModule,
    TokenModule,
    EnhancementModule,
    StyleModule,
    BackgroundModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(DeviceMiddleware)
      .exclude(
        { path: 'devices/register', method: RequestMethod.POST },
        { path: 'tokens/webhook', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
