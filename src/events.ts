/**
 * The typed event bus. Everything the agent does becomes one of these, and the
 * UI renders them as human-readable lines. Nothing raw ever reaches the screen.
 */

import { EventEmitter } from 'node:events';

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
  | { type: 'done'; url: string; sections: number; elapsedMs: number }
  | { type: 'stopped' }
  | { type: 'error'; message: string };

export type Stamped = RunEvent & { at: number; seq: number };

export class EventBus extends EventEmitter {
  private seq = 0;
  readonly log: Stamped[] = [];

  emitEvent(e: RunEvent): Stamped {
    const stamped = { ...e, at: Date.now(), seq: this.seq++ } as Stamped;
    this.log.push(stamped);
    this.emit('event', stamped);
    return stamped;
  }

  /** Replay everything so far, then stream. Lets the UI attach late. */
  subscribe(fn: (e: Stamped) => void): () => void {
    for (const e of this.log) fn(e);
    this.on('event', fn);
    return () => this.off('event', fn);
  }
}
