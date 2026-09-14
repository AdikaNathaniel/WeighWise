import { Module } from '@nestjs/common';
import { AlertingController } from './alerting.controller.js';
import { AlertingService } from './alerting.service.js';

@Module({
  controllers: [AlertingController],
  providers: [AlertingService],
})
export class AlertingModule {}
