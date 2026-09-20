/**
 * render_preview — write the assembled document and point the UI at it,
 * optionally at one section.
 */

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Run } from '../run.js';
import { ok, fail } from './result.js';

export const makeRenderPreviewTool = (run: Run) => tool(
  'render_preview',
  'Write the assembled proposal and refresh the preview. Use it when you want the client to ' +
    'look at a particular section, or once at the end. Composing a section already refreshes ' +
    'the preview, so you do not need to call this after every one.',
  {
    sectionId: z.string().optional().describe('Scroll the preview to this section.'),
  },
  async ({ sectionId }) => {
    run.touch();
    if (!run.sectionCount()) return fail('There is nothing to preview yet. Compose a section first.');

    const url = run.writeProposal();
    run.bus.emitEvent({ type: 'preview', url, sectionId });
    run.bus.emitEvent({
      type: 'act',
      verb: 'Refreshed the preview',
      detail: sectionId ?? `${run.sectionCount()} sections`,
      tool: 'render_preview',
    });

    return ok(`Preview updated: ${run.sectionCount()} section(s) at ${url}`);
  }
);
