import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { auth, health } from '@/api/client';
import { RunProvider } from '@/state/RunProvider';
import { PasscodeGate } from '@/screens/PasscodeGate';
import { Dashboard } from '@/screens/Dashboard';
import { Intake } from '@/screens/Intake';
import { Upload } from '@/screens/Upload';
import { RunScreen } from '@/screens/RunScreen';

/**
 * The mode banner, from /healthz.
 *
 * It is the one thing every screen needs and nothing else knows: whether this
 * instance is replaying a recording. It is deliberately not part of the run
 * state — it is a property of the server, it does not change while the app is
 * open, and during the demo's fallback it has to be visible on the dashboard
 * before any session exists.
 */
const ModeContext = createContext<string | null>(null);
export const useMode = () => useContext(ModeContext);

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void auth
      .check()
      .then((ok) => !cancelled && setSignedIn(ok))
      .catch(() => !cancelled && setSignedIn(false));
    return () => {
      cancelled = true;
    };
  }, []);

  /* Only once signed in: /healthz is public, but asking before the gate is
     passed puts a "cached" banner on the login screen, which tells anyone who
     reaches it something about how the demo is being run. */
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    void health()
      .then((h) => !cancelled && setMode(h.mode && h.mode !== 'live' ? h.mode : null))
      .catch(() => {
        /* The banner is a nicety. Everything else still works without it. */
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (signedIn === null) {
    return (
      <div className="grid h-full place-items-center bg-[color:var(--ss-surface-soft)]">
        <p className="text-sm text-ink-muted" role="status">
          Checking the session…
        </p>
      </div>
    );
  }

  if (!signedIn) return <PasscodeGate onPass={() => setSignedIn(true)} />;

  return (
    <ModeContext.Provider value={mode}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<Intake />} />
          {/* The RFP step. No session exists yet: it is created, with the
              intake and the file together, when the agent is started. */}
          <Route path="/new/rfp" element={<Upload />} />
          <Route path="/s/:id" element={<Session />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ModeContext.Provider>
  );
}

/**
 * One provider per session, mounted under the id in the URL and keyed by it.
 *
 * The `key` is what makes a restart work: navigating from one session to
 * another remounts the provider rather than reusing it, so the old stream is
 * closed, the reducer starts clean, and no event from the previous run can
 * land in the new one's log.
 */
function Session() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;
  return (
    <RunProvider key={id} sessionId={id}>
      <RunScreen />
    </RunProvider>
  );
}
