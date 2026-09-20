import { useEffect, useState } from 'react';

/**
 * A ticking clock.
 *
 * Used only to age numbers that were already true when they arrived — "the
 * heartbeat said 41 seconds in this phase, and that was 3 seconds ago". It is
 * never used to advance a progress indicator: nothing in this UI moves because
 * time passed, only because the agent said something.
 */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);

  return now;
}
