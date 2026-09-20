import type {
  ChatMessage,
  ClientEvent,
  LogRow,
  RfpAnalysis,
  RunAction,
  RunState,
  SectionState,
} from '@/types';
import { PHASES } from '@/lib/phases';
import { truncate } from '@/lib/format';

/**
 * The switch in the old public/app.js was the real specification for what this
 * UI renders. It is reproduced here as a pure reducer, case for case, with the
 * events the contract has gained since (`phase`, `session`, `pdf`, `heartbeat`)
 * added. Nothing renders that does not pass through here.
 */

export const initialRunState: RunState = {
  startedAt: null,
  session: 'queued',
  statusKind: 'idle',
  statusText: 'Not started',
  mode: null,

  chat: [],
  log: [],

  rfp: null,
  brief: null,
  outline: [],
  sectionState: {},

  sectionsDone: 0,
  sectionsTotal: 0,

  previewUrl: null,
  previewSectionId: null,
  writingSectionId: null,
  pdfUrl: null,

  phase: null,
  phaseLabel: null,
  phaseSince: null,

  heartbeat: null,

  waitingForAnswer: false,
  finished: false,
  stopped: false,
  elapsedMsFinal: null,
  answerPlaceholder: 'Answer the agent…',

  lastSeq: -1,
};

let counter = 0;
const nextId = () => `r${++counter}`;

/* ------------------------------------------------------------------------ *
 * Log rows
 * ------------------------------------------------------------------------ */

/**
 * Consecutive rows of the same kind and headline collapse into one, with a
 * counter and a merged detail list — three "Checking the library" calls in a
 * row become one row reading ×3, not three lines down the timeline.
 *
 * Only the *last* row collapses, which is deliberate: an interleaved event
 * breaks the streak and the next repeat starts a fresh row, so the log stays
 * an honest ordering of what happened.
 */
function pushLog(
  state: RunState,
  kind: string,
  what: string,
  detail: string | undefined,
  at: number
): LogRow[] {
  const last = state.log[state.log.length - 1];
  if (last && last.kind === kind && last.what === what) {
    const merged: LogRow = {
      ...last,
      count: last.count + 1,
      details: detail ? [...last.details, detail] : last.details,
      at,
    };
    return [...state.log.slice(0, -1), merged];
  }

  const row: LogRow = {
    id: nextId(),
    kind,
    what,
    details: detail ? [detail] : [],
    count: 1,
    at,
    tSeconds: state.startedAt ? Math.round((at - state.startedAt) / 1000) : null,
  };
  return [...state.log, row];
}

function pushChat(
  state: RunState,
  kind: ChatMessage['kind'],
  who: string,
  text: string,
  at: number
): ChatMessage[] {
  return [...state.chat, { id: nextId(), kind, who, text, at }];
}

function markSection(
  state: RunState,
  id: string,
  value: SectionState
): Record<string, SectionState> {
  return { ...state.sectionState, [id]: value };
}

/* ------------------------------------------------------------------------ *
 * The reducer
 * ------------------------------------------------------------------------ */

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'reset':
      return { ...initialRunState, mode: state.mode };

    /**
     * What the session endpoint said, applied before the event log replays.
     *
     * Without this a reopened session renders for a moment as an empty run —
     * no outline, no document, status "Not started" — and then snaps into
     * place as the replay arrives. The replay is authoritative and overwrites
     * all of this; the point is only that the first frame is not a lie.
     */
    case 'hydrate': {
      const d = action.detail;
      return {
        ...state,
        mode: d.mode && d.mode !== 'live' ? d.mode : null,
        session: d.status,
        statusKind: statusKindFor(d.status, state.statusKind),
        statusText: statusTextFor(d.status, state.statusText),
        phase: d.phase,
        phaseLabel: d.phase ? PHASES[d.phase].label : null,
        startedAt: state.startedAt ?? d.createdAt,
        outline: d.outline,
        rfp: (d.rfp as RfpAnalysis | null) ?? null,
        brief: d.brief ?? null,
        sectionsDone: Math.max(state.sectionsDone, d.sections),
        sectionsTotal: Math.max(state.sectionsTotal, d.outline.length, d.sections),
        /* The document exists on disk whether or not this tab has seen a
           `preview` event, so a finished session shows its proposal at once. */
        previewUrl: state.previewUrl ?? (d.sections ? d.proposalUrl : null),
        finished: d.status === 'done',
        stopped: d.status === 'stopped',
      };
    }

    case 'local-error':
      return {
        ...state,
        statusKind: 'error',
        statusText: action.what,
        log: pushLog(state, 'error', action.what, action.detail, Date.now()),
      };

    case 'event':
      return applyEvent(state, action.event);
  }
}

/**
 * `ClientEvent`, not `Stamped`: what a browser receives is the persisted union
 * plus the transient heartbeat, and folding them together is what lets one
 * switch handle both. The switch is exhaustive over that union, so an event
 * the server adds and this file does not handle is a compile error rather than
 * a silently ignored frame.
 */
function applyEvent(state: RunState, e: ClientEvent): RunState {
  const at = e.at || Date.now();

  /* `seq === -1` marks a transient event — currently only the heartbeat.
     Render it, but never advance the replay cursor past it. */
  const withSeq = (next: RunState): RunState =>
    e.seq === -1 ? next : { ...next, lastSeq: Math.max(next.lastSeq, e.seq) };

  switch (e.type) {
    /* ---- the agent narrating itself ----------------------------------- */

    case 'act':
      return withSeq({ ...state, log: pushLog(state, 'act', e.verb, e.detail, at) });

    case 'agent':
      return withSeq({ ...state, chat: pushChat(state, 'agent', 'Agent', e.text, at) });

    case 'status':
      return withSeq({
        ...state,
        log: pushLog(state, 'status', e.text, undefined, at),
        statusKind: 'working',
        statusText: e.text,
      });

    /* ---- the conversation ---------------------------------------------- */

    case 'question': {
      const chat = pushChat(state, 'question', 'Agent asks', e.text, at);
      return withSeq({
        ...state,
        chat,
        log: pushLog(state, 'question', 'Asked the client about the gaps', undefined, at),
        waitingForAnswer: true,
        session: 'waiting',
        statusKind: 'waiting',
        statusText: 'Waiting for your answer',
      });
    }

    case 'answer':
      return withSeq({
        ...state,
        chat: pushChat(state, 'you', 'You', e.text, at),
        waitingForAnswer: false,
        session: state.finished ? state.session : 'running',
        statusKind: state.finished ? state.statusKind : 'working',
        statusText: state.finished ? state.statusText : 'Working…',
      });

    /* ---- what it understood -------------------------------------------- */

    case 'rfp': {
      const a = e.analysis as RfpAnalysis | null;
      const reqs = a?.requirements?.length ?? 0;
      const gaps = a?.gaps?.length ?? 0;
      return withSeq({
        ...state,
        rfp: a ?? null,
        log: pushLog(state, 'rfp', 'Read the RFP', `${reqs} requirements · ${gaps} gaps`, at),
      });
    }

    case 'brief':
      return withSeq({
        ...state,
        brief: e.brief,
        log: pushLog(state, 'brief', 'Wrote the brief', undefined, at),
      });

    case 'outline': {
      const sectionState: Record<string, SectionState> = {};
      for (const s of e.sections) sectionState[s.id] = 'pending';
      return withSeq({
        ...state,
        outline: e.sections,
        sectionState,
        sectionsTotal: state.sectionsTotal || e.sections.length,
        log: pushLog(state, 'outline', 'Planned the document', `${e.sections.length} sections`, at),
      });
    }

    /* ---- writing -------------------------------------------------------- */

    case 'section:start':
      return withSeq({
        ...state,
        sectionState: markSection(state, e.id, 'doing'),
        writingSectionId: e.id,
      });

    /**
     * `e.index` is NOT the section counter.
     *
     * The old UI used it as one, and it is wrong in a way that only shows up
     * on a long run: during the fixing pass the agent re-emits `section:done`
     * for the sections it rewrites, with an index relative to that pass rather
     * than to the document. Taking it verbatim sends the counter from "17 of
     * 17" back to "1 of 17" while the reviewer's findings are being applied,
     * which is the exact opposite of a progress indicator that always reports
     * something true.
     *
     * The honest number is how many distinct sections exist in the document,
     * so it is counted from the sections marked done. It cannot regress, and
     * it cannot exceed the outline. The event's own index and total are still
     * reported verbatim in the log row, because that is what the agent said.
     */
    case 'section:done': {
      const sectionState = markSection(state, e.id, 'done');
      const written = Object.values(sectionState).filter((v) => v === 'done').length;
      return withSeq({
        ...state,
        sectionState,
        sectionsDone: written,
        /* `written` is in the max because the agent can write a section the
           outline did not plan — the recorded run ends with 18 sections against
           a 17-line outline. A total smaller than the count would render as
           "18 of 17". */
        sectionsTotal: Math.max(state.sectionsTotal, state.outline.length, e.total, written),
        writingSectionId: null,
        log: pushLog(state, 'section:done', e.title, `page ${e.index} of ${e.total}`, at),
      });
    }

    case 'preview':
      return withSeq({
        ...state,
        previewUrl: e.url,
        previewSectionId: e.sectionId ?? null,
      });

    /* ---- the quiet phases ----------------------------------------------- */

    case 'research':
      return withSeq({
        ...state,
        log: pushLog(
          state,
          'research',
          'The researcher reported back',
          e.items.map((s) => truncate(s, 150)).join('  ·  '),
          at
        ),
      });

    case 'review': {
      if (!e.findings.length) {
        return withSeq({
          ...state,
          log: pushLog(state, 'review', 'The reviewer found nothing to fix', undefined, at),
        });
      }
      const n = e.findings.length;
      return withSeq({
        ...state,
        log: pushLog(
          state,
          'review',
          `The reviewer found ${n} thing${n === 1 ? '' : 's'}`,
          e.findings.map((f) => `[${f.severity}] ${f.requirement}`).join(' · '),
          at
        ),
      });
    }

    /* ---- trouble --------------------------------------------------------- */

    case 'warn':
      return withSeq({ ...state, log: pushLog(state, 'warn', e.text, undefined, at) });

    case 'error':
      return withSeq({
        ...state,
        log: pushLog(state, 'error', e.message, undefined, at),
        session: 'error',
        statusKind: 'error',
        statusText: 'Something went wrong',
      });

    /* ---- the end, which is really the middle ----------------------------- */

    case 'done':
      return withSeq({
        ...state,
        previewUrl: e.url || state.previewUrl,
        /* Same reasoning as `section:done`: prefer the sections actually
           counted over the total the agent reports, which can disagree with
           the outline it wrote to. */
        sectionsDone: state.outline.length ? state.sectionsDone : e.sections,
        sectionsTotal: Math.max(state.sectionsTotal, state.outline.length, state.sectionsDone),
        finished: true,
        elapsedMsFinal: e.elapsedMs,
        session: 'done',
        statusKind: 'ready',
        statusText: 'Ready — ask for a change',
        /* The document being finished is the middle of the demo, not the end:
           the session stays open for changes. Say so. */
        answerPlaceholder: 'Ask for a change — "give me the executive summary in Arabic"',
        log: pushLog(
          state,
          'done',
          'Finished',
          `${e.sections} sections in ${Math.round(e.elapsedMs / 1000)}s`,
          at
        ),
      });

    case 'stopped':
      return withSeq({
        ...state,
        chat: pushChat(state, 'agent', 'Agent', 'Stopped — the document is as far as it got.', at),
        log: pushLog(state, 'stopped', 'Stopped by you', undefined, at),
        stopped: true,
        session: 'stopped',
        statusKind: 'stopped',
        statusText: 'Stopped',
        waitingForAnswer: false,
      });

    /* ---- events the contract gained after the old UI was written ---------- */

    case 'phase': {
      const changed = state.phase !== e.phase;
      return withSeq({
        ...state,
        phase: e.phase,
        phaseLabel: PHASES[e.phase].label,
        phaseSince: changed ? at : (state.phaseSince ?? at),
      });
    }

    case 'session':
      return withSeq({
        ...state,
        session: e.status,
        statusKind: statusKindFor(e.status, state.statusKind),
        statusText: statusTextFor(e.status, state.statusText),
      });

    case 'pdf':
      return withSeq({
        ...state,
        pdfUrl: e.url,
        log: pushLog(state, 'pdf', 'PDF ready', e.url, at),
      });

    /**
     * The heartbeat. Transient (seq === -1), so it never advances the cursor
     * and never appears in a late subscriber's replay. It is the only reason
     * the researcher's 90 seconds and the reviewer's 120 seconds do not look
     * like a hung process.
     */
    case 'heartbeat': {
      const phaseChanged = state.phase !== e.phase;
      const label = e.phase ? PHASES[e.phase].label : state.phaseLabel;
      return {
        ...state,
        phase: e.phase,
        phaseLabel: state.phaseLabel && !phaseChanged ? state.phaseLabel : label,
        phaseSince: phaseChanged ? at : (state.phaseSince ?? at),
        sectionsDone: Math.max(state.sectionsDone, e.sectionsDone),
        sectionsTotal: e.sectionsTotal || state.sectionsTotal,
        startedAt: state.startedAt ?? at - e.elapsedMs,
        heartbeat: {
          phase: e.phase,
          elapsedMs: e.elapsedMs,
          sinceLastActivityMs: e.sinceLastActivityMs,
          sectionsDone: e.sectionsDone,
          sectionsTotal: e.sectionsTotal,
          deadlineRemainingMs: e.deadlineRemainingMs,
          alive: e.alive,
          receivedAt: Date.now(),
        },
      };
    }
  }

  /* Every case above returns, so this is unreachable for any event the
     contract declares. It exists for the one that does not: a server running
     ahead of this bundle sends a type this switch has never seen, and dropping
     it is better than throwing inside a reducer mid-render. */
  return state;
}

function statusKindFor(s: RunState['session'], fallback: RunState['statusKind']) {
  switch (s) {
    case 'running':
      return 'working' as const;
    case 'waiting':
      return 'waiting' as const;
    case 'done':
      return 'ready' as const;
    case 'stopped':
      return 'stopped' as const;
    case 'error':
    case 'orphaned':
      return 'error' as const;
    default:
      return fallback;
  }
}

function statusTextFor(s: RunState['session'], fallback: string) {
  switch (s) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Working…';
    case 'waiting':
      return 'Waiting for your answer';
    case 'done':
      return 'Ready — ask for a change';
    case 'stopped':
      return 'Stopped';
    case 'error':
      return 'Something went wrong';
    case 'orphaned':
      return 'This run lost its agent';
    default:
      return fallback;
  }
}
