/**
 * write_brief — the agent's working understanding, made visible and inspectable.
 * It also carries the outline, so the section list appears before any content does.
 */

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { Brief, getRun } from '../run.js';
import { ok, fail } from './result.js';

export const writeBriefTool = tool(
  'write_brief',
  'Record the working brief and the section outline. Call this after the client has answered ' +
    'your questions and before you compose any section. The outline is a section list with a ' +
    'one-line intent each — no content yet.',
  {
    brief: Brief,
    outline: z
      .array(
        z.object({
          id: z.string().describe('kebab-case, stable. You will pass this to compose_proposal.'),
          title: z.string().describe('The section name as it appears in the contents list.'),
          intent: z.string().describe('One line. What this section has to achieve.'),
        })
      )
      .min(8)
      .max(24),
  },
  async ({ brief, outline }) => {
    const run = getRun();
    if (!run) return fail('No run is active.');

    const parsed = Brief.safeParse(brief);
    if (!parsed.success) {
      return fail(
        'The brief did not validate:\n' +
          parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
      );
    }

    const dupes = outline.map((o) => o.id).filter((id, i, a) => a.indexOf(id) !== i);
    if (dupes.length) return fail(`Duplicate outline ids: ${[...new Set(dupes)].join(', ')}`);

    run.brief = parsed.data;
    run.outline = outline;
    run.bus.emitEvent({ type: 'brief', brief: parsed.data });
    run.bus.emitEvent({ type: 'outline', sections: outline });
    run.bus.emitEvent({
      type: 'act',
      verb: 'Wrote the brief',
      detail: `${outline.length} sections planned`,
      tool: 'write_brief',
    });
    run.transcript({ t: 'brief', brief: parsed.data, outline });

    return ok(
      `Brief recorded and the outline is on screen: ${outline.length} sections.\n\n` +
        'Now compose them one at a time, in outline order, with one compose_proposal call each.'
    );
  }
);
