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
  }
}

export const db = new GTGDatabase();
