'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { excludeSubgroup } from '@/lib/api';
import { ASSIGNABLE_CAUSES, OTHER_CAUSE } from '@/lib/assignableCauses';
import { formatBatchDate } from '@/lib/pChartFormat';
import { limitName, ReviewItem, signalLabel } from '@/lib/signalReview';

// Option values join category and cause, which is how they are stored.
const SEPARATOR = '::';

/** Today as a local calendar date (YYYY-MM-DD), not the UTC date. */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-base text-foreground">{value}</div>
    </div>
  );
}

/**
 * The fields for one subgroup's review. Keyed by subgroup in the dialog, so
 * each point opens on a fresh form.
 */
function ReviewForm({
  item,
  titleId,
  queueRemaining,
  saving,
  setSaving,
  onSaved,
  onSkip,
  onClose,
}: {
  item: ReviewItem;
  titleId: string;
  queueRemaining: number;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onSaved: () => void;
  onSkip?: () => void;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState('');
  const [investigatedOn, setInvestigatedOn] = useState(todayIso);
  const [found, setFound] = useState('');
  const [action, setAction] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signal = item.signals[0];
  const canSave =
    Boolean(selection) &&
    Boolean(investigatedOn) &&
    found.trim() !== '' &&
    action.trim() !== '' &&
    confirmed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const [category, cause] = selection.split(SEPARATOR);
    setSaving(true);
    setError(null);
    try {
      await excludeSubgroup(item.subgroup.id, {
        chart: signal.chart,
        rule: signal.rule,
        direction: signal.direction,
        value: signal.value,
        limitType: signal.limitType,
        trialLimit: signal.limit,
        category,
        cause,
        found: found.trim(),
        correctiveAction: action.trim(),
        investigatedOn,
        confirmed: true,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the review.');
    } finally {
      setSaving(false);
    }
  }

  return (

    <form onSubmit={handleSubmit}>
      <div className="border-b border-border px-6 pt-5 pb-4 space-y-2">
        <h2 id={titleId} className="text-xl font-bold text-foreground">
          Review assignable cause
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {item.signals.map((s) => (
            <li
              key={`${s.chart}-${s.rule}`}
              className="rounded-full bg-red-50 px-4 py-1 text-xs text-red-800"
            >
              {signalLabel(s)}
            </li>
          ))}
        </ul>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-primary-soft/60 px-5 py-4 sm:grid-cols-4">
          <Fact label="Subgroup" value={String(item.number)} />
          <Fact label="Date" value={formatBatchDate(item.subgroup.productionDate)} />
          <Fact
            label={signal.chart === 'r' ? 'Range' : 'Mean'}
            value={`${signal.value.toFixed(2)} g`}
          />
          <Fact label={`Trial ${limitName(signal.limitType)}`} value={`${signal.limit.toFixed(2)} g`} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-foreground">
              Assignable-cause category *
            </span>
            <select
              required
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
              className={`${inputClass} ${selection ? '' : 'text-muted'}`}
            >
              <option value="" disabled>
                Select a category…
              </option>
              {Object.entries(ASSIGNABLE_CAUSES).map(([category, causes]) => (
                <optgroup key={category} label={category}>
                  {causes.map((cause) => (
                    <option key={cause} value={`${category}${SEPARATOR}${cause}`}>
                      {cause}
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Other">
                <option value={`Other${SEPARATOR}${OTHER_CAUSE}`}>{OTHER_CAUSE}</option>
              </optgroup>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-foreground">Date investigated</span>
            <input
              type="date"
              required
              value={investigatedOn}
              max={todayIso()}
              onChange={(e) => setInvestigatedOn(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-foreground">What was found? Required *</span>
          <textarea
            required
            rows={2}
            maxLength={2000}
            value={found}
            onChange={(e) => setFound(e.target.value)}
            placeholder="Describe the evidence for the assignable cause…"
            className={inputClass}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-foreground">
            Corrective action taken Required *
          </span>
          <textarea
            required
            rows={2}
            maxLength={2000}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="What action was taken to address it?"
            className={inputClass}
          />
        </label>

        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            I confirm a specific assignable cause was identified and this whole subgroup should
            be excluded from both revised X-bar and R-chart calculations.
          </span>
        </label>

        <p className="rounded-md bg-primary-soft px-4 py-2 text-sm text-primary-hover">
          Original data stay in the trial chart and revision history.
        </p>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-3">
        {queueRemaining > 0 && (
          <span className="mr-auto text-xs text-muted">
            {queueRemaining} more point{queueRemaining === 1 ? '' : 's'} to review
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        {onSkip && queueRemaining > 0 && (
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-primary-soft disabled:opacity-50"
          >
            Skip — no cause found
          </button>
        )}
        <button
          type="submit"
          disabled={!canSave || saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Exclude subgroup'}
        </button>
      </div>
    </form>
  );
}

/**
 * The assignable-cause review for one out-of-control subgroup. Saving records
 * the investigation and excludes the whole subgroup from the revised X-bar
 * and R limits; its data stay on the trial chart.
 */
export function AssignableCauseDialog({
  item,
  queueRemaining = 0,
  onSaved,
  onSkip,
  onClose,
}: {
  item: ReviewItem | null;
  /** Other points still to review after this one, when working through them all. */
  queueRemaining?: number;
  onSaved: () => void;
  onSkip?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [saving, setSaving] = useState(false);
  const open = item !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !saving) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-xl border border-border bg-surface p-0 shadow-xl backdrop:bg-black/40"
    >
      {item && item.signals.length > 0 && (
        <ReviewForm
          key={item.subgroup.id}
          item={item}
          titleId={titleId}
          queueRemaining={queueRemaining}
          saving={saving}
          setSaving={setSaving}
          onSaved={onSaved}
          onSkip={onSkip}
          onClose={onClose}
        />
      )}
    </dialog>
  );
}
