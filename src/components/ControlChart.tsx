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

export interface ControlChartPoint {
  label: string;
  value: number;
  ucl: number;
  cl: number;
  lcl: number;
  outOfControl: boolean;
}

function ValueDot(props: { cx?: number; cy?: number; payload?: ControlChartPoint }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={payload.outOfControl ? '#dc2626' : '#15803d'}
      stroke="none"
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
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis fontSize={12} unit={unit} width={56} />
            <Tooltip
              formatter={(value, name) => [
                typeof value === 'number' ? value.toFixed(2) : String(value),
                String(name),
              ]}
            />
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
