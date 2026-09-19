/** The Journey of Life on the real Our Path page (D-268), fictional books only.
    `node scripts/capture-journey-of-life-page.mjs` — writes PNGs and report.json to docs/evidence/journey-of-life/page/.
    OUT=<dir> to write elsewhere; THEMES=classic,... and WIDTHS=390,... to narrow a run. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';
import { minimize, onPage, openWorld } from './lib/path-world-game.mjs';

const out = process.env.OUT || 'docs/evidence/journey-of-life/page';
mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const THEMES = (process.env.THEMES || 'classic,taylor,newfoundland').split(',');
const WIDTHS = (process.env.WIDTHS || '390,1100').split(',').map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const noWebgl = () => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; };
const benign = (text) => /GPU stall|GL_CLOSE_PATH|swiftshader|WebGL.*(performance|warning)|Automatic fallback to software WebGL/i.test(text);
const proof = await startOurPathWorldProof({ port: 5194 });
const report = {};

async function open(width, query, { webgl = true } = {}) {
  const height = width < 720 ? 844 : 800;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = { page: [], console: [], failed: [] };
  page.on('response', (r) => { if (r.status() >= 400) errors.failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  page.on('pageerror', (e) => errors.page.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'warning' && /proof journey skipped/.test(m.text())) errors.page.push(m.text());
    if (m.type() !== 'error' || benign(m.text()) || (!webgl && /Error creating WebGL context/.test(m.text()))) return;
    errors.console.push(m.text().slice(0, 200));
  });
  if (!webgl) await page.addInitScript(noWebgl);
  await page.goto(`${proof.url}?${query}`);
  await page.waitForFunction(() => window.__ready && document.querySelector('.path-world'), null, { timeout: 180_000 });
  // Game mode (D-285): the world is built when it is opened; the journey panel and planner are on the page behind it.
  page.__flat = !webgl;
  await openWorld(page, { live: webgl, timeout: 180_000 });
  await wait(1500);
  return { page, errors, close: () => context.close() };
}
async function checks(page, errors) {
  const dom = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    visibleEraMarks: [...document.querySelectorAll('.path-mark[data-place^="era"]')].filter((b) => !b.hidden).map((b) => b.getAttribute('aria-label')),
    card: document.querySelector('.path-world__card h3')?.textContent ?? null,
    amounts: /\$\s?\d/.test([...document.querySelectorAll('.path-mark[data-place^="era"], .path-world__card, .path-planner, .path-world__journey')].map((n) => n.textContent).join(' ')),
  }));
  return { pageErrors: errors.page.slice(0, 3), consoleErrors: errors.console.slice(0, 3), failedRequests: errors.failed.slice(0, 3), ...dom };
}
async function level(page, name) {
  const b = page.locator('.path-world__rail button', { hasText: name }).first();
  if (await b.isEnabled()) { await b.click(); await wait(2600); }
}
async function toStage(page) {
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.path-world__stage').getBoundingClientRect().top + window.scrollY - 4));
  await wait(500);
}
async function press(page, name) {
  // The journey panel is on the page, behind the open world: press there, and the world opens on the place.
  await onPage(page, () => page.getByRole('button', { name, exact: true }).first().click(), { live: !page.__flat });
  await wait(2800);
}
async function shot(page, errors, file, target) {
  if (target === 'stage') await page.locator('.path-world__stage').screenshot({ path: `${out}/${file}` });
  else if (target) await page.locator(target).first().screenshot({ path: `${out}/${file}` });
  else await page.screenshot({ path: `${out}/${file}` });
  report[file] = await checks(page, errors);
  console.log(file, JSON.stringify(report[file]));
}

try {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const quality = width < 720 ? 'lite' : 'full';
      const { page, errors, close } = await open(width, `theme=${theme}&story=well&eras=demo&lantern=1&quality=${quality}`);
      try {
        await toStage(page);
        await level(page, 'Sky');
        await shot(page, errors, `${theme}-sky-${width}.png`, 'stage');
        // A future island, travelled to from the journey list: its fog lifts and the card lists what is planned.
        await press(page, 'Take me to Fictional first house');
        await toStage(page);
        await shot(page, errors, `${theme}-future-${width}.png`, 'stage');
        // A past island and its card.
        await press(page, 'Take me to Fictional furnished flat');
        await toStage(page);
        await shot(page, errors, `${theme}-past-${width}.png`, 'stage');
        // The era we are in: lanterns and why.
        await press(page, 'Where we are: Fictional steady year');
        await toStage(page);
        await shot(page, errors, `${theme}-current-${width}.png`, 'stage');
        // The planner, open on the future era.
        await minimize(page);
        await page.locator('.path-world__head .path-world__plan-journey').click();
        await wait(500);
        await page.locator('.path-planner').screenshot({ path: `${out}/${theme}-planner-${width}.png` });
        report[`${theme}-planner-${width}.png`] = await checks(page, errors);
        await page.getByRole('button', { name: 'Plan Fictional first house', exact: true }).click();
        await wait(500);
        await page.locator('.path-planner').screenshot({ path: `${out}/${theme}-planner-era-${width}.png` });
        report[`${theme}-planner-era-${width}.png`] = await checks(page, errors);
        console.log(`${theme}-planner-${width}`, JSON.stringify(report[`${theme}-planner-era-${width}.png`]));
      } finally { await close(); }
    }
    // No WebGL: the outline and the journey panel reach every era and plan.
    const { page, errors, close } = await open(390, `theme=${theme}&story=well&eras=demo&lantern=1`, { webgl: false });
    try {
      await minimize(page);
      await page.evaluate(() => { document.querySelector('.path-world__outline').open = true; });
      await wait(300);
      report[`${theme}-nowebgl-journey`] = { rows: await page.evaluate(() => [...document.querySelectorAll('.path-world__outline-journey button')].map((b) => b.textContent)) };
      await page.locator('.path-world__journey').screenshot({ path: `${out}/${theme}-nowebgl-journey-390.png` });
      await page.locator('.path-world__outline').screenshot({ path: `${out}/${theme}-nowebgl-outline-390.png` });
      report[`${theme}-nowebgl-outline-390.png`] = await checks(page, errors);
      console.log(`${theme}-nowebgl`, JSON.stringify(report[`${theme}-nowebgl-outline-390.png`]), report[`${theme}-nowebgl-journey`].rows.length);
    } finally { await close(); }
  }
  if (!process.env.WIDTHS) {
    // Once each at 320 and 720, with the gate open and a crossing waiting.
    for (const [theme, width] of [['taylor', 320], ['newfoundland', 720]]) {
      const { page, errors, close } = await open(width, `theme=${theme}&story=well&eras=demo&gate=open&crossing=1&lantern=1&quality=lite`);
      try {
        await toStage(page);
        await level(page, 'Sky');
        await shot(page, errors, `${theme}-sky-crossing-${width}.png`, 'stage');
        await onPage(page, () => page.getByRole('button', { name: /^The bridge ·/ }).click());
        await wait(2800);
        await toStage(page);
        await shot(page, errors, `${theme}-gate-crossing-${width}.png`, 'stage');
        await minimize(page);
        await page.locator('.path-world__head .path-world__plan-journey').click();
        await wait(500);
        await page.getByRole('button', { name: 'Add an era', exact: true }).click();
        await wait(300);
        await page.locator('.path-planner').screenshot({ path: `${out}/${theme}-planner-new-${width}.png` });
        report[`${theme}-planner-new-${width}.png`] = await checks(page, errors);
      } finally { await close(); }
    }
  }
} finally {
  writeFileSync(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  await proof.close();
}
