/** Browser evidence for the cellar's pay glass, contribution banks and missing subscriptions (2026-09-16, D-278/D-279).
    On the `composition=queen` proof page with `bills=1&cellar3=1` (fictional books only), in Classic, Taylor and Newfoundland at
    320/390/720/1100: the rail with the missing mark in the gate; the missing card (its spark burst) as the custodian; the glass pay
    card; the partner's phone with the offer waiting; the custodian's phone after the partner said yes (Confirm open); the rolled
    mark; and the missing card under reduced motion. No page scroll; axe clean inside the cellar (Classic, colour-contrast excluded as
    in the other queen proofs); no page errors. Writes PNGs and records.json to HEARTH_ARTIFACTS_DIR (default .artifacts/cellar-v3). */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/cellar-v3');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const browser = await chromium.launch({ ...exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const records = [], errors = [], picks = [];
// 320×700 is the honest 320 (the 320×568 frame with the chrome stand-ins is the compromised one the earlier cellar evidence names).
const SIZES = [[320, 700], [390, 844], [720, 900], [1100, 800]];
const THEMES = ['classic', 'taylor', 'newfoundland'];
const only = process.env.RUNS ? process.env.RUNS.split(',') : null;
// The App's chrome stand-ins at 800px and taller; the 320×700 frame is measured without them (the honest 320).
let chrome = '1';
const url = (theme, extra = {}) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome, state: 'building', bills: '1', cellar3: '1', today: '2026-09-12', theme, ...extra })}`;
const scroll = (page) => page.evaluate(() => ({ x: document.documentElement.scrollWidth - document.documentElement.clientWidth, y: document.documentElement.scrollHeight - document.documentElement.clientHeight }));
async function clickHer(page) { const her = page.locator('.queen-figure'); await her.waitFor({ timeout: 90_000 }); const b = await her.boundingBox(); await her.click({ position: { x: b.width / 2, y: b.height * 0.3 }, timeout: 60_000, force: true }); }
async function cellar(page, width) {
  await page.waitForSelector('.queen-home', { timeout: 180_000 });
  await page.waitForTimeout(600);
  await clickHer(page);
  await page.waitForSelector('.queen-home.is-expanded', { timeout: 120_000 });
  await page.waitForTimeout(700);
  await page.locator('.queen-bank--protect .queen-bank__button').click({ timeout: 60_000 });
  await page.waitForSelector('.queen-home[data-open="protect"]', { timeout: 120_000 });
  await page.waitForTimeout(500);
  await page.locator(width >= 720 ? '.queen-bank--protect .queen-bank__button' : '.queen-panel .queen-go--primary[data-door="protect"]').click({ timeout: 60_000 });
  await page.waitForSelector('.queen-home[data-scene="cellar"]', { timeout: 120_000 });
  await page.waitForTimeout(1200);
}
/** Walk the gate to a day by the rail's own keys (the slider hides on the shortest frame). */
async function gateTo(page, day) {
  await page.locator('.queen-cellar-rail').focus();
  await page.keyboard.press('Home');
  for (let i = 1; i < day; i += 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
}
async function pick(page, kind) {
  const jar = page.locator(`.queen-jar--extra[data-kind="${kind}"].is-in-gate`).first();
  // A tap where the jar is clear; where the room's line or acts overlap it on a short frame, the keyboard path (focus, Enter).
  try { await jar.click({ timeout: 8_000 }); } catch { await jar.focus(); await page.keyboard.press('Enter'); picks.push(`${kind}:keyboard`); }
  await page.waitForSelector('.queen-jar-card', { timeout: 60_000 });
  await page.waitForTimeout(250);
}
const openPage = async (viewport) => (await browser.newContext({ viewport })).newPage();
const closePage = (page) => page.context().close();
const shot = (page, name) => page.screenshot({ path: join(output, `${name}.png`) });
const noScroll = async (page, tag) => { const s = await scroll(page); assert.ok(s.x <= 1 && s.y <= 0, `${tag}: page scrolls ${JSON.stringify(s)}`); };

for (const theme of THEMES) for (const [width, height] of SIZES) {
  const tag = `${theme}-${width}x${height}`;
  if (only && !only.includes(tag)) continue;
  const full = theme === 'classic' || width === 390 || width === 1100;
  chrome = height >= 800 ? '1' : '0';
  picks.length = 0;
  // ---- the custodian's cellar ----
  const page = await openPage({ width, height });
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  // The 3D world first; SwiftShader sometimes never stands her up here, so the flat world is the fallback (recorded).
  let world = 'auto';
  try { await page.goto(url(theme)); await cellar(page, width); }
  catch { world = 'flat'; await page.goto(url(theme, { world })); await cellar(page, width); }
  const roomWorld = await page.locator('.queen-room--cellar').getAttribute('data-world');
  const rest = await page.evaluate(() => ({
    extras: [...document.querySelectorAll('.queen-jar--extra')].map((el) => ({ kind: el.dataset.kind, label: el.getAttribute('aria-label'), px: el.style.getPropertyValue('--jar-px') })),
    sub: document.querySelector('.queen-room--cellar .queen-room__sub')?.textContent,
    figures: /\$\d/.test(document.querySelector('.queen-cellar-rail')?.textContent ?? ''),
  }));
  assert.deepEqual(rest.extras.map((row) => row.kind).sort(), ['contribution', 'income', 'missing', 'smaller'], `${tag}: the four extra jars stand on the rail`);
  assert.equal(rest.figures, false, `${tag}: no figure on the rail`);
  // The missing video club, in the gate, with the jars sized up (the rail's own + key; one dollar scale).
  await gateTo(page, 5);
  const larger = page.locator('.queen-cellar-zoom__step[aria-label="Larger jars"]');
  const paneShown = await larger.isVisible();
  for (let i = 0; i < 6; i += 1) { if (paneShown) await larger.click(); else { await page.locator('.queen-cellar-rail').focus(); await page.keyboard.press('+'); } }
  await page.waitForTimeout(700);
  const zoomRead = await page.locator('.queen-cellar-rail').getAttribute('data-zoom');
  const gateLine = await page.locator('.queen-room--cellar > .queen-room__line').first().textContent();
  assert.match(gateLine, /Fictional video club — missing: not charged, Sep 5/, `${tag}: the gate names the missing jar`);
  await shot(page, `rail-missing-${tag}`);
  const smallerJars = page.locator('.queen-cellar-zoom__step[aria-label="Smaller jars"]');
  for (let i = 0; i < 6; i += 1) { if (paneShown) await smallerJars.click(); else { await page.locator('.queen-cellar-rail').focus(); await page.keyboard.press('-'); } }
  await noScroll(page, tag);
  await pick(page, 'missing');
  const card = await page.evaluate(() => ({ text: document.querySelector('.queen-jar-card--missing')?.textContent, sparks: document.querySelectorAll('.queen-cellar-cheer i').length, anim: getComputedStyle(document.querySelector('.queen-cellar-cheer i')).animationName }));
  assert.match(card.text, /Fictional video club wasn't charged for Sep 5/, `${tag}: the missing words`);
  assert.equal(card.anim, 'queen-cellar-spark', `${tag}: the sparks play once`);
  await page.waitForTimeout(150);
  await shot(page, `missing-card-${tag}`);
  await noScroll(page, tag);
  if (theme === 'classic') {
    const axe = await new AxeBuilder({ page }).include('.queen-room--cellar').disableRules(['color-contrast']).analyze();
    assert.deepEqual(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => v.id), [], `${tag}: axe`);
  }
  // The smaller music app.
  await page.keyboard.press('Escape');
  await gateTo(page, 3);
  await pick(page, 'smaller');
  const smaller = await page.locator('.queen-jar-card--missing').textContent();
  assert.match(smaller, /came in \$4\.00 lower on Sep 3/, `${tag}: the smaller words`);
  if (full) await shot(page, `smaller-card-${tag}`);
  // Alex's glass pay on the 18th.
  await page.keyboard.press('Escape');
  await gateTo(page, 18);
  await pick(page, 'income');
  const glass = await page.locator('.queen-jar-card--hypothetical').textContent();
  assert.match(glass, /If all of your pay came in/, `${tag}: the glass words`);
  await shot(page, `income-card-${tag}`);
  await noScroll(page, tag);
  if (full) {
    // Sam's contribution bank on the 10th.
    await page.keyboard.press('Escape');
    await gateTo(page, 10);
    await pick(page, 'contribution');
    await shot(page, `contribution-card-${tag}`);
  }
  records.push({ tag, chrome, picks: [...picks], world, roomWorld, rest, zoomRead, gateLine, card: { sparks: card.sparks }, glass: glass.slice(0, 120) });
  await closePage(page);
  if (!full) continue;
  // ---- the partner's phone, the offer waiting ----
  const partner = await openPage({ width, height });
  partner.on('pageerror', (e) => errors.push(`${tag} partner: ${e.message}`));
  await partner.goto(url(theme, { roll: 'offered', member: 'MEM-002', world: 'flat' }));
  await cellar(partner, width);
  await gateTo(partner, 5);
  await pick(partner, 'missing');
  const waiting = await partner.locator('.queen-jar-card--missing').textContent();
  assert.match(waiting, /offers to roll \$18\.00 into Fictional trip to the shore/, `${tag}: the partner sees the offer`);
  assert.equal(await partner.locator('button', { hasText: 'Yes, roll it' }).count(), 1, `${tag}: the partner can say yes`);
  await shot(partner, `partner-offer-${tag}`);
  await noScroll(partner, tag);
  await closePage(partner);
  // ---- the custodian's phone after the yes: Confirm ----
  const agreed = await openPage({ width, height });
  agreed.on('pageerror', (e) => errors.push(`${tag} agreed: ${e.message}`));
  await agreed.goto(url(theme, { roll: 'agreed', world: 'flat' }));
  await cellar(agreed, width);
  await gateTo(agreed, 5);
  await pick(agreed, 'missing');
  await agreed.locator('button', { hasText: 'Roll $18.00 into Fictional trip to the shore' }).click();
  await agreed.waitForSelector('[role=dialog].sheet', { timeout: 60_000 });
  await shot(agreed, `roll-confirm-${tag}`);
  await agreed.locator('[role=dialog].sheet button', { hasText: /^Roll \$18\.00$/ }).click();
  await agreed.waitForTimeout(500);
  const rolled = await agreed.evaluate(() => ({ text: document.querySelector('.queen-jar-card--missing')?.textContent, mark: document.querySelector('.queen-jar--extra[data-kind="missing"] .queen-extrajar__mark')?.textContent }));
  assert.match(rolled.text, /Rolled \$18\.00 into Fictional trip to the shore/, `${tag}: rolled`);
  assert.equal(rolled.mark, '✓', `${tag}: the rolled mark`);
  await shot(agreed, `rolled-${tag}`);
  await noScroll(agreed, tag);
  records.push({ tag, partner: waiting.slice(0, 120), rolled: rolled.text.slice(0, 120) });
  await closePage(agreed);
}
// ---- reduced motion: the sparks stand still ----
for (const [width, height] of [[390, 844], [1100, 800]]) {
  const tag = `reduced-${width}x${height}`;
  chrome = '1';
  if (only && !only.includes(tag)) continue;
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  await page.goto(url('classic', { reduced: '1', world: 'flat' }));
  await cellar(page, width);
  await gateTo(page, 5);
  await pick(page, 'missing');
  const still = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.queen-cellar-cheer i')); return { anim: s.animationName, opacity: s.opacity, wave: getComputedStyle(document.querySelector('.queen-water__wave')).animationName }; });
  assert.equal(still.anim, 'none', `${tag}: no spark animation under reduced motion`);
  await shot(page, `missing-card-${tag}`);
  records.push({ tag, still });
  await context.close();
}
await browser.close();
writeFileSync(join(output, `records${process.env.RUNS ? '-' + process.env.RUNS.replace(/[^a-z0-9]+/gi, '_') : ''}.json`), JSON.stringify({ records, errors }, null, 2));
assert.deepEqual(errors, [], 'page errors');
console.log(`cellar-v3-layout: ${records.length} records, 0 errors → ${output}`);
await proof.close?.();
process.exit(0);
