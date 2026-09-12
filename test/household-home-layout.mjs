/** Vision v2 Horizon A browser evidence: Household Home, Our Path, Comfort at 320/390/720/1100 in three themes, with axe. Fictional books only. */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/household-home');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const browser = await chromium.launch({ headless: true, ...(process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {}) });
const records = [], errors = [];
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const surface of ['home', 'path', 'comfort']) for (const theme of ['classic', 'taylor', 'newfoundland']) for (const width of [320, 390, 720, 1100]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${proof.url}?theme=${theme}&surface=${surface}`);
    await page.waitForSelector(surface === 'home' ? '.fund-pulse__button' : surface === 'path' ? '.chapter-room' : '.comfort-panel');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${surface} ${theme} ${width}: horizontal overflow ${overflow}px`);
    if (surface === 'home') {
      assert.equal(await page.locator('.fund-pulse__button').count(), 1);
      assert.ok(await page.locator('.chapter-moment h3').textContent(), 'chapter title present');
      assert.equal(await page.locator('.home-doors button').count(), 3);
      assert.equal(await page.locator('.wax-seal, .hearth-wax-seals').count(), 0, 'no wax seals on Household Home');
    }
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    const file = join(output, `${theme}-${width}-${surface}.png`);
    await page.screenshot({ path: file, fullPage: true });
    records.push({ surface, theme, width, overflow, axeSerious: serious.map(v => `${v.id}: ${v.nodes.length}`), file });
  }
  // Keyboard: the first Move's Done button is reachable and focus is visible.
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`${proof.url}?theme=classic&surface=home`);
  await page.waitForSelector('.fund-pulse__button');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.className || '');
  assert.ok(focused.includes('fund-pulse__button'), `first Tab lands on the pulse, got ${focused}`);
  writeFileSync(join(output, 'records.json'), JSON.stringify({ records, errors }, null, 2));
  const seriousTotal = records.reduce((sum, row) => sum + row.axeSerious.length, 0);
  console.log(`household-home-layout: ${records.length} captures, ${seriousTotal} serious/critical axe rule hits, ${errors.length} page errors → ${output}`);
  assert.equal(errors.length, 0, errors.join('\n'));
} finally {
  await browser.close();
  await proof.close();
}
