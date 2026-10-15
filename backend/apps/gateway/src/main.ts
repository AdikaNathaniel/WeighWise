import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { GatewayModule } from './gateway.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(GatewayModule);
  // Spreadsheet imports send every subgroup in one request; the 100kb default
  // is too small for a few hundred subgroups.
  app.useBodyParser('json', { limit: '2mb' });
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000' });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  // Render injects PORT; GATEWAY_PORT is kept for local dev
  const port = Number(process.env.PORT) || Number(process.env.GATEWAY_PORT) || 3001;
  await app.listen(port);
  console.log(`Gateway HTTP listening on port ${port}`);
}
await bootstrap();
