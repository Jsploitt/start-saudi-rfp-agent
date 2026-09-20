import type {
  CreatedSession,
  Health,
  Intake,
  SessionDetail,
  SessionSummary,
} from '@contracts';

/**
 * Every call the operator UI makes. One file, so there is exactly one place to
 * reconcile against the server.
 *
 * This was written against a guessed single-run API — `/api/run`, `/api/answer`,
 * one global stream — while the backend was being built in parallel. It is now
 * the real thing: everything is keyed by a session id, because two operators in
 * two tabs must never see each other's document.
 *
 * Auth is a cookie set by POST /api/auth/login; nothing here handles a token.
 * `credentials: 'same-origin'` is the default for a same-origin fetch, stated
 * explicitly because the whole session depends on it.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The server's machine-readable code: `at_capacity`, `not_running`, … */
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function json<T>(input: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;

  const res = await fetch(input, {
    credentials: 'same-origin',
    ...init,
    headers: {
      /* The CSRF rule: a mutating request must declare a content type a
         cross-site form cannot send. Multipart says so with the header below
         instead, because the browser owns the multipart Content-Type and its
         boundary parameter. */
      ...(isForm ? { 'X-Requested-With': 'fetch' } : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // A non-JSON body from a proxy or a crash. Surface the status, not a parse error.
  }

  if (!res.ok) {
    const err = body as { error?: string; code?: string } | null;
    throw new ApiError(err?.error ?? `${res.status} ${res.statusText}`, res.status, err?.code);
  }
  return body as T;
}

/* ---- auth ---------------------------------------------------------------- */

export const auth = {
  /** The passcode gate. One field; the cookie comes back on the response. */
  login: (passcode: string, name = '') =>
    json<{ ok: true }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ passcode, name }),
    }),

  logout: () => fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }),

  /**
   * Is this browser already signed in? 401 is a normal answer here, not an
   * error, so it is caught and reported as `false`.
   */
  async check(): Promise<boolean> {
    try {
      await json<{ user: { id: string; name: string } }>('/api/auth/me');
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return false;
      throw e;
    }
  },
};

/* ---- health -------------------------------------------------------------- */

/**
 * Called on load, for the mode banner and the capacity warning.
 *
 * It deliberately says nothing about *which* sessions are running — that is
 * per-session state and it lives behind the cookie. /healthz is the one
 * unauthenticated route, so it carries a count and never a secret, a session
 * id or a file path.
 */
export const health = () => json<Health>('/healthz');

/* ---- sessions ------------------------------------------------------------ */

export const sessions = {
  list: (opts: { limit?: number; archived?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (opts.limit) q.set('limit', String(opts.limit));
    if (opts.archived) q.set('archived', '1');
    const qs = q.toString();
    return json<{ sessions: SessionSummary[]; nextCursor: number | null }>(
      `/api/sessions${qs ? `?${qs}` : ''}`
    );
  },

  get: (id: string) => json<SessionDetail>(`/api/sessions/${id}`),

  /**
   * Create a session and start it. The RFP is required at this point: the
   * session id *is* the run id, so there is no such thing here as a session
   * without a document to work on.
   *
   * The intake travels with it — as a JSON string in the multipart case,
   * because a form field is a string and nothing else.
   */
  createFromFile(file: File, intake: Intake, title?: string) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('intake', JSON.stringify(intake));
    if (title) fd.append('title', title);
    return json<CreatedSession>('/api/sessions', { method: 'POST', body: fd });
  },

  /**
   * The "use the sample RFP" door. The server refuses anything outside its tree.
   *
   * `mode` is the demo's parachute. A session created with `mode: 'cached'`
   * replays `fixtures/cached-run.json` through the real stream and the real
   * renderer, on a server that is otherwise live — no restart, no environment
   * change, no cold start, and any session already running is undisturbed.
   * `DEMO_MODE=cached` sets the same thing for the whole instance; this sets it
   * for one run, which is the version you want while standing in front of
   * people.
   */
  createFromPath(path: string, intake: Intake, title?: string, mode?: 'live' | 'cached') {
    return json<CreatedSession>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ path, intake, title, ...(mode ? { mode } : {}) }),
    });
  },

  rename: (id: string, title: string) =>
    json<{ ok: true; title: string }>(`/api/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),

  /** Archives. Nothing is deleted; every artifact stays where it is. */
  archive: (id: string) =>
    json<{ ok: true; archivedAt: number }>(`/api/sessions/${id}`, { method: 'DELETE' }),

  setTheme: (id: string, preset: string | null, accent: string | null = null) =>
    json<{ ok: true; theme: { preset: string | null; accent: string | null } }>(
      `/api/sessions/${id}/theme`,
      { method: 'PATCH', body: JSON.stringify({ preset, accent }) }
    ),

  answer: (id: string, text: string) =>
    json<{ ok: true }>(`/api/sessions/${id}/answer`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  stop: (id: string) => json<{ ok: true }>(`/api/sessions/${id}/stop`, { method: 'POST' }),

  /** A new session over the same RFP. The old one stays intact and readable. */
  restart: (id: string) =>
    json<CreatedSession>(`/api/sessions/${id}/restart`, { method: 'POST' }),

  /**
   * Ask for the PDF. Returns as soon as the job is queued, not when the file
   * exists: Chromium takes five to fifteen seconds and a request that hangs
   * that long reads as a crash. The URL arrives on the stream as a `pdf` event.
   */
  exportPdf: (id: string) =>
    json<{ ok: true }>(`/api/sessions/${id}/export`, { method: 'POST' }),
};
