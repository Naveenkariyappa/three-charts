import { useEffect, useRef, useState } from 'react';
import { LineChart, type ChartHandle } from '../react/ThreeChart';

const WINDOW = 600;
// Module-level so re-renders (e.g. the pause toggle) don't look like new options.
const Y_AXIS = { label: 'Usage (%)', min: 0, max: 100 };
const BENCH_LEGEND = { position: 'top', align: 'end', marker: 'line' } as const;
const EMPTY = [
  { name: 'CPU', y: [] },
  { name: 'Memory', y: [] },
];

const cpuAt = (t: number) => 50 + Math.sin(t / 15) * 20 + (Math.random() - 0.5) * 6;
const memAt = (t: number) => 40 + Math.cos(t / 23) * 15 + (Math.random() - 0.5) * 6;

/** A window that is already full, so the stream opens mid-flow rather than climbing from zero. */
function filledWindow() {
  const s = { t: WINDOW, a: new Float32Array(WINDOW), b: new Float32Array(WINDOW), x: new Float64Array(WINDOW) };
  for (let i = 0; i < WINDOW; i++) {
    s.x[i] = i + 1;
    s.a[i] = cpuAt(i + 1);
    s.b[i] = memAt(i + 1);
  }
  return s;
}

/** Streams two signals at 20 updates/second through `ref.update()`. `bench` adds a live readout of the latest values. */
export function LiveChart({ height = 320, bench = false }: { height?: number; bench?: boolean }) {
  const ref = useRef<ChartHandle>(null);
  const cpuEl = useRef<HTMLElement>(null);
  const memEl = useRef<HTMLElement>(null);
  const [running, setRunning] = useState(true);
  const state = useRef<ReturnType<typeof filledWindow> | null>(null);
  state.current ??= filledWindow();

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = state.current!;
      // Shift the window left by one and append the newest sample.
      s.a.copyWithin(0, 1);
      s.b.copyWithin(0, 1);
      s.x.copyWithin(0, 1);
      s.t++;
      s.x[WINDOW - 1] = s.t;
      s.a[WINDOW - 1] = cpuAt(s.t);
      s.b[WINDOW - 1] = memAt(s.t);
      // Readouts are written directly, so 20 ticks a second never re-render React.
      if (cpuEl.current) cpuEl.current.textContent = s.a[WINDOW - 1].toFixed(1) + '%';
      if (memEl.current) memEl.current.textContent = s.b[WINDOW - 1].toFixed(1) + '%';
      ref.current?.update({
        series: [
          { name: 'CPU', x: s.x, y: s.a },
          { name: 'Memory', x: s.x, y: s.b },
        ],
      });
    }, 50);
    return () => clearInterval(id);
  }, [running]);

  if (bench) {
    return (
      <div className="bench">
        <div className="readout">
          <span>
            CPU<b ref={cpuEl}>–</b>
          </span>
          <span>
            Memory<b ref={memEl}>–</b>
          </span>
          <span className={running ? 'live' : 'live paused'}>{running ? 'Live · 20 Hz' : 'Paused'}</span>
        </div>
        <LineChart ref={ref} height={height} animate={false} zoom={false} yAxis={Y_AXIS} series={EMPTY} legend={BENCH_LEGEND} />
        <div className="bench-foot">
          <span>600-sample window · ref.update() · no React re-render</span>
          <button className="btn small" onClick={() => setRunning((r) => !r)}>
            {running ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <LineChart
        ref={ref}
        height={height}
        animate={false}
        zoom={false}
        yAxis={Y_AXIS}
        series={EMPTY}
      />
      <button className="btn" onClick={() => setRunning((r) => !r)}>
        {running ? 'Pause stream' : 'Resume stream'}
      </button>
    </div>
  );
}

export const LIVE_SNIPPETS = {
  js: `import { createLineChart } from './charts/line-chart.js';

const WINDOW = 600;
const x = new Float64Array(WINDOW);
const cpu = new Float32Array(WINDOW);
let t = 0;

const chart = createLineChart(document.getElementById('chart'), {
  animate: false,
  zoom: false,
  yAxis: { label: 'Usage (%)', min: 0, max: 100 },
  series: [{ name: 'CPU', y: [] }],
});

setInterval(() => {
  // Shift the window and append the newest sample.
  x.copyWithin(0, 1);
  cpu.copyWithin(0, 1);
  x[WINDOW - 1] = ++t;
  cpu[WINDOW - 1] = 50 + Math.sin(t / 15) * 20 + (Math.random() - 0.5) * 6;
  chart.update({ series: [{ name: 'CPU', x, y: cpu }] });
}, 50);
`,
  jsx: `import { useEffect, useRef } from 'react';
import { LineChart } from '@/components/charts/line-chart';

const WINDOW = 600;

export default function LiveCpu() {
  const ref = useRef(null);
  const buf = useRef({ t: 0, x: new Float64Array(WINDOW), y: new Float32Array(WINDOW) });

  useEffect(() => {
    const id = setInterval(() => {
      const b = buf.current;
      b.x.copyWithin(0, 1);
      b.y.copyWithin(0, 1);
      b.x[WINDOW - 1] = ++b.t;
      b.y[WINDOW - 1] = 50 + Math.sin(b.t / 15) * 20 + (Math.random() - 0.5) * 6;
      // Imperative update: no React re-render per frame.
      ref.current?.update({ series: [{ name: 'CPU', x: b.x, y: b.y }] });
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <LineChart
      ref={ref}
      height={320}
      animate={false}
      zoom={false}
      yAxis={{ label: 'Usage (%)', min: 0, max: 100 }}
      series={[{ name: 'CPU', y: [] }]}
    />
  );
}
`,
  tsx: `import { useEffect, useRef } from 'react';
import { LineChart, type LineChartHandle } from '@/components/charts/line-chart';

const WINDOW = 600;

export default function LiveCpu() {
  const ref = useRef<LineChartHandle>(null);
  const buf = useRef({ t: 0, x: new Float64Array(WINDOW), y: new Float32Array(WINDOW) });

  useEffect(() => {
    const id = setInterval(() => {
      const b = buf.current;
      b.x.copyWithin(0, 1);
      b.y.copyWithin(0, 1);
      b.x[WINDOW - 1] = ++b.t;
      b.y[WINDOW - 1] = 50 + Math.sin(b.t / 15) * 20 + (Math.random() - 0.5) * 6;
      // Imperative update: no React re-render per frame.
      ref.current?.update({ series: [{ name: 'CPU', x: b.x, y: b.y }] });
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <LineChart
      ref={ref}
      height={320}
      animate={false}
      zoom={false}
      yAxis={{ label: 'Usage (%)', min: 0, max: 100 }}
      series={[{ name: 'CPU', y: [] }]}
    />
  );
}
`,
  ts: `import { createLineChart } from './charts/line-chart';

const WINDOW = 600;
const x = new Float64Array(WINDOW);
const cpu = new Float32Array(WINDOW);
let t = 0;

const chart = createLineChart(document.getElementById('chart')!, {
  animate: false,
  zoom: false,
  yAxis: { label: 'Usage (%)', min: 0, max: 100 },
  series: [{ name: 'CPU', y: [] }],
});

setInterval(() => {
  // Shift the window and append the newest sample.
  x.copyWithin(0, 1);
  cpu.copyWithin(0, 1);
  x[WINDOW - 1] = ++t;
  cpu[WINDOW - 1] = 50 + Math.sin(t / 15) * 20 + (Math.random() - 0.5) * 6;
  chart.update({ series: [{ name: 'CPU', x, y: cpu }] });
}, 50);
`,
};
