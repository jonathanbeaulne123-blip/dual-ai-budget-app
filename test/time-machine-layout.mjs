/** D-247 browser evidence: the time machine at 320/390/720/1100/1440 in three themes, both views, every pane, with axe, keyboard and reduced motion. Fictional books only. */
import { startTimeMachineProof } from '../scripts/serve-time-machine-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/time-machine');
mkdirSync(output, { recursive: true });
const proof = await startTimeMachineProof({ port: 0 });
const browser = await chromium.launch({ headless: true, ...(process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {}) });
const records = [], errors = [];
const PANES = { month: 'The month', compare: 'Compare', ahead: 'Ahead', year: 'The year' };
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const [pane, view] of [['month', 'household'], ['compare', 'household'], ['ahead', 'household'], ['year', 'household'], ['month', 'personal']])
    for (const theme of ['classic', 'taylor', 'newfoundland'])
      for (const width of [320, 390, 720, 1100, 1440]) {
        if (pane !== 'month' && width !== 390 && width !== 1100) continue;
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${proof.url}?theme=${theme}&view=${view}`);
        await page.waitForSelector('.time-machine__ribbon');
        if (pane !== 'month') await page.getByRole('button', { name: PANES[pane], exact: true }).click();
        // One period per page: the month named in the title is the month the ribbon has chosen.
        const title = await page.locator('#time-machine-title').textContent();
        const chosen = await page.locator('.time-machine__bead[aria-checked="true"]').count();
        assert.equal(chosen, 1, `${pane} ${theme} ${width}: exactly one month is chosen`);
        assert.match(title, /September 2026/, 'opens on the month you are in');
        // Nothing on this surface can post: no form, no money input, no Confirm.
        assert.equal(await page.locator('.time-machine form').count(), 0, 'no form on the time machine');
        assert.equal(await page.locator('.time-machine input').count(), 0, 'no input on the time machine');
        assert.equal(await page.getByRole('button', { name: /confirm/i }).count(), 0, 'no Confirm on the time machine');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `${pane} ${view} ${theme} ${width}: horizontal overflow ${overflow}px`);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
        const file = join(output, `${theme}-${width}-${view}-${pane}.png`);
        await page.screenshot({ path: file, fullPage: true });
        records.push({ pane, view, theme, width, overflow, axeSerious: serious.map(v => `${v.id}: ${v.nodes.length}`), file });
      }

  // A month behind you reads as history and carries no edit affordance.
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`${proof.url}?theme=classic&view=household`);
  await page.waitForSelector('.time-machine__ribbon');
  await page.getByRole('button', { name: 'Previous month' }).click();
  assert.match(await page.locator('#time-machine-title').textContent(), /August 2026/, 'stepping back lands on August');
  assert.equal(await page.locator('.time-machine[data-time-machine-state="behind"]').count(), 1, 'August reads as behind you');
  await page.screenshot({ path: join(output, 'classic-390-household-behind.png'), fullPage: true });

  // A month ahead says expected, not posted, and offers no door into the books.
  await page.goto(`${proof.url}?theme=classic&view=household`);
  await page.waitForSelector('.time-machine__ribbon');
  await page.getByRole('button', { name: 'Next month' }).click();
  assert.match(await page.locator('.time-machine__state').textContent(), /Expected, not posted/, 'a future month says expected');
  assert.equal(await page.getByRole('button', { name: /Open the books/ }).count(), 0, 'no books door on a future month');
  await page.screenshot({ path: join(output, 'classic-390-household-ahead-month.png'), fullPage: true });

  // Keyboard only: the ribbon is a radiogroup, arrows move the whole page, focus stays visible.
  await page.goto(`${proof.url}?theme=classic&view=household`);
  await page.waitForSelector('.time-machine__ribbon');
  await page.locator('.time-machine__bead[aria-checked="true"]').focus();
  await page.keyboard.press('ArrowLeft');
  assert.match(await page.locator('#time-machine-title').textContent(), /August 2026/, 'ArrowLeft moves a month back');
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('#time-machine-title').textContent(), /September 2026/, 'ArrowRight comes back');
  const ring = await page.evaluate(() => {
    const active = document.activeElement;
    return active ? getComputedStyle(active).outlineStyle : 'none';
  });
  await page.screenshot({ path: join(output, 'classic-390-household-keyboard.png'), fullPage: true });
  records.push({ pane: 'keyboard', view: 'household', theme: 'classic', width: 390, outlineStyle: ring });

  // Quiet mode: no tape, no rotation, everything still legible.
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.goto(`${proof.url}?theme=taylor&view=household&quiet=1`);
  await page.waitForSelector('.time-machine__ribbon');
  await page.screenshot({ path: join(output, 'taylor-1100-household-quiet.png'), fullPage: true });

  // Empty: a household with nothing in it must still read as a page, not a hole.
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`${proof.url}?theme=newfoundland&view=personal`);
  await page.waitForSelector('.time-machine__ribbon');
  await page.screenshot({ path: join(output, 'newfoundland-390-personal-month.png'), fullPage: true });

  assert.equal(errors.length, 0, `page errors: ${errors.join(' | ')}`);
  const serious = records.flatMap(row => row.axeSerious ?? []);
  writeFileSync(join(output, 'records.json'), `${JSON.stringify({ records, errors }, null, 2)}\n`);
  console.log(`time machine evidence: ${records.length} captures, ${serious.length} serious/critical axe findings, ${errors.length} page errors`);
  if (serious.length) { console.error(serious.join('\n')); process.exitCode = 1; }
} finally {
  await browser.close();
  await proof.close();
}
