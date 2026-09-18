/**
 * The block vocabulary.
 *
 * The model never writes HTML. It picks blocks from this fixed list and supplies
 * their content as JSON. These zod schemas are both the runtime validation and
 * the input schema handed to the model, so the two can never drift apart.
 *
 * Twelve types. Adding a thirteenth is a decision, not a convenience.
 */

import { z } from 'zod';

/** Every block may cite the content/ files it drew from. Rendered as a hover indicator. */
const sources = z
  .array(z.string())
  .optional()
  .describe(
    'Paths of the start-saudi-kit/content files this block drew from, e.g. ["content/04-process.md"]. ' +
      'Required for any block making a factual claim about Start Saudi or Taajeel.'
  );

/**
 * Text fields accept a light inline syntax and nothing else:
 *   **bold**  ·  *italic*  ·  [TO CONFIRM: ...]  (rendered as a visible highlight)
 * A paragraph beginning "- " is rendered as a bullet; consecutive ones group into a list.
 */
const richText = z.string();

export const CoverBlock = z.object({
  type: z.literal('cover'),
  client: z.string().describe("The client's exact legal name, as given in the RFP."),
  title: z
    .string()
    .describe(
      'The assignment in the brand\'s own words, not "Proposal for Professional Services". ' +
        'e.g. "Your Saudi company, registered in 15 working days".'
    ),
  date: z.string().describe('e.g. "30 September 2026".'),
  reference: z.string().optional().describe('Proposal reference, format YYYY.MM.DD.NNNN.'),
  clientSector: z.string().optional().describe('One short line, e.g. "Flow measurement and metering · United Kingdom".'),
  sources,
});

export const StatementBlock = z.object({
  type: z.literal('statement'),
  eyebrow: z.string().optional().describe('Two or three words above the statement.'),
  text: z.string().describe('ONE sentence. 8-18 words. This is the section opener.'),
  sources,
});

export const UnderstandingBlock = z.object({
  type: z.literal('understanding'),
  heading: z.string().optional(),
  paragraphs: z
    .array(richText)
    .min(1)
    .max(12)
    .describe('Short paragraphs. A paragraph beginning "- " renders as a bullet.'),
  sources,
});

export const ApproachStepsBlock = z.object({
  type: z.literal('approach_steps'),
  heading: z.string().optional(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        text: z.string().describe('One line.'),
        duration: z.string().optional().describe('e.g. "10 working days", "48 hours, in parallel with step 1".'),
      })
    )
    .min(2)
    .max(8),
  note: richText
    .optional()
    .describe('The footnote. For the six-step path this is non-negotiable: "Steps 1 and 2 run in parallel. The durations above are the government\'s, not ours."'),
  sources,
});

export const TwoColBlock = z.object({
  type: z.literal('two_col'),
  left: z.object({ heading: z.string(), body: z.array(richText).min(1) }),
  right: z.object({ heading: z.string(), body: z.array(richText).min(1) }),
  variant: z
    .enum(['balanced', 'rail'])
    .optional()
    .describe('"rail" makes the right column a narrow muted sidebar — use it for the About the Client callouts.'),
  sources,
});

export const StatRowBlock = z.object({
  type: z.literal('stat_row'),
  stats: z
    .array(z.object({ figure: z.string(), caption: z.string() }))
    .min(2)
    .max(4)
    .describe('Keep the "+" signs. Never round the figures.'),
  attribution: z
    .string()
    .optional()
    .describe('e.g. "Taajeel\'s track record, as published by Taajeel." Required whenever the figures are Taajeel\'s.'),
  sources,
});

export const TimelineBlock = z.object({
  type: z.literal('timeline'),
  heading: z.string().optional(),
  phases: z
    .array(
      z.object({
        when: z.string().describe('A calendar date or date range, in the client\'s own reckoning.'),
        what: richText,
        who: z.string().optional().describe('"Yours", "Ours", "The bank\'s" — whose side of the line this sits on.'),
      })
    )
    .min(2)
    .max(8),
  note: richText.optional(),
  sources,
});

export const TableBlock = z.object({
  type: z.literal('table'),
  heading: z.string().optional(),
  headers: z.array(z.string()).optional().describe('Omit for a plain two-column label/value table.'),
  rows: z.array(z.array(richText)).min(1),
  footnote: richText.optional(),
  sources,
});

export const TeamBlock = z.object({
  type: z.literal('team'),
  heading: z.string().optional(),
  people: z
    .array(z.object({ name: z.string(), role: z.string(), bio: z.string().describe('One line.') }))
    .min(1)
    .max(4),
  sources,
});

export const QuoteBlock = z.object({
  type: z.literal('quote'),
  text: z.string(),
  attribution: z.string(),
  note: richText.optional().describe('The disclosure, where one is required. Never drop it.'),
  sources,
});

export const RtlSectionBlock = z.object({
  type: z.literal('rtl_section'),
  heading: z.string().describe('In Arabic.'),
  body: z.array(richText).min(1).describe('Arabic paragraphs. Latin names, numerals and dates may appear inline.'),
  latinHeading: z.string().optional().describe('An English label above, e.g. "Executive summary".'),
  sources,
});

export const CloseBlock = z.object({
  type: z.literal('close'),
  heading: z.string().optional(),
  cta: richText.describe('What happens next, in the imperative.'),
  contact: z.array(z.string()).describe('Contact lines, one per string.'),
  signatories: z
    .array(z.object({ party: z.string(), lines: z.array(z.string()) }))
    .optional()
    .describe('Signature blocks, side by side.'),
  sources,
});

export const Block = z.discriminatedUnion('type', [
  CoverBlock,
  StatementBlock,
  UnderstandingBlock,
  ApproachStepsBlock,
  TwoColBlock,
  StatRowBlock,
  TimelineBlock,
  TableBlock,
  TeamBlock,
  QuoteBlock,
  RtlSectionBlock,
  CloseBlock,
]);

export type Block = z.infer<typeof Block>;
export type BlockType = Block['type'];

/** One section renders to one page (one 16:9 slide). */
export const Section = z.object({
  id: z.string().describe('Stable kebab-case id, e.g. "about-the-client". Re-composing the same id replaces that section.'),
  title: z.string().describe('The section name as it appears in the contents list.'),
  surface: z
    .enum(['light', 'dark'])
    .optional()
    .describe('"dark" is the brand\'s native navy register. Use it for the cover, statement openers and the close.'),
  blocks: z.array(Block).min(1).max(8),
});

export type Section = z.infer<typeof Section>;

/** Human-readable one-liners, used in the event log and in the system prompt. */
export const BLOCK_GUIDE: Record<BlockType, string> = {
  cover: 'Page 1 only. Client, title in the brand\'s words, date, reference.',
  statement: 'A section opener: one sentence. Lead with these — it is what makes a document read as authored.',
  understanding: 'Three or four short paragraphs proving the RFP was read. The "what we heard" move.',
  approach_steps: 'The registration path, scene-stepped. Carries the durations and the parallelism footnote.',
  two_col: 'Comparisons, in-scope vs out-of-scope, or a narrow muted rail beside the main text.',
  stat_row: 'Two to four figures with captions. Taajeel\'s track record, always attributed.',
  timeline: 'Calendar dates and milestones, worked backwards from the client\'s own date. Never a competing per-step duration chart.',
  table: 'Pricing, deliverables, contents, compliance matrix. Headers optional.',
  team: 'People with a role and a one-line bio.',
  quote: 'A sentence quoted back from the RFP, or the ChiefNest case study with its disclosure.',
  rtl_section: 'An Arabic section, RTL. The executive summary when one is asked for.',
  close: 'Signoff, call to action, contact, signature blocks.',
};
