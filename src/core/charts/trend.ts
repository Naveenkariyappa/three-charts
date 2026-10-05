import type { Hit, LegendItem } from '../base';
import { MarkChart, type MarkBuilder } from '../markchart';
import { extent, formatNumber, nearestIndex, niceDomain } from '../scale';
import type { Numbers, XYSeries } from '../types';
import type { BumpOptions, HorizonOptions, RangeAreaOptions, SlopeOptions, SparklineOptions } from '../types2';

const xAt = (x: Numbers | undefined, i: number) => (x ? x[i] : i);

// ---- Range area / band --------------------------------------------------------------

export class RangeAreaChart extends MarkChart<RangeAreaOptions> {
  readonly type = 'rangeArea' as const;
  private hover: { px: number; py: number; color: string } | null = null;

  protected legendItems(): LegendItem[] {
    const bands = this.opts.bands.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
    const lines = (this.opts.lines ?? []).map((s, i) => ({ name: s.name, color: this.color(bands.length + i, s.color) }));
    return [...bands, ...lines];
  }

  private visBands() {
    return this.opts.bands.map((s, i) => ({ s, color: this.color(i, s.color) })).filter(({ s }) => !this.hidden.has(s.name));
  }

  private visLines() {
    const nb = this.opts.bands.length;
    return (this.opts.lines ?? []).map((s, i) => ({ s, color: this.color(nb + i, s.color) })).filter(({ s }) => !this.hidden.has(s.name));
  }

  protected computeDomain() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const take = (x: Numbers | undefined, n: number, lo: Numbers, hi: Numbers) => {
      const [a, b] = x ? extent(x) : [0, n - 1];
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, b);
      y0 = Math.min(y0, extent(lo)[0]);
      y1 = Math.max(y1, extent(hi)[1]);
    };
    for (const { s } of this.visBands()) take(s.x, s.low.length, s.low, s.high);
    for (const { s } of this.visLines()) take(s.x, s.y.length, s.y, s.y);
    if (!isFinite(x0)) [x0, x1, y0, y1] = [0, 1, 0, 1];
    const [a, b] = niceDomain(y0, y1);
    this.full = { x0, x1: x1 === x0 ? x0 + 1 : x1, y0: a, y1: b };
  }

  protected marks(b: MarkBuilder) {
    for (const { s, color } of this.visBands()) {
      const top: number[] = [];
      const bot: number[] = [];
      for (let i = 0; i < s.low.length; i++) {
        top.push(xAt(s.x, i), s.high[i]);
        bot.push(xAt(s.x, i), s.low[i]);
      }
      b.band(top, bot, color, 0.22);
      b.softLine(top, color, 1, 0.6);
      b.softLine(bot, color, 1, 0.6);
    }
    for (const { s, color } of this.visLines()) {
      const pts: number[] = [];
      for (let i = 0; i < s.y.length; i++) pts.push(xAt(s.x, i), s.y[i]);
      b.line(pts, color, 2);
    }
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const [dx] = this.toData(px, py);
    const rows: NonNullable<Hit['rows']> = [];
    const values: Record<string, string> = {};
    let x = NaN;
    let dot: { y: number; color: string } | null = null;
    const pick = (xs: Numbers | undefined, n: number) => (xs ? nearestIndex(xs, dx) : Math.max(0, Math.min(n - 1, Math.round(dx))));
    for (const { s, color } of this.visLines()) {
      const i = pick(s.x, s.y.length);
      x = xAt(s.x, i);
      rows.push({ label: s.name, value: this.formatY(s.y[i]), color });
      values[s.name] = this.formatY(s.y[i]);
      dot ??= { y: s.y[i], color };
    }
    for (const { s, color } of this.visBands()) {
      const i = pick(s.x, s.low.length);
      if (x !== x) x = xAt(s.x, i);
      const v = `${this.formatY(s.low[i])} – ${this.formatY(s.high[i])}`;
      rows.push({ label: s.name, value: v, color });
      values[s.name] = v;
    }
    if (x !== x) return null;
    const [hx, hy] = this.toPx(x, dot?.y ?? 0);
    this.hover = { px: hx, py: hy, color: dot?.color ?? '' };
    return { series: 'x', index: 0, title: this.formatXTip(x), values, rows };
  }

  protected highlight(hit: Hit | null) {
    this.showCrosshair(hit && this.hover ? this.hover.px : null);
    if (hit && this.hover?.color) this.showDot(this.hover.px, this.hover.py, this.hover.color);
    else this.showDot(null);
  }
}

// ---- Slope ----------------------------------------------------------------------------

export class SlopeChart extends MarkChart<SlopeOptions> {
  readonly type = 'slope' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected relayout = true;
  protected showYTicks = false;

  protected legendItems(): LegendItem[] {
    return [
      { name: 'Increase', color: this.color(0) },
      { name: 'Decrease', color: this.color(1) },
    ];
  }

  protected computeDomain() {
    let lo = Infinity, hi = -Infinity;
    for (const it of this.opts.items) {
      lo = Math.min(lo, it.start, it.end);
      hi = Math.max(hi, it.start, it.end);
    }
    const [a, c] = niceDomain(lo, hi);
    this.xCategories = ['', this.opts.labels[0], this.opts.labels[1], ''];
    this.full = { x0: -0.2, x1: 3.2, y0: a, y1: c };
  }

  protected marks(b: MarkBuilder) {
    const up = this.color(0);
    const down = this.color(1);
    const items = this.opts.items.filter((it) => !this.hidden.has(it.end >= it.start ? 'Increase' : 'Decrease'));
    b.seg(1, this.full.y0, 1, this.full.y1, this.theme.axis, 1);
    b.seg(2, this.full.y0, 2, this.full.y1, this.theme.axis, 1);
    const [, upy] = this.unitsPerPx();
    const gap = 14 * upy;
    // Spread labels vertically so close values don't collide.
    const spread = (vals: number[]) => {
      const order = vals.map((_, i) => i).sort((a, c) => vals[a] - vals[c]);
      const out = [...vals];
      for (let k = 1; k < order.length; k++) {
        const p = out[order[k - 1]];
        if (out[order[k]] - p < gap) out[order[k]] = p + gap;
      }
      return out;
    };
    const ls = spread(items.map((it) => it.start));
    const rs = spread(items.map((it) => it.end));
    items.forEach((it, i) => {
      const color = it.color ?? (it.end >= it.start ? up : down);
      b.line([1, it.start, 2, it.end], color, 2);
      b.point(1, it.start, color, 9);
      b.point(2, it.end, color, 9);
      b.text(`${it.name}  ${formatNumber(it.start)}`, 1, ls[i], 1.08, 0.5);
      b.text(`${formatNumber(it.end)}  ${it.name}`, 2, rs[i], -0.08, 0.5);
      const d = it.end - it.start;
      b.region({
        k: 'path',
        pts: [1, it.start, 2, it.end],
        tol: 6,
        hit: {
          series: it.name,
          index: i,
          values: { [this.opts.labels[0]]: it.start, [this.opts.labels[1]]: it.end },
          rows: [
            { label: this.opts.labels[0], value: formatNumber(it.start) },
            { label: this.opts.labels[1], value: formatNumber(it.end), color },
            { label: 'Change', value: `${d >= 0 ? '+' : ''}${formatNumber(d)} (${it.start ? ((d / it.start) * 100).toFixed(1) : '–'}%)` },
          ],
        },
      });
    });
  }
}

// ---- Bump ------------------------------------------------------------------------------

export class BumpChart extends MarkChart<BumpOptions> {
  readonly type = 'bump' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  /** ranks[series][period], 1 = best. */
  private ranks(): number[][] {
    const { series, periods } = this.opts;
    if (this.opts.ranks) return series.map((s) => Array.from(s.data));
    const out = series.map(() => new Array(periods.length).fill(0));
    for (let t = 0; t < periods.length; t++) {
      const order = series.map((_, i) => i).sort((a, b) => (series[b].data[t] ?? -Infinity) - (series[a].data[t] ?? -Infinity));
      order.forEach((si, r) => (out[si][t] = r + 1));
    }
    return out;
  }

  protected computeDomain() {
    const n = this.opts.series.length;
    const T = this.opts.periods.length;
    this.xCategories = this.opts.periods;
    this.yCategories = Array.from({ length: n }, (_, i) => `#${n - i}`);
    // Extra room on the right for end labels.
    this.full = { x0: -0.4, x1: T - 1 + Math.max(0.9, T * 0.18), y0: -0.6, y1: n - 0.4 };
  }

  protected marks(b: MarkBuilder) {
    const n = this.opts.series.length;
    const ranks = this.ranks();
    const T = this.opts.periods.length;
    this.opts.series.forEach((s, si) => {
      if (this.hidden.has(s.name)) return;
      const color = this.color(si, s.color);
      const pts: number[] = [];
      for (let t = 0; t < T; t++) pts.push(t, n - ranks[si][t]);
      // Smooth S-curves between periods read better than straight zig-zags.
      const curve: number[] = [];
      for (let t = 0; t < T - 1; t++) {
        const y0 = pts[t * 2 + 1];
        const y1 = pts[t * 2 + 3];
        for (let k = 0; k <= 12; k++) {
          const u = k / 12;
          const e = u * u * (3 - 2 * u);
          curve.push(t + u, y0 + (y1 - y0) * e);
        }
      }
      b.line(curve.length ? curve : pts, color, 3);
      for (let t = 0; t < T; t++) b.point(t, n - ranks[si][t], color, 11);
      b.text(s.name, T - 1, n - ranks[si][T - 1], -0.15, 0.5, true);
      b.region({
        k: 'path',
        pts: curve.length ? curve : pts,
        tol: 7,
        hit: {
          series: s.name,
          index: si,
          color,
          values: Object.fromEntries(this.opts.periods.map((p, t) => [p, `#${ranks[si][t]}`])),
          rows: this.opts.periods.map((p, t) => ({ label: p, value: `#${ranks[si][t]}${this.opts.ranks ? '' : `  (${formatNumber(s.data[t])})`}` })),
        },
      });
    });
  }
}

// ---- Horizon ----------------------------------------------------------------------------

export class HorizonChart extends MarkChart<HorizonOptions> {
  readonly type = 'horizon' as const;
  protected legendToggles = false;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  private rowH = 0;
  private x0px = 0;
  private hover: { px: number } | null = null;

  private series(): XYSeries[] {
    return this.opts.series;
  }

  protected marks(b: MarkBuilder) {
    const series = this.series();
    const W = this.plot.width;
    const H = this.plot.height;
    const labelW = Math.min(120, W * 0.2);
    const B = Math.max(1, this.opts.bands ?? 3);
    let maxAbs = 0;
    for (const s of series) for (let i = 0; i < s.y.length; i++) maxAbs = Math.max(maxAbs, Math.abs(s.y[i]));
    const bs = this.opts.bandSize ?? (maxAbs / B || 1);
    const rowH = (H - 2 * (series.length - 1)) / Math.max(1, series.length);
    this.rowH = rowH;
    this.x0px = labelW;
    const d = this.theme.diverging;
    const pos = [d[2], d[1], d[0]];
    const neg = [d[4], d[5], d[6]];
    series.forEach((s, r) => {
      const top = r * (rowH + 2);
      const bottom = top + rowH;
      const n = s.y.length;
      const [xlo, xhi] = s.x ? extent(s.x) : [0, n - 1];
      const X = (i: number) => labelW + ((xAt(s.x, i) - xlo) / (xhi - xlo || 1)) * (W - labelW);
      b.box(labelW, top, W, bottom, this.theme.grid, 0.35);
      for (let k = 0; k < B; k++) {
        for (const sign of [1, -1]) {
          const t: number[] = [];
          const bt: number[] = [];
          let any = false;
          for (let i = 0; i < n; i++) {
            const v = s.y[i] * sign;
            const h = Math.min(Math.max(v - k * bs, 0), bs) / bs;
            if (h > 0) any = true;
            t.push(X(i), bottom - h * rowH);
            bt.push(X(i), bottom);
          }
          if (any) b.band(t, bt, (sign > 0 ? pos : neg)[Math.min(k, 2)], 1);
        }
      }
      b.text(s.name, labelW - 8, top + rowH / 2, 1, 0.5, true, { maxWidth: labelW - 8 });
    });
  }

  protected legendItems(): LegendItem[] {
    return [
      { name: 'Above zero', color: this.theme.diverging[1] },
      { name: 'Below zero', color: this.theme.diverging[5] },
    ];
  }

  protected hitTest(px: number, py: number): Hit | null {
    const series = this.series();
    const r = Math.floor((py - this.plot.top) / (this.rowH + 2));
    const s = series[r];
    if (!s || px < this.x0px) return null;
    const n = s.y.length;
    const [xlo, xhi] = s.x ? extent(s.x) : [0, n - 1];
    const xv = xlo + ((px - this.plot.left - this.x0px) / (this.plot.width - this.x0px)) * (xhi - xlo);
    const i = s.x ? nearestIndex(s.x, xv) : Math.max(0, Math.min(n - 1, Math.round(xv)));
    this.hover = { px };
    return { series: s.name, index: i, title: s.name, values: { x: formatNumber(xAt(s.x, i)), Value: formatNumber(s.y[i]) } };
  }

  protected highlight(hit: Hit | null) {
    this.showCrosshair(hit && this.hover ? this.hover.px : null);
  }
}

// ---- Sparkline ---------------------------------------------------------------------------

export class SparklineChart extends MarkChart<SparklineOptions> {
  readonly type = 'sparkline' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 6;
  private X: (i: number) => number = () => 0;
  private Y: (v: number) => number = () => 0;

  protected marks(b: MarkBuilder) {
    const v = this.opts.values;
    const n = v.length;
    if (!n) return;
    const color = this.opts.color ?? this.color(0);
    const showLast = this.plot.width > 140;
    const W = this.plot.width - (showLast ? 48 : 6);
    const H = this.plot.height;
    const [lo, hi] = extent(v);
    this.X = (i) => (n > 1 ? (i / (n - 1)) * W : W / 2);
    this.Y = (y) => H - 3 - ((y - lo) / (hi - lo || 1)) * (H - 6);
    const pts: number[] = [];
    // Decimate to ~2 points per px; min/max per bucket keeps spikes visible.
    const step = Math.max(1, Math.floor(n / (W * 2)));
    for (let i = 0; i < n; i += step) {
      let a = i, c = i;
      for (let k = i; k < Math.min(n, i + step); k++) {
        if (v[k] < v[a]) a = k;
        if (v[k] > v[c]) c = k;
      }
      for (const k of a < c ? [a, c] : [c, a]) pts.push(this.X(k), this.Y(v[k]));
    }
    if (this.opts.area) {
      const bot: number[] = [];
      for (let i = 0; i < pts.length; i += 2) bot.push(pts[i], H);
      b.band(pts, bot, color, 0.15);
    }
    b.line(pts, color, 1.5);
    if (this.opts.markers !== false) {
      let a = 0, c = 0;
      for (let i = 0; i < n; i++) {
        if (v[i] < v[a]) a = i;
        if (v[i] > v[c]) c = i;
      }
      b.point(this.X(a), this.Y(v[a]), this.theme.textMuted, 6);
      b.point(this.X(c), this.Y(v[c]), this.theme.textMuted, 6);
      b.point(this.X(n - 1), this.Y(v[n - 1]), color, 7);
    }
    if (showLast) b.text(formatNumber(v[n - 1]), W + 8, this.Y(v[n - 1]), 0, 0.5, true);
  }

  protected hitTest(px: number, py: number): Hit | null {
    const n = this.opts.values.length;
    if (!n || !this.inPlot(px, py)) return null;
    const W = this.plot.width - (this.plot.width > 140 ? 48 : 6);
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - this.plot.left) / W) * (n - 1))));
    this.dotAt = [this.plot.left + this.X(i), this.plot.top + this.Y(this.opts.values[i])];
    return { series: 'Value', index: i, title: `#${i + 1}`, values: { Value: formatNumber(this.opts.values[i]) } };
  }

  private dotAt: [number, number] = [0, 0];

  protected highlight(hit: Hit | null) {
    if (!hit) return this.showDot(null);
    this.showDot(this.dotAt[0], this.dotAt[1], this.opts.color ?? this.color(0));
  }
}
