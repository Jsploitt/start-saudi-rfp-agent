import type { Stamped } from '@/types';
import { isMockMode } from '@/mocks/mode';

export interface StreamHandle {
  close(): void;
}

export type EventSink = (e: Stamped) => void;

/**
 * Subscribe to the run's event stream.
 *
 * In production this is an EventSource on /api/events, which the server
 * replays from seq 0 so a tab that arrives late catches up. EventSource
 * reconnects on its own, so there is no retry logic here on purpose.
 *
 * In mock mode the same sink is fed by the fixture replayer instead. The
 * contract is identical — a sink that receives `Stamped` events — so nothing
 * downstream of this function knows or cares which one it got.
 */
export function subscribeToEvents(onEvent: EventSink, onError?: (e: unknown) => void): StreamHandle {
  if (!import.meta.env.PROD && isMockMode()) {
    /* Statically false in a production build, so the fixture and the replayer
       are eliminated rather than shipped as an unreachable chunk. */
    let stop: (() => void) | null = null;
    let cancelled = false;
    void import('@/mocks/replay').then(({ startReplay }) => {
      if (cancelled) return;
      stop = startReplay(onEvent);
    });
    return {
      close() {
        cancelled = true;
        stop?.();
      },
    };
  }

  const es = new EventSource('/api/events');
  es.onmessage = (m) => {
    let parsed: Stamped;
    try {
      parsed = JSON.parse(m.data) as Stamped;
    } catch {
      return; // A partial frame. The next one will be whole.
    }
    onEvent(parsed);
  };
  es.onerror = (e) => onError?.(e);

  return { close: () => es.close() };
}
