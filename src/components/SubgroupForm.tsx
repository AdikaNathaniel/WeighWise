'use client';

import { useState } from 'react';
import { createSubgroup } from '@/lib/api';

const MIN_N = 2;
const MAX_N = 10;

const inputClass =
  'rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SubgroupForm({ onCreated }: { onCreated: () => void }) {
  const [productionDate, setProductionDate] = useState(todayIso());
  const [sampleSize, setSampleSize] = useState(4);
  const [weights, setWeights] = useState<string[]>(Array(4).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSampleSizeChange(next: number) {
    const clamped = Math.min(MAX_N, Math.max(MIN_N, next));
    setSampleSize(clamped);
    setWeights((prev) => {
      const copy = prev.slice(0, clamped);
      while (copy.length < clamped) copy.push('');
      return copy;
    });
  }

  function handleWeightChange(index: number, value: string) {
    setWeights((prev) => prev.map((w, i) => (i === index ? value : w)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedWeights = weights.map((w) => Number(w));
    if (parsedWeights.some((w) => !Number.isFinite(w) || weights.some((raw) => raw.trim() === ''))) {
      setError('Enter a valid weight for every sample.');
      return;
    }

    setSubmitting(true);
    try {
      await createSubgroup({ productionDate, sampleSize, weights: parsedWeights });
      setWeights(Array(sampleSize).fill(''));
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
            required
            className={`w-24 ${inputClass}`}
          />
        </label>
      </div>

      <div>
        <div className="text-sm text-muted mb-2">Individual package weights (g)</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {weights.map((w, i) => (
            <input
              key={i}
              type="number"
              step="0.01"
              placeholder={`Sample ${i + 1}`}
              value={w}
              onChange={(e) => handleWeightChange(i, e.target.value)}
              required
              className={inputClass}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary text-white px-4 py-2 text-sm font-medium transition hover:bg-primary-hover disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Save subgroup'}
      </button>
    </form>
  );
}
