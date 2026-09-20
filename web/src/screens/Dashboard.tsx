import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { sessions as api } from '@/api/client';
import { useMode } from '@/App';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Badge, Card, PanelHeading } from '@/components/ui/primitives';
import { isoDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SessionSummary, SessionStatus } from '@/types';

/**
 * The landing screen. The old UI opened straight onto a drop zone, which made
 * the tool look like a one-shot converter; it is a workspace with a history,
 * and this says so before anything else does.
 */
export function Dashboard() {
  const mode = useMode();
  const [rows, setRows] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  /**
   * Re-read the list every ten seconds.
   *
   * The dashboard is not on any session's stream — subscribing to all of them
   * to keep a list fresh would be absurd — so a run started in the other tab,
   * or one that finished while this tab sat here, appears on the next poll.
   * Ten seconds is slow enough to be free and quick enough that the second tab
   * in the two-at-once demo does not look broken.
   */
  useEffect(() => {
    let cancelled = false;
    const read = () =>
      api
        .list()
        .then((d) => {
          if (cancelled) return;
          setRows(d.sessions);
          setError(null);
        })
        .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));

    void read();
    const timer = setInterval(() => void read(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <AppShell
      mode={mode}
      right={
        <Button onClick={() => navigate('/new')}>
          <Plus aria-hidden="true" />
          New proposal
        </Button>
      }
    >
      <div className="scroll-thin mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-8">
        <PanelHeading>Proposals</PanelHeading>

        {error ? (
          <Card className="mt-4 p-6">
            <p className="text-sm text-ink">
              Could not load the list of proposals. {error}
            </p>
          </Card>
        ) : rows === null ? (
          <div className="mt-4 flex flex-col gap-3" aria-busy="true" aria-label="Loading proposals">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-breathe rounded-lg bg-surface ring-1 ring-hairline" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState onStart={() => navigate('/new')} />
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {rows.map((s) => (
              <li key={s.id}>
                <SessionCard session={s} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

const STATUS_TONE: Record<SessionStatus, 'neutral' | 'working' | 'waiting' | 'done' | 'stopped' | 'error'> = {
  queued: 'neutral',
  running: 'working',
  waiting: 'waiting',
  done: 'done',
  stopped: 'stopped',
  error: 'error',
  orphaned: 'error',
};

const STATUS_LABEL: Record<SessionStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  waiting: 'Needs an answer',
  done: 'Done',
  stopped: 'Stopped',
  error: 'Error',
  orphaned: 'Lost its agent',
};

/**
 * One row.
 *
 * The listing carries a section *count* and no total, because until the agent
 * has written the outline there is no total — and a bar drawn against a
 * guessed denominator is a progress indicator measuring nothing. So the count
 * is what is shown, and the proportion lives on the run screen, where the
 * outline is known. A row of ticks, one per section written, says the same
 * thing at a glance without claiming to know the end.
 */
function SessionCard({ session: s }: { session: SessionSummary }) {

  return (
    <Card className="transition-shadow hover:shadow-md">
      <Link
        to={`/s/${s.id}`}
        className="flex flex-col gap-3 rounded-lg p-5 sm:flex-row sm:items-center sm:gap-6"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="truncate font-display text-base font-semibold text-ink">
              {s.title}
            </h3>
            <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
            {s.mode !== 'live' ? <Badge tone="neutral">{s.mode}</Badge> : null}
          </div>
          {s.rfpName ? (
            <p className="mt-1 truncate text-sm text-ink-muted">{s.rfpName}</p>
          ) : null}
          {s.restartedFrom ? (
            <p className="mt-1 text-xs text-ink-muted">A re-run of an earlier session.</p>
          ) : null}
          <p className="mt-2 text-xs text-ink-muted tabular-nums">
            Created {isoDateTime(s.createdAt)} · Updated {isoDateTime(s.updatedAt)}
          </p>
        </div>

        {/* Section progress, counted rather than estimated. */}
        <div className="w-full shrink-0 sm:w-48">
          <p className="text-xs text-ink-muted tabular-nums">
            {s.sections
              ? `${s.sections} section${s.sections === 1 ? '' : 's'} written`
              : 'Nothing written yet'}
          </p>
          <div
            className="mt-1.5 flex gap-0.5"
            role="img"
            aria-label={`${s.sections} sections written`}
          >
            {Array.from({ length: Math.max(s.sections, 1) }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-sm',
                  s.sections ? 'bg-accent' : 'bg-surface-raised ring-1 ring-inset ring-hairline'
                )}
                /* One tick per section. `i` is the key, not a threshold: every
                   tick drawn is a section that exists. */
                data-index={i}
              />
            ))}
          </div>
        </div>
      </Link>
    </Card>
  );
}

function EmptyState({ onStart }: { onStart(): void }) {
  return (
    <Card className="mt-4 p-10 text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid size-12 place-items-center rounded-full bg-surface-raised text-ink-muted"
      >
        <FileText className="size-5" />
      </span>

      <h2 className="mt-5 font-display text-lg font-semibold text-ink">No proposals yet</h2>

      <p className="mx-auto mt-2 max-w-prose text-sm text-ink-muted">
        Give the agent an RFP and it reads it, works out what the document has to answer, asks
        you about anything the RFP leaves open, then writes the proposal section by section. You
        watch it happen and can redirect it at any point, including after it has finished.
      </p>

      <Button className="mt-6" size="lg" onClick={onStart}>
        <Plus aria-hidden="true" />
        New proposal
      </Button>
    </Card>
  );
}
