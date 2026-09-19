/**
 * fixtures/golden-proposal.html — the last-resort fallback.
 *
 * It has to open by double-clicking it, with no server running, which means its
 * asset paths are relative to fixtures/ rather than to a web root. The run's own
 * proposal.html is served from /runs/... and uses "/assets/...", so the golden
 * file cannot simply be a copy of it — that was a bug: every image and font 404s
 * under file://, in precisely the situation where nothing else is working.
 *
 *   npx tsx src/dev/golden.ts     regenerate it from fixtures/cached-run.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES_DIR } from '../paths.js';
import { Section } from '../render/blocks.js';
import { renderSections } from '../render/renderer.js';
import { renderDocument } from '../render/template.js';
import { isMain } from '../isMain.js';
import { CACHE_PATH, type CachedRun } from '../cached.js';

export function writeGolden(sections: Section[], client?: string): string {
  const html = renderDocument({
    title: `${client ?? 'Start Saudi'} — proposal`,
    sectionsHtml: renderSections(sections),
    assetPrefix: '../public/', // relative to fixtures/, so file:// works
  });
  const out = join(FIXTURES_DIR, 'golden-proposal.html');
  writeFileSync(out, html, 'utf8');
  return out;
}

if (isMain(import.meta.url)) {
  const cache: CachedRun = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  const ordered = cache.outline
    .map((o) => cache.sections[o.id])
    .concat(
      Object.entries(cache.sections)
        .filter(([id]) => !cache.outline.some((o) => o.id === id))
        .map(([, s]) => s)
    )
    .filter(Boolean)
    .map((s) => Section.parse(s));

  const client = (cache.rfp as { client?: { name?: string } } | undefined)?.client?.name;
  console.log(`${ordered.length} sections -> ${writeGolden(ordered, client)}`);
}
