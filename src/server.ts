/**
 * Express + SSE + static. The single entry point.
 *
 * Everything under /api is keyed by a session id, and every session id is also
 * the directory name its artifacts live in. One id, one word.
 */

import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import multer from 'multer';
import { mkdirSync, existsSync, copyFileSync, renameSync } from 'node:fs';
import { isAbsolute, join, basename, relative, resolve } from 'node:path';
import { PUBLIC_DIR, RUNS_DIR, UPLOADS_DIR, KIT_DIR, ROOT, DATA_DIR } from './paths.js';
import { isMain } from './isMain.js';
import {
  Run,
  createRun,
  dropRun,
  getRun,
  liveRuns,
  runningCount,
  newSessionId,
} from './run.js';
import { Inbox, runAgent } from './agent.js';
import { exportPdf } from './export/pdf.js';
import { replayCachedRun } from './cached.js';
import * as store from './db/store.js';
import { getDb, closeDb } from './db/index.js';
import { rehydrate, summarise } from './sessions/rehydrate.js';
import { ensureUploadDir } from './sessions/artifacts.js';
import { MAX_CONCURRENT_RUNS, exportMutex } from './sessions/concurrency.js';
import { startWatchdog } from './sessions/watchdog.js';
import {
  startInternalStatic,
  internalOrigin,
  stopInternalStatic,
} from './sessions/internal.js';
import {
  COOKIE,
  cookieOptions,
  login,
  passcodeMatches,
  requireAuth,
  requireSameOrigin,
} from './auth/index.js';
import type { Stamped } from './events.js';
import { EMPTY_INTAKE, hasIntake, type Intake } from './contracts.js';

const upload = multer({ dest: join(DATA_DIR, 'tmp-uploads') });

const DEADLINE_MS = 9 * 60_000;

/** The UI is styled from the kit's own tokens. One source of colour. */
const TOKENS_PATH = join(KIT_DIR, 'brand', 'tokens.css');

/**
 * Resolve a caller-supplied RFP path, inside the source tree and nowhere else.
 *
 * The `path` field exists for one reason: the "use the sample RFP" door. It is
 * a string from an authenticated browser, which is not the same as a trusted
 * one — `{"path":"../../../../etc/passwd"}` used to resolve, exist, and be fed
 * to the agent, because the old version only asked whether the file was there.
 *
 * Two rules now. An absolute path is refused outright: nothing legitimate
 * sends one. A relative path is resolved against each base and then checked to
 * be genuinely underneath it, with `relative()` rather than a string prefix so
 * that a sibling directory named like the base cannot pass.
 */
function resolveRfp(arg: string): string {
  if (!arg || isAbsolute(arg) || /^[a-zA-Z]:/.test(arg)) {
    throw new Error('That path is not allowed.');
  }
  for (const base of [ROOT, KIT_DIR]) {
    const p = resolve(base, arg);
    const rel = relative(base, p);
    if (rel.startsWith('..') || isAbsolute(rel)) continue;
    if (existsSync(p)) return p;
  }
  throw new Error(`RFP not found: ${arg}`);
}

/**
 * The intake form off the wire. Multipart sends it as a JSON string, JSON
 * sends it as an object, and either way every field is coerced to a trimmed,
 * bounded string. Unknown keys are dropped: the shape is this app's, not the
 * caller's.
 */
function readIntake(raw: unknown): Intake | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const src = obj as Record<string, unknown>;
  const intake = { ...EMPTY_INTAKE };
  for (const key of Object.keys(EMPTY_INTAKE) as (keyof Intake)[]) {
    intake[key] = String(src[key] ?? '').trim().slice(0, 300);
  }
  return hasIntake(intake) ? intake : null;
}

/** Look in memory first, then the tables. Null means it never existed. */
function findRun(id: string): Run | null {
  const live = getRun(id);
  if (live) return live;
  const row = store.getSession(id);
  return row ? rehydrate(row) : null;
}

const bad = (res: Response, status: number, error: string, code?: string) =>
  res.status(status).json(code ? { error, code } : { error });

export function createServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));
  app.use(cookieParser());

  /* Public: the login page's own assets, and the health check. */
  app.use(express.static(PUBLIC_DIR));

  app.get('/healthz', (_req, res) =>
    res.json({
      ok: true,
      version: process.env.APP_VERSION ?? '0.1.0',
      mode: process.env.DEMO_MODE ?? 'live',
      activeRuns: runningCount(),
      capacity: MAX_CONCURRENT_RUNS,
    })
  );

  app.get('/brand/tokens.css', (_req, res) => res.sendFile(TOKENS_PATH));

  /* ------------------------------------------------------------- auth --- */

  app.post('/api/auth/login', requireSameOrigin, async (req, res) => {
    const supplied = String(req.body?.passcode ?? '');
    if (!supplied || !passcodeMatches(supplied)) {
      return bad(res, 401, 'That passcode is not right.', 'bad_passcode');
    }
    const token = await login(String(req.body?.name ?? ''));
    res.cookie(COOKIE, token, cookieOptions());
    res.json({ ok: true });
  });

  app.post('/api/auth/logout', requireSameOrigin, (_req, res) => {
    res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
    res.status(204).end();
  });

  /* Everything below this line needs a cookie, including the documents. */
  app.use('/api', requireAuth, requireSameOrigin);
  app.use('/runs', requireAuth, express.static(RUNS_DIR));

  app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));

  /* --------------------------------------------------------- sessions --- */

  app.get('/api/sessions', (req, res) => {
    const limit = Number(req.query.limit ?? 25);
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;
    const includeArchived = req.query.archived === '1';
    const rows = store.listSessions({ limit, cursor, includeArchived });
    const counts = store.countSectionsFor(rows.map((r) => r.id));
    res.json({
      sessions: rows.map((r) => summarise(r, counts.get(r.id) ?? 0)),
      nextCursor: rows.length === limit ? (rows[rows.length - 1]?.createdAt ?? null) : null,
    });
  });

  app.post(
    '/api/sessions',
    upload.single('file'),
    async (req: Request, res: Response) => {
      if (runningCount() >= MAX_CONCURRENT_RUNS) {
        return bad(
          res,
          429,
          `${MAX_CONCURRENT_RUNS} sessions are already running. Wait for one to finish.`,
          'at_capacity'
        );
      }

      const mode = String(req.body?.mode ?? process.env.DEMO_MODE ?? 'live');
      const id = newSessionId();

      /* Uploads live under the session, with the original filename, so a restart
         can still find the RFP the run was started from. */
      let rfpPath: string;
      let rfpName: string;
      try {
        if (req.file) {
          const dir = ensureUploadDir(id);
          rfpName = basename(req.file.originalname || req.file.filename);
          rfpPath = join(dir, rfpName);
          renameSync(req.file.path, rfpPath);
        } else {
          rfpPath = resolveRfp(String(req.body?.path ?? 'proposal/sample-rfp.md'));
          rfpName = basename(rfpPath);
        }
      } catch (e) {
        return bad(res, 400, (e as Error).message, 'bad_rfp');
      }

      const run = createRun({
        id,
        title: String(req.body?.title ?? '').trim() || rfpName,
        mode,
        rfpPath,
        rfpName,
        restartedFrom: String(req.body?.restartedFrom ?? '') || null,
        userId: req.user?.id ?? null,
        intake: readIntake(req.body?.intake),
      });

      const autostart = req.body?.autostart === undefined || truthy(req.body.autostart);
      res.status(201).json({ sessionId: run.id, url: run.proposalUrl, mode, autostart });

      if (autostart) start(run);
    }
  );

  app.get('/api/sessions/:id', (req, res) => {
    const run = findRun(req.params.id);
    const row = store.getSession(req.params.id);
    if (!run || !row) return bad(res, 404, 'No such session.', 'not_found');
    res.json({
      ...summarise(row, run.sectionCount()),
      proposalUrl: run.proposalUrl,
      theme: run.theme,
      outline: run.outline,
      rfp: run.rfp,
      brief: run.brief,
      intake: run.intake,
      lastSeq: store.lastSeq(run.id),
      sinceLastActivityMs: run.running ? run.sinceLastActivityMs : null,
    });
  });

  app.patch('/api/sessions/:id', (req, res) => {
    const run = findRun(req.params.id);
    if (!run) return bad(res, 404, 'No such session.', 'not_found');
    const title = String(req.body?.title ?? '').trim();
    if (!title) return bad(res, 400, 'A title is required.', 'bad_title');
    run.setTitle(title.slice(0, 200));
    res.json({ ok: true, title: run.title });
  });

  /** Archive. Nothing is ever deleted: the artifacts stay exactly where they are. */
  app.delete('/api/sessions/:id', (req, res) => {
    const run = findRun(req.params.id);
    if (!run) return bad(res, 404, 'No such session.', 'not_found');
    if (run.running) {
      run.stopRequested = true;
      run.interruptHandle?.();
    }
    store.updateSession(run.id, { archivedAt: Date.now() });
    dropRun(run.id);
    res.json({ ok: true, archivedAt: Date.now() });
  });

  app.patch('/api/sessions/:id/theme', (req, res) => {
    const run = findRun(req.params.id);
    if (!run) return bad(res, 404, 'No such session.', 'not_found');
    const preset = req.body?.preset == null ? null : String(req.body.preset).slice(0, 40);
    const accent = req.body?.accent == null ? null : String(req.body.accent).slice(0, 40);
    run.setTheme(preset, accent);
    res.json({ ok: true, theme: run.theme });
  });

  /** Full blocks, for a renderer that is not an iframe. */
  app.get('/api/sessions/:id/sections', (req, res) => {
    const run = findRun(req.params.id);
    if (!run) return bad(res, 404, 'No such session.', 'not_found');
    res.json({ outline: run.outline, sections: run.orderedSections() });
  });

  app.post('/api/sessions/:id/answer', (req, res) => {
    const run = getRun(req.params.id);
    const text = String(req.body?.text ?? '').trim();
    if (!text) return bad(res, 400, 'Empty.', 'empty');
    if (!run?.running) return bad(res, 409, 'That session is not running.', 'not_running');
    run.touch();
    if (run.status === 'waiting') run.setStatus('running');
    run.bus.emitEvent({ type: 'answer', text });
    run.inbox?.push(text);
    res.status(202).json({ ok: true });
  });

  app.post('/api/sessions/:id/stop', (req, res) => {
    const run = getRun(req.params.id);
    if (!run?.running) return bad(res, 409, 'That session is not running.', 'not_running');
    run.stopRequested = true;
    run.interruptHandle?.();
    res.status(202).json({ ok: true });
  });

  /** A new session over the same RFP. The old one is left intact and readable. */
  app.post('/api/sessions/:id/restart', (req, res) => {
    const previous = findRun(req.params.id);
    if (!previous) return bad(res, 404, 'No such session.', 'not_found');
    if (!previous.rfpPath) return bad(res, 409, 'That session has no RFP to re-run.', 'no_rfp');
    if (runningCount() >= MAX_CONCURRENT_RUNS) {
      return bad(res, 429, 'At capacity. Wait for a session to finish.', 'at_capacity');
    }

    const run = createRun({
      title: previous.title,
      mode: previous.mode,
      rfpPath: previous.rfpPath,
      rfpName: previous.rfpName,
      restartedFrom: previous.id,
      userId: req.user?.id ?? null,
      /* A re-run of the same RFP is a re-run of the same engagement. Asking
         for the client's legal name a second time would be absurd. */
      intake: previous.intake,
    });
    res.status(201).json({ sessionId: run.id, url: run.proposalUrl, restartedFrom: previous.id });
    start(run);
  });

  /**
   * Async, because Chromium takes five to fifteen seconds and a request that
   * hangs that long reads as a crash. The PDF arrives on the stream.
   */
  app.post('/api/sessions/:id/export', (req, res) => {
    const run = findRun(req.params.id);
    if (!run?.sectionCount()) return bad(res, 409, 'Nothing to export.', 'empty');

    res.status(202).json({ ok: true });

    void exportMutex.run(async () => {
      const origin = internalOrigin() ?? (await startInternalStatic());
      try {
        /* A rehydrated session has its sections in memory but may not have
           written the document in this process. Re-render before printing. */
        run.writeProposal();
        run.bus.emitEvent({ type: 'act', verb: 'Printing the PDF' });
        const url = await exportPdf(run, origin);
        run.bus.emitEvent({ type: 'act', verb: 'PDF ready', detail: url });
        run.bus.emitEvent({ type: 'pdf', url });
      } catch (e) {
        run.bus.emitEvent({ type: 'error', message: `PDF export failed: ${(e as Error).message}` });
      }
    });
  });

  /* ----------------------------------------------------------- stream --- */

  app.get('/api/sessions/:id/events', (req, res) => {
    const run = findRun(req.params.id);
    if (!run) return bad(res, 404, 'No such session.', 'not_found');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');

    /* The browser resends Last-Event-ID for free on reconnect, so the seq on the
       id: line is the whole resume mechanism. */
    const since = Number(req.get('last-event-id') ?? req.query.since ?? -1);

    const send = (e: Stamped) => {
      res.write(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
    };

    /* Attach first and buffer, so nothing emitted during the replay is lost. */
    let replaying = true;
    const buffered: Stamped[] = [];
    const off = run.bus.listen((e) => (replaying ? buffered.push(e) : send(e)));

    let highest = Number.isFinite(since) ? since : -1;
    for (const e of store.eventsSince(run.id, highest)) {
      send(e);
      highest = Math.max(highest, e.seq);
    }
    replaying = false;
    for (const e of buffered) if (e.seq > highest) send(e);

    /* The comment defeats proxy buffering. It is not an application signal, so it
       carries nothing and is never persisted. */
    const ping = setInterval(() => res.write(': ping\n\n'), 15_000);

    /* The application signal. Transient by design: 180 rows of heartbeat per run
       would be noise in the event table and noise in a replay. */
    const beat = setInterval(() => {
      res.write(
        `event: heartbeat\ndata: ${JSON.stringify({
          phase: run.phase,
          status: run.status,
          running: run.running,
          elapsedMs: run.elapsedMs,
          sinceLastActivityMs: run.running ? run.sinceLastActivityMs : null,
          sectionsDone: run.sectionCount(),
          sectionsTotal: run.outline.length,
          deadlineRemainingMs: run.running ? Math.max(0, DEADLINE_MS - run.elapsedMs) : null,
          alive: run.alive,
        })}\n\n`
      );
    }, 3_000);

    req.on('close', () => {
      clearInterval(ping);
      clearInterval(beat);
      off();
    });
  });

  /** For a proxy that eats SSE. */
  app.get('/api/sessions/:id/events.json', (req, res) => {
    const run = findRun(req.params.id);
    if (!run) return bad(res, 404, 'No such session.', 'not_found');
    const since = Number(req.query.since ?? -1);
    const events = store.eventsSince(run.id, Number.isFinite(since) ? since : -1);
    res.json({
      events,
      lastSeq: store.lastSeq(run.id),
      heartbeat: {
        phase: run.phase,
        status: run.status,
        running: run.running,
        elapsedMs: run.elapsedMs,
        sinceLastActivityMs: run.running ? run.sinceLastActivityMs : null,
        sectionsDone: run.sectionCount(),
        sectionsTotal: run.outline.length,
      },
    });
  });

  /* ------------------------------------------------ the React build --- */

  /* In dev the UI is served by Vite, so everything that is not an API route or
     an artifact goes there, websockets included — that is what keeps HMR alive
     behind one origin. In production the built files are served directly, with
     an SPA fallback for client routes. */
  const viteUrl = process.env.VITE_DEV_URL;
  const webDist = join(ROOT, 'web', 'dist');

  if (viteUrl) {
    /**
     * `pathFilter`, not `app.use(NOT_OURS, …)`.
     *
     * Mounting middleware on a path makes express strip the matched portion
     * from `req.url`, and a regex that matches the whole path strips the whole
     * path: every request reached Vite as `/`, so the app's own HTML came back
     * and `/src/main.tsx` 404'd. The page rendered as a blank white screen with
     * three aborted requests in the console and no error anywhere.
     *
     * `pathFilter` makes the same choice about which requests to forward
     * without rewriting any of them.
     */
    app.use(
      createProxyMiddleware({
        target: viteUrl,
        changeOrigin: false,
        ws: true, // HMR, so the dev experience survives being behind one origin
        pathFilter: (path) => NOT_OURS.test(path),
      })
    );
  } else if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(NOT_OURS, (_req, res) => res.sendFile(join(webDist, 'index.html')));
  }

  /* An unknown /api route is a JSON 404, not the HTML one express would
     otherwise fall through to. A client that only parses JSON should never
     have to guess what a stray `<!DOCTYPE html>` means. */
  app.use('/api', (_req, res) => bad(res, 404, 'No such endpoint.', 'not_found'));

  /**
   * The last word on every error, so that none of them is express's.
   *
   * Express's default handler renders an HTML page with the stack trace in it,
   * which on this app meant a malformed JSON body answered with the absolute
   * path of every file in the call chain — `C:\Users\...` in development and
   * the container's layout in production. It is also the wrong content type
   * for a client that only ever parses JSON.
   *
   * Four arguments, including the unused `next`: that signature is how express
   * recognises an error handler at all.
   */
  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    const code =
      err.type === 'entity.parse.failed'
        ? 'bad_json'
        : err.type === 'entity.too.large'
          ? 'too_large'
          : undefined;
    const message =
      status === 400 && code === 'bad_json'
        ? 'That request body is not valid JSON.'
        : status === 413
          ? 'That request is too large.'
          : status < 500
            ? err.message
            : 'Something went wrong on the server.';
    if (status >= 500) console.error(err);
    bad(res, status, message, code);
  });

  return app;
}

/** Everything the API and the artifacts do not already own. */
const NOT_OURS = /^\/(?!api\/|runs\/|assets\/|healthz|brand\/).*/;

const truthy = (v: unknown): boolean =>
  v === true || v === 'true' || v === '1' || v === 1 || v === 'on';

/** Start the agent, or the replay, and hold the concurrency slot until it exits. */
function start(run: Run): void {
  run.running = true;
  run.setStatus('running');

  const finish = (status: 'done' | 'stopped' | 'error', error?: string) => {
    run.running = false;
    run.inbox = null;
    /* The watchdog may have already called it: its verdict is the accurate one,
       because it is the reason the loop exited at all. */
    if (run.status === 'error') return;
    run.setStatus(status, { finishedAt: Date.now(), error: error ?? null });
  };

  if (run.mode === 'cached') {
    replayCachedRun(run)
      .then(() => finish(run.stopRequested ? 'stopped' : 'done'))
      .catch((e: Error) => finish('error', e.message));
    return;
  }

  const inbox = new Inbox();
  run.inbox = inbox;
  runAgent(
    run,
    {
      rfpPath: run.rfpPath!,
      intake: run.intake,
      unattended: false,
      deadlineMs: DEADLINE_MS,
      stayOpen: true,
    },
    inbox
  )
    .then(() => finish(run.stopRequested ? 'stopped' : 'done'))
    .catch((e: Error) => {
      run.bus.emitEvent({ type: 'error', message: e.message });
      finish('error', e.message);
    });
}

if (isMain(import.meta.url)) {
  mkdirSync(RUNS_DIR, { recursive: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });
  getDb();

  /* Every session that claimed to be live died with the previous process. The
     SDK session was a subprocess; there is nothing to reattach to. Sections
     written so far stay readable and exportable — that is the honest offer. */
  const orphaned = store.orphanLiveSessions();
  if (orphaned) console.log(`  ${orphaned} session(s) from the last process marked orphaned.`);

  try {
    copyFileSync(TOKENS_PATH, join(PUBLIC_DIR, 'tokens.css'));
  } catch {
    /* the route serves them either way */
  }

  startWatchdog();
  void startInternalStatic();

  const port = Number(process.env.PORT ?? 5173);
  const server = createServer().listen(port, () => {
    const mode = process.env.DEMO_MODE ?? 'live';
    console.log(`Start Saudi demo (${mode})  ->  http://localhost:${port}`);
    console.log(`  data: ${DATA_DIR}   capacity: ${MAX_CONCURRENT_RUNS} concurrent`);
    if (mode === 'live' && process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_WORKSPACE_ID) {
      console.log(
        '  note: if ANTHROPIC_API_KEY is an organisation key, set ANTHROPIC_WORKSPACE_ID too,\n' +
          '        or clear the key to use the signed-in Claude Code session.'
      );
    }
  });

  /* A deploy is a SIGTERM. Tell whoever is watching a live run what happened,
     stop the agents, and close the database rather than be killed mid-write. */
  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`\n${signal}: shutting down.`);

    for (const run of liveRuns()) {
      if (!run.running) continue;
      run.bus.emitEvent({
        type: 'warn',
        text:
          'The server is restarting. This run cannot continue, but every section written ' +
          'so far is saved and can still be exported.',
      });
      run.stopRequested = true;
      run.interruptHandle?.();
    }

    stopInternalStatic();
    const done = () => {
      closeDb();
      process.exit(0);
    };
    server.close(done);
    /* An open SSE connection must not hold the process past a deploy window. */
    setTimeout(done, 5_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
