/**
 * researcher — three or four specifics the proposal can reference.
 *
 * The rule that makes this safe to demo: it may state nothing about the client
 * that it cannot attribute. Every finding carries its basis, and anything it is
 * inferring rather than reading is labelled as inference. A researcher that
 * invents a fact about the prospect is worse than no researcher, in a document
 * whose entire pitch is "we do not fill gaps with plausible numbers".
 *
 * Web access is off unless ALLOW_WEB=1, because the demo must run with no network.
 */

import { z } from 'zod';
import { runSubagent } from './shared.js';
import type { RfpAnalysis } from '../run.js';

export const Research = z.object({
  findings: z
    .array(
      z.object({
        point: z.string().describe('One sentence, under 30 words.'),
        basis: z.enum(['from the RFP', 'sector knowledge', 'web']),
        useItIn: z.string().describe('Which section this is worth a sentence in.'),
        confident: z.boolean(),
      })
    )
    .min(2)
    .max(5),
});
export type Research = z.infer<typeof Research>;

const JSON_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'object',
        required: ['point', 'basis', 'useItIn', 'confident'],
        properties: {
          point: { type: 'string' },
          basis: { type: 'string', enum: ['from the RFP', 'sector knowledge', 'web'] },
          useItIn: { type: 'string' },
          confident: { type: 'boolean' },
        },
      },
    },
  },
};

const SYSTEM = `
You research a prospective client so a proposal can reference their situation specifically
rather than generically. You return two to five findings and nothing else.

**You may not state a fact about this company that you cannot attribute.** No revenue you
did not read, no customer you did not read, no funding round, no headcount, no news event
you are not certain of. If you are reasoning from the sector rather than from the company,
say so: that is what \`basis\` is for, and "sector knowledge" is an honest and useful answer.
Set \`confident: false\` on anything a careful reader could challenge.

Each finding must be worth a sentence in a proposal. "They are a UK engineering company" is
not — the proposal already says that. "Their Saudi client is a water infrastructure
contractor, so the counterparty is likely working to a government programme timetable that
their own supplier deadline inherits" is, because it changes how the timeline section reads.

**One sentence per finding, under 30 words.** It has to fit on a line in a log the room is
watching. If it needs a paragraph it is not a finding, it is a memo.

Return JSON matching the schema. No prose.
`.trim();

export async function research(
  rfp: RfpAnalysis,
  env?: Record<string, string | undefined>
): Promise<Research | null> {
  const allowWeb = process.env.ALLOW_WEB === '1';
  const prompt = [
    `Client: ${rfp.client.name}`,
    rfp.client.sector ? `Sector: ${rfp.client.sector}` : '',
    rfp.client.country ? `Country: ${rfp.client.country}` : '',
    '',
    'What the RFP says:',
    rfp.summary,
    '',
    'Their stated requirements:',
    ...rfp.requirements.map((r) => `  - ${r.text}`),
    '',
    'They are entering Saudi Arabia. Give me two to five specifics a proposal writer could',
    'use — what they actually do, why Saudi entry makes sense for them specifically, and',
    'anything about their situation that should change how the proposal is written.',
    allowWeb ? '' : 'You have no web access. Work from the brief and from sector knowledge, and label which is which.',
  ]
    .filter(Boolean)
    .join('\n');

  return runSubagent({
    name: 'researcher',
    systemPrompt: SYSTEM,
    prompt,
    schema: Research,
    jsonSchema: JSON_SCHEMA,
    timeoutMs: allowWeb ? 120_000 : 75_000,
    allowWeb,
    env,
  });
}
