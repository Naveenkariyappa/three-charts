import type { Hit, LegendItem } from '../base';
import { MarkChart, inkOn, textWidth, toColor, type MarkBuilder } from '../markchart';
import { formatNumber } from '../scale';
import { bezier } from '../stats';
import type { MindMapOptions, TreeDatum, WordCloudOptions, WordCloudWord } from '../types2';

const FONT_WEIGHT = 600;

// ---- Word cloud ----------------------------------------------------------------------------------

interface Placed {
  w: WordCloudWord;
  x: number;
  y: number;
  bw: number;
  bh: number;
  size: number;
  vertical: boolean;
}

/**
 * Words sized by value, placed on a spiral from the center (largest first).
 * If the big words don't fit, everything shrinks and the layout runs again.
 */
export class WordCloudChart extends MarkChart<WordCloudOptions> {
  readonly type = 'wordCloud' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 4;

  private groups() {
    const out: string[] = [];
    for (const w of this.opts.words) if (w.group && !out.includes(w.group)) out.push(w.group);
    return out;
  }

  protected legendItems(): LegendItem[] {
    return this.groups().map((g, i) => ({ name: g, color: this.color(i) }));
  }

  private arrange(words: WordCloudWord[], W: number, H: number): Placed[] {
    const lo = Math.min(...words.map((w) => w.value));
    const hi = Math.max(...words.map((w) => w.value));
    const [minF, maxF] = this.opts.fontSize ?? [11, Math.max(18, Math.min(72, Math.min(W, H) / 5))];
    const mixed = (this.opts.rotate ?? 'mixed') === 'mixed';
    let scale = 1;
    let best: Placed[] = [];
    for (let attempt = 0; attempt < 7; attempt++) {
      const placed: Placed[] = [];
      let missedBig = 0;
      words.forEach((w, i) => {
        const t = hi > lo ? (w.value - lo) / (hi - lo) : 1;
        const size = Math.max(9, (minF + (maxF - minF) * Math.sqrt(t)) * scale);
        const tw = textWidth(w.text, size, FONT_WEIGHT) + 4;
        const th = size * 1.05 + 2;
        // Every fourth word (never the first) turns vertical.
        const vertical = mixed && i > 0 && i % 4 === 2;
        const bw = vertical ? th : tw;
        const bh = vertical ? tw : th;
        const spot = this.findSpot(placed, bw, bh, W, H);
        if (spot) placed.push({ w, x: spot[0], y: spot[1], bw, bh, size, vertical });
        else if (i < Math.max(5, words.length * 0.3)) missedBig++;
      });
      best = placed;
      if (!missedBig) break;
      scale *= 0.85;
    }
    return best;
  }

  /** Archimedean spiral from the center, stretched to the box's aspect ratio. */
  private findSpot(placed: Placed[], bw: number, bh: number, W: number, H: number): [number, number] | null {
    const cx = W / 2;
    const cy = H / 2;
    const ratio = W / Math.max(1, H);
    const maxR = Math.hypot(W, H) / 2;
    for (let t = 0; ; t += 0.12) {
      const r = 2 * t;
      if (r > maxR) return null;
      const x = cx + r * Math.cos(t) * ratio;
      const y = cy + r * Math.sin(t);
      if (x - bw / 2 < 0 || x + bw / 2 > W || y - bh / 2 < 0 || y + bh / 2 > H) continue;
      let hit = false;
      for (const p of placed) {
        if (Math.abs(p.x - x) * 2 < p.bw + bw && Math.abs(p.y - y) * 2 < p.bh + bh) {
          hit = true;
          break;
        }
      }
      if (!hit) return [x, y];
    }
  }

  protected marks(b: MarkBuilder) {
    const groups = this.groups();
    const words = this.opts.words
      .filter((w) => !(w.group && this.hidden.has(w.group)) && w.value > 0)
      .sort((a, c) => c.value - a.value)
      .slice(0, this.opts.maxWords ?? 150);
    if (!words.length) return;
    const W = this.plot.width;
    const H = this.plot.height;
    const hi = words[0].value;
    const lo = words[words.length - 1].value;
    const accent = toColor(this.color(0));
    const quiet = toColor(this.theme.textSecondary);
    this.arrange(words, W, H).forEach((p, i) => {
      const t = hi > lo ? (p.w.value - lo) / (hi - lo) : 1;
      // Without groups, color only echoes size: big words in the accent, small ones fade to secondary text.
      const color = p.w.group ? this.color(groups.indexOf(p.w.group)) : '#' + quiet.clone().lerp(accent, 0.35 + 0.65 * t).getHexString();
      b.text(p.w.text, p.x, p.y, 0.5, 0.5, false, { size: Math.round(p.size), weight: FONT_WEIGHT, color, rotate: p.vertical ? -90 : 0 });
      b.region({
        k: 'rect',
        x0: p.x - p.bw / 2,
        y0: p.y - p.bh / 2,
        x1: p.x + p.bw / 2,
        y1: p.y + p.bh / 2,
        hit: {
          series: p.w.text,
          index: i,
          color,
          values: { Value: p.w.value },
          rows: [{ label: 'Value', value: formatNumber(p.w.value), color }, ...(p.w.group ? [{ label: 'Group', value: p.w.group }] : [])],
        },
      });
    });
  }
}

// ---- Mind map ---------------------------------------------------------------------------------------

interface MNode {
  d: TreeDatum;
  depth: number;
  side: 1 | -1;
  branch: number;
  x: number;
  y: number;
  w: number;
  parent: MNode | null;
  children: MNode[];
}

const leafCount = (d: TreeDatum): number => (d.children?.length ? d.children.reduce((s, c) => s + leafCount(c), 0) : 1);

/** A central topic with branches to both sides; each branch keeps one color. */
export class MindMapChart extends MarkChart<MindMapOptions> {
  readonly type = 'mindMap' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 6;

  private fontFor(depth: number) {
    return depth === 1 ? { size: 13, weight: 600 } : { size: 12, weight: 400 };
  }

  protected marks(b: MarkBuilder) {
    const W = this.plot.width;
    const H = this.plot.height;
    const root = this.opts.data;
    const kids = root.children ?? [];
    // Split branches between the sides so each holds about half the leaves.
    const total = kids.reduce((s, c) => s + leafCount(c), 0);
    let acc = 0;
    const right: TreeDatum[] = [];
    const left: TreeDatum[] = [];
    kids.forEach((c) => {
      if (acc < total / 2 || !right.length) {
        right.push(c);
        acc += leafCount(c);
      } else left.push(c);
    });

    const rootFont = 15;
    const rootW = textWidth(root.name, rootFont, 700) + 28;
    const rootH = 34;
    const cx = W / 2;
    const cy = H / 2;
    const nodes: MNode[] = [];

    const sideLayout = (list: TreeDatum[], side: 1 | -1) => {
      const make = (d: TreeDatum, depth: number, branch: number, parent: MNode | null): MNode => {
        const f = this.fontFor(depth);
        const n: MNode = { d, depth, side, branch, x: 0, y: 0, w: textWidth(d.name, f.size, f.weight), parent, children: [] };
        n.children = (d.children ?? []).map((c) => make(c, depth + 1, branch, n));
        nodes.push(n);
        return n;
      };
      const tops = list.map((d) => make(d, 1, kids.indexOf(d), null));
      // Column width per depth: widest label at that depth plus room for the curve.
      const widest: number[] = [];
      const walk = (n: MNode) => {
        widest[n.depth] = Math.max(widest[n.depth] ?? 0, n.w);
        n.children.forEach(walk);
      };
      tops.forEach(walk);
      const avail = W / 2 - rootW / 2 - 8;
      const need = widest.reduce((s, w) => s + (w ?? 0) + 36, 0);
      const k = need > avail ? avail / need : 1;
      const colX: number[] = [];
      let x = rootW / 2 + 36 * k;
      for (let d = 1; d < widest.length; d++) {
        colX[d] = x;
        x += ((widest[d] ?? 0) + 36) * k;
      }
      // Leaves evenly down the height; parents centered on their children.
      const leaves = tops.reduce((s, t) => s + leafCount(t.d), 0);
      const step = H / Math.max(1, leaves);
      let row = 0;
      const place = (n: MNode): number => {
        n.x = cx + side * colX[n.depth];
        n.w = Math.min(n.w, ((widest[n.depth] ?? 0) + 30) * k);
        if (!n.children.length) n.y = step * (row++ + 0.5);
        else n.y = n.children.map(place).reduce((s, v) => s + v, 0) / n.children.length;
        return n.y;
      };
      tops.forEach(place);
    };
    sideLayout(right, 1);
    sideLayout(left, -1);

    for (const n of nodes) {
      const color = n.d.color ?? (n.depth === 1 ? kids[n.branch]?.color : undefined) ?? this.color(n.branch);
      const f = this.fontFor(n.depth);
      const lw = n.depth === 1 ? 3 : n.depth === 2 ? 2 : 1.5;
      const under = n.y + f.size * 0.75;
      // Text sits on a colored underline; the curve joins the parent's underline end.
      const tx0 = n.side > 0 ? n.x : n.x - n.w;
      const tx1 = n.side > 0 ? n.x + n.w : n.x;
      b.line([tx0, under, tx1, under], color, lw);
      let px: number;
      let py: number;
      if (n.parent) {
        px = n.side > 0 ? n.parent.x + n.parent.w : n.parent.x - n.parent.w;
        py = n.parent.y + this.fontFor(n.parent.depth).size * 0.75;
      } else {
        px = cx + (n.side * rootW) / 2;
        py = cy;
      }
      const sx = n.side > 0 ? tx0 : tx1;
      const mx = (px + sx) / 2;
      b.line(bezier(px, py, mx, py, mx, under, sx, under, 20), color, lw);
      b.text(n.d.name, n.side > 0 ? tx0 : tx1, n.y, n.side > 0 ? 0 : 1, 0.5, n.depth === 1, {
        size: f.size,
        weight: f.weight,
        color: n.depth === 1 ? this.theme.textPrimary : this.theme.textSecondary,
        maxWidth: n.w + 2,
      });
      const count = (m: MNode): number => m.children.reduce((s, c) => s + 1 + count(c), 0);
      const pathOf = (m: MNode): string => (m.parent ? pathOf(m.parent) + ' › ' : this.opts.data.name + ' › ') + m.d.name;
      b.region({
        k: 'rect',
        x0: tx0 - 2,
        y0: n.y - f.size * 0.7,
        x1: tx1 + 2,
        y1: under + 3,
        hit: {
          series: n.d.name,
          index: nodes.indexOf(n),
          color,
          title: pathOf(n),
          values: { Depth: n.depth },
          rows: [
            { label: 'Branch', value: kids[n.branch]?.name ?? n.d.name, color },
            { label: 'Subtopics', value: String(count(n)) },
            ...(n.d.value !== undefined ? [{ label: 'Value', value: formatNumber(n.d.value) }] : []),
          ],
        },
      });
    }

    // Central topic.
    const fill = this.theme.textPrimary;
    b.box(cx - rootW / 2, cy - rootH / 2, cx + rootW / 2, cy + rootH / 2, fill, 1);
    b.text(root.name, cx, cy, 0.5, 0.5, true, { size: rootFont, weight: 700, color: inkOn(fill), maxWidth: rootW });
    b.region({
      k: 'rect',
      x0: cx - rootW / 2,
      y0: cy - rootH / 2,
      x1: cx + rootW / 2,
      y1: cy + rootH / 2,
      hit: { series: root.name, index: -1, values: {}, rows: [{ label: 'Branches', value: String(kids.length) }] } satisfies Hit,
    });
  }
}
