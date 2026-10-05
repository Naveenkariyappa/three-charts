import { DARK, LIGHT, type ChartType } from '../core';
import { CUSTOM_FLAGS } from './customFlags';

/** Everything the Customize panel can change. `null` / defaults mean "leave the option out". */
export interface Custom {
  theme: 'auto' | 'light' | 'dark';
  /** null = the default palette. */
  colors: string[] | null;
  scale: string;
  diverging: string;
  positive: string | null;
  negative: string | null;
  legend: 'auto' | 'on' | 'off';
  position: 'bottom' | 'top' | 'left' | 'right';
  align: 'start' | 'center' | 'end';
  marker: 'square' | 'circle' | 'line';
  toggle: boolean;
  font: string;
  fontSize: number;
  title: string;
  background: string | null;
  tooltip: boolean;
  download: boolean;
  animate: boolean;
  grid: boolean;
}

export const DEFAULT_CUSTOM: Custom = {
  theme: 'auto',
  colors: null,
  scale: 'blue',
  diverging: 'blue-red',
  positive: null,
  negative: null,
  legend: 'auto',
  position: 'bottom',
  align: 'center',
  marker: 'square',
  toggle: true,
  font: 'system',
  fontSize: 11,
  title: '',
  background: null,
  tooltip: true,
  download: true,
  animate: true,
  grid: true,
};

export const FONTS: Record<string, [label: string, css: string | null]> = {
  system: ['System', null],
  serif: ['Serif', 'Georgia, "Times New Roman", serif'],
  mono: ['Monospace', 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'],
  rounded: ['Rounded', 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif'],
};

/** One-hue sequential ramps, low → high. On dark surfaces low values sit dark so they recede. */
export const SCALES: Record<string, { label: string; light: string[] | null }> = {
  blue: { label: 'Blue', light: null },
  orange: { label: 'Orange', light: ['#fde6d8', '#f4a172', '#eb6834', '#b8441a', '#7a2a0c'] },
  green: { label: 'Green', light: ['#d5f2e5', '#7fd3ae', '#1baf7a', '#12805a', '#0a4d36'] },
  violet: { label: 'Violet', light: ['#e4e0f7', '#a79ce0', '#6a5bc4', '#4a3aa7', '#2c2170'] },
  gray: { label: 'Gray', light: ['#efeeea', '#c3c2b7', '#898781', '#52514e', '#232322'] },
};

/** Two poles and a neutral middle, negative → positive. */
export const DIVERGING: Record<string, { label: string; light: string[] | null; dark: string[] | null }> = {
  'blue-red': { label: 'Blue ↔ Red', light: null, dark: null },
  'violet-green': {
    label: 'Violet ↔ Green',
    light: ['#2c2170', '#6a5bc4', '#c6bff0', '#f0efec', '#a8e3c9', '#1baf7a', '#0a5c3f'],
    dark: ['#d8d3f6', '#8f84d6', '#4a3aa7', '#383835', '#12805a', '#4cc495', '#bfeedb'],
  },
  'orange-blue': {
    label: 'Orange ↔ Blue',
    light: ['#7a2a0c', '#d95926', '#f7c2a4', '#f0efec', '#9ec5f4', '#2a78d6', '#104281'],
    dark: ['#fbd5bf', '#eb6834', '#9c3a12', '#383835', '#1c5cab', '#5598e7', '#cde2fb'],
  },
};

export function resolvedMode(c: Custom): 'light' | 'dark' {
  if (c.theme !== 'auto') return c.theme;
  const attr = document.documentElement.dataset.theme;
  if (attr === 'dark' || attr === 'light') return attr;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const defaultPalette = (mode: 'light' | 'dark') => (mode === 'dark' ? DARK : LIGHT).series;
export const defaultUpDown = (mode: 'light' | 'dark') => {
  const t = mode === 'dark' ? DARK : LIGHT;
  return { positive: t.positive, negative: t.negative };
};

export interface Flags {
  palette: boolean;
  scale: boolean;
  diverging: boolean;
  updown: boolean;
  cartesian: boolean;
  legend: boolean;
}

export function flagsFor(type: ChartType): Flags {
  const f = CUSTOM_FLAGS[type] ?? '';
  const has = (k: string) => f.split(' ').includes(k);
  return { palette: has('palette'), scale: has('scale'), diverging: has('diverging'), updown: has('updown'), cartesian: has('cartesian'), legend: has('legend') };
}

/**
 * The options the panel adds, as values (for the live chart) and as source text (for the code).
 * Only options that differ from the defaults, and that the chart type accepts, are included.
 */
export function customOptions(c: Custom, type: ChartType, slots = 8): { values: Record<string, unknown>; code: [string, string][] } {
  const f = flagsFor(type);
  const mode = resolvedMode(c);
  const values: Record<string, unknown> = {};
  const code: [string, string][] = [];
  const put = (k: string, v: unknown, src = lit(v)) => {
    values[k] = v;
    code.push([k, src]);
  };

  if (c.title) put('title', c.title);
  if (c.theme !== 'auto') put('theme', c.theme);
  // The code lists only the colors this chart uses; the live chart gets the same list.
  if (c.colors && f.palette) put('colors', c.colors.slice(0, slots));
  const scale = SCALES[c.scale]?.light;
  if (scale && f.scale) put('colorScale', mode === 'dark' ? [...scale].reverse() : scale);
  const div = DIVERGING[c.diverging];
  if (div?.light && f.diverging) put('divergingColors', mode === 'dark' ? div.dark : div.light);
  if (f.updown && c.positive) put('positiveColor', c.positive);
  if (f.updown && c.negative) put('negativeColor', c.negative);

  const legend: Record<string, unknown> = {};
  if (c.legend !== 'auto') legend.show = c.legend === 'on';
  if (c.legend !== 'off') {
    if (c.position !== 'bottom') legend.position = c.position;
    if (c.align !== 'center') legend.align = c.align;
    if (c.marker !== 'square') legend.marker = c.marker;
    if (!c.toggle) legend.toggle = false;
  }
  const keys = Object.keys(legend);
  if (keys.length === 1 && keys[0] === 'show') put('legend', legend.show);
  else if (keys.length) put('legend', legend);

  const style: Record<string, unknown> = {};
  const font = FONTS[c.font]?.[1];
  if (font) style.fontFamily = font;
  if (c.fontSize !== 11) style.fontSize = c.fontSize;
  if (Object.keys(style).length) put('appearance', style);

  if (c.background) put('background', c.background);
  if (!c.tooltip) put('tooltip', false);
  if (!c.download) put('download', false);
  if (!c.animate) put('animate', false);
  if (f.cartesian && !c.grid) put('grid', false);
  return { values, code };
}

/**
 * How many palette colors an example uses: one per series, slice, group or top-level branch, capped at 8.
 * Charts colored some other way (one series, a color scale) use 1, so the panel doesn't offer swatches that change nothing.
 */
export function colorSlots(o: Record<string, unknown>): number {
  const len = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]).length : 0);
  const recs = (k: string) => (Array.isArray(o[k]) && typeof (o[k] as unknown[])[0] === 'object' ? (o[k] as Record<string, unknown>[]) : null);
  const distinct = (list: Record<string, unknown>[] | null, f: string) => (list ? new Set(list.map((r) => r[f]).filter((v) => v !== undefined)).size : 0);
  const tree = o.data as { children?: unknown[] } | undefined;
  const n = Math.max(
    len('series'),
    len('groups'),
    len('levels'),
    len('bands'),
    len('rings'),
    recs('data') ? len('data') : 0,
    tree && !Array.isArray(tree) && Array.isArray(tree.children) ? tree.children.length : 0,
    distinct(recs('nodes'), 'group'),
    distinct(recs('tasks'), 'group'),
    distinct(recs('items'), 'group'),
    distinct(recs('data'), 'group'),
    distinct(recs('words'), 'group'),
  );
  return Math.min(8, Math.max(1, n));
}

/** A JS literal with single quotes, short arrays on one line. */
function lit(v: unknown): string {
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
  if (v && typeof v === 'object') {
    return `{ ${Object.entries(v)
      .map(([k, x]) => `${k}: ${lit(x)}`)
      .join(', ')} }`;
  }
  return String(v);
}

/**
 * Replace (or add) top-level keys in an example's `props` source. Top-level keys start at column 0;
 * a key's value runs until the next top-level key.
 */
export function mergeProps(props: string, extra: [string, string][]): string {
  if (!extra.length) return props;
  const drop = new Set(extra.map(([k]) => k));
  const out: string[] = [];
  let skipping = false;
  for (const line of props.split('\n')) {
    const key = /^([A-Za-z_$][\w$]*)\s*:/.exec(line)?.[1];
    if (key !== undefined) skipping = drop.has(key);
    else if (/^\S/.test(line) && !line.startsWith('}') && !line.startsWith(']')) skipping = false;
    if (!skipping) out.push(line);
  }
  const body = out.join('\n').replace(/\s+$/, '');
  return `${body}\n${extra.map(([k, v]) => `${k}: ${v},`).join('\n')}`;
}

/** OKLab distance ×100 between two hex colors; below ~15 most people can't tell two series apart. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
}

function oklab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const r = lin(((n >> 16) & 255) / 255);
  const g = lin(((n >> 8) & 255) / 255);
  const b = lin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
