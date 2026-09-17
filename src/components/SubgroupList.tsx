'use client';

import { useState } from 'react';
import { deleteSubgroup } from '@/lib/api';
import { Subgroup } from '@/types/spc';

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

export function SubgroupList({
  subgroups,
  onDeleted,
}: {
  subgroups: Subgroup[];
  onDeleted: () => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...subgroups].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  async function handleDelete(id: string) {
    setError(null);
    setDeletingId(id);
    try {
      await deleteSubgroup(id);
      setConfirmingId(null);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subgroup.');
    } finally {
      setDeletingId(null);
    }
  }

  if (subgroups.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
        No subgroups recorded yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold text-foreground">All recorded subgroups</h3>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 pr-4">Date</th>
              <th className="py-1 pr-4">n</th>
              <th className="py-1 pr-4">Mean (g)</th>
              <th className="py-1 pr-4">Range (g)</th>
              <th className="py-1 pr-4">Weights (g)</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="py-1.5 pr-4 whitespace-nowrap">{formatDate(s.productionDate)}</td>
                <td className="py-1.5 pr-4">{s.sampleSize}</td>
                <td className="py-1.5 pr-4">{fmt(s.mean)}</td>
                <td className="py-1.5 pr-4">{fmt(s.range)}</td>
                <td className="py-1.5 pr-4 text-muted">{s.weights.map(fmt).join(', ')}</td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  {confirmingId === s.id ? (
                    <span className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        disabled={deletingId === s.id}
                        className="rounded-md bg-red-600 text-white px-2 py-1 text-xs font-medium transition hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingId === s.id ? 'Deleting…' : 'Confirm'}
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
                    <button
                      type="button"
                      onClick={() => setConfirmingId(s.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
