import { Module } from '@nestjs/common';
import { SpcEngineController } from './spc-engine.controller.js';
import { SpcEngineService } from './spc-engine.service.js';

@Module({
  controllers: [SpcEngineController],
  providers: [SpcEngineService],
})
export class SpcEngineModule {}
