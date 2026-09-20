import type { ReactNode } from 'react';
import { AlertTriangle, CircleDashed } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { PHASES, PHASE_ORDER, phaseMeta } from '@/lib/phases';
import { clock, duration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Phase, RunState } from '@/types';

/**
 * The one component that has to be right.
 *
 * The old UI only moved when a discrete event arrived, and there are two
 * windows in a run where none does: the researcher can go 90 seconds without
 * emitting, and the reviewer 120. That is three and a half minutes of a
 * nine-minute run during which the screen looked like a hung process.
 *
 * The fix is the `heartbeat` event, and the rule this component is built
 * around: it never shows a bar that advances because time passed. Every number
 * below is either something the agent reported, or that same number aged by
 * the wall clock since it arrived — and where a value ages, the UI says how
 * stale it is instead of pretending it is current. The two indicators that do
 * fill (the phase rail, the section cells) are discrete and move only when a
 * `phase` or `section:done` event says they may.
 */

/** Past this with no beat, the numbers on screen are no longer trustworthy. */
const STALE_AFTER_MS = 6_000;

export function AgentStatus({ state, className }: { state: RunState; className?: string }) {
  const live = !state.finished && !state.stopped;
  const now = useNow(1000, live || state.heartbeat !== null);

  const hb = state.heartbeat;
  const sinceBeat = hb ? now - hb.receivedAt : null;
  const stale = sinceBeat !== null && sinceBeat > STALE_AFTER_MS;

  /* Ageing a measured value is honest; inventing one is not. Both of these
     start from a number the agent sent and add only the time since it sent it. */
  const elapsedMs = hb ? hb.elapsedMs + (sinceBeat ?? 0) : state.startedAt ? now - state.startedAt : null;
  const quietMs = hb ? hb.sinceLastActivityMs + (sinceBeat ?? 0) : null;
  const deadlineMs =
    hb?.deadlineRemainingMs != null ? Math.max(0, hb.deadlineRemainingMs - (sinceBeat ?? 0)) : null;

  const inPhaseMs = state.phaseSince ? now - state.phaseSince : null;
  const meta = phaseMeta(state.phase);
  const label = state.phaseLabel ?? meta?.label ?? state.statusText;

  const total = state.sectionsTotal || state.outline.length;
  const done = state.sectionsDone;

  /* A silence is only worth flagging once it is longer than this phase's own
     normal quiet. The reviewer going 40 seconds without a word is not news. */
  const budget = meta?.quietMs ?? 30_000;
  const unexpectedlyQuiet = quietMs !== null && budget > 0 && quietMs > Math.max(12_000, budget * 0.35);

  const dead = hb ? !hb.alive : false;

  return (
    <section
      className={cn('rounded-lg bg-surface ring-1 ring-hairline shadow-sm', className)}
      aria-label="Agent status"
    >
      {/* The line that is always true, announced when it changes. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-6 pt-5">
        <Pulse alive={!dead && live && !stale} stopped={state.stopped} finished={state.finished} />
        <h2 className="font-display text-lg font-semibold text-ink" role="status" aria-live="polite">
          {dead ? 'The agent is not responding' : label}
        </h2>
        {inPhaseMs !== null && live && !dead ? (
          <span className="text-sm text-ink-muted tabular-nums">for {duration(inPhaseMs)}</span>
        ) : null}
      </div>

      {meta && live && !dead ? (
        <p className="px-6 pt-1 text-sm text-ink-muted">{meta.detail}</p>
      ) : null}

      {/* The readouts. Every one of them is a measurement, and the two that
          only mean something during a run are dropped once it ends rather than
          left ticking: a deadline counting down against a finished document is
          not information, and "last activity" stops being a liveness signal the
          moment there is nothing left to be live. */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-6 pt-4 sm:grid-cols-4">
        <Readout
          label="Sections"
          value={total ? `${done} of ${total}` : done ? String(done) : 'Not planned yet'}
        />
        {live ? (
          <Readout
            label="Last activity"
            value={quietMs === null ? '—' : `${duration(quietMs)} ago`}
            warn={unexpectedlyQuiet}
          />
        ) : null}
        <Readout
          label={live ? 'Elapsed' : 'Took'}
          value={
            state.elapsedMsFinal !== null
              ? clock(state.elapsedMsFinal)
              : elapsedMs === null
                ? '—'
                : clock(elapsedMs)
          }
        />
        {live && !dead ? (
          <Readout
            label="Deadline"
            value={deadlineMs === null ? 'No limit' : `${clock(deadlineMs)} left`}
            warn={deadlineMs !== null && deadlineMs < 60_000}
          />
        ) : null}
      </dl>

      {/* Discrete, event-driven, and labelled as such. */}
      <div className="px-6 pt-5">
        <PhaseRail current={state.phase} />
      </div>

      {total > 0 ? (
        <div className="px-6 pt-4">
          <SectionCells done={done} total={total} writing={state.writingSectionId !== null} />
        </div>
      ) : null}

      {/* What to say during a silence. */}
      <div className="px-6 pb-5 pt-4">
        {dead ? (
          <Notice tone="danger" icon={<AlertTriangle className="size-4" aria-hidden="true" />}>
            The last heartbeat reported the run as no longer alive. Nothing more will arrive on
            this stream. The document holds whatever was written before it stopped.
          </Notice>
        ) : stale && live ? (
          <Notice tone="caution" icon={<AlertTriangle className="size-4" aria-hidden="true" />}>
            No heartbeat for {duration(sinceBeat ?? 0)}. The numbers above are as of the last one,
            not as of now.
          </Notice>
        ) : unexpectedlyQuiet && meta ? (
          <Notice tone="neutral" icon={<CircleDashed className="size-4 animate-breathe" aria-hidden="true" />}>
            Nothing has arrived for {duration(quietMs ?? 0)}. That is expected here:{' '}
            {meta.label.toLowerCase()} runs silent for up to {duration(budget)}. The heartbeat is
            still arriving, so the agent is working.
          </Notice>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function Pulse({
  alive,
  stopped,
  finished,
}: {
  alive: boolean;
  stopped: boolean;
  finished: boolean;
}) {
  const tone = stopped
    ? 'bg-[color:var(--ss-danger)]'
    : finished || alive
      ? 'bg-accent'
      : 'bg-[color:var(--ss-caution)]';
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2.5 shrink-0 rounded-full', tone, alive && 'animate-breathe')}
    />
  );
}

function Readout({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-display text-ink-muted">{label}</dt>
      <dd
        className={cn(
          'truncate font-display text-base tabular-nums text-ink',
          warn && 'font-semibold'
        )}
      >
        {value}
        {warn ? <span className="sr-only"> (worth watching)</span> : null}
      </dd>
    </div>
  );
}

/**
 * The phases, as steps. It fills on `phase` events and on nothing else, so a
 * step that has not been reached is never shaded on the strength of a guess.
 * `fixing` is left out of the rail because it is a loop back, not a step
 * forward; when it is current it is named in the heading above instead.
 */
function PhaseRail({ current }: { current: RunState['phase'] }) {
  const rail: Phase[] = PHASE_ORDER.filter((p) => p !== 'fixing');
  const currentIndex = current ? rail.indexOf(current) : -1;

  return (
    <ol className="flex items-center gap-1" aria-label="Run phases">
      {rail.map((p, i) => {
        const done = currentIndex > i;
        const isCurrent = currentIndex === i;
        return (
          <li key={p} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={cn(
                'h-1 rounded-full transition-colors',
                done ? 'bg-accent' : isCurrent ? 'bg-accent animate-breathe' : 'bg-surface-raised ring-1 ring-inset ring-hairline'
              )}
            />
            <span
              className={cn(
                'hidden truncate text-[0.6875rem] leading-tight sm:block',
                isCurrent ? 'font-semibold text-ink' : 'text-ink-muted'
              )}
            >
              {PHASES[p].label}
            </span>
            {/* Narrow screens get the bar only: seven labels truncated to
                "Rea… Aski… Writi…" say less than the phase name already set
                in the heading above. The list keeps its accessible name. */}
            <span className="sr-only sm:hidden">{PHASES[p].label}</span>
            {isCurrent ? <span className="sr-only">current phase</span> : null}
            {done ? <span className="sr-only">done</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** One cell per section, filled by `section:done`. Countable, not estimated. */
function SectionCells({ done, total, writing }: { done: number; total: number; writing: boolean }) {
  return (
    <div>
      <div
        className="flex gap-1"
        role="img"
        aria-label={`${done} of ${total} sections written`}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-2 flex-1 rounded-sm',
              i < done
                ? 'bg-accent'
                : i === done && writing
                  ? 'bg-accent animate-breathe'
                  : 'bg-surface-raised ring-1 ring-inset ring-hairline'
            )}
          />
        ))}
      </div>
    </div>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: 'neutral' | 'caution' | 'danger';
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-md px-3 py-2 text-xs text-ink',
        tone === 'neutral' && 'bg-surface-raised',
        tone === 'caution' && 'tint-caution',
        tone === 'danger' && 'tint-danger'
      )}
    >
      <span className="mt-0.5 shrink-0 text-ink-muted">{icon}</span>
      <span>{children}</span>
    </p>
  );
}
