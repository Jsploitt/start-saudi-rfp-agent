/**
 * Plain numbered SQL. No ORM, no migration library: the schema is small enough
 * that a list of statements and an integer in schema_meta is the whole story.
 * Append a migration, never edit one that has shipped.
 */

export type Migration = { version: number; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE users (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        created_at  INTEGER NOT NULL
      );

      CREATE TABLE sessions (
        id             TEXT PRIMARY KEY,
        user_id        TEXT,
        title          TEXT NOT NULL,
        status         TEXT NOT NULL,
        phase          TEXT,
        mode           TEXT NOT NULL,
        rfp_path       TEXT,
        rfp_name       TEXT,
        theme_preset   TEXT,
        theme_accent   TEXT,
        restarted_from TEXT,
        error          TEXT,
        last_seq       INTEGER NOT NULL DEFAULT 0,
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL,
        finished_at    INTEGER,
        archived_at    INTEGER
      );
      CREATE INDEX sessions_by_created ON sessions (created_at DESC);

      -- The durable form of the in-memory section map. Re-composing a section
      -- replaces it in place and leaves every other section untouched, which is
      -- exactly what compose_proposal relies on.
      CREATE TABLE sections (
        session_id  TEXT NOT NULL,
        id          TEXT NOT NULL,
        title       TEXT NOT NULL,
        payload     TEXT NOT NULL,
        updated_at  INTEGER NOT NULL,
        PRIMARY KEY (session_id, id)
      );

      -- seq is per session and continues the in-memory bus, so a rehydrated
      -- session never reissues an id a client has already seen.
      CREATE TABLE events (
        session_id  TEXT NOT NULL,
        seq         INTEGER NOT NULL,
        type        TEXT NOT NULL,
        payload     TEXT NOT NULL,
        at          INTEGER NOT NULL,
        PRIMARY KEY (session_id, seq)
      );

      CREATE TABLE schema_meta (
        version     INTEGER NOT NULL
      );
    `,
  },
];
