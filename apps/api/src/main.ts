import '@bahrawy/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { env } from '@bahrawy/config';
import cookieParser from 'cookie-parser';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', env.PROXY_TRUST);
  app.enableCors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3002',
      process.env.ACADEMY_WEB_URL,
      process.env.STAFF_ADMIN_URL,
    ].filter(Boolean),
    credentials: true,
  });
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const server = app.getHttpServer();
  server.requestTimeout = 2 * 60 * 60 * 1000;
  server.headersTimeout = 2 * 60 * 60 * 1000 + 5_000;
  await app.listen(env.PORT ?? 3000);
}
void bootstrap();
