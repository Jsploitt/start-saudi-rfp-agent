/**
 * PDF export. Chromium prints the deck at 1920x1080 per page, using the print
 * rules already in the template — every page visible, no chrome, no source dots.
 */

import { join } from 'node:path';
import type { Run } from '../run.js';

export async function exportPdf(run: Run, origin: string): Promise<string> {
  const { chromium } = await import('playwright');
  const out = join(run.dir, 'proposal.pdf');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`${origin}${run.proposalUrl}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.pdf({
      path: out,
      width: '1920px',
      height: '1080px',
      printBackground: true,
      pageRanges: `1-${Math.max(1, run.sectionCount())}`,
    });
  } finally {
    await browser.close();
  }
  return `/runs/${run.id}/proposal.pdf`;
}
