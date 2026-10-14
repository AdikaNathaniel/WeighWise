import { ColourBatch } from '@app/common';
import { SpcEngineService } from './spc-engine.service.js';

// Batches 1–15 from Tom_Brown_Colour_P_Chart_Calculator.xlsx: [n, d]
const WORKBOOK_BATCHES: [number, number][] = [
  [24, 5], [31, 7], [21, 3], [22, 6], [40, 5], [25, 6], [15, 2], [12, 1],
  [24, 2], [70, 30], [31, 3], [23, 5], [17, 2], [16, 4], [19, 4],
];

// All 25 batches from updates/tom-brown-updates/Tom_Brown_Colour_P_Chart_Calculator.xlsx
// with the workbook's own calculated values: [n, d, p, σp, UCL, LCL, status]
const WORKBOOK_25: [number, number, number, number, number, number, string][] = [
  [24, 9, 0.375, 0.08969776421784297, 0.5305488182599979, 0, 'IN CONTROL'],
  [31, 12, 0.3870967741935484, 0.07892351007847348, 0.49822605584188945, 0.024684995371048568, 'IN CONTROL'],
  [21, 4, 0.19047619047619047, 0.09589094344651414, 0.5491283559460114, 0, 'IN CONTROL'],
  [22, 14, 0.6363636363636364, 0.09368625923705384, 0.5425143033176305, 0, 'OUT OF CONTROL'],
  [40, 5, 0.125, 0.06947958940154908, 0.46989429381111625, 0.05301675740182177, 'IN CONTROL'],
  [25, 6, 0.24, 0.08788550136087614, 0.5251120296890974, 0, 'IN CONTROL'],
  [15, 7, 0.4666666666666667, 0.11345969438125418, 0.6018346087502315, 0, 'IN CONTROL'],
  [12, 8, 0.6666666666666666, 0.12685179467141763, 0.6420109096207219, 0, 'OUT OF CONTROL'],
  [24, 13, 0.5416666666666666, 0.08969776421784297, 0.5305488182599979, 0, 'OUT OF CONTROL'],
  [70, 30, 0.42857142857142855, 0.05252163278610797, 0.4190204239647929, 0.1038906272481451, 'OUT OF CONTROL'],
  [31, 3, 0.0967741935483871, 0.07892351007847348, 0.49822605584188945, 0.024684995371048568, 'IN CONTROL'],
  [23, 16, 0.6956521739130435, 0.09162696910187668, 0.536336432912099, 0, 'OUT OF CONTROL'],
  [17, 2, 0.11764705882352941, 0.10657682502095793, 0.5811860006693428, 0, 'IN CONTROL'],
  [16, 4, 0.25, 0.10985687670109517, 0.5910261557097545, 0, 'IN CONTROL'],
  [52, 9, 0.17307692307692307, 0.060937631062788294, 0.4442684187948339, 0.07864263241810412, 'IN CONTROL'],
  [28, 4, 0.14285714285714285, 0.08304399301753818, 0.5105875046590835, 0.01232354655385448, 'IN CONTROL'],
  [20, 16, 0.8, 0.09825897763978465, 0.5562324585258229, 0, 'OUT OF CONTROL'],
  [20, 0, 0, 0.09825897763978465, 0.5562324585258229, 0, 'IN CONTROL'],
  [20, 3, 0.15, 0.09825897763978465, 0.5562324585258229, 0, 'IN CONTROL'],
  [60, 4, 0.06666666666666667, 0.05672984719062709, 0.4316450671783503, 0.09126598403458774, 'OUT OF CONTROL'],
  [18, 2, 0.1111111111111111, 0.10357405663375845, 0.5721776955077443, 0, 'IN CONTROL'],
  [50, 5, 0.1, 0.062144433980255064, 0.4478888275472342, 0.07502222366570382, 'IN CONTROL'],
  [25, 6, 0.24, 0.08788550136087614, 0.5251120296890974, 0, 'IN CONTROL'],
  [28, 8, 0.2857142857142857, 0.08304399301753818, 0.5105875046590835, 0.01232354655385448, 'IN CONTROL'],
  [50, 4, 0.08, 0.062144433980255064, 0.4478888275472342, 0.07502222366570382, 'IN CONTROL'],
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

describe('SpcEngineService.computePChart — 25-batch workbook', () => {
  const service = new SpcEngineService();
  const { points, summary } = service.computePChart(
    toBatches(WORKBOOK_25.map(([n, d]) => [n, d])),
  );

  it('matches the workbook totals and p-bar', () => {
    expect(summary.totalBatches).toBe(25);
    expect(summary.totalSamples).toBe(742);
    expect(summary.totalNonconforming).toBe(194);
    expect(summary.overallProportion).toBeCloseTo(0.261455525606469, 12);
  });

  it.each(WORKBOOK_25.map((row, i) => [i + 1, row] as const))(
    'batch %i matches the workbook p, σ, limits and status',
    (batchNo, [, , p, sigma, ucl, lcl, status]) => {
      const point = points[batchNo - 1];
      expect(point.proportion).toBeCloseTo(p, 12);
      expect(point.sigma).toBeCloseTo(sigma, 12);
      expect(point.cl).toBeCloseTo(0.261455525606469, 12);
      expect(point.ucl).toBeCloseTo(ucl, 12);
      expect(point.lcl).toBeCloseTo(lcl, 12);
      expect(point.status).toBe(status === 'OUT OF CONTROL' ? 'out-of-control' : 'in-control');
    },
  );

  it('flags the same 7 batches as the workbook', () => {
    expect(summary.outOfControlCount).toBe(7);
    expect(
      points.filter((pt) => pt.status === 'out-of-control').map((pt) => pt.batchLabel),
    ).toEqual(['4', '8', '9', '10', '12', '17', '20']);
    expect(points[19].violatedLimit).toBe('lcl');
  });
});
