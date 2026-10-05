import type { ChartType } from '../core';
import type { Example } from './examples';

/**
 * Examples for the extended catalog. Same rules as examples.ts: `setup` is
 * plain JS that the gallery executes and the code page prints; `setupTs` is
 * the TypeScript variant when JS alone wouldn't type-check.
 * Avoid template literals in the code strings (they're inside one already).
 */

const walk = (name: string, n: number, start: number, vol: number) => `const ${name} = new Float32Array(${n});
{
  let v = ${start};
  for (let i = 0; i < ${n}; i++) {
    v += (Math.random() - 0.5) * ${vol};
    ${name}[i] = v;
  }
}`;

const ohlcSetup = (ts: boolean, n: number, withVolume = false) => `const n = ${n};
const day = 86_400_000;
const start = Date.UTC(2025, 0, 1);
const x${ts ? ': number[]' : ''} = [], open${ts ? ': number[]' : ''} = [], high${ts ? ': number[]' : ''} = [], low${ts ? ': number[]' : ''} = [], close${ts ? ': number[]' : ''} = []${withVolume ? (ts ? ', volume: number[] = []' : ', volume = []') : ''};
let p = 150;
for (let i = 0; i < n; i++) {
  const o = p;
  const c = o * (1 + (Math.random() - 0.48) * 0.04);
  x.push(start + i * day);
  open.push(o);
  close.push(c);
  high.push(Math.max(o, c) * (1 + Math.random() * 0.015));
  low.push(Math.min(o, c) * (1 - Math.random() * 0.015));${withVolume ? '\n  volume.push(1e6 * (0.5 + Math.random()));' : ''}
  p = c;
}`;

const closeSeries = (n: number) => `const n = ${n};
const day = 86_400_000;
const x = Array.from({ length: n }, (_, i) => Date.UTC(2023, 0, 1) + i * day);
const close = new Float64Array(n);
let p = 100;
for (let i = 0; i < n; i++) {
  p *= 1 + (Math.random() - 0.48) * 0.03;
  close[i] = p;
}`;

const gaussianGroups = (ts: boolean) => `const normal = (mean${ts ? ': number' : ''}, sd${ts ? ': number' : ''}, n${ts ? ': number' : ''}) =>
  Float32Array.from({ length: n }, () => mean + sd * Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()));`;

const treeData = (ts: boolean) => `// Disk usage by folder.
const folder = (name${ts ? ': string' : ''}, files${ts ? ': number' : ''}, scale${ts ? ': number' : ''}) => ({
  name,
  children: Array.from({ length: files }, (_, i) => ({ name: name.toLowerCase() + '-' + (i + 1), value: Math.round(scale * (0.2 + Math.random() ** 2 * 3)) })),
});
const data = {
  name: 'Disk',
  children: [
    { name: 'Photos', children: [folder('2024', 8, 40), folder('2025', 10, 40), folder('2026', 5, 50)] },
    folder('Videos', 6, 120),
    { name: 'Code', children: [folder('Web', 9, 8), folder('Mobile', 6, 10), folder('ML', 4, 30)] },
    folder('Music', 12, 10),
    folder('Docs', 14, 4),
  ],
};`;

const graphData = (ts: boolean, n: number, groups: number) => `// Communities: dense links inside a group, a few between groups.
const groups = ${groups};
const nodes = Array.from({ length: ${n} }, (_, i) => ({ id: 'n' + i, name: 'Node ' + i, group: i % groups }));
const links${ts ? ': { source: string; target: string }[]' : ''} = [];
for (let i = 0; i < nodes.length; i++) {
  for (let k = 0; k < 2; k++) {
    const sameGroup = Math.random() < 0.9;
    const j = sameGroup
      ? (Math.floor(Math.random() * (nodes.length / groups)) * groups + nodes[i].group) % nodes.length
      : Math.floor(Math.random() * nodes.length);
    if (j !== i) links.push({ source: nodes[i].id, target: nodes[j].id });
  }
}
const groupNames = ['Research', 'Design', 'Engineering', 'Sales', 'Support', 'Ops'].slice(0, groups);`;

const cities = `const cities = [
  { label: 'Tokyo', lon: 139.7, lat: 35.7, value: 37 },
  { label: 'Delhi', lon: 77.2, lat: 28.6, value: 33 },
  { label: 'Shanghai', lon: 121.5, lat: 31.2, value: 29 },
  { label: 'São Paulo', lon: -46.6, lat: -23.5, value: 22 },
  { label: 'Mexico City', lon: -99.1, lat: 19.4, value: 22 },
  { label: 'Cairo', lon: 31.2, lat: 30.0, value: 21 },
  { label: 'Mumbai', lon: 72.9, lat: 19.1, value: 21 },
  { label: 'Beijing', lon: 116.4, lat: 39.9, value: 21 },
  { label: 'Dhaka', lon: 90.4, lat: 23.8, value: 23 },
  { label: 'New York', lon: -74.0, lat: 40.7, value: 19 },
  { label: 'Lagos', lon: 3.4, lat: 6.5, value: 16 },
  { label: 'Istanbul', lon: 29.0, lat: 41.0, value: 16 },
  { label: 'Buenos Aires', lon: -58.4, lat: -34.6, value: 15 },
  { label: 'Moscow', lon: 37.6, lat: 55.8, value: 13 },
  { label: 'Paris', lon: 2.35, lat: 48.9, value: 11 },
  { label: 'London', lon: -0.13, lat: 51.5, value: 9.6 },
  { label: 'Los Angeles', lon: -118.2, lat: 34.1, value: 12.5 },
  { label: 'Jakarta', lon: 106.8, lat: -6.2, value: 11 },
  { label: 'Sydney', lon: 151.2, lat: -33.9, value: 5.4 },
  { label: 'Johannesburg', lon: 28.0, lat: -26.2, value: 6.2 },
  { label: 'Lima', lon: -77.0, lat: -12.0, value: 11 },
  { label: 'Bangkok', lon: 100.5, lat: 13.8, value: 11 },
  { label: 'Nairobi', lon: 36.8, lat: -1.3, value: 5.3 },
  { label: 'Toronto', lon: -79.4, lat: 43.7, value: 6.4 },
];`;

const countryValues = (ts: boolean) => `// A value for every country in the topology (deterministic, from the name).
const values${ts ? ': Record<string, number>' : ''} = {};
for (const g of world.objects.countries.geometries) {
  const name = g.properties.name;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 1000;
  values[name] = 20 + (h % 80);
}`;

const seededOhlc = (ts: boolean) => `// Seeded, so the price, MACD and RSI panels show the same market.
let seed = 42;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n = 300;
const day = 86_400_000;
const start = Date.UTC(2025, 0, 1);
const x${ts ? ': number[]' : ''} = [], open${ts ? ': number[]' : ''} = [], high${ts ? ': number[]' : ''} = [], low${ts ? ': number[]' : ''} = [], close${ts ? ': number[]' : ''} = [];
let p = 150;
for (let i = 0; i < n; i++) {
  const o = p;
  const c = o * (1 + (rand() - 0.48) * 0.035);
  x.push(start + i * day);
  open.push(o);
  close.push(c);
  high.push(Math.max(o, c) * (1 + rand() * 0.012));
  low.push(Math.min(o, c) * (1 - rand() * 0.012));
  p = c;
}`;

// Approximate 2024 population (millions) and urban share (%), for the demos only.
const populations = `const people = {
  'China': [1410, 66], 'India': [1440, 36], 'United States of America': [340, 83], 'Indonesia': [281, 58],
  'Pakistan': [245, 38], 'Nigeria': [227, 54], 'Brazil': [212, 88], 'Bangladesh': [173, 41], 'Russia': [144, 75],
  'Mexico': [130, 81], 'Ethiopia': [129, 23], 'Japan': [124, 92], 'Philippines': [116, 48], 'Egypt': [114, 43],
  'Dem. Rep. Congo': [109, 47], 'Vietnam': [100, 40], 'Iran': [90, 77], 'Turkey': [86, 77], 'Germany': [84, 78],
  'Thailand': [72, 53], 'United Kingdom': [69, 84], 'France': [68, 82], 'Tanzania': [68, 38], 'South Africa': [63, 69],
  'Italy': [59, 72], 'Kenya': [56, 29], 'Myanmar': [55, 32], 'Colombia': [53, 82], 'South Korea': [52, 81],
  'Sudan': [50, 37], 'Uganda': [49, 27], 'Spain': [48, 82], 'Argentina': [46, 92], 'Algeria': [46, 75], 'Iraq': [46, 71],
  'Afghanistan': [42, 27], 'Canada': [41, 82], 'Morocco': [38, 65], 'Ukraine': [37, 70], 'Poland': [37, 60],
  'Angola': [37, 69], 'Malaysia': [35, 79], 'Peru': [34, 79], 'Mozambique': [34, 38], 'Ghana': [34, 59],
  'Saudi Arabia': [33, 85], 'Nepal': [31, 22], 'Madagascar': [31, 40], 'Venezuela': [28, 88], 'Australia': [27, 87],
  'Kazakhstan': [20, 58], 'Chile': [20, 88],
};`;

// Seeded walk shared by the navigator and the chart it drives, so both show the same data.
const seededWalk = (ts: boolean) => `let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n = 2000;
const x${ts ? ': number[]' : ''} = [];
const y${ts ? ': number[]' : ''} = [];
let v = 100;
for (let i = 0; i < n; i++) {
  v += (rand() - 0.49) * 2;
  x.push(Date.UTC(2021, 0, 1) + i * 86_400_000);
  y.push(v);
}`;

export const GROUP_BY_TYPE: Record<ChartType, string> = {
  bar: 'Comparison', lollipop: 'Comparison', dotplot: 'Comparison', dumbbell: 'Comparison', rangeBar: 'Comparison', bullet: 'Comparison', waterfall: 'Comparison', marimekko: 'Comparison', pictograph: 'Comparison', radialBar: 'Comparison', radar: 'Comparison',
  line: 'Trend', area: 'Trend', rangeArea: 'Trend', slope: 'Trend', bump: 'Trend', horizon: 'Trend', sparkline: 'Trend', radialLine: 'Trend',
  histogram: 'Distribution', box: 'Distribution', violin: 'Distribution', density: 'Distribution', ridgeline: 'Distribution', beeswarm: 'Distribution', strip: 'Distribution', ecdf: 'Distribution', qq: 'Distribution',
  pie: 'Part-to-whole', donut: 'Part-to-whole', semiDonut: 'Part-to-whole', waffle: 'Part-to-whole', funnel: 'Part-to-whole', pyramid: 'Part-to-whole', venn: 'Part-to-whole', polarArea: 'Part-to-whole', windRose: 'Part-to-whole',
  treemap: 'Hierarchy', sunburst: 'Hierarchy', icicle: 'Hierarchy', pack: 'Hierarchy', dendrogram: 'Hierarchy', orgChart: 'Hierarchy',
  scatter: 'Relationship', bubble: 'Relationship', hexbin: 'Relationship', density2d: 'Relationship', splom: 'Relationship', connectedScatter: 'Relationship', parallel: 'Relationship', heatmap: 'Relationship',
  chord: 'Network', arcDiagram: 'Network', adjacency: 'Network', network: 'Network', network3d: 'Network',
  sankey: 'Flow & time', alluvial: 'Flow & time', gantt: 'Flow & time', timeline: 'Flow & time', calendar: 'Flow & time',
  gauge: 'KPI', linearGauge: 'KPI', progressRing: 'KPI', stat: 'KPI',
  candlestick: 'Financial', ohlc: 'Financial', heikinAshi: 'Financial', volumeProfile: 'Financial', renko: 'Financial', pointFigure: 'Financial', kagi: 'Financial', depth: 'Financial',
  choropleth: 'Geo', bubbleMap: 'Geo', flowMap: 'Geo', hexbinMap: 'Geo', globe: 'Geo',
  bar3d: '3D & scientific', scatter3d: '3D & scientific', line3d: '3D & scientific', surface3d: '3D & scientific', mesh3d: '3D & scientific', isosurface: '3D & scientific', vectorField: '3D & scientific', vectorField3d: '3D & scientific', contour: '3D & scientific', spectrogram: '3D & scientific', waterfall3d: '3D & scientific', ternary: '3D & scientific', smith: '3D & scientific',
  wordCloud: 'Comparison', pareto: 'Comparison', populationPyramid: 'Comparison', confidenceBand: 'Trend', errorBar: 'Distribution', mindMap: 'Hierarchy', voronoi: 'Relationship', polarScatter: 'Relationship', confusionMatrix: 'Machine learning', rocCurve: 'Machine learning', macd: 'Financial', rsi: 'Financial', cartogram: 'Geo', dotDensity: 'Geo',
  baseline: 'Trend', difference: 'Trend', areaBump: 'Trend', smallMultiples: 'Trend', navigator: 'Trend', windBarb: '3D & scientific', divergingBar: 'Comparison', variwide: 'Comparison', packedBubble: 'Part-to-whole', quadrant: 'Relationship', stem: 'Trend', jumpLine: 'Comparison', dotHistogram: 'Distribution', winLoss: 'KPI', variablePie: 'Part-to-whole', parliament: 'Part-to-whole', radialTree: 'Hierarchy', edgeBundling: 'Network', radialHeatmap: 'Relationship', liquidGauge: 'KPI', tileMap: 'Geo', spikeMap: 'Geo', densityMap: 'Geo', map3d: 'Geo', lineBreak: 'Financial', hollowCandle: 'Financial', hlc: 'Financial', histogram2d: 'Relationship', streamline: '3D & scientific',
};

export const GROUPS = ['Comparison', 'Trend', 'Distribution', 'Part-to-whole', 'Hierarchy', 'Relationship', 'Network', 'Flow & time', 'KPI', 'Machine learning', 'Financial', 'Geo', '3D & scientific'];

export const EXTRA_EXAMPLES: Example[] = [
  // ---- Comparison -------------------------------------------------------------------------
  {
    id: 'bar-percent',
    type: 'bar',
    title: '100% stacked bar',
    blurb: 'Each category scaled to 100%: compares shares, not totals.',
    dim: '2D',
    setup: ``,
    props: `stacked: 'percent',
categories: ['North', 'South', 'East', 'West', 'Central'],
yAxis: { label: 'Share of responses (%)' },
series: [
  { name: 'Agree', data: [62, 48, 55, 71, 40] },
  { name: 'Neutral', data: [20, 22, 25, 14, 30] },
  { name: 'Disagree', data: [18, 30, 20, 15, 30] },
],`,
  },
  {
    id: 'lollipop',
    type: 'lollipop',
    title: 'Lollipop',
    blurb: 'A lighter bar chart: a stem and a dot per category.',
    dim: '2D',
    setup: ``,
    props: `name: 'Coffee (kg per person)',
categories: ['Finland', 'Norway', 'Iceland', 'Denmark', 'Netherlands', 'Sweden', 'Switzerland', 'Belgium', 'Canada'],
values: [12, 9.9, 9, 8.7, 8.4, 8.2, 7.9, 6.8, 6.5],
yAxis: { label: 'kg per person per year' },`,
  },
  {
    id: 'dotplot',
    type: 'dotplot',
    title: 'Dot plot (Cleveland)',
    blurb: 'Compare several measures per category on one line each.',
    dim: '2D',
    setup: ``,
    props: `categories: ['Austin', 'Boston', 'Chicago', 'Denver', 'Miami', 'Seattle', 'Phoenix'],
xAxis: { label: 'Median rent ($)' },
series: [
  { name: '2016', data: [1150, 2100, 1300, 1250, 1500, 1600, 900] },
  { name: '2026', data: [1650, 2900, 1700, 1800, 2400, 2200, 1500] },
],`,
  },
  {
    id: 'dumbbell',
    type: 'dumbbell',
    title: 'Dumbbell',
    blurb: 'Before and after for each category, joined by a bar.',
    dim: '2D',
    setup: ``,
    props: `startName: '2000',
endName: '2025',
categories: ['Ethiopia', 'India', 'Brazil', 'China', 'Peru', 'Kenya', 'Vietnam'],
start: [52, 63, 70, 72, 70, 53, 73],
end: [67, 72, 76, 78, 77, 66, 75],
xAxis: { label: 'Life expectancy (years)' },`,
  },
  {
    id: 'rangeBar',
    type: 'rangeBar',
    title: 'Range (floating) bar',
    blurb: 'Each bar spans a low and a high value.',
    dim: '2D',
    setup: ``,
    props: `name: 'Temperature',
horizontal: false,
categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
low: [-4, -3, 1, 6, 11, 16, 19, 18, 14, 8, 3, -2],
high: [3, 5, 10, 16, 21, 26, 29, 28, 24, 17, 10, 4],
yAxis: { label: '°C' },`,
  },
  {
    id: 'bullet',
    type: 'bullet',
    title: 'Bullet',
    blurb: 'A measure against qualitative bands and a target, one scale per row.',
    dim: '2D',
    setup: ``,
    props: `items: [
  { label: 'Revenue ($k)', value: 270, target: 250, ranges: [150, 225, 300] },
  { label: 'Profit (%)', value: 22.5, target: 26, ranges: [20, 25, 30] },
  { label: 'Avg order ($)', value: 410, target: 550, ranges: [350, 500, 600] },
  { label: 'New customers', value: 1650, target: 2100, ranges: [1400, 2000, 2500] },
],`,
  },
  {
    id: 'waterfall',
    type: 'waterfall',
    title: 'Waterfall',
    blurb: 'How a start value becomes an end value, step by step.',
    dim: '2D',
    setup: ``,
    props: `categories: ['Revenue', 'Cost of sales', 'Gross profit', 'Marketing', 'R&D', 'Admin', 'Tax', 'Net income'],
values: [420, -180, 240, -45, -60, -25, -28, 82],
totals: [0, 2, 7],
yAxis: { label: '$M' },`,
  },
  {
    id: 'marimekko',
    type: 'marimekko',
    title: 'Marimekko',
    blurb: 'Column width = market size, segment height = share within it.',
    dim: '2D',
    setup: ``,
    props: `categories: ['Phones', 'Laptops', 'Tablets', 'Wearables'],
series: [
  { name: 'Vendor A', data: [180, 60, 40, 30] },
  { name: 'Vendor B', data: [150, 90, 25, 12] },
  { name: 'Others', data: [120, 70, 20, 18] },
],`,
  },
  {
    id: 'pictograph',
    type: 'pictograph',
    title: 'Pictograph',
    blurb: 'Counts shown as repeated icons; partial icons are clipped exactly.',
    dim: '2D',
    setup: ``,
    props: `unit: 10,
icon: 'person',
data: [
  { label: 'Walk', value: 145 },
  { label: 'Bike', value: 92 },
  { label: 'Bus', value: 128 },
  { label: 'Car', value: 187 },
  { label: 'Remote', value: 64 },
],`,
  },
  {
    id: 'radialBar',
    type: 'radialBar',
    title: 'Radial bar',
    blurb: 'Bars bent into concentric arcs.',
    dim: '2D',
    setup: ``,
    props: `max: 100,
data: [
  { label: 'Design', value: 92 },
  { label: 'Build', value: 74 },
  { label: 'Test', value: 51 },
  { label: 'Docs', value: 33 },
],`,
  },

  // ---- Trend ------------------------------------------------------------------------------
  {
    id: 'spline',
    type: 'line',
    title: 'Spline (smoothed line)',
    blurb: 'Monotone smoothing: curves through every point and never overshoots.',
    dim: '2D',
    setup: `const months = Array.from({ length: 24 }, (_, i) => i + 1);
const a = months.map((m) => 40 + Math.sin(m / 3) * 12 + m);
const b = months.map((m) => 30 + Math.cos(m / 4) * 10 + m * 1.4);`,
    props: `smooth: true,
xAxis: { label: 'Month' },
series: [
  { name: 'Product A', x: months, y: a },
  { name: 'Product B', x: months, y: b },
],`,
  },
  {
    id: 'area-stacked',
    type: 'area',
    title: 'Stacked area',
    blurb: 'Totals over time with each layer’s contribution.',
    dim: '2D',
    setup: `const n = 36;
const wave = (phase, amp, base) => Float32Array.from({ length: n }, (_, i) => base + amp * Math.sin(i / 5 + phase) + i * 0.6);`,
    setupTs: `const n = 36;
const wave = (phase: number, amp: number, base: number) => Float32Array.from({ length: n }, (_, i) => base + amp * Math.sin(i / 5 + phase) + i * 0.6);`,
    props: `stacked: true,
xAxis: { label: 'Month' },
yAxis: { label: 'Visitors (k)' },
series: [
  { name: 'Search', y: wave(0, 6, 30) },
  { name: 'Social', y: wave(1, 5, 20) },
  { name: 'Direct', y: wave(2, 3, 12) },
],`,
  },
  {
    id: 'area-percent',
    type: 'area',
    title: '100% stacked area',
    blurb: 'Shares over time; every x adds up to 100%.',
    dim: '2D',
    setup: `const n = 40;
const share = (k) => Float32Array.from({ length: n }, (_, i) => Math.max(1, 10 + k * 4 + Math.sin(i / 6 + k) * 8 + (k === 0 ? i * 0.8 : -i * 0.2)));`,
    setupTs: `const n = 40;
const share = (k: number) => Float32Array.from({ length: n }, (_, i) => Math.max(1, 10 + k * 4 + Math.sin(i / 6 + k) * 8 + (k === 0 ? i * 0.8 : -i * 0.2)));`,
    props: `stacked: 'percent',
yAxis: { label: 'Share (%)' },
series: [
  { name: 'Mobile', y: share(0) },
  { name: 'Desktop', y: share(1) },
  { name: 'Tablet', y: share(2) },
],`,
  },
  {
    id: 'streamgraph',
    type: 'area',
    title: 'Streamgraph',
    blurb: 'A stacked area centered on zero; shows how layers swell and fade.',
    dim: '2D',
    setup: `const n = 80;
const bump = (center, width, height) =>
  Float32Array.from({ length: n }, (_, i) => 1 + height * Math.exp(-((i - center) ** 2) / (2 * width * width)));`,
    setupTs: `const n = 80;
const bump = (center: number, width: number, height: number) =>
  Float32Array.from({ length: n }, (_, i) => 1 + height * Math.exp(-((i - center) ** 2) / (2 * width * width)));`,
    props: `stacked: 'stream',
smooth: true,
series: [
  { name: 'Jazz', y: bump(15, 10, 30) },
  { name: 'Rock', y: bump(35, 14, 45) },
  { name: 'Pop', y: bump(55, 12, 50) },
  { name: 'Hip-hop', y: bump(68, 9, 40) },
  { name: 'Electronic', y: bump(60, 16, 25) },
],`,
  },
  {
    id: 'rangeArea',
    type: 'rangeArea',
    title: 'Range area / forecast band',
    blurb: 'An uncertainty band around a line.',
    dim: '2D',
    setup: `const n = 60;
const x = Array.from({ length: n }, (_, i) => i);
const median = x.map((i) => 100 + i * 1.2 + Math.sin(i / 4) * 6);
// The band widens the further out the forecast goes.
const low = median.map((v, i) => v - 4 - i * 0.35);
const high = median.map((v, i) => v + 4 + i * 0.35);`,
    props: `xAxis: { label: 'Week' },
bands: [{ name: '80% interval', x, low, high }],
lines: [{ name: 'Median forecast', x, y: median }],`,
  },
  {
    id: 'slope',
    type: 'slope',
    title: 'Slope chart',
    blurb: 'Change between two points in time, item by item.',
    dim: '2D',
    setup: ``,
    props: `labels: ['2015', '2025'],
items: [
  { name: 'Solar', start: 2, end: 15 },
  { name: 'Wind', start: 4, end: 9 },
  { name: 'Hydro', start: 16, end: 14 },
  { name: 'Nuclear', start: 11, end: 9 },
  { name: 'Gas', start: 22, end: 23 },
  { name: 'Coal', start: 39, end: 26 },
],
yAxis: { label: 'Share of electricity (%)' },`,
  },
  {
    id: 'bump',
    type: 'bump',
    title: 'Bump chart',
    blurb: 'Rankings over time; ranks are computed from the values.',
    dim: '2D',
    setup: `const periods = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const teams = ['Lions', 'Hawks', 'Bears', 'Wolves', 'Sharks'];
const series = teams.map((name, k) => {
  let v = 50 + k * 5;
  return { name, data: periods.map(() => (v += (Math.random() - 0.5) * 30)) };
});`,
    props: `periods,
series,`,
  },
  {
    id: 'horizon',
    type: 'horizon',
    title: 'Horizon chart',
    blurb: 'Folds each series into bands: many time series in little height.',
    dim: '2D',
    setup: `const n = 400;
const series = ['CPU', 'Memory', 'Disk', 'Network', 'GPU', 'Cache'].map((name, k) => ({
  name,
  y: Float32Array.from({ length: n }, (_, i) => Math.sin(i / (18 + k * 5) + k) * (40 + k * 6) + (Math.random() - 0.5) * 18),
}));`,
    props: `bands: 3,
series,`,
    height: 300,
  },
  {
    id: 'sparkline',
    type: 'sparkline',
    title: 'Sparkline',
    blurb: 'A word-sized trend with min, max and last value marked.',
    dim: '2D',
    setup: walk('values', 120, 50, 4),
    props: `values,
area: true,`,
    height: 120,
  },
  {
    id: 'radialLine',
    type: 'radialLine',
    title: 'Radial line',
    blurb: 'A cyclical series (hours, months) wrapped around a circle.',
    dim: '2D',
    setup: `const categories = Array.from({ length: 24 }, (_, h) => h + 'h');
const weekday = categories.map((_, h) => 20 + 60 * Math.exp(-((h - 8.5) ** 2) / 4) + 50 * Math.exp(-((h - 17.5) ** 2) / 5));
const weekend = categories.map((_, h) => 15 + 45 * Math.exp(-((h - 14) ** 2) / 18));`,
    props: `categories,
min: 0,
series: [
  { name: 'Weekday', data: weekday },
  { name: 'Weekend', data: weekend },
],`,
  },

  // ---- Distribution -----------------------------------------------------------------------
  {
    id: 'box',
    type: 'box',
    title: 'Box plot',
    blurb: 'Median, quartiles, whiskers (1.5 IQR) and outliers per group.',
    dim: '2D',
    setup: gaussianGroups(false),
    setupTs: gaussianGroups(true),
    props: `yAxis: { label: 'Response time (ms)' },
groups: [
  { name: 'API', values: normal(120, 18, 1000) },
  { name: 'Web', values: normal(180, 35, 1000) },
  { name: 'Mobile', values: normal(210, 50, 1000) },
  { name: 'Batch', values: normal(260, 25, 1000) },
],`,
  },
  {
    id: 'violin',
    type: 'violin',
    title: 'Violin',
    blurb: 'The full shape of each distribution, with the quartile box inside.',
    dim: '2D',
    setup: gaussianGroups(false) + `
const bimodal = Float32Array.from({ length: 1500 }, () => (Math.random() < 0.5 ? 40 : 70) + (Math.random() - 0.5) * 18);`,
    setupTs: gaussianGroups(true) + `
const bimodal = Float32Array.from({ length: 1500 }, () => (Math.random() < 0.5 ? 40 : 70) + (Math.random() - 0.5) * 18);`,
    props: `yAxis: { label: 'Score' },
groups: [
  { name: 'Class A', values: normal(60, 10, 1500) },
  { name: 'Class B', values: bimodal },
  { name: 'Class C', values: normal(52, 15, 1500) },
],`,
  },
  {
    id: 'density',
    type: 'density',
    title: 'Density (KDE)',
    blurb: 'Smooth estimates of each distribution’s shape.',
    dim: '2D',
    setup: gaussianGroups(false),
    setupTs: gaussianGroups(true),
    props: `xAxis: { label: 'Height (cm)' },
series: [
  { name: 'Group 1', values: normal(165, 7, 5000) },
  { name: 'Group 2', values: normal(178, 8, 5000) },
],`,
  },
  {
    id: 'ridgeline',
    type: 'ridgeline',
    title: 'Ridgeline',
    blurb: 'Many distributions stacked with overlap, e.g. temperature by month.',
    dim: '2D',
    setup: gaussianGroups(false) + `
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const groups = months.map((name, m) => ({ name, values: normal(12 - 12 * Math.cos((m / 12) * Math.PI * 2), 4 + (m % 3), 800) }));`,
    setupTs: gaussianGroups(true) + `
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const groups = months.map((name, m) => ({ name, values: normal(12 - 12 * Math.cos((m / 12) * Math.PI * 2), 4 + (m % 3), 800) }));`,
    props: `xAxis: { label: 'Daily high (°C)' },
groups,`,
    height: 380,
  },
  {
    id: 'beeswarm',
    type: 'beeswarm',
    title: 'Beeswarm',
    blurb: 'Every observation as a dot, packed so none overlap.',
    dim: '2D',
    setup: gaussianGroups(false),
    setupTs: gaussianGroups(true),
    props: `xAxis: { label: 'Salary ($k)' },
groups: [
  { name: 'Junior', values: normal(70, 10, 120) },
  { name: 'Mid', values: normal(105, 14, 140) },
  { name: 'Senior', values: normal(150, 20, 110) },
],`,
  },
  {
    id: 'strip',
    type: 'strip',
    title: 'Strip / jitter',
    blurb: 'Raw points per group with random horizontal jitter.',
    dim: '2D',
    setup: gaussianGroups(false),
    setupTs: gaussianGroups(true),
    props: `yAxis: { label: 'Order value ($)' },
groups: [
  { name: 'Mon', values: normal(42, 12, 400) },
  { name: 'Tue', values: normal(45, 14, 400) },
  { name: 'Wed', values: normal(50, 10, 400) },
  { name: 'Thu', values: normal(48, 16, 400) },
  { name: 'Fri', values: normal(60, 18, 400) },
],`,
  },
  {
    id: 'ecdf',
    type: 'ecdf',
    title: 'ECDF',
    blurb: 'Share of values at or below each x. No binning choices needed.',
    dim: '2D',
    setup: gaussianGroups(false),
    setupTs: gaussianGroups(true),
    props: `xAxis: { label: 'Load time (s)' },
series: [
  { name: 'Before', values: normal(3.2, 0.8, 5000) },
  { name: 'After', values: normal(2.4, 0.5, 5000) },
],`,
  },
  {
    id: 'qq',
    type: 'qq',
    title: 'Q–Q plot',
    blurb: 'Sample quantiles against a normal distribution; curvature means skew.',
    dim: '2D',
    setup: `// Log-normal sample: right-skewed, so the points bend away from the line.
const values = Float32Array.from({ length: 3000 }, () => Math.exp(Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()) * 0.4));`,
    props: `name: 'Log-normal sample',
values,
xAxis: { label: 'Theoretical quantiles' },
yAxis: { label: 'Sample quantiles' },`,
  },

  // ---- Part-to-whole ---------------------------------------------------------------------
  {
    id: 'semiDonut',
    type: 'semiDonut',
    title: 'Semi-donut',
    blurb: 'Half a donut, good for one share or a parliament-style split.',
    dim: '2D',
    setup: ``,
    props: `centerLabel: '650 seats',
data: [
  { label: 'Party A', value: 290 },
  { label: 'Party B', value: 210 },
  { label: 'Party C', value: 90 },
  { label: 'Others', value: 60 },
],`,
  },
  {
    id: 'waffle',
    type: 'waffle',
    title: 'Waffle',
    blurb: 'A 10 × 10 grid: each square is 1%.',
    dim: '2D',
    setup: ``,
    props: `data: [
  { label: 'Renewables', value: 32 },
  { label: 'Gas', value: 23 },
  { label: 'Coal', value: 26 },
  { label: 'Nuclear', value: 9 },
  { label: 'Other', value: 10 },
],`,
  },
  {
    id: 'funnel',
    type: 'funnel',
    title: 'Funnel',
    blurb: 'Stage-to-stage conversion.',
    dim: '2D',
    setup: ``,
    props: `data: [
  { label: 'Visited site', value: 12000 },
  { label: 'Viewed product', value: 6400 },
  { label: 'Added to cart', value: 2100 },
  { label: 'Checkout', value: 1250 },
  { label: 'Purchased', value: 860 },
],`,
  },
  {
    id: 'pyramid',
    type: 'pyramid',
    title: 'Pyramid',
    blurb: 'Segment areas match their shares (not just their heights).',
    dim: '2D',
    setup: ``,
    props: `data: [
  { label: 'Executives', value: 5 },
  { label: 'Managers', value: 15 },
  { label: 'Specialists', value: 30 },
  { label: 'Staff', value: 50 },
],`,
  },
  {
    id: 'venn',
    type: 'venn',
    title: 'Venn / Euler',
    blurb: 'Circle areas and overlaps sized to the data (up to three sets).',
    dim: '2D',
    setup: ``,
    props: `data: [
  { sets: ['Email'], size: 1200 },
  { sets: ['Mobile app'], size: 900 },
  { sets: ['Web'], size: 1500 },
  { sets: ['Email', 'Mobile app'], size: 300 },
  { sets: ['Email', 'Web'], size: 500 },
  { sets: ['Mobile app', 'Web'], size: 350 },
  { sets: ['Email', 'Mobile app', 'Web'], size: 120 },
],`,
  },
  {
    id: 'polarArea',
    type: 'polarArea',
    title: 'Polar area (Nightingale rose)',
    blurb: 'Equal angles; radius set so area matches the value.',
    dim: '2D',
    setup: ``,
    props: `data: [
  { label: 'Jan', value: 12 }, { label: 'Feb', value: 19 }, { label: 'Mar', value: 30 },
  { label: 'Apr', value: 42 }, { label: 'May', value: 55 }, { label: 'Jun', value: 61 },
  { label: 'Jul', value: 64 }, { label: 'Aug', value: 58 }, { label: 'Sep', value: 44 },
  { label: 'Oct', value: 31 }, { label: 'Nov', value: 18 }, { label: 'Dec', value: 11 },
],`,
  },
  {
    id: 'windRose',
    type: 'windRose',
    title: 'Wind rose',
    blurb: 'Frequency by direction, stacked by speed band.',
    dim: '2D',
    setup: `const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
// Prevailing south-westerlies.
const prevail = directions.map((_, i) => 1 + 3 * Math.exp(-((i - 10) ** 2) / 6));
const band = (k) => prevail.map((p) => Math.round(p * (4 - k) * (0.8 + Math.random() * 0.4) * 10) / 10);`,
    setupTs: `const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
// Prevailing south-westerlies.
const prevail = directions.map((_, i) => 1 + 3 * Math.exp(-((i - 10) ** 2) / 6));
const band = (k: number) => prevail.map((p) => Math.round(p * (4 - k) * (0.8 + Math.random() * 0.4) * 10) / 10);`,
    props: `directions,
series: [
  { name: '0–5 m/s', data: band(0) },
  { name: '5–10 m/s', data: band(1) },
  { name: '10–15 m/s', data: band(2) },
  { name: '15+ m/s', data: band(3) },
],`,
  },

  // ---- Hierarchy -------------------------------------------------------------------------
  {
    id: 'treemap',
    type: 'treemap',
    title: 'Treemap',
    blurb: 'Nested rectangles sized by value (squarified layout).',
    dim: '2D',
    setup: treeData(false),
    setupTs: treeData(true),
    props: `data,`,
    height: 360,
  },
  {
    id: 'sunburst',
    type: 'sunburst',
    title: 'Sunburst',
    blurb: 'A hierarchy as rings: the center is the root.',
    dim: '2D',
    setup: treeData(false),
    setupTs: treeData(true),
    props: `data,`,
    height: 360,
  },
  {
    id: 'icicle',
    type: 'icicle',
    title: 'Icicle',
    blurb: 'A partition laid out left to right by depth.',
    dim: '2D',
    setup: treeData(false),
    setupTs: treeData(true),
    props: `data,`,
    height: 360,
  },
  {
    id: 'pack',
    type: 'pack',
    title: 'Circle packing',
    blurb: 'Nested circles; area matches value.',
    dim: '2D',
    setup: treeData(false),
    setupTs: treeData(true),
    props: `data,`,
    height: 380,
  },
  {
    id: 'dendrogram',
    type: 'dendrogram',
    title: 'Dendrogram / tree',
    blurb: 'Hierarchy as a node-link tree with leaves aligned.',
    dim: '2D',
    setup: `const data = {
  name: 'Mammals',
  children: [
    { name: 'Primates', children: [{ name: 'Human' }, { name: 'Chimpanzee' }, { name: 'Gorilla' }, { name: 'Macaque' }] },
    { name: 'Carnivores', children: [
      { name: 'Felids', children: [{ name: 'Lion' }, { name: 'Tiger' }, { name: 'House cat' }] },
      { name: 'Canids', children: [{ name: 'Wolf' }, { name: 'Fox' }, { name: 'Dog' }] },
    ] },
    { name: 'Cetaceans', children: [{ name: 'Blue whale' }, { name: 'Orca' }, { name: 'Dolphin' }] },
    { name: 'Rodents', children: [{ name: 'Mouse' }, { name: 'Rat' }, { name: 'Squirrel' }] },
  ],
};`,
    props: `data,`,
    height: 380,
  },
  {
    id: 'orgChart',
    type: 'orgChart',
    title: 'Org chart',
    blurb: 'Reporting lines, top-down.',
    dim: '2D',
    setup: `const data = {
  name: 'Ada Park', title: 'CEO',
  children: [
    { name: 'Ben Ito', title: 'CTO', children: [{ name: 'Cy Ruiz', title: 'Platform' }, { name: 'Di Okoro', title: 'Mobile' }] },
    { name: 'Eve Lund', title: 'CFO', children: [{ name: 'Fay Chen', title: 'Finance' }] },
    { name: 'Gus Moreau', title: 'COO', children: [{ name: 'Hal Singh', title: 'Support' }, { name: 'Ivy Novak', title: 'Sales' }, { name: 'Jo Abe', title: 'People' }] },
  ],
};`,
    props: `data,`,
    height: 320,
  },

  // ---- Relationship ------------------------------------------------------------------------
  {
    id: 'hexbin',
    type: 'hexbin',
    title: 'Hexbin · 200k points',
    blurb: 'Counts in hexagonal bins: density without overplotting.',
    dim: '2D',
    scale: '200k points',
    setup: `const n = 200_000;
const x = new Float32Array(n);
const y = new Float32Array(n);
for (let i = 0; i < n; i++) {
  const g = Math.sqrt(-2 * Math.log(1 - Math.random()));
  const t = 2 * Math.PI * Math.random();
  const second = Math.random() < 0.35;
  x[i] = (second ? 6 : 0) + g * Math.cos(t) * (second ? 1.2 : 2);
  y[i] = (second ? 4 : 0) + g * Math.sin(t) * (second ? 1.2 : 1.4);
}`,
    props: `x,
y,
radius: 9,`,
  },
  {
    id: 'density2d',
    type: 'density2d',
    title: '2D density contours',
    blurb: 'Kernel density of a point cloud, drawn as filled contour bands.',
    dim: '2D',
    setup: `const n = 4000;
const x = new Float32Array(n);
const y = new Float32Array(n);
for (let i = 0; i < n; i++) {
  const g = Math.sqrt(-2 * Math.log(1 - Math.random()));
  const t = 2 * Math.PI * Math.random();
  const k = Math.random() < 0.6;
  x[i] = (k ? 2 : 5) + g * Math.cos(t) * (k ? 1 : 0.7);
  y[i] = (k ? 70 : 85) + g * Math.sin(t) * (k ? 8 : 5);
}`,
    props: `x,
y,
xAxis: { label: 'Eruption (min)' },
yAxis: { label: 'Waiting (min)' },`,
  },
  {
    id: 'splom',
    type: 'splom',
    title: 'Scatterplot matrix (SPLOM)',
    blurb: 'Every pair of variables at once. Hover brushes the row in every cell.',
    dim: '2D',
    setup: `const species = ['Setosa', 'Versicolor', 'Virginica'];
const rows = 450;
const index = Float32Array.from({ length: rows }, (_, i) => i % 3);
const g = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const dim = (base, step, sd) => Float32Array.from(index, (s) => base + s * step + g() * sd);`,
    setupTs: `const species = ['Setosa', 'Versicolor', 'Virginica'];
const rows = 450;
const index = Float32Array.from({ length: rows }, (_, i) => i % 3);
const g = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const dim = (base: number, step: number, sd: number) => Float32Array.from(index, (s) => base + s * step + g() * sd);`,
    props: `groups: { names: species, index },
dimensions: [
  { name: 'Sepal length', values: dim(5, 0.9, 0.4) },
  { name: 'Sepal width', values: dim(3.4, -0.35, 0.3) },
  { name: 'Petal length', values: dim(1.5, 2.3, 0.4) },
  { name: 'Petal width', values: dim(0.25, 0.9, 0.18) },
],`,
    height: 420,
  },
  {
    id: 'connectedScatter',
    type: 'connectedScatter',
    title: 'Connected scatter',
    blurb: 'Two measures traced through time; the arrow shows direction.',
    dim: '2D',
    setup: `const years = Array.from({ length: 16 }, (_, i) => 2010 + i);
const x = years.map((_, i) => 9 - i * 0.35 + Math.sin(i) * 0.6 + (i > 9 ? 2.5 - (i - 10) * 0.8 : 0));
const y = years.map((_, i) => 1.5 + Math.cos(i / 2) * 0.8 + (i > 10 ? (i - 10) * 1.1 : 0));`,
    props: `xAxis: { label: 'Unemployment (%)' },
yAxis: { label: 'Inflation (%)' },
series: [{ name: 'Economy', x, y, labels: years.map(String) }],`,
  },
  {
    id: 'parallel',
    type: 'parallel',
    title: 'Parallel coordinates · 1,500 rows',
    blurb: 'One line per row across every dimension.',
    dim: '2D',
    setup: `const rows = 1500;
const index = Float32Array.from({ length: rows }, () => Math.floor(Math.random() * 3));
const g = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const dim = (base, step, sd) => Float32Array.from(index, (k) => base + k * step + g() * sd);`,
    setupTs: `const rows = 1500;
const index = Float32Array.from({ length: rows }, () => Math.floor(Math.random() * 3));
const g = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const dim = (base: number, step: number, sd: number) => Float32Array.from(index, (k) => base + k * step + g() * sd);`,
    props: `groups: { names: ['Economy', 'Family', 'Sports'], index },
dimensions: [
  { name: 'Price ($k)', values: dim(22, 14, 5) },
  { name: 'MPG', values: dim(40, -8, 4) },
  { name: 'Horsepower', values: dim(120, 90, 25) },
  { name: 'Weight (t)', values: dim(1.2, 0.35, 0.12) },
  { name: '0–60 (s)', values: dim(10, -2.2, 0.8) },
  { name: 'Seats', values: dim(5, 0.6, 0.6) },
],`,
  },

  // ---- Network -------------------------------------------------------------------------------
  {
    id: 'chord',
    type: 'chord',
    title: 'Chord diagram',
    blurb: 'Flows between groups in both directions.',
    dim: '2D',
    setup: ``,
    props: `names: ['Europe', 'Asia', 'Americas', 'Africa', 'Oceania'],
matrix: [
  [0, 42, 38, 12, 6],
  [35, 0, 50, 15, 18],
  [30, 44, 0, 8, 5],
  [18, 10, 6, 0, 2],
  [5, 16, 7, 1, 0],
],`,
    height: 380,
  },
  {
    id: 'arcDiagram',
    type: 'arcDiagram',
    title: 'Arc diagram',
    blurb: 'Nodes on a line, links as arcs; good for ordered networks.',
    dim: '2D',
    setup: graphData(false, 30, 4),
    setupTs: graphData(true, 30, 4),
    props: `nodes,
links,
groupNames,`,
  },
  {
    id: 'adjacency',
    type: 'adjacency',
    title: 'Adjacency matrix',
    blurb: 'A network as a grid; nodes are ordered by group so communities form blocks.',
    dim: '2D',
    setup: graphData(false, 40, 4),
    setupTs: graphData(true, 40, 4),
    props: `nodes,
links,`,
    height: 380,
  },
  {
    id: 'network',
    type: 'network',
    title: 'Force-directed network · 600 nodes',
    blurb: 'Live Barnes–Hut layout. Drag nodes; click, then scroll to zoom.',
    dim: '2D',
    scale: '600 nodes',
    setup: graphData(false, 600, 5),
    setupTs: graphData(true, 600, 5),
    props: `nodes,
links,
groupNames,`,
    height: 400,
  },
  {
    id: 'network3d',
    type: 'network3d',
    title: '3D network · 1,000 nodes',
    blurb: 'The same force layout in three dimensions.',
    dim: '3D',
    scale: '1k nodes',
    setup: graphData(false, 1000, 6),
    setupTs: graphData(true, 1000, 6),
    props: `nodes,
links,
groupNames,`,
    height: 400,
  },

  // ---- Flow & time -----------------------------------------------------------------------------
  {
    id: 'sankey',
    type: 'sankey',
    title: 'Sankey',
    blurb: 'Flow quantities between stages; link width = value.',
    dim: '2D',
    setup: ``,
    props: `nodes: [
  { id: 'coal', name: 'Coal' },
  { id: 'gas', name: 'Gas' },
  { id: 'nuclear', name: 'Nuclear' },
  { id: 'renew', name: 'Renewables' },
  { id: 'elec', name: 'Electricity' },
  { id: 'industry', name: 'Industry' },
  { id: 'homes', name: 'Homes' },
  { id: 'transport', name: 'Transport' },
  { id: 'loss', name: 'Losses' },
],
links: [
  { source: 'coal', target: 'elec', value: 25 },
  { source: 'coal', target: 'industry', value: 10 },
  { source: 'gas', target: 'elec', value: 22 },
  { source: 'gas', target: 'homes', value: 18 },
  { source: 'gas', target: 'industry', value: 12 },
  { source: 'nuclear', target: 'elec', value: 15 },
  { source: 'renew', target: 'elec', value: 28 },
  { source: 'renew', target: 'transport', value: 4 },
  { source: 'elec', target: 'industry', value: 30 },
  { source: 'elec', target: 'homes', value: 26 },
  { source: 'elec', target: 'transport', value: 8 },
  { source: 'elec', target: 'loss', value: 26 },
],`,
    height: 380,
  },
  {
    id: 'alluvial',
    type: 'alluvial',
    title: 'Alluvial',
    blurb: 'How categories regroup across dimensions; flows keep their first color.',
    dim: '2D',
    setup: `// Passenger counts by class, sex, age group and outcome.
const rows = [];
for (const cls of ['1st', '2nd', '3rd', 'Crew']) for (const sex of ['Male', 'Female']) for (const age of ['Adult', 'Child']) {
  if (cls === 'Crew' && age === 'Child') continue;
  const base = { '1st': 160, '2nd': 140, '3rd': 350, Crew: 450 }[cls] * (sex === 'Male' ? 0.65 : 0.35) * (age === 'Adult' ? 0.92 : 0.08);
  const survival = (sex === 'Female' ? 0.75 : 0.2) * (cls === '3rd' ? 0.6 : cls === 'Crew' ? 0.9 : 1.1) * (age === 'Child' ? 1.4 : 1);
  const lived = Math.round(base * Math.min(0.95, survival));
  rows.push({ values: [cls, sex, age, 'Survived'], count: lived });
  rows.push({ values: [cls, sex, age, 'Died'], count: Math.round(base) - lived });
}`,
    setupTs: `// Passenger counts by class, sex, age group and outcome.
const rows: { values: string[]; count: number }[] = [];
const size: Record<string, number> = { '1st': 160, '2nd': 140, '3rd': 350, Crew: 450 };
for (const cls of ['1st', '2nd', '3rd', 'Crew']) for (const sex of ['Male', 'Female']) for (const age of ['Adult', 'Child']) {
  if (cls === 'Crew' && age === 'Child') continue;
  const base = size[cls] * (sex === 'Male' ? 0.65 : 0.35) * (age === 'Adult' ? 0.92 : 0.08);
  const survival = (sex === 'Female' ? 0.75 : 0.2) * (cls === '3rd' ? 0.6 : cls === 'Crew' ? 0.9 : 1.1) * (age === 'Child' ? 1.4 : 1);
  const lived = Math.round(base * Math.min(0.95, survival));
  rows.push({ values: [cls, sex, age, 'Survived'], count: lived });
  rows.push({ values: [cls, sex, age, 'Died'], count: Math.round(base) - lived });
}`,
    props: `dimensions: ['Class', 'Sex', 'Age', 'Outcome'],
rows,`,
    height: 400,
  },
  {
    id: 'gantt',
    type: 'gantt',
    title: 'Gantt',
    blurb: 'Tasks over time with progress, dependencies and a today line.',
    dim: '2D',
    setup: `const day = 86_400_000;
const t0 = Date.UTC(2026, 8, 1);
const d = (n) => t0 + n * day;`,
    setupTs: `const day = 86_400_000;
const t0 = Date.UTC(2026, 8, 1);
const d = (n: number) => t0 + n * day;`,
    props: `xAxis: { type: 'time' },
today: d(24),
tasks: [
  { name: 'Research', start: d(0), end: d(8), progress: 1, group: 'Design' },
  { name: 'Wireframes', start: d(6), end: d(14), progress: 1, group: 'Design', dependsOn: ['Research'] },
  { name: 'Visual design', start: d(14), end: d(24), progress: 0.8, group: 'Design', dependsOn: ['Wireframes'] },
  { name: 'API', start: d(10), end: d(30), progress: 0.55, group: 'Build' },
  { name: 'Frontend', start: d(22), end: d(40), progress: 0.2, group: 'Build', dependsOn: ['Visual design'] },
  { name: 'QA', start: d(38), end: d(46), progress: 0, group: 'Build', dependsOn: ['Frontend', 'API'] },
  { name: 'Beta', start: d(46), end: d(52), progress: 0, group: 'Launch', dependsOn: ['QA'] },
  { name: 'Launch', start: d(52), end: d(54), progress: 0, group: 'Launch', dependsOn: ['Beta'] },
],`,
    height: 340,
  },
  {
    id: 'timeline',
    type: 'timeline',
    title: 'Timeline',
    blurb: 'Events and spans on a time axis; labels are packed into lanes.',
    dim: '2D',
    setup: `const y = (year, month = 0) => Date.UTC(year, month, 1);`,
    setupTs: `const y = (year: number, month = 0) => Date.UTC(year, month, 1);`,
    props: `xAxis: { type: 'time' },
events: [
  { label: 'World Wide Web', start: y(1991, 7), group: 'Web' },
  { label: 'JavaScript', start: y(1995, 11), group: 'Languages' },
  { label: 'CSS', start: y(1996, 11), group: 'Web' },
  { label: 'Browser wars', start: y(1995), end: y(2001), group: 'Web' },
  { label: 'AJAX', start: y(2005, 1), group: 'Web' },
  { label: 'jQuery', start: y(2006, 7), group: 'Libraries' },
  { label: 'Chrome', start: y(2008, 8), group: 'Web' },
  { label: 'Node.js', start: y(2009, 4), group: 'Languages' },
  { label: 'WebGL 1.0', start: y(2011, 2), group: 'Graphics' },
  { label: 'TypeScript', start: y(2012, 9), group: 'Languages' },
  { label: 'React', start: y(2013, 4), group: 'Libraries' },
  { label: 'WebGL 2.0', start: y(2017, 0), group: 'Graphics' },
  { label: 'WebGPU', start: y(2023, 3), group: 'Graphics' },
],`,
  },
  {
    id: 'calendar',
    type: 'calendar',
    title: 'Calendar heatmap',
    blurb: 'One square per day, weeks as columns.',
    dim: '2D',
    setup: `const day = 86_400_000;
const start = Date.UTC(2025, 0, 1);
const n = 365 * 2;
const dates = Float64Array.from({ length: n }, (_, i) => start + i * day);
const values = Float32Array.from({ length: n }, (_, i) => {
  const dow = new Date(start + i * day).getUTCDay();
  const weekday = dow > 0 && dow < 6 ? 1 : 0.3;
  return Math.max(0, Math.round(weekday * (6 + 4 * Math.sin(i / 40)) + (Math.random() - 0.4) * 6));
});`,
    props: `dates,
values,`,
    height: 280,
  },

  // ---- KPI ------------------------------------------------------------------------------------
  {
    id: 'linearGauge',
    type: 'linearGauge',
    title: 'Linear gauge',
    blurb: 'A value on a straight scale with status bands and a target.',
    dim: '2D',
    setup: ``,
    props: `value: 68,
target: 80,
units: '%',
label: 'Quarterly goal',
bands: [
  { to: 50, color: '#d03b3b' },
  { to: 75, color: '#fab219' },
  { to: 100, color: '#0ca30c' },
],`,
    height: 160,
  },
  {
    id: 'thermometer',
    type: 'linearGauge',
    title: 'Thermometer',
    blurb: 'The linear gauge as a vertical tube.',
    dim: '2D',
    setup: ``,
    props: `variant: 'thermometer',
value: 23.5,
min: -10,
max: 40,
units: '°C',
label: 'Greenhouse',`,
  },
  {
    id: 'progressRing',
    type: 'progressRing',
    title: 'Progress rings',
    blurb: 'Several goals as concentric rings with rounded ends.',
    dim: '2D',
    setup: ``,
    props: `rings: [
  { label: 'Move', value: 420, max: 500 },
  { label: 'Exercise', value: 26, max: 30 },
  { label: 'Stand', value: 9, max: 12 },
],`,
  },
  {
    id: 'stat',
    type: 'stat',
    title: 'Stat tile',
    blurb: 'A headline number with its change and a sparkline.',
    dim: '2D',
    setup: walk('spark', 60, 45000, 900),
    props: `label: 'Monthly active users',
value: 48210,
previous: 45120,
spark,`,
    height: 200,
  },

  // ---- Financial -----------------------------------------------------------------------------
  {
    id: 'ohlc',
    type: 'ohlc',
    title: 'OHLC bars',
    blurb: 'Open tick left, close tick right, high–low line.',
    dim: '2D',
    setup: ohlcSetup(false, 160),
    setupTs: ohlcSetup(true, 160),
    props: `name: 'ACME',
xAxis: { type: 'time' },
x, open, high, low, close,`,
  },
  {
    id: 'heikinAshi',
    type: 'heikinAshi',
    title: 'Heikin-Ashi',
    blurb: 'Candles computed from averaged prices; trends read more clearly.',
    dim: '2D',
    setup: ohlcSetup(false, 200),
    setupTs: ohlcSetup(true, 200),
    props: `name: 'ACME',
xAxis: { type: 'time' },
x, open, high, low, close,`,
  },
  {
    id: 'volumeProfile',
    type: 'volumeProfile',
    title: 'Volume profile',
    blurb: 'Candles with traded volume by price on the right; the point of control is highlighted.',
    dim: '2D',
    setup: ohlcSetup(false, 260, true),
    setupTs: ohlcSetup(true, 260, true),
    props: `name: 'ACME',
xAxis: { type: 'time' },
x, open, high, low, close, volume,`,
  },
  {
    id: 'renko',
    type: 'renko',
    title: 'Renko',
    blurb: 'Fixed-size bricks that ignore time; only price moves count.',
    dim: '2D',
    setup: closeSeries(700),
    props: `x,
close,`,
  },
  {
    id: 'pointFigure',
    type: 'pointFigure',
    title: 'Point & figure',
    blurb: 'Columns of X (rising) and O (falling); 3-box reversal.',
    dim: '2D',
    setup: closeSeries(700),
    props: `close,
reversal: 3,`,
  },
  {
    id: 'kagi',
    type: 'kagi',
    title: 'Kagi',
    blurb: 'Line turns on a 4% reversal; thick after breaking a high, thin after breaking a low.',
    dim: '2D',
    setup: closeSeries(700),
    props: `x,
close,
reversal: 0.04,`,
  },
  {
    id: 'depth',
    type: 'depth',
    title: 'Market depth',
    blurb: 'Cumulative order book on each side of the mid price.',
    dim: '2D',
    setup: `const mid = 100;
const bids = Array.from({ length: 60 }, (_, i) => ({ price: mid - 0.05 - i * 0.1, size: 5 + Math.random() * 40 + i * 1.5 }));
const asks = Array.from({ length: 60 }, (_, i) => ({ price: mid + 0.05 + i * 0.1, size: 5 + Math.random() * 40 + i * 1.2 }));`,
    props: `bids,
asks,
xAxis: { label: 'Price' },
yAxis: { label: 'Cumulative size' },`,
  },

  // ---- Geo -----------------------------------------------------------------------------------
  {
    id: 'choropleth',
    type: 'choropleth',
    title: 'Choropleth',
    blurb: 'Countries shaded by value. Click, then scroll to zoom; drag to pan.',
    dim: '2D',
    needsWorld: true,
    setup: countryValues(false),
    setupTs: countryValues(true),
    props: `topology: world,
values,
exclude: ['Antarctica'],`,
    height: 360,
  },
  {
    id: 'bubbleMap',
    type: 'bubbleMap',
    title: 'Bubble map',
    blurb: 'Values at locations, bubble area = value.',
    dim: '2D',
    needsWorld: true,
    setup: cities,
    props: `topology: world,
exclude: ['Antarctica'],
points: cities,`,
    height: 360,
  },
  {
    id: 'flowMap',
    type: 'flowMap',
    title: 'Flow map',
    blurb: 'Curved routes between places; width = volume.',
    dim: '2D',
    needsWorld: true,
    setup: cities + `
const hub = cities[15]; // London
const flows = cities.filter((c) => c !== hub).map((c) => ({ from: [hub.lon, hub.lat], to: [c.lon, c.lat], value: c.value, label: 'London → ' + c.label }));`,
    setupTs: cities + `
const hub = cities[15]; // London
const flows = cities.filter((c) => c !== hub).map((c) => ({ from: [hub.lon, hub.lat] as [number, number], to: [c.lon, c.lat] as [number, number], value: c.value, label: 'London → ' + c.label }));`,
    props: `topology: world,
exclude: ['Antarctica'],
flows,`,
    height: 360,
  },
  {
    id: 'hexbinMap',
    type: 'hexbinMap',
    title: 'Hexbin map · 100k points',
    blurb: 'Point density binned into hexagons on a map.',
    dim: '2D',
    scale: '100k points',
    needsWorld: true,
    setup: cities + `
const n = 100_000;
const lon = new Float32Array(n);
const lat = new Float32Array(n);
for (let i = 0; i < n; i++) {
  const c = cities[Math.floor(Math.random() * cities.length)];
  const r = Math.sqrt(-2 * Math.log(1 - Math.random())) * 4;
  const t = Math.random() * Math.PI * 2;
  lon[i] = c.lon + Math.cos(t) * r;
  lat[i] = c.lat + Math.sin(t) * r * 0.7;
}`,
    props: `topology: world,
exclude: ['Antarctica'],
lon,
lat,
radius: 7,`,
    height: 360,
  },
  {
    id: 'globe',
    type: 'globe',
    title: '3D globe',
    blurb: 'Choropleth on a sphere with city bars and great-circle routes.',
    dim: '3D',
    needsWorld: true,
    setup: countryValues(false) + '\n' + cities + `
const flows = cities.slice(1, 9).map((c) => ({ from: [cities[0].lon, cities[0].lat], to: [c.lon, c.lat], value: c.value }));`,
    setupTs: countryValues(true) + '\n' + cities + `
const flows = cities.slice(1, 9).map((c) => ({ from: [cities[0].lon, cities[0].lat] as [number, number], to: [c.lon, c.lat] as [number, number], value: c.value }));`,
    props: `topology: world,
values,
points: cities,
flows,
autoRotate: true,`,
    height: 400,
  },

  // ---- 3D & scientific -------------------------------------------------------------------------
  {
    id: 'contour',
    type: 'contour',
    title: 'Contour',
    blurb: 'Filled bands and isolines computed per pixel on the GPU.',
    dim: '2D',
    setup: `const rows = 200;
const cols = 200;
const data = new Float32Array(rows * cols);
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = (c / (cols - 1)) * 6 - 3;
    const y = (r / (rows - 1)) * 6 - 3;
    data[r * cols + c] = Math.exp(-((x - 1) ** 2 + (y - 0.5) ** 2)) * 2 + Math.exp(-((x + 1.2) ** 2 + (y + 1) ** 2) / 0.6) * 1.5 - 0.1 * (x * x + y * y) / 3;
  }
}`,
    props: `data,
rows,
cols,
extent: [-3, 3, -3, 3],
levels: 12,`,
  },
  {
    id: 'vectorField',
    type: 'vectorField',
    title: 'Vector field (quiver)',
    blurb: 'Direction and magnitude on a grid.',
    dim: '2D',
    setup: `const x = [], y = [], u = [], v = [];
for (let i = -10; i <= 10; i++) {
  for (let j = -10; j <= 10; j++) {
    // A vortex plus a gentle drift.
    const r2 = i * i + j * j + 4;
    x.push(i); y.push(j);
    u.push(-j / r2 * 20 + 0.4);
    v.push(i / r2 * 20);
  }
}`,
    setupTs: `const x: number[] = [], y: number[] = [], u: number[] = [], v: number[] = [];
for (let i = -10; i <= 10; i++) {
  for (let j = -10; j <= 10; j++) {
    // A vortex plus a gentle drift.
    const r2 = i * i + j * j + 4;
    x.push(i); y.push(j);
    u.push(-j / r2 * 20 + 0.4);
    v.push(i / r2 * 20);
  }
}`,
    props: `x, y, u, v,`,
  },
  {
    id: 'spectrogram',
    type: 'spectrogram',
    title: 'Spectrogram',
    blurb: 'Frequency content over time (a rising chirp plus a steady tone).',
    dim: '2D',
    setup: `const rows = 128; // frequency bins
const cols = 300; // time slices
const data = new Float32Array(rows * cols);
for (let c = 0; c < cols; c++) {
  const chirp = 10 + (c / cols) * 100;
  for (let r = 0; r < rows; r++) {
    data[r * cols + c] = Math.exp(-((r - chirp) ** 2) / 12) + 0.7 * Math.exp(-((r - 30) ** 2) / 4) + Math.random() * 0.08;
  }
}`,
    props: `data,
rows,
cols,
duration: 3,
maxFrequency: 8000,`,
  },
  {
    id: 'ternary',
    type: 'ternary',
    title: 'Ternary plot',
    blurb: 'Three-part compositions that sum to 100%.',
    dim: '2D',
    setup: `const soil = (sand, silt, clay, n) => {
  const a = [], b = [], c = [];
  for (let i = 0; i < n; i++) {
    a.push(Math.max(1, sand + (Math.random() - 0.5) * 20));
    b.push(Math.max(1, silt + (Math.random() - 0.5) * 20));
    c.push(Math.max(1, clay + (Math.random() - 0.5) * 20));
  }
  return { a, b, c };
};`,
    setupTs: `const soil = (sand: number, silt: number, clay: number, n: number) => {
  const a: number[] = [], b: number[] = [], c: number[] = [];
  for (let i = 0; i < n; i++) {
    a.push(Math.max(1, sand + (Math.random() - 0.5) * 20));
    b.push(Math.max(1, silt + (Math.random() - 0.5) * 20));
    c.push(Math.max(1, clay + (Math.random() - 0.5) * 20));
  }
  return { a, b, c };
};`,
    props: `axes: ['Sand', 'Silt', 'Clay'],
series: [
  { name: 'Field A', ...soil(65, 20, 15, 40) },
  { name: 'Field B', ...soil(20, 55, 25, 40) },
  { name: 'Field C', ...soil(25, 25, 50, 40) },
],`,
    height: 380,
  },
  {
    id: 'smith',
    type: 'smith',
    title: 'Smith chart',
    blurb: 'Impedance vs frequency for RF matching (normalized to 50 Ω).',
    dim: '2D',
    setup: `const sweep = (r0, l, c, n) => {
  const r = [], x = [];
  for (let i = 0; i < n; i++) {
    const w = 0.4 + (i / (n - 1)) * 2.2;
    r.push(r0);
    x.push(w * l - 1 / (w * c));
  }
  return { r, x };
};`,
    setupTs: `const sweep = (r0: number, l: number, c: number, n: number) => {
  const r: number[] = [], x: number[] = [];
  for (let i = 0; i < n; i++) {
    const w = 0.4 + (i / (n - 1)) * 2.2;
    r.push(r0);
    x.push(w * l - 1 / (w * c));
  }
  return { r, x };
};`,
    props: `series: [
  { name: 'Antenna A', ...sweep(0.6, 1.2, 1.4, 40) },
  { name: 'Antenna B', ...sweep(1.8, 0.8, 2.5, 40) },
],`,
    height: 380,
  },
  {
    id: 'mesh3d',
    type: 'mesh3d',
    title: '3D mesh',
    blurb: 'Any triangle mesh with per-vertex values (here a torus colored by height).',
    dim: '3D',
    setup: `const U = 96, V = 32, R = 3, r = 1.1;
const vertices = [], indices = [], values = [];
for (let i = 0; i <= U; i++) {
  for (let j = 0; j <= V; j++) {
    const u = (i / U) * Math.PI * 2;
    const v = (j / V) * Math.PI * 2;
    const ripple = 0.25 * Math.sin(u * 5);
    const x = (R + (r + ripple) * Math.cos(v)) * Math.cos(u);
    const y = (R + (r + ripple) * Math.cos(v)) * Math.sin(u);
    const z = (r + ripple) * Math.sin(v);
    vertices.push(x, y, z);
    values.push(z + ripple);
  }
}
for (let i = 0; i < U; i++) {
  for (let j = 0; j < V; j++) {
    const a = i * (V + 1) + j, b = a + V + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
}`,
    setupTs: `const U = 96, V = 32, R = 3, r = 1.1;
const vertices: number[] = [], indices: number[] = [], values: number[] = [];
for (let i = 0; i <= U; i++) {
  for (let j = 0; j <= V; j++) {
    const u = (i / U) * Math.PI * 2;
    const v = (j / V) * Math.PI * 2;
    const ripple = 0.25 * Math.sin(u * 5);
    const x = (R + (r + ripple) * Math.cos(v)) * Math.cos(u);
    const y = (R + (r + ripple) * Math.cos(v)) * Math.sin(u);
    const z = (r + ripple) * Math.sin(v);
    vertices.push(x, y, z);
    values.push(z + ripple);
  }
}
for (let i = 0; i < U; i++) {
  for (let j = 0; j < V; j++) {
    const a = i * (V + 1) + j, b = a + V + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
}`,
    props: `vertices,
indices,
values,
zLabel: 'Height',`,
    height: 380,
  },
  {
    id: 'isosurface',
    type: 'isosurface',
    title: 'Isosurface',
    blurb: 'Nested shells of a 3D scalar field (marching cubes).',
    dim: '3D',
    scale: '64³ grid',
    setup: `const size = 64;
const data = new Float32Array(size ** 3);
const blobs = [[0.35, 0.4, 0.5], [0.65, 0.55, 0.45], [0.5, 0.7, 0.6]];
for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  let v = 0;
  for (const [bx, by, bz] of blobs) {
    const d2 = (x / size - bx) ** 2 + (y / size - by) ** 2 + (z / size - bz) ** 2;
    v += Math.exp(-d2 / 0.012);
  }
  data[x + y * size + z * size * size] = v;
}`,
    props: `data,
size,
levels: [0.3, 0.6, 0.9],`,
    height: 380,
  },
  {
    id: 'vectorField3d',
    type: 'vectorField3d',
    title: '3D vector field',
    blurb: 'Cones show flow direction and strength in a volume.',
    dim: '3D',
    setup: `const x = [], y = [], z = [], u = [], v = [], w = [];
for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) for (let k = 0; k <= 6; k++) {
  // A rising vortex.
  x.push(i); y.push(j); z.push(k);
  u.push(-j * 0.5); v.push(i * 0.5); w.push(0.6 + k * 0.1);
}`,
    setupTs: `const x: number[] = [], y: number[] = [], z: number[] = [], u: number[] = [], v: number[] = [], w: number[] = [];
for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) for (let k = 0; k <= 6; k++) {
  // A rising vortex.
  x.push(i); y.push(j); z.push(k);
  u.push(-j * 0.5); v.push(i * 0.5); w.push(0.6 + k * 0.1);
}`,
    props: `x, y, z, u, v, w,
autoRotate: true,`,
    height: 380,
  },
  {
    id: 'waterfall3d',
    type: 'waterfall3d',
    title: '3D waterfall',
    blurb: 'Spectra over time as stacked slices; slices in front hide those behind.',
    dim: '3D',
    setup: `const rows = 40;
const cols = 200;
const data = new Float32Array(rows * cols);
for (let r = 0; r < rows; r++) {
  const peak = 40 + r * 2.5;
  for (let c = 0; c < cols; c++) {
    data[r * cols + c] = Math.exp(-((c - peak) ** 2) / 40) * (1 + r / 40) + 0.4 * Math.exp(-((c - 150) ** 2) / 20) + Math.random() * 0.05;
  }
}`,
    props: `data,
rows,
cols,
xLabel: 'Frequency bin',
yLabel: 'Time',`,
    height: 380,
  },
  // ---- Added: text, statistics, ML, indicators, more geo --------------------------------------
  {
    id: 'wordCloud',
    type: 'wordCloud',
    title: 'Word cloud',
    blurb: 'Words sized by frequency; color marks praise vs complaints.',
    dim: '2D',
    setup: `// Word counts from product reviews.
const counts = {
  fast: 96, battery: 88, screen: 74, price: 70, camera: 66, light: 52, sturdy: 47, charger: 44, sound: 41,
  support: 39, update: 35, design: 33, heavy: 30, bright: 28, cheap: 27, warranty: 25, apps: 24, keyboard: 22,
  slow: 20, storage: 19, setup: 18, case: 17, colors: 16, fingerprint: 15, wifi: 15, bluetooth: 14, refund: 13,
  shipping: 13, manual: 12, packaging: 11, glitch: 11, speaker: 10, sleek: 10, crash: 9, noise: 9, heat: 8,
  returns: 8, upgrade: 8, value: 7, quality: 7,
};
const complaints = ['heavy', 'slow', 'refund', 'glitch', 'crash', 'noise', 'heat', 'returns', 'cheap'];
const words = Object.entries(counts).map(([text, value]) => ({ text, value, group: complaints.includes(text) ? 'Complaint' : 'Praise' }));`,
    props: `words,`,
    height: 340,
  },
  {
    id: 'pareto',
    type: 'pareto',
    title: 'Pareto chart',
    blurb: 'Causes sorted by size with the running total: the few that matter most stand out.',
    dim: '2D',
    setup: ``,
    props: `name: 'Defects',
data: [
  { label: 'Scratches', value: 412 }, { label: 'Dents', value: 251 }, { label: 'Misaligned', value: 160 },
  { label: 'Loose screws', value: 94 }, { label: 'Discoloration', value: 61 }, { label: 'Cracks', value: 38 },
  { label: 'Missing parts', value: 24 }, { label: 'Other', value: 17 },
],
yAxis: { label: 'Defects' },`,
  },
  {
    id: 'populationPyramid',
    type: 'populationPyramid',
    title: 'Population pyramid',
    blurb: 'Back-to-back bars: two groups compared band by band.',
    dim: '2D',
    setup: ``,
    props: `categories: ['0–9', '10–19', '20–29', '30–39', '40–49', '50–59', '60–69', '70–79', '80+'],
left: { name: 'Male', values: [2.9, 3.1, 3.4, 3.6, 3.3, 3.2, 2.7, 1.8, 0.8] },
right: { name: 'Female', values: [2.8, 3.0, 3.3, 3.6, 3.4, 3.4, 2.9, 2.2, 1.3] },
xAxis: { label: 'Population (millions)' },`,
  },
  {
    id: 'confidenceBand',
    type: 'confidenceBand',
    title: 'Confidence band (fan chart)',
    blurb: 'A forecast with 50% and 95% intervals that widen with the horizon.',
    dim: '2D',
    setup: `const n = 120;
const x = Array.from({ length: n }, (_, i) => i);
const y = [], lo95 = [], hi95 = [], lo50 = [], hi50 = [];
for (let i = 0; i < n; i++) {
  const mean = 100 + i * 0.6 + Math.sin(i / 8) * 6;
  const sd = 2 + i * 0.12; // uncertainty grows with the horizon
  y.push(mean);
  lo95.push(mean - 1.96 * sd);
  hi95.push(mean + 1.96 * sd);
  lo50.push(mean - 0.674 * sd);
  hi50.push(mean + 0.674 * sd);
}`,
    setupTs: `const n = 120;
const x = Array.from({ length: n }, (_, i) => i);
const y: number[] = [], lo95: number[] = [], hi95: number[] = [], lo50: number[] = [], hi50: number[] = [];
for (let i = 0; i < n; i++) {
  const mean = 100 + i * 0.6 + Math.sin(i / 8) * 6;
  const sd = 2 + i * 0.12; // uncertainty grows with the horizon
  y.push(mean);
  lo95.push(mean - 1.96 * sd);
  hi95.push(mean + 1.96 * sd);
  lo50.push(mean - 0.674 * sd);
  hi50.push(mean + 0.674 * sd);
}`,
    props: `series: [
  {
    name: 'Forecast',
    x,
    y,
    bands: [
      { lower: lo95, upper: hi95, label: '95% interval' },
      { lower: lo50, upper: hi50, label: '50% interval' },
    ],
  },
],
xAxis: { label: 'Days ahead' },
yAxis: { label: 'Daily orders' },`,
  },
  {
    id: 'errorBar',
    type: 'errorBar',
    title: 'Error bars',
    blurb: 'Means with 95% confidence intervals, two time points per dose.',
    dim: '2D',
    setup: ``,
    props: `categories: ['Placebo', '10 mg', '20 mg', '40 mg'],
series: [
  { name: 'Week 4', x: [0, 1, 2, 3], y: [1.2, 2.8, 4.1, 5.0], error: [0.6, 0.7, 0.8, 0.9] },
  { name: 'Week 8', x: [0, 1, 2, 3], y: [1.5, 3.6, 5.4, 6.8], error: [0.7, 0.8, 0.9, 1.1] },
],
yAxis: { label: 'Improvement (points)' },`,
  },
  {
    id: 'mindMap',
    type: 'mindMap',
    title: 'Mind map',
    blurb: 'A central topic branching both ways; each branch keeps its color.',
    dim: '2D',
    setup: `const data = {
  name: 'Product launch',
  children: [
    { name: 'Research', children: [{ name: 'User interviews' }, { name: 'Competitors' }, { name: 'Pricing study' }] },
    { name: 'Design', children: [{ name: 'Wireframes' }, { name: 'Prototype' }, { name: 'Usability tests' }] },
    { name: 'Engineering', children: [{ name: 'API' }, { name: 'Mobile app' }, { name: 'Load testing' }] },
    { name: 'Marketing', children: [{ name: 'Landing page' }, { name: 'Email campaign' }, { name: 'Press kit' }] },
    { name: 'Support', children: [{ name: 'Help center' }, { name: 'Training' }] },
    { name: 'Legal', children: [{ name: 'Terms' }, { name: 'Privacy review' }] },
  ],
};`,
    props: `data,`,
    height: 360,
  },
  {
    id: 'voronoi',
    type: 'voronoi',
    title: 'Voronoi diagram',
    blurb: 'Each cell is the area closest to one store; color is the sales region.',
    dim: '2D',
    setup: `const n = 240;
const x = new Float32Array(n);
const y = new Float32Array(n);
const groups = [];
const centers = [['North', 30, 70], ['East', 72, 55], ['South', 45, 22]];
for (let i = 0; i < n; i++) {
  const [name, cx, cy] = centers[i % 3];
  x[i] = cx + (Math.random() - 0.5) * 50;
  y[i] = cy + (Math.random() - 0.5) * 40;
  groups.push(name);
}`,
    setupTs: `const n = 240;
const x = new Float32Array(n);
const y = new Float32Array(n);
const groups: string[] = [];
const centers: [string, number, number][] = [['North', 30, 70], ['East', 72, 55], ['South', 45, 22]];
for (let i = 0; i < n; i++) {
  const [name, cx, cy] = centers[i % 3];
  x[i] = cx + (Math.random() - 0.5) * 50;
  y[i] = cy + (Math.random() - 0.5) * 40;
  groups.push(name);
}`,
    props: `x,
y,
groups,
xAxis: { label: 'km east' },
yAxis: { label: 'km north' },`,
    height: 340,
  },
  {
    id: 'polarScatter',
    type: 'polarScatter',
    title: 'Polar scatter',
    blurb: 'Wind readings by direction (angle) and speed (radius) at two stations.',
    dim: '2D',
    setup: `const station = (n, prevailing, spread) => {
  const theta = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    theta[i] = (prevailing + (Math.random() - 0.5) * spread + 360) % 360;
    r[i] = 2 + Math.random() ** 0.7 * 12;
  }
  return { theta, r };
};`,
    setupTs: `const station = (n: number, prevailing: number, spread: number) => {
  const theta = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    theta[i] = (prevailing + (Math.random() - 0.5) * spread + 360) % 360;
    r[i] = 2 + Math.random() ** 0.7 * 12;
  }
  return { theta, r };
};`,
    props: `series: [
  { name: 'Coast', ...station(250, 240, 110) },
  { name: 'Inland', ...station(250, 60, 160) },
],`,
    height: 340,
  },
  {
    id: 'confusionMatrix',
    type: 'confusionMatrix',
    title: 'Confusion matrix',
    blurb: 'Counts of actual vs predicted class; the diagonal is correct.',
    dim: '2D',
    setup: ``,
    props: `labels: ['Cat', 'Dog', 'Fox', 'Rabbit', 'Bird'],
matrix: [
  [88, 7, 3, 1, 1],
  [6, 91, 2, 0, 1],
  [9, 4, 74, 8, 5],
  [1, 0, 6, 86, 7],
  [0, 2, 3, 5, 90],
],`,
    height: 360,
  },
  {
    id: 'confusionMatrix-recall',
    type: 'confusionMatrix',
    title: 'Confusion matrix · normalized',
    blurb: "normalize: 'row' shows each class's recall; 'column' shows precision.",
    dim: '2D',
    setup: ``,
    props: `labels: ['Negative', 'Neutral', 'Positive'],
matrix: [
  [412, 61, 27],
  [88, 301, 111],
  [19, 54, 927],
],
normalize: 'row',`,
    height: 320,
  },
  {
    id: 'rocCurve',
    type: 'rocCurve',
    title: 'ROC curve',
    blurb: 'Three classifiers on 5,000 samples each; the legend shows AUC.',
    dim: '2D',
    setup: `// Simulated scores: positives score higher, by a margin set per model.
const sample = (n, margin) => {
  const actual = new Uint8Array(n);
  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    actual[i] = Math.random() < 0.4 ? 1 : 0;
    const z = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
    score[i] = 1 / (1 + Math.exp(-(z + (actual[i] ? margin : -margin))));
  }
  return { actual, score };
};`,
    setupTs: `// Simulated scores: positives score higher, by a margin set per model.
const sample = (n: number, margin: number) => {
  const actual = new Uint8Array(n);
  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    actual[i] = Math.random() < 0.4 ? 1 : 0;
    const z = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
    score[i] = 1 / (1 + Math.exp(-(z + (actual[i] ? margin : -margin))));
  }
  return { actual, score };
};`,
    props: `series: [
  { name: 'Gradient boosting', ...sample(5000, 1.4) },
  { name: 'Logistic regression', ...sample(5000, 0.9) },
  { name: 'Rules baseline', ...sample(5000, 0.4) },
],`,
    height: 340,
  },
  {
    id: 'rocCurve-pr',
    type: 'rocCurve',
    title: 'Precision–recall curve',
    blurb: "kind: 'pr'. Better than ROC when positives are rare; the legend shows average precision.",
    dim: '2D',
    setup: `const sample = (n, margin) => {
  const actual = new Uint8Array(n);
  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    actual[i] = Math.random() < 0.1 ? 1 : 0; // rare positives
    const z = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
    score[i] = 1 / (1 + Math.exp(-(z + (actual[i] ? margin : -margin))));
  }
  return { actual, score };
};`,
    setupTs: `const sample = (n: number, margin: number) => {
  const actual = new Uint8Array(n);
  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    actual[i] = Math.random() < 0.1 ? 1 : 0; // rare positives
    const z = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
    score[i] = 1 / (1 + Math.exp(-(z + (actual[i] ? margin : -margin))));
  }
  return { actual, score };
};`,
    props: `kind: 'pr',
series: [
  { name: 'Gradient boosting', ...sample(5000, 1.4) },
  { name: 'Logistic regression', ...sample(5000, 0.9) },
],`,
    height: 340,
  },
  {
    id: 'candlestick-indicators',
    type: 'candlestick',
    title: 'Candlestick + indicators',
    blurb: 'SMA, EMA and Bollinger bands. Zoom here and the MACD and RSI panels below follow (sync).',
    dim: '2D',
    setup: seededOhlc(false),
    setupTs: seededOhlc(true),
    props: `x,
open,
high,
low,
close,
xAxis: { type: 'time' },
sync: 'stock',
indicators: [
  { type: 'sma', period: 50 },
  { type: 'ema', period: 20 },
  { type: 'bollinger', period: 20, stdDev: 2 },
],`,
    height: 340,
  },
  {
    id: 'macd',
    type: 'macd',
    title: 'MACD',
    blurb: 'Same market as above (12, 26, 9). Shares its zoom through sync.',
    dim: '2D',
    setup: seededOhlc(false),
    setupTs: seededOhlc(true),
    props: `x,
close,
xAxis: { type: 'time' },
sync: 'stock',`,
    height: 200,
  },
  {
    id: 'rsi',
    type: 'rsi',
    title: 'RSI',
    blurb: '14-day Relative Strength Index with 70 / 30 bands; synced too.',
    dim: '2D',
    setup: seededOhlc(false),
    setupTs: seededOhlc(true),
    props: `x,
close,
xAxis: { type: 'time' },
sync: 'stock',`,
    height: 200,
  },
  {
    id: 'cartogram',
    type: 'cartogram',
    title: 'Cartogram (Dorling)',
    blurb: 'Countries as circles sized by population, nudged apart near their real position.',
    dim: '2D',
    needsWorld: true,
    setup: `${populations}
const values = {};
for (const [name, [millions]] of Object.entries(people)) values[name] = millions * 1e6;`,
    setupTs: `${populations}
const values: Record<string, number> = {};
for (const [name, [millions]] of Object.entries(people)) values[name] = millions * 1e6;`,
    props: `topology: world,
values,
label: 'Population',
exclude: ['Antarctica'],`,
    height: 380,
  },
  {
    id: 'dotDensity',
    type: 'dotDensity',
    title: 'Dot density map',
    blurb: 'One dot per 500K people, urban and rural, scattered inside each country.',
    dim: '2D',
    needsWorld: true,
    setup: `${populations}
const values = {};
for (const [name, [millions, urban]] of Object.entries(people)) {
  values[name] = { Urban: millions * 1e6 * (urban / 100), Rural: millions * 1e6 * (1 - urban / 100) };
}`,
    setupTs: `${populations}
const values: Record<string, Record<string, number>> = {};
for (const [name, [millions, urban]] of Object.entries(people)) {
  values[name] = { Urban: millions * 1e6 * (urban / 100), Rural: millions * 1e6 * (1 - urban / 100) };
}`,
    props: `topology: world,
values,
dotValue: 500_000,
exclude: ['Antarctica'],`,
    height: 380,
  },
  // ---- More types found across other libraries ---------------------------------------------------
  {
    id: 'baseline',
    type: 'baseline',
    title: 'Baseline',
    blurb: 'Above the opening price in one color, below in the other.',
    dim: '2D',
    setup: walk('y', 300, 100, 3),
    props: `y,
baseline: 100,
name: 'Price',
yAxis: { label: 'Price ($)' },`,
  },
  {
    id: 'difference',
    type: 'difference',
    title: 'Difference chart',
    blurb: 'The gap between two series, shaded by which one is higher.',
    dim: '2D',
    setup: `const day = (i) => (2 * Math.PI * i) / 365;
const rome = Array.from({ length: 365 }, (_, i) => 16 - 9 * Math.cos(day(i - 20)) + (Math.random() - 0.5) * 3);
const london = Array.from({ length: 365 }, (_, i) => 12 - 7 * Math.cos(day(i - 25)) + (Math.random() - 0.5) * 3 + (i > 150 && i < 230 ? 3 : 0));`,
    setupTs: `const day = (i: number) => (2 * Math.PI * i) / 365;
const rome = Array.from({ length: 365 }, (_, i) => 16 - 9 * Math.cos(day(i - 20)) + (Math.random() - 0.5) * 3);
const london = Array.from({ length: 365 }, (_, i) => 12 - 7 * Math.cos(day(i - 25)) + (Math.random() - 0.5) * 3 + (i > 150 && i < 230 ? 3 : 0));`,
    props: `a: { name: 'Rome', y: rome },
b: { name: 'London', y: london },
xAxis: { label: 'Day of year' },
yAxis: { label: 'Temperature (°C)' },`,
  },
  {
    id: 'divergingBar',
    type: 'divergingBar',
    title: 'Diverging stacked bar (Likert)',
    blurb: 'Survey answers stacked out from neutral: disagreement left, agreement right.',
    dim: '2D',
    setup: ``,
    props: `categories: ['The app is easy to use', 'Support answers quickly', 'Pricing is fair', 'I would recommend it', 'New features are useful'],
levels: [
  { name: 'Strongly disagree', values: [12, 30, 61, 18, 9] },
  { name: 'Disagree', values: [25, 48, 90, 30, 22] },
  { name: 'Neutral', values: [60, 72, 80, 55, 70] },
  { name: 'Agree', values: [160, 110, 52, 140, 150] },
  { name: 'Strongly agree', values: [143, 40, 17, 157, 149] },
],`,
    height: 320,
  },
  {
    id: 'variwide',
    type: 'variwide',
    title: 'Variwide bar',
    blurb: 'Height is hourly labor cost; width is GDP (illustrative values).',
    dim: '2D',
    setup: ``,
    props: `data: [
  { label: 'Norway', value: 50.2, width: 335 },
  { label: 'Denmark', value: 42.0, width: 214 },
  { label: 'Belgium', value: 39.2, width: 394 },
  { label: 'Sweden', value: 38.0, width: 437 },
  { label: 'France', value: 35.6, width: 2276 },
  { label: 'Germany', value: 34.5, width: 3108 },
  { label: 'Italy', value: 27.8, width: 1717 },
  { label: 'Spain', value: 21.3, width: 1123 },
  { label: 'Poland', value: 9.4, width: 450 },
],
valueName: 'Labor cost (€/h)',
widthName: 'GDP (€bn)',
xAxis: { label: 'GDP (€bn)' },
yAxis: { label: '€ per hour' },`,
  },
  {
    id: 'variablePie',
    type: 'variablePie',
    title: 'Variable-radius pie',
    blurb: 'Angle is land area; slice length is population density (approximate).',
    dim: '2D',
    setup: ``,
    props: `valueName: 'Area (km²)',
zName: 'People per km²',
data: [
  { label: 'Spain', value: 505992, z: 94 },
  { label: 'France', value: 551695, z: 118 },
  { label: 'Poland', value: 312679, z: 122 },
  { label: 'Czechia', value: 78865, z: 137 },
  { label: 'Italy', value: 301340, z: 195 },
  { label: 'Switzerland', value: 41284, z: 219 },
  { label: 'Germany', value: 357022, z: 235 },
],`,
    height: 340,
  },
  {
    id: 'parliament',
    type: 'parliament',
    title: 'Parliament (item) chart',
    blurb: 'One dot per seat, each party a wedge of the chamber.',
    dim: '2D',
    setup: ``,
    props: `data: [
  { label: 'Greens', value: 38 },
  { label: 'Social Democrats', value: 92 },
  { label: 'Liberals', value: 41 },
  { label: 'Christian Democrats', value: 104 },
  { label: 'Conservatives', value: 25 },
],`,
    height: 300,
  },
  {
    id: 'packedBubble',
    type: 'packedBubble',
    title: 'Packed bubble',
    blurb: 'Circle area is CO₂ emissions; countries cluster by continent (approximate Mt).',
    dim: '2D',
    setup: ``,
    props: `data: [
  { label: 'China', value: 11400, group: 'Asia' },
  { label: 'India', value: 2800, group: 'Asia' },
  { label: 'Japan', value: 1050, group: 'Asia' },
  { label: 'Indonesia', value: 690, group: 'Asia' },
  { label: 'Korea', value: 620, group: 'Asia' },
  { label: 'USA', value: 4900, group: 'Americas' },
  { label: 'Brazil', value: 480, group: 'Americas' },
  { label: 'Mexico', value: 440, group: 'Americas' },
  { label: 'Canada', value: 550, group: 'Americas' },
  { label: 'Germany', value: 670, group: 'Europe' },
  { label: 'UK', value: 330, group: 'Europe' },
  { label: 'France', value: 300, group: 'Europe' },
  { label: 'Italy', value: 320, group: 'Europe' },
  { label: 'Poland', value: 290, group: 'Europe' },
  { label: 'South Africa', value: 400, group: 'Africa' },
  { label: 'Egypt', value: 250, group: 'Africa' },
  { label: 'Nigeria', value: 130, group: 'Africa' },
],`,
    height: 360,
  },
  {
    id: 'quadrant',
    type: 'quadrant',
    title: 'Quadrant chart',
    blurb: 'Projects by effort and impact, split into four action groups.',
    dim: '2D',
    setup: ``,
    props: `points: [
  { label: 'SSO login', x: 2, y: 8.5 }, { label: 'Dark mode', x: 3, y: 5 }, { label: 'Offline sync', x: 8.5, y: 8 },
  { label: 'New onboarding', x: 4.5, y: 7.2 }, { label: 'Billing rewrite', x: 9, y: 6 }, { label: 'Icon refresh', x: 2.2, y: 2.5 },
  { label: 'Data export', x: 3.6, y: 6.4 }, { label: 'Plugin API', x: 7.5, y: 3.2 }, { label: 'Search v2', x: 6.2, y: 8.8 },
],
xSplit: 5,
ySplit: 5,
quadrants: ['Quick wins', 'Major projects', 'Fill-ins', 'Thankless tasks'],
xAxis: { label: 'Effort', min: 0, max: 10 },
yAxis: { label: 'Impact', min: 0, max: 10 },`,
    height: 360,
  },
  {
    id: 'stem',
    type: 'stem',
    title: 'Stem (stick) chart',
    blurb: 'Discrete samples as stems from zero: a decaying oscillation.',
    dim: '2D',
    setup: `const y = Array.from({ length: 64 }, (_, i) => Math.sin(i / 2.2) * Math.exp(-i / 28));`,
    props: `series: [{ name: 'Response', y }],
xAxis: { label: 'Sample' },`,
  },
  {
    id: 'jumpLine',
    type: 'jumpLine',
    title: 'Jump line',
    blurb: 'Flat ticks per category: plan vs actual without implying a trend.',
    dim: '2D',
    setup: ``,
    props: `categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
series: [
  { name: 'Target', data: [40, 42, 44, 46, 48, 50, 52, 54] },
  { name: 'Actual', data: [38, 45, 41, 49, 47, 55, 50, 58] },
],
yAxis: { label: 'Orders (k)' },`,
  },
  {
    id: 'dotHistogram',
    type: 'dotHistogram',
    title: 'Dot histogram (Wilkinson)',
    blurb: 'Every observation is a dot, stacked in its bin.',
    dim: '2D',
    setup: `const values = Float32Array.from({ length: 220 }, () => 170 + 9 * Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()));`,
    props: `values,
name: 'People',
binWidth: 2,
xAxis: { label: 'Height (cm)' },`,
  },
  {
    id: 'winLoss',
    type: 'winLoss',
    title: 'Win / loss',
    blurb: 'A season of results at a glance: up for wins, down for losses.',
    dim: '2D',
    setup: `const values = [1, 1, -1, 1, 0, 1, 1, -1, -1, 1, 1, 1, -1, 1, 0, 1, -1, 1, 1, 1, 1, -1, 1, 1, 0, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1];`,
    props: `values,`,
    height: 140,
  },
  {
    id: 'areaBump',
    type: 'areaBump',
    title: 'Area bump',
    blurb: 'Rank over time, with band thickness showing each value.',
    dim: '2D',
    setup: ``,
    props: `categories: ['2019', '2020', '2021', '2022', '2023', '2024'],
series: [
  { name: 'JavaScript', data: [68, 65, 65, 65, 63, 62] },
  { name: 'Python', data: [42, 44, 48, 48, 49, 51] },
  { name: 'TypeScript', data: [21, 25, 30, 34, 38, 38] },
  { name: 'Java', data: [41, 40, 35, 33, 30, 30] },
  { name: 'Go', data: [8, 9, 10, 11, 13, 14] },
],`,
    height: 340,
  },
  {
    id: 'smallMultiples',
    type: 'smallMultiples',
    title: 'Small multiples',
    blurb: 'One panel per region on a shared scale, instead of eight tangled lines.',
    dim: '2D',
    setup: `const months = 36;
const region = (name, level, growth) => ({
  name,
  y: Array.from({ length: months }, (_, i) => level + growth * i + 6 * Math.sin(i / 2) + Math.random() * 4),
});`,
    setupTs: `const months = 36;
const region = (name: string, level: number, growth: number) => ({
  name,
  y: Array.from({ length: months }, (_, i) => level + growth * i + 6 * Math.sin(i / 2) + Math.random() * 4),
});`,
    props: `series: [
  region('North', 40, 0.9), region('South', 55, 0.2), region('East', 30, 1.4), region('West', 60, -0.3),
  region('Central', 45, 0.6), region('Coast', 35, 1.1), region('Islands', 20, 0.4), region('Mountains', 25, 0.1),
],
mark: 'area',`,
    height: 360,
  },
  {
    id: 'navigator-line',
    type: 'line',
    title: 'Range navigator: main chart',
    blurb: 'Five years of daily values. Use the navigator below to pick the window.',
    dim: '2D',
    setup: seededWalk(false),
    setupTs: seededWalk(true),
    props: `series: [{ name: 'Index', x, y }],
xAxis: { type: 'time' },
sync: 'overview',`,
  },
  {
    id: 'navigator',
    type: 'navigator',
    title: 'Range navigator',
    blurb: 'Drag or resize the window; the chart above follows (same sync key).',
    dim: '2D',
    setup: seededWalk(false),
    setupTs: seededWalk(true),
    props: `x,
y,
xAxis: { type: 'time' },
sync: 'overview',`,
    height: 110,
  },
  {
    id: 'windBarb',
    type: 'windBarb',
    title: 'Wind barbs',
    blurb: 'Speed over two days with barbs for direction and strength (knots).',
    dim: '2D',
    setup: `const hours = 48;
const x = Array.from({ length: hours }, (_, i) => Date.UTC(2026, 2, 1) + i * 3_600_000);
const speed = Array.from({ length: hours }, (_, i) => Math.max(0, 14 + 12 * Math.sin(i / 7) + (Math.random() - 0.5) * 6));
const direction = Array.from({ length: hours }, (_, i) => (200 + i * 3 + (Math.random() - 0.5) * 20) % 360);`,
    props: `x,
speed,
direction,
xAxis: { type: 'time' },
yAxis: { label: 'Wind speed (kn)' },`,
  },
  {
    id: 'radialTree',
    type: 'radialTree',
    title: 'Radial tree',
    blurb: 'A hierarchy around a circle: root in the middle, leaves on the rim.',
    dim: '2D',
    setup: treeData(false),
    setupTs: treeData(true),
    props: `data,`,
    height: 420,
  },
  {
    id: 'edgeBundling',
    type: 'edgeBundling',
    title: 'Hierarchical edge bundling',
    blurb: 'Imports between modules, bundled along the package tree. Hover a module.',
    dim: '2D',
    setup: `let seed = 3;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pkgs = { core: 9, ui: 10, data: 8, net: 6, utils: 7 };
const data = {
  name: 'app',
  children: Object.entries(pkgs).map(([pkg, n]) => ({ name: pkg, children: Array.from({ length: n }, (_, i) => ({ name: pkg + '.' + (i + 1) })) })),
};
const names = data.children.flatMap((p) => p.children.map((c) => c.name));
const links = [];
for (const source of names) {
  const k = 1 + Math.floor(rand() * 3);
  for (let j = 0; j < k; j++) links.push({ source, target: names[Math.floor(rand() * names.length)] });
}`,
    setupTs: `let seed = 3;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pkgs = { core: 9, ui: 10, data: 8, net: 6, utils: 7 };
const data = {
  name: 'app',
  children: Object.entries(pkgs).map(([pkg, n]) => ({ name: pkg, children: Array.from({ length: n }, (_, i) => ({ name: pkg + '.' + (i + 1) })) })),
};
const names = data.children.flatMap((p) => p.children.map((c) => c.name));
const links: { source: string; target: string }[] = [];
for (const source of names) {
  const k = 1 + Math.floor(rand() * 3);
  for (let j = 0; j < k; j++) links.push({ source, target: names[Math.floor(rand() * names.length)] });
}`,
    props: `data,
links,
bundle: 0.85,`,
    height: 420,
  },
  {
    id: 'radialHeatmap',
    type: 'radialHeatmap',
    title: 'Radial heatmap',
    blurb: 'Site visits by hour (around) and weekday (rings).',
    dim: '2D',
    setup: `const hours = Array.from({ length: 24 }, (_, h) => String(h));
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const data = new Float32Array(days.length * 24);
days.forEach((_, d) => {
  for (let h = 0; h < 24; h++) {
    const work = d < 5 ? Math.exp(-((h - 11) ** 2) / 10) + 0.8 * Math.exp(-((h - 15) ** 2) / 8) : 0.5 * Math.exp(-((h - 14) ** 2) / 20);
    data[d * 24 + h] = Math.round(200 * work + 30 * Math.exp(-((h - 21) ** 2) / 6) + Math.random() * 15);
  }
});`,
    props: `angles: hours,
rings: days,
data,`,
    height: 380,
  },
  {
    id: 'liquidGauge',
    type: 'liquidGauge',
    title: 'Liquid fill gauge',
    blurb: 'A single level, shown as liquid in a circle (or tank).',
    dim: '2D',
    setup: ``,
    props: `value: 68,
label: 'Reservoir level',`,
    height: 240,
  },
  {
    id: 'tileMap',
    type: 'tileMap',
    title: 'Tile map',
    blurb: 'One equal hex per country, so small countries count as much as large ones (illustrative values).',
    dim: '2D',
    setup: ``,
    props: `shape: 'hex',
tiles: [
  { id: 'IS', label: 'Iceland', col: 1, row: 0, value: 86 }, { id: 'NO', label: 'Norway', col: 5, row: 0, value: 76 },
  { id: 'SE', label: 'Sweden', col: 6, row: 0, value: 66 }, { id: 'FI', label: 'Finland', col: 7, row: 0, value: 47 },
  { id: 'IE', label: 'Ireland', col: 2, row: 1, value: 13 }, { id: 'GB', label: 'United Kingdom', col: 3, row: 1, value: 14 },
  { id: 'DK', label: 'Denmark', col: 5, row: 1, value: 44 }, { id: 'EE', label: 'Estonia', col: 7, row: 1, value: 38 },
  { id: 'NL', label: 'Netherlands', col: 4, row: 2, value: 17 }, { id: 'DE', label: 'Germany', col: 5, row: 2, value: 22 },
  { id: 'PL', label: 'Poland', col: 6, row: 2, value: 17 }, { id: 'LT', label: 'Lithuania', col: 7, row: 2, value: 29 },
  { id: 'BE', label: 'Belgium', col: 3, row: 3, value: 14 }, { id: 'CZ', label: 'Czechia', col: 5, row: 3, value: 18 },
  { id: 'SK', label: 'Slovakia', col: 6, row: 3, value: 17 }, { id: 'UA', label: 'Ukraine', col: 7, row: 3, value: 9 },
  { id: 'FR', label: 'France', col: 3, row: 4, value: 22 }, { id: 'CH', label: 'Switzerland', col: 4, row: 4, value: 28 },
  { id: 'AT', label: 'Austria', col: 5, row: 4, value: 34 }, { id: 'HU', label: 'Hungary', col: 6, row: 4, value: 15 },
  { id: 'RO', label: 'Romania', col: 7, row: 4, value: 24 }, { id: 'PT', label: 'Portugal', col: 1, row: 5, value: 34 },
  { id: 'ES', label: 'Spain', col: 2, row: 5, value: 22 }, { id: 'IT', label: 'Italy', col: 4, row: 5, value: 19 },
  { id: 'HR', label: 'Croatia', col: 5, row: 5, value: 29 }, { id: 'RS', label: 'Serbia', col: 6, row: 5, value: 21 },
  { id: 'BG', label: 'Bulgaria', col: 7, row: 5, value: 19 }, { id: 'GR', label: 'Greece', col: 6, row: 6, value: 22 },
],`,
    height: 380,
  },
  {
    id: 'spikeMap',
    type: 'spikeMap',
    title: 'Spike map',
    blurb: 'Metro populations as spikes: height reads more precisely than bubble area.',
    dim: '2D',
    needsWorld: true,
    setup: cities,
    props: `topology: world,
exclude: ['Antarctica'],
points: cities,`,
    height: 360,
  },
  {
    id: 'densityMap',
    type: 'densityMap',
    title: 'Geo density map',
    blurb: '20,000 points around large cities, smoothed into a heat layer.',
    dim: '2D',
    needsWorld: true,
    setup: `${cities}
const lon = new Float32Array(20000);
const lat = new Float32Array(20000);
for (let i = 0; i < lon.length; i++) {
  const c = cities[i % cities.length];
  const r = 6 * Math.sqrt(-2 * Math.log(1 - Math.random()));
  const t = Math.random() * Math.PI * 2;
  lon[i] = c.lon + r * Math.cos(t);
  lat[i] = c.lat + r * 0.6 * Math.sin(t);
}`,
    props: `topology: world,
exclude: ['Antarctica'],
lon,
lat,
radius: 10,`,
    height: 360,
  },
  {
    id: 'map3d',
    type: 'map3d',
    title: '3D extruded map',
    blurb: 'Countries raised by population. Drag to orbit, click and scroll to zoom.',
    dim: '3D',
    needsWorld: true,
    setup: `${populations}
const values = {};
for (const [name, [millions]] of Object.entries(people)) values[name] = millions;`,
    setupTs: `${populations}
const values: Record<string, number> = {};
for (const [name, [millions]] of Object.entries(people)) values[name] = millions;`,
    props: `topology: world,
exclude: ['Antarctica'],
values,`,
    height: 380,
  },
  {
    id: 'lineBreak',
    type: 'lineBreak',
    title: 'Three line break',
    blurb: 'A new line only on a new high or low; reversals must break three lines.',
    dim: '2D',
    setup: closeSeries(400),
    props: `x,
close,
lines: 3,
xAxis: { type: 'time' },`,
  },
  {
    id: 'hollowCandle',
    type: 'hollowCandle',
    title: 'Hollow candlestick',
    blurb: 'Hollow when the close beats the open; color by change from the previous close.',
    dim: '2D',
    setup: ohlcSetup(false, 90),
    setupTs: ohlcSetup(true, 90),
    props: `x,
open,
high,
low,
close,
xAxis: { type: 'time' },`,
  },
  {
    id: 'hlc',
    type: 'hlc',
    title: 'HLC bars',
    blurb: 'High-low range with a tick at the close.',
    dim: '2D',
    setup: ohlcSetup(false, 90),
    setupTs: ohlcSetup(true, 90),
    props: `x,
high,
low,
close,
xAxis: { type: 'time' },`,
  },
  {
    id: 'candlestick-events',
    type: 'candlestick',
    title: 'Candlestick + event flags',
    blurb: 'events marks earnings, splits or news on the price; hover a flagged day.',
    dim: '2D',
    setup: ohlcSetup(false, 120),
    setupTs: ohlcSetup(true, 120),
    props: `x,
open,
high,
low,
close,
xAxis: { type: 'time' },
events: [
  { x: x[20], label: 'E', text: 'Q4 earnings' },
  { x: x[62], label: 'S', text: '2-for-1 split' },
  { x: x[95], label: 'N', text: 'New CEO' },
],`,
  },
  {
    id: 'histogram2d',
    type: 'histogram2d',
    title: '2D histogram',
    blurb: '50,000 correlated pairs counted in rectangular bins.',
    dim: '2D',
    setup: `const n = 50000;
const x = new Float32Array(n);
const y = new Float32Array(n);
for (let i = 0; i < n; i++) {
  const a = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  const b = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  x[i] = 50 + 12 * a;
  y[i] = 30 + 8 * (0.7 * a + 0.7 * b);
}`,
    props: `x,
y,
bins: [40, 30],
xAxis: { label: 'Study hours' },
yAxis: { label: 'Score' },`,
  },
  {
    id: 'streamline',
    type: 'streamline',
    title: 'Streamlines',
    blurb: 'Flow past a vortex: evenly spaced lines through the vector field, colored by speed.',
    dim: '2D',
    setup: `const cols = 50, rows = 34;
const u = new Float32Array(cols * rows);
const v = new Float32Array(cols * rows);
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = (c / (cols - 1)) * 10 - 5;
    const y = (r / (rows - 1)) * 6.8 - 3.4;
    const d = x * x + y * y + 0.6;
    u[r * cols + c] = 1 - (2.5 * y) / d;
    v[r * cols + c] = (2.5 * x) / d;
  }
}`,
    props: `cols,
rows,
u,
v,
x0: -5, x1: 5, y0: -3.4, y1: 3.4,
spacing: 20,`,
    height: 340,
  },
  {
    id: 'scatter-trendline',
    type: 'scatter',
    title: 'Scatter + trendline',
    blurb: 'trendline: true adds a least-squares fit per series; hover for the equation and R².',
    dim: '2D',
    setup: `const x = Float32Array.from({ length: 300 }, () => Math.random() * 100);
const y = x.map((v) => 20 + 0.6 * v + (Math.random() - 0.5) * 30);`,
    props: `series: [{ name: 'Stores', x, y }],
trendline: true,
xAxis: { label: 'Ad spend ($k)' },
yAxis: { label: 'Sales ($k)' },`,
  },
];
