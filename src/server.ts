/**
 * Express + SSE + static. The single entry point.
 */

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { PUBLIC_DIR, RUNS_DIR, KIT_DIR, ROOT } from './paths.js';
import { isMain } from './isMain.js';
import { getRun, newRun } from './run.js';
import { Inbox, runAgent } from './agent.js';
import { exportPdf } from './export/pdf.js';
import { replayCachedRun } from './cached.js';

const upload = multer({ dest: join(ROOT, 'uploads') });

/** The UI is styled from the kit's own tokens, copied at boot. One source of colour. */
function publishTokens(): void {
  copyFileSync(join(KIT_DIR, 'brand', 'tokens.css'), join(PUBLIC_DIR, 'tokens.css'));
}

/** One run at a time, and one inbox for the answers going into it. */
let inbox: Inbox | null = null;
let running = false;

function resolveRfp(arg: string): string {
  for (const base of [ROOT, KIT_DIR, process.cwd()]) {
    const p = isAbsolute(arg) ? arg : join(base, arg);
    if (existsSync(p)) return p;
  }
  throw new Error(`RFP not found: ${arg}`);
}

export function createServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(express.static(PUBLIC_DIR));
  app.use('/runs', express.static(RUNS_DIR));

  app.get('/healthz', (_req, res) =>
    res.json({ ok: true, mode: process.env.DEMO_MODE ?? 'live', running })
  );

  /** The event stream. Replays everything so far, so a late tab catches up. */
  app.get('/api/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');

    const run = getRun();
    if (!run) {
      res.write(`data: ${JSON.stringify({ type: 'status', text: 'Waiting for an RFP', at: Date.now(), seq: -1 })}\n\n`);
    }
    const off = run?.bus.subscribe((e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ping);
      off?.();
    });
  });

  /** Start a run, from an upload or from a path in the kit. */
  app.post('/api/run', upload.single('file'), async (req, res) => {
    /* A live demo needs a way out of a wedged run. `force` abandons the old one. */
    if (running && !req.body?.force) {
      return res.status(409).json({ error: 'A run is already in progress. Send force:true to abandon it.' });
    }

    const mode = (req.body?.mode as string) ?? process.env.DEMO_MODE ?? 'live';
    let rfpPath: string;
    try {
      rfpPath = req.file
        ? req.file.path
        : resolveRfp((req.body?.path as string) ?? 'proposal/sample-rfp.md');
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }

    const run = newRun();
    running = true;
    res.json({ runId: run.id, url: run.proposalUrl, mode });

    const finish = () => {
      running = false;
      inbox = null;
    };

    if (mode === 'cached') {
      replayCachedRun(run).finally(finish);
      return;
    }

    inbox = new Inbox();
    runAgent({ rfpPath, unattended: false, deadlineMs: 9 * 60_000, stayOpen: true }, inbox)
      .catch((e) => run.bus.emitEvent({ type: 'error', message: (e as Error).message }))
      .finally(finish);
  });

  /** The client answers the agent's questions here. */
  app.post('/api/answer', (req, res) => {
    const text = String(req.body?.text ?? '').trim();
    const run = getRun();
    if (!text) return res.status(400).json({ error: 'Empty.' });
    if (!run) return res.status(409).json({ error: 'No run.' });
    run.bus.emitEvent({ type: 'answer', text });
    inbox?.push(text);
    res.json({ ok: true });
  });

  app.post('/api/export', async (req, res) => {
    const run = getRun();
    if (!run?.sectionCount()) return res.status(409).json({ error: 'Nothing to export.' });
    const origin = `http://localhost:${process.env.PORT ?? 5173}`;
    try {
      run.bus.emitEvent({ type: 'act', verb: 'Printing the PDF' });
      const url = await exportPdf(run, origin);
      run.bus.emitEvent({ type: 'act', verb: 'PDF ready', detail: url });
      res.json({ url });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return app;
}

if (isMain(import.meta.url)) {
  mkdirSync(RUNS_DIR, { recursive: true });
  publishTokens();
  const port = Number(process.env.PORT ?? 5173);
  createServer().listen(port, () => {
    const mode = process.env.DEMO_MODE ?? 'live';
    console.log(`Start Saudi demo (${mode})  ->  http://localhost:${port}`);
    if (mode === 'live' && process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_WORKSPACE_ID) {
      console.log(
        '  note: if ANTHROPIC_API_KEY is an organisation key, set ANTHROPIC_WORKSPACE_ID too,\n' +
          '        or clear the key to use the signed-in Claude Code session.'
      );
    }
  });
}
