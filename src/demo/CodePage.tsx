import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { COMPONENT, EXAMPLES, chartFile, jsSnippet, jsxSnippet, tsSnippet, tsxSnippet, type Example } from './examples';
import { LIVE_SNIPPETS } from './LiveChart';
import { CustomPanel, CustomPreview } from './Customizer';
import { PAGES } from './Sidebar';
import { DEFAULT_CUSTOM, customOptions, mergeProps, type Custom } from './customize';
import { highlight } from './highlight';
import { zip } from './zip';

/**
 * shadcn-style docs: every chart is one small file you copy into your project.
 * The code they share (engine, axes, layouts...) is a handful of files you add
 * once, by one download or one command. Everything is generated from src/core
 * by scripts/registry.mjs and served from /registry.
 */
export type Flavour = 'react-ts' | 'react-js' | 'ts' | 'js';

/** `single`: a one-file build exists (TypeScript flavours only). */
const FLAVOURS: Record<Flavour, { label: string; ext: string; packExt: string; dir: string; react: boolean; single: boolean }> = {
  'react-ts': { label: 'React · TS', ext: 'tsx', packExt: 'ts', dir: 'src/components/charts', react: true, single: true },
  'react-js': { label: 'React · JS', ext: 'jsx', packExt: 'js', dir: 'src/components/charts', react: true, single: false },
  ts: { label: 'TypeScript', ext: 'ts', packExt: 'ts', dir: 'src/charts', react: false, single: true },
  js: { label: 'JavaScript', ext: 'js', packExt: 'js', dir: 'src/charts', react: false, single: false },
};

interface Stat {
  lines: number;
  bytes: number;
}

interface Manifest {
  packs: Record<string, { file: string; about: string; ts: Stat; js: Stat }>;
  react: { file: string; tsx: Stat; jsx: Stat };
  charts: Record<string, { file: string; component: string; packs: string[]; ts: Stat; js: Stat; tsx: Stat; jsx: Stat; single: Record<'ts' | 'tsx', Stat> }>;
}

/** three ships without type definitions, so TypeScript projects also need @types/three. */
const npmInstall = (flavour: Flavour) => (FLAVOURS[flavour].packExt === 'ts' ? 'npm install three && npm install -D @types/three' : 'npm install three');

const BASE = import.meta.env.BASE_URL;
const origin = () => new URL(BASE, location.href).href;

export function useStored<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T) || fallback;
    } catch {
      return fallback;
    }
  });
  const set = (next: T) => {
    setV(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* storage unavailable */
    }
  };
  return [v, set];
}

const cache = new Map<string, Promise<string>>();
function fetchText(path: string) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(BASE + path).then((r) => {
        if (!r.ok) throw new Error(`${path}: ${r.status}`);
        return r.text();
      }),
    );
  }
  return cache.get(path)!;
}

function useFile(path: string) {
  const [state, setState] = useState<{ path: string; text: string | null; error?: string }>({ path, text: null });
  useEffect(() => {
    let live = true;
    fetchText(path).then(
      (text) => live && setState({ path, text }),
      (e) => live && setState({ path, text: null, error: String(e) }),
    );
    return () => {
      live = false;
    };
  }, [path]);
  return state.path === path ? state : { path, text: null };
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const PREVIEW_LINES = 24;

export function CodeBlock({ code, file, collapsible = false, downloadable = false }: { code: string; file?: string; collapsible?: boolean; downloadable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const lines = code.split('\n').length;
  const clipped = collapsible && !open && lines > PREVIEW_LINES;
  const shown = clipped ? code.split('\n').slice(0, PREVIEW_LINES).join('\n') : code;
  const html = useMemo(() => highlight(shown, file), [shown, file]);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="code">
      <div className="code-bar">
        <span>
          {file}
          {collapsible && <span className="meta"> · {lines.toLocaleString()} lines</span>}
        </span>
        <span className="row tight">
          {downloadable && file && (
            <button className="btn small" onClick={() => download(file, code)}>
              Download
            </button>
          )}
          <button className="btn small" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </span>
      </div>
      <pre className={clipped ? 'clipped' : undefined}>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      {collapsible && lines > PREVIEW_LINES && (
        <button className="expand" onClick={() => setOpen(!open)}>
          {open ? 'Collapse' : `Show all ${lines.toLocaleString()} lines`}
        </button>
      )}
    </div>
  );
}

function RemoteCode({ path, file, collapsible }: { path: string; file: string; collapsible?: boolean }) {
  const { text, error } = useFile(path);
  if (error) return <p className="meta">Couldn't load {file}. Run <code>npm run registry</code> and reload.</p>;
  if (text == null) return <div className="code loading">Loading {file}…</div>;
  return <CodeBlock code={text} file={file} collapsible={collapsible} downloadable />;
}

function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'tab on' : 'tab'} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function FlavourTabs({ flavour, setFlavour }: { flavour: Flavour; setFlavour: (f: Flavour) => void }) {
  return <Tabs label="Language" value={flavour} onChange={setFlavour} options={(Object.keys(FLAVOURS) as Flavour[]).map((f) => [f, FLAVOURS[f].label])} />;
}

function Step({ n, title, children }: { n: number; title: ReactNode; children?: ReactNode }) {
  return (
    <li className="step">
      <span className="step-n">{n}</span>
      <div>
        <h4>{title}</h4>
        {children}
      </div>
    </li>
  );
}

function useManifest(): Manifest | null {
  const { text } = useFile('registry/index.json');
  return text ? (JSON.parse(text) as Manifest) : null;
}

/** The shared files a chart needs in a flavour (all of them when `chart` is omitted). */
function sharedFiles(m: Manifest, flavour: Flavour, chart?: string) {
  const f = FLAVOURS[flavour];
  const packs = chart ? m.charts[chart].packs : Object.keys(m.packs);
  const files = packs.map((p) => ({ name: `${m.packs[p].file}.${f.packExt}`, lines: m.packs[p][f.packExt as 'ts' | 'js'].lines, about: m.packs[p].about }));
  if (f.react) files.push({ name: `chart-react.${f.ext}`, lines: m.react[f.ext as 'tsx' | 'jsx'].lines, about: 'Turns a chart class into a React component.' });
  return files;
}

const lines = (n: number) => `${n.toLocaleString()} lines`;

/** Download several registry files as one .zip. */
async function downloadZip(zipName: string, flavour: Flavour, names: string[]) {
  const entries = await Promise.all(names.map(async (n) => [n, await fetchText(`registry/${flavour}/${n}`)] as const));
  const url = URL.createObjectURL(zip(Object.fromEntries(entries)));
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? 'Copied ✓' : label}
    </button>
  );
}

/** One command that installs a chart and its shared files. */
function installCommand(m: Manifest, flavour: Flavour, file?: string) {
  const f = FLAVOURS[flavour];
  if (f.react && file) return `npx shadcn@latest add ${origin()}r/${file}.json`;
  const names = [...sharedFiles(m, flavour, file && Object.keys(m.charts).find((t) => m.charts[t].file === file)).map((x) => x.name), ...(file ? [`${file}.${f.ext}`] : [])];
  const urls = names.map((n) => `-O ${origin()}registry/${flavour}/${n}`).join(' ');
  return `${npmInstall(flavour)} && mkdir -p ${f.dir} && cd ${f.dir} && curl ${urls}`;
}

/** The shared files for a chart: a one-line summary, one download, one command. Code stays hidden unless asked for. */
function SharedFiles({ m, flavour, type }: { m: Manifest; flavour: Flavour; type?: string }) {
  const [show, setShow] = useState<string | null>(null);
  const f = FLAVOURS[flavour];
  const files = sharedFiles(m, flavour, type);
  const total = files.reduce((n, x) => n + x.lines, 0);
  const chart = type ? m.charts[type] : null;
  const zipName = chart ? `${chart.file}-${flavour}.zip` : `three-charts-shared-${flavour}.zip`;
  const names = [...files.map((x) => x.name), ...(chart ? [`${chart.file}.${f.ext}`] : [])];
  return (
    <div className="shared">
      <div className="row">
        <button className="btn primary" onClick={() => downloadZip(zipName, flavour, names)}>
          Download {chart ? `${chart.file}.${f.ext} + shared files` : 'all shared files'} (.zip)
        </button>
        <CopyText text={installCommand(m, flavour, chart?.file)} label="Copy install command" />
      </div>
      <p className="meta">
        {f.react && chart ? 'The command uses the shadcn CLI. ' : ''}
        Shared files are the same for every chart: add them once per project and skip this step for your next chart.{' '}
        {files.length} files, {lines(total)}. Run <code>{npmInstall(flavour)}</code> too.
      </p>
      <ul className="file-list">
        {files.map((x) => (
          <li key={x.name}>
            <button className="linkish" aria-expanded={show === x.name} onClick={() => setShow(show === x.name ? null : x.name)}>
              <code>{x.name}</code>
            </button>
            <span className="meta">
              {lines(x.lines)} · {x.about}
            </span>
          </li>
        ))}
      </ul>
      {show && <RemoteCode path={`registry/${flavour}/${show}`} file={show} collapsible />}
    </div>
  );
}

/** One self-contained file instead of chart file + shared files. */
function SingleFile({ m, flavour, type }: { m: Manifest; flavour: Flavour; type: string }) {
  const [open, setOpen] = useState(false);
  const f = FLAVOURS[flavour];
  const c = m.charts[type];
  const name = `${c.file}.${f.ext}`;
  const path = `registry/${flavour}/single/${name}`;
  return (
    <div className="shared">
      <div className="row">
        <button className="btn" onClick={async () => download(name, await fetchText(path))}>
          Download {name} ({lines(c.single[f.ext as 'ts' | 'tsx'].lines)})
        </button>
        <button className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide code' : 'View code'}
        </button>
      </div>
      <p className="meta">
        Only the code this chart uses, in one file. Good for a single chart; with several, the shared files avoid duplicate code. Still needs{' '}
        <code>{npmInstall(flavour)}</code>.
      </p>
      {open && <RemoteCode path={path} file={name} collapsible />}
    </div>
  );
}

function snippetFor(ex: Example, flavour: Flavour) {
  return { 'react-ts': tsxSnippet, 'react-js': jsxSnippet, ts: tsSnippet, js: jsSnippet }[flavour](ex);
}

function ChartDoc({
  ex,
  flavour,
  setFlavour,
  custom,
  setCustom,
}: {
  ex: Example;
  flavour: Flavour;
  setFlavour: (f: Flavour) => void;
  custom: Custom;
  setCustom: (c: Custom) => void;
}) {
  const m = useManifest();
  const [stored, setMode] = useStored<'files' | 'single'>('tc-mode', 'files');
  const f = FLAVOURS[flavour];
  const mode = f.single ? stored : 'files';
  const file = chartFile(ex.type);
  const comp = COMPONENT[ex.type];
  const c = m?.charts[ex.type];
  // How many palette colors this example uses, so the panel offers only swatches that change something.
  const [slots, setSlots] = useState(8);
  const extra = customOptions(custom, ex.type, slots).code;
  const usage = snippetFor(extra.length ? { ...ex, props: mergeProps(ex.props, extra) } : ex, flavour);
  return (
    <div className="chart-page">
      <PageHead id={ex.id} title={ex.title} blurb={ex.blurb} group={ex.group ?? ''} badges={[ex.type, ex.dim, ...(ex.scale ? [ex.scale] : [])]} />
      <div className="chart-cols">
      <div className="chart-preview">
        <CustomPreview ex={ex} custom={custom} onSlots={setSlots} />
      </div>
      <section className="chart-main">

      <FlavourTabs flavour={flavour} setFlavour={setFlavour} />

      <h3>Usage</h3>
      {extra.length > 0 && (
        <p className="meta">
          Includes your changes: {extra.map(([k]) => <code key={k}>{k}</code>).reduce<ReactNode[]>((a, el, i) => (i ? [...a, ', ', el] : [el]), [])}.
        </p>
      )}
      {ex.needsWorld && (
        <p className="meta">
          Uses country shapes from <code>world-atlas</code> (Natural Earth data). In React, JSON imports need <code>resolveJsonModule</code> in tsconfig.
        </p>
      )}
      <CodeBlock code={usage} file={`${f.react ? comp.replace(/Chart$/, '') + 'Example' : 'main'}.${f.ext}`} />

      <h3>The chart</h3>
      {f.single ? (
        <Tabs
          label="Install as"
          value={mode}
          onChange={setMode}
          options={[
            ['files', c ? `Chart file · ${lines(c[f.ext as 'ts'].lines)}` : 'Chart file'],
            ['single', c ? `One file · ${lines(c.single[f.ext as 'ts'].lines)}` : 'One file'],
          ]}
        />
      ) : (
        <p className="meta">A one-file version is available in the {f.react ? 'React · TS' : 'TypeScript'} tab.</p>
      )}
      {mode === 'files' ? (
        <>
          <RemoteCode path={`registry/${flavour}/${file}.${f.ext}`} file={`${f.dir}/${file}.${f.ext}`} />
          <h3>Shared files</h3>
          {m && <SharedFiles m={m} flavour={flavour} type={ex.type} />}
        </>
      ) : (
        m && <SingleFile m={m} flavour={flavour} type={ex.type} />
      )}

      <h3>API</h3>
      <ul className="notes">
        {f.react ? (
          <>
            <li>
              Props are the chart's options plus <code>height</code>, <code>className</code> and <code>style</code>.
              {flavour === 'react-ts' && (
                <>
                  {' '}
                  Types: <code>{comp}Props</code>, <code>{comp}Handle</code>.
                </>
              )}
            </li>
            <li>
              Pass a ref for imperative control: <code>ref.current.update(options)</code>, <code>resetView()</code>, <code>download('png' | 'csv')</code>,{' '}
              <code>toPNG()</code>, <code>toCSV()</code>, <code>chart()</code>.
            </li>
          </>
        ) : (
          <li>
            <code>create{comp}(element, options)</code> returns the chart: <code>update(options)</code>, <code>resetView()</code>, <code>download('png' | 'csv')</code>,{' '}
            <code>toPNG()</code>, <code>toCSV()</code>, <code>destroy()</code>.
          </li>
        )}
        <li>
          Charts follow the page theme (<code>&lt;html data-theme&gt;</code>, then the OS setting). Override with <code>theme: 'light' | 'dark'</code>.
        </li>
        <li>
          Colors: <code>colors</code> (series), <code>colorScale</code>, <code>divergingColors</code>, <code>positiveColor</code>/<code>negativeColor</code>; fonts and
          text colors: <code>appearance</code>; legend: <code>legend: {'{'} position, align, marker, toggle, hidden, format, onToggle {'}'}</code>. See{' '}
          <a href="#/docs">Docs → Customize</a>.
        </li>
        <li>
          From code: <code>{f.react ? 'ref.current.chart()' : 'chart'}.toggleSeries(name)</code> hides or shows a series; <code>hiddenSeries()</code> lists hidden ones.
        </li>
      </ul>
      </section>
      <aside className="chart-aside" aria-label="Customize">
        <CustomPanel ex={ex} custom={custom} setCustom={setCustom} slots={slots} />
      </aside>
      </div>
      <PrevNext id={ex.id} />
    </div>
  );
}

/** Breadcrumb, title and spec badges for a chart page. */
function PageHead({ id, title, blurb, group, badges }: { id: string; title: string; blurb: string; group: string; badges: string[] }) {
  const i = PAGES.findIndex((p) => p.id === id);
  const prev = PAGES[i - 1];
  const next = PAGES[i + 1];
  return (
    <header className="page-head">
      <div className="crumbs">
        <a href="#/">Charts</a>
        <span aria-hidden="true">/</span>
        <span>{group}</span>
        <span className="crumb-nav">
          {prev && (
            <a href={`#/code/${prev.id}`} title={prev.title} aria-label={`Previous: ${prev.title}`}>
              ←
            </a>
          )}
          {next && (
            <a href={`#/code/${next.id}`} title={next.title} aria-label={`Next: ${next.title}`}>
              →
            </a>
          )}
        </span>
      </div>
      <h1>{title}</h1>
      <p className="blurb">{blurb}</p>
      <div className="spec-row">
        {badges.map((b) => (
          <span key={b} className="badge">
            {b}
          </span>
        ))}
      </div>
    </header>
  );
}

/** Previous / next chart, in sidebar order. */
function PrevNext({ id }: { id: string }) {
  const i = PAGES.findIndex((p) => p.id === id);
  const prev = PAGES[i - 1];
  const next = PAGES[i + 1];
  return (
    <nav className="prev-next" aria-label="More charts">
      {prev ? (
        <a href={`#/code/${prev.id}`}>
          <span>Previous</span>
          {prev.title}
        </a>
      ) : (
        <span />
      )}
      {next && (
        <a href={`#/code/${next.id}`} className="next">
          <span>Next</span>
          {next.title}
        </a>
      )}
    </nav>
  );
}

const HTML_PAGE = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- three.js from a CDN; no npm, no bundler -->
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js",
        "three/examples/jsm/": "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <div id="chart" style="height: 360px"></div>
  <script type="module">
    // bar-chart.js and its shared files sit in ./charts (JavaScript tab)
    import { createBarChart } from './charts/bar-chart.js';

    createBarChart(document.getElementById('chart'), {
      categories: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [{ name: 'Revenue', data: [42, 51, 48, 63] }],
    });
  </script>
</body>
</html>
`;

function Setup({ flavour, setFlavour }: { flavour: Flavour; setFlavour: (f: Flavour) => void }) {
  const m = useManifest();
  const f = FLAVOURS[flavour];
  const usage = m ? Object.fromEntries(Object.keys(m.packs).map((p) => [p, Object.values(m.charts).filter((c) => c.packs.includes(p)).length])) : {};
  const median = m ? Object.values(m.charts).map((c) => c[f.ext as 'ts'].lines).sort((a, b) => a - b)[Object.keys(m.charts).length >> 1] : 0;
  return (
    <section id="setup" className="prose">
      <h1>Install the shared files</h1>
      <p className="blurb">
        Not a library: like shadcn/ui, you copy code into your project and own it. Each chart is one small file (median {median} lines). The code charts share
        (engine, axes, layouts) lives in a few shared files you add once. The only dependency is <code>three</code>.
      </p>
      <FlavourTabs flavour={flavour} setFlavour={setFlavour} />
      <ol className="steps">
        <Step n={1} title="Install three.js">
          <CodeBlock code={npmInstall(flavour)} file="terminal" />
        </Step>
        <Step n={2} title={<>Add the shared files to <code>{f.dir}/</code>, once</>}>{m && <SharedFiles m={m} flavour={flavour} />}</Step>
        <Step n={3} title="Pick a chart in the sidebar and copy its file next to them">
          <p className="meta">
            Each chart page also has a single install command for that chart, and (TypeScript and React · TS) a one-file version.
            {f.react && (
              <>
                {' '}
                With the shadcn CLI: <code>npx shadcn@latest add {origin()}r/bar-chart.json</code>
              </>
            )}
          </p>
        </Step>
      </ol>
      {m && (
        <>
          <h3>What the shared files are</h3>
          <div className="table-wrap">
            <table className="pack-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Lines</th>
                  <th>Used by</th>
                  <th>What it does</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(m.packs).map(([p, x]) => (
                  <tr key={p}>
                    <td>
                      <code>
                        {x.file}.{f.packExt}
                      </code>
                    </td>
                    <td>{x[f.packExt as 'ts'].lines.toLocaleString()}</td>
                    <td>{usage[p]} charts</td>
                    <td>{x.about}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="meta">Bundlers drop whatever your charts don't use, so unused shared code costs nothing in production.</p>
        </>
      )}
      <h3>Plain HTML, no build step</h3>
      <p className="meta">
        Use the JavaScript files with an import map. <a href={`${BASE}vanilla.html`}>A working example</a>.
      </p>
      <CodeBlock code={HTML_PAGE} file="index.html" />
      <h3>Performance notes</h3>
      <ul className="notes">
        <li>All charts on a page share one WebGL context, even when copied as single files, so dozens of charts work where a canvas-per-chart approach hits the browser's limit of about 16.</li>
        <li>Charts render only when something changes and only while on screen.</li>
        <li>Pass typed arrays (<code>Float32Array</code>, <code>Float64Array</code> for epoch-ms time) for big data; they are read without copying.</li>
        <li>In React, memoize data with <code>useMemo</code>; options are compared by reference and a changed array re-uploads.</li>
        <li>For streaming, call <code>ref.current.update()</code> instead of setting state on every tick.</li>
        <li>Next.js: the React files start with <code>'use client'</code> and are safe to import on the server.</li>
      </ul>
    </section>
  );
}

function LiveDoc({ flavour, setFlavour, code }: { flavour: Flavour; setFlavour: (f: Flavour) => void; code: string }) {
  const m = useManifest();
  const f = FLAVOURS[flavour];
  return (
    <section className="prose">
      <h1>Live streaming line</h1>
      <p className="blurb">Push new samples through the chart handle; React never re-renders.</p>
      <FlavourTabs flavour={flavour} setFlavour={setFlavour} />
      <h3>Usage</h3>
      <CodeBlock code={code} file={`${f.react ? 'LiveCpu' : 'main'}.${f.ext}`} />
      <h3>The chart</h3>
      <p className="meta">
        Uses the line chart: <a href="#/code/line">line-chart.{f.ext}</a> and its shared files.
      </p>
      {m && <SharedFiles m={m} flavour={flavour} type="line" />}
    </section>
  );
}

// Kept for the whole visit, so one set of brand colors applies to every chart you open.
let savedCustom: Custom = DEFAULT_CUSTOM;

export function CodePage({ id }: { id?: string }) {
  const current = id ?? 'setup';
  const [flavour, setFlavour] = useStored<Flavour>('tc-flavour', 'react-ts');
  const [custom, setCustomState] = useState<Custom>(savedCustom);
  const setCustom = (c: Custom) => {
    savedCustom = c;
    setCustomState(c);
  };
  const ex = EXAMPLES.find((e) => e.id === current);
  const live = { 'react-ts': LIVE_SNIPPETS.tsx, 'react-js': LIVE_SNIPPETS.jsx, ts: LIVE_SNIPPETS.ts, js: LIVE_SNIPPETS.js }[flavour];

  return (
    <div className="code-page">
      <div className="code-main">
        {current === 'setup' && <Setup flavour={flavour} setFlavour={setFlavour} />}
        {current === 'live' && <LiveDoc flavour={flavour} setFlavour={setFlavour} code={live} />}
        {ex && <ChartDoc key={ex.id} ex={ex} flavour={flavour} setFlavour={setFlavour} custom={custom} setCustom={setCustom} />}
      </div>
    </div>
  );
}
