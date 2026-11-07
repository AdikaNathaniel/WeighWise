'use client';

import { useState } from 'react';
import { reopenReview } from '@/lib/api';
import { formatBatchDate } from '@/lib/pChartFormat';
import { OUTCOME_LABELS, signalLabel } from '@/lib/signalReview';
import { Subgroup } from '@/types/spc';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * The investigation history: every reviewed signal with its outcome, the
 * decision to exclude or retain, the evidence and who reviewed it. Reopening
 * a review returns an excluded subgroup to the limits; the review is kept in
 * the database as part of the audit trail.
 */
export function InvestigationHistory({
  subgroups,
  reopening,
  onReopenRequest,
  onReopenCancel,
  onReopened,
}: {
  /** All active subgroups in production order; the reviewed ones are listed. */
  subgroups: Subgroup[];
  /** The subgroup whose review is about to be reopened, if any. */
  reopening: Subgroup | null;
  onReopenRequest: (subgroup: Subgroup) => void;
  onReopenCancel: () => void;
  onReopened: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewed = subgroups
    .map((s, i) => ({ subgroup: s, number: i + 1 }))
    .filter(({ subgroup }) => subgroup.review);
  const excludedNumbers = reviewed.filter(({ subgroup }) => subgroup.exclusion).map((r) => r.number);
  const numberOf = (s: Subgroup | null) => (s ? subgroups.indexOf(s) + 1 : 0);

  async function confirmReopen() {
    if (!reopening) return;
    setBusy(true);
    setError(null);
    try {
      await reopenReview(reopening.id);
      onReopened();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reopen the review.');
    } finally {
      setBusy(false);
    }
  }

  const dialog = (
    <ConfirmDialog
      open={reopening !== null}
      title={`Reopen the review of subgroup ${numberOf(reopening)}?`}
      message={
        reopening && (
          <>
            {reopening.exclusion
              ? 'The subgroup will count toward the control limits again and the charts will be recalculated. '
              : 'The subgroup will be listed for investigation again. '}
            The current review is kept in the database history.
          </>
        )
      }
      confirmLabel="Reopen review"
      busy={busy}
      onConfirm={confirmReopen}
      onCancel={onReopenCancel}
    />
  );

  if (reviewed.length === 0) return dialog;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Investigation history</h3>
        <p className="text-xs text-muted">
          Every reviewed signal, with its outcome and evidence. Excluded subgroups are left out
          of the revised limits only — their original observations remain in the trial chart and
          the Records page.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-background/60 px-4 py-3">
        <div className="text-xs font-semibold text-muted">Excluded from revised calculations</div>
        {excludedNumbers.length === 0 ? (
          <p className="mt-1 text-sm text-foreground">None — every reviewed subgroup was retained.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {excludedNumbers.map((n) => (
              <li
                key={n}
                className="rounded-full border border-red-200 bg-red-50 px-3 py-0.5 text-xs font-semibold text-red-800"
              >
                SG {n}
              </li>
            ))}
          </ul>
        )}
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
              <th className="py-1.5 pr-3">Outcome / decision</th>
              <th className="py-1.5 pr-3">Cause</th>
              <th className="py-1.5 pr-3">Evidence and findings</th>
              <th className="py-1.5 pr-3">Reviewed</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {reviewed.map(({ subgroup, number }) => {
              const r = subgroup.review!;
              return (
                <tr key={subgroup.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <span className="font-medium">{number}</span>
                    <span className="block text-xs text-muted">
                      {formatBatchDate(subgroup.productionDate)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-red-800">
                    {signalLabel(r)}
                    <span className="block text-muted">
                      {r.value.toFixed(2)} g vs {r.trialLimit.toFixed(2)} g
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="block">{OUTCOME_LABELS[r.outcome]}</span>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.excluded ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'
                      }`}
                    >
                      {r.excluded ? 'Excluded' : 'Retained'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 max-w-[14rem]">
                    {r.category ? (
                      <>
                        <span className="text-xs font-semibold text-muted">{r.category}</span>
                        <ul className="list-disc pl-4">
                          {r.causes.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 max-w-xs space-y-0.5">
                    {r.evidence.length > 0 && (
                      <span className="block text-xs text-muted">Evidence: {r.evidence.join(', ')}</span>
                    )}
                    {r.found && <span className="block">{r.found}</span>}
                    {r.correctiveAction && (
                      <span className="block text-xs text-muted">Action: {r.correctiveAction}</span>
                    )}
                    {r.followUp && (
                      <span className="block text-xs text-muted">Follow-up: {r.followUp}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {formatBatchDate(r.investigatedOn)}
                    {r.reviewer && <span className="block text-xs text-muted">{r.reviewer}</span>}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onReopenRequest(subgroup)}
                      className="text-sm font-medium text-primary underline hover:text-primary-hover"
                    >
                      Reopen
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  );
}
