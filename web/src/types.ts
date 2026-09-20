/**
 * The wire types are owned by ../src/contracts.ts and re-exported here so that
 * nothing in this app redeclares them. If the backend changes the shape of an
 * event, this app stops compiling — which is the point.
 */
export type { Phase, RunEvent, SessionStatus, Stamped } from '@contracts';

import type { Phase, SessionStatus, Stamped } from '@contracts';

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
  phase: Phase;
  elapsedMs: number;
  sinceLastActivityMs: number;
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
  | { type: 'attach'; mode: string | null }
  | { type: 'started' }
  | { type: 'mode'; mode: string | null }
  | { type: 'event'; event: Stamped }
  | { type: 'local-error'; what: string; detail?: string };

/* ------------------------------------------------------------------------ *
 * Sessions and theming — the surfaces the rebuilt backend exposes.
 * ------------------------------------------------------------------------ */

export interface SessionSummary {
  id: string;
  clientName: string;
  assignment: string | null;
  status: SessionStatus;
  sectionsDone: number;
  sectionsTotal: number;
  createdAt: number;
  updatedAt: number;
  themeId: ThemePresetId;
}

export type ThemePresetId = 'start-saudi' | 'neutral-corporate' | 'client-accent';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  /** Token names, not values — the swatch reads them off the live stylesheet. */
  swatch: [string, string, string];
}

export interface IntakeDraft {
  clientLegalName: string;
  sector: string;
  country: string;
  contactName: string;
  contactEmail: string;
  assignment: string;
  targetDate: string;
}
