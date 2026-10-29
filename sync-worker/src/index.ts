/**
 * GTG sync worker (Cloudflare Worker + D1).
 *
 *   POST /sync  { since: number | null, records: WireRecord[] }
 *     - upserts `records` (last-write-wins on modifiedAt)
 *     - if `since` is a number, returns records changed after that cursor (paged)
 *
 * Auth: Authorization: Bearer <id>.<mac>, where mac = HMAC-SHA256(SYNC_SECRET, id)[0..16].
 * Keys can only be minted with the SYNC_SECRET (see make-key.mjs), so strangers cannot
 * create accounts or write to the database. user_id = <id>.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Env {
  DB: any;                // D1Database
  SYNC_SECRET: string;    // wrangler secret
  ALLOWED_ORIGIN: string; // e.g. https://kokuraxc.github.io
}

interface WireRecord {
  kind: string;
  uuid: string;
  modifiedAt: number;
  deleted?: boolean;
  data?: string;
}

const KINDS = new Set(['exercises', 'sessions', 'sets']);
const UUID_RE = /^[\w:.-]{8,100}$/;
const KEY_RE = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{22})$/;
const MAX_BODY = 1_000_000;
const MAX_RECORDS_PER_REQUEST = 300;
const MAX_DATA_LEN = 4000;
const MAX_ROWS_PER_USER = 50_000;
const PAGE = 500;

const enc = new TextEncoder();

function b64u(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns the user id if the bearer key is valid, else null. */
async function authenticate(req: Request, env: Env): Promise<string | null> {
  const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '');
  const parts = m && KEY_RE.exec(m[1]);
  if (!parts) return null;
  const [, id, mac] = parts;
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(env.SYNC_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const full = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(id)));
  const expected = b64u(full.slice(0, 16));
  if (expected.length !== mac.length) return null;
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  return diff === 0 ? id : null;
}

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env) },
  });
}

function validRecord(r: any): r is WireRecord {
  return (
    r &&
    KINDS.has(r.kind) &&
    typeof r.uuid === 'string' && UUID_RE.test(r.uuid) &&
    Number.isFinite(r.modifiedAt) && r.modifiedAt > 0 &&
    (r.deleted === true
      ? true
      : typeof r.data === 'string' && r.data.length > 0 && r.data.length <= MAX_DATA_LEN)
  );
}

const UPSERT = `
INSERT INTO records (user_id, kind, uuid, modified_at, deleted, data, seq)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, (SELECT COALESCE(MAX(seq), 0) + 1 FROM records))
ON CONFLICT (user_id, kind, uuid) DO UPDATE SET
  modified_at = excluded.modified_at,
  deleted     = excluded.deleted,
  data        = excluded.data,
  seq         = (SELECT COALESCE(MAX(seq), 0) + 1 FROM records)
WHERE excluded.modified_at > records.modified_at`;

export default {
  // Wrap so that unexpected errors still carry CORS headers (otherwise the browser only
  // reports an opaque "NetworkError" and hides the real cause).
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await handle(req, env);
    } catch (e) {
      console.log('sync error', String(e));
      return json({ error: 'server error', detail: String(e) }, env, 500);
    }
  },
};

async function handle(req: Request, env: Env): Promise<Response> {
  {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });

    const url = new URL(req.url);
    if (req.method !== 'POST' || url.pathname !== '/sync') {
      return json({ error: 'not found' }, env, 404);
    }

    // Cheap rejections first — nothing below touches D1 until the key is verified.
    const userId = await authenticate(req, env);
    if (!userId) return json({ error: 'unauthorized' }, env, 401);

    if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BODY) {
      return json({ error: 'too large' }, env, 413);
    }
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, env, 400); }

    const records: unknown[] = Array.isArray(body.records) ? body.records : [];
    if (records.length > MAX_RECORDS_PER_REQUEST || !records.every(validRecord)) {
      return json({ error: 'bad records' }, env, 400);
    }

    // ── push ──
    if (records.length > 0) {
      const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM records WHERE user_id = ?1')
        .bind(userId).first();
      if ((row?.c ?? 0) + records.length > MAX_ROWS_PER_USER) {
        return json({ error: 'storage limit reached' }, env, 413);
      }
      const stmt = env.DB.prepare(UPSERT);
      await env.DB.batch(
        (records as WireRecord[]).map(r =>
          stmt.bind(userId, r.kind, r.uuid, Math.floor(r.modifiedAt), r.deleted ? 1 : 0, r.deleted ? null : r.data)
        )
      );
    }

    // ── pull ──
    if (typeof body.since === 'number' && Number.isFinite(body.since)) {
      const { results } = await env.DB
        .prepare(
          `SELECT kind, uuid, modified_at, deleted, data, seq FROM records
           WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3`
        )
        .bind(userId, body.since, PAGE + 1)
        .all();
      const more = results.length > PAGE;
      const page = more ? results.slice(0, PAGE) : results;
      return json(
        {
          records: page.map((r: any) => ({
            kind: r.kind,
            uuid: r.uuid,
            modifiedAt: r.modified_at,
            deleted: r.deleted === 1,
            data: r.data ?? undefined,
          })),
          cursor: page.length ? page[page.length - 1].seq : body.since,
          more,
        },
        env
      );
    }

    return json({ records: [], cursor: 0, more: false }, env);
  }
}
