# Typography

**Confidence: LOW on the typeface itself, HIGH on the behaviour.** Read the provenance note before using anything here.

## Provenance

The authoritative source for type is `startsaudi brand guidelines.pdf` (Google Drive id `1mbj4j30JoA5iQ1nY0I02KIVzxKVZsCSP`, 76 MB). **It could not be read in this session.** Google Drive returns an empty text layer for it — it is a flattened, image-only export — and fetching the raw bytes is blocked by this environment's egress policy. The start-saudi.com stylesheet was equally out of reach: the site is not fetchable by any method available here other than a rendered-to-markdown reader, which discards `<link>` tags, `@font-face` rules and CSS custom properties.

So nothing below comes from a type specification. It comes from **measuring the letterforms in the official logo PNGs** and from **testing candidate typefaces against them**. That is good evidence about the wordmark and no evidence at all about body text.

**This is open question Q1 and it is the highest-priority unknown in the kit.** One page of the guidelines PDF, or one line from whoever built the site, closes it.

---

## What the wordmark actually does

This part is measured and reliable. Both lockups (`mark-color.png` and `logo-stacked-dark.png`) set the name as two stacked words:

- **START** — a hairline weight. Thin or ExtraLight, not Light.
- **SAUDI** — a heavy weight. Bold through ExtraBold.
- Both **all caps**, both in the same geometric sans.
- **Tracked to equal width.** In the horizontal lockup (`mark-color.png`, 1080 px export), "START" measures 502 px wide and "SAUDI" measures 502 px wide — identical to the pixel. The stacked lockup does the same thing at its own scale, 554 px per word. The letter-spacing on START is opened up specifically to force this alignment. It is not optical drift; it is the construction of the mark.
- Cap heights are near-identical too (98 px for START, 103 px for SAUDI), with SAUDI marginally taller because the heavy weight overshoots.

The design idea is legible: the light word is the setup, the heavy word is the payoff, and the block they form is a perfect rectangle. **Any display type built for this brand should carry generous tracking on light weights.** The token `--ss-tracking-display: 0.08em` exists for that.

## What the typeface is

Unresolved. The evidence rules some things out and ranks the rest, but it does not name a winner.

Method: the five glyphs of "SAUDI" were segmented out of the lockup, normalised to a 160×160 bitmap each, and compared by intersection-over-union against the same five glyphs rendered from **twenty-one candidate open-source families** at matched weights. The ten best are shown.

| Candidate (Bold) | Mean IoU | S | A | U | D | I |
|---|---|---|---|---|---|---|
| Red Hat Display | **0.916** | 0.82 | 0.93 | 0.95 | 0.88 | 1.00 |
| Raleway | 0.911 | 0.89 | 0.88 | 0.91 | 0.88 | 1.00 |
| Nunito Sans | 0.902 | 0.83 | 0.88 | 0.91 | 0.89 | 1.00 |
| Montserrat | 0.897 | 0.89 | 0.86 | 0.85 | 0.89 | 1.00 |
| Figtree | 0.891 | 0.85 | 0.87 | 0.89 | 0.84 | 1.00 |
| Manrope | 0.886 | 0.79 | 0.84 | 0.92 | 0.89 | 1.00 |
| Urbanist | 0.884 | 0.83 | 0.81 | 0.92 | 0.86 | 1.00 |
| Plus Jakarta Sans | 0.878 | 0.80 | 0.82 | 0.89 | 0.88 | 1.00 |
| Archivo | 0.871 | 0.81 | 0.81 | 0.85 | 0.88 | 1.00 |
| Outfit | 0.856 | 0.81 | 0.79 | 0.81 | 0.86 | 1.00 |

**How to read this: the spread is the finding.** The top ten land within 0.06 of each other, and the "I" scores a perfect 1.00 for every one of them because a rectangle is a rectangle. A genuine match would separate from the field. This one doesn't. The honest conclusion is that the wordmark is set in a **geometric / neo-grotesque sans with a pointed A apex, a straight-legged R, horizontally-cut S terminals and near-circular O-class curves** — a description that fits a large family of faces, including commercial ones not tested here (Gilroy, Museo Sans, Sofia Pro, Brandon Grotesque and similar are all plausible), and including the possibility that the wordmark was **drawn rather than set**.

### Recommended substitute

**Montserrat**, from Google Fonts.

Not because it scored highest — it placed fourth — but because it is the only top-ranked candidate that satisfies the constraint the lockup actually imposes:

- It ships a true variable weight axis **100–900**. The lockup needs a hairline (100/200) *and* a heavy (700/800) in one family. Red Hat Display starts at 300 and cannot set "START" at all. Nunito Sans and Figtree are similarly floor-limited or too humanist at the light end.
- Raleway is the credible alternate — it also spans 100–900 and scored marginally higher — but its distinctive `W` and its more calligraphic light weights pull further from the geometric reading of the mark.
- Montserrat is metrically ordinary, widely available, free, and self-hostable, which matters for documents that must render identically on a client's machine.

```css
--ss-font-display: "Montserrat", system-ui, -apple-system, "Segoe UI", sans-serif;
--ss-font-body:    "Montserrat", system-ui, -apple-system, "Segoe UI", sans-serif;
```

**Caveat that must not be lost:** using Montserrat for *body* text is a decision with no evidential basis whatsoever. Nothing here tells us what Start Saudi sets paragraphs in. A single display face used for everything is a defensible default for a document system, but it is a default, not a specification.

---

## Arabic

**The site is English-only.** The language switcher in the header and footer reads "Change language: English" and offers no alternative. No Arabic string appears anywhere in the rendered page, the blog index, any of the eight blog posts, or the privacy notice.

**No Arabic typeface is specified in any source available to this session**, and — because the guidelines PDF could not be opened — it is not known whether the guidelines specify one. This is the second half of open question Q1, and the answer changes how the bilingual output gets built.

Per the brief for this session, **English is the primary output language and Arabic is a later implementation.** So the kit does not commit to an Arabic face. It records what a later Arabic build will need to decide:

1. **Does the brand have an Arabic wordmark at all?** A Latin-only identity for a company whose entire subject is Saudi Arabia is a live question, not a rhetorical one. If the guidelines contain an Arabic lockup, it changes the logo rules as well as the type rules.
2. **Which Arabic face, and is it weight-matched?** The lockup's hairline/heavy contrast is hard to reproduce in Arabic. Most Arabic families with a full weight range are Kufi or modern-Naskh hybrids.
3. **RTL layout, not just RTL text.** A bilingual proposal mirrors its whole grid — margins, table column order, the direction numbered steps run, and which corner the logo sits in. That is a layout decision made once, early, not a translation step at the end.

If a placeholder is needed before the real answer arrives, **IBM Plex Sans Arabic** (100–700, open licence, designed alongside a Latin companion) or **Noto Sans Arabic** (100–900, widest coverage) are the safe open choices. Both are recorded in `tokens.css` as `--ss-font-arabic` and both are **derived, not specified**.

---

## Type scale

**Derived in full.** No scale exists in any reachable source. `tokens.css` carries a 1.25 (major third) ramp on a 16 px base, chosen because a major third holds up in a long document where a landing page's more dramatic 1.333 or 1.5 would not:

| Token | rem | px |
|---|---|---|
| `--ss-text-xs` | 0.75 | 12 |
| `--ss-text-sm` | 0.875 | 14 |
| `--ss-text-base` | 1 | 16 |
| `--ss-text-lg` | 1.25 | 20 |
| `--ss-text-xl` | 1.5625 | 25 |
| `--ss-text-2xl` | 1.953 | 31 |
| `--ss-text-3xl` | 2.441 | 39 |
| `--ss-text-4xl` | 3.052 | 49 |

Line heights: `1.15` tight (display), `1.3` snug (headings), `1.55` normal (body), `1.7` loose (long-form body and anything set in Arabic, which needs more leading than Latin at the same size).

## Practical rules for the proposal build

These follow from the wordmark's own logic rather than from a specification, and are offered as defaults a reviewer can overrule:

- **Section titles** take the display treatment: caps, light weight, opened tracking. It echoes "START" and it is the one distinctive typographic move the brand owns.
- **Do not set body copy in caps or in the hairline weight.** Below about 20 px the Thin weight disappears, especially printed and especially reversed out of navy.
- **Numbers carry weight in this brand.** "15 working days", "4,638+", "SAR 5.1B+" are load-bearing content (see `content/03-credentials.md`). Set them heavy and large; the light/heavy contrast of the lockup is the licence to do it.
- **One family throughout.** Nothing in the identity suggests a second typeface, and adding one would be an invention.
