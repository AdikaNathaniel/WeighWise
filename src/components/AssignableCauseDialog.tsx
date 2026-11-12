'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { reviewSubgroup } from '@/lib/api';
import {
  ASSIGNABLE_CAUSES,
  AssignableCauseCategory,
  EVIDENCE_TYPES,
  ReviewOutcome,
} from '@/lib/assignableCauses';
import { formatBatchDate } from '@/lib/pChartFormat';
import { CHART_NAMES, limitName, OUTCOME_LABELS, ReviewItem, signalLabel } from '@/lib/signalReview';
import { ruleLabel } from '@/lib/nelsonRules';

/** Today as a local calendar date (YYYY-MM-DD), not the UTC date. */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The reviewer's name is a per-browser convenience so it need not be retyped.
const REVIEWER_KEY = 'processwise.reviewer';

function savedReviewer(): string {
  try {
    return window.localStorage.getItem(REVIEWER_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveReviewer(name: string) {
  try {
    window.localStorage.setItem(REVIEWER_KEY, name);
  } catch {
    // Storage unavailable — the name is simply asked for again next time.
  }
}

const OUTCOME_DETAILS: Record<ReviewOutcome, string> = {
  confirmed: 'A documented batch-specific event explains the signal.',
  possible: 'A plausible explanation exists, but the evidence is insufficient.',
  none: 'The signal was investigated but remains unexplained.',
};

const CATEGORIES = Object.keys(ASSIGNABLE_CAUSES) as AssignableCauseCategory[];

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40';

function Fact({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-base font-semibold ${alert ? 'text-red-700' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">
        <span className="mr-2 text-muted">Step {n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Notice({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        tone === 'warn'
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-primary-soft bg-primary-soft/60 text-primary-hover'
      }`}
    >
      {children}
    </div>
  );
}

function CheckList({
  options,
  selected,
  onToggle,
  columns = 1,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (option: string) => void;
  columns?: 1 | 3;
}) {
  return (
    <div
      className={`grid gap-2 rounded-lg border border-border bg-background/60 p-3 ${
        columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'
      }`}
    >
      {options.map((option) => (
        <label key={option} className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * The review of one signalling subgroup. Keyed by subgroup in the dialog, so
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
  const [outcome, setOutcome] = useState<ReviewOutcome | null>(null);
  const [category, setCategory] = useState<AssignableCauseCategory | ''>('');
  const [causes, setCauses] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [found, setFound] = useState('');
  const [action, setAction] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [reviewer, setReviewer] = useState(savedReviewer);
  const [investigatedOn, setInvestigatedOn] = useState(todayIso);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signal = item.signals[0];
  const confirmedCause = outcome === 'confirmed';
  // A confirmed cause records its corrective action; a retained subgroup its follow-up.
  const followUpText = (confirmedCause ? action : followUp).trim();
  const common = Boolean(outcome) && reviewer.trim() !== '' && Boolean(investigatedOn);

  const exclusionGaps = [
    !category && 'select the primary cause category',
    causes.length === 0 && 'select at least one specific cause',
    evidence.length === 0 && 'record the evidence reviewed',
    !found.trim() && 'describe what was found',
    !action.trim() && 'record the corrective or follow-up action',
    !reviewer.trim() && 'enter the reviewer',
    !confirmed && 'accept the confirmation statement',
  ].filter((g): g is string => Boolean(g));
  const canExclude = confirmedCause && common && exclusionGaps.length === 0;
  const canRetain = common && followUpText !== '';

  function chooseCategory(next: AssignableCauseCategory | '') {
    setCategory(next);
    setCauses([]);
  }

  function chooseOutcome(next: ReviewOutcome) {
    setOutcome(next);
    setConfirmed(false);
    if (next === 'none') chooseCategory('');
  }

  let hint = 'The next fields depend on the investigation outcome.';
  if (outcome && !confirmedCause) hint = 'Exclude subgroup is unavailable because the cause was not confirmed.';
  if (confirmedCause) {
    hint = canExclude
      ? 'All exclusion conditions have been met.'
      : `To exclude: ${exclusionGaps.join(', ')}.`;
  }

  async function save(excluded: boolean) {
    if (!outcome || (excluded ? !canExclude : !canRetain)) return;
    const text = (value: string) => value.trim() || null;
    setSaving(true);
    setError(null);
    try {
      await reviewSubgroup(item.subgroup.id, {
        chart: signal.chart,
        rule: signal.rule,
        direction: signal.direction,
        value: signal.value,
        limitType: signal.limitType,
        trialLimit: signal.limit,
        outcome,
        excluded,
        category: outcome === 'none' ? null : category || null,
        causes: outcome === 'none' ? [] : causes,
        evidence,
        found: text(found),
        correctiveAction: confirmedCause ? text(action) : null,
        followUp: excluded ? null : followUpText,
        reviewer: reviewer.trim(),
        investigatedOn,
        ...(excluded ? { confirmed: true } : {}),
      });
      saveReviewer(reviewer.trim());
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the review.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
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

      <div className="max-h-[65vh] overflow-y-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-background/60 px-5 py-4 sm:grid-cols-5">
          <Fact label="Chart signal" value={`${CHART_NAMES[signal.chart]} · ${ruleLabel(signal.rule)}`} />
          <Fact label="Subgroup" value={String(item.number)} />
          <Fact label="Production date" value={formatBatchDate(item.subgroup.productionDate)} />
          <Fact
            label={signal.chart === 'r' ? 'Range' : 'Mean'}
            value={`${signal.value.toFixed(2)} g`}
            alert
          />
          <Fact label={limitName(signal.limitType)} value={`${signal.limit.toFixed(2)} g`} />
        </div>

        <Step n={1} title="Investigation outcome *">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
            {(Object.keys(OUTCOME_LABELS) as ReviewOutcome[]).map((o) => (
              <label
                key={o}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  outcome === o ? 'border-primary bg-primary-soft/60' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name="outcome"
                  checked={outcome === o}
                  onChange={() => chooseOutcome(o)}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold text-foreground">{OUTCOME_LABELS[o]}</span>
                  <span className="block text-xs text-muted">{OUTCOME_DETAILS[o]}</span>
                </span>
              </label>
            ))}
          </div>
          <Notice tone="warn">
            Important: A control-chart signal alone is not enough to exclude a subgroup. The
            decision must be supported by a specific event affecting that production batch.
          </Notice>
        </Step>

        {outcome && !confirmedCause && (
          <Notice tone="warn">
            <p className="font-semibold">
              This subgroup must be retained because a specific assignable cause was not confirmed.
            </p>
            <p className="mt-1">
              {outcome === 'possible'
                ? 'Record the suspected cause and follow-up monitoring, but do not revise the control limits by removing the subgroup.'
                : 'Record what was investigated and the follow-up monitoring. No cause needs to be selected.'}
            </p>
          </Notice>
        )}

        {outcome && outcome !== 'none' && (
          <>
            <Step n={2} title={confirmedCause ? 'Primary cause category *' : 'Suspected cause category (optional)'}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={category}
                  onChange={(e) => chooseCategory(e.target.value as AssignableCauseCategory | '')}
                  className={`${inputClass} ${category ? '' : 'text-muted'}`}
                >
                  <option value="">Select a category…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">
                  Use only these five categories. They cover the main problems identified in the
                  Tom Brown packaging process. A category describes where the cause belongs; the
                  next step records the exact event that occurred.
                </p>
              </div>
            </Step>

            {category && (
              <Step
                n={3}
                title={confirmedCause ? 'Specific cause or contributing factors *' : 'Suspected causes (optional)'}
              >
                <CheckList
                  options={ASSIGNABLE_CAUSES[category]}
                  selected={causes}
                  onToggle={(c) => setCauses((prev) => toggle(prev, c))}
                />
                <Notice tone="warn">
                  <p className="font-semibold">Selection rule</p>
                  <p className="mt-1">
                    Select only events that were recalled, observed or supported by a production
                    record. A general process weakness, such as manual filling or the absence of
                    automated filling equipment, does not by itself justify excluding one
                    subgroup. The investigation must identify a specific event affecting that
                    production batch.
                  </p>
                  {confirmedCause && (
                    <p className="mt-1 font-semibold">
                      If the event is only suspected, choose “Possible cause, not confirmed” and
                      retain the subgroup.
                    </p>
                  )}
                </Notice>
              </Step>
            )}
          </>
        )}

        {outcome && (
          <Step n={4} title={confirmedCause ? 'Evidence, findings and corrective action' : 'Evidence and follow-up'}>
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">
                Evidence reviewed{confirmedCause ? ' *' : ''}
              </span>
              <CheckList
                options={EVIDENCE_TYPES}
                selected={evidence}
                onToggle={(e) => setEvidence((prev) => toggle(prev, e))}
                columns={3}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">
                  {outcome === 'none' ? 'What was investigated?' : 'What was found?'}
                  {confirmedCause ? ' *' : ''}
                </span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={found}
                  onChange={(e) => setFound(e.target.value)}
                  placeholder={
                    confirmedCause
                      ? 'Describe the specific event and the evidence for it…'
                      : 'Describe what was checked and what was learned…'
                  }
                  className={inputClass}
                />
              </label>
              {confirmedCause ? (
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-foreground">Corrective or follow-up action *</span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="What action was taken or is planned?"
                    className={inputClass}
                  />
                </label>
              ) : (
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-foreground">Follow-up action *</span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder="e.g. Retain the subgroup, improve production records and monitor the same condition in future batches."
                    className={inputClass}
                  />
                </label>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Reviewed by *</span>
                <input
                  value={reviewer}
                  maxLength={100}
                  onChange={(e) => setReviewer(e.target.value)}
                  placeholder="Name of the person who investigated"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Date investigated *</span>
                <input
                  type="date"
                  value={investigatedOn}
                  max={todayIso()}
                  onChange={(e) => setInvestigatedOn(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          </Step>
        )}

        {confirmedCause && (
          <Step n={5} title="Confirmation and exclusion">
            <label className="flex items-start gap-3 rounded-lg border border-primary-soft bg-primary-soft/60 p-4 text-sm text-foreground">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block font-medium">
                  I confirm that a specific assignable cause affecting this subgroup was identified
                  and supported by evidence.
                </span>
                <span className="mt-1 block text-xs text-muted">
                  Exclusion applies only to revised X-bar and R-chart calculations; the original
                  observations remain in the trial chart and investigation history.
                </span>
              </span>
            </label>
            <Notice tone="warn">
              Never delete the original data. Exclusion means “omit from revised limit
              estimation,” not “erase from the dataset.” After an exclusion, both charts are
              recalculated from the retained subgroups and the subgroup numbers are kept.
            </Notice>
          </Step>
        )}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-3">
        <span className="mr-auto max-w-sm text-xs text-muted">
          {hint}
          {queueRemaining > 0 &&
            ` ${queueRemaining} more signal${queueRemaining === 1 ? '' : 's'} to review.`}
        </span>
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
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
        <button
          type="button"
          onClick={() => save(false)}
          disabled={!canRetain || saving}
          className="rounded-md border-2 border-foreground/70 bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-background disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Retain subgroup'}
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={!canExclude || saving}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {saving ? 'Saving…' : 'Exclude subgroup'}
        </button>
      </div>
    </form>
  );
}

/**
 * The investigation of one signalling subgroup. Every outcome is recorded;
 * only a confirmed, evidenced cause can exclude the whole subgroup from the
 * revised X-bar and R limits, after which both charts are recalculated.
 */
export function AssignableCauseDialog({
  item,
  queueRemaining = 0,
  onSaved,
  onSkip,
  onClose,
}: {
  item: ReviewItem | null;
  /** Other signals still to review after this one, when working through them all. */
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
      className="m-auto w-[calc(100%-2rem)] max-w-4xl rounded-xl border border-border bg-surface p-0 shadow-xl backdrop:bg-black/40"
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
