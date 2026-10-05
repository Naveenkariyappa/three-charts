import type { Hit, LegendItem } from '../base';
import { MarkChart, toColor, type MarkBuilder } from '../markchart';
import { extent, formatNumber, nearestIndex, niceDomain } from '../scale';
import type { ConfidenceBandOptions, ErrorBarOptions, ParetoOptions, PopulationPyramidOptions } from '../types2';

/** `color` mixed toward the surface: same hue, recessive. */
function tint(color: string, surface: string, amount: number) {
  return '#' + toColor(color).clone().lerp(toColor(surface), amount).getHexString();
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

// ---- Pareto -------------------------------------------------------------------------------

/**
 * Bars sorted largest first with the cumulative total as a line. Both share
 * one scale (0 to the grand total), so the line's end is 100% by construction
 * and no second axis is needed.
 */
export class ParetoChart extends MarkChart<ParetoOptions> {
  readonly type = 'pareto' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected relayout = true;
  private rows: { label: string; value: number; cum: number }[] = [];
  private total = 1;

  private names() {
    return { bars: this.opts.name ?? 'Value', line: 'Cumulative %' };
  }

  protected legendItems(): LegendItem[] {
    const n = this.names();
    return [
      { name: n.bars, color: this.color(0) },
      { name: n.line, color: this.color(1) },
    ];
  }

  protected computeDomain() {
    const data = [...this.opts.data].filter((d) => d.value > 0).sort((a, c) => c.value - a.value);
    this.total = data.reduce((s, d) => s + d.value, 0) || 1;
    let run = 0;
    this.rows = data.map((d) => ({ label: d.label, value: d.value, cum: (run += d.value) / this.total }));
    this.xCategories = this.rows.map((r) => r.label);
    // Headroom above 100% for the percentage labels.
    this.full = { x0: -0.5, x1: Math.max(1, this.rows.length) - 0.5, y0: 0, y1: this.total * 1.12 };
  }

  protected marks(b: MarkBuilder) {
    const names = this.names();
    const thr = this.opts.threshold ?? 0.8;
    const barColor = this.color(0);
    const lineColor = this.color(1);
    b.grow = { base: 0, horizontal: false };
    const n = this.rows.length;
    if (!this.hidden.has(names.bars)) {
      this.rows.forEach((r, i) => {
        const before = i ? this.rows[i - 1].cum : 0;
        // The "vital few" (up to the threshold) at full color, the rest recede.
        const color = before < thr ? barColor : tint(barColor, this.theme.surface, 0.55);
        b.rect(i - 0.4, 0, i + 0.4, r.value, color, 'top');
        b.region({ k: 'rect', x0: i - 0.4, y0: 0, x1: i + 0.4, y1: r.value, hit: this.hit(r, i, color) });
      });
    }
    // Threshold reference.
    b.line([-0.5, thr * this.total, n - 0.5, thr * this.total], this.theme.textMuted, 1, 1, false, true);
    b.text(`${Math.round(thr * 100)}%`, n - 0.5, thr * this.total, 1.1, 1.2);
    if (!this.hidden.has(names.line)) {
      const pts: number[] = [];
      this.rows.forEach((r, i) => pts.push(i, r.cum * this.total));
      b.line(pts, lineColor, 2);
      const every = Math.max(1, Math.ceil(n / 10));
      this.rows.forEach((r, i) => {
        b.point(i, r.cum * this.total, lineColor, 8);
        if (i % every === 0 || i === n - 1) b.text(`${Math.round(r.cum * 100)}%`, i, r.cum * this.total, 0.5, 1.6);
        b.region({ k: 'circle', x: i, y: r.cum * this.total, r: 8, hit: this.hit(r, i, lineColor) });
      });
    }
  }

  private hit(r: { label: string; value: number; cum: number }, i: number, color: string): Hit {
    return {
      series: r.label,
      index: i,
      color,
      values: { Value: r.value },
      rows: [
        { label: this.names().bars, value: this.formatY(r.value), color },
        { label: 'Share', value: pct(r.value / this.total) },
        { label: 'Cumulative', value: pct(r.cum) },
      ],
    };
  }
}

// ---- Error bars ------------------------------------------------------------------------------

/** Point estimates with whiskers: symmetric (± error) or asymmetric (low/high). */
export class ErrorBarChart extends MarkChart<ErrorBarOptions> {
  readonly type = 'errorBar' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected relayout = true;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  private visible() {
    return this.opts.series.map((s, i) => ({ s, color: this.color(i, s.color) })).filter(({ s }) => !this.hidden.has(s.name));
  }

  private bounds(s: ErrorBarOptions['series'][number], i: number): [number, number] {
    if (s.low && s.high) return [s.low[i], s.high[i]];
    const e = s.error ? s.error[i] : 0;
    return [s.y[i] - e, s.y[i] + e];
  }

  protected computeDomain() {
    const cats = this.opts.categories;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const { s } of this.visible()) {
      for (let i = 0; i < s.y.length; i++) {
        const [lo, hi] = this.bounds(s, i);
        y0 = Math.min(y0, lo);
        y1 = Math.max(y1, hi);
      }
      const [a, c] = s.x ? extent(s.x) : [0, s.y.length - 1];
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, c);
    }
    if (!isFinite(y0)) [x0, x1, y0, y1] = [0, 1, 0, 1];
    const [a, c] = niceDomain(y0, y1);
    if (cats) {
      this.xCategories = cats;
      this.full = { x0: -0.5, x1: cats.length - 0.5, y0: a, y1: c };
    } else {
      const pad = (x1 - x0 || 1) * 0.05;
      this.full = { x0: x0 - pad, x1: x1 + pad, y0: a, y1: c };
    }
  }

  protected marks(b: MarkBuilder) {
    const vis = this.visible();
    const [upx] = this.unitsPerPx();
    const cap = 5 * upx;
    // Side by side within a category so whiskers don't overlap.
    const dodge = this.opts.categories && vis.length > 1 ? Math.min(0.6 / vis.length, 0.2) : 0;
    vis.forEach(({ s, color }, k) => {
      const off = (k - (vis.length - 1) / 2) * dodge;
      for (let i = 0; i < s.y.length; i++) {
        const x = (s.x ? s.x[i] : i) + off;
        const [lo, hi] = this.bounds(s, i);
        b.seg(x, lo, x, hi, color, 1.5);
        b.seg(x - cap, lo, x + cap, lo, color, 1.5);
        b.seg(x - cap, hi, x + cap, hi, color, 1.5);
        b.point(x, s.y[i], color, 9);
        const label = this.opts.categories?.[s.x ? s.x[i] : i] ?? this.formatX(s.x ? s.x[i] : i);
        b.region({
          k: 'rect',
          x0: x - cap * 1.6,
          y0: lo,
          x1: x + cap * 1.6,
          y1: hi,
          hit: {
            series: s.name,
            index: i,
            color,
            title: label,
            values: { Value: s.y[i], Low: lo, High: hi },
            rows: [
              { label: s.name, value: this.formatY(s.y[i]), color },
              { label: 'Interval', value: `${this.formatY(lo)} – ${this.formatY(hi)}` },
            ],
          },
        });
      }
    });
  }
}

// ---- Confidence band (fan chart) ------------------------------------------------------------

/** A central line with one or more shaded intervals around it. */
export class ConfidenceBandChart extends MarkChart<ConfidenceBandOptions> {
  readonly type = 'confidenceBand' as const;
  private hover: { px: number; py: number; color: string } | null = null;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  private visible() {
    return this.opts.series.map((s, i) => ({ s, color: this.color(i, s.color) })).filter(({ s }) => !this.hidden.has(s.name));
  }

  protected computeDomain() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const { s } of this.visible()) {
      const [a, c] = s.x ? extent(s.x) : [0, s.y.length - 1];
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, c);
      const all = [s.y, ...s.bands.flatMap((bd) => [bd.lower, bd.upper])];
      for (const arr of all) {
        const [lo, hi] = extent(arr);
        y0 = Math.min(y0, lo);
        y1 = Math.max(y1, hi);
      }
    }
    if (!isFinite(x0)) [x0, x1, y0, y1] = [0, 1, 0, 1];
    const [a, c] = niceDomain(y0, y1);
    this.full = { x0, x1: x1 === x0 ? x0 + 1 : x1, y0: a, y1: c };
  }

  protected marks(b: MarkBuilder) {
    for (const { s, color } of this.visible()) {
      const xAt = (i: number) => (s.x ? s.x[i] : i);
      const nb = s.bands.length;
      // Widest band first and palest; inner bands stack darker on top.
      s.bands.forEach((band, j) => {
        const top: number[] = [];
        const bot: number[] = [];
        for (let i = 0; i < band.lower.length; i++) {
          top.push(xAt(i), band.upper[i]);
          bot.push(xAt(i), band.lower[i]);
        }
        b.band(top, bot, color, 0.16 + (0.16 * j) / Math.max(1, nb - 1));
      });
      const pts: number[] = [];
      for (let i = 0; i < s.y.length; i++) pts.push(xAt(i), s.y[i]);
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
    for (const { s, color } of this.visible()) {
      const i = s.x ? nearestIndex(s.x, dx) : Math.max(0, Math.min(s.y.length - 1, Math.round(dx)));
      if (x !== x) x = s.x ? s.x[i] : i;
      rows.push({ label: s.name, value: this.formatY(s.y[i]), color });
      values[s.name] = this.formatY(s.y[i]);
      s.bands.forEach((band, j) => rows.push({ label: band.label ?? (s.bands.length > 1 ? `Interval ${j + 1}` : 'Interval'), value: `${this.formatY(band.lower[i])} – ${this.formatY(band.upper[i])}` }));
      dot ??= { y: s.y[i], color };
    }
    if (x !== x || !dot) return null;
    const [hx, hy] = this.toPx(x, dot.y);
    this.hover = { px: hx, py: hy, color: dot.color };
    return { series: 'x', index: 0, title: this.formatXTip(x), values, rows };
  }

  protected highlight(hit: Hit | null) {
    this.showCrosshair(hit && this.hover ? this.hover.px : null);
    if (hit && this.hover) this.showDot(this.hover.px, this.hover.py, this.hover.color);
    else this.showDot(null);
  }
}

// ---- Population pyramid -----------------------------------------------------------------------

/** Back-to-back horizontal bars: two groups compared row by row (e.g. age bands by sex). */
export class PopulationPyramidChart extends MarkChart<PopulationPyramidOptions> {
  readonly type = 'populationPyramid' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  private total = 1;

  protected legendItems(): LegendItem[] {
    const { left, right } = this.opts;
    return [
      { name: left.name, color: this.color(0, left.color) },
      { name: right.name, color: this.color(1, right.color) },
    ];
  }

  /** Both sides read as positive amounts. */
  formatX(v: number) {
    return super.formatX(Math.abs(v));
  }

  protected computeDomain() {
    const { left, right, categories } = this.opts;
    const m = Math.max(extent(left.values)[1], extent(right.values)[1], 1e-9);
    const [, hi] = niceDomain(0, m);
    this.total = [...Array.from(left.values), ...Array.from(right.values)].reduce((s, v) => s + v, 0) || 1;
    this.yCategories = categories;
    this.full = { x0: -hi, x1: hi, y0: -0.5, y1: categories.length - 0.5 };
  }

  protected marks(b: MarkBuilder) {
    const { left, right, categories } = this.opts;
    b.grow = { base: 0, horizontal: true };
    const sides: [typeof left, number, 1 | -1][] = [
      [left, 0, -1],
      [right, 1, 1],
    ];
    for (const [side, ci, dir] of sides) {
      if (this.hidden.has(side.name)) continue;
      const color = this.color(ci, side.color);
      const other = side === left ? right : left;
      categories.forEach((cat, i) => {
        const v = side.values[i] ?? 0;
        const x0 = dir < 0 ? -v : 0;
        const x1 = dir < 0 ? 0 : v;
        b.rect(x0, i - 0.4, x1, i + 0.4, color, dir < 0 ? 'left' : 'right');
        const o = other.values[i] ?? 0;
        b.region({
          k: 'rect',
          x0,
          y0: i - 0.4,
          x1,
          y1: i + 0.4,
          hit: {
            series: side.name,
            index: i,
            color,
            title: cat,
            values: { [side.name]: v },
            rows: [
              { label: side.name, value: this.formatY(v), color },
              { label: other.name, value: this.formatY(o) },
              { label: 'Share of total', value: pct(v / this.total) },
            ],
          },
        });
      });
    }
    b.seg(0, -0.5, 0, categories.length - 0.5, this.theme.axis, 1);
  }

  formatY(v: number) {
    return this.opts.xAxis?.format?.(v) ?? formatNumber(v);
  }
}

