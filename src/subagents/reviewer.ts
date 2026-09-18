/**
 * reviewer — a critic run over the assembled proposal, in public.
 *
 * It reads the composed sections against the original RfpAnalysis and returns
 * what is unaddressed, with a severity and the section that should carry the fix.
 * The main agent then recomposes those sections. Running a critic over your own
 * output and then visibly fixing what it catches is the most credibility-building
 * thing the demo does, so the findings are deliberately specific enough to act on.
 */

import { z } from 'zod';
import { runSubagent } from './shared.js';
import type { Run } from '../run.js';

export const Review = z.object({
  findings: z
    .array(
      z.object({
        requirement: z.string().describe('What the RFP asked for, or the rule that was broken.'),
        severity: z.enum(['blocking', 'material', 'minor']),
        note: z.string().describe('What is wrong and what would fix it. One or two sentences.'),
        sectionId: z.string().describe('The section that should carry the fix, or "new" if one is missing.'),
      })
    )
    .max(6),
  verdict: z.string().describe('One sentence. Would this proposal survive a competitive read?'),
});
export type Review = z.infer<typeof Review>;

const JSON_SCHEMA = {
  type: 'object',
  required: ['findings', 'verdict'],
  properties: {
    findings: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        required: ['requirement', 'severity', 'note', 'sectionId'],
        properties: {
          requirement: { type: 'string' },
          severity: { type: 'string', enum: ['blocking', 'material', 'minor'] },
          note: { type: 'string' },
          sectionId: { type: 'string' },
        },
      },
    },
    verdict: { type: 'string' },
  },
};

const SYSTEM = `
You review a draft proposal against the RFP it answers. You are the last read before it goes
to a client who is comparing three providers and who said she is "slightly allergic to
vagueness".

Report only what you can point at. For each finding name the requirement it misses, how bad
it is, what would fix it, and which section should carry the fix.

Check, in this order:

1. **Unaddressed requirements.** Every numbered thing the client asked for. If the client
   asked six questions and the proposal answers five, that is the finding.
2. **Invented specifics.** Any figure, date, price or claim that reads as authoritative.
   A visible [TO CONFIRM: …] marker is correct and is never a finding — flagging it as one
   is itself a mistake.
3. **A promise with no boundary.** This brand states the limit of every claim in the same
   flat register as the claim. A section of pure promise is off-brand.
4. **The consultancy register.** Adjectives about the seller, abstractions that are never
   itemised, sentences that could appear unchanged in a competitor's brochure.
5. **A gap that was raised and then quietly dropped.** The worst failure available: the
   proposal notices something, and then the rest of the document proceeds as if it did not.

Six findings maximum, worst first. If it is genuinely sound, return an empty findings array
and say so in the verdict — a reviewer that invents work to look useful is worse than none.

Return JSON matching the schema. No prose.
`.trim();

/** A compact reading of the document: enough to review, small enough to be quick. */
function digest(run: Run): string {
  return run
    .orderedSections()
    .map((s) => {
      const body = JSON.stringify(s.blocks)
        .replace(/"(type|sources|variant|surface)":/g, '')
        .slice(0, 1400);
      return `### [${s.id}] ${s.title}\n${body}`;
    })
    .join('\n\n');
}

export async function review(run: Run, env?: Record<string, string | undefined>): Promise<Review | null> {
  if (!run.rfp) return null;

  const prompt = [
    '## The RFP, as analysed',
    `Client: ${run.rfp.client.name}`,
    `Summary: ${run.rfp.summary}`,
    '',
    'Requirements:',
    ...run.rfp.requirements.map((r) => `  - [${r.mustHave ? 'must' : 'should'}] ${r.id}: ${r.text}`),
    '',
    'Dates:',
    ...run.rfp.dates.map((d) => `  - ${d.label}: ${d.date}`),
    '',
    'Gaps that were raised with the client:',
    ...run.rfp.gaps.map((g) => `  - ${g.question}`),
    '',
    '## The draft proposal, section by section',
    digest(run),
    '',
    'Review it.',
  ].join('\n');

  return runSubagent({
    name: 'reviewer',
    systemPrompt: SYSTEM,
    prompt,
    schema: Review,
    jsonSchema: JSON_SCHEMA,
    timeoutMs: 120_000,
    env,
  });
}
