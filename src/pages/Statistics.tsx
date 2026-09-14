import { useState, useEffect } from 'react';
import { getAllExercises } from '../db/exercises';
import { getSessionsByExercise } from '../db/sessions';
import { getAllSetsForExercise } from '../db/sets';
import type { Exercise } from '../models/Exercise';
import type { WorkoutSet } from '../models/WorkoutSet';
import './Statistics.css';

// ── Weekly chart ───────────────────────────────────────────────
interface DayTotal { label: string; reps: number; isToday: boolean; }

function buildWeeklyData(sets: WorkoutSet[]): DayTotal[] {
  const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const days: DayTotal[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const reps = sets
      .filter(s => {
        const t = new Date(s.timestamp);
        return t >= d && t < next && s.reps != null;
      })
      .reduce((sum, s) => sum + s.reps!, 0);
    days.push({ label: DAY[d.getDay()], reps, isToday: i === 0 });
  }
  return days;
}

function WeeklyChart({ days, targetReps }: { days: DayTotal[]; targetReps?: number }) {
  const W = 320, H = 140, padL = 28, padR = 8, padT = 10, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...days.map(d => d.reps), targetReps ?? 0, 1);
  const barW = chartW / days.length * 0.55;
  const gap = chartW / days.length;

  const yLabel = (v: number) => {
    const x = padL - 4;
    const y = padT + chartH - (v / maxVal) * chartH;
    return <text key={v} x={x} y={y + 4} textAnchor="end" fontSize={9} fill="#aaa">{v}</text>;
  };

  // y-axis ticks: 0 and max
  const ticks = [0, Math.round(maxVal)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {/* grid line at max */}
      <line x1={padL} y1={padT} x2={W - padR} y2={padT} stroke="#eee" strokeWidth={1} />
      <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#ddd" strokeWidth={1} />
      {ticks.map(yLabel)}

      {/* GTG target line */}
      {targetReps != null && targetReps > 0 && (
        <>
          <line
            x1={padL} x2={W - padR}
            y1={padT + chartH - (targetReps / maxVal) * chartH}
            y2={padT + chartH - (targetReps / maxVal) * chartH}
            stroke="#34c759" strokeWidth={1.5} strokeDasharray="4 3"
          />
          <text
            x={W - padR + 2}
            y={padT + chartH - (targetReps / maxVal) * chartH + 4}
            fontSize={8} fill="#34c759"
          >goal</text>
        </>
      )}

      {days.map((d, i) => {
        const bH = Math.max(2, (d.reps / maxVal) * chartH);
        const x = padL + i * gap + (gap - barW) / 2;
        const y = padT + chartH - bH;
        const barColor = d.isToday ? '#007aff' : d.reps === 0 ? '#e5e5ea' : '#5ac8fa';
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bH} rx={3} fill={barColor} />
            {d.reps > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="#555">{d.reps}</text>
            )}
            <text
              x={padL + i * gap + gap / 2} y={H - 4}
              textAnchor="middle" fontSize={10}
              fill={d.isToday ? '#007aff' : '#888'}
              fontWeight={d.isToday ? '700' : '400'}
            >{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

interface Stats {
  repsToday: number;
  repsThisWeek: number;
  bestSet: number;
  avgReps: number;
  setsThisWeek: number;
  trainingDays: number;
}

function computeStats(sets: WorkoutSet[]): Stats {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);

  const todaySets = sets.filter(s => new Date(s.timestamp) >= todayStart);
  const weekSets = sets.filter(s => new Date(s.timestamp) >= weekStart);

  const repSets = sets.filter(s => s.reps != null);
  const bestSet = repSets.length ? Math.max(...repSets.map(s => s.reps!)) : 0;
  const avgReps = repSets.length ? Math.round(repSets.reduce((sum, s) => sum + s.reps!, 0) / repSets.length * 10) / 10 : 0;

  const uniqueDays = new Set(sets.map(s => new Date(s.timestamp).toDateString())).size;

  return {
    repsToday: todaySets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
    repsThisWeek: weekSets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
    bestSet,
    avgReps,
    setsThisWeek: weekSets.length,
    trainingDays: uniqueDays,
  };
}

export default function Statistics() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [weeklyData, setWeeklyData] = useState<DayTotal[]>([]);

  useEffect(() => {
    getAllExercises().then(list => {
      setExercises(list);
      if (list.length > 0) loadStats(list[0]);
    });
  }, []);

  async function loadStats(ex: Exercise) {
    setSelected(ex);
    const sessions = await getSessionsByExercise(ex.id!);
    const sessionIds = sessions.map(s => s.id!);
    const sets = await getAllSetsForExercise(sessionIds);
    setStats(computeStats(sets));
    setWeeklyData(buildWeeklyData(sets));
  }

  const statCards = stats ? [
    { label: 'Today', value: `${stats.repsToday} reps` },
    { label: 'This week', value: `${stats.repsThisWeek} reps` },
    { label: 'Best set', value: `${stats.bestSet} reps` },
    { label: 'Avg reps/set', value: `${stats.avgReps}` },
    { label: 'Sets this week', value: `${stats.setsThisWeek}` },
    { label: 'Training days', value: `${stats.trainingDays}` },
  ] : [];

  return (
    <div className="statistics">
      <h2 className="statistics-title">Statistics</h2>

      {exercises.length > 1 && (
        <div className="stats-tabs">
          {exercises.map(ex => (
            <button
              key={ex.id}
              className={`stats-tab ${selected?.id === ex.id ? 'stats-tab--active' : ''}`}
              onClick={() => loadStats(ex)}
            >
              {ex.name}
            </button>
          ))}
        </div>
      )}

      {selected && <div className="stats-exercise-name">{selected.name}</div>}

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
          <WeeklyChart
            days={weeklyData}
            targetReps={selected?.gtgEnabled
              ? (selected.gtgMaxSetsPerDay * (selected.defaultReps ?? 5))
              : undefined}
          />
        </div>
      )}

      {stats && statCards.every(s => s.value === '0' || s.value === '0 reps') && (
        <p style={{ color: '#999', textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          No data yet — log some sets first!
        </p>
      )}
    </div>
  );
}
