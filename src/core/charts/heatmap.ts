import * as THREE from 'three';
import { CartesianChart } from '../cartesian';
import type { Hit } from '../base';
import { rampTexture } from '../theme';
import { extent, formatNumber } from '../scale';
import type { HeatmapOptions } from '../types';

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const frag = /* glsl */ `
uniform sampler2D uData;
uniform sampler2D uRamp;
uniform float uLo;
uniform float uHi;
uniform float uGrow;
uniform vec2 uGrid;
uniform vec2 uCellPx;
uniform float uGapPx;
uniform float uHover;
varying vec2 vUv;
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float v = texture2D(uData, uv).r;
  if (v != v) discard; // NaN = missing
  // Surface-colored gutters between cells once cells are big enough to show them.
  // Measured from both edges so the gap never falls between pixel centers.
  vec2 f = fract(uv * uGrid) * uCellPx;
  vec2 e = min(f, uCellPx - f);
  if ((uCellPx.x > 8.0 && e.x < uGapPx * 0.5) || (uCellPx.y > 8.0 && e.y < uGapPx * 0.5)) discard;
  float t = clamp((v - uLo) / (uHi - uLo), 0.0, 1.0);
  vec3 c = texture2D(uRamp, vec2(t, 0.5)).rgb;
  vec2 cell = floor(uv * uGrid);
  float id = cell.y * uGrid.x + cell.x;
  float a = uGrow;
  if (uHover >= 0.0 && abs(id - uHover) > 0.5) a *= 0.55;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`;

/** Matrix heatmap rendered from a float texture: a 2000x2000 grid is one quad. */
export class HeatmapChart extends CartesianChart<HeatmapOptions> {
  readonly type: 'heatmap' | 'adjacency' | 'spectrogram' = 'heatmap';
  protected defaultZoom: 'x' | 'xy' | false = 'xy';
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
  private lo = 0;
  private hi = 1;

  private stops() {
    return this.opts.scale === 'diverging' ? this.theme.diverging : this.theme.sequential;
  }

  protected computeDomain() {
    const { rows, cols, xLabels, yLabels } = this.opts;
    if (xLabels) this.xCategories = xLabels;
    // Row 0 is drawn at the top, so the category axis runs bottom-up reversed.
    if (yLabels) this.yCategories = [...yLabels].reverse();
    let [lo, hi] = extent(this.opts.data);
    if (this.opts.scale === 'diverging') {
      const c = this.opts.center ?? 0;
      const m = Math.max(Math.abs(lo - c), Math.abs(hi - c)) || 1;
      lo = c - m;
      hi = c + m;
    }
    this.lo = lo;
    this.hi = hi === lo ? lo + 1 : hi;
    this.full = { x0: -0.5, x1: cols - 0.5, y0: -0.5, y1: rows - 0.5 };
  }

  protected buildMarks() {
    const { rows, cols, data } = this.opts;
    const arr = data instanceof Float32Array ? data : Float32Array.from(data);
    const tex = new THREE.DataTexture(arr, cols, rows, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    const o = this.origin;
    const g = new THREE.PlaneGeometry(cols, rows);
    g.translate(cols / 2 - 0.5 - o.x, rows / 2 - 0.5 - o.y, 0);
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthTest: false,
      uniforms: {
        uData: { value: tex },
        uRamp: { value: rampTexture(this.stops()) },
        uLo: { value: this.lo },
        uHi: { value: this.hi },
        uGrow: { value: 1 },
        uGrid: { value: new THREE.Vector2(cols, rows) },
        uCellPx: { value: new THREE.Vector2(1, 1) },
        uGapPx: { value: 1 },
        uHover: { value: -1 },
      },
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  protected customLegend() {
    const el = document.createElement('div');
    el.className = 'tc-ramp';
    const stops = this.stops();
    el.innerHTML = `<span>${formatNumber(this.lo)}</span><i style="background:linear-gradient(90deg,${stops.join(',')})"></i><span>${formatNumber(this.hi)}</span>`;
    return el;
  }

  protected onProgress() {
    if (this.mesh) this.mesh.material.uniforms.uGrow.value = this.progress;
  }

  protected onViewChange() {
    if (!this.mesh) return;
    const ppu = this.pxPerUnit();
    this.mesh.material.uniforms.uCellPx.value.copy(ppu);
    this.mesh.material.uniforms.uGapPx.value = 2 * this.dpr;
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const { rows, cols, data, xLabels, yLabels } = this.opts;
    const [dx, dy] = this.toData(px, py);
    const c = Math.round(dx);
    const rFromBottom = Math.round(dy);
    if (c < 0 || c >= cols || rFromBottom < 0 || rFromBottom >= rows) return null;
    const r = rows - 1 - rFromBottom;
    const v = data[r * cols + c];
    return {
      series: 'cell',
      index: r * cols + c,
      title: `${yLabels?.[r] ?? `Row ${r}`} · ${xLabels?.[c] ?? `Col ${c}`}`,
      values: { Value: formatNumber(v) },
    };
  }

  protected highlight(hit: Hit | null) {
    if (!this.mesh) return;
    // The shader samples with a flipped v, so its cell id matches the data index.
    const id = hit ? hit.index : -1;
    // Only dim the rest for grids small enough that a single cell is a meaningful target.
    this.mesh.material.uniforms.uHover.value = this.opts.rows * this.opts.cols <= 2500 ? id : -1;
    this.invalidate();
  }
}
