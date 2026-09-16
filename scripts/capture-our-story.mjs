/** Our Story habitat (D-268) on the real Our Path component, generated in the Demo Suite worker. Fictional only.
    `node scripts/capture-our-story.mjs` */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';

const out = 'docs/evidence/journey-of-life/story';
mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const proof = await startOurPathWorldProof({ port: 5197 });
const themes = (process.env.THEMES || 'taylor,classic,newfoundland').split(',');
const widths = (process.env.WIDTHS || '1100,390').split(',').map(Number);
const report = [];
for (const theme of themes) for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: width < 720 ? 844 : 800 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const started = Date.now();
  await page.goto(`${proof.url}?story=story&theme=${theme}&motion=reduced&lantern=1`);
  const beat = setInterval(() => { void page.evaluate(() => 1).catch(() => {}); }, 5000);
  // The page must stay responsive while the worker grows the books.
  const responsive = await page.evaluate(() => new Promise((r) => { const t = performance.now(); setTimeout(() => r(performance.now() - t), 50); }));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 900_000 });
  clearInterval(beat);
  // The first frame of a big island on a software renderer is slow; the world's settle redraw follows it.
  await page.waitForTimeout(6000);
  const name = `${theme}-${width}`;
  await page.screenshot({ path: `${out}/${name}-sky.png` });
  const generatedMs = await page.evaluate(() => window.__generatedMs);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  report.push({ name, generatedMs, totalMs: Date.now() - started, mainThreadTimerMs: responsive, overflow, errors });
  if (theme === themes[0]) {
    // The current era card from the home, and a focused future era.
    for (const [label, file] of [[/Our home/i, 'home-card'], [/Our first house/i, 'future-era'], [/Moving in/i, 'past-era'], [/bridge to/i, 'gate']]) {
      const button = page.getByRole('button', { name: label }).first();
      if (await button.count()) { await button.click().catch(() => {}); await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/${name}-${file}.png` }); }
      const close = page.getByRole('button', { name: /^close/i }).first();
      if (await close.count()) await close.click().catch(() => {});
    }
  }
  await context.close();
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await proof.close();
await browser.close();
