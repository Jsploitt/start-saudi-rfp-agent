import type { ClientEvent, HeartbeatPayload, Stamped } from '@contracts';

export interface StreamHandle {
  close(): void;
}

export type EventSink = (e: ClientEvent) => void;

/**
 * Subscribe to one session's event stream.
 *
 * An `EventSource` on `/api/sessions/:id/events`. The server replays the log
 * from seq 0 before streaming, so a tab that arrives late — or comes back
 * after a reload mid-demo — rebuilds the conversation, the log and the
 * document from the same events the first tab saw.
 *
 * There is deliberately no retry logic here. Every frame carries its `seq` on
 * the SSE `id:` line, so the browser resends `Last-Event-ID` on reconnect by
 * itself and the server resumes from `WHERE seq > :since`. Hand-rolled
 * reconnection would have to reimplement that, worse.
 *
 * Two kinds of frame arrive and both reach the same sink:
 *
 *  - default events, the persisted `RunEvent` union;
 *  - `event: heartbeat`, every three seconds, which is transient. It is given
 *    `seq: -1` here so the reducer renders it but never advances the replay
 *    cursor onto a sequence number the server never stored.
 */
export function subscribeToEvents(
  sessionId: string,
  onEvent: EventSink,
  onError?: (e: unknown) => void
): StreamHandle {
  const es = new EventSource(`/api/sessions/${sessionId}/events`);

  es.onmessage = (m) => {
    let parsed: Stamped;
    try {
      parsed = JSON.parse(m.data) as Stamped;
    } catch {
      return; // A partial frame. The next one will be whole.
    }
    onEvent(parsed);
  };

  es.addEventListener('heartbeat', (m) => {
    let beat: HeartbeatPayload;
    try {
      beat = JSON.parse((m as MessageEvent<string>).data) as HeartbeatPayload;
    } catch {
      return;
    }
    onEvent({ ...beat, type: 'heartbeat', at: Date.now(), seq: -1 });
  });

  /* EventSource reports a dropped connection and a failed reconnect the same
     way, and it retries on its own either way. The caller decides whether that
     is worth showing; during the researcher's silent ninety seconds it is not. */
  es.onerror = (e) => onError?.(e);

  return { close: () => es.close() };
}
