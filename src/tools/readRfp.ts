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

import { readFile } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { RfpAnalysis, type Run } from '../run.js';
import { ok, fail } from './result.js';

async function extract(path: string): Promise<string> {
  const ext = extname(path).toLowerCase();
  if (ext === '.pdf') {
    // pdf-parse is CJS and reads a fixture file at import time in some versions;
    // importing the implementation directly avoids that.
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    const pdf = (mod as { default: (b: Buffer) => Promise<{ text: string }> }).default;
    return (await pdf(await readFile(path))).text;
  }
  if (ext === '.docx') {
    const { extractRawText } = await import('mammoth');
    return (await extractRawText({ path })).value;
  }
  return readFile(path, 'utf8');
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
      let text: string;
      try {
        text = stripAnswerKey(await extract(file_path));
      } catch (e) {
        return fail(`Could not read ${file_path}: ${(e as Error).message}`);
      }
      run.transcript({ t: 'rfp:text', file: file_path, chars: text.length });
      return ok(
        `Document: ${basename(file_path)} (${text.length} characters)\n\n` +
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
