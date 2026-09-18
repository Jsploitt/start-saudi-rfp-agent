# Open questions raised by the build

`start-saudi-kit/OPEN-QUESTIONS.md` is input and is not modified. Anything the
build found that is missing, contradictory or awkward in practice is logged here
instead, with the interpretation taken so the work could continue.

---

## B1 · The supplied logo files cannot be sized by their own dimensions

**Kit reference:** Q4, `brand/logo-usage.md`.

Confirmed in practice. Every lockup and mark file is padded into a 1080×1080
square — `mark-color.png` and `mark-light.png` are 93% transparent. Setting
`height: 34px` on the `<img>` renders the artwork at about 9px.

**Interpretation taken:** the deck does not use `<img>` for the lockup. It uses a
`.lockup` class that crops to the measured content box (105,402 → 974,677) via
`background-size` and `background-position`, driven by one `--lw` custom property
so it scales exactly. `render/template.ts`.

**What would close it:** properly trimmed exports. One re-export removes this
workaround entirely.

---

## B2 · No Taajeel logo exists in the kit, so the endorsement is set in type

**Kit reference:** Q6, `brand/logo-usage.md` "Start Saudi and Taajeel together".

The cover and every page footer need the endorsement, and there is no Taajeel
mark to place, nor any specified size relationship.

**Interpretation taken:** "Powered by **Taajeel**" set in type — muted ink,
`--ss-text-base` on the cover, `--ss-text-xs` in the footer, Start Saudi's lockup
leading at full size. This is defensible and it is also honest: it makes no claim
about a lockup relationship that no source defines.

**What would close it:** the Taajeel logo files, and a decision on relative size.

---

## B3 · Whether the demo ships the nine Terms clauses in full

`proposal/structure.md` says Terms occupy five slides and are reproduced
verbatim. `proposal/worked-example.md` does not reproduce them — it surfaces four
of the commercial consequences and says the clauses are attached in full.

**Interpretation taken:** the worked example's. One `terms` page surfacing the
four consequences, and the clauses treated as an attachment. In a demo, five
slides of legal boilerplate is five slides of nothing to watch.

**What would close it:** a decision on whether the generated artefact is the
engagement letter itself or the proposal that precedes it.

---

## B4 · Q35 is load-bearing on the `timeline` block and is encoded as a constraint

`content/04-process.md` and `proposal/section-briefs.md` §9: until Q35 is
answered, no Start Saudi proposal may lay out a competing day-by-day sequence,
because Taajeel's own chart puts the same work at 31 days.

**Interpretation taken:** the constraint is written into the `timeline` block's
schema description — calendar dates and milestones only — as well as into the
system prompt, so it survives a model that does not read the prompt carefully.
The six published step durations stay on `approach_steps`, where the briefs put
them.

---

## B5 · `--ss-caution` is a placeholder, and the build leans on it

`brand/tokens.css` marks `--ss-caution: #E8B93C` as DERIVED — "nothing in the
identity defines an amber". The `[TO CONFIRM: …]` highlight is the most visible
non-brand colour in the document and it uses exactly that token.

**Interpretation taken:** used as-is, at 22% against the page, with the token
kept so a single edit changes every instance. Flagged because it is the one
colour a reviewer will notice and it has no source.
