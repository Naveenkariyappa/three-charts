import type { Topology } from './types2';

/** A decoded feature: polygons as rings of flat [lon, lat, ...] (first ring outer, rest holes). */
export interface GeoFeature {
  id: string;
  name: string;
  polygons: number[][][];
}

interface TopoGeometry {
  type: string;
  id?: string | number;
  properties?: { name?: string };
  arcs?: number[][] | number[][][];
  geometries?: TopoGeometry[];
}

/** Decode a TopoJSON object into features with antimeridian-safe rings. */
export function topoFeatures(topo: Topology, objectName?: string): GeoFeature[] {
  const name = objectName ?? Object.keys(topo.objects)[0];
  const obj = topo.objects[name] as TopoGeometry | undefined;
  if (!obj) return [];
  const t = topo.transform;
  // Decode every arc once (quantized + delta-encoded when there's a transform).
  const arcs = topo.arcs.map((a) => {
    const out: number[] = [];
    let x = 0;
    let y = 0;
    for (const p of a) {
      if (t) {
        x += p[0];
        y += p[1];
        out.push(x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]);
      } else out.push(p[0], p[1]);
    }
    return out;
  });
  const ring = (refs: number[]): number[] => {
    const out: number[] = [];
    refs.forEach((r, k) => {
      const a = r >= 0 ? arcs[r] : arcs[~r];
      const pts: number[] = [];
      if (r >= 0) pts.push(...a);
      else for (let i = a.length - 2; i >= 0; i -= 2) pts.push(a[i], a[i + 1]);
      // Consecutive arcs share an endpoint.
      out.push(...(k ? pts.slice(2) : pts));
    });
    return out;
  };
  const geoms = obj.type === 'GeometryCollection' ? (obj.geometries ?? []) : [obj];
  const features: GeoFeature[] = [];
  for (const g of geoms) {
    let polys: number[][][] = [];
    if (g.type === 'Polygon') polys = [(g.arcs as number[][]).map(ring)];
    else if (g.type === 'MultiPolygon') polys = (g.arcs as number[][][]).map((p) => p.map(ring));
    else continue;
    const clean: number[][][] = [];
    for (const p of polys) {
      // Only the outer ring decides the split; holes are clipped the same way.
      const pieces = splitRing(p[0]);
      for (const piece of pieces) clean.push([piece, ...p.slice(1).flatMap((h) => splitRing(h))]);
    }
    features.push({ id: String(g.id ?? ''), name: g.properties?.name ?? String(g.id ?? ''), polygons: clean });
  }
  return features;
}

/**
 * Make a ring safe to draw in flat projections: unwrap longitude jumps,
 * close rings that circle a pole, and clip into [-180, 180] (copying the
 * part that spills over the antimeridian to the other side).
 */
function splitRing(r: number[]): number[][] {
  const n = r.length / 2;
  if (n < 3) return [];
  let jumped = false;
  const u = r.slice();
  let off = 0;
  for (let i = 1; i < n; i++) {
    const d = r[i * 2] - r[i * 2 - 2];
    if (d > 180) {
      off -= 360;
      jumped = true;
    } else if (d < -180) {
      off += 360;
      jumped = true;
    }
    u[i * 2] = r[i * 2] + off;
  }
  if (!jumped) return [r];
  const span = u[(n - 1) * 2] - u[0];
  if (Math.abs(span) > 180) {
    // Circles a pole (e.g. Antarctica): close the ring along the pole.
    let lat = 0;
    for (let i = 0; i < n; i++) lat += u[i * 2 + 1];
    const pole = lat < 0 ? -90 : 90;
    u.push(u[(n - 1) * 2], pole, u[0], pole);
  }
  const out: number[][] = [];
  for (const shift of [0, -360, 360]) {
    const s = u.map((v, i) => (i % 2 ? v : v + shift));
    const c = clip(clip(s, -180, 1), 180, -1);
    if (c.length >= 6) out.push(c);
  }
  return out;
}

/** Keep the part of a polygon where sign * (x - x0) >= 0. */
function clip(pts: number[], x0: number, sign: number): number[] {
  const out: number[] = [];
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1];
    const j = (i + 1) % n;
    const bx = pts[j * 2], by = pts[j * 2 + 1];
    const ain = sign * (ax - x0) >= 0;
    const bin = sign * (bx - x0) >= 0;
    if (ain) out.push(ax, ay);
    if (ain !== bin) {
      const t = (x0 - ax) / (bx - ax);
      out.push(x0, ay + t * (by - ay));
    }
  }
  return out;
}

// ---- Projections (lon/lat degrees -> unit plane, y up) ----------------------------------

const RAD = Math.PI / 180;

export type ProjectionName = 'naturalEarth' | 'equirectangular' | 'mercator';

export function project(name: ProjectionName, lon: number, lat: number): [number, number] {
  const l = lon * RAD;
  const p = lat * RAD;
  if (name === 'equirectangular') return [l, p];
  if (name === 'mercator') {
    const c = Math.max(-85, Math.min(85, lat)) * RAD;
    return [l, Math.log(Math.tan(Math.PI / 4 + c / 2))];
  }
  // Natural Earth I (Šavrič et al.), polynomial form as in d3-geo.
  const p2 = p * p;
  const p4 = p2 * p2;
  return [
    l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
    p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))),
  ];
}

/** Fit a projection into w x h px (y down). */
export function fitProjection(name: ProjectionName, features: GeoFeature[], w: number, h: number, pad = 6) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of features) for (const poly of f.polygons) {
    const r = poly[0];
    for (let i = 0; i < r.length; i += 2) {
      const [x, y] = project(name, r[i], r[i + 1]);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (!isFinite(x0)) [x0, y0, x1, y1] = [-Math.PI, -1.5, Math.PI, 1.5];
  const k = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0));
  const ox = (w - (x1 - x0) * k) / 2;
  const oy = (h - (y1 - y0) * k) / 2;
  return (lon: number, lat: number): [number, number] => {
    const [x, y] = project(name, lon, lat);
    return [ox + (x - x0) * k, oy + (y1 - y) * k];
  };
}

/** Point in a feature (lon/lat), holes respected. */
export function featureContains(f: GeoFeature, lon: number, lat: number): boolean {
  for (const poly of f.polygons) {
    if (!inRing(poly[0], lon, lat)) continue;
    if (!poly.slice(1).some((h) => inRing(h, lon, lat))) return true;
  }
  return false;
}

function inRing(pts: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
