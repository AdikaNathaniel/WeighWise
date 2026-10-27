/** An assignable-cause review that excludes its subgroup from the revised limits. */
export interface SubgroupExclusion {
  id: string;
  chart: 'x-bar' | 'r';
  rule: number;
  direction: string;
  value: number;
  limitType: 'ucl' | 'cl' | 'lcl';
  trialLimit: number;
  category: string;
  cause: string;
  found: string;
  correctiveAction: string;
  investigatedOn: string;
  createdAt: string;
}

export interface Subgroup {
  id: string;
  productionDate: string;
  sampleSize: number;
  weights: number[];
  mean: number;
  range: number;
  createdAt: string;
  /** The active assignable-cause review, or null when the subgroup counts toward the limits. */
  exclusion: SubgroupExclusion | null;
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
  /** Subgroups the limits are calculated from (excluded subgroups are not counted). */
  subgroupCount: number;
  totalSampleCount: number;
  excludedCount: number;
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
  /** Revised limits: excluded subgroups are left out of the calculation. */
  summary: SpcSummary;
  /** Trial limits: every subgroup counts, as before any assignable-cause review. */
  trialSummary: SpcSummary;
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
