import { useState } from 'react';
import './Exercises.css';

interface Exercise {
  id: number;
  name: string;
  trackingType: 'reps' | 'duration' | 'distance';
  supportsWeight: boolean;
}

const DEFAULT_EXERCISES: Exercise[] = [
  { id: 1, name: 'Pull-up', trackingType: 'reps', supportsWeight: true },
  { id: 2, name: 'Push-up', trackingType: 'reps', supportsWeight: false },
  { id: 3, name: 'Chin-up', trackingType: 'reps', supportsWeight: true },
];

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>(DEFAULT_EXERCISES);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [trackingType, setTrackingType] = useState<'reps' | 'duration' | 'distance'>('reps');
  const [supportsWeight, setSupportsWeight] = useState(false);

  function addExercise() {
    if (!name.trim()) return;
    setExercises(prev => [...prev, {
      id: Date.now(),
      name: name.trim(),
      trackingType,
      supportsWeight,
    }]);
    setName('');
    setTrackingType('reps');
    setSupportsWeight(false);
    setShowForm(false);
  }

  return (
    <div className="exercises">
      <h2 className="exercises-title">Exercises</h2>

      <ul className="exercise-list">
        {exercises.map(ex => (
          <li key={ex.id} className="exercise-item">
            <span className="exercise-item-name">{ex.name}</span>
            <span className="exercise-item-meta">
              {ex.trackingType}{ex.supportsWeight ? ' · weighted' : ''}
            </span>
          </li>
        ))}
      </ul>

      {showForm ? (
        <div className="add-form">
          <h3>New Exercise</h3>

          <label className="field-label">Name</label>
          <input
            className="field-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Dips"
            autoFocus
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

          <label className="field-label checkbox-label">
            <input
              type="checkbox"
              checked={supportsWeight}
              onChange={e => setSupportsWeight(e.target.checked)}
            />
            Supports added weight
          </label>

          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" onClick={addExercise}>Save</button>
          </div>
        </div>
      ) : (
        <button className="add-exercise-btn" onClick={() => setShowForm(true)}>
          + Add Exercise
        </button>
      )}
    </div>
  );
}
