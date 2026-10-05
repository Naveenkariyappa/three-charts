import { useEffect, useState } from 'react';
import { CatalogPage } from './CatalogPage';
import { CodePage } from './CodePage';
import { DocsPage } from './DocsPage';
import { Gallery } from './Gallery';

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
  const [path, query] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const page = parts[0] ?? '';
  const focus = new URLSearchParams(query).get('focus') ?? undefined;

  useEffect(() => {
    if (page === 'code' || page === 'docs') window.scrollTo(0, 0);
  }, [page, parts[1]]);

  const link = (href: string, label: string, active: boolean) => (
    <a href={href} className={active ? 'on' : ''} aria-current={active ? 'page' : undefined}>
      {label}
    </a>
  );

  return (
    <>
      <header className="top">
        <a className="brand" href="#/">
          three-charts
        </a>
        <nav>
          {link('#/', 'Demo', page === '')}
          {link('#/docs', 'Docs', page === 'docs')}
          {link('#/code', 'Code', page === 'code')}
          {link('#/catalog', 'Catalog', page === 'catalog')}
          <a href="vanilla.html">Vanilla page</a>
        </nav>
        <button className="btn small" onClick={toggle} aria-label="Toggle color theme">
          {theme === 'dark' ? '☀︎ Light' : '☾ Dark'}
        </button>
      </header>
      <div className="page">
        {page === '' && <Gallery focus={focus} />}
        {page === 'code' && <CodePage id={parts[1]} />}
        {page === 'catalog' && <CatalogPage />}
        {page === 'docs' && <DocsPage />}
      </div>
    </>
  );
}
