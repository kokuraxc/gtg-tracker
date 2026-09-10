import { useState } from 'react';
import Today from './pages/Today';
import Exercises from './pages/Exercises';
import History from './pages/History';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import './App.css';

type Page = 'today' | 'exercises' | 'history' | 'statistics' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('today');

  const nav: { id: Page; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'exercises', label: 'Exercises' },
    { id: 'history', label: 'History' },
    { id: 'statistics', label: 'Stats' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <main style={{ padding: '1rem' }}>
        {page === 'today' && <Today />}
        {page === 'exercises' && <Exercises />}
        {page === 'history' && <History />}
        {page === 'statistics' && <Statistics />}
        {page === 'settings' && <Settings />}
      </main>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        display: 'flex', background: '#fff', borderTop: '1px solid #ddd',
        maxWidth: 480, margin: '0 auto',
      }}>
        {nav.map(n => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            style={{
              flex: 1, padding: '0.75rem 0', border: 'none', background: 'none',
              fontWeight: page === n.id ? 'bold' : 'normal',
              color: page === n.id ? '#007aff' : '#555',
              cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
