import { useEffect, useRef, useState } from 'react';
import type { ChartOptions } from '../core';
import { ThreeChart } from '../react/ThreeChart';
import { DonutChart as DonutChartJSX } from '../react-js/ThreeChart.jsx';
import { buildOptions, EXAMPLES, type Example } from './examples';
import { GROUPS } from './examples2';
import { LiveChart } from './LiveChart';

type Dim = 'all' | '2D' | '3D' | 'large';

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
        <h3>{ex.title}</h3>
        <span className="badge">{ex.dim}</span>
        {ex.scale && <span className="badge accent">{ex.scale}</span>}
      </header>
      <p className="blurb">{ex.blurb}</p>
      <LazyChart ex={ex} />
      <footer>
        <a href={`#/code/${ex.id}`}>View code →</a>
      </footer>
    </article>
  );
}

export function Gallery({ focus }: { focus?: string }) {
  const [group, setGroup] = useState<string>('all');
  const [dim, setDim] = useState<Dim>('all');

  useEffect(() => {
    if (!focus) return;
    setGroup('all');
    setDim('all');
    // Wait a frame so the card exists after the filter reset.
    const r = requestAnimationFrame(() => {
      const el = document.getElementById(`ex-${focus}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('flash');
      setTimeout(() => el?.classList.remove('flash'), 1600);
    });
    return () => cancelAnimationFrame(r);
  }, [focus]);

  const match = (e: Example) =>
    (group === 'all' || e.group === group) && (dim === 'all' || (dim === 'large' ? !!e.scale : e.dim === dim));
  const list = EXAMPLES.filter(match);
  const groups = GROUPS.filter((g) => list.some((e) => e.group === g));
  const showLive = (group === 'all' || group === 'Trend') && (dim === 'all' || dim === '2D');
  const count = EXAMPLES.length + 1;
  const types = new Set(EXAMPLES.map((e) => e.type)).size;

  return (
    <>
      <section className="intro">
        <h1>Charts on one shared WebGL renderer</h1>
        <p>
          {count} live examples of {types} chart types, 2D and 3D, several with a million data points. Hover for values, click legend
          items to toggle series, drag to pan or orbit, and click a chart (or hold Ctrl/⌘) to zoom with the wheel.
        </p>
        <div className="filters" role="group" aria-label="Filter by category">
          {['all', ...GROUPS].map((g) => (
            <button key={g} className={group === g ? 'chip on' : 'chip'} aria-pressed={group === g} onClick={() => setGroup(g)}>
              {g === 'all' ? 'All' : g}
            </button>
          ))}
        </div>
        <div className="filters" role="group" aria-label="Filter by kind" style={{ marginTop: 8 }}>
          {(['all', '2D', '3D', 'large'] as Dim[]).map((d) => (
            <button key={d} className={dim === d ? 'chip on' : 'chip'} aria-pressed={dim === d} onClick={() => setDim(d)}>
              {d === 'all' ? 'Any size' : d === 'large' ? 'Large data' : d}
            </button>
          ))}
        </div>
      </section>

      {groups.map((g) => (
        <section key={g} className="group">
          <h2 className="group-title">
            {g} <span className="meta">{list.filter((e) => e.group === g).length + (g === 'Trend' && showLive ? 1 : 0)}</span>
          </h2>
          <div className="grid">
            {g === 'Trend' && showLive && (
              <article className="card" id="ex-live">
                <header>
                  <h3>Live streaming line</h3>
                  <span className="badge">2D</span>
                  <span className="badge accent">20 updates/s</span>
                </header>
                <p className="blurb">
                  Data pushed through <code>ref.update()</code> without re-rendering React.
                </p>
                <LiveChart />
                <footer>
                  <a href="#/code/live">View code →</a>
                </footer>
              </article>
            )}
            {list
              .filter((e) => e.group === g)
              .map((ex) => (
                <Card key={ex.id} ex={ex} />
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
