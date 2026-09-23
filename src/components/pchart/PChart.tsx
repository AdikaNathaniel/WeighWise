'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PChartPoint } from '@/types/pChart';
import { formatBatchDate } from '@/lib/pChartFormat';

// Plotted values are percentages (0–100) so the axis and tooltip read as %.
interface ChartRow {
  label: string;
  date: string | null;
  p: number;
  ucl: number;
  cl: number;
  lcl: number;
  outOfControl: boolean;
}

function toPercent(fraction: number): number {
  return Math.round(fraction * 1_000_000) / 10_000;
}

function ProportionDot(props: { cx?: number; cy?: number; payload?: ChartRow }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  return payload.outOfControl ? (
    <circle cx={cx} cy={cy} r={6} fill="#dc2626" stroke="#fff" strokeWidth={2} />
  ) : (
    <circle cx={cx} cy={cy} r={4} fill="#92400e" stroke="none" />
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md space-y-0.5">
      <div className="font-semibold text-foreground">
        Batch {row.label}
        {row.date && <span className="font-normal text-muted"> · {formatBatchDate(row.date)}</span>}
      </div>
      <div>p: {row.p.toFixed(2)}%</div>
      <div>UCL: {row.ucl.toFixed(2)}%</div>
      <div>Centre line (p̄): {row.cl.toFixed(2)}%</div>
      <div>LCL: {row.lcl.toFixed(2)}%</div>
      {row.outOfControl && <div className="font-semibold text-red-600">Out of control</div>}
    </div>
  );
}

export function PChart({ points }: { points: PChartPoint[] }) {
  const data: ChartRow[] = points.map((p) => ({
    label: p.batchLabel,
    date: p.productionDate,
    p: toPercent(p.proportion),
    ucl: toPercent(p.ucl),
    cl: toPercent(p.cl),
    lcl: toPercent(p.lcl),
    outOfControl: p.status === 'out-of-control',
  }));

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">Tom Brown colour p-chart</h3>
      <p className="text-xs text-muted mb-3">
        Proportion of samples outside the light-brown range per batch. Limits step with each
        batch&apos;s sample size.
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis fontSize={12} unit="%" width={52} domain={[0, 'auto']} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="linear"
              dataKey="ucl"
              stroke="#dc2626"
              strokeDasharray="5 4"
              dot={false}
              name="UCL"
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="cl"
              stroke="#15803d"
              strokeDasharray="2 3"
              dot={false}
              name="Centre line (p̄)"
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="lcl"
              stroke="#2563eb"
              strokeDasharray="5 4"
              dot={false}
              name="LCL"
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="p"
              stroke="#92400e"
              strokeWidth={2}
              dot={<ProportionDot />}
              name="Proportion nonconforming (p)"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
