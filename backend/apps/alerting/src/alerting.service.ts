import { Injectable } from '@nestjs/common';
import { ControlStatus, OutOfControlPoint, Subgroup, SpcSummary } from '@app/common';

export interface EvaluateStatusPayload {
  subgroups: Subgroup[];
  summary: SpcSummary;
}

@Injectable()
export class AlertingService {
  evaluateStatus({ subgroups, summary }: EvaluateStatusPayload): ControlStatus {
    const outOfControlPoints: OutOfControlPoint[] = [];

    for (const subgroup of subgroups) {
      const limits = summary.limitsBySubgroup.find((l) => l.subgroupId === subgroup.id);
      if (!limits) continue;

      this.checkLimit(outOfControlPoints, subgroup, 'x-bar', subgroup.mean, limits.xBar);
      this.checkLimit(outOfControlPoints, subgroup, 'r', subgroup.range, limits.r);
    }

    return { isStable: outOfControlPoints.length === 0, outOfControlPoints };
  }

  private checkLimit(
    points: OutOfControlPoint[],
    subgroup: Subgroup,
    chart: 'x-bar' | 'r',
    value: number,
    limit: { ucl: number; lcl: number },
  ): void {
    if (value > limit.ucl) {
      points.push({
        subgroupId: subgroup.id,
        productionDate: subgroup.productionDate,
        chart,
        value,
        violatedLimit: 'ucl',
        limit: limit.ucl,
      });
    } else if (value < limit.lcl) {
      points.push({
        subgroupId: subgroup.id,
        productionDate: subgroup.productionDate,
        chart,
        value,
        violatedLimit: 'lcl',
        limit: limit.lcl,
      });
    }
  }
}
