import { useState, useEffect } from 'react';
import { getAllSessions } from '../db/sessions';
import { getSetsBySession } from '../db/sets';
import { getExerciseById } from '../db/exercises';
import type { WorkoutSession } from '../models/WorkoutSession';
import type { WorkoutSet } from '../models/WorkoutSet';
import type { Exercise } from '../models/Exercise';
import './History.css';

interface SessionSummary {
  session: WorkoutSession;
  exercise: Exercise;
  sets: WorkoutSet[];
  setCount: number;
  totalValue: number;
}

interface DayGroup {
  dateLabel: string;
  sessions: SessionSummary[];
}

// ── SVG Bar Chart ──────────────────────────────────────────────
function SetChart({ sets, exercise }: { sets: WorkoutSet[]; exercise: Exercise }) {
  if (sets.length === 0) return <p className="no-history">No sets recorded.</p>;

  const W = 320, H = 200, padL = 40, padB = 28, padR = 12, padT = 12;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const getValue = (s: WorkoutSet) =>
    exercise.trackingType === 'duration' ? (s.duration ?? 0)
    : exercise.trackingType === 'distance' ? (s.distance ?? 0)
    : (s.reps ?? 0);

  const unit = exercise.trackingType === 'duration'
    ? (exercise.durationUnit ?? 'sec')
    : exercise.trackingType === 'distance' ? 'km' : 'reps';

  // X axis: 07:00 to 01:00 next day (18 hours)
  const dayRef = new Date(sets[0].timestamp);
  const dayStart = new Date(dayRef); dayStart.setHours(7, 0, 0, 0);
  const dayEnd = new Date(dayRef); dayEnd.setHours(25, 0, 0, 0); // 01:00 next day
  const dayRange = dayEnd.getTime() - dayStart.getTime();

  const xPos = (t: Date) => padL + ((t.getTime() - dayStart.getTime()) / dayRange) * chartW;

  // Y axis: shared scale — max is the cumulative total
  const values = sets.map(getValue);

  // cumulative totals
  const cumValues: number[] = [];
  let running = 0;
  for (const v of values) { running += v; cumValues.push(running); }
  const maxY = Math.max(...cumValues, 1);

  // single shared y-scale
  const yBar = (v: number) => padT + chartH - (v / maxY) * chartH;
  const yCum = yBar;

  const barW = Math.max(4, Math.min(12, chartW / sets.length * 0.15));

  // cumulative step-line path: starts at 0 at first set, steps up after each set
  const linePts: string[] = [];
  sets.forEach((s, i) => {
    const x = xPos(new Date(s.timestamp));
    const y = yCum(cumValues[i]);
    linePts.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
  });
  const linePath = linePts.join(' ');

  // x-axis hour labels: 07:00, 10:00, 13:00, 16:00, 19:00, 22:00, 01:00
  const tickHours = [7, 10, 13, 16, 19, 22, 25];
  const hourLabels = tickHours.map(h => {
    const t = new Date(dayStart); t.setHours(h, 0, 0, 0);
    const x = padL + ((t.getTime() - dayStart.getTime()) / dayRange) * chartW;
    const displayH = h === 25 ? 1 : h;
    const label = `${String(displayH).padStart(2, '0')}:00`;
    return { x, label };
  });

  // y gridlines for bars (left scale)
  const yGridFracs = [0, 0.5, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="set-chart">
      {/* Y gridlines + labels (shared scale) */}
      {yGridFracs.map(frac => {
        const v = Math.round(maxY * frac);
        const y = padT + chartH - frac * chartH;
        return (
          <g key={frac}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e8e8e8" strokeWidth="1" />
            <text x={padL - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#aaa">{v}</text>
          </g>
        );
      })}

      {/* Bars (per-set values) */}
      {sets.map((s, i) => {
        const v = getValue(s);
        const x = xPos(new Date(s.timestamp));
        const bH = (v / maxY) * chartH;
        const y = padT + chartH - bH;
        return (
          <g key={s.id ?? i}>
            <rect x={x - barW / 2} y={y} width={barW} height={bH}
              fill="#007aff" rx="2" opacity="0.8" />
            <text x={x} y={y - 2} textAnchor="middle" fontSize="8" fill="#007aff" fontWeight="600">{v}</text>
          </g>
        );
      })}

      {/* Cumulative step line */}
      {sets.length > 1 && (
        <path d={linePath} fill="none" stroke="#34c759" strokeWidth="2" strokeLinejoin="round" />
      )}

      {/* Dots on cumulative line */}
      {sets.map((s, i) => (
        <circle key={`dot${i}`}
          cx={xPos(new Date(s.timestamp))} cy={yCum(cumValues[i])}
          r="3" fill="#34c759" />
      ))}

      {/* X-axis line */}
      <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="#ccc" strokeWidth="1" />

      {/* X-axis hour labels */}
      {hourLabels.map(({ x, label }) => (
        <text key={label} x={x} y={H - 6} textAnchor="middle" fontSize="8" fill="#bbb">{label}</text>
      ))}

      {/* Left axis unit label */}
      <text x={6} y={padT + chartH / 2} fontSize="8" fill="#007aff"
        transform={`rotate(-90, 6, ${padT + chartH / 2})`} textAnchor="middle">{unit}</text>

      {/* Legend */}
      <rect x={padL + 4} y={padT} width={7} height={7} fill="#007aff" rx="1" opacity="0.8" />
      <text x={padL + 14} y={padT + 6} fontSize="8" fill="#555">per set</text>
      <circle cx={padL + 60} cy={padT + 3.5} r="3" fill="#34c759" />
      <text x={padL + 66} y={padT + 6} fontSize="8" fill="#555">cumulative</text>
    </svg>
  );
}

// ── Detail view ────────────────────────────────────────────────
function SessionDetail({ summary, onBack }: { summary: SessionSummary; onBack: () => void }) {
  const { exercise, sets, session } = summary;

  const getValue = (s: WorkoutSet) =>
    exercise.trackingType === 'duration' ? s.duration
    : exercise.trackingType === 'distance' ? s.distance
    : s.reps;

  const unit = exercise.trackingType === 'duration'
    ? (exercise.durationUnit ?? 'sec')
    : exercise.trackingType === 'distance' ? 'km' : 'reps';

  const dateLabel = new Date(session.startedAt).toLocaleDateString(undefined, {
    weekday: 'short', month: 'long', day: 'numeric',
  });

  return (
    <div className="history">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2 className="history-title">{exercise.name}</h2>
      <p className="detail-date">{dateLabel}</p>

      <SetChart sets={sets} exercise={exercise} />

      <ul className="sets-list-detail">
        {[...sets].reverse().map((s, i) => (
          <li key={s.id} className="set-item-detail">
            <span className="set-num">Set {sets.length - i}</span>
            <span className="set-val">{getValue(s)} {unit}</span>
            <span className="set-t">
              {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main History page ──────────────────────────────────────────
export default function History() {
  const [days, setDays] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SessionSummary | null>(null);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    const sessions = await getAllSessions();
    const grouped: Record<string, DayGroup> = {};

    for (const session of sessions) {
      const sets = await getSetsBySession(session.id!);
      const exercise = await getExerciseById(session.exerciseId);
      if (!exercise) continue;

      const dateKey = new Date(session.startedAt).toDateString();
      const dateLabel = new Date(session.startedAt).toLocaleDateString(undefined, {
        month: 'long', day: 'numeric',
      });

      const total = sets.reduce((sum, s) => sum + (s.reps ?? s.duration ?? s.distance ?? 0), 0);

      if (!grouped[dateKey]) grouped[dateKey] = { dateLabel, sessions: [] };
      grouped[dateKey].sessions.push({
        session, exercise, sets,
        setCount: sets.length,
        totalValue: total,
      });
    }

    setDays(Object.values(grouped));
    setLoading(false);
  }

  if (loading) return <div className="history"><p className="loading">Loading…</p></div>;
  if (selected) return <SessionDetail summary={selected} onBack={() => setSelected(null)} />;

  const unit = (ex: Exercise) =>
    ex.trackingType === 'duration' ? (ex.durationUnit ?? 'sec')
    : ex.trackingType === 'distance' ? 'km' : 'reps';

  return (
    <div className="history">
      <h2 className="history-title">History</h2>

      {days.length === 0 && <p className="no-history">No workouts logged yet.</p>}

      {days.map(day => (
        <div key={day.dateLabel} className="history-day">
          <div className="history-date">{day.dateLabel}</div>
          {day.sessions.map(summary => (
            <button
              key={summary.session.id}
              className="history-session"
              onClick={() => setSelected(summary)}
            >
              <div className="history-exercise">{summary.exercise.name}</div>
              <div className="history-detail">
                {summary.setCount > 0
                  ? `${summary.setCount} sets · ${summary.totalValue} ${unit(summary.exercise)} total`
                  : 'Session started'}
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
