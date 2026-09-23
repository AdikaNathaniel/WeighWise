'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchDashboard, fetchSubgroupsPage } from '@/lib/api';
import { DashboardData, PaginatedSubgroups } from '@/types/spc';
import { Header } from './Header';
import { StatusBadge } from './StatusBadge';
import { SubgroupForm } from './SubgroupForm';
import { ExcelUploadForm } from './ExcelUploadForm';
import { SubgroupCalculationCard } from './SubgroupCalculationCard';
import { SummaryPanel } from './SummaryPanel';
import { ControlChart, ControlChartPoint } from './ControlChart';
import { OutOfControlList } from './OutOfControlList';
import { SubgroupList } from './SubgroupList';
import { SubgroupEditor } from './SubgroupEditor';
import { Pagination } from './Pagination';
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

function buildChartData(data: DashboardData, chart: 'x-bar' | 'r'): ControlChartPoint[] {
  return data.subgroups.map((s) => {
    const limits = data.summary.limitsBySubgroup.find((l) => l.subgroupId === s.id);
    const outOfControl = data.status.outOfControlPoints.some(
      (p) => p.subgroupId === s.id && p.chart === chart,
    );

    if (chart === 'x-bar') {
      return {
        label: formatLabel(s.productionDate),
        value: s.mean,
        ucl: limits?.xBar.ucl ?? 0,
        cl: limits?.xBar.cl ?? 0,
        lcl: limits?.xBar.lcl ?? 0,
        outOfControl,
      };
    }

    return {
      label: formatLabel(s.productionDate),
      value: s.range,
      ucl: limits?.r.ucl ?? 0,
      cl: limits?.r.cl ?? 0,
      lcl: limits?.r.lcl ?? 0,
      outOfControl,
    };
  });
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
          {data && tab !== 'colour' && <StatusBadge isStable={data.status.isStable} />}
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

        {tab === 'trends' && data && data.subgroups.length >= MIN_SUBGROUPS_FOR_CHARTS && (
          <>
            <SummaryPanel summary={data.summary} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ControlChart
                title="X-bar chart — subgroup mean"
                unit="g"
                data={buildChartData(data, 'x-bar')}
              />
              <ControlChart
                title="R chart — subgroup range"
                unit="g"
                data={buildChartData(data, 'r')}
              />
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold mb-3">Out-of-control points</h3>
              <OutOfControlList points={data.status.outOfControlPoints} />
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
          </>
        )}
      </main>
    </div>
  );
}
