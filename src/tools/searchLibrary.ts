/**
 * search_library — the only route to a fact about Start Saudi or Taajeel.
 * If it is not in here, it does not go in the proposal.
 */

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { searchLibrary } from '../library.js';
import { getRun } from '../run.js';
import { ok } from './result.js';

/** A readable line for the event log — "Checking what we've done in retail…" */
function phrase(query: string): string {
  const q = query.trim().replace(/\s+/g, ' ');
  return q.length > 52 ? q.slice(0, 52) + '…' : q;
}

export const searchLibraryTool = tool(
  'search_library',
  'Search the Start Saudi content library — the company, its services, the process, pricing, ' +
    'credentials, client types, the FAQ and the terms boilerplate. Every factual claim in the ' +
    'proposal must come from here. Search before you write, not after.',
  {
    query: z.string().describe('Plain words. "MISA capital requirement", "bank account timeline", "payment milestones".'),
    limit: z.number().int().min(1).max(10).optional(),
  },
  async ({ query, limit }) => {
    const run = getRun();
    run?.bus.emitEvent({
      type: 'act',
      verb: 'Checking the library',
      detail: phrase(query),
      tool: 'search_library',
    });

    const hits = searchLibrary(query, limit ?? 6);
    run?.transcript({ t: 'search', query, hits: hits.map((h) => `${h.file}#${h.heading}`) });

    if (!hits.length) {
      return ok(
        `Nothing in the library matches "${query}".\n\n` +
          'Do not fill the gap from general knowledge. Either search again with different ' +
          'words, or mark the fact [TO CONFIRM: …] in the proposal and say what is missing.'
      );
    }

    return ok(
      hits
        .map(
          (h) =>
            `### ${h.file} — ${h.heading}\n${h.passage}\n` +
            `(cite as sources: ["${h.file}"])`
        )
        .join('\n\n---\n\n')
    );
  }
);
