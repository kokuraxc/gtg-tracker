import Dexie, { type Table } from 'dexie';
import type { Exercise } from '../models/Exercise';
import type { WorkoutSession } from '../models/WorkoutSession';
import type { WorkoutSet } from '../models/WorkoutSet';

/** Record of a locally deleted row, so the deletion can be synced to other devices. */
export interface Tombstone {
  id?: number;
  kind: 'exercises' | 'sessions' | 'sets';
  uuid: string;
  deletedAt: number;
}

/** Shared switches between the DB layer and the sync service. */
export const syncControl: {
  /** true while remote changes are being applied (hooks must not re-stamp records) */
  suppress: boolean;
  /** called after any local write that should trigger a sync */
  onLocalChange: (() => void) | null;
} = { suppress: false, onLocalChange: null };

export class GTGDatabase extends Dexie {
  exercises!: Table<Exercise>;
  sessions!: Table<WorkoutSession>;
  sets!: Table<WorkoutSet>;
  tombstones!: Table<Tombstone>;

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
    // Version 3: add GTG config fields
    this.version(3).stores({
      exercises: '++id, name, category, archived, sortOrder',
      sessions: '++id, exerciseId, startedAt, protocol',
      sets: '++id, sessionId, timestamp',
    }).upgrade(tx => {
      return tx.table('exercises').toCollection().modify((ex, ref) => {
        if (ex.gtgEnabled == null) ref.value.gtgEnabled = false;
        if (ex.gtgMinIntervalMinutes == null) ref.value.gtgMinIntervalMinutes = 60;
        if (ex.gtgMaxSetsPerDay == null) ref.value.gtgMaxSetsPerDay = 6;
      });
    });
    // Version 4: cross-device sync — stable uuid + modifiedAt on every record, tombstones for deletes
    this.version(4).stores({
      exercises: '++id, name, category, archived, sortOrder, uuid',
      sessions: '++id, exerciseId, startedAt, protocol, uuid',
      sets: '++id, sessionId, timestamp, uuid',
      tombstones: '++id, uuid',
    }).upgrade(async tx => {
      const toMs = (d: unknown) =>
        d instanceof Date ? d.getTime() : typeof d === 'number' ? d : Date.now();
      await tx.table('exercises').toCollection().modify((r, ref) => {
        ref.value.uuid = r.uuid ?? crypto.randomUUID();
        ref.value.modifiedAt = r.modifiedAt ?? toMs(r.updatedAt);
      });
      await tx.table('sessions').toCollection().modify((r, ref) => {
        ref.value.uuid = r.uuid ?? crypto.randomUUID();
        ref.value.modifiedAt = r.modifiedAt ?? toMs(r.startedAt);
      });
      await tx.table('sets').toCollection().modify((r, ref) => {
        ref.value.uuid = r.uuid ?? crypto.randomUUID();
        ref.value.modifiedAt = r.modifiedAt ?? toMs(r.timestamp);
      });
    });

    // Auto-stamp uuid / modifiedAt on every local write.
    for (const table of [this.exercises, this.sessions, this.sets] as Table<any>[]) {
      table.hook('creating', (_pk, obj) => {
        if (syncControl.suppress) return;
        obj.uuid = obj.uuid ?? crypto.randomUUID();
        obj.modifiedAt = Date.now();
        syncControl.onLocalChange?.();
      });
      table.hook('updating', () => {
        if (syncControl.suppress) return undefined;
        syncControl.onLocalChange?.();
        return { modifiedAt: Date.now() };
      });
    }
  }
}

export const db = new GTGDatabase();

/**
 * Replace ALL local data (used by import and "delete all").
 * Existing rows are recorded as tombstones so the deletion propagates to other devices;
 * tombstones for rows that reappear (same uuid) are dropped at sync time.
 */
export async function replaceAllData(data?: {
  exercises: Exercise[];
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
}): Promise<void> {
  await db.transaction('rw', db.exercises, db.sessions, db.sets, db.tombstones, async () => {
    const now = Date.now();
    const kinds = [
      ['exercises', db.exercises],
      ['sessions', db.sessions],
      ['sets', db.sets],
    ] as const;
    for (const [kind, table] of kinds) {
      const rows = await (table as Table<any>).toArray();
      await db.tombstones.bulkAdd(
        rows.filter(r => r.uuid).map(r => ({ kind, uuid: r.uuid as string, deletedAt: now }))
      );
    }
    await db.exercises.clear();
    await db.sessions.clear();
    await db.sets.clear();
    if (data) {
      await db.exercises.bulkAdd(data.exercises);
      await db.sessions.bulkAdd(data.sessions);
      await db.sets.bulkAdd(data.sets);
    }
  });
  syncControl.onLocalChange?.();
}
