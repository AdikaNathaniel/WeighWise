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
import { evenTicks, fitDomain } from '@/lib/chartDomain';
import { formatBatchDate } from '@/lib/pChartFormat';
import { isInvestigated, rulesLabel } from '@/lib/nelsonRules';
import { StagePoint } from '@/lib/reviewWorkflow';

// Zone boundaries (±1σ, ±2σ) are derived from the 3σ limits: σ = (UCL − CL) / 3.
interface ChartRow extends StagePoint {
  /** Position in the series — the X key. */
  idx: number;
  plus1: number;
  plus2: number;
  minus1: number;
  minus2: number;
}

function ValueDot(props: { cx?: number; cy?: number; payload?: ChartRow }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload || payload.value === null) return null;
  // Red: beyond the limits — investigate. Amber: pattern warning only — watch.
  if (payload.rules.some(isInvestigated)) return <circle cx={cx} cy={cy} r={6} fill="#dc2626" stroke="#fff" strokeWidth={2} />;
  return payload.rules.length > 0 ? (
    <circle cx={cx} cy={cy} r={5} fill="#d97706" stroke="#fff" strokeWidth={2} />
  ) : (
    <circle cx={cx} cy={cy} r={4} fill="#15803d" stroke="none" />
  );
}

/** Excluded subgroups: a grey X at their original position, off the retained line. */
function ExcludedMark(props: { cx?: number; cy?: number; payload?: ChartRow }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || payload?.excludedValue == null) return null;
  const d = 5;
  return (
    <path
      d={`M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}`}
      stroke="#6b7280"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
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
  const excluded = row.value === null;
  const value = row.value ?? row.excludedValue ?? 0;
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md space-y-0.5">
      <div className="font-semibold text-foreground">
        Subgroup {row.number} · {formatBatchDate(row.date)}
      </div>
      <div>
        Value: {value.toFixed(2)}
        {unit}
      </div>
      <div>UCL: {row.ucl.toFixed(2)}</div>
      <div>CL: {row.cl.toFixed(2)}</div>
      <div>LCL: {row.lcl.toFixed(2)}</div>
      {excluded && (
        <div className="font-semibold text-muted">
          Excluded — confirmed assignable cause; not used for these limits
        </div>
      )}
      <SignalNote rules={row.rules} />
    </div>
  );
}

function SignalNote({ rules }: { rules: StagePoint['rules'] }) {
  const warnings = rules.filter((r) => !isInvestigated(r));
  return (
    <>
      {rules.some(isInvestigated) && (
        <div className="font-semibold text-red-600">
          Nelson rule 1: outside the control limits — investigate
        </div>
      )}
      {warnings.length > 0 && (
        <div className="font-semibold text-amber-700">
          Pattern warning ({rulesLabel(warnings)}) — watch
        </div>
      )}
    </>
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
  data: StagePoint[];
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

  // Fit the axis to every point (excluded ones too) and the limit lines.
  const domain = fitDomain(
    rows.flatMap((r) => [r.value ?? r.excludedValue ?? r.cl, r.ucl, r.lcl]),
    { floor: 0 },
  );
  const hasExcluded = rows.some((r) => r.excludedValue !== null);

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hasExcluded && (
          <span className="text-xs text-muted">✕ excluded subgroup (not used for the limits)</span>
        )}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            {/* Subgroup numbers, as in the study; hover a point for its production date. */}
            <XAxis
              dataKey="idx"
              fontSize={12}
              ticks={evenTicks(rows.length)}
              interval={0}
              // Room for the first/last labels, which are centred on the end points.
              padding={{ left: 16, right: 16 }}
              tickFormatter={(i: number) => String(rows[i]?.number ?? '')}
            />
            <YAxis fontSize={12} unit={unit} width={64} domain={domain} allowDataOverflow />
            <Tooltip content={<ChartTooltip unit={unit} />} />
            <ZoneLine dataKey="plus2" />
            <ZoneLine dataKey="plus1" />
            <ZoneLine dataKey="minus1" />
            <ZoneLine dataKey="minus2" />
            <Line type="monotone" dataKey="ucl" stroke="#dc2626" strokeDasharray="4 4" dot={false} name="UCL" />
            <Line type="monotone" dataKey="cl" stroke="#7fb894" strokeDasharray="4 4" dot={false} name="CL" />
            <Line type="monotone" dataKey="lcl" stroke="#dc2626" strokeDasharray="4 4" dot={false} name="LCL" />
            {/* Retained subgroups; the line breaks where a subgroup was excluded. */}
            <Line
              type="linear"
              dataKey="value"
              stroke="#15803d"
              strokeWidth={2}
              dot={<ValueDot />}
              name={title}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="excludedValue"
              stroke="none"
              dot={<ExcludedMark />}
              activeDot={false}
              legendType="none"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
