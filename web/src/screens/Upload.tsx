import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, FileUp, LifeBuoy, Upload as UploadIcon } from 'lucide-react';
import { ApiError, sessions as api } from '@/api/client';
import { useMode } from '@/App';
import { clearDraft, loadDraft } from '@/state/IntakeDraft';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { bytes } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Intake } from '@/types';

/**
 * The RFP, as its own step.
 *
 * The accepted extensions are exactly what read_rfp's extract() can parse, and
 * they are enforced here as well as by the server so a wrong file is refused
 * before it is uploaded rather than after.
 *
 * The size note is not a refusal. A large RFP used to be a failure mode twice
 * over: an image-heavy scan has no text layer, and a very long document
 * overflowed the model's context on the first turn and killed the run before
 * anything appeared on screen. Both are now handled in read_rfp — a scan is
 * refused with a reason, and a long document is read head and tail with the
 * middle skipped and the skip declared.
 *
 * So the operator is told what to expect rather than warned off. The 2.65 MB
 * sample in uploads/ completes.
 */

const ACCEPT = '.pdf,.docx,.md,.txt';
const ALLOWED = ['.pdf', '.docx', '.md', '.txt'];
const WARN_ABOVE = 1_000_000;

/** The sample, relative to the source tree. The server refuses anything outside it. */
const SAMPLE = 'proposal/sample-rfp.md';

export function Upload() {
  const mode = useMode();
  const navigate = useNavigate();
  const location = useLocation();

  /* The draft arrives in the router's state on a normal navigation, and from
     sessionStorage when this URL is reloaded directly. */
  const intake = ((location.state as Intake | null) ?? loadDraft()) as Intake;

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (f: File | null | undefined) => {
    if (!f) return;
    const dot = f.name.lastIndexOf('.');
    const ext = dot < 0 ? '' : f.name.slice(dot).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      setFile(null);
      setError(`${ext || 'That file'} is not something the agent can read. Use a PDF, DOCX, Markdown or text file.`);
      return;
    }
    setError(null);
    setFile(f);
  };

  /**
   * Create the session and go straight to it.
   *
   * One call: the RFP, the intake and the title travel together, the server
   * answers with the id, and the agent is already running by the time the run
   * screen mounts and attaches to the stream. Nothing is lost in that gap —
   * the stream replays from seq 0.
   */
  const begin = async (start: () => Promise<{ sessionId: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const created = await start();
      clearDraft();
      navigate(`/s/${created.sessionId}`, { replace: true });
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'at_capacity'
          ? `${e.message} This instance runs a fixed number of sessions at once so that none of them slows the others down.`
          : e instanceof Error
            ? e.message
            : String(e)
      );
      setBusy(false);
    }
  };

  const title = intake.clientLegalName.trim() || undefined;

  /**
   * The parachute.
   *
   * One action, and it does not touch the server: the session is created with
   * `mode: 'cached'`, so it replays the recorded run through the real stream
   * and the real renderer while the instance stays live. No restart, no
   * environment change, no cold start, and anything already running keeps
   * running.
   *
   * Bound to `F` as well as the button, because the moment you need this you
   * are standing in front of people and a keystroke is steadier than finding a
   * control. Guarded so it cannot fire while focus is in a field.
   */
  const startFallback = useCallback(() => {
    void begin(() => api.createFromPath(SAMPLE, intake, title, 'cached'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intake, title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((el as HTMLElement | null)?.isContentEditable) return;
      e.preventDefault();
      startFallback();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startFallback]);

  return (
    <AppShell mode={mode} breadcrumb={<span className="text-sm text-ink-muted">The RFP</span>}>
      <div className="scroll-thin mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Give it the RFP</CardTitle>
            <CardDescription>
              PDF, DOCX, Markdown or plain text. The agent reads it first and works out what the
              proposal has to answer before writing anything.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div
              className={cn(
                'rounded-lg border-2 border-dashed p-10 text-center transition-colors',
                over ? 'tint-accent border-[color:var(--ss-accent)]' : 'border-hairline'
              )}
              onDragEnter={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                accept(e.dataTransfer?.files?.[0]);
              }}
            >
              <span
                aria-hidden="true"
                className="mx-auto grid size-12 place-items-center rounded-full bg-surface-raised text-ink-muted"
              >
                <FileUp className="size-5" />
              </span>

              <p className="mt-4 font-display text-base font-semibold text-ink">
                Drop the RFP here
              </p>
              <p className="mt-1 text-sm text-ink-muted">PDF, DOCX, Markdown or text</p>

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => accept(e.target.files?.[0])}
              />

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
                  <UploadIcon aria-hidden="true" />
                  Choose a file
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void begin(() => api.createFromPath(SAMPLE, intake, title))}
                >
                  Use the sample RFP
                </Button>
              </div>
            </div>

            {file ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-raised px-4 py-3">
                <p className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{file.name}</span>
                  <span className="text-xs text-ink-muted tabular-nums">{bytes(file.size)}</span>
                </p>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Remove
                </Button>
              </div>
            ) : null}

            {file && file.size > WARN_ABOVE ? (
              <p className="tint-caution flex items-start gap-2 rounded-md px-3 py-2 text-sm text-ink">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                <span>
                  This file is {bytes(file.size)}. If it runs long, the agent reads the beginning
                  and the end and tells you how much of the middle it skipped. If it turns out to
                  be a scan, it will say so rather than write a proposal against a document it
                  could not read.
                </span>
              </p>
            ) : null}

            {error ? (
              <p role="alert" className="tint-danger rounded-md px-3 py-2 text-sm text-ink">
                {error}
              </p>
            ) : null}

            <div className="flex items-center gap-3 pt-1">
              <Button
                size="lg"
                disabled={!file || busy}
                onClick={() => file && void begin(() => api.createFromFile(file, intake, title))}
              >
                {busy ? 'Starting…' : 'Start the agent'}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/new')}>
                Back
              </Button>
            </div>

            {/* The fallback. Deliberately last, deliberately quiet, and
                deliberately on this screen: the decision to use it is taken
                before a run starts, not during one. */}
            <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={startFallback}>
                <LifeBuoy aria-hidden="true" />
                Play the recorded run
              </Button>
              <p className="text-xs text-ink-muted">
                Press <kbd className="rounded border border-hairline px-1 font-mono">F</kbd>. Replays
                the recording through the real screen, with no network. The instance stays live and
                anything already running is untouched.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
