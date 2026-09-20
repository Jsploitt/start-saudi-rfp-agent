/**
 * How many live runs this process will carry, and a mutex over Chromium.
 *
 * In process, because a live session is a Node parent plus a Claude subprocess,
 * plus researcher and reviewer subprocesses during their windows, plus Chromium
 * during export — all of which have to share one process anyway for the SSE
 * subscribers and the in-memory Run to see each other. Nothing here would be
 * improved by Redis.
 *
 * Two is a starting point, not a measurement. Watch RSS during a live run before
 * raising it.
 */

export const MAX_CONCURRENT_RUNS = Math.max(
  1,
  Number(process.env.MAX_CONCURRENT_RUNS ?? 2) || 2
);

/** One at a time. Two Chromium instances beside two live agents will OOM a 4 GB box. */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

export const exportMutex = new Mutex();
