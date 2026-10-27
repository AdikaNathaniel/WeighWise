'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDashboard, fetchSubgroupsPage } from '@/lib/api';
import {
  detectSignals,
  RANGE_CHART_RULES,
  RuleId,
  RulePoint,
  RuleSignal,
  rulesByPoint,
} from '@/lib/nelsonRules';
import { useEnabledRules } from '@/lib/useEnabledRules';
import { formatBatchDate } from '@/lib/pChartFormat';
import { buildReviewItems, ChartKind } from '@/lib/signalReview';
import { DashboardData, PaginatedSubgroups, SpcSummary, Subgroup } from '@/types/spc';
import { Header } from './Header';
import { NAV_ITEMS, SideNav, Tab } from './SideNav';
import { StatusBadge } from './StatusBadge';
import { SubgroupForm } from './SubgroupForm';
import { ExcelUploadForm } from './ExcelUploadForm';
import { SubgroupCalculationCard } from './SubgroupCalculationCard';
import { SummaryPanel } from './SummaryPanel';
import { ControlChart, ControlChartPoint } from './ControlChart';
import { RuleSignalList, SignalPointInfo } from './RuleSignalList';
import { RuleToggles } from './RuleToggles';
import { SubgroupList } from './SubgroupList';
import { SubgroupEditor } from './SubgroupEditor';
import { Pagination } from './Pagination';
import { PreviousUploads } from './PreviousUploads';
import { OutOfControlPoints } from './OutOfControlPoints';
import { AssignableCauseDialog } from './AssignableCauseDialog';
import { ExcludedSubgroups } from './ExcludedSubgroups';
import { ColourPChartModule } from './pchart/ColourPChartModule';


// SPC control limits are only statistically meaningful once a baseline of
// subgroups has been collected — charts stay hidden until then.
const MIN_SUBGROUPS_FOR_CHARTS = 25;

// The records list is fetched in pages instead of relying on the
// (unbounded) dashboard subgroup list, which keeps the Records tab fast
// as production history grows.
const RECORDS_PAGE_SIZE = 20;

function formatLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

interface ChartAnalysis {
  subgroups: Subgroup[];
  chartData: ControlChartPoint[];
  points: RulePoint[];
  signals: RuleSignal[];
}

/** Plots `subgroups` against `summary`'s limits; excluded subgroups are marked as such. */
function analyseChart(
  subgroups: Subgroup[],
  summary: SpcSummary,
  chart: ChartKind,
  enabled: RuleId[],
): ChartAnalysis {
  const points = subgroups.map((s) => {
    const limits = summary.limitsBySubgroup.find((l) => l.subgroupId === s.id);
    const band = chart === 'x-bar' ? limits?.xBar : limits?.r;
    const ucl = band?.ucl ?? 0;
    const cl = band?.cl ?? 0;
    return {
      label: formatLabel(s.productionDate),
      value: chart === 'x-bar' ? s.mean : s.range,
      ucl,
      cl,
      lcl: band?.lcl ?? 0,
      // Limits are 3σ from the centre line, so σ is a third of that distance.
      sigma: (ucl - cl) / 3,
    } satisfies RulePoint & { label: string };
  });

  const signals = detectSignals(points, enabled);
  const rules = rulesByPoint(signals, points.length);
  return {
    subgroups,
    chartData: points.map(({ label, value, ucl, cl, lcl }, i) => ({
      label,
      value,
      ucl,
      cl,
      lcl,
      rules: rules[i],
      excluded: Boolean(subgroups[i].exclusion),
    })),
    points,
    signals,
  };
}

function analyseCharts(subgroups: Subgroup[], summary: SpcSummary, enabled: RuleId[]) {
  return {
    xBar: analyseChart(subgroups, summary, 'x-bar', enabled),
    r: analyseChart(
      subgroups,
      summary,
      'r',
      enabled.filter((rule) => RANGE_CHART_RULES.includes(rule)),
    ),
  };
}

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

  // The revised chart leaves out excluded subgroups; the trial chart shows every subgroup.
  const [chartView, setChartView] = useState<'revised' | 'trial'>('revised');
  const [reviewId, setReviewId] = useState<string | null>(null);
  // "Review all" walks through every out-of-control point, minus those the user skips.
  const [reviewQueue, setReviewQueue] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

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

  const analysis = useMemo(() => {
    if (!data) return null;
    const included = data.subgroups.filter((s) => !s.exclusion);
    const revised = analyseCharts(included, data.summary, enabledRules);
    const trial = analyseCharts(data.subgroups, data.trialSummary, enabledRules);
    const reviewItems = buildReviewItems(data.subgroups, [
      { chart: 'x-bar', ...revised.xBar },
      { chart: 'r', ...revised.r },
    ]);
    return {
      revised,
      trial,
      reviewItems,
      excludedCount: data.subgroups.length - included.length,
      isStable: revised.xBar.signals.length === 0 && revised.r.signals.length === 0,
    };
  }, [data, enabledRules]);

  const shownView = analysis && analysis.excludedCount > 0 ? chartView : 'revised';
  const shown = analysis?.[shownView];
  const signalPoints = (subgroups: Subgroup[]): SignalPointInfo[] =>
    subgroups.map((s) => ({ label: formatBatchDate(s.productionDate) }));

  // In the queue, the point under review is the first one not skipped; it is
  // held back while the charts reload so a just-saved point is not reopened.
  const queued = analysis?.reviewItems.filter((i) => !skipped.has(i.subgroup.id)) ?? [];
  const reviewItem = reviewQueue
    ? (loading ? null : (queued[0] ?? null))
    : (analysis?.reviewItems.find((i) => i.subgroup.id === reviewId) ?? null);
  const queueRemaining = Math.max(0, queued.length - 1);

  function startReviewAll() {
    setSkipped(new Set());
    setChartView('revised');
    setReviewQueue(true);
  }

  function closeReview() {
    setReviewId(null);
    setReviewQueue(false);
    setSkipped(new Set());
  }

  function skipReview() {
    if (!reviewItem) return;
    if (queueRemaining === 0) closeReview();
    else setSkipped((prev) => new Set(prev).add(reviewItem.subgroup.id));
  }

  function handleReviewSaved() {
    // The queue ends with its last point; new signals from the revised limits stay listed.
    if (reviewQueue && queueRemaining === 0) closeReview();
    setReviewId(null);
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
              {analysis && <StatusBadge isStable={analysis.isStable} />}
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

          {tab === 'trends' && analysis && data && data.subgroups.length >= MIN_SUBGROUPS_FOR_CHARTS && (
            <>
              <SummaryPanel summary={shownView === 'trial' ? data.trialSummary : data.summary} />

              <RuleToggles
                enabled={enabledRules}
                onChange={setRule}
                note="As in Minitab, the R chart is checked with rules 1–4 only; rules 5–8 apply to the X-bar chart."
              />

              {analysis.excludedCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                  <p className="text-sm text-muted">
                    {shownView === 'revised'
                      ? `Revised limits: ${analysis.excludedCount} subgroup${
                          analysis.excludedCount === 1 ? '' : 's'
                        } with an assignable cause removed, limits recalculated from the remaining ${
                          data.summary.subgroupCount
                        }.`
                      : 'Trial limits: every subgroup counts. Excluded subgroups are shown as hollow grey points.'}
                  </p>
                  <div className="flex gap-2">
                    <TabButton active={shownView === 'revised'} onClick={() => setChartView('revised')}>
                      Revised chart
                    </TabButton>
                    <TabButton active={shownView === 'trial'} onClick={() => setChartView('trial')}>
                      Trial chart
                    </TabButton>
                  </div>
                </div>
              )}

              {shown && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ControlChart
                      title={`X-bar chart — subgroup mean${analysis.excludedCount > 0 ? ` (${shownView})` : ''}`}
                      unit="g"
                      data={shown.xBar.chartData}
                    />
                    <ControlChart
                      title={`R chart — subgroup range${analysis.excludedCount > 0 ? ` (${shownView})` : ''}`}
                      unit="g"
                      data={shown.r.chartData}
                    />
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="text-sm font-semibold mb-3">Rule signals</h3>
                    <RuleSignalList
                      groups={[
                        {
                          chart: 'X-bar',
                          signals: shown.xBar.signals,
                          points: signalPoints(shown.xBar.subgroups),
                        },
                        {
                          chart: 'R',
                          signals: shown.r.signals,
                          points: signalPoints(shown.r.subgroups),
                        },
                      ]}
                    />
                  </div>
                </>
              )}

              <OutOfControlPoints
                items={analysis.reviewItems}
                onReview={(item) => {
                  setReviewQueue(false);
                  setReviewId(item.subgroup.id);
                }}
                onReviewAll={startReviewAll}
              />

              <ExcludedSubgroups subgroups={data.subgroups} onReinstated={load} />

              <AssignableCauseDialog
                item={reviewItem}
                queueRemaining={reviewQueue ? queueRemaining : 0}
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
