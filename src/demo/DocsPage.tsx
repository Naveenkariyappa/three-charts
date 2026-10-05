import { CodeBlock, FlavourTabs, useStored, type Flavour } from './CodePage';
import { COMPONENT } from './examples';
import { DOC_EXAMPLES } from './docsExamples';

/** The user guide: how to take a chart from this site into your own project. Mirrors the README. */
export function DocsPage() {
  const site = new URL(import.meta.env.BASE_URL, location.href).href.replace(/\/$/, '');
  const [flavour, setFlavour] = useStored<Flavour>('tc-flavour', 'react-ts');
  const example = DOC_EXAMPLES[flavour];
  return (
    <article className="docs">
      <h1>Using the charts in your project</h1>
      <p className="blurb">
        You don't install a charting library. Like <a href="https://ui.shadcn.com">shadcn/ui</a>, you copy a chart's code into your project and own it. It works with
        React (TypeScript or JavaScript) and with plain TypeScript/JavaScript, with or without a build step. The only dependency is <code>three</code>.
      </p>

      <h2>1. Find your chart</h2>
      <p>
        Pick a chart in the sidebar (press <kbd>/</kbd> to search, or browse the <a href="#/">overview</a>). Each chart has its own page with the live chart, a
        Customize panel and the code. Pick your language above the code:{' '}
        <b>React · TS</b>, <b>React · JS</b>, <b>TypeScript</b> or <b>JavaScript</b>.
      </p>

      <h2>2. Add it</h2>
      <p>
        Every chart is one small file. Charts also share a few files (the engine, axes, tooltips). You add those once per project and every later chart reuses them.
        Choose one way:
      </p>
      <div className="table-wrap">
        <table className="pack-table">
          <thead>
            <tr>
              <th>You have</th>
              <th>Do this</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>A React project set up with shadcn</td>
              <td>
                Run the command on the chart's page, e.g. <code>npx shadcn@latest add {site}/r/bar-chart.json</code>
              </td>
            </tr>
            <tr>
              <td>Any React or bundler project (Vite, Next.js, webpack…)</td>
              <td>
                <code>npm install three</code> (with TypeScript, also <code>npm install -D @types/three</code>), then click <b>Download (.zip)</b> on the
                chart's page and unzip into <code>src/components/charts/</code> (React) or <code>src/charts/</code>
              </td>
            </tr>
            <tr>
              <td>Just one chart, simplest possible</td>
              <td>
                <b>TypeScript</b> or <b>React · TS</b> tab → <b>One file</b>: a single self-contained file. Still needs <code>three</code> and{' '}
                <code>@types/three</code>
              </td>
            </tr>
            <tr>
              <td>Plain HTML, no npm</td>
              <td>
                <b>JavaScript</b> tab → download the zip, then use the HTML template in <a href="#/code/setup">Install the shared files</a> (loads three.js
                from a CDN). Serve the folder over http (e.g. <code>npx serve</code>); browsers block modules opened as a file.{' '}
                <a href="vanilla.html">Working example</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="meta">
        Each chart page also has <b>Copy install command</b>, which fetches the files with one terminal command.
      </p>
      <p className="callout">
        <b>About <code>@/components/charts</code>.</b> The React examples import from <code>@/components/…</code>, the path alias shadcn projects already have.
        Without it, use a relative path such as <code>./components/charts/bar-chart</code>, or add the alias (Vite):{' '}
        <code>resolve: {'{'} alias: {'{'} '@': '/src' {'}'} {'}'}</code> in <code>vite.config.ts</code> and{' '}
        <code>"paths": {'{'} "@/*": ["./src/*"] {'}'}</code> in <code>tsconfig</code>.
      </p>

      <h2>3. Use it</h2>
      <FlavourTabs flavour={flavour} setFlavour={setFlavour} />
      <CodeBlock file={example.file} code={example.code} />
      {flavour === 'react-ts' && (
        <p className="meta">
          Every chart exports <code>&lt;Name&gt;Props</code> (its options plus <code>height</code>, <code>className</code>, <code>style</code>) and{' '}
          <code>&lt;Name&gt;Handle</code> (the ref: <code>update</code>, <code>resetView</code>, <code>download</code>, <code>toPNG</code>, <code>toCSV</code>,{' '}
          <code>chart</code>).
        </p>
      )}
      {flavour === 'ts' && (
        <p className="meta">
          Every chart file exports its options type (e.g. <code>BarOptions</code>), its class, and a <code>create&lt;Name&gt;()</code> function.
        </p>
      )}
      <p className="meta">Every chart page has a complete example with realistic data for that chart.</p>

      <h2>4. Customize it</h2>
      <p>
        Every chart takes the same color, text and legend options. The quickest way to get them right is the <b>Customize</b> panel on each chart's page in{' '}
        the site: change colors, the legend and fonts on a live chart, and the usage code updates to match.
      </p>
      <CodeBlock file="options" code={CUSTOMIZE_CODE} />
      <div className="table-wrap">
        <table className="pack-table">
          <thead>
            <tr>
              <th>Option</th>
              <th>What it changes</th>
            </tr>
          </thead>
          <tbody>
            {CUSTOMIZE_ROWS.map(([k, v]) => (
              <tr key={k}>
                <td>
                  <code>{k}</code>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="meta">
        A series' own <code>color</code> (or a slice's, a node's…) wins over <code>colors</code>. Text and legend always use the text colors, never the series color,
        so they stay readable.
      </p>

      <h2>5. Let people download it</h2>
      <p>
        Every chart has a download button in its top-right corner (it appears on hover, and stays visible on touch screens). It saves the chart as a{' '}
        <b>PNG</b> exactly as shown, with labels, legend and title, or its data as a <b>CSV</b> file that opens in Excel or Google Sheets.
      </p>
      <CodeBlock file="options" code={DOWNLOAD_CODE} />

      <h2>Good to know</h2>
      <ul className="notes">
        <li>
          <b>Give the container a height.</b> The chart fills its box (<code>height</code> prop in React, CSS height otherwise).
        </li>
        <li>
          <b>Big data:</b> pass typed arrays (<code>Float32Array</code>; <code>Float64Array</code> for timestamps). Lines and scatter plots handle a million points.
        </li>
        <li>
          <b>React:</b> build data with <code>useMemo</code>. Options are compared by reference, so a new array on every render re-uploads the data.
        </li>
        <li>
          <b>Live data:</b> call <code>ref.current.update(&#123;…&#125;)</code> (React) or <code>chart.update(&#123;…&#125;)</code> instead of re-rendering on every
          tick. See <a href="#/code/live">Live streaming line</a>.
        </li>
        <li>
          <b>Many charts on one page</b> are fine: they share one WebGL context.
        </li>
        <li>
          <b>Next.js:</b> the React files start with <code>'use client'</code> and are safe to import on the server.
        </li>
        <li>
          <b>Dark mode</b> follows <code>&lt;html data-theme="dark"&gt;</code>, then the OS setting. Force it with <code>theme: 'light' | 'dark'</code>.
        </li>
        <li>
          <b>Linked panels:</b> give charts the same <code>sync: 'name'</code> and they zoom and pan together (e.g. price + MACD + RSI).
        </li>
        <li>
          <b>Interaction:</b> hover for tooltips, click a legend item to hide its series (double-click to show only that one), drag to pan (2D) or orbit (3D), click a
          chart (or hold Ctrl/⌘) and scroll to zoom, double-click to reset. React to it with <code>onHover</code>, <code>onClick</code> and{' '}
          <code>legend.onToggle</code>; drive it with <code>toggleSeries(name)</code>.
        </li>
        <li>
          <b>It's your code.</b> Change colors, labels or behavior in the files you copied; nothing will overwrite them.
        </li>
      </ul>

      <h2>What's available</h2>
      <p>
        {Object.keys(COMPONENT).length} chart types across comparison, trend, distribution, part-to-whole, hierarchy, relationship, network, flow, KPI, machine
        learning, financial, geo and 3D. See them all in the <a href="#/">overview</a>, and how they compare with 25 other charting libraries in{' '}
        <a href="https://github.com/Naveenkariyappa/three-charts/blob/main/CHARTS.md">CHARTS.md</a>.
      </p>
    </article>
  );
}

const CUSTOMIZE_CODE = `{
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
}`;

const CUSTOMIZE_ROWS: [string, string][] = [
  ['colors', 'Series colors in order. The default is eight hues checked for color blindness.'],
  ['colorScale', 'Low → high scale for heatmaps, maps, contours, densities and 3D surfaces.'],
  ['divergingColors', 'Negative → neutral → positive scale (diverging heatmaps, correlation, Likert).'],
  ['positiveColor / negativeColor', 'Up and down: candles, waterfall, baseline, win/loss, depth.'],
  ['appearance', 'fontFamily, fontSize, titleSize, textColor, secondaryTextColor, mutedTextColor, gridColor, axisColor, tooltipBackground, borderColor.'],
  ['legend', 'false hides it, true always shows it, or an object: show, position, align, marker, toggle, hidden, format, onToggle.'],
  ['theme / background', "Force 'light' or 'dark'; paint a background color (default transparent)."],
  ['tooltip / animate / grid', 'Turn the tooltip, the entry animation or (charts with axes) the grid off.'],
  ['download', 'false hides the download button, or { formats, filename }.'],
];

const DOWNLOAD_CODE = `// Hide the button, or limit and name the downloads:
download: false,
download: { formats: ['png'], filename: 'q3-revenue' },

// From your own button or menu:
chart.download('png');            // React: ref.current.download('png')
chart.download('csv', 'revenue');
const dataUrl = chart.toPNG();    // e.g. to attach to an email or a report
const csv = chart.toCSV();        // null when the data isn't a table (a 3D mesh)`;
