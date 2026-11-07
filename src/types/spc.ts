import type { ReviewOutcome } from '@/lib/assignableCauses';

/**
 * The investigation of one subgroup's signal. Every outcome is recorded; only
 * a confirmed, evidenced cause may exclude the subgroup from the revised limits.
 */
export interface SubgroupReview {
  id: string;
  /** The signal that prompted the review, as seen when it was investigated. */
  chart: 'x-bar' | 'r';
  rule: number;
  direction: string;
  value: number;
  limitType: 'ucl' | 'cl' | 'lcl';
  trialLimit: number;
  outcome: ReviewOutcome;
  /** True when the whole subgroup is left out of the revised limits. */
  excluded: boolean;
  /** Primary cause category (the suspected one when the outcome is "possible"). */
  category: string | null;
  causes: string[];
  evidence: string[];
  found: string | null;
  correctiveAction: string | null;
  followUp: string | null;
  reviewer: string | null;
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
  /** The active review of this subgroup's signal, whatever its outcome. */
  review: SubgroupReview | null;
  /** The active review when it excludes the subgroup; null when the subgroup counts toward the limits. */
  exclusion: SubgroupReview | null;
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
  /** Limits after the R-chart investigation only (chart 2): just the R-chart exclusions are left out. */
  rStageSummary: SpcSummary;
  /** Trial limits: every subgroup counts, as before any assignable-cause review. */
  trialSummary: SpcSummary;
  status: ControlStatus;
}

export interface CreateSubgroupInput {
  productionDate: string;
  sampleSize: number;
  weights: number[];
}

export interface UpdateSubgroupInput {
  productionDate: string;
  sampleSize: number;
  weights: number[];
}

export interface ReviewSubgroupInput {
  chart: 'x-bar' | 'r';
  rule: number;
  direction: string;
  value: number;
  limitType: 'ucl' | 'cl' | 'lcl';
  trialLimit: number;
  outcome: ReviewOutcome;
  /** Exclude the whole subgroup (true) or retain it (false). */
  excluded: boolean;
  category: string | null;
  causes: string[];
  evidence: string[];
  found: string | null;
  correctiveAction: string | null;
  followUp: string | null;
  reviewer: string;
  investigatedOn: string;
  /** Required (true) when the subgroup is excluded. */
  confirmed?: boolean;
}

export interface ImportSubgroupsResult {
  imported: number;
  archived: number;
  archivedAt: string | null;
}

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
