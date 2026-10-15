'use client';

import { useState } from 'react';
import { formatBatchDate } from '@/lib/pChartFormat';
import { DashboardData } from '@/types/spc';

function fmt(n: number): string {
  return n.toFixed(2);
}

export function SubgroupCalculationCard({ data }: { data: DashboardData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (data.subgroups.length === 0) return null;

  // Default to the most recently entered subgroup: sort by createdAt (actual
  // submission time), not productionDate — several subgroups can share a
  // production date. A spreadsheet import stores its rows together, so ties
  // fall back to the latest production date.
  const latest = [...data.subgroups].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      b.productionDate.localeCompare(a.productionDate),
  )[0];
  // The chosen subgroup may have been deleted or replaced by an upload.
  const subgroup = data.subgroups.find((s) => s.id === selectedId) ?? latest;

  const limits = data.summary.limitsBySubgroup.find((l) => l.subgroupId === subgroup.id);
  if (!limits) return null;

  // Derive range and mean straight from the recorded weights (rather than
  // trusting separately-stored values) so the number shown always matches
  // the formula shown next to it.
  const min = Math.min(...subgroup.weights);
  const max = Math.max(...subgroup.weights);
  const range = max - min;
  const sum = subgroup.weights.reduce((total, w) => total + w, 0);
  const mean = sum / subgroup.weights.length;
  const rBar = data.summary.averageRange;
  const grandMean = data.summary.grandMean;
  const weightList = subgroup.weights.map(fmt).join(', ');

  const rows: { label: string; formula: string; value: number }[] = [
    {
      label: 'Range',
      formula: `MAX(${weightList}) − MIN(${weightList}) = ${fmt(max)} − ${fmt(min)}`,
      value: range,
    },
    {
      label: 'Mean',
      formula: `(${subgroup.weights.map(fmt).join(' + ')}) ÷ ${subgroup.weights.length} = ${fmt(sum)} ÷ ${subgroup.weights.length}`,
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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Calculation breakdown —{' '}
            {subgroup.id === latest.id ? 'latest subgroup' : 'selected subgroup'}
          </h3>
          <p className="text-xs text-muted">
            {formatBatchDate(subgroup.productionDate)} · n = {subgroup.sampleSize} · A2 ={' '}
            {limits.A2}, D3 = {limits.D3}, D4 = {limits.D4}
          </p>
        </div>
        <label className="text-xs text-muted flex items-center gap-2">
          Subgroup
          <select
            value={subgroup.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-md border border-border bg-white px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
          >
            {data.subgroups.map((s, i) => (
              <option key={s.id} value={s.id}>
                #{i + 1} · {formatBatchDate(s.productionDate)} · n = {s.sampleSize}
                {s.id === latest.id ? ' (latest)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-2">
            <div>
              <div className="text-sm font-medium text-foreground">{row.label}</div>
              <div className="mt-1 inline-block rounded-md bg-primary-soft px-2 py-1 text-xs text-primary-hover">
                {row.formula}
              </div>
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
