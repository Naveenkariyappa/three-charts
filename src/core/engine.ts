import * as THREE from 'three';

/**
 * One WebGL context for every chart on the page.
 *
 * Browsers cap live WebGL contexts (~16), so a canvas-per-chart design breaks
 * on dashboards. Instead a single hidden renderer draws each chart into the
 * corner of its buffer, then copies those pixels into the chart's own 2D
 * canvas. Charts render only when something changed (or while animating) and
 * only while on screen, so idle and scrolled-away charts cost nothing.
 */
export interface EngineClient {
  /** Size of the chart in device pixels. */
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  dirty: boolean;
  inView: boolean;
  /** Advance animations; return true to keep receiving frames. */
  tick(now: number): boolean;
  /** Draw into the renderer. The engine has already cleared the chart's region. */
  draw(renderer: THREE.WebGLRenderer): void;
  /** Called after the copy, e.g. to place HTML labels. */
  afterDraw?(): void;
}

class Engine {
  readonly renderer: THREE.WebGLRenderer;
  private clients = new Set<EngineClient>();
  private raf = 0;
  private bufW = 1;
  private bufH = 1;

  constructor() {
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1); // clients work in device pixels
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    // After a GPU reset three.js re-uploads resources on the next render; repaint everyone.
    canvas.addEventListener('webglcontextrestored', () => {
      for (const c of this.clients) c.dirty = true;
      this.request();
    });
  }

  add(c: EngineClient) {
    this.clients.add(c);
    this.request();
  }

  remove(c: EngineClient) {
    this.clients.delete(c);
  }

  request() {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    let again = false;
    for (const c of this.clients) {
      if (!c.inView || this.failed.has(c)) continue;
      // One broken chart must not stop every other chart on the page.
      try {
        const animating = c.tick(now);
        if (animating) again = true;
        if (!c.dirty && !animating) continue;
        c.dirty = false;
        this.paint(c);
      } catch (err) {
        this.failed.add(c);
        console.error('three-charts: a chart failed to render and was skipped.', err);
      }
    }
    if (again) this.request();
  };

  private failed = new WeakSet<EngineClient>();

  private paint(c: EngineClient) {
    const w = c.pixelWidth;
    const h = c.pixelHeight;
    if (w < 1 || h < 1) return;

    // Grow the shared buffer to fit the largest chart seen; never shrink it.
    if (w > this.bufW || h > this.bufH) {
      this.bufW = Math.max(w, this.bufW);
      this.bufH = Math.max(h, this.bufH);
      this.renderer.setSize(this.bufW, this.bufH, false);
    }

    const r = this.renderer;
    r.setScissorTest(true);
    r.setScissor(0, 0, w, h);
    r.setViewport(0, 0, w, h);
    r.clear();
    c.draw(r);
    r.setScissorTest(false);

    // WebGL's origin is bottom-left, so the chart sits at the bottom of the buffer.
    if (c.canvas.width !== w || c.canvas.height !== h) {
      c.canvas.width = w;
      c.canvas.height = h;
    }
    c.ctx.clearRect(0, 0, w, h);
    c.ctx.drawImage(r.domElement, 0, this.bufH - h, w, h, 0, 0, w, h);
    c.afterDraw?.();
  }
}

interface Shared {
  engine: Engine | null;
  styles: boolean;
  sync: Map<string, Set<unknown>>;
}

/**
 * Page-wide state lives on globalThis, so charts copied as separate
 * single-file builds still share one WebGL context, one stylesheet and sync groups.
 */
export function shared(): Shared {
  const g = globalThis as typeof globalThis & { __threeCharts?: Shared };
  return (g.__threeCharts ??= { engine: null, styles: false, sync: new Map() });
}

/** Lazily created so importing the library has no side effects. */
export function getEngine(): Engine {
  const s = shared();
  if (!s.engine) {
    s.engine = new Engine();
    s.engine.renderer.domElement.addEventListener('webglcontextlost', () => console.warn('three-charts: WebGL context lost; charts redraw when the browser restores it.'));
  }
  return s.engine;
}
