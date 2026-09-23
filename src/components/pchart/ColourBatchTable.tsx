'use client';

import { Fragment, useState } from 'react';
import { deleteColourBatch, updateColourBatch } from '@/lib/api';
import { formatBatchDate, formatPercent, INVESTIGATE_MESSAGE } from '@/lib/pChartFormat';
import { PChartPoint } from '@/types/pChart';
import { BatchDraft, inputClass, validateBatchDraft } from './batchValidation';

const cellInput = `${inputClass} w-full min-w-0 px-2 py-1`;

function StatusPill({ outOfControl }: { outOfControl: boolean }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
        outOfControl ? 'bg-red-600 text-white' : 'bg-primary-soft text-primary-hover'
      }`}
    >
      {outOfControl ? 'Out of control' : 'In control'}
    </span>
  );
}

export function ColourBatchTable({
  points,
  onChanged,
}: {
  points: PChartPoint[];
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BatchDraft | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEdit(p: PChartPoint) {
    setError(null);
    setConfirmingId(null);
    setEditingId(p.batchId);
    setDraft({
      batchLabel: p.batchLabel,
      productionDate: p.productionDate?.slice(0, 10) ?? '',
      samplesInspected: String(p.samplesInspected),
      nonconforming: String(p.nonconforming),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setError(null);
  }

  async function saveEdit(id: string) {
    if (!draft) return;
    const result = validateBatchDraft(draft);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await updateColourBatch(id, result.input);
      cancelEdit();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update batch.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await deleteColourBatch(id);
      setConfirmingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete batch.');
    } finally {
      setBusyId(null);
    }
  }

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
        No batches recorded yet — add the first batch above.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Batch calculations</h3>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="max-h-[36rem] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-left text-muted text-xs">
              <th className="py-1.5 pr-3">Batch</th>
              <th className="py-1.5 pr-3">Date</th>
              <th className="py-1.5 pr-3">n</th>
              <th className="py-1.5 pr-3">d</th>
              <th className="py-1.5 pr-3">n−d</th>
              <th className="py-1.5 pr-3">p</th>
              <th className="py-1.5 pr-3">σp</th>
              <th className="py-1.5 pr-3">CL (p̄)</th>
              <th className="py-1.5 pr-3">UCL</th>
              <th className="py-1.5 pr-3">LCL</th>
              <th className="py-1.5 pr-3">Status</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {points.map((p) => {
              const outOfControl = p.status === 'out-of-control';
              const editing = editingId === p.batchId && draft !== null;
              const busy = busyId === p.batchId;
              const rowTone = outOfControl ? 'bg-red-50' : '';

              return (
                <Fragment key={p.batchId}>
                  <tr className={`border-t border-border ${rowTone}`}>
                    {editing ? (
                      <>
                        <td className="py-1.5 pr-2">
                          <input
                            className={`${cellInput} w-20`}
                            maxLength={64}
                            value={draft.batchLabel}
                            onChange={(e) => setDraft({ ...draft, batchLabel: e.target.value })}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="date"
                            className={`${cellInput} w-36`}
                            value={draft.productionDate}
                            onChange={(e) => setDraft({ ...draft, productionDate: e.target.value })}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            className={`${cellInput} w-16`}
                            value={draft.samplesInspected}
                            onChange={(e) =>
                              setDraft({ ...draft, samplesInspected: e.target.value })
                            }
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className={`${cellInput} w-16`}
                            value={draft.nonconforming}
                            onChange={(e) => setDraft({ ...draft, nonconforming: e.target.value })}
                          />
                        </td>
                        <td colSpan={7} className="py-1.5 pr-3 text-xs text-muted">
                          Calculations update when you save.
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-1.5 pr-3 font-medium">{p.batchLabel}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {formatBatchDate(p.productionDate)}
                        </td>
                        <td className="py-1.5 pr-3">{p.samplesInspected}</td>
                        <td className="py-1.5 pr-3">{p.nonconforming}</td>
                        <td className="py-1.5 pr-3">{p.conforming}</td>
                        <td
                          className={`py-1.5 pr-3 ${outOfControl ? 'font-semibold text-red-700' : ''}`}
                        >
                          {formatPercent(p.proportion)}
                        </td>
                        <td className="py-1.5 pr-3 text-muted">{formatPercent(p.sigma)}</td>
                        <td className="py-1.5 pr-3 text-muted">{formatPercent(p.cl)}</td>
                        <td className="py-1.5 pr-3 text-muted">{formatPercent(p.ucl)}</td>
                        <td className="py-1.5 pr-3 text-muted">{formatPercent(p.lcl)}</td>
                        <td className="py-1.5 pr-3">
                          <StatusPill outOfControl={outOfControl} />
                        </td>
                      </>
                    )}

                    <td className="py-1.5 text-right whitespace-nowrap">
                      {editing ? (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(p.batchId)}
                            disabled={busy}
                            className="rounded-md bg-primary text-white px-2 py-1 text-xs font-medium transition hover:bg-primary-hover disabled:opacity-50"
                          >
                            {busy ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : confirmingId === p.batchId ? (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(p.batchId)}
                            disabled={busy}
                            className="rounded-md bg-red-600 text-white px-2 py-1 text-xs font-medium transition hover:bg-red-700 disabled:opacity-50"
                          >
                            {busy ? 'Deleting…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            disabled={editingId !== null}
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted hover:text-foreground disabled:opacity-40"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setConfirmingId(p.batchId);
                            }}
                            disabled={editingId !== null}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>

                  {outOfControl && !editing && (
                    <tr className={rowTone}>
                      <td colSpan={12} className="pb-2 pr-3 text-xs text-red-700">
                        ⚠ Batch {p.batchLabel} is {p.violatedLimit === 'lcl' ? 'below the LCL' : 'above the UCL'}.{' '}
                        {INVESTIGATE_MESSAGE}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
