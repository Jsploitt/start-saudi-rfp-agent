/**
 * compose_proposal — the core of the system.
 *
 * One call per section, never one for the document. That is what makes
 * progressive rendering possible, what makes a targeted edit cheap, and — per the
 * research — what most improves quality, because the model is choosing a shape
 * for one page rather than pouring prose into a container.
 *
 * The model supplies typed blocks. This file renders them. The model never sees
 * HTML and never emits it.
 */

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { Block, Section } from '../render/blocks.js';
import { getRun } from '../run.js';
import { ok, fail } from './result.js';

/** Voice checks that are cheap, deterministic and worth failing over. */
const BANNED = [
  'leverage', 'synergy', 'bespoke', 'holistic', 'seamless', 'seamlessly', 'turnkey',
  'one-stop shop', 'value-add', 'best-in-class', 'world-class', 'cutting-edge',
  'state-of-the-art', 'robust', 'innovative', 'ecosystem', 'empower', 'unlock',
  'unleash', 'elevate', 'streamline', 'beacon', 'results-driven', 'proven track record',
  'award-winning', 'unparalleled', 'unrivalled', 'dedicated team', 'passionate',
  'committed to excellence', 'we endeavour', 'we strive', 'every effort will be made',
  'hassle-free', 'stress-free', 'effortless', 'cost-effective', 'competitive pricing',
  'gateway to the kingdom', 'thrilled', 'delighted', 'in a timely manner',
];

function textOf(block: Block): string {
  return JSON.stringify(block).toLowerCase();
}

function voiceProblems(blocks: Block[]): string[] {
  const joined = blocks.map(textOf).join(' ');
  const hits = BANNED.filter((w) => joined.includes(w));
  const problems: string[] = [];
  if (hits.length) {
    problems.push(
      `Banned words from content/voice.md §3: ${hits.join(', ')}. ` +
        'Rewrite the sentence rather than swapping the word — the register is the problem.'
    );
  }
  if (/!/.test(joined.replace(/\\"/g, ''))) {
    problems.push('Exclamation mark. There are none anywhere on the Start Saudi site.');
  }
  for (const a of ['organize', 'organized', 'license', 'licensing', 'authorized', 'center', 'program'])
    if (new RegExp(`\\b${a}\\b`).test(joined))
      problems.push(`American spelling "${a}". This brand uses British spelling throughout.`);
  return problems;
}

export const composeProposalTool = tool(
  'compose_proposal',
  'Compose ONE section of the proposal from typed blocks and render it. Call this once per ' +
    'section, in outline order. Never try to compose the whole document in one call. ' +
    'Re-calling with the same sectionId replaces that section and leaves every other section ' +
    'untouched — that is how a targeted change is made without regenerating the document.',
  {
    sectionId: z.string().describe('The id from the outline. Reusing an id replaces that section.'),
    title: z.string().describe('The section name, as it appears in the contents list and the page header.'),
    surface: z
      .enum(['light', 'dark'])
      .optional()
      .describe('"dark" is the brand\'s native navy register. Use it for the cover, a statement opener and the close. Most pages are light.'),
    blocks: z.array(Block).min(1).max(8).describe('Ordered. One page. Lead with a statement block where the section opens an idea.'),
  },
  async ({ sectionId, title, surface, blocks }) => {
    const run = getRun();
    if (!run) return fail('No run is active.');

    run.bus.emitEvent({ type: 'section:start', id: sectionId, title });

    const parsed = Section.safeParse({ id: sectionId, title, surface, blocks });
    if (!parsed.success) {
      return fail(
        `Section "${sectionId}" did not validate. Nothing was rendered. Fix and call again:\n` +
          parsed.error.issues.map((i) => `  - blocks.${i.path.join('.')}: ${i.message}`).join('\n')
      );
    }

    const problems = voiceProblems(parsed.data.blocks);
    if (problems.length) {
      run.bus.emitEvent({ type: 'warn', text: `${title}: ${problems[0]}` });
      return fail(
        `Section "${sectionId}" was not rendered. The voice rules in content/voice.md are not ` +
          `optional:\n${problems.map((p) => '  - ' + p).join('\n')}\n\nRewrite and call again.`
      );
    }

    const unsourced = parsed.data.blocks.filter(
      (b) => !('sources' in b && b.sources?.length) && b.type !== 'cover' && b.type !== 'close'
    );

    run.setSection(parsed.data);
    const url = run.writeProposal();

    const total = run.outline.length || run.sectionCount();
    const index = Math.max(1, run.outline.findIndex((o) => o.id === sectionId) + 1);
    run.bus.emitEvent({ type: 'section:done', id: sectionId, title, index, total });
    run.bus.emitEvent({ type: 'preview', url, sectionId });
    run.transcript({ t: 'section', id: sectionId, title, blocks: parsed.data.blocks });

    const note = unsourced.length
      ? `\n\n${unsourced.length} block(s) carry no sources. Populate sources on anything making a ` +
        'factual claim about Start Saudi or Taajeel — it is what lets a reader check the document.'
      : '';

    return ok(
      `Rendered "${title}" as page ${index} of ${total}. ` +
        `${run.sectionCount()} section(s) in the document.${note}\n\nCompose the next section.`
    );
  }
);
