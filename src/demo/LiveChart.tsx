import { useEffect, useRef, useState } from 'react';
import { LineChart, type ChartHandle } from '../react/ThreeChart';

const WINDOW = 600;
// Module-level so re-renders (e.g. the pause toggle) don't look like new options.
const Y_AXIS = { label: 'Usage (%)', min: 0, max: 100 };
const EMPTY = [
  { name: 'CPU', y: [] },
  { name: 'Memory', y: [] },
];

/** Streams two signals at 20 updates/second through `ref.update()`. */
export function LiveChart({ height = 320 }: { height?: number }) {
  const ref = useRef<ChartHandle>(null);
  const [running, setRunning] = useState(true);
  const state = useRef({ t: 0, a: new Float32Array(WINDOW), b: new Float32Array(WINDOW), x: new Float64Array(WINDOW) });

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = state.current;
      // Shift the window left by one and append the newest sample.
      s.a.copyWithin(0, 1);
      s.b.copyWithin(0, 1);
      s.x.copyWithin(0, 1);
      s.t++;
      s.x[WINDOW - 1] = s.t;
      s.a[WINDOW - 1] = 50 + Math.sin(s.t / 15) * 20 + (Math.random() - 0.5) * 6;
      s.b[WINDOW - 1] = 40 + Math.cos(s.t / 23) * 15 + (Math.random() - 0.5) * 6;
      ref.current?.update({
        series: [
          { name: 'CPU', x: s.x, y: s.a },
          { name: 'Memory', x: s.x, y: s.b },
        ],
      });
    }, 50);
    return () => clearInterval(id);
  }, [running]);

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
