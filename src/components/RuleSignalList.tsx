import { DIRECTION_LABELS, RULE_DESCRIPTIONS, RuleSignal } from '@/lib/nelsonRules';

export interface SignalPointInfo {
  /** Batch / subgroup number shown to the user. */
  batch: string;
  date: string;
}

export interface SignalGroup {
  /** Chart name, shown when several charts share one list. */
  chart?: string;
  signals: RuleSignal[];
  points: SignalPointInfo[];
}

function span(values: string[]): string {
  return values.length === 1 ? values[0] : `${values[0]} – ${values[values.length - 1]}`;
}

export function RuleSignalList({ groups }: { groups: SignalGroup[] }) {
  const showChart = groups.some((g) => g.chart);
  const rows = groups.flatMap((g) => g.signals.map((signal) => ({ group: g, signal })));

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
            <th className="py-1.5 pr-3">Rule</th>
            {showChart && <th className="py-1.5 pr-3">Chart</th>}
            <th className="py-1.5 pr-3">Batch no.</th>
            <th className="py-1.5 pr-3">Production dates</th>
            <th className="py-1.5 pr-3">Signal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ group, signal }, i) => {
            const pts = signal.indices.map((idx) => group.points[idx]).filter(Boolean);
            return (
              <tr key={i} className="border-b border-border last:border-0 align-top">
                <td className="py-1.5 pr-3">
                  <span className="font-semibold text-red-700">Rule {signal.rule}</span>
                  <span className="block text-xs text-muted">
                    {RULE_DESCRIPTIONS[signal.rule].title}
                  </span>
                </td>
                {showChart && <td className="py-1.5 pr-3">{group.chart}</td>}
                <td className="py-1.5 pr-3">
                  {span(pts.map((p) => p.batch))}
                  {pts.length > 1 && (
                    <span className="block text-xs text-muted">{pts.length} points</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">{span(pts.map((p) => p.date))}</td>
                <td className="py-1.5 pr-3">{DIRECTION_LABELS[signal.direction]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
