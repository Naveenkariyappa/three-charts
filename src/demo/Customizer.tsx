import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ChartOptions } from '../core';
import { ThreeChart } from '../react/ThreeChart';
import {
  DEFAULT_CUSTOM,
  DIVERGING,
  FONTS,
  SCALES,
  customOptions,
  defaultPalette,
  defaultUpDown,
  deltaE,
  flagsFor,
  resolvedMode,
  type Custom,
} from './customize';
import { buildOptions, type Example } from './examples';

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cz-row">
      <span className="cz-label">{label}</span>
      <div className="cz-ctl">{children}</div>
    </div>
  );
}

/** Re-render when the page theme changes, so "auto" previews and defaults follow it. */
function usePageMode(c: Custom) {
  const [, bump] = useState(0);
  useEffect(() => {
    const mo = new MutationObserver(() => bump((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => bump((n) => n + 1);
    mq.addEventListener('change', on);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', on);
    };
  }, []);
  return resolvedMode(c);
}

/** The example chart with the panel's options applied. */
export function CustomPreview({ ex, custom }: { ex: Example; custom: Custom }) {
  const [base, setBase] = useState<ChartOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePageMode(custom);

  useEffect(() => {
    let live = true;
    setBase(null);
    buildOptions(ex)
      .then((o) => live && setBase(o))
      .catch((e: unknown) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [ex]);

  const extra = useMemo(() => customOptions(custom, ex.type).values, [custom, ex.type]);
  const options = useMemo(() => (base ? ({ ...base, ...extra } as ChartOptions) : null), [base, extra]);
  const height = Math.max(ex.height ?? 360, 360);

  return (
    <div className="cz-preview">
      {error && <p className="meta">Couldn't build this example: {error}</p>}
      {options ? <ThreeChart height={height} {...options} /> : <div className="cz-loading" style={{ height }} />}
    </div>
  );
}

/** Controls for colors, legend, text and behavior. Only controls that change this chart type are shown. */
export function CustomPanel({ ex, custom, setCustom }: { ex: Example; custom: Custom; setCustom: (c: Custom) => void }) {
  const mode = usePageMode(custom);
  const f = flagsFor(ex.type);
  const set = <K extends keyof Custom>(k: K, v: Custom[K]) => setCustom({ ...custom, [k]: v });
  const palette = custom.colors ?? defaultPalette(mode);
  const close = palette.slice(1).flatMap((c, i) => (deltaE(palette[i], c) < 15 ? [i + 1] : []));
  const ud = defaultUpDown(mode);
  const changed = JSON.stringify(custom) !== JSON.stringify(DEFAULT_CUSTOM);

  return (
    <>
      <div className="cz-panel">
        <div className="cz-head">
          <h3>Customize</h3>
          <p className="meta">Changes apply to the chart and to the code. They carry over as you move between charts.</p>
        </div>
        <fieldset>
          <legend>Colors</legend>
          <Row label="Theme">
            <Seg label="Theme" value={custom.theme} onChange={(v) => set('theme', v)} options={[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} />
          </Row>
          {f.palette && (
            <Row label="Series">
              <div className="swatches">
                {palette.map((c, i) => (
                  <label key={i} className="swatch" title={`Series ${i + 1}: ${c}`}>
                    <input
                      type="color"
                      value={c}
                      aria-label={`Series ${i + 1} color`}
                      onChange={(e) => {
                        const next = [...palette];
                        next[i] = e.target.value;
                        set('colors', next);
                      }}
                    />
                    <span style={{ background: c }} />
                  </label>
                ))}
                {custom.colors && (
                  <button type="button" className="link" onClick={() => set('colors', null)}>
                    Default
                  </button>
                )}
              </div>
              {close.length > 0 && (
                <p className="cz-warn">
                  Series {close.map((i) => `${i} and ${i + 1}`).join(', ')} look alike. Pick colors that differ more in lightness or hue.
                </p>
              )}
            </Row>
          )}
          {f.scale && (
            <Row label="Color scale">
              <select value={custom.scale} onChange={(e) => set('scale', e.target.value)} aria-label="Color scale">
                {Object.entries(SCALES).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Row>
          )}
          {f.diverging && (
            <Row label="Diverging">
              <select value={custom.diverging} onChange={(e) => set('diverging', e.target.value)} aria-label="Diverging color scale">
                {Object.entries(DIVERGING).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Row>
          )}
          {f.updown && (
            <Row label="Up / down">
              <div className="swatches">
                <label className="swatch" title="Up / gain">
                  <input type="color" value={custom.positive ?? ud.positive} aria-label="Up color" onChange={(e) => set('positive', e.target.value)} />
                  <span style={{ background: custom.positive ?? ud.positive }} />
                </label>
                <label className="swatch" title="Down / loss">
                  <input type="color" value={custom.negative ?? ud.negative} aria-label="Down color" onChange={(e) => set('negative', e.target.value)} />
                  <span style={{ background: custom.negative ?? ud.negative }} />
                </label>
                {(custom.positive || custom.negative) && (
                  <button type="button" className="link" onClick={() => setCustom({ ...custom, positive: null, negative: null })}>
                    Default
                  </button>
                )}
              </div>
            </Row>
          )}
          <Row label="Background">
            <div className="swatches">
              <label className="check">
                <input type="checkbox" checked={!custom.background} onChange={(e) => set('background', e.target.checked ? null : mode === 'dark' ? '#1a1a19' : '#ffffff')} />
                Transparent
              </label>
              {custom.background && (
                <label className="swatch">
                  <input type="color" value={custom.background} aria-label="Background color" onChange={(e) => set('background', e.target.value)} />
                  <span style={{ background: custom.background }} />
                </label>
              )}
            </div>
          </Row>
        </fieldset>

        {f.legend && (
          <fieldset>
            <legend>Legend</legend>
            <Row label="Show">
              <Seg label="Show legend" value={custom.legend} onChange={(v) => set('legend', v)} options={[['auto', 'Auto'], ['on', 'Always'], ['off', 'Hidden']]} />
            </Row>
            {custom.legend !== 'off' && (
              <>
                <Row label="Position">
                  <Seg
                    label="Legend position"
                    value={custom.position}
                    onChange={(v) => set('position', v)}
                    options={[['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']]}
                  />
                </Row>
                <Row label="Align">
                  <Seg label="Legend alignment" value={custom.align} onChange={(v) => set('align', v)} options={[['start', 'Start'], ['center', 'Center'], ['end', 'End']]} />
                </Row>
                <Row label="Marker">
                  <Seg label="Legend marker" value={custom.marker} onChange={(v) => set('marker', v)} options={[['square', 'Square'], ['circle', 'Circle'], ['line', 'Line']]} />
                </Row>
                <Row label="Click">
                  <label className="check">
                    <input type="checkbox" checked={custom.toggle} onChange={(e) => set('toggle', e.target.checked)} />
                    Click an item to hide its series
                  </label>
                </Row>
              </>
            )}
          </fieldset>
        )}

        <fieldset>
          <legend>Text</legend>
          <Row label="Title">
            <input type="text" value={custom.title} placeholder="None" onChange={(e) => set('title', e.target.value)} aria-label="Chart title" />
          </Row>
          <Row label="Font">
            <select value={custom.font} onChange={(e) => set('font', e.target.value)} aria-label="Font">
              {Object.entries(FONTS).map(([k, [label]]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Label size">
            <input type="range" min={9} max={15} value={custom.fontSize} onChange={(e) => set('fontSize', Number(e.target.value))} aria-label="Label size" />
            <span className="meta">{custom.fontSize}px</span>
          </Row>
        </fieldset>

        <fieldset>
          <legend>Behavior</legend>
          <div className="checks">
            <label className="check">
              <input type="checkbox" checked={custom.tooltip} onChange={(e) => set('tooltip', e.target.checked)} />
              Tooltip
            </label>
            <label className="check">
              <input type="checkbox" checked={custom.animate} onChange={(e) => set('animate', e.target.checked)} />
              Entry animation
            </label>
            {f.cartesian && (
              <label className="check">
                <input type="checkbox" checked={custom.grid} onChange={(e) => set('grid', e.target.checked)} />
                Grid lines
              </label>
            )}
          </div>
        </fieldset>

        <button type="button" className="btn small" disabled={!changed} onClick={() => setCustom(DEFAULT_CUSTOM)}>
          Reset all
        </button>
      </div>
    </>
  );
}
