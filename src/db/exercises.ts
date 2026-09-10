import { db } from './database';
import type { Exercise } from '../models/Exercise';

export async function getAllExercises(): Promise<Exercise[]> {
  return db.exercises.filter(ex => !ex.archived).toArray();
}

export async function getExerciseById(id: number): Promise<Exercise | undefined> {
  return db.exercises.get(id);
}

export async function addExercise(exercise: Omit<Exercise, 'id'>): Promise<number> {
  return db.exercises.add(exercise as Exercise);
}

export async function updateExercise(id: number, changes: Partial<Exercise>): Promise<void> {
  await db.exercises.update(id, { ...changes, updatedAt: new Date() });
}

export async function seedDefaultExercises(): Promise<void> {
  const count = await db.exercises.count();
  if (count > 0) return;

  const now = new Date();
  const defaults: Omit<Exercise, 'id'>[] = [
    {
      name: 'Pull-up',
      category: 'strength',
      trackingType: 'reps',
      supportsWeight: true,
      supportsReps: true,
      supportsDuration: false,
      supportsDistance: false,
      defaultReps: 5,
      createdAt: now,
      updatedAt: now,
      archived: false,
    },
    {
      name: 'Push-up',
      category: 'strength',
      trackingType: 'reps',
      supportsWeight: false,
      supportsReps: true,
      supportsDuration: false,
      supportsDistance: false,
      defaultReps: 20,
      createdAt: now,
      updatedAt: now,
      archived: false,
    },
    {
      name: 'Chin-up',
      category: 'strength',
      trackingType: 'reps',
      supportsWeight: true,
      supportsReps: true,
      supportsDuration: false,
      supportsDistance: false,
      defaultReps: 5,
      createdAt: now,
      updatedAt: now,
      archived: false,
    },
  ];

  await db.exercises.bulkAdd(defaults as Exercise[]);
}
