/**
 * Record a live run into fixtures/, so DEMO_MODE=cached can replay it offline.
 *   npm run record -- proposal/sample-rfp.md
 *
 * Writes two things:
 *   fixtures/cached-run.json      the event stream plus every section's blocks
 *   fixtures/golden-proposal.html the finished document, as a standalone fallback
 */

import 'dotenv/config';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { existsSync } from 'node:fs';
import { runAgent, Inbox } from '../agent.js';
import { newRun } from '../run.js';
import { FIXTURES_DIR, KIT_DIR, ROOT } from '../paths.js';
import { isMain } from '../isMain.js';
import type { Stamped } from '../events.js';
import type { CachedRun } from '../cached.js';

/** The answers a presenter would type. Recorded so the replay has both sides. */
const SCRIPTED_ANSWER = [
  'Good questions, and useful ones.',
  '',
  '1. The supplier listing needs only the CR — we checked with them this morning.',
  '2. Yes, we can start the apostille now on the FY2025 accounts.',
  '3. The Saudi contract is service and calibration only. Equipment continues to be supplied',
  '   from the UK under the existing arrangement.',
  '4. Send the structure recommendation to both directors.',
  '5. No fixed ceiling. Cost it on its merits.',
  "6. Treat Daniel's visa as a later engagement, but tell us what it would cost.",
].join('\n');

function resolveRfp(arg: string): string {
  for (const base of [ROOT, KIT_DIR, process.cwd()]) {
    const p = isAbsolute(arg) ? arg : join(base, arg);
    if (existsSync(p)) return p;
  }
  throw new Error(`RFP not found: ${arg}`);
}

if (isMain(import.meta.url)) {
  const rfpPath = resolveRfp(process.argv[2] ?? 'proposal/sample-rfp.md');
  const run = newRun('recording');
  const events: Stamped[] = [];
  const inbox = new Inbox();
  let answered = false;

  run.bus.subscribe((e) => {
    events.push(e);
    if (e.type === 'section:done') console.log(`  ✓ ${e.title}`);
    if (e.type === 'act') console.log(`  · ${e.verb}${e.detail ? ' — ' + e.detail : ''}`);
    /* Answer the first question the way a presenter would, so the recording
       contains the human half of the conversation too. */
    if (e.type === 'question' && !answered) {
      answered = true;
      setTimeout(() => {
        run.bus.emitEvent({ type: 'answer', text: SCRIPTED_ANSWER });
        inbox.push(SCRIPTED_ANSWER);
      }, 6000);
    }
  });

  await runAgent({ rfpPath, unattended: false, deadlineMs: 9 * 60_000 }, inbox);

  mkdirSync(FIXTURES_DIR, { recursive: true });

  const sections: Record<string, unknown> = {};
  for (const s of run.orderedSections()) sections[s.id] = s;

  const cache: CachedRun = {
    recordedAt: new Date().toISOString(),
    events,
    sections,
    outline: run.outline,
    rfp: run.rfp ?? undefined,
    brief: run.brief ?? undefined,
  };
  writeFileSync(join(FIXTURES_DIR, 'cached-run.json'), JSON.stringify(cache, null, 2), 'utf8');
  copyFileSync(join(run.dir, 'proposal.html'), join(FIXTURES_DIR, 'golden-proposal.html'));

  console.log(
    `\nRecorded ${events.length} events and ${Object.keys(sections).length} sections.\n` +
      `  fixtures/cached-run.json\n  fixtures/golden-proposal.html`
  );
  process.exit(0);
}
