import { PChartSummary } from '@/types/pChart';
import { formatPercent } from '@/lib/pChartFormat';

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${
        alert ? 'border-red-200 bg-red-50' : 'border-border bg-surface'
      }`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold ${alert ? 'text-red-700' : 'text-primary'}`}>
        {value}
      </div>
    </div>
  );
}

export function PChartSummaryPanel({ summary }: { summary: PChartSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat label="Total batches" value={String(summary.totalBatches)} />
      <Stat label="Total samples inspected" value={String(summary.totalSamples)} />
      <Stat
        label="Overall proportion nonconforming (p̄)"
        value={formatPercent(summary.overallProportion)}
      />
      <Stat
        label="Out-of-control batches"
        value={String(summary.outOfControlCount)}
        alert={summary.outOfControlCount > 0}
      />
    </div>
  );
}
