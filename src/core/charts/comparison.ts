import type { Hit, LegendItem } from '../base';
import { MarkChart, inkOn, polar, type MarkBuilder } from '../markchart';
import { extent, formatNumber, niceDomain, niceTicks } from '../scale';
import type {
  BulletOptions,
  DotPlotOptions,
  DumbbellOptions,
  LollipopOptions,
  MarimekkoOptions,
  PictographOptions,
  RadialBarOptions,
  RangeBarOptions,
  WaterfallOptions,
} from '../types2';

const zeroDomain = (lo: number, hi: number) => niceDomain(Math.min(0, lo), Math.max(0, hi));

/**
 * Shared plumbing for charts with one category axis and one value axis.
 * `cat(i)` gives the category coordinate; `P(c, v)` maps (category, value) to (x, y).
 */
abstract class CategoryChart<O extends LollipopOptions | DotPlotOptions | DumbbellOptions | RangeBarOptions | WaterfallOptions> extends MarkChart<O> {
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected horizontalDefault = false;

  protected get horizontal() {
    return (this.opts as { horizontal?: boolean }).horizontal ?? this.horizontalDefault;
  }

  protected setCategoryDomain(categories: string[], lo: number, hi: number) {
    const n = categories.length;
    if (this.horizontal) {
      this.yCategories = [...categories].reverse();
      this.full = { x0: lo, x1: hi, y0: -0.5, y1: n - 0.5 };
    } else {
      this.xCategories = categories;
      this.full = { x0: -0.5, x1: n - 0.5, y0: lo, y1: hi };
    }
  }

  protected cat(i: number) {
    const n = (this.opts as { categories: string[] }).categories.length;
    return this.horizontal ? n - 1 - i : i;
  }

  protected P(c: number, v: number): [number, number] {
    return this.horizontal ? [v, c] : [c, v];
  }

  /** Whole category band as the hover target. */
  protected bandRegion(b: MarkBuilder, i: number, hit: Hit, hl?: Parameters<MarkBuilder['region']>[0]['hl']) {
    const c = this.cat(i);
    const f = this.full;
    if (this.horizontal) b.region({ k: 'rect', x0: f.x0, y0: c - 0.5, x1: f.x1, y1: c + 0.5, hit, hl });
    else b.region({ k: 'rect', x0: c - 0.5, y0: f.y0, x1: c + 0.5, y1: f.y1, hit, hl });
  }

  protected fmtV(v: number) {
    return this.horizontal ? this.formatX(v) : this.formatY(v);
  }
}

// ---- Lollipop -------------------------------------------------------------------------

export class LollipopChart extends CategoryChart<LollipopOptions> {
  readonly type = 'lollipop' as const;

  protected computeDomain() {
    const [lo, hi] = extent(this.opts.values);
    const [a, b] = zeroDomain(lo, hi);
    this.setCategoryDomain(this.opts.categories, a, b);
  }

  protected marks(b: MarkBuilder) {
    const color = this.color(0);
    const { categories, values } = this.opts;
    categories.forEach((name, i) => {
      const v = values[i] ?? 0;
      const c = this.cat(i);
      const [x0, y0] = this.P(c, 0);
      const [x1, y1] = this.P(c, v);
      b.seg(x0, y0, x1, y1, color, 2);
      b.point(x1, y1, color, 12);
      this.bandRegion(b, i, { series: this.opts.name ?? 'Value', index: i, title: name, values: { [this.opts.name ?? 'Value']: this.fmtV(v) } }, { k: 'circle', x: x1, y: y1, r: 7 });
    });
  }
}

// ---- Dot plot (Cleveland) -------------------------------------------------------------

export class DotPlotChart extends CategoryChart<DotPlotOptions> {
  readonly type = 'dotplot' as const;
  protected horizontalDefault = true;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected computeDomain() {
    let lo = Infinity, hi = -Infinity;
    for (const s of this.opts.series) {
      if (this.hidden.has(s.name)) continue;
      const [a, b] = extent(s.data);
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    }
    if (!isFinite(lo)) [lo, hi] = [0, 1];
    // Dot plots needn't start at zero: position, not length, carries the value.
    const pad = (hi - lo) * 0.08 || 1;
    const [a, b] = niceDomain(lo - pad, hi + pad);
    this.setCategoryDomain(this.opts.categories, a, b);
  }

  protected marks(b: MarkBuilder) {
    const series = this.opts.series.map((s, si) => ({ s, color: this.color(si, s.color) })).filter(({ s }) => !this.hidden.has(s.name));
    this.opts.categories.forEach((name, i) => {
      const c = this.cat(i);
      const vals = series.map(({ s }) => s.data[i] ?? NaN).filter((v) => v === v);
      if (vals.length > 1) {
        const [x0, y0] = this.P(c, Math.min(...vals));
        const [x1, y1] = this.P(c, Math.max(...vals));
        b.seg(x0, y0, x1, y1, this.theme.axis, 2);
      }
      for (const { s, color } of series) {
        const [x, y] = this.P(c, s.data[i]);
        b.point(x, y, color, 11);
      }
      this.bandRegion(b, i, {
        series: name,
        index: i,
        title: name,
        values: Object.fromEntries(series.map(({ s }) => [s.name, s.data[i]])),
        rows: series.map(({ s, color }) => ({ label: s.name, value: this.fmtV(s.data[i]), color })),
      });
    });
  }
}

// ---- Dumbbell --------------------------------------------------------------------------

export class DumbbellChart extends CategoryChart<DumbbellOptions> {
  readonly type = 'dumbbell' as const;
  protected horizontalDefault = true;

  private names() {
    return [this.opts.startName ?? 'Start', this.opts.endName ?? 'End'];
  }

  protected legendItems(): LegendItem[] {
    const [a, b] = this.names();
    return [
      { name: a, color: this.color(0) },
      { name: b, color: this.color(1) },
    ];
  }

  protected computeDomain() {
    const [a0, a1] = extent(this.opts.start);
    const [b0, b1] = extent(this.opts.end);
    const lo = Math.min(a0, b0);
    const hi = Math.max(a1, b1);
    const pad = (hi - lo) * 0.08 || 1;
    const [x0, x1] = niceDomain(lo - pad, hi + pad);
    this.setCategoryDomain(this.opts.categories, x0, x1);
  }

  protected marks(b: MarkBuilder) {
    const [sn, en] = this.names();
    const [sc, ec] = [this.color(0), this.color(1)];
    const { categories, start, end } = this.opts;
    categories.forEach((name, i) => {
      const c = this.cat(i);
      const [ax, ay] = this.P(c, start[i]);
      const [bx, by] = this.P(c, end[i]);
      b.seg(ax, ay, bx, by, this.theme.axis, 3);
      if (!this.hidden.has(sn)) b.point(ax, ay, sc, 12);
      if (!this.hidden.has(en)) b.point(bx, by, ec, 12);
      const d = end[i] - start[i];
      this.bandRegion(b, i, {
        series: name,
        index: i,
        title: name,
        values: { [sn]: start[i], [en]: end[i] },
        rows: [
          { label: sn, value: this.fmtV(start[i]), color: sc },
          { label: en, value: this.fmtV(end[i]), color: ec },
          { label: 'Change', value: (d >= 0 ? '+' : '') + formatNumber(d) },
        ],
      });
    });
  }
}

// ---- Range / floating bar --------------------------------------------------------------

export class RangeBarChart extends CategoryChart<RangeBarOptions> {
  readonly type = 'rangeBar' as const;
  protected horizontalDefault = true;

  protected computeDomain() {
    const [a] = extent(this.opts.low);
    const [, b] = extent(this.opts.high);
    const pad = (b - a) * 0.05 || 1;
    const [x0, x1] = niceDomain(a - pad, b + pad);
    this.setCategoryDomain(this.opts.categories, x0, x1);
  }

  protected marks(b: MarkBuilder) {
    const color = this.color(0);
    const { categories, low, high } = this.opts;
    const name = this.opts.name ?? 'Range';
    categories.forEach((label, i) => {
      const c = this.cat(i);
      const [x0, y0] = this.P(c - 0.32, low[i]);
      const [x1, y1] = this.P(c + 0.32, high[i]);
      b.rect(x0, y0, x1, y1, color);
      this.bandRegion(b, i, {
        series: name,
        index: i,
        title: label,
        values: { Low: low[i], High: high[i] },
        rows: [
          { label: 'Low', value: this.fmtV(low[i]) },
          { label: 'High', value: this.fmtV(high[i]) },
          { label: 'Span', value: formatNumber(high[i] - low[i]) },
        ],
      }, { k: 'rect', x0, y0, x1, y1 });
    });
  }
}

// ---- Waterfall ---------------------------------------------------------------------------

export class WaterfallChart extends CategoryChart<WaterfallOptions> {
  readonly type = 'waterfall' as const;
  private steps: { from: number; to: number; total: boolean }[] = [];

  protected legendItems(): LegendItem[] {
    return [
      { name: 'Increase', color: this.theme.series[2] },
      { name: 'Decrease', color: this.theme.series[7] },
      { name: 'Total', color: this.theme.series[0] },
    ];
  }

  protected computeDomain() {
    const totals = new Set(this.opts.totals ?? []);
    let run = 0;
    let lo = 0, hi = 0;
    this.steps = this.opts.categories.map((_, i) => {
      const v = this.opts.values[i] ?? 0;
      const s = totals.has(i) ? { from: 0, to: v, total: true } : { from: run, to: run + v, total: false };
      run = s.to;
      lo = Math.min(lo, s.from, s.to);
      hi = Math.max(hi, s.from, s.to);
      return s;
    });
    const [a, b] = niceDomain(lo, hi);
    this.setCategoryDomain(this.opts.categories, a, b);
  }

  protected marks(b: MarkBuilder) {
    const up = this.theme.series[2];
    const down = this.theme.series[7];
    const tot = this.theme.series[0];
    this.steps.forEach((s, i) => {
      const c = this.cat(i);
      const color = s.total ? tot : s.to >= s.from ? up : down;
      const [x0, y0] = this.P(c - 0.35, s.from);
      const [x1, y1] = this.P(c + 0.35, s.to);
      b.rect(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), color);
      // Dashed connector to the next bar's start.
      if (i < this.steps.length - 1) {
        const [cx0, cy0] = this.P(c + 0.35, s.to);
        const [cx1, cy1] = this.P(this.cat(i + 1) - 0.35, s.to);
        b.line([cx0, cy0, cx1, cy1], this.theme.textMuted, 1, 1, false, true);
      }
      const d = s.to - s.from;
      const [lx, ly] = this.P(c, Math.max(s.from, s.to));
      b.text(s.total ? formatNumber(s.to) : (d >= 0 ? '+' : '') + formatNumber(d), lx, ly, this.horizontal ? -0.15 : 0.5, this.horizontal ? 0.5 : 1.3);
      this.bandRegion(b, i, {
        series: this.opts.categories[i],
        index: i,
        title: this.opts.categories[i],
        values: s.total ? { Total: s.to } : { Change: d, Running: s.to },
        rows: s.total
          ? [{ label: 'Total', value: this.fmtV(s.to), color }]
          : [
              { label: 'Change', value: (d >= 0 ? '+' : '') + this.fmtV(d), color },
              { label: 'Running total', value: this.fmtV(s.to) },
            ],
      }, { k: 'rect', x0, y0, x1, y1 });
    });
  }
}

// ---- Marimekko ---------------------------------------------------------------------------

export class MarimekkoChart extends MarkChart<MarimekkoOptions> {
  readonly type = 'marimekko' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected showXTicks = false;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected computeDomain() {
    this.full = { x0: 0, x1: 100, y0: 0, y1: 100 };
  }

  formatY(v: number) {
    return `${formatNumber(v)}%`;
  }

  protected marks(b: MarkBuilder) {
    const { categories, series } = this.opts;
    const vis = series.map((s, si) => ({ s, color: this.color(si, s.color) })).filter(({ s }) => !this.hidden.has(s.name));
    const colTotals = categories.map((_, i) => vis.reduce((t, { s }) => t + Math.max(0, s.data[i] ?? 0), 0));
    const grand = colTotals.reduce((a, v) => a + v, 0) || 1;
    let x = 0;
    const sep: number[][] = [];
    categories.forEach((name, i) => {
      const w = (colTotals[i] / grand) * 100;
      let y = 0;
      vis.forEach(({ s, color }) => {
        const v = Math.max(0, s.data[i] ?? 0);
        const h = colTotals[i] ? (v / colTotals[i]) * 100 : 0;
        b.box(x, y, x + w, y + h, color);
        const share = h;
        if (w > 6 && h > 7) b.text(`${Math.round(share)}%`, x + w / 2, y + h / 2, 0.5, 0.5, false, { color: inkOn(color) });
        b.region({
          k: 'rect',
          x0: x,
          y0: y,
          x1: x + w,
          y1: y + h,
          hit: {
            series: s.name,
            index: i,
            title: `${name} · ${s.name}`,
            values: { Value: v },
            rows: [
              { label: 'Value', value: formatNumber(v), color },
              { label: `Share of ${name}`, value: `${share.toFixed(1)}%` },
              { label: 'Share of total', value: `${((v / grand) * 100).toFixed(1)}%` },
            ],
          },
        });
        y += h;
        sep.push([x, y, x + w, y]);
      });
      b.text(name, x + w / 2, 0, 0.5, -0.4, true, { maxWidth: Math.max(30, w * 3) });
      x += w;
      sep.push([x, 0, x, 100]);
    });
    // Surface-colored separators keep adjacent fills distinct.
    for (const [a, c, d, e] of sep) b.seg(a, c, d, e, this.theme.surface, 2);
  }
}

// ---- Bullet (pixel layout, one scale per row) ----------------------------------------------

export class BulletChart extends MarkChart<BulletOptions> {
  readonly type = 'bullet' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 4;

  protected marks(b: MarkBuilder) {
    const items = this.opts.items;
    const W = this.plot.width;
    const H = this.plot.height;
    const labelW = Math.min(150, W * 0.28);
    const rowH = Math.min(64, H / Math.max(1, items.length));
    const x0 = labelW + 10;
    const x1 = W - 16;
    const greys = [this.theme.grid, this.theme.axis, this.theme.textMuted];
    items.forEach((it, i) => {
      const top = i * rowH + 6;
      const bandH = Math.min(26, rowH - 26);
      const max = Math.max(...it.ranges, it.value, it.target ?? 0);
      const [, hi] = niceDomain(0, max, 4);
      const X = (v: number) => x0 + (v / hi) * (x1 - x0);
      let prev = 0;
      it.ranges.forEach((r, k) => {
        b.box(X(prev), top, X(r), top + bandH, greys[Math.min(k, greys.length - 1)], 0.55 + k * 0.15);
        prev = r;
      });
      const mh = bandH * 0.36;
      b.rect(X(0), top + (bandH - mh) / 2, X(it.value), top + (bandH + mh) / 2, this.color(0));
      if (it.target !== undefined) b.seg(X(it.target), top + 2, X(it.target), top + bandH - 2, this.theme.textPrimary, 3);
      b.text(it.label, labelW, top + bandH / 2, 1, 0.5, true, { maxWidth: labelW });
      for (const t of niceTicks(0, hi, 4)) b.text(formatNumber(t), X(t), top + bandH + 4, 0.5, 0);
      b.region({
        k: 'rect',
        x0: 0,
        y0: top - 4,
        x1: W,
        y1: top + bandH + 4,
        hl: { k: 'rect', x0: X(0), y0: top, x1: X(hi), y1: top + bandH },
        hit: {
          series: it.label,
          index: i,
          values: { Value: it.value, ...(it.target !== undefined ? { Target: it.target } : {}) },
          rows: [
            { label: 'Value', value: formatNumber(it.value), color: this.color(0) },
            ...(it.target !== undefined ? [{ label: 'Target', value: formatNumber(it.target) }] : []),
            ...it.ranges.map((r, k) => ({ label: `Band ${k + 1}`, value: `≤ ${formatNumber(r)}` })),
          ],
        },
      });
    });
  }
}

// ---- Pictograph (unit chart) -----------------------------------------------------------

/** Clip a polygon to x <= xmax (Sutherland–Hodgman, one edge). */
function clipX(pts: number[], xmax: number): number[] {
  const out: number[] = [];
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1];
    const j = (i + 1) % n;
    const bx = pts[j * 2], by = pts[j * 2 + 1];
    const ain = ax <= xmax;
    const bin = bx <= xmax;
    if (ain) out.push(ax, ay);
    if (ain !== bin) {
      const t = (xmax - ax) / (bx - ax);
      out.push(xmax, ay + t * (by - ay));
    }
  }
  return out;
}

function circlePts(cx: number, cy: number, r: number, n = 20): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r);
  return out;
}

function iconShapes(kind: string, x: number, y: number, s: number): number[][] {
  if (kind === 'circle') return [circlePts(x + s / 2, y + s / 2, s * 0.42)];
  if (kind === 'square') return [[x + s * 0.1, y + s * 0.1, x + s * 0.9, y + s * 0.1, x + s * 0.9, y + s * 0.9, x + s * 0.1, y + s * 0.9]];
  // Person: head + rounded-shoulder body.
  const cx = x + s / 2;
  const body: number[] = [];
  const top = y + s * 0.42;
  const r = s * 0.28;
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    body.push(cx + Math.cos(a) * r, top + r + Math.sin(a) * r);
  }
  body.push(cx + r, y + s * 0.98, cx - r, y + s * 0.98);
  return [circlePts(cx, y + s * 0.2, s * 0.17, 16), body];
}

export class PictographChart extends MarkChart<PictographOptions> {
  readonly type = 'pictograph' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 4;

  protected marks(b: MarkBuilder) {
    const data = this.opts.data;
    const max = Math.max(...data.map((d) => d.value), 1e-9);
    const unit = this.opts.unit ?? niceUnit(max / 20);
    const W = this.plot.width;
    const H = this.plot.height;
    const labelW = Math.min(130, W * 0.25);
    const valueW = 56;
    const maxIcons = Math.ceil(max / unit);
    const s = Math.max(6, Math.min(28, (W - labelW - valueW - 16) / maxIcons, H / Math.max(1, data.length) - 8));
    const rowH = Math.min(s + 14, H / Math.max(1, data.length));
    const x0 = labelW + 10;
    const top = Math.max(0, (H - 16 - rowH * data.length) / 2);
    const kind = this.opts.icon ?? 'person';
    data.forEach((d, i) => {
      const color = this.color(0, d.color);
      const y = top + i * rowH + (rowH - s) / 2;
      const count = d.value / unit;
      for (let k = 0; k < Math.ceil(count - 1e-9); k++) {
        const x = x0 + k * s;
        const frac = Math.min(1, count - k);
        for (const shape of iconShapes(kind, x, y, s)) {
          b.poly(shape, this.theme.grid);
          b.poly(frac < 1 ? clipX(shape, x + s * frac) : shape, color);
        }
      }
      b.text(d.label, labelW, y + s / 2, 1, 0.5, true, { maxWidth: labelW });
      b.text(formatNumber(d.value), x0 + Math.ceil(count) * s + 6, y + s / 2, 0, 0.5);
      b.region({
        k: 'rect',
        x0: 0,
        y0: y - 2,
        x1: W,
        y1: y + s + 2,
        hl: { k: 'rect', x0: x0 - 2, y0: y - 2, x1: x0 + Math.ceil(count) * s + 2, y1: y + s + 2 },
        hit: { series: d.label, index: i, values: { Value: d.value, Icons: `${count.toFixed(1)} × ${formatNumber(unit)}` } },
      });
    });
    b.text(`Each icon = ${formatNumber(unit)}`, W, H - 2, 1, 1);
  }
}

function niceUnit(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

// ---- Radial bar -----------------------------------------------------------------------------

const SWEEP = Math.PI * 1.5;

export class RadialBarChart extends MarkChart<RadialBarOptions> {
  readonly type = 'radialBar' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected legendItems(): LegendItem[] {
    return this.opts.data.map((d, i) => ({ name: d.label, color: this.color(i, d.color) }));
  }

  protected marks(b: MarkBuilder) {
    const data = this.opts.data.map((d, i) => ({ d, i, color: this.color(i, d.color) })).filter(({ d }) => !this.hidden.has(d.label));
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 8;
    const r0 = R * 0.3;
    const max = this.opts.max ?? niceDomain(0, Math.max(...data.map(({ d }) => d.value), 1e-9))[1];
    const step = (R - r0) / Math.max(1, data.length);
    const thick = step * 0.72;
    data.forEach(({ d, i, color }, k) => {
      const outer = R - k * step;
      const inner = outer - thick;
      const a = (Math.max(0, d.value) / max) * SWEEP;
      b.sector(cx, cy, inner, outer, 0, SWEEP, this.theme.grid);
      b.sector(cx, cy, inner, outer, 0, Math.max(0.001, a), color);
      // Rounded cap at the data end.
      const [ex, ey] = polar(cx, cy, (inner + outer) / 2, a);
      b.point(ex, ey, color, thick, 'disc');
      b.text(`${d.label}  ${formatNumber(d.value)}`, cx - 6, cy - (inner + outer) / 2, 1, 0.5, false, { maxWidth: cx - 10 });
      b.region({ k: 'sector', cx, cy, r0: inner, r1: outer, a0: 0, a1: SWEEP, hit: { series: d.label, index: i, color, values: { Value: formatNumber(d.value), 'Of max': `${((d.value / max) * 100).toFixed(0)}%` } } });
    });
  }
}
