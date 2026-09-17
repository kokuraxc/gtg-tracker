import { useState } from 'react';
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

  return (
    <div className="app-shell">
      <main className="app-main">
        {page === 'today'     && <Today />}
        {page === 'exercises' && <Exercises />}
        {page === 'history'   && <History />}
        {page === 'settings'  && <Settings />}
      </main>
      <div className="app-nav-backdrop" />
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
