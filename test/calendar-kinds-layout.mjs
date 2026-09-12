/** Rows 5–7 browser evidence: Calendar kinds, legend-as-filter, multi-day runs and Whisper at 320/390/720/1100 in three themes plus the two dark scenes, with axe. Fictional books only. */
import { startCalendarKindsProof } from '../scripts/serve-calendar-kinds-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/calendar-kinds');
mkdirSync(output, { recursive: true });
const proof = await startCalendarKindsProof({ port: 0 });
const browser = await chromium.launch({ headless: true, ...(process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {}) });
const records = [], errors = [];
const variants = [['classic', 0], ['taylor', 0], ['newfoundland', 0], ['taylor', 1], ['newfoundland', 1]];
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const [theme, dark] of variants) for (const width of dark ? [390, 1100] : [320, 390, 720, 1100]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(`${proof.url}?theme=${theme}&dark=${dark}`);
    await page.waitForSelector('.kind-legend');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${theme} dark=${dark} ${width}: horizontal overflow ${overflow}px`);
    const legend = await page.locator('.kind-legend button').count();
    assert.ok(legend >= 3, `${theme} ${width}: legend lists the kinds on screen (${legend})`);
    assert.equal(await page.locator('.cal-title.is-span').count(), 9, 'two multi-day runs (3 + 6 days) draw nine joined chips');
    const carriers = await page.evaluate(() => [...document.querySelectorAll('.cal-title:not(.more)')].slice(0, 40).map(chip => { const s = getComputedStyle(chip); const g = chip.querySelector('.cal-kind'); return { kind: [...chip.classList].find(c => c.startsWith('kind-')), edge: s.borderLeftWidth, edgeColor: s.borderLeftColor, glyph: g ? getComputedStyle(g).color : null, ink: s.color }; }));
    for (const chip of carriers) {
      if (chip.edge === '0px') continue; // joined middle of a run: the edge belongs to the first chip in the row
      assert.equal(chip.edge, '3px', `${chip.kind}: edge`);
      if (!/quiet|google|detected|other/.test(chip.kind)) assert.notEqual(chip.glyph, chip.ink, `${chip.kind}: glyph carries the kind hue`);
    }
    const contrast = await page.evaluate(() => {
      const channel = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const lum = (color) => { const m = color.match(/#([0-9a-f]{6})/i) || color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); const [r, g, b] = m && m[1] && m[1].length === 6 ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : [Number(m[1]), Number(m[2]), Number(m[3])]; return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
      const card = lum(getComputedStyle(document.documentElement).getPropertyValue('--card').trim());
      return [...document.querySelectorAll('.cal-title .cal-kind')].slice(0, 30).map(g => { const a = lum(getComputedStyle(g).color); return Math.round(((Math.max(a, card) + 0.05) / (Math.min(a, card) + 0.05)) * 100) / 100; });
    });
    for (const ratio of contrast) assert.ok(ratio >= 3, `${theme} dark=${dark}: glyph contrast ${ratio}`);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    const seriousDetail = serious.flatMap(v => v.nodes.slice(0, 3).map(n => `${v.id}: ${n.html.slice(0, 120)}`));
    const file = join(output, `${theme}${dark ? '-dark' : ''}-${width}-calendar.png`);
    await page.screenshot({ path: file, fullPage: true });
    records.push({ theme, dark: Boolean(dark), width, overflow, legend, minGlyphContrast: Math.min(...contrast), axeSerious: serious.map(v => `${v.id}: ${v.nodes.length}`), seriousDetail, file });
  }
  // Legend is the filter: toggling Event hides the runs; the Why aside opens by keyboard and is remembered.
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.goto(`${proof.url}?theme=classic`);
  await page.waitForSelector('.kind-legend');
  await page.locator('.kind-legend button.kind-event').click();
  assert.equal(await page.locator('.cal-title.kind-event').count(), 0, 'Event chips hidden by the legend switch');
  assert.equal(await page.locator('.kind-legend button.kind-event').getAttribute('aria-checked'), 'false');
  await page.locator('.kind-legend button.kind-event').click();
  const aside = page.locator('details.whisper-aside[data-whisper="calendar.google"]');
  if (await aside.count()) {
    await aside.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await aside.evaluate(node => node.open), true, 'Why aside opens from the keyboard');
    await page.waitForFunction(() => localStorage.getItem('hearth:whisper:v1:calendar.google') === 'open', null, { timeout: 5000 });
  }
  await page.screenshot({ path: join(output, 'classic-390-legend-filtered.png'), fullPage: true });
  writeFileSync(join(output, 'records.json'), JSON.stringify({ records, errors }, null, 2));
  const seriousTotal = records.reduce((sum, row) => sum + row.axeSerious.length, 0);
  console.log(`calendar-kinds-layout: ${records.length} captures, ${seriousTotal} serious/critical axe rule hits, ${errors.length} page errors → ${output}`);
  assert.equal(errors.length, 0, errors.join('\n'));
} finally {
  await browser.close();
  await proof.close();
}
