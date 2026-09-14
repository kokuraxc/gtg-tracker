import { db } from './database';
import type { WorkoutSet } from '../models/WorkoutSet';

export async function addSet(set: Omit<WorkoutSet, 'id'>): Promise<number> {
  return db.sets.add(set as WorkoutSet);
}

export async function getSetsBySession(sessionId: number): Promise<WorkoutSet[]> {
  return db.sets.where('sessionId').equals(sessionId).sortBy('timestamp');
}

export async function getTodaySets(sessionId: number): Promise<WorkoutSet[]> {
  return db.sets.where('sessionId').equals(sessionId).sortBy('timestamp');
}

export async function getAllSetsForExercise(sessionIds: number[]): Promise<WorkoutSet[]> {
  return db.sets.where('sessionId').anyOf(sessionIds).toArray();
}

export async function getLastSet(sessionIds: number[]): Promise<WorkoutSet | undefined> {
  const sets = await db.sets.where('sessionId').anyOf(sessionIds).reverse().sortBy('timestamp');
  return sets[0];
}

export async function updateSet(id: number, changes: Partial<WorkoutSet>): Promise<void> {
  await db.sets.update(id, changes);
}

export async function deleteSet(id: number): Promise<void> {
  await db.sets.delete(id);
}
