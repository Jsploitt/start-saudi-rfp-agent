# Logo usage

**Confidence: HIGH on what the files contain, LOW on what the rules are.** Everything in the "What the assets actually are" section below was measured directly from the official PNGs. Everything in "Rules" is inferred from how the assets are constructed and from how the brand behaves on the website — the guidelines PDF could not be opened (see `typography.md` provenance, and OPEN-QUESTIONS Q1).

---

## ⚠️ Read this first: the web-ready filenames are wrong

Four of the nine files in `web-ready/` are misnamed, and two of them are duplicates. A build that trusts the filenames will ship the wrong asset. This was established by pixel-measuring every file.

| Filename | What it actually contains | Bounding box (in 1080×1080) |
|---|---|---|
| `logo-horizontal-light.png` | **The mark alone. No wordmark.** | 174,250 → 905,829 (732×580, near-square) |
| `logo-horizontal-dark.png` | **The mark alone. No wordmark.** Visually identical to the "light" file — the two images differ in **5 pixels** out of 1,166,400 (the files themselves differ slightly in size, 70,275 vs 70,262 bytes). | identical, 174,250 → 905,829 |
| `mark-color.png` | **The horizontal lockup** — mark on the left, navy `#10192A` wordmark on the right. | 105,402 → 974,677 (**870×276, ratio 3.15:1**) |
| `mark-light.png` | **The horizontal lockup, reversed** — same artwork, cream `#EBFFF6` wordmark, for dark backgrounds. | identical geometry |
| `logo-stacked-dark.png` | Correct. Stacked lockup, navy `#0F172B` wordmark, for light backgrounds. | 262,219 → 817,860 (556×642) |
| `logo-stacked-light.png` | Correct. Stacked lockup, cream `#EBFFF6` wordmark, for dark backgrounds. | identical geometry |
| `mark-icon.png` | Correct, and the only asset **cropped to its own artwork** (398×304 rather than padded to 1080²). The mark on transparency. | 14,14 → 383,289 |
| `favicon.png` | Correct. Rounded-square app icon, mark in gradient on a `#10192A` field, corner radius 23% of the side. | full bleed |
| `pattern-navy.png` | Correct. Two-tone tiling pattern, `#14243E` power glyphs on `#10192A`, half-drop grid. | full bleed |

**Consequences for the build:**

1. **To place the horizontal lockup, use `mark-color.png` (light backgrounds) or `mark-light.png` (dark backgrounds)** — not the files called "horizontal". This is the lockup a document header wants.
2. **`logo-horizontal-light.png` and `logo-horizontal-dark.png` are unusable as supplied.** They are mark-only, they are identical to each other, and neither is a horizontal lockup. Either treat them as redundant copies of the mark or, better, re-export them properly.
3. **The mark-only asset you want is `mark-icon.png`**, because it is the only one already trimmed to its artwork. Every lockup and mark file is padded into a 1080×1080 square instead: `mark-color.png` and `mark-light.png` are 93% transparent, the stacked lockups 89%, the two misnamed "horizontal" files 80%. Any code that sizes by image dimensions rather than by content box will render the logo far too small inside its own box. (`favicon.png` and `pattern-navy.png` are full-bleed and unaffected.)
4. This should be reported back to whoever produced the identity, and is logged as **OPEN-QUESTIONS Q4**.

## Naming convention, once decoded

The suffix refers to **the colour of the ink, not the colour of the background it goes on.**

- `-dark` = dark ink (navy wordmark) → **use on light backgrounds**
- `-light` = light ink (cream wordmark) → **use on dark backgrounds**

This is the opposite of the convention many build systems assume, and it is the second way a naive build will get it wrong.

---

## What the assets actually are

### The mark
A silhouette of the Kingdom of Saudi Arabia with a **power/standby button** knocked out of its centre in cream `#EBFFF6`. The silhouette carries the brand's one gradient: `#004D43` at the top-left running to `#27EAA6` at the bottom-right, on an axis measured at 41.3° below horizontal (`linear-gradient(131deg, …)` in CSS).

The idea reads immediately and it is the best thing in the identity: *switching Saudi Arabia on*. It also does the entire job of the brand name without words, which is why the mark alone is viable at small sizes.

### The wordmark
**START** in a hairline weight above **SAUDI** in a heavy weight, both all caps, tracked so the two words set to exactly equal width. See `typography.md` for the measurement and for what is and is not known about the typeface.

### The lockups
Only two exist:

- **Horizontal** — mark left, wordmark right, roughly 3.15:1. Files: `mark-color.png` / `mark-light.png`. This is the default for document headers, letterheads and email signatures.
- **Stacked** — mark above wordmark, roughly 1:1.15. Files: `logo-stacked-dark.png` / `logo-stacked-light.png`. For square-ish placements: covers, title pages, social avatars.

There is no horizontal-with-stacked-wordmark variant, no wordmark-only asset, and no one-colour (all-navy or all-cream, gradient removed) version of the mark. **The absence of a single-colour mark is a real gap** — it is what you need for a fax header, an embroidered shirt, a watermark, a stamp, or any print job that cannot carry a gradient. Logged as OPEN-QUESTIONS Q5.

---

## Rules

**These are inferred, not specified.** They are what the assets and the site imply. Treat them as sound defaults that the guidelines PDF may overrule.

### Clear space
No clear-space rule is stated in any source available here. The padding baked into the supplied exports implies a generous one, but export padding is not a specification.

**Proposed default: clear space on all four sides equal to the height of the power glyph inside the mark** — measurable from any asset, scales automatically, and lands close to the padding the exports already carry. Nothing may enter that zone: no text, no rule, no page edge, no other logo.

### Minimum size
Not specified. Derived from the artwork's own legibility:

- **Horizontal lockup:** 120 px / 32 mm wide. Below that the hairline "START" starts to break up on screen and disappears in print.
- **Stacked lockup:** 80 px / 22 mm wide.
- **Mark alone:** 24 px / 7 mm. The power glyph is the limiting detail.
- **Favicon:** supplied at 1080². Down-sample to 512/192/32/16; do not scale up.

The hairline weight is the binding constraint everywhere. When in doubt, go larger or drop to the mark alone.

### Which lockup on which background

| Background | Use | File |
|---|---|---|
| White or `--ss-neutral-50` | Navy-ink lockup | `mark-color.png` (horizontal) or `logo-stacked-dark.png` (stacked) |
| Navy `#10192A`, `#14243E`, or the pattern | Cream-ink lockup | `mark-light.png` (horizontal) or `logo-stacked-light.png` (stacked) |
| Photography | Cream-ink lockup, over a dark enough area — or place it on a solid navy panel rather than trusting the image | as above |
| Mid-tone or busy | Neither. Put down a navy panel first. | — |

The gradient mark is unchanged in both cases — only the wordmark ink flips. The mark's green end `#27EAA6` is bright enough to hold against navy (11.22:1 against `#10192A`, 9.92:1 against the raised tone `#14243E`) and dark enough at the `#004D43` end to hold against white (9.80:1).

### Never

- **Never recolour the mark.** The gradient is fixed at `#004D43 → #27EAA6` on its 131° axis. Not a flat green, not a navy fill, not the client's colours.
- **Never use the bright green `#27EAA6` as text on white.** 1.57:1. It fails WCAG at every size. `#004D43` is the green for light surfaces.
- **Never rebuild the lockup by hand.** Don't set "START SAUDI" in your own type and park the mark next to it — the equal-width tracking is the construction of the mark and it will be wrong.
- **Never stretch, skew, rotate or outline** either lockup, and never apply a drop shadow to the mark.
- **Never place either lockup on a mid-tone or patterned field** without a solid panel behind it.
- **Never use `logo-horizontal-*.png` expecting a horizontal lockup.** See the table at the top.
- **Never add a tagline into the lockup.** "Your Saudi company, registered in 15 working days" is a headline; it is not part of the logo.

---

## Start Saudi and Taajeel together

**This is the most consequential unknown in the brand section, because it governs the cover of every proposal.**

What is established:

- Start Saudi is **"Powered by Taajeel"**. That exact phrase appears in both the site header and the site footer, always adjacent to the Taajeel logo, which links to `taajeel.sa`.
- The relationship is load-bearing rather than decorative. **Every credential in the kit belongs to Taajeel, not to Start Saudi** — the 4,638+ companies, the SAR 5.1B+, the 407,000+ services, and all of the client logos are captioned "Companies that launched with **Taajeel**". Start Saudi is the new front door; Taajeel is the track record behind it. A proposal that drops the endorsement drops its own proof.
What is **inferred** rather than established:

- **[EXTRAPOLATED]** Start Saudi's mark leads and Taajeel's is secondary. The evidence is positional and verbal, not visual — "Powered by Taajeel" is the connective phrase, Start Saudi's name is the site, and the Taajeel mark appears as an endorsement in the header and footer. **Relative size and spacing could not be observed**: the pages were retrieved as text transcriptions, which carry no layout or image dimensions.

What is **not** established at all, because the Taajeel brand assets were not in the shared Drive folder and `taajeel.sa` is unreachable from this environment (its robots.txt could not be retrieved, so every fetch was refused):

- No Taajeel logo file of any kind is available to this kit.
- No co-branding lockup, spacing ratio, or size relationship is specified anywhere.
- It is not known whether an approved "Start Saudi / Powered by Taajeel" lockup exists as an asset.

**Proposed default until that is answered — every number here is invented for the sake of having a default:** Start Saudi horizontal lockup at full size, top-left of the document. Taajeel endorsement bottom-right of the cover or in the footer, at **[TO CONFIRM: no size relationship exists in any source — Q6]** roughly 60% of the Start Saudi mark's height, with "Powered by Taajeel" set in the muted ink colour at `--ss-text-sm`. Never lock the two marks into a single graphic, and never let the Taajeel mark lead.

**Do not ship a client-facing proposal on that assumption without checking it.** Logged as OPEN-QUESTIONS Q6, and it needs the Taajeel logo files to be resolved at all.

## Client logos

The homepage carousel shows 26 marks under the heading "Companies that launched with Taajeel": VOGA CLOSET, Ajlan & Bros Holding, PKF Global, FAS Renewables, HCP Architecture and Construction, KOVA PMC, GnTeq, XYZ Tech, Tools World, New Aqua, CHSS, ATAD, OpenSooq, Grand View Research, IT Works, Araibia, Quantum Industrial, Western International, iMENA Holding, JUST LIFE, Consolidated Consultants Group, Trellis Work, Moona Executive, Green Coordination, PKF Al Bassam Chartered Accountants, FAS Energy.

**None of those logo files are in the shared Drive folder**, and third-party marks carry their own usage rules and their own permission questions. Before any client logo appears in a proposal, confirm that Taajeel holds written permission to use it — displaying it on their own homepage does not automatically extend to a document sent to a different prospect. See `content/03-credentials.md` and OPEN-QUESTIONS Q7.
