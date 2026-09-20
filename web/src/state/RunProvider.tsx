import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { health, run as runApi } from '@/api/client';
import { subscribeToEvents, type StreamHandle } from '@/api/stream';
import { initialRunState, runReducer } from './runReducer';
import type { RunState } from '@/types';

interface RunContextValue {
  state: RunState;
  /** True once this tab is attached to a stream. */
  attached: boolean;
  /** Resolved on load from /healthz: was a run already in progress? */
  reattached: boolean;
  startFromFile(file: File, sessionId?: string): Promise<void>;
  startFromSample(sessionId?: string): Promise<void>;
  sendAnswer(text: string): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  exportPdf(): Promise<string | null>;
  exporting: boolean;
}

const RunContext = createContext<RunContextValue | null>(null);

export function RunProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const [attached, setAttached] = useState(false);
  const [reattached, setReattached] = useState(false);
  const [exporting, setExporting] = useState(false);
  const stream = useRef<StreamHandle | null>(null);

  const listen = useCallback(() => {
    if (stream.current) return;
    stream.current = subscribeToEvents(
      (e) => dispatch({ type: 'event', event: e }),
      () => {
        /* EventSource reconnects on its own; a transport blip is not worth a
           row in the log, and reporting it would cry wolf during the quiet
           phases this UI exists to explain. */
      }
    );
    setAttached(true);
  }, []);

  const closeStream = useCallback(() => {
    stream.current?.close();
    stream.current = null;
    setAttached(false);
  }, []);

  /**
   * On load, ask whether a run is already in progress and re-attach to it.
   *
   * This is what makes a reload mid-demo survivable: the server replays the
   * event log from seq 0, so the conversation, the log and the document all
   * rebuild themselves. Carried over from the old UI, where it was the last
   * ten lines of app.js and easy to lose in a rewrite.
   */
  useEffect(() => {
    let cancelled = false;
    void health()
      .then((h) => {
        if (cancelled) return;
        dispatch({ type: 'mode', mode: h.mode && h.mode !== 'live' ? h.mode : null });
        if (h.running) {
          setReattached(true);
          dispatch({ type: 'attach', mode: h.mode && h.mode !== 'live' ? h.mode : null });
          listen();
        }
      })
      .catch(() => {
        /* No backend yet. The dashboard still renders; starting a run will
           report the failure where the operator can see it. */
      });
    return () => {
      cancelled = true;
    };
  }, [listen]);

  useEffect(() => () => closeStream(), [closeStream]);

  const afterStart = useCallback(
    (mode?: string) => {
      dispatch({ type: 'started' });
      if (mode && mode !== 'live') dispatch({ type: 'mode', mode });
      listen();
    },
    [listen]
  );

  const startFromFile = useCallback(
    async (file: File, sessionId?: string) => {
      dispatch({ type: 'started' });
      try {
        const d = await runApi.upload(file, sessionId);
        afterStart(d.mode);
      } catch (e) {
        dispatch({ type: 'local-error', what: 'Could not start', detail: String(e) });
        throw e;
      }
    },
    [afterStart]
  );

  const startFromSample = useCallback(
    async (sessionId?: string) => {
      dispatch({ type: 'started' });
      try {
        const d = await runApi.fromPath('proposal/sample-rfp.md', sessionId);
        afterStart(d.mode);
      } catch (e) {
        dispatch({ type: 'local-error', what: 'Could not start', detail: String(e) });
        throw e;
      }
    },
    [afterStart]
  );

  const sendAnswer = useCallback(async (text: string) => {
    try {
      await runApi.answer(text);
    } catch {
      dispatch({ type: 'local-error', what: 'Could not send that' });
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await runApi.stop();
    } catch {
      dispatch({ type: 'local-error', what: 'Could not stop the run' });
    }
  }, []);

  const restart = useCallback(async () => {
    try {
      await runApi.restart();
    } catch {
      dispatch({ type: 'local-error', what: 'Could not restart' });
      return;
    }
    closeStream();
    dispatch({ type: 'reset' });
  }, [closeStream]);

  const exportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const d = await runApi.exportPdf();
      if (d.url) return d.url;
      dispatch({ type: 'local-error', what: 'Export failed', detail: d.error });
      return null;
    } catch (e) {
      dispatch({ type: 'local-error', what: 'Export failed', detail: String(e) });
      return null;
    } finally {
      setExporting(false);
    }
  }, []);

  const value = useMemo<RunContextValue>(
    () => ({
      state,
      attached,
      reattached,
      startFromFile,
      startFromSample,
      sendAnswer,
      stop,
      restart,
      exportPdf,
      exporting,
    }),
    [state, attached, reattached, startFromFile, startFromSample, sendAnswer, stop, restart, exportPdf, exporting]
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error('useRun must be used inside <RunProvider>');
  return ctx;
}
