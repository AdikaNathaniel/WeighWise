'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDashboard, fetchSubgroupsPage } from '@/lib/api';
import { useEnabledRules } from '@/lib/useEnabledRules';
import { buildWorkflow, StageAction } from '@/lib/reviewWorkflow';
import { ChartKind, ReviewItem } from '@/lib/signalReview';
import { DashboardData, PaginatedSubgroups, Subgroup } from '@/types/spc';
import { Header } from './Header';
import { NAV_ITEMS, SideNav, Tab } from './SideNav';
import { StatusBadge } from './StatusBadge';
import { SubgroupForm } from './SubgroupForm';
import { ExcelUploadForm } from './ExcelUploadForm';
import { SubgroupCalculationCard } from './SubgroupCalculationCard';
import { RuleToggles } from './RuleToggles';
import { SubgroupList } from './SubgroupList';
import { SubgroupEditor } from './SubgroupEditor';
import { Pagination } from './Pagination';
import { PreviousUploads } from './PreviousUploads';
import { OutOfControlPoints } from './OutOfControlPoints';
import { AssignableCauseDialog } from './AssignableCauseDialog';
import { InvestigationHistory } from './InvestigationHistory';
import { ChartStages } from './ChartStages';
import { ColourPChartModule } from './pchart/ColourPChartModule';


// SPC control limits are only statistically meaningful once a baseline of
// subgroups has been collected — charts stay hidden until then.
const MIN_SUBGROUPS_FOR_CHARTS = 25;

// The records list is fetched in pages instead of relying on the
// (unbounded) dashboard subgroup list, which keeps the Records tab fast
// as production history grows.
const RECORDS_PAGE_SIZE = 20;

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-primary text-white'
          : 'bg-surface text-muted border border-border hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

export function Dashboard() {
  const [tab, setTab] = useState<Tab>('home');
  const [entryMode, setEntryMode] = useState<'manual' | 'upload'>('manual');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [enabledRules, setRule] = useEnabledRules();

  // The chart stage on screen; null follows the current (latest) stage.
  const [stageIndex, setStageIndex] = useState<number | null>(null);
  // The signal under review: one subgroup, or (subgroupId null) a queue
  // through every unreviewed signal on one chart, minus those skipped.
  const [review, setReview] = useState<{ chart: ChartKind; subgroupId: string | null } | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [reopening, setReopening] = useState<Subgroup | null>(null);

  const [recordsPage, setRecordsPage] = useState(1);
  const [records, setRecords] = useState<PaginatedSubgroups | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboard();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reach the ProcessWise backend.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecords = useCallback(async (page: number) => {
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const result = await fetchSubgroupsPage(page, RECORDS_PAGE_SIZE);
      setRecords(result);
    } catch (err) {
      setRecordsError(err instanceof Error ? err.message : 'Could not load subgroups.');
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'records') {
      loadRecords(recordsPage);
    }
  }, [tab, recordsPage, loadRecords]);

  // A delete can empty out the last page — step back so the view isn't stuck empty.
  useEffect(() => {
    if (records && records.subgroups.length === 0 && records.page > 1) {
      setRecordsPage(records.page - 1);
    }
  }, [records]);

  const workflow = useMemo(
    () =>
      data && data.subgroups.length >= MIN_SUBGROUPS_FOR_CHARTS
        ? buildWorkflow(data, enabledRules)
        : null,
    [data, enabledRules],
  );

  const itemsFor = (chart: ChartKind) =>
    (chart === 'r' ? workflow?.rItems : workflow?.xBarItems) ?? [];
  // In a queue, the signal under review is the first unreviewed one not skipped.
  // It is held back while the charts reload, so a just-saved point is not
  // reopened; signals revealed by the recalculated limits join the queue.
  const queue =
    review && review.subgroupId === null
      ? itemsFor(review.chart).filter((i) => !i.subgroup.review && !skipped.has(i.subgroup.id))
      : [];
  const reviewItem: ReviewItem | null = !review
    ? null
    : review.subgroupId === null
      ? loading
        ? null
        : (queue[0] ?? null)
      : (itemsFor(review.chart).find((i) => i.subgroup.id === review.subgroupId) ?? null);
  const queueRemaining = Math.max(0, queue.length - 1);
  // A finished queue ends here, so signals that appear later never reopen it.
  if (review?.subgroupId === null && workflow && !loading && queue.length === 0) {
    setReview(null);
    setSkipped(new Set());
  }

  function startReviewAll(chart: ChartKind) {
    setSkipped(new Set());
    setStageIndex(null);
    setReview({ chart, subgroupId: null });
  }

  function openReview(item: ReviewItem, chart: ChartKind) {
    setReview({ chart, subgroupId: item.subgroup.id });
  }

  function closeReview() {
    setReview(null);
    setSkipped(new Set());
  }

  function skipReview() {
    if (!reviewItem) return;
    if (queueRemaining === 0) closeReview();
    else setSkipped((prev) => new Set(prev).add(reviewItem.subgroup.id));
  }

  function handleReviewSaved() {
    // A single review closes; a queue moves on to the next signal once reloaded.
    if (review?.subgroupId !== null) setReview(null);
    load();
  }

  function handleStageAction(action: StageAction) {
    if (!workflow) return;
    if (action === 'monitor') {
      setTab('home');
      return;
    }
    const chart: ChartKind = action === 'review-r' ? 'r' : 'x-bar';
    const pending = chart === 'r' ? workflow.pendingR : workflow.pendingXBar;
    if (pending.length === 1) openReview(pending[0], chart);
    else startReviewAll(chart);
  }

  function handleReopened() {
    setReopening(null);
    load();
  }

  function handleRecordsMutated() {
    load();
    loadRecords(recordsPage);
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-6 flex flex-col gap-6 md:flex-row">
        <SideNav tab={tab} onSelect={setTab} />

        <main className="min-w-0 flex-1 space-y-6">
          {/* Page header row: the tab's own controls (or title) on the left, process status on the right. */}
          {tab !== 'colour' && (
            <div className="flex items-center justify-between flex-wrap gap-3">
              {tab === 'home' ? (
                <div className="flex gap-2">
                  <TabButton active={entryMode === 'manual'} onClick={() => setEntryMode('manual')}>
                    Manual entry
                  </TabButton>
                  <TabButton active={entryMode === 'upload'} onClick={() => setEntryMode('upload')}>
                    Upload spreadsheet
                  </TabButton>
                </div>
              ) : (
                <h2 className="text-base font-semibold text-foreground">
                  {NAV_ITEMS.find((item) => item.tab === tab)?.label}
                </h2>
              )}
              {workflow && (
                <div className="flex items-center gap-3">
                  <span className="hidden max-w-xs text-right text-xs text-muted sm:block">
                    {workflow.status.reason}
                  </span>
                  <StatusBadge
                    inControl={workflow.status.inControl}
                    label={workflow.status.label}
                    reason={workflow.status.reason}
                  />
                </div>
              )}
            </div>
          )}

          {error && tab !== 'colour' && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error}
              <button onClick={load} className="ml-3 font-medium underline">
                Retry
              </button>
            </div>
          )}

          {loading && !data && tab !== 'colour' && <p className="text-sm text-muted">Loading…</p>}

          {tab === 'home' && (
            <>
              {entryMode === 'manual' ? (
                <SubgroupForm
                  requiredSize={data?.subgroups[0]?.sampleSize}
                  existingDates={data?.subgroups.map((sg) => sg.productionDate.slice(0, 10)) ?? []}
                  onCreated={() => {
                    load();
                    setTab('trends');
                  }}
                />
              ) : (
                <ExcelUploadForm
                  activeCount={data?.subgroups.length ?? 0}
                  onImported={() => {
                    load();
                    setTab('trends');
                  }}
                />
              )}

              {data && <SubgroupCalculationCard data={data} />}
            </>
          )}

          {tab === 'trends' && data && data.subgroups.length === 0 && !error && (
            <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
              No production data yet — record the first subgroup on the Home tab.
            </div>
          )}

          {tab === 'trends' &&
            data &&
            data.subgroups.length > 0 &&
            data.subgroups.length < MIN_SUBGROUPS_FOR_CHARTS && (
              <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted space-y-3">
                <p>
                  Charts unlock once a baseline of {MIN_SUBGROUPS_FOR_CHARTS} subgroups is
                  collected — control limits calculated from fewer subgroups aren&apos;t
                  statistically reliable.
                </p>
                <p className="font-medium text-foreground">
                  {data.subgroups.length} of {MIN_SUBGROUPS_FOR_CHARTS} subgroups recorded
                  ({MIN_SUBGROUPS_FOR_CHARTS - data.subgroups.length} to go)
                </p>
                <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (data.subgroups.length / MIN_SUBGROUPS_FOR_CHARTS) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

          {tab === 'trends' && workflow && data && (
            <>
              <RuleToggles
                enabled={enabledRules}
                onChange={setRule}
                note="As in Minitab, the R chart is checked with Nelson rules 1–4 only; Nelson rules 5–8 apply to the X-bar chart."
              />

              <ChartStages
                workflow={workflow}
                selected={stageIndex ?? workflow.stages.length - 1}
                onSelect={(i) => setStageIndex(i === workflow.stages.length - 1 ? null : i)}
                onAction={handleStageAction}
              />

              <OutOfControlPoints
                workflow={workflow}
                onReview={openReview}
                onReviewAll={startReviewAll}
                onReopen={setReopening}
              />

              <InvestigationHistory
                subgroups={data.subgroups}
                reopening={reopening}
                onReopenRequest={setReopening}
                onReopenCancel={() => setReopening(null)}
                onReopened={handleReopened}
              />

              <AssignableCauseDialog
                item={reviewItem}
                queueRemaining={review?.subgroupId === null ? queueRemaining : 0}
                onSaved={handleReviewSaved}
                onSkip={skipReview}
                onClose={closeReview}
              />
            </>
          )}

          {tab === 'colour' && <ColourPChartModule />}

          {tab === 'records' && (
            <>
              {recordsError && (
                <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                  {recordsError}
                  <button
                    onClick={() => loadRecords(recordsPage)}
                    className="ml-3 font-medium underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {recordsLoading && !records && <p className="text-sm text-muted">Loading…</p>}

              {records && (
                <>
                  <SubgroupEditor subgroups={records.subgroups} onUpdated={handleRecordsMutated} />
                  <SubgroupList subgroups={records.subgroups} onDeleted={handleRecordsMutated} />
                  <Pagination
                    page={records.page}
                    pageSize={records.pageSize}
                    total={records.total}
                    onPageChange={setRecordsPage}
                    disabled={recordsLoading}
                  />
                </>
              )}

              <PreviousUploads
                activeCount={data?.subgroups.length ?? 0}
                refreshKey={data}
                onRestored={handleRecordsMutated}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
