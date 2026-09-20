/**
 * Every query lives here. The rest of the codebase never sees SQL.
 */

import { randomBytes } from 'node:crypto';
import { getDb } from './index.js';
import type { Section } from '../render/blocks.js';
import type { Stamped } from '../events.js';
import type { SessionRow, SessionStatus, Phase } from '../sessions/types.js';

const now = (): number => Date.now();

/* ---------------------------------------------------------------- users --- */

export function upsertUser(name: string): string {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE name = ?').get(name) as
    | { id: string }
    | undefined;
  if (existing) return existing.id;
  const id = `usr_${randomBytes(6).toString('hex')}`;
  db.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)').run(id, name, now());
  return id;
}

export function getUser(id: string): { id: string; name: string } | null {
  const row = getDb().prepare('SELECT id, name FROM users WHERE id = ?').get(id) as
    | { id: string; name: string }
    | undefined;
  return row ?? null;
}

/* ------------------------------------------------------------- sessions --- */

type DbSession = {
  id: string;
  user_id: string | null;
  title: string;
  status: string;
  phase: string | null;
  mode: string;
  rfp_path: string | null;
  rfp_name: string | null;
  theme_preset: string | null;
  theme_accent: string | null;
  restarted_from: string | null;
  error: string | null;
  last_seq: number;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
  archived_at: number | null;
  intake: string | null;
};

const toRow = (r: DbSession): SessionRow => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  status: r.status as SessionStatus,
  phase: r.phase as Phase | null,
  mode: r.mode,
  rfpPath: r.rfp_path,
  rfpName: r.rfp_name,
  themePreset: r.theme_preset,
  themeAccent: r.theme_accent,
  restartedFrom: r.restarted_from,
  error: r.error,
  lastSeq: r.last_seq,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  finishedAt: r.finished_at,
  archivedAt: r.archived_at,
  intake: r.intake ?? null,
});

export type NewSession = {
  id: string;
  userId: string | null;
  title: string;
  status: SessionStatus;
  mode: string;
  rfpPath?: string | null;
  rfpName?: string | null;
  restartedFrom?: string | null;
  /** The intake form, already serialised. */
  intake?: string | null;
};

/**
 * Upsert rather than insert: session ids are random, except for the dev
 * recorder, which deliberately reuses one so the fixture keeps a stable name.
 * A second recording should replace the first, not fail on a primary key.
 */
export function insertSession(s: NewSession): void {
  const t = now();
  getDb()
    .prepare(
      `INSERT INTO sessions
         (id, user_id, title, status, phase, mode, rfp_path, rfp_name,
          restarted_from, intake, last_seq, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         status = excluded.status,
         phase = NULL,
         mode = excluded.mode,
         rfp_path = excluded.rfp_path,
         rfp_name = excluded.rfp_name,
         intake = excluded.intake,
         error = NULL,
         finished_at = NULL,
         archived_at = NULL,
         updated_at = excluded.updated_at`
    )
    .run(
      s.id,
      s.userId,
      s.title,
      s.status,
      s.mode,
      s.rfpPath ?? null,
      s.rfpName ?? null,
      s.restartedFrom ?? null,
      s.intake ?? null,
      t,
      t
    );
}

const PATCHABLE: Record<string, string> = {
  title: 'title',
  status: 'status',
  phase: 'phase',
  mode: 'mode',
  rfpPath: 'rfp_path',
  rfpName: 'rfp_name',
  themePreset: 'theme_preset',
  themeAccent: 'theme_accent',
  error: 'error',
  lastSeq: 'last_seq',
  finishedAt: 'finished_at',
  archivedAt: 'archived_at',
  intake: 'intake',
};

export function updateSession(id: string, patch: Partial<SessionRow>): void {
  const entries = Object.entries(patch).filter(([k]) => k in PATCHABLE);
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${PATCHABLE[k]} = ?`).join(', ');
  const values = entries.map(([, v]) => (v === undefined ? null : v));
  getDb()
    .prepare(`UPDATE sessions SET ${sets}, updated_at = ? WHERE id = ?`)
    .run(...values, now(), id);
}

export function getSession(id: string): SessionRow | null {
  const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
    | DbSession
    | undefined;
  return row ? toRow(row) : null;
}

export function listSessions(opts: {
  limit?: number;
  cursor?: number | null;
  includeArchived?: boolean;
}): SessionRow[] {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const clauses: string[] = [];
  const args: unknown[] = [];
  if (!opts.includeArchived) clauses.push('archived_at IS NULL');
  if (opts.cursor) {
    clauses.push('created_at < ?');
    args.push(opts.cursor);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getDb()
    .prepare(`SELECT * FROM sessions ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...args, limit) as DbSession[];
  return rows.map(toRow);
}

/**
 * On boot every session that claimed to be live is lying: its subprocess died
 * with the previous process. Resuming a mid-conversation SDK session is not
 * something this codebase can do, so say orphaned rather than pretend.
 */
export function orphanLiveSessions(): number {
  const result = getDb()
    .prepare(
      `UPDATE sessions SET status = 'orphaned', updated_at = ?
       WHERE status IN ('running', 'waiting', 'queued')`
    )
    .run(now());
  return result.changes;
}

/* ------------------------------------------------------------- sections --- */

export function upsertSection(sessionId: string, section: Section): void {
  getDb()
    .prepare(
      `INSERT INTO sections (session_id, id, title, payload, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session_id, id) DO UPDATE SET
         title = excluded.title,
         payload = excluded.payload,
         updated_at = excluded.updated_at`
    )
    .run(sessionId, section.id, section.title, JSON.stringify(section), now());
}

export function listSections(sessionId: string): Section[] {
  const rows = getDb()
    .prepare('SELECT payload FROM sections WHERE session_id = ? ORDER BY updated_at ASC')
    .all(sessionId) as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload) as Section);
}

export function countSections(sessionId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM sections WHERE session_id = ?')
    .get(sessionId) as { n: number };
  return row.n;
}

export function countSectionsFor(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  if (!ids.length) return counts;
  const placeholders = ids.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(
      `SELECT session_id, COUNT(*) AS n FROM sections
       WHERE session_id IN (${placeholders}) GROUP BY session_id`
    )
    .all(...ids) as { session_id: string; n: number }[];
  for (const r of rows) counts.set(r.session_id, r.n);
  return counts;
}

/* --------------------------------------------------------------- events --- */

export function appendEvent(sessionId: string, e: Stamped): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO events (session_id, seq, type, payload, at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(sessionId, e.seq, e.type, JSON.stringify(e), e.at);
  getDb()
    .prepare('UPDATE sessions SET last_seq = MAX(last_seq, ?), updated_at = ? WHERE id = ?')
    .run(e.seq, e.at, sessionId);
}

/** The most recent event of a type, for restoring state the tables do not hold. */
export function latestEvent(sessionId: string, type: string): Stamped | null {
  const row = getDb()
    .prepare(
      `SELECT payload FROM events WHERE session_id = ? AND type = ?
       ORDER BY seq DESC LIMIT 1`
    )
    .get(sessionId, type) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as Stamped) : null;
}

/** Replay is a range scan, not a full-log walk. */
export function eventsSince(sessionId: string, since: number, limit = 5000): Stamped[] {
  const rows = getDb()
    .prepare(
      `SELECT payload FROM events WHERE session_id = ? AND seq > ?
       ORDER BY seq ASC LIMIT ?`
    )
    .all(sessionId, since, limit) as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload) as Stamped);
}

/**
 * Where a rehydrated bus continues from. Read from the rows rather than from
 * sessions.last_seq, so a session with no events at all starts at 0 rather than
 * skipping it.
 */
export function nextSeq(sessionId: string): number {
  const row = getDb()
    .prepare('SELECT MAX(seq) AS top FROM events WHERE session_id = ?')
    .get(sessionId) as { top: number | null };
  return row.top === null ? 0 : row.top + 1;
}

export function lastSeq(sessionId: string): number {
  const row = getDb().prepare('SELECT last_seq FROM sessions WHERE id = ?').get(sessionId) as
    | { last_seq: number }
    | undefined;
  return row?.last_seq ?? 0;
}
