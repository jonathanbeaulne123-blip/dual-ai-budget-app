/** Evidence for the Our Path guide slice (fictional books only): Hercules at the tent, his cottage, board photos on
    memory flags, and Home's window onto the island. `node scripts/capture-path-guide.mjs` */
import { chromium } from '@playwright/test';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';
import { startQueenWorldPageProof } from './serve-queen-world-page-proof.mjs';

const out = 'docs/evidence/our-path-world';
const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const report = {};
async function page(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const p = await context.newPage();
  p.on('pageerror', (error) => errors.push(`${width}: ${error.message}`));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function outline(p, text) {
  await p.evaluate(() => { const d = document.querySelector('.path-world__outline'); if (d) d.open = true; });
  await p.locator('.path-world__outline button', { hasText: text }).first().click();
  await p.evaluate(() => { document.querySelector('.path-world__outline').open = false; });
}

const only = process.env.ONLY;
const path = only === 'window' ? null : await startOurPathWorldProof({ port: 5197 });
if (path) try {
  // 1. Hercules waits at the tent; the cottage stands off the first month (Taylor, 1100).
  {
    const p = await page(1100, 860);
    await p.goto(`${path.url}?theme=taylor&story=well&lantern=1&quality=full`);
    await p.waitForFunction(() => window.__ready && document.querySelector('.path-world__host[data-live="true"]'), null, { timeout: 90_000 });
    await p.getByRole('button', { name: 'Region', exact: true }).click();
    await wait(2500);
    report.tentHercules = await p.evaluate(() => { const h = document.querySelector('.path-mark--tent .path-hercules'); const tent = document.querySelector('.path-mark--tent'); return { hercules: Boolean(h), ariaHidden: h?.getAttribute('aria-hidden'), tentShown: tent ? !tent.hidden : false, pose: h?.dataset.pose, cottageShown: !document.querySelector('.path-mark--cottage')?.hidden }; });
    await p.screenshot({ path: `${out}/guide-hercules-taylor-1100.png` });
    // A month card opens the time machine.
    await outline(p, 'We are here');
    await wait(1500);
    await p.getByRole('button', { name: 'Open the time machine' }).click();
    report.timeMachine = await p.evaluate(() => window.__opened);
    await p.context().close();
  }
  // 2. The cottage card (Newfoundland, 390).
  {
    const p = await page(390, 844);
    await p.goto(`${path.url}?theme=newfoundland&story=well&lantern=1&quality=lite`);
    await p.waitForFunction(() => window.__ready && document.querySelector('.path-world__host[data-live="true"]'), null, { timeout: 90_000 });
    await outline(p, "Hercules's cottage");
    await wait(2500);
    await p.evaluate(() => window.scrollTo(0, document.querySelector('.path-world__stage').getBoundingClientRect().top + window.scrollY - 8));
    await wait(300);
    await p.screenshot({ path: `${out}/guide-cottage-card-newfoundland-390.png` });
    await p.getByRole('button', { name: 'Enter the cottage' }).click();
    report.cottage = await p.evaluate(() => window.__opened);
    report.overflow390 = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await p.context().close();
  }
  // 3. Board photos on memory flags (Classic, 1100).
  {
    const p = await page(1100, 860);
    await p.goto(`${path.url}?theme=classic&story=well&lantern=1&quality=full&photos=1`);
    await p.waitForFunction(() => window.__ready && document.querySelector('.path-world__host[data-live="true"]'), null, { timeout: 90_000 });
    await outline(p, 'Shore day');
    await p.evaluate(() => { document.querySelector('.path-world__outline').open = false; window.scrollTo(0, document.querySelector('.path-world__stage').getBoundingClientRect().top + window.scrollY - 8); });
    await wait(3500);
    report.photoCard = await p.locator('.path-world__card').innerText();
    await p.screenshot({ path: `${out}/guide-memory-photo-classic-1100.png` });
    await p.context().close();
  }
  // 4. No WebGL: Hercules beside the tent button (Taylor, 390 and 320).
  for (const width of [390, 320]) {
    const p = await page(width, 844);
    await p.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; });
    await p.goto(`${path.url}?theme=taylor&story=well&lantern=1`);
    await p.waitForFunction(() => window.__ready && document.querySelector('.path-world__flat svg'), null, { timeout: 90_000 });
    await wait(800);
    await p.evaluate(() => window.scrollTo(0, document.querySelector('.path-world__stage').getBoundingClientRect().top + window.scrollY - 8));
    report[`flat-${width}`] = await p.evaluate(() => ({ hercules: Boolean(document.querySelector('.path-world__now > .path-hercules[aria-hidden="true"]')), overflow: document.documentElement.scrollWidth > window.innerWidth, tentWidth: Math.round(document.querySelector('.path-world__tent').getBoundingClientRect().width) }));
    await p.screenshot({ path: `${out}/guide-flat-hercules-taylor-${width}.png` });
    await p.context().close();
  }
} finally { await path?.close(); }

// 5. Home's window (actual App page, Queen's Nest on).
const queen = await startQueenWorldPageProof({ port: 5198 });
try {
  for (const [theme, width] of [['taylor', 1100], ['newfoundland', 390]]) {
    const p = await page(width, 900);
    await p.goto(`${queen.url}?theme=${theme}&habitat=well&today=2026-09-15`);
    // The App settles its books gate after first paint: keep opening Status until the window is there.
    await p.waitForFunction(() => {
      if (document.querySelector('section.queen-window')) return true;
      const door = document.querySelector('.queen-door--status');
      if (door && door.getAttribute('aria-expanded') !== 'true') door.click();
      return false;
    }, null, { timeout: 180_000, polling: 1000 });
    const win = p.locator('section.queen-window');
    await win.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await wait(1500);
    report[`window-${theme}`] = await win.innerText();
    const box = await win.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: Math.max(0, r.x - 12), y: Math.max(0, r.y - 12), width: r.width + 24, height: r.height + 24 }; });
    await p.screenshot({ path: `${out}/guide-home-window-${theme}-${width}.png`, clip: box, timeout: 120_000 });
    report[`window-${theme}-hit`] = await p.getByRole('button', { name: 'Walk the island' }).evaluate((b) => { const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return top === b || b.contains(top) ? 'door' : (top?.className ?? String(top)); });
    await p.getByRole('button', { name: 'Walk the island' }).evaluate((b) => b.click());
    await wait(1500);
    report[`window-${theme}-walked`] = await p.evaluate(() => Boolean(document.querySelector('.path-world')));
    await p.context().close();
  }
} finally { await queen.close(); }
await browser.close();
console.log(JSON.stringify({ report, errors }, null, 2));
