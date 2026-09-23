'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchPChart } from '@/lib/api';
import {
  exportPChartCsv,
  exportPChartXlsx,
  formatBatchDate,
  formatPercent,
  INVESTIGATE_MESSAGE,
} from '@/lib/pChartFormat';
import { PChartData } from '@/types/pChart';
import { ColourBatchForm } from './ColourBatchForm';
import { ColourBatchTable } from './ColourBatchTable';
import { PChart } from './PChart';
import { PChartSummaryPanel } from './PChartSummaryPanel';

// p-chart limits from only a handful of batches are provisional; the chart is
// still shown so the processor sees each new batch immediately.
const RECOMMENDED_BASELINE_BATCHES = 20;

function nextBatchLabel(data: PChartData | null): string {
  const numeric = (data?.points ?? [])
    .map((p) => Number(p.batchLabel))
    .filter((n) => Number.isInteger(n));
  return String((numeric.length ? Math.max(...numeric) : 0) + 1);
}

export function ColourPChartModule() {
  const [data, setData] = useState<PChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyResult = useCallback((request: Promise<PChartData>) => {
    return request
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not reach the WeighWise backend.'),
      )
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch after every add/edit/delete so p̄ and every batch's limits are recomputed.
  const load = useCallback(() => {
    setLoading(true);
    applyResult(fetchPChart());
  }, [applyResult]);

  useEffect(() => {
    applyResult(fetchPChart());
  }, [applyResult]);

  const outOfControl = data?.points.filter((p) => p.status === 'out-of-control') ?? [];
  const hasBatches = !!data && data.points.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Tom Brown colour p-chart</h2>
          <p className="text-xs text-muted">
            Monitors whether product colour stays in the light-brown range from batch to batch.
          </p>
        </div>
        {hasBatches && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportPChartXlsx(data)}
              className="rounded-md bg-primary text-white px-3 py-1.5 text-sm font-medium transition hover:bg-primary-hover"
            >
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => exportPChartCsv(data)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
            >
              Export CSV
            </button>
          </div>
        )}
      </div>

      <ColourBatchForm suggestedBatchLabel={nextBatchLabel(data)} onCreated={load} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
          <button onClick={load} className="ml-3 font-medium underline">
            Retry
          </button>
        </div>
      )}

      {loading && !data && <p className="text-sm text-muted">Loading…</p>}

      {data && (
        <>
          <PChartSummaryPanel summary={data.summary} />

          {hasBatches && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                data.summary.isStable
                  ? 'border-border bg-primary-soft text-primary-hover'
                  : 'border-red-300 bg-red-50 text-red-800'
              }`}
            >
              {data.summary.isStable ? (
                <span className="font-semibold">
                  All batches are within the control limits — no points outside limits.
                </span>
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold">
                    {outOfControl.length} batch{outOfControl.length === 1 ? '' : 'es'} out of
                    control — investigate the process.
                  </p>
                  <ul className="space-y-1">
                    {outOfControl.map((p) => (
                      <li key={p.batchId}>
                        <span className="font-medium">
                          Batch {p.batchLabel}
                          {p.productionDate && ` (${formatBatchDate(p.productionDate)})`}
                        </span>
                        : p = {formatPercent(p.proportion)}{' '}
                        {p.violatedLimit === 'lcl'
                          ? `< LCL ${formatPercent(p.lcl)}`
                          : `> UCL ${formatPercent(p.ucl)}`}
                        . {INVESTIGATE_MESSAGE}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {hasBatches && data.points.length < RECOMMENDED_BASELINE_BATCHES && (
            <p className="text-xs text-muted">
              {data.points.length} of {RECOMMENDED_BASELINE_BATCHES} recommended baseline batches
              recorded — treat the control limits as provisional until more batches are entered.
            </p>
          )}

          {hasBatches && <PChart points={data.points} />}

          <ColourBatchTable points={data.points} onChanged={load} />

          {hasBatches && (
            <p className="text-xs text-muted">
              The light-brown reference range is the product specification. UCL and LCL are
              statistical control limits describing process behaviour — they are not colour
              specification limits. Do not delete an out-of-control batch without documenting an
              assignable cause.
            </p>
          )}
        </>
      )}
    </div>
  );
}
