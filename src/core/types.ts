import type { ThemeMode } from './theme';
import type { ExtraOptions } from './types2';

/** Any array of numbers. Typed arrays (Float32Array etc.) are used as-is, with no copy, for large data. */
export type Numbers = ArrayLike<number>;

export interface HitInfo {
  /** Series or slice name. */
  series: string;
  /** Index of the data point inside its series. */
  index: number;
  /** Rows shown in the tooltip. */
  values: Record<string, string | number>;
}

export interface CommonOptions {
  title?: string;
  /** 'auto' follows `<html data-theme>` first, then the OS setting. */
  theme?: ThemeMode;
  /** Override the categorical palette (fixed order, max 8). */
  colors?: string[];
  /** Legend shows automatically for 2+ series; set false to hide it. */
  legend?: boolean;
  tooltip?: boolean;
  /** Entry animation. Default true. */
  animate?: boolean;
  /** CSS color painted behind the chart. Default: transparent. */
  background?: string;
  onClick?: (hit: HitInfo) => void;
  onHover?: (hit: HitInfo | null) => void;
}

export interface AxisOptions {
  label?: string;
  min?: number;
  max?: number;
  /** 'time' expects epoch milliseconds and formats ticks as dates. */
  type?: 'linear' | 'time';
  /** Custom tick formatter. */
  format?: (v: number) => string;
}

export interface CartesianOptions extends CommonOptions {
  xAxis?: AxisOptions;
  yAxis?: AxisOptions;
  /** Wheel to zoom, drag to pan, double-click to reset. */
  zoom?: 'x' | 'xy' | false;
  grid?: boolean;
  /** Charts with the same `sync` key zoom and pan their x axis together (e.g. price + MACD + RSI). */
  sync?: string;
}

export interface XYSeries {
  name: string;
  /** Sorted ascending for line/area. Omit to use the point index. */
  x?: Numbers;
  y: Numbers;
  color?: string;
}

export interface LineOptions extends CartesianOptions {
  type: 'line';
  series: XYSeries[];
  /** Line width in CSS pixels. Default 2. */
  lineWidth?: number;
  step?: boolean;
  /** Monotone cubic smoothing (spline) that never overshoots the data. */
  smooth?: boolean;
}

export interface AreaOptions extends CartesianOptions {
  type: 'area';
  series: XYSeries[];
  lineWidth?: number;
  /** Fill opacity, 0-1. Default 0.18, or 0.85 when stacked. */
  fillOpacity?: number;
  smooth?: boolean;
  /** Stack series (shared x). 'percent' normalizes to 100%; 'stream' centers the stack (streamgraph). */
  stacked?: boolean | 'percent' | 'stream';
}

export interface BarSeries {
  name: string;
  data: Numbers;
  color?: string;
}

export interface BarOptions extends CartesianOptions {
  type: 'bar';
  categories: string[];
  series: BarSeries[];
  /** true stacks values; 'percent' stacks each category to 100%. */
  stacked?: boolean | 'percent';
  horizontal?: boolean;
}

export interface HistogramOptions extends CartesianOptions {
  type: 'histogram';
  values: Numbers;
  bins?: number;
  name?: string;
  color?: string;
}

export interface ScatterSeries {
  name: string;
  x: Numbers;
  y: Numbers;
  /** Bubble size values (any unit). Mapped to `sizeRange`. */
  size?: Numbers;
  color?: string;
}

interface ScatterBase extends CartesianOptions {
  series: ScatterSeries[];
  /** Point diameter in CSS pixels (scatter). Default 8, or 3 for 100k+ points. */
  pointSize?: number;
  /** Diameter range in CSS pixels for bubbles. Default [8, 48]. */
  sizeRange?: [number, number];
  opacity?: number;
}

export interface ScatterOptions extends ScatterBase {
  type: 'scatter';
}

export interface BubbleOptions extends ScatterBase {
  type: 'bubble';
}

export interface HeatmapOptions extends CartesianOptions {
  type: 'heatmap';
  /** Row-major values, rows x cols. */
  data: Numbers;
  rows: number;
  cols: number;
  xLabels?: string[];
  yLabels?: string[];
  /** 'diverging' centers the scale on `center` (default 0). */
  scale?: 'sequential' | 'diverging';
  center?: number;
}

/** Overlay on price charts, computed from the close. */
export type Indicator =
  | { type: 'sma' | 'ema'; period: number; color?: string }
  /** Moving average with bands `stdDev` standard deviations above and below. Defaults 20 and 2. */
  | { type: 'bollinger'; period?: number; stdDev?: number; color?: string };

export interface CandlestickOptions extends CartesianOptions {
  type: 'candlestick';
  /** Epoch ms or index per candle (sorted). */
  x?: Numbers;
  open: Numbers;
  high: Numbers;
  low: Numbers;
  close: Numbers;
  name?: string;
  /** Moving averages and Bollinger bands drawn over the price. */
  indicators?: Indicator[];
}

export interface PieDatum {
  label: string;
  value: number;
  color?: string;
}

interface PieBase extends CommonOptions {
  data: PieDatum[];
  /** Inner radius as a fraction of the outer radius. Default 0 (pie) or 0.6 (donut). */
  innerRadius?: number;
  /** Text in the donut hole. Default: the total. */
  centerLabel?: string;
}

export interface PieOptions extends PieBase {
  type: 'pie';
}

export interface DonutOptions extends PieBase {
  type: 'donut';
}

/** Half donut (180°), e.g. for a single share or a parliament-style split. */
export interface SemiDonutOptions extends PieBase {
  type: 'semiDonut';
}

export interface RadarOptions extends CommonOptions {
  type: 'radar';
  axes: string[];
  series: BarSeries[];
  max?: number;
}

export interface GaugeBand {
  to: number;
  color: string;
}

export interface GaugeOptions extends CommonOptions {
  type: 'gauge';
  value: number;
  min?: number;
  max?: number;
  label?: string;
  units?: string;
  /** Colored ranges along the track, e.g. good / warning / critical. */
  bands?: GaugeBand[];
}

export interface Chart3DOptions extends CommonOptions {
  autoRotate?: boolean;
  xLabel?: string;
  yLabel?: string;
  zLabel?: string;
}

export interface Bar3DOptions extends Chart3DOptions {
  type: 'bar3d';
  rows: string[];
  cols: string[];
  /** Row-major values, rows.length x cols.length. */
  data: Numbers;
  /** 'row' colors each row as a series; 'value' uses the sequential ramp. */
  colorBy?: 'row' | 'value';
}

export interface XYZSeries {
  name: string;
  x: Numbers;
  y: Numbers;
  z: Numbers;
  color?: string;
}

export interface Scatter3DOptions extends Chart3DOptions {
  type: 'scatter3d';
  series: XYZSeries[];
  pointSize?: number;
}

export interface Line3DOptions extends Chart3DOptions {
  type: 'line3d';
  series: XYZSeries[];
  lineWidth?: number;
}

export interface Surface3DOptions extends Chart3DOptions {
  type: 'surface3d';
  /** Row-major heights, rows x cols. */
  data: Numbers;
  rows: number;
  cols: number;
  wireframe?: boolean;
}

export type ChartOptions =
  | LineOptions
  | AreaOptions
  | BarOptions
  | HistogramOptions
  | ScatterOptions
  | BubbleOptions
  | HeatmapOptions
  | CandlestickOptions
  | PieOptions
  | DonutOptions
  | SemiDonutOptions
  | RadarOptions
  | GaugeOptions
  | Bar3DOptions
  | Scatter3DOptions
  | Line3DOptions
  | Surface3DOptions
  | ExtraOptions;

export type ChartType = ChartOptions['type'];

/** Options for one chart type, with `type` itself omitted (used by typed React components). */
export type OptionsFor<T extends ChartType> = Omit<Extract<ChartOptions, { type: T }>, 'type'>;

export interface Chart<O extends CommonOptions = CommonOptions> {
  readonly type: string;
  /** Merge new options and redraw. */
  update(options: Partial<O>): void;
  /** Re-measure the container (automatic via ResizeObserver). */
  resize(): void;
  /** Reset zoom / camera. */
  resetView(): void;
  /** PNG data URL of the plot. */
  toPNG(): string;
  destroy(): void;
}
