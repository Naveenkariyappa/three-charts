import * as THREE from 'three';
import { getEngine, shared, type EngineClient } from './engine';
import { customTheme, seriesColor, type Theme } from './theme';
import { escapeHtml } from './scale';
import type { Chart, CommonOptions, DownloadOptions, HitInfo, LegendOptions } from './types';

/** Internal hit result: public HitInfo plus what the tooltip needs. */
export interface Hit extends HitInfo {
  title?: string;
  color?: string;
  rows?: { label: string; value: string; color?: string }[];
}

export interface LegendItem {
  name: string;
  color: string;
}

const CSS = `
.tc-root{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;box-sizing:border-box;
  font:12px/1.4 var(--tc-font);color:var(--tc-text);user-select:none;-webkit-user-select:none}
.tc-title{font-size:var(--tc-title-size);font-weight:600;padding:2px 4px 6px;color:var(--tc-text)}
.tc-body{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
.tc-body.tc-side{flex-direction:row}
.tc-title:empty{display:none}
.tc-stage{position:relative;flex:1;min-width:0;min-height:0;overflow:hidden;touch-action:none}
.tc-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.tc-overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.tc-label{position:absolute;white-space:nowrap;font-size:var(--tc-font-size);color:var(--tc-muted);font-variant-numeric:tabular-nums}
.tc-label.tc-strong{color:var(--tc-text2)}
.tc-label.tc-clip{overflow:hidden;text-overflow:ellipsis}
.tc-hl{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.tc-tooltip{position:absolute;z-index:2;pointer-events:none;display:none;min-width:90px;max-width:260px;padding:8px 10px;border-radius:8px;
  background:var(--tc-tip-bg);border:1px solid var(--tc-border);box-shadow:0 4px 16px rgba(0,0,0,.12);color:var(--tc-text)}
.tc-tooltip b{display:block;font-weight:600;margin-bottom:4px}
.tc-row{display:flex;align-items:center;gap:6px;color:var(--tc-text2)}
.tc-row span:last-child{margin-left:auto;padding-left:12px;color:var(--tc-text);font-variant-numeric:tabular-nums}
.tc-sw{width:8px;height:8px;border-radius:2px;flex:none}
.tc-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 14px;padding:6px 4px 0}
.tc-legend:empty{display:none}
.tc-legend.tc-top{order:-1;padding:0 4px 6px}
.tc-legend.tc-left,.tc-legend.tc-right{flex-direction:column;flex-wrap:nowrap;align-items:flex-start;gap:4px;max-width:40%;overflow:auto;padding:0 0 0 12px}
.tc-legend.tc-left{order:-1;padding:0 12px 0 0}
.tc-legend.tc-start{justify-content:flex-start}
.tc-legend.tc-end{justify-content:flex-end}
.tc-legend .tc-sw.tc-circle{border-radius:50%}
.tc-legend .tc-sw.tc-line{width:14px;height:3px;border-radius:2px}
.tc-ramp{display:flex;align-items:center;gap:8px;color:var(--tc-muted);font-size:11px;font-variant-numeric:tabular-nums}
.tc-ramp i{display:block;width:160px;height:8px;border-radius:2px}
.tc-legend button,.tc-legend .tc-key{all:unset;display:flex;align-items:center;gap:6px;color:var(--tc-text2);padding:2px 0;white-space:nowrap}
.tc-legend button{cursor:pointer}
.tc-legend button:hover{color:var(--tc-text)}
.tc-legend button:focus-visible{outline:2px solid var(--tc-text2);outline-offset:2px;border-radius:2px}
.tc-legend button.tc-off{opacity:.4;text-decoration:line-through}
.tc-crosshair{position:absolute;top:0;width:1px;background:var(--tc-axis);display:none}
.tc-dot{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid var(--tc-surface);box-sizing:border-box;display:none}
.tc-hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;pointer-events:none;padding:6px 10px;border-radius:6px;
  background:var(--tc-tip-bg);border:1px solid var(--tc-border);color:var(--tc-text2);font-size:12px;opacity:0;transition:opacity .2s}
.tc-hint.tc-show{opacity:1}
.tc-dl{position:absolute;top:6px;right:6px;z-index:3;display:grid;place-items:center;width:28px;height:28px;padding:0;border-radius:6px;
  border:1px solid var(--tc-border);background:var(--tc-tip-bg);color:var(--tc-text2);cursor:pointer;opacity:0;transition:opacity .15s}
.tc-stage:hover .tc-dl,.tc-dl:focus-visible,.tc-dl[aria-expanded=true]{opacity:1}
.tc-dl:hover{color:var(--tc-text)}
.tc-dl:focus-visible{outline:2px solid var(--tc-text2);outline-offset:1px}
@media (hover:none){.tc-dl{opacity:.85}}
.tc-menu{position:absolute;top:38px;right:6px;z-index:4;display:none;min-width:150px;padding:4px;border-radius:8px;background:var(--tc-tip-bg);
  border:1px solid var(--tc-border);box-shadow:0 4px 16px rgba(0,0,0,.14)}
.tc-menu.tc-open{display:block}
.tc-menu button{all:unset;display:block;box-sizing:border-box;width:100%;padding:6px 10px;border-radius:5px;color:var(--tc-text);cursor:pointer;white-space:nowrap}
.tc-menu button:hover,.tc-menu button:focus-visible{background:var(--tc-border)}
.tc-menu button span{color:var(--tc-muted);margin-left:6px}
.tc-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none}
.tc-center .tc-big{font-size:22px;font-weight:600;color:var(--tc-text)}
.tc-center .tc-small{font-size:12px;color:var(--tc-text2)}
`;

function injectStyles() {
  const s0 = shared();
  if (s0.styles) return;
  s0.styles = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export interface LabelStyle {
  color?: string;
  size?: number;
  weight?: number;
  /** Clip with an ellipsis beyond this width (CSS px). */
  maxWidth?: number;
  rotate?: number;
}

/** Reusable absolutely-positioned HTML labels. Cheaper than text in WebGL and always crisp. */
export class LabelPool {
  private els: HTMLDivElement[] = [];
  private n = 0;
  private parent: HTMLElement;
  constructor(parent: HTMLElement) {
    this.parent = parent;
  }
  begin() {
    this.n = 0;
  }
  /** ax/ay: anchor as a fraction of the label size (0.5,0.5 = centered). */
  add(text: string, x: number, y: number, ax = 0.5, ay = 0.5, strong = false, style?: LabelStyle) {
    let el = this.els[this.n];
    if (!el) {
      el = document.createElement('div');
      el.className = 'tc-label';
      this.parent.appendChild(el);
      this.els.push(el);
    }
    this.n++;
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('tc-strong', strong);
    el.style.display = '';
    el.style.color = style?.color ?? '';
    el.style.fontSize = style?.size ? style.size + 'px' : '';
    el.style.fontWeight = style?.weight ? String(style.weight) : '';
    el.style.maxWidth = style?.maxWidth !== undefined ? Math.max(0, style.maxWidth) + 'px' : '';
    el.classList.toggle('tc-clip', style?.maxWidth !== undefined);
    el.style.transform = `translate(${x}px,${y}px) translate(${-ax * 100}%,${-ay * 100}%)` + (style?.rotate ? ` rotate(${style.rotate}deg)` : '');
    // Rotate about the anchor, so a label pivots on the point it's attached to.
    el.style.transformOrigin = style?.rotate ? `${ax * 100}% ${ay * 100}%` : '';
  }
  end() {
    for (let i = this.n; i < this.els.length; i++) this.els[i].style.display = 'none';
  }
}

function downloadOptions(d: boolean | DownloadOptions | undefined): DownloadOptions {
  return typeof d === 'object' ? d : {};
}

/** Columns and rows for CSV export. */
export interface Table {
  columns: string[];
  rows: (string | number)[][];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart';

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: string | number): string {
  const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Product of the element's and its ancestors' opacity (dimmed legend items stay dimmed in the image). */
function opacityOf(el: Element, stop: Element): number {
  let o = 1;
  for (let e: Element | null = el; e && e !== stop; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity) || 1;
  return o;
}

/** `text`, cut with an ellipsis to fit `max` px. */
function fitText(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

type Rec = Record<string, unknown>;
const isNums = (a: unknown): a is ArrayLike<number> =>
  !!a && typeof a === 'object' && typeof (a as ArrayLike<unknown>).length === 'number' && ((a as ArrayLike<unknown>).length === 0 || typeof (a as ArrayLike<unknown>)[0] === 'number');
const isStrs = (a: unknown): a is string[] => Array.isArray(a) && a.length > 0 && typeof a[0] === 'string';
const isRecs = (a: unknown): a is Rec[] => Array.isArray(a) && a.length > 0 && typeof a[0] === 'object' && a[0] !== null && !Array.isArray(a[0]);
const cell = (v: unknown): string | number => (typeof v === 'number' ? v : typeof v === 'string' ? v : typeof v === 'boolean' ? String(v) : '');

/**
 * Read a chart's data out of its options as a table. Covers the shapes the options use: categories × series,
 * x/y series, parallel number arrays (OHLC), matrices, records, trees and key → value maps.
 */
export function tabulate(o: Rec): Table | null {
  // Meshes are geometry, not a table.
  if (isNums(o.indices)) return null;
  const time = (o.xAxis as Rec | undefined)?.type === 'time';
  const fmtX = (v: number) => (time || v > 1e11 ? new Date(v).toISOString() : v);
  // Epoch-ms fields read as dates in a spreadsheet; anything this large in a time-named field is a timestamp.
  const dated = (k: string, v: unknown) => (typeof v === 'number' && v > 1e11 && /^(x|start|end|date|dates|time)$/.test(k) ? new Date(v).toISOString() : cell(v));
  const cats = (isStrs(o.categories) && o.categories) || (isStrs(o.axes) && o.axes) || (isStrs(o.labels) && o.labels) || null;
  const hasNums = (r: Rec) => Object.values(r).some(isNums);
  // A list of named series, under any of the names the options use, or named objects at the top level (a / b, left / right).
  const listKey = ['series', 'groups', 'bands', 'levels', 'dimensions'].find((k) => isRecs(o[k]) && (o[k] as Rec[]).some(hasNums));
  const named = Object.values(o).filter((v): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as Rec).name === 'string' && hasNums(v as Rec));
  const series = listKey ? (o[listKey] as Rec[]) : named.length > 1 ? named : null;
  const valuesOf = (s: Rec) => (s.data ?? s.values ?? s.y) as ArrayLike<number> | undefined;
  const names = (list: Rec[]) => list.map((s) => String(s.name ?? ''));

  if (series) {
    const vals = series.map(valuesOf);
    const n = vals[0]?.length ?? 0;
    const same = vals.every((v) => isNums(v) && v.length === n) && series.every((s) => !isNums(s.x));
    // Wide: one row per category (bars, levels, pyramid), per point of a shared x, or per record (dimensions).
    const lead: [string, (i: number) => string | number] | null =
      cats && cats.length === n ? [o.axes ? 'axis' : 'category', (i) => cats[i]] : isNums(o.x) && o.x.length === n ? ['x', (i) => fmtX((o.x as ArrayLike<number>)[i])] : listKey === 'dimensions' ? ['row', (i) => i + 1] : null;
    if (same && lead) {
      return { columns: [lead[0], ...names(series)], rows: Array.from({ length: n }, (_, i) => [lead[1](i), ...vals.map((v) => cell(v![i]))]) };
    }
    // Long: one row per point, with every per-point field the series carry.
    const keys: string[] = [];
    for (const s of series) for (const k in s) if (!keys.includes(k) && (isNums(s[k]) || (isStrs(s[k]) && k !== 'name'))) keys.push(k);
    const rows: (string | number)[][] = [];
    for (const s of series) {
      const len = Math.max(0, ...keys.map((k) => (s[k] as ArrayLike<unknown> | undefined)?.length ?? 0));
      for (let i = 0; i < len; i++) {
        rows.push([
          String(s.name ?? ''),
          ...keys.map((k) => {
            const v = (s[k] as ArrayLike<unknown> | undefined)?.[i];
            return k === 'x' && typeof v === 'number' ? fmtX(v) : dated(k, v);
          }),
        ]);
      }
    }
    if (keys.length) return { columns: ['series', ...keys], rows };
  }

  // Matrices: row, column, value.
  const grid = (data: ArrayLike<number>, rowNames: (string | number)[], colNames: (string | number)[]): Table => {
    const rows: (string | number)[][] = [];
    for (let r = 0; r < rowNames.length; r++) for (let c = 0; c < colNames.length; c++) rows.push([rowNames[r], colNames[c], cell(data[r * colNames.length + c])]);
    return { columns: ['row', 'column', 'value'], rows };
  };
  const idx = (n: number) => Array.from({ length: n }, (_, i) => i);
  if (isNums(o.data) && typeof o.rows === 'number' && typeof o.cols === 'number') {
    const yl = (o.yLabels as string[] | undefined) ?? [];
    const xl = (o.xLabels as string[] | undefined) ?? [];
    return grid(o.data, idx(o.rows).map((r) => yl[r] ?? r), idx(o.cols).map((c) => xl[c] ?? c));
  }
  if (isNums(o.data) && isStrs(o.rings) && isStrs(o.angles) && o.data.length === o.rings.length * o.angles.length) return grid(o.data, o.rings, o.angles);
  if (Array.isArray(o.matrix) && Array.isArray(o.matrix[0])) {
    const m = o.matrix as number[][];
    const labels = (cats ?? (o.names as string[] | undefined) ?? (o.classes as string[] | undefined) ?? []) as string[];
    return { columns: ['', ...m[0].map((_, j) => labels[j] ?? String(j))], rows: m.map((row, i) => [labels[i] ?? String(i), ...row]) };
  }

  // Parallel number arrays at the top level (open / high / low / close, values…).
  const arrays = Object.keys(o).filter((k) => isNums(o[k]) && (o[k] as ArrayLike<number>).length > 1);
  if (arrays.length) {
    const n = Math.max(...arrays.map((k) => (o[k] as ArrayLike<number>).length));
    const cols = arrays.filter((k) => (o[k] as ArrayLike<number>).length === n);
    const lab = cats && cats.length === n ? cats : null;
    return {
      columns: [...(lab ? ['label'] : []), ...cols],
      rows: Array.from({ length: n }, (_, i) => [...(lab ? [lab[i]] : []), ...cols.map((k) => (k === 'x' ? fmtX((o[k] as ArrayLike<number>)[i]) : dated(k, (o[k] as ArrayLike<number>)[i])))]),
    };
  }

  // Records: the first array of objects among the usual names. Nested objects become a.b columns,
  // string lists are joined (or spread over `dimensions`, as in alluvial rows).
  const dims = isStrs(o.dimensions) ? o.dimensions : null;
  for (const k of ['data', 'items', 'tasks', 'events', 'words', 'points', 'flows', 'links', 'nodes', 'bids', 'rows', 'rings', 'tiles']) {
    const list = o[k];
    if (!isRecs(list)) continue;
    const flat = list.map((r) => {
      const out: Record<string, string | number> = {};
      for (const [c, v] of Object.entries(r)) {
        if (c === 'color' || typeof v === 'function') continue;
        if (isStrs(v)) {
          if (dims && c === 'values' && v.length === dims.length) v.forEach((x, i) => (out[dims[i]] = x));
          else out[c] = v.join(' & ');
        } else if (v && typeof v === 'object' && !Array.isArray(v) && !isNums(v)) {
          for (const [c2, v2] of Object.entries(v as Rec)) if (typeof v2 !== 'object') out[`${c}.${c2}`] = cell(v2);
        } else if (isNums(v) && v.length <= 3) out[c] = Array.from(v).join(' ');
        else if (typeof v !== 'object' || v === null) out[c] = dated(c, v);
      }
      return out;
    });
    const cols: string[] = [];
    for (const r of flat) for (const c in r) if (!cols.includes(c)) cols.push(c);
    if (cols.length) return { columns: cols, rows: flat.map((r) => cols.map((c) => r[c] ?? '')) };
  }

  // Tree: one row per node, with its path.
  const tree = (o.data ?? o.root) as Rec | undefined;
  if (tree && typeof tree === 'object' && Array.isArray(tree.children)) {
    const rows: (string | number)[][] = [];
    const walk = (n: Rec, path: string[]) => {
      const p = [...path, String(n.name ?? n.label ?? '')];
      rows.push([p.join(' / '), p.length - 1, cell(n.value)]);
      for (const c of (n.children as Rec[] | undefined) ?? []) walk(c, p);
    };
    walk(tree, []);
    return { columns: ['path', 'depth', 'value'], rows };
  }

  // Key → value maps, optionally one level deep (key → { a: 1, b: 2 }).
  const map = o.values;
  if (map && typeof map === 'object' && !Array.isArray(map) && !isNums(map)) {
    const entries = Object.entries(map as Rec);
    const sub: string[] = [];
    for (const [, v] of entries) if (v && typeof v === 'object') for (const c in v as Rec) if (!sub.includes(c)) sub.push(c);
    if (sub.length) return { columns: ['key', ...sub], rows: entries.map(([k, v]) => [k, ...sub.map((c) => (typeof v === 'object' && v ? cell((v as Rec)[c]) : c === sub[0] ? cell(v) : ''))]) };
    const rows = entries.filter(([, v]) => typeof v === 'number' || typeof v === 'string').map(([k, v]) => [k, cell(v)]);
    if (rows.length) return { columns: ['key', 'value'], rows };
  }
  if (typeof o.value === 'number') return { columns: ['label', 'value'], rows: [[String(o.label ?? o.title ?? ''), o.value]] };
  return null;
}

/** `legend` accepts a boolean shorthand; normalize it. */
export function legendOptions(legend: boolean | LegendOptions | undefined): LegendOptions {
  if (legend === undefined) return {};
  return typeof legend === 'boolean' ? { show: legend } : legend;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export abstract class BaseChart<O extends CommonOptions = CommonOptions> implements EngineClient, Chart<O> {
  abstract readonly type: string;

  readonly root: HTMLDivElement;
  readonly stage: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly overlay: HTMLDivElement;
  readonly labels: LabelPool;
  private titleEl: HTMLDivElement;
  private bodyEl: HTMLDivElement;
  private legendEl: HTMLDivElement;
  private tooltipEl: HTMLDivElement;

  /** CSS pixels. */
  width = 0;
  height = 0;
  dpr = 1;
  pixelWidth = 0;
  pixelHeight = 0;
  dirty = false;
  inView = true;

  opts: O;
  theme: Theme;
  scene = new THREE.Scene();
  /** Series names toggled off in the legend. */
  hidden = new Set<string>();
  /** False when the legend is a key (e.g. Increase / Decrease) rather than a list of series that can be hidden. */
  protected legendToggles = true;

  /** Entry animation progress, 0 -> 1 (eased). */
  protected progress = 1;
  private animStart = -1;
  protected animDuration = 700;
  protected built = false;
  protected dragging = false;
  private destroyed = false;
  private pointer: { x: number; y: number } | null = null;
  private pointerRaf = 0;
  private lastHit: Hit | null = null;
  /** Wheel-zoom is armed by clicking into the chart, so page scrolling never gets trapped. */
  protected wheelArmed = false;
  private hintEl: HTMLDivElement;
  private dlBtn: HTMLButtonElement;
  private menuEl: HTMLDivElement;
  private hintTimer = 0;
  private releaseTimer = 0;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private mq: MediaQueryList;
  private mo: MutationObserver;

  constructor(container: HTMLElement, options: O) {
    injectStyles();
    this.opts = options;
    this.theme = customTheme(options.theme, options);
    this.hidden = new Set(legendOptions(options.legend).hidden);

    this.root = document.createElement('div');
    this.root.className = 'tc-root';
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'tc-title';
    this.stage = document.createElement('div');
    this.stage.className = 'tc-stage';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tc-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.overlay = document.createElement('div');
    this.overlay.className = 'tc-overlay';
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'tc-tooltip';
    this.legendEl = document.createElement('div');
    this.legendEl.className = 'tc-legend';
    this.hintEl = document.createElement('div');
    this.hintEl.className = 'tc-hint';
    this.hintEl.textContent = 'Click the chart (or hold Ctrl/⌘) to zoom with the wheel';
    this.dlBtn = document.createElement('button');
    this.dlBtn.type = 'button';
    this.dlBtn.className = 'tc-dl';
    this.dlBtn.setAttribute('aria-label', 'Download chart');
    this.dlBtn.setAttribute('aria-haspopup', 'menu');
    this.dlBtn.setAttribute('aria-expanded', 'false');
    this.dlBtn.title = 'Download';
    this.dlBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5v7.5M3.8 6 7 9.2 10.2 6M2 12.5h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    this.dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'tc-menu';
    this.menuEl.setAttribute('role', 'menu');
    this.menuEl.addEventListener('click', (e) => e.stopPropagation());
    this.stage.append(this.canvas, this.overlay, this.tooltipEl, this.hintEl, this.dlBtn, this.menuEl);
    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'tc-body';
    this.bodyEl.append(this.stage, this.legendEl);
    this.root.append(this.titleEl, this.bodyEl);
    container.appendChild(this.root);
    this.labels = new LabelPool(this.overlay);

    this.stage.addEventListener('pointermove', this.onPointerMove);
    this.stage.addEventListener('pointerleave', this.onPointerLeave);
    this.stage.addEventListener('click', this.onClick);
    this.stage.addEventListener('pointerdown', () => (this.wheelArmed = true), { capture: true });

    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this.stage);
    // "In view" starts a little before the chart scrolls on screen, so it is painted on arrival.
    this.io = new IntersectionObserver(
      (entries) => {
        const visible = entries[entries.length - 1].isIntersecting;
        if (visible && !this.inView) {
          this.inView = true;
          this.invalidate();
        } else if (!visible && this.inView) {
          this.inView = false;
          // Free the pixel buffer of off-screen charts: pages with dozens of charts would
          // otherwise hold every canvas in GPU memory. It is repainted on the way back in.
          this.canvas.width = 0;
          this.canvas.height = 0;
          this.dirty = true;
          // After a moment off screen, release GPU buffers too (CPU copies stay; three.js
          // re-uploads them on the next render).
          clearTimeout(this.releaseTimer);
          this.releaseTimer = window.setTimeout(() => !this.inView && this.releaseGPU(), 1500);
        }
      },
      { rootMargin: '300px 0px' },
    );
    this.io.observe(this.stage);

    this.mq = matchMedia('(prefers-color-scheme: dark)');
    this.mq.addEventListener('change', this.onSchemeChange);
    this.mo = new MutationObserver(this.onSchemeChange);
    this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    getEngine().add(this);
    // Build after subclass field initializers have run.
    queueMicrotask(() => {
      if (this.destroyed) return;
      if (this.opts.animate !== false) this.progress = 0;
      this.rebuild();
    });
  }

  // ---- subclass hooks -------------------------------------------------------

  /** Create scene content from `this.opts`. The scene is empty when this runs. */
  protected abstract build(): void;
  /** Size changed (also called once after build). */
  protected abstract layout(): void;
  /** Render the scene(s). Viewport is the full chart; override to restrict. */
  abstract draw(renderer: THREE.WebGLRenderer): void;
  /** Find the mark under (x, y) in CSS px relative to the stage. */
  protected hitTest(_x: number, _y: number): Hit | null {
    return null;
  }
  /** Show hover state for `hit` (or clear it). Call invalidate() if WebGL output changes. */
  protected highlight(_hit: Hit | null): void {}
  protected legendItems(): LegendItem[] {
    return [];
  }
  /** Non-series legend content (e.g. a color ramp). */
  protected customLegend(): HTMLElement | null {
    return null;
  }
  /** Called when the entry animation advances. */
  protected onProgress(): void {}
  /** Return true to keep animating (e.g. camera damping). */
  protected onTick(_now: number): boolean {
    return false;
  }
  afterDraw?(): void;

  // ---- public API -----------------------------------------------------------

  update(options: Partial<O>) {
    const prev = legendOptions(this.opts.legend).hidden;
    this.opts = { ...this.opts, ...options };
    const next = legendOptions(this.opts.legend).hidden;
    if (JSON.stringify(next) !== JSON.stringify(prev)) this.hidden = new Set(next);
    if (this.built) this.rebuild();
  }

  toggleSeries(name: string, visible = this.hidden.has(name)) {
    if (visible === !this.hidden.has(name)) return;
    if (visible) this.hidden.delete(name);
    else this.hidden.add(name);
    if (this.built) this.rebuild();
  }

  hiddenSeries(): string[] {
    return [...this.hidden];
  }

  resize() {
    this.measure();
  }

  resetView() {}

  toPNG(): string {
    return this.snapshot().toDataURL('image/png');
  }

  toCSV(): string | null {
    const t = this.table();
    if (!t || !t.rows.length) return null;
    return [t.columns, ...t.rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  }

  download(format: 'png' | 'csv' = 'png', filename?: string) {
    const name = filename ?? downloadOptions(this.opts.download).filename ?? slug(this.opts.title || this.type);
    if (format === 'csv') {
      const text = this.toCSV();
      // The byte-order mark makes Excel read the file as UTF-8.
      if (text) saveFile(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
      return;
    }
    this.snapshot().toBlob((b) => b && saveFile(b, `${name}.png`), 'image/png');
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.closeMenu();
    getEngine().remove(this);
    this.ro.disconnect();
    this.io.disconnect();
    this.mo.disconnect();
    this.mq.removeEventListener('change', this.onSchemeChange);
    cancelAnimationFrame(this.pointerRaf);
    clearTimeout(this.releaseTimer);
    this.disposeScene(this.scene);
    this.root.remove();
  }

  // ---- engine client --------------------------------------------------------

  tick(now: number): boolean {
    if (!this.built) return false;
    let animating = false;
    if (this.progress < 1) {
      if (this.animStart < 0) this.animStart = now;
      const t = Math.min(1, (now - this.animStart) / this.animDuration);
      this.progress = t >= 1 ? 1 : ease(t);
      this.onProgress();
      this.dirty = true;
      animating = this.progress < 1;
    }
    if (this.onTick(now)) {
      this.dirty = true;
      animating = true;
    }
    return animating;
  }

  // ---- helpers for subclasses -----------------------------------------------

  invalidate() {
    if (!this.built) return;
    this.dirty = true;
    getEngine().request();
  }

  protected color(i: number, custom?: string): string {
    return custom ?? seriesColor(this.theme, i, this.opts.colors);
  }

  protected rebuild() {
    if (this.destroyed) return;
    this.theme = customTheme(this.opts.theme, this.opts);
    this.applyCssVars();
    this.titleEl.textContent = this.opts.title ?? '';
    this.dlBtn.style.display = this.opts.download === false ? 'none' : '';
    this.closeMenu();
    this.root.style.background = this.opts.background ?? 'transparent';
    this.disposeScene(this.scene);
    this.scene = new THREE.Scene();
    this.lastHit = null;
    this.hideTooltip();
    this.measureNow();
    this.build();
    this.renderLegend();
    this.measureNow(); // legend may have changed the stage height
    this.layout();
    this.built = true;
    this.onProgress();
    this.invalidate();
  }

  /** Scenes whose GPU resources can be released while the chart is off screen. */
  protected gpuScenes(): THREE.Object3D[] {
    return [this.scene];
  }

  /** Drop GPU copies of geometry and textures; they re-upload automatically when drawn again. */
  protected releaseGPU() {
    for (const root of this.gpuScenes()) {
      root.traverse((o) => {
        (o as THREE.Mesh).geometry?.dispose();
        const mats = (o as THREE.Mesh).material;
        for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
          const u = (m as THREE.ShaderMaterial).uniforms;
          if (u) for (const k in u) if (u[k].value instanceof THREE.Texture) u[k].value.dispose();
          const map = (m as THREE.MeshStandardMaterial).map;
          if (map) map.dispose();
        }
      });
    }
  }

  protected disposeScene(scene: THREE.Object3D) {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        const u = (mat as THREE.ShaderMaterial).uniforms;
        if (u) for (const k in u) if (u[k].value instanceof THREE.Texture) u[k].value.dispose();
        mat.dispose();
      }
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    });
  }

  private applyCssVars() {
    const t = this.theme;
    const s = this.root.style;
    s.setProperty('--tc-text', t.textPrimary);
    s.setProperty('--tc-text2', t.textSecondary);
    s.setProperty('--tc-muted', t.textMuted);
    s.setProperty('--tc-axis', t.axis);
    s.setProperty('--tc-border', t.border);
    s.setProperty('--tc-surface', t.surface);
    s.setProperty('--tc-tip-bg', t.tooltipBg);
    s.setProperty('--tc-font', t.font);
    s.setProperty('--tc-font-size', t.fontSize + 'px');
    s.setProperty('--tc-title-size', (this.opts.appearance?.titleSize ?? 13) + 'px');
  }

  private measureNow(): boolean {
    const r = this.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const changed = r.width !== this.width || r.height !== this.height || dpr !== this.dpr;
    this.width = r.width;
    this.height = r.height;
    this.dpr = dpr;
    this.pixelWidth = Math.round(r.width * dpr);
    this.pixelHeight = Math.round(r.height * dpr);
    return changed;
  }

  private measure() {
    if (this.measureNow() && this.built) {
      this.layout();
      this.invalidate();
    }
  }

  // ---- download ---------------------------------------------------------------

  /** The chart's data as columns and rows, for CSV. Override when the generic reading of the options misses. */
  protected table(): Table | null {
    return tabulate(this.opts as unknown as Record<string, unknown>);
  }

  private toggleMenu() {
    if (this.menuEl.classList.contains('tc-open')) return this.closeMenu();
    const formats = downloadOptions(this.opts.download).formats ?? ['png', 'csv'];
    const items: [string, string, () => void][] = [];
    if (formats.includes('png')) items.push(['Image', 'PNG', () => this.download('png')]);
    if (formats.includes('csv') && this.table()?.rows.length) items.push(['Data', 'CSV', () => this.download('csv')]);
    this.menuEl.textContent = '';
    for (const [label, ext, run] of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.innerHTML = `${label}<span>.${ext.toLowerCase()}</span>`;
      b.onclick = () => {
        this.closeMenu();
        run();
      };
      this.menuEl.appendChild(b);
    }
    this.menuEl.classList.add('tc-open');
    this.dlBtn.setAttribute('aria-expanded', 'true');
    (this.menuEl.firstElementChild as HTMLElement | null)?.focus();
    document.addEventListener('click', this.closeMenu);
    document.addEventListener('keydown', this.onMenuKey);
  }

  private closeMenu = () => {
    if (!this.menuEl?.classList.contains('tc-open')) return;
    this.menuEl.classList.remove('tc-open');
    this.dlBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', this.closeMenu);
    document.removeEventListener('keydown', this.onMenuKey);
  };

  private onMenuKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.closeMenu();
      this.dlBtn.focus();
    }
  };

  /** The whole chart as one canvas: background, plot, then every visible label, swatch and title on top. */
  private snapshot(): HTMLCanvasElement {
    if (this.progress < 1) {
      this.progress = 1;
      this.onProgress();
    }
    if (this.built && this.pixelWidth > 0) getEngine().paintNow(this);
    this.hideTooltip();
    const root = this.root.getBoundingClientRect();
    const scale = Math.max(2, this.dpr);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(root.width * scale));
    out.height = Math.max(1, Math.round(root.height * scale));
    const g = out.getContext('2d')!;
    g.scale(scale, scale);
    g.fillStyle = this.opts.background ?? this.theme.surface;
    g.fillRect(0, 0, root.width, root.height);
    const cr = this.canvas.getBoundingClientRect();
    if (this.canvas.width) g.drawImage(this.canvas, cr.left - root.left, cr.top - root.top, cr.width, cr.height);
    const stage = this.stage.getBoundingClientRect();
    const skip = (el: Element) => !!el.closest('.tc-tooltip,.tc-hint,.tc-dl,.tc-menu');

    for (const el of this.root.querySelectorAll<HTMLElement>('.tc-sw, .tc-ramp i')) {
      if (skip(el)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const cs = getComputedStyle(el);
      g.globalAlpha = opacityOf(el, this.root);
      const x = r.left - root.left;
      const y = r.top - root.top;
      const stops = cs.backgroundImage.match(/rgba?\([^)]*\)/g);
      if (stops && stops.length > 1) {
        const grad = g.createLinearGradient(x, 0, x + r.width, 0);
        stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
        g.fillStyle = grad;
      } else g.fillStyle = cs.backgroundColor;
      const br = cs.borderTopLeftRadius;
      const radius = br.endsWith('%') ? (Math.min(r.width, r.height) * parseFloat(br)) / 100 : parseFloat(br) || 0;
      g.beginPath();
      g.roundRect(x, y, r.width, r.height, Math.min(radius, r.width / 2, r.height / 2));
      g.fill();
    }

    const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim();
      const el = n.parentElement;
      if (!text || !el || skip(el)) continue;
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      g.save();
      g.globalAlpha = opacityOf(el, this.root);
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      g.fillStyle = cs.color;
      g.textBaseline = 'middle';
      // Labels inside the plot are clipped to it, as on screen.
      if (this.stage.contains(el)) {
        g.beginPath();
        g.rect(stage.left - root.left, stage.top - root.top, stage.width, stage.height);
        g.clip();
      }
      const label = el.closest<HTMLElement>('.tc-label');
      const deg = label ? parseFloat(/rotate\((-?[\d.]+)deg\)/.exec(label.style.transform)?.[1] ?? '0') : 0;
      const cx = r.left - root.left + r.width / 2;
      const cy = r.top - root.top + r.height / 2;
      if (deg) {
        g.translate(cx, cy);
        g.rotate((deg * Math.PI) / 180);
        g.textAlign = 'center';
        g.fillText(text, 0, 0);
      } else {
        g.textAlign = 'left';
        const x = r.left - root.left;
        const max = label?.classList.contains('tc-clip') ? label.getBoundingClientRect().width : Infinity;
        g.fillText(fitText(g, text, max), x, cy);
        if (cs.textDecorationLine.includes('line-through')) {
          g.fillRect(x, cy, Math.min(max, g.measureText(text).width), 1);
        }
      }
      g.restore();
    }
    return out;
  }

  /** Rebuild the legend (e.g. after a layout changed a color scale's range). */
  protected renderLegend() {
    const lo = legendOptions(this.opts.legend);
    const pos = lo.position ?? 'bottom';
    const side = pos === 'left' || pos === 'right';
    this.bodyEl.className = side ? 'tc-body tc-side' : 'tc-body';
    this.legendEl.className = `tc-legend tc-${pos}` + (lo.align && lo.align !== 'center' ? ` tc-${lo.align}` : '');
    this.legendEl.textContent = '';
    if (lo.show === false) return;
    const items = this.legendItems();
    const custom = this.customLegend();
    if (custom) this.legendEl.appendChild(custom);
    if (items.length < (lo.show ? 1 : 2)) return;
    const toggles = this.legendToggles && lo.toggle !== false;
    const marker = lo.marker && lo.marker !== 'square' ? ` tc-${lo.marker}` : '';
    for (const it of items) {
      const off = this.hidden.has(it.name);
      const el = document.createElement(toggles ? 'button' : 'span');
      el.innerHTML = `<span class="tc-sw${marker}" style="background:${it.color}"></span>${escapeHtml(lo.format ? lo.format(it.name) : it.name)}`;
      if (toggles) {
        const b = el as HTMLButtonElement;
        b.type = 'button';
        b.title = 'Click to hide or show · double-click to show only this';
        b.setAttribute('aria-pressed', String(!off));
        b.className = off ? 'tc-off' : '';
        b.onclick = () => {
          this.toggleSeries(it.name);
          lo.onToggle?.(it.name, !this.hidden.has(it.name));
        };
        b.ondblclick = () => {
          // Isolate this item; isolating it again shows everything.
          const others = items.filter((o) => o.name !== it.name);
          const alone = others.every((o) => this.hidden.has(o.name));
          this.hidden = new Set(alone ? [] : others.map((o) => o.name));
          this.rebuild();
        };
      } else el.className = 'tc-key';
      this.legendEl.appendChild(el);
    }
  }

  private onSchemeChange = () => {
    if ((this.opts.theme ?? 'auto') === 'auto' && this.built) this.rebuild();
  };

  private onPointerMove = (e: PointerEvent) => {
    const r = this.stage.getBoundingClientRect();
    this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    // Hit-test at most once per frame, however fast the pointer events arrive.
    if (!this.pointerRaf) this.pointerRaf = requestAnimationFrame(this.processPointer);
  };

  private processPointer = () => {
    this.pointerRaf = 0;
    if (!this.pointer || !this.built) return;
    const hit = this.dragging ? null : this.hitTest(this.pointer.x, this.pointer.y);
    const same = hit && this.lastHit && hit.series === this.lastHit.series && hit.index === this.lastHit.index;
    if (!same) {
      this.highlight(hit);
      this.opts.onHover?.(hit ? this.publicHit(hit) : null);
    }
    this.lastHit = hit;
    if (hit && this.opts.tooltip !== false) this.showTooltip(hit, this.pointer.x, this.pointer.y);
    else this.hideTooltip();
    this.stage.style.cursor = hit && this.opts.onClick ? 'pointer' : '';
  };

  private onPointerLeave = () => {
    this.pointer = null;
    this.wheelArmed = false;
    if (this.lastHit) {
      this.lastHit = null;
      this.highlight(null);
      this.opts.onHover?.(null);
    }
    this.hideTooltip();
  };

  private onClick = () => {
    if (this.lastHit) this.opts.onClick?.(this.publicHit(this.lastHit));
  };

  private publicHit(h: Hit): HitInfo {
    return { series: h.series, index: h.index, values: h.values };
  }

  private showTooltip(hit: Hit, x: number, y: number) {
    const rows = hit.rows ?? Object.entries(hit.values).map(([label, v]) => ({ label, value: String(v), color: undefined as string | undefined }));
    let html = `<b>${escapeHtml(hit.title ?? hit.series)}</b>`;
    for (const r of rows) {
      const sw = r.color ? `<i class="tc-sw" style="background:${r.color}"></i>` : '';
      html += `<div class="tc-row">${sw}<span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.value)}</span></div>`;
    }
    const tip = this.tooltipEl;
    if (tip.innerHTML !== html) tip.innerHTML = html;
    tip.style.display = 'block';
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = x + 14;
    let top = y + 14;
    if (left + tw > this.width) left = x - tw - 14;
    if (top + th > this.height) top = y - th - 14;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = Math.max(0, top) + 'px';
  }

  /** True when a wheel event should zoom this chart rather than scroll the page. */
  protected wantsWheel(e: WheelEvent): boolean {
    if (this.wheelArmed || e.ctrlKey || e.metaKey) return true;
    this.hintEl.classList.add('tc-show');
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hintEl.classList.remove('tc-show'), 1200);
    return false;
  }

  protected hideTooltip() {
    this.tooltipEl.style.display = 'none';
  }
}
