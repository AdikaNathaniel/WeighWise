'use client';

import { useEffect, useState } from 'react';
import { updateSubgroup } from '@/lib/api';
import { Subgroup } from '@/types/spc';

const MIN_N = 2;
const MAX_N = 10;

const inputClass =
  'rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

function formatOptionLabel(s: Subgroup): string {
  const date = new Date(s.productionDate).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
  return `${date} — n=${s.sampleSize}, mean ${s.mean.toFixed(2)}g`;
}

export function SubgroupEditor({
  subgroups,
  onUpdated,
}: {
  subgroups: Subgroup[];
  onUpdated: () => void;
}) {
  const sorted = [...subgroups].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const [selectedId, setSelectedId] = useState<string>('');
  const [productionDate, setProductionDate] = useState('');
  const [sampleSize, setSampleSize] = useState(0);
  const [weights, setWeights] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const selected = subgroups.find((s) => s.id === selectedId);
    if (!selected) return;
    setProductionDate(selected.productionDate.slice(0, 10));
    setSampleSize(selected.sampleSize);
    setWeights(selected.weights.map((w) => String(w)));
    setError(null);
    setSuccess(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setSuccess(false);
  }

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
    if (!selectedId) return;
    setError(null);
    setSuccess(false);

    const parsedWeights = weights.map((w) => Number(w));
    if (parsedWeights.some((w) => !Number.isFinite(w) || weights.some((raw) => raw.trim() === ''))) {
      setError('Enter a valid weight for every sample.');
      return;
    }

    setSubmitting(true);
    try {
      await updateSubgroup(selectedId, { productionDate, sampleSize, weights: parsedWeights });
      setSuccess(true);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subgroup.');
    } finally {
      setSubmitting(false);
    }
  }

  if (subgroups.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">Edit a recorded subgroup</h3>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Select subgroup
        <select
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          className={inputClass}
        >
          <option value="">Choose a subgroup…</option>
          {sorted.map((s) => (
            <option key={s.id} value={s.id}>
              {formatOptionLabel(s)}
            </option>
          ))}
        </select>
      </label>

      {selectedId && (
        <form onSubmit={handleSubmit} className="space-y-4">
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
          {success && <p className="text-sm text-green-700">Subgroup updated.</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary text-white px-4 py-2 text-sm font-medium transition hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
    </div>
  );
}
