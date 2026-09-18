/**
 * The content library, in memory.
 *
 * Every markdown file under start-saudi-kit/content/ plus the terms boilerplate,
 * split at headings into passages. At this corpus size — about 160KB — embeddings
 * would be a dependency that can fail live in exchange for nothing.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { KIT_DIR } from './paths.js';

export type LibraryEntry = {
  file: string; // kit-relative, e.g. "content/04-process.md"
  heading: string; // the nearest enclosing heading
  passage: string;
  score?: number;
};

type Doc = { file: string; heading: string; text: string; haystack: string };

let docs: Doc[] | null = null;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Split a markdown file into passages, each carrying its nearest heading. */
function split(file: string, text: string): Doc[] {
  const out: Doc[] = [];
  let heading = file;
  let buf: string[] = [];
  const flush = () => {
    const passage = buf.join('\n').trim();
    if (passage.length > 40) {
      out.push({ file, heading, text: passage, haystack: (heading + '\n' + passage).toLowerCase() });
    }
    buf = [];
  };
  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,4}\s/.test(line)) {
      flush();
      heading = line.replace(/^#+\s*/, '').trim();
    } else {
      buf.push(line);
      // keep passages readable rather than whole-section dumps
      if (buf.length > 34) flush();
    }
  }
  flush();
  return out;
}

export function loadLibrary(): Doc[] {
  if (docs) return docs;
  const files = [
    ...walk(join(KIT_DIR, 'content')),
    join(KIT_DIR, 'proposal', 'terms-and-conditions.md'),
    join(KIT_DIR, 'proposal', 'structure.md'),
    join(KIT_DIR, 'proposal', 'section-briefs.md'),
  ];
  docs = files.flatMap((abs) => {
    const rel = relative(KIT_DIR, abs).replace(/\\/g, '/');
    return split(rel, readFileSync(abs, 'utf8'));
  });
  return docs;
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'is', 'are', 'on', 'it',
  'what', 'how', 'do', 'does', 'with', 'that', 'this', 'be', 'by', 'at', 'as', 'we',
]);

/** Keyword scoring with a cheap fuzzy pass for near-misses (misa/MISA, licence/license). */
export function searchLibrary(query: string, limit = 6): LibraryEntry[] {
  const all = loadLibrary();
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9%+.']+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
  if (!terms.length) return [];

  const scored = all.map((d) => {
    let score = 0;
    for (const t of terms) {
      const exact = d.haystack.split(t).length - 1;
      if (exact) {
        score += exact * 3;
        if (d.heading.toLowerCase().includes(t)) score += 6;
      } else {
        // fuzzy: British/American spelling and singular/plural near-misses
        const stem = t.replace(/(s|es|ing|ed)$/, '');
        if (stem.length > 3 && d.haystack.includes(stem)) score += 1;
        if (t.includes('c') && d.haystack.includes(t.replace(/c/g, 'z'))) score += 1;
      }
    }
    return { d, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ d, score }) => ({
      file: d.file,
      heading: d.heading,
      passage: d.text.length > 1400 ? d.text.slice(0, 1400) + '\n…' : d.text,
      score,
    }));
}

/** Used by the system prompt so the model knows what it can search. */
export function libraryIndex(): string[] {
  const seen = new Set<string>();
  for (const d of loadLibrary()) seen.add(d.file);
  return [...seen].sort();
}
