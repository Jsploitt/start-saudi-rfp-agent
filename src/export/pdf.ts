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

    /* The self-hosted faces have to be resolved before anything is measured:
       a page fitted against the fallback font is fitted against the wrong
       widths, and the shrink-to-fit is what keeps a dense page inside its
       frame. */
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    });

    /* Switching the media is what makes the deck lay every page out at once and
       re-measure them. It is also what the print stylesheet keys off. */
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(600);

    /* A section is no longer a page: one that runs long is split onto a
       continuation slide before it is rendered, so the section count
       under-reports and would silently truncate the export. Count the pages
       that actually exist. */
    const pages = await page.locator('.page').count();

    await page.pdf({
      path: out,
      width: '1920px',
      height: '1080px',
      /* The stylesheet declares `@page { size:1920px 1080px; margin:0 }`.
         Without this Chromium sizes the sheet itself and the 1920x1080 canvas
         lands in the corner of a larger page with a grey margin round two
         sides of it. */
      preferCSSPageSize: true,
      printBackground: true,
      pageRanges: `1-${Math.max(1, pages || run.sectionCount())}`,
    });
  } finally {
    await browser.close();
  }
  return `/runs/${run.id}/proposal.pdf`;
}
