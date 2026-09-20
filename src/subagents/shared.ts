/**
 * Subagents run as their own query() calls rather than through the Task tool.
 *
 * Three reasons, all of them about the room: they can start before the main agent
 * needs them and finish while it is still working; their findings come back as
 * typed JSON rather than prose the main agent has to re-read; and if one fails or
 * runs long it is one `await` to give up on, not a stalled main loop.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export type SubagentRun<T> = {
  name: string;
  systemPrompt: string;
  prompt: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
  allowWeb?: boolean;
};

export async function runSubagent<T>(opts: SubagentRun<T>): Promise<T | null> {
  const timeout = opts.timeoutMs ?? 90_000;

  const work = (async (): Promise<T | null> => {
    let done = false;
    async function* stream() {
      yield {
        type: 'user' as const,
        message: { role: 'user' as const, content: opts.prompt },
        parent_tool_use_id: null,
        session_id: '',
      };
      while (!done) await new Promise((r) => setTimeout(r, 200));
    }

    const session = query({
      prompt: stream(),
      options: {
        systemPrompt: opts.systemPrompt,
        tools: opts.allowWeb ? ['WebSearch', 'WebFetch'] : [],
        /* Same isolation as the main session: no user or project settings, so
           no plugins and no MCP servers inherited from whoever is running the
           server. A subagent with a search tool and nothing else is the point. */
        settingSources: [],
        mcpServers: {},
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        maxTurns: opts.allowWeb ? 12 : 4,
        model: 'claude-sonnet-5',
        env: opts.env,
        outputFormat: { type: 'json_schema', schema: opts.jsonSchema },
      },
    });

    try {
      for await (const msg of session) {
        if (msg.type !== 'result') continue;
        done = true;
        const raw =
          'structured_output' in msg && msg.structured_output
            ? msg.structured_output
            : safeJson('result' in msg ? String(msg.result) : '');
        const parsed = opts.schema.safeParse(raw);
        return parsed.success ? parsed.data : null;
      }
    } finally {
      done = true;
    }
    return null;
  })();

  return Promise.race([
    work.catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), timeout)),
  ]);
}

/** Models sometimes wrap JSON in prose. Take the outermost object if so. */
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(text.slice(a, b + 1));
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}
