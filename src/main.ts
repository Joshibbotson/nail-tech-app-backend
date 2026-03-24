import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import mongoose from 'mongoose';

async function bootstrap() {
  mongoose.set('transactionAsyncLocalStorage', true);

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.use(json({ limit: '20mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3000);

  // app.enableCors({
  //   origin: '*', // change this later
  //   credentials: true,
  //   methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  //   allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id'],
  // });

  await app.listen(port);
  console.log(`NailGlow API running on port ${port}`);
}

bootstrap();
