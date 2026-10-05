import type { LegendItem } from '../base';
import { MarkChart, type MarkBuilder } from '../markchart';
import { extent, formatNumber, niceDomain } from '../scale';
import { sampleRamp } from '../theme';
import type { SmithOptions, TernaryOptions, VectorFieldOptions } from '../types2';

function rampLegend(stops: string[], lo: string, hi: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'tc-ramp';
  el.innerHTML = `<span>${lo}</span><i style="background:linear-gradient(90deg,${stops.join(',')})"></i><span>${hi}</span>`;
  return el;
}

// ---- Vector field (quiver) -------------------------------------------------------------------

export class VectorFieldChart extends MarkChart<VectorFieldOptions> {
  readonly type = 'vectorField' as const;
  protected relayout = true;
  protected defaultZoom: 'x' | 'xy' | false = 'xy';
  private maxMag = 1;

  protected customLegend() {
    return rampLegend(this.theme.sequential.slice(3), '0', `${formatNumber(this.maxMag)} (magnitude)`);
  }

  protected computeDomain() {
    const [x0, x1] = extent(this.opts.x);
    const [y0, y1] = extent(this.opts.y);
    const px = (x1 - x0) * 0.05 || 1;
    const py = (y1 - y0) * 0.05 || 1;
    const [a, b] = niceDomain(x0 - px, x1 + px);
    const [c, d] = niceDomain(y0 - py, y1 + py);
    this.full = { x0: a, x1: b, y0: c, y1: d };
  }

  protected marks(b: MarkBuilder) {
    const { x, y, u, v } = this.opts;
    const n = Math.min(x.length, u.length);
    let max = 0;
    for (let i = 0; i < n; i++) max = Math.max(max, Math.hypot(u[i], v[i]));
    this.maxMag = max || 1;
    const [ux, uy] = this.unitsPerPx();
    // Longest arrow ~ the typical spacing between samples, in px.
    const spacing = Math.sqrt((this.plot.width * this.plot.height) / Math.max(1, n));
    const k = (spacing * 0.9) / this.maxMag;
    const ramp = this.theme.sequential.slice(3);
    for (let i = 0; i < n; i++) {
      const m = Math.hypot(u[i], v[i]);
      const color = '#' + sampleRamp(ramp, m / this.maxMag).getHexString();
      // Work in px, convert back to data units.
      const lx = u[i] * k;
      const ly = v[i] * k;
      const L = Math.hypot(lx, ly);
      const x1 = x[i] + lx * ux;
      const y1 = y[i] + ly * uy;
      b.seg(x[i], y[i], x1, y1, color, 1.5);
      if (L > 3) {
        const dx = lx / L;
        const dy = ly / L;
        const h = Math.min(6, L * 0.45);
        const bx = x1 - dx * h * ux;
        const by = y1 - dy * h * uy;
        b.tri(x1, y1, bx - dy * h * 0.45 * ux, by + dx * h * 0.45 * uy, bx + dy * h * 0.45 * ux, by - dx * h * 0.45 * uy, color);
      }
      b.region({ k: 'circle', x: x[i], y: y[i], r: 6, hit: { series: 'Vector', index: i, color, title: `${formatNumber(x[i])}, ${formatNumber(y[i])}`, values: { u: formatNumber(u[i]), v: formatNumber(v[i]), Magnitude: formatNumber(m), Direction: `${((Math.atan2(v[i], u[i]) * 180) / Math.PI).toFixed(0)}°` } } });
    }
  }
}

// ---- Ternary ------------------------------------------------------------------------------------

export class TernaryChart extends MarkChart<TernaryOptions> {
  readonly type = 'ternary' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected marks(b: MarkBuilder) {
    const W = this.plot.width;
    const H = this.plot.height;
    const side = Math.min(W - 80, (H - 50) / 0.866);
    const h = side * 0.866;
    const A: [number, number] = [W / 2, (H - h) / 2 + 6];
    const B: [number, number] = [W / 2 - side / 2, A[1] + h];
    const C: [number, number] = [W / 2 + side / 2, A[1] + h];
    const P = (a: number, bb: number, c: number): [number, number] => {
      const s = a + bb + c || 1;
      return [(A[0] * a + B[0] * bb + C[0] * c) / s, (A[1] * a + B[1] * bb + C[1] * c) / s];
    };
    b.poly([...A, ...B, ...C], this.theme.grid, 0.25);
    for (let t = 0.2; t < 0.99; t += 0.2) {
      // Lines of constant a, b and c.
      b.line([...P(t, 1 - t, 0), ...P(t, 0, 1 - t)], this.theme.grid, 1);
      b.line([...P(1 - t, t, 0), ...P(0, t, 1 - t)], this.theme.grid, 1);
      b.line([...P(1 - t, 0, t), ...P(0, 1 - t, t)], this.theme.grid, 1);
      const pct = `${Math.round(t * 100)}%`;
      b.text(pct, ...P(t, 0, 1 - t), -0.15, 0.5, false, { size: 10 });
      b.text(pct, ...P(1 - t, t, 0), 1.15, 0.5, false, { size: 10 });
      b.text(pct, ...P(0, 1 - t, t), 0.5, -0.3, false, { size: 10 });
    }
    b.line([...A, ...B, ...C], this.theme.textMuted, 1.5, 1, true);
    const [na, nb, nc] = this.opts.axes;
    b.text(na, A[0], A[1] - 6, 0.5, 1, true);
    b.text(nb, B[0] - 6, B[1] + 4, 1, 0, true);
    b.text(nc, C[0] + 6, C[1] + 4, 0, 0, true);
    this.opts.series.forEach((s, si) => {
      if (this.hidden.has(s.name)) return;
      const color = this.color(si, s.color);
      const n = Math.min(s.a.length, s.b.length, s.c.length);
      for (let i = 0; i < n; i++) {
        const [x, y] = P(s.a[i], s.b[i], s.c[i]);
        b.point(x, y, color, 8, 'circle', 0.85);
        const tot = s.a[i] + s.b[i] + s.c[i] || 1;
        b.region({ k: 'circle', x, y, r: 6, hit: { series: s.name, index: i, color, values: { [na]: `${((s.a[i] / tot) * 100).toFixed(1)}%`, [nb]: `${((s.b[i] / tot) * 100).toFixed(1)}%`, [nc]: `${((s.c[i] / tot) * 100).toFixed(1)}%` } } });
      }
    });
  }
}

// ---- Smith chart ----------------------------------------------------------------------------------

export class SmithChart extends MarkChart<SmithOptions> {
  readonly type = 'smith' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;

  protected legendItems(): LegendItem[] {
    return this.opts.series.map((s, i) => ({ name: s.name, color: this.color(i, s.color) }));
  }

  protected marks(b: MarkBuilder) {
    const W = this.plot.width;
    const H = this.plot.height;
    const R = Math.min(W, H) / 2 - 22;
    const cx = W / 2;
    const cy = H / 2;
    const G = (gr: number, gi: number): [number, number] => [cx + gr * R, cy - gi * R];
    const circle = (ccx: number, ccy: number, r: number, color: string, width = 1) => {
      // Sample the circle, keeping only the part inside |Γ| <= 1.
      let run: number[] = [];
      const steps = 180;
      for (let k = 0; k <= steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const gr = ccx + Math.cos(a) * r;
        const gi = ccy + Math.sin(a) * r;
        if (gr * gr + gi * gi <= 1.0001) run.push(...G(gr, gi));
        else if (run.length) {
          b.line(run, color, width);
          run = [];
        }
      }
      if (run.length > 2) b.line(run, color, width);
    };
    b.sector(cx, cy, 0, R, 0, Math.PI * 2, this.theme.grid, 0.25);
    for (const r of [0.2, 0.5, 1, 2, 5]) {
      circle(r / (r + 1), 0, 1 / (r + 1), this.theme.grid);
      b.text(String(r), ...G((r - 1) / (r + 1), 0), 1.1, -0.15, false, { size: 10 });
    }
    for (const x of [0.2, 0.5, 1, 2, 5]) {
      circle(1, 1 / x, 1 / x, this.theme.grid);
      circle(1, -1 / x, 1 / x, this.theme.grid);
      // Reactance labels where the arcs meet the outer circle.
      const den = 1 + x * x;
      const gr = (x * x - 1) / den;
      const gi = (2 * x) / den;
      b.text(`+j${x}`, ...G(gr * 1.07, gi * 1.07), 0.5, 0.5, false, { size: 10 });
      b.text(`−j${x}`, ...G(gr * 1.07, -gi * 1.07), 0.5, 0.5, false, { size: 10 });
    }
    b.line([...G(-1, 0), ...G(1, 0)], this.theme.grid, 1);
    circle(0, 0, 1, this.theme.textMuted, 1.5);
    this.opts.series.forEach((s, si) => {
      if (this.hidden.has(s.name)) return;
      const color = this.color(si, s.color);
      const n = Math.min(s.r.length, s.x.length);
      const pts: number[] = [];
      for (let i = 0; i < n; i++) {
        const r = s.r[i];
        const x = s.x[i];
        const den = (r + 1) ** 2 + x * x;
        const gr = (r * r - 1 + x * x) / den;
        const gi = (2 * x) / den;
        const [px, py] = G(gr, gi);
        pts.push(px, py);
        const mag = Math.hypot(gr, gi);
        b.region({
          k: 'circle',
          x: px,
          y: py,
          r: 5,
          hit: {
            series: s.name,
            index: i,
            color,
            values: { z: `${formatNumber(r)} ${x >= 0 ? '+' : '−'} j${formatNumber(Math.abs(x))}`, '|Γ|': mag.toFixed(3), '∠Γ': `${((Math.atan2(gi, gr) * 180) / Math.PI).toFixed(1)}°`, VSWR: mag < 1 ? ((1 + mag) / (1 - mag)).toFixed(2) : '∞' },
          },
        });
      }
      b.line(pts, color, 2);
      for (let i = 0; i < pts.length; i += 2) b.point(pts[i], pts[i + 1], color, i === 0 || i === pts.length - 2 ? 8 : 5);
    });
  }
}
