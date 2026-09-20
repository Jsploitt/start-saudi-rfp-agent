import { http, HttpResponse } from 'msw';
import type { IntakeDraft, SessionSummary, ThemePresetId } from '@/types';
import { fixtureMeta } from './replay';

/**
 * The HTTP half of the mock backend. The event stream is handled separately by
 * the fixture replayer, because EventSource is not something a service worker
 * can usefully stand in front of.
 *
 * These handlers are a statement of what this UI expects the rebuilt backend to
 * provide, written down in one place so the two can be reconciled cheaply.
 */

const PASSCODE = 'start-saudi';

/* A tiny store, persisted so a reload does not wipe the dashboard. */
const KEY = 'mock.sessions.v1';

function load(): SessionSummary[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as SessionSummary[];
  } catch {
    // Private browsing, or a shape from an older build. Seed fresh.
  }
  return seed();
}

function save(rows: SessionSummary[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    // Nothing to do; the store stays in memory for this tab.
  }
}

function seed(): SessionSummary[] {
  const day = 86_400_000;
  const now = Date.now();
  return [
    {
      id: 'replay',
      clientName: fixtureMeta.clientName,
      assignment: 'Saudi subsidiary formation for a UK engineering SME',
      status: 'done',
      sectionsDone: fixtureMeta.sections,
      sectionsTotal: fixtureMeta.sections,
      createdAt: now - 2 * day,
      updatedAt: now - 2 * day + 446_000,
      themeId: 'start-saudi',
    },
    {
      id: 'hcp-branch',
      clientName: 'Hanseatic Cold Chain GmbH',
      assignment: 'Branch registration and government account activation',
      status: 'waiting',
      sectionsDone: 6,
      sectionsTotal: 16,
      createdAt: now - 4 * 3_600_000,
      updatedAt: now - 11 * 60_000,
      themeId: 'neutral-corporate',
    },
  ];
}

let store = load();

/**
 * Auth and "is a run in progress" both live in storage rather than in a module
 * variable, because both survive a reload in the real system — the first is a
 * cookie, the second is server state — and a mock that forgets them on reload
 * makes the two paths that depend on a reload untestable: signing in once, and
 * re-attaching to a run already under way.
 */
const flag = {
  get(key: string): boolean {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  },
  set(key: string, value: boolean) {
    try {
      if (value) sessionStorage.setItem(key, '1');
      else sessionStorage.removeItem(key);
    } catch {
      // Private browsing. The flag stays false for this tab.
    }
  },
};

const AUTH = 'mock.authed';
const RUNNING = 'mock.running';

export const handlers = [
  /* ---- auth ------------------------------------------------------------ */

  http.post('/api/auth/login', async ({ request }) => {
    const { passcode } = (await request.json()) as { passcode?: string };
    if (passcode?.trim() !== PASSCODE) {
      return HttpResponse.json({ error: 'That passcode is not right.' }, { status: 401 });
    }
    flag.set(AUTH, true);
    return HttpResponse.json(
      { ok: true },
      { headers: { 'Set-Cookie': 'ss_operator=mock; Path=/; SameSite=Lax' } }
    );
  }),

  http.get('/api/auth/me', () =>
    flag.get(AUTH)
      ? HttpResponse.json({ ok: true })
      : HttpResponse.json({ error: 'Not signed in' }, { status: 401 })
  ),

  http.post('/api/auth/logout', () => {
    flag.set(AUTH, false);
    return HttpResponse.json({ ok: true });
  }),

  /* ---- health ---------------------------------------------------------- */

  /* Reports a run as in progress once one has been started in this tab, so a
     reload mid-run takes the re-attach path exactly as it does against the
     real server. */
  http.get('/healthz', () =>
    HttpResponse.json({ ok: true, mode: 'cached', running: flag.get(RUNNING) })
  ),

  /* ---- sessions -------------------------------------------------------- */

  http.get('/api/sessions', () =>
    HttpResponse.json({ sessions: [...store].sort((a, b) => b.updatedAt - a.updatedAt) })
  ),

  http.get('/api/sessions/:id', ({ params }) => {
    const found = store.find((s) => s.id === params.id);
    return found
      ? HttpResponse.json(found)
      : HttpResponse.json({ error: 'No such session.' }, { status: 404 });
  }),

  http.post('/api/sessions', async ({ request }) => {
    const intake = (await request.json()) as IntakeDraft;
    const now = Date.now();
    const created: SessionSummary = {
      id: `s${now.toString(36)}`,
      clientName: intake.clientLegalName || 'Untitled client',
      assignment: intake.assignment || null,
      status: 'queued',
      sectionsDone: 0,
      sectionsTotal: 0,
      createdAt: now,
      updatedAt: now,
      themeId: 'start-saudi',
    };
    store = [created, ...store];
    save(store);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch('/api/sessions/:id/theme', async ({ params, request }) => {
    const { themeId } = (await request.json()) as { themeId: ThemePresetId };
    store = store.map((s) =>
      s.id === params.id ? { ...s, themeId, updatedAt: Date.now() } : s
    );
    save(store);
    return HttpResponse.json({ ok: true, themeId });
  }),

  /* ---- a run ----------------------------------------------------------- */

  /* The replayer is started by the stream subscription, not by this call, so
     all this has to do is answer the way the server does. */
  http.post('/api/run', () => {
    flag.set(RUNNING, true);
    return HttpResponse.json({
      runId: 'replay',
      url: '/runs/recording/proposal.html',
      mode: 'cached',
    });
  }),

  http.post('/api/answer', () => HttpResponse.json({ ok: true })),

  http.post('/api/stop', () => {
    flag.set(RUNNING, false);
    return HttpResponse.json({ ok: true });
  }),

  http.post('/api/restart', () => {
    flag.set(RUNNING, false);
    return HttpResponse.json({ ok: true });
  }),

  http.post('/api/export', async () => {
    await new Promise((r) => setTimeout(r, 1200));
    return HttpResponse.json({ url: '/runs/recording/proposal.pdf' });
  }),
];
