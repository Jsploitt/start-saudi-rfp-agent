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

**The API key in the kit's `.env` is an organisation key**, and on the 0.1.x SDK the API
rejected it with a raw 400 unless `ANTHROPIC_WORKSPACE_ID` travelled as a header.

**Corrected in Phase 4: this is not an outstanding problem.** On 0.3.277 the same key works
untouched — tested directly, with and without it. The 400 was bound to the old SDK line, not
to the key, and I had reported it as a hard stop to settle before the demo. It is not one.
The handling and the error message stay in, because they cost nothing and the failure is
unrecognisable without them, but nobody needs to chase a workspace ID.

The general lesson is the one worth keeping: **two unrelated-looking failures, both
introduced by the same wrong dependency range.** Fixing the range fixed both, and I only
noticed the second had gone by testing it again rather than assuming.

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

---

## Phase 4 — the safety net

**Two of the eleven demo beats had never been able to run, and nothing said so.** Beats 9,
10 and 11 all happen *after* the document is assembled — and `runAgent` closed the session
the moment the agent finished. Every phase gate passed, the typecheck passed, the cached
replay passed, and the closer was structurally impossible. It took writing the rehearsal
script to find it, because every check until then had stopped at "the document is complete".
The fix was small (`stayOpen`, and clearing the deadline once a finished document exists);
the lesson is that **a gate that ends where the demo's midpoint is will never test its
second half.**

**A shell-escaping mistake silently broke a CSS rule, and the same mistake broke two more
scripts.** Patching files with `node -e "…"` through the Bash tool mangled `content:""` into
`content:;`, which is invalid, so the pseudo-element never generated and the fade on
clamped chat messages never rendered. Two later heredocs lost backslashes the same way. None
of it failed loudly: invalid CSS declarations are dropped silently, and the JS selector error
only surfaced because Playwright happened to throw. **Anything with quotes or backslashes now
goes through the Write tool, not a shell string.** The time lost to escaping exceeded the
time saved by not opening an editor, several times over.

**The last-resort fallback did not work, and it is the one nobody tests.**
`fixtures/golden-proposal.html` was a copy of a run's `proposal.html`, which references
`/assets/...` because it is served from `/runs/...`. Opened by double-clicking it — exactly
what the run book said to do when everything else has failed — every image and font 404s. It
now renders with `../public/` and is verified from a real `file://` load: 18 pages, fonts
resolved, zero failed requests. A fallback that has never been exercised in the mode it
exists for is not a fallback.

**The agent refused the closer, and it was right to.** Asked to change the timeline to four
months, it answered: *"this instruction conflicts with what the client actually told us, and
I want to flag that rather than quietly comply"* — the client had said the January listing
date was binding. Correct by the system prompt's own standards, and fatal to the demo, which
needs the change to land. The fix is not to make it more obedient: it now flags the conflict
**and acts**, stating the assumption and marking in the document what is at risk. The
prompt's new line is the point — *"a flagged change that was not made is just a document
that did not get updated."*

Worth keeping as a beat either way. A system that pauses to say "this contradicts what you
told me" is more convincing than one that complies, and the recovery is one sentence.

**The targeted edit does what the architecture promised.** After confirmation, the timeline
change recomposed **two sections out of twenty-three** — Time frame, and the Arabic summary,
which carries the 7 December date. It left the fee section alone, correctly: a four-month
plan changes no figure on a page whose figures are all `[TO CONFIRM]`. Watching twenty-one
outline rows stay still is the whole argument for typed blocks over generated documents.

**One correction to something I reported as a blocker.** I told the user the organisation
API key was a hard stop needing a workspace id before the demo. On the current SDK it works
untouched — tested with the key and without it. The 400 belonged to the 0.1.x line, the same
wrong dependency range that caused the `tool_use ids must be unique` failure. One bad version
range produced two unrelated-looking blockers, and I only noticed the second had gone because
I retested it instead of assuming.

### Phase 4, after the retest

**The flag-and-act prompt change worked, and produced a better answer than compliance would
have.** Given the same conflicting instruction that it refused the first time, the agent now
says what it is doing and does it: *"target date is 19 September 2026 + 4 months =
mid-January 2027, with 1 March 2027 kept visible as the client's own stated deadline and the
gap between the two named rather than silently absorbed."* That is the brand's move — state
the change, name the boundary, do not smooth it over — and no part of it was scripted.

**Propagation turns out to be content-aware, not id-based, and that is the stronger
result.** On the first rehearsal the timeline change updated the Arabic summary as well,
because that summary carried a *derived* date (7 December 2026, documents-complete) which had
moved. On the retest it left the Arabic summary alone — because that one carried only the
client's own target date (1 مارس 2027), which had not moved. Two different answers, both
correct, from reading what each section actually contains. A rule that recomposed "every
section mentioning a date" would have been wrong once out of twice.

**Arabic can break the tool call once.** The compose call for the `rtl_section` failed with
malformed JSON — the agent's own diagnosis was *"the Arabic text likely broke escaping"* —
and it retried successfully on its own. Self-recovering, but it costs a minute, and beat 9
therefore takes two to three minutes rather than the thirty seconds a section normally takes.
Worth knowing before standing in front of it, so the pause reads as the agent working rather
than as a hang.

**The section count varies run to run: 15, 17, 18.** The outline is written after the gaps
are known, so a run that surfaces different gaps plans a different document. That is the
system working as designed, but it means no fixed number belongs in the run book, and any
check that asserts one will be flaky.

---

## Session E — integration

Three branches, built in parallel: a multi-session backend, a React operator UI, and a
redesigned deck. All three merged into one branch with **zero file conflicts** — the three
sessions had touched disjoint sets of files almost perfectly. Not one of them worked with
the others.

**Zero merge conflicts told us nothing about whether the pieces fit.** Git compares text.
Every real conflict here was semantic: the UI called `POST /api/run` where the server has
`POST /api/sessions`, subscribed to one global `/api/events` where the server streams per
session, expected the PDF export to return a URL where the server returns 202 and sends the
URL down the stream, sent `{themeId}` where the server takes `{preset, accent}`, and had a
`fixing` phase the server calls `revising` and a `printing` phase the server does not have.
A clean merge is the beginning of integration, not the end of it.

The fix was `src/contracts.ts`: one module, declaring the event union, the session shapes
and the heartbeat, imported by both halves. Every disagreement above is now a compile error.
It is worth having done this at the start; it is not worth having pretended it could be
skipped.

**`allowedTools` does not restrict tools, and the README said otherwise for weeks.** The
session was configured with `allowedTools: [the five]` plus a hand-written `disallowedTools`
list of built-ins, and documented as "five tools and no filesystem". `allowedTools` is an
auto-approve list — the SDK's own docs say *"To restrict which tools are available, use the
`tools` option instead"* — and the denylist could only name the tools that existed when it
was written. A `system`/`init` line showed the agent had also been given `CronCreate`,
`Monitor`, `Skill`, `ToolSearch` and `Workflow`, plus MCP servers inherited from the
developer's plugin environment, because `settingSources` was omitted and omitting it loads
`~/.claude/settings.json` and every plugin it enables.

Three lines close it: `tools: []`, `settingSources: []`, and an `ENV_ALLOWLIST` in place of
`{ ...process.env }`. The check is one line of output — a session's init now reads
`tools: []` and `mcp servers: []` — and **that line should have been read on day one.** It
was always there. Nobody looked at it, because the config *said* what we wanted and config
that looks right is the easiest kind of wrong to keep.

**The oversized PDF was not an oversized PDF.** A 2.65 MB file in `uploads/` killed every
run it was given to, and the obvious diagnosis — too much text for the context window — was
wrong. That PDF extracts to 19,609 characters; it is large because of images. The actual
cause: multer saves an upload under a random name with **no extension**, `extract()`
switched on `extname(path)`, got `''`, and fell through to `readFile(path, 'utf8')`. A PDF
read as UTF-8 became 2.5 million characters of binary — roughly 630,000 tokens — in the
first turn. The run died before the analysis, and it looked like a hang.

`extract()` now sniffs the first four bytes: `%PDF`, or the zip header a `.docx` is. Trust
the bytes, not the filename. The same run then completed in 279 seconds with 15 sections.
**The measurement that mattered took two minutes and would have saved the wrong fix.**

**The parachute had a five-minute fuse.** `DEMO_MODE=cached` is the fallback for a live
demo, and `replayCachedRun` never called `run.touch()`. So `lastActivityAt` stayed at
construction: at ninety seconds the watchdog set `alive: false` and the UI said *"the agent
is not responding"* over a document that was visibly still filling, and at five minutes the
watchdog stopped the run with an error. The one path that must never fail was the one path
nobody had watched all the way through, because watching it takes nine minutes and it
"obviously works". One line.

The watchdog had a second version of the same mistake: a run in `waiting` is idle *because
it asked the operator a question*, and it was being killed after five minutes of someone
thinking. In a demo where the question is the thing being shown off, that is most runs.

**The container shipped no interface, and passed its health check.** The Dockerfile copied
`src`, `public`, `fixtures` and the kit, and never built `web/`. `existsSync(webDist)` is
false, so express serves the API and nothing else — and `/healthz` returns `{ok: true}`
throughout. A health check that only proves the process is alive will certify an app with
no front end. The image now builds the UI in its own stage.

**A regex in `app.use` rewrites the URL.** The dev proxy was mounted as
`app.use(NOT_OURS, proxy)` where `NOT_OURS` matches the whole path. Express strips the
matched portion from `req.url` — so every request reached Vite as `/`, the app's own HTML
came back for `/src/main.tsx`, and the page rendered as a blank white screen with three
aborted requests and no error anywhere. `pathFilter` selects without rewriting.

**The wire contract has to import nothing.** `contracts.ts` first re-exported its types
*from* `events.ts` and `sessions/types.ts`. That compiles on a laptop, where the root
`node_modules` is one directory up, and fails in the container's web build stage, where it
is not: `node:events` has no types there. The dependency now runs the other way — the
contract declares, the server re-exports — so the browser can typecheck it alone. **A shared
module that pulls in a runtime is not shared.**

**`tsc -b --noEmit false` scattered 29 `.js` files through `web/src`.** That was the web
`typecheck` script, and its output sat next to every `.tsx` source shadowing it on the next
resolution. Nothing failed; things merely stopped changing when edited. The script is now
`tsc -b --force` and the emitted shapes are gitignored.

**Express's default error page prints absolute paths.** Malformed JSON answered with an
HTML stack trace naming every file in the call chain. It would have printed the container's
layout in production, to anyone who could post a broken body. Every error is now `{error,
code}` and nothing else.

**`npm run shots` had been broken by a feature in another branch.** Once `/runs/*` went
behind the session cookie, Chromium arrives without one and screenshots the login page —
forty-seven times, silently, exit code 0. It now starts the same loopback static listener
the PDF export uses, and it fails loudly on a non-OK response. A tool that cannot fail is
not a check.

**The fees slide refused to state a price.** Unprompted, against an RFP that contained a
priced prior proposal, the agent marked both figures `[TO CONFIRM: … set by Trellis Work's
CEO, not carried over from the document you supplied]`. The house rule reached the output
without anyone checking that it would, which is the first thing in this log that worked
better than expected.
