import { useState } from 'react';
import { chartTypes } from '../core';
import { CATALOG, LIBRARIES } from './catalog';

type Cost = 'all' | 'Free' | 'Paid';

export function CatalogPage() {
  const [cost, setCost] = useState<Cost>('all');
  const total = CATALOG.reduce((n, g) => n + g.items.length, 0);
  const built = CATALOG.reduce((n, g) => n + g.items.filter((i) => i.demo).length, 0);
  const libs = LIBRARIES.filter((l) => cost === 'all' || (cost === 'Free' ? l.cost !== 'Paid' : l.cost !== 'Free'));

  return (
    <div className="catalog">
      <section className="intro">
        <h1>Chart types in the market</h1>
        <p>
          {total} chart types collected from the major free and paid libraries, grouped by the job they do.{' '}
          <strong>{built}</strong> are covered by this library's {chartTypes.length} chart components (some through
          options such as <code>stacked</code>, <code>horizontal</code> or <code>smooth</code>). {total - built ? `${total - built} left out on purpose.` : ''}
        </p>
      </section>

      <div className="cat-grid">
        {CATALOG.map((g) => (
          <section key={g.group} className="card">
            <header>
              <h2>{g.group}</h2>
              <span className="meta">{g.purpose}</span>
            </header>
            <ul className="cat-list">
              {g.items.map((it) => (
                <li key={it.name}>
                  <span className="cat-name">
                    {it.name}
                    {it.note && <span className="meta"> — {it.note}</span>}
                  </span>
                  <span className="badge">{it.dim}</span>
                  {it.demo ? (
                    <a className="status built" href={it.demo === 'live' ? '#/code/live' : `#/?focus=${it.demo}`}>
                      ✓ Built
                    </a>
                  ) : (
                    <span className="status">{it.note?.startsWith('Not built') ? 'Avoided' : 'Roadmap'}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="libs">
        <h2>Charting libraries</h2>
        <p className="meta">Licences change; check the vendor's site before you choose.</p>
        <div className="filters" role="group" aria-label="Filter by cost">
          {(['all', 'Free', 'Paid'] as Cost[]).map((c) => (
            <button key={c} className={cost === c ? 'chip on' : 'chip'} aria-pressed={cost === c} onClick={() => setCost(c)}>
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Library</th>
                <th>Cost</th>
                <th>Licence</th>
                <th>Rendering</th>
                <th>3D</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {libs.map((l) => (
                <tr key={l.name}>
                  <td>
                    <strong>{l.name}</strong>
                  </td>
                  <td>
                    <span className={l.cost === 'Paid' ? 'badge' : 'badge accent'}>{l.cost}</span>
                  </td>
                  <td>{l.license}</td>
                  <td>{l.tech}</td>
                  <td>{l.threeD ? 'Yes' : '—'}</td>
                  <td className="meta">{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
