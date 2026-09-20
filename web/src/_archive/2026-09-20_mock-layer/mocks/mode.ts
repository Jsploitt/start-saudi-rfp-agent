/**
 * The backend is being rebuilt in parallel with this app, so development runs
 * against a mock layer by default: MSW for the HTTP surface, and a replay of
 * fixtures/cached-run.json for the event stream.
 *
 *   npm run dev                 mocked (default)
 *   VITE_MOCK=0 npm run dev     straight through the proxy to express on 5173
 *
 * A production build is never mocked, whatever the env says.
 */
export function isMockMode(): boolean {
  if (import.meta.env.PROD) return false;
  return import.meta.env.VITE_MOCK !== '0';
}

function param(name: string, fallback: number): number {
  const raw = new URLSearchParams(window.location.search).get(name);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * How much faster than real time the fixture replays.
 *
 * The default is 4, which turns a nine-minute recording into about two and a
 * quarter minutes while keeping the two silent windows proportionally silent:
 * the researcher's gap is still ~11 seconds of nothing and the reviewer's is
 * still ~24. Pass `?speed=1` to watch it at the speed an operator will.
 */
export const replaySpeed = () => param('speed', 4);

/**
 * `?stall=<seconds>` stops the replay at that point in recording time and
 * lets the heartbeat go stale, so the "the agent has gone quiet" and
 * `alive: false` states can be looked at without waiting for one to happen.
 */
export function stallAt(): number | null {
  const raw = new URLSearchParams(window.location.search).get('stall');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n * 1000 : null;
}
