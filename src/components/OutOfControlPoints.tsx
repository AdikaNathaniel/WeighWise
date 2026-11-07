import { formatBatchDate } from '@/lib/pChartFormat';
import { Phase, Workflow } from '@/lib/reviewWorkflow';
import { ChartKind, OUTCOME_LABELS, ReviewItem, signalLabel } from '@/lib/signalReview';
import { Subgroup } from '@/types/spc';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-base text-foreground">{value}</div>
    </div>
  );
}

function SignalSection({
  chart,
  title,
  items,
  phase,
  onReview,
  onReviewAll,
  onReopen,
}: {
  chart: ChartKind;
  title: string;
  items: ReviewItem[];
  phase: Phase;
  onReview: (item: ReviewItem, chart: ChartKind) => void;
  onReviewAll: (chart: ChartKind) => void;
  onReopen: (subgroup: Subgroup) => void;
}) {
  // The R chart is investigated first; X-bar review opens once every R signal is reviewed.
  const locked = chart === 'x-bar' && phase === 'r';
  const pending = items.filter((i) => !i.subgroup.review);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">
          {title}{' '}
          <span className="font-normal text-muted">
            · {items.length} signalling, {pending.length} awaiting review
          </span>
        </h4>
        {!locked && pending.length > 1 && (
          <button
            type="button"
            onClick={() => onReviewAll(chart)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Review all {pending.length} {chart === 'r' ? 'R-chart' : 'X-bar'} signals
          </button>
        )}
      </div>

      {locked && items.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Investigate the R-chart signals first. X-bar signals can be reviewed once every R-chart
          signal has been reviewed.
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-md border border-primary-soft bg-primary-soft px-3 py-2 text-sm text-primary-hover">
          No signals on the current {chart === 'r' ? 'R' : 'X-bar'} chart.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const review = item.subgroup.review;
            return (
              <li
                key={item.subgroup.id}
                className="rounded-lg border border-border bg-background/60 px-4 py-3"
              >
                <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                  <Fact
                    label={`Subgroup ${item.number} · Production date`}
                    value={formatBatchDate(item.subgroup.productionDate)}
                  />
                  <Fact label="Mean" value={`${item.subgroup.mean.toFixed(2)} g`} />
                  <Fact label="Range" value={`${item.subgroup.range.toFixed(2)} g`} />
                  {review ? (
                    <button
                      type="button"
                      onClick={() => onReopen(item.subgroup)}
                      className="rounded-md border border-border bg-surface px-5 py-2 text-sm font-medium text-muted hover:text-foreground"
                    >
                      Reopen review
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => onReview(item, chart)}
                      title={locked ? 'Investigate the R chart first' : undefined}
                      className="rounded-md border border-border bg-surface px-5 py-2 text-sm font-medium text-foreground hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Review signal
                    </button>
                  )}
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {item.signals.map((s) => (
                    <li
                      key={`${s.chart}-${s.rule}`}
                      className="rounded-full bg-red-50 px-3 py-0.5 text-xs text-red-800"
                    >
                      {signalLabel(s)}
                    </li>
                  ))}
                  {review && (
                    <li className="rounded-full bg-amber-50 px-3 py-0.5 text-xs font-medium text-amber-900">
                      Retained — {OUTCOME_LABELS[review.outcome].toLowerCase()}
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * The subgroups signalling on the current charts. The R chart is investigated
 * first; a signal is only resolved by a review, and a retained subgroup keeps
 * signalling until its cause is confirmed or the process changes.
 */
export function OutOfControlPoints({
  workflow,
  onReview,
  onReviewAll,
  onReopen,
}: {
  workflow: Workflow;
  onReview: (item: ReviewItem, chart: ChartKind) => void;
  onReviewAll: (chart: ChartKind) => void;
  onReopen: (subgroup: Subgroup) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Out-of-control points — current chart</h3>
        <p className="text-xs text-muted">
          Investigate each signal and record the outcome. Only a specific, evidenced assignable
          cause can exclude a subgroup; a possible or unexplained cause keeps it in the analysis.
        </p>
      </div>
      <SignalSection
        chart="r"
        title="R-chart signals"
        items={workflow.rItems}
        phase={workflow.phase}
        onReview={onReview}
        onReviewAll={onReviewAll}
        onReopen={onReopen}
      />
      <SignalSection
        chart="x-bar"
        title="X-bar signals"
        items={workflow.xBarItems}
        phase={workflow.phase}
        onReview={onReview}
        onReviewAll={onReviewAll}
        onReopen={onReopen}
      />
    </div>
  );
}
