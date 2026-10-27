'use client';

import { useState } from 'react';
import { reinstateSubgroup } from '@/lib/api';
import { formatBatchDate } from '@/lib/pChartFormat';
import { signalLabel } from '@/lib/signalReview';
import { Subgroup } from '@/types/spc';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * The revision history: subgroups excluded from the revised limits, with the
 * assignable cause recorded for each. Reinstating puts one back into the limits.
 */
export function ExcludedSubgroups({
  subgroups,
  onReinstated,
}: {
  /** All active subgroups in production order; the excluded ones are listed. */
  subgroups: Subgroup[];
  onReinstated: () => void;
}) {
  const [pending, setPending] = useState<Subgroup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const excluded = subgroups
    .map((s, i) => ({ subgroup: s, number: i + 1 }))
    .filter(({ subgroup }) => subgroup.exclusion);

  if (excluded.length === 0) return null;

  async function confirmReinstate() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await reinstateSubgroup(pending.id);
      setPending(null);
      onReinstated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reinstate the subgroup.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Excluded subgroups — revision history</h3>
        <p className="text-xs text-muted">
          These subgroups had an assignable cause and are left out of the revised limits. Their
          data are unchanged and still appear on the trial chart.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="py-1.5 pr-3">Subgroup</th>
              <th className="py-1.5 pr-3">Signal</th>
              <th className="py-1.5 pr-3">Assignable cause</th>
              <th className="py-1.5 pr-3">Found / action taken</th>
              <th className="py-1.5 pr-3">Investigated</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {excluded.map(({ subgroup, number }) => {
              const x = subgroup.exclusion!;
              return (
                <tr key={subgroup.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <span className="font-medium">{number}</span>
                    <span className="block text-xs text-muted">
                      {formatBatchDate(subgroup.productionDate)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-red-800">
                    {signalLabel(x)}
                    <span className="block text-muted">
                      {x.value.toFixed(2)} g vs trial {x.trialLimit.toFixed(2)} g
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-xs font-semibold text-muted">{x.category}</span>
                    <span className="block">{x.cause}</span>
                  </td>
                  <td className="py-2 pr-3 max-w-xs">
                    <span className="block">{x.found}</span>
                    <span className="block text-xs text-muted">Action: {x.correctiveAction}</span>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatBatchDate(x.investigatedOn)}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setPending(subgroup)}
                      className="text-sm font-medium text-primary underline hover:text-primary-hover"
                    >
                      Reinstate
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Reinstate subgroup?"
        message={
          pending && (
            <>
              The subgroup from {formatBatchDate(pending.productionDate)} will count toward the
              control limits again and the revised charts will be recalculated. Its review is
              kept in the database history.
            </>
          )
        }
        confirmLabel="Reinstate"
        busy={busy}
        onConfirm={confirmReinstate}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
