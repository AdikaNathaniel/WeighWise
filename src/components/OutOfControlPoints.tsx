import { formatBatchDate } from '@/lib/pChartFormat';
import { ReviewItem, signalLabel } from '@/lib/signalReview';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-base text-foreground">{value}</div>
    </div>
  );
}

/**
 * Every subgroup where an enabled test fails on the current (revised) charts.
 * Reviewing one records its assignable cause and removes it from the limits.
 */
export function OutOfControlPoints({
  items,
  onReview,
  onReviewAll,
}: {
  items: ReviewItem[];
  onReview: (item: ReviewItem) => void;
  onReviewAll: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Out-of-control points</h3>
          <p className="text-xs text-muted">
            Investigate each signal. Where a specific assignable cause is found, exclude the
            subgroup to recalculate the revised charts.
          </p>
        </div>
        {items.length > 1 && (
          <button
            type="button"
            onClick={onReviewAll}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Review all {items.length} points
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-primary-soft bg-primary-soft px-3 py-2 text-sm text-primary-hover">
          No out-of-control points on the current charts.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.subgroup.id}
              className="rounded-lg border border-border bg-background/60 px-4 py-3"
            >
              <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <Fact
                  label={`Production date · Subgroup ${item.number}`}
                  value={formatBatchDate(item.subgroup.productionDate)}
                />
                <Fact label="Mean" value={`${item.subgroup.mean.toFixed(2)} g`} />
                <Fact label="Range" value={`${item.subgroup.range.toFixed(2)} g`} />
                <button
                  type="button"
                  onClick={() => onReview(item)}
                  className="rounded-md border border-border bg-surface px-5 py-2 text-sm font-medium text-foreground hover:bg-primary-soft"
                >
                  Review signal
                </button>
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
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
