import * as THREE from 'three';
import { CartesianChart } from '../cartesian';
import type { Hit, LegendItem } from '../base';
import { createPoints } from '../marks';
import { extent, niceDomain } from '../scale';
import type { BubbleOptions, ScatterOptions, ScatterSeries } from '../types';

/**
 * Uniform grid over the data domain so hover finds the nearest point by
 * scanning a few cells instead of every point.
 */
class GridIndex {
  readonly size = 128;
  private starts = new Uint32Array(0);
  private items = new Uint32Array(0);
  private x0 = 0;
  private y0 = 0;
  private cw = 1;
  private ch = 1;

  constructor(
    private series: { s: ScatterSeries; si: number }[],
    domain: { x0: number; x1: number; y0: number; y1: number },
  ) {
    const G = this.size;
    this.x0 = domain.x0;
    this.y0 = domain.y0;
    this.cw = (domain.x1 - domain.x0) / G || 1;
    this.ch = (domain.y1 - domain.y0) / G || 1;
    let total = 0;
    for (const { s } of series) total += s.x.length;
    // Counting sort of (series, index) pairs into cells; items store a packed id.
    const counts = new Uint32Array(G * G + 1);
    const cellOf = new Uint32Array(total);
    let k = 0;
    for (const { s } of series) {
      for (let i = 0; i < s.x.length; i++, k++) {
        const c = this.cell(s.x[i], s.y[i]);
        cellOf[k] = c;
        counts[c + 1]++;
      }
    }
    for (let i = 1; i <= G * G; i++) counts[i] += counts[i - 1];
    this.starts = counts.slice();
    const fill = counts.slice();
    this.items = new Uint32Array(total);
    for (let j = 0; j < total; j++) this.items[fill[cellOf[j]]++] = j;
  }

  private cell(x: number, y: number) {
    const G = this.size;
    const cx = Math.min(G - 1, Math.max(0, Math.floor((x - this.x0) / this.cw)));
    const cy = Math.min(G - 1, Math.max(0, Math.floor((y - this.y0) / this.ch)));
    return cy * G + cx;
  }

  /** Visit candidate global ids inside the data-space box. */
  query(x0: number, y0: number, x1: number, y1: number, visit: (id: number) => void) {
    const G = this.size;
    const cx0 = Math.max(0, Math.floor((x0 - this.x0) / this.cw));
    const cx1 = Math.min(G - 1, Math.floor((x1 - this.x0) / this.cw));
    const cy0 = Math.max(0, Math.floor((y0 - this.y0) / this.ch));
    const cy1 = Math.min(G - 1, Math.floor((y1 - this.y0) / this.ch));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = cy * G + cx;
        for (let j = this.starts[c]; j < this.starts[c + 1]; j++) visit(this.items[j]);
      }
    }
  }

  /** Map a global id back to (series slot, point index). */
  resolve(id: number): [number, number] {
    for (let k = 0; k < this.series.length; k++) {
      const n = this.series[k].s.x.length;
      if (id < n) return [k, id];
      id -= n;
    }
    return [-1, -1];
  }
}

/** Scatter and bubble charts. 1M points render in one draw call per series. */
export class ScatterChart extends CartesianChart<ScatterOptions | BubbleOptions> {
  readonly type: 'scatter' | 'bubble';
  protected defaultZoom: 'x' | 'xy' | false = 'xy';
  private visible: { s: ScatterSeries; si: number; color: string }[] = [];
  private points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private index: GridIndex | null = null;
  private sizeRange: [number, number] = [0, 1];
  private hover: { px: number; py: number; color: string } | null = null;

  constructor(container: HTMLElement, options: ScatterOptions | BubbleOptions) {
    super(container, options);
    this.type = options.type;
  }

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  private total() {
    return this.visible.reduce((n, v) => n + v.s.x.length, 0);
  }

  protected computeDomain() {
    this.visible = this.opts.series
      .map((s, si) => ({ s, si, color: this.color(si, s.color) }))
      .filter((v) => !this.hidden.has(v.s.name) && v.s.x.length);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let s0 = Infinity;
    let s1 = -Infinity;
    for (const { s } of this.visible) {
      const [a, b] = extent(s.x);
      const [c, d] = extent(s.y);
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, b);
      y0 = Math.min(y0, c);
      y1 = Math.max(y1, d);
      if (s.size) {
        const [e, f] = extent(s.size);
        s0 = Math.min(s0, e);
        s1 = Math.max(s1, f);
      }
    }
    if (!isFinite(x0)) [x0, x1, y0, y1] = [0, 1, 0, 1];
    this.sizeRange = [isFinite(s0) ? s0 : 0, isFinite(s1) ? s1 : 1];
    const [nx0, nx1] = niceDomain(x0, x1);
    const [ny0, ny1] = niceDomain(y0, y1);
    this.full = { x0: nx0, x1: nx1, y0: ny0, y1: ny1 };
  }

  protected buildMarks() {
    const o = this.origin;
    const total = this.total();
    const big = total > 100_000;
    const size = (this.opts.pointSize ?? (big ? 3 : total > 10_000 ? 5 : 8)) * this.dpr;
    const opacity = this.opts.opacity ?? (big ? 0.55 : this.type === 'bubble' ? 0.75 : 0.9);
    const [r0, r1] = this.opts.sizeRange ?? [8, 48];
    const [s0, s1] = this.sizeRange;
    this.points = [];
    for (const { s, color } of this.visible) {
      const n = s.x.length;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = s.x[i] - o.x;
        pos[i * 3 + 1] = s.y[i] - o.y;
      }
      let sizes: Float32Array | undefined;
      if (this.type === 'bubble' && s.size) {
        sizes = new Float32Array(n);
        // Area-proportional: diameter grows with sqrt of the value.
        for (let i = 0; i < n; i++) {
          const t = s1 > s0 ? (s.size[i] - s0) / (s1 - s0) : 1;
          sizes[i] = (r0 + (r1 - r0) * Math.sqrt(Math.max(0, t))) * this.dpr;
        }
      }
      const p = createPoints({
        positions: pos,
        color,
        size,
        sizes,
        opacity,
        ring: this.theme.surface,
        ringWidth: big ? 0 : (this.type === 'bubble' ? 1.5 : 1) * this.dpr,
      });
      this.scene.add(p);
      this.points.push(p);
    }
    this.index = new GridIndex(this.visible, this.full);
  }

  protected onProgress() {
    for (const p of this.points) p.material.uniforms.uScale.value = this.progress;
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py) || !this.index) return null;
    const radius = this.type === 'bubble' ? (this.opts.sizeRange?.[1] ?? 48) / 2 : 10;
    const [ax, ay] = this.toData(px - radius, py + radius);
    const [bx, by] = this.toData(px + radius, py - radius);
    let best = -1;
    let bestD = Infinity;
    const v = this.view;
    const sx = this.plot.width / (v.x1 - v.x0);
    const sy = this.plot.height / (v.y1 - v.y0);
    const [cx, cy] = this.toData(px, py);
    const idx = this.index;
    const visible = this.visible;
    let budget = 200_000; // keep hover snappy even in pathological clusters
    idx.query(ax, ay, bx, by, (id) => {
      if (budget-- <= 0) return;
      const [k, i] = idx.resolve(id);
      const s = visible[k].s;
      const dx = (s.x[i] - cx) * sx;
      const dy = (s.y[i] - cy) * sy;
      let d = Math.hypot(dx, dy);
      if (this.type === 'bubble' && s.size) d -= this.bubbleRadius(s.size[i]);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    });
    if (best < 0 || bestD > (this.type === 'bubble' ? 4 : 10)) return null;
    const [k, i] = idx.resolve(best);
    const { s, color } = visible[k];
    const [hx, hy] = this.toPx(s.x[i], s.y[i]);
    this.hover = { px: hx, py: hy, color };
    const values: Record<string, string> = { x: this.formatX(s.x[i]), y: this.formatY(s.y[i]) };
    if (s.size) values.size = this.formatY(s.size[i]);
    return { series: s.name, index: i, values, color, rows: Object.entries(values).map(([label, value]) => ({ label, value })) };
  }

  private bubbleRadius(v: number) {
    const [r0, r1] = this.opts.sizeRange ?? [8, 48];
    const [s0, s1] = this.sizeRange;
    const t = s1 > s0 ? (v - s0) / (s1 - s0) : 1;
    return (r0 + (r1 - r0) * Math.sqrt(Math.max(0, t))) / 2;
  }

  protected highlight(hit: Hit | null) {
    if (!hit || !this.hover || this.type === 'bubble') return this.showDot(null);
    this.showDot(this.hover.px, this.hover.py, this.hover.color);
  }

  protected onViewChange() {
    this.showDot(null);
  }
}
