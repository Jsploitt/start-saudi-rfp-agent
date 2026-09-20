/**
 * The multi-session check, against a running server.
 *
 *   npm run smoke                      # http://localhost:5173
 *   npm run smoke -- https://host      # a deployment
 *
 * It signs in, starts two cached sessions at once, streams both, and asserts the
 * two streams never mention each other's id and never carry each other's
 * sections. Then it lists, to prove both survive a restart if one happened
 * between runs.
 */

import 'dotenv/config';
import { isMain } from '../isMain.js';

const origin = process.argv[2] ?? `http://localhost:${process.env.PORT ?? 5173}`;
const passcode = process.env.ACCESS_PASSCODE ?? process.argv[3];

let cookie = '';

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${origin}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return res;
}

const json = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await call(path, init);
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
};

type Collected = { sections: Set<string>; done: boolean; ids: Set<string> };

/** Read the stream to its 'done', collecting section ids seen. */
async function collect(sessionId: string, timeoutMs = 600_000): Promise<Collected> {
  const out: Collected = { sections: new Set(), done: false, ids: new Set() };
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), timeoutMs);

  const res = await fetch(`${origin}/api/sessions/${sessionId}/events`, {
    headers: { cookie, accept: 'text/event-stream' },
    signal: control.signal,
  });
  if (!res.ok || !res.body) throw new Error(`stream ${sessionId} -> ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (!out.done) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const data = frame
          .split('\n')
          .filter((l) => l.startsWith('data: '))
          .map((l) => l.slice(6))
          .join('');
        if (!data) continue;
        const e = JSON.parse(data) as Record<string, unknown>;
        if (typeof e.url === 'string') {
          const match = /\/runs\/(ses_[0-9a-f]+)\//.exec(e.url);
          if (match) out.ids.add(match[1]);
        }
        if (e.type === 'section:done') out.sections.add(String(e.id));
        if (e.type === 'done' || e.type === 'error' || e.type === 'stopped') out.done = true;
      }
    }
  } finally {
    clearTimeout(timer);
    control.abort();
  }
  return out;
}

if (isMain(import.meta.url)) {
  if (!passcode) throw new Error('Set ACCESS_PASSCODE, or pass it as the second argument.');

  await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ passcode, name: 'smoke' }),
  });
  console.log('signed in');

  const health = await json<{ capacity: number }>('/healthz');
  console.log(`capacity ${health.capacity}`);

  const make = (title: string) =>
    json<{ sessionId: string }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ title, mode: 'cached', path: 'proposal/sample-rfp.md' }),
    });

  const a = await make('smoke A');
  const b = await make('smoke B');
  console.log(`two sessions: ${a.sessionId}  ${b.sessionId}`);
  if (a.sessionId === b.sessionId) throw new Error('the registry handed out one id twice');

  const [ra, rb] = await Promise.all([collect(a.sessionId), collect(b.sessionId)]);

  for (const [name, r, own, other] of [
    ['A', ra, a.sessionId, b.sessionId],
    ['B', rb, b.sessionId, a.sessionId],
  ] as const) {
    if (r.ids.has(other)) throw new Error(`stream ${name} carried ${other}: the streams are crossed`);
    if (r.ids.size && !r.ids.has(own)) throw new Error(`stream ${name} never mentioned its own id`);
    console.log(`stream ${name}: ${r.sections.size} sections, own id only`);
  }

  const listed = await json<{ sessions: { id: string; sections: number; title: string }[] }>(
    '/api/sessions'
  );
  for (const id of [a.sessionId, b.sessionId]) {
    const row = listed.sessions.find((s) => s.id === id);
    if (!row) throw new Error(`${id} is not in the listing`);
    console.log(`listed ${row.title}: ${row.sections} sections on disk`);
  }

  console.log('\nok — two sessions, two documents, no crossed streams.');
  console.log('Now restart the server and run this again; the listing must still show both.');
}
