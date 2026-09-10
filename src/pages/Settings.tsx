import { useState } from 'react';
import './Settings.css';

export default function Settings() {
  const [defaultReps, setDefaultReps] = useState(5);
  const [gtgInterval, setGtgInterval] = useState(60);
  const [maxSets, setMaxSets] = useState(6);
  const [reminders, setReminders] = useState(false);

  return (
    <div className="settings">
      <h2 className="settings-title">Settings</h2>

      <div className="settings-section">
        <div className="settings-section-title">GTG</div>

        <div className="setting-row">
          <label className="setting-label">Default reps</label>
          <input
            type="number"
            className="setting-input"
            value={defaultReps}
            min={1}
            onChange={e => setDefaultReps(Number(e.target.value))}
          />
        </div>

        <div className="setting-row">
          <label className="setting-label">Min interval (min)</label>
          <input
            type="number"
            className="setting-input"
            value={gtgInterval}
            min={1}
            onChange={e => setGtgInterval(Number(e.target.value))}
          />
        </div>

        <div className="setting-row">
          <label className="setting-label">Max sets/day</label>
          <input
            type="number"
            className="setting-input"
            value={maxSets}
            min={1}
            onChange={e => setMaxSets(Number(e.target.value))}
          />
        </div>

        <div className="setting-row">
          <label className="setting-label">Reminders</label>
          <input
            type="checkbox"
            checked={reminders}
            onChange={e => setReminders(e.target.checked)}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Data</div>
        <button className="settings-btn">Export data (JSON)</button>
        <button className="settings-btn">Import data</button>
        <button className="settings-btn settings-btn--danger">Delete all data</button>
      </div>
    </div>
  );
}
