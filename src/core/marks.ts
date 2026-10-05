import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/**
 * GPU marks shared by the charts. Each is a single draw call regardless of
 * how many data points it holds.
 */

// ---- Rectangles (bars, histogram, candles, heat cells) -----------------------

export const ROUND_NONE = 0;
export const ROUND_TOP = 1;
export const ROUND_BOTTOM = 2;
export const ROUND_RIGHT = 3;
export const ROUND_LEFT = 4;

const rectVert = /* glsl */ `
attribute vec4 aRect;
attribute vec3 aColor;
attribute float aRound;
attribute float aIndex;
uniform vec2 uPxPerUnit;
uniform float uGrow;
uniform float uBase;
uniform float uHorizontal;
uniform float uGap;
uniform float uMinW;
uniform float uSideGap;
uniform float uMinH;
varying vec2 vLocal;
varying vec2 vSize;
varying vec3 vColor;
varying float vRound;
varying float vIndex;
void main() {
  vec4 r = aRect;
  if (uHorizontal > 0.5) { r.x = mix(uBase, r.x, uGrow); r.z = mix(uBase, r.z, uGrow); }
  else { r.y = mix(uBase, r.y, uGrow); r.w = mix(uBase, r.w, uGrow); }
  vec2 p0 = min(r.xy, r.zw) * uPxPerUnit;
  vec2 p1 = max(r.xy, r.zw) * uPxPerUnit;
  vec2 c = (p0 + p1) * 0.5;
  if (uHorizontal > 0.5) {
    p0.x += uGap * 0.5; p1.x -= uGap * 0.5;
    p0.y += uSideGap * 0.5; p1.y -= uSideGap * 0.5;
    float h = max(p1.y - p0.y, uMinW); p0.y = c.y - h * 0.5; p1.y = c.y + h * 0.5;
  } else {
    p0.y += uGap * 0.5; p1.y -= uGap * 0.5;
    p0.x += uSideGap * 0.5; p1.x -= uSideGap * 0.5;
    float w = max(p1.x - p0.x, uMinW); p0.x = c.x - w * 0.5; p1.x = c.x + w * 0.5;
  }
  p1 = max(p1, p0);
  if (uHorizontal > 0.5) { float d = max(0.0, uMinH - (p1.x - p0.x)) * 0.5; p0.x -= d; p1.x += d; }
  else { float d = max(0.0, uMinH - (p1.y - p0.y)) * 0.5; p0.y -= d; p1.y += d; }
  vec2 px = mix(p0, p1, position.xy);
  vLocal = px - p0;
  vSize = p1 - p0;
  vColor = aColor;
  vRound = aRound;
  vIndex = aIndex;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(px / uPxPerUnit, 0.0, 1.0);
}`;

const rectFrag = /* glsl */ `
uniform float uRadius;
uniform float uHover;
uniform vec3 uSurface;
varying vec2 vLocal;
varying vec2 vSize;
varying vec3 vColor;
varying float vRound;
varying float vIndex;
void main() {
  vec2 p = vLocal;
  vec2 s = vSize;
  // Rotate so the rounded (data) end is always "top".
  if (vRound > 1.5 && vRound < 2.5) { p.y = s.y - p.y; }
  else if (vRound > 2.5) { p = p.yx; s = s.yx; if (vRound > 3.5) p.y = s.y - p.y; }
  float a = 1.0;
  if (vRound > 0.5) {
    float r = min(uRadius, min(s.x * 0.5, s.y));
    vec2 q = vec2(max(r - p.x, p.x - (s.x - r)), p.y - (s.y - r));
    if (q.x > 0.0 && q.y > 0.0) a = 1.0 - smoothstep(r - 0.75, r + 0.75, length(q));
  }
  if (a <= 0.0) discard;
  vec3 col = vColor;
  if (uHover >= 0.0 && abs(vIndex - uHover) > 0.5) col = mix(col, uSurface, 0.5);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

export interface RectSpec {
  /** x0,y0,x1,y1 per rect, in world units. */
  rects: Float32Array;
  /** Linear RGB per rect. */
  colors: Float32Array;
  /** ROUND_* per rect. */
  round?: Float32Array;
  /** Hover id per rect (defaults to rect index). */
  ids?: Float32Array;
  horizontal?: boolean;
  base?: number;
}

export function createRects(spec: RectSpec): THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> {
  const n = spec.rects.length / 4;
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0.5, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index;
  g.setAttribute('position', quad.getAttribute('position'));
  g.setAttribute('aRect', new THREE.InstancedBufferAttribute(spec.rects, 4));
  g.setAttribute('aColor', new THREE.InstancedBufferAttribute(spec.colors, 3));
  g.setAttribute('aRound', new THREE.InstancedBufferAttribute(spec.round ?? new Float32Array(n), 1));
  let ids = spec.ids;
  if (!ids) {
    ids = new Float32Array(n);
    for (let i = 0; i < n; i++) ids[i] = i;
  }
  g.setAttribute('aIndex', new THREE.InstancedBufferAttribute(ids, 1));
  g.instanceCount = n;
  const m = new THREE.ShaderMaterial({
    vertexShader: rectVert,
    fragmentShader: rectFrag,
    transparent: true,
    depthTest: false,
    // Pixel-space charts flip y, which reverses winding.
    side: THREE.DoubleSide,
    uniforms: {
      uPxPerUnit: { value: new THREE.Vector2(1, 1) },
      uGrow: { value: 1 },
      uBase: { value: spec.base ?? 0 },
      uHorizontal: { value: spec.horizontal ? 1 : 0 },
      uGap: { value: 0 },
      uMinW: { value: 1 },
      uSideGap: { value: 0 },
      uMinH: { value: 0 },
      uRadius: { value: 4 },
      uHover: { value: -1 },
      uSurface: { value: new THREE.Color() },
    },
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

// ---- Points (scatter, bubble, 3D scatter) ------------------------------------

const pointVert = /* glsl */ `
uniform float uSize;
uniform float uScale;
#ifdef USE_SIZE
attribute float aSize;
#endif
varying float vSize;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #ifdef USE_SIZE
  gl_PointSize = aSize * uScale;
  #else
  gl_PointSize = uSize * uScale;
  #endif
  vSize = gl_PointSize;
}`;

const pointFrag = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uRing;
uniform float uRingWidth;
uniform float uOpacity;
varying float vSize;
void main() {
  float R = vSize * 0.5;
  float d = length(gl_PointCoord * 2.0 - 1.0) * R;
  float a = 1.0 - smoothstep(R - 1.0, R, d);
  if (a <= 0.01) discard;
  float ring = uRingWidth > 0.0 ? smoothstep(R - uRingWidth - 0.75, R - uRingWidth + 0.25, d) : 0.0;
  gl_FragColor = vec4(mix(uColor, uRing, ring), a * uOpacity);
  #include <colorspace_fragment>
}`;

export interface PointSpec {
  positions: Float32Array;
  color: string;
  /** Diameter in device px (when `sizes` is absent). */
  size: number;
  /** Per-point diameter in device px. */
  sizes?: Float32Array;
  ring?: string;
  ringWidth?: number;
  opacity?: number;
  depth?: boolean;
}

export function createPoints(spec: PointSpec): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(spec.positions, 3));
  if (spec.sizes) g.setAttribute('aSize', new THREE.BufferAttribute(spec.sizes, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: pointVert,
    fragmentShader: pointFrag,
    defines: spec.sizes ? { USE_SIZE: '' } : {},
    transparent: !spec.depth,
    depthTest: !!spec.depth,
    depthWrite: !!spec.depth,
    uniforms: {
      uSize: { value: spec.size },
      uScale: { value: 1 },
      uColor: { value: new THREE.Color(spec.color) },
      uRing: { value: new THREE.Color(spec.ring ?? spec.color) },
      uRingWidth: { value: spec.ringWidth ?? 0 },
      uOpacity: { value: spec.opacity ?? 1 },
    },
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

// ---- Lines ---------------------------------------------------------------------

/** Screen-space-width line. `positions` is xyz per vertex. Width in device px. */
export function createLine(positions: Float32Array, color: string, width: number): Line2 {
  const g = new LineGeometry();
  g.setPositions(positions);
  const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, worldUnits: false });
  m.depthTest = false;
  const line = new Line2(g, m);
  line.frustumCulled = false;
  return line;
}

/** Reveal a Line2 progressively (0..1). */
export function revealLine(line: Line2, t: number) {
  const g = line.geometry as LineGeometry;
  const total = (g.attributes.instanceStart as THREE.InterleavedBufferAttribute).count;
  g.instanceCount = Math.max(0, Math.round(total * t));
}

export function setLineResolution(obj: THREE.Object3D, w: number, h: number) {
  obj.traverse((o) => {
    const m = (o as Line2).material as LineMaterial | undefined;
    if (m && (m as LineMaterial).isLineMaterial) m.resolution.set(w, h);
  });
}

/** Cheap 1px segments (grids, wicks of huge datasets). `positions`: pairs of xyz. */
export function createSegments(positions: Float32Array, color: string, opacity = 1): THREE.LineSegments {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const m = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: false });
  const l = new THREE.LineSegments(g, m);
  l.frustumCulled = false;
  return l;
}

export { Line2, LineGeometry, LineMaterial };
