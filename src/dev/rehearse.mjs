/* Rehearsal for beats 9 and 10. Deliberately uses the *conflicting* phrasing of the
   timeline change, because that is the version that failed before the prompt fix. */
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1760, height: 990 } });
const t0 = Date.now();
const el = () => Math.round((Date.now() - t0) / 1000) + 's';

const state = () =>
  p.evaluate(() => {
    const rows = [...document.querySelectorAll('#log li')];
    return {
      done: rows.some((r) => r.className.indexOf('ev-done') >= 0),
      q: document.querySelectorAll('.msg.question').length,
      sections: rows
        .filter((r) => r.className.indexOf('ev-section') >= 0)
        .map((r) => r.querySelector('.what b').textContent),
    };
  });

const say = async (t) => { await p.fill('#answer', t); await p.click('#answerForm button'); };
const waitFor = async (fn, ms) => {
  const s = Date.now();
  while (Date.now() - s < ms) { await p.waitForTimeout(3000); if (await fn()) return true; }
  return false;
};

await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.click('#sample');

await waitFor(async () => (await state()).q > 0, 180000);
console.log(el(), 'answering the gaps');
await say(
  '1) The supplier listing needs only the CR. 2) Yes, we can start the apostille now on the FY2025 accounts. ' +
    '3) The Saudi contract is service and calibration only. 4) Send the structure view to both directors. ' +
    '5) No fixed ceiling. 6) Treat Daniel’s visa as a later engagement.'
);

await waitFor(async () => (await state()).done, 480000);
const built = (await state()).sections.length;
console.log(el(), 'DOCUMENT DONE. renders =', built);

console.log(el(), '--- BEAT 9: Arabic ---');
await say('Give me the executive summary in Arabic as well.');
await p.waitForTimeout(95000);
const afterArabic = (await state()).sections;
console.log(el(), 'Arabic renders =', afterArabic.length - built, '|', afterArabic.slice(built).join(' | '));

console.log(el(), '--- BEAT 10: conflicting timeline instruction ---');
await say('Change the timeline to four months rather than working back from 1 March. Update whatever that affects.');
await p.waitForTimeout(180000);
const afterEdit = (await state()).sections;
console.log(el(), 'timeline renders =', afterEdit.length - afterArabic.length,
  '|', afterEdit.slice(afterArabic.length).join(' | '));
await p.screenshot({ path: 'runs/r-beat10.png' });

const chat = await p.evaluate(() =>
  [...document.querySelectorAll('.msg.agent, .msg.question')].slice(-2).map(m => m.textContent.slice(0, 420)));
console.log('--- last agent turns ---\n' + chat.join('\n---\n'));

await b.close();
