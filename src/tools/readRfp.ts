/**
 * read_rfp — parse the uploaded document, then hold the model to a typed analysis.
 *
 * Two calls, deliberately:
 *   1. read_rfp({ file_path })            -> the extracted text, and the contract
 *   2. read_rfp({ file_path, analysis })  -> validated, persisted, pushed to the UI
 *
 * The extraction is deterministic; the analysis is the model's judgement; the
 * validation is deterministic again. Splitting it this way is what lets the
 * system REJECT an empty `gaps` array rather than hope for a full one — and the
 * gaps are the whole point of the exercise.
 */

import { open, readFile } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { RfpAnalysis, type Run } from '../run.js';
import { ok, fail } from './result.js';

/**
 * What kind of document this actually is, from its first four bytes.
 *
 * Not from its extension. An upload arrives as a multer temp file with a
 * random name and no extension at all, so `extname()` returned '' and the
 * PDF branch was never taken: the file fell through to `readFile(path,
 * 'utf8')` and a 2.65 MB PDF became 2.5 million characters of binary — about
 * 630,000 tokens — posted into the first turn. The run did not produce a bad
 * proposal, it died before the analysis, and the failure looked like a hang.
 *
 * Magic bytes are not a heuristic here: `%PDF-` and the zip header are part of
 * both formats' specifications.
 */
async function sniff(path: string): Promise<'pdf' | 'docx' | 'text'> {
  let head: Buffer;
  try {
    const fh = await open(path, 'r');
    try {
      head = Buffer.alloc(4);
      await fh.read(head, 0, 4, 0);
    } finally {
      await fh.close();
    }
  } catch {
    return 'text';
  }

  if (head.toString('latin1') === '%PDF') return 'pdf';
  /* Every .docx is a zip. So is every .xlsx and .pptx, which mammoth will
     reject with its own message — better than reading one as text. */
  if (head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05)) {
    return 'docx';
  }

  /* No signature. Trust the extension for the two that have one, then text. */
  const ext = extname(path).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  return 'text';
}

async function extract(path: string): Promise<string> {
  const kind = await sniff(path);

  if (kind === 'pdf') {
    // pdf-parse is CJS and reads a fixture file at import time in some versions;
    // importing the implementation directly avoids that.
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    const pdf = (mod as { default: (b: Buffer) => Promise<{ text: string }> }).default;
    return (await pdf(await readFile(path))).text;
  }

  if (kind === 'docx') {
    const { extractRawText } = await import('mammoth');
    return (await extractRawText({ path })).value;
  }

  const text = await readFile(path, 'utf8');

  /* A last guard for a binary format with no signature this function knows.
     U+FFFD is what utf8 decoding leaves behind where the bytes were not text,
     and a real RFP does not contain them by the thousand. */
  const replacements = (text.match(/\uFFFD/gu) ?? []).length;
  if (replacements > 64 && replacements > text.length / 200) {
    throw new Error(
      'this file is not text, and is not a PDF or a DOCX either. Convert it and try again'
    );
  }
  return text;
}

/**
 * How much of the RFP goes into the model's context.
 *
 * The uploaded file is bounded by nothing — the oversized sample in uploads/ is
 * a 2.65 MB PDF — and an RFP that extracts to half a million characters does
 * not produce a bad proposal, it produces no proposal: the first turn exceeds
 * the context window and the run dies before the analysis is ever attempted.
 * Nine minutes of demo, nothing on screen.
 *
 * 200k characters is roughly 50k tokens, which leaves room for the system
 * prompt, the library excerpts, seventeen composed sections and the reviewer.
 */
const MAX_CHARS = 200_000;
/** Of that budget, how much is kept from the end rather than the beginning. */
const TAIL_CHARS = 60_000;

/**
 * A PDF with no text layer extracts to almost nothing. Left alone, the agent
 * reads it, gets an empty string, and writes a confident proposal against a
 * document it never saw. Better to refuse, and say why.
 */
const MIN_CHARS = 200;

/**
 * Keep the head and the tail, and say where the cut is.
 *
 * Not simply the first 200k: an RFP puts the scope at the front and the
 * evaluation criteria, the submission deadline and the contract terms at the
 * back, and those are exactly what a proposal is scored against. Taking the
 * head alone drops the half the document is judged by.
 */
function clamp(text: string): { text: string; dropped: number } {
  if (text.length <= MAX_CHARS) return { text, dropped: 0 };
  const head = text.slice(0, MAX_CHARS - TAIL_CHARS);
  const tail = text.slice(-TAIL_CHARS);
  const dropped = text.length - head.length - tail.length;
  return {
    text:
      head +
      `\n\n--- ${dropped.toLocaleString('en')} characters omitted from the middle of this ` +
      'document, which is too long to read whole. The beginning and the end are intact. ' +
      'If a requirement is referred to but not stated, say so in your analysis and ask ' +
      'about it rather than inventing it. ---\n\n' +
      tail,
    dropped,
  };
}

/** The answer key at the foot of sample-rfp.md is not for the model to read. */
function stripAnswerKey(text: string): string {
  const cut = text.search(/^#+\s*The deliberate ambiguities/im);
  return cut > 0 ? text.slice(0, cut) : text;
}

export const makeReadRfpTool = (run: Run) => tool(
  'read_rfp',
  'Read the client\'s RFP and record a structured analysis of it. Call it first with only ' +
    'file_path to get the document text. Then call it a second time with the same file_path ' +
    'and the analysis filled in. The gaps array is the most important field: it is what the ' +
    'RFP does NOT say, and it must never be empty.',
  {
    file_path: z.string().describe('Path to the RFP. PDF, DOCX or Markdown.'),
    analysis: RfpAnalysis.optional().describe('Omit on the first call. Required on the second.'),
  },
  async ({ file_path, analysis }) => {
    run.touch();

    if (!analysis) {
      run.setPhase('reading-rfp');
      run.bus.emitEvent({ type: 'act', verb: 'Reading the RFP', detail: basename(file_path), tool: 'read_rfp' });
      let raw: string;
      try {
        raw = stripAnswerKey(await extract(file_path));
      } catch (e) {
        return fail(`Could not read ${file_path}: ${(e as Error).message}`);
      }

      /* A scan. Refuse it loudly rather than write against an empty document. */
      if (raw.trim().length < MIN_CHARS) {
        run.bus.emitEvent({
          type: 'warn',
          text:
            `${basename(file_path)} has no readable text. If it is a scan, the agent cannot ` +
            'read it — send a text PDF or a DOCX instead.',
        });
        return fail(
          `${basename(file_path)} extracted to ${raw.trim().length} characters, so it has no ` +
            'text layer — almost certainly a scan or an image-only PDF. Do not guess at its ' +
            'contents. Tell the operator it cannot be read and ask for a text PDF, a DOCX, or ' +
            'the text pasted in.'
        );
      }

      const { text, dropped } = clamp(raw);
      if (dropped) {
        run.bus.emitEvent({
          type: 'warn',
          text:
            `${basename(file_path)} is ${Math.round(raw.length / 1000)}k characters. The agent ` +
            `read the beginning and the end, and skipped ${Math.round(dropped / 1000)}k in the ` +
            'middle.',
        });
      }
      run.transcript({
        t: 'rfp:text',
        file: file_path,
        chars: raw.length,
        used: text.length,
        dropped,
      });
      return ok(
        `Document: ${basename(file_path)} (${raw.length} characters` +
          (dropped ? `, ${text.length} of them below` : '') +
          `)\n\n` +
          '--- BEGIN DOCUMENT ---\n' +
          text +
          '\n--- END DOCUMENT ---\n\n' +
          'Now call read_rfp again with the same file_path and the `analysis` argument.\n' +
          'Before you do, read the document a second time asking only one question: what does ' +
          'it NOT say? Look for an unstated budget, a scope boundary the client has not noticed ' +
          'is ambiguous, a date that does not reconcile with another date, a decision nobody has ' +
          'been named to take, and an assumption the client has made without knowing it is an ' +
          'assumption. Those go in `gaps`. An empty gaps array will be rejected.'
      );
    }

    const parsed = RfpAnalysis.safeParse(analysis);
    if (!parsed.success) {
      return fail(
        'The analysis did not validate. Fix these and call read_rfp again:\n' +
          parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
      );
    }
    if (!parsed.data.gaps.length) {
      return fail('gaps is empty. Re-read the RFP and identify what it does not say.');
    }

    run.rfp = parsed.data;
    run.setPhase('asking');
    run.bus.emitEvent({ type: 'rfp', analysis: parsed.data });
    run.bus.emitEvent({
      type: 'act',
      verb: 'Noticed what the RFP does not say',
      detail: `${parsed.data.gaps.length} open question${parsed.data.gaps.length === 1 ? '' : 's'}`,
      tool: 'read_rfp',
    });
    run.transcript({ t: 'rfp:analysis', analysis: parsed.data });

    return ok(
      `Recorded. ${parsed.data.requirements.length} requirements, ${parsed.data.dates.length} dates, ` +
        `${parsed.data.gaps.length} gaps.\n\n` +
        'Put the gaps to the client now, in one message, before you draft anything. ' +
        'Ask them as questions a person would ask, not as a list of fields.'
    );
  }
);
