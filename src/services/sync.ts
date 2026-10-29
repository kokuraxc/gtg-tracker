import { db, syncControl } from '../db/database';
import type { Exercise } from '../models/Exercise';
import type { WorkoutSession } from '../models/WorkoutSession';
import type { WorkoutSet } from '../models/WorkoutSet';

const SYNC_URL = (import.meta.env.VITE_SYNC_URL as string | undefined)?.replace(/\/$/, '');

const K_KEY = 'gtg-sync-key';
const K_CURSOR = 'gtg-sync-cursor';
const K_LASTPUSH = 'gtg-sync-lastpush';
const K_LASTAT = 'gtg-sync-last-at';
const K_ERROR = 'gtg-sync-error';

type Kind = 'exercises' | 'sessions' | 'sets';
const KIND_ORDER: Kind[] = ['exercises', 'sessions', 'sets'];

interface WireRecord {
  kind: Kind;
  uuid: string;
  modifiedAt: number;
  deleted?: boolean;
  data?: string; // JSON (dates encoded as {$d: ms}); omitted for deletions
}

interface SyncResponse {
  records: WireRecord[];
  cursor: number;
  more: boolean;
}

// ── JSON with Date support ────────────────────────────────
function stringify(obj: unknown): string {
  return JSON.stringify(obj, function (this: any, k, v) {
    const raw = this[k];
    return raw instanceof Date ? { $d: raw.getTime() } : v;
  });
}
function parse<T>(s: string): T {
  return JSON.parse(s, (_k, v) =>
    v && typeof v === 'object' && '$d' in v ? new Date(v.$d as number) : v
  ) as T;
}

// ── Config / state ────────────────────────────────────────
export const syncConfigured = () => !!SYNC_URL;
export const getSyncKey = () => localStorage.getItem(K_KEY);
export const getLastSyncAt = () => Number(localStorage.getItem(K_LASTAT) ?? 0) || null;
export const getLastSyncError = () => localStorage.getItem(K_ERROR);

function emitStatus() {
  window.dispatchEvent(new Event('gtg-sync-status'));
}

export function setSyncKey(key: string) {
  const k = key.trim();
  if (!/^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/.test(k)) throw new Error('That does not look like a sync key.');
  if (k !== getSyncKey()) {
    localStorage.setItem(K_KEY, k);
    localStorage.removeItem(K_CURSOR);
    localStorage.removeItem(K_LASTPUSH);
    localStorage.removeItem(K_LASTAT);
    localStorage.removeItem(K_ERROR);
  }
  emitStatus();
  scheduleSync(0);
}

/** Stop syncing on this device. Local data is kept. */
export function disconnectSync() {
  for (const k of [K_KEY, K_CURSOR, K_LASTPUSH, K_LASTAT, K_ERROR]) localStorage.removeItem(k);
  emitStatus();
}

// ── Network ───────────────────────────────────────────────
async function request(since: number | null, records: WireRecord[]): Promise<SyncResponse> {
  if (!SYNC_URL) throw new Error('Sync is not configured in this build.');
  const res = await fetch(`${SYNC_URL}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSyncKey()}` },
    body: JSON.stringify({ since, records }),
  });
  if (res.status === 401) throw new Error('Sync key rejected.');
  if (!res.ok) throw new Error(`Sync server error (${res.status}).`);
  return res.json();
}

// ── Apply remote changes ──────────────────────────────────
async function applyRemote(
  recs: WireRecord[],
  firstSync: boolean,
  unresolved: WireRecord[]
): Promise<number> {
  let changes = 0;
  const sorted = [...recs].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

  await db.transaction('rw', db.exercises, db.sessions, db.sets, db.tombstones, async () => {
    syncControl.suppress = true;
    try {
      const tomb = new Map<string, number>();
      for (const t of await db.tombstones.toArray()) tomb.set(`${t.kind}:${t.uuid}`, t.deletedAt);

      const exByUuid = new Map<string, Exercise>();
      const seByUuid = new Map<string, WorkoutSession>();
      const stByUuid = new Map<string, WorkoutSet>();
      for (const e of await db.exercises.toArray()) if (e.uuid) exByUuid.set(e.uuid, e);
      for (const s of await db.sessions.toArray()) if (s.uuid) seByUuid.set(s.uuid, s);
      for (const s of await db.sets.toArray()) if (s.uuid) stByUuid.set(s.uuid, s);
      const exByName = new Map<string, Exercise>();
      if (firstSync) for (const e of exByUuid.values()) exByName.set(e.name.trim().toLowerCase(), e);

      for (const r of sorted) {
        const deletedLocallyAt = tomb.get(`${r.kind}:${r.uuid}`);
        if (deletedLocallyAt != null && deletedLocallyAt >= r.modifiedAt) continue;

        // ── deletions ──
        if (r.deleted) {
          const [map, table] =
            r.kind === 'sets' ? [stByUuid, db.sets] :
            r.kind === 'sessions' ? [seByUuid, db.sessions] :
            [exByUuid, db.exercises];
          const l = map.get(r.uuid) as { id?: number; modifiedAt?: number } | undefined;
          if (l && (l.modifiedAt ?? 0) < r.modifiedAt) {
            await table.delete(l.id!);
            map.delete(r.uuid);
            changes++;
          }
          continue;
        }
        if (!r.data) continue;

        if (r.kind === 'exercises') {
          const d = parse<Exercise>(r.data);
          let local = exByUuid.get(r.uuid);
          let force = false;
          if (!local && firstSync) {
            // seeded defaults on a fresh device: adopt the remote identity instead of duplicating
            const byName = exByName.get(d.name.trim().toLowerCase());
            if (byName && byName.uuid !== r.uuid) {
              exByUuid.delete(byName.uuid!);
              local = byName;
              force = true;
            }
          }
          if (local && !force && (local.modifiedAt ?? 0) >= r.modifiedAt) continue;
          const row: Exercise = { ...d, uuid: r.uuid, modifiedAt: r.modifiedAt };
          if (local) { row.id = local.id; await db.exercises.put(row); }
          else row.id = await db.exercises.add(row);
          exByUuid.set(r.uuid, row);
          changes++;
        } else if (r.kind === 'sessions') {
          const d = parse<WorkoutSession & { exerciseUuid: string }>(r.data);
          const parent = exByUuid.get(d.exerciseUuid);
          if (!parent) { unresolved.push(r); continue; }
          const local = seByUuid.get(r.uuid);
          if (local && (local.modifiedAt ?? 0) >= r.modifiedAt) continue;
          const { exerciseUuid: _x, ...rest } = d;
          const row: WorkoutSession = { ...rest, exerciseId: parent.id!, uuid: r.uuid, modifiedAt: r.modifiedAt };
          if (local) { row.id = local.id; await db.sessions.put(row); }
          else row.id = await db.sessions.add(row);
          seByUuid.set(r.uuid, row);
          changes++;
        } else {
          const d = parse<WorkoutSet & { sessionUuid: string }>(r.data);
          const parent = seByUuid.get(d.sessionUuid);
          if (!parent) { unresolved.push(r); continue; }
          const local = stByUuid.get(r.uuid);
          if (local && (local.modifiedAt ?? 0) >= r.modifiedAt) continue;
          const { sessionUuid: _x, ...rest } = d;
          const row: WorkoutSet = { ...rest, sessionId: parent.id!, uuid: r.uuid, modifiedAt: r.modifiedAt };
          if (local) { row.id = local.id; await db.sets.put(row); }
          else row.id = await db.sets.add(row);
          stByUuid.set(r.uuid, row);
          changes++;
        }
      }
    } finally {
      syncControl.suppress = false;
    }
  });
  return changes;
}

// ── Collect local changes ─────────────────────────────────
async function collectLocal(since: number): Promise<{ records: WireRecord[]; tombIds: number[] }> {
  const [exs, ses, sts, tombs] = await Promise.all([
    db.exercises.toArray(),
    db.sessions.toArray(),
    db.sets.toArray(),
    db.tombstones.toArray(),
  ]);
  const exUuid = new Map(exs.map(e => [e.id!, e.uuid!]));
  const seUuid = new Map(ses.map(s => [s.id!, s.uuid!]));
  const out: WireRecord[] = [];
  const changed = (r: { modifiedAt?: number }) => (r.modifiedAt ?? 0) >= since;

  for (const e of exs.filter(changed)) {
    const { id: _i, uuid, modifiedAt, ...rest } = e;
    out.push({ kind: 'exercises', uuid: uuid!, modifiedAt: modifiedAt ?? 0, data: stringify(rest) });
  }
  for (const s of ses.filter(changed)) {
    const { id: _i, uuid, modifiedAt, exerciseId, ...rest } = s;
    const exerciseUuid = exUuid.get(exerciseId);
    if (!exerciseUuid) continue;
    out.push({ kind: 'sessions', uuid: uuid!, modifiedAt: modifiedAt ?? 0, data: stringify({ ...rest, exerciseUuid }) });
  }
  for (const s of sts.filter(changed)) {
    const { id: _i, uuid, modifiedAt, sessionId, ...rest } = s;
    const sessionUuid = seUuid.get(sessionId);
    if (!sessionUuid) continue;
    out.push({ kind: 'sets', uuid: uuid!, modifiedAt: modifiedAt ?? 0, data: stringify({ ...rest, sessionUuid }) });
  }

  // tombstones — drop those whose uuid has reappeared locally (e.g. after import)
  const live = new Set([...exs, ...ses, ...sts].map(r => r.uuid));
  const tombIds: number[] = [];
  for (const t of tombs) {
    tombIds.push(t.id!);
    if (live.has(t.uuid)) continue;
    out.push({ kind: t.kind, uuid: t.uuid, modifiedAt: t.deletedAt, deleted: true });
  }
  return { records: out, tombIds };
}

// ── Main sync ─────────────────────────────────────────────
export interface SyncResult { ok: boolean; pulled: number; pushed: number; error?: string }

let running: Promise<SyncResult> | null = null;

export function syncNow(): Promise<SyncResult> {
  if (!getSyncKey() || !SYNC_URL) return Promise.resolve({ ok: false, pulled: 0, pushed: 0 });
  if (!running) running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync(): Promise<SyncResult> {
  let pulled = 0;
  let pushed = 0;
  try {
    let cursor = Number(localStorage.getItem(K_CURSOR) ?? 0);
    const firstSync = cursor === 0;

    // 1) pull
    const unresolved: WireRecord[] = [];
    let more = true;
    while (more) {
      const r = await request(cursor, []);
      pulled += await applyRemote(r.records, firstSync, unresolved);
      cursor = r.cursor;
      more = r.more;
    }
    if (unresolved.length) pulled += await applyRemote(unresolved, false, []);
    localStorage.setItem(K_CURSOR, String(cursor));

    // 2) push
    const startedAt = Date.now();
    const since = Number(localStorage.getItem(K_LASTPUSH) ?? 0);
    const { records, tombIds } = await collectLocal(since);
    for (let i = 0; i < records.length; i += 200) {
      await request(null, records.slice(i, i + 200));
    }
    pushed = records.length;
    if (tombIds.length) await db.tombstones.bulkDelete(tombIds);
    localStorage.setItem(K_LASTPUSH, String(startedAt));

    localStorage.setItem(K_LASTAT, String(Date.now()));
    localStorage.removeItem(K_ERROR);
    emitStatus();
    if (pulled > 0) window.dispatchEvent(new Event('gtg-data-changed'));
    return { ok: true, pulled, pushed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    localStorage.setItem(K_ERROR, msg);
    emitStatus();
    return { ok: false, pulled, pushed, error: msg };
  }
}

// ── Auto sync ─────────────────────────────────────────────
let timer: ReturnType<typeof setTimeout> | undefined;

export function scheduleSync(delayMs = 3000) {
  if (!getSyncKey() || !SYNC_URL) return;
  clearTimeout(timer);
  timer = setTimeout(() => { void syncNow(); }, delayMs);
}

let started = false;
export function startAutoSync() {
  if (started) return;
  started = true;
  syncControl.onLocalChange = () => scheduleSync(3000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(500);
  });
  window.addEventListener('online', () => scheduleSync(500));
  scheduleSync(500);
}
