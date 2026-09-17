import { useState, useEffect } from 'react';
import { getAllSessions, getSessionsByExercise } from '../db/sessions';
import { getSetsBySession, getAllSetsForExercise } from '../db/sets';
import { getExerciseById, getAllExercises } from '../db/exercises';
import type { WorkoutSession } from '../models/WorkoutSession';
import type { WorkoutSet } from '../models/WorkoutSet';
import type { Exercise } from '../models/Exercise';
import './History.css';
import './Statistics.css';

// ── Stats helpers (from Statistics) ───────────────────────────
interface DayTotal { label: string; reps: number; isToday: boolean; }

function buildWeeklyData(sets: WorkoutSet[]): DayTotal[] {
  const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (6 - i)); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const reps = sets.filter(s => { const t = new Date(s.timestamp); return t >= d && t < next && s.reps != null; })
                     .reduce((sum, s) => sum + s.reps!, 0);
    return { label: DAY[d.getDay()], reps, isToday: i === 6 };
  });
}

function WeeklyChart({ days, targetReps }: { days: DayTotal[]; targetReps?: number }) {
  const W = 320, H = 140, padL = 28, padR = 8, padT = 10, padB = 28;
  const chartW = W - padL - padR; const chartH = H - padT - padB;
  const maxVal = Math.max(...days.map(d => d.reps), targetReps ?? 0, 1);
  const barW = chartW / days.length * 0.55;
  const gap = chartW / days.length;
  const ticks = [0, Math.round(maxVal)];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <line x1={padL} y1={padT} x2={W-padR} y2={padT} stroke="var(--border-light)" strokeWidth={1} />
      <line x1={padL} y1={padT+chartH} x2={W-padR} y2={padT+chartH} stroke="var(--border)" strokeWidth={1} />
      {ticks.map(v => <text key={v} x={padL-4} y={padT+chartH-(v/maxVal)*chartH+4} textAnchor="end" fontSize={9} fill="var(--text-3)">{v}</text>)}
      {targetReps != null && targetReps > 0 && (
        <line x1={padL} x2={W-padR} y1={padT+chartH-(targetReps/maxVal)*chartH} y2={padT+chartH-(targetReps/maxVal)*chartH} stroke="var(--accent-green)" strokeWidth={1.5} strokeDasharray="4 3" />
      )}
      {days.map((d, i) => {
        const bH = Math.max(2, (d.reps/maxVal)*chartH);
        const x = padL + i*gap + (gap-barW)/2;
        const y = padT+chartH-bH;
        const col = d.isToday ? 'var(--accent)' : d.reps === 0 ? 'var(--bg-surface-2)' : '#5ac8fa';
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bH} rx={3} fill={col} />
            {d.reps > 0 && <text x={x+barW/2} y={y-3} textAnchor="middle" fontSize={9} fill="var(--text-2)">{d.reps}</text>}
            <text x={padL+i*gap+gap/2} y={H-4} textAnchor="middle" fontSize={10} fill={d.isToday ? 'var(--accent)' : 'var(--text-3)'} fontWeight={d.isToday ? '700' : '400'}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

interface Stats { repsToday: number; repsThisWeek: number; bestSet: number; avgReps: number; setsThisWeek: number; trainingDays: number; }

function computeStats(sets: WorkoutSet[]): Stats {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const weekStart = new Date(now); weekStart.setDate(now.getDate()-now.getDay()); weekStart.setHours(0,0,0,0);
  const repSets = sets.filter(s => s.reps != null);
  return {
    repsToday: sets.filter(s => new Date(s.timestamp) >= todayStart).reduce((sum,s) => sum+(s.reps??0),0),
    repsThisWeek: sets.filter(s => new Date(s.timestamp) >= weekStart).reduce((sum,s) => sum+(s.reps??0),0),
    bestSet: repSets.length ? Math.max(...repSets.map(s => s.reps!)) : 0,
    avgReps: repSets.length ? Math.round(repSets.reduce((sum,s) => sum+s.reps!,0)/repSets.length*10)/10 : 0,
    setsThisWeek: sets.filter(s => new Date(s.timestamp) >= weekStart).length,
    trainingDays: new Set(sets.map(s => new Date(s.timestamp).toDateString())).size,
  };
}

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
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [statsEx, setStatsEx] = useState<Exercise | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [weeklyData, setWeeklyData] = useState<DayTotal[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [exList] = await Promise.all([getAllExercises()]);
    setExercises(exList);
    if (exList.length > 0) await loadStats(exList[0]);
    await loadHistory();
  }

  async function loadStats(ex: Exercise) {
    setStatsEx(ex);
    const sessions = await getSessionsByExercise(ex.id!);
    const sets = await getAllSetsForExercise(sessions.map(s => s.id!));
    setStats(computeStats(sets));
    setWeeklyData(buildWeeklyData(sets));
  }

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

      if (sets.length === 0) continue; // skip empty sessions

      if (!grouped[dateKey]) grouped[dateKey] = { dateLabel, sessions: [] };
      grouped[dateKey].sessions.push({
        session, exercise, sets,
        setCount: sets.length,
        totalValue: total,
      });
    }

    const sorted = Object.entries(grouped)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([, v]) => v);
    setDays(sorted);
    setLoading(false);
  }

  if (loading) return <div className="history"><p className="loading">Loading…</p></div>;
  if (selected) return <SessionDetail summary={selected} onBack={() => setSelected(null)} />;

  const unit = (ex: Exercise) =>
    ex.trackingType === 'duration' ? (ex.durationUnit ?? 'sec')
    : ex.trackingType === 'distance' ? 'km' : 'reps';

  const statCards = stats ? [
    { label: 'Today',         value: `${stats.repsToday} reps` },
    { label: 'This week',     value: `${stats.repsThisWeek} reps` },
    { label: 'Best set',      value: `${stats.bestSet} reps` },
    { label: 'Avg reps/set',  value: `${stats.avgReps}` },
    { label: 'Sets this week',value: `${stats.setsThisWeek}` },
    { label: 'Training days', value: `${stats.trainingDays}` },
  ] : [];

  return (
    <div className="history">
      <h2 className="history-title">History</h2>

      {/* ── Stats section ── */}
      {exercises.length > 1 && (
        <div className="stats-tabs">
          {exercises.map(ex => (
            <button key={ex.id} className={`stats-tab${statsEx?.id === ex.id ? ' stats-tab--active' : ''}`} onClick={() => loadStats(ex)}>
              {ex.name}
            </button>
          ))}
        </div>
      )}
      {statsEx && <div className="stats-exercise-name">{statsEx.name}</div>}
      {stats && (
        <div className="stats-grid">
          {statCards.map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}
      {weeklyData.length > 0 && (
        <div className="weekly-chart-card">
          <div className="weekly-chart-title">Last 7 days</div>
          <WeeklyChart days={weeklyData} targetReps={statsEx?.gtgEnabled ? (statsEx.gtgMaxSetsPerDay * (statsEx.defaultReps ?? 5)) : undefined} />
        </div>
      )}

      <h3 className="history-log-title">Log</h3>

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
