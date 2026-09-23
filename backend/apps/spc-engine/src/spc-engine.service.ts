import { Injectable } from '@nestjs/common';
import {
  ColourBatch,
  getControlChartConstants,
  PChartData,
  PChartPoint,
  Subgroup,
  SpcSummary,
  SubgroupControlLimits,
} from '@app/common';

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

  /**
   * p-chart for the proportion of nonconforming (off-colour) samples per batch:
   *   p_i   = d_i / n_i
   *   p-bar = Σd / Σn          (weighted by batch size, not a mean of p_i)
   *   σ_i   = √(p-bar(1 − p-bar) / n_i)
   *   UCL_i = min(1, p-bar + 3σ_i),  LCL_i = max(0, p-bar − 3σ_i)
   * Limits vary per batch because n_i varies. Batches with invalid counts are
   * skipped rather than plotted as zero.
   */
  computePChart(batches: ColourBatch[]): PChartData {
    const valid = batches.filter(
      (b) =>
        Number.isInteger(b.samplesInspected) &&
        Number.isInteger(b.nonconforming) &&
        b.samplesInspected > 0 &&
        b.nonconforming >= 0 &&
        b.nonconforming <= b.samplesInspected,
    );

    if (valid.length === 0) {
      return {
        points: [],
        summary: {
          totalBatches: 0,
          totalSamples: 0,
          totalNonconforming: 0,
          overallProportion: null,
          outOfControlCount: 0,
          isStable: true,
        },
      };
    }

    const totalSamples = valid.reduce((sum, b) => sum + b.samplesInspected, 0);
    const totalNonconforming = valid.reduce((sum, b) => sum + b.nonconforming, 0);
    const pBar = totalNonconforming / totalSamples;

    const points: PChartPoint[] = valid.map((b) => {
      const proportion = b.nonconforming / b.samplesInspected;
      const sigma = Math.sqrt((pBar * (1 - pBar)) / b.samplesInspected);
      const ucl = Math.min(1, pBar + 3 * sigma);
      const lcl = Math.max(0, pBar - 3 * sigma);
      const violatedLimit = proportion > ucl ? 'ucl' : proportion < lcl ? 'lcl' : null;
      return {
        batchId: b.id,
        batchLabel: b.batchLabel,
        productionDate: b.productionDate,
        samplesInspected: b.samplesInspected,
        nonconforming: b.nonconforming,
        conforming: b.samplesInspected - b.nonconforming,
        proportion,
        sigma,
        cl: pBar,
        ucl,
        lcl,
        status: violatedLimit ? 'out-of-control' : 'in-control',
        violatedLimit,
      };
    });

    const outOfControlCount = points.filter((p) => p.status === 'out-of-control').length;

    return {
      points,
      summary: {
        totalBatches: points.length,
        totalSamples,
        totalNonconforming,
        overallProportion: pBar,
        outOfControlCount,
        isStable: outOfControlCount === 0,
      },
    };
  }
}
