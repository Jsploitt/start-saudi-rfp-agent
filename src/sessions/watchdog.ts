/**
 * The watchdog over live runs.
 *
 * Without it a hung subprocess holds a concurrency slot forever, and the slot is
 * the scarce thing. Inactivity is measured from run.lastActivityAt, which every
 * SDK message, every tool handler and every subagent result bumps — so a long
 * silent tool call is not mistaken for a wedge.
 */

import { liveRuns } from '../run.js';

const TICK_MS = 30_000;
const WARN_AFTER_MS = 90_000;
const KILL_AFTER_MS = 300_000;

export function startWatchdog(): NodeJS.Timeout {
  const timer = setInterval(() => {
    for (const run of liveRuns()) {
      if (!run.running) continue;

      /**
       * A session waiting on the operator is idle on purpose.
       *
       * The agent has asked its question and is blocked on the inbox; nothing
       * is wedged, and the reason for the silence is known and displayed. Left
       * in, this killed any run whose question took more than five minutes to
       * answer — which, in a demo where the question is the thing being shown
       * off and discussed, is most of them.
       */
      if (run.status === 'waiting') continue;

      const idle = run.sinceLastActivityMs;

      if (idle > KILL_AFTER_MS) {
        run.bus.emitEvent({
          type: 'error',
          message: `No activity for ${Math.round(idle / 1000)}s. Stopping this session.`,
        });
        run.stopRequested = true;
        run.interruptHandle?.();
        run.setStatus('error', { error: 'watchdog: inactive', finishedAt: Date.now() });
        run.running = false;
        continue;
      }

      /* One warn per wedge, not one every tick. touch() clears the flag. */
      if (idle > WARN_AFTER_MS && run.alive) {
        run.alive = false;
        run.bus.emitEvent({
          type: 'warn',
          text: `Nothing has come back for ${Math.round(idle / 1000)}s. Still waiting.`,
        });
      }
    }
  }, TICK_MS);

  timer.unref?.();
  return timer;
}
