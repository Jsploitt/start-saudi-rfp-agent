import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { auth } from '@/api/client';
import { RunProvider, useRun } from '@/state/RunProvider';
import { PasscodeGate } from '@/screens/PasscodeGate';
import { Dashboard } from '@/screens/Dashboard';
import { Intake } from '@/screens/Intake';
import { Upload } from '@/screens/Upload';
import { RunScreen } from '@/screens/RunScreen';

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

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
    <BrowserRouter>
      <RunProvider>
        <Router />
      </RunProvider>
    </BrowserRouter>
  );
}

function Router() {
  const { state } = useRun();

  return (
    <Routes>
      <Route path="/" element={<Dashboard mode={state.mode} />} />
      <Route path="/new" element={<Intake mode={state.mode} />} />
      <Route path="/s/:id/upload" element={<Upload mode={state.mode} />} />
      <Route path="/s/:id" element={<RunScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
