/** Game mode (D-285): the shared focus with a stand-in simple view (?mini=stub), reduced motion, and no WebGL.
    `node scripts/capture-journey-game-sync.mjs` — writes sync-*.png and sync-report.json to docs/evidence/journey-simple-view/game/. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';

const out = process.env.OUT || 'docs/evidence/journey-simple-view/game';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const proof = await startOurPathWorldProof({ port: 5198 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const report = {};
const noWebgl = () => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; };
async function open(width, query, init) {
  const context = await browser.newContext({ viewport: { width, height: width < 720 ? 844 : 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (init) await page.addInitScript(init);
  await page.goto(`${proof.url}?${query}`);
  await page.waitForFunction(() => window.__ready && document.querySelector('.path-world'), null, { timeout: 240_000 });
  await wait(500);
  return { page, errors, close: () => context.close() };
}
const focusText = (page) => page.evaluate(() => [...document.querySelectorAll('[data-focus]')].map((n) => n.textContent));
const landed = (page, level) => page.waitForFunction((l) => document.querySelector('.path-world')?.dataset.level === l, level, { timeout: 90_000 }).catch(() => console.warn('not landed', level));
async function shot(page, errors, file, extra = {}) {
  await page.screenshot({ path: `${out}/${file}` });
  report[file] = { errors: errors.slice(0, 3), focus: await focusText(page), caption: await page.evaluate(() => document.querySelector('.path-hud__caption')?.textContent ?? null), slider: await page.evaluate(() => document.querySelector('.path-world__slider input')?.value), ...extra };
  console.log(file, JSON.stringify(report[file]));
}
try {
  for (const width of [390, 1100]) {
    const { page, errors, close } = await open(width, 'theme=taylor&story=well&eras=demo&lantern=1&quality=lite&motion=full&ambient=off&mini=stub&chrome=1');
    try {
      // The simple view moves to June: the page's Replay follows.
      await page.locator('.path-world__simple button', { hasText: 'June' }).click();
      await wait(300);
      await shot(page, errors, `sync-${width}-1-page-june.png`);
      await page.locator('.path-world__simple button', { hasText: 'Open the world' }).click();
      await page.waitForSelector('.path-world__host[data-live="true"]', { timeout: 120_000 });
      await landed(page, '2');
      await wait(1200);
      await shot(page, errors, `sync-${width}-2-world-june.png`);
      // The person zooms out to Sky in the world: the simple view (corner copy and page copy) reads Journey.
      await page.locator('.path-world__rail button', { hasText: 'Sky' }).click();
      await landed(page, '0');
      await wait(1200);
      await shot(page, errors, `sync-${width}-3-world-sky.png`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.path-world')?.dataset.game, null, { timeout: 20_000 });
      await wait(400);
      await shot(page, errors, `sync-${width}-4-minimized.png`);
    } finally { await close(); }
  }
  // Reduced motion: a cut in, no banner, same HUD.
  {
    const { page, errors, close } = await open(390, 'theme=newfoundland&story=well&eras=demo&lantern=1&quality=lite&motion=reduced&chrome=1');
    try {
      await page.locator('.path-world__open').click();
      await wait(150);
      await shot(page, errors, 'sync-390-reduced-enter.png', { animations: await page.evaluate(() => document.getAnimations().length), banner: await page.evaluate(() => Boolean(document.querySelector('.path-hud__banner'))) });
    } finally { await close(); }
  }
  // No WebGL: the open world is the flat map with the same HUD.
  for (const width of [320, 1100]) {
    const { page, errors, close } = await open(width, 'theme=classic&story=well&eras=demo&lantern=1&motion=reduced&chrome=1', noWebgl);
    try {
      await page.locator('.path-world__open').click();
      await page.waitForSelector('.path-world__stage .path-world__flat svg', { timeout: 30_000 });
      await wait(400);
      await shot(page, errors, `sync-${width}-nowebgl-world.png`);
    } finally { await close(); }
  }
} finally {
  writeFileSync(`${out}/sync-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  await proof.close();
}
