# Versions — the mock layer

## 2026-09-20 — archived, superseded by the real API

The operator UI was built in parallel with the backend, against a mock layer:
MSW for the HTTP surface (`mocks/handlers.ts`) and a replay of
`fixtures/cached-run.json` for the event stream (`mocks/replay.ts`).

Both are now superseded. `web/src/api/client.ts` and `web/src/api/stream.ts`
talk to the express server, and `main.tsx` no longer starts a service worker.

Kept, not deleted, because `handlers.ts` is the written record of what this UI
expected the backend to provide, and the gap between that and what it does
provide is worth being able to read back. The differences, for the record:

| The mock assumed | The server does |
| --- | --- |
| `POST /api/run`, one global run | `POST /api/sessions`, keyed by session id |
| `/api/answer`, `/api/stop`, `/api/export` | `/api/sessions/:id/answer`, `…/stop`, `…/export` |
| `GET /api/events`, one stream | `GET /api/sessions/:id/events` |
| Intake creates an empty session, the RFP arrives later | One create, with the RFP, which also starts the run |
| `setTheme({themeId})` | `PATCH …/theme {preset, accent}` |
| Export returns `{url}` | Export returns 202; the URL arrives as a `pdf` event |
| `/healthz` names the running session | `/healthz` carries counts only, never an id |

`replay.ts` is not what drives `DEMO_MODE=cached`. That is the server's own
`src/cached.ts`, which replays the same fixture through the real stream, so the
fallback exercises the real code path rather than a second implementation of it.

Nothing here is imported by the app. It is excluded from the build via
`tsconfig.json` and stays on disk as a record.
