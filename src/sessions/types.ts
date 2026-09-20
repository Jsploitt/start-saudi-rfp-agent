/** The vocabulary shared by the registry, the store and the API. */

export type SessionStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'done'
  | 'stopped'
  | 'error'
  /** Its subprocess died with a previous process. Artifacts remain readable. */
  | 'orphaned';

/**
 * The nine natural points of a run. Purely for legibility: "Researching, 47s"
 * reads as working, "Researching" with no timer reads as frozen.
 */
export type Phase =
  | 'starting'
  | 'reading-rfp'
  | 'asking'
  | 'researching'
  | 'briefing'
  | 'composing'
  | 'reviewing'
  | 'revising'
  | 'ready';

export type Theme = { preset: string | null; accent: string | null };

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
};

export type SessionSummary = {
  id: string;
  title: string;
  status: SessionStatus;
  phase: Phase | null;
  mode: string;
  rfpName: string | null;
  sections: number;
  live: boolean;
  restartedFrom: string | null;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  archivedAt: number | null;
};
