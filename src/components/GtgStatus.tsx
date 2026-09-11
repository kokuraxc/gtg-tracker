import { useState, useEffect } from 'react';
import type { Exercise } from '../models/Exercise';
import type { WorkoutSet } from '../models/WorkoutSet';
import './GtgStatus.css';

interface Props {
  exercise: Exercise;
  todaySets: WorkoutSet[];
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GtgStatus({ exercise, todaySets }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!exercise.gtgEnabled) return null;

  const { gtgMinIntervalMinutes, gtgMaxSetsPerDay } = exercise;
  const setsToday = todaySets.length;
  const maxReached = setsToday >= gtgMaxSetsPerDay;

  const lastSet = todaySets.length > 0
    ? todaySets.reduce((latest, s) =>
        new Date(s.timestamp).getTime() > new Date(latest.timestamp).getTime() ? s : latest
      )
    : null;

  const secondsSinceLast = lastSet
    ? Math.floor((now - new Date(lastSet.timestamp).getTime()) / 1000)
    : null;

  const intervalSeconds = gtgMinIntervalMinutes * 60;
  const secondsUntilReady = secondsSinceLast !== null
    ? Math.max(0, intervalSeconds - secondsSinceLast)
    : 0;

  const isReady = !maxReached && (secondsSinceLast === null || secondsSinceLast >= intervalSeconds);

  let statusClass = 'gtg-status--ready';
  let statusText = 'Ready for a set';
  if (maxReached) {
    statusClass = 'gtg-status--done';
    statusText = `Max sets reached (${gtgMaxSetsPerDay})`;
  } else if (!isReady) {
    statusClass = 'gtg-status--waiting';
    statusText = 'Rest time';
  }

  return (
    <div className={`gtg-status ${statusClass}`}>
      <div className="gtg-status-row">
        <div className="gtg-stat">
          <div className="gtg-stat-label">Sets today</div>
          <div className="gtg-stat-value">{setsToday} / {gtgMaxSetsPerDay}</div>
        </div>

        {secondsSinceLast !== null && (
          <div className="gtg-stat">
            <div className="gtg-stat-label">Since last set</div>
            <div className="gtg-stat-value">{formatDuration(secondsSinceLast)}</div>
          </div>
        )}

        <div className="gtg-stat">
          <div className="gtg-stat-label">{isReady || maxReached ? 'Status' : 'Next set in'}</div>
          <div className="gtg-stat-value gtg-stat-value--highlight">
            {maxReached ? '✓ Done' : isReady ? '✓ Go' : formatDuration(secondsUntilReady)}
          </div>
        </div>
      </div>

      <div className={`gtg-readiness-bar`}>
        <div
          className="gtg-readiness-fill"
          style={{
            width: maxReached ? '100%'
              : secondsSinceLast === null ? '100%'
              : `${Math.min(100, (secondsSinceLast / intervalSeconds) * 100)}%`,
          }}
        />
      </div>

      <div className="gtg-status-label">{statusText}</div>

      {setsToday > 0 && <GtgSummary sets={todaySets} maxSets={gtgMaxSetsPerDay} />}
    </div>
  );
}

// ── Daily summary ─────────────────────────────────────────────
function GtgSummary({ sets, maxSets }: { sets: WorkoutSet[]; maxSets: number }) {
  const repSets = sets.filter(s => s.reps != null);
  if (repSets.length === 0) return null;

  const totalReps = repSets.reduce((sum, s) => sum + s.reps!, 0);
  const bestSet = Math.max(...repSets.map(s => s.reps!));
  const avgReps = Math.round((totalReps / repSets.length) * 10) / 10;

  const first = new Date(sets.reduce((a, b) =>
    new Date(a.timestamp) < new Date(b.timestamp) ? a : b).timestamp);
  const last = new Date(sets.reduce((a, b) =>
    new Date(a.timestamp) > new Date(b.timestamp) ? a : b).timestamp);
  const spanMinutes = Math.round((last.getTime() - first.getTime()) / 60000);

  const completionPct = Math.round((sets.length / maxSets) * 100);

  return (
    <div className="gtg-summary">
      <div className="gtg-summary-title">Today's summary</div>
      <div className="gtg-summary-grid">
        <div className="gtg-summary-item">
          <span className="gtg-summary-val">{totalReps}</span>
          <span className="gtg-summary-lbl">total reps</span>
        </div>
        <div className="gtg-summary-item">
          <span className="gtg-summary-val">{bestSet}</span>
          <span className="gtg-summary-lbl">best set</span>
        </div>
        <div className="gtg-summary-item">
          <span className="gtg-summary-val">{avgReps}</span>
          <span className="gtg-summary-lbl">avg reps</span>
        </div>
        <div className="gtg-summary-item">
          <span className="gtg-summary-val">{completionPct}%</span>
          <span className="gtg-summary-lbl">of target</span>
        </div>
      </div>
      {sets.length > 1 && (
        <div className="gtg-summary-span">
          Training span: {spanMinutes} min
        </div>
      )}
    </div>
  );
}
