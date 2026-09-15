/** Browser evidence for the loft's studio cats, shelf-tool cards, held saves and money gun, and the cellar's water (2026-09-15).
    On the `composition=queen` proof page (fictional books only), at 320/390/720/1100 in Classic, and at 390/1100 in Taylor and
    Newfoundland: the loft at rest (studio cats sized by goal), the weight's card open, the gun armed with a round thrown (the
    banks swell), the Confirm for the round, a tap off the card closing it; the cellar with its water. No page scroll; axe clean
    on the loft; no page errors. Writes PNGs and records.json to HEARTH_ARTIFACTS_DIR (default .artifacts/queen-loft-gun). */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/queen-loft-gun');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const browser = await chromium.launch({ ...exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const records = [], errors = [];
const RUNS = [
  ['classic', 320, 568], ['classic', 390, 844], ['classic', 720, 900], ['classic', 1100, 800],
  ['taylor', 390, 844], ['taylor', 1100, 800], ['newfoundland', 390, 844], ['newfoundland', 1100, 800],
];
const url = (theme, extra = {}) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome: '1', state: 'building', bills: '1', loft: '1', today: '2026-09-12', theme, ...extra })}`;
const scroll = (page) => page.evaluate(() => ({ x: document.documentElement.scrollWidth - document.documentElement.clientWidth, y: document.documentElement.scrollHeight - document.documentElement.clientHeight }));
async function clickHer(page) { const her = page.locator('.queen-figure'); await her.waitFor(); const b = await her.boundingBox(); await her.click({ position: { x: b.width / 2, y: b.height * 0.3 }, timeout: 60_000 }); }
async function into(page, bank, width) {
  await page.waitForSelector('.queen-home');
  await page.waitForTimeout(600);
  await clickHer(page);
  await page.waitForSelector('.queen-home.is-expanded');
  await page.waitForTimeout(700);
  await page.locator(`.queen-bank--${bank} .queen-bank__button`).click({ timeout: 60_000 });
  await page.waitForSelector(`.queen-home[data-open="${bank}"]`);
  await page.waitForTimeout(500);
  await page.locator(width >= 720 ? `.queen-bank--${bank} .queen-bank__button` : `.queen-panel .queen-go--primary[data-door="${bank}"]`).click({ timeout: 60_000 });
  await page.waitForSelector(`.queen-home[data-scene="${bank === 'protect' ? 'cellar' : 'loft'}"]`);
  await page.waitForTimeout(1500);
}
const shot = (page, name) => page.screenshot({ path: join(output, `${name}.png`) });

const only = process.env.RUNS ? process.env.RUNS.split(',') : null;
for (const [theme, width, height] of RUNS.filter(([t, w, h]) => !only || only.includes(`${t}-${w}x${h}`))) {
  const tag = `${theme}-${width}x${height}`;
  // ---- the loft ----
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  await page.goto(url(theme));
  await into(page, 'build', width);
  const rest = await page.evaluate(() => ({
    world: document.querySelector('.queen-room--loft')?.dataset.world,
    cats: [...document.querySelectorAll('.queen-room--loft [data-ledge-bank]')].map((el) => ({ name: el.getAttribute('aria-label').split(' — ')[0], scale: Number(el.querySelector('[data-room-vessel]').style.getPropertyValue('--bank-scale')), h: Math.round(el.querySelector('[data-room-vessel]').getBoundingClientRect().height) })),
    kitty: document.querySelectorAll('.queen-room--loft .queen-goal__kitty').length,
  }));
  assert.ok(rest.kitty >= 1, `${tag}: studio cats on the rack`);
  const s0 = await scroll(page); assert.ok(s0.x <= 1 && s0.y <= 0, `${tag}: page scrolls ${JSON.stringify(s0)}`);
  await shot(page, `loft-${tag}`);
  // The weight's card.
  await page.locator('.queen-shelf__weight').first().click();
  await page.waitForSelector('.queen-tool-card');
  const card = await page.evaluate(() => { const c = document.querySelector('.queen-tool-card').getBoundingClientRect(), r = document.querySelector('.queen-rack .queen-shelf').getBoundingClientRect(); return { overlapsShelf: c.top < r.bottom - 1 && c.bottom > r.top + 1, title: document.querySelector('.queen-tool-card__title').textContent }; });
  await shot(page, `loft-tool-${tag}`);
  assert.equal(card.overlapsShelf, false, `${tag}: the tool card sits clear of the shelf it adjusts`);
  if (theme === 'classic') {
    const axe = await new AxeBuilder({ page }).include('.queen-room--loft').disableRules(['color-contrast']).analyze();
    assert.deepEqual(axe.violations.map((v) => v.id), [], `${tag}: axe`);
  }
  // A tap off the card closes it.
  await page.mouse.click(8, Math.round(height * 0.55));
  await page.waitForTimeout(150);
  const closed = (await page.locator('.queen-tool-card').count()) === 0;
  assert.ok(closed, `${tag}: a tap outside closes the card`);
  // A slide of the weight is held: the Done mark appears and nothing is sent.
  const w = await page.locator('.queen-shelf__weight').first().boundingBox();
  await page.mouse.move(w.x + w.width / 2, w.y + w.height / 2); await page.mouse.down(); await page.mouse.move(w.x + w.width / 2 + 60, w.y + w.height / 2, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(200);
  const held = await page.locator('.queen-held__mark').count();
  assert.ok(held === 1, `${tag}: a slid weight is held with a Done`);
  await page.locator('.queen-held__done').click();
  await page.waitForTimeout(400);
  // The gun.
  await page.locator('.queen-gun__trigger').click();
  await page.locator('.queen-gun__bill', { hasText: '$100' }).click();
  const target = page.locator('.queen-room--loft .queen-goal--open').first();
  await target.focus();
  for (let i = 0; i < 4; i += 1) { await page.keyboard.press("Enter"); await page.waitForTimeout(90); }
  await page.waitForTimeout(120);
  await shot(page, `loft-gun-${tag}`);
  const gun = await page.evaluate(() => ({ line: document.querySelector('.queen-room--loft .queen-room__line')?.textContent, send: [...document.querySelectorAll('.queen-room--loft .queen-room__acts button')].map((b) => b.textContent) }));
  assert.match(gun.line, /The money gun\. \$[\d,.]+ at /, `${tag}: the round is read`);
  await page.waitForTimeout(900);
  await shot(page, `loft-gun-landed-${tag}`);
  await page.locator('.queen-gun__send').click();
  await page.waitForSelector('[role=dialog].sheet');
  await shot(page, `loft-gun-confirm-${tag}`);
  await page.keyboard.press('Escape');
  const s1 = await scroll(page); assert.ok(s1.x <= 1 && s1.y <= 0, `${tag}: page scrolls with the gun ${JSON.stringify(s1)}`);
  records.push({ tag, rest, card, gun });
  await context.close();
  // ---- the cellar's water ----
  const cellar = await browser.newPage({ viewport: { width, height } });
  cellar.on('pageerror', (e) => errors.push(`${tag} cellar: ${e.message}`));
  await cellar.goto(url(theme));
  await into(cellar, 'protect', width);
  const water = await cellar.evaluate(() => { const el = document.querySelector('.queen-water'); return { height: el?.style.height, name: el?.querySelector('.queen-water__name')?.textContent, body: getComputedStyle(el.querySelector('.queen-water__body')).backgroundImage.includes('gradient') }; });
  assert.ok(water.body, `${tag}: the water has a body`);
  await shot(cellar, `cellar-water-${tag}`);
  records.push({ tag, water });
  await cellar.close();
}
await browser.close();
writeFileSync(join(output, `records${process.env.RUNS ? '-' + process.env.RUNS.replace(/[^a-z0-9]+/gi, '_') : ''}.json`), JSON.stringify({ records, errors }, null, 2));
assert.deepEqual(errors, [], 'page errors');
console.log(`queen-loft-gun-layout: ${records.length} records, 0 errors → ${output}`);
await proof.close?.();
process.exit(0);
