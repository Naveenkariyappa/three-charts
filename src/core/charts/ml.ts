import type { Hit, LegendItem } from '../base';
import { MarkChart, inkOn, textWidth, type MarkBuilder } from '../markchart';
import { formatNumber } from '../scale';
import { sampleRamp } from '../theme';
import type { Numbers } from '../types';
import type { ConfusionMatrixOptions, RocCurveOptions, RocSeries } from '../types2';

const pct = (v: number) => (v === v ? `${(v * 100).toFixed(1)}%` : '–');

// ---- Confusion matrix ------------------------------------------------------------------------

/**
 * Actual classes down the side, predicted across the bottom. Shading follows
 * the shown value (counts, or row/column shares when normalized); the
 * diagonal is where the model is right.
 */
export class ConfusionMatrixChart extends MarkChart<ConfusionMatrixOptions> {
  readonly type = 'confusionMatrix' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 4;
  private max = 1;

  protected customLegend() {
    const el = document.createElement('div');
    el.className = 'tc-ramp';
    const stops = this.theme.sequential;
    const hi = this.opts.normalize && this.opts.normalize !== 'none' ? '100%' : formatNumber(this.max);
    el.innerHTML = `<span>0</span><i style="background:linear-gradient(90deg,${stops.join(',')})"></i><span>${hi}</span>`;
    return el;
  }

  /** Value shown in cell [a][p], in 0..1 when normalized. */
  private shown(a: number, p: number) {
    const m = this.opts.matrix;
    const mode = this.opts.normalize ?? 'none';
    if (mode === 'row') {
      const s = m[a].reduce((x, y) => x + y, 0);
      return s ? m[a][p] / s : 0;
    }
    if (mode === 'column') {
      let s = 0;
      for (const row of m) s += row[p] ?? 0;
      return s ? m[a][p] / s : 0;
    }
    return m[a][p];
  }

  protected marks(b: MarkBuilder) {
    const { labels, matrix } = this.opts;
    const n = labels.length;
    const mode = this.opts.normalize ?? 'none';
    const W = this.plot.width;
    const H = this.plot.height;
    const labelW = Math.min(140, Math.max(...labels.map((l) => textWidth(l, 11))) + 10);
    const left = labelW + 22;
    const bottom = 44;
    const top = 20;
    const cell = Math.max(4, Math.min((W - left - 4) / n, (H - bottom - top) / n));
    const x0 = left + (W - left - cell * n) / 2;
    const y0 = top + Math.max(0, (H - bottom - top - cell * n) / 2);
    this.max = 1;
    for (let a = 0; a < n; a++) for (let p = 0; p < n; p++) this.max = Math.max(this.max, matrix[a]?.[p] ?? 0);
    let total = 0;
    let correct = 0;
    for (let a = 0; a < n; a++) {
      for (let p = 0; p < n; p++) {
        total += matrix[a]?.[p] ?? 0;
        if (a === p) correct += matrix[a]?.[p] ?? 0;
      }
    }
    const rowSum = (a: number) => matrix[a].reduce((x, y) => x + y, 0);
    const colSum = (p: number) => matrix.reduce((x, row) => x + (row[p] ?? 0), 0);
    const size = Math.max(9, Math.min(15, cell * 0.26));
    for (let a = 0; a < n; a++) {
      for (let p = 0; p < n; p++) {
        const count = matrix[a]?.[p] ?? 0;
        const v = this.shown(a, p);
        const t = mode === 'none' ? count / this.max : v;
        const color = '#' + sampleRamp(this.theme.sequential, t).getHexString();
        const cx0 = x0 + p * cell;
        const cy0 = y0 + a * cell;
        // 2px surface gap between cells.
        b.box(cx0 + 1, cy0 + 1, cx0 + cell - 1, cy0 + cell - 1, color, 1);
        if (cell >= 22) b.text(mode === 'none' ? formatNumber(count) : pct(v), cx0 + cell / 2, cy0 + cell / 2, 0.5, 0.5, a === p, { color: inkOn(color), size, weight: a === p ? 600 : 400 });
        b.region({
          k: 'rect',
          x0: cx0,
          y0: cy0,
          x1: cx0 + cell,
          y1: cy0 + cell,
          hit: {
            series: `${labels[a]} → ${labels[p]}`,
            index: a * n + p,
            title: a === p ? `${labels[a]}: correct` : `Actual ${labels[a]}, predicted ${labels[p]}`,
            values: { Count: count },
            rows: [
              { label: 'Count', value: formatNumber(count), color },
              { label: 'Of actual ' + labels[a], value: pct(count / rowSum(a)) },
              { label: 'Of predicted ' + labels[p], value: pct(count / colSum(p)) },
            ],
          },
        });
      }
      b.text(labels[a], x0 - 8, y0 + (a + 0.5) * cell, 1, 0.5, false, { maxWidth: labelW });
    }
    for (let p = 0; p < n; p++) b.text(labels[p], x0 + (p + 0.5) * cell, y0 + n * cell + 6, 0.5, 0, false, { maxWidth: cell - 4 });
    b.text('Predicted', x0 + (n * cell) / 2, y0 + n * cell + 24, 0.5, 0, true);
    b.text('Actual', x0 - labelW - 14, y0 + (n * cell) / 2, 0.5, 0.5, true, { rotate: -90 });
    b.text(`Accuracy ${pct(correct / (total || 1))}`, x0 + n * cell, y0 - 6, 1, 1);
  }
}

// ---- ROC / precision-recall ------------------------------------------------------------------------

interface Curve {
  x: Float64Array;
  y: Float64Array;
  /** Score threshold per point (NaN for precomputed curves). */
  t: Float64Array;
  area: number;
  /** Positive rate, for the PR baseline. */
  base: number;
}

/** Sweep thresholds from the highest score down. */
function curveFrom(actual: Numbers, score: Numbers, kind: 'roc' | 'pr'): Curve {
  const n = Math.min(actual.length, score.length);
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, c) => score[c] - score[a]);
  let P = 0;
  for (let i = 0; i < n; i++) if (actual[i] > 0) P++;
  const N = n - P;
  const xs: number[] = [kind === 'roc' ? 0 : 0];
  const ys: number[] = [kind === 'roc' ? 0 : 1];
  const ts: number[] = [Infinity];
  let tp = 0;
  let fp = 0;
  for (let k = 0; k < n; k++) {
    const i = idx[k];
    if (actual[i] > 0) tp++;
    else fp++;
    // One point per distinct score.
    if (k < n - 1 && score[idx[k + 1]] === score[i]) continue;
    if (kind === 'roc') {
      xs.push(N ? fp / N : 0);
      ys.push(P ? tp / P : 0);
    } else {
      xs.push(P ? tp / P : 0);
      ys.push(tp + fp ? tp / (tp + fp) : 1);
    }
    ts.push(score[i]);
  }
  return finish(xs, ys, ts, kind, n ? P / n : 0);
}

function finish(xs: number[], ys: number[], ts: number[], kind: 'roc' | 'pr', base: number): Curve {
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const dx = xs[i] - xs[i - 1];
    // ROC: trapezoids. PR: average precision (step at each recall gain).
    area += kind === 'roc' ? (dx * (ys[i] + ys[i - 1])) / 2 : dx * ys[i];
  }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), t: Float64Array.from(ts), area, base };
}

interface CurveView {
  s: RocSeries;
  c: Curve;
  color: string;
  name: string;
}

/** ROC (true vs false positive rate) or precision-recall curves, with the area under each. */
export class RocCurveChart extends MarkChart<RocCurveOptions> {
  readonly type = 'rocCurve' as const;
  protected defaultZoom: 'x' | 'xy' | false = false;
  private curves: CurveView[] = [];
  private hover: { px: number; py: number; color: string } | null = null;

  private kind() {
    return this.opts.kind ?? 'roc';
  }

  private label(s: RocSeries, c: Curve) {
    return `${s.name} (${this.kind() === 'roc' ? 'AUC' : 'AP'} ${c.area.toFixed(3)})`;
  }

  private computedFor: unknown = null;

  private compute() {
    const kind = this.kind();
    const key = [this.opts.series, kind, this.theme, this.opts.colors];
    const prev = this.computedFor as unknown[] | null;
    if (prev && key.every((k, i) => k === prev[i])) return;
    this.computedFor = key;
    this.curves = this.opts.series.map((s, i) => {
      let c: Curve;
      if (s.actual && s.score) c = curveFrom(s.actual, s.score, kind);
      else c = finish(Array.from(s.x ?? []), Array.from(s.y ?? []), Array.from(s.x ?? [], () => NaN), kind, NaN);
      return { s, c, color: this.color(i, s.color), name: this.label(s, c) };
    });
  }

  protected legendItems(): LegendItem[] {
    this.compute();
    return this.curves.map((v) => ({ name: v.name, color: v.color }));
  }

  protected computeDomain() {
    this.compute();
    const roc = this.kind() === 'roc';
    const xa = this.opts.xAxis ?? {};
    const ya = this.opts.yAxis ?? {};
    this.opts = {
      ...this.opts,
      xAxis: { ...xa, label: xa.label ?? (roc ? 'False positive rate' : 'Recall') },
      yAxis: { ...ya, label: ya.label ?? (roc ? 'True positive rate' : 'Precision') },
    };
    this.full = { x0: 0, x1: 1, y0: 0, y1: 1 };
  }

  protected marks(b: MarkBuilder) {
    const roc = this.kind() === 'roc';
    const muted = this.theme.textMuted;
    if (roc) {
      b.line([0, 0, 1, 1], muted, 1, 1, false, true);
      b.text('Chance', 0.78, 0.74, 0, 1);
    } else {
      const base = this.curves.find((v) => v.c.base === v.c.base)?.c.base;
      if (base !== undefined) {
        b.line([0, base, 1, base], muted, 1, 1, false, true);
        b.text('Chance', 0.99, base, 1, 1.3);
      }
    }
    for (const { c, color, name } of this.curves) {
      if (this.hidden.has(name)) continue;
      const pts: number[] = [];
      // Cap drawn vertices; hover still uses every point.
      const step = Math.max(1, Math.floor(c.x.length / 4000));
      for (let i = 0; i < c.x.length; i += step) pts.push(c.x[i], c.y[i]);
      pts.push(c.x[c.x.length - 1], c.y[c.y.length - 1]);
      b.line(pts, color, 2);
    }
  }

  protected hitTest(px: number, py: number): Hit | null {
    if (!this.inPlot(px, py)) return null;
    let best: { v: CurveView; i: number; d: number } | null = null;
    for (const v of this.curves) {
      if (this.hidden.has(v.name)) continue;
      const { x, y } = v.c;
      for (let i = 0; i < x.length; i++) {
        const [qx, qy] = this.toPx(x[i], y[i]);
        const d = Math.hypot(qx - px, qy - py);
        if (!best || d < best.d) best = { v, i, d };
      }
    }
    if (!best || best.d > 16) return null;
    const { v, i } = best;
    const roc = this.kind() === 'roc';
    const [hx, hy] = this.toPx(v.c.x[i], v.c.y[i]);
    this.hover = { px: hx, py: hy, color: v.color };
    const t = v.c.t[i];
    return {
      series: v.s.name,
      index: i,
      color: v.color,
      title: v.name,
      values: { x: v.c.x[i], y: v.c.y[i] },
      rows: [
        { label: roc ? 'False positive rate' : 'Recall', value: pct(v.c.x[i]) },
        { label: roc ? 'True positive rate' : 'Precision', value: pct(v.c.y[i]), color: v.color },
        ...(t === t && isFinite(t) ? [{ label: 'Threshold', value: formatNumber(t) }] : []),
      ],
    };
  }

  protected highlight(hit: Hit | null) {
    if (hit && this.hover) this.showDot(this.hover.px, this.hover.py, this.hover.color);
    else this.showDot(null);
  }
}
