import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { Hit, LegendItem } from '../base';
import { Chart3D, HALF } from '../chart3d';
import { featureContains, fitProjection, topoFeatures, type GeoFeature } from '../geo';
import { MarkChart, inkOn, pointInPoly, type MarkBuilder } from '../markchart';
import { extent, formatNumber } from '../scale';
import { rng } from '../stats';
import { sampleRamp } from '../theme';
import type {
  BubbleMapOptions,
  CartogramOptions,
  ChoroplethOptions,
  DensityMapOptions,
  DotDensityOptions,
  FlowMapOptions,
  GeoBase,
  GlobeOptions,
  HexbinMapOptions,
  Map3DOptions,
  SpikeMapOptions,
  TileMapOptions,
  Topology,
} from '../types2';

const cache = new WeakMap<Topology, Map<string, GeoFeature[]>>();

function features(topo: Topology, object?: string, exclude: string[] = []): GeoFeature[] {
  let m = cache.get(topo);
  if (!m) cache.set(topo, (m = new Map()));
  const key = object ?? '';
  let f = m.get(key);
  if (!f) m.set(key, (f = topoFeatures(topo, object)));
  return exclude.length ? f.filter((x) => !exclude.includes(x.name)) : f;
}

function rampLegend(stops: string[], lo: string, hi: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'tc-ramp';
  el.innerHTML = `<span>${lo}</span><i style="background:linear-gradient(90deg,${stops.join(',')})"></i><span>${hi}</span>`;
  return el;
}

/** Flat maps: projection fitted to the plot, zoom and pan by wheel/drag. */
abstract class MapChart<O extends GeoBase> extends MarkChart<O> {
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected defaultZoom: 'x' | 'xy' | false = 'xy';
  protected P: (lon: number, lat: number) => [number, number] = () => [0, 0];
  protected feats: GeoFeature[] = [];

  protected setupProjection() {
    this.feats = features(this.opts.topology, this.opts.object, this.opts.exclude);
    this.P = fitProjection(this.opts.projection ?? 'naturalEarth', this.feats, this.plot.width, this.plot.height);
  }

  /** Draw every feature; `fill(f)` returns its color or null for the neutral land color. */
  protected basemap(b: MarkBuilder, fill: (f: GeoFeature) => string | null, hit?: (f: GeoFeature, i: number) => Hit, borders = true) {
    this.feats.forEach((f, i) => {
      const color = fill(f) ?? this.theme.grid;
      for (const poly of f.polygons) {
        const proj = poly.map((r) => {
          const out: number[] = [];
          for (let k = 0; k < r.length; k += 2) out.push(...this.P(r[k], r[k + 1]));
          return out;
        });
        b.poly(proj[0], color, 1, proj.slice(1));
        // Lines draw after fills, so overlays that are fills (hexbins) go without borders.
        if (borders) b.line(proj[0], this.theme.surface, 0.75, 1, true);
        if (hit) b.region({ k: 'poly', pts: proj[0], hit: hit(f, i) });
      }
    });
  }
}

// ---- Choropleth ---------------------------------------------------------------------------

export class ChoroplethChart extends MapChart<ChoroplethOptions> {
  readonly type = 'choropleth' as const;
  private lo = 0;
  private hi = 1;

  private stops() {
    return this.opts.scale === 'diverging' ? this.theme.diverging : this.theme.sequential;
  }

  private valueOf(f: GeoFeature): number | undefined {
    return this.opts.values[f.name] ?? this.opts.values[f.id];
  }

  protected customLegend() {
    return rampLegend(this.stops(), formatNumber(this.lo), formatNumber(this.hi));
  }

  protected computeDomain() {
    super.computeDomain();
    const vals = Object.values(this.opts.values).filter((v) => v === v);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (this.opts.scale === 'diverging') {
      const c = this.opts.center ?? 0;
      const m = Math.max(Math.abs(lo - c), Math.abs(hi - c));
      lo = c - m;
      hi = c + m;
    }
    this.lo = isFinite(lo) ? lo : 0;
    this.hi = isFinite(hi) && hi > lo ? hi : this.lo + 1;
  }

  protected marks(b: MarkBuilder) {
    this.setupProjection();
    const stops = this.stops();
    this.basemap(
      b,
      (f) => {
        const v = this.valueOf(f);
        return v === undefined ? null : '#' + sampleRamp(stops, (v - this.lo) / (this.hi - this.lo)).getHexString();
      },
      (f, i) => {
        const v = this.valueOf(f);
        return { series: f.name, index: i, values: { Value: v === undefined ? 'No data' : formatNumber(v) } };
      },
    );
  }
}

// ---- Bubble map -------------------------------------------------------------------------------

export class BubbleMapChart extends MapChart<BubbleMapOptions> {
  readonly type = 'bubbleMap' as const;

  protected marks(b: MarkBuilder) {
    this.setupProjection();
    this.basemap(b, () => null);
    const pts = [...this.opts.points].sort((a, c) => c.value - a.value);
    const max = Math.max(...pts.map((p) => p.value), 1e-9);
    const maxSize = this.opts.maxSize ?? 40;
    const color = this.color(0);
    pts.forEach((p, i) => {
      const [x, y] = this.P(p.lon, p.lat);
      const d = Math.max(4, Math.sqrt(p.value / max) * maxSize);
      b.point(x, y, color, d, 'circle', 0.7);
      b.region({ k: 'circle', x, y, r: d / 2, hit: { series: p.label ?? `${p.lat.toFixed(1)}, ${p.lon.toFixed(1)}`, index: i, color, values: { Value: formatNumber(p.value) } } });
    });
  }
}

// ---- Flow map ----------------------------------------------------------------------------------

export class FlowMapChart extends MapChart<FlowMapOptions> {
  readonly type = 'flowMap' as const;

  protected marks(b: MarkBuilder) {
    this.setupProjection();
    this.basemap(b, () => null);
    const flows = [...this.opts.flows].sort((a, c) => a.value - c.value);
    const max = Math.max(...flows.map((f) => f.value), 1e-9);
    const color = this.color(0);
    const ends = new Map<string, [number, number]>();
    flows.forEach((f, i) => {
      const [x0, y0] = this.P(f.from[0], f.from[1]);
      const [x1, y1] = this.P(f.to[0], f.to[1]);
      // Curve to the left of travel so A->B and B->A don't overlap.
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const cx = mx + dy * 0.25;
      const cy = my - dx * 0.25;
      const pts: number[] = [];
      for (let k = 0; k <= 24; k++) {
        const t = k / 24;
        const u = 1 - t;
        pts.push(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1);
      }
      const w = 1 + (f.value / max) * 6;
      b.softLine(pts, color, w, 0.7);
      ends.set(`${f.to[0]},${f.to[1]}`, [x1, y1]);
      ends.set(`${f.from[0]},${f.from[1]}`, [x0, y0]);
      b.region({ k: 'path', pts, tol: Math.max(4, w), hit: { series: f.label ?? 'Flow', index: i, color, values: { Value: formatNumber(f.value) } } });
    });
    for (const [x, y] of ends.values()) b.point(x, y, this.theme.textPrimary, 6);
  }
}

// ---- Hexbin map ----------------------------------------------------------------------------------

export class HexbinMapChart extends MapChart<HexbinMapOptions> {
  readonly type = 'hexbinMap' as const;
  private max = 1;

  protected customLegend() {
    return rampLegend(this.theme.sequential.slice(2), '1', formatNumber(this.max));
  }

  protected marks(b: MarkBuilder) {
    this.setupProjection();
    this.basemap(b, () => null, undefined, false);
    const { lon, lat } = this.opts;
    const r = this.opts.radius ?? 8;
    const dx = Math.sqrt(3) * r;
    const dy = 1.5 * r;
    const bins = new Map<string, { i: number; j: number; n: number }>();
    for (let k = 0; k < lon.length; k++) {
      const [x, y] = this.P(lon[k], lat[k]);
      let j = Math.round(y / dy);
      let i = Math.round(x / dx - (j & 1) / 2);
      const ey = y / dy - j;
      if (Math.abs(ey) * 3 > 1) {
        const j2 = j + (ey < 0 ? -1 : 1);
        const i2 = Math.round(x / dx - (j2 & 1) / 2);
        const d1 = (x - (i + (j & 1) / 2) * dx) ** 2 + (y - j * dy) ** 2;
        const d2 = (x - (i2 + (j2 & 1) / 2) * dx) ** 2 + (y - j2 * dy) ** 2;
        if (d2 < d1) {
          i = i2;
          j = j2;
        }
      }
      const key = `${i},${j}`;
      const bin = bins.get(key);
      if (bin) bin.n++;
      else bins.set(key, { i, j, n: 1 });
    }
    this.max = Math.max(1, ...[...bins.values()].map((v) => v.n));
    const ramp = this.theme.sequential.slice(2);
    for (const { i, j, n } of bins.values()) {
      const cx = (i + (j & 1) / 2) * dx;
      const cy = j * dy;
      const pts: number[] = [];
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        pts.push(cx + Math.cos(a) * (r - 0.6), cy + Math.sin(a) * (r - 0.6));
      }
      const color = '#' + sampleRamp(ramp, Math.sqrt(n / this.max)).getHexString();
      b.poly(pts, color, 0.9);
      b.region({ k: 'poly', pts, hit: { series: 'Area', index: 0, values: { Points: formatNumber(n) } } });
    }
  }
}

// ---- Cartogram (Dorling) -----------------------------------------------------------------------

/** Shoelace area (signed) and centroid of a flat x,y ring. */
function ringCentroid(r: number[]): { area: number; x: number; y: number } {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const f = r[j] * r[i + 1] - r[i] * r[j + 1];
    a += f;
    cx += (r[j] + r[i]) * f;
    cy += (r[j + 1] + r[i + 1]) * f;
  }
  a /= 2;
  return a ? { area: a, x: cx / (6 * a), y: cy / (6 * a) } : { area: 0, x: r[0], y: r[1] };
}

/**
 * Each region becomes a circle sized by its value, starting at its centroid
 * and pushed apart until circles stop overlapping (a Dorling cartogram).
 */
export class CartogramChart extends MapChart<CartogramOptions> {
  readonly type = 'cartogram' as const;

  protected marks(b: MarkBuilder) {
    this.setupProjection();
    if (this.opts.basemap ?? true) this.basemap(b, () => null, undefined, false);
    const W = this.plot.width;
    const H = this.plot.height;
    const items: { name: string; v: number; x: number; y: number; ox: number; oy: number; r: number }[] = [];
    for (const f of this.feats) {
      const v = this.opts.values[f.name] ?? this.opts.values[f.id];
      if (!(v > 0)) continue;
      // Start from the centroid of the largest polygon (mainland, not islands).
      let best = { area: 0, x: 0, y: 0 };
      for (const poly of f.polygons) {
        const ring: number[] = [];
        for (let k = 0; k < poly[0].length; k += 2) ring.push(...this.P(poly[0][k], poly[0][k + 1]));
        const c = ringCentroid(ring);
        if (Math.abs(c.area) > Math.abs(best.area)) best = c;
      }
      items.push({ name: f.name, v, x: best.x, y: best.y, ox: best.x, oy: best.y, r: 0 });
    }
    const sum = items.reduce((s, it) => s + it.v, 0) || 1;
    // Circles cover about a fifth of the map.
    const k = Math.sqrt((0.2 * W * H) / (Math.PI * sum));
    for (const it of items) it.r = Math.sqrt(it.v) * k;
    for (let iter = 0; iter < 160; iter++) {
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        for (let j = i + 1; j < items.length; j++) {
          const c = items[j];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const d = Math.hypot(dx, dy) || 1e-6;
          const overlap = a.r + c.r + 1 - d;
          if (overlap <= 0) continue;
          // Push apart, the smaller circle moving more.
          const wa = c.r / (a.r + c.r);
          a.x -= (dx / d) * overlap * wa;
          a.y -= (dy / d) * overlap * wa;
          c.x += (dx / d) * overlap * (1 - wa);
          c.y += (dy / d) * overlap * (1 - wa);
        }
        // Gentle pull home keeps the geography recognizable.
        a.x += (a.ox - a.x) * 0.02;
        a.y += (a.oy - a.y) * 0.02;
      }
    }
    const color = this.color(0);
    const label = this.opts.label ?? 'Value';
    items.sort((a, c) => c.r - a.r);
    items.forEach((it, i) => {
      b.sector(it.x, it.y, 0, it.r, 0, Math.PI * 2, color, 0.85);
      b.arc(it.x, it.y, it.r, 0, Math.PI * 2, this.theme.surface, 1);
      if (it.r >= 14) b.text(it.name, it.x, it.y, 0.5, 0.5, false, { maxWidth: it.r * 1.8, color: inkOn(color), size: Math.min(13, Math.max(9, it.r / 3)) });
      const ring: number[] = [];
      for (let a = 0; a < 24; a++) ring.push(it.x + Math.cos((a / 24) * Math.PI * 2) * it.r, it.y + Math.sin((a / 24) * Math.PI * 2) * it.r);
      b.region({ k: 'poly', pts: ring, hit: { series: it.name, index: i, color, values: { [label]: it.v }, rows: [{ label, value: formatNumber(it.v), color }, { label: 'Share', value: `${((it.v / sum) * 100).toFixed(1)}%` }] } });
    });
  }
}

// ---- Dot density ----------------------------------------------------------------------------------

/** 1, 2 or 5 times a power of ten: readable "1 dot = N" values. */
function niceUnit(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1e-12))));
  const m = v / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** One dot per N units, scattered inside each region; categories get their own colors. */
export class DotDensityChart extends MapChart<DotDensityOptions> {
  readonly type = 'dotDensity' as const;

  private categories() {
    const out: string[] = [];
    for (const v of Object.values(this.opts.values)) {
      if (typeof v === 'number') {
        if (!out.includes('Total')) out.push('Total');
      } else for (const k of Object.keys(v)) if (!out.includes(k)) out.push(k);
    }
    return out;
  }

  protected legendItems(): LegendItem[] {
    const cats = this.categories();
    return cats.length > 1 ? cats.map((c, i) => ({ name: c, color: this.color(i) })) : [];
  }

  private parts(f: GeoFeature): Record<string, number> | null {
    const v = this.opts.values[f.name] ?? this.opts.values[f.id];
    if (v === undefined) return null;
    return typeof v === 'number' ? { Total: v } : v;
  }

  protected marks(b: MarkBuilder) {
    this.setupProjection();
    const cats = this.categories();
    let total = 0;
    for (const v of Object.values(this.opts.values)) total += typeof v === 'number' ? v : Object.values(v).reduce((s, x) => s + x, 0);
    const unit = this.opts.dotValue ?? niceUnit(total / 15000);
    this.basemap(
      b,
      () => null,
      (f, i) => {
        const parts = this.parts(f);
        const rows = parts ? Object.entries(parts).map(([k, v]) => ({ label: k, value: formatNumber(v), color: cats.length > 1 ? this.color(cats.indexOf(k)) : undefined })) : [{ label: 'Value', value: 'No data' }];
        return { series: f.name, index: i, values: parts ?? {}, rows };
      },
    );
    const random = rng(7);
    const size = this.opts.dotSize ?? 2;
    const dots: [number, number, string][] = [];
    for (const f of this.feats) {
      const parts = this.parts(f);
      if (!parts) continue;
      const polys = f.polygons.map((poly) => {
        const ring: number[] = [];
        for (let k = 0; k < poly[0].length; k += 2) ring.push(...this.P(poly[0][k], poly[0][k + 1]));
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let k = 0; k < ring.length; k += 2) {
          x0 = Math.min(x0, ring[k]);
          x1 = Math.max(x1, ring[k]);
          y0 = Math.min(y0, ring[k + 1]);
          y1 = Math.max(y1, ring[k + 1]);
        }
        return { ring, x0, y0, x1, y1, area: Math.abs(ringCentroid(ring).area) };
      });
      const areaSum = polys.reduce((s, p) => s + p.area, 0);
      if (!areaSum) continue;
      for (const [cat, v] of Object.entries(parts)) {
        if (this.hidden.has(cat)) continue;
        const color = this.color(Math.max(0, cats.indexOf(cat)));
        // Fractional dots are kept with matching probability, so small places still show up.
        const exact = v / unit;
        const n = Math.floor(exact) + (random() < exact % 1 ? 1 : 0);
        for (let d = 0; d < n; d++) {
          let pick = random() * areaSum;
          let p = polys[0];
          for (const q of polys) {
            p = q;
            if ((pick -= q.area) <= 0) break;
          }
          for (let tries = 0; tries < 30; tries++) {
            const x = p.x0 + random() * (p.x1 - p.x0);
            const y = p.y0 + random() * (p.y1 - p.y0);
            if (pointInPoly(p.ring, x, y)) {
              dots.push([x, y, color]);
              break;
            }
          }
        }
      }
    }
    // Shuffle so no category is drawn wholly on top of another.
    for (let i = dots.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [dots[i], dots[j]] = [dots[j], dots[i]];
    }
    for (const [x, y, color] of dots) b.point(x, y, color, size, 'disc', 0.85);
    b.text(`1 dot = ${formatNumber(unit)}`, 4, this.plot.height - 4, 0, 1);
  }
}

// ---- Tile map ------------------------------------------------------------------------------------------

/** Every region as one equal tile on a grid (square or hex), so small regions get equal weight. */
export class TileMapChart extends MarkChart<TileMapOptions> {
  readonly type = 'tileMap' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 4;
  private lo = 0;
  private hi = 1;

  private stops() {
    return this.opts.scale === 'diverging' ? this.theme.diverging : this.theme.sequential;
  }

  protected customLegend() {
    return rampLegend(this.stops(), formatNumber(this.lo), formatNumber(this.hi));
  }

  protected marks(b: MarkBuilder) {
    const tiles = this.opts.tiles;
    if (!tiles.length) return;
    let [lo, hi] = extent(tiles.map((t) => t.value));
    if (this.opts.scale === 'diverging') {
      const c = this.opts.center ?? 0;
      const m = Math.max(Math.abs(lo - c), Math.abs(hi - c));
      [lo, hi] = [c - m, c + m];
    }
    this.lo = lo;
    this.hi = hi > lo ? hi : lo + 1;
    const cols = Math.max(...tiles.map((t) => t.col)) + 1;
    const rows = Math.max(...tiles.map((t) => t.row)) + 1;
    const W = this.plot.width;
    const H = this.plot.height;
    const hex = this.opts.shape === 'hex';
    // Fit the grid to the box; hex rows overlap by a quarter and odd rows shift half a tile.
    const size = hex ? Math.min(W / (cols + 0.5) / Math.sqrt(3), H / ((rows - 1) * 1.5 + 2)) : Math.min(W / cols, H / rows);
    const gw = hex ? (cols + 0.5) * Math.sqrt(3) * size : cols * size;
    const gh = hex ? ((rows - 1) * 1.5 + 2) * size : rows * size;
    const ox = (W - gw) / 2;
    const oy = (H - gh) / 2;
    tiles.forEach((t, i) => {
      const color = '#' + sampleRamp(this.stops(), (t.value - this.lo) / (this.hi - this.lo)).getHexString();
      let pts: number[];
      let cx: number;
      let cy: number;
      if (hex) {
        const r = size - 1;
        cx = ox + Math.sqrt(3) * size * (t.col + 0.5 + (t.row & 1 ? 0.5 : 0));
        cy = oy + size + t.row * 1.5 * size;
        pts = [];
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
      } else {
        const x0 = ox + t.col * size + 1;
        const y0 = oy + t.row * size + 1;
        cx = x0 + size / 2 - 1;
        cy = y0 + size / 2 - 1;
        pts = [x0, y0, x0 + size - 2, y0, x0 + size - 2, y0 + size - 2, x0, y0 + size - 2];
      }
      b.poly(pts, color, 1);
      if (size >= 18) b.text(t.id, cx, cy, 0.5, 0.5, false, { color: inkOn(color), size: Math.min(13, Math.max(9, size / 3)), maxWidth: size * 1.4 });
      b.region({ k: 'poly', pts, hit: { series: t.label ?? t.id, index: i, color, values: { Value: t.value }, rows: [{ label: 'Value', value: formatNumber(t.value), color }] } });
    });
  }
}

// ---- Spike map ---------------------------------------------------------------------------------------

/** Values at locations as vertical spikes: height reads more precisely than bubble area. */
export class SpikeMapChart extends MapChart<SpikeMapOptions> {
  readonly type = 'spikeMap' as const;

  protected marks(b: MarkBuilder) {
    this.setupProjection();
    this.basemap(b, () => null);
    const max = Math.max(...this.opts.points.map((p) => p.value), 1e-9);
    const H = this.opts.maxHeight ?? 80;
    const color = this.color(0);
    // Back (north) first, so nearer spikes overlap farther ones.
    const pts = this.opts.points.map((p, i) => ({ p, i, xy: this.P(p.lon, p.lat) })).sort((a, c) => a.xy[1] - c.xy[1]);
    for (const { p, i, xy } of pts) {
      const [x, y] = xy;
      const h = (p.value / max) * H;
      const w = 3.5;
      const tri = [x - w, y, x, y - h, x + w, y];
      b.poly(tri, color, 0.3);
      b.line(tri, color, 1.2);
      b.region({ k: 'poly', pts: [x - w - 2, y + 2, x - 2, y - h - 2, x + 2, y - h - 2, x + w + 2, y + 2], hit: { series: p.label ?? `${p.lat.toFixed(1)}, ${p.lon.toFixed(1)}`, index: i, color, values: { Value: p.value }, rows: [{ label: 'Value', value: formatNumber(p.value), color }] } });
    }
  }
}

// ---- Density map ----------------------------------------------------------------------------------

/** A smooth heat layer of point density (optionally weighted) over a map. */
export class DensityMapChart extends MapChart<DensityMapOptions> {
  readonly type = 'densityMap' as const;
  private grid: { cols: number; rows: number; cell: number; v: Float32Array; max: number } | null = null;

  protected customLegend() {
    return rampLegend(this.theme.sequential.slice(2), 'Low', 'High');
  }

  protected marks(b: MarkBuilder) {
    this.setupProjection();
    this.basemap(b, () => null, (f, i) => ({ series: f.name, index: i, values: {} }));
    const W = this.plot.width;
    const H = this.plot.height;
    const cell = 3;
    const cols = Math.ceil(W / cell);
    const rows = Math.ceil(H / cell);
    let v = new Float32Array(cols * rows);
    const { lon, lat, weight } = this.opts;
    for (let i = 0; i < lon.length; i++) {
      const [x, y] = this.P(lon[i], lat[i]);
      const c = Math.floor(x / cell);
      const r = Math.floor(y / cell);
      if (c >= 0 && c < cols && r >= 0 && r < rows) v[r * cols + c] += weight ? weight[i] : 1;
    }
    // Three box blurs approximate a Gaussian kernel.
    const rad = Math.max(1, Math.round((this.opts.radius ?? 10) / cell / 1.7));
    const tmp = new Float32Array(v.length);
    const blur = (src: Float32Array, dst: Float32Array, horizontal: boolean) => {
      const n = horizontal ? cols : rows;
      const m = horizontal ? rows : cols;
      for (let a = 0; a < m; a++) {
        let acc = 0;
        const at = (k: number) => (horizontal ? a * cols + k : k * cols + a);
        for (let k = -rad; k <= rad; k++) if (k >= 0 && k < n) acc += src[at(k)];
        for (let k = 0; k < n; k++) {
          dst[at(k)] = acc / (2 * rad + 1);
          const add = k + rad + 1;
          const sub = k - rad;
          if (add < n) acc += src[at(add)];
          if (sub >= 0) acc -= src[at(sub)];
        }
      }
    };
    for (let pass = 0; pass < 3; pass++) {
      blur(v, tmp, true);
      blur(tmp, v, false);
    }
    let max = 0;
    for (let i = 0; i < v.length; i++) if (v[i] > max) max = v[i];
    this.grid = { cols, rows, cell, v, max };
    if (!max) return;
    const ramp = this.theme.sequential.slice(2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = v[r * cols + c] / max;
        if (t < 0.03) continue;
        const color = '#' + sampleRamp(ramp, Math.sqrt(t)).getHexString();
        b.box(c * cell, r * cell, (c + 1) * cell, (r + 1) * cell, color, Math.min(0.9, t * 1.8));
      }
    }
    v = new Float32Array(0);
  }

  protected hitTest(px: number, py: number): Hit | null {
    const hit = super.hitTest(px, py);
    const g = this.grid;
    if (!g || !g.max) return hit;
    const [x, y] = this.toData(px, py);
    const c = Math.floor(x / g.cell);
    const r = Math.floor(y / g.cell);
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return hit;
    const t = g.v[r * g.cols + c] / g.max;
    const row = { label: 'Density', value: `${Math.round(t * 100)}% of peak` };
    return hit ? { ...hit, rows: [row] } : { series: 'Density', index: 0, values: {}, rows: [row] };
  }
}

// ---- 3D extruded map ---------------------------------------------------------------------------------

/** Regions extruded upward by value (a 3D choropleth); drag to orbit. */
export class Map3DChart extends Chart3D<Map3DOptions> {
  readonly type = 'map3d' as const;
  private lo = 0;
  private hi = 1;

  protected customLegend() {
    return rampLegend(this.theme.sequential, formatNumber(this.lo), formatNumber(this.hi));
  }

  protected buildContent() {
    const feats = features(this.opts.topology, this.opts.object, this.opts.exclude);
    const P = fitProjection(this.opts.projection ?? 'naturalEarth', feats, 2 * HALF, 2 * HALF, 0);
    const vals = feats.map((f) => this.opts.values[f.name] ?? this.opts.values[f.id]).filter((v): v is number => v !== undefined);
    [this.lo, this.hi] = vals.length ? extent(vals) : [0, 1];
    if (this.hi <= this.lo) this.hi = this.lo + 1;
    for (const f of feats) {
      const v = this.opts.values[f.name] ?? this.opts.values[f.id];
      const t = v === undefined ? 0 : (v - this.lo) / (this.hi - this.lo);
      const depth = v === undefined ? 0.04 : 0.08 + t * 2.4;
      const shapes = f.polygons.map((poly) => {
        const toV = (r: number[]) => {
          const out: THREE.Vector2[] = [];
          for (let k = 0; k < r.length; k += 2) {
            const [x, y] = P(r[k], r[k + 1]);
            out.push(new THREE.Vector2(x - HALF, HALF - y));
          }
          return out;
        };
        const shape = new THREE.Shape(toV(poly[0]));
        shape.holes = poly.slice(1).map((h) => new THREE.Path(toV(h)));
        return shape;
      });
      const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      const color = v === undefined ? new THREE.Color(this.theme.grid) : sampleRamp(this.theme.sequential, 0.15 + 0.85 * t);
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 }));
      mesh.userData = { name: f.name, value: v };
      this.content.add(mesh);
    }
    this.controls.target.set(0, 0.6, 0);
    this.camera.position.set(0, 8.5, 9.5);
    this.controls.update();
  }

  protected hitTest(px: number, py: number): Hit | null {
    this.setRay(px, py);
    const hit = this.raycaster.intersectObjects(this.content.children, false)[0];
    if (!hit) return null;
    const { name, value } = hit.object.userData as { name: string; value?: number };
    return { series: name, index: 0, values: { Value: value ?? 'No data' }, rows: [{ label: 'Value', value: value === undefined ? 'No data' : formatNumber(value) }] };
  }
}

// ---- Globe (3D) --------------------------------------------------------------------------------

const GR = 4; // globe radius in world units

function toVec(lon: number, lat: number, r = GR): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const th = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

export class GlobeChart extends Chart3D<GlobeOptions> {
  readonly type = 'globe' as const;
  private sphere: THREE.Mesh | null = null;
  private feats: GeoFeature[] = [];
  private lo = 0;
  private hi = 1;

  protected customLegend() {
    if (!this.opts.values) return null;
    return rampLegend(this.theme.sequential, formatNumber(this.lo), formatNumber(this.hi));
  }

  protected legendItems(): LegendItem[] {
    return [];
  }

  private valueOf(f: GeoFeature) {
    return this.opts.values?.[f.name] ?? this.opts.values?.[f.id];
  }

  /** Paint countries into an equirectangular canvas used as the globe's texture. */
  private texture(): THREE.CanvasTexture {
    const W = 2048;
    const H = 1024;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = this.theme.mode === 'dark' ? '#202a36' : '#dfe9f5';
    g.fillRect(0, 0, W, H);
    const vals = Object.values(this.opts.values ?? {});
    this.lo = vals.length ? Math.min(...vals) : 0;
    this.hi = vals.length ? Math.max(...vals) : 1;
    for (const f of this.feats) {
      const v = this.valueOf(f);
      g.fillStyle = v === undefined ? (this.theme.mode === 'dark' ? '#3a3a37' : '#c9c8c0') : '#' + sampleRamp(this.theme.sequential, (v - this.lo) / (this.hi - this.lo || 1)).getHexString();
      g.strokeStyle = this.theme.surface;
      g.lineWidth = 1.2;
      const path = new Path2D();
      for (const poly of f.polygons) {
        for (const ring of poly) {
          for (let i = 0; i < ring.length; i += 2) {
            const x = ((ring[i] + 180) / 360) * W;
            const y = ((90 - ring[i + 1]) / 180) * H;
            if (i) path.lineTo(x, y);
            else path.moveTo(x, y);
          }
          path.closePath();
        }
      }
      g.fill(path, 'evenodd');
      g.stroke(path);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  protected buildContent() {
    this.feats = features(this.opts.topology, this.opts.object);
    this.content.position.y = 2.4;
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(GR, 96, 64), new THREE.MeshStandardMaterial({ map: this.texture(), roughness: 0.9, metalness: 0 }));
    this.content.add(this.sphere);

    // Points: bars standing on the surface, height by value.
    const pts = this.opts.points ?? [];
    if (pts.length) {
      const max = Math.max(...pts.map((p) => p.value), 1e-9);
      const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
      geo.translate(0, 0.5, 0);
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: this.color(1), roughness: 0.5 }), pts.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      pts.forEach((p, i) => {
        const pos = toVec(p.lon, p.lat);
        q.setFromUnitVectors(up, pos.clone().normalize());
        m.compose(pos, q, new THREE.Vector3(1, 0.05 + (p.value / max) * 1.6, 1));
        mesh.setMatrixAt(i, m);
      });
      mesh.userData.points = pts;
      this.content.add(mesh);
    }
    // Flows: great-circle arcs lifted off the surface.
    for (const f of this.opts.flows ?? []) {
      const a = toVec(f.from[0], f.from[1], 1);
      const c = toVec(f.to[0], f.to[1], 1);
      const ang = a.angleTo(c);
      const pos: number[] = [];
      for (let k = 0; k <= 48; k++) {
        const t = k / 48;
        const v = new THREE.Vector3().copy(a).multiplyScalar(Math.sin((1 - t) * ang)).addScaledVector(c, Math.sin(t * ang)).divideScalar(Math.sin(ang) || 1);
        v.normalize().multiplyScalar(GR * (1 + Math.sin(Math.PI * t) * ang * 0.12));
        pos.push(v.x, v.y, v.z);
      }
      const lg = new LineGeometry();
      lg.setPositions(pos);
      const lm = new LineMaterial({ color: new THREE.Color(this.color(0)).getHex(), linewidth: 2 * this.dpr, worldUnits: false });
      lm.resolution.set(this.pixelWidth, this.pixelHeight);
      this.content.add(new Line2(lg, lm));
    }
  }

  protected onProgress() {
    this.content.scale.setScalar(0.6 + 0.4 * this.progress);
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.sphere) return null;
    // Bars first: nearest projected tip within 8px.
    const pts = this.opts.points ?? [];
    let best = -1;
    let bd = 64;
    pts.forEach((p, i) => {
      const v = toVec(p.lon, p.lat).add(this.content.position);
      const [x, y, ok] = this.project(v);
      // Skip the far side of the globe.
      if (!ok || v.clone().sub(this.content.position).dot(this.camera.position.clone().sub(this.content.position)) < 0) return;
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0) {
      const p = pts[best];
      return { series: p.label ?? 'Point', index: best, color: this.color(1), values: { Value: formatNumber(p.value) } };
    }
    this.setRay(px, py);
    const hit = this.raycaster.intersectObject(this.sphere, false)[0];
    if (!hit) return null;
    const v = hit.point.clone().sub(this.content.position).normalize();
    const lat = 90 - (Math.acos(v.y) * 180) / Math.PI;
    let lon = (Math.atan2(v.z, -v.x) * 180) / Math.PI - 180;
    if (lon < -180) lon += 360;
    const f = this.feats.find((x) => featureContains(x, lon, lat));
    if (!f) return null;
    const val = this.valueOf(f);
    return { series: f.name, index: 0, values: { ...(this.opts.values ? { Value: val === undefined ? 'No data' : formatNumber(val) } : {}), Location: `${lat.toFixed(1)}°, ${lon.toFixed(1)}°` } };
  }
}
