/**
 * One SQLite file on the volume.
 *
 * Synchronous on purpose: it matches the writeFileSync/appendFileSync code it
 * sits beside, so persisting a section stays a one-line call inside a tool
 * handler rather than turning every handler async.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DB_PATH } from '../paths.js';
import { MIGRATIONS } from './migrations.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const handle = new Database(DB_PATH);
  handle.pragma('journal_mode = WAL');
  handle.pragma('synchronous = NORMAL');
  handle.pragma('busy_timeout = 5000');
  handle.pragma('foreign_keys = ON');
  migrate(handle);
  db = handle;
  return db;
}

function currentVersion(handle: Database.Database): number {
  const meta = handle
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'`)
    .get();
  if (!meta) return 0;
  const row = handle.prepare('SELECT version FROM schema_meta').get() as { version: number } | undefined;
  return row?.version ?? 0;
}

function migrate(handle: Database.Database): void {
  let version = currentVersion(handle);
  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue;
    handle.transaction(() => {
      handle.exec(migration.sql);
      handle.exec('DELETE FROM schema_meta');
      handle.prepare('INSERT INTO schema_meta (version) VALUES (?)').run(migration.version);
    })();
    version = migration.version;
  }
}

/** Tests and the dev CLI reopen against a different DATA_DIR. */
export function closeDb(): void {
  db?.close();
  db = null;
}
