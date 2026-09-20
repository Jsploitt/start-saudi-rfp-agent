# Versions — fixtures

`cached-run.json` and `golden-proposal.html` are the demo's fallbacks, so a superseded one
is archived rather than overwritten: if a re-recording turns out worse than what it
replaced, the previous run has to be one `cp` away.

Both are produced together by `npm run record`, against `proposal/sample-rfp.md`. Record
them as a pair. A `cached-run.json` from one run and a `golden-proposal.html` from another
will show two different documents to anyone who compares them, which is exactly what the
fallback exists to avoid.

## v2 — 2026-09-20, current

Re-recorded after the deck redesign and the backend rebuild landed together.

Why, specifically: `replayCachedRun` re-renders each section through the *current*
renderer, so the archived v1 already picked up the new typography. What it could not pick
up was anything the agent decides at compose time — and the redesign moved density there,
so v1 replayed a document whose blocks had been chosen for the old, denser slides. v1 also
predates the `phase` and `session` events, so the phase rail stayed empty and the status
band never learned that a run had finished.

Recorded against the same RFP the demo uses, so the fallback shows the same client and the
same document as a live run.

## v1 — 2026-09-20, archived

`_archive/2026-09-20_cached-run_v1.json`
`_archive/2026-09-20_golden-proposal_v1.html`

The original recording, from before the deck redesign. Replays correctly — every section
still validates against the current block schema — but it plans the old document and emits
no `phase` events. Kept as the known-good parachute of last resort.
