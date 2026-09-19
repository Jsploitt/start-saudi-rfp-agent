# Sources

Every URL and file actually opened in building this kit, what each gave, and — where it matters — how reliable the extraction was.

**Session date:** 17 September 2026.

---

## ⚠️ How the extraction worked, and what that means for quotation

This matters for `content/voice.md`, whose value depends entirely on quotes being verbatim.

This session could not fetch web pages directly. The environment's egress policy refused `curl` to `start-saudi.com`, `drive.google.com` and every Google host (403 at the proxy's CONNECT). All web content therefore came through a reader tool that fetches a page, converts it to markdown, and passes it to a summarising model. That has two consequences:

1. **The homepage, the blog index and the privacy notice came back as full structured transcriptions.** Copy from those is treated as **verbatim** and marked `[VERBATIM]`.
2. **The eight blog posts came back as a mix of direct quotation and summary.** Only strings returned *inside quotation marks* are treated as verbatim, and are marked `[VERBATIM — blog]`. The surrounding summarised prose is used as **[SOURCED]** fact but is never quoted.

**If more verbatim blog material is wanted, the eight URLs below should be read directly in a browser.** It would improve `voice.md` further — the blog contains the sharpest writing in the corpus.

**No CSS, stylesheet or font file from start-saudi.com was retrievable by any means**, because the reader discards `<link>` tags and `@font-face` rules and direct fetching is blocked. This is why the typeface could not be confirmed.

---

## start-saudi.com — primary source

| URL | What it gave |
|---|---|
| `https://start-saudi.com` | **The single richest source in the kit.** Full transcription: hero, the six-step process table with durations and the "government's, not ours" footnote, the four track-record figures, the 26-logo client carousel, the ChiefNest testimonial with the partnership disclosure, step 1 of the qualification quiz, all six FAQs verbatim, header/footer "Powered by Taajeel". Feeds `01-company.md`, `03-credentials.md`, `04-process.md`, `06-faq.md`, `07-client-types.md` and most of `voice.md`. |
| `https://start-saudi.com/blog` | Index of eight posts with titles, slugs and summaries; the positioning line *"Plain-English guides for foreign founders…"*. |
| `https://start-saudi.com/privacy` | Netlify hosting, Calendly booking, cookieless analytics, data passed to Taajeel. **No address, phone, email or registration number.** Carries its own disclaimer: *"Draft notice prepared with the site build. Review by legal counsel is recommended before advertising at scale."* → `01-company.md` (Q10). |

### The eight blog posts

| URL | What it gave |
|---|---|
| `/blog/company-registration-timeline-saudi-arabia` | **The most useful post.** Stage-by-stage breakdown of the 15 days; "Saudi business days rather than calendar days"; the parallelism explanation; the four delay causes; "service promise, not a legal guarantee"; why competitor timelines disagree; registered-vs-operating. → `04-process.md`. |
| `/blog/cost-to-register-a-company-in-saudi-arabia` | Government-vs-adviser fee distinction; the contradictory MISA fee position; trade name, CR, e-publishing, translation, notarisation, national address and platform fee ranges; capital thresholds including the **SAR 30,000,000** figure for 100% foreign-owned retail/wholesale trading. → `05-pricing.md`. |
| `/blog/100-percent-foreign-ownership-saudi-arabia` | The four activity bands — open, restricted (~25% Saudi shareholding), capital-gated, closed. → `07-client-types.md`, `02-services/01-misa-investment-licence.md`. |
| `/blog/register-company-saudi-arabia-from-abroad` | Power of Attorney definition and the specific-not-general requirement; apostille vs embassy attestation chains; the five common errors. → `02-services/00-document-preparation.md`. |
| `/blog/misa-license-vs-commercial-registration` | The licence/CR definitions and ordering; what a MISA licence does *not* permit. → `02-services/01-misa-investment-licence.md`, `04-commercial-registration.md`. |
| `/blog/gm-visa-vs-investor-visa-saudi-arabia` | The three-products distinction; "you can list yourself as GM"; residency and ownership as separate questions; Premium Residency as personal. → `02-services/07-gm-visa-and-residency.md`. |
| `/blog/open-branch-foreign-company-saudi-arabia` | Branch vs LLC; the activity-match constraint; the parent document pack including audited financials; contradictory branch capital guidance. → `02-services/08-branch-of-foreign-company.md`. |
| `/blog/after-commercial-registration-saudi-arabia` | Post-CR steps; automatic opening of Qiwa/GOSI/ZATCA/National Address/Chamber; **banks typically 2–3 weeks**; parent documentation as the largest delay. → `02-services/05-government-account-activation.md`, `06-bank-account-opening.md`. |

---

## taajeel.sa — **not retrievable**

| Attempt | Result |
|---|---|
| `https://taajeel.sa` | **Failed.** `ROBOTS_DISALLOWED` — the site's robots.txt could not be fetched (connect timeout), so the reader refused the request. |
| `https://www.taajeel.sa/` | **Failed.** Same. |
| `curl https://taajeel.sa` | **Failed.** Blocked by egress policy. |

**Nothing in this kit about Taajeel comes from Taajeel.** It all comes from what Start Saudi publishes about it. See OPEN-QUESTIONS Q9.

### Independent search for Taajeel

Two searches were run for Taajeel's track record and positioning. Neither returned any coverage of Taajeel's business, and **neither corroborated the 4,638 / SAR 5.1B / 407,000 figures.** Results were dominated by unrelated similarly-named Saudi companies (Tasheel Holding, Taajeer Group) and by generic MISA-licensing content from competing formation agencies. The only relevant hit was Taajeel's own homepage title, *"Taajeel — Your Gateway to the Saudi Market"*, which is recorded in `brand/logo-usage.md` as a Taajeel-brand line rather than a Start Saudi one.

This is not evidence the figures are wrong — small B2B service firms are rarely covered — but it is why `03-credentials.md` insists they be attributed and never described as verified.

---

## Google Drive — brand folder

Folder: **"start saudi visual identity"** (`1wmFQAqxXdDASGaSqitEBQxY1wm-c9dIP`), owned by `sulaiman@aitrellis.sa`.

### Downloaded

All nine `web-ready/` PNGs were retrieved through the Drive connector and are in `brand/assets/`, original filenames kept. **Each was verified byte-exact against its Drive file size and confirmed to decode as a valid PNG.**

| File | Bytes | Dimensions | What it actually contains |
|---|---|---|---|
| `favicon.png` | 98,351 | 1080×1080 | Rounded-square app icon, mark on `#10192A`, radius 23% of side |
| `logo-horizontal-dark.png` | 70,275 | 1080×1080 | **Mark only, no wordmark** — misnamed |
| `logo-horizontal-light.png` | 70,262 | 1080×1080 | **Mark only, no wordmark** — misnamed; identical to the above but for 5 pixels |
| `logo-stacked-dark.png` | 51,327 | 1080×1080 | Stacked lockup, navy `#0F172B` wordmark |
| `logo-stacked-light.png` | 51,180 | 1080×1080 | Stacked lockup, cream `#EBFFF6` wordmark |
| `mark-color.png` | 42,897 | 1080×1080 | **The horizontal lockup**, navy wordmark — misnamed |
| `mark-light.png` | 42,625 | 1080×1080 | **The horizontal lockup**, cream wordmark — misnamed |
| `mark-icon.png` | 20,654 | 398×304 | The mark, the only file trimmed to its artwork |
| `pattern-navy.png` | 64,420 | 1080×1080 | Two-tone power-glyph tile, `#14243E` on `#10192A` |

### Analysis performed on them

- **Colour:** full pixel histograms per file; every hex in `brand/tokens.json` and `tokens.css` is a measured value with its pixel count recorded.
- **Gradient:** least-squares fit of the green channel against pixel position over the mark's 48,201 gradient pixels → axis 41.3° below horizontal, endpoints `#004D43` → `#27EAA6`.
- **Geometry:** bounding boxes for every asset (which is how the misnaming was found); favicon corner radius measured at 23.2% of the side; pattern edge-continuity checked.
- **Contrast:** eleven WCAG 2.1 pairs computed; recorded in `tokens.json`.
- **Typeface:** the wordmark was isolated by colour mask, split into "START" and "SAUDI", segmented into individual glyphs, normalised to 160×160 bitmaps, and compared by intersection-over-union against 21 open-source families downloaded from the `google/fonts` GitHub repository. Result: no decisive match — the top ten within 0.06 of each other. Full table in `brand/typography.md`.

### Not retrievable

| File | Size | Why |
|---|---|---|
| **`startsaudi brand guidelines.pdf`** | **76.2 MB** | **The authoritative source, and the biggest gap in the kit.** Drive returns an **empty text layer** — it is a flattened, image-only export — and the raw bytes cannot be transferred: direct download is blocked by egress policy, and 76 MB base64 through the connector is not viable. **See OPEN-QUESTIONS Q1.** |
| `logo/start saudi logo.pdf` (419 KB), `logo/start saudi logo.ai` (424 KB) | | Vector originals — would confirm exact colour definitions. Not transferable by the same constraint. |
| `letterhead/letterhead.png` (7.5 MB), `folder/folder.png` (6.7 MB) | | **Would have shown how the brand behaves on a document**, which is exactly what is being built. Too large to transfer. Worth requesting directly. |
| `pattern/pattern.ai`, `pattern/pattern.pdf` | | Vector pattern source. |
| `letterhead.psb`, `folder.psd` | | Photoshop sources. |
| `business card/`, `envelope/`, `badge/`, `favicon/`, `logo/PNG/`, `logo/JPEG/`, `pattern/PNG/` | | Listed but not opened — lower value than the items above. |

---

## Other resources used

| Resource | Purpose |
|---|---|
| `raw.githubusercontent.com/google/fonts` | 21 open-licence typeface families (22 font files — Poppins as two statics) downloaded for the wordmark-matching analysis: Montserrat, Raleway, Poppins, Jost, Outfit, Manrope, Figtree, Inter, Archivo, Sora, Space Grotesk, Plus Jakarta Sans, Lexend, DM Sans, Urbanist, Red Hat Display, Nunito Sans, Rubik, Barlow, Questrial, Hanken Grotesk. |
| Pillow, NumPy, fontTools | All image measurement, glyph segmentation, IoU scoring and contrast computation. |

---

## Taajeel proposals — supplied 17 September 2026

Three real proposals, supplied as `Tajeel_proposals.zip`. **The primary source for everything in `proposal/`**, and the source of eleven answers or partial answers in `OPEN-QUESTIONS.md`.

| File | Date | Client | Assignment | Format |
|---|---|---|---|---|
| `Proposal to HAVENSTONE CONSULTING W.L.L foreign company set up.pptx` | 12 Jun 2026 | Bahraini management consultancy, British + Brazilian shareholders | **Foreign company formation in Saudi Arabia + GM resident visa** | 33 slides, PPTX, 16:9 |
| `Proposal to HCP Architecture & Engineering HRO & GRO V03.pdf` | 15 Jul 2026 | Spanish architecture firm, already MISA-licensed | HRO/GRO retainer + National Address & office services | 27 slides, PDF |
| `Proposal to FlyAkeed _ Annual Confirmation v02.pdf` | 11 Aug 2026 | Saudi travel-tech, UAE parent | Annual Confirmation + AoA amendment | 28 slides, PDF, DocuSigned |

**Havenstone is the template** — the same product Start Saudi sells, to the same kind of buyer. The other two establish what is fixed across engagements and what flexes.

### What they gave

- **The canonical section skeleton**, identical in order across all three → `proposal/structure.md`
- **Real pricing**: SAR 40,000 for foreign company formation + GM visa; a twelve-line optional price list with units; retainer and one-off comparators; milestones 50/35/15; VAT at 15% shown separately → `content/05-pricing.md`
- **Government fee breakdown** by authority, with the MISA fee explicitly left as `#,###` → `content/05-pricing.md`
- **Two different 16-item formation views** — a 16-step gear diagram on the Scope slide (no durations, and it includes company name reservation) and a 16-milestone Time Frame chart with 15 durations (which drops name reservation and adds MUDAD). They are not the same list and the kit keeps them distinct. Plus the GM residency path, labelled 15 steps but printed as 16 bullets → `content/04-process.md`, `content/02-services/07`
- **The MISA document list** and the services-licence capital position → `content/02-services/00`
- **Muqeem and MUDAD**, two platforms the Start Saudi site never mentions → `content/02-services/05`
- **Taajeel's legal identity**: Taajeel Business Solutions Co. LLC, CR 1010941670, Riyadh; GM Muath Abdullah A AlZahrani → `content/01-company.md`
- **The nine standard Terms and Conditions**, verbatim and identical across all three → `proposal/terms-and-conditions.md`
- **The voice clash** — the parent company writes in exactly the register `content/voice.md` bans → `content/voice.md` § 3a

### How they were extracted, and how the numbers were checked

- `pdftotext -layout` for the two PDFs; `python-pptx` for the PPTX, walking grouped shapes recursively.
- **The PPTX was also rendered, and this mattered.** Shape order in the XML does not follow visual layout, so fee labels and their figures can be mispaired by text extraction alone. The deck was converted with LibreOffice and slides 1, 12, 14, 15, 17, 18, 24 and 25 rendered at 90–110 dpi and read visually. **Every fee, unit and duration quoted in this kit was verified against the rendered slide, not against the extracted text.**
- Two independent arithmetic checks confirm the label–figure pairings: the government-fee subtotal (1,775 + 1,265 + 1,840 + 350 = **5,230**, matching the printed total) and the Iqama breakdown (2,000 + 9,600 + 650 + 1,000 + 1,500 = **14,750**, matching the printed figure). The MISA fee sits outside the 5,230 subtotal, which is why the printed total carries an asterisk.
- Taajeel's deck palette sampled from the renders: navy `#0D304E`/`#0F3353`, parchment `#F2E8D9`, taupe `#BAA38F`, maroon `#5E312A` — **no colour in common with Start Saudi's identity**.

### What they did not give

No Start Saudi-branded proposal exists among them; all three are Taajeel-branded. The Start Saudi adaptation in `proposal/structure.md` is therefore reasoned from the two brands' published material, not copied from a precedent — and it is marked as such.

Also absent: any Start Saudi contact details, any mention of the 15-working-day promise, and any reference to the Start Saudi brand at all. The two operations appear, on this evidence, to be entirely separate in their client-facing material.
