import * as THREE from 'three';
import { CartesianChart } from '../cartesian';
import type { Hit, LabelPool, LegendItem } from '../base';
import { createRects } from '../marks';
import { MarkBuilder, applyProgress, type WorldLabel } from '../markchart';
import { formatNumber, nearestIndex, niceDomain } from '../scale';
import { ema, rollingStd, sma } from '../stats';
import type { CandlestickOptions, Indicator, Numbers } from '../types';
import type { HeikinAshiOptions, OHLCOptions, VolumeProfileOptions } from '../types2';

type RectMesh = ReturnType<typeof createRects>;
type Opts = CandlestickOptions | OHLCOptions | HeikinAshiOptions | VolumeProfileOptions;

interface Series {
  open: Numbers;
  high: Numbers;
  low: Numbers;
  close: Numbers;
}

/** Heikin-Ashi smoothing of OHLC data. */
function heikinAshi(s: Series): Series {
  const n = s.open.length;
  const open = new Float64Array(n);
  const high = new Float64Array(n);
  const low = new Float64Array(n);
  const close = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    close[i] = (s.open[i] + s.high[i] + s.low[i] + s.close[i]) / 4;
    open[i] = i ? (open[i - 1] + close[i - 1]) / 2 : (s.open[0] + s.close[0]) / 2;
    high[i] = Math.max(s.high[i], open[i], close[i]);
    low[i] = Math.min(s.low[i], open[i], close[i]);
  }
  return { open, high, low, close };
}

interface Overlay {
  name: string;
  color: string;
  mid: Float64Array;
  /** Bollinger bands. */
  upper?: Float64Array;
  lower?: Float64Array;
}

/** Palette slots for overlays: skip 2 and 7, which the up/down candles use. */
const OVERLAY_SLOTS = [0, 1, 6, 4, 3, 5];

/**
 * Candlesticks, OHLC bars and Heikin-Ashi. Every style is two or three
 * instanced draws, so 100k+ bars stay smooth.
 */
export class CandlestickChart<O extends Opts = Opts> extends CartesianChart<O> {
  readonly type: Opts['type'];
  private bodies: RectMesh | null = null;
  private wicks: RectMesh | null = null;
  private ticks: RectMesh | null = null;
  private xs: Numbers = [];
  protected d: Series = { open: [], high: [], low: [], close: [] };
  private hover: { px: number; py: number; color: string } | null = null;
  private overlays: Overlay[] = [];
  private overlayGroup: THREE.Group | null = null;
  private overlayLabels: WorldLabel[] = [];

  constructor(container: HTMLElement, options: O) {
    super(container, options);
    this.type = options.type;
  }

  private computeOverlays() {
    const close = this.opts.close;
    this.overlays = (this.opts.indicators ?? []).map((ind: Indicator, k) => {
      const color = ind.color ?? this.color(OVERLAY_SLOTS[k % OVERLAY_SLOTS.length]);
      if (ind.type === 'bollinger') {
        const period = ind.period ?? 20;
        const sd = ind.stdDev ?? 2;
        const mid = sma(close, period);
        const dev = rollingStd(close, period);
        const upper = mid.map((m, i) => m + sd * dev[i]);
        const lower = mid.map((m, i) => m - sd * dev[i]);
        return { name: `Bollinger ${period}, ${sd}σ`, color, mid, upper, lower };
      }
      return { name: `${ind.type.toUpperCase()} ${ind.period}`, color, mid: ind.type === 'ema' ? ema(close, ind.period) : sma(close, ind.period) };
    });
  }

  protected legendItems(): LegendItem[] {
    this.computeOverlays();
    return this.overlays.map((o) => ({ name: o.name, color: o.color }));
  }

  protected xAt(i: number) {
    return this.opts.x ? this.opts.x[i] : i;
  }

  protected computeDomain() {
    const o = this.opts;
    this.d = o.type === 'heikinAshi' ? heikinAshi(o) : { open: o.open, high: o.high, low: o.low, close: o.close };
    const { low, high } = this.d;
    const n = this.d.open.length;
    if (o.x) this.xs = o.x;
    else {
      const a = new Float64Array(n);
      for (let i = 0; i < n; i++) a[i] = i;
      this.xs = a;
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i++) {
      if (low[i] < lo) lo = low[i];
      if (high[i] > hi) hi = high[i];
    }
    this.computeOverlays();
    for (const ov of this.overlays) {
      if (this.hidden.has(ov.name)) continue;
      for (const arr of [ov.mid, ov.upper, ov.lower]) {
        if (!arr) continue;
        for (let i = 0; i < n; i++) {
          if (arr[i] < lo) lo = arr[i];
          if (arr[i] > hi) hi = arr[i];
        }
      }
    }
    const spacing = this.spacing();
    // Room above the highs for event flags.
    if (o.events?.length) hi += (hi - lo) * 0.1;
    const [y0, y1] = niceDomain(lo, hi);
    this.full = { x0: this.xAt(0) - spacing, x1: this.xAt(n - 1) + spacing * this.rightRoom(), y0, y1 };
  }

  /** Extra x room on the right, in candle spacings. */
  protected rightRoom() {
    return 1;
  }

  protected spacing() {
    const n = this.d.open.length;
    if (n < 2) return 1;
    let m = Infinity;
    for (let i = 1; i < Math.min(n, 2000); i++) m = Math.min(m, this.xAt(i) - this.xAt(i - 1));
    return m > 0 && isFinite(m) ? m : 1;
  }

  protected buildMarks() {
    const { open, high, low, close } = this.d;
    const n = open.length;
    const o = this.origin;
    const half = this.spacing() * 0.35;
    const up = new THREE.Color(this.theme.positive);
    const down = new THREE.Color(this.theme.negative);
    const ohlc = this.opts.type === 'ohlc';
    const bRects = new Float32Array(n * 4);
    const wRects = new Float32Array(n * 4);
    const tRects = new Float32Array(n * 8);
    const cols = new Float32Array(n * 3);
    const tcols = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = this.xAt(i) - o.x;
      const a = Math.min(open[i], close[i]) - o.y;
      const b = Math.max(open[i], close[i]) - o.y;
      bRects.set([x - half, a, x + half, b], i * 4);
      wRects.set([x, low[i] - o.y, x, high[i] - o.y], i * 4);
      // OHLC: open tick to the left, close tick to the right.
      tRects.set([x - half, open[i] - o.y, x, open[i] - o.y, x, close[i] - o.y, x + half, close[i] - o.y], i * 8);
      const c = close[i] >= open[i] ? up : down;
      cols.set([c.r, c.g, c.b], i * 3);
      tcols.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    }
    // Grow animation pivots on the middle of the chart.
    const base = (this.full.y0 + this.full.y1) / 2 - o.y;
    this.wicks = createRects({ rects: wRects, colors: cols, base });
    this.scene.add(this.wicks);
    if (ohlc) {
      this.ticks = createRects({ rects: tRects, colors: tcols, base, horizontal: true });
      this.scene.add(this.ticks);
      this.bodies = null;
    } else {
      this.bodies = createRects({ rects: bRects, colors: cols, base });
      this.scene.add(this.bodies);
      this.ticks = null;
    }
    this.buildOverlays();
  }

  private buildOverlays() {
    this.overlayGroup = null;
    this.overlayLabels = [];
    const shown = this.overlays.filter((ov) => !this.hidden.has(ov.name));
    const events = this.opts.events ?? [];
    if (!shown.length && !events.length) return;
    const o = this.origin;
    const b = new MarkBuilder(o.x, o.y, false, this.theme.surface);
    const path = (v: Float64Array) => {
      const pts: number[] = [];
      for (let i = 0; i < v.length; i++) if (v[i] === v[i]) pts.push(this.xAt(i), v[i]);
      return pts;
    };
    for (const ov of shown) {
      if (ov.upper && ov.lower) {
        const top = path(ov.upper);
        const bot = path(ov.lower);
        b.band(top, bot, ov.color, 0.08);
        b.softLine(top, ov.color, 1, 0.6);
        b.softLine(bot, ov.color, 1, 0.6);
      }
      b.line(path(ov.mid), ov.color, 1.5);
    }
    // Event flags: a short pole above the candle's high with a lettered square.
    const pad = (this.full.y1 - this.full.y0) * 0.04;
    for (const ev of events) {
      const i = nearestIndex(this.xs, ev.x);
      if (i < 0) continue;
      const x = this.xAt(i);
      const y = this.d.high[i] + pad;
      b.seg(x, this.d.high[i], x, y, this.theme.textMuted, 1);
      b.point(x, y + pad * 0.4, this.theme.textPrimary, 14, 'square');
      b.text(ev.label.slice(0, 2), x, y + pad * 0.4, 0.5, 0.5, true, { color: this.theme.surface, size: 9, weight: 700 });
    }
    this.overlayGroup = b.build(this.dpr, this.theme.surface);
    this.overlayLabels = b.labels;
    this.scene.add(this.overlayGroup);
  }

  protected addLabels(L: LabelPool) {
    const p = this.plot;
    for (const l of this.overlayLabels) {
      const [x, y] = this.toPx(l.x, l.y);
      if (x < p.left - 2 || x > p.left + p.width + 2 || y < p.top - 2 || y > p.top + p.height + 2) continue;
      L.add(l.text, x, y, l.ax, l.ay, l.strong, l.style);
    }
  }

  protected onProgress() {
    if (this.overlayGroup) applyProgress(this.overlayGroup, this.progress);
    for (const m of [this.wicks, this.bodies]) if (m) m.material.uniforms.uGrow.value = this.progress;
    if (this.ticks) this.ticks.material.uniforms.uGrow.value = 1;
  }

  protected onViewChange() {
    const ppu = this.pxPerUnit();
    for (const m of [this.wicks, this.bodies, this.ticks]) {
      if (!m) continue;
      const u = m.material.uniforms;
      u.uPxPerUnit.value.copy(ppu);
      u.uRadius.value = 0;
      u.uMinW.value = this.dpr * (this.opts.type === 'ohlc' ? 1.5 : 1);
      u.uSurface.value.set(this.theme.surface);
    }
    // Doji candles (open == close) still get a 1px body; OHLC ticks are 1.5px tall.
    if (this.bodies) this.bodies.material.uniforms.uMinH.value = this.dpr;
    if (this.ticks) this.ticks.material.uniforms.uMinH.value = 1.5 * this.dpr;
    this.showCrosshair(null);
    this.showDot(null);
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const [dx] = this.toData(px, py);
    const i = nearestIndex(this.xs, dx);
    if (i < 0) return null;
    const { open, high, low, close } = this.d;
    const [hx, hy] = this.toPx(this.xAt(i), close[i]);
    const color = close[i] >= open[i] ? this.theme.positive : this.theme.negative;
    this.hover = { px: hx, py: hy, color };
    const chg = ((close[i] - open[i]) / open[i]) * 100;
    const ha = this.opts.type === 'heikinAshi' ? 'HA ' : '';
    return {
      series: this.opts.name ?? 'Price',
      index: i,
      title: this.formatXTip(this.xAt(i)),
      values: { Open: open[i], High: high[i], Low: low[i], Close: close[i] },
      rows: [
        { label: `${ha}Open`, value: this.formatY(open[i]) },
        { label: `${ha}High`, value: this.formatY(high[i]) },
        { label: `${ha}Low`, value: this.formatY(low[i]) },
        { label: `${ha}Close`, value: this.formatY(close[i]), color },
        { label: 'Change', value: `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` },
        ...(this.opts.events ?? [])
          .filter((ev) => nearestIndex(this.xs, ev.x) === i)
          .map((ev) => ({ label: `⚑ ${ev.label}`, value: ev.text ?? '' })),
        ...this.overlays
          .filter((ov) => !this.hidden.has(ov.name) && ov.mid[i] === ov.mid[i])
          .map((ov) => ({
            label: ov.name,
            value: ov.upper && ov.lower ? `${this.formatY(ov.lower[i])} – ${this.formatY(ov.upper[i])}` : this.formatY(ov.mid[i]),
            color: ov.color,
          })),
      ],
    };
  }

  protected highlight(hit: Hit | null) {
    if (!hit || !this.hover) {
      this.showCrosshair(null);
      this.showDot(null);
      return;
    }
    this.showCrosshair(this.hover.px);
  }
}

/** Candles plus a horizontal volume-by-price histogram pinned to the right edge. */
export class VolumeProfileChart extends CandlestickChart<VolumeProfileOptions> {
  private profile: THREE.Group | null = null;
  private bins: { lo: number; hi: number; vol: number }[] = [];

  protected rightRoom() {
    // Leave space so the latest candles aren't hidden under the profile.
    return Math.max(1, this.d.open.length * 0.3);
  }

  protected buildMarks() {
    super.buildMarks();
    const { high, low, close } = this.d;
    const vol = this.opts.volume;
    const nb = this.opts.bins ?? 24;
    const { y0, y1 } = this.full;
    const step = (y1 - y0) / nb;
    this.bins = Array.from({ length: nb }, (_, i) => ({ lo: y0 + i * step, hi: y0 + (i + 1) * step, vol: 0 }));
    for (let i = 0; i < close.length; i++) {
      const typical = (high[i] + low[i] + close[i]) / 3;
      const b = Math.min(nb - 1, Math.max(0, Math.floor((typical - y0) / step)));
      this.bins[b].vol += vol[i] ?? 0;
    }
  }

  protected onViewChange() {
    super.onViewChange();
    if (this.profile) {
      this.scene.remove(this.profile);
      this.disposeScene(this.profile);
    }
    const v = this.view;
    const max = Math.max(...this.bins.map((b) => b.vol), 1);
    const width = (v.x1 - v.x0) * 0.24;
    const poc = this.bins.reduce((best, b, i) => (b.vol > this.bins[best].vol ? i : best), 0);
    const mb = new MarkBuilder(this.origin.x, this.origin.y, false);
    this.bins.forEach((b, i) => {
      const w = (b.vol / max) * width;
      const gap = (b.hi - b.lo) * 0.1;
      mb.box(v.x1 - w, b.lo + gap, v.x1, b.hi - gap, i === poc ? this.theme.series[0] : this.theme.textMuted, i === poc ? 0.55 : 0.3);
    });
    this.profile = mb.build(this.dpr, this.theme.surface);
    this.scene.add(this.profile);
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (this.inPlot(px, py)) {
      const [x, y] = this.toData(px, py);
      const v = this.view;
      const max = Math.max(...this.bins.map((b) => b.vol), 1);
      const b = this.bins.find((b) => y >= b.lo && y < b.hi);
      if (b && x >= v.x1 - (b.vol / max) * (v.x1 - v.x0) * 0.24) {
        const total = this.bins.reduce((s, c) => s + c.vol, 0) || 1;
        return { series: 'Volume', index: 0, title: `${this.formatY(b.lo)} – ${this.formatY(b.hi)}`, values: { Volume: formatNumber(b.vol), Share: `${((b.vol / total) * 100).toFixed(1)}%` } };
      }
    }
    return super.hitTest(px, py);
  }
}
