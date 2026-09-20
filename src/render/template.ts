/**
 * The stage shell: a fixed 1920x1080 deck scaled to fit the viewport.
 *
 * Every colour in here resolves to a custom property defined in
 * start-saudi-kit/brand/tokens.css, which is read from disk and injected at
 * render time. If a hex literal appears below this line it is a bug.
 *
 * SIZES DO NOT COME FROM tokens.css. The document ramp in that file is built on
 * a 16px base, for a page read at arm's length in a browser window. This deck is
 * a 1920px canvas scaled down to whatever the viewport is, so a token that means
 * "20px body copy" in a document means "20px out of 1920" here — about a third
 * of a readable size, and the reason the old deck read as a wall of grey. The
 * --deck-* ramp below is the canvas-relative one, and it is the only ramp any
 * rule in this file is allowed to reach for.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KIT_DIR } from '../paths.js';

let tokensCache: string | null = null;

/** brand/tokens.css, verbatim, minus its own body/pattern rules which the deck overrides. */
export function tokensCss(): string {
  if (tokensCache) return tokensCache;
  const raw = readFileSync(join(KIT_DIR, 'brand', 'tokens.css'), 'utf8');
  tokensCache = raw.replace(/\nbody\s*\{[\s\S]*?\n\}/, '\n');
  return tokensCache;
}

const DECK_CSS = `
/* --- fonts: self-hosted so the deck renders identically offline ----------- */
@font-face { font-family:"Montserrat"; src:url("assets/fonts/montserrat.woff2") format("woff2");
  font-weight:100 900; font-style:normal; font-display:swap; }
@font-face { font-family:"IBM Plex Sans Arabic"; src:url("assets/fonts/plex-arabic-400.woff2") format("woff2");
  font-weight:400; font-style:normal; font-display:swap;
  unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,
    U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC; }
@font-face { font-family:"IBM Plex Sans Arabic"; src:url("assets/fonts/plex-arabic-600.woff2") format("woff2");
  font-weight:600; font-style:normal; font-display:swap;
  unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,
    U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC; }
/* Latin subset of the same family, so company names, numerals and dates inside an
   Arabic paragraph set in a matched face instead of falling through to the system. */
@font-face { font-family:"IBM Plex Sans Arabic"; src:url("assets/fonts/plex-latin-400.woff2") format("woff2");
  font-weight:400; font-style:normal; font-display:swap; unicode-range:U+0000-00FF,U+2000-206F,U+2212; }
@font-face { font-family:"IBM Plex Sans Arabic"; src:url("assets/fonts/plex-latin-600.woff2") format("woff2");
  font-weight:600; font-style:normal; font-display:swap; unicode-range:U+0000-00FF,U+2000-206F,U+2212; }

/* --- the deck type ramp ---------------------------------------------------
   Sized for 1920x1080, not for a document. Body copy is --deck-text-lg; a slide
   title is --deck-text-4xl. Nothing below --deck-text-xs may appear on a slide:
   at 20/1920 that is already the smallest thing a person can read across a
   meeting room, and it is reserved for the footer and the appendix.
   --------------------------------------------------------------------------- */
:root {
  --deck-text-xs:   20px;  /* footer, source popovers, appendix body */
  --deck-text-sm:   24px;  /* eyebrows, table headers, captions, chips */
  --deck-text-base: 28px;  /* secondary copy, notes, table cells */
  --deck-text-lg:   34px;  /* BODY COPY. The default for a paragraph. */
  --deck-text-xl:   42px;  /* block headings */
  --deck-text-2xl:  54px;  /* pull quotes, cover subtitle */
  --deck-text-3xl:  68px;  /* section statements */
  --deck-text-4xl:  86px;  /* slide titles, statistics */
  --deck-text-5xl: 112px;  /* the client's name on the cover */

  /* 62 characters. The old 96ch was close to double a readable line, and no
     amount of leading rescues a measure that long. */
  --deck-measure: 62ch;
}

*, *::before, *::after { box-sizing:border-box; }
html, body { margin:0; padding:0; height:100%; overflow:hidden; background:var(--ss-navy);
  font-family:var(--ss-font-body); -webkit-font-smoothing:antialiased; }

#stage { position:absolute; top:0; left:0; width:1920px; height:1080px; transform-origin:0 0; }

/* --- the page ------------------------------------------------------------- */
.page {
  position:absolute; inset:0; width:1920px; height:1080px;
  display:none; flex-direction:column;
  padding:var(--pad-block) var(--pad-inline);
  background:var(--ss-bg); color:var(--ss-ink);
  --pad-inline:132px; --pad-block:72px;
}
.page.is-current { display:flex; }
@media (prefers-reduced-motion:no-preference) {
  .page.is-current > * { animation:rise .34s cubic-bezier(.2,.7,.3,1) both; }
  .page.is-current > .page-body { animation-delay:.05s; }
  @keyframes rise { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
}

.page-head { display:flex; align-items:center; justify-content:space-between; flex:0 0 auto;
  padding-block-end:22px; border-block-end:1px solid var(--ss-hairline); margin-block-end:38px; }
.page-title { font-size:var(--deck-text-sm); text-transform:uppercase;
  letter-spacing:var(--ss-tracking-display); font-weight:500; color:var(--ss-ink-muted); }

/* The supplied lockups are padded into a 1080x1080 box: the artwork occupies
   105,402 -> 974,677, i.e. 870x275 at an offset. Sizing by image dimensions
   renders the logo a quarter of its intended size, so crop to the content box.
   See brand/logo-usage.md. */
.lockup { --lw:148px; display:inline-block; flex:0 0 auto;
  width:var(--lw); height:calc(var(--lw) * 275 / 870);
  background-repeat:no-repeat;
  background-size:calc(var(--lw) * 1080 / 870) auto;
  background-position:calc(var(--lw) * -105 / 870) calc(var(--lw) * -402 / 870); }
.lockup-light { background-image:url("assets/mark-light.png"); }  /* light ink, on dark */
.lockup-dark  { background-image:url("assets/mark-color.png"); }  /* dark ink, on light */
.page-mark { --lw:168px; opacity:.92; }

.page-body { flex:1 1 auto; min-height:0; display:flex; align-items:center; }
.page[data-overflow] .page-body { align-items:flex-start; }
.fitbox { width:100%; flex:0 0 auto; transform-origin:0 0; display:flex; flex-direction:column; gap:44px; }

.page-foot { flex:0 0 auto; display:flex; justify-content:space-between; align-items:flex-end;
  padding-block-start:18px; margin-block-start:24px; border-block-start:1px solid var(--ss-hairline);
  font-size:var(--deck-text-xs); color:var(--ss-ink-muted); letter-spacing:.02em; }
.foot-id { display:flex; align-items:center; gap:16px; }
.foot-id .barcode-mono { color:var(--ss-ink-muted); opacity:.55; display:block; }
.pageno { font-variant-numeric:tabular-nums; }

/* --- type ----------------------------------------------------------------- */
.page h1 { font-size:var(--deck-text-4xl); line-height:var(--ss-leading-tight); font-weight:200;
  letter-spacing:var(--ss-tracking-display); text-transform:uppercase; margin:0; }
.page h3 { font-size:var(--deck-text-xl); line-height:var(--ss-leading-snug); font-weight:600;
  margin:0 0 20px; letter-spacing:.01em; }
.page p { margin:0 0 20px; font-size:var(--deck-text-lg); line-height:var(--ss-leading-normal);
  max-inline-size:var(--deck-measure); }
.page p:last-child { margin-block-end:0; }
.page strong { font-weight:700; }
.page code { font-family:var(--ss-font-mono); font-size:.9em; }
.page ul { margin:0 0 20px; padding-inline-start:32px; font-size:var(--deck-text-lg);
  line-height:var(--ss-leading-normal); max-inline-size:var(--deck-measure); }
.page li { margin-block-end:10px; }
.eyebrow { font-size:var(--deck-text-sm); text-transform:uppercase; font-weight:600;
  letter-spacing:var(--ss-tracking-display); color:var(--ss-accent); margin-block-end:22px; }
.page .note { font-size:var(--deck-text-sm) !important; color:var(--ss-ink-muted);
  line-height:var(--ss-leading-snug); margin-block-start:20px !important;
  max-inline-size:none; }

/* the gap that survives into the shipped document */
mark.to-confirm { background:color-mix(in srgb, var(--ss-caution) 22%, transparent);
  color:inherit; border-radius:var(--ss-radius-sm); padding:.08em .38em;
  box-shadow:inset 0 -3px 0 var(--ss-caution); }
mark.to-confirm .tc-tag { font-size:.62em; text-transform:uppercase; font-weight:700;
  letter-spacing:.1em; color:var(--ss-ink-muted); margin-inline-end:.35em; vertical-align:.12em; }

/* --- source provenance ---------------------------------------------------- */
.blk { position:relative; }
.src { position:absolute; inset-block-start:2px; inset-inline-end:-42px; width:30px; height:30px;
  display:grid; place-items:center; cursor:help; opacity:0; transition:opacity .16s; }
.blk:hover .src, .src:focus-visible { opacity:1; }
.src-dot { width:10px; height:10px; border-radius:var(--ss-radius-full); background:var(--ss-accent); }
.src-pop { position:absolute; inset-block-start:32px; inset-inline-end:0; width:460px;
  background:var(--ss-navy); color:var(--ss-cream); padding:18px 20px;
  border-radius:var(--ss-radius-md); box-shadow:var(--ss-shadow-lg);
  font-size:var(--deck-text-xs); line-height:1.5; opacity:0; pointer-events:none; transition:opacity .16s;
  z-index:20; text-align:start; }
.src:hover .src-pop, .src:focus-visible .src-pop { opacity:1; }
.src-pop em { color:var(--ss-green); font-style:normal; text-transform:uppercase;
  letter-spacing:.08em; font-size:16px; }
.src-pop ul { margin:8px 0 0; padding-inline-start:20px; font-size:var(--deck-text-xs); }
.src-pop li { margin-block-end:4px; }

/* --- cover ---------------------------------------------------------------- */
.page-cover { padding:104px 132px; background:var(--ss-navy); position:relative; overflow:hidden; }
.page-cover::before { content:""; position:absolute; inset:0;
  background-image:url("assets/pattern-navy.png"); background-size:760px; opacity:.22; }
.page-cover::after { content:""; position:absolute; inset-block-end:-380px; inset-inline-end:-260px;
  width:900px; height:900px; border-radius:var(--ss-radius-full);
  background:radial-gradient(circle, color-mix(in srgb, var(--ss-green) 16%, transparent), transparent 62%); }
.page-cover .page-body { align-items:stretch; }
.page-cover .fitbox { height:100%; }
.blk-cover { position:relative; z-index:2; height:100%; display:flex; flex-direction:column;
  justify-content:space-between; align-items:flex-start; }
.cover-id { display:flex; flex-direction:column; align-items:flex-start; gap:30px; }
.cover-id .barcode { display:block; }
.cover-lockup { --lw:330px; }
.cover-body { margin-block:auto; }
.cover-sector { font-size:var(--deck-text-sm); text-transform:uppercase; font-weight:600;
  letter-spacing:var(--ss-tracking-display); color:var(--ss-green); margin-block-end:26px; }
.cover-client { font-size:var(--deck-text-5xl) !important; font-weight:200 !important;
  letter-spacing:var(--ss-tracking-display); text-transform:uppercase; margin:0 0 30px !important;
  color:var(--ss-cream); line-height:var(--ss-leading-tight); }
.cover-title { font-size:var(--deck-text-2xl) !important; font-weight:300; color:var(--ss-cream);
  opacity:.92; max-inline-size:24ch; line-height:var(--ss-leading-snug); margin:0 !important; }
.cover-foot { width:100%; display:flex; justify-content:space-between; align-items:flex-end;
  font-size:var(--deck-text-base); color:var(--ss-neutral-300); }
.cover-endorse strong { color:var(--ss-cream); font-weight:600; }
.cover-meta .sep { opacity:.5; margin-inline:8px; }

.page[data-surface="dark"]:not(.page-cover) { position:relative; }
.page[data-surface="dark"]:not(.page-cover)::before { content:""; position:absolute; inset:0;
  background-image:url("assets/pattern-navy.png"); background-size:900px; opacity:.13; pointer-events:none; }
.page[data-surface="dark"] > * { position:relative; z-index:1; }

/* --- statement ------------------------------------------------------------ */
.blk-statement .statement-text { font-size:var(--deck-text-3xl); line-height:var(--ss-leading-snug);
  font-weight:300; max-inline-size:24ch; margin:0; }
[data-surface="dark"] .blk-statement .statement-text { color:var(--ss-cream); }

/* --- approach_steps: a horizontal path ------------------------------------
   Not a list with numbers in front of it. The steps run left to right along a
   spine, each one a node carrying its duration as a chip; a step whose duration
   says it runs in parallel hangs off the spine below its anchor, on a dashed
   branch, so the parallelism is visible before the footnote explains it.
   --------------------------------------------------------------------------- */
.path { --node:62px; --branch-gap:24px; margin-block-start:8px; }
.path-track { list-style:none; margin:0; padding:0;
  display:grid; grid-template-columns:repeat(var(--lanes,1), 1fr);
  grid-auto-rows:auto; row-gap:var(--branch-gap); align-items:start; }

.step { position:relative; grid-row:1; grid-column:var(--lane); padding-inline:20px;
  display:flex; flex-direction:column; align-items:center; text-align:center;
  transition:opacity .2s; }

/* the spine: from this node's centre to the next node's centre. The track has no
   column gap, so 100% of the column is exactly one centre-to-centre span. */
.step:not(.is-parallel)::before { content:""; position:absolute; z-index:0;
  inset-block-start:calc(var(--node) / 2 - 1px); inset-inline-start:50%; width:100%; height:2px;
  background:var(--ss-hairline); }
.step.is-last::before { display:none; }

.step-n { position:relative; z-index:1; flex:0 0 auto;
  width:var(--node); height:var(--node); border-radius:var(--ss-radius-full);
  display:grid; place-items:center;
  font-size:var(--deck-text-base); font-weight:700; font-variant-numeric:tabular-nums;
  background:var(--ss-accent); color:var(--ss-bg);
  box-shadow:0 0 0 10px var(--ss-bg); }
.step-main { display:block; }
.step-title { display:block; font-size:var(--deck-text-base); font-weight:700;
  line-height:1.2; margin-block-start:12px; }
.step-text { display:block; font-size:var(--deck-text-sm); color:var(--ss-ink-muted);
  line-height:1.3; margin-block-start:6px; }
.step-dur { display:inline-block; margin-block-start:10px;
  font-size:var(--deck-text-sm); font-weight:700; line-height:1.2;
  padding:6px 14px; border-radius:var(--ss-radius-full);
  background:color-mix(in srgb, var(--ss-accent) 12%, transparent); color:var(--ss-accent); }

/* the branch */
/* The branch node straddles its anchor's column and the next one, so it sits
   centred on the column boundary — which is the one vertical channel through
   row 1 that has no text in it. That is what the connector runs down. */
.step.is-parallel { grid-row:2; grid-column:var(--lane) / span var(--span,1); }
.step.is-parallel .step-n { background:var(--ss-bg); color:var(--ss-accent);
  box-shadow:inset 0 0 0 3px var(--ss-accent), 0 0 0 10px var(--ss-bg); }
.step.is-parallel .step-dur { background:transparent;
  box-shadow:inset 0 0 0 2px color-mix(in srgb, var(--ss-accent) 40%, transparent); }
.step-par { display:block; margin-block-start:8px; font-size:var(--deck-text-xs);
  font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--ss-accent); }
/* The connector is drawn in two halves that meet across the row gap: the anchor
   carries it from the spine down to the bottom of its own row, the branch node
   carries it from the top of its row down to its circle. Neither half can know
   the other's height, so neither can draw the whole thing. The anchor's half
   hangs off the END of its column box (inset-inline-start:100%), which is the
   column boundary the branch node is centred on. */
.step.has-branch::after { content:""; position:absolute; z-index:0;
  inset-inline-start:100%; margin-inline-start:-1px; width:2px;
  inset-block-start:calc(var(--node) / 2); inset-block-end:calc(-1 * var(--branch-gap));
  background:repeating-linear-gradient(to bottom,
    var(--ss-accent) 0 7px, transparent 7px 14px); opacity:.5; }
.step.is-parallel::before { content:""; position:absolute; z-index:0;
  inset-inline-start:50%; margin-inline-start:-1px; inset-block-start:0;
  width:2px; height:calc(var(--node) / 2);
  background:repeating-linear-gradient(to bottom,
    var(--ss-accent) 0 7px, transparent 7px 14px); opacity:.5; }

[data-stepped] .step, [data-stepped] .tl-row { opacity:.3; }
[data-stepped] .step.on, [data-stepped] .tl-row.on { opacity:1; }

/* --- timeline: a calendar spine -------------------------------------------
   Milestones sit on a horizontal date line. The "who" field decides the side: yours above
   the line, ours and everyone else's below it. Two parties, two halves, one
   glance — which is the question the block exists to answer.
   --------------------------------------------------------------------------- */
.cal { --stem:20px; margin-block-start:8px; }
.cal-legend { display:flex; gap:30px; font-size:var(--deck-text-sm); text-transform:uppercase;
  letter-spacing:.08em; color:var(--ss-ink-muted); margin-block-end:12px; }
.cal-legend span::before { content:""; display:inline-block; width:14px; height:14px;
  border-radius:var(--ss-radius-full); margin-inline-end:10px; vertical-align:-1px; }
.cal-legend .lg-yours::before { background:var(--ss-accent); }
.cal-legend .lg-ours::before { background:var(--ss-ink); }

.cal-track { list-style:none; margin:0; padding:0; position:relative;
  display:grid; grid-auto-flow:column; grid-auto-columns:1fr; column-gap:24px; align-items:stretch; }
.cal-track::before { content:""; position:absolute; z-index:0;
  inset-block-start:50%; inset-inline:-26px; height:2px; margin-block-start:-1px;
  background:var(--ss-hairline); }

.tl-row { position:relative; display:grid; grid-template-rows:1fr 0 1fr;
  transition:opacity .2s; }
.cal-card { min-width:0; }
.tl-row.is-above .cal-card { grid-row:1; align-self:end; padding-block-end:var(--stem); }
.tl-row.is-below .cal-card, .tl-row.is-neutral .cal-card {
  grid-row:3; align-self:start; padding-block-start:var(--stem); }

.cal-marker { grid-row:2; place-self:center; position:relative; z-index:2;
  width:20px; height:20px; border-radius:var(--ss-radius-full);
  background:var(--ss-ink); box-shadow:0 0 0 6px var(--ss-bg); }
.tl-row.is-above .cal-marker { background:var(--ss-accent); }
.tl-row.is-neutral .cal-marker { background:var(--ss-bg);
  box-shadow:inset 0 0 0 3px var(--ss-ink-muted), 0 0 0 6px var(--ss-bg); }
/* the stem, from the marker out to its card */
.cal-marker::after { content:""; position:absolute; inset-inline-start:50%; width:2px;
  height:var(--stem); background:var(--ss-hairline); margin-inline-start:-1px; }
.tl-row.is-above .cal-marker::after { inset-block-end:100%; }
.tl-row.is-below .cal-marker::after, .tl-row.is-neutral .cal-marker::after { inset-block-start:100%; }

.tl-when { display:block; font-weight:700; font-size:var(--deck-text-base);
  line-height:1.25; font-variant-numeric:tabular-nums; }
.tl-what { display:block; font-size:var(--deck-text-sm); line-height:1.35;
  color:var(--ss-ink-muted); margin-block-start:8px; }
.tl-who { display:block; font-size:var(--deck-text-xs); font-weight:700; text-transform:uppercase;
  letter-spacing:.1em; color:var(--ss-ink-muted); margin-block-end:6px; }
.tl-row.is-above .tl-who { color:var(--ss-accent); }

/* --- two col -------------------------------------------------------------- */
.blk-two_col { display:grid; grid-template-columns:1fr 1fr; gap:72px; }
.blk-two_col .col p, .blk-two_col .col li { max-inline-size:none; }
.blk-two_col.rail { grid-template-columns:1.5fr 1fr; gap:64px; }
.blk-two_col.rail .col-right { background:var(--ss-bg-raised); padding:36px 38px;
  border-radius:var(--ss-radius-lg); border-inline-start:4px solid var(--ss-accent); }
.blk-two_col.rail .col-right h3 { font-size:var(--deck-text-base); text-transform:uppercase;
  letter-spacing:var(--ss-tracking-display); color:var(--ss-ink-muted); }
.blk-two_col.rail .col-right p, .blk-two_col.rail .col-right li { font-size:var(--deck-text-base); }

/* --- stats ---------------------------------------------------------------- */
.stat-grid { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:44px; align-items:stretch; }
.stat { padding-inline-start:28px; border-inline-start:4px solid var(--ss-accent);
  display:flex; flex-direction:column; justify-content:space-between; }
.stat-fig { font-size:var(--deck-text-4xl); font-weight:800; line-height:1.02;
  letter-spacing:-.02em; font-variant-numeric:tabular-nums; text-wrap:balance; }
/* four across 1656px is 414px a column, and "SAR 5.1B+" does not fit that at 86px */
.stat-grid[data-n="4"] .stat-fig { font-size:var(--deck-text-3xl); }
.stat-cap { font-size:var(--deck-text-base); color:var(--ss-ink-muted); margin-block-start:16px;
  line-height:var(--ss-leading-snug); }

/* --- table ---------------------------------------------------------------- */
.blk-table table { width:100%; border-collapse:collapse; font-size:var(--deck-text-base); }
.blk-table th { text-align:start; font-size:var(--deck-text-sm); text-transform:uppercase;
  letter-spacing:var(--ss-tracking-display); font-weight:600; color:var(--ss-ink-muted);
  padding:0 26px 16px 0; border-block-end:2px solid var(--ss-hairline); }
.blk-table td { padding:18px 26px 18px 0; border-block-end:1px solid var(--ss-hairline);
  vertical-align:top; line-height:var(--ss-leading-normal); }
.blk-table tr td:last-child, .blk-table tr th:last-child { padding-inline-end:0; }
.blk-table.plain td:first-child { font-weight:600; width:38%; }
.blk-table tbody tr:last-child td { border-block-end:none; }
/* --- two-column flow ------------------------------------------------------
   For a page that is scanned rather than read: a contents list, a schedule.
   Same type sizes as everywhere else, just two columns of it.
   --------------------------------------------------------------------------- */
.page[data-columns="2"] .fitbox { display:block; }
.page[data-columns="2"] .cols { column-gap:96px; }
.page[data-columns="2"] .blk { break-inside:avoid-column; margin-block-end:34px; }
.page[data-columns="2"] .blk:last-child { margin-block-end:0; }
/* In half the width, the plain table's 38% label column leaves nine characters
   a line. Let the label take the room and pin the number to the end. */
.page[data-columns="2"] .blk-table.plain td:first-child { width:auto; }
.page[data-columns="2"] .blk-table.plain td:last-child {
  width:1%; white-space:nowrap; text-align:end; color:var(--ss-ink-muted);
  font-variant-numeric:tabular-nums; }
.page[data-columns="2"] .blk-table td { padding-block:15px; }
.page[data-columns="2"] .src { display:none; }

/* --- team ----------------------------------------------------------------- */
.team-grid { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:52px; }
.person-name { font-size:var(--deck-text-xl); font-weight:700; }
.person-role { font-size:var(--deck-text-sm); color:var(--ss-accent); text-transform:uppercase;
  letter-spacing:.06em; margin-block:8px 14px; }
.person-bio { font-size:var(--deck-text-base) !important; color:var(--ss-ink-muted); }

/* --- quote ---------------------------------------------------------------- */
.blk-quote blockquote { margin:0; font-size:var(--deck-text-2xl); font-weight:300;
  line-height:var(--ss-leading-snug); padding-inline-start:40px;
  border-inline-start:4px solid var(--ss-accent); max-inline-size:26ch; }
.attrib { margin-block-start:24px; padding-inline-start:44px; font-size:var(--deck-text-base);
  color:var(--ss-ink-muted); }

/* --- RTL: logical properties throughout, so the grid mirrors with no second sheet --- */
.rtl-body { direction:rtl; text-align:start; font-family:var(--ss-font-arabic);
  line-height:var(--ss-leading-loose); }
.rtl-body h3 { font-size:var(--deck-text-xl); font-weight:600; margin-block-end:26px; }
.rtl-body p, .rtl-body li { font-size:var(--deck-text-lg); line-height:var(--ss-leading-loose);
  max-inline-size:var(--deck-measure); }
.rtl-body strong { font-weight:600; }
.rtl-body [dir="ltr"], .rtl-body code { unicode-bidi:isolate; }
.eyebrow.ltr { direction:ltr; }

/* --- close ---------------------------------------------------------------- */
.blk-close .cta { font-size:var(--deck-text-xl) !important; max-inline-size:44ch; }
.sig-grid { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:72px; margin-block:52px 44px; }
.sig { border-block-start:1px solid var(--ss-hairline); padding-block-start:22px; }
.sig-party { font-weight:700; font-size:var(--deck-text-base); margin-block-end:18px; }
.sig-line { font-size:var(--deck-text-base); color:var(--ss-ink-muted); margin-block-end:12px; }
.contact { font-size:var(--deck-text-base); color:var(--ss-ink-muted); line-height:1.8; }

/* --- appendix: the terms ---------------------------------------------------
   Back matter, and it should look like back matter. Two columns, set small and
   tight, no accent colour, no rules, no diagrams. The nine clauses are verbatim
   Taajeel boilerplate and must not be rewritten, so the only lever left is
   typographic: give them the room they are worth and no more.
   --------------------------------------------------------------------------- */
/* The columns live on an inner .cols, never on .fitbox itself. The
   shrink-to-fit sets an explicit height on .fitbox to keep the page centred,
   and a definite height on a multicol box makes the browser open a THIRD
   column off the side of the page rather than growing downwards. Keeping the
   two on separate elements is what stops that. */
.cols { columns:2; column-fill:balance; }
.page[data-appendix] .fitbox { display:block; --deck-appendix:17px; }
.page[data-appendix] .cols { column-gap:56px; }
.page[data-appendix] .blk { break-inside:avoid-column; margin-block-end:26px; }
.page[data-appendix] .blk:last-child { margin-block-end:0; }
.page[data-appendix] h3 { font-size:var(--deck-text-sm); font-weight:700; text-transform:uppercase;
  letter-spacing:.1em; color:var(--ss-ink-muted); margin:0 0 8px; }
/* Nine verbatim clauses, two slides. That arithmetic only closes below the
   deck's smallest slide size, so the appendix has its own: 18px, which is the
   0.9% of page width that legal boilerplate has always been set at. */
.page[data-appendix] p, .page[data-appendix] li {
  font-size:var(--deck-appendix); line-height:1.45; max-inline-size:none;
  margin-block-end:9px; text-align:justify; hyphens:auto; }
.page[data-appendix] .src { display:none; }
.page[data-appendix] .note { font-size:var(--deck-appendix) !important;
  margin-block-start:8px !important; }

/* --- chrome: progress bar, hints, edit mode ------------------------------- */
#progress { position:fixed; inset-block-start:0; inset-inline-start:0; height:3px;
  background:var(--ss-green); width:0; z-index:99; transition:width .3s ease; }
#hint { position:fixed; inset-block-end:16px; inset-inline-end:18px; z-index:99;
  font-family:var(--ss-font-body); font-size:11px; letter-spacing:.06em; text-transform:uppercase;
  color:var(--ss-neutral-400); background:color-mix(in srgb, var(--ss-navy) 78%, transparent);
  padding:7px 13px; border-radius:var(--ss-radius-full); opacity:0; transition:opacity .3s;
  pointer-events:none; }
#hint.show { opacity:1; }
body.editing #stage { outline:3px solid var(--ss-green); outline-offset:-3px; }
body.editing [contenteditable]:hover { background:color-mix(in srgb, var(--ss-green) 10%, transparent); }
body.editing [contenteditable]:focus { outline:2px solid var(--ss-green); outline-offset:3px;
  border-radius:var(--ss-radius-sm); }
.page.is-writing { position:relative; }
.page.is-writing::after { content:"drafting"; position:absolute; inset-block-start:84px;
  inset-inline-end:132px; font-size:var(--deck-text-xs); text-transform:uppercase; letter-spacing:.12em;
  color:var(--ss-accent); animation:pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 50% { opacity:.35; } }

/* A page that could not be made to fit even at the 85% floor. Visible in
   development, invisible in print — the warning is for whoever is composing,
   not for the client. */
.page[data-overflow] { outline:4px solid var(--ss-caution); outline-offset:-4px; }

/* --- reading mode: narrow screens ------------------------------------------
   A 16:9 slide scaled to fit a 390px phone puts body copy at seven effective
   pixels. No type size fixes that — it is arithmetic: 34 of 1920 is 1.8% of the
   width, whatever the number is. The canvas itself has to go.

   So below 820px the deck stops being a deck. The stage stops scaling, the
   pages stack and scroll as a document, the ramp switches to real reading
   sizes, and the two diagrams stack vertically instead of running across a
   width that is no longer there. Same markup, same content, same source of
   truth — only the geometry changes.

   The exported PDF cannot do this: it is a fixed 16:9 sheet, and a reader on a
   phone will have to zoom. That is what a slide deck is.
   --------------------------------------------------------------------------- */
@media (max-width:820px) {
  :root {
    --deck-text-xs:   12px;
    --deck-text-sm:   13px;
    --deck-text-base: 15px;
    --deck-text-lg:   17px;  /* BODY COPY, at a size a phone actually reads */
    --deck-text-xl:   21px;
    --deck-text-2xl:  25px;
    --deck-text-3xl:  29px;
    --deck-text-4xl:  34px;
    --deck-text-5xl:  40px;
    --deck-measure:   38ch;
  }
  html, body { overflow:auto; height:auto; background:var(--ss-bg); }
  #stage { position:static; width:100%; height:auto; transform:none !important; }
  #hint { display:none; }

  .page { position:static; display:flex !important; width:100%; height:auto;
    min-height:100svh; padding:26px 20px 30px; }
  .page-cover { padding:40px 20px; }
  .page-head { margin-block-end:22px; padding-block-end:12px; }
  .page-mark { --lw:96px; }
  .cover-lockup { --lw:190px; }
  .page-foot { margin-block-start:22px; padding-block-start:12px; }
  .fitbox { transform:none !important; width:100% !important; height:auto !important;
    gap:24px; }
  .page[data-overflow] { outline:none; }

  /* one column, everywhere */
  .cols { columns:1 !important; }
  .blk-two_col, .blk-two_col.rail { grid-template-columns:1fr !important; gap:26px; }
  .stat-grid, .team-grid, .sig-grid { grid-auto-flow:row !important; gap:22px; }
  .stat-grid { grid-auto-columns:auto; }

  /* the path: a vertical run of nodes down a spine on the left */
  .path-track { grid-template-columns:1fr !important; row-gap:0; }
  .step { grid-row:auto !important; grid-column:1 !important;
    align-items:flex-start; text-align:start; padding:0 0 0 54px;
    margin-block-end:22px; }
  .step-n { position:absolute; inset-inline-start:0; inset-block-start:0;
    width:38px; height:38px; font-size:var(--deck-text-sm); box-shadow:none; }
  .step:not(.is-last)::before { inset-block-start:38px; inset-inline-start:18px;
    width:2px; height:calc(100% - 16px); background:var(--ss-hairline); }
  .step.has-branch::after, .step.is-parallel::before { display:none; }
  .step-title { margin-block-start:0; }

  /* the calendar: one card per row, the side shown as a coloured edge */
  .cal-track { grid-auto-flow:row !important; column-gap:0; row-gap:18px; }
  .cal-track::before { display:none; }
  .tl-row { grid-template-rows:auto !important; }
  .cal-card { grid-row:auto !important; padding:0 0 0 16px !important;
    border-inline-start:3px solid var(--ss-hairline); }
  .tl-row.is-above .cal-card { border-inline-start-color:var(--ss-accent); }
  .tl-row.is-below .cal-card { border-inline-start-color:var(--ss-ink); }
  .cal-marker { display:none; }
  .cal-legend { flex-direction:column; gap:6px; }

  /* Every page is on screen at once and the reader scrolls, so there is no
     "current" page to step through. Dimming the rest leaves a document that
     looks like it failed to load. */
  [data-stepped] .step, [data-stepped] .tl-row { opacity:1 !important; }

  .blk-quote blockquote, .blk-statement .statement-text, .cover-title { max-inline-size:none; }
  .src { display:none; }
  .blk-table td, .blk-table th { padding-inline-end:10px; }
  .page[data-appendix] p, .page[data-appendix] li { text-align:start; }
}

/* --- print / PDF ---------------------------------------------------------- */
@page { size:1920px 1080px; margin:0; }
@media print {
  html, body { overflow:visible; background:var(--ss-white); }
  #stage { position:static; transform:none !important; width:auto; height:auto; }
  #progress, #hint { display:none; }
  .page { position:static; display:flex !important; width:1920px; height:1080px;
    page-break-after:always; break-after:page; animation:none !important;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  /* The entry animation has fill-mode "both", so a page that becomes current at
     print time is captured at its first frame — which is opacity zero. Every
     page becomes current at print time. That is how a 32-page export came out
     with 31 blank sheets behind a perfect cover. */
  .page.is-current > *, .page > * {
    animation:none !important; opacity:1 !important; transform:none !important; }
  .page[data-overflow] { outline:none; }
  .src { display:none; }
  /* every step and milestone printed, whatever the step-through was showing */
  [data-stepped] .step, [data-stepped] .tl-row { opacity:1 !important; }
}
`;

const DECK_JS = `
(function(){
  var stage = document.getElementById('stage');
  var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));
  var bar   = document.getElementById('progress');
  var hint  = document.getElementById('hint');
  var i = 0, step = 0, hintT;

  /* The floor. Below this the deck is solving a composition problem with a
     font size, which is the thing that made the old deck unreadable. Density is
     enforced upstream, at compose time, by the caps in blocks.ts and the
     character budget in renderer.ts; this is only the safety net under them. */
  var FLOOR = 0.85;

  /* Below this the deck stops scaling a 1920px canvas and becomes a scrolling
     document at real reading sizes. See the reading-mode block in the CSS. */
  function reading(){ return innerWidth <= 820; }

  function fit(){
    if (reading()) { stage.style.transform = ''; return; }
    var s = Math.min(innerWidth/1920, innerHeight/1080);
    stage.style.transform =
      'translate(' + ((innerWidth-1920*s)/2) + 'px,' + ((innerHeight-1080*s)/2) + 'px) scale(' + s + ')';
  }
  addEventListener('resize', function(){ fit(); fitBoxes(); }); fit();

  /* Shrink-to-fit, with a hard floor. A page that still overflows at the floor
     keeps the floor and says so — it does not go on shrinking. An unreadable
     slide is a worse outcome than a visibly overfull one, because the second
     kind gets fixed. */
  function fitBoxes(){
    /* Nothing to fit in reading mode: the pages grow to their content and the
       viewport scrolls, which is the whole point of it. */
    if (reading()) {
      pages.forEach(function(p){
        var box = p.querySelector('.fitbox');
        if (box) box.style.cssText = '';
        p.removeAttribute('data-overflow');
      });
      return;
    }
    pages.forEach(function(p){
      var box = p.querySelector('.fitbox'); if (!box) return;
      box.style.cssText = '';
      p.removeAttribute('data-overflow');
      var avail = p.querySelector('.page-body').clientHeight;
      if (!avail || box.scrollHeight <= avail) return;
      /* Widening in step with the scale keeps the measure constant, so it takes
         two or three passes to settle. The explicit height is what keeps the
         page vertically centred — a transform does not change layout size. */
      var visual = function(s){ box.style.width = (100/s) + '%'; return box.scrollHeight * s; };
      var lo = FLOOR, hi = 1;
      var overflows = visual(FLOOR) > avail;
      if (!overflows) {
        for (var k = 0; k < 8; k++) {
          var mid = (lo + hi) / 2;
          if (visual(mid) > avail) hi = mid; else lo = mid;
        }
      }
      box.style.width = (100 / lo) + '%';
      box.style.transform = 'scale(' + lo + ')';
      box.style.height = (box.scrollHeight * lo) + 'px';
      if (overflows) {
        p.setAttribute('data-overflow', '1');
        var id = p.dataset.section || p.id;
        try {
          console.warn('[deck] "' + id + '" does not fit at the ' + Math.round(FLOOR*100) +
            '% floor (needs ' + Math.round(box.scrollHeight * FLOOR) + 'px of ' + avail +
            'px). Split the section rather than shrinking it further.');
          parent.postMessage({type:'deck:overflow', id:id}, '*');
        } catch(e){}
      }
    });
  }

  function steps(p){ return Array.prototype.slice.call(p.querySelectorAll('.step, .tl-row')); }

  function paint(){
    pages.forEach(function(p,n){ p.classList.toggle('is-current', n===i); });
    var p = pages[i];
    if (p) {
      var st = steps(p);
      if (p.hasAttribute('data-stepped')) st.forEach(function(el,n){ el.classList.toggle('on', n<=step); });
      else st.forEach(function(el){ el.classList.add('on'); });
      document.title = (p.dataset.section || 'proposal') + ' — Start Saudi';
    }
    bar.style.width = ((i+1)/Math.max(1,pages.length)*100) + '%';
    try { history.replaceState(null,'','#' + (pages[i] ? pages[i].id : '')); } catch(e){}
    try { parent.postMessage({type:'deck:page', index:i, id: pages[i] && pages[i].dataset.section}, '*'); } catch(e){}
  }

  function stepCount(){ var p = pages[i]; return p && p.hasAttribute('data-stepped') ? steps(p).length : 0; }
  function go(n, atEnd){
    if (n < 0 || n >= pages.length) return;
    i = n; step = atEnd ? Math.max(0, stepCount()) : (stepCount() ? 1 : 0);
    paint(); fitBoxes();
  }
  function next(){
    var c = stepCount();
    if (c && step < c) { step++; paint(); return; }
    go(i+1);
  }
  function prev(){
    if (stepCount() && step > 1) { step--; paint(); return; }
    go(i-1, true);
  }

  function flash(msg){
    hint.textContent = msg; hint.classList.add('show');
    clearTimeout(hintT); hintT = setTimeout(function(){ hint.classList.remove('show'); }, 1800);
  }

  var EDITABLE = 'h1,h2,h3,p,li,td,th,blockquote,.stat-fig,.stat-cap,.step-title,.step-text,' +
                 '.step-dur,.tl-when,.tl-what,.cover-client,.cover-title,.sig-line';
  function toggleEdit(){
    var on = !document.body.classList.contains('editing');
    document.body.classList.toggle('editing', on);
    document.querySelectorAll(EDITABLE).forEach(function(el){
      if (on) el.setAttribute('contenteditable','true'); else el.removeAttribute('contenteditable');
    });
    flash(on ? 'Edit mode on — click any text' : 'Edit mode off');
  }

  addEventListener('keydown', function(e){
    if (document.body.classList.contains('editing') && e.key !== 'Escape' &&
        !(e.key === 'e' && (e.metaKey||e.ctrlKey))) {
      if (e.target && e.target.isContentEditable) return;
    }
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); go(0); break;
      case 'End': e.preventDefault(); go(pages.length-1, true); break;
      case 'f': case 'F':
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        break;
      case 'p': case 'P': if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); print(); } break;
      case 'e': case 'E': e.preventDefault(); toggleEdit(); break;
      case 'Escape': if (document.body.classList.contains('editing')) toggleEdit(); break;
      default:
        if (/^[1-9]$/.test(e.key) && stepCount()) { step = Math.min(+e.key, stepCount()); paint(); }
    }
  });

  addEventListener('message', function(e){
    var d = e.data || {};
    if (d.type === 'deck:goto') {
      var n = typeof d.index === 'number' ? d.index
            : pages.findIndex(function(p){ return p.dataset.section === d.id; });
      if (n >= 0) { go(n, true); markWriting(d.writing); }
    }
    if (d.type === 'deck:writing') markWriting(d.id);
  });
  function markWriting(id){
    pages.forEach(function(p){ p.classList.toggle('is-writing', !!id && p.dataset.section === id); });
  }

  /* open on the section named in the hash, so a refresh keeps its place */
  var h = location.hash.replace('#','');
  if (h) { var n = pages.findIndex(function(p){ return p.id === h || p.dataset.section === h; }); if (n>=0) i = n; }

  /* Printing lays every page out at once, and fitBoxes can only measure a page
     that is displayed — a hidden one reports a height of zero and is skipped.
     So every page is shown and measured before Chromium takes the snapshot.
     beforeprint covers a person pressing P; the matchMedia listener covers a
     headless export, which switches the media without firing beforeprint. */
  function layOutForPrint(){
    pages.forEach(function(p){ p.classList.add('is-current'); });
    fitBoxes();
  }
  addEventListener('beforeprint', layOutForPrint);
  try {
    var mq = matchMedia('print');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(
      function(e){ if (e.matches) layOutForPrint(); }
    );
  } catch(e){}
  addEventListener('afterprint', function(){ paint(); fitBoxes(); });

  paint();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitBoxes);
  addEventListener('load', fitBoxes);
  setTimeout(fitBoxes, 60);
  flash('← → navigate · E edit · F fullscreen · P print');
})();
`;

/** Wrap rendered sections in the stage shell. `assetPrefix` lets the PDF export point elsewhere. */
export function renderDocument(opts: {
  title: string;
  sectionsHtml: string;
  assetPrefix?: string;
}): string {
  const prefix = opts.assetPrefix ?? '';
  const css = (tokensCss() + DECK_CSS).replace(/url\("assets\//g, `url("${prefix}assets/`);
  const body = opts.sectionsHtml.replace(/src="assets\//g, `src="${prefix}assets/`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.title}</title>
<link rel="icon" href="${prefix}assets/favicon.png">
<style>${css}</style>
</head>
<body>
<div id="progress"></div>
<div id="stage">
${body}
</div>
<div id="hint"></div>
<script>${DECK_JS}</script>
</body>
</html>`;
}
