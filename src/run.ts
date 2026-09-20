/**
 * Run state: the assembled document, the brief, the RFP analysis, the transcript.
 *
 * Sections are held in an ordered map keyed by id, so re-composing one section
 * replaces it in place and leaves the rest untouched. That is what makes the
 * targeted live edit possible without regenerating the document.
 *
 * A Run owns everything that used to be a module global: its event bus, its
 * inbox, whether it is running. The registry at the foot of the file holds them
 * by id, so two sessions in two tabs never see each other's document.
 */

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { EventBus, type Stamped } from './events.js';
import type { Section } from './render/blocks.js';
import type { Inbox } from './agent.js';
import type { Phase, SessionRow, SessionStatus } from './sessions/types.js';
import type { Intake } from './contracts.js';
import {
  appendTranscript,
  ensureSessionDir,
  sessionDir,
  writeProposal as writeProposalFile,
} from './sessions/artifacts.js';
import * as store from './db/store.js';

export const RfpAnalysis = z.object({
  client: z.object({
    name: z.string(),
    sector: z.string().optional(),
    country: z.string().optional(),
  }),
  summary: z.string().describe('Three or four sentences. What they are asking for and why.'),
  requirements: z
    .array(z.object({ id: z.string(), text: z.string(), mustHave: z.boolean() }))
    .min(1),
  dates: z.array(z.object({ label: z.string(), date: z.string() })),
  evaluationCriteria: z.array(z.string()),
  gaps: z
    .array(
      z.object({
        question: z.string().describe('The question to put to the client, in their own terms.'),
        whyItMatters: z.string().describe('The consequence of getting it wrong. Be concrete.'),
      })
    )
    .min(1)
    .describe(
      'What the RFP does NOT say. Unstated budget, ambiguous scope boundaries, a timeline ' +
        'that conflicts with itself, unnamed decision-makers, an assumption the client has ' +
        'made without knowing it is an assumption. This is the most important field in the ' +
        'system. An empty array is always wrong.'
    ),
});
export type RfpAnalysis = z.infer<typeof RfpAnalysis>;

export const Brief = z.object({
  client: z.string(),
  engagementType: z.string(),
  scopeIn: z.array(z.string()).min(1),
  scopeOut: z.array(z.string()).min(1).describe('A brand whose signature move is naming its own boundary always has these.'),
  timeline: z.array(z.string()),
  constraints: z.array(z.string()),
  openItems: z.array(z.string()).describe('Carried from the RFP gaps. These become [TO CONFIRM] markers.'),
  winThemes: z.array(z.string()),
});
export type Brief = z.infer<typeof Brief>;

export type OutlineItem = { id: string; title: string; intent: string };

/** Short, opaque, and safe in a URL and a directory name. */
export const newSessionId = (): string => `ses_${randomBytes(6).toString('hex')}`;

export type RunInit = {
  id?: string;
  title?: string;
  mode?: string;
  status?: SessionStatus;
  rfpPath?: string | null;
  rfpName?: string | null;
  restartedFrom?: string | null;
  userId?: string | null;
  /** The intake form, collected before the RFP. */
  intake?: Intake | null;
  /** Seed the event sequence when rehydrating a finished session. */
  startSeq?: number;
  /** When the session was created. Seeded on rehydration so the clock is the run's own. */
  startedAt?: number;
  /** When it ended, if it has. Stops that clock where it actually stopped. */
  finishedAt?: number | null;
  /** A rehydrated session must not write to disk merely by existing. */
  persist?: boolean;
};

export class Run {
  readonly id: string;
  readonly dir: string;
  readonly bus: EventBus;
  /**
   * When the run began — its creation time, not this object's.
   *
   * A rehydrated Run is constructed when someone reopens the session, which is
   * hours after the run it represents. Left as `Date.now()` the elapsed clock
   * restarted at zero every time a finished session was opened, so a run that
   * took four minutes displayed as "0:23" and got shorter the sooner you
   * looked at it.
   */
  readonly started: number;

  title: string;
  mode: string;
  status: SessionStatus;
  phase: Phase | null = null;
  rfpPath: string | null;
  rfpName: string | null;
  restartedFrom: string | null;
  userId: string | null;
  /**
   * What the operator stated before the RFP was read. The agent is told these
   * as fact; anything left blank it asks about like any other gap.
   */
  intake: Intake | null;
  theme: { preset: string | null; accent: string | null } = { preset: null, accent: null };

  rfp: RfpAnalysis | null = null;
  brief: Brief | null = null;
  outline: OutlineItem[] = [];
  research: string[] = [];
  private sections = new Map<string, Section>();
  /** Pending answers the agent is waiting on, keyed by nothing — it is a queue. */
  readonly answers: string[] = [];

  /** The agent's answer queue, while one is live. Was a server-level global. */
  inbox: Inbox | null = null;
  /** True between starting the agent and the loop exiting. Was a server-level global. */
  running = false;

  /**
   * Bumped by every SDK message of any type, every tool handler and every
   * subagent result. The gap since tells "thinking" from "wedged", which is the
   * only liveness signal that survives a long silent tool call.
   */
  lastActivityAt = Date.now();

  /** Set by the stop route; read once the agent loop exits to decide done vs stopped. */
  stopRequested = false;
  /** Wired by runAgent once the SDK session exists, so the server can interrupt it. */
  interruptHandle: (() => void) | null = null;
  /** One warn per wedged run, not one every watchdog tick. */
  alive = true;
  /** Set once the run ends, so the elapsed clock stops where the run did. */
  finishedAt: number | null;

  private persist: boolean;
  private dirReady = false;

  constructor(init: RunInit = {}) {
    this.id = init.id ?? newSessionId();
    this.dir = sessionDir(this.id);
    this.title = init.title ?? 'Untitled proposal';
    this.mode = init.mode ?? 'live';
    this.status = init.status ?? 'queued';
    this.rfpPath = init.rfpPath ?? null;
    this.rfpName = init.rfpName ?? null;
    this.restartedFrom = init.restartedFrom ?? null;
    this.userId = init.userId ?? null;
    this.intake = init.intake ?? null;
    this.started = init.startedAt ?? Date.now();
    this.finishedAt = init.finishedAt ?? null;
    this.persist = init.persist ?? true;

    this.bus = new EventBus({
      startSeq: init.startSeq ?? 0,
      onEvent: (e) => this.record(e),
    });
  }

  /** Create the directory only when something is about to be written into it. */
  ensureDir(): string {
    if (!this.dirReady) {
      ensureSessionDir(this.id);
      this.dirReady = true;
    }
    return this.dir;
  }

  get proposalUrl(): string {
    return `/runs/${this.id}/proposal.html`;
  }

  /** Stops when the run stops. A finished run does not keep ageing on screen. */
  get elapsedMs(): number {
    return (this.finishedAt ?? Date.now()) - this.started;
  }

  get sinceLastActivityMs(): number {
    return Date.now() - this.lastActivityAt;
  }

  touch(): void {
    this.lastActivityAt = Date.now();
    this.alive = true;
  }

  setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    if (this.persist) store.updateSession(this.id, { phase });
    this.bus.emitEvent({ type: 'phase', phase });
  }

  setStatus(status: SessionStatus, extra: Partial<SessionRow> = {}): void {
    const changed = this.status !== status;
    if (extra.finishedAt != null) this.finishedAt = extra.finishedAt;
    this.status = status;
    if (this.persist) store.updateSession(this.id, { status, ...extra });
    /* Announce it. Without this the operator UI has to poll the session
       endpoint to notice that a run went to `waiting` or `error`, and a tab
       that is already holding the stream open should not have to. */
    if (changed) this.bus.emitEvent({ type: 'session', status });
  }

  setTitle(title: string): void {
    this.title = title;
    if (this.persist) store.updateSession(this.id, { title });
  }

  setTheme(preset: string | null, accent: string | null): void {
    this.theme = { preset, accent };
    if (this.persist) store.updateSession(this.id, { themePreset: preset, themeAccent: accent });
    this.bus.emitEvent({ type: 'theme', preset, accent });
  }

  private record(e: Stamped): void {
    if (!this.persist) return;
    store.appendEvent(this.id, e);
  }

  setSection(section: Section): void {
    this.sections.set(section.id, section);
    if (this.persist) store.upsertSection(this.id, section);
  }

  /** Rehydration path: fill the map without writing it straight back out. */
  loadSections(sections: Section[]): void {
    for (const s of sections) this.sections.set(s.id, s);
  }

  hasSection(id: string): boolean {
    return this.sections.has(id);
  }

  /** Outline order wins; anything composed off-outline is appended in arrival order. */
  orderedSections(): Section[] {
    const byOutline = this.outline
      .map((o) => this.sections.get(o.id))
      .filter((s): s is Section => Boolean(s));
    const extra = [...this.sections.values()].filter((s) => !this.outline.some((o) => o.id === s.id));
    return byOutline.length ? [...byOutline, ...extra] : extra;
  }

  sectionCount(): number {
    return this.sections.size;
  }

  /** Write the assembled document. Called after every section, so the preview is live. */
  writeProposal(): string {
    this.ensureDir();
    const client = this.rfp?.client.name ?? this.brief?.client ?? 'Proposal';
    return writeProposalFile({
      id: this.id,
      title: `${client} — Start Saudi proposal`,
      sections: this.orderedSections(),
      outline: this.outline,
    });
  }

  transcript(entry: unknown): void {
    this.ensureDir();
    appendTranscript(this.id, entry);
  }
}

/* -------------------------------------------------------------- registry --- */

/**
 * Live sessions, by id. A session leaves this map when its run finishes and
 * nothing is streaming it; everything needed to read it back is on disk.
 */
const live = new Map<string, Run>();

export const getRun = (id: string): Run | null => live.get(id) ?? null;

export function registerRun(run: Run): Run {
  live.set(run.id, run);
  return run;
}

export function createRun(init: RunInit = {}): Run {
  const run = new Run(init);
  if (init.persist ?? true) {
    store.insertSession({
      id: run.id,
      userId: run.userId,
      title: run.title,
      status: run.status,
      mode: run.mode,
      rfpPath: run.rfpPath,
      rfpName: run.rfpName,
      restartedFrom: run.restartedFrom,
      intake: run.intake ? JSON.stringify(run.intake) : null,
    });
  }
  return registerRun(run);
}

export function dropRun(id: string): void {
  live.delete(id);
}

export const liveRuns = (): Run[] => [...live.values()];

/** How many are holding a concurrency slot right now. */
export const runningCount = (): number => liveRuns().filter((r) => r.running).length;
