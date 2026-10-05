import type { Hit, LegendItem } from '../base';
import { MarkChart, type MarkBuilder } from '../markchart';
import { formatNumber, niceDomain } from '../scale';
import { bandwidth, boxStats, kde, normInv, quantile, rng, sorted, type BoxStats } from '../stats';
import type { BoxOptions, DensityOptions, EcdfOptions, QQOptions, RidgelineOptions, StripOptions, BeeswarmOptions, ViolinOptions, ValueGroup } from '../types2';

function statRows(s: BoxStats, fmt: (v: number) => string) {
  return [
    { label: 'n', value: formatNumber(s.n) },
    { label: 'Max (whisker)', value: fmt(s.hi) },
    { label: 'Q3', value: fmt(s.q3) },
    { label: 'Median', value: fmt(s.median) },
    { label: 'Q1', value: fmt(s.q1) },
    { label: 'Min (whisker)', value: fmt(s.lo) },
    { label: 'Mean', value: fmt(s.mean) },
    { label: 'Outliers', value: formatNumber(s.outliers.length) },
  ];
}

function globalExtent(groups: ValueGroup[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const g of groups) {
    for (let i = 0; i < g.values.length; i++) {
      const v = g.values[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return isFinite(lo) ? [lo, hi] : [0, 1];
}

/** Groups along a category axis, values along the other. Vertical by default. */
abstract class GroupChart<O extends BoxOptions | ViolinOptions | StripOptions | BeeswarmOptions> extends MarkChart<O> {
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected horizontalDefault = false;

  protected get horizontal(): boolean {
    return (this.opts as { horizontal?: boolean }).horizontal ?? this.horizontalDefault;
  }

  protected setDomain(lo: number, hi: number) {
    const names = this.opts.groups.map((g) => g.name);
    const n = names.length;
    if (this.horizontal) {
      this.yCategories = [...names].reverse();
      this.full = { x0: lo, x1: hi, y0: -0.5, y1: n - 0.5 };
    } else {
      this.xCategories = names;
      this.full = { x0: -0.5, x1: n - 0.5, y0: lo, y1: hi };
    }
  }

  protected cat(i: number) {
    return this.horizontal ? this.opts.groups.length - 1 - i : i;
  }

  protected P(c: number, v: number): [number, number] {
    return this.horizontal ? [v, c] : [c, v];
  }

  protected band(b: MarkBuilder, i: number, hit: Hit) {
    const c = this.cat(i);
    const f = this.full;
    if (this.horizontal) b.region({ k: 'rect', x0: f.x0, y0: c - 0.5, x1: f.x1, y1: c + 0.5, hit });
    else b.region({ k: 'rect', x0: c - 0.5, y0: f.y0, x1: c + 0.5, y1: f.y1, hit });
  }

  protected fmt = (v: number) => (this.horizontal ? this.formatX(v) : this.formatY(v));

  protected groupColor(g: ValueGroup) {
    return g.color ?? this.color(0);
  }

  /** Data units per CSS px along the category and value axes. */
  protected upp(): [number, number] {
    const [ux, uy] = this.unitsPerPx();
    return this.horizontal ? [uy, ux] : [ux, uy];
  }
}

// ---- Box plot ------------------------------------------------------------------------------

export class BoxChart extends GroupChart<BoxOptions> {
  readonly type = 'box' as const;
  private stats: BoxStats[] = [];

  protected computeDomain() {
    this.stats = this.opts.groups.map((g) => boxStats(g.values));
    const lo = Math.min(...this.stats.map((s) => (this.opts.outliers === false ? s.lo : s.min)));
    const hi = Math.max(...this.stats.map((s) => (this.opts.outliers === false ? s.hi : s.max)));
    const [a, b] = niceDomain(lo, hi);
    this.setDomain(a, b);
  }

  protected marks(b: MarkBuilder) {
    this.opts.groups.forEach((g, i) => {
      const s = this.stats[i];
      const c = this.cat(i);
      const color = this.groupColor(g);
      const w = 0.28;
      const L = (c1: number, v1: number, c2: number, v2: number, col: string, width: number) => {
        const [x0, y0] = this.P(c1, v1);
        const [x1, y1] = this.P(c2, v2);
        b.seg(x0, y0, x1, y1, col, width);
      };
      L(c, s.lo, c, s.q1, color, 1.5);
      L(c, s.q3, c, s.hi, color, 1.5);
      L(c - w * 0.5, s.lo, c + w * 0.5, s.lo, color, 1.5);
      L(c - w * 0.5, s.hi, c + w * 0.5, s.hi, color, 1.5);
      const [bx0, by0] = this.P(c - w, s.q1);
      const [bx1, by1] = this.P(c + w, s.q3);
      b.box(Math.min(bx0, bx1), Math.min(by0, by1), Math.max(bx0, bx1), Math.max(by0, by1), color, 0.28);
      b.line([bx0, by0, bx1, by0, bx1, by1, bx0, by1], color, 1.5, 1, true);
      L(c - w, s.median, c + w, s.median, color, 3);
      const [mx, my] = this.P(c, s.mean);
      b.point(mx, my, this.theme.surface, 7, 'diamond');
      if (this.opts.outliers !== false) {
        const r = rng(i + 1);
        for (const v of s.outliers) {
          const [ox, oy] = this.P(c + (r() - 0.5) * w * 0.6, v);
          b.point(ox, oy, color, 6, 'ring', 0.8);
        }
      }
      this.band(b, i, { series: g.name, index: i, title: g.name, values: { median: s.median, q1: s.q1, q3: s.q3 }, rows: statRows(s, this.fmt) });
    });
  }
}

// ---- Violin -------------------------------------------------------------------------------

export class ViolinChart extends GroupChart<ViolinOptions> {
  readonly type = 'violin' as const;
  private dens: Float64Array[] = [];
  private stats: BoxStats[] = [];
  private lo = 0;
  private hi = 1;

  protected computeDomain() {
    const groups = this.opts.groups;
    const [lo, hi] = globalExtent(groups);
    const pad = Math.max(...groups.map((g) => bandwidth(g.values))) * 2;
    this.lo = lo - pad;
    this.hi = hi + pad;
    this.dens = groups.map((g) => kde(g.values, this.lo, this.hi, 120));
    this.stats = groups.map((g) => boxStats(g.values));
    const [a, b] = niceDomain(this.lo, this.hi);
    this.setDomain(a, b);
  }

  protected marks(b: MarkBuilder) {
    const maxD = Math.max(...this.dens.map((d) => Math.max(...d)), 1e-12);
    const steps = 120;
    this.opts.groups.forEach((g, i) => {
      const d = this.dens[i];
      const c = this.cat(i);
      const color = this.groupColor(g);
      const right: number[] = [];
      const left: number[] = [];
      for (let k = 0; k < steps; k++) {
        const v = this.lo + ((this.hi - this.lo) * k) / (steps - 1);
        const w = (d[k] / maxD) * 0.42;
        right.push(...this.P(c + w, v));
        left.push(...this.P(c - w, v));
      }
      b.band(right, left, color, 0.35);
      const outline = [...right];
      for (let k = left.length - 2; k >= 0; k -= 2) outline.push(left[k], left[k + 1]);
      b.line(outline, color, 1.5, 1, true);
      const s = this.stats[i];
      const [x0, y0] = this.P(c - 0.035, s.q1);
      const [x1, y1] = this.P(c + 0.035, s.q3);
      b.box(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), this.theme.textPrimary, 0.85);
      const [mx, my] = this.P(c, s.median);
      b.point(mx, my, this.theme.surface, 6);
      this.band(b, i, { series: g.name, index: i, title: g.name, values: { median: s.median }, rows: statRows(s, this.fmt) });
    });
  }
}

// ---- Strip / jitter --------------------------------------------------------------------------

export class StripChart extends GroupChart<StripOptions> {
  readonly type = 'strip' as const;

  protected computeDomain() {
    const [lo, hi] = globalExtent(this.opts.groups);
    const [a, b] = niceDomain(lo, hi);
    this.setDomain(a, b);
  }

  protected marks(b: MarkBuilder) {
    const total = this.opts.groups.reduce((n, g) => n + g.values.length, 0);
    const size = this.opts.pointSize ?? (total > 20_000 ? 3 : 6);
    const jit = this.opts.jitter ?? 0.6;
    this.opts.groups.forEach((g, i) => {
      const c = this.cat(i);
      const color = this.groupColor(g);
      const r = rng(i * 7919 + 1);
      const alpha = total > 5000 ? 0.45 : 0.75;
      const withRegions = g.values.length <= 5000;
      for (let k = 0; k < g.values.length; k++) {
        const [x, y] = this.P(c + (r() - 0.5) * jit, g.values[k]);
        b.point(x, y, color, size, 'circle', alpha);
        if (withRegions) b.region({ k: 'circle', x, y, r: size / 2 + 2, hit: { series: g.name, index: k, title: g.name, values: { Value: this.fmt(g.values[k]) } } });
      }
      if (!withRegions) {
        const s = boxStats(g.values);
        this.band(b, i, { series: g.name, index: i, title: g.name, values: {}, rows: statRows(s, this.fmt).slice(0, 7) });
      }
    });
  }
}

// ---- Beeswarm ----------------------------------------------------------------------------------

export class BeeswarmChart extends GroupChart<BeeswarmOptions> {
  readonly type = 'beeswarm' as const;
  protected horizontalDefault = true;
  protected relayout = true;

  protected computeDomain() {
    const [lo, hi] = globalExtent(this.opts.groups);
    const pad = (hi - lo) * 0.02;
    const [a, b] = niceDomain(lo - pad, hi + pad);
    this.setDomain(a, b);
  }

  /** Sweep-line packing; returns px offsets, or null if any dot would leave the band. */
  private pack(vals: Float64Array, d: number, uval: number, maxOff: number): Float64Array | null {
    const offs = new Float64Array(vals.length);
    const placed: [number, number][] = [];
    let head = 0;
    for (let k = 0; k < vals.length; k++) {
      const vx = vals[k] / uval;
      while (head < placed.length && vx - placed[head][0] > d) head++;
      let off = 0;
      let found = false;
      // Try offsets 0, +d, -d, +2d ... until no collision.
      for (let step = 0; step < 400; step++) {
        off = step === 0 ? 0 : (step % 2 ? 1 : -1) * Math.ceil(step / 2) * d * 0.9;
        if (Math.abs(off) > maxOff) break;
        let ok = true;
        for (let j = head; j < placed.length; j++) {
          const dx = vx - placed[j][0];
          const dy = off - placed[j][1];
          if (dx * dx + dy * dy < d * d * 0.95) {
            ok = false;
            break;
          }
        }
        if (ok) {
          found = true;
          break;
        }
      }
      if (!found) return null;
      placed.push([vx, off]);
      offs[k] = off;
    }
    return offs;
  }

  protected marks(b: MarkBuilder) {
    const [ucat, uval] = this.upp();
    this.opts.groups.forEach((g, gi) => {
      const c = this.cat(gi);
      const color = this.groupColor(g);
      const vals = sorted(g.values);
      const maxOff = 0.46 / ucat; // band half-height in px
      // Shrink the dots until every one fits in the band without overlapping.
      let d = this.opts.pointSize ?? 7;
      let offs = this.pack(vals, d, uval, maxOff);
      while (!offs && d > 2) {
        d *= 0.85;
        offs = this.pack(vals, d, uval, maxOff);
      }
      if (!offs) offs = new Float64Array(vals.length);
      for (let k = 0; k < vals.length; k++) {
        const [x, y] = this.P(c + offs[k] * ucat, vals[k]);
        b.point(x, y, color, d);
        b.region({ k: 'circle', x, y, r: d / 2 + 1, hit: { series: g.name, index: k, title: g.name, values: { Value: this.fmt(vals[k]) } } });
      }
    });
  }
}

// ---- Density (KDE) ------------------------------------------------------------------------------

const STEPS = 200;

export class DensityChart extends MarkChart<DensityOptions> {
  readonly type = 'density' as const;
  private curves: { g: ValueGroup; color: string; d: Float64Array }[] = [];
  private lo = 0;
  private hi = 1;
  private hoverPx = 0;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected computeDomain() {
    const vis = this.opts.series.map((g, i) => ({ g, color: this.color(i, g.color) })).filter(({ g }) => !this.hidden.has(g.name));
    const [lo, hi] = globalExtent(vis.map((v) => v.g));
    const bw = this.opts.bandwidth;
    const pad = Math.max(...vis.map(({ g }) => bw ?? bandwidth(g.values)), 0) * 3;
    this.lo = lo - pad;
    this.hi = hi + pad;
    this.curves = vis.map(({ g, color }) => ({ g, color, d: kde(g.values, this.lo, this.hi, STEPS, bw ?? bandwidth(g.values)) }));
    const top = Math.max(...this.curves.map((c) => Math.max(...c.d)), 1e-12);
    const [, y1] = niceDomain(0, top);
    this.full = { x0: this.lo, x1: this.hi, y0: 0, y1 };
  }

  protected marks(b: MarkBuilder) {
    for (const { d, color } of this.curves) {
      const top: number[] = [];
      const bot: number[] = [];
      for (let k = 0; k < STEPS; k++) {
        const x = this.lo + ((this.hi - this.lo) * k) / (STEPS - 1);
        top.push(x, d[k]);
        bot.push(x, 0);
      }
      b.band(top, bot, color, 0.15);
      b.line(top, color, 2);
    }
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py) || !this.curves.length) return null;
    const [x] = this.toData(px, py);
    const k = Math.max(0, Math.min(STEPS - 1, Math.round(((x - this.lo) / (this.hi - this.lo)) * (STEPS - 1))));
    this.hoverPx = px;
    return {
      series: 'density',
      index: k,
      title: this.formatX(x),
      values: Object.fromEntries(this.curves.map((c) => [c.g.name, c.d[k]])),
      rows: this.curves.map((c) => ({ label: c.g.name, value: c.d[k].toPrecision(3), color: c.color })),
    };
  }

  protected highlight(hit: Hit | null) {
    this.showCrosshair(hit ? this.hoverPx : null);
  }
}

// ---- Ridgeline ------------------------------------------------------------------------------------

export class RidgelineChart extends MarkChart<RidgelineOptions> {
  readonly type = 'ridgeline' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected relayout = true;
  private dens: Float64Array[] = [];
  private lo = 0;
  private hi = 1;

  protected computeDomain() {
    const groups = this.opts.groups;
    const [lo, hi] = globalExtent(groups);
    const pad = Math.max(...groups.map((g) => bandwidth(g.values))) * 2.5;
    this.lo = lo - pad;
    this.hi = hi + pad;
    this.dens = groups.map((g) => kde(g.values, this.lo, this.hi, STEPS));
    const n = groups.length;
    this.yCategories = groups.map((g) => g.name).reverse();
    this.full = { x0: this.lo, x1: this.hi, y0: -0.3, y1: n - 1 + (this.opts.overlap ?? 1.6) * 0.9 };
  }

  protected marks(b: MarkBuilder) {
    const n = this.opts.groups.length;
    const H = this.opts.overlap ?? 1.6;
    const maxD = Math.max(...this.dens.map((d) => Math.max(...d)), 1e-12);
    const [, uy] = this.unitsPerPx();
    const edge = 1.5 * uy;
    // Back (top) rows first so lower ridges overlap them.
    this.opts.groups.forEach((g, i) => {
      const base = n - 1 - i;
      const d = this.dens[i];
      const color = g.color ?? this.color(0);
      const top: number[] = [];
      const bot: number[] = [];
      for (let k = 0; k < STEPS; k++) {
        const x = this.lo + ((this.hi - this.lo) * k) / (STEPS - 1);
        top.push(x, base + (d[k] / maxD) * H);
        bot.push(x, base);
      }
      // Surface-colored edge along the curve (not the flat tails) separates overlapping ridges.
      let run: number[] = [];
      let runTop: number[] = [];
      const flush = () => {
        if (run.length >= 4) b.band(runTop, run, this.theme.surface, 1);
        run = [];
        runTop = [];
      };
      for (let k = 0; k < STEPS; k++) {
        if (d[k] / maxD > 0.004) {
          run.push(top[k * 2], top[k * 2 + 1]);
          runTop.push(top[k * 2], top[k * 2 + 1] + edge);
        } else flush();
      }
      flush();
      b.band(top, bot, color, 0.85);
      const s = boxStats(g.values);
      b.region({
        k: 'rect',
        x0: this.lo,
        y0: base,
        x1: this.hi,
        y1: base + 0.9,
        hl: { k: 'poly', pts: [...top, this.hi, base, this.lo, base] },
        hit: { series: g.name, index: i, title: g.name, values: { median: s.median }, rows: statRows(s, (v) => this.formatX(v)).slice(0, 7) },
      });
    });
  }
}

// ---- ECDF -------------------------------------------------------------------------------------

export class EcdfChart extends MarkChart<EcdfOptions> {
  readonly type = 'ecdf' as const;
  private sortedVals: { g: ValueGroup; color: string; s: Float64Array }[] = [];
  private hoverPx = 0;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  formatY(v: number) {
    return `${Math.round(v * 100)}%`;
  }

  protected computeDomain() {
    this.sortedVals = this.opts.series
      .map((g, i) => ({ g, color: this.color(i, g.color), s: sorted(g.values) }))
      .filter(({ g }) => !this.hidden.has(g.name));
    const [lo, hi] = globalExtent(this.sortedVals.map((v) => v.g));
    const [a, b] = niceDomain(lo, hi);
    this.full = { x0: a, x1: b, y0: 0, y1: 1 };
  }

  protected marks(b: MarkBuilder) {
    for (const { s, color } of this.sortedVals) {
      const n = s.length;
      const m = Math.min(n, 4000);
      const pts: number[] = [this.full.x0, 0];
      for (let k = 0; k < m; k++) {
        const i = Math.min(n - 1, Math.floor(((k + 1) / m) * n) - 1);
        const x = s[Math.max(0, i)];
        pts.push(x, pts[pts.length - 1], x, (i + 1) / n);
      }
      pts.push(this.full.x1, 1);
      b.line(pts, color, 2);
    }
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const [x] = this.toData(px, py);
    this.hoverPx = px;
    const rows = this.sortedVals.map(({ g, color, s }) => {
      let lo = 0, hi = s.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (s[mid] <= x) lo = mid + 1;
        else hi = mid;
      }
      return { label: g.name, value: `${((lo / (s.length || 1)) * 100).toFixed(1)}% ≤ ${formatNumber(x)}`, color };
    });
    return { series: 'ecdf', index: 0, title: this.formatX(x), values: Object.fromEntries(rows.map((r) => [r.label, r.value])), rows };
  }

  protected highlight(hit: Hit | null) {
    this.showCrosshair(hit ? this.hoverPx : null);
  }
}

// ---- Q-Q -------------------------------------------------------------------------------------

export class QQChart extends MarkChart<QQOptions> {
  readonly type = 'qq' as const;
  private pts: [number, number][] = [];
  private line: [number, number] = [0, 1];

  protected computeDomain() {
    const s = sorted(this.opts.values);
    const m = Math.min(s.length, 2000);
    this.pts = [];
    for (let k = 0; k < m; k++) {
      const p = (k + 0.5) / m;
      this.pts.push([normInv(p), quantile(s, p)]);
    }
    // Reference line through the quartiles (robust to tails).
    const q1 = quantile(s, 0.25);
    const q3 = quantile(s, 0.75);
    const t1 = normInv(0.25);
    const t3 = normInv(0.75);
    const slope = (q3 - q1) / (t3 - t1);
    this.line = [q1 - slope * t1, slope];
    const xs = this.pts.map((p) => p[0]);
    const ys = this.pts.map((p) => p[1]);
    const [x0, x1] = niceDomain(Math.min(...xs), Math.max(...xs));
    const [y0, y1] = niceDomain(Math.min(...ys), Math.max(...ys));
    this.full = { x0, x1, y0, y1 };
  }

  protected marks(b: MarkBuilder) {
    const [a, k] = this.line;
    const { x0, x1 } = this.full;
    b.line([x0, a + k * x0, x1, a + k * x1], this.theme.textMuted, 1.5, 1, false, true);
    const color = this.color(0);
    const name = this.opts.name ?? 'Sample';
    this.pts.forEach(([t, v], i) => {
      b.point(t, v, color, 6, 'circle', 0.8);
      b.region({ k: 'circle', x: t, y: v, r: 5, hit: { series: name, index: i, values: { Theoretical: formatNumber(t), Sample: formatNumber(v), Expected: formatNumber(a + k * t) } } });
    });
  }
}
