import { ALL_RULES, RULE_DESCRIPTIONS, RuleSignal } from '@/lib/nelsonRules';

export interface SignalPointInfo {
  /** How the point is named in the list, e.g. a production date or "Batch 4 (22 Aug 2026)". */
  label: string;
}

export interface SignalGroup {
  /** Chart name, shown when several charts share one list. */
  chart?: string;
  signals: RuleSignal[];
  points: SignalPointInfo[];
}

interface Row {
  chart?: string;
  rule: (typeof ALL_RULES)[number];
  labels: string[];
}

/**
 * One row per chart and rule, listing the points where the test fails — the
 * same layout as a Minitab "tests for special causes" report. The chart still
 * highlights every point of each sequence.
 */
function toRows(groups: SignalGroup[]): Row[] {
  return groups.flatMap((group) =>
    ALL_RULES.flatMap((rule) => {
      const flagged = new Set(
        group.signals.filter((s) => s.rule === rule).flatMap((s) => s.flagged),
      );
      if (flagged.size === 0) return [];
      const labels = [...flagged]
        .sort((a, b) => a - b)
        .map((i) => group.points[i]?.label)
        .filter((l): l is string => Boolean(l));
      return [{ chart: group.chart, rule, labels }];
    }),
  );
}

export function RuleSignalList({
  groups,
  pointHeading = 'Dates flagged',
}: {
  groups: SignalGroup[];
  pointHeading?: string;
}) {
  const showChart = groups.some((g) => g.chart);
  const rows = toRows(groups);

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-primary-soft bg-primary-soft px-3 py-2 text-sm text-primary-hover">
        No enabled rule is triggered — the process shows no special-cause signals.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted border-b border-border">
            {showChart && <th className="py-1.5 pr-3">Chart</th>}
            <th className="py-1.5 pr-3">Test</th>
            <th className="py-1.5 pr-3">Reason</th>
            <th className="py-1.5 pr-3">{pointHeading}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.chart ?? ''}-${row.rule}`}
              className="border-b border-border last:border-0 align-top"
            >
              {showChart && <td className="py-1.5 pr-3 whitespace-nowrap">{row.chart}</td>}
              <td className="py-1.5 pr-3 font-semibold text-red-700 whitespace-nowrap">
                Rule {row.rule}
              </td>
              <td className="py-1.5 pr-3">
                <span className="font-medium text-foreground">
                  {RULE_DESCRIPTIONS[row.rule].title}
                </span>
                <span className="block text-xs text-muted">{RULE_DESCRIPTIONS[row.rule].detail}</span>
              </td>
              <td className="py-1.5 pr-3">
                {row.labels.join(', ')}
                <span className="block text-xs text-muted">
                  {row.labels.length} point{row.labels.length === 1 ? '' : 's'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        Listed points are where each test fails, as reported by Minitab. On the chart, every
        point in the triggering sequence is highlighted.
      </p>
    </div>
  );
}
