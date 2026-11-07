'use client';

import { useState } from 'react';
import { createSubgroup } from '@/lib/api';
import { formatBatchDate } from '@/lib/pChartFormat';

const MIN_N = 2;
const MAX_N = 10;

const inputClass =
  'rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

/** Today as a local calendar date (YYYY-MM-DD), not the UTC date. */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses each weight; null when any is blank, not a number, or not positive. */
export function parseWeights(raw: string[]): number[] | null {
  const parsed = raw.map((w) => (w.trim() === '' ? NaN : Number(w)));
  return parsed.every((w) => Number.isFinite(w) && w > 0) ? parsed : null;
}

export function SubgroupForm({
  requiredSize,
  existingDates = [],
  onCreated,
}: {
  /** Sample size of the subgroups already on the chart; every subgroup must match it. */
  requiredSize?: number;
  /** Production dates already recorded (YYYY-MM-DD), to catch an unintended duplicate. */
  existingDates?: string[];
  onCreated: () => void;
}) {
  const [productionDate, setProductionDate] = useState(todayIso());
  const [chosenSize, setChosenSize] = useState(4);
  const [rawWeights, setWeights] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A repeated date is allowed only after the user confirms it is intended.
  const [confirmedDuplicate, setConfirmedDuplicate] = useState<string | null>(null);

  const sampleSize = requiredSize ?? chosenSize;
  const weights = Array.from({ length: sampleSize }, (_, i) => rawWeights[i] ?? '');
  const duplicateDate = existingDates.includes(productionDate);
  const needsDuplicateConfirm = duplicateDate && confirmedDuplicate !== productionDate;

  function handleSampleSizeChange(next: number) {
    setChosenSize(Math.min(MAX_N, Math.max(MIN_N, next || MIN_N)));
  }

  function handleWeightChange(index: number, value: string) {
    setWeights(weights.map((w, i) => (i === index ? value : w)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedWeights = parseWeights(weights);
    if (!parsedWeights) {
      setError('Enter a weight greater than 0 g for every sample.');
      return;
    }
    if (needsDuplicateConfirm) {
      setConfirmedDuplicate(productionDate);
      return;
    }

    setSubmitting(true);
    try {
      await createSubgroup({ productionDate, sampleSize, weights: parsedWeights });
      setWeights([]);
      setConfirmedDuplicate(null);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save subgroup.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-5 space-y-4 shadow-sm"
    >
      <h3 className="text-sm font-semibold text-foreground">Record a new subgroup</h3>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Production date
          <input
            type="date"
            value={productionDate}
            onChange={(e) => setProductionDate(e.target.value)}
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          Subgroup sample size
          <input
            type="number"
            min={MIN_N}
            max={MAX_N}
            value={sampleSize}
            onChange={(e) => handleSampleSizeChange(Number(e.target.value))}
            disabled={requiredSize !== undefined}
            required
            className={`w-24 ${inputClass} disabled:bg-background disabled:text-muted`}
          />
        </label>
      </div>
      {requiredSize !== undefined && (
        <p className="text-xs text-muted">
          Every subgroup on the chart has {requiredSize} packages, so this one must too.
        </p>
      )}

      <div>
        <div className="text-sm text-muted mb-2">Individual package weights (g)</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {weights.map((w, i) => (
            <input
              key={i}
              type="number"
              step="0.01"
              min="0.01"
              placeholder={`Sample ${i + 1}`}
              value={w}
              onChange={(e) => handleWeightChange(i, e.target.value)}
              required
              className={inputClass}
            />
          ))}
        </div>
      </div>

      {duplicateDate && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          A subgroup for {formatBatchDate(productionDate)} is already recorded.
          {needsDuplicateConfirm
            ? ' Check the date, or save again to record a second subgroup for that day.'
            : ' A second subgroup for this date will be recorded.'}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary text-white px-4 py-2 text-sm font-medium transition hover:bg-primary-hover disabled:opacity-50"
      >
        {submitting ? 'Saving…' : duplicateDate && !needsDuplicateConfirm ? 'Save anyway' : 'Save subgroup'}
      </button>
    </form>
  );
}
