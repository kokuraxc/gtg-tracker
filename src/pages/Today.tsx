import { useState, useEffect, useCallback } from 'react';
import { getAllExercises } from '../db/exercises';
import { getOrCreateTodaySession, getTodaySessions } from '../db/sessions';
import { addSet, getSetsBySession, updateSet, deleteSet } from '../db/sets';
import type { Exercise } from '../models/Exercise';
import type { WorkoutSet } from '../models/WorkoutSet';
import GtgStatus from '../components/GtgStatus';
import './Today.css';

interface SetWithExercise extends WorkoutSet {
  exerciseName: string;
  trackingType: 'reps' | 'duration' | 'distance';
  durationUnit?: 'min' | 'sec';
}

function formatSetValue(s: SetWithExercise): string {
  if (s.trackingType === 'duration') {
    const unit = s.durationUnit ?? 'sec';
    return `${s.duration ?? 0} ${unit}`;
  }
  if (s.trackingType === 'distance') return `${s.distance ?? 0} km`;
  return `${s.reps ?? 0} reps`;
}

function getDefaultValue(ex: Exercise): number {
  if (ex.trackingType === 'duration') return ex.defaultDuration ?? 60;
  if (ex.trackingType === 'distance') return ex.defaultDistance ?? 1;
  return ex.defaultReps ?? 5;
}

function getUnit(ex: Exercise): string {
  if (ex.trackingType === 'duration') return ex.durationUnit ?? 'sec';
  if (ex.trackingType === 'distance') return 'km';
  return 'reps';
}

export default function Today() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [value, setValue] = useState(5);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [allTodaySets, setAllTodaySets] = useState<SetWithExercise[]>([]);
  const [justLogged, setJustLogged] = useState(false);
  const [editingSet, setEditingSet] = useState<SetWithExercise | null>(null);
  const [editValue, setEditValue] = useState(0);

  const loadAllTodaySets = useCallback(async (exerciseList: Exercise[]) => {
    const sessions = await getTodaySessions();
    const result: SetWithExercise[] = [];
    for (const session of sessions) {
      const exercise = exerciseList.find(ex => ex.id === session.exerciseId);
      const sets = await getSetsBySession(session.id!);
      for (const set of sets) {
        result.push({
          ...set,
          exerciseName: exercise?.name ?? 'Unknown',
          trackingType: exercise?.trackingType ?? 'reps',
          durationUnit: exercise?.durationUnit,
        });
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
    setValue(getDefaultValue(ex));
    setSessionId(null); // reset; session created lazily on first log
    await loadAllTodaySets(exerciseList ?? exercises);
  }

  async function logSet() {
    if (!selectedExercise) return;
    // Lazily create session on first set log — avoids duplicate empty sessions
    const sid = sessionId ?? await getOrCreateTodaySession(selectedExercise.id!);
    setSessionId(sid);
    const sessionSets = allTodaySets.filter(s => s.exerciseName === selectedExercise.name);
    const setData: Omit<WorkoutSet, 'id'> = {
      sessionId: sid,
      setNumber: sessionSets.length + 1,
      timestamp: new Date(),
    };
    if (selectedExercise.trackingType === 'reps') setData.reps = value;
    else if (selectedExercise.trackingType === 'duration') setData.duration = value;
    else if (selectedExercise.trackingType === 'distance') setData.distance = value;

    await addSet(setData);
    navigator.vibrate?.(50);
    await loadAllTodaySets(exercises);
    setSessionId(sid);
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1500);
  }

  function openEditSet(s: SetWithExercise) {
    setEditingSet(s);
    if (s.trackingType === 'duration') setEditValue(s.duration ?? 0);
    else if (s.trackingType === 'distance') setEditValue(s.distance ?? 0);
    else setEditValue(s.reps ?? 0);
  }

  async function saveEditSet() {
    if (!editingSet?.id) return;
    const changes: Record<string, number> = {};
    if (editingSet.trackingType === 'duration') changes.duration = editValue;
    else if (editingSet.trackingType === 'distance') changes.distance = editValue;
    else changes.reps = editValue;
    await updateSet(editingSet.id, changes);
    setEditingSet(null);
    await loadAllTodaySets(exercises);
  }

  async function confirmDeleteSet() {
    if (!editingSet?.id) return;
    if (!confirm('Delete this set?')) return;
    await deleteSet(editingSet.id);
    setEditingSet(null);
    await loadAllTodaySets(exercises);
  }

  const unit = selectedExercise ? getUnit(selectedExercise) : 'reps';
  const step = selectedExercise?.trackingType === 'distance' ? 0.1 : 1;
  const minValue = selectedExercise?.trackingType === 'distance' ? 0.1 : 1;

  // Summary line — only count reps exercises
  const totalReps = allTodaySets
    .filter(s => s.trackingType === 'reps')
    .reduce((sum, s) => sum + (s.reps ?? 0), 0);
  const summaryText = totalReps > 0
    ? `${allTodaySets.length} sets · ${totalReps} reps`
    : `${allTodaySets.length} sets`;

  function formatTime(date: Date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

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
        <GtgStatus
          exercise={selectedExercise}
          todaySets={allTodaySets.filter(s => s.exerciseName === selectedExercise.name)}
        />
      )}

      {selectedExercise && (
        <div className="exercise-card">
          <div className="exercise-name">{selectedExercise.name}</div>
          <div className="exercise-target">Target: {value} {unit}</div>

          <div className="rep-counter">
            <button className="rep-btn" onClick={() => setValue(v => Math.max(minValue, parseFloat((v - step).toFixed(1))))}>−</button>
            <span className="rep-value">{value}</span>
            <button className="rep-btn" onClick={() => setValue(v => parseFloat((v + step).toFixed(1)))}>+</button>
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
            <span className="sets-summary">{summaryText}</span>
          </div>

          {Object.entries(setsByExercise).map(([exerciseName, exSets]) => (
            <div key={exerciseName} className="sets-exercise-group">
              {Object.keys(setsByExercise).length > 1 && (
                <div className="sets-exercise-label">{exerciseName}</div>
              )}
              <ul className="sets-list">
                {exSets.map((s, i) => (
                  <li key={s.id} className="set-item set-item--tappable" onClick={() => openEditSet(s)}>
                    <span className="set-number">Set {exSets.length - i}</span>
                    <span className="set-time">{formatTime(s.timestamp)}</span>
                    <span className="set-reps">{formatSetValue(s)}</span>
                    <span className="set-edit-hint">✎</span>
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

      {editingSet && (
        <div className="edit-set-overlay" onClick={() => setEditingSet(null)}>
          <div className="edit-set-sheet" onClick={e => e.stopPropagation()}>
            <div className="edit-set-title">Edit Set</div>
            <div className="edit-set-meta">{editingSet.exerciseName} · {formatTime(editingSet.timestamp)}</div>
            <div className="rep-counter" style={{ margin: '1.25rem 0' }}>
              <button className="rep-btn" onClick={() => setEditValue(v => Math.max(0, parseFloat((v - (editingSet.trackingType === 'distance' ? 0.1 : 1)).toFixed(1))))}>−</button>
              <span className="rep-value">{editValue}</span>
              <button className="rep-btn" onClick={() => setEditValue(v => parseFloat((v + (editingSet.trackingType === 'distance' ? 0.1 : 1)).toFixed(1)))}>+</button>
            </div>
            <div className="edit-set-unit">{getUnit({ trackingType: editingSet.trackingType, durationUnit: editingSet.durationUnit } as any)}</div>
            <div className="edit-set-actions">
              <button className="log-btn" onClick={saveEditSet}>Save</button>
              <button className="edit-set-cancel" onClick={() => setEditingSet(null)}>Cancel</button>
            </div>
            <button className="edit-set-delete" onClick={confirmDeleteSet}>Delete set</button>
          </div>
        </div>
      )}
    </div>
  );
}
