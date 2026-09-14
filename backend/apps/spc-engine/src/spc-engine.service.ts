import { Injectable } from '@nestjs/common';
import { getControlChartConstants, Subgroup, SpcSummary, SubgroupControlLimits } from '@app/common';

@Injectable()
export class SpcEngineService {
  /**
   * Grand mean is the weighted average of subgroup means (weighted by each
   * subgroup's own sample size), which is equivalent to averaging every
   * individual sample directly. This is the correct estimator when subgroup
   * size (n) varies between production dates -- a simple average of means
   * would over-weight small subgroups.
   */
  computeSummary(subgroups: Subgroup[]): SpcSummary {
    if (subgroups.length === 0) {
      return {
        grandMean: 0,
        averageRange: 0,
        subgroupCount: 0,
        totalSampleCount: 0,
        limitsBySubgroup: [],
      };
    }

    const totalSampleCount = subgroups.reduce((sum, s) => sum + s.sampleSize, 0);
    const grandMean =
      subgroups.reduce((sum, s) => sum + s.mean * s.sampleSize, 0) / totalSampleCount;
    const averageRange = subgroups.reduce((sum, s) => sum + s.range, 0) / subgroups.length;

    const limitsBySubgroup: SubgroupControlLimits[] = subgroups.map((s) => {
      const { A2, D3, D4 } = getControlChartConstants(s.sampleSize);
      return {
        subgroupId: s.id,
        sampleSize: s.sampleSize,
        A2,
        D3,
        D4,
        xBar: {
          ucl: grandMean + A2 * averageRange,
          cl: grandMean,
          lcl: grandMean - A2 * averageRange,
        },
        r: {
          ucl: D4 * averageRange,
          cl: averageRange,
          lcl: D3 * averageRange,
        },
      };
    });

    return {
      grandMean,
      averageRange,
      subgroupCount: subgroups.length,
      totalSampleCount,
      limitsBySubgroup,
    };
  }
}
