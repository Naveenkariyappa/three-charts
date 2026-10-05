import * as THREE from 'three';
import { Chart3D, HALF, type Range } from '../chart3d';
import type { Hit, LegendItem } from '../base';
import { createLine, createPoints, setLineResolution } from '../marks';
import { sampleRamp } from '../theme';
import { extent, formatNumber } from '../scale';
import type { Bar3DOptions, Line3DOptions, Scatter3DOptions, Surface3DOptions, XYZSeries } from '../types';

function thin(labels: string[], max: number) {
  const every = Math.max(1, Math.ceil(labels.length / max));
  return labels.map((l, i) => (i % every === 0 ? l : null));
}

// ---- 3D bars -------------------------------------------------------------------------

export class Bar3DChart extends Chart3D<Bar3DOptions> {
  readonly type = 'bar3d' as const;
  private mesh: THREE.InstancedMesh | null = null;
  private baseColors: THREE.Color[] = [];
  private hovered = -1;
  private zRange: Range = { lo: 0, hi: 1 };

  private byRow() {
    return (this.opts.colorBy ?? (this.opts.rows.length <= 8 ? 'row' : 'value')) === 'row';
  }

  protected legendItems(): LegendItem[] {
    return this.byRow() ? this.opts.rows.map((r, i) => ({ name: r, color: this.color(i) })) : [];
  }

  protected customLegend() {
    if (this.byRow()) return null;
    const el = document.createElement('div');
    el.className = 'tc-ramp';
    el.innerHTML = `<span>${formatNumber(this.zRange.lo)}</span><i style="background:linear-gradient(90deg,${this.theme.sequential.join(',')})"></i><span>${formatNumber(this.zRange.hi)}</span>`;
    return el;
  }

  protected buildContent() {
    const { rows, cols, data } = this.opts;
    const nr = rows.length;
    const nc = cols.length;
    const [, hi] = extent(data);
    this.zRange = this.niceRange(0, Math.max(hi, 1e-9));
    const cw = (2 * HALF) / nc;
    const cd = (2 * HALF) / nr;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
    const mesh = new THREE.InstancedMesh(geo, mat, nr * nc);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    this.baseColors = [];
    let k = 0;
    for (let r = 0; r < nr; r++) {
      for (let col = 0; col < nc; col++, k++) {
        const v = Math.max(0, data[r * nc + col] ?? 0);
        const hidden = this.hidden.has(rows[r]);
        const h = hidden ? 0.0001 : Math.max(0.0001, this.mapH(v, this.zRange));
        m.makeScale(cw * 0.7, h, cd * 0.7);
        m.setPosition(-HALF + cw * (col + 0.5), 0, -HALF + cd * (r + 0.5));
        mesh.setMatrixAt(k, m);
        if (this.byRow()) c.set(this.color(r));
        else sampleRamp(this.theme.sequential, (v - this.zRange.lo) / (this.zRange.hi - this.zRange.lo || 1), c);
        this.baseColors.push(c.clone());
        mesh.setColorAt(k, c);
        if (hidden) mesh.setMatrixAt(k, new THREE.Matrix4().makeScale(0, 0, 0));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.mesh = mesh;
    this.content.add(mesh);

    const xt = thin(cols, 6)
      .map((l, i) => (l === null ? null : { w: -HALF + cw * (i + 0.5), label: l }))
      .filter((t): t is { w: number; label: string } => !!t);
    const dt = thin(rows, 6)
      .map((l, i) => (l === null ? null : { w: -HALF + cd * (i + 0.5), label: l }))
      .filter((t): t is { w: number; label: string } => !!t);
    this.buildAxes(xt, dt, this.zRange);
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.mesh) return null;
    this.setRay(px, py);
    const hit = this.raycaster.intersectObject(this.mesh, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    const { rows, cols, data } = this.opts;
    const i = hit.instanceId;
    const r = Math.floor(i / cols.length);
    const c = i % cols.length;
    return {
      series: rows[r],
      index: i,
      title: `${rows[r]} · ${cols[c]}`,
      color: this.baseColors[i].getStyle(),
      values: { Value: formatNumber(data[i]) },
    };
  }

  protected highlight(hit: Hit | null) {
    if (!this.mesh) return;
    const prev = this.hovered;
    this.hovered = hit ? hit.index : -1;
    if (prev >= 0) this.mesh.setColorAt(prev, this.baseColors[prev]);
    if (this.hovered >= 0) {
      const c = this.baseColors[this.hovered].clone().lerp(new THREE.Color(this.theme.textPrimary), 0.25);
      this.mesh.setColorAt(this.hovered, c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.invalidate();
  }
}

// ---- Shared XYZ normalization ----------------------------------------------------------

abstract class XYZChart<O extends Scatter3DOptions | Line3DOptions> extends Chart3D<O> {
  protected rx: Range = { lo: 0, hi: 1 };
  protected ry: Range = { lo: 0, hi: 1 };
  protected rz: Range = { lo: 0, hi: 1 };
  /** World positions per visible series, kept for picking. */
  protected world: { s: XYZSeries; color: string; pos: Float32Array }[] = [];
  private m = new THREE.Matrix4();

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  /** Data x -> world x, data y -> world depth, data z -> world up. */
  protected prepare() {
    const vis = this.opts.series.map((s, i) => ({ s, color: this.color(i, s.color) })).filter((v) => !this.hidden.has(v.s.name));
    const ext = (key: 'x' | 'y' | 'z') => {
      let lo = Infinity;
      let hi = -Infinity;
      for (const { s } of vis) {
        const [a, b] = extent(s[key]);
        lo = Math.min(lo, a);
        hi = Math.max(hi, b);
      }
      return isFinite(lo) ? this.niceRange(lo, hi) : { lo: 0, hi: 1 };
    };
    this.rx = ext('x');
    this.ry = ext('y');
    this.rz = ext('z');
    this.world = vis.map(({ s, color }) => {
      const n = s.x.length;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = this.mapX(s.x[i], this.rx);
        pos[i * 3 + 1] = this.mapH(s.z[i], this.rz);
        pos[i * 3 + 2] = -this.mapX(s.y[i], this.ry);
      }
      return { s, color, pos };
    });
    this.buildAxes(
      this.numericTicks(this.rx, (v) => this.mapX(v, this.rx)),
      this.numericTicks(this.ry, (v) => -this.mapX(v, this.ry)),
      this.rz,
    );
  }

  /** Nearest projected vertex within 10px, scanning the typed arrays directly. */
  protected nearest(px: number, py: number): Hit | null {
    this.camera.updateMatrixWorld();
    const m = this.m.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    const e = m.elements;
    const sy = this.content.scale.y;
    const w2 = this.width / 2;
    const h2 = this.height / 2;
    let best = -1;
    let bestK = -1;
    let bestD = 100; // 10px squared
    let bestZ = Infinity;
    for (let k = 0; k < this.world.length; k++) {
      const p = this.world[k].pos;
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i];
        const y = p[i + 1] * sy;
        const z = p[i + 2];
        const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
        if (cw <= 0) continue;
        const sx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / cw) * w2 + w2;
        const sY = -((e[1] * x + e[5] * y + e[9] * z + e[13]) / cw) * h2 + h2;
        const d = (sx - px) * (sx - px) + (sY - py) * (sY - py);
        if (d < bestD || (d === bestD && cw < bestZ)) {
          bestD = d;
          bestZ = cw;
          best = i / 3;
          bestK = k;
        }
      }
    }
    if (best < 0) return null;
    const { s, color } = this.world[bestK];
    return {
      series: s.name,
      index: best,
      color,
      values: { x: formatNumber(s.x[best]), y: formatNumber(s.y[best]), z: formatNumber(s.z[best]) },
    };
  }

  protected hitTest(px: number, py: number): Hit | null {
    return this.nearest(px, py);
  }
}

export class Scatter3DChart extends XYZChart<Scatter3DOptions> {
  readonly type = 'scatter3d' as const;

  protected buildContent() {
    this.prepare();
    const total = this.world.reduce((n, w) => n + w.pos.length / 3, 0);
    const size = (this.opts.pointSize ?? (total > 100_000 ? 2.5 : total > 10_000 ? 4 : 7)) * this.dpr;
    for (const w of this.world) this.content.add(createPoints({ positions: w.pos, color: w.color, size, depth: true }));
  }
}

export class Line3DChart extends XYZChart<Line3DOptions> {
  readonly type = 'line3d' as const;

  protected buildContent() {
    this.prepare();
    const width = (this.opts.lineWidth ?? 2) * this.dpr;
    for (const w of this.world) {
      const line = createLine(w.pos, w.color, width);
      line.material.depthTest = true;
      this.content.add(line);
    }
    setLineResolution(this.content, this.pixelWidth, this.pixelHeight);
  }
}

// ---- Surface ------------------------------------------------------------------------

export class Surface3DChart extends Chart3D<Surface3DOptions> {
  readonly type = 'surface3d' as const;
  private mesh: THREE.Mesh | null = null;
  private zRange: Range = { lo: 0, hi: 1 };

  protected customLegend() {
    const el = document.createElement('div');
    el.className = 'tc-ramp';
    el.innerHTML = `<span>${formatNumber(this.zRange.lo)}</span><i style="background:linear-gradient(90deg,${this.theme.sequential.join(',')})"></i><span>${formatNumber(this.zRange.hi)}</span>`;
    return el;
  }

  protected buildContent() {
    const { rows, cols, data } = this.opts;
    const [lo, hi] = extent(data);
    this.zRange = this.niceRange(lo, hi);
    const g = new THREE.PlaneGeometry(2 * HALF, 2 * HALF, cols - 1, rows - 1);
    g.rotateX(-Math.PI / 2); // row 0 at the back
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const span = this.zRange.hi - this.zRange.lo || 1;
    for (let i = 0; i < pos.count; i++) {
      const v = data[i];
      pos.setY(i, this.mapH(v, this.zRange));
      sampleRamp(this.theme.sequential, (v - this.zRange.lo) / span, c);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    this.mesh = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0 }),
    );
    this.content.add(this.mesh);
    if (this.opts.wireframe) {
      const wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(g),
        new THREE.LineBasicMaterial({ color: this.theme.textPrimary, transparent: true, opacity: 0.12 }),
      );
      this.content.add(wire);
    }
    const ticks = (n: number) =>
      [0, 0.25, 0.5, 0.75, 1].map((t) => ({ w: -HALF + t * 2 * HALF, label: String(Math.round(t * (n - 1))) }));
    this.buildAxes(ticks(cols), ticks(rows), this.zRange);
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.mesh) return null;
    this.setRay(px, py);
    const hit = this.raycaster.intersectObject(this.mesh, false)[0];
    if (!hit) return null;
    const { rows, cols, data } = this.opts;
    const col = Math.round(((hit.point.x + HALF) / (2 * HALF)) * (cols - 1));
    const row = Math.round(((hit.point.z + HALF) / (2 * HALF)) * (rows - 1));
    const i = row * cols + col;
    return { series: 'Surface', index: i, title: `Row ${row} · Col ${col}`, values: { Value: formatNumber(data[i]) } };
  }
}

