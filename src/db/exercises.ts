import { db } from './database';
import type { Exercise } from '../models/Exercise';

export async function getAllExercises(): Promise<Exercise[]> {
  const all = await db.exercises.filter(ex => !ex.archived).toArray();
  return all.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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

export async function saveExerciseOrder(ordered: Exercise[]): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    for (let i = 0; i < ordered.length; i++) {
      await db.exercises.update(ordered[i].id!, { sortOrder: i });
    }
  });
}
