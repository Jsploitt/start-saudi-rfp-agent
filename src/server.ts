/**
 * Express + SSE + static. The single entry point.
 * Phase 1: serves the deck. Phase 2 adds the agent session and the event stream.
 */

import 'dotenv/config';
import express from 'express';
import { mkdirSync } from 'node:fs';
import { PUBLIC_DIR, RUNS_DIR } from './paths.js';
import { isMain } from './isMain.js';

export function createServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(express.static(PUBLIC_DIR));
  app.use('/runs', express.static(RUNS_DIR));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  return app;
}

if (isMain(import.meta.url)) {
  mkdirSync(RUNS_DIR, { recursive: true });
  const port = Number(process.env.PORT ?? 5173);
  createServer().listen(port, () => {
    console.log(`Start Saudi demo  ->  http://localhost:${port}`);
  });
}
