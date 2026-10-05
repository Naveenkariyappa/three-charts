import * as THREE from 'three';
import { getEngine, shared, type EngineClient } from './engine';
import { resolveTheme, seriesColor, type Theme } from './theme';
import { escapeHtml } from './scale';
import type { Chart, CommonOptions, HitInfo } from './types';

/** Internal hit result: public HitInfo plus what the tooltip needs. */
export interface Hit extends HitInfo {
  title?: string;
  color?: string;
  rows?: { label: string; value: string; color?: string }[];
}

export interface LegendItem {
  name: string;
  color: string;
}

const CSS = `
.tc-root{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;box-sizing:border-box;
  font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--tc-text);user-select:none;-webkit-user-select:none}
.tc-title{font-size:13px;font-weight:600;padding:2px 4px 6px;color:var(--tc-text)}
.tc-title:empty{display:none}
.tc-stage{position:relative;flex:1;min-height:0;overflow:hidden;touch-action:none}
.tc-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.tc-overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.tc-label{position:absolute;white-space:nowrap;font-size:11px;color:var(--tc-muted);font-variant-numeric:tabular-nums}
.tc-label.tc-strong{color:var(--tc-text2)}
.tc-label.tc-clip{overflow:hidden;text-overflow:ellipsis}
.tc-hl{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.tc-tooltip{position:absolute;z-index:2;pointer-events:none;display:none;min-width:90px;max-width:260px;padding:8px 10px;border-radius:8px;
  background:var(--tc-tip-bg);border:1px solid var(--tc-border);box-shadow:0 4px 16px rgba(0,0,0,.12);color:var(--tc-text)}
.tc-tooltip b{display:block;font-weight:600;margin-bottom:4px}
.tc-row{display:flex;align-items:center;gap:6px;color:var(--tc-text2)}
.tc-row span:last-child{margin-left:auto;padding-left:12px;color:var(--tc-text);font-variant-numeric:tabular-nums}
.tc-sw{width:8px;height:8px;border-radius:2px;flex:none}
.tc-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 14px;padding:6px 4px 0}
.tc-legend:empty{display:none}
.tc-ramp{display:flex;align-items:center;gap:8px;color:var(--tc-muted);font-size:11px;font-variant-numeric:tabular-nums}
.tc-ramp i{display:block;width:160px;height:8px;border-radius:2px}
.tc-legend button{all:unset;display:flex;align-items:center;gap:6px;cursor:pointer;color:var(--tc-text2);padding:2px 0}
.tc-legend button:focus-visible{outline:2px solid var(--tc-text2);outline-offset:2px;border-radius:2px}
.tc-legend button.tc-off{opacity:.4;text-decoration:line-through}
.tc-crosshair{position:absolute;top:0;width:1px;background:var(--tc-axis);display:none}
.tc-dot{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid var(--tc-surface);box-sizing:border-box;display:none}
.tc-hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;pointer-events:none;padding:6px 10px;border-radius:6px;
  background:var(--tc-tip-bg);border:1px solid var(--tc-border);color:var(--tc-text2);font-size:12px;opacity:0;transition:opacity .2s}
.tc-hint.tc-show{opacity:1}
.tc-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none}
.tc-center .tc-big{font-size:22px;font-weight:600;color:var(--tc-text)}
.tc-center .tc-small{font-size:12px;color:var(--tc-text2)}
`;

function injectStyles() {
  const s0 = shared();
  if (s0.styles) return;
  s0.styles = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export interface LabelStyle {
  color?: string;
  size?: number;
  weight?: number;
  /** Clip with an ellipsis beyond this width (CSS px). */
  maxWidth?: number;
  rotate?: number;
}

/** Reusable absolutely-positioned HTML labels. Cheaper than text in WebGL and always crisp. */
export class LabelPool {
  private els: HTMLDivElement[] = [];
  private n = 0;
  constructor(private parent: HTMLElement) {}
  begin() {
    this.n = 0;
  }
  /** ax/ay: anchor as a fraction of the label size (0.5,0.5 = centered). */
  add(text: string, x: number, y: number, ax = 0.5, ay = 0.5, strong = false, style?: LabelStyle) {
    let el = this.els[this.n];
    if (!el) {
      el = document.createElement('div');
      el.className = 'tc-label';
      this.parent.appendChild(el);
      this.els.push(el);
    }
    this.n++;
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('tc-strong', strong);
    el.style.display = '';
    el.style.color = style?.color ?? '';
    el.style.fontSize = style?.size ? style.size + 'px' : '';
    el.style.fontWeight = style?.weight ? String(style.weight) : '';
    el.style.maxWidth = style?.maxWidth !== undefined ? Math.max(0, style.maxWidth) + 'px' : '';
    el.classList.toggle('tc-clip', style?.maxWidth !== undefined);
    el.style.transform = `translate(${x}px,${y}px) translate(${-ax * 100}%,${-ay * 100}%)` + (style?.rotate ? ` rotate(${style.rotate}deg)` : '');
  }
  end() {
    for (let i = this.n; i < this.els.length; i++) this.els[i].style.display = 'none';
  }
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export abstract class BaseChart<O extends CommonOptions = CommonOptions> implements EngineClient, Chart<O> {
  abstract readonly type: string;

  readonly root: HTMLDivElement;
  readonly stage: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly overlay: HTMLDivElement;
  readonly labels: LabelPool;
  private titleEl: HTMLDivElement;
  private legendEl: HTMLDivElement;
  private tooltipEl: HTMLDivElement;

  /** CSS pixels. */
  width = 0;
  height = 0;
  dpr = 1;
  pixelWidth = 0;
  pixelHeight = 0;
  dirty = false;
  inView = true;

  opts: O;
  theme: Theme;
  scene = new THREE.Scene();
  /** Series names toggled off in the legend. */
  hidden = new Set<string>();

  /** Entry animation progress, 0 -> 1 (eased). */
  protected progress = 1;
  private animStart = -1;
  protected animDuration = 700;
  protected built = false;
  protected dragging = false;
  private destroyed = false;
  private pointer: { x: number; y: number } | null = null;
  private pointerRaf = 0;
  private lastHit: Hit | null = null;
  /** Wheel-zoom is armed by clicking into the chart, so page scrolling never gets trapped. */
  protected wheelArmed = false;
  private hintEl: HTMLDivElement;
  private hintTimer = 0;
  private releaseTimer = 0;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private mq: MediaQueryList;
  private mo: MutationObserver;

  constructor(container: HTMLElement, options: O) {
    injectStyles();
    this.opts = options;
    this.theme = resolveTheme(options.theme);

    this.root = document.createElement('div');
    this.root.className = 'tc-root';
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'tc-title';
    this.stage = document.createElement('div');
    this.stage.className = 'tc-stage';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tc-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.overlay = document.createElement('div');
    this.overlay.className = 'tc-overlay';
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'tc-tooltip';
    this.legendEl = document.createElement('div');
    this.legendEl.className = 'tc-legend';
    this.hintEl = document.createElement('div');
    this.hintEl.className = 'tc-hint';
    this.hintEl.textContent = 'Click the chart (or hold Ctrl/⌘) to zoom with the wheel';
    this.stage.append(this.canvas, this.overlay, this.tooltipEl, this.hintEl);
    this.root.append(this.titleEl, this.stage, this.legendEl);
    container.appendChild(this.root);
    this.labels = new LabelPool(this.overlay);

    this.stage.addEventListener('pointermove', this.onPointerMove);
    this.stage.addEventListener('pointerleave', this.onPointerLeave);
    this.stage.addEventListener('click', this.onClick);
    this.stage.addEventListener('pointerdown', () => (this.wheelArmed = true), { capture: true });

    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this.stage);
    // "In view" starts a little before the chart scrolls on screen, so it is painted on arrival.
    this.io = new IntersectionObserver(
      (entries) => {
        const visible = entries[entries.length - 1].isIntersecting;
        if (visible && !this.inView) {
          this.inView = true;
          this.invalidate();
        } else if (!visible && this.inView) {
          this.inView = false;
          // Free the pixel buffer of off-screen charts: pages with dozens of charts would
          // otherwise hold every canvas in GPU memory. It is repainted on the way back in.
          this.canvas.width = 0;
          this.canvas.height = 0;
          this.dirty = true;
          // After a moment off screen, release GPU buffers too (CPU copies stay; three.js
          // re-uploads them on the next render).
          clearTimeout(this.releaseTimer);
          this.releaseTimer = window.setTimeout(() => !this.inView && this.releaseGPU(), 1500);
        }
      },
      { rootMargin: '300px 0px' },
    );
    this.io.observe(this.stage);

    this.mq = matchMedia('(prefers-color-scheme: dark)');
    this.mq.addEventListener('change', this.onSchemeChange);
    this.mo = new MutationObserver(this.onSchemeChange);
    this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    getEngine().add(this);
    // Build after subclass field initializers have run.
    queueMicrotask(() => {
      if (this.destroyed) return;
      if (this.opts.animate !== false) this.progress = 0;
      this.rebuild();
    });
  }

  // ---- subclass hooks -------------------------------------------------------

  /** Create scene content from `this.opts`. The scene is empty when this runs. */
  protected abstract build(): void;
  /** Size changed (also called once after build). */
  protected abstract layout(): void;
  /** Render the scene(s). Viewport is the full chart; override to restrict. */
  abstract draw(renderer: THREE.WebGLRenderer): void;
  /** Find the mark under (x, y) in CSS px relative to the stage. */
  protected hitTest(_x: number, _y: number): Hit | null {
    return null;
  }
  /** Show hover state for `hit` (or clear it). Call invalidate() if WebGL output changes. */
  protected highlight(_hit: Hit | null): void {}
  protected legendItems(): LegendItem[] {
    return [];
  }
  /** Non-series legend content (e.g. a color ramp). */
  protected customLegend(): HTMLElement | null {
    return null;
  }
  /** Called when the entry animation advances. */
  protected onProgress(): void {}
  /** Return true to keep animating (e.g. camera damping). */
  protected onTick(_now: number): boolean {
    return false;
  }
  afterDraw?(): void;

  // ---- public API -----------------------------------------------------------

  update(options: Partial<O>) {
    this.opts = { ...this.opts, ...options };
    if (this.built) this.rebuild();
  }

  resize() {
    this.measure();
  }

  resetView() {}

  toPNG(): string {
    return this.canvas.toDataURL('image/png');
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    getEngine().remove(this);
    this.ro.disconnect();
    this.io.disconnect();
    this.mo.disconnect();
    this.mq.removeEventListener('change', this.onSchemeChange);
    cancelAnimationFrame(this.pointerRaf);
    clearTimeout(this.releaseTimer);
    this.disposeScene(this.scene);
    this.root.remove();
  }

  // ---- engine client --------------------------------------------------------

  tick(now: number): boolean {
    if (!this.built) return false;
    let animating = false;
    if (this.progress < 1) {
      if (this.animStart < 0) this.animStart = now;
      const t = Math.min(1, (now - this.animStart) / this.animDuration);
      this.progress = t >= 1 ? 1 : ease(t);
      this.onProgress();
      this.dirty = true;
      animating = this.progress < 1;
    }
    if (this.onTick(now)) {
      this.dirty = true;
      animating = true;
    }
    return animating;
  }

  // ---- helpers for subclasses -----------------------------------------------

  invalidate() {
    if (!this.built) return;
    this.dirty = true;
    getEngine().request();
  }

  protected color(i: number, custom?: string): string {
    return custom ?? seriesColor(this.theme, i, this.opts.colors);
  }

  protected rebuild() {
    if (this.destroyed) return;
    this.theme = resolveTheme(this.opts.theme);
    this.applyCssVars();
    this.titleEl.textContent = this.opts.title ?? '';
    this.root.style.background = this.opts.background ?? 'transparent';
    this.disposeScene(this.scene);
    this.scene = new THREE.Scene();
    this.lastHit = null;
    this.hideTooltip();
    this.measureNow();
    this.build();
    this.renderLegend();
    this.measureNow(); // legend may have changed the stage height
    this.layout();
    this.built = true;
    this.onProgress();
    this.invalidate();
  }

  /** Scenes whose GPU resources can be released while the chart is off screen. */
  protected gpuScenes(): THREE.Object3D[] {
    return [this.scene];
  }

  /** Drop GPU copies of geometry and textures; they re-upload automatically when drawn again. */
  protected releaseGPU() {
    for (const root of this.gpuScenes()) {
      root.traverse((o) => {
        (o as THREE.Mesh).geometry?.dispose();
        const mats = (o as THREE.Mesh).material;
        for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
          const u = (m as THREE.ShaderMaterial).uniforms;
          if (u) for (const k in u) if (u[k].value instanceof THREE.Texture) u[k].value.dispose();
          const map = (m as THREE.MeshStandardMaterial).map;
          if (map) map.dispose();
        }
      });
    }
  }

  protected disposeScene(scene: THREE.Object3D) {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        const u = (mat as THREE.ShaderMaterial).uniforms;
        if (u) for (const k in u) if (u[k].value instanceof THREE.Texture) u[k].value.dispose();
        mat.dispose();
      }
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    });
  }

  private applyCssVars() {
    const t = this.theme;
    const s = this.root.style;
    s.setProperty('--tc-text', t.textPrimary);
    s.setProperty('--tc-text2', t.textSecondary);
    s.setProperty('--tc-muted', t.textMuted);
    s.setProperty('--tc-axis', t.axis);
    s.setProperty('--tc-border', t.border);
    s.setProperty('--tc-surface', t.surface);
    s.setProperty('--tc-tip-bg', t.tooltipBg);
  }

  private measureNow(): boolean {
    const r = this.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const changed = r.width !== this.width || r.height !== this.height || dpr !== this.dpr;
    this.width = r.width;
    this.height = r.height;
    this.dpr = dpr;
    this.pixelWidth = Math.round(r.width * dpr);
    this.pixelHeight = Math.round(r.height * dpr);
    return changed;
  }

  private measure() {
    if (this.measureNow() && this.built) {
      this.layout();
      this.invalidate();
    }
  }

  /** Rebuild the legend (e.g. after a layout changed a color scale's range). */
  protected renderLegend() {
    const items = this.legendItems();
    this.legendEl.textContent = '';
    if (this.opts.legend === false) return;
    const custom = this.customLegend();
    if (custom) this.legendEl.appendChild(custom);
    if (items.length < 2) return;
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(!this.hidden.has(it.name)));
      b.className = this.hidden.has(it.name) ? 'tc-off' : '';
      b.innerHTML = `<span class="tc-sw" style="background:${it.color}"></span>${escapeHtml(it.name)}`;
      b.onclick = () => {
        if (this.hidden.has(it.name)) this.hidden.delete(it.name);
        else this.hidden.add(it.name);
        this.rebuild();
      };
      this.legendEl.appendChild(b);
    }
  }

  private onSchemeChange = () => {
    if ((this.opts.theme ?? 'auto') === 'auto' && this.built) this.rebuild();
  };

  private onPointerMove = (e: PointerEvent) => {
    const r = this.stage.getBoundingClientRect();
    this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    // Hit-test at most once per frame, however fast the pointer events arrive.
    if (!this.pointerRaf) this.pointerRaf = requestAnimationFrame(this.processPointer);
  };

  private processPointer = () => {
    this.pointerRaf = 0;
    if (!this.pointer || !this.built) return;
    const hit = this.dragging ? null : this.hitTest(this.pointer.x, this.pointer.y);
    const same = hit && this.lastHit && hit.series === this.lastHit.series && hit.index === this.lastHit.index;
    if (!same) {
      this.highlight(hit);
      this.opts.onHover?.(hit ? this.publicHit(hit) : null);
    }
    this.lastHit = hit;
    if (hit && this.opts.tooltip !== false) this.showTooltip(hit, this.pointer.x, this.pointer.y);
    else this.hideTooltip();
    this.stage.style.cursor = hit && this.opts.onClick ? 'pointer' : '';
  };

  private onPointerLeave = () => {
    this.pointer = null;
    this.wheelArmed = false;
    if (this.lastHit) {
      this.lastHit = null;
      this.highlight(null);
      this.opts.onHover?.(null);
    }
    this.hideTooltip();
  };

  private onClick = () => {
    if (this.lastHit) this.opts.onClick?.(this.publicHit(this.lastHit));
  };

  private publicHit(h: Hit): HitInfo {
    return { series: h.series, index: h.index, values: h.values };
  }

  private showTooltip(hit: Hit, x: number, y: number) {
    const rows = hit.rows ?? Object.entries(hit.values).map(([label, v]) => ({ label, value: String(v), color: undefined as string | undefined }));
    let html = `<b>${escapeHtml(hit.title ?? hit.series)}</b>`;
    for (const r of rows) {
      const sw = r.color ? `<i class="tc-sw" style="background:${r.color}"></i>` : '';
      html += `<div class="tc-row">${sw}<span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.value)}</span></div>`;
    }
    const tip = this.tooltipEl;
    if (tip.innerHTML !== html) tip.innerHTML = html;
    tip.style.display = 'block';
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = x + 14;
    let top = y + 14;
    if (left + tw > this.width) left = x - tw - 14;
    if (top + th > this.height) top = y - th - 14;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = Math.max(0, top) + 'px';
  }

  /** True when a wheel event should zoom this chart rather than scroll the page. */
  protected wantsWheel(e: WheelEvent): boolean {
    if (this.wheelArmed || e.ctrlKey || e.metaKey) return true;
    this.hintEl.classList.add('tc-show');
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hintEl.classList.remove('tc-show'), 1200);
    return false;
  }

  protected hideTooltip() {
    this.tooltipEl.style.display = 'none';
  }
}
