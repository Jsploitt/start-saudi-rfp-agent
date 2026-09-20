/**
 * DEMO_MODE=cached — replay a recorded run through the same UI, with the same
 * timings, and no network at all.
 *
 * It replays the event stream, and it re-renders each section through the real
 * renderer as its event arrives, so the preview fills progressively exactly as it
 * does live. Identical to watch, and deterministic.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES_DIR } from './paths.js';
import type { Run } from './run.js';
import type { Stamped } from './events.js';
import { Section } from './render/blocks.js';

export type CachedRun = {
  recordedAt: string;
  events: Stamped[];
  /** Section payloads keyed by id, so the preview can be rebuilt as events replay. */
  sections: Record<string, unknown>;
  outline: { id: string; title: string; intent: string }[];
  rfp?: unknown;
  brief?: unknown;
};

export const CACHE_PATH = join(FIXTURES_DIR, 'cached-run.json');

export function hasCachedRun(): boolean {
  return existsSync(CACHE_PATH);
}

/** Wall-clock gaps are replayed, but nothing waits longer than this. */
const MAX_GAP_MS = 6000;

export async function replayCachedRun(run: Run, speed = 1): Promise<void> {
  if (!hasCachedRun()) {
    run.bus.emitEvent({
      type: 'error',
      message: 'No fixtures/cached-run.json. Record one with: npm run record',
    });
    return;
  }

  const cache: CachedRun = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  run.outline = cache.outline ?? [];
  if (cache.rfp) run.rfp = cache.rfp as Run['rfp'];
  if (cache.brief) run.brief = cache.brief as Run['brief'];

  let previous = cache.events[0]?.at ?? Date.now();
  for (const event of cache.events) {
    if (run.stopRequested) {
      run.bus.emitEvent({ type: 'stopped' });
      return;
    }

    const gap = Math.min(MAX_GAP_MS, Math.max(0, event.at - previous)) / speed;
    previous = event.at;
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));

    /**
     * A replayed event is activity.
     *
     * Without this the replay never touches the run, so `lastActivityAt` stays
     * at construction time: the heartbeat reports the gap growing, at ninety
     * seconds the watchdog sets `alive: false` and the UI says "the agent is
     * not responding" over a document that is visibly still filling, and at
     * five minutes the watchdog stops the run outright with an error.
     *
     * Which is to say: the fallback died on stage, at minute five, every time.
     * The one path that must not fail was the one path nothing had watched all
     * the way through.
     */
    run.touch();

    /* Rebuild the document as the events go by, so the preview is genuinely live. */
    if (event.type === 'section:done') {
      const payload = cache.sections[event.id];
      const parsed = payload ? Section.safeParse(payload) : null;
      if (parsed?.success) {
        run.setSection(parsed.data);
        run.writeProposal();
      }
    }
    /* Go through setPhase rather than re-emitting the raw event, so the
       session row learns its phase too. Otherwise a replayed session shows the
       phase correctly on the stream and `null` in the listing — the same run
       described two different ways depending on which one you asked. setPhase
       emits the event itself, and ignores a repeat of the phase it is on. */
    if (event.type === 'phase') {
      run.setPhase(event.phase);
      continue;
    }

    if (event.type === 'preview') {
      run.bus.emitEvent({ type: 'preview', url: run.proposalUrl, sectionId: event.sectionId });
      continue;
    }
    if (event.type === 'done') {
      run.bus.emitEvent({ ...event, url: run.proposalUrl });
      continue;
    }

    const { at: _at, seq: _seq, ...rest } = event;
    run.bus.emitEvent(rest as Parameters<typeof run.bus.emitEvent>[0]);
  }
}
