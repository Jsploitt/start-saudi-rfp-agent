/**
 * Visual QA. Screenshots every page of a rendered deck at true 1920x1080.
 *
 *   npm run shots -- <session id>            # runs/shots-<id>
 *   npm run shots -- <session id> <outDir> [id,id,...]
 *   npm run shots -- http://host/path.html <outDir>
 *
 * A session id rather than a URL, because /runs/* is behind the session cookie
 * now and Chromium arriving without one screenshots the login page forty-seven
 * times without saying anything is wrong. This starts the same loopback static
 * listener the PDF export uses, so no cookie is needed and no running server
 * is either.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../paths.js';
import { startInternalStatic, stopInternalStatic } from '../sessions/internal.js';

const target = process.argv[2] ?? 'worked-example';
const isUrl = /^https?:\/\//.test(target);

/* A bare id names a session; anything else is taken as given. */
const url = isUrl
  ? target
  : `${await startInternalStatic()}/runs/${target.replace(/^\/?runs\//, '')}/proposal.html`;

const outDir = join(
  ROOT,
  process.argv[3] ?? (isUrl ? 'runs/shots' : `runs/shots-${target.replace(/[^\w.-]/g, '_')}`)
);
const only = process.argv[4]?.split(',').filter(Boolean);

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const response = await page.goto(url, { waitUntil: 'networkidle' });
if (!response?.ok()) {
  throw new Error(`${url} answered ${response?.status() ?? 'nothing'} — no deck to screenshot.`);
}
await page.waitForTimeout(400);

const ids: string[] = await page.$$eval('.page', (els) =>
  els.map((e) => (e as HTMLElement).dataset.section ?? '')
);
if (!ids.length) throw new Error(`No .page elements at ${url}. Is that a rendered deck?`);
console.log(`${ids.length} pages at ${url}`);

for (const [i, id] of ids.entries()) {
  if (only && !only.includes(id)) continue;
  await page.evaluate((n) => (window as never as { postMessage: Function }).postMessage({ type: 'deck:goto', index: n }, '*'), i);
  await page.waitForTimeout(450);
  const file = join(outDir, `${String(i + 1).padStart(2, '0')}-${id}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}

await browser.close();
stopInternalStatic();
