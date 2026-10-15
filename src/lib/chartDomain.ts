/**
 * Y-axis range that fits the plotted data instead of always starting at 0.
 * Pass every plotted series (points and limit lines) so nothing is clipped.
 * The range is padded by 8% of the data span and rounded outwards to a tidy
 * step; `floor`/`ceiling` clamp it to values that are impossible to go past
 * (e.g. 0 for a range or a percentage).
 */
export function fitDomain(
  values: number[],
  { floor, ceiling }: { floor?: number; ceiling?: number } = {},
): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [floor ?? 0, ceiling ?? 1];

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  // A flat series still needs some height around it.
  const span = max - min || Math.abs(max) * 0.1 || 1;
  const pad = span * 0.08;

  const step = 10 ** Math.floor(Math.log10(span / 5));
  let lo = Math.floor((min - pad) / step) * step;
  let hi = Math.ceil((max + pad) / step) * step;
  if (floor !== undefined) lo = Math.max(floor, lo);
  if (ceiling !== undefined) hi = Math.min(ceiling, hi);
  return [lo, hi];
}

/**
 * Indices of at most `max` evenly spaced X-axis ticks for `count` points,
 * always including the first and last point. Every other point is still
 * identified by its tooltip.
 */
export function evenTicks(count: number, max = 5): number[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => Math.round(i * step));
}
