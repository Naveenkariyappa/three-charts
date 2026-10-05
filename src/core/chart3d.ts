import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BaseChart } from './base';
import { formatNumber, niceDomain, niceTicks } from './scale';
import { setLineResolution } from './marks';
import type { Chart3DOptions } from './types';

/** World box the data is normalized into: x and depth in [-5, 5], height in [0, H]. */
export const HALF = 5;
export const H = 6;

export interface Range {
  lo: number;
  hi: number;
}

interface Label3D {
  p: THREE.Vector3;
  text: string;
  strong?: boolean;
}

/**
 * Base for 3D charts: orbit camera (drag rotate, wheel zoom, right-drag pan),
 * lights, a floor grid with ticks, and HTML labels projected each frame.
 */
export abstract class Chart3D<O extends Chart3DOptions> extends BaseChart<O> {
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  controls: OrbitControls;
  protected axes = new THREE.Group();
  protected content = new THREE.Group();
  protected labels3d: Label3D[] = [];
  protected raycaster = new THREE.Raycaster();
  private v = new THREE.Vector3();

  constructor(container: HTMLElement, options: O) {
    super(container, options);
    this.camera.position.set(13, 10, 15);
    this.controls = new OrbitControls(this.camera, this.stage);
    this.controls.target.set(0, H / 2.5, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxDistance = 80;
    this.controls.minDistance = 4;
    this.controls.update();
    this.controls.addEventListener('change', () => this.invalidate());
    // Capture phase runs before OrbitControls' own wheel handler on the same element.
    this.stage.addEventListener('wheel', (e) => (this.controls.enableZoom = this.wantsWheel(e)), { capture: true });
    this.stage.addEventListener('pointerdown', () => (this.controls.enableZoom = true), { capture: true });
    this.controls.addEventListener('start', () => {
      this.dragging = true;
      this.hideTooltip();
    });
    this.controls.addEventListener('end', () => (this.dragging = false));
  }

  protected abstract buildContent(): void;

  protected build() {
    this.controls.autoRotate = !!this.opts.autoRotate;
    this.controls.autoRotateSpeed = 1.2;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(8, 14, 6);
    this.scene.add(sun);
    this.axes = new THREE.Group();
    this.content = new THREE.Group();
    this.labels3d = [];
    this.scene.add(this.axes, this.content);
    this.buildContent();
  }

  protected layout() {
    this.camera.aspect = this.width / Math.max(1, this.height);
    this.camera.updateProjectionMatrix();
    setLineResolution(this.scene, this.pixelWidth, this.pixelHeight);
  }

  draw(r: THREE.WebGLRenderer) {
    r.render(this.scene, this.camera);
  }

  protected onTick(): boolean {
    // update() returns true while damping or auto-rotate is still moving the camera.
    return this.controls.update();
  }

  protected onProgress() {
    this.content.scale.y = Math.max(0.0001, this.progress);
  }

  resetView() {
    this.controls.reset();
    this.invalidate();
  }

  destroy() {
    this.controls.dispose();
    super.destroy();
  }

  afterDraw() {
    const L = this.labels;
    L.begin();
    for (const l of this.labels3d) {
      const [x, y, ok] = this.project(l.p);
      if (ok) L.add(l.text, x, y, 0.5, 0.5, l.strong);
    }
    L.end();
  }

  /** World -> stage CSS px. Third value is false when behind the camera. */
  project(p: THREE.Vector3): [number, number, boolean] {
    const v = this.v.copy(p).project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.width, (-v.y * 0.5 + 0.5) * this.height, v.z < 1];
  }

  protected setRay(px: number, py: number) {
    this.raycaster.setFromCamera(new THREE.Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1), this.camera);
  }

  // ---- axes -----------------------------------------------------------------------

  /**
   * Floor grid + vertical axis. `xTicks` / `dTicks` map values (or categories)
   * to world positions; height ticks come from `height`.
   */
  protected buildAxes(
    xTicks: { w: number; label: string }[],
    dTicks: { w: number; label: string }[],
    height: Range,
  ) {
    const pts: number[] = [];
    for (const t of xTicks) pts.push(t.w, 0, -HALF, t.w, 0, HALF);
    for (const t of dTicks) pts.push(-HALF, 0, t.w, HALF, 0, t.w);
    // Outline of the floor and the back vertical edge.
    pts.push(-HALF, 0, -HALF, HALF, 0, -HALF, HALF, 0, -HALF, HALF, 0, HALF, HALF, 0, HALF, -HALF, 0, HALF, -HALF, 0, HALF, -HALF, 0, -HALF);
    pts.push(-HALF, 0, -HALF, -HALF, H, -HALF);
    const hTicks = niceTicks(height.lo, height.hi, 5);
    for (const t of hTicks) {
      const y = this.mapH(t, height);
      pts.push(-HALF, y, -HALF, HALF, y, -HALF, -HALF, y, -HALF, -HALF, y, HALF);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.axes.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: this.theme.grid })));

    for (const t of xTicks) this.labels3d.push({ p: new THREE.Vector3(t.w, 0, HALF + 0.7), text: t.label });
    for (const t of dTicks) this.labels3d.push({ p: new THREE.Vector3(HALF + 0.7, 0, t.w), text: t.label });
    for (const t of hTicks) this.labels3d.push({ p: new THREE.Vector3(-HALF - 0.5, this.mapH(t, height), -HALF), text: formatNumber(t) });
    const { xLabel, yLabel, zLabel } = this.opts;
    if (xLabel) this.labels3d.push({ p: new THREE.Vector3(0, 0, HALF + 1.7), text: xLabel, strong: true });
    if (yLabel) this.labels3d.push({ p: new THREE.Vector3(HALF + 1.9, 0, 0), text: yLabel, strong: true });
    if (zLabel) this.labels3d.push({ p: new THREE.Vector3(-HALF - 0.5, H + 0.7, -HALF), text: zLabel, strong: true });
  }

  protected numericTicks(r: Range, map: (v: number) => number) {
    return niceTicks(r.lo, r.hi, 5).map((v) => ({ w: map(v), label: formatNumber(v) }));
  }

  protected mapX(v: number, r: Range) {
    return ((v - r.lo) / (r.hi - r.lo || 1)) * 2 * HALF - HALF;
  }

  protected mapH(v: number, r: Range) {
    return ((v - r.lo) / (r.hi - r.lo || 1)) * H;
  }

  protected niceRange(lo: number, hi: number): Range {
    const [a, b] = niceDomain(lo, hi, 5);
    return { lo: a, hi: b };
  }
}
