import type { Numbers } from './types';

/** Sorted Float64 copy, NaN removed. */
export function sorted(a: Numbers): Float64Array {
  const out = new Float64Array(a.length);
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === a[i]) out[n++] = a[i];
  return out.subarray(0, n).sort();
}

/** Linear-interpolated quantile of sorted data, q in [0,1]. */
export function quantile(s: ArrayLike<number>, q: number): number {
  if (!s.length) return NaN;
  const p = (s.length - 1) * q;
  const i = Math.floor(p);
  const f = p - i;
  return i + 1 < s.length ? s[i] * (1 - f) + s[i + 1] * f : s[i];
}

export interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  /** Tukey whiskers: furthest points within 1.5 IQR. */
  lo: number;
  hi: number;
  outliers: number[];
  mean: number;
  n: number;
}

export function boxStats(values: Numbers, maxOutliers = 2000): BoxStats {
  const s = sorted(values);
  const q1 = quantile(s, 0.25);
  const q3 = quantile(s, 0.75);
  const iqr = q3 - q1;
  const loF = q1 - 1.5 * iqr;
  const hiF = q3 + 1.5 * iqr;
  let lo = q1;
  let hi = q3;
  let sum = 0;
  const outliers: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const v = s[i];
    sum += v;
    if (v < loF || v > hiF) {
      if (outliers.length < maxOutliers) outliers.push(v);
    } else {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return { min: s[0], q1, median: quantile(s, 0.5), q3, max: s[s.length - 1], lo, hi, outliers, mean: sum / (s.length || 1), n: s.length };
}

export function meanStd(a: Numbers): [number, number] {
  let m = 0;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== a[i]) continue;
    n++;
    m += (a[i] - m) / n;
  }
  let v = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === a[i]) v += (a[i] - m) ** 2;
  return [m, Math.sqrt(v / Math.max(1, n - 1))];
}

/** Silverman's rule-of-thumb bandwidth. */
export function bandwidth(a: Numbers): number {
  const s = sorted(a);
  const [, sd] = meanStd(s);
  const iqr = quantile(s, 0.75) - quantile(s, 0.25);
  const k = Math.min(sd, iqr / 1.34) || sd || 1;
  return 0.9 * k * Math.pow(s.length || 1, -0.2);
}

/**
 * Gaussian KDE evaluated on `steps` points across [lo, hi].
 * Bins first, then convolves, so it's O(n + steps * kernel) even for 1M values.
 */
export function kde(values: Numbers, lo: number, hi: number, steps = 128, bw = bandwidth(values)): Float64Array {
  const bins = new Float64Array(steps);
  const w = (hi - lo) / (steps - 1 || 1);
  let n = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v !== v) continue;
    const b = Math.round((v - lo) / w);
    if (b >= 0 && b < steps) bins[b]++;
    n++;
  }
  const out = new Float64Array(steps);
  const r = Math.max(1, Math.ceil((bw * 4) / w));
  const kernel = new Float64Array(r * 2 + 1);
  for (let k = -r; k <= r; k++) kernel[k + r] = Math.exp(-0.5 * ((k * w) / bw) ** 2);
  const norm = 1 / ((n || 1) * bw * Math.sqrt(2 * Math.PI));
  for (let i = 0; i < steps; i++) {
    if (!bins[i]) continue;
    for (let k = -r; k <= r; k++) {
      const j = i + k;
      if (j >= 0 && j < steps) out[j] += bins[i] * kernel[k + r];
    }
  }
  for (let i = 0; i < steps; i++) out[i] *= norm;
  return out;
}

/** 2D Gaussian density on a grid (binned + separable blur). Returns row-major rows x cols. */
export function kde2d(x: Numbers, y: Numbers, x0: number, x1: number, y0: number, y1: number, cols: number, rows: number): Float32Array {
  const grid = new Float32Array(cols * rows);
  const sx = (cols - 1) / (x1 - x0 || 1);
  const sy = (rows - 1) / (y1 - y0 || 1);
  for (let i = 0; i < x.length; i++) {
    const c = Math.round((x[i] - x0) * sx);
    const r = Math.round((y[i] - y0) * sy);
    if (c >= 0 && c < cols && r >= 0 && r < rows) grid[r * cols + c]++;
  }
  const bx = bandwidth(x) * sx;
  const by = bandwidth(y) * sy;
  blur1d(grid, cols, rows, Math.max(0.8, bx), true);
  blur1d(grid, cols, rows, Math.max(0.8, by), false);
  return grid;
}

function blur1d(g: Float32Array, cols: number, rows: number, sigma: number, horizontal: boolean) {
  const r = Math.ceil(sigma * 3);
  const k = new Float32Array(r * 2 + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += k[i + r] = Math.exp(-0.5 * (i / sigma) ** 2);
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const n = horizontal ? cols : rows;
  const m = horizontal ? rows : cols;
  const line = new Float32Array(n);
  for (let a = 0; a < m; a++) {
    for (let i = 0; i < n; i++) line[i] = horizontal ? g[a * cols + i] : g[i * cols + a];
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = -r; j <= r; j++) {
        const t = i + j;
        if (t >= 0 && t < n) s += line[t] * k[j + r];
      }
      if (horizontal) g[a * cols + i] = s;
      else g[i * cols + a] = s;
    }
  }
}

/** Inverse standard normal CDF (Acklam's approximation, |error| < 1.2e-9). */
export function normInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson): smooth, never overshoots
 * the data, so a smoothed line can't invent peaks. Returns flat x,y pairs.
 */
export function monotoneCurve(xs: Numbers, ys: Numbers, perSegment = 8): number[] {
  const n = ys.length;
  if (n < 3) {
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(xs[i], ys[i]);
    return out;
  }
  const dx = new Float64Array(n - 1);
  const m = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    m[i] = (ys[i + 1] - ys[i]) / (dx[i] || 1);
  }
  const t = new Float64Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const s = 3 / Math.sqrt(h);
      t[i] = s * a * m[i];
      t[i + 1] = s * b * m[i];
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    for (let k = 0; k < perSegment; k++) {
      const s = k / perSegment;
      const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
      const h10 = s ** 3 - 2 * s ** 2 + s;
      const h01 = -2 * s ** 3 + 3 * s ** 2;
      const h11 = s ** 3 - s ** 2;
      out.push(xs[i] + s * h, h00 * ys[i] + h10 * h * t[i] + h01 * ys[i + 1] + h11 * h * t[i + 1]);
    }
  }
  out.push(xs[n - 1], ys[n - 1]);
  return out;
}

/** Cubic Bezier sampled to flat x,y pairs. */
export function bezier(x0: number, y0: number, c1x: number, c1y: number, c2x: number, c2y: number, x1: number, y1: number, steps = 24): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push(
      u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1,
      u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1,
    );
  }
  return out;
}

/** Small deterministic PRNG for layouts that need jitter (stable across re-renders). */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ---- Moving windows (technical indicators) ------------------------------------------

/** Simple moving average. The first `period - 1` values are NaN. */
export function sma(v: Numbers, period: number): Float64Array {
  const n = v.length;
  const out = new Float64Array(n).fill(NaN);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += v[i];
    if (i >= period) sum -= v[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average, seeded with the SMA of the first `period` values. */
export function ema(v: Numbers, period: number): Float64Array {
  const n = v.length;
  const out = new Float64Array(n).fill(NaN);
  if (n < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += v[i] / period;
  out[period - 1] = prev;
  for (let i = period; i < n; i++) out[i] = prev = v[i] * k + prev * (1 - k);
  return out;
}

/** Rolling population standard deviation over `period` values (NaN until full). */
export function rollingStd(v: Numbers, period: number): Float64Array {
  const n = v.length;
  const out = new Float64Array(n).fill(NaN);
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    s += v[i];
    s2 += v[i] * v[i];
    if (i >= period) {
      s -= v[i - period];
      s2 -= v[i - period] * v[i - period];
    }
    if (i >= period - 1) out[i] = Math.sqrt(Math.max(0, s2 / period - (s / period) ** 2));
  }
  return out;
}
