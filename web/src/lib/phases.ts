import type { Phase } from '@/types';

/**
 * Plain-English labels and, more usefully, an honest expectation of how long
 * each phase takes. The two long ones are the reason the status component
 * exists at all: the researcher can run for 90 seconds and the reviewer for
 * 120, and across both of those windows the event stream is silent.
 *
 * `quietMs` is not a progress estimate and is never used to advance anything.
 * It is only used to decide when a silence is normal and when it is worth
 * saying out loud that nothing has arrived for a while.
 */
export interface PhaseMeta {
  label: string;
  /** What the agent is actually doing, in one line, for the operator. */
  detail: string;
  /** How long this phase can legitimately go without emitting an event. */
  quietMs: number;
}

export const PHASES: Record<Phase, PhaseMeta> = {
  'reading-rfp': {
    label: 'Reading the RFP',
    detail: 'Pulling out requirements, dates and the gaps worth asking about.',
    quietMs: 20_000,
  },
  asking: {
    label: 'Asking the client',
    detail: 'Waiting on an answer to the gaps it found.',
    quietMs: 0,
  },
  briefing: {
    label: 'Writing the brief',
    detail: 'Turning the RFP and your answers into a scope it can draft from.',
    quietMs: 30_000,
  },
  researching: {
    label: 'Researching',
    detail: 'Searching the library. This phase runs quiet for up to 90 seconds.',
    quietMs: 90_000,
  },
  composing: {
    label: 'Composing',
    detail: 'Writing sections. Each one lands in the document as it finishes.',
    quietMs: 45_000,
  },
  reviewing: {
    label: 'Reviewing',
    detail: 'Checking the draft against every requirement. Up to 120 seconds, silent.',
    quietMs: 120_000,
  },
  fixing: {
    label: 'Fixing',
    detail: 'Rewriting what the review flagged.',
    quietMs: 60_000,
  },
  ready: {
    label: 'Ready',
    detail: 'The document is written. Ask for a change and it keeps going.',
    quietMs: 0,
  },
  printing: {
    label: 'Printing',
    detail: 'Rendering the PDF.',
    quietMs: 30_000,
  },
};

export const PHASE_ORDER: Phase[] = [
  'reading-rfp',
  'asking',
  'briefing',
  'researching',
  'composing',
  'reviewing',
  'fixing',
  'ready',
];

export function phaseMeta(p: Phase | null): PhaseMeta | null {
  return p ? PHASES[p] : null;
}
