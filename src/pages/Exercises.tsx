import { useState, useEffect, useRef } from 'react';
import { getAllExercises, addExercise as dbAddExercise, updateExercise as dbUpdateExercise, seedDefaultExercises, saveExerciseOrder } from '../db/exercises';
import { db } from '../db/database';
import type { Exercise } from '../models/Exercise';
import './Exercises.css';

function formatMeta(ex: Exercise) {
  const parts: string[] = [];
  if (ex.trackingType === 'reps' && ex.defaultReps) parts.push(`${ex.defaultReps} reps`);
  if (ex.trackingType === 'duration' && ex.defaultDuration) parts.push(`${ex.defaultDuration} ${ex.durationUnit}`);
  if (ex.trackingType === 'distance' && ex.defaultDistance) parts.push(`${ex.defaultDistance} km`);
  if (ex.supportsWeight) parts.push('weighted');
  if (ex.gtgEnabled) parts.push('GTG');
  return parts.join(' · ');
}

function ExerciseForm({
  title,
  name, setName,
  trackingType, setTrackingType,
  supportsWeight, setSupportsWeight,
  defaultReps, setDefaultReps,
  defaultDuration, setDefaultDuration,
  durationUnit, setDurationUnit,
  defaultDistance, setDefaultDistance,
  gtgEnabled, setGtgEnabled,
  gtgMinInterval, setGtgMinInterval,
  gtgMaxSets, setGtgMaxSets,
  nameEditable,
  onSave,
  onCancel,
  onDelete,
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
  gtgEnabled: boolean; setGtgEnabled: (v: boolean) => void;
  gtgMinInterval: number; setGtgMinInterval: (v: number) => void;
  gtgMaxSets: number; setGtgMaxSets: (v: number) => void;
  nameEditable: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
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
            <input type="radio" value={t} checked={trackingType === t} onChange={() => setTrackingType(t)} />
            {t}
          </label>
        ))}
      </div>

      {trackingType === 'reps' && (
        <div className="default-value-row">
          <label className="field-label">Default reps</label>
          <input type="number" className="field-input field-input--small" min={1} value={defaultReps}
            onChange={e => setDefaultReps(Number(e.target.value))} />
        </div>
      )}

      {trackingType === 'duration' && (
        <div className="default-value-row">
          <label className="field-label">Default duration</label>
          <div className="duration-row">
            <input type="number" className="field-input field-input--small" min={1} value={defaultDuration}
              onChange={e => setDefaultDuration(Number(e.target.value))} />
            <div className="unit-toggle">
              {(['sec', 'min'] as const).map(u => (
                <button key={u} type="button"
                  className={`unit-btn ${durationUnit === u ? 'unit-btn--active' : ''}`}
                  onClick={() => setDurationUnit(u)}>{u}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {trackingType === 'distance' && (
        <div className="default-value-row">
          <label className="field-label">Default distance (km)</label>
          <input type="number" className="field-input field-input--small" min={0.1} step={0.1} value={defaultDistance}
            onChange={e => setDefaultDistance(Number(e.target.value))} />
        </div>
      )}

      <label className="field-label checkbox-label">
        <input type="checkbox" checked={supportsWeight} onChange={e => setSupportsWeight(e.target.checked)} />
        Supports added weight
      </label>

      <div className="form-section-divider" />

      <label className="field-label checkbox-label">
        <input type="checkbox" checked={gtgEnabled} onChange={e => setGtgEnabled(e.target.checked)} />
        Enable GTG protocol
      </label>

      {gtgEnabled && (
        <>
          <div className="default-value-row">
            <label className="field-label">Min interval (min)</label>
            <input type="number" className="field-input field-input--small" min={1}
              value={gtgMinInterval} onChange={e => setGtgMinInterval(Number(e.target.value))} />
          </div>
          <div className="default-value-row">
            <label className="field-label">Max sets/day</label>
            <input type="number" className="field-input field-input--small" min={1}
              value={gtgMaxSets} onChange={e => setGtgMaxSets(Number(e.target.value))} />
          </div>
        </>
      )}

      <div className="form-actions">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={onSave}>{saveLabel}</button>
      </div>

      {onDelete && (
        <button className="btn-delete" onClick={onDelete}>Delete Exercise</button>
      )}
    </div>
  );
}

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [trackingType, setTrackingType] = useState<'reps' | 'duration' | 'distance'>('reps');
  const [supportsWeight, setSupportsWeight] = useState(false);
  const [defaultReps, setDefaultReps] = useState(5);
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [durationUnit, setDurationUnit] = useState<'min' | 'sec'>('sec');
  const [defaultDistance, setDefaultDistance] = useState(1);
  const [gtgEnabled, setGtgEnabled] = useState(false);
  const [gtgMinInterval, setGtgMinInterval] = useState(60);
  const [gtgMaxSets, setGtgMaxSets] = useState(6);

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    seedDefaultExercises().then(loadExercises);
  }, []);

  async function loadExercises() {
    const all = await getAllExercises();
    setExercises(all);
  }

  function resetForm() {
    setName(''); setTrackingType('reps'); setSupportsWeight(false);
    setDefaultReps(5); setDefaultDuration(60); setDurationUnit('sec'); setDefaultDistance(1);
    setGtgEnabled(false); setGtgMinInterval(60); setGtgMaxSets(6);
  }

  function populateForm(ex: Exercise) {
    setName(ex.name); setTrackingType(ex.trackingType); setSupportsWeight(ex.supportsWeight);
    setDefaultReps(ex.defaultReps ?? 5); setDefaultDuration(ex.defaultDuration ?? 60);
    setDurationUnit(ex.durationUnit ?? 'sec'); setDefaultDistance(ex.defaultDistance ?? 1);
    setGtgEnabled(ex.gtgEnabled ?? false);
    setGtgMinInterval(ex.gtgMinIntervalMinutes ?? 60);
    setGtgMaxSets(ex.gtgMaxSetsPerDay ?? 6);
  }

  function buildPayload() {
    const now = new Date();
    return {
      trackingType,
      supportsWeight,
      supportsReps: trackingType === 'reps',
      supportsDuration: trackingType === 'duration',
      supportsDistance: trackingType === 'distance',
      defaultReps: trackingType === 'reps' ? defaultReps : undefined,
      defaultDuration: trackingType === 'duration' ? defaultDuration : undefined,
      durationUnit: trackingType === 'duration' ? durationUnit : undefined,
      defaultDistance: trackingType === 'distance' ? defaultDistance : undefined,
      gtgEnabled,
      gtgMinIntervalMinutes: gtgMinInterval,
      gtgMaxSetsPerDay: gtgMaxSets,
      updatedAt: now,
    };
  }

  async function addExercise() {
    if (!name.trim()) return;
    const now = new Date();
    await dbAddExercise({
      name: name.trim(),
      category: 'strength',
      ...buildPayload(),
      sortOrder: exercises.length,
      gtgEnabled,
      gtgMinIntervalMinutes: gtgMinInterval,
      gtgMaxSetsPerDay: gtgMaxSets,
      createdAt: now,
      updatedAt: now,
      archived: false,
    });
    resetForm();
    setShowAddForm(false);
    loadExercises();
  }

  // ── Drag handlers ──────────────────────────────────────────
  function onDragStart(i: number) {
    dragIndex.current = i;
  }

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOverIndex(i);
  }

  async function onDrop(i: number) {
    const from = dragIndex.current;
    if (from === null || from === i) { setDragOverIndex(null); return; }
    const reordered = [...exercises];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(i, 0, moved);
    setExercises(reordered);
    setDragOverIndex(null);
    dragIndex.current = null;
    await saveExerciseOrder(reordered);
  }

  function onDragEnd() {
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  // Touch drag
  const touchDragIndex = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  function onTouchStart(i: number) {
    touchDragIndex.current = i;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchDragIndex.current === null || !listRef.current) return;
    const touch = e.touches[0];
    const items = listRef.current.querySelectorAll<HTMLElement>('[data-index]');
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const idx = Number(item.dataset.index);
        setDragOverIndex(idx);
        break;
      }
    }
  }

  async function onTouchEnd() {
    const from = touchDragIndex.current;
    if (from === null || dragOverIndex === null || from === dragOverIndex) {
      touchDragIndex.current = null;
      setDragOverIndex(null);
      return;
    }
    const reordered = [...exercises];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(dragOverIndex, 0, moved);
    setExercises(reordered);
    touchDragIndex.current = null;
    setDragOverIndex(null);
    await saveExerciseOrder(reordered);
  }

  async function saveEdit() {
    if (editingId === null) return;
    await dbUpdateExercise(editingId, buildPayload());
    setEditingId(null);
    resetForm();
    loadExercises();
  }

  async function deleteExercise() {
    if (editingId === null) return;
    if (!confirm('Delete this exercise? Its history will be kept.')) return;
    await db.exercises.update(editingId, { archived: true });
    setEditingId(null);
    resetForm();
    loadExercises();
  }

  function startEdit(ex: Exercise) {
    populateForm(ex);
    setEditingId(ex.id!);
    setShowAddForm(false);
  }

  const formProps = {
    name, setName, trackingType, setTrackingType,
    supportsWeight, setSupportsWeight,
    defaultReps, setDefaultReps,
    defaultDuration, setDefaultDuration,
    durationUnit, setDurationUnit,
    defaultDistance, setDefaultDistance,
    gtgEnabled, setGtgEnabled,
    gtgMinInterval, setGtgMinInterval,
    gtgMaxSets, setGtgMaxSets,
  };

  return (
    <div className="exercises">
      <h2 className="exercises-title">Exercises</h2>

      <ul className="exercise-list" ref={listRef} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {exercises.map((ex, i) => (
          <li
            key={ex.id}
            data-index={i}
            className={`exercise-list-item ${dragOverIndex === i ? 'exercise-list-item--over' : ''}`}
            draggable={!editingId}
            onDragStart={() => onDragStart(i)}
            onDragOver={e => onDragOver(e, i)}
            onDrop={() => onDrop(i)}
            onDragEnd={onDragEnd}
          >
            {editingId === ex.id ? (
              <ExerciseForm title="Edit Exercise" {...formProps} nameEditable={false}
                onSave={saveEdit} onCancel={() => { setEditingId(null); resetForm(); }}
                onDelete={deleteExercise} saveLabel="Update" />
            ) : (
              <div className="exercise-item-row">
                <span
                  className="drag-handle"
                  onTouchStart={() => onTouchStart(i)}
                  onMouseDown={e => e.stopPropagation()}
                >☰</span>
                <button className="exercise-item" onClick={() => startEdit(ex)}>
                  <span className="exercise-item-name">{ex.name}</span>
                  <span className="exercise-item-meta">{formatMeta(ex)}</span>
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {showAddForm ? (
        <ExerciseForm title="New Exercise" {...formProps} nameEditable={true}
          onSave={addExercise} onCancel={() => { resetForm(); setShowAddForm(false); }} />
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
