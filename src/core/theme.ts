import * as THREE from 'three';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface Theme {
  mode: 'light' | 'dark';
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  grid: string;
  axis: string;
  border: string;
  tooltipBg: string;
  /** Categorical slots in fixed order. Never cycled past 8 (see `seriesColor`). */
  series: string[];
  /** Sequential ramp (one hue, light -> dark), used for heatmaps and surfaces. */
  sequential: string[];
  /** Diverging: cool pole -> neutral -> warm pole. */
  diverging: string[];
  status: { good: string; warning: string; serious: string; critical: string };
  /** Gains, up candles, increases. */
  positive: string;
  /** Losses, down candles, decreases. */
  negative: string;
  /** CSS font-family for every label. */
  font: string;
  /** Base label size in CSS px (axis ticks, data labels). */
  fontSize: number;
}

const SEQ_BLUE = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };

export const LIGHT: Theme = {
  mode: 'light',
  surface: '#fcfcfb',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  textMuted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  border: 'rgba(11,11,11,0.10)',
  tooltipBg: '#ffffff',
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  sequential: SEQ_BLUE,
  diverging: ['#104281', '#3987e5', '#9ec5f4', '#f0efec', '#f3a9a8', '#e34948', '#a52a2a'],
  status: STATUS,
  positive: '#1baf7a',
  negative: '#e34948',
  font: FONT,
  fontSize: 11,
};

export const DARK: Theme = {
  mode: 'dark',
  surface: '#1a1a19',
  textPrimary: '#ffffff',
  textSecondary: '#c3c2b7',
  textMuted: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
  border: 'rgba(255,255,255,0.10)',
  tooltipBg: '#242423',
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  // On dark, magnitude reads dark -> light so "near zero" recedes into the surface.
  sequential: [...SEQ_BLUE].reverse(),
  diverging: ['#cde2fb', '#5598e7', '#1c5cab', '#383835', '#a63a39', '#e66767', '#f6c4c3'],
  status: STATUS,
  positive: '#199e70',
  negative: '#e66767',
  font: FONT,
  fontSize: 11,
};

export function resolveTheme(mode: ThemeMode = 'auto'): Theme {
  if (mode === 'light') return LIGHT;
  if (mode === 'dark') return DARK;
  const attr = document.documentElement.dataset.theme;
  if (attr === 'dark') return DARK;
  if (attr === 'light') return LIGHT;
  return matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
}

/** The color and font options every chart accepts (see `CommonOptions`). */
export interface ThemeOverrides {
  colors?: string[];
  colorScale?: string[];
  divergingColors?: string[];
  positiveColor?: string;
  negativeColor?: string;
  appearance?: Appearance;
}

/** Text, grid and font overrides. Any field left out keeps the theme's value. */
export interface Appearance {
  /** CSS font-family for titles, labels, legend and tooltip. */
  fontFamily?: string;
  /** Label size in CSS px. Default 11. */
  fontSize?: number;
  /** Title size in CSS px. Default 13. */
  titleSize?: number;
  /** Titles, values and tooltip text. */
  textColor?: string;
  /** Legend text and secondary labels. */
  secondaryTextColor?: string;
  /** Axis ticks and quiet labels. */
  mutedTextColor?: string;
  gridColor?: string;
  axisColor?: string;
  tooltipBackground?: string;
  borderColor?: string;
}

/** The theme for `mode`, with the chart's own color and font options applied on top. */
export function customTheme(mode: ThemeMode | undefined, o: ThemeOverrides): Theme {
  const t = resolveTheme(mode);
  const s = o.appearance ?? {};
  const list = (a?: string[]) => (a && a.length > 1 ? a : undefined);
  return {
    ...t,
    series: o.colors && o.colors.length ? o.colors : t.series,
    sequential: list(o.colorScale) ?? t.sequential,
    diverging: list(o.divergingColors) ?? t.diverging,
    positive: o.positiveColor ?? t.positive,
    negative: o.negativeColor ?? t.negative,
    font: s.fontFamily ?? t.font,
    fontSize: s.fontSize ?? t.fontSize,
    textPrimary: s.textColor ?? t.textPrimary,
    textSecondary: s.secondaryTextColor ?? t.textSecondary,
    textMuted: s.mutedTextColor ?? t.textMuted,
    grid: s.gridColor ?? t.grid,
    axis: s.axisColor ?? t.axis,
    tooltipBg: s.tooltipBackground ?? t.tooltipBg,
    border: s.borderColor ?? t.border,
  };
}

/** Slot i of the categorical palette. Past the last slot, series fold to muted gray rather than invent hues. */
export function seriesColor(theme: Theme, i: number, custom?: string[]): string {
  const list = custom && custom.length ? custom : theme.series;
  return list[i] ?? theme.textMuted;
}

/** 256x1 lookup texture for continuous color scales. */
export function rampTexture(stops: string[]): THREE.DataTexture {
  const n = 256;
  const data = new Uint8Array(n * 4);
  const cols = stops.map((s) => new THREE.Color(s));
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (cols.length - 1);
    const k = Math.min(cols.length - 2, Math.floor(t));
    c.copy(cols[k]).lerp(cols[k + 1], t - k);
    data[i * 4] = Math.round(c.r * 255);
    data[i * 4 + 1] = Math.round(c.g * 255);
    data[i * 4 + 2] = Math.round(c.b * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Sample a ramp on the CPU (for vertex colors). t in [0,1]. */
export function sampleRamp(stops: string[], t: number, out = new THREE.Color()): THREE.Color {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const k = Math.min(stops.length - 2, Math.floor(x));
  return out.set(stops[k]).lerp(new THREE.Color(stops[k + 1]), x - k);
}
