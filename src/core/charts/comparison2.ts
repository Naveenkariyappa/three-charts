import type { LegendItem } from '../base';
import { hierarchy, leaves, pack, type TreeDatum } from '../layouts';
import { MarkChart, inkOn, textWidth, type MarkBuilder } from '../markchart';
import { extent, formatNumber, niceDomain } from '../scale';
import { sampleRamp } from '../theme';
import type {
  DivergingBarOptions,
  DotHistogramOptions,
  JumpLineOptions,
  PackedBubbleOptions,
  QuadrantOptions,
  StemOptions,
  VariwideOptions,
  WinLossOptions,
} from '../types2';

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

// ---- Diverging stacked bar (Likert) ----------------------------------------------------------

/**
 * Survey-style answers stacked out from zero: negative levels to the left,
 * positive to the right, a neutral level split across the middle.
 */
export class DivergingBarChart extends MarkChart<DivergingBarOptions> {
  readonly type = 'divergingBar' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;

  private neutral() {
    const n = this.opts.levels.length;
    return this.opts.neutral ?? (n % 2 ? (n - 1) / 2 : -1);
  }

  private levelColor(j: number) {
    const n = this.opts.levels.length;
    return '#' + sampleRamp(this.theme.diverging, n > 1 ? j / (n - 1) : 0.5).getHexString();
  }

  protected legendItems(): LegendItem[] {
    return this.opts.levels.map((l, j) => ({ name: l.name, color: this.levelColor(j) }));
  }

  /** Row values (shares when `percent`), with hidden levels removed. */
  private row(i: number) {
    const vals = this.opts.levels.map((l) => (this.hidden.has(l.name) ? 0 : (l.values[i] ?? 0)));
    const total = this.opts.levels.reduce((s, l) => s + (l.values[i] ?? 0), 0) || 1;
    return (this.opts.percent ?? true) ? vals.map((v) => v / total) : vals;
  }

  formatX(v: number) {
    return (this.opts.percent ?? true) ? `${Math.round(Math.abs(v) * 100)}%` : formatNumber(Math.abs(v));
  }

  protected computeDomain() {
    const { categories, levels } = this.opts;
    const mid = this.neutral();
    let m = 1e-9;
    categories.forEach((_, i) => {
      const r = this.row(i);
      let left = 0;
      let right = 0;
      levels.forEach((_, j) => {
        if (j === mid) {
          left += r[j] / 2;
          right += r[j] / 2;
        } else if (j < (mid >= 0 ? mid : levels.length / 2)) left += r[j];
        else right += r[j];
      });
      m = Math.max(m, left, right);
    });
    // Shares: round up to the next 10%; counts: a nice round number.
    const hi = (this.opts.percent ?? true) ? Math.min(1, Math.ceil(m * 10 + 1e-9) / 10) : niceDomain(0, m)[1];
    // First category on top.
    this.yCategories = [...categories].reverse();
    this.full = { x0: -hi, x1: hi, y0: -0.5, y1: categories.length - 0.5 };
  }

  protected marks(b: MarkBuilder) {
    const { categories, levels } = this.opts;
    const mid = this.neutral();
    const split = mid >= 0 ? mid : levels.length / 2;
    const n = categories.length;
    categories.forEach((cat, i) => {
      const y = n - 1 - i;
      const r = this.row(i);
      const raw = levels.map((l) => l.values[i] ?? 0);
      const total = raw.reduce((s, v) => s + v, 0) || 1;
      const seg = (j: number, x0: number, x1: number) => {
        if (x1 - x0 <= 0) return;
        const color = this.levelColor(j);
        b.rect(x0, y - 0.36, x1, y + 0.36, color);
        b.region({
          k: 'rect',
          x0,
          y0: y - 0.36,
          x1,
          y1: y + 0.36,
          hit: { series: levels[j].name, index: i, color, title: cat, values: { Count: raw[j] }, rows: [{ label: levels[j].name, value: `${pct(raw[j] / total)} (${formatNumber(raw[j])})`, color }] },
        });
      };
      // Neutral straddles zero; others stack outward from it.
      let left = 0;
      let right = 0;
      if (mid >= 0) {
        seg(mid, -r[mid] / 2, r[mid] / 2);
        left = -r[mid] / 2;
        right = r[mid] / 2;
      }
      for (let j = Math.ceil(split) - 1; j >= 0; j--) {
        if (j === mid) continue;
        seg(j, left - r[j], left);
        left -= r[j];
      }
      for (let j = Math.floor(split) + (mid >= 0 ? 1 : 0); j < levels.length; j++) {
        if (j === mid) continue;
        seg(j, right, right + r[j]);
        right += r[j];
      }
    });
    b.seg(0, -0.5, 0, n - 0.5, this.theme.axis, 1);
  }
}

// ---- Variwide -------------------------------------------------------------------------------

/** Bars whose height and width both carry a value (e.g. labor cost by country, width = GDP). */
export class VariwideChart extends MarkChart<VariwideOptions> {
  readonly type = 'variwide' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected relayout = true;

  protected computeDomain() {
    const data = this.opts.data;
    const w = data.reduce((s, d) => s + Math.max(0, d.width), 0) || 1;
    const [, hi] = niceDomain(0, Math.max(...data.map((d) => d.value), 1e-9) * 1.12);
    this.full = { x0: 0, x1: w, y0: 0, y1: hi };
  }

  protected marks(b: MarkBuilder) {
    const { data, valueName = 'Value', widthName = 'Width' } = this.opts;
    b.grow = { base: 0, horizontal: false };
    const color = this.color(0);
    let x = 0;
    data.forEach((d, i) => {
      const w = Math.max(0, d.width);
      b.rect(x, 0, x + w, d.value, color, 'top');
      // Label only bars wide enough to hold it; the rest are in the tooltip.
      if (w / this.unitsPerPx()[0] >= textWidth(d.label) + 6) b.text(d.label, x + w / 2, d.value, 0.5, 1.15);
      b.region({
        k: 'rect',
        x0: x,
        y0: 0,
        x1: x + w,
        y1: d.value,
        hit: { series: d.label, index: i, color, values: { [valueName]: d.value, [widthName]: d.width }, rows: [{ label: valueName, value: this.formatY(d.value), color }, { label: widthName, value: formatNumber(d.width) }] },
      });
      x += w;
    });
  }
}

// ---- Packed bubble ---------------------------------------------------------------------------

/** Circles sized by value, packed tightly; items sharing a `group` cluster together. */
export class PackedBubbleChart extends MarkChart<PackedBubbleOptions> {
  readonly type = 'packedBubble' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  private groups() {
    const out: string[] = [];
    for (const d of this.opts.data) if (d.group && !out.includes(d.group)) out.push(d.group);
    return out;
  }

  protected legendItems(): LegendItem[] {
    return this.groups().map((g, i) => ({ name: g, color: this.color(i) }));
  }

  protected marks(b: MarkBuilder) {
    const groups = this.groups();
    const items = this.opts.data.filter((d) => d.value > 0 && !(d.group && this.hidden.has(d.group)));
    const datum: TreeDatum = groups.length
      ? { name: '', children: groups.filter((g) => !this.hidden.has(g)).map((g) => ({ name: g, children: items.filter((d) => d.group === g).map((d) => ({ name: d.label, value: d.value })) })) }
      : { name: '', children: items.map((d) => ({ name: d.label, value: d.value })) };
    const root = hierarchy(datum);
    const W = this.plot.width;
    const H = this.plot.height;
    pack(root, W / 2, H / 2, Math.min(W, H) / 2 - 4, groups.length ? 6 : 2);
    // Zoom the bubbles (not the empty group circles) to fill the box.
    const ls = leaves(root).filter((n) => n.r > 0);
    if (ls.length) {
      const x0 = Math.min(...ls.map((n) => n.x - n.r));
      const x1 = Math.max(...ls.map((n) => n.x + n.r));
      const y0 = Math.min(...ls.map((n) => n.y - n.r));
      const y1 = Math.max(...ls.map((n) => n.y + n.r));
      const k = Math.min((W - 8) / (x1 - x0), (H - 8) / (y1 - y0));
      for (const n of ls) {
        n.x = W / 2 + (n.x - (x0 + x1) / 2) * k;
        n.y = H / 2 + (n.y - (y0 + y1) / 2) * k;
        n.r *= k;
      }
    }
    const total = items.reduce((s, d) => s + d.value, 0) || 1;
    leaves(root).forEach((n, i) => {
      if (n.r <= 0.5) return;
      const group = n.parent && n.parent.parent ? n.parent.name : undefined;
      const color = this.color(group ? groups.indexOf(group) : 0);
      b.sector(n.x, n.y, 0, n.r, 0, Math.PI * 2, color, 0.88);
      if (n.r > 16) b.text(n.name, n.x, n.y, 0.5, 0.5, false, { maxWidth: n.r * 1.8, color: inkOn(color), size: Math.min(13, Math.max(9, n.r / 3)) });
      const ring: number[] = [];
      for (let k = 0; k < 24; k++) ring.push(n.x + Math.cos((k / 24) * Math.PI * 2) * n.r, n.y + Math.sin((k / 24) * Math.PI * 2) * n.r);
      b.region({
        k: 'poly',
        pts: ring,
        hit: { series: n.name, index: i, color, values: { Value: n.value }, rows: [{ label: 'Value', value: formatNumber(n.value), color }, { label: 'Share', value: pct(n.value / total) }, ...(group ? [{ label: 'Group', value: group }] : [])] },
      });
    });
  }
}

// ---- Quadrant ---------------------------------------------------------------------------------

/** Scatter split into four labeled quadrants (e.g. effort vs impact). */
export class QuadrantChart extends MarkChart<QuadrantOptions> {
  readonly type = 'quadrant' as const;
  protected defaultZoom: 'x' | 'xy' | false = 'xy';

  protected computeDomain() {
    const pts = this.opts.points;
    const [x0, x1] = extent(pts.map((p) => p.x));
    const [y0, y1] = extent(pts.map((p) => p.y));
    const xs = this.opts.xSplit;
    const ys = this.opts.ySplit;
    const [a, c] = niceDomain(Math.min(x0, xs ?? x0), Math.max(x1, xs ?? x1));
    const [d, e] = niceDomain(Math.min(y0, ys ?? y0), Math.max(y1, ys ?? y1));
    this.full = { x0: a, x1: c, y0: d, y1: e };
  }

  protected marks(b: MarkBuilder) {
    const f = this.full;
    const xs = this.opts.xSplit ?? (f.x0 + f.x1) / 2;
    const ys = this.opts.ySplit ?? (f.y0 + f.y1) / 2;
    const names = this.opts.quadrants;
    // Faint fills tell the quadrants apart without competing with the points.
    b.box(f.x0, ys, xs, f.y1, this.theme.textMuted, 0.04);
    b.box(xs, f.y0, f.x1, ys, this.theme.textMuted, 0.04);
    b.seg(xs, f.y0, xs, f.y1, this.theme.axis, 1.5);
    b.seg(f.x0, ys, f.x1, ys, this.theme.axis, 1.5);
    if (names) {
      const [upx, upy] = this.unitsPerPx();
      const pad = 8;
      b.text(names[0], f.x0 + pad * upx, f.y1 - pad * upy, 0, 0, true);
      b.text(names[1], f.x1 - pad * upx, f.y1 - pad * upy, 1, 0, true);
      b.text(names[2], f.x0 + pad * upx, f.y0 + pad * upy, 0, 1, true);
      b.text(names[3], f.x1 - pad * upx, f.y0 + pad * upy, 1, 1, true);
    }
    const color = this.color(0);
    const label = this.opts.points.length <= 40;
    this.opts.points.forEach((p, i) => {
      const size = p.size ?? 10;
      b.point(p.x, p.y, color, size);
      // Labels sit right of the dot, or left near the right edge.
      const nearRight = (f.x1 - p.x) / this.unitsPerPx()[0] < 110;
      if (label) b.text(p.label, p.x, p.y, nearRight ? 1.15 : -0.15, 0.5, false, { maxWidth: 120 });
      const q = (p.y >= ys ? 0 : 2) + (p.x >= xs ? 1 : 0);
      b.region({
        k: 'circle',
        x: p.x,
        y: p.y,
        r: Math.max(8, size / 2 + 2),
        hit: { series: p.label, index: i, color, values: { x: p.x, y: p.y }, rows: [{ label: 'x', value: this.formatX(p.x) }, { label: 'y', value: this.formatY(p.y) }, ...(names ? [{ label: 'Quadrant', value: names[q] }] : [])] },
      });
    });
  }

  protected relayout = true;
}

// ---- Stem ----------------------------------------------------------------------------------------

/** Values as vertical stems from a baseline (impulse / stick chart), e.g. discrete signals. */
export class StemChart extends MarkChart<StemOptions> {
  readonly type = 'stem' as const;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  private visible() {
    return this.opts.series.map((s, i) => ({ s, color: this.color(i, s.color) })).filter(({ s }) => !this.hidden.has(s.name));
  }

  protected computeDomain() {
    const base = this.opts.baseline ?? 0;
    let x0 = Infinity, x1 = -Infinity, y0 = base, y1 = base;
    for (const { s } of this.visible()) {
      const [a, c] = s.x ? extent(s.x) : [0, s.y.length - 1];
      const [d, e] = extent(s.y);
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, c);
      y0 = Math.min(y0, d);
      y1 = Math.max(y1, e);
    }
    if (!isFinite(x0)) [x0, x1] = [0, 1];
    const pad = (x1 - x0 || 1) * 0.03;
    const [a, c] = niceDomain(y0, y1);
    this.full = { x0: x0 - pad, x1: x1 + pad, y0: a, y1: c };
  }

  protected marks(b: MarkBuilder) {
    const base = this.opts.baseline ?? 0;
    const vis = this.visible();
    const total = vis.reduce((n, v) => n + v.s.y.length, 0);
    b.seg(this.full.x0, base, this.full.x1, base, this.theme.axis, 1);
    for (const { s, color } of vis) {
      for (let i = 0; i < s.y.length; i++) {
        const x = s.x ? s.x[i] : i;
        b.seg(x, base, x, s.y[i], color, 1.5);
        b.point(x, s.y[i], color, total > 600 ? 5 : 8);
        if (total <= 3000) b.region({ k: 'circle', x, y: s.y[i], r: 7, hit: { series: s.name, index: i, color, title: this.formatXTip(x), values: { y: s.y[i] }, rows: [{ label: s.name, value: this.formatY(s.y[i]), color }] } });
      }
    }
  }
}

// ---- Jump line ------------------------------------------------------------------------------------

/** One flat tick per category and series, no connecting lines (e.g. targets or plan vs actual). */
export class JumpLineChart extends MarkChart<JumpLineOptions> {
  readonly type = 'jumpLine' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected computeDomain() {
    let lo = Infinity, hi = -Infinity;
    for (const s of this.opts.series) {
      if (this.hidden.has(s.name)) continue;
      const [a, c] = extent(s.data);
      lo = Math.min(lo, a);
      hi = Math.max(hi, c);
    }
    if (!isFinite(lo)) [lo, hi] = [0, 1];
    const [a, c] = niceDomain(Math.min(0, lo), hi);
    this.xCategories = this.opts.categories;
    this.full = { x0: -0.5, x1: this.opts.categories.length - 0.5, y0: a, y1: c };
  }

  protected marks(b: MarkBuilder) {
    this.opts.series.forEach((s, k) => {
      if (this.hidden.has(s.name)) return;
      const color = this.color(k, s.color);
      this.opts.categories.forEach((cat, i) => {
        const v = s.data[i];
        if (v === undefined || v !== v) return;
        b.seg(i - 0.34, v, i + 0.34, v, color, 3);
        const [, upy] = this.unitsPerPx();
        b.region({ k: 'rect', x0: i - 0.36, y0: v - 6 * upy, x1: i + 0.36, y1: v + 6 * upy, hit: { series: s.name, index: i, color, title: cat, values: { [s.name]: v }, rows: [{ label: s.name, value: this.formatY(v), color }] } });
      });
    });
  }

  protected relayout = true;
}

// ---- Dot histogram (Wilkinson) --------------------------------------------------------------------

/** A histogram where every observation is a dot, stacked in its bin. */
export class DotHistogramChart extends MarkChart<DotHistogramOptions> {
  readonly type = 'dotHistogram' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected relayout = true;
  protected showYTicks = false;
  private bins: { x: number; n: number }[] = [];
  private binW = 1;

  protected computeDomain() {
    const v = this.opts.values;
    const [lo, hi] = extent(v);
    const [a, c] = niceDomain(lo, hi);
    this.binW = this.opts.binWidth ?? ((c - a) / 30 || 1);
    const counts = new Map<number, number>();
    for (let i = 0; i < v.length; i++) {
      const k = Math.floor((v[i] - a) / this.binW);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    this.bins = [...counts].map(([k, n]) => ({ x: a + (k + 0.5) * this.binW, n }));
    this.full = { x0: a, x1: c, y0: 0, y1: 1 };
  }

  protected marks(b: MarkBuilder) {
    const [upx] = this.unitsPerPx();
    const binPx = this.binW / upx;
    const maxN = Math.max(1, ...this.bins.map((x) => x.n));
    // Dots are as wide as a bin, unless the tallest stack wouldn't fit.
    const d = Math.max(2, Math.min(binPx, (this.plot.height - 4) / maxN));
    const unitY = d / this.plot.height;
    const color = this.color(0);
    this.bins.forEach((bin, i) => {
      for (let k = 0; k < bin.n; k++) b.point(bin.x, (k + 0.5) * unitY, color, d - 1, 'disc');
      b.region({
        k: 'rect',
        x0: bin.x - this.binW / 2,
        y0: 0,
        x1: bin.x + this.binW / 2,
        y1: Math.max(bin.n * unitY, 0.05),
        hit: { series: this.opts.name ?? 'Count', index: i, color, title: `${this.formatX(bin.x - this.binW / 2)} – ${this.formatX(bin.x + this.binW / 2)}`, values: { Count: bin.n }, rows: [{ label: 'Count', value: String(bin.n), color }] },
      });
    });
  }
}

// ---- Win / loss ---------------------------------------------------------------------------------

/** Compact up/down marks for a run of wins, losses and draws. */
export class WinLossChart extends MarkChart<WinLossOptions> {
  readonly type = 'winLoss' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 2;

  protected legendItems(): LegendItem[] {
    return [
      { name: 'Win', color: this.color(0) },
      { name: 'Loss', color: this.color(1) },
    ];
  }

  protected marks(b: MarkBuilder) {
    const v = this.opts.values;
    const W = this.plot.width;
    const H = this.plot.height;
    const step = W / Math.max(1, v.length);
    const w = Math.max(1, step - 2);
    const mid = H / 2;
    b.seg(0, mid, W, mid, this.theme.axis, 1);
    for (let i = 0; i < v.length; i++) {
      const x = i * step + (step - w) / 2;
      const win = v[i] > 0;
      const loss = v[i] < 0;
      const color = win ? this.color(0) : loss ? this.color(1) : this.theme.textMuted;
      if (win && !this.hidden.has('Win')) b.rect(x, mid - H * 0.42, x + w, mid - 1, color);
      else if (loss && !this.hidden.has('Loss')) b.rect(x, mid + 1, x + w, mid + H * 0.42, color);
      else if (!win && !loss) b.rect(x, mid - 1.5, x + w, mid + 1.5, color);
      b.region({ k: 'rect', x0: i * step, y0: 0, x1: (i + 1) * step, y1: H, hit: { series: this.opts.labels?.[i] ?? `Game ${i + 1}`, index: i, color, values: { Result: v[i] }, rows: [{ label: 'Result', value: win ? 'Win' : loss ? 'Loss' : 'Draw', color }] } });
    }
  }
}

