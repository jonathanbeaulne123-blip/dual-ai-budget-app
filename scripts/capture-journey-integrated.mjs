/** The journey's two views together (D-284 + D-285), end to end on the real page, fictional books only.
    `node scripts/capture-journey-integrated.mjs` → docs/evidence/journey-simple-view/integrated/ (JPEGs + report.json).
    Flow: the page's simple view → wheel through Day, Week, Month, Era, Journey → open the world → pick in the world →
    the corner minimap follows → pick in the minimap → the world flies there → Escape → the page, same focus.
    STORIES=well,story THEMES=classic,taylor,newfoundland WIDTHS=320,390,720,1100 narrow a run (rows merge into report.json). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';

const out = process.env.OUT || 'docs/evidence/journey-simple-view/integrated';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const THEMES = (process.env.THEMES || 'classic,taylor,newfoundland').split(',');
const WIDTHS = (process.env.WIDTHS || '320,390,720,1100').split(',').map(Number);
const STORIES = (process.env.STORIES || 'well,story').split(',');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const benign = (t) => /GPU stall|GL_CLOSE_PATH|swiftshader|WebGL.*(performance|warning)|Automatic fallback to software WebGL/i.test(t);
const proof = await startOurPathWorldProof({ port: 5202 });
const reportFile = `${out}/report.json`;
const report = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, 'utf8')) : {};
const storyCache = 'scripts/tmp/our-story.json';

async function open(width, query) {
  const height = width < 720 ? (width < 360 ? 640 : 844) : 800;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width < 720 });
  const page = await context.newPage();
  const errors = { page: [], console: [], failed: [] };
  page.on('pageerror', (e) => errors.page.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !benign(m.text()) && !/Failed to load resource/.test(m.text())) errors.console.push(m.text().slice(0, 200)); });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  await page.goto(`${proof.url}?${query}`);
  await page.waitForFunction(() => window.__ready && document.querySelector('.journey-mini'), null, { timeout: 240_000 });
  // The Fund's lanes have landed (the staged read-model is done).
  await page.waitForFunction(() => [...document.querySelectorAll('.path-world__simple [data-place="lane:prepare"]')].some((b) => /\$|Prepare$/.test(b.getAttribute('aria-label') ?? '')) && !document.querySelector('.path-world__simple .journey-mini__stage[data-busy="true"]'), null, { timeout: 120_000 }).catch(() => console.warn('lanes still reading'));
  await wait(800);
  return { page, errors, close: () => context.close() };
}
const state = (page) => page.evaluate(() => {
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const pageMini = document.querySelector('.path-world__simple .journey-mini');
  const corner = document.querySelector('.path-hud__mini .journey-mini');
  const hudButtons = [...document.querySelectorAll('.path-hud button')].filter(visible);
  return {
    game: document.querySelector('.path-world')?.dataset.game ?? null,
    worldLevel: document.querySelector('.path-world')?.dataset.level ?? null,
    pageMiniLevel: pageMini?.dataset.level ?? null,
    cornerLevel: corner?.dataset.level ?? null,
    pageTitle: pageMini?.querySelector('h2')?.textContent ?? null,
    pageSub: pageMini?.querySelector('.journey-mini__sub')?.textContent ?? null,
    cornerCaption: corner?.querySelector('.journey-mini__compact-caption')?.textContent ?? null,
    caption: document.querySelector('.path-hud__caption')?.textContent ?? null,
    card: document.querySelector('.path-world__card h3')?.textContent ?? null,
    replay: document.querySelector('.path-world__slider input')?.value ?? null,
    slider: document.querySelector('.path-world__when strong')?.textContent ?? null,
    navVisible: visible(document.querySelector('.nav')),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    focus: document.activeElement ? `${document.activeElement.tagName.toLowerCase()}.${String(document.activeElement.className).split(' ')[0]} "${(document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 30)}"` : null,
    smallTargets: hudButtons.filter((b) => { if (b.closest('.path-hud__mini')) return false; const r = b.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((b) => b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 5),
    shimmer: document.querySelectorAll('.journey-mini__shimmer, .path-hud__shimmer').length,
  };
});
async function shot(page, errors, name, extra = {}) {
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 84 });
  report[name] = { ...(await state(page)), ...extra, pageErrors: errors.page.slice(0, 3), consoleErrors: errors.console.slice(0, 3), failed: errors.failed.slice(0, 3) };
  console.log(name, JSON.stringify(report[name]));
}
const levelNow = (page, scope) => page.evaluate((s) => document.querySelector(s)?.dataset.level, scope);
async function wheelTo(page, target) {
  const stage = page.locator('.path-world__simple .journey-mini__stage');
  await stage.scrollIntoViewIfNeeded();
  const box = await stage.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 8; i++) {
    const now = Number(await levelNow(page, '.path-world__simple .journey-mini'));
    if (now === target) break;
    await page.mouse.wheel(0, now < target ? 120 : -120);
    await wait(420);
  }
  await page.waitForFunction(() => !document.querySelector('.path-world__simple .journey-mini__stage[data-busy="true"]'), null, { timeout: 60_000 }).catch(() => undefined);
  await wait(1400);
}
const landed = (page, level) => page.waitForFunction((l) => document.querySelector('.path-world')?.dataset.level === l, level, { timeout: 90_000 }).then(() => true, () => false);

try {
  if (STORIES.includes('story') && !existsSync(storyCache)) {
    const { page, close } = await open(1100, 'theme=classic&story=story&mini=none');
    writeFileSync(storyCache, await page.evaluate(() => JSON.stringify(window.__household)));
    await close();
  }
  for (const story of STORIES) for (const theme of THEMES) for (const width of WIDTHS) {
    const quality = width < 720 ? 'lite' : 'full';
    const query = `theme=${theme}&lantern=1&quality=${quality}&motion=full&ambient=off&chrome=1&${story === 'story' ? 'story=story&cached=1' : 'story=well&eras=demo'}`;
    const tag = `${story}-${theme}-${width}`;
    const { page, errors, close } = await open(width, query);
    try {
      await page.evaluate(() => window.scrollTo(0, document.querySelector('.path-world__simple').getBoundingClientRect().top + window.scrollY - 8));
      await wait(400);
      await shot(page, errors, `${tag}-01-page-week`);
      // Scroll through the five levels on the simple view.
      for (const [level, name] of [[0, '02-day'], [1, '03-week'], [2, '04-month'], [3, '05-era'], [4, '06-journey']]) {
        await wheelTo(page, level);
        await shot(page, errors, `${tag}-${name}`, { wanted: level });
      }
      await wheelTo(page, 2);
      // Open the world from the simple view.
      await page.locator('.path-world__simple .journey-mini__open').click();
      await page.waitForSelector('.path-world__host[data-live="true"]', { timeout: 120_000 });
      const atMonth = await landed(page, '2');
      await wait(1500);
      await shot(page, errors, `${tag}-07-world`, { landed: atMonth });
      // Pick in the world: a Kitty Bank landmark (or the month, if none shows).
      const picked = await page.evaluate(() => {
        const marks = [...document.querySelectorAll('.path-mark')].filter((b) => !b.hidden);
        const b = marks.find((m) => m.classList.contains('path-mark--goal')) ?? marks.find((m) => m.classList.contains('path-mark--fire')) ?? marks.find((m) => m.classList.contains('path-mark--month')) ?? marks[0];
        if (!b) return null;
        b.click();
        return b.dataset.place;
      });
      await wait(3500);
      await shot(page, errors, `${tag}-08-world-pick`, { picked });
      // The corner minimap followed: its own close-up.
      const corner = page.locator('.path-hud__mini');
      if (await corner.count()) {
        await corner.screenshot({ path: `${out}/${tag}-09-minimap.jpg`, type: 'jpeg', quality: 90 });
        report[`${tag}-09-minimap`] = await state(page);
      }
      // Pick in the minimap: out to its Journey level, then another era's island.
      await page.keyboard.press('Escape');
      await wait(300);
      const journeyButton = page.locator('.path-hud__mini .journey-mini__levels button[aria-label="Journey"]');
      if (await journeyButton.count()) {
        await journeyButton.click();
        await page.waitForFunction(() => document.querySelector('.path-hud__mini .journey-mini')?.dataset.level === '4', null, { timeout: 20_000 }).catch(() => undefined);
        await page.waitForFunction(() => [...document.querySelectorAll('.path-hud__mini .journey-mini__label[data-place^="era:"]')].some((b) => !b.hidden && getComputedStyle(b).pointerEvents !== 'none' && !/We are here/.test(b.textContent)), null, { timeout: 30_000 }).catch(() => undefined);
      }
      const minimapPick = await page.evaluate(() => {
        const labels = [...document.querySelectorAll('.path-hud__mini .journey-mini__label')].filter((b) => !b.hidden && getComputedStyle(b).pointerEvents !== 'none');
        const b = labels.find((l) => /^era:/.test(l.dataset.place) && !/We are here/.test(l.textContent)) ?? labels[0];
        if (!b) return null;
        b.click();
        return `${b.dataset.place} ${b.textContent}`;
      });
      await landed(page, '2');
      await wait(3800);
      await shot(page, errors, `${tag}-10-minimap-pick`, { minimapPick });
      // Escape: a card closes first, then the world minimizes; the page shows the same focus.
      const before = await state(page);
      for (let i = 0; i < 3 && (await page.evaluate(() => Boolean(document.querySelector('.path-world')?.dataset.game))); i++) { await page.keyboard.press('Escape'); await wait(500); }
      await page.waitForFunction(() => !document.querySelector('.path-world')?.dataset.game, null, { timeout: 20_000 });
      await wait(1500);
      await page.evaluate(() => window.scrollTo(0, document.querySelector('.path-world__simple').getBoundingClientRect().top + window.scrollY - 8));
      await wait(500);
      await shot(page, errors, `${tag}-11-page-back`, { levelInWorld: before.cornerLevel, captionInWorld: before.caption });
    } finally { await close(); }
    writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  }
} finally {
  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  await proof.close();
}
