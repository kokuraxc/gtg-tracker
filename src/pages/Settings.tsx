import { useState, useRef, useEffect } from 'react';
import { db, replaceAllData } from '../db/database';
import {
  syncConfigured,
  getSyncKey,
  setSyncKey,
  disconnectSync,
  syncNow,
  getLastSyncAt,
  getLastSyncError,
} from '../services/sync';
import {
  notificationsEnabled,
  requestNotificationPermission,
  disableNotifications,
} from '../services/notifications';
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
  const [reminders, setReminders] = useState(() => notificationsEnabled());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    () => ('Notification' in window ? Notification.permission : 'denied')
  );
  const [status, setStatus] = useState<Status>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('gtg-theme') as Theme) ?? 'system'
  );

  // ── Sync ────────────────────────────────────────────────────
  const [syncKey, setSyncKeyState] = useState<string | null>(() => getSyncKey());
  const [keyInput, setKeyInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [, setSyncTick] = useState(0);

  useEffect(() => {
    const bump = () => { setSyncKeyState(getSyncKey()); setSyncTick(n => n + 1); };
    window.addEventListener('gtg-sync-status', bump);
    return () => window.removeEventListener('gtg-sync-status', bump);
  }, []);

  function connectSync() {
    try {
      setSyncKey(keyInput);
      setKeyInput('');
      setSyncKeyState(getSyncKey());
    } catch (e) {
      showStatus('error', e instanceof Error ? e.message : 'Invalid key.');
    }
  }

  async function runSyncNow() {
    setSyncing(true);
    const r = await syncNow();
    setSyncing(false);
    if (r.ok) showStatus('success', `Synced (${r.pulled} received, ${r.pushed} sent).`);
    else showStatus('error', r.error ?? 'Sync failed.');
  }

  function handleDisconnect() {
    if (!confirm('Stop syncing on this device? Data on this device is kept.')) return;
    disconnectSync();
    setSyncKeyState(null);
  }

  const lastSyncAt = getLastSyncAt();
  const lastSyncError = getLastSyncError();

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

      await replaceAllData({ exercises: data.exercises, sessions: data.sessions, sets: data.sets });

      showStatus('success', `Imported ${data.sets.length} sets across ${data.exercises.length} exercises.`);
    } catch {
      showStatus('error', 'Import failed — file may be corrupt.');
    }
  }

  // ── Delete all ──────────────────────────────────────────────
  async function deleteAllData() {
    if (!confirm('Delete ALL workout data? This cannot be undone.')) return;
    try {
      await replaceAllData();
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
          <div>
            <label className="setting-label">GTG reminders</label>
            {notifPermission === 'denied' && (
              <div className="setting-hint">Blocked by browser — enable in site settings.</div>
            )}
          </div>
          <input
            type="checkbox"
            checked={reminders}
            disabled={notifPermission === 'denied'}
            onChange={async e => {
              if (e.target.checked) {
                const perm = await requestNotificationPermission();
                setNotifPermission(perm);
                setReminders(perm === 'granted');
              } else {
                disableNotifications();
                setReminders(false);
              }
            }}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Sync</div>
        {!syncConfigured() ? (
          <div className="setting-hint">Sync is not configured in this build.</div>
        ) : !syncKey ? (
          <>
            <div className="setting-hint" style={{ marginBottom: 8 }}>
              Paste your sync key to sync this device with your others.
            </div>
            <input
              type="text"
              className="setting-input"
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
              placeholder="Sync key"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
            />
            <button className="settings-btn" onClick={connectSync} disabled={!keyInput.trim()}>
              Connect &amp; sync
            </button>
          </>
        ) : (
          <>
            <div className="setting-row">
              <div>
                <label className="setting-label">Connected</label>
                <div className="setting-hint">
                  {lastSyncError
                    ? `Last sync failed: ${lastSyncError}`
                    : lastSyncAt
                      ? `Last synced ${new Date(lastSyncAt).toLocaleString()}`
                      : 'Not synced yet'}
                </div>
              </div>
            </div>
            <button className="settings-btn" onClick={runSyncNow} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button className="settings-btn" onClick={handleDisconnect}>
              Disconnect this device
            </button>
          </>
        )}
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
