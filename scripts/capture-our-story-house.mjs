/** Our Story (D-268) on the ACTUAL App page (Queen's Nest on): Home, the cellar's bills, the loft's Kitty Banks and the
    Our Path tab, at 1100×800 and 390×844. Fictional books generated on the device only. `node scripts/capture-our-story-house.mjs` */
import { startQueenWorldPageProof } from './serve-queen-world-page-proof.mjs';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = 'docs/evidence/journey-of-life/story-house';
mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const proof = await startQueenWorldPageProof();
const records = [];
for (const [w, h] of [[1100, 800], [390, 844]]) {
  const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('**://fonts.gstatic.com/**', (route) => route.abort());
  await page.goto(`${proof.url}?habitat=story&today=2026-09-16&theme=taylor`, { waitUntil: 'domcontentloaded', timeout: 900000 });
  await page.waitForSelector('.queen-house-rail__stop', { state: 'attached', timeout: 900000 });
  const opened = Date.now();
  await page.waitForFunction(() => document.querySelector('.queen-house-rail__stop') && !document.body.textContent.includes('Validating the local journal'), null, { timeout: 900000, polling: 2000 }).catch(() => {});
  await page.evaluate(() => 1);
  records.push({ width: w, settledAfterRailMs: Date.now() - opened });
  await page.waitForTimeout(3000);
  for (const floor of ['home', 'cellar', 'loft']) {
    if (floor !== 'home') { await page.click(`.queen-house-rail__stop[data-floor='${floor}']`, { timeout: 600000 }); await page.waitForTimeout(2500); }
    const m = await page.evaluate(() => {
      const cellar = document.querySelector('.queen-room--cellar'), loft = document.querySelector('.queen-room--loft');
      return {
        jars: cellar ? [...cellar.querySelectorAll('.queen-jar--bill')].map((el) => el.getAttribute('aria-label')) : [],
        cellarSub: cellar?.querySelector('.queen-room__sub')?.textContent ?? null,
        ledge: loft ? [...loft.querySelectorAll('.queen-goal')].map((el) => el.getAttribute('aria-label')) : [],
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    await page.screenshot({ path: `${out}/${floor}-${w}.png`, timeout: 600000 });
    records.push({ width: w, floor, ...m });
  }
  const tab = page.getByRole('button', { name: /^Our Path$/ }).first();
  if (await tab.count()) { const t = Date.now(); await tab.click({ timeout: 600000 }); await page.evaluate(() => 1); records.push({ width: w, ourPathClickMs: Date.now() - t }); await page.waitForTimeout(8000); await page.screenshot({ path: `${out}/our-path-${w}.png`, timeout: 600000 }); }
  records.push({ width: w, errors });
  await browser.close();
}
writeFileSync(`${out}/records.json`, `${JSON.stringify(records, null, 2)}\n`);
console.log(JSON.stringify(records, null, 2).slice(0, 5000));
await proof.close();
