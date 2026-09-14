import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ALERTING_PATTERNS } from '@app/common';
import { AlertingService } from './alerting.service.js';
import type { EvaluateStatusPayload } from './alerting.service.js';

@Controller()
export class AlertingController {
  constructor(private readonly alertingService: AlertingService) {}

  @MessagePattern(ALERTING_PATTERNS.EVALUATE_STATUS)
  evaluateStatus(@Payload() payload: EvaluateStatusPayload) {
    return this.alertingService.evaluateStatus(payload);
  }
}
