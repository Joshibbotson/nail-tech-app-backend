import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
}));

export const mongoConfig = registerAs('mongo', () => ({
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nailtech',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const s3Config = registerAs('s3', () => ({
  region: process.env.AWS_REGION || 'eu-west-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  bucket: process.env.S3_BUCKET || 'nailtech-images',
}));

export const falConfig = registerAs('fal', () => ({
  key: process.env.FAL_KEY,
}));

export const revenueCatConfig = registerAs('revenueCat', () => ({
  webhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET,
}));
