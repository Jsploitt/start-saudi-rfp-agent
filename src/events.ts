/**
 * The typed event bus. Everything the agent does becomes one of these, and the
 * UI renders them as human-readable lines. Nothing raw ever reaches the screen.
 *
 * One bus per session. `seq` is per session and can be seeded, so a session
 * rehydrated from the database never reissues an id a client has already seen.
 */

import { EventEmitter } from 'node:events';
import type { RunEvent, Stamped } from './contracts.js';

/* The union and its stamped form are declared in the wire contract, which
   imports nothing, so the browser can read them without reading this file.
   Re-exported here because every server module already imports them from
   './events.js' and the indirection is not worth a rename. */
export type { RunEvent, Stamped } from './contracts.js';

export type EventBusOptions = {
  /** Continue the numbering of a session read back from the database. */
  startSeq?: number;
  /** Called synchronously for every event, before any subscriber sees it. */
  onEvent?: (e: Stamped) => void;
};

export class EventBus extends EventEmitter {
  private seq: number;
  private readonly onEvent?: (e: Stamped) => void;
  readonly log: Stamped[] = [];

  constructor(opts: EventBusOptions = {}) {
    super();
    this.setMaxListeners(64); // a handful of SSE subscribers per session, plus the agent
    this.seq = opts.startSeq ?? 0;
    this.onEvent = opts.onEvent;
  }

  get nextSeq(): number {
    return this.seq;
  }

  emitEvent(e: RunEvent): Stamped {
    const stamped = { ...e, at: Date.now(), seq: this.seq++ } as Stamped;
    this.log.push(stamped);
    try {
      this.onEvent?.(stamped);
    } catch {
      /* persistence must never take the run down */
    }
    this.emit('event', stamped);
    return stamped;
  }

  /** Stream new events only. Replay for a live session comes from the database. */
  listen(fn: (e: Stamped) => void): () => void {
    this.on('event', fn);
    return () => this.off('event', fn);
  }

  /** Replay everything so far, then stream. Lets the CLI and the recorder attach. */
  subscribe(fn: (e: Stamped) => void): () => void {
    for (const e of this.log) fn(e);
    this.on('event', fn);
    return () => this.off('event', fn);
  }
}
