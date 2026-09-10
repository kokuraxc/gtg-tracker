import { useState } from 'react';
import './Today.css';

interface LoggedSet {
  id: number;
  reps: number;
  timestamp: Date;
}

export default function Today() {
  const [reps, setReps] = useState(5);
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [justLogged, setJustLogged] = useState(false);

  const totalReps = sets.reduce((sum, s) => sum + s.reps, 0);

  function logSet() {
    setSets(prev => [...prev, { id: Date.now(), reps, timestamp: new Date() }]);
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1500);
  }

  function formatTime(date: Date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="today">
      <h2 className="today-title">Today</h2>

      <div className="exercise-card">
        <div className="exercise-name">Pull-up</div>
        <div className="exercise-target">Target: {reps} reps</div>

        <div className="rep-counter">
          <button className="rep-btn" onClick={() => setReps(r => Math.max(1, r - 1))}>−</button>
          <span className="rep-value">{reps}</span>
          <button className="rep-btn" onClick={() => setReps(r => r + 1)}>+</button>
        </div>

        <button
          className={`log-btn ${justLogged ? 'log-btn--success' : ''}`}
          onClick={logSet}
        >
          {justLogged ? '✓ Logged!' : 'LOG SET'}
        </button>
      </div>

      {sets.length > 0 && (
        <div className="sets-section">
          <div className="sets-header">
            <span>Today's sets</span>
            <span className="sets-summary">{sets.length} sets · {totalReps} reps</span>
          </div>
          <ul className="sets-list">
            {sets.map((s, i) => (
              <li key={s.id} className="set-item">
                <span className="set-number">Set {i + 1}</span>
                <span className="set-time">{formatTime(s.timestamp)}</span>
                <span className="set-reps">{s.reps} reps</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sets.length === 0 && (
        <p className="no-sets">No sets logged yet today.</p>
      )}
    </div>
  );
}
