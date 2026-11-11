import { DIRECTION_LABELS, isInvestigated, RuleId, RulePoint, RuleSignal, SignalDirection } from './nelsonRules';
import type { ReviewOutcome } from './assignableCauses';
import type { Subgroup } from '@/types/spc';

export type ChartKind = 'x-bar' | 'r';

export const CHART_NAMES: Record<ChartKind, string> = { 'x-bar': 'X-bar chart', r: 'R chart' };

/** One rule failing at one subgroup, with the limit it is judged against. */
export interface PointSignal {
  chart: ChartKind;
  rule: RuleId;
  direction: SignalDirection;
  value: number;
  limitType: 'ucl' | 'cl' | 'lcl';
  limit: number;
}

/** An out-of-control subgroup awaiting an assignable-cause review. */
export interface ReviewItem {
  subgroup: Subgroup;
  /** 1-based position among all active subgroups in production order. */
  number: number;
  /** Every failing test at this subgroup, rule 1 first; the first is the one reviewed. */
  signals: PointSignal[];
}

export interface ChartSignals {
  chart: ChartKind;
  /** The subgroups plotted on the chart, in plotting order. */
  subgroups: Subgroup[];
  points: RulePoint[];
  signals: RuleSignal[];
}

function signalLimit(rule: RuleId, direction: SignalDirection, point: RulePoint) {
  if (rule === 1 && direction === 'above') return { limitType: 'ucl' as const, limit: point.ucl };
  if (rule === 1 && direction === 'below') return { limitType: 'lcl' as const, limit: point.lcl };
  return { limitType: 'cl' as const, limit: point.cl };
}

/**
 * Collects the subgroups to investigate on either chart — only points beyond
 * the control limits; pattern warnings (rules 2–8) are never queued — one
 * item per subgroup in production order.
 */
export function buildReviewItems(allSubgroups: Subgroup[], charts: ChartSignals[]): ReviewItem[] {
  const numbers = new Map(allSubgroups.map((s, i) => [s.id, i + 1]));
  const items = new Map<string, ReviewItem>();

  for (const { chart, subgroups, points, signals } of charts) {
    for (const signal of signals) {
      if (!isInvestigated(signal.rule)) continue;
      for (const i of signal.flagged) {
        const subgroup = subgroups[i];
        if (!subgroup) continue;
        const item = items.get(subgroup.id) ?? {
          subgroup,
          number: numbers.get(subgroup.id) ?? i + 1,
          signals: [],
        };
        const duplicate = item.signals.some((s) => s.chart === chart && s.rule === signal.rule);
        if (!duplicate) {
          item.signals.push({
            chart,
            rule: signal.rule,
            direction: signal.direction,
            value: points[i].value,
            ...signalLimit(signal.rule, signal.direction, points[i]),
          });
        }
        items.set(subgroup.id, item);
      }
    }
  }

  return [...items.values()]
    .map((item) => ({
      ...item,
      signals: item.signals.sort((a, b) => a.rule - b.rule || (a.chart === 'r' ? 1 : -1)),
    }))
    .sort((a, b) => a.number - b.number);
}

export const OUTCOME_LABELS: Record<ReviewOutcome, string> = {
  confirmed: 'Specific assignable cause confirmed',
  possible: 'Possible cause, not confirmed',
  none: 'No assignable cause identified',
};

const LIMIT_NAMES = { ucl: 'UCL', cl: 'CL', lcl: 'LCL' } as const;

export function limitName(limitType: PointSignal['limitType']): string {
  return LIMIT_NAMES[limitType];
}

/** e.g. "R chart · Rule 1 · Above UCL" or "X-bar chart · Rule 2 · Below". */
export function signalLabel(signal: {
  chart: ChartKind;
  rule: number;
  direction: string;
  limitType: PointSignal['limitType'];
}): string {
  const direction = DIRECTION_LABELS[signal.direction as SignalDirection] ?? signal.direction;
  const where = signal.rule === 1 ? `${direction} ${limitName(signal.limitType)}` : direction;
  return `${CHART_NAMES[signal.chart]} · Rule ${signal.rule} · ${where}`;
}
