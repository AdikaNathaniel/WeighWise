import { ColourBatch } from '@app/common';
import { SpcEngineService } from './spc-engine.service.js';

// Batches 1–15 from Tom_Brown_Colour_P_Chart_Calculator.xlsx: [n, d]
const WORKBOOK_BATCHES: [number, number][] = [
  [24, 5], [31, 7], [21, 3], [22, 6], [40, 5], [25, 6], [15, 2], [12, 1],
  [24, 2], [70, 30], [31, 3], [23, 5], [17, 2], [16, 4], [19, 4],
];

function toBatches(rows: [number, number][]): ColourBatch[] {
  return rows.map(([n, d], i) => ({
    id: `b${i + 1}`,
    batchLabel: String(i + 1),
    productionDate: null,
    samplesInspected: n,
    nonconforming: d,
    createdAt: '2026-09-01T00:00:00Z',
  }));
}

describe('SpcEngineService.computePChart', () => {
  const service = new SpcEngineService();

  it('reproduces the workbook calculations', () => {
    const { points, summary } = service.computePChart(toBatches(WORKBOOK_BATCHES));
    const pBar = 85 / 390;

    expect(summary.totalBatches).toBe(15);
    expect(summary.totalSamples).toBe(390);
    expect(summary.totalNonconforming).toBe(85);
    expect(summary.overallProportion).toBeCloseTo(pBar, 12);

    const batch10 = points[9];
    const sigma = Math.sqrt((pBar * (1 - pBar)) / 70);
    expect(batch10.proportion).toBeCloseTo(30 / 70, 12);
    expect(batch10.sigma).toBeCloseTo(sigma, 12);
    expect(batch10.ucl).toBeCloseTo(pBar + 3 * sigma, 12);
    expect(batch10.lcl).toBeCloseTo(Math.max(0, pBar - 3 * sigma), 12);
    expect(batch10.status).toBe('out-of-control');
    expect(batch10.violatedLimit).toBe('ucl');

    expect(summary.outOfControlCount).toBe(1);
    expect(summary.isStable).toBe(false);
    expect(points.filter((p) => p.status === 'in-control')).toHaveLength(14);
  });

  it('clamps limits to [0, 1] and varies them with batch size', () => {
    const { points } = service.computePChart(toBatches([[12, 1], [70, 30]]));
    expect(points[0].lcl).toBe(0);
    expect(points[0].ucl).toBeLessThanOrEqual(1);
    expect(points[0].ucl).toBeGreaterThan(points[1].ucl);
  });

  it('flags a batch below the LCL', () => {
    const rows: [number, number][] = [...Array(10).fill([100, 30]), [100, 5]];
    const { points } = service.computePChart(toBatches(rows));
    expect(points[10].violatedLimit).toBe('lcl');
    expect(points[10].status).toBe('out-of-control');
  });

  it('skips invalid batches instead of plotting them as zero', () => {
    const { points, summary } = service.computePChart(
      toBatches([[20, 2], [0, 0], [10, 11], [20, 4]]),
    );
    expect(points.map((p) => p.batchId)).toEqual(['b1', 'b4']);
    expect(summary.totalSamples).toBe(40);
  });

  it('returns an empty chart when there are no batches', () => {
    const { points, summary } = service.computePChart([]);
    expect(points).toEqual([]);
    expect(summary.overallProportion).toBeNull();
    expect(summary.isStable).toBe(true);
  });
});
