/** "Nice" tick values covering [min, max] with roughly `count` steps. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max)) return [];
  if (min === max) return [min];
  const span = max - min;
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.ceil(min / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

/** Expand [min, max] outward to nice round bounds. */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    return [min - pad, max + pad];
  }
  const ticks = niceTicks(min, max, count);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : (max - min);
  return [Math.floor(min / step + 1e-9) * step, Math.ceil(max / step - 1e-9) * step];
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

export function formatNumber(v: number): string {
  if (!isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 10000) return compact.format(v);
  if (a > 0 && a < 0.01) return v.toExponential(1);
  return plain.format(v);
}

const dateFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });

export function formatTime(ms: number, spanMs: number): string {
  const d = new Date(ms);
  if (spanMs < 2 * 86400000) return timeFmt.format(d);
  return spanMs > 120 * 86400000 ? monthFmt.format(d) : dateFmt.format(d);
}

/** Min/max of a numeric array, skipping NaN. */
export function extent(a: ArrayLike<number>): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

/** Index of the element in sorted `a` closest to `v`. */
export function nearestIndex(a: ArrayLike<number>, v: number): number {
  let lo = 0;
  let hi = a.length - 1;
  if (hi < 0) return -1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < v) lo = mid;
    else hi = mid;
  }
  return Math.abs(a[lo] - v) <= Math.abs(a[hi] - v) ? lo : hi;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
