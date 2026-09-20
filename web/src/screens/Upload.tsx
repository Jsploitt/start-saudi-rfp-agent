import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, FileUp, Upload as UploadIcon } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { useRun } from '@/state/RunProvider';
import { bytes } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The RFP, as its own step.
 *
 * The accepted extensions are exactly what read_rfp's extract() can parse, and
 * they are enforced here as well as by the server so a wrong file is refused
 * before it is uploaded rather than after.
 *
 * The size warning is not arbitrary. Large PDFs are a known failure mode: a
 * scanned or image-heavy one has no usable text layer, so the agent reads it,
 * gets nothing, and writes a proposal against an empty RFP. Above a megabyte
 * is where that starts being likely, so the operator is told before they
 * spend nine minutes finding out.
 */

const ACCEPT = '.pdf,.docx,.md,.txt';
const ALLOWED = ['.pdf', '.docx', '.md', '.txt'];
const WARN_ABOVE = 1_000_000;

export function Upload({ mode }: { mode: string | null }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { startFromFile, startFromSample } = useRun();

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

  const begin = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      navigate(`/s/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

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
                  onClick={() => void begin(() => startFromSample(id))}
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
                  This file is {bytes(file.size)}. Anything much over a megabyte is usually a
                  scanned PDF, and a scan has no text for the agent to read — it will produce a
                  proposal against an empty RFP rather than fail. If this one was scanned, send a
                  text PDF or a DOCX instead.
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
                onClick={() => file && void begin(() => startFromFile(file, id))}
              >
                {busy ? 'Starting…' : 'Start the agent'}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
