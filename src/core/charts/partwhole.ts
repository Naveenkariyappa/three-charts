import type { Hit, LegendItem } from '../base';
import { distanceForOverlap } from '../layouts';
import { MarkChart, inkOn, polar, type MarkBuilder } from '../markchart';
import { formatNumber, niceDomain, niceTicks } from '../scale';
import { sampleRamp } from '../theme';
import type { FunnelOptions, PolarAreaOptions, PyramidOptions, RadialLineOptions, VennOptions, WaffleOptions, WindRoseOptions } from '../types2';
import type { PieDatum } from '../types';

const TAU = Math.PI * 2;

/** Pixel-space chart with a categorical legend over `data`. */
abstract class PixelChart<O extends WaffleOptions | FunnelOptions | PyramidOptions | PolarAreaOptions> extends MarkChart<O> {
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected legendItems(): LegendItem[] {
    return this.opts.data.map((d, i) => ({ name: d.label, color: this.color(i, d.color) }));
  }

  protected visible(): { d: PieDatum; i: number; color: string }[] {
    return this.opts.data.map((d, i) => ({ d, i, color: this.color(i, d.color) })).filter(({ d }) => !this.hidden.has(d.label));
  }
}

// ---- Waffle ------------------------------------------------------------------------------

export class WaffleChart extends PixelChart<WaffleOptions> {
  readonly type = 'waffle' as const;

  protected marks(b: MarkBuilder) {
    const cols = this.opts.columns ?? 10;
    const rows = this.opts.rows ?? 10;
    const cells = cols * rows;
    const vis = this.visible();
    const total = vis.reduce((s, v) => s + Math.max(0, v.d.value), 0) || 1;
    // Largest-remainder rounding so the cells add up exactly.
    const exact = vis.map((v) => (Math.max(0, v.d.value) / total) * cells);
    const counts = exact.map(Math.floor);
    let left = cells - counts.reduce((s, c) => s + c, 0);
    exact
      .map((e, i) => [e - Math.floor(e), i])
      .sort((a, c) => c[0] - a[0])
      .forEach(([, i]) => {
        if (left-- > 0) counts[i]++;
      });
    const W = this.plot.width;
    const H = this.plot.height;
    const s = Math.min(W / cols, H / rows);
    const ox = (W - s * cols) / 2;
    const oy = (H - s * rows) / 2;
    const gap = Math.max(1.5, s * 0.08);
    let k = 0;
    vis.forEach(({ d, i, color }, vi) => {
      for (let c = 0; c < counts[vi]; c++, k++) {
        // Fill column by column from the top-left, like reading a table.
        const col = Math.floor(k / rows);
        const row = k % rows;
        const x0 = ox + col * s + gap / 2;
        const y0 = oy + row * s + gap / 2;
        b.rect(x0, y0, x0 + s - gap, y0 + s - gap, color);
        b.region({
          k: 'rect',
          x0,
          y0,
          x1: x0 + s - gap,
          y1: y0 + s - gap,
          hit: { series: d.label, index: i, color, values: { Value: formatNumber(d.value), Share: `${((d.value / total) * 100).toFixed(1)}%`, Cells: `${counts[vi]} of ${cells}` } },
        });
      }
    });
    for (; k < cells; k++) {
      const col = Math.floor(k / rows);
      const row = k % rows;
      b.rect(ox + col * s + gap / 2, oy + row * s + gap / 2, ox + (col + 1) * s - gap / 2, oy + (row + 1) * s - gap / 2, this.theme.grid);
    }
  }
}

// ---- Funnel ------------------------------------------------------------------------------

export class FunnelChart extends PixelChart<FunnelOptions> {
  readonly type = 'funnel' as const;

  protected legendItems(): LegendItem[] {
    return [];
  }

  protected marks(b: MarkBuilder) {
    const data = this.opts.data;
    const W = this.plot.width;
    const H = this.plot.height;
    const max = Math.max(...data.map((d) => d.value), 1e-9);
    const labelW = Math.min(170, W * 0.3);
    const cx = (W - labelW) / 2;
    const maxW = W - labelW - 8;
    const n = data.length;
    const step = H / n;
    const color = this.color(0);
    data.forEach((d, i) => {
      const w0 = (d.value / max) * maxW;
      const next = data[i + 1];
      const w1 = next ? (next.value / max) * maxW : w0;
      const y0 = i * step + 1;
      const y1 = (i + 1) * step - 1;
      const pts = [cx - w0 / 2, y0, cx + w0 / 2, y0, cx + w1 / 2, y1, cx - w1 / 2, y1];
      const c = d.color ?? color;
      b.quad(pts, c);
      const ink = inkOn(c);
      if (w0 > 70) b.text(formatNumber(d.value), cx, (y0 + y1) / 2, 0.5, 0.5, true, { color: ink, weight: 600 });
      const conv = i ? `${((d.value / data[i - 1].value) * 100).toFixed(1)}% of previous` : '';
      b.text(d.label, W - labelW + 8, (y0 + y1) / 2 - (conv ? 7 : 0), 0, 0.5, true, { maxWidth: labelW - 8 });
      if (conv) b.text(conv, W - labelW + 8, (y0 + y1) / 2 + 8, 0, 0.5, false, { size: 10, maxWidth: labelW - 8 });
      b.region({
        k: 'rect',
        x0: 0,
        y0,
        x1: W,
        y1,
        hl: { k: 'poly', pts },
        hit: {
          series: d.label,
          index: i,
          color: c,
          values: {
            Value: formatNumber(d.value),
            'Of first stage': `${((d.value / data[0].value) * 100).toFixed(1)}%`,
            ...(i ? { 'Of previous': `${((d.value / data[i - 1].value) * 100).toFixed(1)}%` } : {}),
          },
        },
      });
    });
  }
}

// ---- Pyramid ------------------------------------------------------------------------------

export class PyramidChart extends PixelChart<PyramidOptions> {
  readonly type = 'pyramid' as const;

  protected marks(b: MarkBuilder) {
    const vis = this.visible();
    const W = this.plot.width;
    const H = this.plot.height;
    const total = vis.reduce((s, v) => s + Math.max(0, v.d.value), 0) || 1;
    const h = H - 4;
    const half = Math.min(W * 0.42, h * 0.75);
    const cx = W * 0.42;
    const apex = 2;
    // Area under the apex grows with height², so segment k ends at sqrt(cumulative share).
    let cum = 0;
    vis.forEach(({ d, i, color }) => {
      const f0 = Math.sqrt(cum / total);
      cum += Math.max(0, d.value);
      const f1 = Math.sqrt(cum / total);
      const y0 = apex + f0 * h;
      const y1 = apex + f1 * h;
      const pts = [cx - f0 * half, y0 + 1, cx + f0 * half, y0 + 1, cx + f1 * half, y1 - 1, cx - f1 * half, y1 - 1];
      if (f0 === 0) pts.splice(0, 4, cx, y0 + 1, cx, y0 + 1);
      b.poly(pts, color);
      const share = (d.value / total) * 100;
      b.text(`${d.label}  ${share.toFixed(0)}%`, cx + f1 * half + 10, (y0 + y1) / 2, 0, 0.5, false, { maxWidth: W - (cx + f1 * half + 14) });
      b.region({ k: 'poly', pts, hit: { series: d.label, index: i, color, values: { Value: formatNumber(d.value), Share: `${share.toFixed(1)}%` } } });
    });
  }
}

// ---- Polar area / Nightingale rose ----------------------------------------------------------

export class PolarAreaChart extends PixelChart<PolarAreaOptions> {
  readonly type = 'polarArea' as const;

  // Categories are labeled around the rim, so one color is enough (and doesn't run out at 8).
  protected legendItems() {
    return [];
  }

  protected visible() {
    return this.opts.data.map((d, i) => ({ d, i, color: d.color ?? this.color(0) }));
  }

  protected marks(b: MarkBuilder) {
    const data = this.opts.data;
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 22;
    const vis = this.visible();
    const max = niceDomain(0, Math.max(...vis.map((v) => v.d.value), 1e-9))[1];
    // Area-true: radius grows with the square root of the value.
    const rad = (v: number) => Math.sqrt(Math.max(0, v) / max) * R;
    for (const t of niceTicks(0, max, 4)) {
      if (t <= 0) continue;
      b.arc(cx, cy, rad(t), 0, TAU, this.theme.grid, 1);
      b.text(formatNumber(t), cx + 3, cy - rad(t), 0, 1.1);
    }
    const n = data.length;
    const step = TAU / n;
    for (const { d, i, color } of vis) {
      const a0 = i * step;
      const a1 = a0 + step;
      const r = rad(d.value);
      b.sector(cx, cy, 0, r, a0, a1, color, 0.9, 2);
      const [lx, ly] = polar(cx, cy, R + 12, (a0 + a1) / 2);
      const mid = (a0 + a1) / 2;
      b.text(d.label, lx, ly, Math.sin(mid) > 0.3 ? 0 : Math.sin(mid) < -0.3 ? 1 : 0.5, 0.5, false, { maxWidth: 90 });
      b.region({ k: 'sector', cx, cy, r0: 0, r1: Math.max(r, 10), a0, a1, hit: { series: d.label, index: i, color, values: { Value: formatNumber(d.value) } } });
    }
  }
}

// ---- Wind rose ------------------------------------------------------------------------------

export class WindRoseChart extends MarkChart<WindRoseOptions> {
  readonly type = 'windRose' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  /** Speed bands are ordered, so they take steps of one sequential ramp rather than categorical hues. */
  private bandColor(i: number) {
    const n = this.opts.series.length;
    const s = this.opts.series[i].color;
    if (s) return s;
    const t = n > 1 ? 0.3 + (0.7 * i) / (n - 1) : 0.7;
    return '#' + sampleRamp(this.theme.sequential, t).getHexString();
  }

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.bandColor(i) }));
  }

  protected marks(b: MarkBuilder) {
    const { directions, series } = this.opts;
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 24;
    const n = directions.length;
    const vis = series.map((s, i) => ({ s, i })).filter(({ s }) => !this.hidden.has(s.name));
    const totals = directions.map((_, d) => vis.reduce((t, { s }) => t + Math.max(0, s.data[d] ?? 0), 0));
    const max = niceDomain(0, Math.max(...totals, 1e-9))[1];
    for (const t of niceTicks(0, max, 4)) {
      if (t <= 0) continue;
      b.arc(cx, cy, (t / max) * R, 0, TAU, this.theme.grid, 1);
      b.text(formatNumber(t), cx + 3, cy - (t / max) * R, 0, 1.1);
    }
    const step = TAU / n;
    directions.forEach((name, d) => {
      const a0 = d * step - step / 2;
      const a1 = a0 + step;
      let r = 0;
      for (const { s, i } of vis) {
        const v = Math.max(0, s.data[d] ?? 0);
        const r1 = r + (v / max) * R;
        b.sector(cx, cy, r, r1, a0, a1, this.bandColor(i), 1, 2);
        r = r1;
      }
      const [lx, ly] = polar(cx, cy, R + 12, d * step);
      b.text(name, lx, ly, 0.5, 0.5, true);
      b.region({
        k: 'sector',
        cx,
        cy,
        r0: 0,
        r1: Math.max(r, 12),
        a0,
        a1,
        hit: {
          series: name,
          index: d,
          title: name,
          values: { Total: totals[d] },
          rows: [...vis.map(({ s, i }) => ({ label: s.name, value: formatNumber(s.data[d] ?? 0), color: this.bandColor(i) })).reverse(), { label: 'Total', value: formatNumber(totals[d]) }],
        },
      });
    });
  }
}

// ---- Radial line -----------------------------------------------------------------------------

export class RadialLineChart extends MarkChart<RadialLineOptions> {
  readonly type = 'radialLine' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected marks(b: MarkBuilder) {
    const { categories, series } = this.opts;
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 26;
    const r0 = R * 0.18;
    let lo = Infinity, hi = -Infinity;
    for (const s of series) for (let i = 0; i < s.data.length; i++) {
      lo = Math.min(lo, s.data[i]);
      hi = Math.max(hi, s.data[i]);
    }
    const [a, c] = niceDomain(this.opts.min ?? lo, this.opts.max ?? hi, 4);
    const rad = (v: number) => r0 + ((v - a) / (c - a || 1)) * (R - r0);
    const n = categories.length;
    const step = TAU / n;
    for (const t of niceTicks(a, c, 4)) {
      b.arc(cx, cy, rad(t), 0, TAU, this.theme.grid, 1);
      b.text(formatNumber(t), cx + 3, cy - rad(t), 0, 1.1);
    }
    categories.forEach((name, i) => {
      const [x0, y0] = polar(cx, cy, r0, i * step);
      const [x1, y1] = polar(cx, cy, R, i * step);
      b.seg(x0, y0, x1, y1, this.theme.grid, 1);
      const [lx, ly] = polar(cx, cy, R + 13, i * step);
      b.text(name, lx, ly, 0.5, 0.5);
    });
    const vis = series.map((s, si) => ({ s, color: this.color(si, s.color) })).filter(({ s }) => !this.hidden.has(s.name));
    for (const { s, color } of vis) {
      const pts: number[] = [];
      for (let i = 0; i < n; i++) pts.push(...polar(cx, cy, rad(s.data[i] ?? a), i * step));
      b.line(pts, color, 2, 1, true);
      for (let i = 0; i < n; i++) b.point(pts[i * 2], pts[i * 2 + 1], color, 6);
    }
    categories.forEach((name, i) => {
      b.region({
        k: 'sector',
        cx,
        cy,
        r0: 0,
        r1: R + 20,
        a0: i * step - step / 2,
        a1: i * step + step / 2,
        hl: { k: 'path', pts: [...polar(cx, cy, r0, i * step), ...polar(cx, cy, R, i * step)], tol: 0 },
        hit: {
          series: name,
          index: i,
          title: name,
          values: Object.fromEntries(vis.map(({ s }) => [s.name, s.data[i]])),
          rows: vis.map(({ s, color }) => ({ label: s.name, value: formatNumber(s.data[i]), color })),
        },
      });
    });
  }
}

// ---- Venn (2–3 sets) -----------------------------------------------------------------------------

interface Circle {
  name: string;
  x: number;
  y: number;
  r: number;
  size: number;
  color: string;
}

export class VennChart extends MarkChart<VennOptions> {
  readonly type = 'venn' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  private circles: Circle[] = [];
  private hoverSets: string[] = [];

  private names(): string[] {
    return this.opts.data.filter((d) => d.sets.length === 1).map((d) => d.sets[0]).slice(0, 3);
  }

  protected legendItems(): LegendItem[] {
    return this.names().map((n, i) => ({ name: n, color: this.color(i) }));
  }

  private sizeOf(sets: string[]): number | undefined {
    const key = [...sets].sort().join('∩');
    return this.opts.data.find((d) => [...d.sets].sort().join('∩') === key)?.size;
  }

  protected marks(b: MarkBuilder) {
    const names = this.names();
    const rad = names.map((n) => Math.sqrt((this.sizeOf([n]) ?? 0) / Math.PI));
    const dist = (i: number, j: number) => distanceForOverlap(rad[i], rad[j], this.sizeOf([names[i], names[j]]) ?? 0);
    const pos: [number, number][] = [[0, 0]];
    if (names.length > 1) pos.push([dist(0, 1), 0]);
    if (names.length > 2) {
      const dAB = dist(0, 1);
      const dAC = dist(0, 2);
      const dBC = dist(1, 2);
      const x = (dAC * dAC - dBC * dBC + dAB * dAB) / (2 * dAB || 1);
      pos.push([x, Math.sqrt(Math.max(0, dAC * dAC - x * x))]);
    }
    // Fit into the plot.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pos.forEach(([x, y], i) => {
      x0 = Math.min(x0, x - rad[i]);
      x1 = Math.max(x1, x + rad[i]);
      y0 = Math.min(y0, y - rad[i]);
      y1 = Math.max(y1, y + rad[i]);
    });
    const W = this.plot.width;
    const H = this.plot.height;
    const k = Math.min((W - 24) / (x1 - x0 || 1), (H - 24) / (y1 - y0 || 1));
    const ox = (W - (x1 - x0) * k) / 2 - x0 * k;
    const oy = (H - (y1 - y0) * k) / 2 - y0 * k;
    this.circles = names.map((name, i) => ({ name, x: ox + pos[i][0] * k, y: oy + pos[i][1] * k, r: rad[i] * k, size: this.sizeOf([name]) ?? 0, color: this.color(i) }));
    const gcx = this.circles.reduce((s, c) => s + c.x, 0) / (this.circles.length || 1);
    const gcy = this.circles.reduce((s, c) => s + c.y, 0) / (this.circles.length || 1);
    for (const c of this.circles) {
      if (this.hidden.has(c.name)) continue;
      b.sector(c.x, c.y, 0, c.r, 0, TAU, c.color, 0.25);
      b.arc(c.x, c.y, c.r, 0, TAU, c.color, 2);
      // Set label pushed away from the group's center.
      const dx = c.x - gcx;
      const dy = c.y - gcy;
      const L = Math.hypot(dx, dy) || 1;
      const lx = this.circles.length > 1 ? c.x + (dx / L) * c.r * 0.55 : c.x;
      const ly = this.circles.length > 1 ? c.y + (dy / L) * c.r * 0.55 : c.y;
      b.text(c.name, lx, ly - 8, 0.5, 0.5, true, { weight: 600 });
      b.text(formatNumber(c.size), lx, ly + 8, 0.5, 0.5);
    }
    // Intersection labels at the centroid of each exact region.
    for (const d of this.opts.data) {
      if (d.sets.length < 2) continue;
      const inSet = new Set(d.sets);
      let sx = 0, sy = 0, cnt = 0;
      const G = 60;
      for (let gx = 0; gx < G; gx++) for (let gy = 0; gy < G; gy++) {
        const x = (gx / (G - 1)) * W;
        const y = (gy / (G - 1)) * H;
        const member = this.circles.filter((c) => (x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r).map((c) => c.name);
        if (member.length === inSet.size && member.every((m) => inSet.has(m))) {
          sx += x;
          sy += y;
          cnt++;
        }
      }
      if (cnt) b.text(formatNumber(d.size), sx / cnt, sy / cnt, 0.5, 0.5, true);
    }
    // One region covering everything; hitTest works out membership itself.
    b.region({ k: 'rect', x0: 0, y0: 0, x1: W, y1: H, hit: { series: '', index: 0, values: {} } });
  }

  protected hitTest(px: number, py: number): Hit | null {
    const x = px - this.plot.left;
    const y = py - this.plot.top;
    const sets = this.circles.filter((c) => !this.hidden.has(c.name) && (x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r).map((c) => c.name);
    this.hoverSets = sets;
    if (!sets.length) return null;
    const size = this.sizeOf(sets);
    const total = this.circles.reduce((s, c) => s + c.size, 0);
    return {
      series: sets.join(' ∩ '),
      index: 0,
      values: { [sets.length > 1 ? 'Shared' : 'Total']: size !== undefined ? formatNumber(size) : '–', ...(sets.length === 1 ? { 'Share of all sets': `${(((size ?? 0) / (total || 1)) * 100).toFixed(1)}%` } : {}) },
    };
  }

  protected highlight(hit: Hit | null) {
    this.clearHighlight();
    if (!hit) return;
    const svg = this.overlay.querySelector('svg.tc-hl')!;
    for (const c of this.circles) {
      if (!this.hoverSets.includes(c.name)) continue;
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      el.setAttribute('cx', String(this.plot.left + c.x));
      el.setAttribute('cy', String(this.plot.top + c.y));
      el.setAttribute('r', String(c.r));
      el.setAttribute('fill', this.theme.textPrimary);
      el.setAttribute('fill-opacity', '0.12');
      el.setAttribute('stroke', this.theme.textPrimary);
      el.setAttribute('stroke-opacity', '0.45');
      el.setAttribute('stroke-width', '1.5');
      svg.appendChild(el);
    }
  }
}
