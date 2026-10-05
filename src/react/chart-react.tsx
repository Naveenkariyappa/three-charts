'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import type { CommonOptions, HitInfo } from '../core/types';

/** What every chart class provides. */
export interface ChartInstance<O> {
  update(options: Partial<O>): void;
  resetView(): void;
  toPNG(): string;
  destroy(): void;
}

/** The ref of a chart component. */
export interface ChartHandle<O, C = ChartInstance<O>> {
  /** Merge new options and redraw (no React re-render). */
  update(options: Partial<Omit<O, 'type'>>): void;
  /** Reset zoom / camera. */
  resetView(): void;
  /** PNG data URL of the chart. */
  toPNG(): string;
  /** The underlying chart instance, or null before mount. */
  chart(): C | null;
}

/** The box a chart renders into. */
export interface BoxProps {
  /** Chart height. The chart fills its box. Default 320. */
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

/** A chart's options (without `type`) plus the box it renders into. */
export type ChartProps<O> = Omit<O, 'type'> & BoxProps;

/** Callbacks change on every render; they must not count as an options change. */
function optionsChanged(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    if (typeof next[k] === 'function' || typeof prev[k] === 'function') continue;
    if (prev[k] !== next[k]) return true;
  }
  return false;
}

/**
 * Wrap a chart class as a React component. Options are compared by reference,
 * so build big arrays once (useMemo) to avoid re-uploading data on unrelated renders.
 */
export function chartComponent<O extends CommonOptions & { type: string }, C extends ChartInstance<O>>(
  Ctor: new (container: HTMLElement, options: O) => C,
  type: O['type'],
  displayName: string,
): ForwardRefExoticComponent<ChartProps<O> & RefAttributes<ChartHandle<O, C>>> {
  const Component = forwardRef<ChartHandle<O, C>, ChartProps<O>>(function Chart(props, ref) {
    const { height = 320, className, style, ...rest } = props as BoxProps & Record<string, unknown>;
    const options = rest as unknown as Omit<O, 'type'>;
    const el = useRef<HTMLDivElement>(null);
    const chart = useRef<C | null>(null);
    const latest = useRef(options);
    const applied = useRef(options);
    latest.current = options;

    // Handlers always call the latest props without rebuilding the chart.
    const resolved = (o: Omit<O, 'type'>) =>
      ({
        ...o,
        type,
        onClick: (hit: HitInfo) => (latest.current as CommonOptions).onClick?.(hit),
        onHover: (hit: HitInfo | null) => (latest.current as CommonOptions).onHover?.(hit),
      }) as unknown as O;

    useEffect(() => {
      chart.current = new Ctor(el.current!, resolved(latest.current));
      applied.current = latest.current;
      return () => {
        chart.current?.destroy();
        chart.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (chart.current && optionsChanged(applied.current as Record<string, unknown>, options as Record<string, unknown>)) {
        chart.current.update(resolved(options));
        applied.current = options;
      }
    });

    useImperativeHandle(
      ref,
      () => ({
        update: (o) => chart.current?.update(o as Partial<O>),
        resetView: () => chart.current?.resetView(),
        toPNG: () => chart.current?.toPNG() ?? '',
        chart: () => chart.current,
      }),
      [],
    );

    return <div ref={el} className={className} style={{ height, position: 'relative', ...style }} />;
  });
  Component.displayName = displayName;
  return Component as unknown as ForwardRefExoticComponent<ChartProps<O> & RefAttributes<ChartHandle<O, C>>>;
}
