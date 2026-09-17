import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface ExerciseCardProps {
  exercise: Exercise;
  todaySets: SetWithExercise[];
  onRefresh: () => Promise<void>;
}

function ExerciseCard({ exercise, todaySets, onRefresh }: ExerciseCardProps) {
  const [value, setValue] = useState(getDefaultValue(exercise));
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [justLogged, setJustLogged] = useState(false);
  const [showSets, setShowSets] = useState(false);
  const [editingSet, setEditingSet] = useState<SetWithExercise | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const unit = getUnit(exercise);
  const step = exercise.trackingType === 'distance' ? 0.1 : 1;
  const minValue = exercise.trackingType === 'distance' ? 0.1 : 1;

  async function logSet() {
    const sid = sessionId ?? await getOrCreateTodaySession(exercise.id!);
    setSessionId(sid);
    const setData: Omit<WorkoutSet, 'id'> = {
      sessionId: sid,
      setNumber: todaySets.length + 1,
      timestamp: new Date(),
    };
    if (exercise.trackingType === 'reps') setData.reps = value;
    else if (exercise.trackingType === 'duration') setData.duration = value;
    else if (exercise.trackingType === 'distance') setData.distance = value;

    await addSet(setData);
    navigator.vibrate?.(50);
    await onRefresh();
    setSessionId(sid);
    setShowSets(true);
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1500);
  }

  function openEditSet(s: SetWithExercise) {
    setConfirmingDelete(false);
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
    await onRefresh();
  }

  async function doDeleteSet() {
    if (!editingSet?.id) return;
    await deleteSet(editingSet.id);
    setEditingSet(null);
    setConfirmingDelete(false);
    await onRefresh();
  }

  const repsTotal = todaySets
    .filter(s => s.trackingType === 'reps')
    .reduce((sum, s) => sum + (s.reps ?? 0), 0);

  const summaryText = todaySets.length > 0
    ? exercise.trackingType === 'reps'
      ? `${todaySets.length} sets · ${repsTotal} reps`
      : `${todaySets.length} sets`
    : '';

  return (
    <div className="ex-card">
      {/* Card Header */}
      <div className="ex-card-header">
        <span className="ex-card-name">{exercise.name}</span>
        {summaryText ? (
          <button
            className={`ex-card-summary-btn${showSets ? ' ex-card-summary-btn--open' : ''}`}
            onClick={() => setShowSets(v => !v)}
          >
            {summaryText} <span className="ex-card-chevron">▾</span>
          </button>
        ) : null}
      </div>

      {/* GTG Status — compact (no title, since card header has the name) */}
      {exercise.gtgEnabled && (
        <GtgStatus exercise={exercise} todaySets={todaySets} compact />
      )}

      {/* Rep Counter + Log Button — same row */}
      <div className="ex-card-log">
        <div className="rep-counter">
          <button
            className="rep-btn"
            onClick={() => setValue(v => Math.max(minValue, parseFloat((v - step).toFixed(1))))}
          >−</button>
          <span className="rep-value-group">
            <span className="rep-value">{value}</span>
            <span className="rep-unit">{unit}</span>
          </span>
          <button
            className="rep-btn"
            onClick={() => setValue(v => parseFloat((v + step).toFixed(1)))}
          >+</button>
        </div>
        <button
          className={`log-btn ${justLogged ? 'log-btn--success' : ''}`}
          onClick={logSet}
        >
          {justLogged ? '✓ Logged!' : 'LOG SET'}
        </button>
      </div>

      {/* Today's Sets — toggled by summary button */}
      {todaySets.length > 0 && showSets && (
        <div className="ex-card-sets">
          <ul className="sets-list">
            {todaySets.map((s, i) => (
              <li key={s.id} className="set-item set-item--tappable" onClick={() => openEditSet(s)}>
                <span className="set-number">Set {todaySets.length - i}</span>
                <span className="set-time">{formatTime(s.timestamp)}</span>
                <span className="set-reps">{formatSetValue(s)}</span>
                <span className="set-edit-hint">✎</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Edit Set bottom sheet */}
      {editingSet && createPortal(
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
            {confirmingDelete ? (
              <div className="edit-set-confirm">
                <span>Delete this set?</span>
                <div className="edit-set-confirm-btns">
                  <button className="edit-set-confirm-yes" onClick={doDeleteSet}>Delete</button>
                  <button className="edit-set-cancel" onClick={() => setConfirmingDelete(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="edit-set-delete" onClick={() => setConfirmingDelete(true)}>Delete set</button>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  );
}

export default function Today() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [allTodaySets, setAllTodaySets] = useState<SetWithExercise[]>([]);

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
    // newest first so set numbers render correctly inside each card
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setAllTodaySets(result);
  }, []);

  useEffect(() => {
    getAllExercises().then(list => {
      setExercises(list);
      loadAllTodaySets(list);
    });
  }, [loadAllTodaySets]);

  async function refreshSets() {
    await loadAllTodaySets(exercises);
  }

  return (
    <div className="today">
      <h2 className="today-title">Today</h2>
      {exercises.length === 0 && (
        <p className="no-sets">No exercises yet — add some in the Exercises tab.</p>
      )}
      {exercises.map(ex => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          todaySets={allTodaySets.filter(s => s.exerciseName === ex.name)}
          onRefresh={refreshSets}
        />
      ))}
    </div>
  );
}
