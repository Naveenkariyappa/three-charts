# Chart coverage vs other libraries

Every chart type offered by 25 popular charting libraries, and the three-charts type that covers it. three-charts has **134 chart types**.

**How this list was made.** Highcharts and Plotly.js were checked against their official chart-type lists (October 2026). The other libraries come from their documented chart catalogs as of 2025–26, so very recent additions may be missing. Names differ between libraries; similar types are grouped under one name.

Legend: ✅ built (three-charts type in `code`) · ⚙️ an option or variant of a built type · ➖ not built (reason given).

---

## Master list (union of all libraries)

### Comparison

| Chart | Found in | three-charts |
|---|---|---|
| Column / bar, grouped | all | ✅ `bar` |
| Stacked bar, 100% stacked | all | ⚙️ `bar` (`stacked`, `stacked: 'percent'`) |
| Horizontal bar | all | ⚙️ `bar` (`horizontal`) |
| Lollipop | Highcharts, AnyChart, D3 | ✅ `lollipop` |
| Dot plot (Cleveland) | Vega-Lite, Observable Plot, D3 | ✅ `dotplot` |
| Dumbbell | Highcharts, D3 | ✅ `dumbbell` |
| Range / floating bar, x-range | Highcharts, ECharts, AG Charts, Syncfusion | ✅ `rangeBar` |
| Bullet | Highcharts, AnyChart, FusionCharts, Nivo, D3 | ✅ `bullet` |
| Waterfall | most | ✅ `waterfall` |
| Marimekko / Mekko / mosaic | AnyChart, FusionCharts, amCharts, Nivo | ✅ `marimekko` |
| Variwide (variable-width bar) | Highcharts | ✅ `variwide` |
| Pictograph / pictorial bar / isotype | Highcharts, ECharts, amCharts, Vega-Lite | ✅ `pictograph` |
| Radial / circular bar, radial column | Highcharts, AG Charts, Nivo, D3 | ✅ `radialBar` |
| Radar / spider / polar line | most | ✅ `radar` |
| Diverging stacked bar (Likert) | Vega-Lite, D3, amCharts | ✅ `divergingBar` |
| Pareto | Highcharts, FusionCharts, AnyChart | ✅ `pareto` |
| Population pyramid (back-to-back) | Highcharts, AnyChart, D3 | ✅ `populationPyramid` |
| Jump line | AnyChart | ✅ `jumpLine` |
| Word cloud / tag cloud | Highcharts, AnyChart, amCharts, ECharts (ext.) | ✅ `wordCloud` |
| Column pyramid, cylinder, 3D column | Highcharts, AnyChart, FusionCharts | ➖ 3D bars of 2D data distort values; use `bar` (or `bar3d` for real 3D grids) |

### Trend over time

| Chart | Found in | three-charts |
|---|---|---|
| Line, spline (smoothed), step | all | ✅ `line` (`smooth`, `step`) |
| Area, spline area, step area | all | ✅ `area` |
| Stacked / 100% area | most | ⚙️ `area` (`stacked`, `'percent'`) |
| Streamgraph / ThemeRiver | Highcharts, ECharts, Nivo, D3 | ⚙️ `area` (`stacked: 'stream'`) |
| Range area, area range, band | Highcharts, ECharts, Syncfusion | ✅ `rangeArea` |
| Confidence band / fan chart, error band | Plotly, SciChart, Vega-Lite | ✅ `confidenceBand` |
| Baseline area (above/below colors), negative color | Lightweight Charts, Highcharts | ✅ `baseline` |
| Difference chart | Observable Plot, D3 | ✅ `difference` |
| Sparkline | AnyChart, FusionCharts, Syncfusion, DevExtreme | ✅ `sparkline` |
| Win-loss sparkline | FusionCharts, Excel-style | ✅ `winLoss` |
| Slope | D3, Vega-Lite | ✅ `slope` |
| Bump | Nivo, D3 | ✅ `bump` |
| Area bump | Nivo | ✅ `areaBump` |
| Horizon | D3, Observable Plot | ✅ `horizon` |
| Stem / stick / impulse | AnyChart, SciChart | ✅ `stem` |
| Real-time / streaming line, zoom line | FusionCharts, SciChart, LightningChart, uPlot | ⚙️ `line` + `update()` ([live example](https://three-charts.vercel.app/#/code/live)) |
| Small multiples / trellis / facets | Vega-Lite, Observable Plot | ✅ `smallMultiples` |
| Range navigator / range selector / scrollbar | Highcharts Stock, Syncfusion, DevExtreme, amCharts | ✅ `navigator` (drives charts with the same `sync`) |
| Synchronized charts | Highcharts, ECharts | ⚙️ `sync` option on every axis chart |
| Dual / multi-axis combination | Highcharts, FusionCharts, ECharts, AnyChart | ➖ on purpose: two y-scales mislead; use `smallMultiples` or `sync` |

### Distribution

| Chart | Found in | three-charts |
|---|---|---|
| Histogram | most | ✅ `histogram` |
| Bell curve / density / KDE | Highcharts, Plotly, Vega-Lite | ✅ `density` |
| Box plot | most | ✅ `box` |
| Violin | Plotly, Vega-Lite, D3 | ✅ `violin` |
| Ridgeline / joy plot | D3, Vega-Lite | ✅ `ridgeline` |
| Beeswarm / swarm | Nivo, D3, Observable Plot | ✅ `beeswarm` |
| Strip / jitter / tick plot | Vega-Lite, Observable Plot | ✅ `strip` |
| Dot histogram (Wilkinson) | Vega-Lite | ✅ `dotHistogram` |
| ECDF | Plotly, Observable Plot | ✅ `ecdf` |
| Q–Q plot | Plotly, D3 | ✅ `qq` |
| Error bars | Highcharts, Plotly, AnyChart, FusionCharts, Victory | ✅ `errorBar` |

### Part-to-whole

| Chart | Found in | three-charts |
|---|---|---|
| Pie, donut, semi-donut | all | ✅ `pie`, `donut`, `semiDonut` |
| Variable-radius pie | Highcharts, amCharts | ✅ `variablePie` |
| Nightingale / rose / polar area / bar polar | ECharts, AG Charts, Plotly | ✅ `polarArea` |
| Waffle / item / unit | Nivo, Highcharts, amCharts | ✅ `waffle` |
| Item / parliament | Highcharts, amCharts | ✅ `parliament` |
| Funnel, funnel area, cone funnel | most | ✅ `funnel` |
| Pyramid | Highcharts, AnyChart, FusionCharts | ✅ `pyramid` |
| Packed bubble / bubble cloud | Highcharts, amCharts, D3 | ✅ `packedBubble` |
| Venn / Euler | Highcharts, AnyChart | ✅ `venn` |
| Wind rose | Highcharts, amCharts | ✅ `windRose` |
| 3D pie, 3D funnel, 3D pyramid | Highcharts, AnyChart, FusionCharts | ➖ on purpose: perspective distorts slice sizes |

### Hierarchy

| Chart | Found in | three-charts |
|---|---|---|
| Treemap | most | ✅ `treemap` |
| Sunburst, multi-level pie | Highcharts, ECharts, Plotly, FusionCharts | ✅ `sunburst` |
| Icicle / partition | Plotly, Nivo, D3 | ✅ `icicle` |
| Circle packing | D3, Nivo, AnyChart | ✅ `pack` |
| Tree / treegraph / dendrogram | Highcharts, ECharts, D3 | ✅ `dendrogram` |
| Radial tree | D3, ECharts | ✅ `radialTree` |
| Organization chart | Highcharts, amCharts, FusionCharts | ✅ `orgChart` |
| Mind map | amCharts, AnyChart (via network) | ✅ `mindMap` |
| Word tree | AnyChart | ➖ not built (text exploration tool) |

### Relationship and correlation

| Chart | Found in | three-charts |
|---|---|---|
| Scatter, scatter GL | all | ✅ `scatter` (1M+ points) |
| Bubble | most | ✅ `bubble` |
| Trendline / regression | Highcharts, Vega-Lite, Plotly | ⚙️ `scatter` (`trendline: true`) |
| Quadrant | AnyChart | ✅ `quadrant` |
| Heatmap, correlation matrix | most | ✅ `heatmap` |
| Hexbin | D3, Observable Plot, Vega | ✅ `hexbin` |
| 2D histogram | Plotly | ✅ `histogram2d` |
| 2D density contour, histogram 2D contour | Plotly, Vega-Lite, D3 | ✅ `density2d` |
| Scatter-plot matrix (SPLOM) | Plotly, Vega-Lite | ✅ `splom` |
| Connected scatter | D3, Vega-Lite | ✅ `connectedScatter` |
| Parallel coordinates | Highcharts, ECharts, Plotly, Nivo | ✅ `parallel` |
| Parallel categories / parallel sets | Plotly, D3 | ✅ `alluvial` |
| Voronoi | Nivo, D3, Victory | ✅ `voronoi` |
| Polar scatter | Plotly, Highcharts, Syncfusion | ✅ `polarScatter` |
| Radial / polar heatmap | AnyChart, SciChart, D3 | ✅ `radialHeatmap` |

### Network and flow

| Chart | Found in | three-charts |
|---|---|---|
| Network / force graph | Highcharts, ECharts, AnyChart, Nivo, D3 | ✅ `network`, `network3d` |
| Chord, dependency wheel | Highcharts, AG Charts, Nivo, D3 | ✅ `chord` |
| Arc diagram | Highcharts, D3 | ✅ `arcDiagram` |
| Adjacency matrix | D3, Vega | ✅ `adjacency` |
| Hierarchical edge bundling | D3 | ✅ `edgeBundling` |
| Sankey | most | ✅ `sankey` |
| Alluvial | D3, RAWGraphs | ✅ `alluvial` |
| Gantt | Highcharts Gantt, AnyChart, FusionCharts, DevExtreme | ✅ `gantt` |
| Timeline | Highcharts, amCharts | ✅ `timeline` |
| Calendar heatmap | ECharts, Nivo, D3 | ✅ `calendar` |
| PERT chart | AnyChart | ➖ not built (use `gantt` with dependencies or `network`) |
| Marey diagram | D3 | ➖ not built (niche) |

### KPI and gauges

| Chart | Found in | three-charts |
|---|---|---|
| Angular / radial gauge, solid gauge | most | ✅ `gauge` |
| Linear gauge, thermometer, LED gauge | AnyChart, FusionCharts, Syncfusion | ✅ `linearGauge` (`variant: 'thermometer'`) |
| Progress ring | AG Charts, Syncfusion | ✅ `progressRing` |
| Liquid fill / cylinder / tank gauge | ECharts (ext.), FusionCharts | ✅ `liquidGauge` (`shape: 'circle' \| 'tank'`) |
| Indicator / big number with delta | Plotly, FusionCharts | ✅ `stat` |
| Bulb gauge | FusionCharts | ➖ use `stat` or `progressRing` |

### Machine learning

| Chart | Found in | three-charts |
|---|---|---|
| Confusion matrix | Plotly (heatmap), scikit-style | ✅ `confusionMatrix` |
| ROC curve, precision–recall | Plotly (line), scikit-style | ✅ `rocCurve` (`kind: 'roc' \| 'pr'`) |
| Feature importance | any (bar) | ⚙️ `bar` (`horizontal`) |
| Learning / loss curve | any (line) | ⚙️ `line` |

### Financial

| Chart | Found in | three-charts |
|---|---|---|
| Candlestick | most | ✅ `candlestick` |
| Hollow candlestick | Highcharts Stock | ✅ `hollowCandle` |
| OHLC | most | ✅ `ohlc` |
| HLC / hi-lo | Highcharts Stock, AnyChart | ✅ `hlc` |
| Heikin-Ashi | Highcharts Stock, AnyChart | ✅ `heikinAshi` |
| Renko | Highcharts Stock, AnyChart | ✅ `renko` |
| Point & figure | Highcharts Stock, AnyChart | ✅ `pointFigure` |
| Kagi | AnyChart, FusionCharts | ✅ `kagi` |
| Three line break | AnyChart, stock tools | ✅ `lineBreak` |
| Volume profile | Highcharts Stock, TradingView | ✅ `volumeProfile` |
| Market depth | Lightweight Charts ecosystem | ✅ `depth` |
| Moving averages, Bollinger bands | Highcharts Stock, AnyChart | ⚙️ `candlestick` (`indicators`) |
| MACD, RSI | Highcharts Stock, AnyChart | ✅ `macd`, `rsi` |
| Event flags | Highcharts Stock | ⚙️ `candlestick` (`events`) |
| Other indicators (Stochastic, ATR, OBV, VWAP…) | Highcharts Stock (40+) | ➖ not yet; the indicator panel pattern (`macd`, `rsi`) makes them easy to add |

### Geo

| Chart | Found in | three-charts |
|---|---|---|
| Choropleth | most | ✅ `choropleth` |
| Bubble / symbol / point map, scatter geo | most | ✅ `bubbleMap` |
| Flow / connector / lines map | Highcharts Maps, ECharts, AnyChart, deck.gl | ✅ `flowMap` |
| Hexbin map | D3, deck.gl | ✅ `hexbinMap` |
| Density / heat map on a map | Plotly, deck.gl, Highcharts | ✅ `densityMap` |
| Dot density | D3 | ✅ `dotDensity` |
| Cartogram (Dorling) | D3 | ✅ `cartogram` |
| Tile map / grid map | Highcharts | ✅ `tileMap` |
| Spike map | D3 | ✅ `spikeMap` |
| 3D globe | ECharts GL, deck.gl | ✅ `globe` |
| 3D extruded map | ECharts GL (map3D), deck.gl | ✅ `map3d` |
| Extruded hexagon columns, animated trips | deck.gl | ➖ not built |
| Pies on a map, bivariate choropleth, seat maps | Highcharts Maps, AnyChart | ➖ not built |

### 3D and scientific

| Chart | Found in | three-charts |
|---|---|---|
| 3D bar | ECharts GL, Highcharts | ✅ `bar3d` |
| 3D scatter / point cloud | Plotly, ECharts GL, Highcharts | ✅ `scatter3d` |
| 3D line / trajectory | Plotly, ECharts GL | ✅ `line3d` |
| Surface | Plotly, ECharts GL, SciChart | ✅ `surface3d` |
| Mesh 3D | Plotly | ✅ `mesh3d` |
| Isosurface | Plotly | ✅ `isosurface` |
| Volume rendering | Plotly | ➖ use `isosurface` |
| Contour | Plotly, Highcharts, Vega | ✅ `contour` |
| Vector field / quiver / cone | Plotly, Highcharts | ✅ `vectorField`, `vectorField3d` |
| Streamlines | Plotly, ECharts GL (flowGL) | ✅ `streamline` |
| Streamtube (3D streamlines) | Plotly | ➖ not built |
| Wind barbs | Highcharts | ✅ `windBarb` |
| Spectrogram / waterfall | SciChart, LightningChart | ✅ `spectrogram`, `waterfall3d` |
| Ternary | Plotly | ✅ `ternary` |
| Smith | Plotly, Syncfusion | ✅ `smith` |
| Carpet, scatter carpet, contour carpet | Plotly | ➖ not built (niche engineering plots) |
| Logarithmic axis | most | ➖ not yet supported (an axis feature, not a chart type) |

### Not charts

Table (Plotly), Image (Plotly) and draggable editing (FusionCharts) are UI features rather than chart types, so they aren't counted.

---

## Per library

Each library's own chart list, mapped to the types above. ✅ means every listed type is covered except where noted.

| Library | Its chart types | Not covered |
|---|---|---|
| **Highcharts** (verified) | line, spline, area, areaspline, column, bar, pie, scatter, gauge, arearange, areasplinerange, columnrange, candlestick, hollow candlestick, Heikin-Ashi, Renko, point and figure, HLC, OHLC, flags, contour, 3D cylinder, 3D funnel, 3D pyramid, angular gauge, arc diagram, bell curve, box plot, bubble, bullet, column pyramid, dependency wheel, dumbbell, error bar, funnel, heatmap, histogram, item, lollipop, network graph, organization, packed bubble, parallel coordinates, Pareto, pictorial, polar/radar, radial bar, range, Sankey, stream graph, sunburst, timeline, treegraph, treemap, variable radius pie, variwide, vector, Venn, waterfall, wind barbs, word cloud, x-range; Maps: choropleth, map bubble, map point, map line, flow map, tile map, geo heatmap; Gantt | 3D cylinder/funnel/pyramid and column pyramid (on purpose) |
| **Plotly.js** (verified) | scatter, scatter GL, bar, pie, heatmap, image, contour, quiver, table, box, violin, histogram, histogram 2D, histogram 2D contour, OHLC, candlestick, waterfall, funnel, funnel area, indicator, scatter 3D, surface, mesh, cone, streamtube, volume, isosurface, scatter geo, choropleth, scatter map, choropleth map, density map, scatter polar, bar polar, scatter ternary, scatter Smith, sunburst, treemap, icicle, Sankey, SPLOM, parallel coordinates, parallel categories, carpet, scatter carpet, contour carpet | streamtube, volume, carpet family (table, image aren't charts) |
| **Apache ECharts** (+ echarts-gl) | line, bar, pie, scatter, effect scatter, radar, tree, treemap, sunburst, boxplot, candlestick, heatmap, map, parallel, lines, graph, Sankey, funnel, gauge, pictorial bar, ThemeRiver, calendar; GL: bar3D, line3D, scatter3D, lines3D, surface, map3D, globe, scatterGL, graphGL, flowGL; extensions: liquid fill, word cloud | effect scatter's ripple animation |
| **D3.js** | toolkit: every chart in its gallery (bar, line, area, stacked, stream, horizon, bump, slope, dot, box, violin, ridgeline, beeswarm, QQ, histogram, hexbin, density contour, treemap, sunburst, icicle, pack, tidy/radial tree, edge bundling, force graph, arc, chord, Sankey, choropleth, bubble/spike/hexbin maps, cartograms, calendar, Marey, …) | Marey diagram |
| **Chart.js** | line, bar, radar, doughnut/pie, polar area, bubble, scatter, area, mixed | — |
| **Vega / Vega-Lite** | bar, line, area, point, rule, tick, rect, arc, text, boxplot, errorbar, errorband; examples: Likert, Wilkinson dot plot, isotype, trellis, population pyramid, Lasagna, ridgeline, density, regression | — |
| **Observable Plot** | dot, line, area, bar, cell, rect, rule, tick, text, link, arrow, vector, hexbin, density, contour, raster, tree, waffle, difference, box | — |
| **Recharts** | line, area, bar, composed, pie, radar, radial bar, scatter, funnel, treemap, Sankey | — |
| **Nivo** | bar, line, pie, radar, heatmap, treemap, sunburst, circle packing, bump, area bump, calendar, chord, choropleth, geo map, network, parallel coordinates, Sankey, stream, swarm plot, waffle, Marimekko, funnel, bullet, radial bar, scatter, Voronoi, tree, icicle, box plot | — |
| **visx** | primitives on D3: bar, line, area, stack, pie, heatmap, hierarchy, network, geo, Voronoi, wordcloud, sankey | — |
| **Victory** | area, bar, box plot, candlestick, errorbar, histogram, line, pie, polar, scatter, Voronoi | — |
| **uPlot** | time-series line, area, bars, points (fast) | — |
| **Lightweight Charts** | candlestick, bar (OHLC), line, area, baseline, histogram | — |
| **deck.gl** | scatterplot, arc, line, path, polygon, GeoJSON, heatmap, hexagon (3D), grid, contour, screen grid, H3, trips, point cloud, terrain | extruded hexagon/grid columns, animated trips |
| **Three.js** | 3D engine with no chart types; three-charts is built on it | — |
| **AG Charts** | bar, line, area, scatter, bubble, pie, donut, histogram, combination, radar line/area, Nightingale, radial bar/column, range bar/area, box plot, heatmap, treemap, sunburst, waterfall, funnel, cone funnel, pyramid, map shapes/lines/markers, candlestick, OHLC, radial/linear gauge, chord, Sankey | — |
| **amCharts 5** | column, bar, line, area, step, pie, donut, funnel, pyramid, pictorial, Venn, treemap, sunburst, pack, tree, force-directed, Sankey, chord, arc, flow, word cloud, Gantt, timeline, radar, polar, gauges, heatmap, maps (choropleth, bubble, flow, globe), stock (candlestick, OHLC, indicators), parliament, packed bubble, variable pie, Likert | — |
| **SciChart.js** | line, scatter, mountain (area), column, impulse (stem), band, fan, candlestick, OHLC, bubble, error bars, box plot, heatmap, contours, polar/radar, ternary, Smith, 3D surface, 3D scatter / point cloud, waterfall | — |
| **LightningChart JS** | line, area, scatter, heatmap, spectrogram, polar, radar, Smith, 3D surface, 3D point cloud, 3D box, 3D line, gauges, map, trading charts | — |
| **FusionCharts** | column, bar, line, area, spline, spline area, step, pie/doughnut (2D, 3D), stacked, combination, scroll, zoom line, bubble, scatter, error bar/line/scatter, log axis, inverse y, radar, Pareto, Marimekko, Kagi, waterfall, box & whisker, heat map, treemap, Sankey, chord, sunburst (multi-level pie), angular gauge, bulb, cylinder, LED, linear gauge, thermometer, bullet, sparkline, win-loss, real-time, drag node, Gantt, funnel, pyramid, candlestick, radial bar | 3D pie (on purpose), log axis, bulb gauge, drag editing |
| **AnyChart** | area, bar, column, line, spline, step, jump line, stick, box, bubble, bullet, candlestick, OHLC, HiLo, Heikin-Ashi, Kagi, Renko, point & figure, line break, error, funnel, pyramid, heat map, marimekko, mosaic, pie, donut, 3D charts, polar, radar, quadrant, range area/bar/column, sparkline, sunburst, treemap, tag cloud, Venn, waterfall, word tree, network, PERT, Gantt (project, resource), timeline, Sankey, circular/linear gauges, LED, thermometer, tank, maps (choropleth, bubble, dot, connector, seat) | word tree, PERT, seat map, 3D variants (on purpose) |
| **Syncfusion Charts** | line, spline, step, area, spline area, step area, range area, stacked, column, bar, range column, scatter, bubble, box & whisker, error bar, histogram, waterfall, polar, radar, pie, doughnut, funnel, pyramid, stock (candlestick, HiLo, OHLC, indicators), range navigator, sparkline, bullet, Smith, 3D, gauges, maps, heat map, treemap, sunburst | 3D (on purpose) |
| **DevExtreme Charts** | line, spline, step, area, range area, bar, range bar, bubble, scatter, candlestick, stock, box, error bar, pie, donut, polar, radar, funnel, Sankey, treemap, vector map, range selector, sparkline, bullet, circular/linear/bar gauges | — |
| **Kendo UI Charts** | area, bar, box plot, bubble, bullet, candlestick, donut, funnel, heatmap, line, OHLC, pie, polar, radar, range area/bar, scatter, sparkline, waterfall, stock chart with navigator, gauges, maps, treemap | — |
| **CanvasJS** | line, spline, step line, area, spline area, step area, range area, range spline area, column, bar, range column/bar, stacked (100%), pie, doughnut, funnel, pyramid, scatter, bubble, box & whisker, candlestick, OHLC, error, waterfall | — |
