import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SpcEngineModule } from './spc-engine.module.js';

async function bootstrap() {
  const port = Number(process.env.SPC_ENGINE_TCP_PORT) || 4002;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(SpcEngineModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.SPC_ENGINE_HOST ?? '127.0.0.1',
      port,
    },
  });
  await app.listen();
  console.log(`SPC engine microservice listening on TCP ${port}`);
}
await bootstrap();
