import { OutOfControlPoint } from '@/types/spc';

export function OutOfControlList({ points }: { points: OutOfControlPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="rounded-md border border-primary-soft bg-primary-soft px-3 py-2 text-sm text-primary-hover">
        No subgroups fall outside the control limits.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5 text-sm">
      {points.map((p, i) => (
        <li
          key={`${p.subgroupId}-${p.chart}-${i}`}
          className="rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-1.5"
        >
          <span className="font-medium">{p.productionDate}</span> — {p.chart === 'x-bar' ? 'X-bar' : 'R'}{' '}
          chart: value {p.value.toFixed(2)} breaches {p.violatedLimit.toUpperCase()} (
          {p.limit.toFixed(2)})
        </li>
      ))}
    </ul>
  );
}
