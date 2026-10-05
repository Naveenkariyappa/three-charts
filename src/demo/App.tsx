import { useEffect, useState } from 'react';
import { CodePage } from './CodePage';
import { DocsPage } from './DocsPage';
import { COMPONENT } from './examples';
import { Gallery } from './Gallery';
import { Sidebar } from './Sidebar';

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
}

type Theme = 'light' | 'dark';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('tc-theme');
    } catch {
      /* storage unavailable */
    }
    if (saved === 'light' || saved === 'dark') return saved;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('tc-theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export function App() {
  const hash = useHash();
  const [theme, toggle] = useTheme();
  const [menu, setMenu] = useState(false);
  const [path, query] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const page = parts[0] ?? '';
  const focus = new URLSearchParams(query).get('focus') ?? undefined;
  const isCode = page === 'code';
  const current = isCode ? (parts[1] ?? 'setup') : page === 'docs' ? 'docs' : 'overview';

  useEffect(() => {
    if (isCode || page === 'docs') window.scrollTo(0, 0);
    setMenu(false);
  }, [page, parts[1]]);

  return (
    <>
      <header className="top">
        <button className="menu-btn" aria-label="Show charts" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <a className="brand" href="#/">
          three-charts
        </a>
        <span className="top-meta">{Object.keys(COMPONENT).length} chart types · copy, don’t install</span>
        <nav className="top-links">
          <a href="#/docs" className={page === 'docs' ? 'on' : ''}>
            Guide
          </a>
          <a href="vanilla.html">Plain HTML demo</a>
          <a href="https://github.com/Naveenkariyappa/three-charts">GitHub</a>
        </nav>
        <button className="btn small" onClick={toggle} aria-label="Toggle color theme">
          {theme === 'dark' ? '☀︎ Light' : '☾ Dark'}
        </button>
      </header>
      <div className="shell">
        <Sidebar current={current} open={menu} onNavigate={() => setMenu(false)} />
        {menu && <div className="scrim" onClick={() => setMenu(false)} />}
        <main className="main">
          {/* Unknown pages (including the hidden #/catalog) show the overview. */}
          {!isCode && page !== 'docs' && <Gallery focus={focus} />}
          {isCode && <CodePage id={parts[1]} />}
          {page === 'docs' && <DocsPage />}
        </main>
      </div>
    </>
  );
}
