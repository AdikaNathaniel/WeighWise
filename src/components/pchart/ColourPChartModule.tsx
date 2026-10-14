'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPChart } from '@/lib/api';
import { exportPChartCsv, exportPChartXlsx, formatBatchDate, INVESTIGATE_MESSAGE } from '@/lib/pChartFormat';
import { detectSignals, RuleId, RuleSignal, rulesByPoint } from '@/lib/nelsonRules';
import { useEnabledRules } from '@/lib/useEnabledRules';
import { PChartData } from '@/types/pChart';
import { RuleSignalList } from '../RuleSignalList';
import { RuleToggles } from '../RuleToggles';
import { ColourBatchForm } from './ColourBatchForm';
import { ColourBatchTable } from './ColourBatchTable';
import { PChart } from './PChart';
import { PChartSummaryPanel } from './PChartSummaryPanel';

// p-chart limits from only a handful of batches are provisional; the chart is
// still shown so the processor sees each new batch immediately.
const RECOMMENDED_BASELINE_BATCHES = 20;

interface RuleAnalysis {
  /** The data with each batch's status and the summary driven by the enabled rules. */
  data: PChartData;
  signals: RuleSignal[];
  rules: RuleId[][];
}

/**
 * The backend only flags points beyond the 3σ limits (rule 1). Re-derive batch
 * status from every enabled Nelson rule so the table, summary and exports all
 * agree with the chart.
 */
function analyse(raw: PChartData, enabled: RuleId[]): RuleAnalysis {
  const signals = detectSignals(
    raw.points.map((p) => ({ value: p.proportion, cl: p.cl, sigma: p.sigma, ucl: p.ucl, lcl: p.lcl })),
    enabled,
  );
  const rules = rulesByPoint(signals, raw.points.length);
  const points = raw.points.map((p, i) => ({
    ...p,
    status: rules[i].length > 0 ? ('out-of-control' as const) : ('in-control' as const),
  }));
  const outOfControlCount = points.filter((p) => p.status === 'out-of-control').length;
  return {
    data: {
      points,
      summary: { ...raw.summary, outOfControlCount, isStable: outOfControlCount === 0 },
    },
    signals,
    rules,
  };
}

function nextBatchLabel(data: PChartData | null): string {
  const numeric = (data?.points ?? [])
    .map((p) => Number(p.batchLabel))
    .filter((n) => Number.isInteger(n));
  return String((numeric.length ? Math.max(...numeric) : 0) + 1);
}

export function ColourPChartModule() {
  const [rawData, setData] = useState<PChartData | null>(null);
  const [enabledRules, setRule] = useEnabledRules();
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

  const analysis = useMemo(
    () => (rawData ? analyse(rawData, enabledRules) : null),
    [rawData, enabledRules],
  );
  const data = analysis?.data ?? null;
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
                  No enabled rule is triggered — no special-cause signals.
                </span>
              ) : (
                <p className="font-semibold">
                  {data.summary.outOfControlCount} batch
                  {data.summary.outOfControlCount === 1 ? '' : 'es'} involved in rule signals —
                  investigate the process. {INVESTIGATE_MESSAGE}
                </p>
              )}
            </div>
          )}

          {hasBatches && data.points.length < RECOMMENDED_BASELINE_BATCHES && (
            <p className="text-xs text-muted">
              {data.points.length} of {RECOMMENDED_BASELINE_BATCHES} recommended baseline batches
              recorded — treat the control limits as provisional until more batches are entered.
            </p>
          )}

          {hasBatches && analysis && (
            <>
              <RuleToggles enabled={enabledRules} onChange={setRule} />
              <PChart points={data.points} rules={analysis.rules} />
              <div className="rounded-lg border border-border bg-surface p-4">
                <h3 className="text-sm font-semibold mb-3">Rule signals</h3>
                <RuleSignalList
                  groups={[
                    {
                      signals: analysis.signals,
                      points: data.points.map((p) => ({
                        batch: p.batchLabel,
                        date: formatBatchDate(p.productionDate),
                      })),
                    },
                  ]}
                />
              </div>
            </>
          )}

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
