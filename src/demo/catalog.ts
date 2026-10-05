/** Chart types found across today's charting libraries, and which ones this library ships. */
export interface CatalogEntry {
  name: string;
  dim: '2D' | '3D' | '2D/3D';
  /** Demo id when built here. */
  demo?: string;
  note?: string;
}

export interface CatalogGroup {
  group: string;
  purpose: string;
  items: CatalogEntry[];
}

export const CATALOG: CatalogGroup[] = [
  {
    group: 'Comparison',
    purpose: 'Compare values across categories',
    items: [
      { name: 'Column / vertical bar', dim: '2D', demo: 'bar' },
      { name: 'Horizontal bar', dim: '2D', demo: 'bar-horizontal' },
      { name: 'Grouped bar', dim: '2D', demo: 'bar' },
      { name: 'Stacked bar', dim: '2D', demo: 'bar-stacked' },
      { name: '100% stacked bar', dim: '2D', demo: 'bar-percent' },
      { name: 'Lollipop', dim: '2D', demo: 'lollipop' },
      { name: 'Dot plot', dim: '2D', demo: 'dotplot' },
      { name: 'Dumbbell', dim: '2D', demo: 'dumbbell' },
      { name: 'Bullet chart', dim: '2D', demo: 'bullet' },
      { name: 'Radial bar', dim: '2D', demo: 'radialBar' },
      { name: 'Waterfall', dim: '2D', demo: 'waterfall' },
      { name: 'Marimekko / Mekko', dim: '2D', demo: 'marimekko' },
      { name: 'Range / floating bar', dim: '2D', demo: 'rangeBar' },
      { name: 'Pictograph', dim: '2D', demo: 'pictograph' },
      { name: 'Pareto chart', dim: '2D', demo: 'pareto' },
      { name: 'Population pyramid (back-to-back bar)', dim: '2D', demo: 'populationPyramid' },
      { name: 'Word cloud', dim: '2D', demo: 'wordCloud' },
    ],
  },
  {
    group: 'Trend over time',
    purpose: 'Show change across a continuous axis',
    items: [
      { name: 'Line', dim: '2D', demo: 'line' },
      { name: 'Large-data line (1M+)', dim: '2D', demo: 'line-1m' },
      { name: 'Step line', dim: '2D', demo: 'step' },
      { name: 'Area', dim: '2D', demo: 'area' },
      { name: 'Spline / smoothed line', dim: '2D', demo: 'spline' },
      { name: 'Stacked area', dim: '2D', demo: 'area-stacked' },
      { name: '100% stacked area', dim: '2D', demo: 'area-percent' },
      { name: 'Streamgraph', dim: '2D', demo: 'streamgraph' },
      { name: 'Confidence band / fan chart', dim: '2D', demo: 'confidenceBand' },
      { name: 'Range area / band', dim: '2D', demo: 'rangeArea' },
      { name: 'Sparkline', dim: '2D', demo: 'sparkline' },
      { name: 'Slope chart', dim: '2D', demo: 'slope' },
      { name: 'Bump chart', dim: '2D', demo: 'bump' },
      { name: 'Horizon chart', dim: '2D', demo: 'horizon' },
      { name: 'Real-time streaming line', dim: '2D', demo: 'live' },
    ],
  },
  {
    group: 'Distribution',
    purpose: 'Show how values spread',
    items: [
      { name: 'Histogram', dim: '2D', demo: 'histogram' },
      { name: 'Box plot', dim: '2D', demo: 'box' },
      { name: 'Violin', dim: '2D', demo: 'violin' },
      { name: 'Density / KDE', dim: '2D', demo: 'density' },
      { name: 'Ridgeline', dim: '2D', demo: 'ridgeline' },
      { name: 'Beeswarm', dim: '2D', demo: 'beeswarm' },
      { name: 'Strip / jitter plot', dim: '2D', demo: 'strip' },
      { name: 'ECDF', dim: '2D', demo: 'ecdf' },
      { name: 'Q–Q plot', dim: '2D', demo: 'qq' },
      { name: 'Error bars / interval plot', dim: '2D', demo: 'errorBar' },
    ],
  },
  {
    group: 'Part-to-whole',
    purpose: 'Show composition',
    items: [
      { name: 'Pie', dim: '2D', demo: 'pie' },
      { name: 'Donut', dim: '2D', demo: 'donut' },
      { name: 'Semi-donut', dim: '2D', demo: 'semiDonut' },
      { name: 'Treemap', dim: '2D', demo: 'treemap' },
      { name: 'Sunburst', dim: '2D', demo: 'sunburst' },
      { name: 'Icicle', dim: '2D', demo: 'icicle' },
      { name: 'Circle packing', dim: '2D', demo: 'pack' },
      { name: 'Waffle', dim: '2D', demo: 'waffle' },
      { name: 'Nightingale / rose', dim: '2D', demo: 'polarArea' },
      { name: 'Funnel', dim: '2D', demo: 'funnel' },
      { name: 'Pyramid', dim: '2D', demo: 'pyramid' },
      { name: 'Venn / Euler', dim: '2D', demo: 'venn' },
      { name: '3D pie', dim: '3D', note: 'Not built on purpose: perspective distorts slice sizes. Use pie, donut or semi-donut' },
    ],
  },
  {
    group: 'Relationship',
    purpose: 'Show correlation and connection',
    items: [
      { name: 'Scatter', dim: '2D', demo: 'scatter' },
      { name: 'Large-data scatter (1M+)', dim: '2D', demo: 'scatter-1m' },
      { name: 'Bubble', dim: '2D', demo: 'bubble' },
      { name: 'Correlation matrix', dim: '2D', demo: 'heatmap', note: 'Use the heatmap' },
      { name: 'Voronoi diagram', dim: '2D', demo: 'voronoi' },
      { name: 'Hexbin', dim: '2D', demo: 'hexbin' },
      { name: '2D density / contour', dim: '2D', demo: 'density2d' },
      { name: 'Scatter-plot matrix (SPLOM)', dim: '2D', demo: 'splom' },
      { name: 'Connected scatter', dim: '2D', demo: 'connectedScatter' },
      { name: 'Parallel coordinates', dim: '2D', demo: 'parallel' },
      { name: 'Network / force graph', dim: '2D/3D', demo: 'network', note: 'Also network3d' },
      { name: 'Chord diagram', dim: '2D', demo: 'chord' },
      { name: 'Arc diagram', dim: '2D', demo: 'arcDiagram' },
      { name: 'Dendrogram / tree', dim: '2D', demo: 'dendrogram' },
    ],
  },
  {
    group: 'Flow & process',
    purpose: 'Show movement, stages and schedules',
    items: [
      { name: 'Sankey', dim: '2D', demo: 'sankey' },
      { name: 'Alluvial', dim: '2D', demo: 'alluvial' },
      { name: 'Gantt', dim: '2D', demo: 'gantt' },
      { name: 'Timeline', dim: '2D', demo: 'timeline' },
      { name: 'Org chart / flowchart', dim: '2D', demo: 'orgChart' },
      { name: 'Mind map', dim: '2D', demo: 'mindMap' },
    ],
  },
  {
    group: 'Matrix & grid',
    purpose: 'Values across two categorical axes',
    items: [
      { name: 'Heatmap', dim: '2D', demo: 'heatmap' },
      { name: 'Large heatmap (1M cells)', dim: '2D', demo: 'heatmap-1m' },
      { name: 'Calendar heatmap', dim: '2D', demo: 'calendar' },
      { name: 'Adjacency matrix', dim: '2D', demo: 'adjacency' },
    ],
  },
  {
    group: 'Polar & radial',
    purpose: 'Values arranged around a center',
    items: [
      { name: 'Radar / spider', dim: '2D', demo: 'radar' },
      { name: 'Polar area', dim: '2D', demo: 'polarArea' },
      { name: 'Radial line', dim: '2D', demo: 'radialLine' },
      { name: 'Wind rose', dim: '2D', demo: 'windRose' },
      { name: 'Polar scatter', dim: '2D', demo: 'polarScatter' },
    ],
  },
  {
    group: 'KPI & single value',
    purpose: 'One number against a target',
    items: [
      { name: 'Radial gauge', dim: '2D', demo: 'gauge' },
      { name: 'Linear gauge / thermometer', dim: '2D', demo: 'linearGauge' },
      { name: 'Progress ring', dim: '2D', demo: 'progressRing' },
      { name: 'Stat tile / big number', dim: '2D', demo: 'stat', note: 'Often better as plain HTML' },
    ],
  },
  {
    group: 'Machine learning',
    purpose: 'Evaluate and explain models',
    items: [
      { name: 'Confusion matrix', dim: '2D', demo: 'confusionMatrix' },
      { name: 'ROC curve', dim: '2D', demo: 'rocCurve' },
      { name: 'Precision–recall curve', dim: '2D', demo: 'rocCurve-pr' },
      { name: 'Feature importance', dim: '2D', demo: 'bar-horizontal', note: 'Use a horizontal bar chart' },
      { name: 'Learning / loss curve', dim: '2D', demo: 'line', note: 'Use the line chart' },
    ],
  },
  {
    group: 'Financial',
    purpose: 'Price and market data',
    items: [
      { name: 'Candlestick', dim: '2D', demo: 'candlestick' },
      { name: 'OHLC bars', dim: '2D', demo: 'ohlc' },
      { name: 'Heikin-Ashi', dim: '2D', demo: 'heikinAshi' },
      { name: 'Renko', dim: '2D', demo: 'renko' },
      { name: 'Point & figure', dim: '2D', demo: 'pointFigure' },
      { name: 'Kagi', dim: '2D', demo: 'kagi' },
      { name: 'Market depth', dim: '2D', demo: 'depth' },
      { name: 'Moving averages & Bollinger bands', dim: '2D', demo: 'candlestick-indicators' },
      { name: 'MACD', dim: '2D', demo: 'macd' },
      { name: 'RSI', dim: '2D', demo: 'rsi' },
      { name: 'Volume profile', dim: '2D', demo: 'volumeProfile' },
    ],
  },
  {
    group: 'Geospatial',
    purpose: 'Data on maps',
    items: [
      { name: 'Choropleth', dim: '2D', demo: 'choropleth' },
      { name: 'Bubble / symbol map', dim: '2D', demo: 'bubbleMap' },
      { name: 'Flow map', dim: '2D', demo: 'flowMap' },
      { name: 'Hexbin map', dim: '2D', demo: 'hexbinMap' },
      { name: '3D globe', dim: '3D', demo: 'globe' },
      { name: 'Cartogram (Dorling)', dim: '2D', demo: 'cartogram' },
      { name: 'Dot density map', dim: '2D', demo: 'dotDensity' },
    ],
  },
  {
    group: '3D & scientific',
    purpose: 'Three continuous dimensions',
    items: [
      { name: '3D bar', dim: '3D', demo: 'bar3d' },
      { name: '3D scatter / point cloud', dim: '3D', demo: 'scatter3d' },
      { name: '3D line / trajectory', dim: '3D', demo: 'line3d' },
      { name: '3D surface', dim: '3D', demo: 'surface3d' },
      { name: '3D mesh / terrain', dim: '3D', demo: 'mesh3d' },
      { name: 'Isosurface / volume', dim: '3D', demo: 'isosurface' },
      { name: 'Vector field / quiver', dim: '2D/3D', demo: 'vectorField', note: 'Also vectorField3d' },
      { name: 'Contour', dim: '2D', demo: 'contour' },
      { name: 'Spectrogram / waterfall', dim: '2D/3D', demo: 'spectrogram', note: 'Also waterfall3d' },
      { name: 'Ternary plot', dim: '2D', demo: 'ternary' },
      { name: 'Smith chart', dim: '2D', demo: 'smith' },
    ],
  },
];

export interface Library {
  name: string;
  license: string;
  cost: 'Free' | 'Paid' | 'Free + paid tier';
  tech: string;
  threeD: boolean;
  note: string;
}

/** Licensing changes over time; verify on the vendor's site before choosing. */
export const LIBRARIES: Library[] = [
  { name: 'D3.js', license: 'ISC', cost: 'Free', tech: 'SVG / Canvas', threeD: false, note: 'Low-level toolkit; build any chart by hand' },
  { name: 'Apache ECharts', license: 'Apache-2.0', cost: 'Free', tech: 'Canvas / SVG (+ WebGL via echarts-gl)', threeD: true, note: 'Very broad catalog, good large-data modes' },
  { name: 'Chart.js', license: 'MIT', cost: 'Free', tech: 'Canvas', threeD: false, note: 'Small set of core types, many plugins' },
  { name: 'Plotly.js', license: 'MIT', cost: 'Free', tech: 'SVG + WebGL', threeD: true, note: 'Scientific charts, 3D surface/scatter/mesh' },
  { name: 'Vega / Vega-Lite', license: 'BSD-3-Clause', cost: 'Free', tech: 'SVG / Canvas', threeD: false, note: 'Declarative grammar of graphics' },
  { name: 'Observable Plot', license: 'ISC', cost: 'Free', tech: 'SVG', threeD: false, note: 'Concise exploratory charts' },
  { name: 'Recharts', license: 'MIT', cost: 'Free', tech: 'SVG', threeD: false, note: 'React components' },
  { name: 'Nivo', license: 'MIT', cost: 'Free', tech: 'SVG / Canvas', threeD: false, note: 'React components, rich catalog' },
  { name: 'visx', license: 'MIT', cost: 'Free', tech: 'SVG', threeD: false, note: 'React primitives on top of D3' },
  { name: 'Victory', license: 'MIT', cost: 'Free', tech: 'SVG', threeD: false, note: 'React and React Native' },
  { name: 'uPlot', license: 'MIT', cost: 'Free', tech: 'Canvas', threeD: false, note: 'Tiny and very fast time series' },
  { name: 'Lightweight Charts', license: 'Apache-2.0', cost: 'Free', tech: 'Canvas', threeD: false, note: 'Financial charts by TradingView' },
  { name: 'deck.gl', license: 'MIT', cost: 'Free', tech: 'WebGL / WebGPU', threeD: true, note: 'Large geospatial layers' },
  { name: 'Three.js', license: 'MIT', cost: 'Free', tech: 'WebGL / WebGPU', threeD: true, note: '3D engine, no chart features (this project adds them)' },
  { name: 'AG Charts', license: 'MIT + commercial', cost: 'Free + paid tier', tech: 'Canvas', threeD: false, note: 'Community edition free; Enterprise adds advanced types' },
  { name: 'Highcharts', license: 'Commercial', cost: 'Paid', tech: 'SVG', threeD: true, note: 'Free for non-commercial use; Stock, Maps and Gantt add-ons' },
  { name: 'amCharts 5', license: 'Commercial', cost: 'Paid', tech: 'Canvas', threeD: false, note: 'Free version shows a branding link' },
  { name: 'SciChart.js', license: 'Commercial', cost: 'Paid', tech: 'WebGL + WebAssembly', threeD: true, note: 'Built for millions of points; community licence for non-commercial' },
  { name: 'LightningChart JS', license: 'Commercial', cost: 'Paid', tech: 'WebGL', threeD: true, note: 'High-performance and 3D; non-commercial licence available' },
  { name: 'FusionCharts', license: 'Commercial', cost: 'Paid', tech: 'SVG', threeD: false, note: 'Large catalog including maps' },
  { name: 'AnyChart', license: 'Commercial', cost: 'Paid', tech: 'SVG', threeD: true, note: 'Includes Gantt, stock and maps' },
  { name: 'Syncfusion Charts', license: 'Commercial', cost: 'Paid', tech: 'SVG / Canvas', threeD: false, note: 'Free community licence for small companies' },
  { name: 'DevExtreme Charts', license: 'Commercial', cost: 'Paid', tech: 'SVG', threeD: false, note: 'Part of the DevExpress suite' },
  { name: 'Kendo UI Charts', license: 'Commercial', cost: 'Paid', tech: 'SVG / Canvas', threeD: false, note: 'Part of the Progress Telerik suite' },
  { name: 'CanvasJS', license: 'Commercial', cost: 'Paid', tech: 'Canvas', threeD: false, note: 'Free for non-commercial use' },
];
