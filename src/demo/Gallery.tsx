import { useEffect, useRef, useState } from 'react';
import type { ChartOptions } from '../core';
import { ThreeChart } from '../react/ThreeChart';
import { DonutChart as DonutChartJSX } from '../react-js/ThreeChart.jsx';
import { buildOptions, EXAMPLES, type Example } from './examples';
import { GROUPS } from './examples2';
import { LiveChart } from './LiveChart';

/** Mounts the chart (and generates its data) only once the card is near the viewport. */
function LazyChart({ ex }: { ex: Example }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [built, setBuilt] = useState<{ options: ChartOptions; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const height = ex.height ?? 320;

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '400px' });
    io.observe(box.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let live = true;
    const t0 = performance.now();
    buildOptions(ex)
      .then((options) => live && setBuilt({ options, ms: performance.now() - t0 }))
      .catch((e: unknown) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [near, ex]);

  return (
    <div ref={box} style={{ minHeight: height }}>
      {error && <p className="meta">Couldn't build this example: {error}</p>}
      {built &&
        (ex.id === 'donut' ? (
          // One card renders through the plain-JS wrapper to show both wrappers behave the same.
          <DonutChartJSX height={height} {...built.options} />
        ) : (
          <ThreeChart height={height} {...built.options} />
        ))}
      {built && ex.scale && <p className="meta">Data generated in {built.ms.toFixed(0)} ms</p>}
    </div>
  );
}

function Card({ ex }: { ex: Example }) {
  return (
    <article className="card" id={`ex-${ex.id}`}>
      <header>
        <h3>
          <a href={`#/code/${ex.id}`}>{ex.title}</a>
        </h3>
      </header>
      <p className="blurb">{ex.blurb}</p>
      <LazyChart ex={ex} />
      <footer>
        <span className="spec">
          <span>{ex.type}</span>
          <span>{ex.dim}</span>
          {ex.scale && <span>{ex.scale}</span>}
        </span>
        <a href={`#/code/${ex.id}`}>Customize &amp; code →</a>
      </footer>
    </article>
  );
}

/** One line per category, saying what its charts are for. */
const ABOUT: Record<string, string> = {
  Comparison: 'Compare values across categories: bars, dots, ranges, bullets.',
  Trend: 'Change over time, from sparklines to streaming lines and range navigators.',
  Distribution: 'The shape of a set of values: histograms, boxes, violins, swarms.',
  'Part-to-whole': 'Shares of a total: pies, waffles, funnels, Venn diagrams.',
  Hierarchy: 'Nested data: treemaps, sunbursts, trees, packed circles.',
  Relationship: 'How variables move together: scatter, hexbin, contour, parallel coordinates.',
  Network: 'Nodes and links in 2D and 3D, chords and arc diagrams.',
  'Flow & time': 'Movement between stages and schedules: Sankey, Gantt, calendars.',
  KPI: 'One number and how it is doing: gauges, rings, stat tiles.',
  'Machine learning': 'Model evaluation: confusion matrices and ROC curves.',
  Financial: 'Prices and indicators: candles, depth, MACD, RSI, Renko.',
  Geo: 'Maps, from choropleths and bubbles to a 3D globe.',
  '3D & scientific': 'Surfaces, meshes, vector fields and isosurfaces.',
};

const FEATURED = 3;

export function Gallery({ focus }: { focus?: string }) {
  // Old "see it live" links pointed at the overview; each chart now has its own page.
  useEffect(() => {
    if (focus) location.replace(`#/code/${focus}`);
  }, [focus]);

  const count = EXAMPLES.length + 1;
  const types = new Set(EXAMPLES.map((e) => e.type)).size;

  return (
    <div className="overview">
      <section className="hero">
        <div>
          <h1>
            Charts you copy in. <em>Not a library you install.</em>
          </h1>
          <p>
            {types} chart types on one shared WebGL renderer, from bar charts to million-point scatter plots, streaming telemetry and 3D surfaces. Pick one, copy
            its file, and the code is yours. React or plain TypeScript; three.js is the only dependency.
          </p>
          <div className="row">
            <a className="btn primary" href="#/code/bar">
              Open the first chart
            </a>
            <a className="btn" href="#/docs">
              How to use them
            </a>
          </div>
          <p className="meta hint">
            Every chart is live: hover for values, click legend items to hide series, drag to pan or orbit. Press <kbd>/</kbd> to find one of {count}{' '}
            examples.
          </p>
        </div>
        <LiveChart bench height={260} />
      </section>

      {GROUPS.map((g) => {
        const all = EXAMPLES.filter((e) => e.group === g);
        return (
          <section key={g} className="group" id={`group-${g.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
            <header className="group-head">
              <h2>{g}</h2>
              <span className="count">{all.length + (g === 'Trend' ? 1 : 0)}</span>
              <p>{ABOUT[g]}</p>
            </header>
            <div className="grid">
              {all.slice(0, FEATURED).map((ex) => (
                <Card key={ex.id} ex={ex} />
              ))}
            </div>
            <ul className="more">
              {all.slice(FEATURED).map((ex) => (
                <li key={ex.id}>
                  <a href={`#/code/${ex.id}`}>{ex.title}</a>
                </li>
              ))}
              {g === 'Trend' && (
                <li>
                  <a href="#/code/live">Live streaming line</a>
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
