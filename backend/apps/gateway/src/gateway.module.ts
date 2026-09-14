import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GatewayController } from './gateway.controller.js';
import { GatewayService } from './gateway.service.js';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'INGESTION_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.INGESTION_HOST ?? '127.0.0.1',
          port: Number(process.env.INGESTION_TCP_PORT) || 4001,
        },
      },
      {
        name: 'SPC_ENGINE_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.SPC_ENGINE_HOST ?? '127.0.0.1',
          port: Number(process.env.SPC_ENGINE_TCP_PORT) || 4002,
        },
      },
      {
        name: 'ALERTING_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.ALERTING_HOST ?? '127.0.0.1',
          port: Number(process.env.ALERTING_TCP_PORT) || 4003,
        },
      },
    ]),
  ],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
