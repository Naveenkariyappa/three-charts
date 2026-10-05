/** Docs page "Use it" examples, one per language. Compile-checked along with the Code page snippets. */
export const DOC_EXAMPLES = {
  'react-ts': {
    file: 'Revenue.tsx',
    code: `import { useMemo, useRef } from 'react';
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
`,
  },
  'react-js': {
    file: 'Revenue.jsx',
    code: `import { useMemo, useRef } from 'react';
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
`,
  },
  ts: {
    file: 'main.ts',
    code: `import { createBarChart, type BarOptions } from './charts/bar-chart';

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
`,
  },
  js: {
    file: 'main.js',
    code: `import { createBarChart } from './charts/bar-chart.js';

// The container needs a height; the chart fills it.
const chart = createBarChart(document.getElementById('chart'), {
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{ name: 'Revenue', data: [42, 51, 48, 63] }],
  yAxis: { label: 'Revenue ($M)' },
  onClick: (hit) => console.log(hit.series, hit.values),
});

chart.update({ series: [{ name: 'Revenue', data: [50, 55, 60, 70] }] }); // new data
chart.destroy(); // when removing it
`,
  },
} as const;
