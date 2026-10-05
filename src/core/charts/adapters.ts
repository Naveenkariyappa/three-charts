import { HeatmapChart } from './heatmap';
import { formatNumber } from '../scale';
import type { HeatmapOptions } from '../types';
import type { AdjacencyOptions, SpectrogramOptions } from '../types2';

/** Adjacency matrix: nodes on both axes, link weight in each cell. Symmetric for undirected links. */
export function adjacencyToHeatmap(o: AdjacencyOptions): HeatmapOptions {
  // Order nodes by group so communities form visible blocks.
  const nodes = [...o.nodes].sort((a, b) => (a.group ?? 0) - (b.group ?? 0));
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const n = nodes.length;
  const data = new Float32Array(n * n);
  for (const l of o.links) {
    const a = idx.get(l.source);
    const b = idx.get(l.target);
    if (a === undefined || b === undefined) continue;
    data[a * n + b] += l.value ?? 1;
    data[b * n + a] += l.value ?? 1;
  }
  const labels = nodes.map((x) => x.name ?? x.id);
  return { ...o, type: 'heatmap', data, rows: n, cols: n, xLabels: labels, yLabels: labels, zoom: 'xy' };
}

/** Spectrogram: time on x, frequency on y (low at the bottom), power as color. */
export function spectrogramToHeatmap(o: SpectrogramOptions): HeatmapOptions {
  const { rows, cols, data } = o;
  // Heatmap rows run top-down; spectra put low frequencies at the bottom.
  const flipped = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) flipped.set(Array.from({ length: cols }, (_, c) => data[r * cols + c]), (rows - 1 - r) * cols);
  const dur = o.duration ?? cols;
  const fmax = o.maxFrequency ?? rows;
  const hz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} kHz` : `${Math.round(v)} Hz`);
  const sec = (v: number) => `${Number(v.toPrecision(3))}s`;
  const xLabels = Array.from({ length: cols }, (_, c) => {
    const v = (c / Math.max(1, cols - 1)) * dur;
    return o.duration ? sec(v) : formatNumber(Math.round(v));
  });
  const yLabels = Array.from({ length: rows }, (_, r) => {
    const v = ((rows - 1 - r) / Math.max(1, rows - 1)) * fmax;
    return o.maxFrequency ? hz(v) : formatNumber(Math.round(v));
  });
  return { ...o, type: 'heatmap', data: flipped, rows, cols, xLabels, yLabels, zoom: 'xy' };
}

export class AdjacencyChart extends HeatmapChart {
  readonly type = 'adjacency' as const;
  private raw: AdjacencyOptions;

  constructor(container: HTMLElement, options: AdjacencyOptions) {
    super(container, adjacencyToHeatmap(options));
    this.raw = options;
  }

  // @ts-expect-error -- takes this chart's own options, not the heatmap it renders through.
  update(options: Partial<AdjacencyOptions>) {
    this.raw = { ...this.raw, ...options };
    super.update(adjacencyToHeatmap(this.raw));
  }
}

export class SpectrogramChart extends HeatmapChart {
  readonly type = 'spectrogram' as const;
  private raw: SpectrogramOptions;

  constructor(container: HTMLElement, options: SpectrogramOptions) {
    super(container, spectrogramToHeatmap(options));
    this.raw = options;
  }

  // @ts-expect-error -- takes this chart's own options, not the heatmap it renders through.
  update(options: Partial<SpectrogramOptions>) {
    this.raw = { ...this.raw, ...options };
    super.update(spectrogramToHeatmap(this.raw));
  }
}
