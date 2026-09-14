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

export async function seedDefaultExercises(): Promise<void> {
  // Only seed once — never re-seed after user deletes data
  if (localStorage.getItem('gtg-seeded') === '1') return;
  const count = await db.exercises.count();
  if (count > 0) { localStorage.setItem('gtg-seeded', '1'); return; }

  const now = new Date();
  const defaults: Omit<Exercise, 'id'>[] = [
    {
      name: 'Pull-up', category: 'strength', trackingType: 'reps',
      supportsWeight: true, supportsReps: true, supportsDuration: false, supportsDistance: false,
      defaultReps: 5, gtgEnabled: true, gtgMinIntervalMinutes: 60, gtgMaxSetsPerDay: 6,
      sortOrder: 0, createdAt: now, updatedAt: now, archived: false,
    },
    {
      name: 'Push-up', category: 'strength', trackingType: 'reps',
      supportsWeight: false, supportsReps: true, supportsDuration: false, supportsDistance: false,
      defaultReps: 20, gtgEnabled: false, gtgMinIntervalMinutes: 60, gtgMaxSetsPerDay: 6,
      sortOrder: 1, createdAt: now, updatedAt: now, archived: false,
    },
    {
      name: 'Chin-up', category: 'strength', trackingType: 'reps',
      supportsWeight: true, supportsReps: true, supportsDuration: false, supportsDistance: false,
      defaultReps: 5, gtgEnabled: false, gtgMinIntervalMinutes: 60, gtgMaxSetsPerDay: 6,
      sortOrder: 2, createdAt: now, updatedAt: now, archived: false,
    },
  ];

  await db.exercises.bulkAdd(defaults as Exercise[]);
  localStorage.setItem('gtg-seeded', '1');
}
