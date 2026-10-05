import type { LegendItem } from '../base';
import { MarkChart, polar, toColor, type MarkBuilder } from '../markchart';
import { extent, formatNumber, niceDomain, niceTicks } from '../scale';
import { sampleRamp } from '../theme';
import type { Numbers } from '../types';
import type { PolarScatterOptions, VoronoiOptions } from '../types2';

const TAU = Math.PI * 2;

// ---- Voronoi -----------------------------------------------------------------------------------

/** Keep the part of `poly` on site i's side of the bisector between sites i and j. */
function clip(poly: number[], ax: number, ay: number, bx: number, by: number): number[] {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const nx = bx - ax;
  const ny = by - ay;
  const side = (x: number, y: number) => (x - mx) * nx + (y - my) * ny;
  const out: number[] = [];
  const n = poly.length / 2;
  for (let k = 0; k < n; k++) {
    const px = poly[k * 2], py = poly[k * 2 + 1];
    const qx = poly[((k + 1) % n) * 2], qy = poly[((k + 1) % n) * 2 + 1];
    const sp = side(px, py);
    const sq = side(qx, qy);
    if (sp <= 0) out.push(px, py);
    if ((sp <= 0) !== (sq <= 0)) {
      const t = sp / (sp - sq);
      out.push(px + (qx - px) * t, py + (qy - py) * t);
    }
  }
  return out;
}

/**
 * Voronoi cells inside a box. Each cell starts as the box and is cut by the
 * bisectors of nearby sites, searched ring by ring on a grid; the search stops
 * once no farther site can reach the cell. Near-linear for spread-out points.
 */
export function voronoiCells(xs: ArrayLike<number>, ys: ArrayLike<number>, box: [number, number, number, number]): number[][] {
  const [bx0, by0, bx1, by1] = box;
  const n = xs.length;
  const W = bx1 - bx0 || 1;
  const H = by1 - by0 || 1;
  const cs = Math.sqrt((W * H) / Math.max(1, n));
  const cols = Math.max(1, Math.ceil(W / cs));
  const rows = Math.max(1, Math.ceil(H / cs));
  const cellOf = (x: number, y: number): [number, number] => [Math.min(cols - 1, Math.max(0, Math.floor((x - bx0) / cs))), Math.min(rows - 1, Math.max(0, Math.floor((y - by0) / cs)))];
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  for (let i = 0; i < n; i++) {
    const [c, r] = cellOf(xs[i], ys[i]);
    buckets[r * cols + c].push(i);
  }
  const cells: number[][] = [];
  for (let i = 0; i < n; i++) {
    const sx = xs[i];
    const sy = ys[i];
    let poly = [bx0, by0, bx1, by0, bx1, by1, bx0, by1];
    const [hc, hr] = cellOf(sx, sy);
    for (let k = 0; k <= Math.max(cols, rows); k++) {
      let R = 0;
      for (let v = 0; v < poly.length; v += 2) R = Math.max(R, Math.hypot(poly[v] - sx, poly[v + 1] - sy));
      // Sites in ring k are at least (k - 1) cells away: too far to cut once beyond 2R.
      if (k > 1 && (k - 1) * cs > 2 * R) break;
      for (let r = hr - k; r <= hr + k; r++) {
        if (r < 0 || r >= rows) continue;
        for (let c = hc - k; c <= hc + k; c++) {
          if (c < 0 || c >= cols) continue;
          if (Math.max(Math.abs(r - hr), Math.abs(c - hc)) !== k) continue;
          for (const j of buckets[r * cols + c]) {
            if (j === i || (xs[j] === sx && ys[j] === sy)) continue;
            poly = clip(poly, sx, sy, xs[j], ys[j]);
            if (poly.length < 6) break;
          }
        }
      }
      if (poly.length < 6) break;
    }
    cells.push(poly);
  }
  return cells;
}

/** Cells of the plane closest to each point, colored by group or value. */
export class VoronoiChart extends MarkChart<VoronoiOptions> {
  readonly type = 'voronoi' as const;
  protected defaultZoom: 'x' | 'xy' | false = 'xy';
  protected relayout = true;

  private groupNames() {
    const out: string[] = [];
    for (const g of this.opts.groups ?? []) if (!out.includes(g)) out.push(g);
    return out;
  }

  protected legendItems(): LegendItem[] {
    return this.groupNames().map((g, i) => ({ name: g, color: this.color(i) }));
  }

  protected computeDomain() {
    const [x0, x1] = extent(this.opts.x);
    const [y0, y1] = extent(this.opts.y);
    const px = (x1 - x0 || 1) * 0.04;
    const py = (y1 - y0 || 1) * 0.04;
    this.full = { x0: x0 - px, x1: x1 + px, y0: y0 - py, y1: y1 + py };
  }

  protected marks(b: MarkBuilder) {
    const { x, y, groups, values, labels } = this.opts;
    const f = this.full;
    // Cells are computed in screen proportions so they look right at the default zoom.
    const sx = this.plot.width / (f.x1 - f.x0);
    const sy = this.plot.height / (f.y1 - f.y0);
    const n = Math.min(x.length, y.length);
    const keep: number[] = [];
    for (let i = 0; i < n; i++) if (!(groups && this.hidden.has(groups[i]))) keep.push(i);
    const X = keep.map((i) => (x[i] - f.x0) * sx);
    const Y = keep.map((i) => (y[i] - f.y0) * sy);
    const cells = voronoiCells(X, Y, [0, 0, (f.x1 - f.x0) * sx, (f.y1 - f.y0) * sy]);
    const names = this.groupNames();
    const [vlo, vhi] = values ? extent(values) : [0, 1];
    const base = this.color(0);
    const plain = '#' + toColor(base).clone().lerp(toColor(this.theme.surface), 0.72).getHexString();
    keep.forEach((i, k) => {
      const cell = cells[k];
      if (!cell || cell.length < 6) return;
      const pts: number[] = [];
      for (let v = 0; v < cell.length; v += 2) pts.push(cell[v] / sx + f.x0, cell[v + 1] / sy + f.y0);
      const color = groups ? this.color(names.indexOf(groups[i])) : values ? '#' + sampleRamp(this.theme.sequential, vhi > vlo ? (values[i] - vlo) / (vhi - vlo) : 0.5).getHexString() : plain;
      // Opaque tint (not alpha) so cells read the same on light and dark surfaces.
      const fill = groups ? '#' + toColor(color).clone().lerp(toColor(this.theme.surface), 0.45).getHexString() : color;
      b.poly(pts, fill, 1);
      b.line(pts, this.theme.surface, 1.5, 1, true);
      if (this.opts.showPoints ?? true) b.point(x[i], y[i], groups ? color : this.theme.textPrimary, 5);
      b.region({
        k: 'poly',
        pts,
        hit: {
          series: labels?.[i] ?? groups?.[i] ?? `Point ${i + 1}`,
          index: i,
          color,
          values: { x: x[i], y: y[i] },
          rows: [
            { label: 'x', value: this.formatX(x[i]) },
            { label: 'y', value: this.formatY(y[i]) },
            ...(groups ? [{ label: 'Group', value: groups[i], color }] : []),
            ...(values ? [{ label: 'Value', value: formatNumber(values[i]), color }] : []),
          ],
        },
      });
    });
  }
}

// ---- Polar scatter ---------------------------------------------------------------------------------

/** Points at (angle, radius): direction-dependent data such as wind, antenna gain or bearings. */
export class PolarScatterChart extends MarkChart<PolarScatterOptions> {
  readonly type = 'polarScatter' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  private angle(t: number) {
    return this.opts.angleUnit === 'radians' ? t : (t * Math.PI) / 180;
  }

  protected marks(b: MarkBuilder) {
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.max(10, Math.min(W, H) / 2 - 24);
    const vis = this.opts.series.map((s, i) => ({ s, color: this.color(i, s.color) })).filter(({ s }) => !this.hidden.has(s.name));
    let max = 1e-9;
    for (const { s } of vis) max = Math.max(max, extent(s.r as Numbers)[1]);
    const rmax = niceDomain(0, max)[1];
    for (const t of niceTicks(0, rmax, 4)) {
      if (t <= 0) continue;
      b.arc(cx, cy, (t / rmax) * R, 0, TAU, this.theme.grid, 1);
      // Radius labels sit between two spokes, clear of the angle labels.
      const [tx, ty] = polar(cx, cy, (t / rmax) * R, Math.PI / 12);
      b.text(formatNumber(t), tx + 2, ty, 0, 1.1);
    }
    for (let d = 0; d < 360; d += 30) {
      const a = (d * Math.PI) / 180;
      const [ex, ey] = polar(cx, cy, R, a);
      b.seg(cx, cy, ex, ey, this.theme.grid, 1);
      const [lx, ly] = polar(cx, cy, R + 12, a);
      b.text(`${d}°`, lx, ly, 0.5, 0.5);
    }
    let total = 0;
    for (const { s } of vis) total += s.r.length;
    // Hover targets for every point up to a few thousand.
    const hover = total <= 5000;
    for (const { s, color } of vis) {
      const n = Math.min(s.theta.length, s.r.length);
      for (let i = 0; i < n; i++) {
        const [px, py] = polar(cx, cy, (s.r[i] / rmax) * R, this.angle(s.theta[i]));
        b.point(px, py, color, total > 2000 ? 5 : 8, 'circle', 0.85);
        if (hover) {
          const deg = this.opts.angleUnit === 'radians' ? (s.theta[i] * 180) / Math.PI : s.theta[i];
          b.region({ k: 'circle', x: px, y: py, r: 7, hit: { series: s.name, index: i, color, values: { Angle: deg, Radius: s.r[i] }, rows: [{ label: 'Angle', value: `${formatNumber(deg)}°` }, { label: 'Radius', value: formatNumber(s.r[i]), color }] } });
        }
      }
    }
  }
}
