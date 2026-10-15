/**
 * Nelson rules for detecting special-cause variation on a control chart.
 *
 * Each point carries its own centre line and sigma, so charts whose limits
 * step with sample size (X-bar with varying n, p-chart) are zoned per point.
 * Rule 1 uses the plotted UCL/LCL directly so clamped limits (p-chart at 0/1,
 * R chart LCL at 0) are respected.
 */

export type RuleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const ALL_RULES: RuleId[] = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Rules applied to range (R) charts. As in Minitab, the zone tests 5–8 are
 * not run there because the R chart's σ-zones are not symmetric about its
 * centre line.
 */
export const RANGE_CHART_RULES: RuleId[] = [1, 2, 3, 4];

/** The Tom Brown colour p-chart is judged on rule 1 (a point beyond the 3σ limits) only. */
export const P_CHART_RULES: RuleId[] = [1];

export const RULE_DESCRIPTIONS: Record<RuleId, { title: string; detail: string }> = {
  1: { title: 'One point beyond 3σ', detail: 'A point is above the UCL or below the LCL.' },
  2: {
    title: 'Nine in a row on one side',
    detail: 'Nine consecutive points are all above or all below the centre line.',
  },
  3: {
    title: 'Six-point trend',
    detail: 'Six increases in a row or six decreases in a row (seven points).',
  },
  4: {
    title: 'Fourteen alternating',
    detail: 'Fourteen consecutive points alternate up and down.',
  },
  5: {
    title: 'Two of three beyond 2σ',
    detail: 'In three consecutive points, at least two are more than 2σ from the centre line on the same side.',
  },
  6: {
    title: 'Four of five beyond 1σ',
    detail: 'In five consecutive points, at least four are more than 1σ from the centre line on the same side.',
  },
  7: {
    title: 'Fifteen within 1σ',
    detail: 'Fifteen consecutive points are within ±1σ of the centre line.',
  },
  8: {
    title: 'Eight outside 1σ',
    detail: 'Eight consecutive points are outside ±1σ of the centre line, on either side.',
  },
};

export type SignalDirection =
  | 'above'
  | 'below'
  | 'increasing'
  | 'decreasing'
  | 'alternating'
  | 'within'
  | 'both-sides';

export const DIRECTION_LABELS: Record<SignalDirection, string> = {
  above: 'Above',
  below: 'Below',
  increasing: 'Increasing',
  decreasing: 'Decreasing',
  alternating: 'Alternating',
  within: 'Within ±1σ',
  'both-sides': 'Both sides',
};

export interface RulePoint {
  value: number;
  cl: number;
  sigma: number;
  ucl: number;
  lcl: number;
}

export interface RuleSignal {
  rule: RuleId;
  /** Indices (into the input array) of every point that forms the signal. */
  indices: number[];
  /**
   * The points Minitab reports for this signal — where the test fails: the
   * point itself (rule 1), the last point of the window (rules 5, 6), or every
   * point from the K-th in the run onward (run rules 2, 3, 4, 7, 8).
   */
  flagged: number[];
  direction: SignalDirection;
}

type DetectedSignal = Omit<RuleSignal, 'flagged'>;

type Side = 1 | -1 | 0;

// Minimum points in a run. Rule 3 follows Minitab's Test 3, where K = 6 counts
// consecutive increases (or decreases), so the trend spans K + 1 = 7 points.
const RUN_LENGTH: Record<2 | 3 | 4 | 7 | 8, number> = { 2: 9, 3: 7, 4: 14, 7: 15, 8: 8 };

function range(start: number, endInclusive: number): number[] {
  return Array.from({ length: endInclusive - start + 1 }, (_, i) => start + i);
}

/** Which side of the centre line a point lies on, beyond `k` sigma (0 = not beyond). */
function sideBeyond(p: RulePoint, k: number): Side {
  if (p.value > p.cl + k * p.sigma) return 1;
  if (p.value < p.cl - k * p.sigma) return -1;
  return 0;
}

/**
 * Reports every maximal run of consecutive indices where `step(i)` holds for
 * each adjacent pair (i-1, i) and the run spans at least `minPoints` points.
 * A run longer than the minimum is reported once, covering all its points.
 */
function maximalRuns(
  n: number,
  minPoints: number,
  startsRun: (i: number) => boolean,
  continuesRun: (i: number) => boolean,
): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    if (start >= 0 && i < n && continuesRun(i)) continue;
    if (start >= 0 && i - start >= minPoints) runs.push([start, i - 1]);
    start = i < n && startsRun(i) ? i : -1;
  }
  return runs;
}

function rule1(points: RulePoint[]): DetectedSignal[] {
  const signals: DetectedSignal[] = [];
  points.forEach((p, i) => {
    if (p.value > p.ucl) signals.push({ rule: 1, indices: [i], direction: 'above' });
    else if (p.value < p.lcl) signals.push({ rule: 1, indices: [i], direction: 'below' });
  });
  return signals;
}

function rule2(points: RulePoint[]): DetectedSignal[] {
  const side = points.map((p) => sideBeyond(p, 0));
  return maximalRuns(
    points.length,
    RUN_LENGTH[2],
    (i) => side[i] !== 0,
    (i) => side[i] === side[i - 1],
  ).map(([s, e]) => ({
    rule: 2,
    indices: range(s, e),
    direction: side[s] === 1 ? 'above' : 'below',
  }));
}

function rule3(points: RulePoint[]): DetectedSignal[] {
  const signals: DetectedSignal[] = [];
  for (const dir of [1, -1] as const) {
    const runs = maximalRuns(
      points.length,
      RUN_LENGTH[3],
      () => true,
      (i) => Math.sign(points[i].value - points[i - 1].value) === dir,
    );
    for (const [s, e] of runs) {
      signals.push({ rule: 3, indices: range(s, e), direction: dir === 1 ? 'increasing' : 'decreasing' });
    }
  }
  return signals.sort((a, b) => a.indices[0] - b.indices[0]);
}

function rule4(points: RulePoint[]): DetectedSignal[] {
  // step[i] is the direction of the move from point i-1 to point i.
  const step = points.map((p, i) => (i === 0 ? 0 : Math.sign(p.value - points[i - 1].value)));
  const signals: DetectedSignal[] = [];
  let start = 0;
  for (let i = 1; i <= points.length; i++) {
    const moves = i < points.length && step[i] !== 0;
    if (moves && (i === start + 1 || step[i] === -step[i - 1])) continue;
    if (i - start >= RUN_LENGTH[4]) {
      signals.push({ rule: 4, indices: range(start, i - 1), direction: 'alternating' });
    }
    // A repeated direction can still begin a new alternating run at the previous point.
    start = moves ? i - 1 : i;
  }
  return signals;
}

/**
 * "k of m beyond z·σ on the same side". As in Minitab, the test fails at a
 * point only if that point is itself beyond z·σ, so a window is reported only
 * when its last point is one of the points beyond.
 */
function windowRule(
  points: RulePoint[],
  rule: 5 | 6,
  windowSize: number,
  minCount: number,
  zSigma: number,
): DetectedSignal[] {
  const side = points.map((p) => sideBeyond(p, zSigma));
  const signals: DetectedSignal[] = [];
  for (let s = 0; s + windowSize <= points.length; s++) {
    const window = side.slice(s, s + windowSize);
    for (const dir of [1, -1] as const) {
      const last = window[window.length - 1];
      if (last === dir && window.filter((v) => v === dir).length >= minCount) {
        signals.push({
          rule,
          indices: range(s, s + windowSize - 1),
          direction: dir === 1 ? 'above' : 'below',
        });
      }
    }
  }
  return signals;
}

function rule7(points: RulePoint[]): DetectedSignal[] {
  const within = points.map((p) => sideBeyond(p, 1) === 0 && p.sigma > 0);
  return maximalRuns(
    points.length,
    RUN_LENGTH[7],
    (i) => within[i],
    (i) => within[i],
  ).map(([s, e]) => ({ rule: 7, indices: range(s, e), direction: 'within' }));
}

function rule8(points: RulePoint[]): DetectedSignal[] {
  const side = points.map((p) => sideBeyond(p, 1));
  return maximalRuns(
    points.length,
    RUN_LENGTH[8],
    (i) => side[i] !== 0,
    (i) => side[i] !== 0,
  ).map(([s, e]) => {
    const sides = new Set(side.slice(s, e + 1));
    const direction: SignalDirection =
      sides.size > 1 ? 'both-sides' : sides.has(1) ? 'above' : 'below';
    return { rule: 8, indices: range(s, e), direction };
  });
}

const DETECTORS: Record<RuleId, (points: RulePoint[]) => DetectedSignal[]> = {
  1: rule1,
  2: rule2,
  3: rule3,
  4: rule4,
  5: (pts) => windowRule(pts, 5, 3, 2, 2),
  6: (pts) => windowRule(pts, 6, 5, 4, 1),
  7: rule7,
  8: rule8,
};

/**
 * Runs every enabled rule over the points (in plotting order). Signals from
 * different rules — and overlapping windows of rules 5 and 6 — are all
 * reported, so a point may belong to several signals.
 */
export function detectSignals(points: RulePoint[], enabled: Iterable<RuleId>): RuleSignal[] {
  const enabledSet = new Set(enabled);
  return ALL_RULES.filter((r) => enabledSet.has(r))
    .flatMap((r) => DETECTORS[r](points))
    .map((signal) => ({ ...signal, flagged: flaggedIndices(signal) }))
    .sort((a, b) => a.indices[0] - b.indices[0] || a.rule - b.rule);
}

function flaggedIndices({ rule, indices }: DetectedSignal): number[] {
  if (rule === 1) return indices;
  if (rule === 5 || rule === 6) return indices.slice(-1);
  return indices.slice(RUN_LENGTH[rule] - 1);
}

/** Maps each point index to the sorted list of rules whose signals include it. */
export function rulesByPoint(signals: RuleSignal[], pointCount: number): RuleId[][] {
  const sets = Array.from({ length: pointCount }, () => new Set<RuleId>());
  for (const s of signals) for (const i of s.indices) sets[i]?.add(s.rule);
  return sets.map((set) => [...set].sort((a, b) => a - b));
}
