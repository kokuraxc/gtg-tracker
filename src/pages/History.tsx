import { useState, useEffect } from 'react';
import { getAllSessions } from '../db/sessions';
import { getSetsBySession } from '../db/sets';
import { getExerciseById } from '../db/exercises';
import type { WorkoutSession } from '../models/WorkoutSession';
import './History.css';

interface DayGroup {
  dateLabel: string;
  sessions: {
    session: WorkoutSession;
    exerciseName: string;
    setCount: number;
    totalReps: number;
  }[];
}

export default function History() {
  const [days, setDays] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    const sessions = await getAllSessions();
    const grouped: Record<string, DayGroup> = {};

    for (const session of sessions) {
      const sets = await getSetsBySession(session.id!);
      const exercise = await getExerciseById(session.exerciseId);
      const dateKey = new Date(session.startedAt).toDateString();
      const dateLabel = new Date(session.startedAt).toLocaleDateString(undefined, {
        month: 'long', day: 'numeric',
      });

      if (!grouped[dateKey]) grouped[dateKey] = { dateLabel, sessions: [] };
      grouped[dateKey].sessions.push({
        session,
        exerciseName: exercise?.name ?? 'Unknown',
        setCount: sets.length,
        totalReps: sets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
      });
    }

    setDays(Object.values(grouped));
    setLoading(false);
  }

  if (loading) return <div className="history"><p className="loading">Loading…</p></div>;

  return (
    <div className="history">
      <h2 className="history-title">History</h2>

      {days.length === 0 && (
        <p className="no-history">No workouts logged yet.</p>
      )}

      {days.map(day => (
        <div key={day.dateLabel} className="history-day">
          <div className="history-date">{day.dateLabel}</div>
          {day.sessions.map(({ session, exerciseName, setCount, totalReps }) => (
            <div key={session.id} className="history-session">
              <div className="history-exercise">{exerciseName}</div>
              <div className="history-detail">
                {setCount > 0
                  ? `${setCount} sets · ${totalReps} reps total`
                  : 'Session started'}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
