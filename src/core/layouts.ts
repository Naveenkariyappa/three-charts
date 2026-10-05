/**
 * Layout algorithms for hierarchy, flow and network charts. Dependency-free
 * implementations of the standard approaches (squarified treemap, d3-style
 * front-chain circle packing, Sankey relaxation, Barnes–Hut forces).
 */

// ---- Hierarchy ------------------------------------------------------------------------

export interface TreeDatum {
  name: string;
  value?: number;
  color?: string;
  children?: TreeDatum[];
}

export interface HNode {
  data: TreeDatum;
  name: string;
  value: number;
  depth: number;
  height: number;
  parent: HNode | null;
  children: HNode[];
  /** Index of the top-level branch this node belongs to (for coloring). */
  branch: number;
  // Layout outputs
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x: number;
  y: number;
  r: number;
}

export function hierarchy(root: TreeDatum, sort = true): HNode {
  const make = (d: TreeDatum, depth: number, parent: HNode | null, branch: number): HNode => {
    const n: HNode = { data: d, name: d.name, value: 0, depth, height: 0, parent, children: [], branch, x0: 0, y0: 0, x1: 0, y1: 0, x: 0, y: 0, r: 0 };
    n.children = (d.children ?? []).map((c, i) => make(c, depth + 1, n, depth === 0 ? i : branch));
    if (n.children.length) {
      n.value = n.children.reduce((s, c) => s + c.value, 0);
      n.height = 1 + Math.max(...n.children.map((c) => c.height));
      if (sort) n.children.sort((a, b) => b.value - a.value);
    } else n.value = Math.max(0, d.value ?? 1);
    return n;
  };
  return make(root, 0, null, 0);
}

export function descendants(n: HNode, out: HNode[] = []): HNode[] {
  out.push(n);
  for (const c of n.children) descendants(c, out);
  return out;
}

export function leaves(n: HNode): HNode[] {
  return descendants(n).filter((d) => !d.children.length);
}

/** Squarified treemap (Bruls et al.), golden-ratio target aspect. */
export function treemap(root: HNode, w: number, h: number, paddingInner = 2, paddingTop = 18) {
  root.x0 = 0;
  root.y0 = 0;
  root.x1 = w;
  root.y1 = h;
  const recurse = (n: HNode) => {
    if (!n.children.length) return;
    const top = n.depth === 0 ? 0 : paddingTop;
    const pad = n.depth === 0 ? 0 : paddingInner;
    squarify(n.children, n.x0 + pad, n.y0 + top, n.x1 - pad, n.y1 - pad, paddingInner);
    for (const c of n.children) recurse(c);
  };
  recurse(root);
}

function squarify(nodes: HNode[], x0: number, y0: number, x1: number, y1: number, gap: number) {
  const total = nodes.reduce((s, n) => s + n.value, 0);
  if (total <= 0 || x1 <= x0 || y1 <= y0) {
    for (const n of nodes) Object.assign(n, { x0, y0, x1: x0, y1: y0 });
    return;
  }
  const ratio = (1 + Math.sqrt(5)) / 2;
  let i = 0;
  let value = total;
  while (i < nodes.length) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const area = (dx * dy) / value;
    const side = Math.min(dx, dy);
    let sum = 0;
    let minV = Infinity;
    let maxV = 0;
    let best = Infinity;
    let j = i;
    for (; j < nodes.length; j++) {
      const v = nodes[j].value * area;
      if (v <= 0 && j > i) break;
      const s2 = sum + v;
      const mn = Math.min(minV, v);
      const mx = Math.max(maxV, v);
      const a = (side * side) / (s2 * s2);
      const worst = Math.max(ratio * mx * a, 1 / (ratio * mn * a || 1e-9));
      if (j > i && worst > best) break;
      best = worst;
      sum = s2;
      minV = mn;
      maxV = mx;
    }
    // Lay row nodes[i..j) along the shorter side.
    const rowValue = nodes.slice(i, j).reduce((s, n) => s + n.value, 0);
    if (dx >= dy) {
      const w = (rowValue / value) * dx;
      let y = y0;
      for (let k = i; k < j; k++) {
        const hh = (nodes[k].value / (rowValue || 1)) * dy;
        setRect(nodes[k], x0, y, x0 + w, y + hh, gap);
        y += hh;
      }
      x0 += w;
    } else {
      const hh = (rowValue / value) * dy;
      let x = x0;
      for (let k = i; k < j; k++) {
        const ww = (nodes[k].value / (rowValue || 1)) * dx;
        setRect(nodes[k], x, y0, x + ww, y0 + hh, gap);
        x += ww;
      }
      y0 += hh;
    }
    value -= rowValue;
    i = j;
  }
}

function setRect(n: HNode, x0: number, y0: number, x1: number, y1: number, gap: number) {
  const g = gap / 2;
  n.x0 = x0 + g;
  n.y0 = y0 + g;
  n.x1 = Math.max(n.x0, x1 - g);
  n.y1 = Math.max(n.y0, y1 - g);
}

/** Adjacency partition: depth along one axis, value along the other (icicle / sunburst). */
export function partition(root: HNode, breadth: number, depthSize: number) {
  const levels = root.height + 1;
  const step = depthSize / levels;
  const recurse = (n: HNode, b0: number, b1: number) => {
    n.x0 = b0;
    n.x1 = b1;
    n.y0 = n.depth * step;
    n.y1 = (n.depth + 1) * step;
    let b = b0;
    for (const c of n.children) {
      const span = ((b1 - b0) * c.value) / (n.value || 1);
      recurse(c, b, b + span);
      b += span;
    }
  };
  recurse(root, 0, breadth);
}

// Circle packing (front-chain algorithm, as in d3-hierarchy's packSiblings).
interface PC {
  x: number;
  y: number;
  r: number;
}
interface Chain {
  c: PC;
  next: Chain;
  prev: Chain;
}

function place(b: PC, a: PC, c: PC) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  if (d2) {
    const a2 = (a.r + c.r) ** 2;
    const b2 = (b.r + c.r) ** 2;
    if (a2 > b2) {
      const x = (d2 + b2 - a2) / (2 * d2);
      const y = Math.sqrt(Math.max(0, b2 / d2 - x * x));
      c.x = b.x - x * dx - y * dy;
      c.y = b.y - x * dy + y * dx;
    } else {
      const x = (d2 + a2 - b2) / (2 * d2);
      const y = Math.sqrt(Math.max(0, a2 / d2 - x * x));
      c.x = a.x + x * dx - y * dy;
      c.y = a.y + x * dy + y * dx;
    }
  } else {
    c.x = a.x + c.r;
    c.y = a.y;
  }
}

function intersects(a: PC, b: PC) {
  const dr = a.r + b.r - 1e-6;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dr > 0 && dr * dr > dx * dx + dy * dy;
}

function score(n: Chain) {
  const a = n.c;
  const b = n.next.c;
  const ab = a.r + b.r;
  const dx = (a.x * b.r + b.x * a.r) / ab;
  const dy = (a.y * b.r + b.y * a.r) / ab;
  return dx * dx + dy * dy;
}

/** Pack circles around the origin; returns the enclosing radius. */
export function packSiblings(circles: PC[]): number {
  const n = circles.length;
  if (!n) return 0;
  let a = circles[0];
  a.x = 0;
  a.y = 0;
  if (n === 1) return a.r;
  let b = circles[1];
  a.x = -b.r;
  b.x = a.r;
  b.y = 0;
  if (n === 2) return a.r + b.r;
  const c0 = circles[2];
  place(b, a, c0);
  const A: Chain = { c: a } as Chain;
  const B: Chain = { c: b } as Chain;
  const C: Chain = { c: c0 } as Chain;
  A.next = C.prev = B;
  B.next = A.prev = C;
  C.next = B.prev = A;
  let na = A;
  let nb = B;
  for (let i = 3; i < n; i++) {
    const cc = circles[i];
    place(na.c, nb.c, cc);
    const node: Chain = { c: cc } as Chain;
    let j = nb.next;
    let k = na.prev;
    let sj = nb.c.r;
    let sk = na.c.r;
    let retry = false;
    do {
      if (sj <= sk) {
        if (intersects(j.c, cc)) {
          nb = j;
          na.next = nb;
          nb.prev = na;
          retry = true;
          break;
        }
        sj += j.c.r;
        j = j.next;
      } else {
        if (intersects(k.c, cc)) {
          na = k;
          na.next = nb;
          nb.prev = na;
          retry = true;
          break;
        }
        sk += k.c.r;
        k = k.prev;
      }
    } while (j !== k.next);
    if (retry) {
      i--;
      continue;
    }
    node.prev = na;
    node.next = nb;
    na.next = nb.prev = nb = node;
    let best = score(na);
    let cur: Chain = node;
    while ((cur = cur.next) !== nb) {
      const s = score(cur);
      if (s < best) {
        na = cur;
        best = s;
      }
    }
    nb = na.next;
  }
  // Enclosing circle: centered on the bounding box, radius covers every circle.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of circles) {
    x0 = Math.min(x0, c.x - c.r);
    x1 = Math.max(x1, c.x + c.r);
    y0 = Math.min(y0, c.y - c.r);
    y1 = Math.max(y1, c.y + c.r);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  let R = 0;
  for (const c of circles) {
    c.x -= cx;
    c.y -= cy;
    R = Math.max(R, Math.hypot(c.x, c.y) + c.r);
  }
  return R;
}

/** Nested circle packing into a circle of radius R centered at (cx, cy). */
export function pack(root: HNode, cx: number, cy: number, R: number, padding = 3) {
  const size = (n: HNode) => {
    if (!n.children.length) {
      n.r = Math.sqrt(n.value);
      return;
    }
    for (const c of n.children) size(c);
    const pad = padding;
    for (const c of n.children) c.r += pad;
    n.r = packSiblings(n.children);
    for (const c of n.children) c.r -= pad;
  };
  size(root);
  const k = R / (root.r || 1);
  // Children store offsets relative to their parent's center at this point.
  const offsets = new Map<HNode, [number, number]>();
  for (const n of descendants(root)) offsets.set(n, [n.x, n.y]);
  const apply = (n: HNode, x: number, y: number) => {
    n.x = x;
    n.y = y;
    n.r *= k;
    for (const c of n.children) {
      const [ox, oy] = offsets.get(c)!;
      apply(c, x + ox * k, y + oy * k);
    }
  };
  apply(root, cx, cy);
}

/**
 * Tree layout: leaves evenly spaced along the breadth axis, parents centered
 * over their children. `cluster` puts every leaf at the deepest level (dendrogram).
 */
export function tree(root: HNode, breadth: number, depthSize: number, cluster = false) {
  const ls = leaves(root);
  const step = breadth / Math.max(1, ls.length);
  ls.forEach((l, i) => (l.x = step * (i + 0.5)));
  const maxDepth = root.height;
  const setX = (n: HNode): number => {
    if (n.children.length) n.x = n.children.map(setX).reduce((s, v) => s + v, 0) / n.children.length;
    return n.x;
  };
  setX(root);
  for (const n of descendants(root)) {
    const d = cluster && !n.children.length ? maxDepth : n.depth;
    n.y = maxDepth ? (d / maxDepth) * depthSize : 0;
  }
}

// ---- Sankey -------------------------------------------------------------------------------

export interface SankeyNodeIn {
  id: string;
  name?: string;
  color?: string;
  /** Force a column (0-based). */
  column?: number;
}
export interface SankeyLinkIn {
  source: string;
  target: string;
  value: number;
  color?: string;
}
export interface SNode {
  id: string;
  name: string;
  index: number;
  column: number;
  value: number;
  inLinks: SLink[];
  outLinks: SLink[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  color?: string;
}
export interface SLink {
  source: SNode;
  target: SNode;
  value: number;
  width: number;
  y0: number;
  y1: number;
  color?: string;
}

export function sankey(nodesIn: SankeyNodeIn[], linksIn: SankeyLinkIn[], w: number, h: number, nodeWidth = 14, nodePad = 12, iterations = 8) {
  const byId = new Map<string, SNode>();
  const nodes: SNode[] = nodesIn.map((n, i) => {
    const s: SNode = { id: n.id, name: n.name ?? n.id, index: i, column: n.column ?? -1, value: 0, inLinks: [], outLinks: [], x0: 0, x1: 0, y0: 0, y1: 0, color: n.color };
    byId.set(n.id, s);
    return s;
  });
  const links: SLink[] = [];
  for (const l of linksIn) {
    const s = byId.get(l.source);
    const t = byId.get(l.target);
    if (!s || !t || !(l.value > 0)) continue;
    const link: SLink = { source: s, target: t, value: l.value, width: 0, y0: 0, y1: 0, color: l.color };
    s.outLinks.push(link);
    t.inLinks.push(link);
    links.push(link);
  }
  for (const n of nodes) {
    const a = n.inLinks.reduce((s, l) => s + l.value, 0);
    const b = n.outLinks.reduce((s, l) => s + l.value, 0);
    n.value = Math.max(a, b);
  }
  // Columns: longest path from a source (DAG assumed), unless fixed.
  const auto = nodes.filter((n) => n.column < 0);
  if (auto.length) {
    for (const n of auto) n.column = 0;
    let changed = true;
    let guard = 0;
    while (changed && guard++ < nodes.length + 1) {
      changed = false;
      for (const l of links) {
        if (l.target.column >= 0 && nodesIn[l.target.index].column === undefined && l.target.column < l.source.column + 1) {
          l.target.column = l.source.column + 1;
          changed = true;
        }
      }
    }
    // Justify: sinks go to the last column.
    const maxC = Math.max(...nodes.map((n) => n.column));
    for (const n of nodes) if (!n.outLinks.length && nodesIn[n.index].column === undefined) n.column = maxC;
  }
  const maxCol = Math.max(0, ...nodes.map((n) => n.column));
  const columns: SNode[][] = Array.from({ length: maxCol + 1 }, () => []);
  for (const n of nodes) columns[n.column].push(n);
  const xStep = maxCol ? (w - nodeWidth) / maxCol : 0;
  for (const n of nodes) {
    n.x0 = n.column * xStep;
    n.x1 = n.x0 + nodeWidth;
  }
  let ky = Infinity;
  for (const col of columns) {
    const total = col.reduce((s, n) => s + n.value, 0);
    if (total > 0) ky = Math.min(ky, (h - (col.length - 1) * nodePad) / total);
  }
  if (!isFinite(ky)) ky = 1;
  for (const col of columns) {
    let y = 0;
    for (const n of col) {
      n.y0 = y;
      n.y1 = y + n.value * ky;
      y = n.y1 + nodePad;
    }
  }
  for (const l of links) l.width = l.value * ky;

  const center = (n: SNode) => (n.y0 + n.y1) / 2;
  const resolve = (col: SNode[]) => {
    col.sort((a, b) => a.y0 - b.y0);
    let y = 0;
    for (const n of col) {
      const dy = y - n.y0;
      if (dy > 0) {
        n.y0 += dy;
        n.y1 += dy;
      }
      y = n.y1 + nodePad;
    }
    // Push back up if the column overflows.
    let over = y - nodePad - h;
    if (over > 0) {
      for (let i = col.length - 1; i >= 0; i--) {
        const n = col[i];
        n.y0 -= over;
        n.y1 -= over;
        over = i > 0 ? Math.max(0, col[i - 1].y1 + nodePad - n.y0) : 0;
      }
    }
  };
  for (let it = 0, alpha = 1; it < iterations; it++, alpha *= 0.99) {
    for (const col of columns.slice(1)) {
      for (const n of col) {
        if (!n.inLinks.length) continue;
        const wsum = n.inLinks.reduce((s, l) => s + l.value, 0);
        const c = n.inLinks.reduce((s, l) => s + center(l.source) * l.value, 0) / wsum;
        const dy = (c - center(n)) * alpha;
        n.y0 += dy;
        n.y1 += dy;
      }
      resolve(col);
    }
    for (const col of columns.slice(0, -1).reverse()) {
      for (const n of col) {
        if (!n.outLinks.length) continue;
        const wsum = n.outLinks.reduce((s, l) => s + l.value, 0);
        const c = n.outLinks.reduce((s, l) => s + center(l.target) * l.value, 0) / wsum;
        const dy = (c - center(n)) * alpha;
        n.y0 += dy;
        n.y1 += dy;
      }
      resolve(col);
    }
  }
  // Link attachment points, ordered by the other end's position to minimize crossings.
  for (const n of nodes) {
    n.outLinks.sort((a, b) => a.target.y0 - b.target.y0);
    n.inLinks.sort((a, b) => a.source.y0 - b.source.y0);
    let y = n.y0;
    for (const l of n.outLinks) {
      l.y0 = y + l.width / 2;
      y += l.width;
    }
    y = n.y0;
    for (const l of n.inLinks) {
      l.y1 = y + l.width / 2;
      y += l.width;
    }
  }
  return { nodes, links };
}

// ---- Chord --------------------------------------------------------------------------------

export interface ChordGroup {
  index: number;
  a0: number;
  a1: number;
  value: number;
}
export interface Chord {
  source: { index: number; a0: number; a1: number; value: number };
  target: { index: number; a0: number; a1: number; value: number };
}

/** Chord layout of a square flow matrix. Angles clockwise from 12 o'clock. */
export function chord(matrix: number[][], padAngle = 0.03) {
  const n = matrix.length;
  const rowSums = matrix.map((r) => r.reduce((s, v) => s + v, 0));
  const total = rowSums.reduce((s, v) => s + v, 0) || 1;
  const k = Math.max(0, Math.PI * 2 - padAngle * n) / total;
  const groups: ChordGroup[] = [];
  const sub: { a0: number; a1: number }[][] = [];
  let a = 0;
  for (let i = 0; i < n; i++) {
    const a0 = a;
    sub[i] = [];
    for (let j = 0; j < n; j++) {
      const v = matrix[i][j];
      sub[i][j] = { a0: a, a1: a + v * k };
      a += v * k;
    }
    groups.push({ index: i, a0, a1: a, value: rowSums[i] });
    a += padAngle;
  }
  const chords: Chord[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const v1 = matrix[i][j];
      const v2 = matrix[j][i];
      if (!v1 && !v2) continue;
      chords.push({
        source: { index: i, ...sub[i][j], value: v1 },
        target: { index: j, ...sub[j][i], value: v2 },
      });
    }
  }
  return { groups, chords };
}

// ---- Venn (2–3 sets) ----------------------------------------------------------------------

/** Overlap area of two circles at distance d. */
export function circleOverlap(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const a = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const b = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const c = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  return a + b - c;
}

/** Distance giving the requested overlap area (bisection). */
export function distanceForOverlap(r1: number, r2: number, overlap: number): number {
  let lo = Math.abs(r1 - r2);
  let hi = r1 + r2;
  if (overlap <= 0) return hi + 1e-6;
  if (overlap >= Math.PI * Math.min(r1, r2) ** 2) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (circleOverlap(r1, r2, mid) > overlap) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---- Force-directed (Barnes–Hut) ---------------------------------------------------------

export interface ForceNode {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Pinned while dragged. */
  fixed?: boolean;
}

interface Cell {
  cx: number;
  cy: number;
  cz: number;
  half: number;
  mass: number;
  mx: number;
  my: number;
  mz: number;
  node: ForceNode | null;
  kids: (Cell | null)[] | null;
}

/** Many-body + link + centering simulation in 2D or 3D. */
export class ForceSim {
  alpha = 1;
  alphaMin = 0.003;
  alphaDecay = 1 - Math.pow(0.003, 1 / 300);
  velocityDecay = 0.4;
  charge = -30;
  linkDistance = 30;
  linkStrength: number[] = [];
  theta2 = 0.81;

  constructor(
    readonly nodes: ForceNode[],
    readonly links: [number, number][],
    readonly dims: 2 | 3,
  ) {
    const deg = new Array(nodes.length).fill(0);
    for (const [a, b] of links) {
      deg[a]++;
      deg[b]++;
    }
    this.linkStrength = links.map(([a, b]) => 1 / Math.min(deg[a] || 1, deg[b] || 1));
    // Phyllotaxis start, like d3: deterministic and well spread.
    const ga = Math.PI * (3 - Math.sqrt(5));
    nodes.forEach((n, i) => {
      const r = 10 * Math.sqrt(0.5 + i);
      const a = i * ga;
      if (!n.x && !n.y) {
        n.x = r * Math.cos(a);
        n.y = r * Math.sin(a);
        n.z = dims === 3 ? r * Math.sin(a * 0.7) * 0.6 : 0;
      }
      n.vx = n.vy = n.vz = 0;
    });
  }

  get running() {
    return this.alpha > this.alphaMin;
  }

  tick(iterations = 1) {
    for (let it = 0; it < iterations; it++) {
      this.alpha += (0 - this.alpha) * this.alphaDecay;
      this.applyLinks();
      this.applyCharge();
      let sx = 0, sy = 0, sz = 0;
      for (const n of this.nodes) {
        if (n.fixed) {
          n.vx = n.vy = n.vz = 0;
          continue;
        }
        n.vx *= 1 - this.velocityDecay;
        n.vy *= 1 - this.velocityDecay;
        n.vz *= 1 - this.velocityDecay;
        n.x += n.vx;
        n.y += n.vy;
        n.z += n.vz;
        sx += n.x;
        sy += n.y;
        sz += n.z;
      }
      // Keep the cloud centered on the origin.
      const k = 1 / (this.nodes.length || 1);
      for (const n of this.nodes) {
        if (n.fixed) continue;
        n.x -= sx * k;
        n.y -= sy * k;
        if (this.dims === 3) n.z -= sz * k;
      }
    }
  }

  private applyLinks() {
    const { nodes, links } = this;
    for (let i = 0; i < links.length; i++) {
      const a = nodes[links[i][0]];
      const b = nodes[links[i][1]];
      let dx = b.x + b.vx - a.x - a.vx;
      let dy = b.y + b.vy - a.y - a.vy;
      let dz = this.dims === 3 ? b.z + b.vz - a.z - a.vz : 0;
      let l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      l = ((l - this.linkDistance) / l) * this.alpha * this.linkStrength[i];
      dx *= l;
      dy *= l;
      dz *= l;
      b.vx -= dx * 0.5;
      b.vy -= dy * 0.5;
      b.vz -= dz * 0.5;
      a.vx += dx * 0.5;
      a.vy += dy * 0.5;
      a.vz += dz * 0.5;
    }
  }

  private applyCharge() {
    const nodes = this.nodes;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const n of nodes) {
      x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x);
      y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y);
      z0 = Math.min(z0, n.z); z1 = Math.max(z1, n.z);
    }
    const half = Math.max(x1 - x0, y1 - y0, this.dims === 3 ? z1 - z0 : 0) / 2 + 1;
    const root = this.cell((x0 + x1) / 2, (y0 + y1) / 2, this.dims === 3 ? (z0 + z1) / 2 : 0, half);
    for (const n of nodes) this.insert(root, n, 0);
    this.accumulate(root);
    const strength = this.charge * this.alpha;
    for (const n of nodes) this.force(root, n, strength);
  }

  private cell(cx: number, cy: number, cz: number, half: number): Cell {
    return { cx, cy, cz, half, mass: 0, mx: 0, my: 0, mz: 0, node: null, kids: null };
  }

  private child(c: Cell, n: ForceNode): number {
    return (n.x >= c.cx ? 1 : 0) | (n.y >= c.cy ? 2 : 0) | (this.dims === 3 && n.z >= c.cz ? 4 : 0);
  }

  private insert(c: Cell, n: ForceNode, depth: number) {
    if (!c.kids && !c.node) {
      c.node = n;
      return;
    }
    if (depth > 40) return; // coincident points
    if (!c.kids) {
      c.kids = new Array(this.dims === 3 ? 8 : 4).fill(null);
      const old = c.node!;
      c.node = null;
      this.insertKid(c, old, depth);
    }
    this.insertKid(c, n, depth);
  }

  private insertKid(c: Cell, n: ForceNode, depth: number) {
    const i = this.child(c, n);
    let k = c.kids![i];
    if (!k) {
      const h = c.half / 2;
      k = c.kids![i] = this.cell(c.cx + (i & 1 ? h : -h), c.cy + (i & 2 ? h : -h), c.cz + (i & 4 ? h : -h), h);
    }
    this.insert(k, n, depth + 1);
  }

  private accumulate(c: Cell) {
    if (c.node) {
      c.mass = 1;
      c.mx = c.node.x;
      c.my = c.node.y;
      c.mz = c.node.z;
      return;
    }
    let m = 0, x = 0, y = 0, z = 0;
    for (const k of c.kids ?? []) {
      if (!k) continue;
      this.accumulate(k);
      m += k.mass;
      x += k.mx * k.mass;
      y += k.my * k.mass;
      z += k.mz * k.mass;
    }
    c.mass = m;
    c.mx = x / (m || 1);
    c.my = y / (m || 1);
    c.mz = z / (m || 1);
  }

  private force(c: Cell, n: ForceNode, strength: number) {
    if (!c.mass || c.node === n) return;
    const dx = c.mx - n.x;
    const dy = c.my - n.y;
    const dz = this.dims === 3 ? c.mz - n.z : 0;
    let l = dx * dx + dy * dy + dz * dz;
    const w = c.half * 2;
    if (c.node || (w * w) / this.theta2 < l) {
      if (l < 1) l = Math.sqrt(l) || 1;
      const k = (strength * c.mass) / l;
      n.vx += dx * k;
      n.vy += dy * k;
      n.vz += dz * k;
      return;
    }
    for (const k of c.kids ?? []) if (k) this.force(k, n, strength);
  }
}
