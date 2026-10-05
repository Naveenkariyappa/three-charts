import * as THREE from 'three';
import type { Hit, LabelPool, LegendItem } from '../base';
import { Chart3D } from '../chart3d';
import { ForceSim, type ForceNode } from '../layouts';
import { MarkChart, shapePointMaterial, toColor, type MarkBuilder } from '../markchart';
import type { GraphLink, GraphNode, Network3DOptions, NetworkOptions } from '../types2';

interface Graph {
  nodes: (ForceNode & { src: GraphNode; deg: number })[];
  links: [number, number][];
  values: number[];
}

function buildGraph(nodes: GraphNode[], links: GraphLink[], dims: 2 | 3): { g: Graph; sim: ForceSim } {
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const g: Graph = {
    nodes: nodes.map((src) => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, src, deg: 0 })),
    links: [],
    values: [],
  };
  for (const l of links) {
    const a = idx.get(l.source);
    const b = idx.get(l.target);
    if (a === undefined || b === undefined || a === b) continue;
    g.links.push([a, b]);
    g.values.push(l.value ?? 1);
    g.nodes[a].deg++;
    g.nodes[b].deg++;
  }
  const sim = new ForceSim(g.nodes, g.links, dims);
  // Bigger graphs need more room per node.
  sim.linkDistance = nodes.length > 1000 ? 18 : 30;
  sim.charge = nodes.length > 1000 ? -18 : -40;
  return { g, sim };
}

function nodeSize(n: { src: GraphNode; deg: number }) {
  return n.src.size ?? 5 + Math.sqrt(n.deg) * 2;
}

// ---- 2D -------------------------------------------------------------------------------------

export class NetworkChart extends MarkChart<NetworkOptions> {
  readonly type = 'network' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected defaultZoom: 'x' | 'xy' | false = 'xy';
  private g: Graph | null = null;
  private sim: ForceSim | null = null;
  private points: THREE.Points | null = null;
  private edges: THREE.LineSegments | null = null;
  private scale = 1;
  private hover = -1;

  constructor(container: HTMLElement, options: NetworkOptions) {
    super(container, options);
    // Capture phase: grabbing a node must win over panning the view.
    this.stage.addEventListener('pointerdown', this.onNodeDown, { capture: true });
  }

  protected legendItems(): LegendItem[] {
    return (this.opts.groupNames ?? []).map((n, i) => ({ name: n, color: this.color(i) }));
  }

  protected build() {
    super.build();
    // Legend-hidden groups leave the graph entirely (and the layout re-settles).
    const names = this.opts.groupNames ?? [];
    const nodes = this.opts.nodes.filter((n) => !this.hidden.has(names[n.group ?? 0] ?? ''));
    const { g, sim } = buildGraph(nodes, this.opts.links, 2);
    this.g = g;
    this.sim = sim;
    // Settle big graphs a little before the first frame.
    if (g.nodes.length > 500) sim.tick(40);
  }

  protected marks(_b: MarkBuilder) {}

  protected rebuildMarks() {
    super.rebuildMarks();
    if (!this.g || !this.group) return;
    const n = this.g.nodes.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 4);
    const size = new Float32Array(n);
    const shape = new Float32Array(n);
    this.g.nodes.forEach((node, i) => {
      const c = toColor(this.color(node.src.group ?? 0));
      col.set([c.r, c.g, c.b, 1], i * 4);
      size[i] = nodeSize(node) * this.dpr;
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('aColor', new THREE.BufferAttribute(col, 4));
    pg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    pg.setAttribute('aShape', new THREE.BufferAttribute(shape, 1));
    this.points = new THREE.Points(pg, shapePointMaterial(this.theme.surface, this.dpr));
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;

    const L = this.g.links.length;
    const epos = new Float32Array(L * 6);
    const ecol = new Float32Array(L * 6);
    this.g.links.forEach(([a], i) => {
      const c = toColor(this.color(this.g!.nodes[a].src.group ?? 0));
      ecol.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    });
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(epos, 3));
    eg.setAttribute('color', new THREE.BufferAttribute(ecol, 3));
    const em = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: L > 3000 ? 0.18 : 0.4, depthTest: false });
    this.edges = new THREE.LineSegments(eg, em);
    this.edges.frustumCulled = false;
    this.group.add(this.edges, this.points);
    this.syncPositions();
  }

  /** Simulation space -> plot px. */
  private toWorld(n: ForceNode): [number, number] {
    return [this.plot.width / 2 + n.x * this.scale, this.plot.height / 2 + n.y * this.scale];
  }

  private syncPositions() {
    if (!this.g || !this.points || !this.edges) return;
    let R = 1;
    for (const n of this.g.nodes) R = Math.max(R, Math.abs(n.x), Math.abs(n.y));
    // Ease the fit so the graph doesn't jitter while it settles.
    const target = Math.min(this.plot.width, this.plot.height) / 2 / (R + 12);
    this.scale = this.scale === 1 ? target : this.scale + (target - this.scale) * 0.15;
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    this.g.nodes.forEach((n, i) => {
      const [x, y] = this.toWorld(n);
      pos.setXY(i, x, y);
    });
    pos.needsUpdate = true;
    const ep = this.edges.geometry.attributes.position as THREE.BufferAttribute;
    this.g.links.forEach(([a, b], i) => {
      const [x0, y0] = this.toWorld(this.g!.nodes[a]);
      const [x1, y1] = this.toWorld(this.g!.nodes[b]);
      ep.setXY(i * 2, x0, y0);
      ep.setXY(i * 2 + 1, x1, y1);
    });
    ep.needsUpdate = true;
    this.labels.begin();
    this.addLabels(this.labels);
    this.labels.end();
  }

  protected onTick(): boolean {
    if (!this.sim?.running) return false;
    this.sim.tick(this.g!.nodes.length > 2000 ? 1 : 2);
    this.syncPositions();
    return true;
  }

  protected addLabels(L: LabelPool) {
    if (!this.g) return;
    // Label the best-connected nodes, skipping any that would collide with one already placed.
    const top = [...this.g.nodes].sort((a, b) => b.deg - a.deg).slice(0, 12);
    const placed: [number, number][] = [];
    for (const n of top) {
      if (!n.src.name) continue;
      const [x, y] = this.toPx(...this.toWorld(n));
      if (placed.some(([px, py]) => Math.abs(px - x) < 70 && Math.abs(py - y) < 16)) continue;
      placed.push([x, y]);
      L.add(n.src.name, x, y - nodeSize(n) / 2 - 2, 0.5, 1, true, { size: 10 });
    }
  }

  private nearest(px: number, py: number): number {
    if (!this.g) return -1;
    let best = -1;
    let bd = Infinity;
    this.g.nodes.forEach((n, i) => {
      const [x, y] = this.toPx(...this.toWorld(n));
      const d = Math.hypot(x - px, y - py) - nodeSize(n) / 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return bd <= 4 ? best : -1;
  }

  protected hitTest(px: number, py: number): Hit | null {
    const i = this.nearest(px, py);
    this.hover = i;
    if (i < 0 || !this.g) return null;
    const n = this.g.nodes[i];
    const neighbors = this.g.links.filter(([a, b]) => a === i || b === i).length;
    return {
      series: n.src.name ?? n.src.id,
      index: i,
      color: this.color(n.src.group ?? 0),
      values: { Links: neighbors, ...(this.opts.groupNames ? { Group: this.opts.groupNames[n.src.group ?? 0] } : {}) },
    };
  }

  protected highlight(hit: Hit | null) {
    this.clearHighlight();
    if (!hit || this.hover < 0 || !this.g) return;
    const i = this.hover;
    for (const [a, b] of this.g.links) {
      if (a !== i && b !== i) continue;
      this.drawOutline({ k: 'path', pts: [...this.toWorld(this.g.nodes[a]), ...this.toWorld(this.g.nodes[b])], tol: 0 }, true);
    }
    const [x, y] = this.toWorld(this.g.nodes[i]);
    this.drawOutline({ k: 'circle', x, y, r: nodeSize(this.g.nodes[i]) / 2 + 2 }, true);
  }

  private onNodeDown = (e: PointerEvent) => {
    const r = this.stage.getBoundingClientRect();
    const i = this.nearest(e.clientX - r.left, e.clientY - r.top);
    if (i < 0 || !this.g || !this.sim) return;
    e.stopImmediatePropagation();
    this.dragging = true;
    this.stage.setPointerCapture(e.pointerId);
    const node = this.g.nodes[i];
    node.fixed = true;
    const move = (ev: PointerEvent) => {
      const [wx, wy] = this.toData(ev.clientX - r.left, ev.clientY - r.top);
      node.x = (wx - this.plot.width / 2) / this.scale;
      node.y = (wy - this.plot.height / 2) / this.scale;
      this.sim!.alpha = Math.max(this.sim!.alpha, 0.3);
      this.syncPositions();
      this.invalidate();
    };
    const up = () => {
      node.fixed = false;
      setTimeout(() => (this.dragging = false));
      this.stage.removeEventListener('pointermove', move);
      this.stage.removeEventListener('pointerup', up);
      this.stage.removeEventListener('pointercancel', up);
    };
    this.stage.addEventListener('pointermove', move);
    this.stage.addEventListener('pointerup', up);
    this.stage.addEventListener('pointercancel', up);
  };
}

// ---- 3D -------------------------------------------------------------------------------------

export class Network3DChart extends Chart3D<Network3DOptions> {
  readonly type = 'network3d' as const;
  private g: Graph | null = null;
  private sim: ForceSim | null = null;
  private points: THREE.Points | null = null;
  private edges: THREE.LineSegments | null = null;
  private k = 1;

  protected legendItems(): LegendItem[] {
    return (this.opts.groupNames ?? []).map((n, i) => ({ name: n, color: this.color(i) }));
  }

  protected buildContent() {
    const names = this.opts.groupNames ?? [];
    const nodes = this.opts.nodes.filter((n) => !this.hidden.has(names[n.group ?? 0] ?? ''));
    const { g, sim } = buildGraph(nodes, this.opts.links, 3);
    this.g = g;
    this.sim = sim;
    if (g.nodes.length > 500) sim.tick(40);
    const n = g.nodes.length;
    const col = new Float32Array(n * 4);
    const size = new Float32Array(n);
    g.nodes.forEach((node, i) => {
      const c = toColor(this.color(node.src.group ?? 0));
      col.set([c.r, c.g, c.b, 1], i * 4);
      size[i] = nodeSize(node) * this.dpr;
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    pg.setAttribute('aColor', new THREE.BufferAttribute(col, 4));
    pg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    pg.setAttribute('aShape', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.points = new THREE.Points(pg, shapePointMaterial(this.theme.surface, this.dpr, true));
    this.points.frustumCulled = false;
    const L = g.links.length;
    const ecol = new Float32Array(L * 6);
    g.links.forEach(([a], i) => {
      const c = toColor(this.color(g.nodes[a].src.group ?? 0));
      ecol.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    });
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(L * 6), 3));
    eg.setAttribute('color', new THREE.BufferAttribute(ecol, 3));
    this.edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35 }));
    this.edges.frustumCulled = false;
    this.content.add(this.edges, this.points);
    this.content.position.y = 2.4;
    this.k = 1;
    this.sync();
  }

  protected onProgress() {
    this.content.scale.setScalar(Math.max(0.0001, this.progress));
  }

  private sync() {
    if (!this.g || !this.points || !this.edges) return;
    let R = 1;
    for (const n of this.g.nodes) R = Math.max(R, Math.hypot(n.x, n.y, n.z));
    const target = 5 / R;
    this.k = this.k === 1 ? target : this.k + (target - this.k) * 0.15;
    const p = this.points.geometry.attributes.position as THREE.BufferAttribute;
    this.g.nodes.forEach((n, i) => p.setXYZ(i, n.x * this.k, n.y * this.k, n.z * this.k));
    p.needsUpdate = true;
    const e = this.edges.geometry.attributes.position as THREE.BufferAttribute;
    this.g.links.forEach(([a, b], i) => {
      const A = this.g!.nodes[a];
      const B = this.g!.nodes[b];
      e.setXYZ(i * 2, A.x * this.k, A.y * this.k, A.z * this.k);
      e.setXYZ(i * 2 + 1, B.x * this.k, B.y * this.k, B.z * this.k);
    });
    e.needsUpdate = true;
  }

  protected onTick(): boolean {
    let moving = super.onTick();
    if (this.sim?.running) {
      this.sim.tick(1);
      this.sync();
      moving = true;
    }
    return moving;
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.g) return null;
    const v = new THREE.Vector3();
    let best = -1;
    let bd = 100;
    this.g.nodes.forEach((n, i) => {
      v.set(n.x * this.k, n.y * this.k + 2.4, n.z * this.k);
      const [x, y, ok] = this.project(v);
      if (!ok) return;
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0) return null;
    const n = this.g.nodes[best];
    return { series: n.src.name ?? n.src.id, index: best, color: this.color(n.src.group ?? 0), values: { Links: n.deg, ...(this.opts.groupNames ? { Group: this.opts.groupNames[n.src.group ?? 0] } : {}) } };
  }
}
