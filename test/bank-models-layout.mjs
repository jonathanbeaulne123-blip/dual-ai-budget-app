/** Browser evidence for the Queen's household in the cellar (2026-09-16): each sorted bill stands as its umbrella's bank, and the pay
    jars stand as Clink (shifts) and Poise (salary) — frosted before pay day, glazing as contributions arrive after it.
    On the `composition=queen` proof page with `sorted=1&bills=1&cellar3=1` (fictional books only; both flags on), in Classic, Taylor and
    Newfoundland at 320/390/720/1100: the rail with the gate on a bill, on Alex's pay day ahead (glass Poise) and on Sam's pay day
    behind (Clink, contribution); and the gate under reduced motion. Records: the canvas painted, model files fetched, no page
    scroll, no page errors. Writes PNGs and records.json to HEARTH_ARTIFACTS_DIR (default .artifacts/bank-models). */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/bank-models');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0, cellarV3: true, fundModel: true });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const browser = await chromium.launch({ ...exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const records = [], errors = [];
const SIZES = (process.env.SIZES || '320x700,390x844,720x900,1100x800').split(',').map((s) => s.split('x').map(Number));
const THEMES = (process.env.THEMES || 'classic,taylor,newfoundland').split(',');
const url = (theme, extra = {}) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome: '1', state: 'building', sorted: '1', bills: '1', cellar3: '1', today: '2026-09-12', theme, ...extra })}`;
const scroll = (page) => page.evaluate(() => ({ x: document.documentElement.scrollWidth - document.documentElement.clientWidth, y: document.documentElement.scrollHeight - document.documentElement.clientHeight }));
async function cellar(page, width) {
  await page.waitForSelector('.queen-home', { timeout: 180_000 });
  await page.waitForTimeout(600);
  const her = page.locator('.queen-figure'); await her.waitFor({ timeout: 90_000 });
  const b = await her.boundingBox({ timeout: 120_000 }); await her.click({ position: { x: b.width / 2, y: b.height * 0.3 }, timeout: 60_000, force: true });
  await page.waitForSelector('.queen-home.is-expanded', { timeout: 120_000 });
  await page.waitForTimeout(700);
  await page.locator('.queen-bank--protect .queen-bank__button').click({ timeout: 60_000 });
  await page.waitForSelector('.queen-home[data-open="protect"]', { timeout: 120_000 });
  await page.waitForTimeout(500);
  await page.locator(width >= 720 ? '.queen-bank--protect .queen-bank__button' : '.queen-panel .queen-go--primary[data-door="protect"]').click({ timeout: 60_000 });
  await page.waitForSelector('.queen-home[data-scene="cellar"]', { timeout: 120_000 });
  await page.waitForSelector('.queen-room--cellar[data-world="3d"]', { timeout: 120_000 });
}
async function gateTo(page, day) {
  await page.locator('.queen-cellar-rail').focus();
  await page.keyboard.press('Home');
  for (let i = 1; i < day; i += 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
}
/** Wait until every model the rail asks for has arrived (the network goes quiet), then give the renderer a beat. */
async function settle(page, fetched) {
  for (let i = 0; i < 60 && fetched.pending > 0; i += 1) await page.waitForTimeout(500);
  await page.waitForTimeout(2500);
}
const painted = (page) => page.evaluate(() => {
  const c = document.querySelector('.queen-room--cellar .queen-room-world__canvas');
  if (!c) return 0;
  const probe = document.createElement('canvas'); probe.width = 64; probe.height = 64;
  const ctx = probe.getContext('2d'); ctx.drawImage(c, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data; let lit = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) lit += 1;
  return lit / 4096;
});

for (const theme of THEMES) {
  for (const [w, h] of SIZES) {
    for (const motion of theme === 'classic' && w === 390 ? ['full', 'reduced'] : ['full']) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const fetched = { urls: new Set(), pending: 0 };
      page.on('request', (r) => { if (r.url().includes('/models/banks/')) { fetched.urls.add(new URL(r.url()).pathname); fetched.pending += 1; } });
      page.on('requestfinished', (r) => { if (r.url().includes('/models/banks/')) fetched.pending -= 1; });
      page.on('requestfailed', (r) => { if (r.url().includes('/models/banks/')) fetched.pending -= 1; });
      page.on('pageerror', (e) => errors.push(`${theme} ${w}: ${e.message}`));
      await page.goto(url(theme));
      await cellar(page, w);
      const tag = `${theme}-${w}x${h}${motion === 'reduced' ? '-reduced' : ''}`;
      // The largest jars, so the models read in the pictures.
      const larger = page.getByRole('button', { name: 'Larger jars' });
      for (let i = 0; i < Number(process.env.ZOOM_STEPS ?? 4) && await larger.isEnabled().catch(() => false); i += 1) { await larger.click(); await page.waitForTimeout(120); }
      for (const [name, day] of [['bill', 5], ['sam-clink', 10], ['alex-poise', 18]]) {
        await gateTo(page, day);
        await settle(page, fetched);
        const s = await scroll(page);
        assert.ok(s.x <= 1, `${tag} ${name}: page scrolls sideways ${JSON.stringify(s)}`);
        const lit = await painted(page);
        const pay = await page.locator('.queen-jar--extra[data-room-vessel]').evaluateAll((els) => els.map((el) => `${el.dataset.kind}:${el.querySelector('[data-modelled]')?.dataset.modelled}`));
        await page.screenshot({ path: join(output, `${name}-${tag}.png`) });
        const rail = await page.locator('.queen-cellar-rail').boundingBox();
        if (rail) await page.screenshot({ path: join(output, `${name}-${tag}-rail.png`), clip: { x: 0, y: Math.max(0, rail.y - 40), width: w, height: Math.min(h - Math.max(0, rail.y - 40), rail.height + 60) } });
        records.push({ theme, width: w, height: h, motion, gate: name, day, canvasLit: +lit.toFixed(3), payJars: pay, models: [...fetched.urls].sort(), scroll: s });
        if (motion === 'reduced' || theme !== 'classic') break;
      }
      await context.close();
    }
  }
}
await browser.close();
await proof.close?.();
writeFileSync(join(output, 'records.json'), JSON.stringify({ records, errors }, null, 2));
assert.deepEqual(errors, [], 'page errors');
const classic = records.some((r) => r.theme === 'classic') ? records.filter((r) => r.theme === 'classic') : records;
assert.ok(classic.every((r) => r.canvasLit > 0.05), 'the room painted');
assert.ok(classic.some((r) => r.payJars.includes('contribution:clink')), 'Sam (shifts) stands as Clink');
assert.ok(classic.some((r) => r.payJars.includes('income:poise')), "Alex's salary stands as Poise");
assert.ok(classic.some((r) => r.models.some((m) => m.includes('pay-clink'))) && classic.some((r) => r.models.some((m) => m.includes('home.v1') || m.includes('utilities.v1'))), 'model files fetched');
console.log(`bank-models evidence: ${records.length} records, ${errors.length} errors → ${output}`);
process.exit(0);
