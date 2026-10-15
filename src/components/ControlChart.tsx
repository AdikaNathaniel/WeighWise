'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RuleId } from '@/lib/nelsonRules';
import { evenTicks, fitDomain } from '@/lib/chartDomain';

export interface ControlChartPoint {
  label: string;
  value: number;
  ucl: number;
  cl: number;
  lcl: number;
  /** Nelson rules whose signals include this point (empty = no signal). */
  rules: RuleId[];
}

// Zone boundaries (±1σ, ±2σ) are derived from the 3σ limits: σ = (UCL − CL) / 3.
interface ChartRow extends ControlChartPoint {
  /** Position in the series — the X key, so repeated date labels stay distinct. */
  idx: number;
  plus1: number;
  plus2: number;
  minus1: number;
  minus2: number;
}

function ValueDot(props: { cx?: number; cy?: number; payload?: ChartRow }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  return payload.rules.length > 0 ? (
    <circle cx={cx} cy={cy} r={6} fill="#dc2626" stroke="#fff" strokeWidth={2} />
  ) : (
    <circle cx={cx} cy={cy} r={4} fill="#15803d" stroke="none" />
  );
}

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md space-y-0.5">
      <div className="font-semibold text-foreground">{row.label}</div>
      <div>
        Value: {row.value.toFixed(2)}
        {unit}
      </div>
      <div>UCL: {row.ucl.toFixed(2)}</div>
      <div>CL: {row.cl.toFixed(2)}</div>
      <div>LCL: {row.lcl.toFixed(2)}</div>
      {row.rules.length > 0 && (
        <div className="font-semibold text-red-600">
          Signal: rule{row.rules.length > 1 ? 's' : ''} {row.rules.join(', ')}
        </div>
      )}
    </div>
  );
}

function ZoneLine({ dataKey }: { dataKey: keyof ChartRow }) {
  return (
    <Line
      type="monotone"
      dataKey={dataKey}
      stroke="#9ca3af"
      strokeOpacity={0.5}
      strokeDasharray="2 4"
      dot={false}
      activeDot={false}
      isAnimationActive={false}
      legendType="none"
    />
  );
}

export function ControlChart({
  title,
  unit,
  data,
}: {
  title: string;
  unit: string;
  data: ControlChartPoint[];
}) {
  // Lower zones are clamped to the LCL so the R chart (LCL = 0) never plots below zero.
  const rows: ChartRow[] = data.map((p, idx) => {
    const sigma = (p.ucl - p.cl) / 3;
    return {
      ...p,
      idx,
      plus1: p.cl + sigma,
      plus2: p.cl + 2 * sigma,
      minus1: Math.max(p.lcl, p.cl - sigma),
      minus2: Math.max(p.lcl, p.cl - 2 * sigma),
    };
  });

  // Fit the axis to the points and limit lines; weights and ranges are never negative.
  const domain = fitDomain(rows.flatMap((r) => [r.value, r.ucl, r.lcl]), { floor: 0 });

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            {/* Only 5 dates are labelled to avoid crowding; hover a point for its date. */}
            <XAxis
              dataKey="idx"
              fontSize={12}
              ticks={evenTicks(rows.length)}
              interval={0}
              // Room for the first/last labels, which are centred on the end points.
              padding={{ left: 16, right: 16 }}
              tickFormatter={(i: number) => rows[i]?.label ?? ''}
            />
            <YAxis fontSize={12} unit={unit} width={64} domain={domain} allowDataOverflow />
            <Tooltip content={<ChartTooltip unit={unit} />} />
            <ZoneLine dataKey="plus2" />
            <ZoneLine dataKey="plus1" />
            <ZoneLine dataKey="minus1" />
            <ZoneLine dataKey="minus2" />
            <Line
              type="monotone"
              dataKey="ucl"
              stroke="#dc2626"
              strokeDasharray="4 4"
              dot={false}
              name="UCL"
            />
            <Line
              type="monotone"
              dataKey="cl"
              stroke="#7fb894"
              strokeDasharray="4 4"
              dot={false}
              name="CL"
            />
            <Line
              type="monotone"
              dataKey="lcl"
              stroke="#dc2626"
              strokeDasharray="4 4"
              dot={false}
              name="LCL"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#15803d"
              strokeWidth={2}
              dot={<ValueDot />}
              name={title}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
