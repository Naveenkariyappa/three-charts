import * as THREE from 'three';
import { BaseChart, type Hit, type LegendItem } from '../base';
import { createLine, setLineResolution } from '../marks';
import { escapeHtml, formatNumber, niceDomain, niceTicks } from '../scale';
import type { CommonOptions, DonutOptions, GaugeOptions, PieOptions, RadarOptions, SemiDonutOptions } from '../types';

const TAU = Math.PI * 2;

/** Charts laid out around a center point. World units are CSS px, y up, origin at center. */
abstract class PolarChart<O extends CommonOptions> extends BaseChart<O> {
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  protected R = 1;
  /** Downward shift of the center from the middle of the stage, CSS px. */
  protected cy = 0;
  protected center: HTMLDivElement;

  constructor(container: HTMLElement, options: O) {
    super(container, options);
    this.center = document.createElement('div');
    this.center.className = 'tc-center';
    this.overlay.appendChild(this.center);
  }

  protected layout() {
    const w = this.width;
    const h = this.height;
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h / 2;
    this.camera.bottom = -h / 2;
    this.camera.updateProjectionMatrix();
    this.R = Math.max(10, Math.min(w, h) / 2 - this.margin());
    setLineResolution(this.scene, this.pixelWidth, this.pixelHeight);
    this.place();
  }

  protected margin() {
    return 28;
  }

  /** Rebuild size-dependent geometry and labels. */
  protected abstract place(): void;

  draw(r: THREE.WebGLRenderer) {
    r.render(this.scene, this.camera);
  }

  /** Stage px -> polar (radius, clockwise angle from 12 o'clock). */
  protected polar(px: number, py: number): [number, number] {
    const x = px - this.width / 2;
    const y = this.height / 2 + this.cy - py;
    let a = Math.PI / 2 - Math.atan2(y, x);
    if (a < 0) a += TAU;
    return [Math.hypot(x, y), a];
  }

  /** Clockwise-from-top angle -> stage px. */
  protected at(r: number, a: number): [number, number] {
    return [this.width / 2 + Math.sin(a) * r, this.height / 2 + this.cy - Math.cos(a) * r];
  }

  protected clearGroup(g: THREE.Group) {
    this.disposeScene(g);
    g.clear();
  }
}

/** Ring sector from clockwise angles a0..a1 (radians from 12 o'clock). */
function sector(r0: number, r1: number, a0: number, a1: number): THREE.BufferGeometry {
  const len = Math.max(0.0001, a1 - a0);
  const segs = Math.max(2, Math.ceil(len * 40));
  return new THREE.RingGeometry(r0, r1, segs, 1, Math.PI / 2 - a1, len);
}

// ---- Pie / Donut -------------------------------------------------------------------

interface Slice {
  label: string;
  value: number;
  color: string;
  a0: number;
  a1: number;
}

export class PieChart extends PolarChart<PieOptions | DonutOptions | SemiDonutOptions> {
  readonly type: 'pie' | 'donut' | 'semiDonut';
  private group = new THREE.Group();
  private slices: Slice[] = [];
  private hovered = -1;

  constructor(container: HTMLElement, options: PieOptions | DonutOptions | SemiDonutOptions) {
    super(container, options);
    this.type = options.type;
    this.animDuration = 800;
  }

  /** Past 8 slices the remainder folds into "Other" instead of inventing colors. */
  private items(): { label: string; value: number; color: string }[] {
    const data = this.opts.data.map((d, i) => ({ label: d.label, value: Math.max(0, d.value), color: this.color(i, d.color) }));
    if (data.length <= 8) return data;
    const head = data.slice(0, 7);
    const rest = data.slice(7).reduce((s, d) => s + d.value, 0);
    return [...head, { label: 'Other', value: rest, color: this.theme.textMuted }];
  }

  protected legendItems(): LegendItem[] {
    return this.items().map((d) => ({ name: d.label, color: d.color }));
  }

  private inner() {
    return this.opts.innerRadius ?? (this.type === 'pie' ? 0 : 0.6);
  }

  private get semi() {
    return this.type === 'semiDonut';
  }

  /** Start angle and sweep (radians, clockwise from 12 o'clock). */
  private arc(): [number, number] {
    return this.semi ? [-Math.PI / 2, Math.PI] : [0, TAU];
  }

  protected build() {
    this.group = new THREE.Group();
    this.scene.add(this.group);
    const items = this.items().filter((d) => !this.hidden.has(d.label));
    const total = items.reduce((s, d) => s + d.value, 0) || 1;
    const [start, sweep] = this.arc();
    let a = start;
    this.slices = items.map((d) => {
      const s = { ...d, a0: a, a1: a + (d.value / total) * sweep };
      a = s.a1;
      return s;
    });
    if (this.inner() > 0) {
      const big = escapeHtml(this.opts.centerLabel ?? formatNumber(items.reduce((s, d) => s + d.value, 0)));
      this.center.innerHTML = `<div class="tc-big">${big}</div><div class="tc-small">Total</div>`;
    } else this.center.textContent = '';
  }

  protected place() {
    if (this.semi) {
      // A half disc: as wide as possible, centered vertically.
      this.R = Math.max(10, Math.min(this.width / 2 - 28, this.height - 40));
      this.cy = this.R / 2 - 4;
      this.group.position.y = -this.cy;
      this.center.style.top = `${this.height / 2 + this.cy - this.R * 0.22}px`;
    } else {
      this.cy = 0;
      this.group.position.y = 0;
      this.center.style.top = '';
    }
    this.rebuildSlices();
  }

  protected onProgress() {
    if (this.built) this.rebuildSlices();
  }

  private rebuildSlices() {
    this.clearGroup(this.group);
    const R = this.R;
    const r0 = R * this.inner();
    const [start, full] = this.arc();
    const sweep = start + full * this.progress;
    const gap = this.slices.length > 1 ? 2 / R : 0; // 2px surface gap at the rim
    this.labels.begin();
    this.slices.forEach((s, i) => {
      const a0 = Math.min(s.a0, sweep);
      const a1 = Math.min(s.a1, sweep);
      if (a1 - a0 <= gap) return;
      const mat = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, depthTest: false });
      if (this.hovered >= 0 && this.hovered !== i) mat.opacity = 0.45;
      const mesh = new THREE.Mesh(sector(r0, R, a0 + gap / 2, a1 - gap / 2), mat);
      if (i === this.hovered) {
        const mid = (a0 + a1) / 2;
        mesh.position.set(Math.sin(mid) * 6, Math.cos(mid) * 6, 0);
      }
      this.group.add(mesh);
      const share = (s.a1 - s.a0) / full;
      if (this.progress >= 1 && share >= 0.04) {
        const mid = (s.a0 + s.a1) / 2;
        const [lx, ly] = this.at(R + 14, mid);
        const ax = Math.sin(mid) > 0.2 ? 0 : Math.sin(mid) < -0.2 ? 1 : 0.5;
        this.labels.add(`${Math.round(share * 100)}%`, lx, ly, ax, 0.5, true);
      }
    });
    this.labels.end();
  }

  protected hitTest(px: number, py: number): Hit | null {
    const [r, a0] = this.polar(px, py);
    if (r > this.R + 8 || r < this.R * this.inner() - 4) return null;
    const a = this.semi && a0 > Math.PI ? a0 - TAU : a0;
    const i = this.slices.findIndex((s) => a >= s.a0 && a < s.a1);
    if (i < 0) return null;
    const s = this.slices[i];
    const total = this.slices.reduce((t, d) => t + d.value, 0) || 1;
    return {
      series: s.label,
      index: i,
      color: s.color,
      values: { Value: formatNumber(s.value), Share: `${((s.value / total) * 100).toFixed(1)}%` },
    };
  }

  protected highlight(hit: Hit | null) {
    this.hovered = hit ? hit.index : -1;
    this.rebuildSlices();
    this.invalidate();
  }
}

// ---- Radar -------------------------------------------------------------------------

export class RadarChart extends PolarChart<RadarOptions> {
  readonly type = 'radar' as const;
  private group = new THREE.Group();
  private max = 1;
  private hoverAxis = -1;

  protected margin() {
    return 36;
  }

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected build() {
    let m = 0;
    for (const s of this.opts.series) for (let i = 0; i < s.data.length; i++) m = Math.max(m, s.data[i]);
    this.max = this.opts.max ?? niceDomain(0, m || 1, 4)[1];
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  protected place() {
    this.clearGroup(this.group);
    const { axes } = this.opts;
    const n = axes.length;
    const R = this.R;
    const angle = (i: number) => (i / n) * TAU;
    const pt = (r: number, i: number) => new THREE.Vector3(Math.sin(angle(i)) * r, Math.cos(angle(i)) * r, 0);

    // Grid rings and spokes.
    const grid: number[] = [];
    const ticks = niceTicks(0, this.max, 4).filter((t) => t > 0);
    for (const t of ticks) {
      const r = (t / this.max) * R;
      for (let i = 0; i < n; i++) {
        const a = pt(r, i);
        const b = pt(r, (i + 1) % n);
        grid.push(a.x, a.y, 0, b.x, b.y, 0);
      }
    }
    for (let i = 0; i < n; i++) {
      const b = pt(R, i);
      grid.push(0, 0, 0, b.x, b.y, 0);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
    this.group.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: this.theme.grid })));

    // Series: translucent fill + 2px outline, scaled in by the entry animation.
    const series = new THREE.Group();
    series.name = 'series';
    this.opts.series.forEach((s, si) => {
      if (this.hidden.has(s.name)) return;
      const color = this.color(si, s.color);
      const pts = axes.map((_, i) => pt((Math.max(0, s.data[i] ?? 0) / this.max) * R, i));
      const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
      const fill = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, depthTest: false }),
      );
      series.add(fill);
      const pos = new Float32Array((n + 1) * 3);
      pts.concat([pts[0]]).forEach((p, k) => pos.set([p.x, p.y, 0], k * 3));
      series.add(createLine(pos, color, 2 * this.dpr));
    });
    this.group.add(series);
    setLineResolution(this.group, this.pixelWidth, this.pixelHeight);
    this.onProgress();

    this.labels.begin();
    axes.forEach((name, i) => {
      const a = angle(i);
      const [x, y] = this.at(R + 10, a);
      const ax = Math.sin(a) > 0.2 ? 0 : Math.sin(a) < -0.2 ? 1 : 0.5;
      const ay = Math.cos(a) > 0.2 ? 1 : Math.cos(a) < -0.2 ? 0 : 0.5;
      this.labels.add(name, x, y, ax, ay, i === this.hoverAxis);
    });
    for (const t of ticks) {
      const [x, y] = this.at((t / this.max) * R, 0);
      this.labels.add(formatNumber(t), x + 4, y, 0, 0.5);
    }
    this.labels.end();
  }

  protected onProgress() {
    const s = this.group.getObjectByName('series');
    if (s) s.scale.setScalar(Math.max(0.0001, this.progress));
  }

  protected hitTest(px: number, py: number): Hit | null {
    const [r, a] = this.polar(px, py);
    if (r > this.R + 30) return null;
    const n = this.opts.axes.length;
    const i = Math.round((a / TAU) * n) % n;
    const rows: Hit['rows'] = [];
    const values: Record<string, number> = {};
    this.opts.series.forEach((s, si) => {
      if (this.hidden.has(s.name)) return;
      values[s.name] = s.data[i] ?? 0;
      rows.push({ label: s.name, value: formatNumber(s.data[i] ?? 0), color: this.color(si, s.color) });
    });
    return { series: this.opts.axes[i], index: i, values, rows };
  }

  protected highlight(hit: Hit | null) {
    this.hoverAxis = hit ? hit.index : -1;
    this.place();
    this.invalidate();
  }
}

// ---- Gauge -------------------------------------------------------------------------

const G_START = -Math.PI * 0.75; // 7:30 position
const G_SWEEP = Math.PI * 1.5;

export class GaugeChart extends PolarChart<GaugeOptions> {
  readonly type = 'gauge' as const;
  private group = new THREE.Group();

  protected margin() {
    return 16;
  }

  private range(): [number, number] {
    return [this.opts.min ?? 0, this.opts.max ?? 100];
  }

  private frac(v: number) {
    const [lo, hi] = this.range();
    return Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)));
  }

  protected build() {
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  protected place() {
    this.clearGroup(this.group);
    const R = this.R;
    const thick = Math.max(8, R * 0.16);
    const r0 = R - thick;
    const a0 = G_START;
    const a1 = G_START + G_SWEEP;
    const add = (g: THREE.BufferGeometry, color: string) =>
      this.group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, depthTest: false })));

    add(sector(r0, R, a0, a1), this.theme.grid);

    // Optional bands as a thin outer rim.
    const [lo] = this.range();
    let from = lo;
    for (const b of this.opts.bands ?? []) {
      add(sector(R + 3, R + 7, a0 + this.frac(from) * G_SWEEP, a0 + this.frac(b.to) * G_SWEEP), b.color);
      from = b.to;
    }

    const v = this.opts.value;
    const shown = this.frac(v) * this.progress;
    const band = this.opts.bands?.find((b) => v <= b.to);
    if (shown > 0.001) add(sector(r0, R, a0, a0 + shown * G_SWEEP), band?.color ?? this.color(0));

    const hi = this.range()[1];
    const current = lo + (v - lo) * this.progress;
    this.center.innerHTML =
      `<div class="tc-big">${escapeHtml(formatNumber(current))}${escapeHtml(this.opts.units ?? '')}</div>` +
      (this.opts.label ? `<div class="tc-small">${escapeHtml(this.opts.label)}</div>` : '');
    this.labels.begin();
    const [sx, sy] = this.at(R - thick / 2, a0);
    const [ex, ey] = this.at(R - thick / 2, a1);
    this.labels.add(formatNumber(lo), sx, sy + thick, 0.5, 0);
    this.labels.add(formatNumber(hi), ex, ey + thick, 0.5, 0);
    this.labels.end();
  }

  protected onProgress() {
    if (this.built) this.place();
  }

  protected hitTest(px: number, py: number): Hit | null {
    const [r] = this.polar(px, py);
    if (r > this.R + 8 || r < this.R * 0.6) return null;
    const [lo, hi] = this.range();
    return {
      series: this.opts.label ?? 'Value',
      index: 0,
      values: { Value: formatNumber(this.opts.value) + (this.opts.units ?? ''), Range: `${formatNumber(lo)} – ${formatNumber(hi)}` },
    };
  }
}
