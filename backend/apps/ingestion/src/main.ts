import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { IngestionModule } from './ingestion.module.js';

async function bootstrap() {
  const port = Number(process.env.INGESTION_TCP_PORT) || 4001;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(IngestionModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.INGESTION_HOST ?? '127.0.0.1',
      port,
    },
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen();
  console.log(`Ingestion microservice listening on TCP ${port}`);
}
await bootstrap();
