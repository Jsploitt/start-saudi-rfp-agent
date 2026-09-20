import type { IntakeDraft, SessionSummary, ThemePresetId } from '@/types';

/**
 * Every call the operator UI makes. One place, so that when the backend lands
 * there is exactly one file to reconcile against it.
 *
 * Auth is a cookie set by POST /api/auth/login; nothing here handles a token.
 * `credentials: 'same-origin'` is the default for same-origin fetch, stated
 * explicitly because the whole session depends on it.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function json<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: 'same-origin',
    ...init,
    headers:
      init?.body instanceof FormData
        ? init?.headers
        : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // A non-JSON body from a proxy or a crash. Surface the status, not a parse error.
  }

  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

/* ---- auth ---------------------------------------------------------------- */

export const auth = {
  /** The passcode gate. One field; the cookie comes back on the response. */
  login: (passcode: string) =>
    json<{ ok: true }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),

  logout: () => json<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  /**
   * Is this browser already signed in? 401 is a normal answer here, not an
   * error, so it is caught and reported as `false`.
   */
  async check(): Promise<boolean> {
    try {
      await json<{ ok: true }>('/api/auth/me');
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return false;
      throw e;
    }
  },
};

/* ---- health -------------------------------------------------------------- */

export interface Health {
  ok: boolean;
  mode: string;
  running: boolean;
  sessionId?: string;
}

/** Called on load. If a run is already going, the UI re-attaches to it. */
export const health = () => json<Health>('/healthz');

/* ---- sessions ------------------------------------------------------------ */

export const sessions = {
  list: () => json<{ sessions: SessionSummary[] }>('/api/sessions'),

  get: (id: string) => json<SessionSummary>(`/api/sessions/${id}`),

  create: (intake: IntakeDraft) =>
    json<SessionSummary>('/api/sessions', { method: 'POST', body: JSON.stringify(intake) }),

  setTheme: (id: string, themeId: ThemePresetId) =>
    json<{ ok: true; themeId: ThemePresetId }>(`/api/sessions/${id}/theme`, {
      method: 'PATCH',
      body: JSON.stringify({ themeId }),
    }),
};

/* ---- a run --------------------------------------------------------------- */

export interface StartedRun {
  runId: string;
  sessionId?: string;
  url?: string;
  mode?: string;
}

export const run = {
  /** Start from an uploaded file. */
  upload: (file: File, sessionId?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (sessionId) fd.append('sessionId', sessionId);
    return json<StartedRun>('/api/run', { method: 'POST', body: fd });
  },

  /** Start from a path inside the kit — the "use the sample RFP" door. */
  fromPath: (path: string, sessionId?: string) =>
    json<StartedRun>('/api/run', {
      method: 'POST',
      body: JSON.stringify({ path, force: true, sessionId }),
    }),

  answer: (text: string) =>
    json<{ ok: true }>('/api/answer', { method: 'POST', body: JSON.stringify({ text }) }),

  stop: () => json<{ ok: true }>('/api/stop', { method: 'POST' }),

  restart: () => json<{ ok: true }>('/api/restart', { method: 'POST' }),

  exportPdf: () => json<{ url?: string; error?: string }>('/api/export', { method: 'POST' }),
};
