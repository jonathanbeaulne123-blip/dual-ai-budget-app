/** The Mandevilla Queen browser evidence (D-266): Jonathan's sculpted model standing in the Home world at
    320/390/720/1100 in all three themes — the model arrives (data-queen-model="model"), the page does not scroll,
    the readings stand around her (coins, crown light, kintsugi, new growth, stones), and a model that cannot load
    leaves her drawn figure with no note. Fictional books only. */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/queen-model');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const THEMES = (process.env.HEARTH_PROOF_THEMES || 'classic,taylor,newfoundland').split(',');
const WIDTHS = [[320, 568], [390, 844], [720, 900], [1100, 800]];
const records = [], errors = [];
const url = (params) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome: '1', world: '3d', ...params })}`;
const measure = (page) => page.evaluate(() => {
  const doc = document.documentElement, home = document.querySelector('.queen-home');
  const stats = window.__queenWorldStats ? window.__queenWorldStats() : null;
  return {
    overflowX: doc.scrollWidth - doc.clientWidth, overflowY: doc.scrollHeight - doc.clientHeight,
    world: home?.dataset.world, model: home?.dataset.queenModel ?? null, statsModel: stats?.model ?? null, bankModels: stats?.bankModels ?? null, frames: stats?.frames ?? 0,
    still: document.getElementById(document.querySelector('.queen-figure').getAttribute('aria-describedby'))?.textContent ?? '',
    note: document.querySelector('.kitty-render-note, [role=alert]')?.textContent ?? null,
  };
});

const browser = await chromium.launch({ headless: true, ...exe, args: GL });
try {
  for (const theme of THEMES) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    page.on('pageerror', (error) => errors.push(`${theme}: ${error.message}`));
    for (const [width, height] of WIDTHS) {
      if (theme !== 'classic' && width !== 390 && width !== 1100) continue;
      for (const state of theme === 'classic' ? ['building', 'needs-us'] : ['building']) {
        await page.setViewportSize({ width, height });
        await page.goto(url({ theme, state, charms: 'few', rings: '2' }));
        await page.waitForSelector('.queen-home');
        await page.waitForFunction(() => document.querySelector('.queen-home')?.dataset.queenModel === 'model', null, { timeout: 90000 });
        await page.waitForTimeout(600);
        const m = await measure(page);
        const label = `${theme} ${state} ${width}x${height}`;
        assert.equal(m.world, '3d', label);
        assert.equal(m.statsModel, 'model', label);
        assert.ok(m.overflowX <= 1 && m.overflowY <= 0, `${label}: page scrolls ${m.overflowX}/${m.overflowY}`);
        assert.match(m.still, /Mandevilla Queen/, label);
        assert.match(m.still, /kept for her drawn figure/, label);
        assert.equal(m.note, null, label);
        const file = `model-${theme}-${state}-${width}x${height}.png`;
        await page.screenshot({ path: join(output, file) });
        records.push({ label, ...m, still: m.still.slice(0, 160), file });
        // Expanded: Protect and Build stand as the Guardian and the Mastermind (D-267).
        const her = page.locator('.queen-figure'); const box = await her.boundingBox();
        await her.click({ position: { x: box.width / 2, y: box.height * 0.3 } });
        await page.waitForFunction(() => { const b = window.__queenWorldStats?.().bankModels; return b && b.protect === 'model' && b.build === 'model'; }, null, { timeout: 90000 });
        await page.waitForTimeout(900);
        const e = await measure(page);
        assert.ok(e.overflowX <= 1 && e.overflowY <= 0, `${label} expanded: page scrolls ${e.overflowX}/${e.overflowY}`);
        const expandedFile = `banks-${theme}-${state}-${width}x${height}.png`;
        await page.screenshot({ path: join(output, expandedFile) });
        records.push({ label: `${label} expanded`, ...e, still: e.still.slice(0, 160), file: expandedFile });
        await page.keyboard.press('Escape');
      }
    }
    await context.close();
  }
  // The model refused: her drawn figure stands, silently.
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`refused: ${error.message}`));
  await page.route('**/models/queen/**', (route) => route.abort());
  await page.goto(url({ theme: 'classic', state: 'building' }));
  await page.waitForFunction(() => document.querySelector('.queen-home')?.dataset.queenModel === 'drawn', null, { timeout: 90000 });
  await page.waitForTimeout(600);
  const m = await measure(page);
  assert.equal(m.statsModel, 'drawn');
  const her = page.locator('.queen-figure'); const hb = await her.boundingBox();
  await her.click({ position: { x: hb.width / 2, y: hb.height * 0.3 } });
  await page.waitForFunction(() => { const b = window.__queenWorldStats?.().bankModels; return b && b.protect === 'studio' && b.build === 'studio'; }, null, { timeout: 90000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(output, 'banks-refused-studio-390x844.png') });
  assert.doesNotMatch(m.still, /Mandevilla Queen/);
  assert.equal(m.note, null);
  await page.screenshot({ path: join(output, 'model-refused-drawn-390x844.png') });
  records.push({ label: 'model refused 390x844', ...m, still: m.still.slice(0, 160), file: 'model-refused-drawn-390x844.png' });
  await context.close();
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(join(output, 'queen-model-layout.json'), JSON.stringify({ records, errors }, null, 2));
  await browser.close();
  await proof.close();
}
console.log(JSON.stringify({ ok: true, records: records.length }, null, 2));
