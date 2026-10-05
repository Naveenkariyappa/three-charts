import type { Hit, LegendItem } from '../base';
import { descendants, hierarchy, leaves, tree, type HNode } from '../layouts';
import { MarkChart, polar, type MarkBuilder } from '../markchart';
import { extent, formatNumber } from '../scale';
import { bezier } from '../stats';
import { sampleRamp } from '../theme';
import type { EdgeBundlingOptions, LiquidGaugeOptions, ParliamentOptions, RadialHeatmapOptions, RadialTreeOptions, VariablePieOptions } from '../types2';

const TAU = Math.PI * 2;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Index of the top-level branch a node sits under. */
function branchOf(n: HNode, root: HNode): number {
  let top = n;
  while (top.parent && top.parent !== root) top = top.parent;
  return Math.max(0, root.children.indexOf(top));
}

/** Leaf label pointing outward from the center, readable on both halves of the circle. */
function radialLabel(b: MarkBuilder, text: string, cx: number, cy: number, r: number, a: number, maxWidth = 120) {
  const deg = (a * 180) / Math.PI;
  const right = a < Math.PI;
  const [x, y] = polar(cx, cy, r + 6, a);
  b.text(text, x, y, right ? 0 : 1, 0.5, false, { rotate: right ? deg - 90 : deg + 90, maxWidth });
}

// ---- Variable-radius pie ------------------------------------------------------------------------------

/** Slice angle shows one value, slice length a second (e.g. area vs population density). */
export class VariablePieChart extends MarkChart<VariablePieOptions> {
  readonly type = 'variablePie' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected legendItems(): LegendItem[] {
    return this.opts.data.map((d, i) => ({ name: d.label, color: this.color(i, d.color) }));
  }

  protected marks(b: MarkBuilder) {
    const { data, valueName = 'Value', zName = 'Size' } = this.opts;
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.max(20, Math.min(W, H) / 2 - 26);
    const vis = data.map((d, i) => ({ d, i, color: this.color(i, d.color) })).filter(({ d }) => !this.hidden.has(d.label));
    const total = vis.reduce((s, v) => s + Math.max(0, v.d.value), 0) || 1;
    const [zlo, zhi] = extent(vis.map((v) => v.d.z));
    const r0 = R * (this.opts.innerRadius ?? 0.3) * 0.6;
    const radius = (z: number) => r0 + (R - r0) * (0.35 + 0.65 * (zhi > zlo ? (z - zlo) / (zhi - zlo) : 1));
    let a = 0;
    for (const { d, i, color } of vis) {
      const span = (Math.max(0, d.value) / total) * TAU;
      const r = radius(d.z);
      b.sector(cx, cy, r0, r, a, a + span, color, 1, 2);
      const mid = a + span / 2;
      if (span > 0.25) {
        const [lx, ly] = polar(cx, cy, r + 10, mid);
        b.text(d.label, lx, ly, Math.sin(mid) > 0.3 ? 0 : Math.sin(mid) < -0.3 ? 1 : 0.5, 0.5, false, { maxWidth: 90 });
      }
      b.region({
        k: 'sector',
        cx,
        cy,
        r0,
        r1: r,
        a0: a,
        a1: a + span,
        hit: { series: d.label, index: i, color, values: { [valueName]: d.value, [zName]: d.z }, rows: [{ label: valueName, value: `${formatNumber(d.value)} (${pct(d.value / total)})`, color }, { label: zName, value: formatNumber(d.z) }] },
      });
      a += span;
    }
  }
}

// ---- Parliament / item chart ---------------------------------------------------------------------------

/** One dot per seat (or item), grouped by party around a half circle or in a grid. */
export class ParliamentChart extends MarkChart<ParliamentOptions> {
  readonly type = 'parliament' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 4;

  protected legendItems(): LegendItem[] {
    return this.opts.data.map((d, i) => ({ name: d.label, color: this.color(i, d.color) }));
  }

  /** Seat centers, ordered left to right so each party gets a wedge. */
  private arcSeats(N: number, W: number, H: number): { x: number; y: number; d: number }[] {
    const cx = W / 2;
    const cy = H - 24;
    const R = Math.max(20, Math.min(W / 2, cy) - 4);
    const inner = R * 0.36;
    for (let rows = 1; rows < 60; rows++) {
      const dr = rows > 1 ? (R - inner) / (rows - 1) : R - inner;
      const d = Math.min(dr * 0.86, rows > 1 ? Infinity : (R - inner) * 0.8);
      const caps: number[] = [];
      for (let k = 0; k < rows; k++) caps.push(Math.max(1, Math.floor((Math.PI * (inner + k * dr)) / (d * 1.12)) + 1));
      const cap = caps.reduce((s, c) => s + c, 0);
      if (cap < N) continue;
      // Share seats across rows in proportion to their capacity.
      const per = caps.map((c) => Math.floor((c / cap) * N));
      let left = N - per.reduce((s, c) => s + c, 0);
      for (let k = rows - 1; left > 0; k = (k - 1 + rows) % rows) {
        if (per[k] < caps[k]) {
          per[k]++;
          left--;
        }
      }
      const seats: { x: number; y: number; d: number; a: number }[] = [];
      per.forEach((m, k) => {
        const r = inner + k * dr;
        for (let j = 0; j < m; j++) {
          const a = m > 1 ? (Math.PI * j) / (m - 1) : Math.PI / 2;
          seats.push({ x: cx - Math.cos(a) * r, y: cy - Math.sin(a) * r, d, a });
        }
      });
      return seats.sort((p, q) => p.a - q.a);
    }
    return [];
  }

  protected marks(b: MarkBuilder) {
    const W = this.plot.width;
    const H = this.plot.height;
    const parties = this.opts.data.map((d, i) => ({ d, i, n: Math.max(0, Math.round(d.value)), color: this.color(i, d.color) }));
    const N = parties.reduce((s, p) => s + p.n, 0);
    if (!N) return;
    let seats: { x: number; y: number; d: number }[];
    if ((this.opts.layout ?? 'arc') === 'grid') {
      const cols = Math.max(1, Math.ceil(Math.sqrt((N * W) / H)));
      const rows = Math.ceil(N / cols);
      const step = Math.min(W / cols, H / rows);
      const ox = (W - step * cols) / 2;
      seats = Array.from({ length: N }, (_, k) => ({ x: ox + (k % cols) * step + step / 2, y: Math.floor(k / cols) * step + step / 2, d: step * 0.8 }));
    } else seats = this.arcSeats(N, W, H);
    let k = 0;
    for (const p of parties) {
      for (let j = 0; j < p.n && k < seats.length; j++, k++) {
        const s = seats[k];
        const off = this.hidden.has(p.d.label);
        b.point(s.x, s.y, off ? this.theme.grid : p.color, Math.max(2, s.d), 'disc');
        b.region({ k: 'circle', x: s.x, y: s.y, r: Math.max(3, s.d / 2), hit: { series: p.d.label, index: p.i, color: p.color, values: { Seats: p.n }, rows: [{ label: 'Seats', value: `${p.n} of ${N}`, color: p.color }, { label: 'Share', value: pct(p.n / N) }] } });
      }
    }
    if ((this.opts.layout ?? 'arc') === 'arc') {
      b.text(String(N), W / 2, H - 30, 0.5, 1, true, { size: 22, weight: 600, color: this.theme.textPrimary });
      b.text(`Majority ${Math.floor(N / 2) + 1}`, W / 2, H - 24, 0.5, 0);
    }
  }
}

// ---- Radial tree -----------------------------------------------------------------------------------------

/** A tree laid out around a circle: root at the center, leaves on the rim. */
export class RadialTreeChart extends MarkChart<RadialTreeOptions> {
  readonly type = 'radialTree' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected legendItems(): LegendItem[] {
    return (this.opts.data.children ?? []).map((c, i) => ({ name: c.name, color: c.color ?? this.color(i) }));
  }

  protected marks(b: MarkBuilder) {
    const root = hierarchy(this.opts.data, false);
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const ls = leaves(root);
    // Label leaves only when each gets ~11 px of rim; otherwise names live in the tooltip.
    const labels = (TAU * (Math.min(W, H) / 2 - 80)) / Math.max(1, ls.length) >= 11;
    const R = Math.max(30, Math.min(W, H) / 2 - (labels ? 80 : 10));
    tree(root, TAU, R, false);
    const P = (n: HNode) => polar(cx, cy, n.y, n.x);
    const all = descendants(root);
    for (const n of all) {
      if (!n.parent) continue;
      const p = n.parent;
      const mid = (p.y + n.y) / 2;
      const [x0, y0] = P(p);
      const [c1x, c1y] = polar(cx, cy, mid, p.x);
      const [c2x, c2y] = polar(cx, cy, mid, n.x);
      const [x1, y1] = P(n);
      b.softLine(bezier(x0, y0, c1x, c1y, c2x, c2y, x1, y1, 16), this.color(branchOf(n, root)), 1.5, 0.6);
    }
    all.forEach((n, i) => {
      const [x, y] = P(n);
      const color = n === root ? this.theme.textPrimary : this.color(branchOf(n, root));
      b.point(x, y, color, n.children.length ? 6 : 5, 'disc');
      if (labels && !n.children.length) radialLabel(b, n.name, cx, cy, n.y, n.x, 80);
      const path: string[] = [];
      for (let q: HNode | null = n; q; q = q.parent) path.unshift(q.name);
      b.region({ k: 'circle', x, y, r: 6, hit: { series: n.name, index: i, color, title: path.join(' › '), values: { Children: n.children.length }, rows: [{ label: 'Children', value: String(n.children.length) }, { label: 'Leaves below', value: String(leaves(n).length) }] } });
    });
  }
}

// ---- Hierarchical edge bundling ---------------------------------------------------------------------------

/** Uniform cubic B-spline through control points (ends clamped). */
function bspline(pts: [number, number][], steps = 8): number[] {
  const p = [pts[0], pts[0], ...pts, pts[pts.length - 1], pts[pts.length - 1]];
  const out: number[] = [];
  for (let i = 0; i + 3 < p.length; i++) {
    for (let s = i ? 1 : 0; s <= steps; s++) {
      const t = s / steps;
      const b0 = (1 - t) ** 3 / 6;
      const b1 = (3 * t ** 3 - 6 * t * t + 4) / 6;
      const b2 = (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6;
      const b3 = t ** 3 / 6;
      out.push(b0 * p[i][0] + b1 * p[i + 1][0] + b2 * p[i + 2][0] + b3 * p[i + 3][0], b0 * p[i][1] + b1 * p[i + 1][1] + b2 * p[i + 2][1] + b3 * p[i + 3][1]);
    }
  }
  return out;
}

/** Links between the leaves of a hierarchy, bent along the tree so related links bundle together. */
export class EdgeBundlingChart extends MarkChart<EdgeBundlingOptions> {
  readonly type = 'edgeBundling' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  private paths = new Map<string, number[][]>();

  protected legendItems(): LegendItem[] {
    return (this.opts.data.children ?? []).map((c, i) => ({ name: c.name, color: c.color ?? this.color(i) }));
  }

  protected marks(b: MarkBuilder) {
    const root = hierarchy(this.opts.data, false);
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const ls = leaves(root);
    // Label leaves only when each gets ~11 px of rim; otherwise names live in the tooltip.
    const labels = (TAU * (Math.min(W, H) / 2 - 80)) / Math.max(1, ls.length) >= 11;
    const R = Math.max(30, Math.min(W, H) / 2 - (labels ? 80 : 10));
    tree(root, TAU, R, true);
    const byName = new Map(ls.map((l) => [l.name, l]));
    const beta = this.opts.bundle ?? 0.85;
    const P = (n: HNode): [number, number] => polar(cx, cy, n.y, n.x);
    const degree = new Map<string, number>();
    this.paths.clear();
    for (const link of this.opts.links) {
      const s = byName.get(link.source);
      const t = byName.get(link.target);
      if (!s || !t || s === t) continue;
      if (this.hidden.has(root.children[branchOf(s, root)]?.name ?? '')) continue;
      // Path through the tree: source up to the common ancestor, then down to the target.
      const up: HNode[] = [];
      for (let q: HNode | null = s; q; q = q.parent) up.push(q);
      const down: HNode[] = [];
      let lca: HNode | null = t;
      while (lca && !up.includes(lca)) {
        down.unshift(lca);
        lca = lca.parent;
      }
      const chain = [...up.slice(0, up.indexOf(lca!) + 1), ...down].map(P);
      // Straighten toward the direct line by (1 - beta).
      const m = chain.length - 1;
      const [ax, ay] = chain[0];
      const [bx, by] = chain[m];
      const ctrl = chain.map(([x, y], i) => [beta * x + (1 - beta) * (ax + ((bx - ax) * i) / m), beta * y + (1 - beta) * (ay + ((by - ay) * i) / m)] as [number, number]);
      const pts = bspline(ctrl);
      b.softLine(pts, this.color(branchOf(s, root)), 1.2, 0.45);
      for (const name of [s.name, t.name]) {
        (this.paths.get(name) ?? this.paths.set(name, []).get(name)!).push(pts);
        degree.set(name, (degree.get(name) ?? 0) + 1);
      }
    }
    ls.forEach((l, i) => {
      const [x, y] = P(l);
      const color = this.color(branchOf(l, root));
      b.point(x, y, color, 5, 'disc');
      if (labels) radialLabel(b, l.name, cx, cy, l.y, l.x, 80);
      b.region({ k: 'circle', x, y, r: 6, hit: { series: l.name, index: i, color, title: l.name, values: { Links: degree.get(l.name) ?? 0 }, rows: [{ label: 'Links', value: String(degree.get(l.name) ?? 0), color }, ...(l.parent && l.parent !== root ? [{ label: 'Group', value: l.parent.name }] : [])] } });
    });
  }

  protected highlight(hit: Hit | null) {
    super.highlight(hit);
    if (!hit) return;
    for (const pts of this.paths.get(hit.series) ?? []) this.drawOutline({ k: 'path', pts, tol: 0 }, true);
  }
}

// ---- Radial heatmap --------------------------------------------------------------------------------------

/** A heatmap bent into rings: cyclic data such as hour of day by weekday. */
export class RadialHeatmapChart extends MarkChart<RadialHeatmapOptions> {
  readonly type = 'radialHeatmap' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected customLegend() {
    const [lo, hi] = extent(this.opts.data);
    const el = document.createElement('div');
    el.className = 'tc-ramp';
    el.innerHTML = `<span>${formatNumber(lo)}</span><i style="background:linear-gradient(90deg,${this.theme.sequential.join(',')})"></i><span>${formatNumber(hi)}</span>`;
    return el;
  }

  protected marks(b: MarkBuilder) {
    const { angles, rings, data } = this.opts;
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.max(30, Math.min(W, H) / 2 - 24);
    const r0 = R * 0.24;
    const ringW = (R - r0) / Math.max(1, rings.length);
    const step = TAU / Math.max(1, angles.length);
    const [lo, hi] = extent(data);
    rings.forEach((ring, k) => {
      angles.forEach((ang, j) => {
        const v = data[k * angles.length + j];
        if (v === undefined) return;
        const color = '#' + sampleRamp(this.theme.sequential, hi > lo ? (v - lo) / (hi - lo) : 0.5).getHexString();
        const a0 = j * step;
        const ra = r0 + k * ringW;
        b.sector(cx, cy, ra + 0.75, ra + ringW - 0.75, a0, a0 + step, color, 1, 1.5);
        b.region({ k: 'sector', cx, cy, r0: ra, r1: ra + ringW, a0, a1: a0 + step, hit: { series: `${ring} · ${ang}`, index: k * angles.length + j, color, values: { Value: v }, rows: [{ label: ring, value: '' }, { label: ang, value: formatNumber(v), color }] } });
      });
      if (ringW >= 10) b.text(ring, cx - 4, cy - (r0 + (k + 0.5) * ringW), 1, 0.5, false, { size: 10 });
    });
    const every = Math.max(1, Math.ceil(angles.length / 24));
    angles.forEach((ang, j) => {
      if (j % every) return;
      const mid = (j + 0.5) * step;
      const [x, y] = polar(cx, cy, R + 12, mid);
      b.text(ang, x, y, 0.5, 0.5, false, { size: 10 });
    });
  }
}

// ---- Liquid fill gauge ------------------------------------------------------------------------------------

/** A single value as a liquid level in a circle or tank. */
export class LiquidGaugeChart extends MarkChart<LiquidGaugeOptions> {
  readonly type = 'liquidGauge' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected marks(b: MarkBuilder) {
    const { value, min = 0, max = 100, label, format } = this.opts;
    const W = this.plot.width;
    const H = this.plot.height;
    const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
    const color = this.color(0);
    const text = format ? format(value) : max === 100 && min === 0 ? `${Math.round(value)}%` : formatNumber(value);
    const cx = W / 2;
    const tank = this.opts.shape === 'tank';
    const R = Math.max(20, Math.min(W, H) / 2 - 8);
    const cy = H / 2;
    const top: number[] = [];
    const bot: number[] = [];
    if (tank) {
      const w = Math.min(W - 16, R * 1.4);
      const x0 = cx - w / 2;
      const y0 = 8;
      const y1 = H - 8;
      b.line([x0, y0, x0 + w, y0, x0 + w, y1, x0, y1], this.theme.axis, 2, 1, true);
      const level = y1 - 3 - (y1 - y0 - 6) * t;
      for (let k = 0; k <= 48; k++) {
        const x = x0 + 3 + ((w - 6) * k) / 48;
        top.push(x, Math.min(y1 - 3, level + Math.sin((k / 48) * Math.PI * 4) * (t > 0 && t < 1 ? 3 : 0)));
        bot.push(x, y1 - 3);
      }
    } else {
      b.arc(cx, cy, R, 0, TAU, color, 2);
      const Ri = R - 6;
      const level = cy + Ri - 2 * Ri * t;
      const amp = t > 0 && t < 1 ? Ri * 0.04 : 0;
      for (let k = 0; k <= 64; k++) {
        const dx = -Ri + (2 * Ri * k) / 64;
        const half = Math.sqrt(Math.max(0, Ri * Ri - dx * dx));
        const wave = level + Math.sin((dx / Ri) * Math.PI * 1.5) * amp;
        top.push(cx + dx, Math.max(cy - half, Math.min(cy + half, wave)));
        bot.push(cx + dx, cy + half);
      }
    }
    b.band(top, bot, color, 0.75);
    b.text(text, cx, cy, 0.5, 0.5, true, { size: Math.round(Math.max(14, Math.min(R * 0.36, 44))), weight: 700, color: this.theme.textPrimary });
    if (label) b.text(label, cx, cy + Math.max(14, Math.min(R * 0.36, 44)) * 0.75, 0.5, 0, false);
    b.region({ k: 'rect', x0: cx - R, y0: cy - R, x1: cx + R, y1: cy + R, hit: { series: label ?? 'Value', index: 0, color, values: { Value: value }, rows: [{ label: label ?? 'Value', value: text, color }, { label: 'Range', value: `${formatNumber(min)} – ${formatNumber(max)}` }] } });
  }
}
