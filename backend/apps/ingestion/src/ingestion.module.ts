import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller.js';
import { IngestionService } from './ingestion.service.js';
import { supabaseProvider } from './supabase.provider.js';

@Module({
  controllers: [IngestionController],
  providers: [IngestionService, supabaseProvider],
})
export class IngestionModule {}
