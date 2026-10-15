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
import { DashboardData, PaginatedSubgroups } from '@/types/spc';
import { Header } from './Header';
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
import { ColourPChartModule } from './pchart/ColourPChartModule';

type Tab = 'home' | 'trends' | 'records' | 'colour';

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

type ChartKind = 'x-bar' | 'r';

interface ChartAnalysis {
  chartData: ControlChartPoint[];
  signals: RuleSignal[];
}

function analyseChart(data: DashboardData, chart: ChartKind, enabled: RuleId[]): ChartAnalysis {
  const points = data.subgroups.map((s) => {
    const limits = data.summary.limitsBySubgroup.find((l) => l.subgroupId === s.id);
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
    chartData: points.map(({ label, value, ucl, cl, lcl }, i) => ({
      label,
      value,
      ucl,
      cl,
      lcl,
      rules: rules[i],
    })),
    signals,
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
          : 'Could not reach the WeighWise backend.',
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
    const xBar = analyseChart(data, 'x-bar', enabledRules);
    const r = analyseChart(
      data,
      'r',
      enabledRules.filter((rule) => RANGE_CHART_RULES.includes(rule)),
    );
    const points: SignalPointInfo[] = data.subgroups.map((s, i) => ({
      batch: `#${i + 1}`,
      date: formatBatchDate(s.productionDate),
    }));
    return {
      xBar,
      r,
      points,
      isStable: xBar.signals.length === 0 && r.signals.length === 0,
    };
  }, [data, enabledRules]);

  function handleRecordsMutated() {
    load();
    loadRecords(recordsPage);
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            <TabButton active={tab === 'home'} onClick={() => setTab('home')}>
              Home
            </TabButton>
            <TabButton active={tab === 'trends'} onClick={() => setTab('trends')}>
              Trends &amp; Charts
            </TabButton>
            <TabButton active={tab === 'records'} onClick={() => setTab('records')}>
              Records
            </TabButton>
            <TabButton active={tab === 'colour'} onClick={() => setTab('colour')}>
              Tom Brown p-Chart
            </TabButton>
          </div>
          {analysis && tab !== 'colour' && <StatusBadge isStable={analysis.isStable} />}
        </div>

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
            <div className="flex gap-2">
              <TabButton active={entryMode === 'manual'} onClick={() => setEntryMode('manual')}>
                Manual entry
              </TabButton>
              <TabButton active={entryMode === 'upload'} onClick={() => setEntryMode('upload')}>
                Upload spreadsheet
              </TabButton>
            </div>

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
            <SummaryPanel summary={data.summary} />

            <RuleToggles
              enabled={enabledRules}
              onChange={setRule}
              note="As in Minitab, the R chart is checked with rules 1–4 only; rules 5–8 apply to the X-bar chart."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ControlChart
                title="X-bar chart — subgroup mean"
                unit="g"
                data={analysis.xBar.chartData}
              />
              <ControlChart
                title="R chart — subgroup range"
                unit="g"
                data={analysis.r.chartData}
              />
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold mb-3">Rule signals</h3>
              <RuleSignalList
                groups={[
                  { chart: 'X-bar', signals: analysis.xBar.signals, points: analysis.points },
                  { chart: 'R', signals: analysis.r.signals, points: analysis.points },
                ]}
              />
            </div>
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
  );
}
