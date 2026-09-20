# Operator UI

The screen an operator drives a proposal run from. Vite + React 18 +
TypeScript + Tailwind, with shadcn-style primitives in `src/components/ui`.

It replaces `public/index.html` + `app.js` + `app.css`, which are archived under
`public/_archive/2026-09-20_legacy-ui/` with a note on what carried over.

## Running it

```bash
npm install --prefix web
```

```bash
npm run dev --prefix web
```

Vite serves on **5174** and proxies `/api`, `/runs`, `/brand`, `/assets`,
`/tokens.css` and `/healthz` to express on **5173**. SSE survives the proxy:
the server already sends `X-Accel-Buffering: no` and `Cache-Control: no-transform`,
and http-proxy streams the body rather than buffering it.

Development runs against a **mock backend** by default, because the server is
being rebuilt in parallel. To go through the proxy to the real express server:

```bash
VITE_MOCK=0 npm run dev --prefix web
```

Passcode in mock mode: `start-saudi`.

### Mock mode

- **HTTP** is MSW (`src/mocks/handlers.ts`). Those handlers are the statement of
  what this app expects the rebuilt backend to provide — auth, sessions, theme,
  run control — in one file, so the two can be reconciled cheaply.
- **The event stream** is a replay of `fixtures/cached-run.json`
  (`src/mocks/replay.ts`). EventSource is not something a service worker can
  usefully stand in front of, so the replayer feeds the same sink instead.

The fixture is a real nine-minute recording and is the best test data in the
project, because it carries the two silences the progress design exists for: a
43-second gap between the brief and the first section, and a 97-second gap
before the reviewer reports. The replay preserves them proportionally.

It predates `phase`, `session` and `heartbeat`, so the replayer synthesises
those. Phase boundaries are placed at the *start* of a silence rather than at
the event that ends it — otherwise the UI would announce each quiet phase only
once it was already over, which is the failure being fixed.

Query parameters, development only:

| Parameter | Effect |
|---|---|
| `?speed=N` | Replay N× faster than the recording. Default 4. `?speed=1` is real time. |
| `?stall=N` | Cut the stream at N seconds of recording time, then let the heartbeat go stale and finally report `alive: false`. For looking at the quiet and not-responding states without waiting for one. |

A production build is never mocked. Both mock entry points are behind
`!import.meta.env.PROD`, which is replaced with a literal at build time, so MSW,
the handlers and the fixture are eliminated rather than shipped as unreachable
chunks.

## Two configuration rules

### `build.assetsDir: 'app'`

Not the default `'assets'`. The built app is served from the same root as
`../public`, and `../public/assets` holds the brand fonts and logos that the
generated proposal references by absolute path (`/assets/fonts/plex-latin-400.woff2`,
`/assets/logo-horizontal-light.png`, …). If Vite also emitted its bundle into
`/assets` the two would collide on deploy and the proposal would lose its
typefaces and its lockup — in production only, where nobody is watching the
console.

`vite build` emits to `web/dist/`. Deploying means serving `dist/` at the same
root as `public/`; `dist/app/` and `public/assets/` then never meet.

### The dev proxy

Listed above. `/assets` is the one that matters, for the same reason.

## Colour

`tailwind.config.ts` maps the custom properties from
`start-saudi-kit/brand/tokens.css` by reference. It copies no values. **A hex
literal anywhere under `web/` is a bug** — if you reach for one, the token you
want is missing from `tokens.css`, and that is where it belongs.

The cost of the indirection is that Tailwind's slash-opacity syntax
(`bg-navy/50`) cannot work against a `var()` colour. Use `color-mix(in srgb, …)`;
`src/index.css` defines the few tints the UI needs.

### The light surface

The old UI forced `[data-surface="dark"]` onto `<body>`, so the brand's navy
register was the entire application. It is now an accent, and the register of
the document's own dark slides. The operator UI is light.

`--ss-green` (#27EAA6 in the token file) is **1.57:1 on white** and must never
carry text on a light background. The idiom that prevents it is `bg-accent
text-surface`: `--ss-accent` is `--ss-green-deep` on light and `--ss-green` on
navy, and `--ss-bg` is white on light and navy on dark, so a control is always
the page's own background colour on the register's own accent — 9.8:1 or
11.2:1, never 1.57:1, and the component needs no knowledge of which surface it
landed on.

Body copy is `--ss-ink` (~17:1 on white). Secondary is `--ss-ink-muted` (5.73:1).
Contrast was lowered on surfaces, not on text.

## The progress indicator

`src/components/AgentStatus.tsx`, and the rule it is built around:

> Never show a progress bar that advances on a timer. It must always be
> reporting something true.

Every number it shows is either something the agent reported in a `heartbeat`,
or that same number aged by the wall clock since it arrived — and where a value
ages, the component says how stale it is rather than pretending it is current
(`STALE_AFTER_MS`). The two indicators that fill — the phase rail and the
section cells — are discrete and move only when a `phase` or `section:done`
event says they may.

It reports: current phase, time in phase, time since the last activity,
sections written of total, and the deadline remaining. When a phase is
legitimately quiet it says so and names the budget ("researching runs silent for
up to 90s"), rather than leaving the operator to guess. When `alive` goes false
it says the run is not responding, and the status pill in the header says the
same thing rather than continuing to read "Working…".

`src/lib/phases.ts` holds the per-phase quiet budgets. They are used only to
decide when a silence is worth remarking on. They never advance anything.

## Notes and open items

- **`e.index` is not a section counter.** During the fixing pass the agent
  re-emits `section:done` with an index relative to that pass, so taking it
  verbatim — as the old UI did — sends the counter from "17 of 17" back to "1 of
  17". `runReducer.ts` counts distinct sections marked done instead. The event's
  own index and total are still shown verbatim in the log row.
- **`--ss-danger` is a placeholder.** `tokens.css` flags it as having no source
  in the identity, and white on it is 3.55:1, under AA for a 14px label. The
  destructive button therefore carries the red on its edge and keeps ink text.
  [NEEDS: a status red from the brand guidelines, owner: brand]
- **A custom theme colour picker is a stretch goal, not a commitment.** It would
  need a contrast check against the document's own body copy before it could
  ship; picking an arbitrary colour is exactly how `--ss-green` ends up carrying
  text on white. The three fixed presets are in `src/components/ThemePresets.tsx`
  and name tokens rather than values.
- Types come from `../src/contracts.ts` and are re-exported through
  `src/types.ts`. Nothing here redeclares a wire type; if the backend changes an
  event shape, this app stops compiling, which is the point.
- `.claude/launch.json` at the repo root gained an `operator-ui` entry on 5174.
  The existing `start-saudi-demo` entry is unchanged.
