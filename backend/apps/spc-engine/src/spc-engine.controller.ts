import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SPC_ENGINE_PATTERNS, Subgroup } from '@app/common';
import { SpcEngineService } from './spc-engine.service.js';

@Controller()
export class SpcEngineController {
  constructor(private readonly spcEngineService: SpcEngineService) {}

  @MessagePattern(SPC_ENGINE_PATTERNS.COMPUTE_SUMMARY)
  computeSummary(@Payload() subgroups: Subgroup[]) {
    return this.spcEngineService.computeSummary(subgroups);
  }
}
