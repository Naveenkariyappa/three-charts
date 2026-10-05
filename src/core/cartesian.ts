import * as THREE from 'three';
import { BaseChart, type LabelPool } from './base';
import { shared } from './engine';
import { formatNumber, formatTime, niceTicks } from './scale';
import { setLineResolution } from './marks';
import type { AxisOptions, CartesianOptions } from './types';

export interface Domain {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Base for 2D charts with x/y axes.
 *
 * Data lives in world space (offset by `origin` to keep float32 precise) and
 * an orthographic camera maps the visible domain onto the plot rectangle.
 * Zoom and pan only move the camera, so a million points never re-upload.
 */
/** Charts that share an x range, by `sync` key (page-wide, see `shared`). */
const syncGroups = () => shared().sync as Map<string, Set<CartesianChart<CartesianOptions>>>;

export abstract class CartesianChart<O extends CartesianOptions> extends BaseChart<O> {
  camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  gridScene = new THREE.Scene();
  /** Full data domain (after nice rounding / user min-max). */
  full: Domain = { x0: 0, x1: 1, y0: 0, y1: 1 };
  /** Currently visible domain. */
  view: Domain = { x0: 0, x1: 1, y0: 0, y1: 1 };
  /** World = data - origin. */
  origin = { x: 0, y: 0 };
  /** Plot rectangle in CSS px. */
  plot = { left: 48, top: 10, width: 1, height: 1 };

  /** Category labels for a band axis. */
  protected xCategories: string[] | null = null;
  protected yCategories: string[] | null = null;
  protected defaultZoom: 'x' | 'xy' | false = 'x';
  /** False for layout charts (treemap, sankey, maps...) that draw no axes or grid. */
  protected showAxes = true;
  /** Hide one axis's tick labels (charts that label marks directly). */
  protected showXTicks = true;
  protected showYTicks = true;
  /** Padding around the plot when axes are hidden, in CSS px. */
  protected plotPad = 0;

  private crosshair: HTMLDivElement;
  private dot: HTMLDivElement;
  private drag: { x: number; y: number; view: Domain } | null = null;
  private axisTitleX: HTMLDivElement;
  private axisTitleY: HTMLDivElement;

  constructor(container: HTMLElement, options: O) {
    super(container, options);
    this.crosshair = document.createElement('div');
    this.crosshair.className = 'tc-crosshair';
    this.dot = document.createElement('div');
    this.dot.className = 'tc-dot';
    this.axisTitleX = document.createElement('div');
    this.axisTitleY = document.createElement('div');
    for (const el of [this.axisTitleX, this.axisTitleY]) el.className = 'tc-label tc-strong';
    this.overlay.append(this.crosshair, this.dot, this.axisTitleX, this.axisTitleY);

    this.stage.addEventListener('wheel', this.onWheel, { passive: false });
    this.stage.addEventListener('pointerdown', this.onDown);
    this.stage.addEventListener('dblclick', () => this.resetView());
  }

  /** Compute `this.full` (and categories) from data. Called before buildMarks. */
  protected abstract computeDomain(): void;
  /** Add marks to `this.scene` in world units. */
  protected abstract buildMarks(): void;

  protected build() {
    this.xCategories = null;
    this.yCategories = null;
    this.computeDomain();
    const xo = this.opts.xAxis;
    const yo = this.opts.yAxis;
    if (xo?.min !== undefined) this.full.x0 = xo.min;
    if (xo?.max !== undefined) this.full.x1 = xo.max;
    if (yo?.min !== undefined) this.full.y0 = yo.min;
    if (yo?.max !== undefined) this.full.y1 = yo.max;
    this.origin = { x: this.full.x0, y: this.full.y0 };
    this.view = { ...this.full };
    this.joinSync();
    this.buildMarks();
  }

  private syncKey: string | null = null;

  private joinSync() {
    const key = this.opts.sync ?? null;
    if (key === this.syncKey) return;
    this.leaveSync();
    this.syncKey = key;
    if (!key) return;
    let g = syncGroups().get(key);
    if (!g) syncGroups().set(key, (g = new Set()));
    g.add(this as unknown as CartesianChart<CartesianOptions>);
  }

  private leaveSync() {
    if (!this.syncKey) return;
    const g = syncGroups().get(this.syncKey);
    g?.delete(this as unknown as CartesianChart<CartesianOptions>);
    if (g && !g.size) syncGroups().delete(this.syncKey);
    this.syncKey = null;
  }

  /** Tell charts in the same sync group about a user zoom / pan / reset. */
  private broadcastView() {
    if (!this.syncKey) return;
    const { x0, x1 } = this.view;
    const reset = x0 === this.full.x0 && x1 === this.full.x1;
    for (const c of syncGroups().get(this.syncKey) ?? []) {
      if (c !== (this as unknown as CartesianChart<CartesianOptions>)) c.receiveView(x0, x1, reset);
    }
  }

  private receiveView(x0: number, x1: number, reset: boolean) {
    const f = this.full;
    if (reset) [this.view.x0, this.view.x1] = [f.x0, f.x1];
    else [this.view.x0, this.view.x1] = clampRange(x0, x1, f.x0, f.x1);
    this.applyView();
    this.invalidate();
  }

  protected layout() {
    if (!this.showAxes) {
      const pad = this.plotPad;
      this.plot = { left: pad, top: pad, width: Math.max(1, this.width - pad * 2), height: Math.max(1, this.height - pad * 2) };
      this.onPlotSized();
      this.applyView();
      return;
    }
    // Tick density depends on the plot height, so set it before measuring the y labels.
    const hasXTitleEarly = !!this.opts.xAxis?.label;
    this.plot = { ...this.plot, top: 10, height: Math.max(1, this.height - 10 - (22 + (hasXTitleEarly ? 18 : 0))) };
    // Size the left margin for the longest label that could appear, not just the current ticks.
    const yLabels = this.showYTicks ? (this.yCategories ?? this.ticksFor('y').map((t) => t.label)) : [];
    const longest = yLabels.reduce((m, l) => Math.max(m, l.length), 0);
    const hasYTitle = !!this.opts.yAxis?.label;
    const hasXTitle = !!this.opts.xAxis?.label;
    const left = Math.min(140, 12 + longest * 6.5) + (hasYTitle ? 18 : 0);
    const bottom = 22 + (hasXTitle ? 18 : 0);
    this.plot = {
      left,
      top: 10,
      width: Math.max(1, this.width - left - 14),
      height: Math.max(1, this.height - 10 - bottom),
    };
    this.onPlotSized();
    this.applyView();
  }

  /** The plot rectangle is known; pixel-space charts lay out their marks here. */
  protected onPlotSized() {}

  /** Extra labels positioned for the current view (called on every view change). */
  protected addLabels(_L: LabelPool) {}

  draw(r: THREE.WebGLRenderer) {
    const d = this.dpr;
    const p = this.plot;
    // Plot rect in device px, measured from the bottom of the chart.
    const x = Math.round(p.left * d);
    const y = Math.round((this.height - p.top - p.height) * d);
    const w = Math.round(p.width * d);
    const h = Math.round(p.height * d);
    r.setViewport(x, y, w, h);
    r.setScissor(x, y, w, h);
    r.render(this.gridScene, this.camera);
    r.render(this.scene, this.camera);
  }

  resetView() {
    this.view = { ...this.full };
    this.applyView();
    this.invalidate();
    this.broadcastView();
  }

  // ---- coordinate helpers -----------------------------------------------------

  /** Data -> CSS px within the stage. */
  toPx(x: number, y: number): [number, number] {
    const v = this.view;
    const p = this.plot;
    return [p.left + ((x - v.x0) / (v.x1 - v.x0)) * p.width, p.top + (1 - (y - v.y0) / (v.y1 - v.y0)) * p.height];
  }

  /** CSS px within the stage -> data. */
  toData(px: number, py: number): [number, number] {
    const v = this.view;
    const p = this.plot;
    return [v.x0 + ((px - p.left) / p.width) * (v.x1 - v.x0), v.y0 + (1 - (py - p.top) / p.height) * (v.y1 - v.y0)];
  }

  /** Data units per CSS px along x and y (absolute). */
  unitsPerPx(): [number, number] {
    const v = this.view;
    return [Math.abs((v.x1 - v.x0) / this.plot.width), Math.abs((v.y1 - v.y0) / this.plot.height)];
  }

  inPlot(px: number, py: number) {
    const p = this.plot;
    return px >= p.left && px <= p.left + p.width && py >= p.top && py <= p.top + p.height;
  }

  /** Device px per world unit, for shaders. */
  pxPerUnit(): THREE.Vector2 {
    const v = this.view;
    // Absolute: pixel-space charts run y downward (y0 > y1).
    return new THREE.Vector2(Math.abs((this.plot.width * this.dpr) / (v.x1 - v.x0)), Math.abs((this.plot.height * this.dpr) / (v.y1 - v.y0)));
  }

  protected showCrosshair(px: number | null) {
    if (px === null) {
      this.crosshair.style.display = 'none';
      return;
    }
    this.crosshair.style.display = 'block';
    this.crosshair.style.left = px + 'px';
    this.crosshair.style.top = this.plot.top + 'px';
    this.crosshair.style.height = this.plot.height + 'px';
  }

  protected showDot(px: number | null, py = 0, color = '') {
    if (px === null) {
      this.dot.style.display = 'none';
      return;
    }
    this.dot.style.display = 'block';
    this.dot.style.left = px + 'px';
    this.dot.style.top = py + 'px';
    this.dot.style.background = color;
  }

  formatX(v: number): string {
    const a = this.opts.xAxis;
    if (a?.format) return a.format(v);
    if (a?.type === 'time') return formatTime(v, this.view.x1 - this.view.x0);
    return formatNumber(v);
  }

  /** Exact value for tooltips (axis ticks may round dates to months). */
  formatXTip(v: number): string {
    const a = this.opts.xAxis;
    if (a?.format) return a.format(v);
    if (a?.type === 'time') {
      const d = new Date(v);
      // Daily data sits on midnight; don't print a meaningless 00:00.
      const midnight = (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) || (d.getHours() === 0 && d.getMinutes() === 0);
      return (midnight ? dayDate : fullDate).format(d);
    }
    return formatNumber(v);
  }

  formatY(v: number): string {
    return this.opts.yAxis?.format?.(v) ?? formatNumber(v);
  }

  /** Called whenever the view changes. Subclasses update uniforms here. */
  protected onViewChange() {}

  // ---- internals --------------------------------------------------------------

  private ticksFor(axis: 'x' | 'y'): { v: number; label: string }[] {
    const cats = axis === 'x' ? this.xCategories : this.yCategories;
    const lo = axis === 'x' ? this.view.x0 : this.view.y0;
    const hi = axis === 'x' ? this.view.x1 : this.view.y1;
    if (cats) {
      const px = axis === 'x' ? this.plot.width : this.plot.height;
      const visible = Math.max(1, hi - lo);
      const longest = cats.reduce((m, c) => Math.max(m, c.length), 1);
      const need = axis === 'x' ? longest * 6.5 + 10 : 16;
      const every = Math.max(1, Math.ceil(need / (px / visible)));
      const out = [];
      for (let i = Math.max(0, Math.ceil(lo)); i <= Math.min(cats.length - 1, Math.floor(hi)); i += every) out.push({ v: i, label: cats[i] });
      return out;
    }
    const target = axis === 'x' ? Math.max(2, Math.floor(this.plot.width / 90)) : Math.max(2, Math.floor(this.plot.height / 50));
    const fmt = axis === 'x' ? (v: number) => this.formatX(v) : (v: number) => this.formatY(v);
    const opt: AxisOptions | undefined = axis === 'x' ? this.opts.xAxis : this.opts.yAxis;
    let ticks = niceTicks(lo, hi, target);
    if (opt?.type === 'time') ticks = niceTimeTicks(lo, hi, target);
    return ticks.map((v) => ({ v, label: fmt(v) }));
  }

  protected applyView() {
    const v = this.view;
    const o = this.origin;
    const cam = this.camera;
    cam.left = v.x0 - o.x;
    cam.right = v.x1 - o.x;
    cam.bottom = v.y0 - o.y;
    cam.top = v.y1 - o.y;
    cam.updateProjectionMatrix();
    setLineResolution(this.scene, this.plot.width * this.dpr, this.plot.height * this.dpr);
    this.rebuildGrid();
    this.onViewChange();
  }

  private rebuildGrid() {
    this.disposeScene(this.gridScene);
    this.gridScene = new THREE.Scene();
    if (!this.showAxes) {
      this.labels.begin();
      this.addLabels(this.labels);
      this.labels.end();
      this.axisTitleX.style.display = 'none';
      this.axisTitleY.style.display = 'none';
      return;
    }
    const v = this.view;
    const o = this.origin;
    const xt = this.ticksFor('x');
    const yt = this.ticksFor('y');
    const showGrid = this.opts.grid !== false;
    const pts: number[] = [];
    if (showGrid) {
      // Horizontal hairlines at y ticks (the value axis); vertical ones only for numeric x.
      if (!this.yCategories) for (const t of yt) pts.push(v.x0 - o.x, t.v - o.y, 0, v.x1 - o.x, t.v - o.y, 0);
      if (!this.xCategories) for (const t of xt) pts.push(t.v - o.x, v.y0 - o.y, 0, t.v - o.x, v.y1 - o.y, 0);
    }
    if (pts.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      this.gridScene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: this.theme.grid })));
    }
    // Baseline along the bottom of the plot.
    const base = new THREE.BufferGeometry();
    const by = v.y0 - o.y + ((v.y1 - v.y0) * 0.5) / Math.max(1, this.plot.height * this.dpr);
    base.setAttribute('position', new THREE.Float32BufferAttribute([v.x0 - o.x, by, 0, v.x1 - o.x, by, 0], 3));
    this.gridScene.add(new THREE.LineSegments(base, new THREE.LineBasicMaterial({ color: this.theme.axis })));

    // Tick labels (HTML).
    const L = this.labels;
    const p = this.plot;
    L.begin();
    if (this.showXTicks) for (const t of xt) {
      const [px] = this.toPx(t.v, 0);
      if (px < p.left - 1 || px > p.left + p.width + 1) continue;
      L.add(t.label, px, p.top + p.height + 6, 0.5, 0);
    }
    if (this.showYTicks) for (const t of yt) {
      const [, py] = this.toPx(0, t.v);
      if (py < p.top - 1 || py > p.top + p.height + 1) continue;
      L.add(t.label, p.left - 8, py, 1, 0.5);
    }
    this.addLabels(L);
    L.end();

    const xl = this.opts.xAxis?.label;
    const yl = this.opts.yAxis?.label;
    this.axisTitleX.style.display = xl ? '' : 'none';
    this.axisTitleY.style.display = yl ? '' : 'none';
    if (xl) {
      this.axisTitleX.textContent = xl;
      this.axisTitleX.style.transform = `translate(${p.left + p.width / 2}px,${this.height - 2}px) translate(-50%,-100%)`;
    }
    if (yl) {
      this.axisTitleY.textContent = yl;
      this.axisTitleY.style.transform = `translate(4px,${p.top + p.height / 2}px) rotate(-90deg) translate(-50%,0)`;
      this.axisTitleY.style.transformOrigin = '0 0';
    }
  }

  private zoomMode(): 'x' | 'xy' | false {
    return this.opts.zoom === undefined ? this.defaultZoom : this.opts.zoom;
  }

  private onWheel = (e: WheelEvent) => {
    const mode = this.zoomMode();
    if (!mode) return;
    const r = this.stage.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    if (!this.inPlot(px, py) || !this.wantsWheel(e)) return;
    e.preventDefault();
    const k = Math.exp(e.deltaY * 0.0015);
    const [cx, cy] = this.toData(px, py);
    const v = this.view;
    const f = this.full;
    const minSpanX = (f.x1 - f.x0) / 1e6;
    let x0 = cx - (cx - v.x0) * k;
    let x1 = cx + (v.x1 - cx) * k;
    if (x1 - x0 < minSpanX) return;
    [x0, x1] = clampRange(x0, x1, f.x0, f.x1);
    v.x0 = x0;
    v.x1 = x1;
    if (mode === 'xy') {
      let y0 = cy - (cy - v.y0) * k;
      let y1 = cy + (v.y1 - cy) * k;
      [y0, y1] = clampRange(y0, y1, f.y0, f.y1);
      v.y0 = y0;
      v.y1 = y1;
    }
    this.applyView();
    this.invalidate();
    this.broadcastView();
  };

  private onDown = (e: PointerEvent) => {
    if (!this.zoomMode() || e.button !== 0) return;
    const r = this.stage.getBoundingClientRect();
    if (!this.inPlot(e.clientX - r.left, e.clientY - r.top)) return;
    this.drag = { x: e.clientX, y: e.clientY, view: { ...this.view } };
    this.stage.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (!this.drag) return;
      const dx = ev.clientX - this.drag.x;
      const dy = ev.clientY - this.drag.y;
      if (!this.dragging && Math.hypot(dx, dy) < 3) return;
      this.dragging = true;
      this.hideTooltip();
      const s = this.drag.view;
      const f = this.full;
      const ux = ((s.x1 - s.x0) / this.plot.width) * dx;
      [this.view.x0, this.view.x1] = clampRange(s.x0 - ux, s.x1 - ux, f.x0, f.x1);
      if (this.zoomMode() === 'xy') {
        const uy = ((s.y1 - s.y0) / this.plot.height) * dy;
        [this.view.y0, this.view.y1] = clampRange(s.y0 + uy, s.y1 + uy, f.y0, f.y1);
      }
      this.applyView();
      this.invalidate();
      this.broadcastView();
    };
    const up = () => {
      this.drag = null;
      setTimeout(() => (this.dragging = false));
      this.stage.removeEventListener('pointermove', move);
      this.stage.removeEventListener('pointerup', up);
      this.stage.removeEventListener('pointercancel', up);
    };
    this.stage.addEventListener('pointermove', move);
    this.stage.addEventListener('pointerup', up);
    this.stage.addEventListener('pointercancel', up);
  };

  protected gpuScenes(): THREE.Object3D[] {
    return [this.scene, this.gridScene];
  }

  protected disposeAll() {
    this.disposeScene(this.gridScene);
  }

  destroy() {
    this.leaveSync();
    this.disposeAll();
    super.destroy();
  }
}

function clampRange(a: number, b: number, lo: number, hi: number): [number, number] {
  if (lo > hi) {
    // Inverted axis (pixel space, y down): clamp in mirrored space.
    const [m0, m1] = clampRange(-a, -b, -lo, -hi);
    return [-m0, -m1];
  }
  const span = Math.min(b - a, hi - lo);
  if (a < lo) return [lo, lo + span];
  if (b > hi) return [hi - span, hi];
  return [a, b];
}

const dayDate = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });
const fullDate = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const DAY = 86400000;
const TIME_STEPS = [1000, 5000, 15000, 60000, 300000, 900000, 3600000, 3 * 3600000, 6 * 3600000, 12 * 3600000, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 91 * DAY, 182 * DAY, 365 * DAY];

function niceTimeTicks(lo: number, hi: number, count: number): number[] {
  const raw = (hi - lo) / Math.max(1, count);
  if (raw >= 28 * DAY) {
    // Month-scale: tick on the 1st of every k months so labels read Jan 1, Apr 1, ...
    const months = [1, 2, 3, 6, 12, 24, 60].find((m) => m * 30 * DAY >= raw) ?? 120;
    const d = new Date(lo);
    const out: number[] = [];
    const y = d.getFullYear();
    let m = Math.ceil((d.getMonth() + (d.getDate() > 1 ? 1 : 0)) / months) * months;
    for (;;) {
      const t = new Date(y + Math.floor(m / 12), m % 12, 1).getTime();
      if (t > hi) break;
      if (t >= lo) out.push(t);
      m += months;
    }
    return out;
  }
  const step = TIME_STEPS.find((s) => s >= raw) ?? Math.ceil(raw / (365 * DAY)) * 365 * DAY;
  // Align day-or-larger steps to local midnight.
  const tz = step >= DAY ? new Date(lo).getTimezoneOffset() * 60000 : 0;
  const out: number[] = [];
  for (let v = Math.ceil((lo - tz) / step) * step + tz; v <= hi; v += step) out.push(v);
  return out;
}
