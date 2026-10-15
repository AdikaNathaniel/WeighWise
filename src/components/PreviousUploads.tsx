'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchArchivedSubgroups, restoreSubgroups } from '@/lib/api';
import { formatBatchDate } from '@/lib/pChartFormat';
import { ArchivedSubgroupSet } from '@/types/spc';
import { ConfirmDialog } from './ConfirmDialog';

function formatArchivedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Earlier subgroup sets that were replaced by a spreadsheet upload. They no
 * longer count toward the charts or calculations but can be viewed, and any
 * set can be made the active one again.
 */
export function PreviousUploads({
  activeCount,
  refreshKey,
  onRestored,
}: {
  activeCount: number;
  /** Changes whenever the active set changes, so the list re-fetches. */
  refreshKey: unknown;
  onRestored: () => void;
}) {
  const [sets, setSets] = useState<ArchivedSubgroupSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<ArchivedSubgroupSet | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchArchivedSubgroups()
      .then((result) => {
        setSets(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load previous uploads.'));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function handleRestore() {
    if (!restoring) return;
    setBusy(true);
    try {
      await restoreSubgroups(restoring.archivedAt);
      setRestoring(null);
      setExpanded(null);
      onRestored();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore that set.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Previous uploads</h3>
        <p className="text-xs text-muted">
          Subgroups replaced by a spreadsheet upload. They are kept for reference but are not used
          in the charts or calculations.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {sets && sets.length === 0 && (
        <p className="text-sm text-muted">No previous uploads yet.</p>
      )}

      {sets?.map((set) => {
        const dates = set.subgroups.map((s) => s.productionDate).sort();
        const isOpen = expanded === set.archivedAt;
        return (
          <div key={set.archivedAt} className="rounded-md border border-border">
            <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2">
              <div className="text-sm">
                <span className="font-medium text-foreground">
                  {set.subgroups.length} subgroup{set.subgroups.length === 1 ? '' : 's'}
                </span>
                <span className="text-muted">
                  {' '}
                  · {formatBatchDate(dates[0])} – {formatBatchDate(dates[dates.length - 1])} ·
                  replaced {formatArchivedAt(set.archivedAt)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : set.archivedAt)}
                  className="rounded-md border border-border bg-surface px-3 py-1 text-sm font-medium text-muted hover:text-foreground"
                >
                  {isOpen ? 'Hide' : 'View'}
                </button>
                <button
                  type="button"
                  onClick={() => setRestoring(set)}
                  className="rounded-md border border-border bg-surface px-3 py-1 text-sm font-medium text-muted hover:text-foreground"
                >
                  Use this set
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="overflow-x-auto border-t border-border px-3 py-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1 pr-3">Production date</th>
                      <th className="py-1 pr-3">n</th>
                      <th className="py-1 pr-3">Weights (g)</th>
                      <th className="py-1 pr-3">Mean</th>
                      <th className="py-1 pr-3">Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {set.subgroups.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="py-1 pr-3">{formatBatchDate(s.productionDate)}</td>
                        <td className="py-1 pr-3">{s.sampleSize}</td>
                        <td className="py-1 pr-3">{s.weights.join(', ')}</td>
                        <td className="py-1 pr-3">{s.mean.toFixed(2)}</td>
                        <td className="py-1 pr-3">{s.range.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={restoring !== null}
        title={`Use these ${restoring?.subgroups.length ?? 0} subgroups?`}
        message={
          <p>
            They become the active set for the charts and calculations. The current{' '}
            {activeCount} subgroup{activeCount === 1 ? '' : 's'} will move to Previous uploads, so
            you can switch back at any time.
          </p>
        }
        confirmLabel="Use this set"
        busy={busy}
        onConfirm={handleRestore}
        onCancel={() => setRestoring(null)}
      />
    </div>
  );
}
