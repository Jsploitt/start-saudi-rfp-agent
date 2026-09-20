/**
 * Every disk write for a session goes through here.
 *
 * It is the only file that knows a session's artifacts are files on a volume
 * rather than objects in a bucket, so moving them later is one file's worth of
 * work. It is also the one place this side of the codebase touches the renderer.
 */

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUNS_DIR, UPLOADS_DIR } from '../paths.js';
import type { Section } from '../render/blocks.js';
import { renderSections } from '../render/renderer.js';
import { renderDocument } from '../render/template.js';

export const sessionDir = (id: string): string => join(RUNS_DIR, id);
export const uploadDir = (id: string): string => join(UPLOADS_DIR, id);

export function ensureSessionDir(id: string): string {
  const dir = sessionDir(id);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureUploadDir(id: string): string {
  const dir = uploadDir(id);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export type ProposalInput = {
  id: string;
  title: string;
  sections: Section[];
  outline: { id: string; title: string; intent: string }[];
};

/**
 * Write the assembled document and its section payloads. Called after every
 * section, so the preview is live.
 */
export function writeProposal({ id, title, sections, outline }: ProposalInput): string {
  const dir = ensureSessionDir(id);
  const html = renderDocument({
    title,
    sectionsHtml: renderSections(sections),
    assetPrefix: '/',
  });
  writeFileSync(join(dir, 'proposal.html'), html, 'utf8');
  writeFileSync(
    join(dir, 'sections.json'),
    JSON.stringify({ outline, sections }, null, 2),
    'utf8'
  );
  return `/runs/${id}/proposal.html`;
}

export function appendTranscript(id: string, entry: unknown): void {
  try {
    appendFileSync(join(sessionDir(id), 'transcript.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    /* a demo must not die because a log write failed */
  }
}
