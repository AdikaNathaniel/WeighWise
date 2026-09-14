'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchDashboard } from '@/lib/api';
import { DashboardData } from '@/types/spc';
import { Header } from './Header';
import { StatusBadge } from './StatusBadge';
import { SubgroupForm } from './SubgroupForm';
import { SummaryPanel } from './SummaryPanel';
import { ControlChart, ControlChartPoint } from './ControlChart';
import { OutOfControlList } from './OutOfControlList';

type Tab = 'home' | 'trends';

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    load();
  }, [load]);

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
          </div>
          {data && <StatusBadge isStable={data.status.isStable} />}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {error}
            <button onClick={load} className="ml-3 font-medium underline">
              Retry
            </button>
          </div>
        )}

        {loading && !data && <p className="text-sm text-muted">Loading…</p>}

        {tab === 'home' && (
          <SubgroupForm
            onCreated={() => {
              load();
              setTab('trends');
            }}
          />
        )}

        {tab === 'trends' && data && data.subgroups.length === 0 && !error && (
          <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
            No production data yet — record the first subgroup on the Home tab.
          </div>
        )}

        {tab === 'trends' && data && data.subgroups.length > 0 && (
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
      </main>
    </div>
  );
}
