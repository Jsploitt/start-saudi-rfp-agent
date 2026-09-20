import * as React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { ApiError, sessions as api } from '@/api/client';
import { subscribeToEvents, type StreamHandle } from '@/api/stream';
import { initialRunState, runReducer } from './runReducer';
import type { RunState, SessionDetail } from '@/types';

/**
 * One session's live state.
 *
 * The provider used to be global — one run, one stream, one set of module-level
 * actions — which is exactly the shape that made two tabs share a document. It
 * now takes a session id and owns nothing outside it: two `<RunProvider>`s in
 * two tabs are two independent subscriptions to two independent runs, and the
 * server is keyed the same way.
 *
 * Mounting it is what attaches. There is no separate "is a run in progress?"
 * question any more: the session endpoint answers it, and the stream replays
 * from seq 0 either way.
 */

interface RunContextValue {
  sessionId: string;
  state: RunState;
  /** True once this tab is attached to the stream. */
  attached: boolean;
  /** The session as the server described it on load. Null until it answers. */
  detail: SessionDetail | null;
  /** Null, or why the session could not be loaded. */
  loadError: string | null;
  sendAnswer(text: string): Promise<void>;
  stop(): Promise<void>;
  /** Starts a new session over the same RFP and resolves to its id. */
  restart(): Promise<string | null>;
  exportPdf(): Promise<void>;
  exporting: boolean;
  setTheme(preset: string): Promise<void>;
}

const RunContext = createContext<RunContextValue | null>(null);

export function RunProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const [attached, setAttached] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const stream = useRef<StreamHandle | null>(null);

  /**
   * Load the session, then attach.
   *
   * The detail call is not redundant with the stream: it supplies the mode, the
   * theme and the stored status before a single event has replayed, so a
   * reopened session renders as itself rather than as an empty run for the
   * moment it takes the log to arrive.
   */
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'reset' });
    setDetail(null);
    setLoadError(null);

    void api
      .get(sessionId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        dispatch({ type: 'hydrate', detail: d });
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(
          e instanceof ApiError && e.status === 404
            ? 'There is no session with that id.'
            : e instanceof Error
              ? e.message
              : String(e)
        );
      });

    const handle = subscribeToEvents(sessionId, (e) => dispatch({ type: 'event', event: e }), () => {
      /* EventSource reconnects on its own, and it reports a dropped connection
         the same way it reports a failed one. Saying "connection lost" during
         the researcher's silent ninety seconds would be crying wolf at exactly
         the moment this UI exists to keep everyone calm. */
    });
    stream.current = handle;
    setAttached(true);

    return () => {
      cancelled = true;
      handle.close();
      stream.current = null;
      setAttached(false);
    };
  }, [sessionId]);

  /** Every action reports its own failure into the log rather than throwing into a click handler. */
  const guard = useCallback(async (what: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      dispatch({
        type: 'local-error',
        what,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const sendAnswer = useCallback(
    (text: string) => guard('Could not send that', () => api.answer(sessionId, text)),
    [guard, sessionId]
  );

  const stop = useCallback(
    () => guard('Could not stop the run', () => api.stop(sessionId)),
    [guard, sessionId]
  );

  /**
   * Restart is a new session over the same RFP, not a reset of this one.
   *
   * The old session keeps its id, its event log and its document; the caller
   * navigates to the new id. Nothing is discarded, which is worth knowing
   * before you press it.
   */
  const restart = useCallback(async (): Promise<string | null> => {
    try {
      const created = await api.restart(sessionId);
      return created.sessionId;
    } catch (e) {
      dispatch({
        type: 'local-error',
        what: 'Could not restart',
        detail: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  }, [sessionId]);

  /**
   * Ask for the PDF and stop there.
   *
   * The request returns as soon as the job is queued. The URL arrives later on
   * the stream as a `pdf` event, which the reducer puts in `state.pdfUrl` — so
   * the button is released when the file exists, not when the request returns,
   * and a tab that reloads mid-export still gets the link.
   */
  const exportPdf = useCallback(async () => {
    setExporting(true);
    try {
      await api.exportPdf(sessionId);
    } catch (e) {
      setExporting(false);
      dispatch({
        type: 'local-error',
        what: 'Export failed',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }, [sessionId]);

  /* The `pdf` event is the completion signal, and an `error` during the export
     is the other one. Either way the button stops spinning. */
  useEffect(() => {
    if (state.pdfUrl || state.statusKind === 'error') setExporting(false);
  }, [state.pdfUrl, state.statusKind]);

  const setTheme = useCallback(
    (preset: string) =>
      guard('Could not change the theme', () => api.setTheme(sessionId, preset)),
    [guard, sessionId]
  );

  const value = useMemo<RunContextValue>(
    () => ({
      sessionId,
      state,
      attached,
      detail,
      loadError,
      sendAnswer,
      stop,
      restart,
      exportPdf,
      exporting,
      setTheme,
    }),
    [
      sessionId,
      state,
      attached,
      detail,
      loadError,
      sendAnswer,
      stop,
      restart,
      exportPdf,
      exporting,
      setTheme,
    ]
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error('useRun must be used inside <RunProvider>');
  return ctx;
}
