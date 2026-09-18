/**
 * The Phase 2 gate.
 *   npm run demo -- proposal/sample-rfp.md
 * Runs the agent unattended and prints the event log as it happens.
 */

import 'dotenv/config';
import { isAbsolute, join } from 'node:path';
import { existsSync } from 'node:fs';
import { runAgent } from '../agent.js';
import { newRun } from '../run.js';
import { KIT_DIR, ROOT } from '../paths.js';
import { isMain } from '../isMain.js';

function resolveRfp(arg: string): string {
  for (const base of [process.cwd(), ROOT, KIT_DIR]) {
    const p = isAbsolute(arg) ? arg : join(base, arg);
    if (existsSync(p)) return p;
  }
  throw new Error(`RFP not found: ${arg} (looked in the working directory, the app root and the kit)`);
}

if (isMain(import.meta.url)) {
  const arg = process.argv[2] ?? 'proposal/sample-rfp.md';
  const rfpPath = resolveRfp(arg);
  const run = newRun();
  const t0 = Date.now();

  run.bus.subscribe((e) => {
    const s = ((Date.now() - t0) / 1000).toFixed(0).padStart(4) + 's  ';
    switch (e.type) {
      case 'act':
        console.log(`${s}· ${e.verb}${e.detail ? ` — ${e.detail}` : ''}`);
        break;
      case 'section:done':
        console.log(`${s}✓ ${e.title}  (${e.index}/${e.total})`);
        break;
      case 'outline':
        console.log(`${s}▸ Outline: ${e.sections.map((x) => x.title).join(' · ')}`);
        break;
      case 'question':
        console.log(`${s}? ${e.text.split('\n')[0].slice(0, 160)}`);
        break;
      case 'agent':
        console.log(`${s}  ${e.text.split('\n')[0].slice(0, 160)}`);
        break;
      case 'warn':
        console.log(`${s}! ${e.text}`);
        break;
      case 'error':
        console.error(`${s}✗ ${e.message}`);
        break;
      case 'done':
        console.log(
          `\n${e.sections} sections in ${(e.elapsedMs / 1000).toFixed(0)}s\n` +
            `  ${join(run.dir, 'proposal.html')}\n` +
            `  http://localhost:5173${e.url}`
        );
        break;
    }
  });

  await runAgent({ rfpPath, unattended: true, deadlineMs: 6 * 60_000 });
  process.exit(0);
}
