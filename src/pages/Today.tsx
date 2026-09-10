import { useState, useEffect, useCallback } from 'react';
import { getAllExercises } from '../db/exercises';
import { getOrCreateTodaySession, getTodaySessions } from '../db/sessions';
import { addSet, getSetsBySession } from '../db/sets';
import type { Exercise } from '../models/Exercise';
import type { WorkoutSet } from '../models/WorkoutSet';
import './Today.css';

interface SetWithExercise extends WorkoutSet {
  exerciseName: string;
}

export default function Today() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [reps, setReps] = useState(5);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [allTodaySets, setAllTodaySets] = useState<SetWithExercise[]>([]);
  const [justLogged, setJustLogged] = useState(false);

  const loadAllTodaySets = useCallback(async (exerciseList: Exercise[]) => {
    const sessions = await getTodaySessions();
    const result: SetWithExercise[] = [];
    for (const session of sessions) {
      const exercise = exerciseList.find(ex => ex.id === session.exerciseId);
      const sets = await getSetsBySession(session.id!);
      for (const set of sets) {
        result.push({ ...set, exerciseName: exercise?.name ?? 'Unknown' });
      }
    }
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setAllTodaySets(result);
  }, []);

  useEffect(() => {
    getAllExercises().then(list => {
      setExercises(list);
      if (list.length > 0) selectExercise(list[0], list);
    });
  }, []);

  async function selectExercise(ex: Exercise, exerciseList?: Exercise[]) {
    setSelectedExercise(ex);
    setReps(ex.defaultReps ?? 5);
    const sid = await getOrCreateTodaySession(ex.id!);
    setSessionId(sid);
    await loadAllTodaySets(exerciseList ?? exercises);
  }

  async function logSet() {
    if (!sessionId || !selectedExercise) return;
    const sessionSets = allTodaySets.filter(s => s.exerciseName === selectedExercise.name);
    await addSet({
      sessionId,
      setNumber: sessionSets.length + 1,
      reps,
      timestamp: new Date(),
    });
    await loadAllTodaySets(exercises);
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1500);
  }

  const totalReps = allTodaySets.reduce((sum, s) => sum + (s.reps ?? 0), 0);

  function formatTime(date: Date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Group sets by exercise for display
  const setsByExercise = allTodaySets.reduce<Record<string, SetWithExercise[]>>((acc, s) => {
    if (!acc[s.exerciseName]) acc[s.exerciseName] = [];
    acc[s.exerciseName].push(s);
    return acc;
  }, {});

  return (
    <div className="today">
      <h2 className="today-title">Today</h2>

      {exercises.length > 1 && (
        <div className="exercise-selector">
          {exercises.map(ex => (
            <button
              key={ex.id}
              className={`exercise-tab ${selectedExercise?.id === ex.id ? 'exercise-tab--active' : ''}`}
              onClick={() => selectExercise(ex)}
            >
              {ex.name}
            </button>
          ))}
        </div>
      )}

      {selectedExercise && (
        <div className="exercise-card">
          <div className="exercise-name">{selectedExercise.name}</div>
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
      )}

      {allTodaySets.length > 0 && (
        <div className="sets-section">
          <div className="sets-header">
            <span>Today's sets</span>
            <span className="sets-summary">{allTodaySets.length} sets · {totalReps} reps</span>
          </div>

          {Object.entries(setsByExercise).map(([exerciseName, exSets]) => (
            <div key={exerciseName} className="sets-exercise-group">
              {Object.keys(setsByExercise).length > 1 && (
                <div className="sets-exercise-label">{exerciseName}</div>
              )}
              <ul className="sets-list">
                {exSets.map((s, i) => (
                  <li key={s.id} className="set-item">
                    <span className="set-number">Set {exSets.length - i}</span>
                    <span className="set-time">{formatTime(s.timestamp)}</span>
                    <span className="set-reps">{s.reps} reps</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {allTodaySets.length === 0 && selectedExercise && (
        <p className="no-sets">No sets logged yet today.</p>
      )}
    </div>
  );
}
