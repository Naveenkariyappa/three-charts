import type { Hit, LegendItem } from '../base';
import { MarkChart, toColor, type MarkBuilder } from '../markchart';
import { extent, formatNumber, nearestIndex, niceDomain } from '../scale';
import { ema } from '../stats';
import type { Numbers } from '../types';
import type { DepthOptions, HLCOptions, HollowCandleOptions, KagiOptions, LineBreakOptions, MacdOptions, PointFigureOptions, RenkoOptions, RsiOptions } from '../types2';

function upDown(chart: { theme: { series: string[] } }) {
  return { up: chart.theme.series[2], down: chart.theme.series[7] };
}

function niceStep(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
  const n = v / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

// ---- Renko -------------------------------------------------------------------------------

interface Brick {
  lo: number;
  hi: number;
  up: boolean;
  at: number;
}

export class RenkoChart extends MarkChart<RenkoOptions> {
  readonly type = 'renko' as const;
  private bricks: Brick[] = [];
  protected showXTicks = false;

  protected legendItems(): LegendItem[] {
    const { up, down } = upDown(this);
    return [
      { name: 'Up brick', color: up },
      { name: 'Down brick', color: down },
    ];
  }

  private size() {
    const [lo, hi] = extent(this.opts.close);
    return this.opts.brickSize ?? niceStep((hi - lo) / 20);
  }

  protected computeDomain() {
    const c = this.opts.close;
    const s = this.size();
    this.bricks = [];
    let top = Math.floor(c[0] / s) * s + s;
    let bot = top - s;
    for (let i = 1; i < c.length; i++) {
      // A new brick needs a full brick beyond the last one; reversals need two.
      while (c[i] >= top + s) {
        this.bricks.push({ lo: top, hi: top + s, up: true, at: i });
        bot = top;
        top += s;
      }
      while (c[i] <= bot - s) {
        this.bricks.push({ lo: bot - s, hi: bot, up: false, at: i });
        top = bot;
        bot -= s;
      }
    }
    const lo = Math.min(...this.bricks.map((b) => b.lo), bot);
    const hi = Math.max(...this.bricks.map((b) => b.hi), top);
    const [a, b] = niceDomain(lo, hi);
    this.full = { x0: -1, x1: Math.max(1, this.bricks.length), y0: a, y1: b };
  }

  protected marks(b: MarkBuilder) {
    const { up, down } = upDown(this);
    this.bricks.forEach((k, i) => {
      if (this.hidden.has(k.up ? 'Up brick' : 'Down brick')) return;
      const color = k.up ? up : down;
      b.rect(i - 0.44, k.lo, i + 0.44, k.hi, color);
      const when = this.opts.x ? this.formatXTip(this.opts.x[k.at]) : `Bar ${k.at}`;
      b.region({ k: 'rect', x0: i - 0.5, y0: k.lo, x1: i + 0.5, y1: k.hi, hit: { series: k.up ? 'Up' : 'Down', index: i, color, title: `Brick ${i + 1}`, values: { Range: `${formatNumber(k.lo)} – ${formatNumber(k.hi)}`, Formed: when } } });
    });
  }

  formatXTip(v: number) {
    return new Date(v).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

// ---- Point & figure -------------------------------------------------------------------------

interface PFColumn {
  up: boolean;
  from: number;
  to: number;
}

export class PointFigureChart extends MarkChart<PointFigureOptions> {
  readonly type = 'pointFigure' as const;
  protected relayout = true;
  protected showXTicks = false;
  private cols: PFColumn[] = [];
  private box = 1;

  protected legendItems(): LegendItem[] {
    const { up, down } = upDown(this);
    return [
      { name: 'X (rising)', color: up },
      { name: 'O (falling)', color: down },
    ];
  }

  protected computeDomain() {
    const c = this.opts.close;
    const [lo, hi] = extent(c);
    const s = (this.box = this.opts.boxSize ?? niceStep((hi - lo) / 30));
    const rev = this.opts.reversal ?? 3;
    this.cols = [];
    let cur: PFColumn | null = null;
    const start = Math.floor(c[0] / s);
    let pending = start;
    for (let i = 1; i < c.length; i++) {
      const bx = Math.floor(c[i] / s);
      if (!cur) {
        if (bx > pending) cur = { up: true, from: pending + 1, to: bx };
        else if (bx < pending) cur = { up: false, from: pending - 1, to: bx };
        continue;
      }
      if (cur.up) {
        if (bx > cur.to) cur.to = bx;
        else if (bx <= cur.to - rev) {
          this.cols.push(cur);
          cur = { up: false, from: cur.to - 1, to: bx };
        }
      } else {
        if (bx < cur.to) cur.to = bx;
        else if (bx >= cur.to + rev) {
          this.cols.push(cur);
          cur = { up: true, from: cur.to + 1, to: bx };
        }
      }
      pending = bx;
    }
    if (cur) this.cols.push(cur);
    const all = this.cols.flatMap((k) => [k.from, k.to]);
    const [a, b] = niceDomain((Math.min(...all) - 1) * s, (Math.max(...all) + 2) * s);
    this.full = { x0: -1, x1: Math.max(2, this.cols.length), y0: a, y1: b };
  }

  protected marks(b: MarkBuilder) {
    const { up, down } = upDown(this);
    const [ux, uy] = this.unitsPerPx();
    const size = Math.max(4, Math.min(1 / ux, this.box / uy) * 0.85);
    this.cols.forEach((k, i) => {
      const lo = Math.min(k.from, k.to);
      const hi = Math.max(k.from, k.to);
      const color = k.up ? up : down;
      if (!this.hidden.has(k.up ? 'X (rising)' : 'O (falling)')) {
        for (let bx = lo; bx <= hi; bx++) b.point(i, (bx + 0.5) * this.box, color, size, k.up ? 'cross' : 'ring');
      }
      b.region({
        k: 'rect',
        x0: i - 0.5,
        y0: lo * this.box,
        x1: i + 0.5,
        y1: (hi + 1) * this.box,
        hit: { series: k.up ? 'X' : 'O', index: i, color, title: `Column ${i + 1} (${k.up ? 'rising' : 'falling'})`, values: { Boxes: hi - lo + 1, From: formatNumber(k.from * this.box), To: formatNumber(k.to * this.box), 'Box size': formatNumber(this.box) } },
      });
    });
  }
}

// ---- Kagi --------------------------------------------------------------------------------

export class KagiChart extends MarkChart<KagiOptions> {
  readonly type = 'kagi' as const;
  protected showXTicks = false;
  private turns: number[] = [];
  private turnAt: number[] = [];

  protected legendItems(): LegendItem[] {
    const { up, down } = upDown(this);
    return [
      { name: 'Yang (above prior high)', color: up },
      { name: 'Yin (below prior low)', color: down },
    ];
  }

  protected computeDomain() {
    const c = this.opts.close;
    const rev = this.opts.reversal ?? 0.04;
    // Turning points: a reversal needs a move of `rev` (fraction) against the trend.
    const turns = [c[0]];
    const at = [0];
    let dir = 0;
    let ext = c[0];
    let extAt = 0;
    for (let i = 1; i < c.length; i++) {
      const p = c[i];
      if (dir >= 0 && p > ext) {
        ext = p;
        extAt = i;
        if (dir === 0 && p > c[0] * (1 + rev)) dir = 1;
      } else if (dir <= 0 && p < ext) {
        ext = p;
        extAt = i;
        if (dir === 0 && p < c[0] * (1 - rev)) dir = -1;
      }
      if (dir === 1 && p < ext * (1 - rev)) {
        turns.push(ext);
        at.push(extAt);
        dir = -1;
        ext = p;
        extAt = i;
      } else if (dir === -1 && p > ext * (1 + rev)) {
        turns.push(ext);
        at.push(extAt);
        dir = 1;
        ext = p;
        extAt = i;
      }
    }
    turns.push(ext);
    at.push(extAt);
    this.turns = turns;
    this.turnAt = at;
    const [a, b] = niceDomain(...extent(turns));
    this.full = { x0: -0.5, x1: turns.length - 0.5, y0: a, y1: b };
  }

  protected marks(b: MarkBuilder) {
    const { up, down } = upDown(this);
    const t = this.turns;
    // Thick (yang) after price breaks the previous shoulder, thin (yin) after it breaks the previous waist.
    let yang = t[1] >= t[0];
    let lastHigh = Math.max(t[0], t[1] ?? t[0]);
    let lastLow = Math.min(t[0], t[1] ?? t[0]);
    const seg = (x: number, y0: number, y1: number) => {
      const color = yang ? up : down;
      b.seg(x, y0, x, y1, color, yang ? 4 : 1.5);
    };
    for (let i = 0; i < t.length - 1; i++) {
      const y0 = t[i];
      const y1 = t[i + 1];
      if (y1 > y0 && !yang && y1 > lastHigh) {
        seg(i, y0, lastHigh);
        yang = true;
        seg(i, lastHigh, y1);
      } else if (y1 < y0 && yang && y1 < lastLow) {
        seg(i, y0, lastLow);
        yang = false;
        seg(i, lastLow, y1);
      } else seg(i, y0, y1);
      if (y1 > y0) lastHigh = y1;
      else lastLow = y1;
      if (i < t.length - 2) b.seg(i, y1, i + 1, y1, yang ? up : down, yang ? 4 : 1.5);
      const when = this.opts.x ? new Date(this.opts.x[this.turnAt[i + 1]]).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : `Bar ${this.turnAt[i + 1]}`;
      b.region({ k: 'rect', x0: i - 0.5, y0: Math.min(y0, y1), x1: i + 0.5, y1: Math.max(y0, y1), hit: { series: 'Kagi', index: i, title: `Line ${i + 1}`, values: { From: formatNumber(y0), To: formatNumber(y1), Turned: when } } });
    }
  }
}

// ---- Market depth --------------------------------------------------------------------------

export class DepthChart extends MarkChart<DepthOptions> {
  readonly type = 'depth' as const;
  private bid: { price: number; cum: number }[] = [];
  private ask: { price: number; cum: number }[] = [];
  private hoverPx = 0;

  protected legendItems(): LegendItem[] {
    const { up, down } = upDown(this);
    return [
      { name: 'Bids', color: up },
      { name: 'Asks', color: down },
    ];
  }

  protected computeDomain() {
    const bids = [...this.opts.bids].sort((a, b) => b.price - a.price);
    const asks = [...this.opts.asks].sort((a, b) => a.price - b.price);
    let c = 0;
    this.bid = bids.map((o) => ({ price: o.price, cum: (c += o.size) }));
    c = 0;
    this.ask = asks.map((o) => ({ price: o.price, cum: (c += o.size) }));
    const lo = this.bid.length ? this.bid[this.bid.length - 1].price : 0;
    const hi = this.ask.length ? this.ask[this.ask.length - 1].price : 1;
    const top = Math.max(this.bid.at(-1)?.cum ?? 0, this.ask.at(-1)?.cum ?? 0);
    this.full = { x0: lo, x1: hi, y0: 0, y1: niceDomain(0, top || 1)[1] };
  }

  protected marks(b: MarkBuilder) {
    const { up, down } = upDown(this);
    const side = (pts: { price: number; cum: number }[], color: string, name: string) => {
      if (!pts.length || this.hidden.has(name)) return;
      const top: number[] = [pts[0].price, 0];
      for (let i = 0; i < pts.length; i++) {
        top.push(pts[i].price, i ? pts[i - 1].cum : 0, pts[i].price, pts[i].cum);
      }
      const bot: number[] = [];
      for (let i = 0; i < top.length; i += 2) bot.push(top[i], 0);
      b.band(top, bot, color, 0.25);
      b.line(top, color, 2);
    };
    side(this.bid, up, 'Bids');
    side(this.ask, down, 'Asks');
    if (this.bid.length && this.ask.length) {
      const mid = (this.bid[0].price + this.ask[0].price) / 2;
      b.line([mid, 0, mid, this.full.y1], this.theme.textMuted, 1, 1, false, true);
      b.text(`Mid ${formatNumber(mid)} · spread ${formatNumber(this.ask[0].price - this.bid[0].price)}`, mid, this.full.y1, 0.5, -0.2, true);
    }
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const [x] = this.toData(px, py);
    this.hoverPx = px;
    const bidSide = this.bid.length && x <= this.bid[0].price;
    const list: { price: number; cum: number }[] = bidSide ? this.bid : this.ask;
    // Cumulative depth available at this price or better.
    let cum = 0;
    for (const p of list) if (bidSide ? p.price >= x : p.price <= x) cum = p.cum;
    const { up, down } = upDown(this);
    return { series: bidSide ? 'Bids' : 'Asks', index: 0, color: bidSide ? up : down, title: `Price ${formatNumber(x)}`, values: { [bidSide ? 'Buy depth' : 'Sell depth']: formatNumber(cum) } };
  }

  protected highlight(hit: Hit | null) {
    this.showCrosshair(hit ? this.hoverPx : null);
  }
}


// ---- Indicator panels (MACD, RSI) ------------------------------------------------------------

/**
 * Shared plumbing for indicator panels under a price chart: x from `x` or the
 * index, crosshair hover, and `sync` to pan and zoom with the price chart.
 */
abstract class IndicatorPanel<O extends MacdOptions | RsiOptions> extends MarkChart<O> {
  protected xs: Numbers = [];
  private hover: { px: number; py: number; color: string } | null = null;

  protected xAt(i: number) {
    return this.opts.x ? this.opts.x[i] : i;
  }

  protected prepareX() {
    const n = this.opts.close.length;
    this.xs = this.opts.x ?? Float64Array.from({ length: n }, (_, i) => i);
  }

  protected spacing() {
    let m = Infinity;
    for (let i = 1; i < Math.min(this.xs.length, 2000); i++) m = Math.min(m, this.xs[i] - this.xs[i - 1]);
    return m > 0 && isFinite(m) ? m : 1;
  }

  /** Polyline through the finite values. */
  protected path(v: Numbers): number[] {
    const pts: number[] = [];
    for (let i = 0; i < v.length; i++) if (v[i] === v[i]) pts.push(this.xAt(i), v[i]);
    return pts;
  }

  protected abstract rowsAt(i: number): { rows: NonNullable<Hit['rows']>; y: number; color: string } | null;

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const i = nearestIndex(this.xs, this.toData(px, py)[0]);
    if (i < 0) return null;
    const r = this.rowsAt(i);
    if (!r) return null;
    const [hx, hy] = this.toPx(this.xAt(i), r.y);
    this.hover = { px: hx, py: hy, color: r.color };
    return { series: this.type, index: i, title: this.formatXTip(this.xAt(i)), values: {}, rows: r.rows };
  }

  protected highlight(hit: Hit | null) {
    this.showCrosshair(hit && this.hover ? this.hover.px : null);
    if (hit && this.hover) this.showDot(this.hover.px, this.hover.py, this.hover.color);
    else this.showDot(null);
  }
}

/** MACD line (fast EMA − slow EMA), its signal line, and the histogram between them. */
export class MacdChart extends IndicatorPanel<MacdOptions> {
  readonly type = 'macd' as const;
  private macd = new Float64Array(0);
  private signal = new Float64Array(0);

  protected legendItems(): LegendItem[] {
    return [
      { name: 'MACD', color: this.color(0) },
      { name: 'Signal', color: this.color(1) },
    ];
  }

  protected computeDomain() {
    this.prepareX();
    const { close, fast = 12, slow = 26, signal = 9 } = this.opts;
    const f = ema(close, fast);
    const s = ema(close, slow);
    const n = close.length;
    this.macd = new Float64Array(n).fill(NaN);
    for (let i = 0; i < n; i++) this.macd[i] = f[i] - s[i];
    // Signal = EMA of the MACD line, over the part where it exists.
    const start = Math.min(n, slow - 1);
    const sig = ema(this.macd.subarray(start), signal);
    this.signal = new Float64Array(n).fill(NaN);
    this.signal.set(sig, start);
    let lo = 0, hi = 0;
    for (let i = 0; i < n; i++) {
      if (this.macd[i] === this.macd[i]) {
        lo = Math.min(lo, this.macd[i]);
        hi = Math.max(hi, this.macd[i]);
      }
      if (this.signal[i] === this.signal[i]) {
        lo = Math.min(lo, this.signal[i]);
        hi = Math.max(hi, this.signal[i]);
      }
    }
    const sp = this.spacing();
    const [a, c] = niceDomain(lo, hi);
    this.full = { x0: this.xAt(0) - sp, x1: this.xAt(n - 1) + sp, y0: a, y1: c };
  }

  protected marks(b: MarkBuilder) {
    const { up, down } = upDown(this);
    const half = this.spacing() * 0.35;
    const surface = toColor(this.theme.surface);
    // Histogram in quieter tints of the up/down colors, so the two lines read first.
    const tint = (c: string) => '#' + toColor(c).clone().lerp(surface, 0.4).getHexString();
    const upT = tint(up);
    const downT = tint(down);
    for (let i = 0; i < this.macd.length; i++) {
      const h = this.macd[i] - this.signal[i];
      if (h !== h) continue;
      const x = this.xAt(i);
      b.rect(x - half, Math.min(0, h), x + half, Math.max(0, h), h >= 0 ? upT : downT);
    }
    b.seg(this.full.x0, 0, this.full.x1, 0, this.theme.axis, 1);
    if (!this.hidden.has('MACD')) b.line(this.path(this.macd), this.color(0), 1.5);
    if (!this.hidden.has('Signal')) b.line(this.path(this.signal), this.color(1), 1.5);
  }

  protected rowsAt(i: number) {
    const m = this.macd[i];
    const s = this.signal[i];
    if (m !== m) return null;
    return {
      y: m,
      color: this.color(0),
      rows: [
        { label: 'MACD', value: m.toFixed(3), color: this.color(0) },
        { label: 'Signal', value: s === s ? s.toFixed(3) : '–', color: this.color(1) },
        { label: 'Histogram', value: s === s ? (m - s).toFixed(3) : '–' },
      ],
    };
  }
}

/** Relative Strength Index (Wilder smoothing), 0–100, with overbought/oversold lines. */
export class RsiChart extends IndicatorPanel<RsiOptions> {
  readonly type = 'rsi' as const;
  private rsi = new Float64Array(0);

  protected computeDomain() {
    this.prepareX();
    const { close, period = 14 } = this.opts;
    const n = close.length;
    this.rsi = new Float64Array(n).fill(NaN);
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < n; i++) {
      const d = close[i] - close[i - 1];
      const g = Math.max(d, 0);
      const l = Math.max(-d, 0);
      if (i <= period) {
        gain += g / period;
        loss += l / period;
      } else {
        gain = (gain * (period - 1) + g) / period;
        loss = (loss * (period - 1) + l) / period;
      }
      if (i >= period) this.rsi[i] = loss ? 100 - 100 / (1 + gain / loss) : 100;
    }
    const sp = this.spacing();
    this.full = { x0: this.xAt(0) - sp, x1: this.xAt(n - 1) + sp, y0: 0, y1: 100 };
  }

  protected marks(b: MarkBuilder) {
    const hi = this.opts.overbought ?? 70;
    const lo = this.opts.oversold ?? 30;
    const { x0, x1 } = this.full;
    const c = this.color(0);
    b.box(x0, lo, x1, hi, c, 0.06);
    b.line([x0, hi, x1, hi], this.theme.textMuted, 1, 1, false, true);
    b.line([x0, lo, x1, lo], this.theme.textMuted, 1, 1, false, true);
    b.text(String(hi), x1, hi, 1.1, 1.2);
    b.text(String(lo), x1, lo, 1.1, -0.2);
    b.line(this.path(this.rsi), c, 1.5);
  }

  protected rowsAt(i: number) {
    const v = this.rsi[i];
    if (v !== v) return null;
    const hi = this.opts.overbought ?? 70;
    const lo = this.opts.oversold ?? 30;
    return {
      y: v,
      color: this.color(0),
      rows: [
        { label: `RSI ${this.opts.period ?? 14}`, value: v.toFixed(1), color: this.color(0) },
        { label: 'Zone', value: v >= hi ? 'Overbought' : v <= lo ? 'Oversold' : 'Neutral' },
        { label: 'Close', value: formatNumber(this.opts.close[i]) },
      ],
    };
  }
}

// ---- Three line break -------------------------------------------------------------------------------

/**
 * Lines (boxes) that ignore time: a new line only when the close breaks the last
 * line's high or low; a reversal needs to break the last `lines` lines.
 */
export class LineBreakChart extends MarkChart<LineBreakOptions> {
  readonly type = 'lineBreak' as const;
  protected showXTicks = false;
  private boxes: { lo: number; hi: number; up: boolean; at: number }[] = [];

  protected legendItems(): LegendItem[] {
    const { up, down } = upDown(this);
    return [
      { name: 'Up', color: up },
      { name: 'Down', color: down },
    ];
  }

  protected computeDomain() {
    const { close } = this.opts;
    const n = this.opts.lines ?? 3;
    const boxes: { lo: number; hi: number; up: boolean; at: number }[] = [];
    let i = 1;
    while (i < close.length && close[i] === close[0]) i++;
    if (i < close.length) boxes.push({ lo: Math.min(close[0], close[i]), hi: Math.max(close[0], close[i]), up: close[i] > close[0], at: i });
    for (i++; i < close.length; i++) {
      const c = close[i];
      const last = boxes[boxes.length - 1];
      const back = boxes.slice(-n);
      const lowest = Math.min(...back.map((b) => b.lo));
      const highest = Math.max(...back.map((b) => b.hi));
      if (last.up) {
        if (c > last.hi) boxes.push({ lo: last.hi, hi: c, up: true, at: i });
        else if (c < lowest) boxes.push({ lo: c, hi: last.lo, up: false, at: i });
      } else {
        if (c < last.lo) boxes.push({ lo: c, hi: last.lo, up: false, at: i });
        else if (c > highest) boxes.push({ lo: last.hi, hi: c, up: true, at: i });
      }
    }
    this.boxes = boxes;
    const [lo, hi] = boxes.length ? [Math.min(...boxes.map((b) => b.lo)), Math.max(...boxes.map((b) => b.hi))] : [0, 1];
    const [a, c] = niceDomain(lo, hi);
    this.full = { x0: -1, x1: Math.max(1, boxes.length), y0: a, y1: c };
  }

  protected marks(b: MarkBuilder) {
    const { up, down } = upDown(this);
    b.grow = { base: (this.full.y0 + this.full.y1) / 2, horizontal: false };
    this.boxes.forEach((box, k) => {
      if (this.hidden.has(box.up ? 'Up' : 'Down')) return;
      const color = box.up ? up : down;
      b.rect(k - 0.4, box.lo, k + 0.4, box.hi, color);
      const when = this.opts.x ? this.formatXTip(this.opts.x[box.at]) : `#${box.at}`;
      b.region({ k: 'rect', x0: k - 0.45, y0: box.lo, x1: k + 0.45, y1: box.hi, hit: { series: box.up ? 'Up line' : 'Down line', index: k, color, title: when, values: { From: box.up ? box.lo : box.hi, To: box.up ? box.hi : box.lo }, rows: [{ label: 'From', value: formatNumber(box.up ? box.lo : box.hi) }, { label: 'To', value: formatNumber(box.up ? box.hi : box.lo), color }] } });
    });
  }
}

// ---- Hollow candlestick and HLC ----------------------------------------------------------------------------

abstract class PriceBars<O extends HollowCandleOptions | HLCOptions> extends MarkChart<O> {
  protected xs: Numbers = [];
  private hover: { px: number; py: number; color: string } | null = null;

  protected xAt(i: number) {
    return this.opts.x ? this.opts.x[i] : i;
  }

  protected computeDomain() {
    const { high, low, close } = this.opts;
    const n = close.length;
    this.xs = this.opts.x ?? Float64Array.from({ length: n }, (_, i) => i);
    const [lo] = extent(low);
    const [, hi] = extent(high);
    let sp = Infinity;
    for (let i = 1; i < Math.min(n, 2000); i++) sp = Math.min(sp, this.xAt(i) - this.xAt(i - 1));
    if (!(sp > 0 && isFinite(sp))) sp = 1;
    const [a, c] = niceDomain(lo, hi);
    this.full = { x0: this.xAt(0) - sp, x1: this.xAt(n - 1) + sp, y0: a, y1: c };
  }

  protected spacing() {
    let sp = Infinity;
    for (let i = 1; i < Math.min(this.xs.length, 2000); i++) sp = Math.min(sp, this.xs[i] - this.xs[i - 1]);
    return sp > 0 && isFinite(sp) ? sp : 1;
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const i = nearestIndex(this.xs, this.toData(px, py)[0]);
    if (i < 0) return null;
    const { high, low, close } = this.opts;
    const open = this.opts.open;
    const { up, down } = upDown(this);
    const color = i && close[i] < close[i - 1] ? down : up;
    const [hx, hy] = this.toPx(this.xAt(i), close[i]);
    this.hover = { px: hx, py: hy, color };
    return {
      series: this.opts.name ?? 'Price',
      index: i,
      title: this.formatXTip(this.xAt(i)),
      values: { High: high[i], Low: low[i], Close: close[i] },
      rows: [
        ...(open ? [{ label: 'Open', value: this.formatY(open[i]) }] : []),
        { label: 'High', value: this.formatY(high[i]) },
        { label: 'Low', value: this.formatY(low[i]) },
        { label: 'Close', value: this.formatY(close[i]), color },
      ],
    };
  }

  protected highlight(hit: Hit | null) {
    this.showCrosshair(hit && this.hover ? this.hover.px : null);
  }
}

/**
 * Hollow candles: hollow when the close is above the open, filled when below;
 * green or red by the change from the previous close.
 */
export class HollowCandleChart extends PriceBars<HollowCandleOptions> {
  readonly type = 'hollowCandle' as const;

  protected marks(b: MarkBuilder) {
    const { open, high, low, close } = this.opts;
    const { up, down } = upDown(this);
    const half = this.spacing() * 0.35;
    for (let i = 0; i < close.length; i++) {
      const x = this.xAt(i);
      const color = i && close[i] < close[i - 1] ? down : up;
      const top = Math.max(open[i], close[i]);
      const bot = Math.min(open[i], close[i]);
      b.seg(x, high[i], x, top, color, 1);
      b.seg(x, bot, x, low[i], color, 1);
      if (close[i] > open[i]) b.line([x - half, bot, x + half, bot, x + half, top, x - half, top], color, 1.2, 1, true);
      else b.rect(x - half, bot, x + half, top, color);
    }
  }
}

/** High-low-close bars: a vertical range with a tick at the close (open optional, on the left). */
export class HLCChart extends PriceBars<HLCOptions> {
  readonly type = 'hlc' as const;

  protected marks(b: MarkBuilder) {
    const { open, high, low, close } = this.opts;
    const { up, down } = upDown(this);
    const half = this.spacing() * 0.35;
    for (let i = 0; i < close.length; i++) {
      const x = this.xAt(i);
      const color = i && close[i] < close[i - 1] ? down : up;
      b.seg(x, low[i], x, high[i], color, 1.5);
      b.seg(x, close[i], x + half, close[i], color, 1.5);
      if (open) b.seg(x - half, open[i], x, open[i], color, 1.5);
    }
  }
}
