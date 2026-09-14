import { useState, useRef } from 'react';
import { db } from '../db/database';
import './Settings.css';

type Status = { type: 'success' | 'error'; message: string } | null;
type Theme = 'system' | 'light' | 'dark';

function applyTheme(t: Theme) {
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('gtg-theme', t);
}

export default function Settings() {
  const [defaultReps, setDefaultReps] = useState(5);
  const [gtgInterval, setGtgInterval] = useState(60);
  const [maxSets, setMaxSets] = useState(6);
  const [reminders, setReminders] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('gtg-theme') as Theme) ?? 'system'
  );

  function handleTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }
  const importRef = useRef<HTMLInputElement>(null);

  function showStatus(type: 'success' | 'error', message: string) {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3000);
  }

  // ── Export ──────────────────────────────────────────────────
  async function exportData() {
    try {
      const [exercises, sessions, sets] = await Promise.all([
        db.exercises.toArray(),
        db.sessions.toArray(),
        db.sets.toArray(),
      ]);
      const payload = { version: 1, exportedAt: new Date().toISOString(), exercises, sessions, sets };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtg-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('success', 'Data exported successfully.');
    } catch {
      showStatus('error', 'Export failed.');
    }
  }

  // ── Export CSV ─────────────────────────────────────────────
  async function exportCSV() {
    try {
      const [exercises, sessions, sets] = await Promise.all([
        db.exercises.toArray(),
        db.sessions.toArray(),
        db.sets.toArray(),
      ]);

      const exerciseMap = Object.fromEntries(exercises.map(e => [e.id, e]));
      const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));

      const rows: string[][] = [['Date', 'Time', 'Exercise', 'Set #', 'Value', 'Unit']];

      const sorted = [...sets].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      for (const set of sorted) {
        const session = sessionMap[set.sessionId];
        const exercise = session ? exerciseMap[session.exerciseId] : undefined;
        const ts = new Date(set.timestamp);
        const date = ts.toLocaleDateString();
        const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const name = exercise?.name ?? 'Unknown';
        let value = '';
        let unit = '';
        if (set.reps != null)     { value = String(set.reps);     unit = 'reps'; }
        else if (set.duration != null) { value = String(set.duration); unit = exercise?.durationUnit ?? 'sec'; }
        else if (set.distance != null) { value = String(set.distance); unit = 'km'; }
        rows.push([date, time, name, String(set.setNumber), value, unit]);
      }

      const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtg-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('success', `Exported ${sets.length} sets as CSV.`);
    } catch {
      showStatus('error', 'CSV export failed.');
    }
  }

  // ── Import ──────────────────────────────────────────────────
  function triggerImport() {
    importRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-imported

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.exercises || !data.sessions || !data.sets) {
        showStatus('error', 'Invalid backup file.');
        return;
      }

      if (!confirm(`Import ${data.exercises.length} exercises, ${data.sessions.length} sessions, and ${data.sets.length} sets? Existing data will be replaced.`)) return;

      await db.transaction('rw', db.exercises, db.sessions, db.sets, async () => {
        await db.exercises.clear();
        await db.sessions.clear();
        await db.sets.clear();
        await db.exercises.bulkAdd(data.exercises);
        await db.sessions.bulkAdd(data.sessions);
        await db.sets.bulkAdd(data.sets);
      });

      showStatus('success', `Imported ${data.sets.length} sets across ${data.exercises.length} exercises.`);
    } catch {
      showStatus('error', 'Import failed — file may be corrupt.');
    }
  }

  // ── Delete all ──────────────────────────────────────────────
  async function deleteAllData() {
    if (!confirm('Delete ALL workout data? This cannot be undone.')) return;
    try {
      await db.transaction('rw', db.exercises, db.sessions, db.sets, async () => {
        await db.exercises.clear();
        await db.sessions.clear();
        await db.sets.clear();
      });
      showStatus('success', 'All data deleted.');
    } catch {
      showStatus('error', 'Delete failed.');
    }
  }

  return (
    <div className="settings">
      <h2 className="settings-title">Settings</h2>

      <div className="settings-section">
        <div className="settings-section-title">Appearance</div>
        <div className="setting-row">
          <label className="setting-label">Theme</label>
          <div className="unit-toggle">
            {(['system', 'light', 'dark'] as Theme[]).map(t => (
              <button
                key={t}
                className={`unit-btn${theme === t ? ' unit-btn--active' : ''}`}
                onClick={() => handleTheme(t)}
                style={{ textTransform: 'capitalize' }}
              >{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">GTG</div>

        <div className="setting-row">
          <label className="setting-label">Default reps</label>
          <input type="number" className="setting-input" value={defaultReps} min={1}
            onChange={e => setDefaultReps(Number(e.target.value))} />
        </div>

        <div className="setting-row">
          <label className="setting-label">Min interval (min)</label>
          <input type="number" className="setting-input" value={gtgInterval} min={1}
            onChange={e => setGtgInterval(Number(e.target.value))} />
        </div>

        <div className="setting-row">
          <label className="setting-label">Max sets/day</label>
          <input type="number" className="setting-input" value={maxSets} min={1}
            onChange={e => setMaxSets(Number(e.target.value))} />
        </div>

        <div className="setting-row">
          <label className="setting-label">Reminders</label>
          <input type="checkbox" checked={reminders}
            onChange={e => setReminders(e.target.checked)} />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Data</div>

        {status && (
          <div className={`status-banner status-banner--${status.type}`}>
            {status.message}
          </div>
        )}

        <button className="settings-btn" onClick={exportData}>
          Export data (JSON)
        </button>

        <button className="settings-btn" onClick={exportCSV}>
          Export data (CSV)
        </button>

        <button className="settings-btn" onClick={triggerImport}>
          Import backup (JSON only)
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />

        <button className="settings-btn settings-btn--danger" onClick={deleteAllData}>
          Delete all data
        </button>
      </div>
    </div>
  );
}
