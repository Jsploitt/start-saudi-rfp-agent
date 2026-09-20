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
    .max(5)
    .describe(
      'At most five short paragraphs, and five is the ceiling rather than the target. ' +
        'A paragraph beginning "- " renders as a bullet. If you need more than five, ' +
        'the section is two sections.'
    ),
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
    .max(6)
    .describe('Two to six. Rendered as a horizontal path diagram, not a list.'),
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
    .max(6)
    .describe('Two to six. Rendered as a horizontal path diagram, not a list.'),
  note: richText.optional(),
  sources,
});

export const TableBlock = z.object({
  type: z.literal('table'),
  heading: z.string().optional(),
  headers: z.array(z.string()).optional().describe('Omit for a plain two-column label/value table.'),
  rows: z
    .array(z.array(richText))
    .min(1)
    .max(8)
    .describe('At most eight rows. A longer table is two tables on two pages.'),
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

/** At most this many blocks on an ordinary slide. Four is a page; eight is a wall. */
export const MAX_BLOCKS_PER_SECTION = 4;

/** Appendix slides set dense, small and two-column, so they carry more. */
export const MAX_BLOCKS_PER_APPENDIX = 12;

/** One section renders to one page (one 16:9 slide). */
export const Section = z
  .object({
    id: z.string().describe('Stable kebab-case id, e.g. "about-the-client". Re-composing the same id replaces that section.'),
    title: z.string().describe('The section name as it appears in the contents list.'),
    surface: z
      .enum(['light', 'dark'])
      .optional()
      .describe('"dark" is the brand\'s native navy register. Use it for the cover, statement openers and the close.'),
    columns: z
      .literal(2)
      .optional()
      .describe(
        'Flow this page down two columns instead of one. For a list-shaped page a ' +
          'reader scans rather than reads — a contents page, a schedule of fees. ' +
          'Not for running prose: two columns of body copy on a slide is a newspaper.'
      ),
    appendix: z
      .boolean()
      .optional()
      .describe(
        'Back matter: terms and conditions, and nothing else. Sets the page dense, small and ' +
          'two-column, drops the accent colour, and exempts it from the density budget. It is ' +
          'not a way to fit more onto a slide you did not want to split.'
      ),
    blocks: z
      .array(Block)
      .min(1)
      .max(MAX_BLOCKS_PER_APPENDIX)
      .describe(
        `Two to ${MAX_BLOCKS_PER_SECTION} blocks. One page, 16:9. A section with more blocks than ` +
          'that is a section that should have been two. Appendix sections may carry more.'
      ),
  })
  .superRefine((s, ctx) => {
    const max = s.appendix ? MAX_BLOCKS_PER_APPENDIX : MAX_BLOCKS_PER_SECTION;
    if (s.blocks.length > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['blocks'],
        message:
          `${s.blocks.length} blocks on one 16:9 page is too many; the limit is ${max}. ` +
          'Split this into two sections rather than asking the page to shrink.',
      });
    }
  });

export type Section = z.infer<typeof Section>;

/** Human-readable one-liners, used in the event log and in the system prompt. */
export const BLOCK_GUIDE: Record<BlockType, string> = {
  cover: 'Page 1 only. Client, title in the brand\'s words, date, reference.',
  statement: 'A section opener: one sentence, 8–18 words, set very large. Lead with these — it is what makes a document read as authored.',
  understanding: 'At most five short paragraphs, and three is better. Two sentences each. The "what we heard" move, not the whole file.',
  approach_steps: 'Two to six steps, drawn as a horizontal path. Titles of three or four words; `text` is ONE short line that fits under a node. Carries the durations and the parallelism footnote — a step whose duration says "in parallel" is drawn as a branch.',
  two_col: 'Comparisons, in-scope vs out-of-scope, or a narrow muted rail beside the main text. Three or four short entries a side.',
  stat_row: 'Two to four figures, set very large, with captions of four or five words. Taajeel\'s track record, always attributed.',
  timeline: 'Two to six milestones, drawn as a calendar spine. `who` puts a milestone above the line ("Yours") or below it (ours, the bank\'s). Calendar dates worked backwards from the client\'s own date — never a competing per-step duration chart.',
  table: 'Pricing, deliverables, contents, compliance matrix. At most eight rows and a short cell; a paragraph in a cell means it is not a table.',
  team: 'People with a role and a one-line bio.',
  quote: 'A sentence quoted back from the RFP, or the ChiefNest case study with its disclosure.',
  rtl_section: 'An Arabic section, RTL. The executive summary when one is asked for.',
  close: 'Signoff, call to action, contact, signature blocks.',
};
