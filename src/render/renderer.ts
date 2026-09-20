/**
 * blocks[] -> HTML. Deterministic. No model output reaches this file except as
 * text inside a typed slot, and every string goes through escape() first.
 *
 * Two things happen here that are not "turn JSON into tags":
 *
 *   1. `approach_steps` and `timeline` are drawn, not typeset. They come out as
 *      a horizontal path and a calendar spine, built from CSS grid and a little
 *      inline SVG, with no library — the deck has to stay one self-contained
 *      file that opens offline.
 *   2. A section that is too long for one 16:9 page is SPLIT onto a continuation
 *      page before it is rendered. That is the half of the overcrowding fix that
 *      prevents the problem. The shrink-to-fit in the deck's own script is only
 *      the safety net underneath it, and it now stops at 85%.
 */

import type { Block, Section } from './blocks.js';
import { barcodeSvg } from '../brand/barcode.js';

const escape = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The only inline syntax the system supports.
 *   [TO CONFIRM: ...]  ->  a visible highlight. The point of the whole exercise:
 *                          a gap that survives into the shipped document.
 *   **bold** · *italic* · `mono`
 */
export function inline(s: string): string {
  return escape(s)
    .replace(/\[TO CONFIRM:?([^\]]*)\]/g, (_m, rest) => {
      const body = String(rest).trim();
      return `<mark class="to-confirm"><span class="tc-tag">to confirm</span>${body ? ' ' + body : ''}</mark>`;
    })
    .replace(
      /\[page:\s*([a-z0-9-]+)\s*\]/gi,
      (_m, id) => `<span class="pageref" data-ref="${escape(String(id))}">${escape(String(id))}</span>`
    )
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>');
}

/**
 * Resolve `[page: section-id]` markers once the pages are known.
 *
 * Cross-references have to be written before the page count exists, and now
 * that a long section can split onto a continuation slide, a number typed into
 * the copy is wrong the moment anyone edits a paragraph above it. So the copy
 * names the section and the renderer supplies the number.
 *
 * A reference to a section that is not in the document stays visible as the id
 * it names. A silently blank cross-reference is the failure this whole system
 * is built to avoid.
 */
function resolvePageRefs(html: string, pages: Map<string, number>): string {
  return html.replace(
    /<span class="pageref" data-ref="([^"]+)">[^<]*<\/span>/g,
    (whole, id) => {
      const n = pages.get(id);
      return n === undefined
        ? `<mark class="to-confirm"><span class="tc-tag">page ref</span> ${id}</mark>`
        : String(n);
    }
  );
}

/** Paragraph list where a leading "- " makes a bullet. Consecutive bullets group. */
function prose(paragraphs: string[]): string {
  const out: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(`<ul>${bullets.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`);
      bullets = [];
    }
  };
  for (const p of paragraphs) {
    const t = String(p ?? '');
    if (/^\s*[-•]\s+/.test(t)) bullets.push(t.replace(/^\s*[-•]\s+/, ''));
    else {
      flush();
      if (t.trim()) out.push(`<p>${inline(t)}</p>`);
    }
  }
  flush();
  return out.join('');
}

/** The cheapest possible answer to "how do we know it didn't make this up?" */
function sourceTag(sources?: string[]): string {
  if (!sources?.length) return '';
  const list = sources.map((s) => `<li>${escape(s)}</li>`).join('');
  return `<span class="src" tabindex="0" aria-label="Sources"><span class="src-dot"></span><span class="src-pop"><em>Drawn from</em><ul>${list}</ul></span></span>`;
}

/** A step runs alongside the one before it when its own duration says so. */
const isParallel = (duration?: string) => /\bin parallel\b/i.test(String(duration ?? ''));

/**
 * "48 hours, in parallel with step 1" -> "48 hours".
 *
 * The branch in the diagram says the rest, and says it better: the node hangs
 * off step 1 on a dashed line, which is the whole point of drawing this instead
 * of listing it. Leaving the clause in the chip makes it wrap to two lines and
 * repeats in words what the picture already shows.
 */
const durationChip = (duration: string) =>
  duration.replace(/[,;]?\s*\(?\bin parallel\b[^,.;)]*\)?/i, '').trim() || duration;

/** Which side of the calendar line a milestone belongs on. */
function side(who?: string): 'above' | 'below' | 'neutral' {
  const w = String(who ?? '').trim();
  if (!w) return 'neutral';
  return /\byou(r|rs)?\b/i.test(w) ? 'above' : 'below';
}

function renderBlock(b: Block, idx: number): string {
  const src = sourceTag((b as { sources?: string[] }).sources);
  const wrap = (cls: string, inner: string, extra = '') =>
    `<div class="blk blk-${b.type} ${cls}" data-block="${idx}" ${extra}>${inner}${src}</div>`;

  switch (b.type) {
    case 'cover':
      return wrap(
        'cover',
        `<div class="cover-id">
           ${b.reference ? barcodeSvg(b.reference) : ''}
           <span class="lockup lockup-light cover-lockup" role="img" aria-label="Start Saudi"></span>
         </div>
         <div class="cover-body">
           ${b.clientSector ? `<div class="cover-sector">${inline(b.clientSector)}</div>` : ''}
           <h1 class="cover-client">${inline(b.client)}</h1>
           <p class="cover-title">${inline(b.title)}</p>
         </div>
         <div class="cover-foot">
           <div class="cover-meta">${inline(b.date)}${b.reference ? ` <span class="sep">·</span> ${inline(b.reference)}` : ''}</div>
           <div class="cover-endorse">Powered by <strong>Taajeel</strong></div>
         </div>`
      );

    case 'statement':
      return wrap(
        'statement',
        `${b.eyebrow ? `<div class="eyebrow">${inline(b.eyebrow)}</div>` : ''}
         <p class="statement-text">${inline(b.text)}</p>`
      );

    case 'understanding':
      return wrap(
        'understanding',
        `${b.heading ? `<h3>${inline(b.heading)}</h3>` : ''}${prose(b.paragraphs)}`
      );

    /* The path. Steps run left to right along a spine; a step whose duration
       says it runs in parallel drops onto a dashed branch under its anchor, so
       you can see the parallelism before you read the footnote that explains it.
       Each node keeps the class `step`, so the keyboard step-through in the
       deck script walks the diagram exactly as it walked the old list. */
    case 'approach_steps': {
      let lane = 0;
      const lanes = b.steps.map((s) => (isParallel(s.duration) ? Math.max(1, lane) : ++lane));
      const lastMain = b.steps.reduce((acc, s, i) => (isParallel(s.duration) ? acc : i), 0);
      /* The node a branch hangs from, so it can draw the top half of the
         dashed connector down to the row below. */
      const anchors = new Set(
        b.steps.flatMap((s, i) => (isParallel(s.duration) ? [lanes[i]] : []))
      );

      const nodes = b.steps
        .map((s, i) => {
          const par = isParallel(s.duration);
          const anchor = !par && anchors.has(lanes[i]);
          /* A branch straddles two columns so it centres on the boundary. The
             last lane has no next column to straddle, so it stays put. */
          const span = par && lanes[i] < lane ? 2 : 1;
          return `<li class="step${par ? ' is-parallel' : ''}${anchor ? ' has-branch' : ''}${
            i === lastMain ? ' is-last' : ''
          }"
             data-step="${i + 1}" style="--lane:${lanes[i]};--span:${span}">
             <span class="step-n">${i + 1}</span>
             <span class="step-main"><span class="step-title">${inline(s.title)}</span>
             <span class="step-text">${inline(s.text)}</span></span>
             ${s.duration ? `<span class="step-dur">${inline(durationChip(s.duration))}</span>` : ''}
             ${par ? '<span class="step-par">in parallel</span>' : ''}
           </li>`;
        })
        .join('');

      return wrap(
        'steps',
        `${b.heading ? `<h3>${inline(b.heading)}</h3>` : ''}
         <div class="path">
           <ol class="path-track" style="--lanes:${Math.max(1, lane)}">${nodes}</ol>
         </div>
         ${b.note ? `<p class="note">${inline(b.note)}</p>` : ''}`,
        `data-steps="${b.steps.length}"`
      );
    }

    /* The calendar spine. Dates run along a horizontal line; `who` decides the
       side — yours above, ours and everyone else's below. Milestone rows keep
       the class `tl-row` for the same step-through reason. */
    case 'timeline': {
      const sides = b.phases.map((p) => side(p.who));
      const showLegend = sides.includes('above') && sides.some((s) => s !== 'above');

      const stops = b.phases
        .map((p, i) => {
          const s = sides[i];
          return `<li class="tl-row is-${s}" data-step="${i + 1}">
             <span class="cal-card">
               ${p.who ? `<span class="tl-who">${inline(p.who)}</span>` : ''}
               <span class="tl-when">${inline(p.when)}</span>
               <span class="tl-what">${inline(p.what)}</span>
             </span>
             <span class="cal-marker" aria-hidden="true"></span>
           </li>`;
        })
        .join('');

      return wrap(
        'timeline',
        `${b.heading ? `<h3>${inline(b.heading)}</h3>` : ''}
         <div class="cal">
           ${
             showLegend
               ? `<div class="cal-legend" aria-hidden="true">
                    <span class="lg-yours">Above the line: yours</span>
                    <span class="lg-ours">Below the line: ours</span>
                  </div>`
               : ''
           }
           <ol class="cal-track">${stops}</ol>
         </div>
         ${b.note ? `<p class="note">${inline(b.note)}</p>` : ''}`,
        `data-steps="${b.phases.length}"`
      );
    }

    case 'two_col':
      return wrap(
        b.variant === 'rail' ? 'two-col rail' : 'two-col',
        `<div class="col col-left"><h3>${inline(b.left.heading)}</h3>${prose(b.left.body)}</div>
         <div class="col col-right"><h3>${inline(b.right.heading)}</h3>${prose(b.right.body)}</div>`
      );

    case 'stat_row':
      return wrap(
        'stats',
        `<div class="stat-grid" data-n="${b.stats.length}">
           ${b.stats
             .map(
               (s) =>
                 `<div class="stat"><div class="stat-fig">${inline(s.figure)}</div><div class="stat-cap">${inline(s.caption)}</div></div>`
             )
             .join('')}
         </div>
         ${b.attribution ? `<p class="note">${inline(b.attribution)}</p>` : ''}`
      );

    case 'table': {
      const cols = b.headers?.length ?? b.rows[0]?.length ?? 2;
      return wrap(
        b.headers ? 'table' : 'table plain',
        `${b.heading ? `<h3>${inline(b.heading)}</h3>` : ''}
         <table data-cols="${cols}">
           ${b.headers ? `<thead><tr>${b.headers.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>` : ''}
           <tbody>${b.rows
             .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
             .join('')}</tbody>
         </table>
         ${b.footnote ? `<p class="note">${inline(b.footnote)}</p>` : ''}`
      );
    }

    case 'team':
      return wrap(
        'team',
        `${b.heading ? `<h3>${inline(b.heading)}</h3>` : ''}
         <div class="team-grid">
           ${b.people
             .map(
               (p) =>
                 `<div class="person"><div class="person-name">${inline(p.name)}</div><div class="person-role">${inline(
                   p.role
                 )}</div><p class="person-bio">${inline(p.bio)}</p></div>`
             )
             .join('')}
         </div>`
      );

    case 'quote':
      return wrap(
        'quote',
        `<blockquote>${inline(b.text)}</blockquote>
         <div class="attrib">${inline(b.attribution)}</div>
         ${b.note ? `<p class="note">${inline(b.note)}</p>` : ''}`
      );

    case 'rtl_section':
      return wrap(
        'rtl',
        `${b.latinHeading ? `<div class="eyebrow ltr">${inline(b.latinHeading)}</div>` : ''}
         <div class="rtl-body" dir="rtl" lang="ar">
           <h3>${inline(b.heading)}</h3>
           ${prose(b.body)}
         </div>`
      );

    case 'close':
      return wrap(
        'close',
        `${b.heading ? `<h3>${inline(b.heading)}</h3>` : ''}
         <p class="cta">${inline(b.cta)}</p>
         ${
           b.signatories?.length
             ? `<div class="sig-grid">${b.signatories
                 .map(
                   (s) =>
                     `<div class="sig"><div class="sig-party">${inline(s.party)}</div>${s.lines
                       .map((l) => `<div class="sig-line">${inline(l)}</div>`)
                       .join('')}</div>`
                 )
                 .join('')}</div>`
             : ''
         }
         <div class="contact">${b.contact.map((c) => `<div>${inline(c)}</div>`).join('')}</div>`
      );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   The density budget
   ──────────────────────────────────────────────────────────────────────────
   Overcrowding used to be invisible: the deck shrank the type until anything
   fitted, so a section with nine paragraphs simply became a section set at 8pt.
   The budget below is the compose-time half of the fix. It estimates how tall a
   section will render, in px on the 1920x1080 canvas, and splits it across a
   continuation page before a single tag is written.

   The estimate is deliberately crude — characters, a measure and a line height.
   It does not need to be right to the pixel, only right about "this is two
   pages". Where it is wrong the shrink-to-fit still catches it, down to 85%.
   ══════════════════════════════════════════════════════════════════════════ */

/** 1080, less the page padding, the header rule and the footer rule. Measured. */
const PAGE_BODY_HEIGHT = 752;

/**
 * Split when the estimate says a section will overrun a page by more than 5%.
 *
 * The 15% the deck script can shrink by is there to absorb the ERROR IN THIS
 * ESTIMATE, not to make room for more content. The estimate is a corrected
 * character count against a measure and runs to roughly ±12%; spending the
 * whole shrink range on content as well leaves nothing for it to be wrong
 * with, and the pages where it is wrong are exactly the ones that end up
 * unreadable. Spending none of it goes the other way and fills the deck with
 * half-empty continuation slides.
 *
 * 0.95 is where both the worked example and the frozen golden proposal come
 * out with no page below the floor and the fewest pages. Swept, not guessed —
 * at 0.90 the golden overflows, at 1.00 both decks gain four slides of air.
 */
const SPLIT_BUDGET = PAGE_BODY_HEIGHT / 0.95;

/** .fitbox gap. */
const BLOCK_GAP = 44;

/**
 * Characters, corrected for what they actually cost on the line.
 *
 * A plain character count is the wrong unit: `**bold**` sets about an eighth
 * wider than the same letters in the regular weight, the asterisks themselves
 * do not render at all, and `[TO CONFIRM: x]` renders with a "to confirm" tag
 * in front of it. This proposal's house style is heavily bolded, so ignoring
 * the first of those was worth a systematic 20% error in the estimates — the
 * difference between a page that fits and one that does not.
 */
function weight(text: string): number {
  const s = String(text ?? '');
  let bold = 0;
  s.replace(/\*\*([^*]+)\*\*/g, (_m: string, b: string) => {
    bold += b.length;
    return '';
  });
  const markers = (s.match(/\*\*/g)?.length ?? 0) * 2;
  const tags = (s.match(/\[TO CONFIRM/gi)?.length ?? 0) * 10;
  return Math.max(0, s.length - markers) + bold * 0.14 + tags;
}

const lineCount = (text: string, charsPerLine: number) =>
  Math.max(1, Math.ceil(weight(text) / charsPerLine));

/** Height of a run of paragraphs at a given measure, line height and margin. */
function proseHeight(paragraphs: string[], charsPerLine = BODY_CPL, lh = 53, margin = 20): number {
  return paragraphs.reduce((h, p) => h + lineCount(p, charsPerLine) * lh + margin, 0);
}

/* A 62ch box holds about 74 average characters: `ch` is the advance of "0",
   which is wider than the mean glyph. Measured, not assumed. */
const BODY_CPL = 74;

const H3 = 75; // 42px heading, snug, plus its margin

/**
 * Measure and line height for each column of a two_col, by variant. A rail's
 * left column is 1.5fr of the grid and set at body size; its right column is
 * narrower but set a step down, so the two come out closer than the grid
 * suggests. Getting this wrong in either direction is expensive: too generous
 * and a page overflows, too mean and the deck fills with half-empty
 * continuation slides.
 */
const COLS = (variant?: string) =>
  variant === 'rail'
    ? ({ left: [50, 53], right: [38, 43] } as const)
    : ({ left: [50, 53], right: [50, 53] } as const);
const NOTE = (t?: string) => (t ? lineCount(t, 134) * 32 + 20 : 0);

/** The drawn height of a calendar spine: twice its tallest milestone card. */
function calTrack(phases: Array<{ when: string; what: string; who?: string }>): number {
  const n = Math.max(1, phases.length);
  const track = 1656 - (n - 1) * 24;
  const whatChars = Math.max(10, Math.floor(track / n / 12.4)); // 24px
  const whenChars = Math.max(8, Math.floor(track / n / 14.5)); // 28px
  const card = (p: { when: string; what: string; who?: string }) =>
    (p.who ? 34 : 0) + lineCount(p.when, whenChars) * 35 + 8 + lineCount(p.what, whatChars) * 32 + 20;
  return 2 * Math.max(...phases.map(card));
}

/** Estimated rendered height of one block, in canvas px. */
export function estimateBlockHeight(b: Block): number {
  switch (b.type) {
    case 'cover':
      return 0; // never shares a page and never splits

    case 'statement':
      return (b.eyebrow ? 46 : 0) + lineCount(b.text, 27) * 88;

    case 'understanding':
      return (b.heading ? H3 : 0) + proseHeight(b.paragraphs);

    /* Both diagrams are close to fixed height: the node row, plus one branch row
       if anything runs in parallel. Longer step text grows the row a little. */
    case 'approach_steps': {
      const longest = Math.max(...b.steps.map((s) => (s.title + s.text).length));
      const row = 330 + Math.max(0, lineCount('x'.repeat(longest), 26) - 3) * 32;
      const branch = b.steps.some((s) => isParallel(s.duration)) ? 220 : 0;
      return (b.heading ? H3 : 0) + row + branch + NOTE(b.note);
    }

    case 'timeline': {
      const sides = b.phases.map((p) => side(p.who));
      const legend = sides.includes('above') && sides.some((s) => s !== 'above') ? 60 : 0;
      /* Milestones share the width, so more of them means a narrower card and
         a taller one. The spine splits the track in half, and the tallest card
         on either side sets both halves — hence the doubling. */
      return (b.heading ? H3 : 0) + legend + calTrack(b.phases) + NOTE(b.note);
    }

    case 'two_col': {
      const c = COLS(b.variant);
      return Math.max(
        H3 + proseHeight(b.left.body, c.left[0], c.left[1]),
        H3 + proseHeight(b.right.body, c.right[0], c.right[1])
      );
    }

    case 'stat_row':
      return 290 + NOTE(b.attribution);

    case 'table': {
      const cols = b.headers?.length ?? b.rows[0]?.length ?? 2;
      const perCell = Math.max(16, Math.floor(138 / cols));
      const rows = b.rows.reduce(
        (h, r) => h + Math.max(...r.map((c) => lineCount(c, perCell))) * 43 + 36,
        0
      );
      return (b.heading ? H3 : 0) + (b.headers ? 62 : 0) + rows + NOTE(b.footnote);
    }

    case 'team':
      return (b.heading ? H3 : 0) + 240;

    case 'quote':
      return lineCount(b.text, 26) * 70 + 60 + NOTE(b.note);

    case 'rtl_section':
      return (b.latinHeading ? 46 : 0) + H3 + proseHeight(b.body, 72, 58);

    case 'close':
      return (
        (b.heading ? H3 : 0) +
        lineCount(b.cta, 40) * 55 +
        (b.signatories?.length ? 260 : 0) +
        b.contact.length * 52
      );
  }
}

/** Estimated rendered height of a whole section, gaps included. */
export function estimateSectionHeight(section: Section): number {
  const blocks = section.blocks.reduce((h, b) => h + estimateBlockHeight(b), 0);
  const gaps = Math.max(0, section.blocks.length - 1) * BLOCK_GAP;
  /* A two-column section flows its blocks down one column and up the next, so
     it fits roughly twice as much. Not exactly twice — the columns rarely
     balance — hence 1.9. */
  const divisor = section.appendix || section.columns === 2 ? 1.9 : 1;
  /* The appendix sets its body at 18px against the 34px the estimates assume.
     Height falls with the square of the size: the lines are shorter AND there
     are fewer of them. */
  const scale = section.appendix ? 0.33 : 1;
  return ((blocks + gaps) / divisor) * scale;
}

/** Height of one paragraph at the given measure. */
const paraHeight = (p: string, charsPerLine = BODY_CPL) => lineCount(p, charsPerLine) * 53 + 20;

/**
 * Deal items into the fewest pages that will hold them, filling each to an even
 * share rather than to the brim. Packing greedily gives one full page and one
 * with a paragraph on it, which looks like a mistake even when it is not.
 */
function packPages<T>(
  items: T[],
  heightOf: (t: T) => number,
  fixed: number,
  budget: number,
  gap = 0
): T[][] {
  const hs = items.map(heightOf);
  const total =
    fixed + hs.reduce((a, b) => a + b, 0) + Math.max(0, items.length - 1) * gap;
  const n = Math.max(1, Math.ceil(total / budget));
  const target = total / n;

  const pages: T[][] = [];
  let current: T[] = [];
  let used = fixed;

  items.forEach((item, k) => {
    const add = current.length ? hs[k] + gap : hs[k];
    /* Break when carrying on would land further from the even share than
       stopping does — the nearest-fit rule. Breaking the moment the target is
       crossed instead puts one block on a page and calls it balanced, which is
       how a three-block section became three nineteen-per-cent slides. */
    const nearer = used + add - target > target - used;
    const overfull = used + add > budget;
    if (current.length && (overfull || (nearer && pages.length < n - 1))) {
      pages.push(current);
      current = [item];
      used = fixed + hs[k];
    } else {
      current.push(item);
      used += add;
    }
  });
  if (current.length) pages.push(current);
  return pages;
}

/**
 * Split the two prose containers across pages when one of them is, on its own,
 * taller than a page.
 *
 * Only `understanding` and `two_col` are divisible: they are lists of
 * paragraphs, and a paragraph is a safe place to break. Everything else is
 * atomic — a table stays one table, a diagram stays one diagram, and a quote
 * split down the middle is not a quote. The heading repeats on each part,
 * which is what a continued section does on paper.
 */
function splitBlock(b: Block, budget: number): Block[] {
  if (b.type === 'understanding') {
    if (estimateBlockHeight(b) <= budget) return [b];
    return packPages(b.paragraphs, (p) => paraHeight(p), b.heading ? H3 : 0, budget).map(
      (paragraphs) => ({ ...b, paragraphs })
    );
  }

  if (b.type === 'rtl_section') {
    if (estimateBlockHeight(b) <= budget) return [b];
    return packPages(b.body, (p) => paraHeight(p, 58), H3, budget).map((body) => ({ ...b, body }));
  }

  /* A table breaks between rows, with the header repeated — the one place a
     table is allowed to continue onto another page. The footnote follows the
     last part, where a footnote belongs. */
  /* A spine can carry on over the page — the second half still reads as a
     calendar. An overfull one reads as nothing. */
  if (b.type === 'timeline') {
    if (estimateBlockHeight(b) <= budget) return [b];
    const room = budget - (b.heading ? H3 : 0) - NOTE(b.note) - 60;
    const n = Math.max(2, Math.ceil(calTrack(b.phases) / Math.max(200, room)));
    const per = Math.ceil(b.phases.length / n);
    const out: Block[] = [];
    for (let k = 0; k < b.phases.length; k += per) {
      out.push({ ...b, phases: b.phases.slice(k, k + per), note: undefined });
    }
    if (out.length < 2) return [b];
    const last = out[out.length - 1];
    if (last.type === 'timeline') last.note = b.note;
    return out;
  }

  if (b.type === 'table') {
    if (estimateBlockHeight(b) <= budget) return [b];
    const cols = b.headers?.length ?? b.rows[0]?.length ?? 2;
    const perCell = Math.max(16, Math.floor(138 / cols));
    const rowH = (r: string[]) => Math.max(...r.map((c) => lineCount(c, perCell))) * 43 + 36;
    const head = (b.heading ? H3 : 0) + (b.headers ? 62 : 0);
    /* The footnote lands on the last part, so the rows only get what is left
       after it. Forgetting that is how a table that needed two pages stayed on
       one and overflowed. */
    /* Pack the footnote as a trailing pseudo-row so it takes its space on the
       page it will actually land on, rather than being charged to every page. */
    const FOOT: string[] = [];
    const packed = packPages(
      [...b.rows, FOOT],
      (r) => (r === FOOT ? NOTE(b.footnote) : rowH(r)),
      head,
      budget
    );
    return packed.map((rows) => ({
      ...b,
      rows: rows.filter((r) => r !== FOOT),
      footnote: rows.includes(FOOT) ? b.footnote : undefined,
    }));
  }

  if (b.type === 'two_col') {
    if (estimateBlockHeight(b) <= budget) return [b];
    /* Fill both columns to the budget in step, then cut across. When one side
       runs out first the remainder of the other becomes an `understanding`
       block under its own heading, rather than a half-empty two-column page. */
    const c = COLS(b.variant);
    const out: Block[] = [];
    let i = 0;
    let j = 0;
    const L = b.left.body;
    const R = b.right.body;
    while (i < L.length && j < R.length) {
      const lp: string[] = [];
      const rp: string[] = [];
      let hl = H3;
      let hr = H3;
      while (i < L.length && (!lp.length || hl + lineCount(L[i], c.left[0]) * c.left[1] + 20 <= budget)) {
        hl += lineCount(L[i], c.left[0]) * c.left[1] + 20;
        lp.push(L[i++]);
      }
      while (j < R.length && (!rp.length || hr + lineCount(R[j], c.right[0]) * c.right[1] + 20 <= budget)) {
        hr += lineCount(R[j], c.right[0]) * c.right[1] + 20;
        rp.push(R[j++]);
      }
      out.push({
        ...b,
        left: { heading: b.left.heading, body: lp },
        right: { heading: b.right.heading, body: rp },
      });
    }
    const tail = i < L.length ? { heading: b.left.heading, rest: L.slice(i) } : j < R.length ? { heading: b.right.heading, rest: R.slice(j) } : null;
    if (tail) {
      out.push(
        ...splitBlock(
          { type: 'understanding', heading: tail.heading, paragraphs: tail.rest, sources: b.sources },
          budget
        )
      );
    }
    return out;
  }

  return [b];
}

/**
 * Split any section that will not fit onto continuation pages.
 *
 * A block that is too tall on its own is divided where it can be (see
 * splitBlock) and otherwise gets a page to itself, with the shrink-to-fit
 * taking the remainder. Appendix sections are exempt — they are already set
 * dense and two-column on purpose.
 */
export function splitOverfullSections(sections: Section[]): Section[] {
  const out: Section[] = [];

  for (const section of sections) {
    if (section.appendix || section.blocks.some((b) => b.type === 'cover')) {
      out.push(section);
      continue;
    }

    const budget = SPLIT_BUDGET * (section.columns === 2 ? 1.9 : 1);
    const pages: Block[][] = [];

    /* Divide anything divisible first, then deal the pieces into pages. */
    const divisible = section.blocks.flatMap((b) => splitBlock(b, budget));
    pages.push(...packPages(divisible, estimateBlockHeight, 0, budget, BLOCK_GAP));

    pages.forEach((blocks, n) => {
      out.push(
        n === 0
          ? { ...section, blocks }
          : {
              ...section,
              id: `${section.id}--${n + 1}`,
              title: `${section.title}, continued`,
              blocks,
            }
      );
    });
  }

  return out;
}

/** One section -> one page (one 16:9 slide). */
export function renderSection(
  section: Section,
  pageNumber: number,
  total?: number,
  reference?: string
): string {
  const isCover = section.blocks.some((b) => b.type === 'cover');
  const surface = section.surface ?? (isCover ? 'dark' : 'light');
  const stepped = section.blocks.some((b) => b.type === 'approach_steps' || b.type === 'timeline');
  /* Two-column pages put their blocks inside an inner .cols, so that the
     multicol box and the box the shrink-to-fit resizes are never the same
     element. See the note on .cols in the stylesheet. */
  const flowed = Boolean(section.appendix || section.columns === 2);

  const head = isCover
    ? ''
    : `<header class="page-head">
         <span class="page-title">${escape(section.title)}</span>
         <span class="lockup page-mark ${surface === 'dark' ? 'lockup-light' : 'lockup-dark'}" role="img" aria-label="Start Saudi"></span>
       </header>`;

  const foot = isCover
    ? ''
    : `<footer class="page-foot">
         <span class="foot-id">${
           reference ? barcodeSvg(reference, { mono: true }) : ''
         }<span>Start Saudi · Powered by Taajeel</span></span>
         <span class="pageno">${pageNumber}${total ? ` / ${total}` : ''}</span>
       </footer>`;

  return `<section class="page${isCover ? ' page-cover' : ''}" id="sec-${escape(section.id)}"
    data-section="${escape(section.id)}" data-surface="${surface}"
    ${section.appendix ? 'data-appendix="1"' : ''}
    ${section.columns === 2 ? 'data-columns="2"' : ''}
    ${stepped ? 'data-stepped="1"' : ''}>
    ${head}
    <div class="page-body"><div class="fitbox">${
      flowed
        ? `<div class="cols">${section.blocks.map(renderBlock).join('\n')}</div>`
        : section.blocks.map(renderBlock).join('\n')
    }</div></div>
    ${foot}
  </section>`;
}

export function renderSections(sections: Section[]): string {
  /* The reference lives on the cover block and nowhere else, so pull it out
     once and hand it down: every footer carries the same monochrome strip. */
  const reference = sections
    .flatMap((s) => s.blocks)
    .find((b): b is Extract<Block, { type: 'cover' }> => b.type === 'cover')?.reference;

  const pages = splitOverfullSections(sections);

  /* A continuation keeps its own id too, so "[page: the-path]" lands on the
     first page of the path and "[page: the-path--2]" on the second. */
  const numbers = new Map<string, number>();
  pages.forEach((s, i) => {
    if (!numbers.has(s.id)) numbers.set(s.id, i + 1);
  });

  const html = pages.map((s, i) => renderSection(s, i + 1, pages.length, reference)).join('\n');
  return resolvePageRefs(html, numbers);
}
