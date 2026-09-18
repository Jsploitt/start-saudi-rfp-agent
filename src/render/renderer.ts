/**
 * blocks[] -> HTML. Deterministic. No model output reaches this file except as
 * text inside a typed slot, and every string goes through escape() first.
 */

import type { Block, Section } from './blocks.js';

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
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>');
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

function renderBlock(b: Block, idx: number): string {
  const src = sourceTag((b as { sources?: string[] }).sources);
  const wrap = (cls: string, inner: string, extra = '') =>
    `<div class="blk blk-${b.type} ${cls}" data-block="${idx}" ${extra}>${inner}${src}</div>`;

  switch (b.type) {
    case 'cover':
      return wrap(
        'cover',
        `<span class="lockup lockup-light cover-lockup" role="img" aria-label="Start Saudi"></span>
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

    case 'approach_steps':
      return wrap(
        'steps',
        `${b.heading ? `<h3>${inline(b.heading)}</h3>` : ''}
         <ol class="steps">
           ${b.steps
             .map(
               (s, i) => `<li class="step" data-step="${i + 1}">
             <span class="step-n">${i + 1}</span>
             <span class="step-main"><span class="step-title">${inline(s.title)}</span>
             <span class="step-text">${inline(s.text)}</span></span>
             ${s.duration ? `<span class="step-dur">${inline(s.duration)}</span>` : ''}
           </li>`
             )
             .join('')}
         </ol>
         ${b.note ? `<p class="note">${inline(b.note)}</p>` : ''}`,
        `data-steps="${b.steps.length}"`
      );

    case 'two_col':
      return wrap(
        b.variant === 'rail' ? 'two-col rail' : 'two-col',
        `<div class="col col-left"><h3>${inline(b.left.heading)}</h3>${prose(b.left.body)}</div>
         <div class="col col-right"><h3>${inline(b.right.heading)}</h3>${prose(b.right.body)}</div>`
      );

    case 'stat_row':
      return wrap(
        'stats',
        `<div class="stat-grid">
           ${b.stats
             .map(
               (s) =>
                 `<div class="stat"><div class="stat-fig">${inline(s.figure)}</div><div class="stat-cap">${inline(s.caption)}</div></div>`
             )
             .join('')}
         </div>
         ${b.attribution ? `<p class="note">${inline(b.attribution)}</p>` : ''}`
      );

    case 'timeline':
      return wrap(
        'timeline',
        `${b.heading ? `<h3>${inline(b.heading)}</h3>` : ''}
         <ol class="tl">
           ${b.phases
             .map(
               (p, i) => `<li class="tl-row" data-step="${i + 1}">
             <span class="tl-when">${inline(p.when)}</span>
             <span class="tl-what">${inline(p.what)}</span>
             ${p.who ? `<span class="tl-who">${inline(p.who)}</span>` : '<span class="tl-who"></span>'}
           </li>`
             )
             .join('')}
         </ol>
         ${b.note ? `<p class="note">${inline(b.note)}</p>` : ''}`,
        `data-steps="${b.phases.length}"`
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

/** One section -> one page (one 16:9 slide). */
export function renderSection(section: Section, pageNumber: number, total?: number): string {
  const isCover = section.blocks.some((b) => b.type === 'cover');
  const surface = section.surface ?? (isCover ? 'dark' : 'light');
  const stepped = section.blocks.some((b) => b.type === 'approach_steps' || b.type === 'timeline');

  const head = isCover
    ? ''
    : `<header class="page-head">
         <span class="page-title">${escape(section.title)}</span>
         <span class="lockup page-mark ${surface === 'dark' ? 'lockup-light' : 'lockup-dark'}" role="img" aria-label="Start Saudi"></span>
       </header>`;

  const foot = isCover
    ? ''
    : `<footer class="page-foot"><span>Start Saudi · Powered by Taajeel</span><span class="pageno">${pageNumber}${
        total ? ` / ${total}` : ''
      }</span></footer>`;

  return `<section class="page${isCover ? ' page-cover' : ''}" id="sec-${escape(section.id)}"
    data-section="${escape(section.id)}" data-surface="${surface}"
    ${stepped ? 'data-stepped="1"' : ''}>
    ${head}
    <div class="page-body"><div class="fitbox">${section.blocks.map(renderBlock).join('\n')}</div></div>
    ${foot}
  </section>`;
}

export function renderSections(sections: Section[]): string {
  return sections.map((s, i) => renderSection(s, i + 1, sections.length)).join('\n');
}
