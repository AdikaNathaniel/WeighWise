import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AlertingModule } from './alerting.module.js';

async function bootstrap() {
  const port = Number(process.env.ALERTING_TCP_PORT) || 4003;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AlertingModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.ALERTING_HOST ?? '127.0.0.1',
      port,
    },
  });
  await app.listen();
  console.log(`Alerting microservice listening on TCP ${port}`);
}
await bootstrap();
