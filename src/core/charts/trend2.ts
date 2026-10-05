import type { Hit, LegendItem } from '../base';
import { MarkChart, type MarkBuilder, type RegionShape } from '../markchart';
import { extent, formatNumber, nearestIndex, niceDomain } from '../scale';
import type { Numbers } from '../types';
import type { AreaBumpOptions, BaselineOptions, DifferenceOptions, NavigatorOptions, SmallMultiplesOptions, WindBarbOptions } from '../types2';

const xAt = (x: Numbers | undefined, i: number) => (x ? x[i] : i);

/** Points of `ys` with the crossings of `ref` inserted, so fills and lines can switch color exactly there. */
function withCrossings(x: Numbers | undefined, ys: Numbers, ref: (i: number) => number): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < ys.length; i++) {
    if (i > 0) {
      const d0 = ys[i - 1] - ref(i - 1);
      const d1 = ys[i] - ref(i);
      if ((d0 < 0 && d1 > 0) || (d0 > 0 && d1 < 0)) {
        const t = d0 / (d0 - d1);
        const xx = xAt(x, i - 1) + (xAt(x, i) - xAt(x, i - 1)) * t;
        const yy = ys[i - 1] + (ys[i] - ys[i - 1]) * t;
        const rr = ref(i - 1) + (ref(i) - ref(i - 1)) * t;
        out.push({ x: xx, y: yy, r: rr });
      }
    }
    out.push({ x: xAt(x, i), y: ys[i], r: ref(i) });
  }
  return out;
}

/** Split points into runs on one side of their reference (shared point at each crossing). */
function runs(pts: { x: number; y: number; r: number }[]) {
  const out: { above: boolean; pts: typeof pts }[] = [];
  for (const p of pts) {
    const side = p.y >= p.r;
    const last = out[out.length - 1];
    if (p.y === p.r && last) {
      last.pts.push(p);
      continue;
    }
    if (!last || last.above !== side) {
      const start = last ? [last.pts[last.pts.length - 1]] : [];
      out.push({ above: side, pts: [...start, p] });
    } else last.pts.push(p);
  }
  return out;
}

// ---- Baseline -----------------------------------------------------------------------------------

/** A series measured against a baseline: above in one color, below in another (e.g. price vs open). */
export class BaselineChart extends MarkChart<BaselineOptions> {
  readonly type = 'baseline' as const;
  private hover: { px: number; py: number; color: string } | null = null;

  private base() {
    return this.opts.baseline ?? this.opts.y[0] ?? 0;
  }

  protected legendItems(): LegendItem[] {
    return [
      { name: 'Above', color: this.theme.series[2] },
      { name: 'Below', color: this.theme.series[7] },
    ];
  }

  protected computeDomain() {
    const { x, y } = this.opts;
    const [x0, x1] = x ? extent(x) : [0, y.length - 1];
    const [lo, hi] = extent(y);
    const base = this.base();
    const [a, c] = niceDomain(Math.min(lo, base), Math.max(hi, base));
    this.full = { x0, x1: x1 === x0 ? x0 + 1 : x1, y0: a, y1: c };
  }

  protected marks(b: MarkBuilder) {
    const base = this.base();
    const up = this.theme.series[2];
    const down = this.theme.series[7];
    const pts = withCrossings(this.opts.x, this.opts.y, () => base);
    for (const run of runs(pts)) {
      if (this.hidden.has(run.above ? 'Above' : 'Below')) continue;
      const color = run.above ? up : down;
      const top = run.pts.flatMap((p) => [p.x, p.y]);
      const bot = run.pts.flatMap((p) => [p.x, base]);
      b.band(top, bot, color, 0.18);
      b.line(top, color, 2);
    }
    b.line([this.full.x0, base, this.full.x1, base], this.theme.textMuted, 1, 1, false, true);
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const { x, y } = this.opts;
    const dx = this.toData(px, py)[0];
    const i = x ? nearestIndex(x, dx) : Math.max(0, Math.min(y.length - 1, Math.round(dx)));
    const base = this.base();
    const color = y[i] >= base ? this.theme.series[2] : this.theme.series[7];
    const [hx, hy] = this.toPx(xAt(x, i), y[i]);
    this.hover = { px: hx, py: hy, color };
    const d = y[i] - base;
    return {
      series: this.opts.name ?? 'Value',
      index: i,
      title: this.formatXTip(xAt(x, i)),
      values: { Value: y[i] },
      rows: [
        { label: this.opts.name ?? 'Value', value: this.formatY(y[i]), color },
        { label: 'vs baseline', value: `${d >= 0 ? '+' : ''}${this.formatY(d)}${base ? ` (${((d / Math.abs(base)) * 100).toFixed(1)}%)` : ''}` },
      ],
    };
  }

  protected highlight(hit: Hit | null) {
    this.showCrosshair(hit && this.hover ? this.hover.px : null);
    if (hit && this.hover) this.showDot(this.hover.px, this.hover.py, this.hover.color);
    else this.showDot(null);
  }
}

// ---- Difference -----------------------------------------------------------------------------------

/** Two series with the gap between them shaded in the color of whichever is higher. */
export class DifferenceChart extends MarkChart<DifferenceOptions> {
  readonly type = 'difference' as const;
  private hover: { px: number; py: number; color: string } | null = null;

  protected legendItems(): LegendItem[] {
    return [
      { name: this.opts.a.name, color: this.color(0) },
      { name: this.opts.b.name, color: this.color(1) },
    ];
  }

  protected computeDomain() {
    const { x, a, b } = this.opts;
    const n = Math.min(a.y.length, b.y.length);
    const [x0, x1] = x ? extent(x) : [0, n - 1];
    const [l1, h1] = extent(a.y);
    const [l2, h2] = extent(b.y);
    const [lo, hi] = niceDomain(Math.min(l1, l2), Math.max(h1, h2));
    this.full = { x0, x1: x1 === x0 ? x0 + 1 : x1, y0: lo, y1: hi };
  }

  protected marks(b: MarkBuilder) {
    const { x, a, b: bb } = this.opts;
    const ca = this.color(0);
    const cb = this.color(1);
    const pts = withCrossings(x, a.y, (i) => bb.y[i]);
    for (const run of runs(pts)) {
      const top = run.pts.flatMap((p) => [p.x, Math.max(p.y, p.r)]);
      const bot = run.pts.flatMap((p) => [p.x, Math.min(p.y, p.r)]);
      b.band(top, bot, run.above ? ca : cb, 0.22);
    }
    const line = (ys: Numbers) => {
      const out: number[] = [];
      for (let i = 0; i < ys.length; i++) out.push(xAt(x, i), ys[i]);
      return out;
    };
    if (!this.hidden.has(bb.name)) b.line(line(bb.y), cb, 2);
    if (!this.hidden.has(a.name)) b.line(line(a.y), ca, 2);
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const { x, a, b } = this.opts;
    const dx = this.toData(px, py)[0];
    const n = Math.min(a.y.length, b.y.length);
    const i = x ? nearestIndex(x, dx) : Math.max(0, Math.min(n - 1, Math.round(dx)));
    const d = a.y[i] - b.y[i];
    const [hx, hy] = this.toPx(xAt(x, i), a.y[i]);
    this.hover = { px: hx, py: hy, color: this.color(0) };
    return {
      series: 'x',
      index: i,
      title: this.formatXTip(xAt(x, i)),
      values: { [a.name]: a.y[i], [b.name]: b.y[i] },
      rows: [
        { label: a.name, value: this.formatY(a.y[i]), color: this.color(0) },
        { label: b.name, value: this.formatY(b.y[i]), color: this.color(1) },
        { label: 'Difference', value: `${d >= 0 ? '+' : ''}${this.formatY(d)}` },
      ],
    };
  }

  protected highlight(hit: Hit | null) {
    this.showCrosshair(hit && this.hover ? this.hover.px : null);
    if (hit && this.hover) this.showDot(this.hover.px, this.hover.py, this.hover.color);
    else this.showDot(null);
  }
}

// ---- Area bump --------------------------------------------------------------------------------------

/** Rank over time like a bump chart, with band thickness showing each value. */
export class AreaBumpChart extends MarkChart<AreaBumpOptions> {
  readonly type = 'areaBump' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected showYTicks = false;
  private bands = new Map<string, { top: number[]; bot: number[]; poly: number[] }>();

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected computeDomain() {
    const n = this.opts.categories.length;
    const vis = this.opts.series.filter((s) => !this.hidden.has(s.name));
    let maxTotal = 1e-9;
    for (let i = 0; i < n; i++) maxTotal = Math.max(maxTotal, vis.reduce((t, s) => t + (s.data[i] ?? 0), 0));
    const gap = (maxTotal * 0.25) / Math.max(1, vis.length);
    this.bands.clear();
    const tops = new Map(vis.map((s) => [s.name, [] as number[]]));
    const bots = new Map(vis.map((s) => [s.name, [] as number[]]));
    for (let i = 0; i < n; i++) {
      const order = [...vis].sort((a, c) => (c.data[i] ?? 0) - (a.data[i] ?? 0));
      const total = order.reduce((t, s) => t + (s.data[i] ?? 0), 0) + gap * (order.length - 1);
      let cursor = total / 2;
      for (const s of order) {
        const v = s.data[i] ?? 0;
        tops.get(s.name)!.push(cursor);
        bots.get(s.name)!.push(cursor - v);
        cursor -= v + gap;
      }
    }
    // Smooth between time points with an ease-in-out curve (flat at each point).
    const smooth = (ys: number[]) => {
      const out: number[] = [];
      for (let i = 0; i < ys.length; i++) {
        out.push(i, ys[i]);
        if (i === ys.length - 1) break;
        for (let k = 1; k < 16; k++) {
          const t = k / 16;
          const e = t * t * (3 - 2 * t);
          out.push(i + t, ys[i] + (ys[i + 1] - ys[i]) * e);
        }
      }
      return out;
    };
    for (const s of vis) {
      const top = smooth(tops.get(s.name)!);
      const bot = smooth(bots.get(s.name)!);
      const poly = [...top];
      for (let k = bot.length - 2; k >= 0; k -= 2) poly.push(bot[k], bot[k + 1]);
      this.bands.set(s.name, { top, bot, poly });
    }
    const half = (maxTotal + gap * Math.max(0, vis.length - 1)) / 2;
    this.xCategories = this.opts.categories;
    this.full = { x0: -0.15, x1: n - 1 + Math.max(0.8, (n - 1) * 0.2), y0: -half * 1.05, y1: half * 1.05 };
  }

  protected marks(b: MarkBuilder) {
    const n = this.opts.categories.length;
    this.opts.series.forEach((s, k) => {
      const band = this.bands.get(s.name);
      if (!band) return;
      const color = this.color(k, s.color);
      b.band(band.top, band.bot, color, 0.88);
      const last = band.top.length - 2;
      b.text(s.name, n - 1 + 0.08, (band.top[last + 1] + band.bot[last + 1]) / 2, 0, 0.5, false, { maxWidth: 110 });
    });
  }

  private hit: RegionShape | null = null;

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const [dx, dy] = this.toData(px, py);
    const n = this.opts.categories.length;
    const i = Math.max(0, Math.min(n - 1, Math.round(dx)));
    const k = Math.round(Math.max(0, Math.min(n - 1, dx)) * 16);
    for (const [name, band] of this.bands) {
      const top = band.top[k * 2 + 1];
      const bot = band.bot[k * 2 + 1];
      if (dy > top || dy < bot) continue;
      const s = this.opts.series.find((x) => x.name === name)!;
      const rank = [...this.opts.series].filter((x) => !this.hidden.has(x.name)).sort((a, c) => (c.data[i] ?? 0) - (a.data[i] ?? 0)).indexOf(s) + 1;
      const color = this.color(this.opts.series.indexOf(s), s.color);
      this.hit = { k: 'poly', pts: band.poly };
      return {
        series: name,
        index: i,
        color,
        title: this.opts.categories[i],
        values: { Value: s.data[i], Rank: rank },
        rows: [
          { label: name, value: this.formatY(s.data[i]), color },
          { label: 'Rank', value: `#${rank}` },
        ],
      };
    }
    return null;
  }

  protected highlight(hit: Hit | null) {
    if (!hit || !this.hit) return this.clearHighlight();
    this.drawOutline(this.hit);
  }
}

// ---- Small multiples --------------------------------------------------------------------------------

interface Panel {
  x0: number;
  y0: number;
  w: number;
  h: number;
  s: SmallMultiplesOptions['series'][number];
  X: (v: number) => number;
  Y: (v: number) => number;
}

/** One small panel per series on a shared scale, so shapes compare at a glance. */
export class SmallMultiplesChart extends MarkChart<SmallMultiplesOptions> {
  readonly type = 'smallMultiples' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 4;
  private panels: Panel[] = [];
  private hover: { px: number; py: number } | null = null;

  protected marks(b: MarkBuilder) {
    const series = this.opts.series;
    const W = this.plot.width;
    const H = this.plot.height;
    const cols = Math.max(1, Math.min(series.length, this.opts.columns ?? (Math.floor(W / 200) || 1)));
    const rows = Math.ceil(series.length / cols);
    const gx = 16;
    const gy = 10;
    const pw = (W - gx * (cols - 1)) / cols;
    const ph = (H - gy * (rows - 1)) / rows;
    const shared = this.opts.sharedScale ?? true;
    let glo = Infinity;
    let ghi = -Infinity;
    for (const s of series) {
      const [a, c] = extent(s.y);
      glo = Math.min(glo, a);
      ghi = Math.max(ghi, c);
    }
    const mark = this.opts.mark ?? 'area';
    const color = this.color(0);
    this.panels = [];
    series.forEach((s, k) => {
      const x0 = (k % cols) * (pw + gx);
      const y0 = Math.floor(k / cols) * (ph + gy);
      const titleH = 16;
      const top = y0 + titleH;
      const bottom = y0 + ph - 2;
      const [l, h] = shared ? [glo, ghi] : extent(s.y);
      const lo = Math.min(0, l);
      const hi = h > lo ? h : lo + 1;
      const [xa, xb] = s.x ? extent(s.x) : [0, s.y.length - 1];
      const X = (v: number) => x0 + ((v - xa) / (xb - xa || 1)) * pw;
      const Y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
      b.text(s.name, x0, y0, 0, 0, true, { maxWidth: pw * 0.65 });
      const last = s.y[s.y.length - 1];
      if (last !== undefined) b.text(formatNumber(last), x0 + pw, y0, 1, 0);
      b.seg(x0, Y(lo), x0 + pw, Y(lo), this.theme.axis, 1);
      if (mark === 'bar') {
        const bw = Math.max(1, pw / s.y.length - 1);
        for (let i = 0; i < s.y.length; i++) b.rect(X(xAt(s.x, i)) - bw / 2, Y(s.y[i]), X(xAt(s.x, i)) + bw / 2, Y(lo), color);
      } else {
        const pts: number[] = [];
        const base: number[] = [];
        for (let i = 0; i < s.y.length; i++) {
          pts.push(X(xAt(s.x, i)), Y(s.y[i]));
          base.push(X(xAt(s.x, i)), Y(lo));
        }
        if (mark === 'area') b.band(pts, base, color, 0.2);
        b.line(pts, color, 1.5);
      }
      this.panels.push({ x0, y0: top, w: pw, h: bottom - top, s, X, Y });
    });
  }

  protected hitTest(px: number, py: number): Hit | null {
    const x = px - this.plot.left;
    const y = py - this.plot.top;
    const p = this.panels.find((q) => x >= q.x0 && x <= q.x0 + q.w && y >= q.y0 - 16 && y <= q.y0 + q.h);
    if (!p) return null;
    const { s } = p;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < s.y.length; i++) {
      const d = Math.abs(p.X(xAt(s.x, i)) - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    this.hover = { px: this.plot.left + p.X(xAt(s.x, best)), py: this.plot.top + p.Y(s.y[best]) };
    return { series: s.name, index: best, title: s.name, values: { y: s.y[best] }, rows: [{ label: this.formatXTip(xAt(s.x, best)), value: this.formatY(s.y[best]), color: this.color(0) }] };
  }

  protected highlight(hit: Hit | null) {
    if (hit && this.hover) this.showDot(this.hover.px, this.hover.py, this.color(0));
    else this.showDot(null);
  }
}

// ---- Navigator --------------------------------------------------------------------------------------

/**
 * An overview strip with a brush. Drag or resize the brush and every chart
 * with the same `sync` key follows; zooming those charts moves the brush.
 */
export class NavigatorChart extends MarkChart<NavigatorOptions> {
  readonly type = 'navigator' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected showYTicks = false;
  private brush: HTMLDivElement;
  private range: [number, number] | null = null;

  constructor(container: HTMLElement, options: NavigatorOptions) {
    super(container, options);
    this.brush = document.createElement('div');
    this.brush.className = 'tc-brush';
    Object.assign(this.brush.style, {
      position: 'absolute',
      boxSizing: 'border-box',
      border: '1.5px solid var(--tc-text2)',
      borderRadius: '4px',
      background: 'rgba(127,127,127,0.14)',
    });
    this.overlay.appendChild(this.brush);
    this.stage.addEventListener('pointerdown', this.onBrushDown);
    this.stage.addEventListener('pointermove', this.onHoverCursor);
  }

  protected computeDomain() {
    const { x, y } = this.opts;
    const [x0, x1] = x ? extent(x) : [0, y.length - 1];
    // The data's own range: an overview is about shape, not magnitude.
    const [lo, hi] = extent(y);
    const pad = (hi - lo || 1) * 0.08;
    this.full = { x0, x1: x1 === x0 ? x0 + 1 : x1, y0: lo - pad, y1: hi + pad };
  }

  protected marks(b: MarkBuilder) {
    const { x, y } = this.opts;
    const pts: number[] = [];
    const base: number[] = [];
    const step = Math.max(1, Math.floor(y.length / 4000));
    for (let i = 0; i < y.length; i += step) {
      pts.push(xAt(x, i), y[i]);
      base.push(xAt(x, i), this.full.y0);
    }
    const color = this.color(0);
    b.band(pts, base, color, 0.16);
    b.line(pts, color, 1.5);
  }

  protected hitTest(): Hit | null {
    return null;
  }

  protected onViewChange() {
    super.onViewChange();
    this.placeBrush();
  }

  protected receiveView(x0: number, x1: number, reset: boolean) {
    this.range = reset ? null : [Math.max(this.full.x0, x0), Math.min(this.full.x1, x1)];
    this.placeBrush();
  }

  private current(): [number, number] {
    return this.range ?? [this.full.x0, this.full.x1];
  }

  private placeBrush() {
    if (!this.brush) return;
    const [a, c] = this.current();
    const left = this.toPx(a, 0)[0];
    const right = this.toPx(c, 0)[0];
    Object.assign(this.brush.style, {
      left: `${left}px`,
      width: `${Math.max(6, right - left)}px`,
      top: `${this.plot.top}px`,
      height: `${this.plot.height}px`,
    });
  }

  private setRange(a: number, c: number) {
    const f = this.full;
    const span = Math.min(c - a, f.x1 - f.x0);
    if (a < f.x0) [a, c] = [f.x0, f.x0 + span];
    if (c > f.x1) [a, c] = [f.x1 - span, f.x1];
    const isFull = a <= f.x0 && c >= f.x1;
    this.range = isFull ? null : [a, c];
    this.placeBrush();
    this.broadcastRange(a, c, isFull);
  }

  private grip(px: number): 'left' | 'right' | 'move' | 'outside' {
    const [a, c] = this.current();
    const l = this.toPx(a, 0)[0];
    const r = this.toPx(c, 0)[0];
    if (Math.abs(px - l) <= 7) return 'left';
    if (Math.abs(px - r) <= 7) return 'right';
    return px > l && px < r ? 'move' : 'outside';
  }

  private onHoverCursor = (e: PointerEvent) => {
    if (e.buttons) return;
    const px = e.clientX - this.stage.getBoundingClientRect().left;
    const g = this.grip(px);
    this.stage.style.cursor = g === 'left' || g === 'right' ? 'ew-resize' : g === 'move' ? 'grab' : 'pointer';
  };

  private onBrushDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const r = this.stage.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (!this.inPlot(px, e.clientY - r.top)) return;
    let mode = this.grip(px);
    const minSpan = (this.full.x1 - this.full.x0) / 200;
    if (mode === 'outside') {
      // Jump: center the brush where clicked, then drag it from there.
      const [a, c] = this.current();
      const half = (c - a) / 2;
      const x = this.toData(px, 0)[0];
      this.setRange(x - half, x + half);
      mode = 'move';
    }
    const start = this.toData(px, 0)[0];
    const [a0, c0] = this.current();
    this.stage.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const x = this.toData(ev.clientX - r.left, 0)[0];
      const d = x - start;
      if (mode === 'move') this.setRange(a0 + d, c0 + d);
      else if (mode === 'left') this.setRange(Math.min(a0 + d, c0 - minSpan), c0);
      else this.setRange(a0, Math.max(c0 + d, a0 + minSpan));
    };
    const up = () => {
      this.stage.removeEventListener('pointermove', move);
      this.stage.removeEventListener('pointerup', up);
      this.stage.removeEventListener('pointercancel', up);
    };
    this.stage.addEventListener('pointermove', move);
    this.stage.addEventListener('pointerup', up);
    this.stage.addEventListener('pointercancel', up);
  };
}

// ---- Wind barbs ----------------------------------------------------------------------------------------

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Wind speed over time with meteorological barbs showing direction and strength. */
export class WindBarbChart extends MarkChart<WindBarbOptions> {
  readonly type = 'windBarb' as const;
  protected relayout = true;
  protected defaultZoom: 'x' | 'xy' | false = false;

  protected computeDomain() {
    const { x, speed } = this.opts;
    const [x0, x1] = x ? extent(x) : [0, speed.length - 1];
    const pad = (x1 - x0 || 1) * 0.03;
    const [, hi] = niceDomain(0, extent(speed)[1] * 1.15);
    this.full = { x0: x0 - pad, x1: x1 + pad, y0: 0, y1: hi };
  }

  protected marks(b: MarkBuilder) {
    const { x, speed, direction } = this.opts;
    const color = this.color(0);
    const ink = this.theme.textPrimary;
    const pts: number[] = [];
    for (let i = 0; i < speed.length; i++) pts.push(xAt(x, i), speed[i]);
    b.softLine(pts, color, 2, 0.5);
    const [upx, upy] = this.unitsPerPx();
    // Barbs need ~34 px each; skip readings in between when crowded.
    const every = Math.max(1, Math.ceil((34 * upx * speed.length) / (this.full.x1 - this.full.x0)));
    for (let i = 0; i < speed.length; i += every) {
      const sx = xAt(x, i);
      const sy = speed[i];
      const P = (px: number, py: number): [number, number] => [sx + px * upx, sy + py * upy];
      const th = (direction[i] * Math.PI) / 180;
      const u = [Math.sin(th), Math.cos(th)]; // toward where the wind comes from, y up
      const w = [Math.cos(th), -Math.sin(th)]; // barbs to the side
      let knots = Math.round(speed[i] / 5) * 5;
      if (knots < 5) {
        b.point(sx, sy, ink, 10, 'ring');
      } else {
        const L = 28;
        const tip = P(u[0] * L, u[1] * L);
        b.line([sx, sy, ...tip], ink, 1.5);
        let pos = L;
        while (knots >= 50) {
          b.poly([...P(u[0] * pos, u[1] * pos), ...P(u[0] * pos + w[0] * 11, u[1] * pos + w[1] * 11), ...P(u[0] * (pos - 6), u[1] * (pos - 6))], ink);
          pos -= 7;
          knots -= 50;
        }
        while (knots >= 10) {
          b.line([...P(u[0] * pos, u[1] * pos), ...P(u[0] * (pos + 3) + w[0] * 11, u[1] * (pos + 3) + w[1] * 11)], ink, 1.5);
          pos -= 5;
          knots -= 10;
        }
        if (knots >= 5) {
          if (pos === L) pos -= 5;
          b.line([...P(u[0] * pos, u[1] * pos), ...P(u[0] * (pos + 1.5) + w[0] * 6, u[1] * (pos + 1.5) + w[1] * 6)], ink, 1.5);
        }
      }
      b.point(sx, sy, color, 6, 'disc');
      const dir = COMPASS[Math.round(((direction[i] % 360) + 360) / 22.5) % 16];
      b.region({
        k: 'circle',
        x: sx,
        y: sy,
        r: 12,
        hit: { series: 'Wind', index: i, color, title: this.formatXTip(sx), values: { Speed: speed[i], Direction: direction[i] }, rows: [{ label: 'Speed', value: `${formatNumber(speed[i])} kn`, color }, { label: 'From', value: `${dir} (${Math.round(direction[i])}°)` }] },
      });
    }
  }
}
