/**
 * The Agent SDK session.
 *
 * Five in-process tools, no built-ins, no permission prompts, a turn cap and a
 * wall-clock deadline. Anything the deadline cuts off is filled from the golden
 * fallback so the document still completes — a demo that ends with a half
 * document is worse than one that ends with a borrowed page.
 */

import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { readRfpTool } from './tools/readRfp.js';
import { searchLibraryTool } from './tools/searchLibrary.js';
import { writeBriefTool } from './tools/writeBrief.js';
import { composeProposalTool } from './tools/composeProposal.js';
import { renderPreviewTool } from './tools/renderPreview.js';
import { buildSystemPrompt } from './prompt.js';
import { getRun, newRun, type Run } from './run.js';
import { WORKED_EXAMPLE } from './dev/worked-example.js';
import { ROOT } from './paths.js';
import { research } from './subagents/researcher.js';
import { review } from './subagents/reviewer.js';

const SERVER = 'startsaudi';
const TOOLS = ['read_rfp', 'search_library', 'write_brief', 'compose_proposal', 'render_preview'];
const QUALIFIED = TOOLS.map((t) => `mcp__${SERVER}__${t}`);

/** Every built-in is switched off. The agent has five tools and no filesystem. */
const BUILTINS = [
  'Bash', 'Read', 'Write', 'Edit', 'NotebookEdit', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'TodoWrite', 'Task', 'KillShell', 'BashOutput', 'ExitPlanMode',
];

export type AgentOptions = {
  rfpPath: string;
  /** Unattended: answer the agent's questions from the brief rather than waiting. */
  unattended?: boolean;
  /** Hard stop. The document is completed from the fallback after this. */
  deadlineMs?: number;
  maxTurns?: number;
  model?: string;
};

/** A queue the UI pushes user answers into; the SDK consumes it as streaming input. */
export class Inbox {
  private waiting: ((m: SDKUserMessage | null) => void)[] = [];
  private queued: SDKUserMessage[] = [];
  private closed = false;

  push(text: string): void {
    const msg: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: '',
    };
    const next = this.waiting.shift();
    if (next) next(msg);
    else this.queued.push(msg);
  }

  close(): void {
    this.closed = true;
    while (this.waiting.length) this.waiting.shift()!(null);
  }

  async *stream(): AsyncIterable<SDKUserMessage> {
    while (true) {
      const queued = this.queued.shift();
      if (queued) {
        yield queued;
        continue;
      }
      if (this.closed) return;
      const next = await new Promise<SDKUserMessage | null>((res) => this.waiting.push(res));
      if (!next) return;
      yield next;
    }
  }
}

/**
 * An org-level API key is not scoped to a workspace and the API rejects it with a
 * 400 unless the workspace id travels as a header. Set ANTHROPIC_WORKSPACE_ID and
 * it is passed through; leave ANTHROPIC_API_KEY unset entirely and the CLI uses
 * whatever session is already signed in.
 */
function sessionEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  const ws = env.ANTHROPIC_WORKSPACE_ID;
  if (ws) {
    env.ANTHROPIC_CUSTOM_HEADERS = [env.ANTHROPIC_CUSTOM_HEADERS, `anthropic-workspace-id: ${ws}`]
      .filter(Boolean)
      .join('\n');
  }
  if (env.ANTHROPIC_API_KEY === '') delete env.ANTHROPIC_API_KEY;
  return env;
}

/** Turn the one auth failure this demo actually hits into an instruction. */
export function explainAuthError(message: string): string | null {
  if (/not scoped to a workspace/i.test(message)) {
    return (
      'The API key is an organisation key, which the API rejects unless the workspace travels ' +
      'with it. Either set ANTHROPIC_WORKSPACE_ID in .env alongside it, or use a ' +
      'workspace-scoped key, or clear ANTHROPIC_API_KEY entirely and the signed-in Claude Code ' +
      'session is used instead.'
    );
  }
  return null;
}

function openingPrompt(opts: AgentOptions): string {
  return [
    `An RFP has arrived. It is at: ${opts.rfpPath}`,
    '',
    'Read it, work out what it does not say, and put those questions to the client before you',
    'draft anything. Then write the brief and the outline, and compose the proposal one',
    'section at a time.',
    opts.unattended
      ? '\nThe client is not at their desk. Ask your questions anyway — they go on the record and\n' +
        'they belong in the document — then carry on without waiting, and carry every unanswered\n' +
        'gap into the proposal as a section that names the decision or as a [TO CONFIRM: …] marker.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Human-readable lines for the event log. Never raw JSON on screen. */
function narrate(run: Run, msg: SDKMessage): void {
  if (msg.type === 'assistant') {
    for (const part of msg.message.content) {
      if (part.type === 'text' && part.text.trim()) {
        const text = part.text.trim();
        const auth = explainAuthError(text);
        if (auth) {
          run.bus.emitEvent({ type: 'error', message: auth });
          continue;
        }
        run.bus.emitEvent({ type: /\?\s*$|\?\n/.test(text) ? 'question' : 'agent', text });
      }
    }
  }
  if (msg.type === 'result') {
    run.transcript({ t: 'result', subtype: msg.subtype, turns: 'num_turns' in msg ? msg.num_turns : undefined });
  }
}

/** Anything the agent did not reach, taken from the worked example so the deck completes. */
function completeFromFallback(run: Run): number {
  let filled = 0;
  for (const item of run.outline) {
    if (run.hasSection(item.id)) continue;
    const golden = WORKED_EXAMPLE.find((s) => s.id === item.id);
    if (!golden) continue;
    run.setSection({ ...golden, title: item.title });
    filled++;
  }
  if (filled) {
    run.writeProposal();
    run.bus.emitEvent({
      type: 'warn',
      text: `${filled} section(s) completed from the reference proposal after the time limit.`,
    });
  }
  return filled;
}

export async function runAgent(opts: AgentOptions, inbox = new Inbox()): Promise<Run> {
  const run = getRun() ?? newRun();
  const deadline = opts.deadlineMs ?? 8 * 60_000;

  const server = createSdkMcpServer({
    name: SERVER,
    version: '1.0.0',
    tools: [readRfpTool, searchLibraryTool, writeBriefTool, composeProposalTool, renderPreviewTool],
  });

  run.bus.emitEvent({ type: 'status', text: 'Starting' });
  inbox.push(openingPrompt(opts));

  const session = query({
    prompt: inbox.stream(),
    options: {
      systemPrompt: buildSystemPrompt(),
      mcpServers: { [SERVER]: server },
      allowedTools: QUALIFIED,
      disallowedTools: BUILTINS, // five tools, and nowhere unrehearsed to wander
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: opts.maxTurns ?? 90,
      model: opts.model ?? 'claude-sonnet-5',
      cwd: ROOT,
      env: sessionEnv(),
      includePartialMessages: false,
      maxThinkingTokens: 0,
    },
  });

  const timer = setTimeout(() => {
    run.bus.emitEvent({ type: 'warn', text: 'Time limit reached — completing the document.' });
    void session.interrupt().catch(() => {});
  }, deadline);

  /* The researcher starts the moment the RFP is understood and finishes while the
     main agent is still searching the library. Nothing waits for it. */
  let researching: Promise<void> | null = null;
  const startResearch = () => {
    if (researching || !run.rfp) return;
    run.bus.emitEvent({ type: 'act', verb: 'Asking the researcher about the client', tool: 'researcher' });
    researching = research(run.rfp, sessionEnv())
      .then((found) => {
        if (!found?.findings.length) return;
        run.research = found.findings.map((f) => f.point);
        run.bus.emitEvent({ type: 'research', items: found.findings.map((f) => `${f.point} (${f.basis})`) });
        run.transcript({ t: 'research', findings: found.findings });
        inbox.push(
          'The researcher came back. Use what is useful and ignore what is not. Anything ' +
            'marked "sector knowledge" or not confident is context for your own judgement, ' +
            'not a fact to put in the document:\n' +
            found.findings
              .map((f) => `  - ${f.point}\n    basis: ${f.basis}${f.confident ? '' : ' (not confident)'} · use in: ${f.useItIn}`)
              .join('\n')
        );
      })
      .catch(() => {});
  };
  run.bus.on('event', (e) => {
    if (e.type === 'rfp') startResearch();
  });

  let reviewed = false;

  try {
    for await (const msg of session) {
      run.transcript(msg);
      narrate(run, msg);
      if (msg.type !== 'result') continue;

      /* The agent thinks it is finished. Before agreeing, put a critic over it in
         public — and then let it fix what the critic found. */
      if (!reviewed && run.sectionCount() >= 3) {
        reviewed = true;
        run.bus.emitEvent({ type: 'act', verb: 'Asking the reviewer to check this against the requirements', tool: 'reviewer' });
        const found = await review(run, sessionEnv());
        run.transcript({ t: 'review', review: found });

        if (found?.findings.length) {
          run.bus.emitEvent({ type: 'review', findings: found.findings });
          inbox.push(
            `The reviewer read the draft against the RFP and found ${found.findings.length} ` +
              `thing${found.findings.length === 1 ? '' : 's'}. Its verdict: ${found.verdict}\n\n` +
              found.findings
                .map((f) => `  - [${f.severity}] ${f.requirement}\n    ${f.note}\n    section: ${f.sectionId}`)
                .join('\n') +
              '\n\nFix the blocking and material ones by recomposing only the sections named. ' +
              'Say which you are changing and why. If you disagree with a finding, say so and ' +
              'leave it — but say it out loud rather than ignoring it.'
          );
          continue;
        }

        run.bus.emitEvent({ type: 'review', findings: [] });
        if (found) run.bus.emitEvent({ type: 'agent', text: `Reviewer: ${found.verdict}` });
      }
      break;
    }
  } catch (e) {
    run.bus.emitEvent({ type: 'error', message: (e as Error).message });
  } finally {
    clearTimeout(timer);
    inbox.close();
    if (researching) await researching;
  }

  completeFromFallback(run);
  const url = run.writeProposal();
  run.bus.emitEvent({ type: 'preview', url });
  run.bus.emitEvent({
    type: 'done',
    url,
    sections: run.sectionCount(),
    elapsedMs: Date.now() - run.started,
  });
  return run;
}
