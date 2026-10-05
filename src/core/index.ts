import { BarChart, HistogramChart } from './charts/bar';
import { CandlestickChart, VolumeProfileChart } from './charts/candlestick';
import { HeatmapChart } from './charts/heatmap';
import { LineChart } from './charts/line';
import { GaugeChart, PieChart, RadarChart } from './charts/polar';
import { ScatterChart } from './charts/scatter';
import { Bar3DChart, Line3DChart, Scatter3DChart, Surface3DChart } from './charts/three-d';
import { BulletChart, DotPlotChart, DumbbellChart, LollipopChart, MarimekkoChart, PictographChart, RadialBarChart, RangeBarChart, WaterfallChart } from './charts/comparison';
import { BumpChart, HorizonChart, RangeAreaChart, SlopeChart, SparklineChart } from './charts/trend';
import { BeeswarmChart, BoxChart, DensityChart, EcdfChart, QQChart, RidgelineChart, StripChart, ViolinChart } from './charts/distribution';
import { DendrogramChart, IcicleChart, OrgChart, PackChart, SunburstChart, TreemapChart } from './charts/hierarchy';
import { FunnelChart, PolarAreaChart, PyramidChart, RadialLineChart, VennChart, WaffleChart, WindRoseChart } from './charts/partwhole';
import { ArcDiagramChart, ChordChart, ConnectedScatterChart, ContourChart, Density2DChart, HexbinChart, ParallelChart, SplomChart } from './charts/relationship';
import { AlluvialChart, CalendarChart, GanttChart, SankeyChart, TimelineChart } from './charts/flow';
import { Network3DChart, NetworkChart } from './charts/network';
import { LinearGaugeChart, ProgressRingChart, StatChart } from './charts/kpi';
import { DepthChart, KagiChart, MacdChart, PointFigureChart, RenkoChart, RsiChart } from './charts/financial';
import { BubbleMapChart, CartogramChart, ChoroplethChart, DotDensityChart, FlowMapChart, GlobeChart, HexbinMapChart } from './charts/geo';
import { SmithChart, TernaryChart, VectorFieldChart } from './charts/scientific';
import { IsosurfaceChart, Mesh3DChart, VectorField3DChart, Waterfall3DChart } from './charts/three-d-extra';
import { AdjacencyChart, SpectrogramChart } from './charts/adapters';
import { MindMapChart, WordCloudChart } from './charts/text';
import { ConfidenceBandChart, ErrorBarChart, ParetoChart, PopulationPyramidChart } from './charts/statistical';
import { PolarScatterChart, VoronoiChart } from './charts/spatial';
import { ConfusionMatrixChart, RocCurveChart } from './charts/ml';
import type { Chart, ChartOptions, ChartType } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctor = new (el: HTMLElement, opts: any) => Chart;

const registry: Record<ChartType, Ctor> = {
  // Core
  line: LineChart,
  area: LineChart,
  bar: BarChart,
  histogram: HistogramChart,
  scatter: ScatterChart,
  bubble: ScatterChart,
  heatmap: HeatmapChart,
  candlestick: CandlestickChart,
  pie: PieChart,
  donut: PieChart,
  semiDonut: PieChart,
  radar: RadarChart,
  gauge: GaugeChart,
  // Comparison
  lollipop: LollipopChart,
  dotplot: DotPlotChart,
  dumbbell: DumbbellChart,
  rangeBar: RangeBarChart,
  bullet: BulletChart,
  waterfall: WaterfallChart,
  marimekko: MarimekkoChart,
  pictograph: PictographChart,
  radialBar: RadialBarChart,
  // Trend
  rangeArea: RangeAreaChart,
  slope: SlopeChart,
  bump: BumpChart,
  horizon: HorizonChart,
  sparkline: SparklineChart,
  // Distribution
  box: BoxChart,
  violin: ViolinChart,
  density: DensityChart,
  ridgeline: RidgelineChart,
  beeswarm: BeeswarmChart,
  strip: StripChart,
  ecdf: EcdfChart,
  qq: QQChart,
  // Hierarchy & part-to-whole
  treemap: TreemapChart,
  sunburst: SunburstChart,
  icicle: IcicleChart,
  pack: PackChart,
  dendrogram: DendrogramChart,
  orgChart: OrgChart,
  waffle: WaffleChart,
  funnel: FunnelChart,
  pyramid: PyramidChart,
  venn: VennChart,
  polarArea: PolarAreaChart,
  windRose: WindRoseChart,
  radialLine: RadialLineChart,
  // Relationship
  hexbin: HexbinChart,
  contour: ContourChart,
  density2d: Density2DChart,
  splom: SplomChart,
  connectedScatter: ConnectedScatterChart,
  parallel: ParallelChart,
  chord: ChordChart,
  arcDiagram: ArcDiagramChart,
  adjacency: AdjacencyChart,
  network: NetworkChart,
  network3d: Network3DChart,
  // Flow & time
  sankey: SankeyChart,
  alluvial: AlluvialChart,
  gantt: GanttChart,
  timeline: TimelineChart,
  calendar: CalendarChart,
  // KPI
  linearGauge: LinearGaugeChart,
  progressRing: ProgressRingChart,
  stat: StatChart,
  // Financial
  ohlc: CandlestickChart,
  heikinAshi: CandlestickChart,
  volumeProfile: VolumeProfileChart,
  renko: RenkoChart,
  pointFigure: PointFigureChart,
  kagi: KagiChart,
  depth: DepthChart,
  // Geo
  choropleth: ChoroplethChart,
  bubbleMap: BubbleMapChart,
  flowMap: FlowMapChart,
  hexbinMap: HexbinMapChart,
  globe: GlobeChart,
  // 3D & scientific
  bar3d: Bar3DChart,
  scatter3d: Scatter3DChart,
  line3d: Line3DChart,
  surface3d: Surface3DChart,
  mesh3d: Mesh3DChart,
  isosurface: IsosurfaceChart,
  vectorField: VectorFieldChart,
  vectorField3d: VectorField3DChart,
  spectrogram: SpectrogramChart,
  waterfall3d: Waterfall3DChart,
  ternary: TernaryChart,
  smith: SmithChart,
  // Added
  wordCloud: WordCloudChart,
  pareto: ParetoChart,
  populationPyramid: PopulationPyramidChart,
  confidenceBand: ConfidenceBandChart,
  errorBar: ErrorBarChart,
  mindMap: MindMapChart,
  voronoi: VoronoiChart,
  polarScatter: PolarScatterChart,
  confusionMatrix: ConfusionMatrixChart,
  rocCurve: RocCurveChart,
  macd: MacdChart,
  rsi: RsiChart,
  cartogram: CartogramChart,
  dotDensity: DotDensityChart,
};

/**
 * Render a chart into `container`. The container needs a height (the chart fills it).
 *
 * ```js
 * const chart = createChart(document.getElementById('sales'), {
 *   type: 'bar',
 *   categories: ['Q1', 'Q2', 'Q3'],
 *   series: [{ name: 'Revenue', data: [12, 19, 15] }],
 * });
 * chart.update({ series: [...] });
 * chart.destroy();
 * ```
 */
export function createChart(container: HTMLElement, options: ChartOptions): Chart<ChartOptions> {
  const C = registry[options.type];
  if (!C) throw new Error(`three-charts: unknown chart type "${options.type}"`);
  return new C(container, options) as Chart<ChartOptions>;
}

export const chartTypes = Object.keys(registry) as ChartType[];

export * from './types';
export * from './types2';
export { LIGHT, DARK, type Theme, type ThemeMode } from './theme';
export { topoFeatures, type GeoFeature } from './geo';
