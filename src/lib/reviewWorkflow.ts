import { detectSignals, RANGE_CHART_RULES, rulesByPoint, splitSignals } from './nelsonRules';
import type { RuleId, RulePoint, RuleSignal } from './nelsonRules';
import { buildReviewItems } from './signalReview';
import type { ChartKind, ReviewItem } from './signalReview';
import type { DashboardData, SpcSummary, Subgroup } from '@/types/spc';

/**
 * The Review Signal workflow: the trial X-bar and R chart (chart 1), the
 * revision after the R-chart investigation (chart 2) and the revision after
 * the X-bar investigation (chart 3). The R chart is investigated first; the
 * X-bar chart only once every R-chart signal has been reviewed.
 */

/** One subgroup at its original position on a chart. */
export interface StagePoint {
  subgroupId: string;
  /** Subgroup number in production order — never renumbered after an exclusion. */
  number: number;
  date: string;
  /** The plotted statistic of a retained subgroup; null when excluded. */
  value: number | null;
  /** The statistic of an excluded subgroup, drawn as a grey X off the line. */
  excludedValue: number | null;
  ucl: number;
  cl: number;
  lcl: number;
  /** Tests whose signals include this point (always empty when excluded); rule 1 means beyond the limits. */
  rules: RuleId[];
}

export interface ChartAnalysis {
  chart: ChartKind;
  /** Retained subgroups in plotting order — the points the tests run on. */
  subgroups: Subgroup[];
  points: RulePoint[];
  /** Every enabled test's signals. */
  signals: RuleSignal[];
  /** Points beyond the control limits — investigated, and decide the in-control status. */
  alarms: RuleSignal[];
  /** Pattern signals (rules 2–8) — shown to watch, never investigated. */
  warnings: RuleSignal[];
  /** Every subgroup, retained and excluded, at its original position. */
  chartData: StagePoint[];
}

export type StageKind = 'trial' | 'after-r' | 'after-x-bar';

export interface ChartStage {
  kind: StageKind;
  summary: SpcSummary;
  /** Numbers of the subgroups left out of this stage's limits. */
  excludedNumbers: number[];
  xBar: ChartAnalysis;
  r: ChartAnalysis;
  rInControl: boolean;
  xBarInControl: boolean;
}

export type Phase = 'r' | 'x-bar' | 'complete';

export interface ProcessStatus {
  inControl: boolean;
  label: 'Process in control' | 'Process not in control';
  /** Why — so the status never rests on colour alone. */
  reason: string;
}

export interface Workflow {
  stages: ChartStage[];
  /** The latest stage: the chart the investigation is working on. */
  current: ChartStage;
  phase: Phase;
  /** Subgroups signalling on the current R / X-bar chart, with their review state. */
  rItems: ReviewItem[];
  xBarItems: ReviewItem[];
  /** Signalling subgroups not yet reviewed. */
  pendingR: ReviewItem[];
  pendingXBar: ReviewItem[];
  status: ProcessStatus;
}

export function analyseChart(
  all: Subgroup[],
  summary: SpcSummary,
  chart: ChartKind,
  enabled: RuleId[],
  excludedIds: Set<string>,
): ChartAnalysis {
  const band = (s: Subgroup) => {
    const limits = summary.limitsBySubgroup.find((l) => l.subgroupId === s.id);
    const b = chart === 'x-bar' ? limits?.xBar : limits?.r;
    return { ucl: b?.ucl ?? 0, cl: b?.cl ?? 0, lcl: b?.lcl ?? 0 };
  };
  const statistic = (s: Subgroup) => (chart === 'x-bar' ? s.mean : s.range);

  const retained = all.filter((s) => !excludedIds.has(s.id));
  const points: RulePoint[] = retained.map((s) => {
    const { ucl, cl, lcl } = band(s);
    // Limits are 3σ from the centre line, so σ is a third of that distance.
    return { value: statistic(s), ucl, cl, lcl, sigma: (ucl - cl) / 3 };
  });
  const rules = chart === 'r' ? enabled.filter((r) => RANGE_CHART_RULES.includes(r)) : enabled;
  const signals = detectSignals(points, rules);
  const rulesAt = rulesByPoint(signals, points.length);
  const retainedIndex = new Map(retained.map((s, i) => [s.id, i]));

  const chartData = all.map((s, i): StagePoint => {
    const ri = retainedIndex.get(s.id);
    return {
      subgroupId: s.id,
      number: i + 1,
      date: s.productionDate,
      value: ri === undefined ? null : statistic(s),
      excludedValue: ri === undefined ? statistic(s) : null,
      ...band(s),
      rules: ri === undefined ? [] : rulesAt[ri],
    };
  });

  return { chart, subgroups: retained, points, signals, ...splitSignals(signals), chartData };
}

function makeStage(
  kind: StageKind,
  all: Subgroup[],
  summary: SpcSummary,
  excludedIds: Set<string>,
  enabled: RuleId[],
): ChartStage {
  const xBar = analyseChart(all, summary, 'x-bar', enabled, excludedIds);
  const r = analyseChart(all, summary, 'r', enabled, excludedIds);
  return {
    kind,
    summary,
    excludedNumbers: all.flatMap((s, i) => (excludedIds.has(s.id) ? [i + 1] : [])),
    xBar,
    r,
    // Only points beyond the limits take a chart out of control; pattern warnings do not.
    rInControl: r.alarms.length === 0,
    xBarInControl: xBar.alarms.length === 0,
  };
}

/** Chart 1 always; chart 2 once R-chart exclusions exist; chart 3 once X-bar exclusions exist. */
export function buildStages(data: DashboardData, enabled: RuleId[]): ChartStage[] {
  const all = data.subgroups;
  const ids = (keep: (s: Subgroup) => boolean) => new Set(all.filter(keep).map((s) => s.id));
  const afterR = ids((s) => s.exclusion?.chart === 'r');
  const afterXBar = ids((s) => s.exclusion !== null);

  const stages = [makeStage('trial', all, data.trialSummary, new Set(), enabled)];
  if (afterR.size > 0) stages.push(makeStage('after-r', all, data.rStageSummary, afterR, enabled));
  if (afterXBar.size > afterR.size) {
    stages.push(makeStage('after-x-bar', all, data.summary, afterXBar, enabled));
  }
  return stages;
}

function flaggedCount(signals: RuleSignal[]): number {
  return new Set(signals.flatMap((s) => s.flagged)).size;
}

/** " 3 subgroups show pattern warnings to watch." — or nothing when there are none. */
function warningNote(stage: ChartStage): string {
  const n = new Set([
    ...stage.xBar.warnings.flatMap((s) => s.flagged.map((i) => stage.xBar.subgroups[i]?.id)),
    ...stage.r.warnings.flatMap((s) => s.flagged.map((i) => stage.r.subgroups[i]?.id)),
  ]).size;
  if (n === 0) return '';
  return ` ${plural(n, 'subgroup')} ${n === 1 ? 'shows a pattern warning' : 'show pattern warnings'} to watch (no investigation needed).`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function stageStatus(stage: ChartStage, phase: Phase): ProcessStatus {
  const inControl = stage.rInControl && stage.xBarInControl;
  if (inControl) {
    return {
      inControl,
      label: 'Process in control',
      reason: `No point is outside the control limits on the X-bar or R chart.${warningNote(stage)}`,
    };
  }
  const retained = phase === 'complete' ? 'retained ' : '';
  const parts = [
    stage.xBarInControl ? null : `${plural(flaggedCount(stage.xBar.alarms), `${retained}subgroup`)} on the X-bar chart`,
    stage.rInControl ? null : `${plural(flaggedCount(stage.r.alarms), `${retained}subgroup`)} on the R chart`,
  ].filter(Boolean);
  return {
    inControl,
    label: 'Process not in control',
    reason: `Points outside the control limits: ${parts.join(' and ')}.`,
  };
}

export function buildWorkflow(data: DashboardData, enabled: RuleId[]): Workflow {
  const stages = buildStages(data, enabled);
  const current = stages[stages.length - 1];
  const rItems = buildReviewItems(data.subgroups, [current.r]);
  const xBarItems = buildReviewItems(data.subgroups, [current.xBar]);
  const pendingR = rItems.filter((i) => !i.subgroup.review);
  const pendingXBar = xBarItems.filter((i) => !i.subgroup.review);
  const phase: Phase = pendingR.length > 0 ? 'r' : pendingXBar.length > 0 ? 'x-bar' : 'complete';
  return {
    stages,
    current,
    phase,
    rItems,
    xBarItems,
    pendingR,
    pendingXBar,
    status: stageStatus(current, phase),
  };
}

export const STAGE_TITLES: Record<StageKind, string> = {
  trial: 'Initial trial X-bar and R chart',
  'after-r': 'Revised chart after R-chart investigation',
  'after-x-bar': 'Revised chart after X-bar investigation',
};

export function stageTitle(stage: ChartStage, workflow: Workflow): string {
  const isFinal = stage === workflow.current && workflow.phase === 'complete' && stage.kind !== 'trial';
  return isFinal ? 'Final revised X-bar and R chart' : STAGE_TITLES[stage.kind];
}

/** The badge for one stage, as in the design guide's chart sequence. */
export function stageBadge(stage: ChartStage, phase: Phase): string {
  if (stage.rInControl && stage.xBarInControl) return 'Process in control';
  if (stage.kind === 'after-r' && stage.rInControl) return 'R chart in control';
  return stageStatus(stage, phase).label;
}

/** "Subgroups 7 and 8 excluded", "Subgroups 7, 8 and 10 excluded". */
export function excludedSummary(numbers: number[]): string {
  if (numbers.length === 0) return 'No subgroups excluded';
  if (numbers.length === 1) return `Subgroup ${numbers[0]} excluded`;
  return `Subgroups ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)} excluded`;
}

export const MSME_NOT_IN_CONTROL =
  'Some production batches still fall outside the revised control limits. The cause could not be confirmed, so these batches were kept in the analysis. The process is not in control. Continue monitoring the process and record what happens during future batches.';

export type StageAction = 'review-r' | 'review-x-bar' | 'monitor';

/** Guidance for the stage the investigation is on, and the next action. */
export function currentStageGuidance(workflow: Workflow): { text: string; action: StageAction } {
  const { current, phase } = workflow;
  if (phase === 'r') {
    return {
      action: 'review-r',
      text:
        current.kind === 'trial'
          ? 'The R chart has points outside its trial limits. Investigate them before interpreting or revising the X-bar chart.'
          : 'Points remain outside the revised R-chart limits. Investigate them before the X-bar chart.',
    };
  }
  if (phase === 'x-bar') {
    return {
      action: 'review-x-bar',
      text: current.rInControl
        ? current.kind === 'trial'
          ? 'The R chart is in control. Investigate the X-bar signals and exclude only those with confirmed assignable causes.'
          : 'All retained ranges are within the revised R-chart limits. The X-bar chart can now be investigated. Exclude only X-bar signals with confirmed assignable causes.'
        : 'Every R-chart signal has been investigated. Their causes were not confirmed, so those subgroups stay in the analysis. The X-bar chart can now be investigated.',
    };
  }
  if (workflow.status.inControl) {
    return {
      action: 'monitor',
      text: 'All retained subgroups are within the revised control limits. Continue monitoring with new production data. Process capability may be considered only when specification limits are available and its other assumptions are met.',
    };
  }
  const lead =
    current.rInControl && !current.xBarInControl
      ? 'The revised R chart is in control, but retained X-bar signals remain. '
      : '';
  return {
    action: 'monitor',
    text: `${lead}${MSME_NOT_IN_CONTROL} Process capability is not calculated while the process is not in control.`,
  };
}
