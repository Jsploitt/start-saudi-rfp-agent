# Start Saudi — RFP and proposal agent

A three-day demo of an agentic RFP-and-proposal system. A prospective client sends an RFP;
the system reads it, notices what the RFP does not say, asks about the gaps, researches the
client, and assembles a complete branded 16:9 proposal deck that a human finishes.

**This is a demo, not a product.** It is optimised for the output looking right, the agent's
work being visible, and nothing failing in the room.

---

## Run it

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

### Authentication

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
npm run demo                 # unattended CLI run against the sample RFP, ~4 minutes
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
| 6 | **The outline appears** | Nothing | 17–18 sections with a one-line intent each, before any content exists |
| 7 | **Sections draft, one at a time** | Let it run, or page through the deck as it fills | The payoff. ~5s a section, each landing in the preview. ~90s total |
| 8 | **The reviewer checks it, and the agent fixes** | **Second-best beat.** Say what is happening. | "The reviewer found 5 or 6 things", with severities and a blunt verdict — then the agent recomposes the named sections. On the recorded run it caught two *blocking* misses: the RFP asked about employing engineers locally and invoicing in riyals, and neither was addressed |
| 9 | **Arabic** | Ask for the executive summary in Arabic | An `rtl_section`, correctly typeset, with Latin company names and numerals inline |
| 10 | **Change the timeline** | Ask in the chat: *"Change the timeline to four months rather than working back from 1 March. Update whatever that affects."* | It recomposes **only the sections that carry the date** — on the rehearsal, 2 of 23 — and says which and why. **This is why the block architecture exists.** Watch the outline: the two it touches light up and the other twenty-one do not move |
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

It proceeds on the next turn. The prompt now tells it to flag *and* act rather than wait, so
it should make the change first time and mark the risk itself — but if it asks, the line
above is the answer, and the pause is worth more than it costs.

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
  server.ts        Express + SSE + static
  agent.ts         the SDK session, the subagent choreography, the fallback
  prompt.ts        buildSystemPrompt() — assembled from the kit at boot
  events.ts        typed event bus -> SSE
  cached.ts        DEMO_MODE=cached replay
  library.ts       content/ in memory
  run.ts           run state: sections, brief, analysis, transcript
  tools/           the five
  subagents/       researcher, reviewer
  render/          blocks.ts (zod), renderer.ts, template.ts
  export/pdf.ts
public/            the demo UI: plain HTML, CSS and JS, no build step
runs/              generated proposals and transcripts, gitignored
fixtures/          golden-proposal.html, cached-run.json
```

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
