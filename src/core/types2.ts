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

// ---- Added: more types found across other libraries -------------------------------------

export interface BaselineOptions extends CartesianOptions {
  type: 'baseline';
  /** Epoch ms or index per point (sorted). */
  x?: Numbers;
  y: Numbers;
  name?: string;
  /** Value the areas are measured from. Default: the first value. */
  baseline?: number;
}

export interface DifferenceOptions extends CartesianOptions {
  type: 'difference';
  x?: Numbers;
  /** The gap between the two is shaded in the color of whichever is higher. */
  a: { name: string; y: Numbers };
  b: { name: string; y: Numbers };
}

export interface DivergingBarOptions extends CartesianOptions {
  type: 'divergingBar';
  /** Rows, e.g. survey questions. */
  categories: string[];
  /** Answer levels from most negative to most positive, with a count per row. */
  levels: { name: string; values: Numbers }[];
  /** Index of the neutral level, split across zero. Default: the middle level when the count is odd. */
  neutral?: number;
  /** Show shares of each row (default) or raw counts. */
  percent?: boolean;
}

export interface VariwideOptions extends CartesianOptions {
  type: 'variwide';
  /** Bar height from `value`, bar width from `width`. */
  data: { label: string; value: number; width: number }[];
  valueName?: string;
  widthName?: string;
}

export interface VariablePieOptions extends CommonOptions {
  type: 'variablePie';
  /** Slice angle from `value`, slice radius from `z`. */
  data: { label: string; value: number; z: number; color?: string }[];
  valueName?: string;
  zName?: string;
  /** Inner radius as a fraction of the smallest slice. Default 0.3. */
  innerRadius?: number;
}

export interface ParliamentOptions extends CommonOptions {
  type: 'parliament';
  /** One dot per unit of value (seats, people...). */
  data: { label: string; value: number; color?: string }[];
  /** Half-circle seating (default) or a grid of items. */
  layout?: 'arc' | 'grid';
}

export interface PackedBubbleOptions extends CommonOptions {
  type: 'packedBubble';
  /** Circle area = value. Items with a `group` cluster together and share a color. */
  data: { label: string; value: number; group?: string }[];
}

export interface QuadrantOptions extends CartesianOptions {
  type: 'quadrant';
  points: { label: string; x: number; y: number; size?: number }[];
  /** Where the dividing lines sit. Default: the middle of each axis. */
  xSplit?: number;
  ySplit?: number;
  /** Quadrant names: top-left, top-right, bottom-left, bottom-right. */
  quadrants?: [string, string, string, string];
}

export interface StemOptions extends CartesianOptions {
  type: 'stem';
  series: XYSeries[];
  /** Where stems start. Default 0. */
  baseline?: number;
}

export interface JumpLineOptions extends CartesianOptions {
  type: 'jumpLine';
  categories: string[];
  /** One flat tick per category; no connecting lines. */
  series: BarSeries[];
}

export interface DotHistogramOptions extends CartesianOptions {
  type: 'dotHistogram';
  /** Each value is one stacked dot (Wilkinson dot plot). */
  values: Numbers;
  name?: string;
  /** Bin width in data units. Default: about 30 bins. */
  binWidth?: number;
}

export interface WinLossOptions extends CommonOptions {
  type: 'winLoss';
  /** Positive = win, negative = loss, 0 = draw. */
  values: Numbers;
  labels?: string[];
}

export interface AreaBumpOptions extends CartesianOptions {
  type: 'areaBump';
  /** Time points. */
  categories: string[];
  /** Value per time point; bands are stacked by rank at each point, thickness = value. */
  series: BarSeries[];
}

export interface SmallMultiplesOptions extends CommonOptions {
  type: 'smallMultiples';
  /** One panel per series. */
  series: XYSeries[];
  /** Panels per row. Default: as many as fit. */
  columns?: number;
  /** Default 'area'. */
  mark?: 'line' | 'area' | 'bar';
  /** Same y scale in every panel (default), so panels compare honestly. */
  sharedScale?: boolean;
}

export interface NavigatorOptions extends CartesianOptions {
  type: 'navigator';
  /** Overview series (usually the same data as the main chart). */
  x?: Numbers;
  y: Numbers;
  name?: string;
  /** Charts with this sync key follow the brush. */
  sync: string;
}

export interface WindBarbOptions extends CartesianOptions {
  type: 'windBarb';
  /** Epoch ms or index per reading. */
  x?: Numbers;
  /** Wind speed in knots. */
  speed: Numbers;
  /** Direction the wind blows from, degrees (0 = north, 90 = east). */
  direction: Numbers;
}

export interface RadialTreeOptions extends CommonOptions {
  type: 'radialTree';
  data: TreeDatum;
}

export interface EdgeBundlingOptions extends CommonOptions {
  type: 'edgeBundling';
  /** Leaves are the nodes, placed on a circle; inner levels group them. */
  data: TreeDatum;
  /** Connections between leaf names. */
  links: { source: string; target: string }[];
  /** 0 = straight lines, 1 = tightly bundled. Default 0.85. */
  bundle?: number;
}

export interface TileMapOptions extends CommonOptions {
  type: 'tileMap';
  /** One equal-size tile per region at a grid position (row 0 at the top). */
  tiles: { id: string; label?: string; col: number; row: number; value: number }[];
  shape?: 'square' | 'hex';
  scale?: 'sequential' | 'diverging';
  center?: number;
}

export interface SpikeMapOptions extends GeoBase {
  type: 'spikeMap';
  points: { lon: number; lat: number; value: number; label?: string }[];
  /** Tallest spike in CSS px. Default 80. */
  maxHeight?: number;
}

export interface DensityMapOptions extends GeoBase {
  type: 'densityMap';
  lon: Numbers;
  lat: Numbers;
  weight?: Numbers;
  /** Smoothing radius in CSS px. Default 10. */
  radius?: number;
}

export interface Map3DOptions extends Chart3DOptions {
  type: 'map3d';
  topology: Topology;
  object?: string;
  exclude?: string[];
  /** Keyed by feature name or id; sets each region's height and color. */
  values: Record<string, number>;
  projection?: 'naturalEarth' | 'equirectangular' | 'mercator';
}

export interface LineBreakOptions extends CartesianOptions {
  type: 'lineBreak';
  x?: Numbers;
  close: Numbers;
  /** Lines a reversal must break. Default 3. */
  lines?: number;
}

export interface HollowCandleOptions extends Omit<CandlestickOptions, 'type'> {
  type: 'hollowCandle';
}

export interface HLCOptions extends Omit<CandlestickOptions, 'type' | 'open'> {
  type: 'hlc';
  open?: Numbers;
}

export interface LiquidGaugeOptions extends CommonOptions {
  type: 'liquidGauge';
  value: number;
  min?: number;
  max?: number;
  label?: string;
  format?: (v: number) => string;
  /** Default 'circle'. */
  shape?: 'circle' | 'tank';
}

export interface RadialHeatmapOptions extends CommonOptions {
  type: 'radialHeatmap';
  /** Around the circle, e.g. hours. */
  angles: string[];
  /** Rings from the center out, e.g. weekdays. */
  rings: string[];
  /** Row-major: rings.length x angles.length. */
  data: Numbers;
}

export interface Histogram2DOptions extends CartesianOptions {
  type: 'histogram2d';
  x: Numbers;
  y: Numbers;
  /** Bins along x and y. Default [40, 30]. */
  bins?: [number, number];
}

export interface StreamlineOptions extends CartesianOptions {
  type: 'streamline';
  /** Vector field on a grid: row-major u (x) and v (y), rows x cols, row 0 at the bottom. */
  cols: number;
  rows: number;
  u: Numbers;
  v: Numbers;
  /** Data range the grid covers. Default 0..cols-1, 0..rows-1. */
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  /** Distance between streamlines in CSS px. Default 22. */
  spacing?: number;
}

export type ExtraOptions =
  | BaselineOptions
  | DifferenceOptions
  | DivergingBarOptions
  | VariwideOptions
  | VariablePieOptions
  | ParliamentOptions
  | PackedBubbleOptions
  | QuadrantOptions
  | StemOptions
  | JumpLineOptions
  | DotHistogramOptions
  | WinLossOptions
  | AreaBumpOptions
  | SmallMultiplesOptions
  | NavigatorOptions
  | WindBarbOptions
  | RadialTreeOptions
  | EdgeBundlingOptions
  | TileMapOptions
  | SpikeMapOptions
  | DensityMapOptions
  | Map3DOptions
  | LineBreakOptions
  | HollowCandleOptions
  | HLCOptions
  | LiquidGaugeOptions
  | RadialHeatmapOptions
  | Histogram2DOptions
  | StreamlineOptions
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
