import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { INGESTION_PATTERNS, CreateSubgroupDto, UpdateSubgroupDto } from '@app/common';
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
}
