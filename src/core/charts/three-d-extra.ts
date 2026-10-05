import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { Hit, LegendItem } from '../base';
import { Chart3D, H, HALF, type Range } from '../chart3d';
import { extent, formatNumber } from '../scale';
import { sampleRamp } from '../theme';
import type { IsosurfaceOptions, Mesh3DOptions, VectorField3DOptions, Waterfall3DOptions } from '../types2';

function rampLegend(stops: string[], lo: string, hi: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'tc-ramp';
  el.innerHTML = `<span>${lo}</span><i style="background:linear-gradient(90deg,${stops.join(',')})"></i><span>${hi}</span>`;
  return el;
}

// ---- Arbitrary mesh ----------------------------------------------------------------------------

export class Mesh3DChart extends Chart3D<Mesh3DOptions> {
  readonly type = 'mesh3d' as const;
  private mesh: THREE.Mesh | null = null;
  private vr: Range = { lo: 0, hi: 1 };

  protected customLegend() {
    return this.opts.values ? rampLegend(this.theme.sequential, formatNumber(this.vr.lo), formatNumber(this.vr.hi)) : null;
  }

  protected buildContent() {
    const { vertices, indices, values } = this.opts;
    const n = vertices.length / 3;
    // Fit the mesh into the chart box, keeping its proportions; data z is up.
    const xs = new Float32Array(n), ys = new Float32Array(n), zs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = vertices[i * 3];
      ys[i] = vertices[i * 3 + 1];
      zs[i] = vertices[i * 3 + 2];
    }
    const [x0, x1] = extent(xs);
    const [y0, y1] = extent(ys);
    const [z0, z1] = extent(zs);
    const k = Math.min((2 * HALF) / (x1 - x0 || 1), (2 * HALF) / (y1 - y0 || 1), H / (z1 - z0 || 1));
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (xs[i] - (x0 + x1) / 2) * k;
      pos[i * 3 + 1] = (zs[i] - z0) * k;
      pos[i * 3 + 2] = -(ys[i] - (y0 + y1) / 2) * k;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(Array.from(indices));
    if (values) {
      const [lo, hi] = extent(values);
      this.vr = { lo, hi };
      const col = new Float32Array(n * 3);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        sampleRamp(this.theme.sequential, (values[i] - lo) / (hi - lo || 1), c);
        col.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: values ? 0xffffff : new THREE.Color(this.color(0)),
      vertexColors: !!values,
      flatShading: !!this.opts.flatShading,
      side: THREE.DoubleSide,
      roughness: 0.6,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.content.add(this.mesh);
    if (this.opts.wireframe) {
      this.content.add(new THREE.LineSegments(new THREE.WireframeGeometry(g), new THREE.LineBasicMaterial({ color: this.theme.textPrimary, transparent: true, opacity: 0.12 })));
    }
    this.buildAxes([], [], { lo: z0, hi: z1 });
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.mesh) return null;
    this.setRay(px, py);
    const hit = this.raycaster.intersectObject(this.mesh, false)[0];
    if (!hit || !hit.face) return null;
    const { vertices, values } = this.opts;
    // Report the closest corner of the hit triangle.
    const f = hit.face;
    const local = this.mesh.worldToLocal(hit.point.clone());
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    let best = f.a;
    let bd = Infinity;
    for (const i of [f.a, f.b, f.c]) {
      const d = local.distanceToSquared(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return {
      series: 'Vertex',
      index: best,
      title: `Vertex ${best}`,
      values: { x: formatNumber(vertices[best * 3]), y: formatNumber(vertices[best * 3 + 1]), z: formatNumber(vertices[best * 3 + 2]), ...(values ? { Value: formatNumber(values[best]) } : {}) },
    };
  }
}

// ---- Isosurface ------------------------------------------------------------------------------------

export class IsosurfaceChart extends Chart3D<IsosurfaceOptions> {
  readonly type = 'isosurface' as const;
  private shells: { level: number; mesh: MarchingCubes }[] = [];

  private levelColor(i: number) {
    const n = this.opts.levels.length;
    return '#' + sampleRamp(this.theme.sequential, n > 1 ? 0.25 + (0.75 * i) / (n - 1) : 0.7).getHexString();
  }

  protected legendItems(): LegendItem[] {
    return this.sortedLevels().map((l, i) => ({ name: `≥ ${formatNumber(l)}`, color: this.levelColor(i) }));
  }

  private sortedLevels() {
    return [...this.opts.levels].sort((a, b) => a - b);
  }

  protected buildContent() {
    const { data, size } = this.opts;
    const levels = this.sortedLevels();
    this.shells = [];
    levels.forEach((level, i) => {
      if (this.hidden.has(`≥ ${formatNumber(level)}`)) return;
      // Outer (lower) levels are translucent so inner shells show through.
      const inner = i === levels.length - 1;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.levelColor(i)),
        roughness: 0.45,
        transparent: !inner,
        opacity: inner ? 1 : 0.3 + 0.2 * (i / Math.max(1, levels.length - 1)),
        depthWrite: inner,
        side: THREE.DoubleSide,
      });
      const mc = new MarchingCubes(size, mat, false, false, 250_000);
      mc.isolation = level;
      const f = mc.field as Float32Array;
      for (let k = 0; k < f.length && k < data.length; k++) f[k] = data[k];
      mc.update();
      mc.scale.set(HALF, H / 2, HALF);
      mc.position.y = H / 2;
      mc.renderOrder = levels.length - i;
      this.content.add(mc);
      this.shells.push({ level, mesh: mc });
    });
    const ticks = [0, 0.5, 1].map((t) => ({ w: -HALF + t * 2 * HALF, label: String(Math.round(t * (size - 1))) }));
    this.buildAxes(ticks, ticks, { lo: 0, hi: size - 1 });
  }

  protected hitTest(px: number, py: number): Hit | null {
    this.setRay(px, py);
    for (const s of [...this.shells].reverse()) {
      const hit = this.raycaster.intersectObject(s.mesh, false)[0];
      if (hit) {
        const p = this.content.worldToLocal(hit.point.clone());
        return { series: 'Isosurface', index: 0, title: `Shell ≥ ${formatNumber(s.level)}`, values: { x: formatNumber(p.x), y: formatNumber(-p.z), z: formatNumber(p.y) } };
      }
    }
    return null;
  }
}

// ---- 3D vector field -------------------------------------------------------------------------------

export class VectorField3DChart extends Chart3D<VectorField3DOptions> {
  readonly type = 'vectorField3d' as const;
  private centers: THREE.Vector3[] = [];
  private maxMag = 1;

  protected customLegend() {
    return rampLegend(this.theme.sequential.slice(3), '0', `${formatNumber(this.maxMag)} (magnitude)`);
  }

  protected buildContent() {
    const { x, y, z, u, v, w } = this.opts;
    const n = Math.min(x.length, u.length);
    const rx = { lo: extent(x)[0], hi: extent(x)[1] };
    const ry = { lo: extent(y)[0], hi: extent(y)[1] };
    const rz = { lo: extent(z)[0], hi: extent(z)[1] };
    let max = 0;
    for (let i = 0; i < n; i++) max = Math.max(max, Math.hypot(u[i], v[i], w[i]));
    this.maxMag = max || 1;
    const spacing = (2 * HALF) / Math.cbrt(Math.max(1, n));
    const geo = new THREE.ConeGeometry(0.09, 1, 8);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.5 }), n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    const ramp = this.theme.sequential.slice(3);
    this.centers = [];
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3(this.mapX(x[i], rx), this.mapH(z[i], rz), -this.mapX(y[i], ry));
      // Data (u, v, w) -> world (x, up, -depth).
      const dir = new THREE.Vector3(u[i], w[i], -v[i]);
      const mag = dir.length();
      q.setFromUnitVectors(up, mag ? dir.clone().normalize() : up);
      const len = Math.max(0.05, (mag / this.maxMag) * spacing * 0.9);
      m.compose(p, q, new THREE.Vector3(len * 1.3, len, len * 1.3));
      mesh.setMatrixAt(i, m);
      sampleRamp(ramp, mag / this.maxMag, c);
      mesh.setColorAt(i, c);
      this.centers.push(p);
    }
    mesh.computeBoundingSphere();
    this.content.add(mesh);
    this.buildAxes(this.numericTicks(rx, (t) => this.mapX(t, rx)), this.numericTicks(ry, (t) => -this.mapX(t, ry)), rz);
  }

  protected hitTest(px: number, py: number): Hit | null {
    const { x, y, z, u, v, w } = this.opts;
    let best = -1;
    let bd = 100;
    const tmp = new THREE.Vector3();
    this.centers.forEach((c, i) => {
      tmp.copy(c);
      tmp.y *= this.content.scale.y;
      const [sx, sy, ok] = this.project(tmp);
      if (!ok) return;
      const d = (sx - px) ** 2 + (sy - py) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0) return null;
    const i = best;
    return { series: 'Vector', index: i, title: `${formatNumber(x[i])}, ${formatNumber(y[i])}, ${formatNumber(z[i])}`, values: { u: formatNumber(u[i]), v: formatNumber(v[i]), w: formatNumber(w[i]), Magnitude: formatNumber(Math.hypot(u[i], v[i], w[i])) } };
  }
}

// ---- Waterfall (stacked spectra) --------------------------------------------------------------------

export class Waterfall3DChart extends Chart3D<Waterfall3DOptions> {
  readonly type = 'waterfall3d' as const;
  private vr: Range = { lo: 0, hi: 1 };

  protected customLegend() {
    return rampLegend(this.theme.sequential.slice(3), 'First slice', 'Last slice');
  }

  protected buildContent() {
    const { data, rows, cols } = this.opts;
    const [lo, hi] = extent(data);
    this.vr = this.niceRange(lo, hi);
    const X = (c: number) => -HALF + (c / Math.max(1, cols - 1)) * 2 * HALF;
    const Z = (r: number) => -HALF + (r / Math.max(1, rows - 1)) * 2 * HALF;
    const ramp = this.theme.sequential.slice(3);
    const surface = new THREE.Color(this.theme.surface);
    for (let r = 0; r < rows; r++) {
      const z = Z(r);
      const pos: number[] = [];
      const fill: number[] = [];
      for (let c = 0; c < cols; c++) {
        const y = this.mapH(data[r * cols + c], this.vr);
        pos.push(X(c), y, z);
        fill.push(X(c), y, z, X(c), 0, z);
      }
      // A surface-colored curtain under each slice hides the slices behind it.
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(fill, 3));
      const idx: number[] = [];
      for (let c = 0; c < cols - 1; c++) idx.push(c * 2, c * 2 + 1, c * 2 + 2, c * 2 + 1, c * 2 + 3, c * 2 + 2);
      g.setIndex(idx);
      this.content.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: surface, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
      const lg = new LineGeometry();
      lg.setPositions(pos);
      const col = sampleRamp(ramp, rows > 1 ? r / (rows - 1) : 1);
      const lm = new LineMaterial({ color: col.getHex(), linewidth: 1.5 * this.dpr, worldUnits: false });
      lm.resolution.set(this.pixelWidth, this.pixelHeight);
      this.content.add(new Line2(lg, lm));
    }
    const xt = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ w: -HALF + t * 2 * HALF, label: String(Math.round(t * (cols - 1))) }));
    const zt = [0, 0.5, 1].map((t) => ({ w: -HALF + t * 2 * HALF, label: String(Math.round(t * (rows - 1))) }));
    this.buildAxes(xt, zt, this.vr);
  }

  protected hitTest(px: number, py: number): Hit | null {
    const { data, rows, cols } = this.opts;
    const tmp = new THREE.Vector3();
    let best = -1;
    let bd = 64;
    const step = Math.max(1, Math.floor((rows * cols) / 60000));
    for (let i = 0; i < rows * cols; i += step) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      tmp.set(-HALF + (c / Math.max(1, cols - 1)) * 2 * HALF, this.mapH(data[i], this.vr) * this.content.scale.y, -HALF + (r / Math.max(1, rows - 1)) * 2 * HALF);
      const [x, y, ok] = this.project(tmp);
      if (!ok) continue;
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best < 0) return null;
    return { series: 'Sample', index: best, title: `Slice ${Math.floor(best / cols)} · bin ${best % cols}`, values: { Value: formatNumber(data[best]) } };
  }
}
