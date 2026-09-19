/** Main-thread cost of the simple view's read-model on Our Story (D-284/D-285), fictional books only.
    `node scripts/measure-journey-mini.mjs` — writes docs/evidence/journey-simple-view/integrated/performance.json.
    Before: the model as the merged simple view read it (one synchronous miniJourney call in one task).
    After: the page as it ships now (staged loader in a worker), long tasks observed from the moment the household is
    ready until the simple view shows the Fund's lanes. Needs scripts/tmp/our-story.json (capture-journey-game.mjs writes it). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';

const out = process.env.OUT || 'docs/evidence/journey-simple-view/integrated';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const proof = await startOurPathWorldProof({ port: 5201 });
const report = { household: 'Our Story (habitat-story, cached)', runs: [] };
try {
  for (let run = 0; run < 2; run++) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__long = [];
      new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true });
    });
    await page.goto(`${proof.url}?theme=classic&story=story&cached=1&lantern=1&quality=lite&motion=reduced`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 240_000 });
    const readyAt = await page.evaluate(() => performance.now());
    await page.waitForFunction(() => {
      const lanes = [...document.querySelectorAll('.journey-mini [data-place="lane:prepare"]')];
      return lanes.some((b) => /\$/.test(b.getAttribute('aria-label') ?? ''));
    }, null, { timeout: 120_000 });
    const lanesAt = await page.evaluate(() => performance.now());
    const after = await page.evaluate((from) => window.__long.filter((t) => t.at >= from), readyAt);
    // Before: the same model, read the way the merged simple view read it (one call on the main thread).
    const before = await page.evaluate(async () => {
      const { miniJourney } = await import('/src/path/mini/miniJourneyModel.ts');
      const h = window.__household;
      const t0 = performance.now();
      miniJourney(h, { memberId: 'MEM-001', today: '2026-09-16' });
      const one = performance.now() - t0;
      const { miniMonth } = await import('/src/path/mini/miniJourneyModel.ts');
      const t1 = performance.now();
      miniMonth(h, '2026-05', { memberId: 'MEM-001', today: '2026-09-16' });
      return { miniJourneyMs: Math.round(one), otherMonthMs: Math.round(performance.now() - t1) };
    });
    // Scrub to another month: the page stays responsive (the month is read in the worker).
    const scrubFrom = await page.evaluate(() => performance.now());
    await page.evaluate(() => { const b = [...document.querySelectorAll('.journey-mini__levels button')].find((x) => x.textContent === 'Month'); b?.click(); });
    await page.keyboard.press('Tab');
    await page.evaluate(() => { const s = document.querySelector('.journey-mini__scrub input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(s, String(Number(s.value) - 4)); s.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => !document.querySelector('.journey-mini__stage[data-busy="true"]'), null, { timeout: 60_000 });
    const scrubMs = Math.round(await page.evaluate(() => performance.now()) - scrubFrom);
    const scrubLong = await page.evaluate((from) => window.__long.filter((t) => t.at >= from), scrubFrom);
    report.runs.push({
      run,
      before: { ...before, note: 'one main-thread task each, as merged' },
      after: {
        readyToLanesMs: Math.round(lanesAt - readyAt),
        longTasks: after,
        longestTaskMs: Math.max(0, ...after.map((t) => t.ms)),
        anotherMonthMs: scrubMs,
        anotherMonthLongestTaskMs: Math.max(0, ...scrubLong.map((t) => t.ms)),
      },
    });
    console.log(JSON.stringify(report.runs.at(-1)));
    await context.close();
  }
} finally {
  writeFileSync(`${out}/performance.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  await proof.close();
}
