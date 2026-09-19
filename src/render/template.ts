/**
 * The stage shell: a fixed 1920x1080 deck scaled to fit the viewport.
 *
 * Every colour in here resolves to a custom property defined in
 * start-saudi-kit/brand/tokens.css, which is read from disk and injected at
 * render time. If a hex literal appears below this line it is a bug.
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
  --pad-inline:132px; --pad-block:88px;
}
.page.is-current { display:flex; }
@media (prefers-reduced-motion:no-preference) {
  .page.is-current > * { animation:rise .34s cubic-bezier(.2,.7,.3,1) both; }
  .page.is-current > .page-body { animation-delay:.05s; }
  @keyframes rise { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
}

.page-head { display:flex; align-items:center; justify-content:space-between; flex:0 0 auto;
  padding-block-end:22px; border-block-end:1px solid var(--ss-hairline); margin-block-end:44px; }
.page-title { font-size:var(--ss-text-sm); text-transform:uppercase;
  letter-spacing:var(--ss-tracking-display); font-weight:400; color:var(--ss-ink-muted); }

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
.page-mark { --lw:152px; opacity:.92; }

.page-body { flex:1 1 auto; min-height:0; display:flex; align-items:center; }
.fitbox { width:100%; flex:0 0 auto; transform-origin:0 0; display:flex; flex-direction:column; gap:34px; }

.page-foot { flex:0 0 auto; display:flex; justify-content:space-between; align-items:flex-end;
  padding-block-start:22px; margin-block-start:34px; border-block-start:1px solid var(--ss-hairline);
  font-size:var(--ss-text-xs); color:var(--ss-ink-muted); letter-spacing:.02em; }
.pageno { font-variant-numeric:tabular-nums; }

/* --- type ----------------------------------------------------------------- */
.page h1 { font-size:var(--ss-text-4xl); line-height:var(--ss-leading-tight); font-weight:200;
  letter-spacing:var(--ss-tracking-display); text-transform:uppercase; margin:0; }
.page h3 { font-size:var(--ss-text-lg); line-height:var(--ss-leading-snug); font-weight:600;
  margin:0 0 14px; letter-spacing:.01em; }
.page p { margin:0 0 14px; font-size:var(--ss-text-lg); line-height:var(--ss-leading-normal);
  max-inline-size:96ch; }
.page p:last-child { margin-block-end:0; }
.page strong { font-weight:700; }
.page code { font-family:var(--ss-font-mono); font-size:.9em; }
.page ul { margin:0 0 14px; padding-inline-start:26px; font-size:var(--ss-text-lg);
  line-height:var(--ss-leading-normal); }
.page li { margin-block-end:8px; }
.eyebrow { font-size:var(--ss-text-sm); text-transform:uppercase; font-weight:500;
  letter-spacing:var(--ss-tracking-display); color:var(--ss-accent); margin-block-end:18px; }
.note { font-size:var(--ss-text-base) !important; color:var(--ss-ink-muted);
  line-height:var(--ss-leading-normal); margin-block-start:18px !important; }

/* the gap that survives into the shipped document */
mark.to-confirm { background:color-mix(in srgb, var(--ss-caution) 22%, transparent);
  color:inherit; border-radius:var(--ss-radius-sm); padding:.08em .38em;
  box-shadow:inset 0 -2px 0 var(--ss-caution); }
mark.to-confirm .tc-tag { font-size:.62em; text-transform:uppercase; font-weight:700;
  letter-spacing:.1em; color:var(--ss-ink-muted); margin-inline-end:.35em; vertical-align:.12em; }

/* --- source provenance ---------------------------------------------------- */
.blk { position:relative; }
.src { position:absolute; inset-block-start:2px; inset-inline-end:-34px; width:24px; height:24px;
  display:grid; place-items:center; cursor:help; opacity:0; transition:opacity .16s; }
.blk:hover .src, .src:focus-visible { opacity:1; }
.src-dot { width:7px; height:7px; border-radius:var(--ss-radius-full); background:var(--ss-accent); }
.src-pop { position:absolute; inset-block-start:26px; inset-inline-end:0; width:330px;
  background:var(--ss-navy); color:var(--ss-cream); padding:14px 16px;
  border-radius:var(--ss-radius-md); box-shadow:var(--ss-shadow-lg);
  font-size:var(--ss-text-xs); line-height:1.5; opacity:0; pointer-events:none; transition:opacity .16s;
  z-index:20; text-align:start; }
.src:hover .src-pop, .src:focus-visible .src-pop { opacity:1; }
.src-pop em { color:var(--ss-green); font-style:normal; text-transform:uppercase;
  letter-spacing:.08em; font-size:10px; }
.src-pop ul { margin:6px 0 0; padding-inline-start:16px; font-size:var(--ss-text-xs); }
.src-pop li { margin-block-end:3px; }

/* --- cover ---------------------------------------------------------------- */
.page-cover { padding:110px 132px; background:var(--ss-navy); position:relative; overflow:hidden; }
.page-cover::before { content:""; position:absolute; inset:0;
  background-image:url("assets/pattern-navy.png"); background-size:760px; opacity:.22; }
.page-cover::after { content:""; position:absolute; inset-block-end:-380px; inset-inline-end:-260px;
  width:900px; height:900px; border-radius:var(--ss-radius-full);
  background:radial-gradient(circle, color-mix(in srgb, var(--ss-green) 16%, transparent), transparent 62%); }
.page-cover .page-body { align-items:stretch; }
.page-cover .fitbox { height:100%; }
.blk-cover { position:relative; z-index:2; height:100%; display:flex; flex-direction:column;
  justify-content:space-between; align-items:flex-start; }
.cover-lockup { --lw:330px; }
.cover-body { margin-block:auto; }
.cover-sector { font-size:var(--ss-text-sm); text-transform:uppercase;
  letter-spacing:var(--ss-tracking-display); color:var(--ss-green); margin-block-end:22px; }
.cover-client { font-size:var(--ss-text-4xl) !important; font-weight:200 !important;
  letter-spacing:var(--ss-tracking-display); text-transform:uppercase; margin:0 0 26px !important;
  color:var(--ss-cream); }
.cover-title { font-size:var(--ss-text-2xl) !important; font-weight:300; color:var(--ss-cream);
  opacity:.92; max-inline-size:26ch; line-height:var(--ss-leading-snug); }
.cover-foot { width:100%; display:flex; justify-content:space-between; align-items:flex-end;
  font-size:var(--ss-text-base); color:var(--ss-neutral-300); }
.cover-endorse strong { color:var(--ss-cream); font-weight:600; }
.cover-meta .sep { opacity:.5; margin-inline:6px; }

.page[data-surface="dark"]:not(.page-cover) { position:relative; }
.page[data-surface="dark"]:not(.page-cover)::before { content:""; position:absolute; inset:0;
  background-image:url("assets/pattern-navy.png"); background-size:900px; opacity:.13; pointer-events:none; }
.page[data-surface="dark"] > * { position:relative; z-index:1; }

/* --- statement ------------------------------------------------------------ */
.blk-statement .statement-text { font-size:var(--ss-text-3xl); line-height:var(--ss-leading-snug);
  font-weight:300; max-inline-size:30ch; margin:0; }
[data-surface="dark"] .blk-statement .statement-text { color:var(--ss-cream); }

/* --- steps ---------------------------------------------------------------- */
ol.steps { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:2px; }
.step { display:grid; grid-template-columns:64px 1fr auto; align-items:baseline; gap:20px;
  padding:16px 18px; border-radius:var(--ss-radius-md); transition:background .2s, opacity .2s; }
.step-n { font-size:var(--ss-text-xl); font-weight:700; color:var(--ss-accent);
  font-variant-numeric:tabular-nums; }
.step-main { display:block; }
.step-title { display:block; font-size:var(--ss-text-lg); font-weight:600; }
.step-text { display:block; font-size:var(--ss-text-base); color:var(--ss-ink-muted); margin-block-start:3px; }
.step-dur { font-size:var(--ss-text-base); font-weight:600; white-space:nowrap;
  padding:5px 13px; border-radius:var(--ss-radius-full);
  background:color-mix(in srgb, var(--ss-accent) 11%, transparent); }
[data-stepped] .step, [data-stepped] .tl-row { opacity:.32; }
[data-stepped] .step.on, [data-stepped] .tl-row.on { opacity:1; }
[data-stepped] .step.on { background:var(--ss-bg-raised); }

/* --- timeline ------------------------------------------------------------- */
ol.tl { list-style:none; margin:0; padding:0; }
.tl-row { display:grid; grid-template-columns:330px 1fr 130px; gap:26px; align-items:baseline;
  padding:17px 0 17px 30px; border-inline-start:2px solid var(--ss-hairline); position:relative;
  transition:opacity .2s; }
.tl-row::before { content:""; position:absolute; inset-inline-start:-7px; inset-block-start:26px;
  width:12px; height:12px; border-radius:var(--ss-radius-full);
  background:var(--ss-accent); box-shadow:0 0 0 4px var(--ss-bg); }
.tl-when { font-weight:700; font-size:var(--ss-text-base); }
.tl-what { font-size:var(--ss-text-base); line-height:var(--ss-leading-normal); }
.tl-who { font-size:var(--ss-text-sm); color:var(--ss-ink-muted); text-align:end;
  text-transform:uppercase; letter-spacing:.06em; }

/* --- two col -------------------------------------------------------------- */
.blk-two_col { display:grid; grid-template-columns:1fr 1fr; gap:64px; }
.blk-two_col.rail { grid-template-columns:1.55fr 1fr; gap:56px; }
.blk-two_col.rail .col-right { background:var(--ss-bg-raised); padding:30px 32px;
  border-radius:var(--ss-radius-lg); border-inline-start:3px solid var(--ss-accent); }
.blk-two_col.rail .col-right p, .blk-two_col.rail .col-right li { font-size:var(--ss-text-base); }

/* --- stats ---------------------------------------------------------------- */
.stat-grid { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:38px; align-items:stretch; }
.stat { padding-inline-start:22px; border-inline-start:3px solid var(--ss-accent);
  display:flex; flex-direction:column; justify-content:space-between; }
.stat-fig { font-size:var(--ss-text-4xl); font-weight:800; line-height:1.05;
  letter-spacing:-.015em; font-variant-numeric:tabular-nums; text-wrap:balance; }
.stat-cap { font-size:var(--ss-text-base); color:var(--ss-ink-muted); margin-block-start:12px;
  line-height:var(--ss-leading-snug); }

/* --- table ---------------------------------------------------------------- */
.blk-table table { width:100%; border-collapse:collapse; font-size:var(--ss-text-base); }
.blk-table th { text-align:start; font-size:var(--ss-text-sm); text-transform:uppercase;
  letter-spacing:var(--ss-tracking-display); font-weight:500; color:var(--ss-ink-muted);
  padding:0 20px 14px 0; border-block-end:2px solid var(--ss-hairline); }
.blk-table td { padding:15px 20px 15px 0; border-block-end:1px solid var(--ss-hairline);
  vertical-align:top; line-height:var(--ss-leading-normal); }
.blk-table tr td:last-child, .blk-table tr th:last-child { padding-inline-end:0; }
.blk-table.plain td:first-child { font-weight:600; width:38%; }
.blk-table tbody tr:last-child td { border-block-end:none; }

/* --- team ----------------------------------------------------------------- */
.team-grid { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:44px; }
.person-name { font-size:var(--ss-text-lg); font-weight:700; }
.person-role { font-size:var(--ss-text-sm); color:var(--ss-accent); text-transform:uppercase;
  letter-spacing:.06em; margin-block:5px 12px; }
.person-bio { font-size:var(--ss-text-base) !important; color:var(--ss-ink-muted); }

/* --- quote ---------------------------------------------------------------- */
.blk-quote blockquote { margin:0; font-size:var(--ss-text-2xl); font-weight:300;
  line-height:var(--ss-leading-snug); padding-inline-start:34px;
  border-inline-start:3px solid var(--ss-accent); max-inline-size:28ch; }
.attrib { margin-block-start:20px; padding-inline-start:37px; font-size:var(--ss-text-base);
  color:var(--ss-ink-muted); }

/* --- RTL: logical properties throughout, so the grid mirrors with no second sheet --- */
.rtl-body { direction:rtl; text-align:start; font-family:var(--ss-font-arabic);
  line-height:var(--ss-leading-loose); }
.rtl-body h3 { font-size:var(--ss-text-xl); font-weight:600; margin-block-end:20px; }
.rtl-body p, .rtl-body li { font-size:var(--ss-text-lg); line-height:var(--ss-leading-loose); }
.rtl-body strong { font-weight:600; }
.rtl-body [dir="ltr"], .rtl-body code { unicode-bidi:isolate; }
.eyebrow.ltr { direction:ltr; }

/* --- close ---------------------------------------------------------------- */
.blk-close .cta { font-size:var(--ss-text-xl) !important; max-inline-size:60ch; }
.sig-grid { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:64px; margin-block:44px 38px; }
.sig { border-block-start:1px solid var(--ss-hairline); padding-block-start:18px; }
.sig-party { font-weight:700; font-size:var(--ss-text-base); margin-block-end:14px; }
.sig-line { font-size:var(--ss-text-base); color:var(--ss-ink-muted); margin-block-end:9px; }
.contact { font-size:var(--ss-text-base); color:var(--ss-ink-muted); line-height:1.75; }

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
.page.is-writing::after { content:"drafting"; position:absolute; inset-block-start:88px;
  inset-inline-end:132px; font-size:11px; text-transform:uppercase; letter-spacing:.12em;
  color:var(--ss-accent); animation:pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 50% { opacity:.35; } }

/* --- print / PDF ---------------------------------------------------------- */
@media print {
  html, body { overflow:visible; background:var(--ss-white); }
  #stage { position:static; transform:none !important; width:auto; height:auto; }
  #progress, #hint { display:none; }
  .page { position:static; display:flex !important; width:1920px; height:1080px;
    page-break-after:always; break-after:page; animation:none !important; }
  .src { display:none; }
}
`;

const DECK_JS = `
(function(){
  var stage = document.getElementById('stage');
  var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));
  var bar   = document.getElementById('progress');
  var hint  = document.getElementById('hint');
  var i = 0, step = 0, hintT;

  function fit(){
    var s = Math.min(innerWidth/1920, innerHeight/1080);
    stage.style.transform =
      'translate(' + ((innerWidth-1920*s)/2) + 'px,' + ((innerHeight-1080*s)/2) + 'px) scale(' + s + ')';
  }
  addEventListener('resize', fit); fit();

  /* Content longer than the page shrinks to fit rather than overflowing.
     Deterministic, and it means a section never has to guess its own length. */
  function fitBoxes(){
    pages.forEach(function(p){
      var box = p.querySelector('.fitbox'); if (!box) return;
      box.style.cssText = '';
      var avail = p.querySelector('.page-body').clientHeight;
      if (!avail || box.scrollHeight <= avail) return;
      /* Shrink to fit. Widening in step with the scale keeps the measure
         constant, so it takes two or three passes to settle. The explicit
         height is what keeps the page vertically centred — a transform does
         not change layout size on its own. */
      var visual = function(s){ box.style.width = (100/s) + '%'; return box.scrollHeight * s; };
      var lo = 0.55, hi = 1;
      for (var k = 0; k < 8; k++) {
        var mid = (lo + hi) / 2;
        if (visual(mid) > avail) hi = mid; else lo = mid;
      }
      box.style.width = (100 / lo) + '%';
      box.style.transform = 'scale(' + lo + ')';
      box.style.height = (box.scrollHeight * lo) + 'px';
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
