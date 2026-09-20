/** The vocabulary shared by the registry, the store and the API. */

/* Declared in the wire contract, which imports nothing, and re-exported here
   because that is where the server has always looked for them. */
export type { Phase, SessionStatus, SessionSummary, Theme } from '../contracts.js';

import type { Phase, SessionStatus } from '../contracts.js';

export type SessionRow = {
  id: string;
  userId: string | null;
  title: string;
  status: SessionStatus;
  phase: Phase | null;
  mode: string;
  rfpPath: string | null;
  rfpName: string | null;
  themePreset: string | null;
  themeAccent: string | null;
  restartedFrom: string | null;
  error: string | null;
  lastSeq: number;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  archivedAt: number | null;
  /** The intake form as stored: JSON, or null when the form was skipped. */
  intake: string | null;
};

