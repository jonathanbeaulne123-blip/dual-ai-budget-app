/** D-245 browser evidence: the Planner at 320/390/720/1100 in three themes, both views, with axe, keyboard and reduced motion. Fictional books only. */
import { startPlannerProof } from '../scripts/serve-planner-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/planner');
mkdirSync(output, { recursive: true });
const proof = await startPlannerProof({ port: 0 });
const browser = await chromium.launch({ headless: true, ...(process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {}) });
const records = [], errors = [];
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const surfaces = [['today', 'household'], ['week', 'household'], ['logbook', 'household'], ['lists', 'household'], ['week', 'personal']];
  for (const [tab, view] of surfaces) for (const theme of ['classic', 'taylor', 'newfoundland']) for (const width of [320, 390, 720, 1100]) {
    if (tab !== 'week' && width !== 390 && width !== 1100) continue;
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${proof.url}?theme=${theme}&view=${view}`);
    await page.waitForSelector('.planner-capture');
    if (tab !== 'today') { await page.getByRole('button', { name: { today: 'Today', week: 'This week', logbook: 'Logbook', lists: 'Lists' }[tab] }).click(); }
    if (tab === 'week') { await page.waitForSelector('.planner-afford'); assert.ok((await page.locator('.planner-afford').textContent()).includes('planned'), 'affordability line present'); }
    if (tab === 'week' && view === 'household') {
      assert.equal(await page.locator('.planner-row--task.is-money .planner-row__check').count(), 0, 'no checkbox on money');
      assert.ok((await page.locator('.planner-row--task.is-money').first().textContent()).match(/covered|short/), 'money status on the row');
      assert.equal(await page.locator('text=Surprise for Bianca').count(), 0, 'partner-private task never shown');
    }
    if (tab === 'week' && view === 'personal') assert.equal(await page.locator('text=Surprise for Bianca').count(), 1, 'own private task shown in the personal view');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${tab} ${view} ${theme} ${width}: horizontal overflow ${overflow}px`);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    const file = join(output, `${theme}-${width}-${view}-${tab}.png`);
    await page.screenshot({ path: file, fullPage: true });
    records.push({ tab, view, theme, width, overflow, axeSerious: serious.map(v => `${v.id}: ${v.nodes.length}`), file });
  }
  // Keyboard: capture, add, tick with the keyboard only; focus stays visible and the notice follows the accepted write.
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`${proof.url}?theme=classic&view=household`);
  await page.waitForSelector('#planner-capture');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'planner-capture', 'first Tab lands on capture');
  await page.keyboard.type('pay the vet friday $95');
  assert.ok((await page.locator('.planner-capture__understood').textContent()).includes('$95.00'), 'capture understood money');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.planner-notice');
  await page.getByRole('button', { name: 'This week' }).click();
  assert.equal(await page.locator('.planner-row--task', { hasText: 'Pay the vet' }).count(), 1, 'captured task on the week');
  let reached = false;
  for (let i = 0; i < 80 && !reached; i += 1) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Complete Bins out'); }
  assert.ok(reached, 'the tick is reachable by Tab');
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(ring, 'none', 'visible focus on the tick');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.planner-row--task.is-done');
  await page.screenshot({ path: join(output, 'classic-390-household-keyboard.png'), fullPage: true });
  // Empty state.
  await page.goto(`${proof.url}?theme=classic&view=personal`);
  await page.waitForSelector('.planner-capture');
  await page.getByRole('button', { name: 'Anytime' }).click();
  await page.waitForSelector('.planner-empty');
  await page.screenshot({ path: join(output, 'classic-390-personal-empty.png'), fullPage: true });
  writeFileSync(join(output, 'records.json'), JSON.stringify({ records, errors }, null, 2));
  const seriousTotal = records.reduce((sum, row) => sum + row.axeSerious.length, 0);
  console.log(`planner-layout: ${records.length} captures, ${seriousTotal} serious/critical axe rule hits, ${errors.length} page errors → ${output}`);
  assert.equal(errors.length, 0, errors.join('\n'));
} finally {
  await browser.close();
  await proof.close();
}
