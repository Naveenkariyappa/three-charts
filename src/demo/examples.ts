import type { ChartOptions, ChartType } from '../core';
import { EXTRA_EXAMPLES, GROUP_BY_TYPE } from './examples2';

/**
 * Every demo is defined once, as source text. The gallery *executes* that
 * text to build its options, and the code page *prints* it, so the snippets
 * you copy are exactly what renders on the demo page.
 */
export interface Example {
  id: string;
  type: ChartType;
  title: string;
  blurb: string;
  dim: '2D' | '3D';
  /** Shown as a badge, e.g. "1M points". */
  scale?: string;
  /** Plain-JS statements that prepare data (no imports). */
  setup: string;
  /** TypeScript variant of `setup` when JS alone wouldn't type-check. */
  setupTs?: string;
  /** Body of the options object (without `type`). */
  props: string;
  height?: number;
  /** Uses the `world` TopoJSON (world-atlas countries-110m). */
  needsWorld?: boolean;
  /** Gallery section; defaults by chart type. */
  group?: string;
}

const cluster2d = (ts: boolean) => `function cluster(n${ts ? ': number' : ''}, cx${ts ? ': number' : ''}, cy${ts ? ': number' : ''}, spread${ts ? ': number' : ''}) {
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = spread * Math.sqrt(-2 * Math.log(1 - Math.random()));
    const t = Math.random() * Math.PI * 2;
    x[i] = cx + r * Math.cos(t);
    y[i] = cy + r * Math.sin(t);
  }
  return { x, y };
}`;

const region = (ts: boolean) => `function region(n${ts ? ': number' : ''}, gdp${ts ? ': number' : ''}, life${ts ? ': number' : ''}) {
  const x${ts ? ': number[]' : ''} = [];
  const y${ts ? ': number[]' : ''} = [];
  const size${ts ? ': number[]' : ''} = [];
  for (let i = 0; i < n; i++) {
    const g = gdp * (0.4 + Math.random() * 1.2);
    x.push(g);
    y.push(life + Math.log(g / gdp) * 5 + (Math.random() - 0.5) * 4);
    size.push(5 + Math.random() ** 3 * 300); // population (M)
  }
  return { x, y, size };
}`;

const blob = (ts: boolean) => `function blob(n${ts ? ': number' : ''}, cx${ts ? ': number' : ''}, cy${ts ? ': number' : ''}, cz${ts ? ': number' : ''}, s${ts ? ': number' : ''}) {
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const z = new Float32Array(n);
  const g = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  for (let i = 0; i < n; i++) {
    x[i] = cx + g() * s;
    y[i] = cy + g() * s;
    z[i] = cz + g() * s;
  }
  return { x, y, z };
}`;

const lorenz = (ts: boolean) => `function lorenz(n${ts ? ': number' : ''}, x0${ts ? ': number' : ''}) {
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const z = new Float32Array(n);
  let a = x0, b = 1, c = 1;
  const dt = 0.005;
  for (let i = 0; i < n; i++) {
    const da = 10 * (b - a), db = a * (28 - c) - b, dc = a * b - (8 / 3) * c;
    a += da * dt; b += db * dt; c += dc * dt;
    x[i] = a; y[i] = b; z[i] = c;
  }
  return { x, y, z };
}`;

const CORE_EXAMPLES: Example[] = [
  {
    id: 'line',
    type: 'line',
    title: 'Line · time series',
    blurb: 'Three series, 5,000 hourly points each. Click, then scroll to zoom; drag to pan; double-click to reset.',
    dim: '2D',
    scale: '15k points',
    setup: `const n = 5000;
const start = Date.UTC(2026, 0, 1);
const x = new Float64Array(n); // epoch ms; Float64 keeps full time precision
const a = new Float32Array(n);
const b = new Float32Array(n);
const c = new Float32Array(n);
let va = 120, vb = 90, vc = 60;
for (let i = 0; i < n; i++) {
  x[i] = start + i * 3_600_000;
  va += (Math.random() - 0.5) * 3; a[i] = va;
  vb += (Math.random() - 0.5) * 3; b[i] = vb;
  vc += (Math.random() - 0.5) * 3; c[i] = vc;
}`,
    props: `xAxis: { type: 'time' },
yAxis: { label: 'Latency (ms)' },
series: [
  { name: 'us-east', x, y: a },
  { name: 'eu-west', x, y: b },
  { name: 'ap-south', x, y: c },
],`,
  },
  {
    id: 'line-1m',
    type: 'line',
    title: 'Line · 1,000,000 points',
    blurb: 'One million samples in a single draw call. Zoom and pan only move the camera — no data re-upload.',
    dim: '2D',
    scale: '1M points',
    setup: `const n = 1_000_000;
const y = new Float32Array(n);
let v = 0;
for (let i = 0; i < n; i++) {
  v += Math.random() - 0.5;
  y[i] = v + Math.sin(i / 20_000) * 300;
}`,
    props: `xAxis: { label: 'Sample' },
yAxis: { label: 'Reading' },
series: [{ name: 'Sensor', y }],`,
  },
  {
    id: 'step',
    type: 'line',
    title: 'Step line',
    blurb: 'Values that hold until the next change — tariffs, states, inventory levels.',
    dim: '2D',
    setup: `const hours = Array.from({ length: 48 }, (_, h) => h);
const price = hours.map((h) => {
  const t = h % 24;
  return t >= 17 && t < 21 ? 0.38 : t >= 7 ? 0.2 : 0.12;
});`,
    props: `step: true,
xAxis: { label: 'Hour' },
yAxis: { label: '$ / kWh' },
series: [{ name: 'Tariff', x: hours, y: price }],`,
  },
  {
    id: 'area',
    type: 'area',
    title: 'Area',
    blurb: 'Filled series anchored to zero.',
    dim: '2D',
    setup: `const web = [];
const mobile = [];
for (let i = 0; i < 36; i++) {
  web.push(40 + i * 1.5 + Math.sin(i / 2) * 6);
  mobile.push(10 + i * 2.6 + Math.cos(i / 3) * 5);
}`,
    setupTs: `const web: number[] = [];
const mobile: number[] = [];
for (let i = 0; i < 36; i++) {
  web.push(40 + i * 1.5 + Math.sin(i / 2) * 6);
  mobile.push(10 + i * 2.6 + Math.cos(i / 3) * 5);
}`,
    props: `xAxis: { label: 'Month' },
yAxis: { label: 'Active users (k)' },
series: [
  { name: 'Web', y: web },
  { name: 'Mobile', y: mobile },
],`,
  },
  {
    id: 'bar',
    type: 'bar',
    title: 'Grouped bar',
    blurb: 'Compare a value across categories and series. Click the legend to toggle a series.',
    dim: '2D',
    setup: ``,
    props: `categories: ['Q1', 'Q2', 'Q3', 'Q4'],
yAxis: { label: 'Revenue ($M)' },
series: [
  { name: '2024', data: [42, 51, 48, 63] },
  { name: '2025', data: [47, 58, 55, 71] },
  { name: '2026', data: [52, 61, 66, 80] },
],`,
  },
  {
    id: 'bar-stacked',
    type: 'bar',
    title: 'Stacked bar',
    blurb: 'Part-to-whole per category, with a 2px gap between segments.',
    dim: '2D',
    setup: ``,
    props: `stacked: true,
categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
yAxis: { label: 'Visits (k)' },
series: [
  { name: 'Organic', data: [32, 35, 31, 38, 41, 22, 19] },
  { name: 'Paid', data: [12, 14, 18, 15, 17, 9, 8] },
  { name: 'Referral', data: [6, 7, 5, 9, 8, 11, 12] },
],`,
  },
  {
    id: 'bar-horizontal',
    type: 'bar',
    title: 'Horizontal bar',
    blurb: 'Long category names read better on the vertical axis.',
    dim: '2D',
    setup: ``,
    props: `horizontal: true,
categories: ['TypeScript', 'Rust', 'Python', 'Go', 'Kotlin', 'Java'],
xAxis: { label: 'Satisfaction (%)' },
series: [{ name: 'Satisfaction', data: [84, 87, 78, 72, 69, 54] }],`,
  },
  {
    id: 'histogram',
    type: 'histogram',
    title: 'Histogram · 1M values',
    blurb: 'Bins a million raw values on nice boundaries, in the browser.',
    dim: '2D',
    scale: '1M values',
    setup: `const n = 1_000_000;
const values = new Float32Array(n);
for (let i = 0; i < n; i++) {
  // Box–Muller: normal distribution, mean 50, sd 12
  const u = 1 - Math.random();
  const v = Math.random();
  values[i] = 50 + 12 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}`,
    props: `values,
name: 'Response time',
xAxis: { label: 'Response time (ms)' },
yAxis: { label: 'Requests' },`,
  },
  {
    id: 'scatter',
    type: 'scatter',
    title: 'Scatter',
    blurb: 'Three clusters. Click, then scroll to zoom both axes.',
    dim: '2D',
    setup: cluster2d(false),
    setupTs: cluster2d(true),
    props: `xAxis: { label: 'Feature 1' },
yAxis: { label: 'Feature 2' },
series: [
  { name: 'Cluster A', ...cluster(400, 20, 30, 5) },
  { name: 'Cluster B', ...cluster(400, 38, 22, 6) },
  { name: 'Cluster C', ...cluster(400, 30, 45, 4) },
],`,
  },
  {
    id: 'scatter-1m',
    type: 'scatter',
    title: 'Scatter · 1,000,000 points',
    blurb: 'A spatial grid index keeps hover instant at a million points.',
    dim: '2D',
    scale: '1M points',
    setup: cluster2d(false),
    setupTs: cluster2d(true),
    props: `series: [
  { name: 'Cluster A', ...cluster(400_000, 20, 30, 5) },
  { name: 'Cluster B', ...cluster(350_000, 38, 22, 6) },
  { name: 'Cluster C', ...cluster(250_000, 30, 45, 4) },
],`,
  },
  {
    id: 'bubble',
    type: 'bubble',
    title: 'Bubble',
    blurb: 'A third value mapped to bubble area.',
    dim: '2D',
    setup: region(false),
    setupTs: region(true),
    props: `xAxis: { label: 'GDP per capita ($k)' },
yAxis: { label: 'Life expectancy' },
series: [
  { name: 'Americas', ...region(12, 30, 76) },
  { name: 'Europe', ...region(12, 42, 80) },
  { name: 'Asia', ...region(14, 18, 74) },
],`,
  },
  {
    id: 'heatmap',
    type: 'heatmap',
    title: 'Heatmap · weekly activity',
    blurb: 'Rows × columns of values on a sequential scale.',
    dim: '2D',
    setup: `const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hours = Array.from({ length: 24 }, (_, h) => h + ':00');
const data = new Float32Array(7 * 24);
for (let d = 0; d < 7; d++) {
  for (let h = 0; h < 24; h++) {
    const peak = d < 5 ? Math.exp(-((h - 14) ** 2) / 18) : 0.7 * Math.exp(-((h - 20) ** 2) / 10);
    data[d * 24 + h] = Math.round(peak * 900 + Math.random() * 80);
  }
}`,
    props: `data,
rows: 7,
cols: 24,
xLabels: hours,
yLabels: days,`,
  },
  {
    id: 'heatmap-1m',
    type: 'heatmap',
    title: 'Heatmap · 1000 × 1000',
    blurb: 'One million cells uploaded as a single float texture. Diverging scale centered on zero.',
    dim: '2D',
    scale: '1M cells',
    setup: `const rows = 1000;
const cols = 1000;
const data = new Float32Array(rows * cols);
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = (c / cols) * 8 - 4;
    const y = (r / rows) * 8 - 4;
    data[r * cols + c] = Math.sin(x * x + y * y) * Math.cos(x * 1.5);
  }
}`,
    props: `data,
rows,
cols,
scale: 'diverging',`,
  },
  {
    id: 'candlestick',
    type: 'candlestick',
    title: 'Candlestick',
    blurb: '500 trading days of OHLC. Hover for open / high / low / close.',
    dim: '2D',
    setup: `const n = 500;
const day = 86_400_000;
const start = Date.UTC(2025, 0, 1);
const x = [], open = [], high = [], low = [], close = [];
let p = 150;
for (let i = 0; i < n; i++) {
  const o = p;
  const c = o * (1 + (Math.random() - 0.48) * 0.04);
  x.push(start + i * day);
  open.push(o);
  close.push(c);
  high.push(Math.max(o, c) * (1 + Math.random() * 0.015));
  low.push(Math.min(o, c) * (1 - Math.random() * 0.015));
  p = c;
}`,
    setupTs: `const n = 500;
const day = 86_400_000;
const start = Date.UTC(2025, 0, 1);
const x: number[] = [], open: number[] = [], high: number[] = [], low: number[] = [], close: number[] = [];
let p = 150;
for (let i = 0; i < n; i++) {
  const o = p;
  const c = o * (1 + (Math.random() - 0.48) * 0.04);
  x.push(start + i * day);
  open.push(o);
  close.push(c);
  high.push(Math.max(o, c) * (1 + Math.random() * 0.015));
  low.push(Math.min(o, c) * (1 - Math.random() * 0.015));
  p = c;
}`,
    props: `name: 'ACME',
xAxis: { type: 'time' },
x, open, high, low, close,`,
  },
  {
    id: 'pie',
    type: 'pie',
    title: 'Pie',
    blurb: 'Part-to-whole with a few slices. More than 8 fold into “Other”.',
    dim: '2D',
    setup: ``,
    props: `data: [
  { label: 'Chrome', value: 64 },
  { label: 'Safari', value: 19 },
  { label: 'Edge', value: 5 },
  { label: 'Firefox', value: 3 },
  { label: 'Other', value: 9 },
],`,
  },
  {
    id: 'donut',
    type: 'donut',
    title: 'Donut',
    blurb: 'A pie with room for a headline number.',
    dim: '2D',
    setup: ``,
    props: `centerLabel: '512 GB',
data: [
  { label: 'Photos', value: 180 },
  { label: 'Apps', value: 120 },
  { label: 'System', value: 64 },
  { label: 'Messages', value: 38 },
  { label: 'Free', value: 110 },
],`,
  },
  {
    id: 'radar',
    type: 'radar',
    title: 'Radar',
    blurb: 'Multivariate profiles on a shared radial scale.',
    dim: '2D',
    setup: ``,
    props: `axes: ['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency', 'Price'],
max: 100,
series: [
  { name: 'Model S', data: [92, 70, 85, 88, 75, 40] },
  { name: 'Model C', data: [65, 90, 70, 80, 92, 85] },
],`,
  },
  {
    id: 'gauge',
    type: 'gauge',
    title: 'Gauge',
    blurb: 'A single KPI against a range, with labeled status bands.',
    dim: '2D',
    setup: ``,
    props: `value: 72,
units: '%',
label: 'CPU load',
bands: [
  { to: 60, color: '#0ca30c' },
  { to: 85, color: '#fab219' },
  { to: 100, color: '#d03b3b' },
],`,
  },
  {
    id: 'bar3d',
    type: 'bar3d',
    title: '3D bar',
    blurb: 'Two categorical dimensions and a value. Drag to orbit; click, then scroll to zoom.',
    dim: '3D',
    setup: `const rows = ['2023', '2024', '2025', '2026'];
const cols = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const data = new Float32Array(rows.length * cols.length);
for (let r = 0; r < rows.length; r++) {
  for (let c = 0; c < cols.length; c++) {
    data[r * cols.length + c] = 40 + r * 12 + Math.sin((c / 12) * Math.PI * 2 - 1) * 25 + Math.random() * 10;
  }
}`,
    props: `rows,
cols,
data,
xLabel: 'Month',
yLabel: 'Year',
zLabel: 'Sales',`,
    height: 380,
  },
  {
    id: 'scatter3d',
    type: 'scatter3d',
    title: '3D scatter · 300k points',
    blurb: 'Three Gaussian clusters in xyz. Hover picks the nearest projected point.',
    dim: '3D',
    scale: '300k points',
    setup: blob(false),
    setupTs: blob(true),
    props: `xLabel: 'x',
yLabel: 'y',
zLabel: 'z',
series: [
  { name: 'Alpha', ...blob(120_000, 0, 0, 0, 1) },
  { name: 'Beta', ...blob(100_000, 3, 2, 1, 0.8) },
  { name: 'Gamma', ...blob(80_000, -2, 3, 3, 0.7) },
],`,
    height: 380,
  },
  {
    id: 'line3d',
    type: 'line3d',
    title: '3D line · Lorenz attractor',
    blurb: 'Three trajectories from nearly identical starting points.',
    dim: '3D',
    scale: '30k points',
    setup: lorenz(false),
    setupTs: lorenz(true),
    props: `autoRotate: true,
series: [
  { name: 'x₀ = 1.00', ...lorenz(10_000, 1) },
  { name: 'x₀ = 1.01', ...lorenz(10_000, 1.01) },
  { name: 'x₀ = 1.02', ...lorenz(10_000, 1.02) },
],`,
    height: 380,
  },
  {
    id: 'surface3d',
    type: 'surface3d',
    title: '3D surface',
    blurb: 'A height field colored on a sequential scale, with wireframe.',
    dim: '3D',
    scale: '14k vertices',
    setup: `const rows = 120;
const cols = 120;
const data = new Float32Array(rows * cols);
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = (c / (cols - 1)) * 6 - 3;
    const y = (r / (rows - 1)) * 6 - 3;
    data[r * cols + c] = Math.sin(x * 1.4) * Math.cos(y * 1.4) * 2 + Math.exp(-(x * x + y * y)) * 3;
  }
}`,
    props: `data,
rows,
cols,
wireframe: true,
zLabel: 'f(x, y)',`,
    height: 380,
  },
];

export const EXAMPLES: Example[] = [...CORE_EXAMPLES, ...EXTRA_EXAMPLES].map((e) => ({ ...e, group: e.group ?? GROUP_BY_TYPE[e.type] }));

let worldPromise: Promise<unknown> | null = null;
/** Loaded on demand so pages without maps don't pay for it. */
export function loadWorld() {
  worldPromise ??= import('world-atlas/countries-110m.json').then((m) => m.default);
  return worldPromise;
}

/** Run an example's source and return its options. */
export async function buildOptions(ex: Example): Promise<ChartOptions> {
  const world = ex.needsWorld ? await loadWorld() : undefined;
  // eslint-disable-next-line no-new-func
  const fn = new Function('world', `${ex.setup}\nreturn { type: '${ex.type}',\n${ex.props}\n};`);
  return fn(world) as ChartOptions;
}

export const COMPONENT: Record<ChartType, string> = {
  line: 'LineChart',
  area: 'AreaChart',
  bar: 'BarChart',
  histogram: 'HistogramChart',
  scatter: 'ScatterChart',
  bubble: 'BubbleChart',
  heatmap: 'HeatmapChart',
  candlestick: 'CandlestickChart',
  pie: 'PieChart',
  donut: 'DonutChart',
  semiDonut: 'SemiDonutChart',
  radar: 'RadarChart',
  gauge: 'GaugeChart',
  lollipop: 'LollipopChart',
  dotplot: 'DotPlotChart',
  dumbbell: 'DumbbellChart',
  rangeBar: 'RangeBarChart',
  bullet: 'BulletChart',
  waterfall: 'WaterfallChart',
  marimekko: 'MarimekkoChart',
  pictograph: 'PictographChart',
  radialBar: 'RadialBarChart',
  rangeArea: 'RangeAreaChart',
  slope: 'SlopeChart',
  bump: 'BumpChart',
  horizon: 'HorizonChart',
  sparkline: 'SparklineChart',
  box: 'BoxChart',
  violin: 'ViolinChart',
  density: 'DensityChart',
  ridgeline: 'RidgelineChart',
  beeswarm: 'BeeswarmChart',
  strip: 'StripChart',
  ecdf: 'ECDFChart',
  qq: 'QQChart',
  treemap: 'TreemapChart',
  sunburst: 'SunburstChart',
  icicle: 'IcicleChart',
  pack: 'PackChart',
  dendrogram: 'DendrogramChart',
  orgChart: 'OrgChart',
  waffle: 'WaffleChart',
  funnel: 'FunnelChart',
  pyramid: 'PyramidChart',
  venn: 'VennChart',
  polarArea: 'PolarAreaChart',
  windRose: 'WindRoseChart',
  radialLine: 'RadialLineChart',
  hexbin: 'HexbinChart',
  contour: 'ContourChart',
  density2d: 'Density2DChart',
  splom: 'SplomChart',
  connectedScatter: 'ConnectedScatterChart',
  parallel: 'ParallelChart',
  chord: 'ChordChart',
  arcDiagram: 'ArcDiagramChart',
  adjacency: 'AdjacencyChart',
  network: 'NetworkChart',
  network3d: 'Network3DChart',
  sankey: 'SankeyChart',
  alluvial: 'AlluvialChart',
  gantt: 'GanttChart',
  timeline: 'TimelineChart',
  calendar: 'CalendarChart',
  linearGauge: 'LinearGaugeChart',
  progressRing: 'ProgressRingChart',
  stat: 'StatChart',
  ohlc: 'OHLCChart',
  heikinAshi: 'HeikinAshiChart',
  volumeProfile: 'VolumeProfileChart',
  renko: 'RenkoChart',
  pointFigure: 'PointFigureChart',
  kagi: 'KagiChart',
  depth: 'DepthChart',
  choropleth: 'ChoroplethChart',
  bubbleMap: 'BubbleMapChart',
  flowMap: 'FlowMapChart',
  hexbinMap: 'HexbinMapChart',
  globe: 'GlobeChart',
  bar3d: 'Bar3DChart',
  scatter3d: 'Scatter3DChart',
  line3d: 'Line3DChart',
  surface3d: 'Surface3DChart',
  mesh3d: 'Mesh3DChart',
  isosurface: 'IsosurfaceChart',
  vectorField: 'VectorFieldChart',
  vectorField3d: 'VectorField3DChart',
  spectrogram: 'SpectrogramChart',
  waterfall3d: 'Waterfall3DChart',
  ternary: 'TernaryChart',
  smith: 'SmithChart',
  wordCloud: 'WordCloudChart',
  pareto: 'ParetoChart',
  populationPyramid: 'PopulationPyramidChart',
  confidenceBand: 'ConfidenceBandChart',
  errorBar: 'ErrorBarChart',
  mindMap: 'MindMapChart',
  voronoi: 'VoronoiChart',
  polarScatter: 'PolarScatterChart',
  confusionMatrix: 'ConfusionMatrixChart',
  rocCurve: 'RocCurveChart',
  macd: 'MacdChart',
  rsi: 'RsiChart',
  cartogram: 'CartogramChart',
  dotDensity: 'DotDensityChart',
};

const indent = (s: string, n: number) =>
  s
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

const pascal = (id: string) => id.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase()).replace(/\W/g, '');

/** File name a chart's component lives in: BarChart -> bar-chart, OHLCChart -> ohlc-chart. Mirrors scripts/registry.mjs. */
export const chartFile = (type: ChartType) =>
  COMPONENT[type]
    .replace(/(\d)D/g, '$1d')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase();

/** Where the docs tell people to put chart files. */
export const VANILLA_DIR = './charts';
export const REACT_DIR = '@/components/charts';

const WORLD_JS = `// Country shapes (TopoJSON): npm install world-atlas, or load from a CDN.
const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((r) => r.json());
`;

function vanillaSnippet(ex: Example, ts: boolean): string {
  const comp = COMPONENT[ex.type];
  const setupSrc = ts ? (ex.setupTs ?? ex.setup) : ex.setup;
  const setup = (ex.needsWorld ? WORLD_JS + '\n' : '') + (setupSrc ? `${setupSrc}\n\n` : '');
  const el = ts ? `document.getElementById('chart')!` : `document.getElementById('chart')`;
  return `import { create${comp} } from '${VANILLA_DIR}/${chartFile(ex.type)}${ts ? '' : '.js'}';

${setup}// The container needs a height; the chart fills it.
const chart = create${comp}(${el}, {
${indent(ex.props, 2)}
});

// Later: chart.update({ ... }), chart.resetView(), chart.toPNG(), chart.destroy()
`;
}

function reactSnippet(ex: Example, ts: boolean): string {
  const comp = COMPONENT[ex.type];
  const setup = ts ? (ex.setupTs ?? ex.setup) : ex.setup;
  const imports = ts ? `{ ${comp}, type ${comp}Props }` : `{ ${comp} }`;
  const sig = ts ? `(): ${comp}Props => ` : '() => ';
  const body = setup
    ? `${sig}{\n${indent(setup, 4)}\n    return {\n${indent(ex.props, 6)}\n    };\n  }`
    : `${sig}({\n${indent(ex.props, 4)}\n  })`;
  const worldImport = ex.needsWorld ? `// npm install world-atlas\nimport world from 'world-atlas/countries-110m.json';\n` : '';
  return `import { useMemo } from 'react';
import ${imports} from '${REACT_DIR}/${chartFile(ex.type)}';
${worldImport}
export default function ${pascal(ex.id)}Example() {
  // Build data once; options are compared by reference.
  const options = useMemo(${body}, []);

  return <${comp} height={${ex.height ?? 320}} {...options} />;
}
`;
}

export const jsSnippet = (ex: Example) => vanillaSnippet(ex, false);
export const tsSnippet = (ex: Example) => vanillaSnippet(ex, true);
export const jsxSnippet = (ex: Example) => reactSnippet(ex, false);
export const tsxSnippet = (ex: Example) => reactSnippet(ex, true);
