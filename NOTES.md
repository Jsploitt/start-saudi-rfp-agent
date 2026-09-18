# Things worth noticing

A running log kept while building. Not a changelog — the git history is that. This is
the set of observations that would be lost otherwise: where the kit's own warnings turned
out to be load-bearing, where the tooling fought back, and which decisions were judgement
calls rather than consequences.

Newest section last.

---

## Phase 1 — the artifact

**The kit's warnings are not hedging. Every one of them fired.**

`brand/logo-usage.md` says the web-ready filenames are wrong and the assets are padded into
1080² boxes. Both true, and both bite immediately: `height: 34px` on `mark-color.png`
renders the artwork at about 9px, and the files called `logo-horizontal-*` contain no
wordmark at all. The deck crops to the measured content box instead of using `<img>`. A
build that trusted the filenames would have shipped the wrong asset at the wrong size and
nobody would have noticed until the room.

**`-light` means light *ink*, for dark backgrounds.** The opposite of what most build
systems assume, and exactly the mistake the kit predicted. It is one boolean away from a
navy logo on a navy cover.

**Shrink-to-fit had to be a binary search, not a formula.** The obvious approach — scale
down by `available / needed` — leaves a margin on the right, because the content keeps its
original measure. Widening the box in step with the scale fixes that, but the two are
coupled: widening reflows the text shorter, which changes the scale you needed. Fixed-point
iteration oscillates. Bisection on the scale converges in eight passes and is dull, which
is the point. The payoff is that **a section never has to guess its own length** — which
later turned out to matter more for the agent than for the layout, because it means a model
cannot produce an overflowing slide.

**Self-hosting the fonts was not optional.** `DEMO_MODE=cached` promises a run with no
network. Google Fonts would have quietly broken that, and the failure mode — Montserrat
silently replaced by Segoe UI — is one nobody notices on a laptop and everybody notices on
a projector. Both the Arabic *and* Latin subsets of IBM Plex Sans Arabic are hosted, so the
Latin company name inside an Arabic paragraph sets in a matched face rather than falling
through to the system.

**The one colour with no source is the most visible one.** `--ss-caution` is marked DERIVED
in `tokens.css` — "nothing in the identity defines an amber" — and it is what the
`[TO CONFIRM]` highlight uses. It is the first non-brand colour a reviewer's eye lands on
and it is the one value in the palette nobody has approved.

---

## Phase 2 — the pipeline

**The SDK version range was the single biggest time sink, and it looked like my bug.**

`"@anthropic-ai/claude-agent-sdk": "^0.1.10"` resolves to the 0.1.x line. There, streaming
input plus in-process MCP tools returns a 400 — ``tool_use ids must be unique`` — on the
turn *after* the first tool result. The tool itself runs correctly, which is what makes it
convincing as an application bug: the transcript shows one clean `tool_use`, one clean
`tool_result`, and then a 400 pointing at a content index that does not exist in any
message you can see.

Two things shortened this. Reproducing it in thirty lines with a toy `echo` tool, which
proved it was not the application. And noticing, in the v2-session variant of the probe,
that the model had called **`Bash`** — a tool that was not in `allowedTools` and should not
have been offered. That was the tell that the problem was below the application layer.

Moving to `0.3.277` fixed it and required **zod 4**. Worth stating plainly: the published
range in the brief points at a line of the SDK that cannot run this architecture.

**The API key in the kit's `.env` is an organisation key.** The API rejects it unless
`ANTHROPIC_WORKSPACE_ID` travels as a header. This is a hard stop with a raw 400, so it now
explains itself. It needs settling before the room, not during it.

**Splitting `read_rfp` into two calls is what makes the gap-finding enforceable.**
Deterministic extraction → the model's analysis → deterministic validation. An empty `gaps`
array can be *rejected* rather than hoped against. The first call's result also carries the
instruction to re-read the document asking only "what does it not say?", so the gaps are a
separate pass rather than one more field to fill in while doing something else. On the run
that counted, it found all four deliberate ambiguities plus two the answer key lists only as
"tells".

**Failing a section on a banned word works better than asking nicely.** `voice.md` §3a is
explicit that the drift toward the parent company's register is invisible and produces
fluent, professional prose. `compose_proposal` therefore refuses to render at all on a
banned word, an exclamation mark or American spelling, and names the term. It fired once on
the run and the agent recomposed without being told twice.

**The agent added a section the kit does not list.** "Before we set the plan" — the six
gaps as a two-column table, question beside consequence. Nothing in `structure.md` or
`section-briefs.md` describes it. It is the best page in the generated deck, and it exists
because the gaps were in the brief as `openItems` and the outline was written after they
were found rather than before.

**It also caught the thing the answer key files under "what else a good proposal
notices"** — that a subsidiary-vs-branch recommendation is a decision for two directors,
and Katherine's instruction to route correspondence to her alone does not obviously cover
it. That was not prompted for anywhere.

**Sources are the weak point, and the agent argued with the nudge.** `compose_proposal`
reports how many blocks carry no `sources`. Several times the agent explained, correctly,
that an opening `statement` restating the client's own brief makes no claim about Start
Saudi and is right to be bare. That is the correct reading. But it means the count is not a
metric — it is a prompt for a judgement, and a reviewer watching the log will see the agent
appearing to talk its way out of a warning. Worth framing that way in the room rather than
letting it look like non-compliance.

---

## Phase 3 — the demo

**The same flex-shrink trap bit twice, in unrelated code.** In Phase 1 the fitbox refused to
widen because a flex item shrinks back to its container by default. In Phase 3 the chat
column collapsed every message to a bare label for the same reason: thirty-six messages in a
fixed-height flex column, each with `flex-shrink: 1`. Both times the DOM said the content was
there and the screen said it was not, and both times the fix was `flex: 0 0 auto`. Worth
remembering as a shape rather than as two bugs.

**Three of the UI problems were only findable by looking.** The flex collapse, the
researcher's findings arriving as a wall of prose that swallowed the middle column, and the
preview letterboxed inside a 4:3 frame. None of them are type errors, none would fail a test,
and all three would have been obvious on a projector. Driving the real UI with Playwright and
screenshotting it mid-run found all three in one pass.

**Running subagents as their own sessions rather than through the Task tool was the right
call, for demo reasons rather than architectural ones.** The researcher can start the moment
the RFP is understood and finish while the main agent is still searching the library; the
findings come back as typed JSON instead of prose the main agent has to re-read; and when one
runs long it is a single `await` to abandon rather than a stalled main loop. The trade is
that the subagents are choreographed in `agent.ts` rather than by the model, which is less
elegant and considerably more predictable.

**The reviewer earned its place, twice, and not on style.** On the run that was recorded it
found two *blocking* misses: the RFP asks for the ability to employ two or three engineers
locally and the ability to invoice in riyals, and the draft addressed neither. Those are
requirements, not register — the kind of thing that loses a competitive bid quietly. The
agent then recomposed six sections to fix them. Watching a system catch its own omission and
repair it is worth more than watching it write well.

**The reviewer is also the demo's one dead spot.** It takes roughly 100 seconds and the log
is silent while it reads. Trimming the digest from 2,600 to 1,400 characters a section
helped, but it is inherently a whole-document read. The honest answer is to use the time: the
deck is complete at that point, so page through it and talk. That is in the run book rather
than hidden.

**The voice gate fired on the recorded run, on "in a timely manner", in the Terms section.**
Which is exactly where it would happen — the one section where the model is handling supplied
legal boilerplate and its guard is down. The rejection is visible in the event log, and it is
a better demonstration of the guardrail than any explanation of it.

**The agent renamed a section mid-run and then fixed the contents page itself.** After a
reviewer finding it recomposed "A founder who was where you are" as "A note on Taajeel and
Start Saudi", which left the contents list stale — and it noticed, and recomposed the
contents. Nothing instructed it to. It is a good beat, but it also means outline titles and
section titles can drift apart, and only the agent is keeping them in sync.

**The cached replay had to rebuild the document, not just the log.** Replaying events alone
would have given a live-looking event stream over a dead preview. It re-renders each section
through the real renderer as its `section:done` event goes by, which means the fallback
exercises the same code path as the live run — and would catch a renderer regression rather
than hiding one.

**A live demo needs a way out of a wedged run, and I only found that by wedging one.** The
server refused a second run with a 409 while a previous replay was still going, and the UI
had no way to say "abandon it". `force: true` now does. The lesson is less about the flag
than about where it was found: the second time you run the demo, not the first.
