import * as THREE from 'three';
import type { Hit, LegendItem } from '../base';
import { chord } from '../layouts';
import { MarkChart, polar, type MarkBuilder } from '../markchart';
import { extent, formatNumber, niceDomain, niceTicks } from '../scale';
import { kde2d } from '../stats';
import { rampTexture, sampleRamp } from '../theme';
import type { ArcDiagramOptions, ChordOptions, ConnectedScatterOptions, ContourOptions, Density2DOptions, HexbinOptions, ParallelOptions, SplomOptions } from '../types2';


function rampLegend(stops: string[], lo: string, hi: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'tc-ramp';
  el.innerHTML = `<span>${lo}</span><i style="background:linear-gradient(90deg,${stops.join(',')})"></i><span>${hi}</span>`;
  return el;
}

// ---- Hexbin -------------------------------------------------------------------------------

export class HexbinChart extends MarkChart<HexbinOptions> {
  readonly type = 'hexbin' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  protected relayout = true;
  private maxCount = 1;

  protected computeDomain() {
    const [x0, x1] = niceDomain(...extent(this.opts.x));
    const [y0, y1] = niceDomain(...extent(this.opts.y));
    this.full = { x0, x1, y0, y1 };
  }

  protected customLegend() {
    return rampLegend(this.theme.sequential.slice(2), '1', formatNumber(this.maxCount));
  }

  protected marks(b: MarkBuilder) {
    const { x, y } = this.opts;
    const r = this.opts.radius ?? 10;
    const [ux, uy] = this.unitsPerPx();
    const dx = Math.sqrt(3) * r;
    const dy = 1.5 * r;
    const bins = new Map<number, { i: number; j: number; n: number }>();
    const W = 1 << 15;
    for (let k = 0; k < x.length; k++) {
      // Point in px relative to the domain origin.
      const px = (x[k] - this.full.x0) / ux;
      const py = (y[k] - this.full.y0) / uy;
      let pj = Math.round(py / dy);
      let pi = Math.round(px / dx - (pj & 1) / 2);
      const ey = py / dy - pj;
      if (Math.abs(ey) * 3 > 1) {
        // Near a row boundary: compare with the neighbour hex in the next row.
        const pj2 = pj + (ey < 0 ? -1 : 1);
        const pi2 = Math.round(px / dx - (pj2 & 1) / 2);
        const cx1 = (pi + (pj & 1) / 2) * dx, cy1 = pj * dy;
        const cx2 = (pi2 + (pj2 & 1) / 2) * dx, cy2 = pj2 * dy;
        if ((px - cx2) ** 2 + (py - cy2) ** 2 < (px - cx1) ** 2 + (py - cy1) ** 2) {
          pj = pj2;
          pi = pi2;
        }
      }
      const key = (pj + W) * 2 * W + (pi + W);
      const bin = bins.get(key);
      if (bin) bin.n++;
      else bins.set(key, { i: pi, j: pj, n: 1 });
    }
    let max = 1;
    for (const v of bins.values()) max = Math.max(max, v.n);
    this.maxCount = max;
    const ramp = this.theme.sequential.slice(2);
    const corners: [number, number][] = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      corners.push([Math.cos(a) * (r - 0.75), Math.sin(a) * (r - 0.75)]);
    }
    for (const { i, j, n } of bins.values()) {
      const cx = this.full.x0 + (i + (j & 1) / 2) * dx * ux;
      const cy = this.full.y0 + j * dy * uy;
      const color = '#' + sampleRamp(ramp, Math.sqrt(n / max)).getHexString();
      const pts: number[] = [];
      for (const [ox, oy] of corners) pts.push(cx + ox * ux, cy + oy * uy);
      for (let k = 0; k < 6; k++) {
        const k2 = (k + 1) % 6;
        b.tri(cx, cy, pts[k * 2], pts[k * 2 + 1], pts[k2 * 2], pts[k2 * 2 + 1], color);
      }
      b.region({ k: 'poly', pts, hit: { series: 'bin', index: 0, title: `${this.formatX(cx)}, ${this.formatY(cy)}`, values: { Points: formatNumber(n), 'Of all': `${((n / x.length) * 100).toFixed(2)}%` } } });
    }
  }
}

// ---- Contour (filled bands + isolines, computed per pixel on the GPU) ------------------------

const contourVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const contourFrag = /* glsl */ `
uniform sampler2D uData;
uniform sampler2D uRamp;
uniform vec2 uSize;
uniform float uLo;
uniform float uHi;
uniform float uLevels;
uniform float uGrow;
uniform float uCutoff;
uniform vec3 uLine;
varying vec2 vUv;
float fetch(vec2 i) {
  return texture2D(uData, (clamp(i, vec2(0.0), uSize - 1.0) + 0.5) / uSize).r;
}
void main() {
  // Manual bilinear filtering: float textures aren't filterable everywhere.
  vec2 p = vUv * (uSize - 1.0);
  vec2 i0 = floor(p);
  vec2 f = p - i0;
  float v = mix(mix(fetch(i0), fetch(i0 + vec2(1.0, 0.0)), f.x), mix(fetch(i0 + vec2(0.0, 1.0)), fetch(i0 + vec2(1.0, 1.0)), f.x), f.y);
  float t = clamp((v - uLo) / (uHi - uLo), 0.0, 1.0);
  if (t < uCutoff) discard;
  float lv = t * uLevels;
  float band = (floor(min(lv, uLevels - 0.001)) + 0.5) / uLevels;
  vec3 c = texture2D(uRamp, vec2(band, 0.5)).rgb;
  // Isolines: distance to the nearest level boundary in screen pixels.
  float d = abs(fract(lv - 0.5) - 0.5) / max(fwidth(lv), 1e-5);
  float line = 1.0 - smoothstep(0.4, 1.4, d);
  gl_FragColor = vec4(mix(c, uLine, line * 0.5), uGrow);
  #include <colorspace_fragment>
}`;

abstract class ContourBase<O extends ContourOptions | Density2DOptions> extends MarkChart<O> {
  protected defaultZoom: 'x' | 'xy' | false = 'xy';
  protected grid: Float32Array = new Float32Array(1);
  protected rows = 1;
  protected cols = 1;
  protected ext: [number, number, number, number] = [0, 1, 0, 1];
  protected lo = 0;
  protected hi = 1;
  protected cutoff = 0;
  private plane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;

  protected stops() {
    return (this.opts as ContourOptions).scale === 'diverging' ? this.theme.diverging : this.theme.sequential;
  }

  protected levels() {
    return this.opts.levels ?? 10;
  }

  protected customLegend() {
    return rampLegend(this.stops(), formatNumber(this.lo), formatNumber(this.hi));
  }

  protected buildMarks() {
    const tex = new THREE.DataTexture(this.grid, this.cols, this.rows, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    const [x0, x1, y0, y1] = this.ext;
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
    g.translate((x0 + x1) / 2 - this.origin.x, (y0 + y1) / 2 - this.origin.y, 0);
    const m = new THREE.ShaderMaterial({
      vertexShader: contourVert,
      fragmentShader: contourFrag,
      transparent: true,
      depthTest: false,
      uniforms: {
        uData: { value: tex },
        uRamp: { value: rampTexture(this.stops()) },
        uSize: { value: new THREE.Vector2(this.cols, this.rows) },
        uLo: { value: this.lo },
        uHi: { value: this.hi },
        uLevels: { value: this.levels() },
        uGrow: { value: 1 },
        uCutoff: { value: this.cutoff },
        uLine: { value: new THREE.Color(this.theme.textPrimary) },
      },
    });
    this.plane = new THREE.Mesh(g, m);
    this.plane.frustumCulled = false;
    this.scene.add(this.plane);
    super.buildMarks();
  }

  protected onProgress() {
    super.onProgress();
    if (this.plane) this.plane.material.uniforms.uGrow.value = this.progress;
  }

  protected valueAt(x: number, y: number): number {
    const [x0, x1, y0, y1] = this.ext;
    const fx = ((x - x0) / (x1 - x0)) * (this.cols - 1);
    const fy = ((y - y0) / (y1 - y0)) * (this.rows - 1);
    if (fx < 0 || fy < 0 || fx > this.cols - 1 || fy > this.rows - 1) return NaN;
    const i = Math.floor(fx), j = Math.floor(fy);
    const a = fx - i, c = fy - j;
    const at = (ii: number, jj: number) => this.grid[Math.min(this.rows - 1, jj) * this.cols + Math.min(this.cols - 1, ii)];
    return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - c) + (at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a) * c;
  }

  protected hitTest(px: number, py: number): Hit | null {
    const hit = super.hitTest(px, py);
    if (hit) return hit;
    if (!this.inPlot(px, py)) return null;
    const [x, y] = this.toData(px, py);
    const v = this.valueAt(x, y);
    if (v !== v) return null;
    const lvl = Math.min(this.levels() - 1, Math.floor(((v - this.lo) / (this.hi - this.lo || 1)) * this.levels()));
    const step = (this.hi - this.lo) / this.levels();
    return { series: 'value', index: 0, title: `${this.formatX(x)}, ${this.formatY(y)}`, values: { Value: formatNumber(v), Level: `${formatNumber(this.lo + lvl * step)} – ${formatNumber(this.lo + (lvl + 1) * step)}` } };
  }
}

export class ContourChart extends ContourBase<ContourOptions> {
  readonly type = 'contour' as const;

  protected computeDomain() {
    const { rows, cols, data } = this.opts;
    this.rows = rows;
    this.cols = cols;
    this.grid = data instanceof Float32Array ? data : Float32Array.from(data);
    this.ext = this.opts.extent ?? [0, cols - 1, 0, rows - 1];
    let [lo, hi] = extent(this.grid);
    if (this.opts.scale === 'diverging') {
      const m = Math.max(Math.abs(lo), Math.abs(hi));
      lo = -m;
      hi = m;
    }
    this.lo = lo;
    this.hi = hi === lo ? lo + 1 : hi;
    const [x0, x1, y0, y1] = this.ext;
    this.full = { x0, x1, y0, y1 };
  }

  protected marks() {}
}

export class Density2DChart extends ContourBase<Density2DOptions> {
  readonly type = 'density2d' as const;

  protected levels() {
    return this.opts.levels ?? 8;
  }

  protected computeDomain() {
    const { x, y } = this.opts;
    const [xa, xb] = extent(x);
    const [ya, yb] = extent(y);
    const px = (xb - xa) * 0.12;
    const py = (yb - ya) * 0.12;
    const [x0, x1] = niceDomain(xa - px, xb + px);
    const [y0, y1] = niceDomain(ya - py, yb + py);
    this.cols = 220;
    this.rows = 220;
    this.ext = [x0, x1, y0, y1];
    this.grid = kde2d(x, y, x0, x1, y0, y1, this.cols, this.rows);
    const [, hi] = extent(this.grid);
    this.lo = 0;
    this.hi = hi || 1;
    // Leave the near-zero background transparent.
    this.cutoff = 1 / this.levels();
    this.full = { x0, x1, y0, y1 };
  }

  protected marks(b: MarkBuilder) {
    const { x, y } = this.opts;
    const show = this.opts.points ?? x.length <= 5000;
    if (!show) return;
    const n = Math.min(x.length, 20000);
    for (let i = 0; i < n; i++) b.point(x[i], y[i], this.theme.textPrimary, 2.5, 'disc', 0.35);
  }
}

// ---- Connected scatter ---------------------------------------------------------------------

export class ConnectedScatterChart extends MarkChart<ConnectedScatterOptions> {
  readonly type = 'connectedScatter' as const;
  protected defaultZoom: 'x' | 'xy' | false = 'xy';
  protected relayout = true;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected computeDomain() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of this.opts.series) {
      if (this.hidden.has(s.name)) continue;
      const [a, b] = extent(s.x);
      const [c, d] = extent(s.y);
      x0 = Math.min(x0, a); x1 = Math.max(x1, b); y0 = Math.min(y0, c); y1 = Math.max(y1, d);
    }
    if (!isFinite(x0)) [x0, x1, y0, y1] = [0, 1, 0, 1];
    const [a, b] = niceDomain(x0 - (x1 - x0) * 0.05, x1 + (x1 - x0) * 0.05);
    const [c, d] = niceDomain(y0 - (y1 - y0) * 0.05, y1 + (y1 - y0) * 0.05);
    this.full = { x0: a, x1: b, y0: c, y1: d };
  }

  protected marks(b: MarkBuilder) {
    const [ux, uy] = this.unitsPerPx();
    this.opts.series.forEach((s, si) => {
      if (this.hidden.has(s.name)) return;
      const color = this.color(si, s.color);
      const n = Math.min(s.x.length, s.y.length);
      const pts: number[] = [];
      for (let i = 0; i < n; i++) pts.push(s.x[i], s.y[i]);
      b.line(pts, color, 2);
      const every = Math.max(1, Math.ceil(n / 12));
      for (let i = 0; i < n; i++) {
        b.point(s.x[i], s.y[i], color, i === n - 1 ? 10 : 7);
        const label = s.labels?.[i];
        if (label && (i % every === 0 || i === n - 1)) b.text(label, s.x[i], s.y[i], -0.12, 1.1);
        b.region({ k: 'circle', x: s.x[i], y: s.y[i], r: 6, hit: { series: s.name, index: i, color, title: label ?? s.name, values: { x: this.formatX(s.x[i]), y: this.formatY(s.y[i]) } } });
      }
      // Arrowhead on the last segment shows direction of travel.
      if (n > 1) {
        const ax = (s.x[n - 1] - s.x[n - 2]) / ux;
        const ay = (s.y[n - 1] - s.y[n - 2]) / uy;
        const L = Math.hypot(ax, ay) || 1;
        const dx = ax / L, dy = ay / L;
        const tipX = s.x[n - 1] - dx * 6 * ux, tipY = s.y[n - 1] - dy * 6 * uy;
        const baseX = tipX - dx * 10 * ux, baseY = tipY - dy * 10 * uy;
        b.tri(tipX, tipY, baseX - dy * 5 * ux, baseY + dx * 5 * uy, baseX + dy * 5 * ux, baseY - dx * 5 * uy, color);
      }
    });
  }
}

// ---- Scatterplot matrix --------------------------------------------------------------------

export class SplomChart extends MarkChart<SplomOptions> {
  readonly type = 'splom' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  private cell = 0;
  private gap = 6;
  private ox = 0;
  private ranges: [number, number][] = [];
  private hoverRow = -1;

  protected legendItems(): LegendItem[] {
    return (this.opts.groups?.names ?? []).map((n, i) => ({ name: n, color: this.color(i) }));
  }

  private colorOf(i: number) {
    const g = this.opts.groups;
    return g ? this.color(g.index[i]) : this.color(0);
  }

  private visibleRow(i: number) {
    const g = this.opts.groups;
    return !g || !this.hidden.has(g.names[g.index[i]]);
  }

  private pos(dim: number, v: number, axis: 'x' | 'y', cellIndex: number): number {
    const [lo, hi] = this.ranges[dim];
    const t = (v - lo) / (hi - lo || 1);
    const start = (axis === 'x' ? this.ox : 0) + cellIndex * this.cell + this.gap;
    const size = this.cell - this.gap * 2;
    return axis === 'x' ? start + t * size : start + (1 - t) * size;
  }

  protected marks(b: MarkBuilder) {
    const dims = this.opts.dimensions;
    const k = dims.length;
    const W = this.plot.width;
    const H = this.plot.height;
    this.cell = Math.min((W - 20) / k, (H - 18) / k);
    this.ox = 20;
    this.ranges = dims.map((d) => niceDomain(...extent(d.values), 4));
    const n = Math.min(...dims.map((d) => d.values.length));
    const size = n > 3000 ? 2.5 : n > 800 ? 3.5 : 5;
    for (let r = 0; r < k; r++) {
      for (let c = 0; c < k; c++) {
        const x0 = this.ox + c * this.cell + 2;
        const y0 = r * this.cell + 2;
        b.box(x0, y0, x0 + this.cell - 4, y0 + this.cell - 4, this.theme.grid, 0.35);
        if (r === c) {
          // Diagonal: histogram of the dimension.
          const bins = new Array(16).fill(0);
          const [lo, hi] = this.ranges[c];
          const vals = dims[c].values;
          for (let i = 0; i < n; i++) if (this.visibleRow(i)) bins[Math.min(15, Math.max(0, Math.floor(((vals[i] - lo) / (hi - lo || 1)) * 16)))]++;
          const m = Math.max(...bins, 1);
          const inner = this.cell - this.gap * 2;
          bins.forEach((v, bi) => {
            const bx = x0 - 2 + this.gap + (bi / 16) * inner;
            const h = (v / m) * inner * 0.85;
            b.rect(bx + 0.5, y0 - 2 + this.gap + inner - h, bx + inner / 16 - 0.5, y0 - 2 + this.gap + inner, this.theme.textMuted);
          });
          b.text(dims[c].name, x0 + 6, y0 + 4, 0, 0, true, { maxWidth: this.cell - 12 });
        } else {
          for (let i = 0; i < n; i++) {
            if (!this.visibleRow(i)) continue;
            b.point(this.pos(c, dims[c].values[i], 'x', c), this.pos(r, dims[r].values[i], 'y', r), this.colorOf(i), size, 'circle', 0.7);
          }
        }
      }
      b.text(dims[r].name, this.ox - 6, r * this.cell + this.cell / 2, 0.5, 1, false, { rotate: -90, maxWidth: this.cell });
    }
  }

  protected hitTest(px: number, py: number): Hit | null {
    const dims = this.opts.dimensions;
    const k = dims.length;
    const x = px - this.plot.left;
    const y = py - this.plot.top;
    const c = Math.floor((x - this.ox) / this.cell);
    const r = Math.floor(y / this.cell);
    if (c < 0 || r < 0 || c >= k || r >= k || c === r) return null;
    const n = Math.min(...dims.map((d) => d.values.length));
    let best = -1;
    let bd = 64;
    for (let i = 0; i < n; i++) {
      if (!this.visibleRow(i)) continue;
      const dx = this.pos(c, dims[c].values[i], 'x', c) - x;
      const dy = this.pos(r, dims[r].values[i], 'y', r) - y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    this.hoverRow = best;
    if (best < 0) return null;
    const g = this.opts.groups;
    return {
      series: g ? g.names[g.index[best]] : `Row ${best + 1}`,
      index: best,
      color: this.colorOf(best),
      title: g ? `${g.names[g.index[best]]} · row ${best + 1}` : `Row ${best + 1}`,
      values: Object.fromEntries(dims.map((d) => [d.name, formatNumber(d.values[best])])),
    };
  }

  protected highlight(hit: Hit | null) {
    this.clearHighlight();
    if (!hit || this.hoverRow < 0) return;
    const dims = this.opts.dimensions;
    const k = dims.length;
    // Brush the same row in every cell.
    for (let r = 0; r < k; r++) for (let c = 0; c < k; c++) {
      if (r === c) continue;
      this.drawOutline({ k: 'circle', x: this.pos(c, dims[c].values[this.hoverRow], 'x', c), y: this.pos(r, dims[r].values[this.hoverRow], 'y', r), r: 5 }, true);
    }
  }
}

// ---- Parallel coordinates ------------------------------------------------------------------

export class ParallelChart extends MarkChart<ParallelOptions> {
  readonly type = 'parallel' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  private xs: number[] = [];
  private Y: (d: number, v: number) => number = () => 0;
  private hoverPts: number[] = [];

  protected legendItems(): LegendItem[] {
    return (this.opts.groups?.names ?? []).map((n, i) => ({ name: n, color: this.color(i) }));
  }

  protected customLegend() {
    if (this.opts.groups || this.opts.colorBy === undefined) return null;
    const d = this.opts.dimensions[this.opts.colorBy];
    const [lo, hi] = extent(d.values);
    return rampLegend(this.theme.sequential.slice(3), `${d.name} ${formatNumber(lo)}`, formatNumber(hi));
  }

  private rowColor(i: number): string {
    const g = this.opts.groups;
    if (g) return this.color(g.index[i]);
    if (this.opts.colorBy !== undefined) {
      const d = this.opts.dimensions[this.opts.colorBy];
      const [lo, hi] = extent(d.values);
      return '#' + sampleRamp(this.theme.sequential.slice(3), (d.values[i] - lo) / (hi - lo || 1)).getHexString();
    }
    return this.color(0);
  }

  private rows() {
    return Math.min(...this.opts.dimensions.map((d) => d.values.length));
  }

  protected marks(b: MarkBuilder) {
    const dims = this.opts.dimensions;
    const k = dims.length;
    const W = this.plot.width;
    const H = this.plot.height;
    const top = 22;
    const bottom = H - 18;
    this.xs = dims.map((_, i) => 30 + (i / Math.max(1, k - 1)) * (W - 60));
    const ranges = dims.map((d) => niceDomain(...extent(d.values), 4));
    this.Y = (d, v) => bottom - ((v - ranges[d][0]) / (ranges[d][1] - ranges[d][0] || 1)) * (bottom - top);
    const n = this.rows();
    const alpha = n > 3000 ? 0.12 : n > 500 ? 0.3 : 0.6;
    const g = this.opts.groups;
    for (let i = 0; i < n; i++) {
      if (g && this.hidden.has(g.names[g.index[i]])) continue;
      const pts: number[] = [];
      for (let d = 0; d < k; d++) pts.push(this.xs[d], this.Y(d, dims[d].values[i]));
      b.line(pts, this.rowColor(i), 1, alpha);
    }
    dims.forEach((d, i) => {
      b.seg(this.xs[i], top, this.xs[i], bottom, this.theme.textMuted, 1.5);
      b.text(d.name, this.xs[i], top - 6, 0.5, 1, true, { maxWidth: (W - 60) / Math.max(1, k - 1) });
      for (const t of niceTicks(ranges[i][0], ranges[i][1], 4)) {
        b.seg(this.xs[i] - 3, this.Y(i, t), this.xs[i], this.Y(i, t), this.theme.textMuted, 1);
        b.text(formatNumber(t), this.xs[i] - 5, this.Y(i, t), 1, 0.5, false, { size: 10 });
      }
    });
  }

  protected hitTest(px: number, py: number): Hit | null {
    const dims = this.opts.dimensions;
    const x = px - this.plot.left;
    const y = py - this.plot.top;
    const seg = this.xs.findIndex((v, i) => i < this.xs.length - 1 && x >= v && x <= this.xs[i + 1]);
    if (seg < 0) return null;
    const t = (x - this.xs[seg]) / (this.xs[seg + 1] - this.xs[seg]);
    const g = this.opts.groups;
    let best = -1;
    let bd = 5;
    for (let i = 0; i < this.rows(); i++) {
      if (g && this.hidden.has(g.names[g.index[i]])) continue;
      const yy = this.Y(seg, dims[seg].values[i]) * (1 - t) + this.Y(seg + 1, dims[seg + 1].values[i]) * t;
      const d = Math.abs(yy - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best < 0) return null;
    this.hoverPts = dims.flatMap((_, d) => [this.xs[d], this.Y(d, dims[d].values[best])]);
    return {
      series: g ? g.names[g.index[best]] : `Row ${best + 1}`,
      index: best,
      color: this.rowColor(best),
      title: `Row ${best + 1}`,
      values: Object.fromEntries(dims.map((d) => [d.name, formatNumber(d.values[best])])),
    };
  }

  protected highlight(hit: Hit | null) {
    if (!hit) return this.clearHighlight();
    this.drawOutline({ k: 'path', pts: this.hoverPts, tol: 0 });
  }
}

// ---- Chord ---------------------------------------------------------------------------------

export class ChordChart extends MarkChart<ChordOptions> {
  readonly type = 'chord' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected legendItems(): LegendItem[] {
    return this.opts.names.map((n, i) => ({ name: n, color: this.color(i) }));
  }

  protected marks(b: MarkBuilder) {
    const { names } = this.opts;
    const keep = names.map((n) => !this.hidden.has(n));
    const matrix = this.opts.matrix.map((row, i) => row.map((v, j) => (keep[i] && keep[j] ? v : 0)));
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 26;
    const ri = R - 12;
    const { groups, chords } = chord(matrix, 0.04);
    const arcPts = (r: number, a0: number, a1: number) => {
      const n = Math.max(2, Math.ceil(((a1 - a0) * r) / 4));
      const out: number[] = [];
      for (let i = 0; i <= n; i++) out.push(...polar(cx, cy, r, a0 + ((a1 - a0) * i) / n));
      return out;
    };
    const curve = (x0: number, y0: number, x1: number, y1: number) => {
      const out: number[] = [];
      for (let i = 1; i < 16; i++) {
        const t = i / 16;
        const u = 1 - t;
        out.push(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1);
      }
      return out;
    };
    for (const c of chords) {
      const s = c.source;
      const t = c.target;
      const sa = arcPts(ri, s.a0, s.a1);
      const ta = arcPts(ri, t.a0, t.a1);
      const pts = [
        ...sa,
        ...curve(sa[sa.length - 2], sa[sa.length - 1], ta[0], ta[1]),
        ...ta,
        ...curve(ta[ta.length - 2], ta[ta.length - 1], sa[0], sa[1]),
      ];
      // Ribbons take the color of the side sending more.
      const main = s.value >= t.value ? s.index : t.index;
      b.poly(pts, this.color(main), 0.55);
      b.region({
        k: 'poly',
        pts,
        hit: {
          series: `${names[s.index]} ↔ ${names[t.index]}`,
          index: 0,
          values: {},
          rows: [
            { label: `${names[s.index]} → ${names[t.index]}`, value: formatNumber(s.value), color: this.color(s.index) },
            ...(s.index !== t.index ? [{ label: `${names[t.index]} → ${names[s.index]}`, value: formatNumber(t.value), color: this.color(t.index) }] : []),
          ],
        },
      });
    }
    for (const g of groups) {
      if (g.a1 - g.a0 < 0.001) continue;
      const color = this.color(g.index);
      b.sector(cx, cy, R - 10, R, g.a0, g.a1, color);
      const mid = (g.a0 + g.a1) / 2;
      const [lx, ly] = polar(cx, cy, R + 10, mid);
      if (g.a1 - g.a0 > 0.08) b.text(names[g.index], lx, ly, Math.sin(mid) > 0.25 ? 0 : Math.sin(mid) < -0.25 ? 1 : 0.5, 0.5, true);
      const inflow = matrix.reduce((s, row) => s + row[g.index], 0);
      b.region({ k: 'sector', cx, cy, r0: R - 12, r1: R + 4, a0: g.a0, a1: g.a1, hit: { series: names[g.index], index: g.index, color, values: { Outgoing: formatNumber(g.value), Incoming: formatNumber(inflow) } } });
    }
  }
}

// ---- Arc diagram ----------------------------------------------------------------------------

export class ArcDiagramChart extends MarkChart<ArcDiagramOptions> {
  readonly type = 'arcDiagram' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected legendItems(): LegendItem[] {
    return (this.opts.groupNames ?? []).map((n, i) => ({ name: n, color: this.color(i) }));
  }

  protected marks(b: MarkBuilder) {
    const { nodes, links } = this.opts;
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const W = this.plot.width;
    const H = this.plot.height;
    const n = nodes.length;
    const baseY = H - Math.min(80, H * 0.3);
    const X = (i: number) => 16 + (i / Math.max(1, n - 1)) * (W - 32);
    const deg = new Array(n).fill(0);
    const maxV = Math.max(...links.map((l) => l.value ?? 1), 1);
    for (const l of links) {
      const a = idx.get(l.source);
      const c = idx.get(l.target);
      if (a === undefined || c === undefined) continue;
      deg[a]++;
      deg[c]++;
      const x0 = Math.min(X(a), X(c));
      const x1 = Math.max(X(a), X(c));
      const r = (x1 - x0) / 2;
      const cx = (x0 + x1) / 2;
      const pts: number[] = [];
      const steps = Math.max(8, Math.ceil(r / 4));
      for (let k = 0; k <= steps; k++) {
        const t = Math.PI - (k / steps) * Math.PI;
        // Flatten tall arcs so long links don't leave the plot.
        pts.push(cx + Math.cos(t) * r, baseY - Math.sin(t) * Math.min(r, baseY - 8));
      }
      const g = nodes[a].group ?? 0;
      b.softLine(pts, this.color(g), 1 + ((l.value ?? 1) / maxV) * 3, 0.5);
      b.region({ k: 'path', pts, tol: 4, hit: { series: `${nodes[a].name ?? nodes[a].id} – ${nodes[c].name ?? nodes[c].id}`, index: 0, values: { Weight: formatNumber(l.value ?? 1) } } });
    }
    nodes.forEach((node, i) => {
      const color = this.color(node.group ?? 0);
      const size = 6 + Math.sqrt(deg[i]) * 2.5;
      b.point(X(i), baseY, color, size);
      // Rotated labels need ~12px of spacing to stay legible.
      if (W / n >= 12) b.text(node.name ?? node.id, X(i) + 3, baseY + 8, 1, 0.5, false, { rotate: -50, size: 10 });
      b.region({ k: 'circle', x: X(i), y: baseY, r: size / 2 + 3, hit: { series: node.name ?? node.id, index: i, color, values: { Links: deg[i], ...(this.opts.groupNames ? { Group: this.opts.groupNames[node.group ?? 0] } : {}) } } });
    });
  }
}

