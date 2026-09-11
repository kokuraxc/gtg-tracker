import Dexie, { type Table } from 'dexie';
import type { Exercise } from '../models/Exercise';
import type { WorkoutSession } from '../models/WorkoutSession';
import type { WorkoutSet } from '../models/WorkoutSet';

export class GTGDatabase extends Dexie {
  exercises!: Table<Exercise>;
  sessions!: Table<WorkoutSession>;
  sets!: Table<WorkoutSet>;

  constructor() {
    super('gtg-tracker');
    this.version(1).stores({
      exercises: '++id, name, category, archived',
      sessions: '++id, exerciseId, startedAt, protocol',
      sets: '++id, sessionId, timestamp',
    });
    // Version 2: add sortOrder index
    this.version(2).stores({
      exercises: '++id, name, category, archived, sortOrder',
      sessions: '++id, exerciseId, startedAt, protocol',
      sets: '++id, sessionId, timestamp',
    }).upgrade(tx => {
      return tx.table('exercises').toCollection().modify((ex, ref) => {
        if (ex.sortOrder == null) ref.value.sortOrder = ex.id ?? 0;
      });
    });
  }
}

export const db = new GTGDatabase();
