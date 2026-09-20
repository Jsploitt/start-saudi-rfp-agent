import { useState } from 'react';
import { auth } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, Field, Input } from '@/components/ui/primitives';
import { Lockup } from '@/components/AppShell';

/**
 * The passcode gate. One field, posted to /api/auth/login; the session cookie
 * comes back on the response and nothing is kept here.
 *
 * `type="password"` and `autoComplete="current-password"` so a password
 * manager can fill it, and the failure message says only that the passcode is
 * wrong — never which part of it.
 */
export function PasscodeGate({ onPass }: { onPass(): void }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await auth.login(passcode);
      onPass();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That passcode is not right.');
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-full place-items-center bg-[color:var(--ss-surface-soft)] p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="p-8">
          <Lockup className="[--lw:150px]" />

          <h1 className="mt-8 font-display text-xl font-semibold text-ink">Proposal agent</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Internal tool. Enter the passcode to continue.
          </p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
            <Field label="Passcode" htmlFor="passcode" error={error} required>
              <Input
                type="password"
                autoComplete="current-password"
                autoFocus
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError(null);
                }}
              />
            </Field>

            <Button type="submit" size="lg" disabled={busy || !passcode.trim()}>
              {busy ? 'Checking…' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
