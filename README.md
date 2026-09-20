# Start Saudi — RFP and proposal agent

A three-day demo of an agentic RFP-and-proposal system. A prospective client sends an RFP;
the system reads it, notices what the RFP does not say, asks about the gaps, researches the
client, and assembles a complete branded 16:9 proposal deck that a human finishes.

**This is a demo, not a product.** It is optimised for the output looking right, the agent's
work being visible, and nothing failing in the room.

---

## Run it

Two processes: the express server, and Vite for the operator UI.

```bash
npm install                  # the server
npm --prefix web install     # the operator UI

cp .env.example .env         # then set ACCESS_PASSCODE and SESSION_SECRET

npm --prefix web run dev     # Vite, on 5174
npm run dev                  # express, on 5173
```

Then open **http://localhost:5173** — not 5174. With `VITE_DEV_URL=http://localhost:5174`
set (it is in `.env.example`), express hands everything that is not an API route or an
artifact to Vite, websockets included. The whole app is therefore on one origin in
development exactly as it is in production, which is what keeps the session cookie working
and HMR alive at the same time.

To run it the way the container does, build the UI first and leave `VITE_DEV_URL` unset:

```bash
npm run build                # web/dist
npm run dev                  # express serves web/dist directly
```

### Signing in

The UI is behind a shared passcode. Set `ACCESS_PASSCODE` in `.env`; leave it unset and one
is generated and printed at boot, and it changes on every restart.

Signing in sets `ss_session`, an HttpOnly cookie signed with `SESSION_SECRET`. It is
stateless, so a restart does not sign anyone out — but if `SESSION_SECRET` is unset a
per-process key is used and every restart does. Set both before hosting.

A cookie rather than a bearer token for one specific reason: `EventSource` cannot set an
`Authorization` header, and the run stream is an `EventSource`.

### The API key

The key in `.env` works as it is — verified against this SDK version, with the key and
without it. `.env` is gitignored, so a fresh clone has none; copy `.env.example` to `.env`
and paste the key in, or set nothing at all and the signed-in Claude Code session is used
instead, which also works.

One failure is worth recognising because it looks alarming and is not: a 400 saying the key
*"is not scoped to a workspace"*. That came from the **0.1.x** line of the Agent SDK, which
this project no longer uses (see `NOTES.md`). If you ever see it — a downgrade, a different
machine, a stale `node_modules` — the fix is one line:

```bash
ANTHROPIC_WORKSPACE_ID=wrkspc_...   # alongside the existing key
```

The error message in the UI says this itself. You do not need to pre-empt it.

### The other commands

```bash
npm run build                # build the operator UI into web/dist
npm run demo                 # unattended CLI run against the sample RFP, ~4 minutes
npm run smoke                # two sessions at once against a running server, asserts isolation
npm run rehearse             # drive the whole demo script in a browser, beats 1-10
npm run record               # re-record fixtures/ from a live run
npm run golden               # rebuild fixtures/golden-proposal.html from the cached run
npm run shots -- <url> <dir> # screenshot every page of a rendered deck at 1920x1080
npm run worked-example       # render proposal/worked-example.md through the block pipeline
npm run typecheck
```

**`npm run rehearse` is the one to run before the demo.** It starts a run, answers the gap
questions, waits for the document, then asks for the Arabic summary and the timeline change,
and prints how many sections each one recomposed. It takes about twelve minutes and it is
the only way to know beats 9 and 10 still work. The server must already be running.

---

## The demo script

Eight to ten minutes. Timings are from a real run.

| # | Beat | What you do | What they see |
|---|---|---|---|
| 1 | **Upload** | Drag `start-saudi-kit/proposal/sample-rfp.md` onto the left panel, or click *Use the sample RFP* | The drop zone gives way to the conversation |
| 2 | **It reads the RFP** | Nothing | The centre panel fills: requirements, dates, evaluation criteria. ~30s |
| 3 | **It notices what the RFP doesn't say** | **Stop here.** This is the beat. | Six or seven gaps, each with its consequence. The one to read aloud is the activity classification: services means no statutory minimum capital and a benchmark around SAR 500,000; retail or wholesale trading at 100% foreign ownership is cited at SAR 30,000,000. Nobody asked the question and it is sixty times the number |
| 4 | **You answer** | Type into the box. Anything reasonable; there is a scripted answer in `src/dev/record.ts` you can paste | Your answer appears; the agent adjusts |
| 5 | **The researcher runs** | Nothing | "Asking the researcher about the client", then two to five specifics, each labelled with its basis |
| 6 | **The outline appears** | Nothing | 15–18 sections with a one-line intent each, before any content exists |
| 7 | **Sections draft, one at a time** | Let it run, or page through the deck as it fills | The payoff. ~5s a section, each landing in the preview. ~90s total |
| 8 | **The reviewer checks it, and the agent fixes** | **Second-best beat.** Say what is happening. | "The reviewer found 5 or 6 things", with severities and a blunt verdict — then the agent recomposes the named sections. On the recorded run it caught two *blocking* misses: the RFP asked about employing engineers locally and invoicing in riyals, and neither was addressed |
| 9 | **Arabic** | Ask for the executive summary in Arabic. Allow two to three minutes — it sources the summary first, and the Arabic text sometimes breaks the tool call once and is retried automatically | An `rtl_section`, correctly typeset, with Latin company names and numerals inline |
| 10 | **Change the timeline** | Ask in the chat: *"Change the timeline to four months rather than working back from 1 March. Update whatever that affects."* | It recomposes **only the sections that carry the date** — on the rehearsals, 1-2 sections out of 15-23 — and says which and why. **This is why the block architecture exists.** Watch the outline: the ones it touches light up and the rest do not move |
| 11 | **Full screen, then the PDF** | *Full screen*, then `E` for edit mode, then *PDF* | A 1920×1080 deck; every heading, paragraph, list item and table cell editable in place; an 18-page PDF |

### If it pushes back on beat 10

It may. The four-month instruction contradicts what the client said earlier in the
conversation — that the January listing date is the binding one — and the agent is built to
name a conflict rather than comply silently. On the first rehearsal it flagged the conflict
and stopped.

**That is a good beat, not a failure.** Read its objection aloud; it is the system refusing
to quietly produce a document it knows is wrong. Then say:

> *Understood. Go ahead anyway, and say in the document that this is at our instruction and
> that the January date is now at risk.*

The prompt now tells it to flag *and* act. On the retest it did exactly that, first time, and
its reconciliation was better than a scripted one would have been — it worked four months
from today, landed on mid-January 2027, kept 1 March visible as the client's own deadline and
named the gap between them. If it ever does stop and ask, the line above is the answer, and
the pause is worth more than it costs.

**One thing not to promise in advance:** which *other* sections it will touch. It updates
what actually carries the changed date, and that differs by run — on one rehearsal the Arabic
summary moved too, because it carried a derived date; on another it correctly did not,
because it carried only the client's unchanged target date. Say "watch which ones it picks",
not "it will update three".

### Inside the preview

`←` `→` navigate · `Home` `End` · number keys step through a numbered list ·
**`E` edit mode** · `F` full screen · `P` print.

`E` is worth five seconds of the demo. It is the answer to "can we edit the output?" and it
lands better than any explanation.

---

## When something goes wrong

**Take the fallback early.** A recovered demo is better than a heroic one.

| Symptom | Do this |
|---|---|
| **400 about the API key** | Only happens on an old SDK. Add `ANTHROPIC_WORKSPACE_ID` to `.env`, or clear `ANTHROPIC_API_KEY` to use the signed-in session. The message says so too |
| **It hangs before the outline** | Give it 60s. Then reload the page — the UI reattaches to the run in progress and replays everything it missed |
| **It hangs mid-document** | A 9-minute deadline runs until a finished document exists; when it fires, any section not reached is filled from the reference proposal and the document still completes. It is cleared once the document is done, so the later beats are never cut off. Say so — it is a real answer to "what happens when it fails" |
| **A section looks wrong** | Press `E` and fix it in front of them. That is the point of edit mode |
| **Anything worse** | Restart the server with `DEMO_MODE=cached` and run it again. It replays a recorded run through the same UI with the same timings and no network at all. It is identical to watch |
| **Worse than that** | Double-click `fixtures/golden-proposal.html`. A finished 18-page deck, with its own fonts and images, off the filesystem — no server, no network, no kit. Arrow keys and `E` still work. Verified from `file://`, not assumed |

**The reviewer takes about 100 seconds** and the log is quiet while it thinks. That is a
feature of what it is doing, not a stall — the document is complete at that point, so page
through the deck while you wait and talk about the sections.

---

## How it works

**The model never writes HTML, CSS or code, and never emits a document.** It selects typed
blocks from a fixed vocabulary of twelve and supplies their content as JSON. Deterministic
TypeScript renders them. That is the whole design, and it buys three things: consistency
across runs, a targeted edit that does not regenerate the document, and a system whose
output cannot be malformed.

### Five tools, and no others

| Tool | What it does |
|---|---|
| `read_rfp` | Parses PDF/DOCX/MD, then takes a validated `RfpAnalysis` back. Two calls on purpose — see below |
| `search_library` | Keyword and fuzzy search over `start-saudi-kit/content/`, loaded into memory at boot |
| `write_brief` | The working brief and the section outline, pushed to the UI |
| `compose_proposal` | One section of typed blocks, validated and rendered |
| `render_preview` | Writes the assembled document and refreshes the preview |

Every built-in tool is switched off. The agent has five tools and no filesystem.

That sentence was not true for most of this project's life, and the way it was false is
worth writing down, because the mistake is an easy one and it is invisible.

The session was configured with `allowedTools: [the five]` and a hand-written
`disallowedTools` list of built-ins. Both look like they restrict the toolbox. Only one of
them does anything of the kind, and it is neither:

- **`allowedTools` is an auto-approve list, not an allowlist.** It says which tools run
  without a permission prompt. It does not remove anything. The SDK's own documentation
  says so in one line: *"To restrict which tools are available, use the `tools` option
  instead."*
- **`disallowedTools` removes exactly what it names**, and it named the built-ins that
  existed on the day it was written: Bash, Read, Write, Edit, Glob, Grep, WebFetch,
  WebSearch, TodoWrite, Task and a few more.

Everything the harness has gained since was in neither list, so it arrived by default. A
`system`/`init` line from a real session showed the agent had also been handed `CronCreate`,
`Monitor`, `Skill`, `ToolSearch` and `Workflow` — plus a set of MCP servers inherited from
the developer's own plugin environment, because `settingSources` was omitted and omitting it
loads `~/.claude/settings.json`, the project settings and every plugin they enable.

So an agent documented as having five tools and no filesystem could, in principle, schedule
a cron job, and could reach whatever the developer happened to have connected that week. It
never did. It had no reason to and the system prompt gave it none. That is luck, not design,
and it would not have survived a laptop with different plugins installed.

Three changes make the sentence true:

```ts
tools: [],            // the restriction. Every built-in, including next month's
settingSources: [],   // no user settings, no project settings, no plugins, no inherited MCP
env: sessionEnv(),    // an allowlist of variable names, not a spread of process.env
```

`sessionEnv()` is the third, and it matters as much as the other two. It used to be
`{ ...process.env }`, which handed the subprocess `CLAUDE_CONFIG_DIR`, `CLAUDECODE` and the
rest of the developer's Claude Code environment. It now copies a named list — the Anthropic
variables, this app's two switches, and enough of an operating system to spawn Node — so the
agent's environment is the same on a laptop as it is in the container.

The check is one line of output. A session's `init` message now reads:

```
init tools      : []
init mcp servers: []
```

The five tools are the MCP server this app builds, and `allowedTools` still names them so
they run without prompting. It is a convenience now, not the fence.

**`read_rfp` is deliberately two calls.** Deterministic extraction, then the model's
analysis, then deterministic validation. That is what lets the system *reject* an empty
`gaps` array rather than hope for a full one.

**`compose_proposal` refuses to render** a section containing a banned word from
`content/voice.md` §3, an exclamation mark, or American spelling, and names the term.
`voice.md` is explicit that this failure is invisible and produces fluent, professional
prose — so it fails loudly instead.

### Two subagents

Both run as their own sessions rather than through the Task tool, so they can overlap the
main loop and so a failure in one is a single `await` to give up on.

- **researcher** — starts the moment the RFP is understood. May not state a fact about the
  client it cannot attribute; every finding carries its basis and a confidence flag. No web
  access unless `ALLOW_WEB=1`, because the demo must run with no network.
- **reviewer** — reads the assembled proposal against the original analysis and returns
  unaddressed requirements with severities. The main agent then fixes them in public.

### Layout

```
start-saudi-kit/   INPUT — a junction to ../start-saudi-kit. Do not modify
src/
  server.ts        Express + SSE + static + the React build
  contracts.ts     THE WIRE CONTRACT. Imported by both halves; see below
  agent.ts         the SDK session, the subagent choreography, the fallback
  prompt.ts        buildSystemPrompt() — assembled from the kit at boot
  events.ts        typed event bus -> SSE
  cached.ts        DEMO_MODE=cached replay
  library.ts       content/ in memory
  run.ts           run state: sections, brief, analysis, transcript
  auth/            passcode, the signed cookie, the same-origin check
  db/              SQLite: migrations, the store. One file under DATA_DIR
  sessions/        the registry, rehydration, concurrency, the watchdog
  tools/           the five
  subagents/       researcher, reviewer
  render/          blocks.ts (zod), renderer.ts, template.ts
  export/pdf.ts
web/               the operator UI: React, Vite, Tailwind
  src/api/         client.ts and stream.ts — every call, in two files
  src/state/       the reducer and the per-session provider
  src/screens/     dashboard, intake, RFP, run
  src/_archive/    the MSW mock layer the UI was built against, kept
  dist/            the build. Served by express in production
public/            brand assets, and the tokens the document references
runs/              generated proposals and transcripts, gitignored
fixtures/          golden-proposal.html, cached-run.json
```

**`src/contracts.ts` is the seam.** The React app imports it as `@contracts`, so the event
union, the session shapes and the heartbeat are declared once, on the server's side, and the
browser re-exports them rather than restating them. A UI that redeclares a wire type is a UI
that compiles happily while rendering a field the server stopped sending; this one stops
compiling instead.

That is not a hypothetical. The two halves were built in parallel against a guessed API, and
bringing them together turned up the expected crop of disagreements: the UI had a `fixing`
phase the server calls `revising` and a `printing` phase the server does not have, expected
one global `/api/run` where the server is keyed by session, and expected the PDF export to
return a URL where the server returns 202 and sends the URL down the stream. Every one of
those is now a compile error if it comes back.

---

## Hosting

See **`DEPLOY.md`**. In short: a Dockerfile, a Railway volume mounted at `/data`, and four
secrets. `DATA_DIR=/data` is what puts the database, the generated documents and the uploads
on the volume rather than in a container layer that a deploy throws away.

The image builds the operator UI in its own stage and copies `web/dist` forward. Without
that stage the container serves a working API behind no interface at all — and it passes its
health check while doing it, which is the worst way for this to fail.

`start-saudi-kit/` is a Windows directory junction to the kit beside this folder. On another
machine, replace it with the kit itself or re-create the junction:
`cmd /c mklink /J start-saudi-kit ..\start-saudi-kit`.

---

## Also worth reading

- **`NOTES.md`** — things worth noticing, kept while building. Where the kit's own warnings
  turned out to be load-bearing, where the tooling fought back, and which decisions were
  judgement calls.
- **`OPEN-QUESTIONS-BUILD.md`** — what the build found missing or contradictory in the kit,
  and the interpretation taken. The kit is input and is not modified, so this is kept
  separately from its own `OPEN-QUESTIONS.md`.
