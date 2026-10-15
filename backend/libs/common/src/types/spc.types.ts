export interface Subgroup {
  id: string;
  productionDate: string;
  sampleSize: number;
  weights: number[];
  mean: number;
  range: number;
  createdAt: string;
}

export interface ControlLimits {
  ucl: number;
  cl: number;
  lcl: number;
}

export interface SubgroupControlLimits {
  subgroupId: string;
  sampleSize: number;
  A2: number;
  D3: number;
  D4: number;
  xBar: ControlLimits;
  r: ControlLimits;
}

export interface SpcSummary {
  grandMean: number;
  averageRange: number;
  subgroupCount: number;
  totalSampleCount: number;
  limitsBySubgroup: SubgroupControlLimits[];
}

export interface OutOfControlPoint {
  subgroupId: string;
  productionDate: string;
  chart: 'x-bar' | 'r';
  value: number;
  violatedLimit: 'ucl' | 'lcl';
  limit: number;
}

export interface ControlStatus {
  isStable: boolean;
  outOfControlPoints: OutOfControlPoint[];
}

export interface DashboardData {
  subgroups: Subgroup[];
  summary: SpcSummary;
  status: ControlStatus;
}

export interface ImportSubgroupsResult {
  imported: number;
  /** How many previously active subgroups were archived by this import. */
  archived: number;
  archivedAt: string | null;
}

/** Subgroups archived together (by one upload or restore). */
export interface ArchivedSubgroupSet {
  archivedAt: string;
  subgroups: Subgroup[];
}

export interface RestoreSubgroupsResult {
  restored: number;
  archived: number;
}

export interface PaginatedSubgroups {
  subgroups: Subgroup[];
  total: number;
  page: number;
  pageSize: number;
}
