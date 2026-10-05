import { useEffect, useMemo, useRef, useState } from 'react';
import { EXAMPLES } from './examples';
import { GROUPS } from './examples2';

/** Every navigable page, in sidebar order. Shared with the chart page's previous / next links. */
export const PAGES: { id: string; title: string; group: string }[] = GROUPS.flatMap((g) => [
  ...(g === 'Trend' ? [{ id: 'live', title: 'Live streaming line', group: g }] : []),
  ...EXAMPLES.filter((e) => e.group === g).map((e) => ({ id: e.id, title: e.title, group: g })),
]);

/** Everyday words people search with, per category. */
const KEYWORDS: Record<string, string> = {
  Comparison: 'compare ranking column',
  Trend: 'time series over time history',
  Distribution: 'spread statistics outliers',
  'Part-to-whole': 'share percent proportion',
  Hierarchy: 'tree nested org',
  Relationship: 'correlation xy',
  Network: 'graph nodes links',
  'Flow & time': 'schedule project timeline process',
  KPI: 'dashboard metric single number progress',
  'Machine learning': 'ml model classification evaluation ai',
  Financial: 'stock price trading market finance crypto',
  Geo: 'map country world location',
  '3D & scientific': 'three dimensional science physics',
};

const GUIDE: [href: string, label: string, key: string][] = [
  ['#/', 'Overview', 'overview'],
  ['#/docs', 'How to use the charts', 'docs'],
  ['#/code/setup', 'Install the shared files', 'setup'],
];

/**
 * The app's one navigation: guides at the top, then every chart by category, filterable.
 * `current` is the active page key ('overview', 'docs', 'setup' or a chart id).
 */
export function Sidebar({ current, open, onNavigate }: { current: string; open: boolean; onNavigate: () => void }) {
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLElement>(null);

  // "/" focuses the filter from anywhere, as in most docs sites.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);

  // Keep the active chart visible when arriving from a link elsewhere.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('a.on')?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const match = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    const types = new Map(EXAMPLES.map((e) => [e.id, `${e.type} ${e.blurb}`]));
    return new Set(
      PAGES.filter((p) => {
        const hay = `${p.title} ${p.group} ${KEYWORDS[p.group] ?? ''} ${types.get(p.id) ?? 'stream realtime telemetry'}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      }).map((p) => p.id),
    );
  }, [q]);

  const visible = (id: string) => !match || match.has(id);
  const groups = GROUPS.map((g) => ({ g, pages: PAGES.filter((p) => p.group === g && visible(p.id)) })).filter((x) => x.pages.length);

  return (
    <nav className={open ? 'sidebar open' : 'sidebar'} aria-label="Charts and guides" ref={list}>
      <div className="sb-search">
        <input
          ref={input}
          type="search"
          value={q}
          placeholder={`Find among ${PAGES.length} charts`}
          aria-label="Find a chart"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && match?.size) {
              location.hash = `#/code/${[...match][0]}`;
              setQ('');
              onNavigate();
            }
            if (e.key === 'Escape') setQ('');
          }}
        />
        <kbd aria-hidden="true">/</kbd>
      </div>

      {!match && (
        <div className="sb-section">
          {GUIDE.map(([href, label, key]) => (
            <a key={key} href={href} className={current === key ? 'on' : ''} aria-current={current === key ? 'page' : undefined} onClick={onNavigate}>
              {label}
            </a>
          ))}
        </div>
      )}

      {groups.map(({ g, pages }) => (
        <div key={g} className="sb-section">
          <div className="sb-group">
            <span>{g}</span>
            <span>{pages.length}</span>
          </div>
          {pages.map((p) => (
            <a
              key={p.id}
              href={`#/code/${p.id}`}
              className={current === p.id ? 'on' : ''}
              aria-current={current === p.id ? 'page' : undefined}
              onClick={onNavigate}
            >
              {p.title}
            </a>
          ))}
        </div>
      ))}
      {match && match.size === 0 && <p className="sb-empty">No chart matches “{q}”. Try a shape (pie, line) or a use (stock, map, network).</p>}
    </nav>
  );
}
