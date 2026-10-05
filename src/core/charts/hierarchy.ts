import type { Hit, LegendItem } from '../base';
import { descendants, hierarchy, leaves, pack, partition, tree, treemap, type HNode } from '../layouts';
import { MarkChart, inkOn, polar, toColor, type MarkBuilder } from '../markchart';
import { formatNumber } from '../scale';
import { sampleRamp } from '../theme';
import type { DendrogramOptions, HierarchyOptions, IcicleOptions, OrgChartOptions, OrgNode, PackOptions, SunburstOptions, TreemapOptions } from '../types2';

const TAU = Math.PI * 2;

function path(n: HNode): string {
  const names: string[] = [];
  for (let p: HNode | null = n; p && p.parent; p = p.parent) names.unshift(p.name);
  return names.join(' › ') || n.name;
}

/** Shared hierarchy plumbing: build the tree, color nodes, tooltip rows. */
abstract class HierarchyChart<O extends HierarchyOptions> extends MarkChart<O> {
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected top!: HNode;
  private maxLeaf = 1;

  protected legendItems(): LegendItem[] {
    if ((this.opts.colorBy ?? 'branch') !== 'branch') return [];
    return (this.opts.data.children ?? []).map((c, i) => ({ name: c.name, color: c.color ?? this.color(i) }));
  }

  protected prepare() {
    const data = this.opts.data;
    // Hidden legend entries drop their whole branch.
    const pruned = { ...data, children: (data.children ?? []).filter((c) => !this.hidden.has(c.name)) };
    this.top = hierarchy(pruned);
    // Keep each branch's color fixed when others are hidden.
    const original = (data.children ?? []).map((c) => c.name);
    for (const n of descendants(this.top)) {
      let top: HNode = n;
      while (top.parent && top.parent.parent) top = top.parent;
      n.branch = Math.max(0, original.indexOf(top.name));
    }
    this.maxLeaf = Math.max(...leaves(this.top).map((l) => l.value), 1e-9);
  }

  protected nodeColor(n: HNode, lighten = 0): string {
    if ((this.opts.colorBy ?? 'branch') === 'value') {
      return '#' + sampleRamp(this.theme.sequential, 0.15 + 0.85 * (n.value / this.maxLeaf)).getHexString();
    }
    let top: HNode = n;
    while (top.parent && top.parent.parent) top = top.parent;
    const base = top.data.color ?? this.color(n.branch);
    if (!lighten) return base;
    const c = toColor(base).clone().lerp(toColor(this.theme.surface), Math.min(0.6, lighten));
    return '#' + c.getHexString();
  }

  protected hit(n: HNode, i: number): Hit {
    const total = this.top.value || 1;
    const parent = n.parent?.value || total;
    return {
      series: n.name,
      index: i,
      title: path(n),
      values: { Value: n.value },
      rows: [
        { label: 'Value', value: formatNumber(n.value), color: this.nodeColor(n) },
        { label: 'Share of parent', value: `${((n.value / parent) * 100).toFixed(1)}%` },
        { label: 'Share of total', value: `${((n.value / total) * 100).toFixed(1)}%` },
        ...(n.children.length ? [{ label: 'Children', value: String(n.children.length) }] : []),
      ],
    };
  }
}

// ---- Treemap ----------------------------------------------------------------------------

export class TreemapChart extends HierarchyChart<TreemapOptions> {
  readonly type = 'treemap' as const;

  protected marks(b: MarkBuilder) {
    this.prepare();
    treemap(this.top, this.plot.width, this.plot.height, 2, 18);
    descendants(this.top).forEach((n, i) => {
      if (n.depth === 0) return;
      const w = n.x1 - n.x0;
      const h = n.y1 - n.y0;
      if (w < 0.5 || h < 0.5) return;
      if (n.children.length) {
        b.box(n.x0, n.y0, n.x1, n.y1, this.theme.grid, 1);
        if (w > 30) b.text(n.name, n.x0 + 4, n.y0 + 9, 0, 0.5, true, { maxWidth: w - 8, weight: 600 });
        b.region({ k: 'rect', x0: n.x0, y0: n.y0, x1: n.x1, y1: n.y0 + 18, hl: { k: 'rect', x0: n.x0, y0: n.y0, x1: n.x1, y1: n.y1 }, hit: this.hit(n, i) });
      } else {
        const color = this.nodeColor(n);
        b.rect(n.x0, n.y0, n.x1, n.y1, color);
        if (w > 36 && h > 20) {
          const ink = inkOn(color);
          b.text(n.name, n.x0 + 4, n.y0 + 4, 0, 0, false, { color: ink, maxWidth: w - 8 });
          if (h > 36) b.text(formatNumber(n.value), n.x0 + 4, n.y0 + 19, 0, 0, false, { color: ink, maxWidth: w - 8, size: 10 });
        }
        b.region({ k: 'rect', x0: n.x0, y0: n.y0, x1: n.x1, y1: n.y1, hit: this.hit(n, i) });
      }
    });
  }
}

// ---- Sunburst ----------------------------------------------------------------------------

export class SunburstChart extends HierarchyChart<SunburstOptions> {
  readonly type = 'sunburst' as const;

  protected marks(b: MarkBuilder) {
    this.prepare();
    const W = this.plot.width;
    const H = this.plot.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 4;
    partition(this.top, TAU, R);
    b.text(formatNumber(this.top.value), cx, cy, 0.5, 0.5, true, { size: 16, weight: 600 });
    descendants(this.top).forEach((n, i) => {
      if (n.depth === 0) return;
      const a0 = n.x0;
      const a1 = n.x1;
      if (a1 - a0 < 0.002) return;
      const color = this.nodeColor(n, (n.depth - 1) * 0.16);
      b.sector(cx, cy, n.y0 + 1, n.y1 - 1, a0, a1, color, 1, 2);
      const mid = (a0 + a1) / 2;
      const rr = (n.y0 + n.y1) / 2;
      const arcLen = (a1 - a0) * rr;
      if (arcLen > 44 && n.y1 - n.y0 > 14) {
        const [lx, ly] = polar(cx, cy, rr, mid);
        b.text(n.name, lx, ly, 0.5, 0.5, false, { color: inkOn(color), maxWidth: Math.min(arcLen, (n.y1 - n.y0) * 2.5) - 6, size: 10 });
      }
      b.region({ k: 'sector', cx, cy, r0: n.y0, r1: n.y1, a0, a1, hit: this.hit(n, i) });
    });
  }
}

// ---- Icicle -------------------------------------------------------------------------------

export class IcicleChart extends HierarchyChart<IcicleOptions> {
  readonly type = 'icicle' as const;

  protected marks(b: MarkBuilder) {
    this.prepare();
    const W = this.plot.width;
    const H = this.plot.height;
    partition(this.top, H, W);
    descendants(this.top).forEach((n, i) => {
      // Partition gives breadth in x0/x1, depth in y0/y1; draw depth left -> right.
      const x0 = n.y0 + 1;
      const x1 = n.y1 - 1;
      const y0 = n.x0 + 1;
      const y1 = n.x1 - 1;
      if (y1 - y0 < 0.5) return;
      const color = n.depth === 0 ? this.theme.textMuted : this.nodeColor(n, (n.depth - 1) * 0.16);
      b.rect(x0, y0, x1, y1, color);
      if (y1 - y0 > 15 && x1 - x0 > 40) {
        b.text(n.name, x0 + 5, y0 + 4, 0, 0, false, { color: inkOn(color), maxWidth: x1 - x0 - 10 });
        if (y1 - y0 > 32) b.text(formatNumber(n.value), x0 + 5, y0 + 19, 0, 0, false, { color: inkOn(color), maxWidth: x1 - x0 - 10, size: 10 });
      }
      b.region({ k: 'rect', x0, y0, x1, y1, hit: this.hit(n, i) });
    });
  }
}

// ---- Circle packing ------------------------------------------------------------------------

export class PackChart extends HierarchyChart<PackOptions> {
  readonly type = 'pack' as const;

  protected marks(b: MarkBuilder) {
    this.prepare();
    const W = this.plot.width;
    const H = this.plot.height;
    pack(this.top, W / 2, H / 2, Math.min(W, H) / 2 - 4, 3);
    descendants(this.top).forEach((n, i) => {
      if (n.r < 0.5) return;
      if (n.children.length) {
        b.sector(n.x, n.y, 0, n.r, 0, TAU, this.theme.grid, n.depth === 0 ? 0.35 : 0.6);
        b.arc(n.x, n.y, n.r, 0, TAU, this.theme.axis, 1);
        if (n.depth === 1 && n.r > 40) b.text(n.name, n.x, n.y - n.r + 10, 0.5, 0, true, { maxWidth: n.r * 1.4 });
      } else {
        const color = this.nodeColor(n);
        b.sector(n.x, n.y, 0, n.r, 0, TAU, color);
        if (n.r > 18) b.text(n.name, n.x, n.y, 0.5, 0.5, false, { color: inkOn(color), maxWidth: n.r * 1.8, size: n.r > 30 ? 11 : 10 });
      }
      if (n.depth > 0) b.region({ k: 'circle', x: n.x, y: n.y, r: n.r, hit: this.hit(n, i) });
    });
  }
}

// ---- Dendrogram ----------------------------------------------------------------------------

export class DendrogramChart extends HierarchyChart<DendrogramOptions> {
  readonly type = 'dendrogram' as const;

  protected marks(b: MarkBuilder) {
    this.prepare();
    const W = this.plot.width;
    const H = this.plot.height;
    const ls = leaves(this.top);
    const labelW = Math.min(140, W * 0.25, 10 + Math.max(...ls.map((l) => l.name.length)) * 6.5);
    tree(this.top, H, W - labelW - 16, true);
    const X = (n: HNode) => 8 + n.y;
    const Y = (n: HNode) => n.x;
    descendants(this.top).forEach((n, i) => {
      for (const c of n.children) {
        b.line([X(n), Y(n), X(n), Y(c), X(c), Y(c)], this.theme.textMuted, 1.5);
      }
      const color = n.depth === 0 ? this.theme.textSecondary : this.nodeColor(n);
      b.point(X(n), Y(n), color, n.children.length ? 7 : 8);
      if (!n.children.length && H / ls.length >= 11) b.text(n.name, X(n) + 8, Y(n), 0, 0.5, false, { maxWidth: labelW });
      b.region({ k: 'circle', x: X(n), y: Y(n), r: 7, hit: { ...this.hit(n, i), rows: [...(this.hit(n, i).rows ?? []), { label: 'Leaves', value: String(leaves(n).length) }] } });
    });
  }
}

// ---- Org chart --------------------------------------------------------------------------------

export class OrgChart extends MarkChart<OrgChartOptions> {
  readonly type = 'orgChart' as const;
  protected space: 'data' | 'pixel' = 'pixel';
  protected showAxes = false;
  protected plotPad = 4;

  protected marks(b: MarkBuilder) {
    const root = hierarchy(this.opts.data, false);
    const W = this.plot.width;
    const H = this.plot.height;
    const ls = leaves(root);
    const step = W / Math.max(1, ls.length);
    // A box may use the width its subtree spans: managers get room even when leaves are tight.
    const widthOf = (n: HNode) => Math.max(60, Math.min(170, leaves(n).length * step - 10));
    const bh = 42;
    tree(root, W, Math.max(0, H - bh), false);
    const all = descendants(root);
    for (const n of all) {
      for (const c of n.children) {
        const midY = n.y + bh + (c.y - n.y - bh) / 2;
        b.line([n.x, n.y + bh, n.x, midY, c.x, midY, c.x, c.y], this.theme.axis, 1.5);
      }
    }
    all.forEach((n, i) => {
      const bw = widthOf(n);
      const x0 = n.x - bw / 2;
      const x1 = n.x + bw / 2;
      const y0 = n.y;
      const y1 = n.y + bh;
      const accent = this.color(n.depth === 0 ? 0 : n.branch);
      b.box(x0, y0, x1, y1, this.theme.surface, 1);
      b.box(x0, y0, x0 + 4, y1, accent, 1);
      b.line([x0, y0, x1, y0, x1, y1, x0, y1], this.theme.axis, 1, 1, true);
      const d = n.data as OrgNode;
      b.text(n.name, x0 + 10, y0 + 7, 0, 0, true, { maxWidth: bw - 14, weight: 600, color: this.theme.textPrimary });
      if (d.title) b.text(d.title, x0 + 10, y0 + 23, 0, 0, false, { maxWidth: bw - 14, size: 10 });
      b.region({
        k: 'rect',
        x0,
        y0,
        x1,
        y1,
        hit: {
          series: n.name,
          index: i,
          title: n.name,
          values: { Title: d.title ?? '' },
          rows: [
            ...(d.title ? [{ label: 'Role', value: d.title }] : []),
            ...(n.parent ? [{ label: 'Reports to', value: n.parent.name }] : []),
            { label: 'Direct reports', value: String(n.children.length) },
            { label: 'Team size', value: String(descendants(n).length - 1) },
          ],
        },
      });
    });
  }
}
