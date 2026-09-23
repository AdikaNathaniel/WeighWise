export interface ColourBatch {
  id: string;
  batchLabel: string;
  productionDate: string | null;
  samplesInspected: number;
  nonconforming: number;
  createdAt: string;
}

export type ColourBatchStatus = 'in-control' | 'out-of-control';

/** One plotted point of the p-chart. All proportions are fractions (0–1). */
export interface PChartPoint {
  batchId: string;
  batchLabel: string;
  productionDate: string | null;
  samplesInspected: number;
  nonconforming: number;
  conforming: number;
  proportion: number;
  sigma: number;
  cl: number;
  ucl: number;
  lcl: number;
  status: ColourBatchStatus;
  violatedLimit: 'ucl' | 'lcl' | null;
}

export interface PChartSummary {
  totalBatches: number;
  totalSamples: number;
  totalNonconforming: number;
  /** p-bar = Σd / Σn, or null when no batches have been entered. */
  overallProportion: number | null;
  outOfControlCount: number;
  isStable: boolean;
}

export interface PChartData {
  points: PChartPoint[];
  summary: PChartSummary;
}
