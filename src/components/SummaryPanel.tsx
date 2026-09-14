import { SpcSummary } from '@/types/spc';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold text-primary">{value}</div>
    </div>
  );
}

export function SummaryPanel({ summary }: { summary: SpcSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat label="Grand mean (X̿)" value={`${summary.grandMean.toFixed(2)} g`} />
      <Stat label="Average range (R̄)" value={`${summary.averageRange.toFixed(2)} g`} />
      <Stat label="Subgroups" value={String(summary.subgroupCount)} />
      <Stat label="Total samples" value={String(summary.totalSampleCount)} />
    </div>
  );
}
