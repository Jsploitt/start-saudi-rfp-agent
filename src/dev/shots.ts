/**
 * Visual QA. Screenshots every page of a rendered deck at true 1920x1080.
 *   npx tsx src/dev/shots.ts <url> [outDir] [id,id,...]
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../paths.js';

const url = process.argv[2] ?? 'http://localhost:5173/runs/worked-example/proposal.html';
const outDir = join(ROOT, process.argv[3] ?? 'runs/shots');
const only = process.argv[4]?.split(',').filter(Boolean);

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const ids: string[] = await page.$$eval('.page', (els) =>
  els.map((e) => (e as HTMLElement).dataset.section ?? '')
);

for (const [i, id] of ids.entries()) {
  if (only && !only.includes(id)) continue;
  await page.evaluate((n) => (window as never as { postMessage: Function }).postMessage({ type: 'deck:goto', index: n }, '*'), i);
  await page.waitForTimeout(450);
  const file = join(outDir, `${String(i + 1).padStart(2, '0')}-${id}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}

await browser.close();
