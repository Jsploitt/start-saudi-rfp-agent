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
import { makeReadRfpTool } from './tools/readRfp.js';
import { makeSearchLibraryTool } from './tools/searchLibrary.js';
import { makeWriteBriefTool } from './tools/writeBrief.js';
import { makeComposeProposalTool } from './tools/composeProposal.js';
import { makeRenderPreviewTool } from './tools/renderPreview.js';
import { buildSystemPrompt } from './prompt.js';
import { type Run } from './run.js';
import { WORKED_EXAMPLE } from './dev/worked-example.js';
import { ROOT } from './paths.js';
import { hasIntake, type Intake } from './contracts.js';
import { research } from './subagents/researcher.js';
import { review } from './subagents/reviewer.js';

const SERVER = 'startsaudi';
const TOOLS = ['read_rfp', 'search_library', 'write_brief', 'compose_proposal', 'render_preview'];
const QUALIFIED = TOOLS.map((t) => `mcp__${SERVER}__${t}`);

/**
 * The five tools are the whole toolbox, and `tools: []` is what makes that
 * true rather than aspirational.
 *
 * This was a hand-written denylist of built-ins, which was wrong in a way that
 * only showed up in a session/init line: `allowedTools` is an auto-approve
 * list, not a restriction, and a denylist can only name the tools that existed
 * when it was written. Everything the harness has gained since — CronCreate,
 * Monitor, Skill, ToolSearch, Workflow and the rest — was neither allowed nor
 * denied, so it arrived in the model's context by default.
 *
 * `tools: []` disables every built-in, including the ones added next month.
 * The list below is kept as a second belt because it costs nothing, but it is
 * no longer the mechanism.
 */
const BUILTINS = [
  'Bash', 'Read', 'Write', 'Edit', 'NotebookEdit', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'TodoWrite', 'Task', 'KillShell', 'BashOutput', 'ExitPlanMode',
];

export type AgentOptions = {
  rfpPath: string;
  /** What the operator stated on the intake form, before the RFP was read. */
  intake?: Intake | null;
  /** Unattended: answer the agent's questions from the brief rather than waiting. */
  unattended?: boolean;
  /** Hard stop on reaching a finished document. Cleared once one exists. */
  deadlineMs?: number;
  /** Keep the session alive after the document is done, for follow-up changes. */
  stayOpen?: boolean;
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
/**
 * What the subprocess is allowed to inherit, by name.
 *
 * Spreading `process.env` handed the agent the developer's own Claude Code
 * environment: `CLAUDE_CONFIG_DIR` pointing at a plugin directory,
 * `CLAUDECODE`/`CLAUDE_CODE_*` marking it a nested session, and with them every
 * MCP server the developer happens to have connected. None of that is part of
 * this demo, none of it exists on the container, and a demo that behaves
 * differently on a laptop than in production has not been rehearsed.
 *
 * So the child environment is built from an allowlist, the same way the toolbox
 * is. A variable not named here does not travel.
 */
const ENV_ALLOWLIST = [
  /* The API, and nothing else about the developer's account. */
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL',
  'ANTHROPIC_WORKSPACE_ID', 'ANTHROPIC_CUSTOM_HEADERS', 'ANTHROPIC_MODEL',
  /* This app's own switches, read by the subagents. */
  'DEMO_MODE', 'ALLOW_WEB',
  /* Enough of an operating system to spawn node. */
  'PATH', 'HOME', 'LANG', 'LC_ALL', 'TZ', 'TMPDIR', 'NODE_EXTRA_CA_CERTS',
  /* Windows needs these or the subprocess does not start at all. */
  'SystemRoot', 'SystemDrive', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP',
  'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ProgramFiles', 'ProgramData',
  'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS',
];

function sessionEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  const ws = env.ANTHROPIC_WORKSPACE_ID;
  if (ws) {
    env.ANTHROPIC_CUSTOM_HEADERS = [env.ANTHROPIC_CUSTOM_HEADERS, `anthropic-workspace-id: ${ws}`]
      .filter(Boolean)
      .join('\n');
  }
  if (env.ANTHROPIC_API_KEY === '') delete env.ANTHROPIC_API_KEY;

  /* Name this app in the User-Agent rather than inheriting whatever the parent
     session called itself. */
  env.CLAUDE_AGENT_SDK_CLIENT_APP = 'start-saudi-rfp-agent/0.1.0';
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

/**
 * The intake form, as lines the agent is told are true.
 *
 * These are not hints. The operator typed them, so the legal name on the cover
 * page comes from a person rather than from the model's reading of a document
 * that may never state it — and an inferred legal name on a cover page is the
 * kind of error that reaches a client.
 *
 * A blank field is simply absent. It then shows up as a gap like any other and
 * the agent asks about it, which is the same outcome as before the form
 * existed, minus the guessing.
 */
function intakeLines(intake: Intake | null): string {
  if (!hasIntake(intake)) return '';
  const stated: [string, string][] = [
    ['Client legal name', intake.clientLegalName],
    ['Sector', intake.sector],
    ['Country', intake.country],
    ['Contact', [intake.contactName, intake.contactEmail].filter(Boolean).join(', ')],
    ['The assignment', intake.assignment],
    ["The client's target date", intake.targetDate],
  ];
  const lines = stated.filter(([, v]) => v.trim()).map(([k, v]) => `  ${k}: ${v}`);
  if (!lines.length) return '';
  return [
    '',
    'Before the RFP arrived, the operator stated the following. Treat these as fact and use',
    'them verbatim — the legal name in particular goes on the cover exactly as written here.',
    'Anything not listed was left blank: do not invent it, ask about it with the other gaps.',
    ...lines,
  ].join('\n');
}

function openingPrompt(opts: AgentOptions): string {
  return [
    `An RFP has arrived. It is at: ${opts.rfpPath}`,
    intakeLines(opts.intake ?? null),
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
  /* Before any type check: every message of any kind, including a tool-use block
     with no prose in it, is proof the session is alive. This single line is what
     lets the UI tell "thinking" from "wedged". */
  run.touch();

  if (msg.type === 'assistant') {
    for (const part of msg.message.content) {
      if (part.type === 'text' && part.text.trim()) {
        const text = part.text.trim();
        const auth = explainAuthError(text);
        if (auth) {
          run.bus.emitEvent({ type: 'error', message: auth });
          continue;
        }
        const asking = /\?\s*$|\?\n/.test(text);
        /* A run waiting on a person is not a run that has stalled, and the
           listing should not make them look alike. */
        if (asking && run.running) run.setStatus('waiting');
        run.bus.emitEvent({ type: asking ? 'question' : 'agent', text });
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

export async function runAgent(run: Run, opts: AgentOptions, inbox = new Inbox()): Promise<Run> {
  const deadline = opts.deadlineMs ?? 8 * 60_000;

  /* The server is built per call, so the five tools can close over this run.
     The SDK handler signature is (args, extra) and `extra` is MCP request
     metadata, not our context: a closure is the only honest way to carry the
     session id without inventing an argument the model would have to fill. */
  const server = createSdkMcpServer({
    name: SERVER,
    version: '1.0.0',
    tools: [
      makeReadRfpTool(run),
      makeSearchLibraryTool(run),
      makeWriteBriefTool(run),
      makeComposeProposalTool(run),
      makeRenderPreviewTool(run),
    ],
  });

  run.setPhase('starting');
  run.bus.emitEvent({ type: 'status', text: 'Starting' });
  inbox.push(openingPrompt(opts));

  const session = query({
    prompt: inbox.stream(),
    options: {
      systemPrompt: buildSystemPrompt(),
      mcpServers: { [SERVER]: server },
      /* `tools: []` is the restriction. `allowedTools` only says these five run
         without a permission prompt — the two are easy to confuse, and the
         difference between them is the whole toolbox. */
      tools: [],
      /* No ~/.claude/settings.json, no .claude/settings.json, no plugins, and
         therefore no MCP servers beyond the one built above. Omitting this
         loads all three, which is the CLI default and wrong for an embedded
         agent. */
      settingSources: [],
      allowedTools: QUALIFIED,
      disallowedTools: BUILTINS, // five tools, and nowhere unrehearsed to wander
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: opts.maxTurns ?? 140, // the document, the reviewer fixes, then the live changes
      model: opts.model ?? 'claude-sonnet-5',
      cwd: ROOT,
      env: sessionEnv(),
      includePartialMessages: false,
      maxThinkingTokens: 0,
    },
  });

  run.interruptHandle = () => void session.interrupt().catch(() => {});

  const timer = setTimeout(() => {
    run.bus.emitEvent({ type: 'warn', text: 'Time limit reached — completing the document.' });
    void session.interrupt().catch(() => {});
  }, deadline);

  /* The researcher starts the moment the RFP is understood and finishes while the
     main agent is still searching the library. Nothing waits for it. */
  let researching: Promise<void> | null = null;
  const startResearch = () => {
    if (researching || !run.rfp) return;
    run.setPhase('researching');
    run.bus.emitEvent({ type: 'act', verb: 'Asking the researcher about the client', tool: 'researcher' });
    researching = research(run.rfp, sessionEnv())
      .then((found) => {
        run.touch();
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
  /* Captured so the finally can remove it. An un-removed listener on a long-lived
     bus is how a registry of sessions turns into a leak. */
  const offRfp = run.bus.listen((e) => {
    if (e.type === 'rfp') startResearch();
  });

  let reviewed = false;
  let finished = false;

  /** The document is complete. In the room, that is the middle of the demo, not the end. */
  const announceDone = () => {
    completeFromFallback(run);
    run.setPhase('ready');
    const url = run.writeProposal();
    run.bus.emitEvent({ type: 'preview', url });
    run.bus.emitEvent({
      type: 'done',
      url,
      sections: run.sectionCount(),
      elapsedMs: Date.now() - run.started,
    });
  };

  try {
    for await (const msg of session) {
      run.transcript(msg);
      narrate(run, msg);
      if (msg.type !== 'result') continue;

      /* The agent thinks it is finished. Before agreeing, put a critic over it in
         public — and then let it fix what the critic found. */
      if (!reviewed && run.sectionCount() >= 3) {
        reviewed = true;
        run.setPhase('reviewing');
        run.bus.emitEvent({ type: 'act', verb: 'Asking the reviewer to check this against the requirements', tool: 'reviewer' });
        const found = await review(run, sessionEnv());
        run.touch();
        run.transcript({ t: 'review', review: found });

        if (found?.findings.length) {
          run.setPhase('revising');
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

      /* First time through: the document is done. The deadline was there to
         guarantee a finished document, so it stops mattering now. */
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        announceDone();
        if (!opts.stayOpen) break;
        run.bus.emitEvent({ type: 'status', text: 'Ready — ask for a change' });
        continue;
      }

      /* A follow-up turn landed: the client asked for something after the fact.
         Whatever it changed is already rendered; just refresh and stay open. */
      const url = run.writeProposal();
      run.bus.emitEvent({ type: 'preview', url });
      run.bus.emitEvent({ type: 'status', text: 'Ready — ask for a change' });
    }
  } catch (e) {
    run.bus.emitEvent({ type: 'error', message: (e as Error).message });
  } finally {
    clearTimeout(timer);
    offRfp();
    inbox.close();
    run.interruptHandle = null;
    if (researching) await researching;
  }

  /* A user-requested stop leaves the document exactly as it is — no fallback
     fill-in, no "done". That completion path stays reserved for the deadline. */
  if (run.stopRequested) {
    run.bus.emitEvent({ type: 'stopped' });
    return run;
  }

  if (!finished) announceDone();
  return run;
}
