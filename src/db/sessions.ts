import { db } from './database';
import type { WorkoutSession } from '../models/WorkoutSession';

export async function addSession(session: Omit<WorkoutSession, 'id'>): Promise<number> {
  return db.sessions.add(session as WorkoutSession);
}

export async function getSessionsByExercise(exerciseId: number): Promise<WorkoutSession[]> {
  return db.sessions.where('exerciseId').equals(exerciseId).reverse().sortBy('startedAt');
}

export async function getTodaySessions(): Promise<WorkoutSession[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return db.sessions.where('startedAt').between(start, end).toArray();
}

export async function getOrCreateTodaySession(exerciseId: number, protocol = 'GTG'): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const existing = await db.sessions
    .where('startedAt').between(start, end)
    .and(s => s.exerciseId === exerciseId && s.protocol === protocol)
    .first();

  if (existing?.id) return existing.id;

  return db.sessions.add({
    exerciseId,
    startedAt: new Date(),
    protocol,
  } as WorkoutSession);
}

export async function getAllSessions(): Promise<WorkoutSession[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray();
}
