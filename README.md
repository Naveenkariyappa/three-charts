# three-charts

134 fast 2D and 3D chart types built on three.js (WebGL), handed out like [shadcn/ui](https://ui.shadcn.com): you don't install a charting library, you copy the chart's code into your project and own it. Works with React (TypeScript or JavaScript) and with plain TypeScript/JavaScript, with or without a build step. The only dependency is `three`.

**Live demo, docs and code:** https://three-charts.vercel.app (docs: https://three-charts.vercel.app/#/docs)

---

## Using the charts in your project

### 1. Find your chart

Open the site and pick a chart in the sidebar (press `/` to search). Each chart has its own page with the live chart, a **Customize** panel and the code. Pick your language above the code: **React · TS**, **React · JS**, **TypeScript** or **JavaScript**.

### 2. Add it

Every chart is one small file. Charts also share a few files (the engine, axes, tooltips); you add those once per project and every later chart reuses them. Choose one way:

| You have | Do this |
|---|---|
| A React project set up with shadcn | `npx shadcn@latest add https://three-charts.vercel.app/r/bar-chart.json` (the chart page shows the exact command) |
| Any React or bundler project (Vite, Next.js, webpack…) | `npm install three` (with TypeScript, also `npm install -D @types/three`), then click **Download (.zip)** on the chart page and unzip into `src/components/charts/` (React) or `src/charts/` |
| Just one chart, simplest possible | TypeScript or React · TS tab → **One file**: a single self-contained file (still needs `three` and `@types/three`) |
| Plain HTML, no npm | **JavaScript** tab → download the zip, then use the HTML template under **Install the shared files** (loads three.js from a CDN). Serve the folder over http (e.g. `npx serve`); browsers block modules opened as a file. |

The chart page also has **Copy install command**, which downloads the files with one terminal command.

> **About `@/components/charts`.** The React examples import from `@/components/…`, the path alias shadcn projects already have. Without it, use a relative path such as `./components/charts/bar-chart`, or add the alias. For Vite: `resolve: { alias: { '@': '/src' } }` in `vite.config.ts` and `"paths": { "@/*": ["./src/*"] }` in `tsconfig.app.json`.

### 3. Use it

**React + TypeScript**

```tsx
import { useMemo, useRef } from 'react';
import { BarChart, type BarChartHandle, type BarChartProps } from '@/components/charts/bar-chart';

export function Revenue({ sales }: { sales: number[] }) {
  const chart = useRef<BarChartHandle>(null);

  // Options are compared by reference: rebuild them only when the data changes.
  const options = useMemo<BarChartProps>(
    () => ({
      categories: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [{ name: 'Revenue', data: sales }],
      yAxis: { label: 'Revenue ($M)' },
      onClick: (hit) => console.log(hit.series, hit.values),
    }),
    [sales],
  );

  return (
    <>
      <BarChart ref={chart} height={320} {...options} />
      <button onClick={() => chart.current?.resetView()}>Reset zoom</button>
    </>
  );
}
```

Every chart exports `<Name>Props` (its options plus `height`, `className`, `style`) and `<Name>Handle` (the ref: `update`, `resetView`, `download`, `toPNG`, `toCSV`, `chart`).

**React + JavaScript**

```jsx
import { useMemo, useRef } from 'react';
import { BarChart } from '@/components/charts/bar-chart';

export function Revenue({ sales }) {
  const chart = useRef(null);

  // Options are compared by reference: rebuild them only when the data changes.
  const options = useMemo(
    () => ({
      categories: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [{ name: 'Revenue', data: sales }],
      yAxis: { label: 'Revenue ($M)' },
      onClick: (hit) => console.log(hit.series, hit.values),
    }),
    [sales],
  );

  return (
    <>
      <BarChart ref={chart} height={320} {...options} />
      <button onClick={() => chart.current?.resetView()}>Reset zoom</button>
    </>
  );
}
```

**TypeScript**

```ts
import { createBarChart, type BarOptions } from './charts/bar-chart';

const options: Omit<BarOptions, 'type'> = {
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{ name: 'Revenue', data: [42, 51, 48, 63] }],
  yAxis: { label: 'Revenue ($M)' },
  onClick: (hit) => console.log(hit.series, hit.values),
};

// The container needs a height; the chart fills it.
const chart = createBarChart(document.getElementById('chart')!, options);

chart.update({ series: [{ name: 'Revenue', data: [50, 55, 60, 70] }] }); // new data
chart.destroy(); // when removing it
```

**JavaScript**

```js
import { createBarChart } from './charts/bar-chart.js';

// The container needs a height; the chart fills it.
const chart = createBarChart(document.getElementById('chart'), {
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{ name: 'Revenue', data: [42, 51, 48, 63] }],
  yAxis: { label: 'Revenue ($M)' },
  onClick: (hit) => console.log(hit.series, hit.values),
});

chart.update({ series: [{ name: 'Revenue', data: [50, 55, 60, 70] }] }); // new data
chart.destroy(); // when removing it
```

Every chart page has a complete example with realistic data for that chart.

### 4. Customize it

Every chart takes the same color, text and legend options. The **Customize** panel on each chart's page lets you change them on a live chart and copies them into the usage code.

```ts
{
  // Colors
  colors: ['#0f766e', '#ea580c', '#4f46e5'],      // series, in order
  colorScale: ['#e0f2fe', '#0369a1', '#0c4a6e'],  // heatmaps, maps, surfaces (low → high)
  divergingColors: ['#b91c1c', '#f5f5f4', '#1d4ed8'],
  positiveColor: '#16a34a',                       // up candles, increases, gains
  negativeColor: '#dc2626',
  background: '#ffffff',
  theme: 'light',                                 // or 'dark'; default follows the page

  // Text
  title: 'Revenue by region',
  appearance: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 12,                                 // labels; titleSize for the title
    textColor: '#111827',
    mutedTextColor: '#6b7280',                    // axis ticks
    gridColor: '#e5e7eb',
    tooltipBackground: '#ffffff',
  },

  // Legend
  legend: {
    position: 'right',                            // 'top' | 'bottom' | 'left' | 'right'
    align: 'start',                               // 'start' | 'center' | 'end'
    marker: 'circle',                             // 'square' | 'circle' | 'line'
    hidden: ['2023'],                             // start with these series hidden
    format: (name) => name.toUpperCase(),
    onToggle: (name, visible) => console.log(name, visible),
  },

  // Interaction
  tooltip: true,
  onHover: (hit) => console.log(hit?.series),     // hit: { series, index, values } or null
  onClick: (hit) => console.log(hit.values),
}
```

- `appearance` also takes `titleSize`, `secondaryTextColor`, `axisColor` and `borderColor`.
- `legend: false` hides the legend, `legend: true` always shows it (by default it appears for 2+ series).
- A series' own `color` (or a slice's, a node's…) wins over `colors`.
- From code: `chart.toggleSeries(name)` hides or shows a series and `chart.hiddenSeries()` lists the hidden ones (in React, `ref.current.chart()`).

### 5. Let people download it

Every chart has a download button in its top-right corner (it appears on hover, and stays visible on touch screens). It saves the chart as a **PNG** exactly as shown, with labels, legend and title, or its data as a **CSV** file that opens in Excel or Google Sheets.

```ts
// Hide the button, or limit and name the downloads:
download: false,
download: { formats: ['png'], filename: 'q3-revenue' },

// From your own button or menu:
chart.download('png');            // React: ref.current.download('png')
chart.download('csv', 'revenue');
const dataUrl = chart.toPNG();    // e.g. to attach to an email or a report
const csv = chart.toCSV();        // null when the data isn't a table (a 3D mesh)
```

### Good to know

- **Give the container a height.** The chart fills its box (`height` prop in React, CSS height otherwise).
- **Big data:** pass typed arrays (`Float32Array`; `Float64Array` for timestamps). Lines and scatter plots handle a million points.
- **React:** build data with `useMemo`. Options are compared by reference, so a new array on every render re-uploads the data.
- **Live data:** call `ref.current.update({...})` (React) or `chart.update({...})` instead of re-rendering on every tick.
- **Many charts on one page** are fine: they share one WebGL context.
- **Next.js:** the React files start with `'use client'` and are safe to import on the server.
- **Dark mode** follows `<html data-theme="dark">`, then the OS setting. Force it with `theme: 'light' | 'dark'`.
- **Linked panels:** give charts the same `sync: 'name'` and they zoom and pan together (e.g. price + MACD + RSI).
- **Interaction:** hover for tooltips, click a legend item to hide its series (double-click to show only that one), drag to pan (2D) or orbit (3D), click a chart (or hold Ctrl/⌘) and scroll to zoom, double-click to reset.
- **It's your code.** Change colors, labels or behavior in the files you copied; nothing will overwrite them.

---

## Chart types (134)

How these compare with 25 other charting libraries, chart by chart: [CHARTS.md](CHARTS.md).

Each type below has its own file and component (`bar` is `bar-chart.tsx` / `<BarChart>` / `createBarChart()`). Variants in parentheses are options on that chart.

| Group | Types |
|---|---|
| Comparison | `bar` (grouped, `stacked`, `stacked: 'percent'`, `horizontal`), `lollipop`, `dotplot`, `dumbbell`, `rangeBar`, `bullet`, `waterfall`, `marimekko`, `pictograph`, `radialBar`, `radar`, `pareto`, `populationPyramid`, `wordCloud`, `divergingBar`, `variwide`, `jumpLine` |
| Trend | `line` (`step`, `smooth`), `area` (`stacked`, `'percent'`, `'stream'`), `rangeArea`, `slope`, `bump`, `horizon`, `sparkline`, `radialLine`, `confidenceBand`, `baseline`, `difference`, `areaBump`, `stem`, `smallMultiples`, `navigator` |
| Distribution | `histogram`, `box`, `violin`, `density`, `ridgeline`, `beeswarm`, `strip`, `ecdf`, `qq`, `errorBar`, `dotHistogram` |
| Part-to-whole | `pie`, `donut`, `semiDonut`, `waffle`, `funnel`, `pyramid`, `venn`, `polarArea`, `windRose`, `variablePie`, `parliament`, `packedBubble` |
| Hierarchy | `treemap`, `sunburst`, `icicle`, `pack`, `dendrogram`, `orgChart`, `mindMap`, `radialTree` |
| Relationship | `scatter`, `bubble`, `heatmap`, `hexbin`, `density2d`, `splom`, `connectedScatter`, `parallel`, `voronoi`, `polarScatter`, `quadrant`, `radialHeatmap`, `histogram2d`; scatter `trendline: true` |
| Network | `chord`, `arcDiagram`, `adjacency`, `network`, `network3d`, `edgeBundling` |
| Flow & time | `sankey`, `alluvial`, `gantt`, `timeline`, `calendar` |
| KPI | `gauge`, `linearGauge` (`variant: 'thermometer'`), `progressRing`, `stat`, `liquidGauge`, `winLoss` |
| Machine learning | `confusionMatrix` (counts, or `normalize: 'row' \| 'column'`), `rocCurve` (`kind: 'roc' \| 'pr'`, AUC / average precision computed from labels and scores) |
| Financial | `candlestick` (`indicators`: SMA, EMA, Bollinger; `events`: flags), `ohlc`, `hollowCandle`, `hlc`, `heikinAshi`, `volumeProfile`, `renko`, `pointFigure`, `kagi`, `lineBreak`, `depth`, `macd`, `rsi` |
| Geo | `choropleth`, `bubbleMap`, `flowMap`, `hexbinMap`, `densityMap`, `cartogram`, `dotDensity`, `tileMap`, `spikeMap`, `globe`, `map3d` (pass any TopoJSON, e.g. `world-atlas`) |
| 3D & scientific | `bar3d`, `scatter3d`, `line3d`, `surface3d`, `mesh3d`, `isosurface`, `vectorField`, `vectorField3d`, `contour`, `spectrogram`, `waterfall3d`, `ternary`, `smith`, `streamline`, `windBarb` |

Not built on purpose: 3D pie, 3D funnel/pyramid and dual-axis charts (they distort or mislead). See [CHARTS.md](CHARTS.md) for the few other types not built yet.

Any 2D axis chart takes `sync: 'name'`: charts with the same name zoom and pan their x axis together (price + MACD + RSI).

---

## Developing this repo

```bash
npm install
npm run dev        # demo at http://localhost:5173 (regenerates the copy-paste files on change)
npm run registry   # regenerate the copy-paste files on their own
npm run build      # type-check source and generated files, build the site into dist/
```

- `src/core/`: the charts (single source of truth).
- `src/react/chart-react.tsx`: the React wrapper every React chart file uses.
- `src/demo/`: the demo site (gallery, Docs, Code page). `CatalogPage.tsx` and `catalog.ts` (chart types across other libraries) are kept but not linked; add the route back in `App.tsx` to show it. Examples live in `examples.ts` and `examples2.ts`; each one is source text that the gallery runs and the Code page prints.
- `scripts/registry.mjs`: turns `src/core` into the copy-paste files.
- `public/vanilla.html`: plain HTML page that uses the copied JavaScript files.

The site deploys to Vercel as a static Vite build (`vercel.json`). `npm run build` generates the copy-paste files, so they are not committed.

### How the copy-paste files are made

`scripts/registry.mjs` reads `src/core` (and `src/react/chart-react.tsx`), splits it by declaration and writes `public/registry` (TS, JS, React TS and React JS modular files, plus single-file builds for TS and React TS) and `public/r` (shadcn registry items):

- Code only one chart uses (its class, options type, helpers) goes into that chart's file.
- Code two or more charts share goes into the shared files, grouped so a chart pulls in only what it needs. Small helpers that would drag a big shared file into a chart are moved into `chart-core` instead.
- JavaScript versions are the same code with types removed, formatted with Prettier (cached in `node_modules/.cache`, so re-runs take about a second).

`npm run dev` regenerates the files when chart source changes, and `npm run build` type-checks every generated file in strict mode. So `src/core` is the single source: the demo and the copy-paste files can't drift apart.

## How it stays fast

- **One WebGL context for every chart.** A single hidden renderer draws each chart and copies the pixels into that chart's own canvas. Browsers allow roughly 16 contexts, so a canvas-per-chart library breaks on big dashboards. This one doesn't.
- **Render on demand.** A chart redraws only when its data, size, hover or camera changes, and only while it is on screen.
- **One draw call per series.** Bars and candles are instanced, points use one `Points` mesh, and lines use `Line2`. A heatmap is a single float texture.
- **Zoom and pan move the camera.** Data is never re-uploaded, so 1M-point charts stay at 60 fps.
- **Fast hover.** Scatter uses a spatial grid index, lines use binary search, and 3D picking scans typed arrays directly.
- **Typed arrays in, no copies.** Pass `Float32Array` for values and `Float64Array` for epoch-ms time.
- **Off-screen charts give memory back.** A chart scrolled away frees its canvas and GPU buffers and re-uploads them when it returns, so pages with dozens of charts stay within GPU memory.
- **GPU contours.** Contour bands and isolines are computed per pixel in a shader, so they stay sharp at any zoom.

## Interaction

- Hover any mark for a tooltip.
- Click a legend item to hide or show its series; double-click it to show only that series.
- Drag to pan (2D) or orbit (3D).
- Click into a chart, or hold Ctrl/⌘, to zoom with the wheel. Plain scrolling still scrolls the page.
- Double-click resets the zoom.
