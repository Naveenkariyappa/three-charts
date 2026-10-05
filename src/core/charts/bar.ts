import * as THREE from 'three';
import { CartesianChart } from '../cartesian';
import type { Hit, LegendItem } from '../base';
import { createRects, ROUND_BOTTOM, ROUND_LEFT, ROUND_NONE, ROUND_RIGHT, ROUND_TOP } from '../marks';
import { extent, formatNumber, niceDomain, niceTicks } from '../scale';
import type { BarOptions, CartesianOptions, HistogramOptions } from '../types';

type RectMesh = ReturnType<typeof createRects>;

interface RectMeta {
  /** Category (or bin) index. */
  cat: number;
  series: number;
  /** Data-space rect: category-axis lo/hi, value-axis lo/hi. */
  c0: number;
  c1: number;
  v0: number;
  v1: number;
}

/** Shared plumbing for charts drawn as instanced rounded rectangles. */
abstract class RectChart<O extends CartesianOptions> extends CartesianChart<O> {
  protected mesh: RectMesh | null = null;
  protected meta: RectMeta[] = [];
  protected horizontal = false;
  protected sideGapPx = 0;
  protected stackGapPx = 0;
  protected defaultZoom: 'x' | 'xy' | false = false;

  protected makeMesh(colors: string[]) {
    const n = this.meta.length;
    const o = this.origin;
    const rects = new Float32Array(n * 4);
    const cols = new Float32Array(n * 3);
    const round = new Float32Array(n);
    const c = new THREE.Color();
    const colorCache = colors.map((s) => new THREE.Color(s));
    // Only the outermost segment of a stack gets the rounded data-end.
    const outer = new Map<string, number>();
    this.meta.forEach((m, i) => {
      const key = this.stackGapPx ? `${m.cat}:${m.v1 >= 0 ? '+' : '-'}` : String(i);
      const prev = outer.get(key);
      if (prev === undefined || Math.abs(m.v1) >= Math.abs(this.meta[prev].v1)) outer.set(key, i);
    });
    const outerSet = new Set(outer.values());
    this.meta.forEach((m, i) => {
      const neg = m.v1 < m.v0;
      if (this.horizontal) {
        rects.set([m.v0 - o.x, m.c0 - o.y, m.v1 - o.x, m.c1 - o.y], i * 4);
        round[i] = outerSet.has(i) ? (neg ? ROUND_LEFT : ROUND_RIGHT) : ROUND_NONE;
      } else {
        rects.set([m.c0 - o.x, m.v0 - o.y, m.c1 - o.x, m.v1 - o.y], i * 4);
        round[i] = outerSet.has(i) ? (neg ? ROUND_BOTTOM : ROUND_TOP) : ROUND_NONE;
      }
      c.copy(colorCache[m.series] ?? colorCache[0]);
      cols.set([c.r, c.g, c.b], i * 3);
    });
    const base = this.horizontal ? -o.x : -o.y;
    this.mesh = createRects({ rects, colors: cols, round, horizontal: this.horizontal, base });
    this.mesh.material.uniforms.uSurface.value.set(this.theme.surface);
    this.scene.add(this.mesh);
  }

  protected onProgress() {
    if (this.mesh) this.mesh.material.uniforms.uGrow.value = this.progress;
  }

  protected onViewChange() {
    if (!this.mesh) return;
    const u = this.mesh.material.uniforms;
    u.uPxPerUnit.value.copy(this.pxPerUnit());
    u.uRadius.value = 4 * this.dpr;
    u.uGap.value = this.stackGapPx * this.dpr;
    u.uSideGap.value = this.sideGapPx * this.dpr;
    u.uMinW.value = 1 * this.dpr;
  }

  protected findRect(px: number, py: number): number {
    if (!this.inPlot(px, py)) return -1;
    const [dx, dy] = this.toData(px, py);
    const c = this.horizontal ? dy : dx;
    const v = this.horizontal ? dx : dy;
    // Generous hit target: the full category slot, any value between baseline and bar end.
    for (let i = 0; i < this.meta.length; i++) {
      const m = this.meta[i];
      if (c < m.c0 || c > m.c1) continue;
      const lo = Math.min(m.v0, m.v1);
      const hi = Math.max(m.v0, m.v1);
      if (v >= lo && v <= hi) return i;
    }
    // Fall back to the nearest bar within the whole category band, so short bars
    // and the gaps between groups are still easy to hover.
    let best = -1;
    let bestD = 0.5;
    for (let i = 0; i < this.meta.length; i++) {
      const d = Math.abs((this.meta[i].c0 + this.meta[i].c1) / 2 - c);
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  protected highlight(hit: Hit | null) {
    if (!this.mesh) return;
    this.mesh.material.uniforms.uHover.value = hit ? (hit as Hit & { rect: number }).rect : -1;
    this.invalidate();
  }
}

/** Grouped, stacked, or horizontal bar chart. */
export class BarChart extends RectChart<BarOptions> {
  readonly type = 'bar' as const;
  private colors: string[] = [];

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected computeDomain() {
    const { categories, series, stacked } = this.opts;
    this.horizontal = !!this.opts.horizontal;
    this.colors = series.map((s, i) => this.color(i, s.color));
    const visible = series.map((s, i) => ({ s, i })).filter(({ s }) => !this.hidden.has(s.name));
    const n = categories.length;
    let lo = 0;
    let hi = 0;
    this.meta = [];
    const m = visible.length;
    const band = 0.8;
    const barW = stacked ? band : band / Math.max(1, m);
    const percent = stacked === 'percent';
    for (let c = 0; c < n; c++) {
      let pos = 0;
      let neg = 0;
      // 100% stacks scale each category to its total magnitude.
      const total = percent ? visible.reduce((t, { s }) => t + Math.abs(s.data[c] ?? 0), 0) || 1 : 1;
      // Horizontal charts list the first category at the top.
      const cc = this.horizontal ? n - 1 - c : c;
      visible.forEach(({ s, i }, k) => {
        const v = percent ? ((s.data[c] ?? 0) / total) * 100 : (s.data[c] ?? 0);
        let v0 = 0;
        let v1 = v;
        if (stacked) {
          if (v >= 0) {
            v0 = pos;
            v1 = pos += v;
          } else {
            v0 = neg;
            v1 = neg += v;
          }
        }
        const c0 = stacked ? cc - band / 2 : cc - band / 2 + k * barW + barW * 0.06;
        const c1 = stacked ? cc + band / 2 : c0 + barW * 0.88;
        this.meta.push({ cat: c, series: i, c0, c1, v0, v1 });
        lo = Math.min(lo, v1);
        hi = Math.max(hi, v1);
      });
    }
    this.stackGapPx = stacked ? 2 : 0;
    const [a, b] = percent ? [Math.min(0, Math.floor(lo)), Math.max(0, Math.ceil(hi))] : niceDomain(lo, hi);
    if (this.horizontal) {
      this.yCategories = [...categories].reverse();
      this.full = { x0: a, x1: b, y0: -0.5, y1: n - 0.5 };
    } else {
      this.xCategories = categories;
      this.full = { x0: -0.5, x1: n - 0.5, y0: a, y1: b };
    }
  }

  protected buildMarks() {
    this.makeMesh(this.colors);
    this.onViewChange();
  }

  protected hitTest(px: number, py: number): Hit | null {
    const i = this.findRect(px, py);
    if (i < 0) return null;
    const m = this.meta[i];
    const cat = this.opts.categories[m.cat];
    const values: Record<string, number> = {};
    const rows: Hit['rows'] = [];
    this.opts.series.forEach((s, si) => {
      if (this.hidden.has(s.name)) return;
      values[s.name] = s.data[m.cat] ?? 0;
      const v = s.data[m.cat] ?? 0;
      let text = this.formatValue(v);
      if (this.opts.stacked === 'percent') {
        const total = this.opts.series.reduce((t, x) => t + (this.hidden.has(x.name) ? 0 : Math.abs(x.data[m.cat] ?? 0)), 0) || 1;
        text += ` (${((Math.abs(v) / total) * 100).toFixed(1)}%)`;
      }
      rows.push({ label: s.name, value: text, color: this.colors[si] });
    });
    return { series: this.opts.series[m.series].name, index: m.cat, title: cat, values, rows, rect: i } as Hit;
  }

  private formatValue(v: number) {
    return this.horizontal ? this.formatX(v) : this.formatY(v);
  }
}

/** Histogram: bins a raw array of values (1M+ fine) on nice boundaries. */
export class HistogramChart extends RectChart<HistogramOptions> {
  readonly type = 'histogram' as const;
  private edges: number[] = [];
  private counts: number[] = [];
  protected defaultZoom: 'x' | 'xy' | false = 'x';

  protected computeDomain() {
    const vals = this.opts.values;
    const n = vals.length;
    const [lo, hi] = n ? extent(vals) : [0, 1];
    const target = this.opts.bins ?? Math.min(60, Math.max(10, Math.ceil(Math.log2(Math.max(1, n)) + 1) * 2));
    let edges = niceTicks(lo, hi, target);
    if (!edges.length || edges[0] > lo) edges.unshift(edges.length > 1 ? edges[0] - (edges[1] - edges[0]) : lo);
    const step = edges.length > 1 ? edges[1] - edges[0] : 1;
    while (edges[edges.length - 1] <= hi) edges.push(edges[edges.length - 1] + step);
    const counts = new Array(edges.length - 1).fill(0);
    const e0 = edges[0];
    for (let i = 0; i < n; i++) {
      const b = Math.min(counts.length - 1, Math.floor((vals[i] - e0) / step));
      if (b >= 0) counts[b]++;
    }
    this.edges = edges;
    this.counts = counts;
    this.meta = counts.map((c, i) => ({ cat: i, series: 0, c0: edges[i], c1: edges[i + 1], v0: 0, v1: c }));
    this.sideGapPx = 2;
    const [, top] = niceDomain(0, Math.max(1, ...counts));
    this.full = { x0: edges[0], x1: edges[edges.length - 1], y0: 0, y1: top };
  }

  protected buildMarks() {
    this.makeMesh([this.color(0, this.opts.color)]);
    this.onViewChange();
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    // Hit the whole bin column, not just the bar.
    const [dx] = this.toData(px, py);
    const i = this.edges.findIndex((e, k) => k < this.counts.length && dx >= e && dx < this.edges[k + 1]);
    if (i < 0) return null;
    const total = this.opts.values.length || 1;
    return {
      series: this.opts.name ?? 'Count',
      index: i,
      title: `${formatNumber(this.edges[i])} – ${formatNumber(this.edges[i + 1])}`,
      values: { Count: this.counts[i], Share: `${((this.counts[i] / total) * 100).toFixed(1)}%` },
      rect: i,
    } as Hit;
  }
}
