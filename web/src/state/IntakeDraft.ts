import { EMPTY_INTAKE, type Intake } from '@contracts';

/**
 * The intake form between the two steps that use it.
 *
 * The form was originally posted to the server, which created an empty session
 * and handed back an id for the upload step to fill. The server does not work
 * that way: a session id *is* a run id, and a run without an RFP is not a
 * thing it can represent. So the draft lives in the browser for the one
 * navigation between "who is this for?" and "give it the RFP", and both are
 * posted together in the single create call that also starts the agent.
 *
 * `sessionStorage` rather than a React context because the upload step is a
 * URL an operator can reload — and does, when they drop the wrong file — and
 * losing seven typed fields to a refresh is the kind of small cruelty that
 * gets noticed in a demo. Per-tab, so two tabs drafting two proposals do not
 * overwrite each other.
 */

const KEY = 'intake.draft.v1';

export function saveDraft(draft: Intake): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* Private browsing, or a full quota. The draft still travels through the
       router's location state, which is the path that matters. */
  }
}

export function loadDraft(): Intake {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return { ...EMPTY_INTAKE, ...(JSON.parse(raw) as Partial<Intake>) };
  } catch {
    /* A shape from an older build. An empty form is the safe answer: the agent
       asks about every blank field rather than inventing one. */
  }
  return { ...EMPTY_INTAKE };
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Nothing to do. A stale draft is overwritten by the next one. */
  }
}
