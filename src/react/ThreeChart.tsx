import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react';
import { createChart, type Chart, type ChartOptions, type ChartType, type OptionsFor } from '../core';

export interface ChartHandle {
  update(options: Partial<ChartOptions>): void;
  resetView(): void;
  toPNG(): string;
  toCSV(): string | null;
  download(format?: 'png' | 'csv', filename?: string): void;
}

interface BoxProps {
  /** Chart height. The chart fills its box. Default 320. */
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

export type ThreeChartProps = ChartOptions & BoxProps;

/** Option values that change on every render (callbacks) must not trigger a rebuild. */
function changed(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    if (typeof next[k] === 'function' || typeof prev[k] === 'function') continue;
    if (prev[k] !== next[k]) return true;
  }
  return false;
}

/** `next`, plus `undefined` for props that were removed, so the chart drops them instead of keeping the old value. */
function withRemoved<T>(prev: T, next: T): T {
  const out = { ...next } as Record<string, unknown>;
  for (const k of Object.keys(prev as object)) if (!(k in out)) out[k] = undefined;
  return out as T;
}

/**
 * Generic chart component: `<ThreeChart type="line" series={...} />`.
 *
 * Options are compared by reference, so memoize big arrays (useMemo) to avoid
 * re-uploading data on unrelated re-renders.
 */
export const ThreeChart = forwardRef<ChartHandle, ThreeChartProps>(function ThreeChart(props, ref) {
  const { height = 320, className, style, ...options } = props;
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<Chart | null>(null);
  const latest = useRef(options);
  const applied = useRef(options);
  latest.current = options;

  // Callbacks always reach the latest props without recreating the chart.
  const withHandlers = (o: ChartOptions): ChartOptions => ({
    ...o,
    onClick: (h) => latest.current.onClick?.(h),
    onHover: (h) => latest.current.onHover?.(h),
  });

  useEffect(() => {
    chart.current = createChart(el.current!, withHandlers(latest.current as ChartOptions));
    applied.current = latest.current;
    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
    // Recreate only when the chart type changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.type]);

  useEffect(() => {
    if (!chart.current) return;
    if (changed(applied.current as Record<string, unknown>, options as Record<string, unknown>)) {
      chart.current.update(withHandlers(withRemoved(applied.current, options) as ChartOptions));
      applied.current = options;
    }
  });

  useImperativeHandle(ref, () => ({
    update: (o) => chart.current?.update(o),
    resetView: () => chart.current?.resetView(),
    toPNG: () => chart.current?.toPNG() ?? '',
    toCSV: () => chart.current?.toCSV() ?? null,
    download: (format, filename) => chart.current?.download(format, filename),
  }));

  return <div ref={el} className={className} style={{ height, position: 'relative', ...style }} />;
});

// ---- Typed per-chart components ----------------------------------------------------

type Props<T extends ChartType> = OptionsFor<T> & BoxProps;

function typed<T extends ChartType>(type: T, name: string) {
  const C = forwardRef<ChartHandle, Props<T>>((p, ref) => <ThreeChart ref={ref} {...({ ...p, type } as unknown as ThreeChartProps)} />);
  C.displayName = name;
  return C;
}

export const LineChart = typed('line', 'LineChart');
export const AreaChart = typed('area', 'AreaChart');
export const BarChart = typed('bar', 'BarChart');
export const HistogramChart = typed('histogram', 'HistogramChart');
export const ScatterChart = typed('scatter', 'ScatterChart');
export const BubbleChart = typed('bubble', 'BubbleChart');
export const HeatmapChart = typed('heatmap', 'HeatmapChart');
export const CandlestickChart = typed('candlestick', 'CandlestickChart');
export const PieChart = typed('pie', 'PieChart');
export const DonutChart = typed('donut', 'DonutChart');
export const SemiDonutChart = typed('semiDonut', 'SemiDonutChart');
export const RadarChart = typed('radar', 'RadarChart');
export const GaugeChart = typed('gauge', 'GaugeChart');
export const LollipopChart = typed('lollipop', 'LollipopChart');
export const DotPlotChart = typed('dotplot', 'DotPlotChart');
export const DumbbellChart = typed('dumbbell', 'DumbbellChart');
export const RangeBarChart = typed('rangeBar', 'RangeBarChart');
export const BulletChart = typed('bullet', 'BulletChart');
export const WaterfallChart = typed('waterfall', 'WaterfallChart');
export const MarimekkoChart = typed('marimekko', 'MarimekkoChart');
export const PictographChart = typed('pictograph', 'PictographChart');
export const RadialBarChart = typed('radialBar', 'RadialBarChart');
export const RangeAreaChart = typed('rangeArea', 'RangeAreaChart');
export const SlopeChart = typed('slope', 'SlopeChart');
export const BumpChart = typed('bump', 'BumpChart');
export const HorizonChart = typed('horizon', 'HorizonChart');
export const SparklineChart = typed('sparkline', 'SparklineChart');
export const BoxChart = typed('box', 'BoxChart');
export const ViolinChart = typed('violin', 'ViolinChart');
export const DensityChart = typed('density', 'DensityChart');
export const RidgelineChart = typed('ridgeline', 'RidgelineChart');
export const BeeswarmChart = typed('beeswarm', 'BeeswarmChart');
export const StripChart = typed('strip', 'StripChart');
export const ECDFChart = typed('ecdf', 'ECDFChart');
export const QQChart = typed('qq', 'QQChart');
export const TreemapChart = typed('treemap', 'TreemapChart');
export const SunburstChart = typed('sunburst', 'SunburstChart');
export const IcicleChart = typed('icicle', 'IcicleChart');
export const PackChart = typed('pack', 'PackChart');
export const DendrogramChart = typed('dendrogram', 'DendrogramChart');
export const OrgChart = typed('orgChart', 'OrgChart');
export const WaffleChart = typed('waffle', 'WaffleChart');
export const FunnelChart = typed('funnel', 'FunnelChart');
export const PyramidChart = typed('pyramid', 'PyramidChart');
export const VennChart = typed('venn', 'VennChart');
export const PolarAreaChart = typed('polarArea', 'PolarAreaChart');
export const WindRoseChart = typed('windRose', 'WindRoseChart');
export const RadialLineChart = typed('radialLine', 'RadialLineChart');
export const HexbinChart = typed('hexbin', 'HexbinChart');
export const ContourChart = typed('contour', 'ContourChart');
export const Density2DChart = typed('density2d', 'Density2DChart');
export const SplomChart = typed('splom', 'SplomChart');
export const ConnectedScatterChart = typed('connectedScatter', 'ConnectedScatterChart');
export const ParallelChart = typed('parallel', 'ParallelChart');
export const ChordChart = typed('chord', 'ChordChart');
export const ArcDiagramChart = typed('arcDiagram', 'ArcDiagramChart');
export const AdjacencyChart = typed('adjacency', 'AdjacencyChart');
export const NetworkChart = typed('network', 'NetworkChart');
export const Network3DChart = typed('network3d', 'Network3DChart');
export const SankeyChart = typed('sankey', 'SankeyChart');
export const AlluvialChart = typed('alluvial', 'AlluvialChart');
export const GanttChart = typed('gantt', 'GanttChart');
export const TimelineChart = typed('timeline', 'TimelineChart');
export const CalendarChart = typed('calendar', 'CalendarChart');
export const LinearGaugeChart = typed('linearGauge', 'LinearGaugeChart');
export const ProgressRingChart = typed('progressRing', 'ProgressRingChart');
export const StatChart = typed('stat', 'StatChart');
export const OHLCChart = typed('ohlc', 'OHLCChart');
export const HeikinAshiChart = typed('heikinAshi', 'HeikinAshiChart');
export const VolumeProfileChart = typed('volumeProfile', 'VolumeProfileChart');
export const RenkoChart = typed('renko', 'RenkoChart');
export const PointFigureChart = typed('pointFigure', 'PointFigureChart');
export const KagiChart = typed('kagi', 'KagiChart');
export const DepthChart = typed('depth', 'DepthChart');
export const ChoroplethChart = typed('choropleth', 'ChoroplethChart');
export const BubbleMapChart = typed('bubbleMap', 'BubbleMapChart');
export const FlowMapChart = typed('flowMap', 'FlowMapChart');
export const HexbinMapChart = typed('hexbinMap', 'HexbinMapChart');
export const GlobeChart = typed('globe', 'GlobeChart');
export const Bar3DChart = typed('bar3d', 'Bar3DChart');
export const Scatter3DChart = typed('scatter3d', 'Scatter3DChart');
export const Line3DChart = typed('line3d', 'Line3DChart');
export const Surface3DChart = typed('surface3d', 'Surface3DChart');
export const Mesh3DChart = typed('mesh3d', 'Mesh3DChart');
export const IsosurfaceChart = typed('isosurface', 'IsosurfaceChart');
export const VectorFieldChart = typed('vectorField', 'VectorFieldChart');
export const VectorField3DChart = typed('vectorField3d', 'VectorField3DChart');
export const SpectrogramChart = typed('spectrogram', 'SpectrogramChart');
export const Waterfall3DChart = typed('waterfall3d', 'Waterfall3DChart');
export const TernaryChart = typed('ternary', 'TernaryChart');
export const SmithChart = typed('smith', 'SmithChart');
export const WordCloudChart = typed('wordCloud', 'WordCloudChart');
export const ParetoChart = typed('pareto', 'ParetoChart');
export const PopulationPyramidChart = typed('populationPyramid', 'PopulationPyramidChart');
export const ConfidenceBandChart = typed('confidenceBand', 'ConfidenceBandChart');
export const ErrorBarChart = typed('errorBar', 'ErrorBarChart');
export const MindMapChart = typed('mindMap', 'MindMapChart');
export const VoronoiChart = typed('voronoi', 'VoronoiChart');
export const PolarScatterChart = typed('polarScatter', 'PolarScatterChart');
export const ConfusionMatrixChart = typed('confusionMatrix', 'ConfusionMatrixChart');
export const RocCurveChart = typed('rocCurve', 'RocCurveChart');
export const MacdChart = typed('macd', 'MacdChart');
export const RsiChart = typed('rsi', 'RsiChart');
export const CartogramChart = typed('cartogram', 'CartogramChart');
export const DotDensityChart = typed('dotDensity', 'DotDensityChart');
export const BaselineChart = typed('baseline', 'BaselineChart');
export const DifferenceChart = typed('difference', 'DifferenceChart');
export const AreaBumpChart = typed('areaBump', 'AreaBumpChart');
export const SmallMultiplesChart = typed('smallMultiples', 'SmallMultiplesChart');
export const NavigatorChart = typed('navigator', 'NavigatorChart');
export const WindBarbChart = typed('windBarb', 'WindBarbChart');
export const DivergingBarChart = typed('divergingBar', 'DivergingBarChart');
export const VariwideChart = typed('variwide', 'VariwideChart');
export const PackedBubbleChart = typed('packedBubble', 'PackedBubbleChart');
export const QuadrantChart = typed('quadrant', 'QuadrantChart');
export const StemChart = typed('stem', 'StemChart');
export const JumpLineChart = typed('jumpLine', 'JumpLineChart');
export const DotHistogramChart = typed('dotHistogram', 'DotHistogramChart');
export const WinLossChart = typed('winLoss', 'WinLossChart');
export const VariablePieChart = typed('variablePie', 'VariablePieChart');
export const ParliamentChart = typed('parliament', 'ParliamentChart');
export const RadialTreeChart = typed('radialTree', 'RadialTreeChart');
export const EdgeBundlingChart = typed('edgeBundling', 'EdgeBundlingChart');
export const RadialHeatmapChart = typed('radialHeatmap', 'RadialHeatmapChart');
export const LiquidGaugeChart = typed('liquidGauge', 'LiquidGaugeChart');
export const TileMapChart = typed('tileMap', 'TileMapChart');
export const SpikeMapChart = typed('spikeMap', 'SpikeMapChart');
export const DensityMapChart = typed('densityMap', 'DensityMapChart');
export const Map3DChart = typed('map3d', 'Map3DChart');
export const LineBreakChart = typed('lineBreak', 'LineBreakChart');
export const HollowCandleChart = typed('hollowCandle', 'HollowCandleChart');
export const HLCChart = typed('hlc', 'HLCChart');
export const Histogram2DChart = typed('histogram2d', 'Histogram2DChart');
export const StreamlineChart = typed('streamline', 'StreamlineChart');
