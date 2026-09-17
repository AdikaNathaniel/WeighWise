import { DashboardData } from '@/types/spc';

function fmt(n: number): string {
  return n.toFixed(2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function SubgroupCalculationCard({ data }: { data: DashboardData }) {
  if (data.subgroups.length === 0) return null;

  const latest = [...data.subgroups].sort(
    (a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime(),
  )[0];

  const limits = data.summary.limitsBySubgroup.find((l) => l.subgroupId === latest.id);
  if (!limits) return null;

  // Derive range and mean straight from the recorded weights (rather than
  // trusting separately-stored values) so the number shown always matches
  // the formula shown next to it.
  const min = Math.min(...latest.weights);
  const max = Math.max(...latest.weights);
  const range = max - min;
  const sum = latest.weights.reduce((total, w) => total + w, 0);
  const mean = sum / latest.weights.length;
  const rBar = data.summary.averageRange;
  const grandMean = data.summary.grandMean;
  const weightList = latest.weights.map(fmt).join(', ');

  const rows: { label: string; formula: string; value: number }[] = [
    {
      label: 'Range',
      formula: `MAX(${weightList}) − MIN(${weightList}) = ${fmt(max)} − ${fmt(min)}`,
      value: range,
    },
    {
      label: 'Mean',
      formula: `(${weightList}) ÷ ${latest.weights.length} = ${fmt(sum)} ÷ ${latest.weights.length}`,
      value: mean,
    },
    {
      label: 'X-bar UCL',
      formula: `Grand mean + (A2 × R̄) = ${fmt(grandMean)} + (${limits.A2} × ${fmt(rBar)})`,
      value: limits.xBar.ucl,
    },
    {
      label: 'X-bar CL',
      formula: 'Grand mean (X̿)',
      value: limits.xBar.cl,
    },
    {
      label: 'X-bar LCL',
      formula: `Grand mean − (A2 × R̄) = ${fmt(grandMean)} − (${limits.A2} × ${fmt(rBar)})`,
      value: limits.xBar.lcl,
    },
    {
      label: 'R UCL',
      formula: `D4 × R̄ = ${limits.D4} × ${fmt(rBar)}`,
      value: limits.r.ucl,
    },
    {
      label: 'R CL',
      formula: 'R̄ (average range)',
      value: limits.r.cl,
    },
    {
      label: 'R LCL',
      formula: `D3 × R̄ = ${limits.D3} × ${fmt(rBar)}`,
      value: limits.r.lcl,
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Calculation breakdown — latest subgroup
        </h3>
        <p className="text-xs text-muted">
          {formatDate(latest.productionDate)} · n = {latest.sampleSize} · A2 = {limits.A2}, D3 ={' '}
          {limits.D3}, D4 = {limits.D4}
        </p>
      </div>

      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-2">
            <div>
              <div className="text-sm font-medium text-foreground">{row.label}</div>
              <div className="text-xs text-muted">{row.formula}</div>
            </div>
            <div className="text-sm font-semibold text-primary whitespace-nowrap">
              {fmt(row.value)} g
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
