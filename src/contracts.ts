/**
 * The wire contract. The only module both halves of the app import.
 *
 * The server owns these shapes and the operator UI re-exports them through
 * `web/src/types.ts` (aliased to `@contracts`). Nothing in the browser
 * redeclares a field the server sends: if a payload changes here, the React
 * app stops compiling, which is the entire point of the file.
 *
 * It imports nothing, and almost all of it is types, so the browser bundle
 * pays nothing for reaching into the server's source tree for it. The two
 * runtime exports at the foot are the empty intake and its emptiness check,
 * which both halves need and neither should own alone.
 */

/* ------------------------------------------------------------------------ *
 * The vocabulary. Declared here and imported everywhere else, including by
 * `events.ts` and `sessions/types.ts`, which re-export it.
 *
 * The dependency runs that way round on purpose. This file has no imports at
 * all, so the browser can typecheck it without `@types/node` and without
 * dragging in the EventBus, the SQLite row types or anything else that only
 * makes sense on a server. It used to re-export *from* those modules, which
 * compiled on a laptop — the root node_modules was one directory up — and
 * failed in the container's web build stage, where it is not.
 * ------------------------------------------------------------------------ */

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

/**
 * Everything the agent does becomes one of these, and the UI renders them as
 * human-readable lines. Nothing raw ever reaches the screen.
 */
export type RunEvent =
  | { type: 'status'; text: string }
  | { type: 'act'; verb: string; detail?: string; tool?: string } // "Reading the RFP…"
  | { type: 'agent'; text: string } // the agent's own prose
  | { type: 'question'; text: string } // the agent asks; the UI answers
  | { type: 'answer'; text: string }
  | { type: 'rfp'; analysis: unknown }
  | { type: 'brief'; brief: unknown }
  | { type: 'outline'; sections: { id: string; title: string; intent: string }[] }
  | { type: 'section:start'; id: string; title: string }
  | { type: 'section:done'; id: string; title: string; index: number; total: number }
  | { type: 'preview'; url: string; sectionId?: string }
  | { type: 'research'; items: string[] }
  | { type: 'review'; findings: { requirement: string; severity: string; note: string }[] }
  | { type: 'warn'; text: string }
  | { type: 'phase'; phase: Phase }
  /**
   * The session's own status changed. Emitted by `Run.setStatus`, so a tab
   * watching the stream learns that a run went to `waiting`, `done`, `error`
   * or `orphaned` without polling the session endpoint for it.
   */
  | { type: 'session'; status: SessionStatus }
  | { type: 'pdf'; url: string }
  | { type: 'theme'; preset: string | null; accent: string | null }
  | { type: 'done'; url: string; sections: number; elapsedMs: number }
  | { type: 'stopped' }
  | { type: 'error'; message: string };

/** Every persisted event carries when it happened and its place in the order. */
export type Stamped = RunEvent & { at: number; seq: number };

/** One row of `GET /api/sessions`. */
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

/**
 * `GET /api/sessions/:id`. A summary plus everything a reopened tab needs to
 * rebuild the screen before the first event arrives.
 */
export interface SessionDetail extends SessionSummary {
  proposalUrl: string;
  theme: { preset: string | null; accent: string | null };
  outline: { id: string; title: string; intent: string }[];
  rfp: unknown;
  brief: unknown;
  /** What the operator stated before the RFP was read. */
  intake: Intake | null;
  lastSeq: number;
  /** Null when the session is not running. */
  sinceLastActivityMs: number | null;
}

/**
 * The heartbeat, every three seconds on the SSE stream as a named `heartbeat`
 * event. Never persisted: 180 rows of it per run would be noise in the event
 * table and noise in a replay.
 *
 * `sinceLastActivityMs` is the field that separates "thinking" from "wedged",
 * and it is the reason the researcher's silent ninety seconds does not read as
 * a crash.
 */
export interface HeartbeatPayload {
  phase: Phase | null;
  status: SessionStatus;
  running: boolean;
  elapsedMs: number;
  sinceLastActivityMs: number | null;
  sectionsDone: number;
  sectionsTotal: number;
  /** Against the nine minute deadline. Null when not running. */
  deadlineRemainingMs: number | null;
  /** False once the watchdog has warned. The authority on liveness. */
  alive: boolean;
}

/**
 * What a browser actually receives: the persisted union, plus the transient
 * heartbeat folded in so one reducer handles both.
 *
 * The heartbeat carries `seq: -1`. That is the marker for "transient": it is
 * rendered, but it never advances the replay cursor, so a reconnect does not
 * ask the server to resume from a sequence number that was never stored.
 */
export type ClientEvent = Stamped | (HeartbeatPayload & { type: 'heartbeat'; at: number; seq: -1 });

/** `POST /api/sessions` — 201. */
export interface CreatedSession {
  sessionId: string;
  url: string;
  mode: string;
  autostart: boolean;
  restartedFrom?: string;
}

/** `GET /healthz`. No secret ever appears in this payload. */
export interface Health {
  ok: boolean;
  version: string;
  mode: string;
  activeRuns: number;
  capacity: number;
}

/**
 * The intake form. Collected before the RFP and handed to the agent as stated
 * fact, so a legal name on a cover page is something a person typed rather
 * than something the model inferred from a document that may not state it.
 *
 * Every field is optional to the server. A blank one arrives blank and the
 * agent asks about it like any other gap; nothing is guessed on the client's
 * behalf.
 */
export interface Intake {
  clientLegalName: string;
  sector: string;
  country: string;
  contactName: string;
  contactEmail: string;
  assignment: string;
  /** ISO date. Their date, not ours: the schedule is worked backwards from it. */
  targetDate: string;
}

export const EMPTY_INTAKE: Intake = {
  clientLegalName: '',
  sector: '',
  country: '',
  contactName: '',
  contactEmail: '',
  assignment: '',
  targetDate: '',
};

/** True when at least one field was filled in. */
export function hasIntake(i: Intake | null | undefined): i is Intake {
  return Boolean(i) && Object.values(i as Intake).some((v) => String(v ?? '').trim() !== '');
}
