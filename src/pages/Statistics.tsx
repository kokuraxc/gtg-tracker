import { useState, useEffect } from 'react';
import { getAllExercises } from '../db/exercises';
import { getSessionsByExercise } from '../db/sessions';
import { getAllSetsForExercise } from '../db/sets';
import type { Exercise } from '../models/Exercise';
import type { WorkoutSet } from '../models/WorkoutSet';
import './Statistics.css';

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

      {stats && statCards.every(s => s.value === '0' || s.value === '0 reps') && (
        <p style={{ color: '#999', textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          No data yet — log some sets first!
        </p>
      )}
    </div>
  );
}
