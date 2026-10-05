#!/usr/bin/env node
/**
 * Plain-HTML pages for every example, built from the same examples as the React demo:
 *
 *   public/html/<id>.html    one chart, a complete page you can save and open (its own source is shown below the chart)
 *   public/html/<id>.js      the same chart as a module, for the gallery
 *   public/vanilla.html      every chart, by category, loaded as you scroll, each with its code
 *
 * Run after scripts/registry.mjs (the pages import public/registry/js/*.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'rolldown/experimental';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THREE = '0.186.1';
const PRISM = 'https://cdn.jsdelivr.net/npm/prismjs@1.30.0';

/** Load the demo's examples (TypeScript) by stripping types into a temp folder. */
async function loadExamples() {
  const tmp = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.html-pages-'));
  try {
    for (const name of ['examples', 'examples2']) {
      const src = fs.readFileSync(path.join(ROOT, `src/demo/${name}.ts`), 'utf8');
      const js = transformSync(`${name}.ts`, src, { lang: 'ts' }).code.replace(/from (['"])\.\/(examples2?)\1/g, "from './$2.mjs'");
      fs.writeFileSync(path.join(tmp, `${name}.mjs`), js);
    }
    const ex = await import(pathToFileURL(path.join(tmp, 'examples.mjs')).href);
    const ex2 = await import(pathToFileURL(path.join(tmp, 'examples2.mjs')).href);
    return { ...ex, GROUPS: ex2.GROUPS };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const indent = (s, n) => s.replace(/^(?=.)/gm, ' '.repeat(n));

const importMap = (extra = '') => `<script type="importmap">
      {
        "imports": {
          "three": "https://cdn.jsdelivr.net/npm/three@${THREE}/build/three.module.js",
          "three/examples/jsm/": "https://cdn.jsdelivr.net/npm/three@${THREE}/examples/jsm/"${extra}
        }
      }
    </script>`;

/** The page a user saves: chart files in ./charts, three.js from a CDN. */
function copyablePage(ex, code) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(ex.title)}</title>
    <!-- three.js from a CDN: no npm, no bundler. -->
    ${importMap()}
  </head>
  <body>
    <!-- The chart fills this box; give it a height. -->
    <div id="chart" style="height: ${ex.height ?? 360}px"></div>
    <script type="module">
${indent(code.trimEnd(), 6)}
    </script>
  </body>
</html>
`;
}

const STYLE = `
      :root { color-scheme: light; --page: #e6e8eb; --surface: #fcfcfb; --text: #111418; --text2: #47505c; --muted: #747d89;
        --border: rgba(17,20,24,.12); --code: #f3f4f5; --link: #1d4fae;
        --c: #626b79; --k: #a3367a; --s: #1a7533; --n: #a35200; --f: #1f5bb8; --t: #b42318; --a: #7340c9; --p: #555e6b; }
      @media (prefers-color-scheme: dark) { :root { color-scheme: dark; --page: #0c0d0f; --surface: #1a1a19; --text: #eef0f3; --text2: #b0b7c1;
        --muted: #7c8592; --border: rgba(255,255,255,.1); --code: #121315; --link: #8fb4f5;
        --c: #858e9b; --k: #f28fc9; --s: #8ddcab; --n: #ffb86b; --f: #8fb4f5; --t: #ff9b91; --a: #c9adff; --p: #a3abb6; } }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--page); color: var(--text); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
      a { color: var(--link); }
      main { max-width: 1280px; margin: 0 auto; padding: 24px 20px 64px; }
      h1 { font-size: 30px; letter-spacing: -.02em; margin: 8px 0 6px; }
      h2 { font-size: 22px; letter-spacing: -.01em; margin: 40px 0 12px; padding-top: 14px; border-top: 1px solid var(--border); }
      .lead { color: var(--text2); max-width: 70ch; margin: 0 0 8px; }
      .meta { color: var(--muted); font-size: 13px; }
      .plate { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 14px; min-width: 0; }
      .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      button, .btn { font: inherit; font-size: 13px; color: var(--text); background: var(--surface); border: 1px solid var(--border);
        border-radius: 6px; padding: 4px 10px; cursor: pointer; text-decoration: none; }
      button:hover, .btn:hover { border-color: var(--muted); }
      pre { margin: 10px 0 0; padding: 14px; background: var(--code); border: 1px solid var(--border); border-radius: 6px;
        overflow: auto; max-height: 520px; font: 12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .token.comment { color: var(--c); font-style: italic; } .token.keyword, .token.boolean { color: var(--k); }
      .token.string, .token.attr-value, .token.template-string { color: var(--s); } .token.number { color: var(--n); }
      .token.function { color: var(--f); } .token.tag { color: var(--t); } .token.attr-name { color: var(--a); }
      .token.punctuation, .token.operator { color: var(--p); }`;

const PRISM_TAGS = `<script src="${PRISM}/prism.min.js" data-manual></script>`;

/** A page for one example: the chart running, then the page a user saves. */
function examplePage(ex, code, group) {
  const copy = copyablePage(ex, code);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(ex.title)} · plain HTML · three-charts</title>
    <!-- Here the chart files come from this site's registry; in your copy they sit in ./charts. -->
    ${importMap(`,\n          "./charts/": "../registry/js/"`)}
    <style>${STYLE}
      .chart { height: ${ex.height ?? 360}px; }
    </style>
    ${PRISM_TAGS}
  </head>
  <body>
    <main>
      <p class="meta"><a href="../vanilla.html">All charts in plain HTML</a> · ${esc(group)} · <a href="../#/code/${ex.id}">React and TypeScript versions</a></p>
      <h1>${esc(ex.title)}</h1>
      <p class="lead">${esc(ex.blurb)}</p>
      <div class="plate"><div id="chart" class="chart"></div></div>

      <h2>The whole page</h2>
      <p class="lead">
        Save this as <code>index.html</code>. Put the chart's JavaScript files in a <code>charts</code> folder next to it: on the chart's page, pick the
        <b>JavaScript</b> tab and click <b>Download (.zip)</b>. Then serve the folder (for example <code>npx serve</code>); browsers block modules opened as a file.
      </p>
      <div class="row"><button id="copy">Copy page</button><a class="btn" href="../#/code/${ex.id}">Get the chart files</a></div>
      <pre><code id="source" class="language-markup">${esc(copy)}</code></pre>
    </main>
    <script type="module">
${indent(code.trimEnd(), 6)}
    </script>
    <script>
      const src = document.getElementById('source');
      const text = src.textContent;
      if (window.Prism) Prism.highlightElement(src);
      document.getElementById('copy').onclick = async (e) => {
        await navigator.clipboard.writeText(text);
        e.target.textContent = 'Copied ✓';
        setTimeout(() => (e.target.textContent = 'Copy page'), 1500);
      };
    </script>
  </body>
</html>
`;
}

/** The same chart as a module the gallery imports: render(el) builds the data and creates the chart. */
function exampleModule(ex, comp, file) {
  const world = ex.needsWorld ? `  const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((r) => r.json());\n` : '';
  return `import { create${comp} } from '../registry/js/${file}.js';

export default async function render(el) {
${world}${ex.setup ? indent(ex.setup, 2) + '\n' : ''}  return create${comp}(el, {
${indent(ex.props, 4)}
  });
}
`;
}

function galleryPage(examples, groups) {
  const list = examples.map((e) => ({ id: e.id, title: e.title, blurb: e.blurb, group: e.group, height: e.height ?? 320 }));
  const nav = groups.map((g) => `<a href="#${g.toLowerCase().replace(/[^a-z]+/g, '-')}">${esc(g)}</a>`).join(' · ');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Plain HTML · three-charts</title>
    <!-- three.js from a CDN: no npm, no bundler. -->
    ${importMap()}
    <style>${STYLE}
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr)); gap: 16px; }
      .card h3 { margin: 0 0 2px; font-size: 15px; }
      .card p { margin: 0 0 10px; color: var(--text2); font-size: 13px; }
      .card .row { margin-top: 10px; }
      .toc { line-height: 2; }
    </style>
    ${PRISM_TAGS}
  </head>
  <body>
    <main>
      <p class="meta"><a href="./">← React demo and docs</a></p>
      <h1>Every chart in plain HTML</h1>
      <p class="lead">
        No npm and no build step: each chart below is the JavaScript chart file, imported straight into the page, with three.js from a CDN.
        Charts load as you scroll. <b>Show code</b> shows a complete page you can save; <b>Open</b> shows that page on its own.
      </p>
      <p class="toc meta">${nav}</p>
      <div id="groups"></div>
    </main>
    <script type="module">
      const EXAMPLES = ${JSON.stringify(list)};
      const GROUPS = ${JSON.stringify(groups)};
      const root = document.getElementById('groups');
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            io.unobserve(e.target);
            import('./html/' + e.target.dataset.id + '.js')
              .then((m) => m.default(e.target))
              .catch((err) => (e.target.textContent = 'Could not load this chart: ' + err.message));
          }
        },
        { rootMargin: '400px' },
      );
      for (const g of GROUPS) {
        const items = EXAMPLES.filter((e) => e.group === g);
        if (!items.length) continue;
        const h = document.createElement('h2');
        h.id = g.toLowerCase().replace(/[^a-z]+/g, '-');
        h.textContent = g + ' (' + items.length + ')';
        const grid = document.createElement('div');
        grid.className = 'grid';
        for (const e of items) {
          const card = document.createElement('article');
          card.className = 'plate card';
          card.innerHTML = '<h3></h3><p></p><div class="chart"></div><div class="row"><button>Show code</button><a class="btn">Open</a></div>';
          card.querySelector('h3').textContent = e.title;
          card.querySelector('p').textContent = e.blurb;
          const box = card.querySelector('.chart');
          box.style.height = e.height + 'px';
          box.dataset.id = e.id;
          io.observe(box);
          card.querySelector('a').href = 'html/' + e.id + '.html';
          const btn = card.querySelector('button');
          let pre = null;
          btn.onclick = async () => {
            if (pre) {
              pre.hidden = !pre.hidden;
              btn.textContent = pre.hidden ? 'Show code' : 'Hide code';
              return;
            }
            const page = await fetch('html/' + e.id + '.html').then((r) => r.text());
            const code = new DOMParser().parseFromString(page, 'text/html').getElementById('source').textContent;
            pre = document.createElement('pre');
            const c = document.createElement('code');
            c.className = 'language-markup';
            c.textContent = code;
            pre.appendChild(c);
            card.appendChild(pre);
            if (window.Prism) Prism.highlightElement(c);
            btn.textContent = 'Hide code';
          };
          grid.appendChild(card);
        }
        root.append(h, grid);
      }
    </script>
  </body>
</html>
`;
}

const { EXAMPLES, GROUPS, COMPONENT, chartFile, jsSnippet } = await loadExamples();
const outDir = path.join(ROOT, 'public/html');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const ex of EXAMPLES) {
  const code = jsSnippet(ex);
  fs.writeFileSync(path.join(outDir, `${ex.id}.html`), examplePage(ex, code, ex.group));
  fs.writeFileSync(path.join(outDir, `${ex.id}.js`), exampleModule(ex, COMPONENT[ex.type], chartFile(ex.type)));
}
fs.writeFileSync(path.join(ROOT, 'public/vanilla.html'), galleryPage(EXAMPLES, GROUPS));
console.log(`html pages: ${EXAMPLES.length} examples -> public/html, public/vanilla.html`);
