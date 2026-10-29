import { useState, useEffect } from 'react';
import { startAutoSync } from './services/sync';
import Today from './pages/Today';
import Exercises from './pages/Exercises';
import History from './pages/History';
import Settings from './pages/Settings';
import './App.css';

type Page = 'today' | 'exercises' | 'history' | 'settings';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'today',     label: 'Today',     icon: '🏋️' },
  { id: 'history',   label: 'History',   icon: '📊' },
  { id: 'exercises', label: 'Exercises', icon: '📋' },
  { id: 'settings',  label: 'Settings',  icon: '⚙️' },
];

export default function App() {
  const [page, setPage] = useState<Page>('today');
  // bumped when a sync brings in remote changes, to remount the page and reload its data
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    startAutoSync();
    const onChanged = () => setDataVersion(v => v + 1);
    window.addEventListener('gtg-data-changed', onChanged);
    return () => window.removeEventListener('gtg-data-changed', onChanged);
  }, []);

  return (
    <div className="app-shell">
      <main className="app-main" key={dataVersion}>
        {page === 'today'     && <Today />}
        {page === 'exercises' && <Exercises />}
        {page === 'history'   && <History />}
        {page === 'settings'  && <Settings />}
      </main>
      <nav className="app-nav">
        {NAV.map(n => (
          <button
            key={n.id}
            className={`app-nav-btn${page === n.id ? ' app-nav-btn--active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
