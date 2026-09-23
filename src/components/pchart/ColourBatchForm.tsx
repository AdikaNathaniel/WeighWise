'use client';

import { useState } from 'react';
import { createColourBatch } from '@/lib/api';
import { TARGET_COLOUR } from '@/lib/pChartFormat';
import { BatchDraft, inputClass, validateBatchDraft } from './batchValidation';

function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function ColourBatchForm({
  suggestedBatchLabel,
  onCreated,
}: {
  suggestedBatchLabel: string;
  onCreated: () => void;
}) {
  const [draft, setDraft] = useState<BatchDraft>({
    batchLabel: '',
    productionDate: todayIso(),
    samplesInspected: '',
    nonconforming: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof BatchDraft>(key: K, value: BatchDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // A blank batch number falls back to the next number in sequence.
    const result = validateBatchDraft({
      ...draft,
      batchLabel: draft.batchLabel.trim() || suggestedBatchLabel,
    });
    if (result.error !== null) {
      setError(result.error);
      return;
    }

    setSubmitting(true);
    try {
      await createColourBatch(result.input);
      setDraft((prev) => ({ ...prev, batchLabel: '', samplesInspected: '', nonconforming: '' }));
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save batch.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-5 space-y-4 shadow-sm"
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">Record a production batch</h3>
        <p className="text-xs text-muted mt-1">
          Target colour: <span className="font-medium text-foreground">{TARGET_COLOUR}</span>. Using
          the colour reference chart, count each sample as conforming (within the light-brown range)
          or nonconforming (too light or too dark).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Batch number
          <input
            type="text"
            maxLength={64}
            placeholder={suggestedBatchLabel}
            value={draft.batchLabel}
            onChange={(e) => set('batchLabel', e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          Production date
          <input
            type="date"
            value={draft.productionDate}
            onChange={(e) => set('productionDate', e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          Samples inspected (n)
          <input
            type="number"
            min={1}
            step={1}
            value={draft.samplesInspected}
            onChange={(e) => set('samplesInspected', e.target.value)}
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          Outside target colour (d)
          <input
            type="number"
            min={0}
            step={1}
            value={draft.nonconforming}
            onChange={(e) => set('nonconforming', e.target.value)}
            required
            className={inputClass}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary text-white px-4 py-2 text-sm font-medium transition hover:bg-primary-hover disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Add batch'}
      </button>
    </form>
  );
}
