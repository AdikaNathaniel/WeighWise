import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  INGESTION_PATTERNS,
  SPC_ENGINE_PATTERNS,
  ALERTING_PATTERNS,
  CreateSubgroupDto,
  ReviewSubgroupDto,
  UpdateSubgroupDto,
  ImportSubgroupsDto,
  ImportSubgroupsResult,
  ArchivedSubgroupSet,
  RestoreSubgroupsResult,
  Subgroup,
  SubgroupReview,
  SpcSummary,
  ControlStatus,
  DashboardData,
  PaginatedSubgroups,
  ColourBatch,
  ClearColourBatchesResult,
  ClearedColourBatch,
  CreateColourBatchDto,
  RestoreColourBatchesResult,
  UpdateColourBatchDto,
  PChartData,
} from '@app/common';

@Injectable()
export class GatewayService {
  constructor(
    @Inject('INGESTION_SERVICE') private readonly ingestionClient: ClientProxy,
    @Inject('SPC_ENGINE_SERVICE') private readonly spcEngineClient: ClientProxy,
    @Inject('ALERTING_SERVICE') private readonly alertingClient: ClientProxy,
  ) {}

  createSubgroup(dto: CreateSubgroupDto): Promise<Subgroup> {
    return firstValueFrom(this.ingestionClient.send(INGESTION_PATTERNS.CREATE_SUBGROUP, dto));
  }

  listSubgroups(): Promise<Subgroup[]> {
    return firstValueFrom(this.ingestionClient.send(INGESTION_PATTERNS.LIST_SUBGROUPS, {}));
  }

  listSubgroupsPage(page: number, pageSize: number): Promise<PaginatedSubgroups> {
    return firstValueFrom(
      this.ingestionClient.send(INGESTION_PATTERNS.LIST_SUBGROUPS_PAGE, { page, pageSize }),
    );
  }

  updateSubgroup(id: string, dto: UpdateSubgroupDto): Promise<Subgroup> {
    return firstValueFrom(
      this.ingestionClient.send(INGESTION_PATTERNS.UPDATE_SUBGROUP, { id, dto }),
    );
  }

  deleteSubgroup(id: string): Promise<{ id: string }> {
    return firstValueFrom(this.ingestionClient.send(INGESTION_PATTERNS.DELETE_SUBGROUP, id));
  }

  importSubgroups(dto: ImportSubgroupsDto): Promise<ImportSubgroupsResult> {
    return firstValueFrom(this.ingestionClient.send(INGESTION_PATTERNS.IMPORT_SUBGROUPS, dto));
  }

  listArchivedSubgroups(): Promise<ArchivedSubgroupSet[]> {
    return firstValueFrom(
      this.ingestionClient.send(INGESTION_PATTERNS.LIST_ARCHIVED_SUBGROUPS, {}),
    );
  }

  restoreSubgroups(archivedAt: string): Promise<RestoreSubgroupsResult> {
    return firstValueFrom(
      this.ingestionClient.send(INGESTION_PATTERNS.RESTORE_SUBGROUPS, { archivedAt }),
    );
  }

  reviewSubgroup(id: string, dto: ReviewSubgroupDto): Promise<SubgroupReview> {
    return firstValueFrom(
      this.ingestionClient.send(INGESTION_PATTERNS.REVIEW_SUBGROUP, { id, dto }),
    );
  }

  reopenReview(id: string): Promise<{ id: string; reopened: number }> {
    return firstValueFrom(this.ingestionClient.send(INGESTION_PATTERNS.REOPEN_REVIEW, id));
  }

  private computeSummary(subgroups: Subgroup[]): Promise<SpcSummary> {
    return firstValueFrom(
      this.spcEngineClient.send<SpcSummary>(SPC_ENGINE_PATTERNS.COMPUTE_SUMMARY, subgroups),
    );
  }

  async getDashboard(): Promise<DashboardData> {
    const subgroups = await this.listSubgroups();
    const keepExclusions = (keep: (s: Subgroup) => boolean) =>
      subgroups.map((s) => (s.exclusion && !keep(s) ? { ...s, exclusion: null } : s));

    // The three stages of the chart sequence: the trial chart counts every
    // subgroup, chart 2 leaves out only the R-chart exclusions, and the
    // revised chart leaves out every confirmed exclusion.
    const [summary, rStageSummary, trialSummary] = await Promise.all([
      this.computeSummary(subgroups),
      this.computeSummary(keepExclusions((s) => s.exclusion?.chart === 'r')),
      this.computeSummary(keepExclusions(() => false)),
    ]);

    const status = await firstValueFrom(
      this.alertingClient.send<ControlStatus>(ALERTING_PATTERNS.EVALUATE_STATUS, {
        subgroups,
        summary,
      }),
    );

    return { subgroups, summary, rStageSummary, trialSummary, status };
  }

  createColourBatch(dto: CreateColourBatchDto): Promise<ColourBatch> {
    return firstValueFrom(this.ingestionClient.send(INGESTION_PATTERNS.CREATE_COLOUR_BATCH, dto));
  }

  updateColourBatch(id: string, dto: UpdateColourBatchDto): Promise<ColourBatch> {
    return firstValueFrom(
      this.ingestionClient.send(INGESTION_PATTERNS.UPDATE_COLOUR_BATCH, { id, dto }),
    );
  }

  deleteColourBatch(id: string): Promise<{ id: string }> {
    return firstValueFrom(this.ingestionClient.send(INGESTION_PATTERNS.DELETE_COLOUR_BATCH, id));
  }

  listColourBatches(): Promise<ColourBatch[]> {
    return firstValueFrom(this.ingestionClient.send(INGESTION_PATTERNS.LIST_COLOUR_BATCHES, {}));
  }

  clearColourBatches(): Promise<ClearColourBatchesResult> {
    return firstValueFrom(this.ingestionClient.send(INGESTION_PATTERNS.CLEAR_COLOUR_BATCHES, {}));
  }

  listClearedColourBatches(): Promise<ClearedColourBatch[]> {
    return firstValueFrom(
      this.ingestionClient.send(INGESTION_PATTERNS.LIST_CLEARED_COLOUR_BATCHES, {}),
    );
  }

  restoreColourBatches(clearedAt?: string): Promise<RestoreColourBatchesResult> {
    return firstValueFrom(
      this.ingestionClient.send(INGESTION_PATTERNS.RESTORE_COLOUR_BATCHES, { clearedAt }),
    );
  }

  async getPChart(): Promise<PChartData> {
    const batches = await firstValueFrom(
      this.ingestionClient.send<ColourBatch[]>(INGESTION_PATTERNS.LIST_COLOUR_BATCHES, {}),
    );
    return firstValueFrom(
      this.spcEngineClient.send<PChartData>(SPC_ENGINE_PATTERNS.COMPUTE_P_CHART, batches),
    );
  }
}
