/**
 * Builds the copy-paste distribution (shadcn style) from src/core.
 *
 * Output (public/registry):
 *   ts/chart-core.ts, ts/<name>.ts           vanilla TypeScript
 *   js/chart-core.js, js/<name>.js           vanilla JavaScript (browser ESM)
 *   react-ts/<name>.tsx                      React + TypeScript (uses ts/chart-core.ts)
 *   react-js/<name>.jsx                      React + JavaScript (uses js/chart-core.js)
 *   index.json                               manifest for the docs site
 * and public/r/<name>.json, shadcn registry items for `npx shadcn add <url>`.
 *
 * chart-core holds everything two or more charts share (engine, axes, marks,
 * layouts, theme). Each chart file holds its own class, options type and any
 * helpers only it uses, so a chart is one file plus the core.
 *
 * Usage: node scripts/registry.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync, transformSync } from 'rolldown/experimental';
import os from 'node:os';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE = path.join(ROOT, 'src/core');

/** Modules that make up the shared engine; everything they need is core. */
const INFRA = ['engine', 'theme', 'scale', 'base', 'marks', 'cartesian', 'markchart', 'chart3d'];
const isChartModule = (key) => key.startsWith('charts/');

// ---- Parse ------------------------------------------------------------------------

function listModules() {
  const out = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.ts') && f !== 'index.ts') out.push(p);
    }
  };
  walk(CORE);
  return out;
}

/** Identifier positions that are names, not references (obj.key, { key: v }, class members...). */
function isNonRef(p, field) {
  if (!p) return false;
  if (p.type === 'MemberExpression' && field === 'property' && !p.computed) return true;
  if (field === 'key' && !p.computed && /^(Property|PropertyDefinition|MethodDefinition|TSAbstractPropertyDefinition|TSAbstractMethodDefinition|AccessorProperty|TSPropertySignature|TSMethodSignature|TSEnumMember|TSAbstractAccessorProperty)$/.test(p.type)) return true;
  if (p.type === 'TSQualifiedName' && field === 'right') return true;
  if (/^(LabeledStatement|BreakStatement|ContinueStatement)$/.test(p.type) && field === 'label') return true;
  return false;
}

function collectIds(node) {
  const ids = [];
  const seen = new Set();
  const walk = (n, parent, field) => {
    if (!n || typeof n !== 'object' || seen.has(n)) return;
    seen.add(n);
    if (Array.isArray(n)) {
      for (const c of n) walk(c, parent, field);
      return;
    }
    if (typeof n.type !== 'string') return;
    if ((n.type === 'Identifier' || n.type === 'JSXIdentifier') && !isNonRef(parent, field)) ids.push(n);
    for (const k in n) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'range' || k === 'loc' || k === 'parent') continue;
      const v = n[k];
      if (v && typeof v === 'object') walk(v, n, k);
    }
  };
  walk(node, null, null);
  return ids;
}

function declNames(st) {
  switch (st.type) {
    case 'VariableDeclaration':
      return st.declarations.map((d) => {
        if (d.id.type !== 'Identifier') throw new Error('destructured top-level declaration not supported');
        return d.id.name;
      });
    case 'FunctionDeclaration':
    case 'TSDeclareFunction':
    case 'ClassDeclaration':
    case 'TSInterfaceDeclaration':
    case 'TSTypeAliasDeclaration':
    case 'TSEnumDeclaration':
      return [st.id.name];
    default:
      return null;
  }
}

function parseModule(file) {
  const key = path.relative(CORE, file).replace(/\\/g, '/').replace(/\.ts$/, '');
  const src = fs.readFileSync(file, 'utf8');
  const res = parseSync(file, src, { lang: 'ts' });
  if (res.errors.length) throw new Error(`${key}: ${res.errors[0].message}`);
  const mod = { key, src, bindings: new Map(), decls: new Map(), reexports: new Map(), deps: new Set() };
  let prevEnd = 0;
  let order = 0;
  for (const raw of res.program.body) {
    // Keep a trailing `// comment` on the same line with its statement.
    let end = raw.end;
    const nl = src.indexOf('\n', end);
    const rest = src.slice(end, nl < 0 ? src.length : nl);
    if (/^\s*\/\//.test(rest)) end += rest.length;
    const lead = src.slice(prevEnd, raw.start).trim();
    prevEnd = end;

    if (raw.type === 'ImportDeclaration') {
      const source = raw.source.value;
      const rel = source.startsWith('.');
      const target = rel ? path.posix.normalize(path.posix.join(path.posix.dirname(key), source)).replace(/\.(ts|js)$/, '') : null;
      if (target) mod.deps.add(target);
      for (const s of raw.specifiers) {
        const local = s.local.name;
        const imported = s.type === 'ImportNamespaceSpecifier' ? '*' : s.type === 'ImportDefaultSpecifier' ? 'default' : (s.imported.name ?? s.imported.value);
        const typeOnly = raw.importKind === 'type' || s.importKind === 'type';
        mod.bindings.set(local, rel ? { kind: 'mod', mod: target, name: imported } : { kind: 'ext', source, imported, typeOnly });
      }
      continue;
    }
    let st = raw;
    let exported = false;
    if (raw.type === 'ExportNamedDeclaration') {
      if (!raw.declaration) {
        if (raw.source) throw new Error(`${key}: re-export from a module is not supported`);
        for (const s of raw.specifiers) mod.reexports.set(s.exported.name, s.local.name);
        continue;
      }
      st = raw.declaration;
      exported = true;
    }
    const names = declNames(st);
    if (!names) throw new Error(`${key}: unsupported top-level statement ${raw.type}`);
    const stmt = {
      lead,
      text: src.slice(raw.start, end),
      start: raw.start,
      exported,
      order: order++,
      ids: collectIds(raw).filter((i) => i.start >= raw.start && i.end <= end),
      isType: st.type === 'TSInterfaceDeclaration' || st.type === 'TSTypeAliasDeclaration',
      node: st,
    };
    // Function overloads and declaration merging share one decl.
    const existing = mod.decls.get(names[0]);
    const decl = existing ?? { mod: key, names, stmts: [], refs: new Set() };
    decl.stmts.push(stmt);
    for (const id of stmt.ids) decl.refs.add(id.name);
    for (const n of names) mod.decls.set(n, decl);
  }
  return mod;
}

// ---- Link -------------------------------------------------------------------------

function link(mods) {
  const resolveExport = (m, name) => {
    if (m.decls.has(name)) return { decl: m.decls.get(name) };
    if (m.reexports.has(name)) return resolveLocal(m, m.reexports.get(name), name);
    throw new Error(`${m.key} does not export ${name}`);
  };
  const resolveLocal = (m, name, asName = name) => {
    if (m.decls.has(name)) return { decl: m.decls.get(name) };
    const b = m.bindings.get(name);
    if (!b) return null;
    if (b.kind === 'ext') return { ext: { source: b.source, imported: b.imported, local: asName, typeOnly: b.typeOnly } };
    const target = mods.get(b.mod);
    if (!target) throw new Error(`${m.key}: cannot resolve ${b.mod}`);
    const r = resolveExport(target, b.name);
    // An external re-exported under the importer's local name.
    if (r?.ext) r.ext = { ...r.ext, local: asName };
    return r;
  };
  for (const m of mods.values()) {
    const done = new Set();
    for (const decl of m.decls.values()) {
      if (done.has(decl)) continue;
      done.add(decl);
      decl.deps = new Set();
      decl.exts = [];
      for (const name of decl.refs) {
        if (decl.names.includes(name)) continue;
        const r = resolveLocal(m, name);
        if (!r) continue;
        if (r.decl) decl.deps.add(r.decl);
        else decl.exts.push(r.ext);
      }
      decl.isType = decl.stmts.every((s) => s.isType);
    }
  }
}

function topoOrder(mods) {
  const order = new Map();
  const visit = (k, stack = new Set()) => {
    if (order.has(k) || stack.has(k)) return;
    stack.add(k);
    for (const d of mods.get(k).deps) if (mods.has(d)) visit(d, stack);
    order.set(k, order.size);
  };
  for (const k of [...mods.keys()].sort()) visit(k);
  return order;
}

function closure(roots, stop) {
  const out = new Set();
  const stack = [...roots];
  while (stack.length) {
    const d = stack.pop();
    if (out.has(d) || stop.has(d)) continue;
    out.add(d);
    for (const x of d.deps) stack.push(x);
  }
  return out;
}

// ---- Chart list ---------------------------------------------------------------------

/** type -> { cls, mod } from the registry in src/core/index.ts. */
function readRegistry() {
  const src = fs.readFileSync(path.join(CORE, 'index.ts'), 'utf8');
  const classMod = new Map();
  for (const m of src.matchAll(/import \{([^}]+)\} from '\.\/(charts\/[\w-]+)'/g)) {
    for (const n of m[1].split(',')) classMod.set(n.trim(), m[2]);
  }
  const block = src.slice(src.indexOf('const registry'), src.indexOf('};', src.indexOf('const registry')));
  const out = new Map();
  for (const m of block.matchAll(/^\s+(\w+): (\w+),$/gm)) out.set(m[1], { cls: m[2], mod: classMod.get(m[2]) });
  return out;
}

/** type -> React component name, from the demo's COMPONENT map. */
function readComponents() {
  const src = fs.readFileSync(path.join(ROOT, 'src/demo/examples.ts'), 'utf8');
  const i = src.indexOf('COMPONENT');
  const block = src.slice(i, src.indexOf('};', i));
  const out = new Map();
  for (const m of block.matchAll(/^\s+(\w+): '(\w+)',$/gm)) out.set(m[1], m[2]);
  return out;
}

export const fileNameFor = (component) =>
  component
    .replace(/(\d)D/g, '$1d')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase();

/** The options interface whose `type` is exactly this literal. */
function findOptions(mods, type) {
  for (const key of ['types', 'types2']) {
    for (const decl of new Set(mods.get(key).decls.values())) {
      for (const s of decl.stmts) {
        if (s.node.type !== 'TSInterfaceDeclaration') continue;
        for (const m of s.node.body.body) {
          const ann = m.typeAnnotation?.typeAnnotation;
          if (m.key?.name === 'type' && ann?.type === 'TSLiteralType' && ann.literal.value === type) return decl;
        }
      }
    }
  }
  throw new Error(`no options interface with type '${type}'`);
}

// ---- Emit ---------------------------------------------------------------------------

function sortDecls(set, order) {
  return [...set].sort((a, b) => order.get(a.mod) - order.get(b.mod) || a.stmts[0].start - b.stmts[0].start);
}

function declText(decl, { addExport, rename }) {
  return decl.stmts
    .map((s) => {
      let text = s.text;
      if (rename?.size) {
        const hits = s.ids.filter((i) => rename.has(i.name)).sort((a, b) => b.start - a.start);
        for (const id of hits) {
          const a = id.start - s.start;
          text = text.slice(0, a) + rename.get(id.name) + text.slice(a + id.name.length);
        }
      }
      if (addExport && !s.exported) text = 'export ' + text;
      return (s.lead ? s.lead + '\n' : '') + text;
    })
    .join('\n\n');
}

function importLine(prefix, parts, source) {
  const one = `import ${prefix}{ ${parts.join(', ')} } from '${source}';`;
  if (one.length <= 120) return one;
  return `import ${prefix}{\n${parts.map((p) => `  ${p},`).join('\n')}\n} from '${source}';`;
}

function importLines(exts, coreNames, coreSpec) {
  const bySource = new Map();
  for (const e of exts) {
    if (!bySource.has(e.source)) bySource.set(e.source, new Map());
    const m = bySource.get(e.source);
    const prev = m.get(e.local);
    if (prev && (prev.imported !== e.imported)) throw new Error(`import clash for ${e.local}`);
    m.set(e.local, { ...e, typeOnly: (prev ? prev.typeOnly : true) && e.typeOnly });
  }
  const lines = [];
  const sources = [...bySource.keys()].sort((a, b) => (a === 'three' ? -1 : b === 'three' ? 1 : a.localeCompare(b)));
  for (const source of sources) {
    const specs = [...bySource.get(source).values()];
    const ns = specs.find((s) => s.imported === '*');
    if (ns) lines.push(`import ${ns.typeOnly ? 'type ' : ''}* as ${ns.local} from '${source}';`);
    const named = specs.filter((s) => s.imported !== '*').sort((a, b) => a.local.localeCompare(b.local));
    if (named.length) {
      const allType = named.every((s) => s.typeOnly);
      const parts = named.map((s) => `${!allType && s.typeOnly ? 'type ' : ''}${s.imported === s.local ? s.local : `${s.imported} as ${s.local}`}`);
      lines.push(importLine(allType ? 'type ' : '', parts, source));
    }
  }
  if (coreNames.length) {
    const sorted = [...coreNames].sort((a, b) => a.name.localeCompare(b.name));
    const allType = sorted.every((c) => c.isType);
    const parts = sorted.map((c) => `${!allType && c.isType ? 'type ' : ''}${c.name}`);
    lines.push(importLine(allType ? 'type ' : '', parts, coreSpec));
  }
  return lines.join('\n');
}

function checkUnique(label, names) {
  const seen = new Set();
  for (const n of names) {
    if (seen.has(n)) throw new Error(`${label}: two top-level declarations named "${n}"`);
    seen.add(n);
  }
}

const PRETTIER = { parser: 'babel', singleQuote: true, printWidth: 140, trailingComma: 'all' };

/** oxc drops blank lines; put one back between top-level statements and class members. */
function respace(code, file) {
  const res = parseSync(file, code, { lang: file.endsWith('x') ? 'jsx' : 'js' });
  const starts = [];
  // Blank line before methods, and before fields that carry a comment.
  const visitClass = (cls) =>
    cls.body.body.slice(1).forEach((m) => {
      if (m.type === 'MethodDefinition' || hasCommentAbove(m.start)) starts.push(m.start);
    });
  const hasCommentAbove = (p) => /^\s*(\/\/|\*|\/\*)/.test(code.slice(0, p).split('\n').at(-2) ?? '') || /\*\/\s*$/.test(code.slice(0, p).split('\n').at(-2) ?? '');
  res.program.body.forEach((st, i) => {
    if (i > 0) starts.push(st.start);
    const d = st.declaration ?? st;
    if (d.type === 'ClassDeclaration') visitClass(d);
  });
  const lines = code.split('\n');
  const lineStarts = [];
  let pos = 0;
  for (const l of lines) {
    lineStarts.push(pos);
    pos += l.length + 1;
  }
  const lineOf = (p) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= p) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const blankBefore = new Set();
  for (const s of starts) {
    let l = lineOf(s);
    // Climb over the comment block that belongs to this statement.
    while (l > 0 && /^\s*(\/\/|\/\*|\*)/.test(lines[l - 1])) l--;
    if (l > 0 && lines[l - 1].trim() !== '' && !/^import /.test(lines[l - 1]) && !/\{$/.test(lines[l - 1].trim())) blankBefore.add(l);
    else if (l > 0 && /^import /.test(lines[l - 1]) && !/^import /.test(lines[l])) blankBefore.add(l);
  }
  return lines.map((l, i) => (blankBefore.has(i) ? '\n' + l : l)).join('\n');
}

// ---- Formatting: Prettier in worker threads, cached on disk by input hash ----------------

const CACHE_FILE = path.join(ROOT, 'node_modules/.cache/three-charts-registry.json');
let cache = null;
let pool = null;

function loadCache() {
  if (cache) return cache;
  try {
    cache = new Map(Object.entries(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))));
  } catch {
    cache = new Map();
  }
  return cache;
}

function saveCache(used) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  // Keep only entries this run used, so the cache doesn't grow forever.
  fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries([...cache].filter(([k]) => used.has(k)))));
}

function startPool() {
  const n = Math.max(1, Math.min(8, os.cpus().length - 1));
  const workers = Array.from({ length: n }, () => new Worker(new URL('./format-worker.mjs', import.meta.url)));
  const pending = new Map();
  const queue = [];
  const idle = [...workers];
  let next = 0;
  const pump = () => {
    while (idle.length && queue.length) {
      const w = idle.pop();
      const job = queue.shift();
      pending.set(job.id, { ...job, w });
      w.postMessage({ id: job.id, code: job.code, options: PRETTIER });
    }
  };
  for (const w of workers) {
    w.on('message', ({ id, code, error }) => {
      const job = pending.get(id);
      pending.delete(id);
      idle.push(job.w);
      if (error) job.reject(new Error(error));
      else job.resolve(code);
      pump();
    });
  }
  return {
    format: (code) =>
      new Promise((resolve, reject) => {
        queue.push({ id: next++, code, resolve, reject });
        pump();
      }),
    close: () => Promise.all(workers.map((w) => w.terminate())),
  };
}

const usedKeys = new Set();
/** Prettier + blank-line pass for one top-level statement, cached by its text. */
async function format(code, lang) {
  const key = crypto.createHash('sha1').update(lang + '\0' + code).digest('base64');
  usedKeys.add(key);
  const hit = loadCache().get(key);
  if (hit !== undefined) return hit;
  pool ??= startPool();
  const out = respace(await pool.format(code), `x.${lang}`);
  cache.set(key, out);
  return out;
}

/**
 * TS -> JS. oxc strips the types (and type-only imports) for the whole file;
 * then each top-level statement is formatted on its own, so a declaration
 * shared by many files is formatted once and cached.
 * `extensions`: plain-browser JS needs './chart-core.js'; bundler (React) files don't.
 */
async function toJS(tsCode, file, lang, extensions = true) {
  // Whole-file cache first: unchanged files skip parsing entirely.
  const fileKey = crypto.createHash('sha1').update(`file\0${lang}\0${extensions}\0${tsCode}`).digest('base64');
  usedKeys.add(fileKey);
  const cached = loadCache().get(fileKey);
  if (cached !== undefined) return cached;
  const js = await toJSUncached(tsCode, file, lang, extensions);
  cache.set(fileKey, js);
  return js;
}

async function toJSUncached(tsCode, file, lang, extensions) {
  const directive = tsCode.startsWith("'use client';") ? "'use client';\n\n" : '';
  const rest = tsCode.slice(directive.length);
  const headerLines = rest.split('\n');
  const n = headerLines.findIndex((l) => !l.startsWith('//'));
  const toJsNames = (t) =>
    t.replace(/\.tsx(:|,| )/g, '.jsx$1').replace(/\.ts(:|,| )/g, '.js$1').replace(/(chart-[\w-]+)\.ts\b/g, '$1.js').replace(/(chart-react)\.tsx\b/g, '$1.jsx');
  const header = toJsNames(headerLines.slice(0, n).join('\n'));
  const body = headerLines.slice(n).join('\n');
  const r = transformSync(file, body, { lang, jsx: 'preserve' });
  if (r.errors.length) throw new Error(`${file}: ${r.errors[0].message}`);
  let code = r.code;
  if (extensions) code = code.replace(/from "\.\/(chart-[\w-]+)"/g, 'from "./$1.js"');
  const jsLang = lang === 'tsx' ? 'jsx' : 'js';
  const prog = parseSync(`x.${jsLang}`, code, { lang: jsLang, sourceType: 'module' }).program;
  const chunks = [];
  let prev = 0;
  for (const st of prog.body) {
    const text = code.slice(prev, st.end).trim();
    prev = st.end;
    if (st.type === 'ExpressionStatement' && st.directive) continue;
    chunks.push({ text, imp: st.type === 'ImportDeclaration' });
  }
  const formatted = await Promise.all(chunks.map((c) => format(c.text, jsLang)));
  let out = '';
  formatted.forEach((f, i) => {
    out += i === 0 ? '' : chunks[i - 1].imp && chunks[i].imp ? '\n' : '\n\n';
    out += f.trimEnd();
  });
  return directive + header + '\n\n' + out + '\n';
}

// ---- Build ------------------------------------------------------------------------

/**
 * The shared code is split into small packs so each chart only asks for what
 * it uses. A pack may import only from its ancestors.
 */
const PACKS = [
  { name: 'core', file: 'chart-core', modules: ['engine', 'theme', 'scale', 'base', 'marks'], parents: [], about: 'Engine, theme, labels, tooltips and legends. Every chart needs it.' },
  { name: 'axes', file: 'chart-axes', modules: ['cartesian'], parents: ['core'], about: 'x/y axes, grid, zoom, pan and sync.' },
  { name: 'marks', file: 'chart-marks', modules: ['markchart'], parents: ['axes'], about: 'Declarative 2D marks: bars, areas, points, labels, hover regions.' },
  { name: '3d', file: 'chart-3d', modules: ['chart3d'], parents: ['core'], about: 'Orbit camera and lighting for 3D charts.' },
  { name: 'layout', file: 'chart-layout', modules: ['layouts'], parents: ['core'], about: 'Tree, treemap, pack, Sankey, chord and force layouts.' },
  { name: 'stats', file: 'chart-stats', modules: ['stats'], parents: ['core'], about: 'Quantiles, kernel density, moving averages, curves.' },
  { name: 'geo', file: 'chart-geo', modules: ['geo'], parents: ['core'], about: 'TopoJSON decoding and map projections.' },
];
const PACK = new Map(PACKS.map((p) => [p.name, p]));
const ancestors = (name) => {
  const out = new Set([name]);
  for (const p of PACK.get(name).parents) for (const x of ancestors(p)) out.add(x);
  return out;
};
const ANC = new Map(PACKS.map((p) => [p.name, ancestors(p.name)]));
const MODULE_PACK = new Map(PACKS.flatMap((p) => p.modules.map((m) => [m, p.name])));
const packOrder = (names) => PACKS.map((p) => p.name).filter((n) => names.has(n));

const REACT_SRC = path.join(ROOT, 'src/react/chart-react.tsx');

const header = (lines) => lines.map((l) => `// ${l}`).join('\n') + '\n';
const GENERATED = 'Generated by three-charts. Edit freely; it is your code now.';

export async function buildRegistry({ quiet = false } = {}) {
  const t0 = performance.now();
  const mods = new Map();
  for (const f of listModules()) {
    const m = parseModule(f);
    mods.set(m.key, m);
  }
  link(mods);
  const order = topoOrder(mods);
  const registry = readRegistry();
  const components = readComponents();

  const charts = [...registry].map(([type, { cls, mod }]) => {
    const comp = components.get(type);
    if (!comp) throw new Error(`no component name for ${type}`);
    const clsDecl = mods.get(mod).decls.get(cls);
    const opts = findOptions(mods, type);
    return { type, cls, comp, file: fileNameFor(comp), roots: [clsDecl, opts], optsName: opts.names[0] };
  });

  // ---- 1. Shared = the engine plus anything (outside chart modules) used by 2+ charts.
  const infraRoots = INFRA.flatMap((k) => [...new Set(mods.get(k).decls.values())]);
  let shared = closure(infraRoots, new Set());
  for (;;) {
    const count = new Map();
    for (const c of charts) for (const d of closure(c.roots, shared)) count.set(d, (count.get(d) ?? 0) + 1);
    const promote = [...count].filter(([d, n]) => n >= 2 && !isChartModule(d.mod)).map(([d]) => d);
    if (!promote.length) break;
    shared = new Set([...shared, ...closure(promote, shared)]);
  }

  // ---- 2. Put each shared declaration in a pack.
  const packOf = new Map();
  const floating = [];
  for (const d of shared) {
    const p = MODULE_PACK.get(d.mod);
    if (p) packOf.set(d, p);
    else if (d.isType) floating.push(d);
    else packOf.set(d, 'core');
  }
  // Small, self-contained helpers that pull a whole pack into a chart (e.g. a pie
  // needing marks + axes just for polar()) move into core instead.
  const declLines = (d) => d.stmts.reduce((n, st) => n + st.text.split('\n').length + (st.lead ? st.lead.split('\n').length : 0), 0);
  const HOIST_LIMIT = 60;
  for (let changed = true; changed; ) {
    changed = false;
    for (const c of charts) {
      const reached = [...closure(c.roots, new Set())].filter((d) => shared.has(d) && packOf.get(d));
      const byPack = new Map();
      for (const d of reached) {
        const p = packOf.get(d);
        if (p !== 'core') (byPack.get(p) ?? byPack.set(p, new Set()).get(p)).add(d);
      }
      for (const [p, D] of byPack) {
        const lines = [...D].reduce((n, d) => n + declLines(d), 0);
        // Worth it only when the pack is much bigger than the bit this chart uses.
        const packLines = [...shared].filter((d) => packOf.get(d) === p).reduce((n, d) => n + declLines(d), 0);
        if (lines > HOIST_LIMIT || packLines < lines * 5) continue;
        const selfContained = [...D].every((d) => [...d.deps].every((x) => !shared.has(x) || D.has(x) || !packOf.get(x) || packOf.get(x) === 'core'));
        if (!selfContained) continue;
        for (const d of D) packOf.set(d, 'core');
        changed = true;
      }
    }
  }

  // Packs a chart needs because of its runtime code (types are placed to fit these).
  const runtimePacks = (c) => {
    const need = new Set();
    for (const d of closure(c.roots, new Set())) {
      const p = packOf.get(d);
      if (p) for (const a of ANC.get(p)) need.add(a);
    }
    return need;
  };
  for (const c of charts) c.need = runtimePacks(c);
  // Users of each shared declaration: shared decls (by pack) and charts.
  const users = new Map();
  for (const d of shared) for (const x of d.deps) if (shared.has(x)) (users.get(x) ?? users.set(x, []).get(x)).push(d);
  // A chart uses every shared declaration it reaches, directly or through other shared ones.
  const chartUsers = new Map();
  for (const c of charts) {
    for (const x of closure(c.roots, new Set())) if (shared.has(x)) (chartUsers.get(x) ?? chartUsers.set(x, new Set()).get(x)).add(c);
  }
  // Types: the most specific pack that every user already has and that can see the type's own dependencies.
  floating.sort((a, b) => order.get(a.mod) - order.get(b.mod) || a.stmts[0].start - b.stmts[0].start);
  const unplaced = new Set(floating);
  for (let pass = 0; pass < 4 && unplaced.size; pass++) {
    for (const d of [...unplaced]) {
      const depPacks = [...d.deps].filter((x) => shared.has(x)).map((x) => packOf.get(x));
      if (depPacks.some((p) => p === undefined)) continue; // a dependency isn't placed yet
      const ok = PACKS.map((p) => p.name).filter((P) => {
        if (!depPacks.every((q) => ANC.get(P).has(q))) return false;
        for (const u of users.get(d) ?? []) {
          const up = packOf.get(u);
          if (up && !ANC.get(up).has(P)) return false;
        }
        for (const c of chartUsers.get(d) ?? []) if (!c.need.has(P)) return false;
        return true;
      });
      if (ok.length) {
        packOf.set(d, ok.sort((x, y) => ANC.get(y).size - ANC.get(x).size)[0]);
        unplaced.delete(d);
      }
    }
  }
  // Types that fit no single pack are copied into each chart file that uses them.
  for (const d of unplaced) shared.delete(d);
  for (const d of shared) for (const x of d.deps) {
    if (shared.has(x) && !ANC.get(packOf.get(d)).has(packOf.get(x))) throw new Error(`${d.names[0]} (${packOf.get(d)}) needs ${x.names[0]} (${packOf.get(x)})`);
  }

  // ---- 3. What each chart file holds and imports.
  const usedOutside = new Set();
  for (const d of shared) for (const x of d.deps) if (shared.has(x) && packOf.get(x) !== packOf.get(d)) usedOutside.add(x);
  for (const c of charts) {
    c.decls = closure(c.roots, shared);
    c.sharedRefs = new Set();
    c.exts = [];
    for (const d of c.decls) {
      for (const x of d.deps) if (shared.has(x)) c.sharedRefs.add(x);
      c.exts.push(...d.exts);
    }
    for (const x of c.sharedRefs) usedOutside.add(x);
    const need = new Set();
    for (const x of c.sharedRefs) for (const a of ANC.get(packOf.get(x))) need.add(a);
    need.add('core');
    c.packs = packOrder(need);
  }

  // ---- 4. Pack files.
  // Build into temp folders and swap them in at the end, so a run that overlaps
  // another (dev server + manual) never leaves a half-written registry.
  const final = path.join(ROOT, 'public/registry');
  const finalR = path.join(ROOT, 'public/r');
  removeStaleTemps();
  const tag = `.tmp-${process.pid}-${Date.now()}`;
  const out = final + tag;
  const outR = finalR + tag;
  for (const dir of ['js', 'react-js']) fs.mkdirSync(path.join(out, dir), { recursive: true });
  // Single-file builds ship for the TypeScript flavours only (they're large; JS users take the modular files).
  for (const dir of ['ts', 'react-ts']) fs.mkdirSync(path.join(out, dir, 'single'), { recursive: true });
  fs.mkdirSync(outR, { recursive: true });
  const write = (rel, text) => fs.writeFileSync(path.join(out, rel), text);

  /** Import lines for shared decls, one per pack. */
  const packImports = (refs, ext = '') => {
    const byPack = new Map();
    for (const d of refs) {
      const p = packOf.get(d);
      if (!byPack.has(p)) byPack.set(p, []);
      for (const name of d.names) byPack.get(p).push({ name, isType: d.isType });
    }
    return packOrder(new Set(byPack.keys()))
      .map((p) => importLines([], [...new Map(byPack.get(p).map((x) => [x.name, x])).values()], `./${PACK.get(p).file}${ext}`))
      .join('\n');
  };

  const packText = new Map();
  for (const pack of PACKS) {
    const decls = sortDecls(new Set([...shared].filter((d) => packOf.get(d) === pack.name)), order);
    checkUnique(pack.file, decls.flatMap((d) => d.names));
    const refs = new Set();
    for (const d of decls) for (const x of d.deps) if (shared.has(x) && packOf.get(x) !== pack.name) refs.add(x);
    const usedBy = charts.filter((c) => c.packs.includes(pack.name)).length;
    const ts =
      header([
        `${pack.file}.ts: ${pack.about}`,
        `Shared by ${usedBy} chart${usedBy === 1 ? '' : 's'}. Copy it once, next to your chart files.`,
        ...(pack.parents.length ? [`Needs ${pack.parents.map((p) => PACK.get(p).file + '.ts').join(', ')}.`] : ['Requires: npm install three']),
        GENERATED,
      ]) +
      '\n' +
      [importLines(decls.flatMap((d) => d.exts), [], ''), packImports(refs)].filter(Boolean).join('\n') +
      '\n\n' +
      decls.map((d) => declText(d, { addExport: usedOutside.has(d) })).join('\n\n') +
      '\n';
    const [js, bundlerJs] = await Promise.all([toJS(ts, `${pack.file}.ts`, 'ts'), toJS(ts, `${pack.file}.ts`, 'ts', false)]);
    packText.set(pack.name, { ts, js });
    for (const dir of ['ts', 'react-ts']) write(`${dir}/${pack.file}.ts`, ts);
    write(`js/${pack.file}.js`, js);
    write(`react-js/${pack.file}.js`, bundlerJs);
  }

  // React helper (one per project): src/react/chart-react.tsx with its import pointed at the core pack.
  const reactSrc = fs.readFileSync(REACT_SRC, 'utf8');
  const reactTsx = reactSrc.replace(
    /^'use client';\n\n/,
    `'use client';\n\n` + header(['chart-react.tsx: turns a chart class into a React component. Copy it once.', 'Requires: React 18+', GENERATED]) + '\n',
  ).replace("from '../core/types'", "from './chart-core'");
  const reactJsx = await toJS(reactTsx, 'chart-react.tsx', 'tsx', false);
  write('react-ts/chart-react.tsx', reactTsx);
  write('react-js/chart-react.jsx', reactJsx);

  const manifest = {
    packs: Object.fromEntries(PACKS.map((p) => [p.name, { file: p.file, about: p.about, ts: stat(packText.get(p.name).ts), js: stat(packText.get(p.name).js) }])),
    react: { file: 'chart-react', tsx: stat(reactTsx), jsx: stat(reactJsx) },
    charts: {},
  };

  // ---- 5. Chart files, modular and single-file.
  const reactParsed = parseSync('chart-react.tsx', reactSrc, { lang: 'tsx' }).program.body;
  const reactBody = reactParsed
    .filter((st) => st.type !== 'ImportDeclaration' && !(st.type === 'ExpressionStatement' && st.directive))
    .map((st, i, arr) => {
      const prevEnd = i ? arr[i - 1].end : reactParsed.find((x) => x.type === 'ImportDeclaration' && x.end <= st.start && !reactParsed.some((y) => y.type === 'ImportDeclaration' && y.start > x.start && y.end <= st.start))?.end ?? 0;
      return reactSrc.slice(prevEnd, st.end).trim();
    })
    .join('\n\n');
  const reactImport = "import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties, type ForwardRefExoticComponent, type RefAttributes } from 'react';";
  const reactTypeRoots = ['CommonOptions', 'HitInfo'].map((n) => mods.get('types').decls.get(n));

  const jobs = charts.map(async (c) => {
    const decls = sortDecls(c.decls, order);
    const own = decls.flatMap((d) => d.names);
    const refs = [...c.sharedRefs];
    checkUnique(c.file, [...own, ...refs.flatMap((d) => d.names), ...new Set(c.exts.map((e) => e.local))]);

    const title = c.comp.replace(/Chart$/, '').replace(/([a-z])([A-Z])/g, '$1 $2') || c.comp;
    const article = /^[aeiou]/i.test(title) ? 'an' : 'a';
    const needs = (ext) => c.packs.map((p) => `${PACK.get(p).file}.${ext}`).join(', ');
    const factory = `
/**
 * Render ${article} ${title.toLowerCase()} chart into \`container\`. Give the container a height; the chart fills it.
 * Returns the chart: call update(options), resetView(), toPNG() or destroy() on it.
 */
export function create${c.comp}(container: HTMLElement, options: Omit<${c.optsName}, 'type'>): ${c.cls} {
  return new ${c.cls}(container, { ...options, type: '${c.type}' });
}
`;
    // React: the component takes the nice name; a clashing class becomes <Name>Core.
    const rename = new Map(own.includes(c.comp) ? [[c.comp, c.comp + 'Core']] : []);
    const coreCls = rename.get(c.cls) ?? c.cls;
    const component = `
export type ${c.comp}Props = ChartProps<${c.optsName}>;
export type ${c.comp}Handle = ChartHandle<${c.optsName}, ${coreCls}>;

/** \`<${c.comp} height={320} ... />\`. Pass a ref for update(), resetView(), toPNG() and chart(). */
export const ${c.comp} = chartComponent<${c.optsName}, ${coreCls}>(${coreCls}, '${c.type}', '${c.comp}');
`;

    // Modular: this chart's own code, importing the shared packs.
    const body = decls.map((d) => declText(d, {})).join('\n\n');
    const ts =
      header([`${c.file}.ts: ${title} chart.`, `Needs ${needs('ts')} in the same folder, and npm install three.`, GENERATED]) +
      '\n' +
      [importLines(c.exts, [], ''), packImports(refs)].filter(Boolean).join('\n') +
      '\n\n' +
      body +
      '\n' +
      factory;
    const tsx =
      `'use client';\n\n` +
      header([`${c.file}.tsx: ${title} chart for React.`, `Needs chart-react.tsx, ${needs('ts')} in the same folder, and npm install three.`, GENERATED]) +
      '\n' +
      [importLines(c.exts, [], ''), packImports(refs), "import { chartComponent, type ChartHandle, type ChartProps } from './chart-react';"].filter(Boolean).join('\n') +
      '\n\n' +
      decls.map((d) => declText(d, { rename })).join('\n\n') +
      '\n' +
      component;

    // Single file: exactly the declarations this chart reaches, nothing else.
    const all = sortDecls(closure(c.roots, new Set()), order);
    const allReact = sortDecls(closure([...c.roots, ...reactTypeRoots], new Set()), order);
    const allExts = all.flatMap((d) => d.exts);
    checkUnique(`${c.file} (single)`, all.flatMap((d) => d.names));
    const singleNote = 'Single-file build: everything this chart needs. Using several charts? The shared files avoid duplicate code.';
    const sts =
      header([`${c.file}.ts: ${title} chart, self-contained.`, singleNote, 'Requires: npm install three', GENERATED]) +
      '\n' +
      importLines(allExts, [], '') +
      '\n\n' +
      all.map((d) => declText(d, { addExport: d === c.roots[0] || d === c.roots[1] })).join('\n\n') +
      '\n' +
      factory;
    const stsx =
      `'use client';\n\n` +
      header([`${c.file}.tsx: ${title} chart for React, self-contained.`, singleNote, 'Requires: npm install three (React 18+)', GENERATED]) +
      '\n' +
      reactImport +
      '\n' +
      importLines(allReact.flatMap((d) => d.exts), [], '') +
      '\n\n' +
      allReact.map((d) => declText(d, { rename, addExport: d === c.roots[1] })).join('\n\n') +
      '\n\n// ---- React ------------------------------------------------------------------------\n\n' +
      reactBody +
      '\n' +
      component;

    const [js, jsx] = await Promise.all([toJS(ts, `${c.file}.ts`, 'ts'), toJS(tsx, `${c.file}.tsx`, 'tsx', false)]);
    write(`ts/${c.file}.ts`, ts);
    write(`js/${c.file}.js`, js);
    write(`react-ts/${c.file}.tsx`, tsx);
    write(`react-js/${c.file}.jsx`, jsx);
    write(`ts/single/${c.file}.ts`, sts);
    write(`react-ts/single/${c.file}.tsx`, stsx);

    manifest.charts[c.type] = {
      file: c.file,
      component: c.comp,
      factory: `create${c.comp}`,
      className: c.cls,
      options: c.optsName,
      packs: c.packs,
      ts: stat(ts),
      js: stat(js),
      tsx: stat(tsx),
      jsx: stat(jsx),
      single: { ts: stat(sts), tsx: stat(stsx) },
    };

    // shadcn registry item: the chart, the React helper and the packs it needs (identical files are skipped on re-add).
    const file = (name, content) => ({ path: `registry/charts/${name}`, type: 'registry:component', target: `components/charts/${name}`, content });
    const item = {
      $schema: 'https://ui.shadcn.com/schema/registry-item.json',
      name: c.file,
      type: 'registry:component',
      title: `${title} chart`,
      description: `${title} chart rendered with three.js (WebGL).`,
      dependencies: ['three'],
      // three ships without types; the TypeScript files need them.
      devDependencies: ['@types/three'],
      files: [...c.packs.map((p) => file(`${PACK.get(p).file}.ts`, packText.get(p).ts)), file('chart-react.tsx', reactTsx), file(`${c.file}.tsx`, tsx)],
    };
    fs.writeFileSync(path.join(outR, `${c.file}.json`), JSON.stringify(item, null, 2));
  });
  await Promise.all(jobs);

  if (pool) {
    await pool.close();
    pool = null;
  }
  saveCache(usedKeys);
  usedKeys.clear();

  manifest.charts = Object.fromEntries(Object.entries(manifest.charts).sort(([a], [b]) => a.localeCompare(b)));
  write('index.json', JSON.stringify(manifest, null, 2));
  for (const [tmp, dest] of [[out, final], [outR, finalR]]) swapInto(tmp, dest);
  if (!quiet) {
    const ms = Math.round(performance.now() - t0);
    const sizes = PACKS.map((p) => `${p.file} ${manifest.packs[p.name].ts.lines}`).join(', ');
    console.log(`registry: ${charts.length} charts in ${ms} ms -> public/registry (${sizes})`);
  }
  return manifest;
}

/** Replace `dest` with `tmp`. Retries when another run swaps at the same moment. */
function swapInto(tmp, dest) {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.rmSync(dest, { recursive: true, force: true });
      fs.renameSync(tmp, dest);
      return;
    } catch (e) {
      if (attempt >= 5 || (e.code !== 'ENOTEMPTY' && e.code !== 'EEXIST')) throw e;
    }
  }
}

/** Temp folders left by runs that were killed part-way. */
function removeStaleTemps() {
  const dir = path.join(ROOT, 'public');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!/^(registry|r)\.tmp-/.test(f)) continue;
    const p = path.join(dir, f);
    if (Date.now() - fs.statSync(p).mtimeMs > 5 * 60_000) fs.rmSync(p, { recursive: true, force: true });
  }
}

function stat(text) {
  return { lines: text.split('\n').length, bytes: Buffer.byteLength(text) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildRegistry().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
