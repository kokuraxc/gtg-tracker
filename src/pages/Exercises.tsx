import { useState } from 'react';
import './Exercises.css';

interface Exercise {
  id: number;
  name: string;
  trackingType: 'reps' | 'duration' | 'distance';
  supportsWeight: boolean;
  defaultReps?: number;
  defaultDuration?: number;
  durationUnit?: 'min' | 'sec';
  defaultDistance?: number;
}

function formatMeta(ex: Exercise) {
  const parts: string[] = [];
  if (ex.trackingType === 'reps' && ex.defaultReps) parts.push(`${ex.defaultReps} reps`);
  if (ex.trackingType === 'duration' && ex.defaultDuration) parts.push(`${ex.defaultDuration} ${ex.durationUnit}`);
  if (ex.trackingType === 'distance' && ex.defaultDistance) parts.push(`${ex.defaultDistance} km`);
  if (ex.supportsWeight) parts.push('weighted');
  return parts.join(' · ');
}

const DEFAULT_EXERCISES: Exercise[] = [
  { id: 1, name: 'Pull-up', trackingType: 'reps', supportsWeight: true, defaultReps: 5 },
  { id: 2, name: 'Push-up', trackingType: 'reps', supportsWeight: false, defaultReps: 20 },
  { id: 3, name: 'Chin-up', trackingType: 'reps', supportsWeight: true, defaultReps: 5 },
];

// Shared form fields component
function ExerciseForm({
  title,
  name, setName,
  trackingType, setTrackingType,
  supportsWeight, setSupportsWeight,
  defaultReps, setDefaultReps,
  defaultDuration, setDefaultDuration,
  durationUnit, setDurationUnit,
  defaultDistance, setDefaultDistance,
  nameEditable,
  onSave,
  onCancel,
  saveLabel = 'Save',
}: {
  title: string;
  name: string; setName: (v: string) => void;
  trackingType: 'reps' | 'duration' | 'distance'; setTrackingType: (v: 'reps' | 'duration' | 'distance') => void;
  supportsWeight: boolean; setSupportsWeight: (v: boolean) => void;
  defaultReps: number; setDefaultReps: (v: number) => void;
  defaultDuration: number; setDefaultDuration: (v: number) => void;
  durationUnit: 'min' | 'sec'; setDurationUnit: (v: 'min' | 'sec') => void;
  defaultDistance: number; setDefaultDistance: (v: number) => void;
  nameEditable: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  return (
    <div className="add-form">
      <h3>{title}</h3>

      <label className="field-label">Name</label>
      <input
        className="field-input"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Dips"
        disabled={!nameEditable}
        autoFocus={nameEditable}
      />

      <label className="field-label">Tracking</label>
      <div className="radio-group">
        {(['reps', 'duration', 'distance'] as const).map(t => (
          <label key={t} className="radio-option">
            <input
              type="radio"
              value={t}
              checked={trackingType === t}
              onChange={() => setTrackingType(t)}
            />
            {t}
          </label>
        ))}
      </div>

      {trackingType === 'reps' && (
        <div className="default-value-row">
          <label className="field-label">Default reps</label>
          <input
            type="number"
            className="field-input field-input--small"
            min={1}
            value={defaultReps}
            onChange={e => setDefaultReps(Number(e.target.value))}
          />
        </div>
      )}

      {trackingType === 'duration' && (
        <div className="default-value-row">
          <label className="field-label">Default duration</label>
          <div className="duration-row">
            <input
              type="number"
              className="field-input field-input--small"
              min={1}
              value={defaultDuration}
              onChange={e => setDefaultDuration(Number(e.target.value))}
            />
            <div className="unit-toggle">
              {(['sec', 'min'] as const).map(u => (
                <button
                  key={u}
                  type="button"
                  className={`unit-btn ${durationUnit === u ? 'unit-btn--active' : ''}`}
                  onClick={() => setDurationUnit(u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {trackingType === 'distance' && (
        <div className="default-value-row">
          <label className="field-label">Default distance (km)</label>
          <input
            type="number"
            className="field-input field-input--small"
            min={0.1}
            step={0.1}
            value={defaultDistance}
            onChange={e => setDefaultDistance(Number(e.target.value))}
          />
        </div>
      )}

      <label className="field-label checkbox-label">
        <input
          type="checkbox"
          checked={supportsWeight}
          onChange={e => setSupportsWeight(e.target.checked)}
        />
        Supports added weight
      </label>

      <div className="form-actions">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={onSave}>{saveLabel}</button>
      </div>
    </div>
  );
}

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>(DEFAULT_EXERCISES);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Shared form state (used for both add and edit)
  const [name, setName] = useState('');
  const [trackingType, setTrackingType] = useState<'reps' | 'duration' | 'distance'>('reps');
  const [supportsWeight, setSupportsWeight] = useState(false);
  const [defaultReps, setDefaultReps] = useState(5);
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [durationUnit, setDurationUnit] = useState<'min' | 'sec'>('sec');
  const [defaultDistance, setDefaultDistance] = useState(1);

  function formValues(ex: Exercise) {
    setName(ex.name);
    setTrackingType(ex.trackingType);
    setSupportsWeight(ex.supportsWeight);
    setDefaultReps(ex.defaultReps ?? 5);
    setDefaultDuration(ex.defaultDuration ?? 60);
    setDurationUnit(ex.durationUnit ?? 'sec');
    setDefaultDistance(ex.defaultDistance ?? 1);
  }

  function resetForm() {
    setName('');
    setTrackingType('reps');
    setSupportsWeight(false);
    setDefaultReps(5);
    setDefaultDuration(60);
    setDurationUnit('sec');
    setDefaultDistance(1);
  }

  function buildExerciseData(id: number): Exercise {
    return {
      id,
      name: name.trim(),
      trackingType,
      supportsWeight,
      defaultReps: trackingType === 'reps' ? defaultReps : undefined,
      defaultDuration: trackingType === 'duration' ? defaultDuration : undefined,
      durationUnit: trackingType === 'duration' ? durationUnit : undefined,
      defaultDistance: trackingType === 'distance' ? defaultDistance : undefined,
    };
  }

  function addExercise() {
    if (!name.trim()) return;
    setExercises(prev => [...prev, buildExerciseData(Date.now())]);
    resetForm();
    setShowAddForm(false);
  }

  function saveEdit() {
    if (editingId === null) return;
    setExercises(prev => prev.map(ex => ex.id === editingId ? buildExerciseData(editingId) : ex));
    setEditingId(null);
    resetForm();
  }

  function startEdit(ex: Exercise) {
    formValues(ex);
    setEditingId(ex.id);
    setShowAddForm(false);
  }

  const formProps = {
    name, setName,
    trackingType, setTrackingType,
    supportsWeight, setSupportsWeight,
    defaultReps, setDefaultReps,
    defaultDuration, setDefaultDuration,
    durationUnit, setDurationUnit,
    defaultDistance, setDefaultDistance,
  };

  return (
    <div className="exercises">
      <h2 className="exercises-title">Exercises</h2>

      <ul className="exercise-list">
        {exercises.map(ex => (
          <li key={ex.id}>
            {editingId === ex.id ? (
              <ExerciseForm
                title="Edit Exercise"
                {...formProps}
                nameEditable={false}
                onSave={saveEdit}
                onCancel={() => { setEditingId(null); resetForm(); }}
                saveLabel="Update"
              />
            ) : (
              <button className="exercise-item" onClick={() => startEdit(ex)}>
                <span className="exercise-item-name">{ex.name}</span>
                <span className="exercise-item-meta">{formatMeta(ex)}</span>
              </button>
            )}
          </li>
        ))}
      </ul>

      {showAddForm ? (
        <ExerciseForm
          title="New Exercise"
          {...formProps}
          nameEditable={true}
          onSave={addExercise}
          onCancel={() => { resetForm(); setShowAddForm(false); }}
        />
      ) : (
        !editingId && (
          <button className="add-exercise-btn" onClick={() => { resetForm(); setShowAddForm(true); }}>
            + Add Exercise
          </button>
        )
      )}
    </div>
  );
}
