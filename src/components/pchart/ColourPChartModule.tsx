'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearColourBatches,
  fetchClearedColourBatches,
  fetchPChart,
  restoreColourBatches,
} from '@/lib/api';
import { exportPChartCsv, exportPChartXlsx, formatBatchDate, INVESTIGATE_MESSAGE } from '@/lib/pChartFormat';
import { detectSignals, P_CHART_RULES, RuleId, RuleSignal, rulesByPoint } from '@/lib/nelsonRules';
import { ClearedColourBatch, PChartData } from '@/types/pChart';
import { RuleSignalList } from '../RuleSignalList';
import { ConfirmDialog } from '../ConfirmDialog';
import { ColourBatchForm } from './ColourBatchForm';
import { ColourBatchUploadForm } from './ColourBatchUploadForm';
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
 * The p-chart uses rule 1 only (a batch beyond its 3σ limits), so batch status
 * matches the backend's; the signals still drive the chart highlighting and
 * the signal list.
 */
function analyse(raw: PChartData): RuleAnalysis {
  const signals = detectSignals(
    raw.points.map((p) => ({ value: p.proportion, cl: p.cl, sigma: p.sigma, ucl: p.ucl, lcl: p.lcl })),
    P_CHART_RULES,
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
  const [entryMode, setEntryMode] = useState<'manual' | 'upload'>('manual');
  const [cleared, setCleared] = useState<ClearedColourBatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // The cleared list only drives the Restore button, so a failure just hides it.
  const loadCleared = useCallback(() => {
    fetchClearedColourBatches()
      .then(setCleared)
      .catch(() => setCleared([]));
  }, []);

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
    loadCleared();
  }, [applyResult, loadCleared]);

  useEffect(() => {
    applyResult(fetchPChart());
    loadCleared();
  }, [applyResult, loadCleared]);

  // Batches from the most recent clear — what the Restore button brings back.
  const lastClear = cleared.filter((b) => b.clearedAt === cleared[0]?.clearedAt);

  const activeCount = rawData?.points.length ?? 0;

  async function handleClearAll() {
    setBusy(true);
    try {
      const result = await clearColourBatches();
      setNotice(`${result.cleared} batch${result.cleared === 1 ? '' : 'es'} cleared.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear the batches.');
    } finally {
      setBusy(false);
      setConfirmingClear(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    try {
      const result = await restoreColourBatches(lastClear[0]?.clearedAt);
      setNotice(
        `${result.restored} batch${result.restored === 1 ? '' : 'es'} restored.` +
          (result.skippedLabels.length
            ? ` Not restored (batch number already in use): ${result.skippedLabels.join(', ')}.`
            : ''),
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore the batches.');
    } finally {
      setBusy(false);
    }
  }

  const analysis = useMemo(
    () => (rawData ? analyse(rawData) : null),
    [rawData],
  );
  const data = analysis?.data ?? null;
  const hasBatches = !!data && data.points.length > 0;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmingClear}
        title={`Clear all ${activeCount} batch${activeCount === 1 ? '' : 'es'}?`}
        message={
          <p>
            Every batch will be removed from the p-chart, the batch table and the signal list.
            They are <strong className="text-foreground">archived, not deleted</strong> — use{' '}
            <em>Restore cleared batches</em> to bring them back.
          </p>
        }
        confirmLabel="Clear all batches"
        destructive
        busy={busy}
        onConfirm={handleClearAll}
        onCancel={() => setConfirmingClear(false)}
      />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Tom Brown colour p-chart</h2>
          <p className="text-xs text-muted">
            Monitors whether product colour stays in the light-brown range from batch to batch.
          </p>
        </div>
        {(hasBatches || lastClear.length > 0) && (
          <div className="flex gap-2 flex-wrap">
            {lastClear.length > 0 && (
              <button
                type="button"
                onClick={handleRestore}
                disabled={busy}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
              >
                Restore {lastClear.length} cleared batch{lastClear.length === 1 ? '' : 'es'}
              </button>
            )}
            {hasBatches && (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                disabled={busy}
                className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Clear all batches
              </button>
            )}
          </div>
        )}
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

      {notice && (
        <div className="rounded-lg border border-border bg-primary-soft px-4 py-2 text-sm text-primary-hover">
          {notice}
          <button onClick={() => setNotice(null)} className="ml-3 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {(['manual', 'upload'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setEntryMode(mode)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              entryMode === mode
                ? 'bg-primary text-white'
                : 'bg-surface text-muted border border-border hover:text-foreground'
            }`}
          >
            {mode === 'manual' ? 'Manual entry' : 'Upload spreadsheet'}
          </button>
        ))}
      </div>

      {entryMode === 'manual' ? (
        <ColourBatchForm suggestedBatchLabel={nextBatchLabel(data)} onCreated={load} />
      ) : (
        <ColourBatchUploadForm
          existingLabels={rawData?.points.map((p) => p.batchLabel) ?? []}
          onImported={load}
        />
      )}

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
                <p className="font-semibold">
                  {data.summary.outOfControlCount} batch
                  {data.summary.outOfControlCount === 1 ? '' : 'es'} outside the control limits
                  — investigate the process. {INVESTIGATE_MESSAGE}
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
              <PChart points={data.points} rules={analysis.rules} />
              <div className="rounded-lg border border-border bg-surface p-4">
                <h3 className="text-sm font-semibold">Rule signals</h3>
                <p className="text-xs text-muted mb-3">
                  The colour p-chart is checked with rule 1 only: a batch above the UCL or below
                  the LCL.
                </p>
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
