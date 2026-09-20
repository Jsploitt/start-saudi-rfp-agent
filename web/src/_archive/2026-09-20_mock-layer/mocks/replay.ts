import type { Phase, RunEvent, Stamped } from '@/types';
import type { EventSink } from '@/api/stream';
import { replaySpeed, stallAt } from './mode';
import raw from '@fixtures/cached-run.json';

/**
 * Replays fixtures/cached-run.json as if it were arriving live.
 *
 * The fixture is a real nine-minute recording, which makes it the best test
 * data in the project: it carries the two silences that the whole progress
 * design exists for — a 43-second gap between the brief and the first section,
 * and a 97-second gap before the reviewer reports. Those are preserved
 * proportionally rather than smoothed away, because a replay with no dead air
 * would not test the thing worth testing.
 *
 * Two kinds of event are synthesised on top of the recording, because it
 * predates both: `phase`/`session`, which are persisted, and `heartbeat`,
 * which is transient and carries seq -1.
 */

interface Recorded {
  recordedAt: string;
  events: (RunEvent & { at: number; seq: number })[];
}

const fixture = raw as unknown as Recorded;

/** A nine-minute budget, the same one src/server.ts hands the agent. */
const DEADLINE_MS = 9 * 60_000;

/* ------------------------------------------------------------------------ *
 * Working out which phase the agent was in, from a recording that never said
 * ------------------------------------------------------------------------ */

/**
 * Phase boundaries inferred from the recorded stream. The two that matter are
 * placed at the *start* of a silence rather than at the event that ends it:
 * `researching` begins when the brief is written, not when the researcher
 * reports back, and `reviewing` begins after the last section of the first
 * pass, not when the findings arrive. Placed the other way round, the UI would
 * announce each quiet phase only once it was already over — which is precisely
 * the failure being fixed.
 */
function planPhases(events: Recorded['events']): Map<number, Phase> {
  const at = new Map<number, Phase>();
  at.set(0, 'reading-rfp');

  const indexOfType = (t: RunEvent['type'], from = 0) =>
    events.findIndex((e, i) => i >= from && e.type === t);

  const question = indexOfType('question');
  if (question >= 0) at.set(question, 'asking');

  const answer = indexOfType('answer');
  if (answer >= 0) at.set(answer, 'briefing');

  const brief = indexOfType('brief');
  if (brief >= 0) at.set(brief, 'researching');

  const firstSection = indexOfType('section:start');
  if (firstSection >= 0) at.set(firstSection, 'composing');

  const review = indexOfType('review');
  if (review > 0) {
    // The silence belongs to the reviewer, so the phase starts before it.
    at.set(review - 1, 'reviewing');
    at.set(review, 'fixing');
    const afterReview = indexOfType('section:start', review + 1);
    if (afterReview >= 0) at.set(afterReview, 'composing');
  }

  const done = indexOfType('done');
  if (done >= 0) at.set(done, 'ready');

  return at;
}

/* ------------------------------------------------------------------------ */

export function startReplay(sink: EventSink): () => void {
  const events = fixture.events;
  const first = events[0];
  if (!first) return () => {};

  const speed = replaySpeed();
  const stall = stallAt();
  const t0 = first.at;
  const phasePlan = planPhases(events);
  const sessionId = 'replay';

  const timers: ReturnType<typeof setTimeout>[] = [];
  let closed = false;

  /* Live state, kept so the heartbeat can report something true. */
  const startedWall = Date.now();
  let phase: Phase = 'reading-rfp';
  let sectionsDone = 0;
  let sectionsTotal = 0;
  let lastActivityWall = startedWall;
  let finished = false;
  let stalled = false;

  const emit = (e: RunEvent, seq: number) => {
    if (closed) return;
    sink({ ...e, sessionId, at: Date.now(), seq } as Stamped);
  };

  /* The persisted stream, replayed on its own recorded clock. */
  let seq = 0;
  events.forEach((e, i) => {
    const offset = (e.at - t0) / speed;
    if (stall !== null && e.at - t0 >= stall) {
      // Everything from here on is simply never delivered.
      return;
    }

    timers.push(
      setTimeout(() => {
        const nextPhase = phasePlan.get(i);
        if (nextPhase && nextPhase !== phase) {
          phase = nextPhase;
          emit({ type: 'phase', phase, label: labelFor(phase) }, seq++);
        }

        const { at: _at, seq: _seq, ...payload } = e;
        emit(payload as RunEvent, seq++);

        lastActivityWall = Date.now();
        if (e.type === 'section:done') {
          sectionsDone = e.index;
          sectionsTotal = e.total;
        }
        if (e.type === 'outline') sectionsTotal = e.sections.length;
        if (e.type === 'done') {
          finished = true;
          emit({ type: 'session', status: 'done' }, seq++);
        }
      }, offset)
    );
  });

  if (stall !== null) {
    // Let the heartbeat run on for a while past the cut, then let it die, so
    // both "gone quiet" and `alive: false` are reachable on demand.
    timers.push(
      setTimeout(
        () => {
          stalled = true;
        },
        stall / speed + 30_000
      )
    );
  }

  emit({ type: 'session', status: 'running' }, seq++);

  /**
   * The heartbeat: one a second, transient, seq -1. This is the only event
   * that arrives during the researcher's and the reviewer's silences, and
   * everything the status component shows is read from it.
   */
  const beat = setInterval(() => {
    if (closed || finished) return;
    const now = Date.now();
    const elapsedMs = now - startedWall;
    emit(
      {
        type: 'heartbeat',
        phase,
        elapsedMs,
        sinceLastActivityMs: now - lastActivityWall,
        sectionsDone,
        sectionsTotal,
        deadlineRemainingMs: Math.max(0, DEADLINE_MS / speed - elapsedMs),
        alive: !stalled,
      },
      -1
    );
  }, 1000);

  return () => {
    closed = true;
    clearInterval(beat);
    for (const t of timers) clearTimeout(t);
  };
}

function labelFor(p: Phase): string {
  return (
    {
      'reading-rfp': 'Reading the RFP',
      asking: 'Asking the client',
      briefing: 'Writing the brief',
      researching: 'Researching',
      composing: 'Composing',
      reviewing: 'Reviewing',
      fixing: 'Fixing',
      ready: 'Ready',
      printing: 'Printing',
    } satisfies Record<Phase, string>
  )[p];
}

/** The fixture's own out-of-band payloads, used by the mock REST handlers. */
export const fixtureMeta = {
  recordedAt: fixture.recordedAt,
  clientName:
    (fixture.events.find((e) => e.type === 'rfp') as { analysis?: { client?: { name?: string } } })
      ?.analysis?.client?.name ?? 'Recorded client',
  sections: fixture.events.filter((e) => e.type === 'section:done').length,
};
