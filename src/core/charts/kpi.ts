import type { LegendItem } from '../base';
import { MarkChart, polar, type MarkBuilder } from '../markchart';
import { extent, formatNumber, niceTicks } from '../scale';
import type { LinearGaugeOptions, ProgressRingOptions, StatOptions } from '../types2';

const TAU = Math.PI * 2;

abstract class KpiChart<O extends LinearGaugeOptions | ProgressRingOptions | StatOptions> extends MarkChart<O> {
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 6;
}

// ---- Linear gauge / thermometer -------------------------------------------------------------

export class LinearGaugeChart extends KpiChart<LinearGaugeOptions> {
  readonly type = 'linearGauge' as const;

  private valueColor() {
    const v = this.opts.value;
    return this.opts.bands?.find((b) => v <= b.to)?.color ?? this.color(0);
  }

  protected marks(b: MarkBuilder) {
    const o = this.opts;
    const lo = o.min ?? 0;
    const hi = o.max ?? 100;
    const W = this.plot.width;
    const H = this.plot.height;
    const v = lo + (Math.min(hi, Math.max(lo, o.value)) - lo) * this.progress;
    const f = (x: number) => (Math.min(hi, Math.max(lo, x)) - lo) / (hi - lo || 1);
    const color = this.valueColor();
    const units = o.units ?? '';
    const hit = { series: o.label ?? 'Value', index: 0, color, values: { Value: formatNumber(o.value) + units, Range: `${formatNumber(lo)} – ${formatNumber(hi)}${units}`, ...(o.target !== undefined ? { Target: formatNumber(o.target) + units } : {}) } };

    if (o.variant === 'thermometer') {
      const tubeW = Math.min(26, W * 0.12);
      const bulbR = tubeW * 0.95;
      const cx = W * 0.4;
      const top = 12;
      const bottom = H - bulbR * 2 - 6;
      const Y = (x: number) => bottom - f(x) * (bottom - top);
      b.box(cx - tubeW / 2, top, cx + tubeW / 2, bottom + 2, this.theme.grid, 1);
      b.sector(cx, top + tubeW / 2, 0, tubeW / 2, -Math.PI / 2, Math.PI / 2, this.theme.grid);
      b.sector(cx, H - bulbR - 6, 0, bulbR, 0, TAU, color);
      b.box(cx - tubeW / 2 + 4, Y(v), cx + tubeW / 2 - 4, bottom + 4, color, 1);
      for (const t of niceTicks(lo, hi, 5)) {
        b.seg(cx + tubeW / 2 + 3, Y(t), cx + tubeW / 2 + 9, Y(t), this.theme.textMuted, 1);
        b.text(formatNumber(t) + units, cx + tubeW / 2 + 12, Y(t), 0, 0.5);
      }
      if (o.target !== undefined) b.seg(cx - tubeW / 2 - 6, Y(o.target), cx + tubeW / 2 + 2, Y(o.target), this.theme.textPrimary, 2.5);
      b.text(formatNumber(o.value) + units, cx - tubeW, H / 2 - 8, 1, 0.5, true, { size: 24, weight: 600, color: this.theme.textPrimary });
      if (o.label) b.text(o.label, cx - tubeW, H / 2 + 14, 1, 0.5);
      b.region({ k: 'rect', x0: 0, y0: 0, x1: W, y1: H, hl: { k: 'rect', x0: cx - tubeW / 2, y0: top, x1: cx + tubeW / 2, y1: bottom }, hit });
      return;
    }

    const y = Math.max(46, H / 2 - 6);
    const th = Math.min(22, H * 0.18);
    const x0 = 6;
    const x1 = W - 6;
    const X = (x: number) => x0 + f(x) * (x1 - x0);
    b.text(formatNumber(o.value) + units, x0, y - th / 2 - 10, 0, 1, true, { size: 24, weight: 600, color: this.theme.textPrimary });
    if (o.label) b.text(o.label, x1, y - th / 2 - 12, 1, 1);
    b.rect(x0, y - th / 2, x1, y + th / 2, this.theme.grid);
    let from = lo;
    for (const band of o.bands ?? []) {
      b.box(X(from), y + th / 2 + 3, X(band.to), y + th / 2 + 7, band.color, 1);
      from = band.to;
    }
    b.rect(x0, y - th / 2, Math.max(x0 + 1, X(v)), y + th / 2, color, 'right');
    if (o.target !== undefined) b.seg(X(o.target), y - th / 2 - 5, X(o.target), y + th / 2 + 5, this.theme.textPrimary, 2.5);
    for (const t of niceTicks(lo, hi, 5)) b.text(formatNumber(t), X(t), y + th / 2 + 11, 0.5, 0);
    b.region({ k: 'rect', x0: 0, y0: 0, x1: W, y1: H, hl: { k: 'rect', x0, y0: y - th / 2, x1, y1: y + th / 2 }, hit });
  }

  protected onProgress() {
    // The value animates in, which changes geometry: rebuild (cheap, a handful of marks).
    if (this.built) {
      this.rebuildMarks();
      this.labels.begin();
      this.addLabels(this.labels);
      this.labels.end();
    }
  }
}

// ---- Progress rings -----------------------------------------------------------------------------

export class ProgressRingChart extends KpiChart<ProgressRingOptions> {
  readonly type = 'progressRing' as const;

  protected legendItems(): LegendItem[] {
    return this.opts.rings.map((r, i) => ({ name: r.label, color: r.color ?? this.color(i) }));
  }

  protected marks(b: MarkBuilder) {
    const rings = this.opts.rings;
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 4;
    const thick = Math.min(26, (R * 0.62) / Math.max(1, rings.length) - 4);
    rings.forEach((r, i) => {
      if (this.hidden.has(r.label)) return;
      const color = r.color ?? this.color(i);
      const outer = R - i * (thick + 5);
      const inner = outer - thick;
      const mid = (inner + outer) / 2;
      const frac = Math.max(0, r.value / (r.max ?? 100));
      const a = Math.min(frac, 1) * TAU * this.progress;
      b.sector(cx, cy, inner, outer, 0, TAU, this.theme.grid, 0.7);
      if (a > 0.001) {
        b.sector(cx, cy, inner, outer, 0, a, color);
        // Round caps at both ends.
        b.point(cx, cy - mid, color, thick, 'disc');
        b.point(...polar(cx, cy, mid, a), color, thick, 'disc');
      }
      b.region({
        k: 'sector',
        cx,
        cy,
        r0: inner,
        r1: outer,
        a0: 0,
        a1: TAU,
        hit: { series: r.label, index: i, color, values: { Value: formatNumber(r.value), Goal: formatNumber(r.max ?? 100), Complete: `${Math.round(frac * 100)}%` } },
      });
    });
    const first = rings.find((r) => !this.hidden.has(r.label));
    if (first) {
      const inner = R - rings.length * (thick + 5);
      b.text(`${Math.round((first.value / (first.max ?? 100)) * 100)}%`, cx, cy - 6, 0.5, 0.5, true, { size: Math.max(14, Math.min(30, inner * 0.5)), weight: 600, color: this.theme.textPrimary });
      b.text(first.label, cx, cy + Math.max(10, Math.min(18, inner * 0.3)), 0.5, 0.5, false, { maxWidth: inner * 1.6 });
    }
  }

  protected onProgress() {
    if (this.built) {
      this.rebuildMarks();
      this.labels.begin();
      this.addLabels(this.labels);
      this.labels.end();
    }
  }
}

// ---- Stat tile ----------------------------------------------------------------------------------

export class StatChart extends KpiChart<StatOptions> {
  readonly type = 'stat' as const;
  protected plotPad = 10;

  protected marks(b: MarkBuilder) {
    const o = this.opts;
    const W = this.plot.width;
    const H = this.plot.height;
    const units = o.units ?? '';
    b.text(o.label, 0, 0, 0, 0, false, { size: 12 });
    b.text(formatNumber(o.value) + units, 0, 18, 0, 0, true, { size: Math.min(34, H * 0.22), weight: 600, color: this.theme.textPrimary });
    if (o.previous !== undefined) {
      const d = o.value - o.previous;
      const pct = o.previous ? (d / Math.abs(o.previous)) * 100 : 0;
      const good = d === 0 ? null : (d > 0) === (o.higherIsBetter ?? true);
      // Status color always travels with an arrow and a signed number, never color alone.
      const color = good === null ? this.theme.textSecondary : good ? this.theme.status.good : this.theme.status.critical;
      const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '■';
      b.text(`${arrow} ${d >= 0 ? '+' : ''}${formatNumber(d)}${units} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`, 0, 18 + Math.min(34, H * 0.22) + 10, 0, 0, true, { color, size: 12 });
      b.text(`vs ${formatNumber(o.previous)}${units}`, W, 0, 1, 0, false, { size: 11 });
    }
    const spark = o.spark;
    if (spark && spark.length > 1) {
      const top = Math.max(H * 0.55, 90);
      const [lo, hi] = extent(spark);
      const n = spark.length;
      const pts: number[] = [];
      const bot: number[] = [];
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * W;
        const y = H - ((spark[i] - lo) / (hi - lo || 1)) * (H - top);
        pts.push(x, y);
        bot.push(x, H);
      }
      const c = this.color(0);
      b.band(pts, bot, c, 0.15);
      b.line(pts, c, 1.5);
      b.point(pts[pts.length - 2], pts[pts.length - 1], c, 7);
      b.region({ k: 'rect', x0: 0, y0: top, x1: W, y1: H, hit: { series: o.label, index: 0, values: { Latest: formatNumber(spark[n - 1]), Low: formatNumber(lo), High: formatNumber(hi), Points: n } } });
    }
  }
}
