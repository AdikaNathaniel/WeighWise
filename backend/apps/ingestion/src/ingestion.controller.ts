import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  INGESTION_PATTERNS,
  CreateColourBatchDto,
  CreateSubgroupDto,
  ImportSubgroupsDto,
  UpdateColourBatchDto,
  UpdateSubgroupDto,
} from '@app/common';
import { IngestionService } from './ingestion.service.js';

@Controller()
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @MessagePattern(INGESTION_PATTERNS.CREATE_SUBGROUP)
  createSubgroup(@Payload() dto: CreateSubgroupDto) {
    return this.ingestionService.createSubgroup(dto);
  }

  @MessagePattern(INGESTION_PATTERNS.LIST_SUBGROUPS)
  listSubgroups() {
    return this.ingestionService.listSubgroups();
  }

  @MessagePattern(INGESTION_PATTERNS.LIST_SUBGROUPS_PAGE)
  listSubgroupsPage(@Payload() payload: { page: number; pageSize: number }) {
    return this.ingestionService.listSubgroupsPage(payload.page, payload.pageSize);
  }

  @MessagePattern(INGESTION_PATTERNS.UPDATE_SUBGROUP)
  updateSubgroup(@Payload() payload: { id: string; dto: UpdateSubgroupDto }) {
    return this.ingestionService.updateSubgroup(payload.id, payload.dto);
  }

  @MessagePattern(INGESTION_PATTERNS.DELETE_SUBGROUP)
  deleteSubgroup(@Payload() id: string) {
    return this.ingestionService.deleteSubgroup(id);
  }

  @MessagePattern(INGESTION_PATTERNS.IMPORT_SUBGROUPS)
  importSubgroups(@Payload() dto: ImportSubgroupsDto) {
    return this.ingestionService.importSubgroups(dto.subgroups);
  }

  @MessagePattern(INGESTION_PATTERNS.LIST_ARCHIVED_SUBGROUPS)
  listArchivedSubgroups() {
    return this.ingestionService.listArchivedSubgroups();
  }

  @MessagePattern(INGESTION_PATTERNS.RESTORE_SUBGROUPS)
  restoreSubgroups(@Payload() payload: { archivedAt: string }) {
    return this.ingestionService.restoreSubgroups(payload.archivedAt);
  }

  @MessagePattern(INGESTION_PATTERNS.CREATE_COLOUR_BATCH)
  createColourBatch(@Payload() dto: CreateColourBatchDto) {
    return this.ingestionService.createColourBatch(dto);
  }

  @MessagePattern(INGESTION_PATTERNS.LIST_COLOUR_BATCHES)
  listColourBatches() {
    return this.ingestionService.listColourBatches();
  }

  @MessagePattern(INGESTION_PATTERNS.UPDATE_COLOUR_BATCH)
  updateColourBatch(@Payload() payload: { id: string; dto: UpdateColourBatchDto }) {
    return this.ingestionService.updateColourBatch(payload.id, payload.dto);
  }

  @MessagePattern(INGESTION_PATTERNS.DELETE_COLOUR_BATCH)
  deleteColourBatch(@Payload() id: string) {
    return this.ingestionService.deleteColourBatch(id);
  }

  @MessagePattern(INGESTION_PATTERNS.CLEAR_COLOUR_BATCHES)
  clearColourBatches() {
    return this.ingestionService.clearColourBatches();
  }

  @MessagePattern(INGESTION_PATTERNS.LIST_CLEARED_COLOUR_BATCHES)
  listClearedColourBatches() {
    return this.ingestionService.listClearedColourBatches();
  }

  @MessagePattern(INGESTION_PATTERNS.RESTORE_COLOUR_BATCHES)
  restoreColourBatches(@Payload() payload: { clearedAt?: string }) {
    return this.ingestionService.restoreColourBatches(payload?.clearedAt);
  }
}
