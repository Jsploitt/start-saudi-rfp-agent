/**
 * Run state: the assembled document, the brief, the RFP analysis, the transcript.
 *
 * Sections are held in an ordered map keyed by id, so re-composing one section
 * replaces it in place and leaves the rest untouched. That is what makes the
 * targeted live edit possible without regenerating the document.
 */

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { RUNS_DIR } from './paths.js';
import { EventBus } from './events.js';
import type { Section } from './render/blocks.js';
import { renderSections } from './render/renderer.js';
import { renderDocument } from './render/template.js';

export const RfpAnalysis = z.object({
  client: z.object({
    name: z.string(),
    sector: z.string().optional(),
    country: z.string().optional(),
  }),
  summary: z.string().describe('Three or four sentences. What they are asking for and why.'),
  requirements: z
    .array(z.object({ id: z.string(), text: z.string(), mustHave: z.boolean() }))
    .min(1),
  dates: z.array(z.object({ label: z.string(), date: z.string() })),
  evaluationCriteria: z.array(z.string()),
  gaps: z
    .array(
      z.object({
        question: z.string().describe('The question to put to the client, in their own terms.'),
        whyItMatters: z.string().describe('The consequence of getting it wrong. Be concrete.'),
      })
    )
    .min(1)
    .describe(
      'What the RFP does NOT say. Unstated budget, ambiguous scope boundaries, a timeline ' +
        'that conflicts with itself, unnamed decision-makers, an assumption the client has ' +
        'made without knowing it is an assumption. This is the most important field in the ' +
        'system. An empty array is always wrong.'
    ),
});
export type RfpAnalysis = z.infer<typeof RfpAnalysis>;

export const Brief = z.object({
  client: z.string(),
  engagementType: z.string(),
  scopeIn: z.array(z.string()).min(1),
  scopeOut: z.array(z.string()).min(1).describe('A brand whose signature move is naming its own boundary always has these.'),
  timeline: z.array(z.string()),
  constraints: z.array(z.string()),
  openItems: z.array(z.string()).describe('Carried from the RFP gaps. These become [TO CONFIRM] markers.'),
  winThemes: z.array(z.string()),
});
export type Brief = z.infer<typeof Brief>;

export type OutlineItem = { id: string; title: string; intent: string };

export class Run {
  readonly id: string;
  readonly dir: string;
  readonly bus = new EventBus();
  readonly started = Date.now();

  rfp: RfpAnalysis | null = null;
  brief: Brief | null = null;
  outline: OutlineItem[] = [];
  research: string[] = [];
  private sections = new Map<string, Section>();
  /** Pending answers the agent is waiting on, keyed by nothing — it is a queue. */
  readonly answers: string[] = [];

  constructor(id = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`) {
    this.id = id;
    this.dir = join(RUNS_DIR, id);
    mkdirSync(this.dir, { recursive: true });
  }

  get proposalUrl(): string {
    return `/runs/${this.id}/proposal.html`;
  }

  setSection(section: Section): void {
    this.sections.set(section.id, section);
  }

  hasSection(id: string): boolean {
    return this.sections.has(id);
  }

  /** Outline order wins; anything composed off-outline is appended in arrival order. */
  orderedSections(): Section[] {
    const byOutline = this.outline
      .map((o) => this.sections.get(o.id))
      .filter((s): s is Section => Boolean(s));
    const extra = [...this.sections.values()].filter((s) => !this.outline.some((o) => o.id === s.id));
    return byOutline.length ? [...byOutline, ...extra] : extra;
  }

  sectionCount(): number {
    return this.sections.size;
  }

  /** Write the assembled document. Called after every section, so the preview is live. */
  writeProposal(): string {
    const sections = this.orderedSections();
    const client = this.rfp?.client.name ?? this.brief?.client ?? 'Proposal';
    const html = renderDocument({
      title: `${client} — Start Saudi proposal`,
      sectionsHtml: renderSections(sections),
      assetPrefix: '/',
    });
    writeFileSync(join(this.dir, 'proposal.html'), html, 'utf8');
    writeFileSync(
      join(this.dir, 'sections.json'),
      JSON.stringify({ outline: this.outline, sections }, null, 2),
      'utf8'
    );
    return this.proposalUrl;
  }

  transcript(entry: unknown): void {
    try {
      appendFileSync(join(this.dir, 'transcript.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
    } catch {
      /* a demo must not die because a log write failed */
    }
  }
}

/** One run at a time. This is a demo, not a service. */
let current: Run | null = null;
export const getRun = (): Run | null => current;
export const newRun = (id?: string): Run => (current = new Run(id));
