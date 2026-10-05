import * as THREE from 'three';
import { CartesianChart } from '../cartesian';
import type { Hit, LegendItem } from '../base';
import { createLine, revealLine, setLineResolution, type Line2 } from '../marks';
import { extent, formatNumber, nearestIndex, niceDomain } from '../scale';
import { monotoneCurve } from '../stats';
import type { AreaOptions, LineOptions, Numbers } from '../types';

interface Prepared {
  name: string;
  color: string;
  x: Numbers | null;
  /** Original values (tooltips). */
  y: Numbers;
  /** Drawn upper edge (= y unless stacked). */
  top: Numbers;
  /** Drawn lower edge for areas (null = the zero baseline). */
  bot: Numbers | null;
}

/** Smoothing is skipped above this many points; at that density it can't be seen anyway. */
const SMOOTH_LIMIT = 20_000;

/**
 * Line and area charts. Handles 1M+ points per series; zoom/pan never re-uploads.
 * Areas can stack (`stacked: true`), normalize to 100% (`'percent'`) or center as a streamgraph (`'stream'`).
 */
export class LineChart extends CartesianChart<LineOptions | AreaOptions> {
  readonly type: 'line' | 'area';
  private prepared: Prepared[] = [];
  private lines: Line2[] = [];
  private fills: THREE.Mesh[] = [];
  private hover: { px: number; py: number; color: string } | null = null;

  constructor(container: HTMLElement, options: LineOptions | AreaOptions) {
    super(container, options);
    this.type = options.type;
    this.animDuration = 900;
  }

  private stackMode(): false | true | 'percent' | 'stream' {
    return this.type === 'area' ? ((this.opts as AreaOptions).stacked ?? false) : false;
  }

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected computeDomain() {
    this.prepared = [];
    const visible = this.opts.series
      .map((s, i) => ({ s, color: this.color(i, s.color) }))
      .filter(({ s }) => !this.hidden.has(s.name) && s.y.length > 0);
    const mode = this.stackMode();

    if (mode) {
      // Stacked series share the x of the first series (or the index).
      const n = Math.min(...visible.map((v) => v.s.y.length));
      const x = visible[0]?.s.x ?? null;
      const totals = new Float64Array(n);
      for (const { s } of visible) for (let i = 0; i < n; i++) totals[i] += Math.max(0, s.y[i]);
      const base = new Float64Array(n);
      if (mode === 'stream') for (let i = 0; i < n; i++) base[i] = -totals[i] / 2;
      for (const { s, color } of visible) {
        const bot = Float64Array.from(base);
        const top = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          const v = Math.max(0, s.y[i]);
          top[i] = base[i] + (mode === 'percent' ? (totals[i] ? (v / totals[i]) * 100 : 0) : v);
          base[i] = top[i];
        }
        this.prepared.push({ name: s.name, color, x, y: s.y, top, bot });
      }
    } else {
      for (const { s, color } of visible) this.prepared.push({ name: s.name, color, x: s.x ?? null, y: s.y, top: s.y, bot: null });
    }

    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of this.prepared) {
      const [a, b] = p.x ? extent(p.x) : [0, p.y.length - 1];
      const [c, d] = extent(p.top);
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, b);
      y0 = Math.min(y0, c, p.bot ? extent(p.bot)[0] : c);
      y1 = Math.max(y1, d);
    }
    if (!isFinite(x0)) [x0, x1, y0, y1] = [0, 1, 0, 1];
    if (this.type === 'area' && mode !== 'stream') {
      y0 = Math.min(y0, 0);
      y1 = Math.max(y1, 0);
    }
    if (x0 === x1) x1 = x0 + 1;
    const [ny0, ny1] = mode === 'percent' ? [0, 100] : niceDomain(y0, y1);
    this.full = { x0, x1, y0: ny0, y1: ny1 };
  }

  protected buildMarks() {
    this.lines = [];
    this.fills = [];
    const o = this.origin;
    const width = (this.opts.lineWidth ?? 2) * this.dpr;
    const step = this.type === 'line' && (this.opts as LineOptions).step;
    const smooth = !!this.opts.smooth && !step;
    const zero = Math.min(Math.max(0, this.full.y0), this.full.y1);

    for (const s of this.prepared) {
      const n = s.top.length;
      const xAt = (i: number) => (s.x ? s.x[i] : i);
      // Build the outline as flat x,y (data units), smoothed or stepped as asked.
      let topXY: number[] | Float64Array;
      let botXY: number[] | Float64Array | null = null;
      if (smooth && n <= SMOOTH_LIMIT) {
        const xs = Float64Array.from({ length: n }, (_, i) => xAt(i));
        topXY = monotoneCurve(xs, s.top);
        if (this.type === 'area') botXY = monotoneCurve(xs, s.bot ?? new Float64Array(n).fill(zero));
      } else {
        const count = step ? n * 2 - 1 : n;
        topXY = new Float64Array(count * 2);
        let k = 0;
        for (let i = 0; i < n; i++) {
          if (step && i > 0) {
            topXY[k] = xAt(i);
            topXY[k + 1] = s.top[i - 1];
            k += 2;
          }
          topXY[k] = xAt(i);
          topXY[k + 1] = s.top[i];
          k += 2;
        }
        if (this.type === 'area') {
          botXY = new Float64Array(n * 2);
          for (let i = 0; i < n; i++) {
            botXY[i * 2] = xAt(i);
            botXY[i * 2 + 1] = s.bot ? s.bot[i] : zero;
          }
        }
      }

      const m = topXY.length / 2;
      const pos = new Float32Array(m * 3);
      for (let i = 0; i < m; i++) {
        pos[i * 3] = topXY[i * 2] - o.x;
        pos[i * 3 + 1] = topXY[i * 2 + 1] - o.y;
      }

      if (botXY) {
        const stacked = !!this.stackMode();
        const opacity = (this.opts as AreaOptions).fillOpacity ?? (stacked ? 0.85 : 0.18);
        const verts = new Float32Array(m * 6);
        const idx = new Uint32Array((m - 1) * 6);
        for (let i = 0; i < m; i++) {
          verts[i * 6] = pos[i * 3];
          verts[i * 6 + 1] = pos[i * 3 + 1];
          verts[i * 6 + 3] = botXY[i * 2] - o.x;
          verts[i * 6 + 4] = botXY[i * 2 + 1] - o.y;
          if (i < m - 1) {
            const a = i * 2;
            idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        const mat = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity, depthTest: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(g, mat);
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.fills.push(mesh);
      }

      // Stacked areas get a surface-colored edge so adjacent layers separate.
      const lineColor = this.stackMode() ? this.theme.surface : s.color;
      const line = createLine(pos, lineColor, this.stackMode() ? 1.5 * this.dpr : width);
      this.scene.add(line);
      this.lines.push(line);
    }
    setLineResolution(this.scene, this.plot.width * this.dpr, this.plot.height * this.dpr);
  }

  protected onProgress() {
    for (const l of this.lines) revealLine(l, this.progress);
    for (const f of this.fills) {
      const total = f.geometry.index!.count;
      f.geometry.setDrawRange(0, Math.floor((total * this.progress) / 6) * 6);
    }
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py) || !this.prepared.length) return null;
    const [dx, dy] = this.toData(px, py);
    const mode = this.stackMode();
    let best: { s: Prepared; i: number; d: number; x: number } | null = null;
    const rows: { s: Prepared; i: number }[] = [];
    for (const s of this.prepared) {
      const i = s.x ? nearestIndex(s.x, dx) : Math.min(s.top.length - 1, Math.max(0, Math.round(dx)));
      if (i < 0) continue;
      const x = s.x ? s.x[i] : i;
      rows.push({ s, i });
      // Stacked: the hovered layer is the one under the pointer; otherwise the nearest line.
      const inside = mode && s.bot && dy >= s.bot[i] && dy <= s.top[i];
      const [, sy] = this.toPx(x, s.top[i]);
      const d = inside ? -1 : Math.abs(sy - py);
      if (!best || d < best.d) best = { s, i, d, x };
    }
    if (!best) return null;
    const [hx, hy] = this.toPx(best.x, best.s.top[best.i]);
    this.hover = { px: hx, py: hy, color: best.s.color };
    const values: Record<string, number> = {};
    for (const r of rows) values[r.s.name] = r.s.y[r.i];
    const fmt = (r: { s: Prepared; i: number }) => {
      const raw = this.formatY(r.s.y[r.i]);
      if (mode !== 'percent' || !r.s.bot) return raw;
      return `${raw} (${formatNumber(r.s.top[r.i] - r.s.bot[r.i])}%)`;
    };
    // Stacked tooltips list layers top-down, matching the picture.
    const ordered = mode ? [...rows].reverse() : rows;
    return {
      series: best.s.name,
      index: best.i,
      title: this.formatXTip(best.x),
      values,
      rows: ordered.map((r) => ({ label: r.s.name, value: fmt(r), color: r.s.color })),
    };
  }

  protected highlight(hit: Hit | null) {
    if (!hit || !this.hover) {
      this.showCrosshair(null);
      this.showDot(null);
      return;
    }
    this.showCrosshair(this.hover.px);
    this.showDot(this.hover.px, this.hover.py, this.hover.color);
  }

  protected onViewChange() {
    // A pan/zoom moves marks under a stationary pointer; drop stale hover state.
    this.showCrosshair(null);
    this.showDot(null);
  }
}
