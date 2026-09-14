import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  INGESTION_PATTERNS,
  SPC_ENGINE_PATTERNS,
  ALERTING_PATTERNS,
  CreateSubgroupDto,
  Subgroup,
  SpcSummary,
  ControlStatus,
  DashboardData,
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

  deleteSubgroup(id: string): Promise<{ id: string }> {
    return firstValueFrom(this.ingestionClient.send(INGESTION_PATTERNS.DELETE_SUBGROUP, id));
  }

  async getDashboard(): Promise<DashboardData> {
    const subgroups = await this.listSubgroups();

    const summary = await firstValueFrom(
      this.spcEngineClient.send<SpcSummary>(SPC_ENGINE_PATTERNS.COMPUTE_SUMMARY, subgroups),
    );

    const status = await firstValueFrom(
      this.alertingClient.send<ControlStatus>(ALERTING_PATTERNS.EVALUATE_STATUS, {
        subgroups,
        summary,
      }),
    );

    return { subgroups, summary, status };
  }
}
