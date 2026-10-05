import type { LabelPool, LegendItem } from '../base';
import { sankey, type SankeyLinkIn, type SankeyNodeIn, type SLink, type SNode } from '../layouts';
import { MarkChart, toColor, type MarkBuilder } from '../markchart';
import { formatNumber } from '../scale';
import { bezier } from '../stats';
import type { AlluvialOptions, CalendarOptions, GanttOptions, SankeyOptions, TimelineOptions } from '../types2';
import { sampleRamp } from '../theme';

// ---- Sankey & alluvial ------------------------------------------------------------------

abstract class FlowChart<O extends SankeyOptions | AlluvialOptions> extends MarkChart<O> {
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 6;
  /** Room above the nodes (alluvial column titles). */
  protected topPad = 0;

  protected abstract graph(): { nodes: SankeyNodeIn[]; links: SankeyLinkIn[] };
  protected abstract nodeColor(n: SNode): string;
  protected abstract linkColor(l: SLink): string;

  protected marks(b: MarkBuilder) {
    const { nodes: nin, links: lin } = this.graph();
    const W = this.plot.width;
    const H = this.plot.height;
    const { nodes, links } = sankey(nin, lin, W, H - this.topPad, 14, 12);
    for (const n of nodes) {
      n.y0 += this.topPad;
      n.y1 += this.topPad;
    }
    for (const l of links) {
      l.y0 += this.topPad;
      l.y1 += this.topPad;
    }
    const maxCol = Math.max(0, ...nodes.map((n) => n.column));
    for (const l of links) {
      const x0 = l.source.x1;
      const x1 = l.target.x0;
      const xm = (x0 + x1) / 2;
      const h = l.width / 2;
      const top = bezier(x0, l.y0 - h, xm, l.y0 - h, xm, l.y1 - h, x1, l.y1 - h, 28);
      const bot = bezier(x0, l.y0 + h, xm, l.y0 + h, xm, l.y1 + h, x1, l.y1 + h, 28);
      const color = this.linkColor(l);
      b.band(top, bot, color, 0.38);
      const outline = [...top];
      for (let i = bot.length - 2; i >= 0; i -= 2) outline.push(bot[i], bot[i + 1]);
      b.region({
        k: 'poly',
        pts: outline,
        hit: {
          series: `${l.source.name} → ${l.target.name}`,
          index: 0,
          color,
          values: { Value: formatNumber(l.value), [`Of ${l.source.name}`]: `${((l.value / (l.source.value || 1)) * 100).toFixed(1)}%` },
        },
      });
    }
    for (const n of nodes) {
      const color = this.nodeColor(n);
      b.rect(n.x0, n.y0, n.x1, Math.max(n.y0 + 1, n.y1), color);
      const right = n.column < maxCol;
      b.text(n.name, right ? n.x1 + 6 : n.x0 - 6, (n.y0 + n.y1) / 2, right ? 0 : 1, 0.5, true, { maxWidth: Math.max(60, W / (maxCol + 1) - 30) });
      const inV = n.inLinks.reduce((s, l) => s + l.value, 0);
      const outV = n.outLinks.reduce((s, l) => s + l.value, 0);
      b.region({
        k: 'rect',
        x0: n.x0 - 3,
        y0: n.y0,
        x1: n.x1 + 3,
        y1: n.y1,
        hit: { series: n.name, index: n.index, color, values: { ...(inV ? { In: formatNumber(inV) } : {}), ...(outV ? { Out: formatNumber(outV) } : {}) } },
      });
    }
  }
}

export class SankeyChart extends FlowChart<SankeyOptions> {
  readonly type = 'sankey' as const;

  protected graph() {
    return { nodes: this.opts.nodes, links: this.opts.links };
  }

  protected nodeColor(n: SNode) {
    return n.color ?? this.color(n.index);
  }

  protected linkColor(l: SLink) {
    return l.color ?? this.nodeColor(l.source);
  }
}

/** Alluvial: categorical dimensions as columns; flows keep the color of their first-column category. */
export class AlluvialChart extends FlowChart<AlluvialOptions> {
  readonly type = 'alluvial' as const;
  protected topPad = 20;
  private firstValues: string[] = [];

  protected legendItems(): LegendItem[] {
    this.firstValues = [...new Set(this.opts.rows.map((r) => r.values[0]))];
    return this.firstValues.map((v, i) => ({ name: v, color: this.color(i) }));
  }

  protected graph() {
    const { dimensions, rows } = this.opts;
    this.firstValues = [...new Set(rows.map((r) => r.values[0]))];
    const nodes = new Map<string, SankeyNodeIn>();
    const links = new Map<string, SankeyLinkIn>();
    for (const r of rows) {
      if (this.hidden.has(r.values[0])) continue;
      dimensions.forEach((_, d) => {
        const id = `${d}:${r.values[d]}`;
        if (!nodes.has(id)) nodes.set(id, { id, name: r.values[d], column: d });
        if (d < dimensions.length - 1) {
          const t = `${d + 1}:${r.values[d + 1]}`;
          // One link per (source, target, origin) so flows keep their color across columns.
          const key = `${id}|${t}|${r.values[0]}`;
          const l = links.get(key);
          if (l) l.value += r.count;
          else links.set(key, { source: id, target: t, value: r.count, color: this.color(this.firstValues.indexOf(r.values[0])) });
        }
      });
    }
    // Order nodes in each column by first appearance in the data.
    return { nodes: [...nodes.values()], links: [...links.values()] };
  }

  protected nodeColor() {
    return this.theme.textSecondary;
  }

  protected linkColor(l: SLink) {
    return l.color ?? this.theme.textMuted;
  }

  protected addLabels(L: LabelPool) {
    super.addLabels(L);
    const n = this.opts.dimensions.length;
    this.opts.dimensions.forEach((d, i) => {
      const x = this.plot.left + 7 + (i / Math.max(1, n - 1)) * (this.plot.width - 14);
      L.add(d, x, 2, i === 0 ? 0 : i === n - 1 ? 1 : 0.5, 0, true, { weight: 600 });
    });
  }
}

// ---- Gantt ---------------------------------------------------------------------------------

export class GanttChart extends MarkChart<GanttOptions> {
  readonly type = 'gantt' as const;
  protected relayout = true;

  private groups(): string[] {
    return [...new Set(this.opts.tasks.map((t) => t.group).filter((g): g is string => !!g))];
  }

  protected legendItems(): LegendItem[] {
    return this.groups().map((g, i) => ({ name: g, color: this.color(i) }));
  }

  protected computeDomain() {
    const tasks = this.opts.tasks;
    const lo = Math.min(...tasks.map((t) => t.start));
    const hi = Math.max(...tasks.map((t) => t.end), this.opts.today ?? -Infinity);
    const pad = (hi - lo) * 0.03;
    this.yCategories = tasks.map((t) => t.name).reverse();
    this.full = { x0: lo - pad, x1: hi + pad, y0: -0.6, y1: tasks.length - 0.4 };
  }

  formatX(v: number) {
    return this.opts.xAxis?.type === 'linear' ? super.formatX(v) : new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }

  protected marks(b: MarkBuilder) {
    const tasks = this.opts.tasks;
    const n = tasks.length;
    const groups = this.groups();
    const row = new Map(tasks.map((t, i) => [t.name, n - 1 - i]));
    const [ux] = this.unitsPerPx();
    const surface = toColor(this.theme.surface);
    tasks.forEach((t, i) => {
      if (t.group && this.hidden.has(t.group)) return;
      const y = n - 1 - i;
      const color = t.group ? this.color(groups.indexOf(t.group)) : this.color(0);
      const p = Math.max(0, Math.min(1, t.progress ?? 1));
      const light = '#' + toColor(color).clone().lerp(surface, 0.55).getHexString();
      b.rect(t.start, y - 0.3, t.end, y + 0.3, light);
      if (p > 0) b.rect(t.start, y - 0.3, t.start + (t.end - t.start) * p, y + 0.3, color);
      for (const dep of t.dependsOn ?? []) {
        const dy = row.get(dep);
        const d = tasks.find((x) => x.name === dep);
        if (dy === undefined || !d) continue;
        // Elbow from the end of the dependency to the start of this task.
        const xm = d.end + 8 * ux;
        b.line([d.end, dy, xm, dy, xm, y, t.start - 6 * ux, y], this.theme.textMuted, 1.2);
        b.tri(t.start, y, t.start - 6 * ux, y + 0.12, t.start - 6 * ux, y - 0.12, this.theme.textMuted);
      }
      const days = (t.end - t.start) / 86_400_000;
      b.region({
        k: 'rect',
        x0: t.start,
        y0: y - 0.35,
        x1: t.end,
        y1: y + 0.35,
        hit: {
          series: t.name,
          index: i,
          color,
          title: t.name,
          values: {},
          rows: [
            { label: 'Start', value: this.formatXTip(t.start) },
            { label: 'End', value: this.formatXTip(t.end) },
            { label: 'Duration', value: `${formatNumber(days)} days` },
            ...(t.progress !== undefined ? [{ label: 'Complete', value: `${Math.round(p * 100)}%` }] : []),
            ...(t.dependsOn?.length ? [{ label: 'After', value: t.dependsOn.join(', ') }] : []),
          ],
        },
      });
    });
    if (this.opts.today !== undefined) {
      b.line([this.opts.today, -0.6, this.opts.today, n - 0.4], this.theme.textPrimary, 1.5, 0.8, false, true);
      b.text('Today', this.opts.today, n - 0.4, 0.5, -0.1, true);
    }
  }
}

// ---- Timeline ------------------------------------------------------------------------------

export class TimelineChart extends MarkChart<TimelineOptions> {
  readonly type = 'timeline' as const;
  protected relayout = true;
  protected showYTicks = false;
  private lanes = 1;

  private groups(): string[] {
    return [...new Set(this.opts.events.map((e) => e.group).filter((g): g is string => !!g))];
  }

  protected legendItems(): LegendItem[] {
    return this.groups().map((g, i) => ({ name: g, color: this.color(i) }));
  }

  protected computeDomain() {
    const ev = this.opts.events;
    const lo = Math.min(...ev.map((e) => e.start));
    const hi = Math.max(...ev.map((e) => e.end ?? e.start));
    const pad = (hi - lo) * 0.04 || 86_400_000;
    this.full = { x0: lo - pad, x1: hi + pad * 6, y0: 0, y1: Math.max(2, this.lanes + 0.8) };
  }

  protected marks(b: MarkBuilder) {
    const groups = this.groups();
    const [ux] = this.unitsPerPx();
    const ev = this.opts.events
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => !e.group || !this.hidden.has(e.group))
      .sort((a, c) => a.e.start - c.e.start);
    // Greedy lane packing: an event needs room for its span and its label.
    const laneEnd: number[] = [];
    const placed = ev.map(({ e, i }) => {
      const width = (e.label.length * 6.5 + 22) * ux;
      const end = Math.max(e.end ?? e.start, e.start + width);
      let lane = laneEnd.findIndex((x) => x < e.start);
      if (lane < 0) {
        lane = laneEnd.length;
        laneEnd.push(end);
      } else laneEnd[lane] = end;
      return { e, i, lane: lane + 1 };
    });
    if (laneEnd.length !== this.lanes) {
      // Lane count changed with the width: update the domain.
      this.lanes = laneEnd.length;
      this.full.y1 = this.view.y1 = Math.max(2, this.lanes + 0.8);
    }
    b.seg(this.full.x0, 0, this.full.x1, 0, this.theme.axis, 2);
    for (const { e, i, lane } of placed) {
      const color = e.group ? this.color(groups.indexOf(e.group)) : this.color(0);
      b.seg(e.start, 0, e.start, lane, this.theme.grid, 1);
      if (e.end !== undefined && e.end > e.start) {
        b.rect(e.start, lane - 0.18, e.end, lane + 0.18, color);
      } else {
        b.point(e.start, lane, color, 11);
      }
      b.text(e.label, e.start, lane, -0.06, 1.3, false);
      b.region({
        k: 'circle',
        x: e.start,
        y: lane,
        r: 8,
        hit: { series: e.label, index: i, color, title: e.label, values: { Date: this.formatXTip(e.start), ...(e.end !== undefined ? { Until: this.formatXTip(e.end) } : {}), ...(e.group ? { Group: e.group } : {}) } },
      });
    }
  }
}

// ---- Calendar heatmap --------------------------------------------------------------------

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class CalendarChart extends MarkChart<CalendarOptions> {
  readonly type = 'calendar' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  private max = 1;

  protected customLegend() {
    const el = document.createElement('div');
    el.className = 'tc-ramp';
    el.innerHTML = `<span>Less</span><i style="background:linear-gradient(90deg,${this.theme.sequential.slice(1).join(',')})"></i><span>More (${formatNumber(this.max)})</span>`;
    return el;
  }

  protected marks(b: MarkBuilder) {
    const { dates, values } = this.opts;
    const byDay = new Map<number, number>();
    let max = 0;
    for (let i = 0; i < dates.length; i++) {
      const d = new Date(dates[i]);
      const key = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
      const v = (byDay.get(key) ?? 0) + values[i];
      byDay.set(key, v);
      max = Math.max(max, v);
    }
    this.max = max || 1;
    const years = [...new Set([...byDay.keys()].map((k) => new Date(k).getUTCFullYear()))].sort();
    const W = this.plot.width;
    const H = this.plot.height;
    const left = 34;
    const blockGap = 18;
    const s = Math.max(4, Math.min((W - left) / 53, (H - years.length * blockGap) / (7 * years.length)));
    const gap = Math.max(1, s * 0.14);
    const ramp = this.theme.sequential.slice(1);
    // Center the year blocks vertically when the width limits the cell size.
    const used = years.length * (7 * s + blockGap);
    const offset = Math.max(0, (H - used) / 2);
    years.forEach((year, yi) => {
      const top = offset + yi * (7 * s + blockGap) + 14;
      const jan1 = Date.UTC(year, 0, 1);
      const firstDow = (new Date(jan1).getUTCDay() + 6) % 7; // Monday = 0
      b.text(String(year), 10, top + 3.5 * s, 0.5, 0.5, true, { rotate: -90 });
      ['Mon', '', 'Wed', '', 'Fri', '', ''].forEach((d, i) => d && s >= 9 && b.text(d, left - 4, top + i * s + s / 2, 1, 0.5, false, { size: 9 }));
      for (let t = jan1; new Date(t).getUTCFullYear() === year; t += DAY_MS) {
        const doy = Math.round((t - jan1) / DAY_MS);
        const week = Math.floor((doy + firstDow) / 7);
        const dow = (new Date(t).getUTCDay() + 6) % 7;
        const x0 = left + week * s + gap / 2;
        const y0 = top + dow * s + gap / 2;
        const v = byDay.get(t);
        const color = v === undefined ? this.theme.grid : '#' + sampleRamp(ramp, v / this.max).getHexString();
        b.rect(x0, y0, x0 + s - gap, y0 + s - gap, color);
        const date = new Date(t);
        if (date.getUTCDate() === 1) b.text(MONTHS[date.getUTCMonth()], x0, top - 3, 0, 1, false, { size: 10 });
        b.region({
          k: 'rect',
          x0,
          y0,
          x1: x0 + s - gap,
          y1: y0 + s - gap,
          hit: { series: 'day', index: doy, title: date.toLocaleDateString('en', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }), values: { Value: v === undefined ? 'No data' : formatNumber(v) } },
        });
      }
    });
  }
}
