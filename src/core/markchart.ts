import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { Hit, LabelPool, LabelStyle, LegendItem } from './base';
import { CartesianChart } from './cartesian';
import { createRects, ROUND_BOTTOM, ROUND_LEFT, ROUND_NONE, ROUND_RIGHT, ROUND_TOP, setLineResolution } from './marks';
import type { CartesianOptions } from './types';

/**
 * Declarative 2D marks.
 *
 * A chart describes rectangles, polygons, lines, points, labels and hover
 * regions; MarkBuilder batches them into at most five draw calls (fills,
 * rounded rects, one line batch per width, points). Coordinates are world
 * units: data values for charts with axes, CSS pixels (y down) for layouts.
 */

export type RoundEnd = 'top' | 'bottom' | 'left' | 'right' | 'none';

/** Point marker shapes. */
/** `disc` is a circle without the separating surface edge (for caps and joins). */
export const SHAPE = { circle: 0, square: 1, diamond: 2, triangle: 3, cross: 4, ring: 5, plus: 6, disc: 7 } as const;
export type ShapeName = keyof typeof SHAPE;

export type RegionShape =
  | { k: 'rect'; x0: number; y0: number; x1: number; y1: number }
  /** Center in world units, radius in CSS px. */
  | { k: 'circle'; x: number; y: number; r: number }
  | { k: 'poly'; pts: number[]; bbox?: [number, number, number, number] }
  /** Pixel space only. Angles clockwise from 12 o'clock, radians. */
  | { k: 'sector'; cx: number; cy: number; r0: number; r1: number; a0: number; a1: number }
  /** Polyline within `tol` CSS px. */
  | { k: 'path'; pts: number[]; tol: number };

/** A hover target. `hl` is drawn as the highlight instead of the target shape when given. */
export type Region = RegionShape & { hit: Hit; hl?: RegionShape };

export interface WorldLabel {
  text: string;
  x: number;
  y: number;
  ax: number;
  ay: number;
  strong: boolean;
  style?: LabelStyle;
}

interface LineBatch {
  pos: number[];
  col: number[];
  width: number;
  alpha: number;
  dashed: boolean;
}

const colorCache = new Map<string, THREE.Color>();
export function toColor(c: string): THREE.Color {
  let v = colorCache.get(c);
  if (!v) {
    v = new THREE.Color(c);
    colorCache.set(c, v);
  }
  return v;
}

/** Near-black or white text, whichever reads better on `bg`. */
export function inkOn(bg: string): string {
  const c = toColor(bg);
  // Relative luminance in linear space (THREE.Color is linear).
  const L = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return L > 0.22 ? '#0b0b0b' : '#ffffff';
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** Width in CSS px of `text` in the chart font (labels are HTML, so this matches what renders). */
export function textWidth(text: string, size = 11, weight = 400): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * size * 0.6;
  measureCtx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  return measureCtx.measureText(text).width;
}

/** Point on a circle, angle clockwise from 12 o'clock, y down. */
export function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
}

export class MarkBuilder {
  readonly labels: WorldLabel[] = [];
  readonly regions: Region[] = [];
  /** Rect grow animation: bars scale from `base` along the value axis. */
  grow: { base: number; horizontal: boolean } | null = null;
  /** Corner radius for rounded rect ends, CSS px. */
  radius = 4;
  /** Minimum rect width along the category axis, CSS px. */
  minWidth = 1;

  private fPos: number[] = [];
  private fCol: number[] = [];
  private rRect: number[] = [];
  private rCol: number[] = [];
  private rRound: number[] = [];
  private lines = new Map<string, LineBatch>();
  private pPos: number[] = [];
  private pCol: number[] = [];
  private pSize: number[] = [];
  private pShape: number[] = [];

  constructor(
    readonly ox: number,
    readonly oy: number,
    readonly yDown: boolean,
    readonly surface = '#ffffff',
  ) {}

  /**
   * Translucent-looking curve drawn opaque: the color pre-mixed with the surface.
   * Real alpha on long curves shows beads where the short segments overlap.
   */
  softLine(pts: number[], color: string, width = 2, alpha = 0.5) {
    const c = toColor(color).clone().lerp(toColor(this.surface), 1 - alpha);
    this.line(pts, '#' + c.getHexString(), width, 1);
  }

  // ---- filled shapes ----------------------------------------------------------

  /** Opaque rect with an optional rounded data-end (one instanced draw call for all). */
  rect(x0: number, y0: number, x1: number, y1: number, color: string, round: RoundEnd = 'none') {
    this.rRect.push(x0 - this.ox, y0 - this.oy, x1 - this.ox, y1 - this.oy);
    const c = toColor(color);
    this.rCol.push(c.r, c.g, c.b);
    // In y-down space the shader's "top" (max y) is the visual bottom.
    const r =
      round === 'top' ? (this.yDown ? ROUND_BOTTOM : ROUND_TOP)
      : round === 'bottom' ? (this.yDown ? ROUND_TOP : ROUND_BOTTOM)
      : round === 'left' ? ROUND_LEFT
      : round === 'right' ? ROUND_RIGHT
      : ROUND_NONE;
    this.rRound.push(r);
  }

  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, color: string, alpha = 1) {
    const c = toColor(color);
    const o = this.ox;
    const p = this.oy;
    this.fPos.push(ax - o, ay - p, 0, bx - o, by - p, 0, cx - o, cy - p, 0);
    for (let i = 0; i < 3; i++) this.fCol.push(c.r, c.g, c.b, alpha);
  }

  /** Axis-aligned translucent rect (fills batch). */
  box(x0: number, y0: number, x1: number, y1: number, color: string, alpha = 1) {
    this.tri(x0, y0, x1, y0, x1, y1, color, alpha);
    this.tri(x0, y0, x1, y1, x0, y1, color, alpha);
  }

  quad(pts: number[], color: string, alpha = 1) {
    this.tri(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5], color, alpha);
    this.tri(pts[0], pts[1], pts[4], pts[5], pts[6], pts[7], color, alpha);
  }

  /** Simple polygon (flat x,y list), optional holes. Triangulated with earcut. */
  poly(pts: number[], color: string, alpha = 1, holes: number[][] = []) {
    if (pts.length < 6) return;
    const toV = (a: number[]) => {
      const out: THREE.Vector2[] = [];
      for (let i = 0; i < a.length; i += 2) out.push(new THREE.Vector2(a[i], a[i + 1]));
      return out;
    };
    const contour = toV(pts);
    const hv = holes.map(toV);
    const faces = THREE.ShapeUtils.triangulateShape(contour, hv);
    const all = contour.concat(...hv);
    for (const [a, b, c] of faces) this.tri(all[a].x, all[a].y, all[b].x, all[b].y, all[c].x, all[c].y, color, alpha);
  }

  /** Band between two curves sharing x (or any paired top/bottom points). */
  band(top: number[], bottom: number[], color: string, alpha = 1) {
    for (let i = 0; i + 3 < top.length; i += 2) {
      this.tri(top[i], top[i + 1], top[i + 2], top[i + 3], bottom[i + 2], bottom[i + 3], color, alpha);
      this.tri(top[i], top[i + 1], bottom[i + 2], bottom[i + 3], bottom[i], bottom[i + 1], color, alpha);
    }
  }

  /** Ring sector, pixel space. Angles clockwise from 12 o'clock. `gap` in px trims both sides. */
  sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, color: string, alpha = 1, gap = 0) {
    if (gap > 0 && r1 > 0) {
      const g = gap / 2 / r1;
      a0 += g;
      a1 -= g;
    }
    if (a1 <= a0) return;
    const n = Math.max(2, Math.ceil(((a1 - a0) * Math.max(r1, 8)) / 4));
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      const [ax, ay] = polar(cx, cy, r1, t0);
      const [bx, by] = polar(cx, cy, r1, t1);
      if (r0 <= 0.01) {
        this.tri(cx, cy, ax, ay, bx, by, color, alpha);
      } else {
        const [cx0, cy0] = polar(cx, cy, r0, t0);
        const [dx0, dy0] = polar(cx, cy, r0, t1);
        this.tri(ax, ay, bx, by, dx0, dy0, color, alpha);
        this.tri(ax, ay, dx0, dy0, cx0, cy0, color, alpha);
      }
    }
  }

  // ---- strokes ----------------------------------------------------------------------

  /** Polyline (flat x,y list). Width in CSS px. */
  line(pts: number[], color: string, width = 2, alpha = 1, closed = false, dashed = false) {
    const n = pts.length / 2;
    if (n < 2) return;
    const key = `${width}|${alpha}|${dashed}`;
    let b = this.lines.get(key);
    if (!b) {
      b = { pos: [], col: [], width, alpha, dashed };
      this.lines.set(key, b);
    }
    const c = toColor(color);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      b.pos.push(pts[i * 2] - this.ox, pts[i * 2 + 1] - this.oy, 0, pts[j * 2] - this.ox, pts[j * 2 + 1] - this.oy, 0);
      b.col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }

  seg(x0: number, y0: number, x1: number, y1: number, color: string, width = 1, alpha = 1) {
    this.line([x0, y0, x1, y1], color, width, alpha);
  }

  /** Arc polyline, pixel space. */
  arc(cx: number, cy: number, r: number, a0: number, a1: number, color: string, width = 1, alpha = 1) {
    const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * Math.max(r, 8) / 4));
    const pts: number[] = [];
    for (let i = 0; i <= n; i++) pts.push(...polar(cx, cy, r, a0 + ((a1 - a0) * i) / n));
    this.line(pts, color, width, alpha);
  }

  // ---- points & text ------------------------------------------------------------------

  /** Marker. Size is the diameter in CSS px. */
  point(x: number, y: number, color: string, size = 8, shape: ShapeName = 'circle', alpha = 1) {
    const c = toColor(color);
    this.pPos.push(x - this.ox, y - this.oy, 0);
    this.pCol.push(c.r, c.g, c.b, alpha);
    this.pSize.push(size);
    this.pShape.push(SHAPE[shape]);
  }

  text(text: string, x: number, y: number, ax = 0.5, ay = 0.5, strong = false, style?: LabelStyle) {
    this.labels.push({ text, x, y, ax, ay, strong, style });
  }

  region(r: Region) {
    if (r.hl?.k === 'poly' && !r.hl.bbox) r.hl.bbox = polyBBox(r.hl.pts);
    if (r.k === 'poly' && !r.bbox) {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (let i = 0; i < r.pts.length; i += 2) {
        a = Math.min(a, r.pts[i]);
        c = Math.max(c, r.pts[i]);
        b = Math.min(b, r.pts[i + 1]);
        d = Math.max(d, r.pts[i + 1]);
      }
      r.bbox = [a, b, c, d];
    }
    this.regions.push(r);
  }

  // ---- output -----------------------------------------------------------------------------

  build(dpr: number, surface: string): THREE.Group {
    const g = new THREE.Group();
    if (this.fPos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(this.fPos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(this.fCol, 4));
      const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthTest: false });
      const mesh = new THREE.Mesh(geo, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = 0;
      mesh.userData.kind = 'fill';
      g.add(mesh);
    }
    if (this.rRect.length) {
      const mesh = createRects({
        rects: new Float32Array(this.rRect),
        colors: new Float32Array(this.rCol),
        round: new Float32Array(this.rRound),
        horizontal: this.grow?.horizontal,
        base: this.grow ? this.grow.base - (this.grow.horizontal ? this.ox : this.oy) : 0,
      });
      mesh.material.uniforms.uSurface.value.set(surface);
      mesh.renderOrder = 1;
      mesh.userData.kind = 'rects';
      mesh.userData.radius = this.radius;
      mesh.userData.minWidth = this.minWidth;
      mesh.userData.grows = !!this.grow;
      g.add(mesh);
    }
    for (const b of this.lines.values()) {
      const geo = new LineSegmentsGeometry();
      geo.setPositions(b.pos);
      geo.setColors(b.col);
      const m = new LineMaterial({
        vertexColors: true,
        linewidth: b.width * dpr,
        worldUnits: false,
        transparent: true,
        opacity: b.alpha,
        dashed: b.dashed,
        dashSize: 4,
        gapSize: 3,
      });
      m.depthTest = false;
      m.userData.alpha = b.alpha;
      const l = new LineSegments2(geo, m);
      if (b.dashed) l.computeLineDistances();
      l.frustumCulled = false;
      l.renderOrder = 2;
      l.userData.kind = 'lines';
      g.add(l);
    }
    if (this.pPos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pPos, 3));
      geo.setAttribute('aColor', new THREE.Float32BufferAttribute(this.pCol, 4));
      geo.setAttribute('aSize', new THREE.Float32BufferAttribute(this.pSize.map((s) => s * dpr), 1));
      geo.setAttribute('aShape', new THREE.Float32BufferAttribute(this.pShape, 1));
      const p = new THREE.Points(geo, shapePointMaterial(surface, dpr));
      p.frustumCulled = false;
      p.renderOrder = 3;
      p.userData.kind = 'points';
      g.add(p);
    }
    return g;
  }
}

// ---- shaped point material -------------------------------------------------------------

const shapeVert = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
attribute float aShape;
uniform float uScale;
varying vec4 vColor;
varying float vSize;
varying float vShape;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale;
  vColor = aColor;
  vSize = gl_PointSize;
  vShape = aShape;
}`;

const shapeFrag = /* glsl */ `
uniform vec3 uRing;
uniform float uRingWidth;
uniform float uOpacity;
varying vec4 vColor;
varying float vSize;
varying float vShape;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  float R = vSize * 0.5;
  vec2 p = (gl_PointCoord * 2.0 - 1.0) * R; // px from center
  p.y = -p.y;
  float d;
  int s = int(vShape + 0.5);
  if (s == 1) d = sdBox(p, vec2(R * 0.82));
  else if (s == 2) d = (abs(p.x) + abs(p.y) - R) * 0.7071;
  else if (s == 3) { vec2 q = vec2(abs(p.x), p.y + R * 0.25); d = max(q.y - R * 0.75, (q.x * 0.866 + q.y * 0.5) - R * 0.5); }
  else if (s == 4) { vec2 q = abs(vec2(p.x + p.y, p.x - p.y)) * 0.7071; d = min(sdBox(q, vec2(R * 0.9, R * 0.16)), sdBox(q.yx, vec2(R * 0.9, R * 0.16))); }
  else if (s == 5) d = abs(length(p) - R * 0.78) - R * 0.16;
  else if (s == 6) d = min(sdBox(p, vec2(R * 0.9, R * 0.16)), sdBox(p.yx, vec2(R * 0.9, R * 0.16)));
  else d = length(p) - R;
  float a = 1.0 - smoothstep(-0.75, 0.75, d);
  if (a <= 0.01) discard;
  // Surface-colored edge separates overlapping filled markers.
  float ring = (uRingWidth > 0.0 && (s == 0 || s == 1 || s == 2 || s == 3)) ? smoothstep(-uRingWidth - 0.75, -uRingWidth + 0.25, d) : 0.0;
  gl_FragColor = vec4(mix(vColor.rgb, uRing, ring), a * vColor.a * uOpacity);
  #include <colorspace_fragment>
}`;

/** Per-vertex color/size/shape point material (attributes aColor vec4, aSize px, aShape). */
export function shapePointMaterial(surface: string, dpr: number, depth = false) {
  return new THREE.ShaderMaterial({
    vertexShader: shapeVert,
    fragmentShader: shapeFrag,
    transparent: !depth,
    depthTest: depth,
    depthWrite: depth,
    uniforms: {
      uScale: { value: 1 },
      uOpacity: { value: 1 },
      uRing: { value: new THREE.Color(surface) },
      uRingWidth: { value: dpr },
    },
  });
}

/** Fade / grow a built mark group. */
export function applyProgress(g: THREE.Object3D, t: number) {
  g.traverse((o) => {
    const kind = o.userData.kind;
    if (kind === 'fill') ((o as THREE.Mesh).material as THREE.Material).opacity = t;
    else if (kind === 'lines') {
      const m = (o as LineSegments2).material as LineMaterial;
      m.opacity = (m.userData.alpha ?? 1) * t;
    } else if (kind === 'points') {
      const u = ((o as THREE.Points).material as THREE.ShaderMaterial).uniforms;
      u.uScale.value = 0.3 + 0.7 * t;
      u.uOpacity.value = t;
    } else if (kind === 'rects') {
      const u = ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
      if (o.userData.grows) u.uGrow.value = t;
    }
  });
}

/**
 * Dash lengths are measured along the line in world units, which on a data
 * axis can be anything. Re-measure them in CSS px so dashes look the same on
 * every chart and at every zoom.
 */
function pixelDashes(l: LineSegments2, sx: number, sy: number) {
  const g = l.geometry;
  const s = g.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute | undefined;
  const e = g.getAttribute('instanceEnd') as THREE.InterleavedBufferAttribute | undefined;
  const ds = g.getAttribute('instanceDistanceStart') as THREE.InterleavedBufferAttribute | undefined;
  if (!s || !e || !ds) return;
  const arr = ds.data.array as Float32Array;
  let acc = 0;
  for (let i = 0; i < s.count; i++) {
    arr[i * 2] = acc;
    acc += Math.hypot((e.getX(i) - s.getX(i)) * sx, (e.getY(i) - s.getY(i)) * sy);
    arr[i * 2 + 1] = acc;
  }
  ds.data.needsUpdate = true;
}

/** Update rect uniforms and dash lengths after a zoom / resize. */
export function applyScale(g: THREE.Object3D, ppu: THREE.Vector2, dpr: number) {
  g.traverse((o) => {
    if (o.userData.kind === 'lines' && ((o as LineSegments2).material as LineMaterial).dashed) {
      pixelDashes(o as LineSegments2, ppu.x / dpr, ppu.y / dpr);
      return;
    }
    if (o.userData.kind !== 'rects') return;
    const u = ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
    u.uPxPerUnit.value.copy(ppu);
    u.uRadius.value = (o.userData.radius ?? 4) * dpr;
    u.uMinW.value = (o.userData.minWidth ?? 1) * dpr;
  });
}

// ---- base chart ------------------------------------------------------------------------

const SVGNS = 'http://www.w3.org/2000/svg';

/**
 * Base for most chart types: computes a domain (or a pixel layout), describes
 * marks with a MarkBuilder, and gets axes, zoom, hover, tooltips, highlight
 * outlines and animation for free.
 */
export abstract class MarkChart<O extends CartesianOptions> extends CartesianChart<O> {
  /** 'data': world = data with axes. 'pixel': world = CSS px of the plot, y down, re-laid-out on resize. */
  protected space: 'data' | 'pixel' = 'data';
  /** Data-space charts whose marks depend on pixel size (label packing, px-sized bins) rebuild on resize. */
  protected relayout = false;
  protected group: THREE.Group | null = null;
  protected regions: Region[] = [];
  private wlabels: WorldLabel[] = [];
  private svg: SVGSVGElement;
  private hlRegion: Region | null = null;

  constructor(container: HTMLElement, options: O) {
    super(container, options);
    this.svg = document.createElementNS(SVGNS, 'svg') as SVGSVGElement;
    this.svg.setAttribute('class', 'tc-hl');
    this.overlay.appendChild(this.svg);
  }

  /** Describe the chart. */
  protected abstract marks(b: MarkBuilder): void;

  /** Data mode: set `this.full` (and categories). Pixel mode: nothing to do. */
  protected computeDomain() {
    this.full = { x0: 0, x1: Math.max(1, this.width), y0: Math.max(1, this.height), y1: 0 };
  }

  protected buildMarks() {
    if (this.space === 'data') this.rebuildMarks();
  }

  protected onPlotSized() {
    if (this.space !== 'pixel') {
      if (this.relayout) this.rebuildMarks();
      return;
    }
    this.full = { x0: 0, x1: this.plot.width, y0: this.plot.height, y1: 0 };
    this.origin = { x: 0, y: 0 };
    this.view = { ...this.full };
    this.rebuildMarks();
  }

  protected rebuildMarks() {
    if (this.group) {
      this.scene.remove(this.group);
      this.disposeScene(this.group);
    }
    const b = new MarkBuilder(this.origin.x, this.origin.y, this.space === 'pixel', this.theme.surface);
    this.marks(b);
    this.group = b.build(this.dpr, this.theme.surface);
    this.scene.add(this.group);
    this.regions = b.regions;
    this.wlabels = b.labels;
    this.clearHighlight();
    applyProgress(this.group, this.progress);
    // Color-scale legends can depend on the layout (e.g. hexbin counts); keep them in sync.
    if (this.customLegend()) this.renderLegend();
  }

  protected onProgress() {
    if (this.group) applyProgress(this.group, this.progress);
  }

  protected onViewChange() {
    if (this.group) {
      applyScale(this.group, this.pxPerUnit(), this.dpr);
      setLineResolution(this.group, this.plot.width * this.dpr, this.plot.height * this.dpr);
    }
    this.clearHighlight();
    this.showCrosshair(null);
    this.showDot(null);
  }

  protected addLabels(L: LabelPool) {
    const p = this.plot;
    for (const l of this.wlabels) {
      const [x, y] = this.toPx(l.x, l.y);
      if (x < p.left - 2 || x > p.left + p.width + 2 || y < p.top - 2 || y > p.top + p.height + 2) continue;
      L.add(l.text, x, y, l.ax, l.ay, l.strong, l.style);
    }
  }

  // ---- hover ------------------------------------------------------------------------

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    const r = this.findRegion(px, py);
    this.hlRegion = r;
    return r ? r.hit : null;
  }

  protected findRegion(px: number, py: number): Region | null {
    const [x, y] = this.toData(px, py);
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (this.inRegion(r, x, y, px, py)) return r;
    }
    return null;
  }

  private inRegion(r: Region, x: number, y: number, px: number, py: number): boolean {
    switch (r.k) {
      case 'rect':
        return x >= Math.min(r.x0, r.x1) && x <= Math.max(r.x0, r.x1) && y >= Math.min(r.y0, r.y1) && y <= Math.max(r.y0, r.y1);
      case 'circle': {
        const [cx, cy] = this.toPx(r.x, r.y);
        return Math.hypot(cx - px, cy - py) <= r.r;
      }
      case 'poly': {
        const b = r.bbox!;
        if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
        return pointInPoly(r.pts, x, y);
      }
      case 'sector': {
        const dx = x - r.cx;
        const dy = r.cy - y;
        const d = Math.hypot(dx, dy);
        if (d < r.r0 || d > r.r1) return false;
        let a = Math.atan2(dx, dy);
        if (a < r.a0) a += Math.PI * 2;
        if (a > r.a1) a -= Math.PI * 2;
        return a >= r.a0 && a <= r.a1;
      }
      case 'path': {
        for (let i = 0; i + 3 < r.pts.length; i += 2) {
          const [ax, ay] = this.toPx(r.pts[i], r.pts[i + 1]);
          const [bx, by] = this.toPx(r.pts[i + 2], r.pts[i + 3]);
          if (segDist(px, py, ax, ay, bx, by) <= r.tol) return true;
        }
        return false;
      }
    }
  }

  protected highlight(hit: Hit | null) {
    if (!hit || !this.hlRegion) return this.clearHighlight();
    this.drawOutline(this.hlRegion);
  }

  protected clearHighlight() {
    this.svg.textContent = '';
  }

  /** Outline a shape (or a region's highlight shape) in the SVG layer. `append` keeps earlier outlines. */
  protected drawOutline(region: RegionShape & { hl?: RegionShape }, append = false) {
    const r: RegionShape = region.hl ?? region;
    const P = (x: number, y: number) => this.toPx(x, y);
    let d = '';
    switch (r.k) {
      case 'rect': {
        const [ax, ay] = P(r.x0, r.y0);
        const [bx, by] = P(r.x1, r.y1);
        d = `M${ax},${ay}H${bx}V${by}H${ax}Z`;
        break;
      }
      case 'circle': {
        const [cx, cy] = P(r.x, r.y);
        const rr = r.r + 1;
        d = `M${cx - rr},${cy}a${rr},${rr} 0 1,0 ${rr * 2},0a${rr},${rr} 0 1,0 ${-rr * 2},0`;
        break;
      }
      case 'poly':
      case 'path': {
        for (let i = 0; i < r.pts.length; i += 2) {
          const [x, y] = P(r.pts[i], r.pts[i + 1]);
          d += (i ? 'L' : 'M') + x + ',' + y;
        }
        if (r.k === 'poly') d += 'Z';
        break;
      }
      case 'sector': {
        const pt = (rad: number, a: number) => {
          const [x, y] = polar(r.cx, r.cy, rad, a);
          return P(x, y);
        };
        const large = r.a1 - r.a0 > Math.PI ? 1 : 0;
        const [ox, oy] = pt(r.r1, r.a0);
        const [ex, ey] = pt(r.r1, r.a1);
        const rr = Math.abs(P(r.r1, 0)[0] - P(0, 0)[0]);
        const r0 = Math.abs(P(r.r0, 0)[0] - P(0, 0)[0]);
        if (r.r0 > 0.5) {
          const [ix, iy] = pt(r.r0, r.a1);
          const [jx, jy] = pt(r.r0, r.a0);
          d = `M${ox},${oy}A${rr},${rr} 0 ${large} 1 ${ex},${ey}L${ix},${iy}A${r0},${r0} 0 ${large} 0 ${jx},${jy}Z`;
        } else {
          const [cx, cy] = P(r.cx, r.cy);
          d = `M${cx},${cy}L${ox},${oy}A${rr},${rr} 0 ${large} 1 ${ex},${ey}Z`;
        }
        break;
      }
    }
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', r.k === 'path' ? 'none' : 'rgba(127,127,127,0.12)');
    path.setAttribute('stroke', this.theme.textPrimary);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linejoin', 'round');
    if (!append) this.svg.textContent = '';
    this.svg.appendChild(path);
  }

  protected legendItems(): LegendItem[] {
    return [];
  }
}

function polyBBox(pts: number[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    a = Math.min(a, pts[i]);
    c = Math.max(c, pts[i]);
    b = Math.min(b, pts[i + 1]);
    d = Math.max(d, pts[i + 1]);
  }
  return [a, b, c, d];
}

export function pointInPoly(pts: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
