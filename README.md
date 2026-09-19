# start-saudi-kit

Source-grounded asset kit for the Start Saudi proposal-generation system.

This is the research and content layer that has to exist before any code is written. It stands in for the client content library, brand brief and working session that were not available. Everything here was extracted from public sources and the supplied brand folder, with provenance recorded throughout.

Built 2026-09-17. Updated 2026-09-19.

## Table of contents

- [Status](#status)
- [Getting started](#getting-started)
- [Repository structure](#repository-structure)
- [How to use this kit](#how-to-use-this-kit)
- [Two findings that change the build](#two-findings-that-change-the-build)
- [Provenance markers](#provenance-markers)
- [Five things worth knowing before you use it](#five-things-worth-knowing-before-you-use-it)
- [Next steps](#next-steps)

## Status

| Directory | Status |
|---|---|
| `brand/` | Complete |
| `content/` | Complete |
| `proposal/` | Complete, built from three real Taajeel proposals |
| `OPEN-QUESTIONS.md`, `SOURCES.md` | Complete |

Built in two passes. The first worked from public sources and the supplied brand folder. The second, after three real Taajeel proposals were supplied, built `proposal/` and fed the findings back through `content/`, closing or narrowing eleven open questions and opening one new and important one.

## Getting started

This repository is a content and documentation kit, not an application. There is no `package.json`, no build step and no server to run. Nothing here needs to be installed or started.

1. Clone the repository.
2. Read [Repository structure](#repository-structure) to see what is in it.
3. Follow the path for your role in [How to use this kit](#how-to-use-this-kit).

An `.env.example` file lists `ANTHROPIC_API_KEY`. This is a placeholder for future tooling (such as the proposal generator this kit is meant to feed) and is not read by anything in this repository today.

## Repository structure

```
start-saudi-kit/
  README.md
  brand/
    tokens.json          design tokens, machine-readable, with per-token provenance
    tokens.css            the same as CSS custom properties, light + dark surfaces
    typography.md        what is known, what was inferred, and the substitute face
    logo-usage.md        lockups, rules, and the misnamed-file warning, read this
    assets/              the nine web-ready PNGs, verified byte-exact
  content/
    01-company.md        who they are, the Taajeel relationship, positioning
    02-services/
      00-document-preparation.md      POA + attestation, before the clock starts
      01-misa-investment-licence.md   step 1, 10 working days
      02-trade-name-reservation.md    step 2, 48 hours, in parallel
      03-articles-of-association.md   step 3, 72 hours
      04-commercial-registration.md   step 4, 24 hours
      05-government-account-activation.md  step 5, 24 hours
      06-bank-account-opening.md      outside the 15 days
      07-gm-visa-and-residency.md     outside the 15 days
      08-branch-of-foreign-company.md alternative structure, not an extra step
    03-credentials.md    track record, client logos, the ChiefNest case study
    04-process.md        the 15-working-day path, the most reusable file here
    05-pricing.md        the fee model. No Start Saudi price exists anywhere
    06-faq.md            the six published FAQs plus everything from the blog
    07-client-types.md   four segments, and the activity bands that cut across them
    voice.md             the most important file in the kit
  proposal/
    README.md            index and the two findings that change the build
    structure.md         the Taajeel skeleton, measured, then the Start Saudi adaptation
    section-briefs.md    per slide: question answered, evidence needed, failure mode
    sample-rfp.md        a realistic inbound RFP with four deliberate ambiguities
    worked-example.md    the quality bar: one complete proposal, in voice
    terms-and-conditions.md   Taajeel's nine standard clauses, verbatim
  OPEN-QUESTIONS.md      Q1-Q35, prioritised, written to be sent as one email
  SOURCES.md             every URL and file opened, and how reliable each was
```

## How to use this kit

**If you are writing a proposal:** `content/voice.md` first, then `proposal/worked-example.md` to see what "in voice" looks like at full length, then `proposal/section-briefs.md` for the slide you are on. `voice.md` is the file with the highest chance of being skipped and the highest cost of skipping. Now that three real Taajeel proposals are in the corpus, skipping it means writing like the parent company instead.

**If you are building the generator:** `proposal/structure.md` for the deck shape, `proposal/section-briefs.md` for what each slide must contain and what it must not do, `proposal/sample-rfp.md` as the test input, `proposal/worked-example.md` as the expected output.

**If you are building the renderer:** `brand/logo-usage.md` first. Four of the nine supplied logo files are misnamed and two are duplicates, and a build that trusts the filenames will ship the wrong asset. Then `tokens.css`.

**If you are briefing the client:** `OPEN-QUESTIONS.md`. The last section is a ready-to-send email.

## Two findings that change the build

1. **The parent company writes in the register `voice.md` bans.** Taajeel's proposals open their About section with *"Taajeel stands as a beacon of excellence in the business solutions landscape, seamlessly merging innovation with expertise to empower organizations…"*. Fifteen banned items appear across two short passages. `voice.md` was written from the Start Saudi website before these documents existed, and its "before" examples turned out to be close paraphrases of the parent's real copy. A model generating proposals here will drift toward that register, and the drift produces fluent, professional, entirely unobjectionable prose. Fluency is the failure mode, not the goal. See `content/voice.md` section 3a.

2. **Taajeel's own timeline says 31 days where Start Saudi promises 15 working days**, for the same product: a foreign-owned company formation, plus a further 47 days for the GM residency. This is now the highest-priority open question in the kit (Q35). Until it is answered, no Start Saudi proposal can publish a per-step duration table, because the parent company's own client-facing chart contradicts it.

## Provenance markers

Every factual claim in `content/` carries one of four markers. They are load-bearing, the whole kit is built on the rule *extract, do not invent*.

| Marker | Meaning |
|---|---|
| **[VERBATIM]** | Word for word from a source. Safe to quote. |
| **[SOURCED]** | The fact is in a source; the wording is the kit's. |
| **[EXTRAPOLATED]** | An inference. Reasoned, but do not present as fact without checking. |
| **[TO CONFIRM: …]** | Not in any source. Every one is logged in `OPEN-QUESTIONS.md`. |

`brand/` uses **measured** (read from an official asset) and **derived** (constructed for build use, in no source) for the same purpose.

A visible `[TO CONFIRM]` in a generated proposal is a correct output, not a defect. A company whose entire pitch is *"You don't know what you don't know"* cannot be the company that quietly fills a gap with a plausible number. This is stated at greater length at the end of `voice.md` and `05-pricing.md`, and it is the most important single rule for whatever is built on top of this kit.

## Five things worth knowing before you use it

1. **The brand guidelines PDF could not be read.** It is a 76 MB flattened image export with an empty text layer, and its bytes are not retrievable from this environment. The brand colours in `tokens.json` were therefore measured by pixel-sampling the official PNGs. Those values are exact, but unreconciled against the authoritative document. The neutral ramp, the semantic tones and the light page colour are not in any source at all: they are marked `derived` in `tokens.json` and should be replaced, not trusted. The typeface could not be identified; Montserrat is a reasoned substitute. See OPEN-QUESTIONS Q1.

2. **Four of the nine logo files are misnamed.** `logo-horizontal-light.png` and `logo-horizontal-dark.png` contain the mark with no wordmark and are identical to each other. The real horizontal lockups are the files called `mark-color.png` and `mark-light.png`. Also, the `-light`/`-dark` suffix refers to the ink colour, not the background. See `brand/logo-usage.md`.

3. **Taajeel's prices are now known. Start Saudi's are not.** The Havenstone proposal quotes SAR 40,000 for a foreign company formation plus GM resident visa, with milestones 50/35/15, VAT at 15% shown separately, a twelve-line optional price list with units, and a government-fee breakdown. That is one quote, to one client, for one scope. It is not a price list, and not Start Saudi's price. Whether the Start Saudi product is priced differently is Q17, and until it is answered a proposal's fee slide carries `[TO CONFIRM]`.

4. **Every credential belongs to Taajeel, not Start Saudi**, is self-published, and was not corroborated by any independent source found. Start Saudi is the pitch; Taajeel is the proof. A proposal needs both, in that order. The proposals did add one verifiable credential: Taajeel Business Solutions Co. LLC, CR 1010941670.

5. **There is no service-level remedy.** Taajeel's standard terms cap liability at fees actually paid and provide no credit, escalation or guarantee behind the fifteen-day promise. A proposal will be asked, and the honest answer is "nothing".

## Next steps

1. Send the Tier 1 email at the end of `OPEN-QUESTIONS.md`. Five items. The first one, the 31-day versus 15-working-day contradiction, blocks the timeline slide of every proposal.
2. Attach the brand guidelines PDF directly (or just its palette, typography and logo-usage pages as images). This closes Q1, the largest remaining gap.
3. Get a Taajeel logo file and the co-branding rule. Every proposal cover needs both marks, and Taajeel's parchment-and-navy palette shares no colour with Start Saudi's.
4. Flag the misnamed logo exports back to whoever produced the identity.
