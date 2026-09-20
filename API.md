# API contract

Base `/api`. JSON in, JSON out. Cookie auth. Errors are always `{ error, code? }`.

`sessionId` is the run id, the directory name under `runs/`, and the id in every
event. One id, one word.

## Auth

The cookie is `ss_session`: HttpOnly, SameSite=Lax, Secure in production, signed
HS256 with `SESSION_SECRET`. It is stateless, so a restart does not sign anyone
out.

A cookie rather than a bearer token because `EventSource` cannot set an
`Authorization` header.

CSRF: mutating requests must send `Content-Type: application/json`, or, for the
upload, `multipart/form-data` plus `X-Requested-With: fetch`. A cross-site form
can send neither.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/login` | `{passcode, name}` → sets the cookie, `{ok: true}`. 401 `bad_passcode`. |
| POST | `/api/auth/logout` | 204 |
| GET | `/api/auth/me` | `{user: {id, name}}` or 401 |

## Sessions

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/sessions` | `?limit=&cursor=&archived=1` → `{sessions: SessionSummary[], nextCursor}` |
| POST | `/api/sessions` | multipart `file`, or JSON `{path?, title?, mode?, autostart?}` → 201 `{sessionId, url, mode, autostart}`. 429 `at_capacity`. |
| GET | `/api/sessions/:id` | `SessionDetail` |
| PATCH | `/api/sessions/:id` | `{title}` |
| DELETE | `/api/sessions/:id` | Archives. Sets `archivedAt`, stops a live run, leaves every artifact in place. Nothing is deleted. |
| PATCH | `/api/sessions/:id/theme` | `{preset, accent}` |
| GET | `/api/sessions/:id/sections` | `{outline, sections}` — full blocks, for a renderer that is not an iframe |
| POST | `/api/sessions/:id/answer` | `{text}` → 202 |
| POST | `/api/sessions/:id/stop` | 202 |
| POST | `/api/sessions/:id/restart` | New session over the same RFP → 201 `{sessionId, restartedFrom}` |
| POST | `/api/sessions/:id/export` | 202. The PDF arrives on the stream as `{type: 'pdf', url}`. Async because Chromium takes 5 to 15 seconds and a request that hangs that long reads as a crash. |
| GET | `/api/sessions/:id/events` | SSE, below |
| GET | `/api/sessions/:id/events.json` | `?since=<seq>` → `{events, lastSeq, heartbeat}`. Polling fallback for a proxy that eats SSE. |
| GET | `/brand/tokens.css` | The kit's brand tokens, served rather than copied at boot |
| GET | `/healthz` | `{ok, version, mode, activeRuns, capacity}`. No secret ever appears here. |

### SessionSummary

```ts
{
  id: string
  title: string
  status: 'queued' | 'running' | 'waiting' | 'done' | 'stopped' | 'error' | 'orphaned'
  phase: Phase | null
  mode: string
  rfpName: string | null
  sections: number
  live: boolean
  restartedFrom: string | null
  createdAt: number
  updatedAt: number
  finishedAt: number | null
  archivedAt: number | null
}
```

`SessionDetail` is a `SessionSummary` plus `proposalUrl`, `theme`, `outline`,
`rfp`, `brief`, `lastSeq` and `sinceLastActivityMs`.

`Phase` is one of `starting`, `reading-rfp`, `asking`, `researching`,
`briefing`, `composing`, `reviewing`, `revising`, `ready`.

## The stream

`GET /api/sessions/:id/events`

Every event carries its `seq` on the SSE `id:` line, so the browser resends
`Last-Event-ID` on reconnect for free and replay is `WHERE seq > :since` rather
than a walk of the whole log. `?since=<seq>` does the same thing explicitly.

Two kinds of frame arrive:

- **Default events** — the `RunEvent` union in `src/events.ts`, each stamped with
  `at` and `seq`, each persisted. `status`, `act`, `agent`, `question`, `answer`,
  `rfp`, `brief`, `outline`, `section:start`, `section:done`, `preview`,
  `research`, `review`, `warn`, `phase`, `pdf`, `theme`, `done`, `stopped`,
  `error`.
- **`event: heartbeat`**, every 3 seconds, never persisted:

```ts
{
  phase, status, running,
  elapsedMs,
  sinceLastActivityMs,   // null when not running. The signal that separates
                         // "thinking" from "wedged".
  sectionsDone, sectionsTotal,
  deadlineRemainingMs,   // against the 9 minute deadline
  alive                  // false once the watchdog has warned
}
```

A `: ping` comment also goes out every 15 seconds. That one defeats proxy
buffering and is not an application signal.

## What a restart does not do

On a clean shutdown (a deploy sends SIGTERM) every live run is sent one last
`warn` on the stream saying the server is restarting and that its sections are
saved, before the process closes its listeners and its database. A hard kill
gets no such courtesy.

A session that was running when the process died comes back as `orphaned`. Its
SDK session was a subprocess and died with it; rebuilding the tool-side `Run`,
the inbox queue and the mid-conversation state on top of SDK session resumption
is not this week's work.

"Come back to a session in progress" means reattaching a browser to a run still
executing in the same process. It does not mean surviving a deploy. The UI
should say so rather than imply otherwise, and deploys belong outside demo
windows.

Sections written before the restart stay readable and exportable.
