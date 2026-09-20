/**
 * The wire types are owned by ../src/contracts.ts and re-exported here so that
 * nothing in this app redeclares them. If the backend changes the shape of an
 * event, this app stops compiling — which is the point.
 */
export type {
  ClientEvent,
  CreatedSession,
  Health,
  HeartbeatPayload,
  Intake,
  Phase,
  RunEvent,
  SessionDetail,
  SessionStatus,
  SessionSummary,
  Stamped,
} from '@contracts';

import type {
  ClientEvent,
  Phase,
  SessionDetail as SessionDetailType,
  SessionStatus,
} from '@contracts';

/* ------------------------------------------------------------------------ *
 * Narrowings of the contract's `unknown` payloads.
 *
 * `rfp.analysis` and `brief.brief` are typed `unknown` on the wire on purpose:
 * the agent owns their shape and the server does not validate it. These are
 * not redeclarations of a contract type, they are what this UI needs to be
 * true before it renders a field, and every access below is guarded.
 * ------------------------------------------------------------------------ */

export interface RfpAnalysis {
  client: { name: string; sector?: string; country?: string };
  summary?: string;
  requirements: { id?: string; text?: string }[];
  dates: { label: string; date: string }[];
  gaps: { question: string }[];
}

export interface OutlineSection {
  id: string;
  title: string;
  intent: string;
}

export type SectionState = 'pending' | 'doing' | 'done';

/* ------------------------------------------------------------------------ *
 * UI-side view models.
 * ------------------------------------------------------------------------ */

export type ChatKind = 'agent' | 'question' | 'you' | 'system';

export interface ChatMessage {
  id: string;
  kind: ChatKind;
  who: string;
  text: string;
  at: number;
}

/**
 * One row of the activity log. `count` and `details` carry the collapsing
 * behaviour: consecutive rows with the same kind and headline merge into one
 * row with a ×N badge and a concatenated detail list, rather than stacking
 * three near-identical lines down the timeline.
 */
export interface LogRow {
  id: string;
  kind: string;
  what: string;
  details: string[];
  count: number;
  at: number;
  /** Seconds since the run started, as shown in the gutter. */
  tSeconds: number | null;
}

export interface Heartbeat {
  phase: Phase | null;
  elapsedMs: number;
  /** Null when the run is not running. */
  sinceLastActivityMs: number | null;
  sectionsDone: number;
  sectionsTotal: number;
  deadlineRemainingMs: number | null;
  alive: boolean;
  /** When this UI received it. Used to age the numbers between beats. */
  receivedAt: number;
}

export type StatusKind = 'idle' | 'working' | 'waiting' | 'ready' | 'stopped' | 'error';

export interface RunState {
  startedAt: number | null;
  /** The session's own status, as the server reports it. */
  session: SessionStatus;
  /** The one line that always says what is happening now. */
  statusKind: StatusKind;
  statusText: string;
  /** 'live' | 'cached' | ... — shown only when it is not 'live'. */
  mode: string | null;

  chat: ChatMessage[];
  log: LogRow[];

  rfp: RfpAnalysis | null;
  brief: unknown;
  outline: OutlineSection[];
  sectionState: Record<string, SectionState>;

  sectionsDone: number;
  sectionsTotal: number;

  previewUrl: string | null;
  previewSectionId: string | null;
  /** The section the document panel should be showing right now. */
  writingSectionId: string | null;
  pdfUrl: string | null;

  phase: Phase | null;
  phaseLabel: string | null;
  phaseSince: number | null;

  heartbeat: Heartbeat | null;

  waitingForAnswer: boolean;
  finished: boolean;
  stopped: boolean;
  elapsedMsFinal: number | null;
  answerPlaceholder: string;

  /** Highest persisted seq seen. Transient events (seq === -1) never advance it. */
  lastSeq: number;
}

export type RunAction =
  | { type: 'reset' }
  /** What GET /api/sessions/:id said, applied before the log replays. */
  | { type: 'hydrate'; detail: SessionDetailType }
  | { type: 'event'; event: ClientEvent }
  | { type: 'local-error'; what: string; detail?: string };

/* ------------------------------------------------------------------------ *
 * Theming.
 *
 * `SessionSummary`, `SessionDetail` and `Intake` are NOT declared here any
 * more: they are the server's shapes and they are re-exported from
 * `@contracts` above. A UI that redeclares a wire type is a UI that compiles
 * happily while rendering a field the server stopped sending.
 * ------------------------------------------------------------------------ */

/**
 * The document's theme, as this UI offers it: three fixed presets.
 *
 * The server stores `{preset, accent}` as free-form strings, because the
 * renderer takes any accent token and a custom picker is a plausible next
 * step. This union is the narrower thing the picker offers today, and the one
 * place the two meet is `sessions.setTheme`.
 */
export type ThemePresetId = 'start-saudi' | 'neutral-corporate' | 'client-accent';

export const THEME_PRESET_IDS: ThemePresetId[] = [
  'start-saudi',
  'neutral-corporate',
  'client-accent',
];

/** A preset the server has never heard of renders as the house style. */
export function asPresetId(value: string | null | undefined): ThemePresetId {
  return THEME_PRESET_IDS.includes(value as ThemePresetId)
    ? (value as ThemePresetId)
    : 'start-saudi';
}

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  /** Token names, not values — the swatch reads them off the live stylesheet. */
  swatch: [string, string, string];
}
