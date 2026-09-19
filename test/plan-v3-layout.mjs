/** Plan Studio v3 browser evidence (D-274…D-278) on the actual components with fictional books only.
    Writes screenshots and records.json to docs/evidence/plan-studio-v3/ (or HEARTH_ARTIFACTS_DIR).
    Set HEARTH_CHROMIUM to a Chromium binary when Playwright's bundled one is not installed. */
import { startPlanV3Proof } from '../scripts/serve-plan-v3-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || 'docs/evidence/plan-studio-v3');
mkdirSync(output, { recursive: true });
const proof = await startPlanV3Proof({ port: 0 });
const browser = await chromium.launch({ headless: true, ...(process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {}) });
const records = [];
const failures = [];

async function open(page, query, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${proof.url}?${query}`);
  await page.locator('.pv3').waitFor();
  await page.waitForTimeout(250);
}
async function measure(page) {
  return page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    // Our own targets only: the embedded Phase 1 sections keep today's sizes.
    const small = [...document.querySelectorAll('.pv3 button, .pv3-veil button, .pv3 summary')]
      .filter(el => !el.closest('.plan-studio, .chapter-close, .ritual-form, .sitdown-brief') && el.getClientRects().length)
      .map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => (r.height < 44 || r.width < 44) && !(el.classList.contains('pv3-link') && r.height >= 44))
      .map(({ el, r }) => `${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    return { overflow, small };
  });
}
async function axe(page, include) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).include(include)
    // The proof banner and the stand-in navigation are not the product.
    .exclude('.proof-banner').exclude('[data-proof-standin]');
  const result = await builder.analyze();
  return result.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`);
}
async function shot(page, name, { full = true } = {}) {
  if (full) {
    const height = await page.evaluate(() => Math.max(900, document.documentElement.scrollHeight));
    const width = page.viewportSize().width;
    await page.setViewportSize({ width, height: Math.min(height, 4000) });
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: join(output, `${name}.png`) });
}
async function record(page, name, errors, extra = {}, axeScope = '.pv3') {
  const m = await measure(page);
  const violations = await axe(page, axeScope);
  console.log('record', name);
  const row = { name, width: page.viewportSize().width, overflow: m.overflow, smallTargets: m.small, axe: violations, pageErrors: [...errors], ...extra };
  records.push(row);
  if (m.overflow > 0) failures.push(`${name}: horizontal overflow ${m.overflow}px`);
  if (m.small.length) failures.push(`${name}: small targets ${m.small.join('; ')}`);
  if (violations.length) failures.push(`${name}: axe ${violations.join(' | ')}`);
  if (errors.length) failures.push(`${name}: page errors ${errors.join(' | ')}`);
  errors.length = 0;
}

try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  // 1. The rest screen: three worlds × four widths.
  for (const theme of ['classic', 'taylor', 'newfoundland']) for (const width of [320, 390, 720, 1100]) {
    await open(page, `theme=${theme}&state=waiting`, width);
    assert.equal(await page.locator('.pv3-cta').count(), 1, 'one primary action');
    await record(page, `rest-${theme}-${width}`, errors);
    await shot(page, `rest-${theme}-${width}`);
  }

  // 2. The rest screen's states (390, and the wide office for two of them).
  for (const [state, extra] of [['agreed', ''], ['short', ''], ['landed', ''], ['first', ''], ['resume', ''], ['badge', ''], ['waiting', '&view=personal'], ['waiting', '&lite=1'], ['agreed', '&dark=1']]) {
    const name = `state-${state}${extra.replace(/[&=]/g, '-')}-390`;
    await open(page, `state=${state}${extra}`, 390);
    await record(page, name, errors, { sentence: await page.locator('.pv3-sent').innerText() });
    await shot(page, name);
  }
  for (const state of ['landed', 'short']) {
    await open(page, `state=${state}&theme=taylor`, 1100);
    await record(page, `state-${state}-taylor-1100`, errors);
    await shot(page, `state-${state}-taylor-1100`);
  }

  // 3. The drawer and a tool, by keyboard, at 390 and 1100, in each world.
  for (const theme of ['classic', 'taylor', 'newfoundland']) for (const width of [390, 1100]) {
    await open(page, `theme=${theme}&state=badge&hint=1`, width);
    const knob = page.getByRole('button', { name: 'Tools', exact: true });
    await knob.focus();
    await page.keyboard.press('Enter');
    assert.equal(await knob.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('[data-badge="on"]').count(), 1, 'one badge at most');
    await record(page, `drawer-open-${theme}-${width}`, errors);
    await shot(page, `drawer-open-${theme}-${width}`, { full: false });
    await page.getByRole('button', { name: 'Got it' }).click();
    const tray = page.getByRole('button', { name: 'Letter tray, between yours and ours, 1 waiting' });
    await tray.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Letter tray' });
    await dialog.waitFor();
    assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'focus moves into the sheet');
    await page.waitForTimeout(200);
    await record(page, `tool-letter-${theme}-${width}`, errors, {}, '.pv3-veil');
    await shot(page, `tool-letter-${theme}-${width}`, { full: false });
    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
    assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'Tab stays inside the sheet');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Letter tray, between yours and ours, 1 waiting', 'focus returns to the tray');
  }

  // 4. Tap a fund: its lane lights and its lines open; the flow panel's list.
  await open(page, 'state=agreed', 390);
  await page.getByRole('button', { name: /^Protect, our backup/ }).click();
  assert.equal(await page.locator('.pv3-flow').getAttribute('data-highlight'), 'protect');
  await record(page, 'fund-protect-390', errors, {}, '.pv3-veil');
  await shot(page, 'fund-protect-390', { full: false });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Show as a list' }).click();
  const stone = page.locator('.pv3-stonebtn').nth(10);
  await stone.focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''), /^Sat, Sep 12/);
  await record(page, 'flow-list-keyboard-390', errors);
  await shot(page, 'flow-list-keyboard-390');

  // 5. The check-in: every step, pause and resume, per-person agreement, the Sitdown and the island.
  for (const width of [320, 390, 1100]) {
    await open(page, 'state=waiting&tent=1', width);
    await page.getByRole('button', { name: 'Two chairs, start our check-in together' }).click();
    await page.getByRole('dialog', { name: 'Two chairs' }).getByRole('button', { name: /^Start our check-in together/ }).click();
    const step = async id => { await page.locator(`.pv3-checkin[data-step="${id}"]`).waitFor(); assert.equal(await page.evaluate(() => document.activeElement?.id), 'pv3-step-h', 'the step heading takes focus'); };
    await step('hello');
    if (width === 390) { await record(page, 'checkin-hello-390', errors); await shot(page, 'checkin-hello-390'); }
    await page.getByRole('button', { name: "We're doing this together" }).click();
    await step('back');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await step('in');
    await record(page, `checkin-in-${width}`, errors);
    await shot(page, `checkin-in-${width}`);
    await page.getByRole('button', { name: 'What if a pay is late?' }).click();
    await page.getByRole('dialog', { name: 'Tracing paper' }).getByRole('tab', { name: 'A pay runs late', selected: true }).waitFor();
    if (width !== 320) { await record(page, `lookcloser-late-${width}`, errors, {}, '.pv3-veil'); await shot(page, `lookcloser-late-${width}`, { full: false }); }
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Looks right' }).click();
    await step('prepare');
    if (width === 390) { await record(page, 'checkin-prepare-390', errors); await shot(page, 'checkin-prepare-390'); }
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.locator('.pv3-toast').waitFor();
    assert.match(await page.locator('.pv3-cta').innerText(), /Continue where we left off/);
    if (width === 390) await shot(page, 'paused-390', { full: false });
    await page.getByRole('button', { name: 'Switch fictional member' }).click();
    await page.locator('.pv3-cta').click();
    await step('prepare');
    await page.getByRole('button', { name: 'All here', exact: true }).click();
    await step('protect');
    await page.getByRole('button', { name: 'Looks right' }).click();
    await step('build');
    await page.getByRole('button', { name: 'Looks right' }).click();
    await step('everyday');
    if (width === 390) { await record(page, 'checkin-everyday-390', errors); await shot(page, 'checkin-everyday-390'); }
    await page.getByRole('button', { name: 'Feels livable' }).click();
    await step('together');
    await page.getByRole('button', { name: /^I agree to this plan/ }).click();
    await page.getByRole('img', { name: /Sam \(fictional\) agreed/ }).waitFor();
    assert.match(await page.locator('.pv3-seal').getAttribute('aria-label'), /Alex \(fictional\) not yet/);
    await record(page, `checkin-together-${width}`, errors);
    await shot(page, `checkin-together-${width}`);
    await page.getByRole('button', { name: 'Switch fictional member' }).click();
    await page.locator('.pv3-cta').click();
    // Alex picks the check-in up where it was paused and walks to the page.
    await step('prepare');
    for (const answer of ['All here', 'Looks right', 'Looks right', 'Feels livable']) await page.getByRole('button', { name: answer, exact: true }).click();
    await step('together');
    await page.getByRole('button', { name: /^I agree to this plan/ }).click();
    await page.getByText('Agreed by both of you.').waitFor();
    await page.getByRole('button', { name: 'Next: the Sitdown' }).click();
    await step('sitdown');
    await page.getByRole('button', { name: /^Close the Sitdown with our agreed plan/ }).click();
    await page.locator('.pv3-set').waitFor();
    await record(page, `checkin-sitdown-set-${width}`, errors);
    await shot(page, `checkin-sitdown-set-${width}`);
    await page.getByRole('button', { name: 'See it on our island' }).click();
    await page.getByText('Back on the island (proof)').first().waitFor();
    await page.getByRole('button', { name: 'Back to the plan' }).click();
    assert.match(await page.locator('.pv3-island').innerText(), /Set on our island/);
    if (width === 390) await shot(page, 'rest-after-sitdown-390');
  }

  // 6. Motion allowed (Full) and Lite at 390: nothing moves in Lite.
  const moving = await browser.newContext({ reducedMotion: 'no-preference' });
  const motionPage = await moving.newPage();
  await open(motionPage, 'state=agreed&lite=0', 390);
  const animated = await motionPage.evaluate(() => document.getAnimations().length);
  await open(motionPage, 'state=agreed&lite=1', 390);
  const animatedLite = await motionPage.evaluate(() => document.getAnimations().length);
  records.push({ name: 'motion', fullAnimations: animated, liteAnimations: animatedLite });
  if (animatedLite !== 0) failures.push(`Lite still animates (${animatedLite})`);
  await moving.close();
  await context.close();
} finally {
  writeFileSync(join(output, 'records.json'), JSON.stringify({ generatedBy: 'test/plan-v3-layout.mjs', data: 'fictional only', failures, records }, null, 2));
  await browser.close();
  await proof.close();
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`plan-v3 layout: ${records.length} records, 0 failures → ${output}`);
