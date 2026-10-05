/**
 * Options for the extended chart catalog. Every chart takes plain data
 * (arrays, typed arrays or small object lists) plus a few switches.
 */
import type { TreeDatum, SankeyLinkIn, SankeyNodeIn } from './layouts';
import type { BarSeries, CandlestickOptions, CartesianOptions, Chart3DOptions, CommonOptions, GaugeBand, Numbers, PieDatum, XYSeries } from './types';

export type { TreeDatum, SankeyLinkIn, SankeyNodeIn };

/** Raw values for one group (box plots, violins, strips...). */
export interface ValueGroup {
  name: string;
  values: Numbers;
  color?: string;
}

// ---- Comparison ------------------------------------------------------------------------

export interface LollipopOptions extends CartesianOptions {
  type: 'lollipop';
  categories: string[];
  values: Numbers;
  name?: string;
  horizontal?: boolean;
}

export interface DotPlotOptions extends CartesianOptions {
  type: 'dotplot';
  categories: string[];
  series: BarSeries[];
  /** Categories on the vertical axis (Cleveland style). Default true. */
  horizontal?: boolean;
}

export interface DumbbellOptions extends CartesianOptions {
  type: 'dumbbell';
  categories: string[];
  start: Numbers;
  end: Numbers;
  startName?: string;
  endName?: string;
  horizontal?: boolean;
}

export interface RangeBarOptions extends CartesianOptions {
  type: 'rangeBar';
  categories: string[];
  low: Numbers;
  high: Numbers;
  name?: string;
  horizontal?: boolean;
}

export interface BulletItem {
  label: string;
  value: number;
  target?: number;
  /** Ascending upper bounds of the qualitative bands (e.g. poor / ok / good). */
  ranges: number[];
}

export interface BulletOptions extends CartesianOptions {
  type: 'bullet';
  items: BulletItem[];
}

export interface WaterfallOptions extends CartesianOptions {
  type: 'waterfall';
  categories: string[];
  /** Changes. Entries listed in `totals` are absolute subtotals instead. */
  values: Numbers;
  totals?: number[];
}

export interface MarimekkoOptions extends CartesianOptions {
  type: 'marimekko';
  /** Columns; width is each column's total. */
  categories: string[];
  /** Segments stacked inside every column. */
  series: BarSeries[];
}

export interface PictographOptions extends CommonOptions {
  type: 'pictograph';
  data: PieDatum[];
  /** Value represented by one icon. Default: chosen so the largest row has 20 icons. */
  unit?: number;
  icon?: 'person' | 'circle' | 'square';
}

export interface RadialBarOptions extends CommonOptions {
  type: 'radialBar';
  data: PieDatum[];
  max?: number;
}

// ---- Trend ------------------------------------------------------------------------------

export interface BandSeries {
  name: string;
  x?: Numbers;
  low: Numbers;
  high: Numbers;
  color?: string;
}

export interface RangeAreaOptions extends CartesianOptions {
  type: 'rangeArea';
  bands: BandSeries[];
  /** Optional lines drawn over the bands (e.g. the forecast median). */
  lines?: XYSeries[];
}

export interface SlopeItem {
  name: string;
  start: number;
  end: number;
  color?: string;
}

export interface SlopeOptions extends CartesianOptions {
  type: 'slope';
  /** Names of the two points in time. */
  labels: [string, string];
  items: SlopeItem[];
}

export interface BumpOptions extends CartesianOptions {
  type: 'bump';
  periods: string[];
  /** Values per period; ranks are computed (largest = #1) unless `ranks` is true. */
  series: BarSeries[];
  ranks?: boolean;
}

export interface HorizonOptions extends CommonOptions {
  type: 'horizon';
  series: XYSeries[];
  /** Number of folded bands. Default 3. */
  bands?: number;
  /** Value of one band; default fits the largest |value|. */
  bandSize?: number;
}

export interface SparklineOptions extends CommonOptions {
  type: 'sparkline';
  values: Numbers;
  color?: string;
  /** Fill under the line. */
  area?: boolean;
  /** Mark min, max and last values. Default true. */
  markers?: boolean;
}

// ---- Distribution -------------------------------------------------------------------

export interface BoxOptions extends CartesianOptions {
  type: 'box';
  groups: ValueGroup[];
  horizontal?: boolean;
  outliers?: boolean;
}

export interface ViolinOptions extends CartesianOptions {
  type: 'violin';
  groups: ValueGroup[];
  horizontal?: boolean;
}

export interface DensityOptions extends CartesianOptions {
  type: 'density';
  series: ValueGroup[];
  /** Kernel bandwidth; default Silverman's rule. */
  bandwidth?: number;
}

export interface RidgelineOptions extends CartesianOptions {
  type: 'ridgeline';
  groups: ValueGroup[];
  /** Curve height in rows. Default 1.6 (curves overlap the row above). */
  overlap?: number;
}

export interface BeeswarmOptions extends CartesianOptions {
  type: 'beeswarm';
  groups: ValueGroup[];
  /** Dot diameter in px. Default 7. */
  pointSize?: number;
}

export interface StripOptions extends CartesianOptions {
  type: 'strip';
  groups: ValueGroup[];
  pointSize?: number;
  /** Fraction of the band used for jitter. Default 0.6. */
  jitter?: number;
}

export interface EcdfOptions extends CartesianOptions {
  type: 'ecdf';
  series: ValueGroup[];
}

export interface QQOptions extends CartesianOptions {
  type: 'qq';
  values: Numbers;
  name?: string;
}

// ---- Hierarchy -----------------------------------------------------------------------

export interface HierarchyOptions extends CommonOptions {
  data: TreeDatum;
  /** 'branch': top-level branches get categorical colors. 'value': sequential by value. */
  colorBy?: 'branch' | 'value';
}

export interface TreemapOptions extends HierarchyOptions {
  type: 'treemap';
}
export interface SunburstOptions extends HierarchyOptions {
  type: 'sunburst';
}
export interface IcicleOptions extends HierarchyOptions {
  type: 'icicle';
}
export interface PackOptions extends HierarchyOptions {
  type: 'pack';
}
export interface DendrogramOptions extends HierarchyOptions {
  type: 'dendrogram';
}

export interface OrgNode extends TreeDatum {
  title?: string;
  children?: OrgNode[];
}

export interface OrgChartOptions extends CommonOptions {
  type: 'orgChart';
  data: OrgNode;
}

// ---- Part-to-whole --------------------------------------------------------------------

export interface WaffleOptions extends CommonOptions {
  type: 'waffle';
  data: PieDatum[];
  /** Grid size; default 10 x 10 (each cell = 1%). */
  columns?: number;
  rows?: number;
}

export interface FunnelOptions extends CommonOptions {
  type: 'funnel';
  data: PieDatum[];
}

export interface PyramidOptions extends CommonOptions {
  type: 'pyramid';
  data: PieDatum[];
}

export interface VennSet {
  /** One name = a set's total size; two or three = their intersection. */
  sets: string[];
  size: number;
}

export interface VennOptions extends CommonOptions {
  type: 'venn';
  /** Up to three sets. */
  data: VennSet[];
}

export interface PolarAreaOptions extends CommonOptions {
  type: 'polarArea';
  data: PieDatum[];
}

export interface WindRoseOptions extends CommonOptions {
  type: 'windRose';
  /** Compass sectors, clockwise from north. */
  directions: string[];
  /** One series per speed band; values per direction, stacked outward. */
  series: BarSeries[];
}

export interface RadialLineOptions extends CommonOptions {
  type: 'radialLine';
  /** Angular categories (months, hours...). */
  categories: string[];
  series: BarSeries[];
  min?: number;
  max?: number;
}

// ---- Relationship -----------------------------------------------------------------------

export interface HexbinOptions extends CartesianOptions {
  type: 'hexbin';
  x: Numbers;
  y: Numbers;
  /** Hexagon radius in px. Default 10. */
  radius?: number;
}

export interface ContourOptions extends CartesianOptions {
  type: 'contour';
  /** Row-major grid, row 0 at the bottom. */
  data: Numbers;
  rows: number;
  cols: number;
  /** Data extent of the grid. Default: indices. */
  extent?: [number, number, number, number];
  /** Number of contour levels. Default 10. */
  levels?: number;
  scale?: 'sequential' | 'diverging';
}

export interface Density2DOptions extends CartesianOptions {
  type: 'density2d';
  x: Numbers;
  y: Numbers;
  levels?: number;
  /** Overlay the raw points (up to 20k). Default true for small data. */
  points?: boolean;
}

export interface SplomOptions extends CommonOptions {
  type: 'splom';
  dimensions: ValueGroup[];
  /** Optional grouping: group index per row plus the group names. */
  groups?: { names: string[]; index: Numbers };
}

export interface ConnectedSeries {
  name: string;
  x: Numbers;
  y: Numbers;
  /** Point labels (e.g. years); every one is shown when there are few. */
  labels?: string[];
  color?: string;
}

export interface ConnectedScatterOptions extends CartesianOptions {
  type: 'connectedScatter';
  series: ConnectedSeries[];
}

export interface ParallelOptions extends CommonOptions {
  type: 'parallel';
  dimensions: ValueGroup[];
  /** Color lines by this dimension (sequential) or by `groups`. */
  colorBy?: number;
  groups?: { names: string[]; index: Numbers };
}

export interface ChordOptions extends CommonOptions {
  type: 'chord';
  names: string[];
  /** matrix[i][j] = flow from i to j. */
  matrix: number[][];
}

export interface GraphNode {
  id: string;
  name?: string;
  group?: number;
  size?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  value?: number;
}

export interface ArcDiagramOptions extends CommonOptions {
  type: 'arcDiagram';
  nodes: GraphNode[];
  links: GraphLink[];
  groupNames?: string[];
}

export interface AdjacencyOptions extends CommonOptions {
  type: 'adjacency';
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface NetworkOptions extends CommonOptions {
  type: 'network';
  nodes: GraphNode[];
  links: GraphLink[];
  groupNames?: string[];
  zoom?: 'xy' | false;
}

export interface Network3DOptions extends Chart3DOptions {
  type: 'network3d';
  nodes: GraphNode[];
  links: GraphLink[];
  groupNames?: string[];
}

// ---- Flow & process ---------------------------------------------------------------------

export interface SankeyOptions extends CommonOptions {
  type: 'sankey';
  nodes: SankeyNodeIn[];
  links: SankeyLinkIn[];
}

export interface AlluvialOptions extends CommonOptions {
  type: 'alluvial';
  /** Column names, left to right. */
  dimensions: string[];
  /** One entry per combination: a value for every dimension, and its count. */
  rows: { values: string[]; count: number }[];
}

export interface GanttTask {
  name: string;
  /** Epoch ms. */
  start: number;
  end: number;
  /** 0–1 complete. */
  progress?: number;
  group?: string;
  dependsOn?: string[];
}

export interface GanttOptions extends CartesianOptions {
  type: 'gantt';
  tasks: GanttTask[];
  /** Draw a "today" line at this time (epoch ms). */
  today?: number;
}

export interface TimelineEvent {
  label: string;
  /** Epoch ms. */
  start: number;
  /** For spans. */
  end?: number;
  group?: string;
}

export interface TimelineOptions extends CartesianOptions {
  type: 'timeline';
  events: TimelineEvent[];
}

// ---- Matrix ------------------------------------------------------------------------------

export interface CalendarOptions extends CommonOptions {
  type: 'calendar';
  /** Epoch ms per day (any time of day). */
  dates: Numbers;
  values: Numbers;
}

// ---- KPI ---------------------------------------------------------------------------------

export interface LinearGaugeOptions extends CommonOptions {
  type: 'linearGauge';
  value: number;
  min?: number;
  max?: number;
  target?: number;
  label?: string;
  units?: string;
  bands?: GaugeBand[];
  /** 'thermometer' draws a vertical tube with a bulb. */
  variant?: 'bar' | 'thermometer';
}

export interface ProgressRingOptions extends CommonOptions {
  type: 'progressRing';
  /** Outermost first. */
  rings: { label: string; value: number; max?: number; color?: string }[];
}

export interface StatOptions extends CommonOptions {
  type: 'stat';
  value: number;
  label: string;
  /** Previous value; shows the change. */
  previous?: number;
  units?: string;
  /** Is an increase good? Default true. */
  higherIsBetter?: boolean;
  spark?: Numbers;
}

// ---- Financial -----------------------------------------------------------------------------

export interface OHLCOptions extends Omit<CandlestickOptions, 'type'> {
  type: 'ohlc';
}

export interface HeikinAshiOptions extends Omit<CandlestickOptions, 'type'> {
  type: 'heikinAshi';
}

export interface VolumeProfileOptions extends Omit<CandlestickOptions, 'type'> {
  type: 'volumeProfile';
  volume: Numbers;
  /** Price buckets. Default 24. */
  bins?: number;
}

export interface RenkoOptions extends CartesianOptions {
  type: 'renko';
  close: Numbers;
  x?: Numbers;
  /** Price per brick. Default ~5% of the price range. */
  brickSize?: number;
}

export interface PointFigureOptions extends CartesianOptions {
  type: 'pointFigure';
  close: Numbers;
  boxSize?: number;
  /** Boxes needed to reverse a column. Default 3. */
  reversal?: number;
}

export interface KagiOptions extends CartesianOptions {
  type: 'kagi';
  close: Numbers;
  x?: Numbers;
  /** Reversal amount as a fraction of price (0.04 = 4%). Default 0.04. */
  reversal?: number;
}

export interface DepthOptions extends CartesianOptions {
  type: 'depth';
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
}

// ---- Geo ----------------------------------------------------------------------------------

/** A TopoJSON topology (e.g. world-atlas `countries-110m.json`). Typed loosely so JSON imports fit. */
export interface Topology {
  type: string;
  objects: Record<string, unknown>;
  arcs: number[][][];
  transform?: { scale: number[]; translate: number[] };
}

export interface GeoBase extends CommonOptions {
  topology: Topology;
  /** Object inside the topology. Default: the first. */
  object?: string;
  projection?: 'naturalEarth' | 'equirectangular' | 'mercator';
  /** Feature names to leave out (e.g. ['Antarctica']). */
  exclude?: string[];
  zoom?: 'xy' | false;
}

export interface ChoroplethOptions extends GeoBase {
  type: 'choropleth';
  /** Keyed by feature name or id. */
  values: Record<string, number>;
  scale?: 'sequential' | 'diverging';
  center?: number;
}

export interface GeoPoint {
  lon: number;
  lat: number;
  value: number;
  label?: string;
}

export interface BubbleMapOptions extends GeoBase {
  type: 'bubbleMap';
  points: GeoPoint[];
  /** Max bubble diameter, px. Default 40. */
  maxSize?: number;
}

export interface GeoFlow {
  from: [number, number];
  to: [number, number];
  value: number;
  label?: string;
}

export interface FlowMapOptions extends GeoBase {
  type: 'flowMap';
  flows: GeoFlow[];
}

export interface HexbinMapOptions extends GeoBase {
  type: 'hexbinMap';
  lon: Numbers;
  lat: Numbers;
  radius?: number;
}

export interface GlobeOptions extends Chart3DOptions {
  type: 'globe';
  topology: Topology;
  object?: string;
  values?: Record<string, number>;
  points?: GeoPoint[];
  flows?: GeoFlow[];
}

// ---- 3D & scientific --------------------------------------------------------------------

export interface Mesh3DOptions extends Chart3DOptions {
  type: 'mesh3d';
  /** x,y,z per vertex. */
  vertices: Numbers;
  /** Triangle vertex indices. */
  indices: Numbers;
  /** Per-vertex value, colored on the sequential scale. */
  values?: Numbers;
  flatShading?: boolean;
  wireframe?: boolean;
}

export interface IsosurfaceOptions extends Chart3DOptions {
  type: 'isosurface';
  /** n x n x n scalar grid, x fastest. */
  data: Numbers;
  size: number;
  /** Iso values; inner shells opaque, outer translucent. */
  levels: number[];
}

export interface VectorFieldOptions extends CartesianOptions {
  type: 'vectorField';
  x: Numbers;
  y: Numbers;
  u: Numbers;
  v: Numbers;
}

export interface VectorField3DOptions extends Chart3DOptions {
  type: 'vectorField3d';
  x: Numbers;
  y: Numbers;
  z: Numbers;
  u: Numbers;
  v: Numbers;
  w: Numbers;
}

export interface SpectrogramOptions extends CommonOptions {
  type: 'spectrogram';
  /** Row-major power values: rows = frequency bins (low first), cols = time slices. */
  data: Numbers;
  rows: number;
  cols: number;
  /** Seconds covered by the columns. */
  duration?: number;
  /** Hz covered by the rows. */
  maxFrequency?: number;
}

export interface Waterfall3DOptions extends Chart3DOptions {
  type: 'waterfall3d';
  /** Row-major: rows = slices (time), cols = samples (frequency). */
  data: Numbers;
  rows: number;
  cols: number;
}

export interface TernaryOptions extends CommonOptions {
  type: 'ternary';
  /** Names of the three components. */
  axes: [string, string, string];
  series: { name: string; a: Numbers; b: Numbers; c: Numbers; color?: string }[];
}

export interface SmithOptions extends CommonOptions {
  type: 'smith';
  /** Normalized impedance z = r + jx per point. */
  series: { name: string; r: Numbers; x: Numbers; color?: string }[];
}

// ---- Added: text, statistics, ML, financial indicators, more geo -----------------------

export interface WordCloudWord {
  text: string;
  /** Frequency or weight; sets the font size. */
  value: number;
  /** Optional category; colors the word and adds a legend. */
  group?: string;
}

export interface WordCloudOptions extends CommonOptions {
  type: 'wordCloud';
  words: WordCloudWord[];
  /** 'mixed' sets about a quarter of the words vertical. Default 'mixed'. */
  rotate?: 'none' | 'mixed';
  /** Font size range in CSS px. Default [11, fitted to the box]. */
  fontSize?: [number, number];
  /** Largest words kept. Default 150. */
  maxWords?: number;
}

export interface ParetoOptions extends CartesianOptions {
  type: 'pareto';
  data: { label: string; value: number }[];
  name?: string;
  /** Cumulative share marking the "vital few". Default 0.8. */
  threshold?: number;
}

export interface ErrorBarSeries {
  name: string;
  /** Numeric x, or category index when `categories` is set. Default: the point index. */
  x?: Numbers;
  y: Numbers;
  /** Symmetric error (y ± error). */
  error?: Numbers;
  /** Asymmetric interval bounds (used instead of `error`). */
  low?: Numbers;
  high?: Numbers;
  color?: string;
}

export interface ErrorBarOptions extends CartesianOptions {
  type: 'errorBar';
  categories?: string[];
  series: ErrorBarSeries[];
}

export interface ConfidenceBandSeries {
  name: string;
  x?: Numbers;
  /** Central estimate. */
  y: Numbers;
  /** Intervals around y, widest first (e.g. 95% then 50%). */
  bands: { lower: Numbers; upper: Numbers; label?: string }[];
  color?: string;
}

export interface ConfidenceBandOptions extends CartesianOptions {
  type: 'confidenceBand';
  series: ConfidenceBandSeries[];
}

export interface PopulationPyramidOptions extends CartesianOptions {
  type: 'populationPyramid';
  /** Row labels, bottom to top (youngest first). */
  categories: string[];
  left: { name: string; values: Numbers; color?: string };
  right: { name: string; values: Numbers; color?: string };
}

export interface VoronoiOptions extends CartesianOptions {
  type: 'voronoi';
  x: Numbers;
  y: Numbers;
  labels?: string[];
  /** Category per point: colors cells and adds a legend. */
  groups?: string[];
  /** Value per point: shades cells on the sequential ramp (when no groups). */
  values?: Numbers;
  showPoints?: boolean;
}

export interface CartogramOptions extends GeoBase {
  type: 'cartogram';
  /** Keyed by feature name or id. Circle area is proportional to the value. */
  values: Record<string, number>;
  /** Faint country shapes behind the circles. Default true. */
  basemap?: boolean;
  /** Tooltip label for the value. Default 'Value'. */
  label?: string;
}

export interface DotDensityOptions extends GeoBase {
  type: 'dotDensity';
  /** Keyed by feature name or id: a total, or totals per category ({ Urban: 3e6, Rural: 1e6 }). */
  values: Record<string, number | Record<string, number>>;
  /** Units one dot stands for. Default: the total spread over about 15,000 dots. */
  dotValue?: number;
  /** Dot diameter in CSS px. Default 2. */
  dotSize?: number;
}

export interface PolarScatterOptions extends CommonOptions {
  type: 'polarScatter';
  series: { name: string; theta: Numbers; r: Numbers; color?: string }[];
  /** Default 'degrees' (0 at the top, clockwise). */
  angleUnit?: 'degrees' | 'radians';
}

export interface MindMapOptions extends CommonOptions {
  type: 'mindMap';
  /** The central topic; children branch out to both sides. */
  data: TreeDatum;
}

export interface MacdOptions extends CartesianOptions {
  type: 'macd';
  x?: Numbers;
  close: Numbers;
  /** Default 12, 26 and 9. */
  fast?: number;
  slow?: number;
  signal?: number;
}

export interface RsiOptions extends CartesianOptions {
  type: 'rsi';
  x?: Numbers;
  close: Numbers;
  /** Default 14. */
  period?: number;
  /** Reference lines. Default 70 and 30. */
  overbought?: number;
  oversold?: number;
}

export interface ConfusionMatrixOptions extends CommonOptions {
  type: 'confusionMatrix';
  /** Class names, in matrix order. */
  labels: string[];
  /** matrix[actual][predicted] = count. */
  matrix: number[][];
  /** 'row' shows recall per actual class, 'column' precision per predicted class. Default 'none' (counts). */
  normalize?: 'none' | 'row' | 'column';
}

export interface RocSeries {
  name: string;
  /** True classes (1 = positive, 0 = negative) and model scores; the curve is computed from these. */
  actual?: Numbers;
  score?: Numbers;
  /** Or a precomputed curve: FPR/TPR for ROC, recall/precision for PR. */
  x?: Numbers;
  y?: Numbers;
  color?: string;
}

export interface RocCurveOptions extends CartesianOptions {
  type: 'rocCurve';
  /** 'roc' (TPR vs FPR) or 'pr' (precision vs recall). Default 'roc'. */
  kind?: 'roc' | 'pr';
  series: RocSeries[];
}

export type ExtraOptions =
  | WordCloudOptions
  | ParetoOptions
  | ErrorBarOptions
  | ConfidenceBandOptions
  | PopulationPyramidOptions
  | VoronoiOptions
  | CartogramOptions
  | DotDensityOptions
  | PolarScatterOptions
  | MindMapOptions
  | MacdOptions
  | RsiOptions
  | ConfusionMatrixOptions
  | RocCurveOptions
  | LollipopOptions
  | DotPlotOptions
  | DumbbellOptions
  | RangeBarOptions
  | BulletOptions
  | WaterfallOptions
  | MarimekkoOptions
  | PictographOptions
  | RadialBarOptions
  | RangeAreaOptions
  | SlopeOptions
  | BumpOptions
  | HorizonOptions
  | SparklineOptions
  | BoxOptions
  | ViolinOptions
  | DensityOptions
  | RidgelineOptions
  | BeeswarmOptions
  | StripOptions
  | EcdfOptions
  | QQOptions
  | TreemapOptions
  | SunburstOptions
  | IcicleOptions
  | PackOptions
  | DendrogramOptions
  | OrgChartOptions
  | WaffleOptions
  | FunnelOptions
  | PyramidOptions
  | VennOptions
  | PolarAreaOptions
  | WindRoseOptions
  | RadialLineOptions
  | HexbinOptions
  | ContourOptions
  | Density2DOptions
  | SplomOptions
  | ConnectedScatterOptions
  | ParallelOptions
  | ChordOptions
  | ArcDiagramOptions
  | AdjacencyOptions
  | NetworkOptions
  | Network3DOptions
  | SankeyOptions
  | AlluvialOptions
  | GanttOptions
  | TimelineOptions
  | CalendarOptions
  | LinearGaugeOptions
  | ProgressRingOptions
  | StatOptions
  | OHLCOptions
  | HeikinAshiOptions
  | VolumeProfileOptions
  | RenkoOptions
  | PointFigureOptions
  | KagiOptions
  | DepthOptions
  | ChoroplethOptions
  | BubbleMapOptions
  | FlowMapOptions
  | HexbinMapOptions
  | GlobeOptions
  | Mesh3DOptions
  | IsosurfaceOptions
  | VectorFieldOptions
  | VectorField3DOptions
  | SpectrogramOptions
  | Waterfall3DOptions
  | TernaryOptions
  | SmithOptions;
