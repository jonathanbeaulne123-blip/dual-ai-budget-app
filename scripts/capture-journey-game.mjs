/** Game mode (D-285) on the real Our Path page, fictional books only.
    `node scripts/capture-journey-game.mjs` — writes PNGs and report.json to docs/evidence/journey-simple-view/game/.
    OUT=<dir>, THEMES=classic,..., WIDTHS=390,..., STORIES=well,story to narrow a run. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';

const out = process.env.OUT || 'docs/evidence/journey-simple-view/game';
mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const THEMES = (process.env.THEMES || 'classic,taylor,newfoundland').split(',');
const WIDTHS = (process.env.WIDTHS || '320,390,720,1100').split(',').map(Number);
const STORIES = (process.env.STORIES || 'well,story').split(',');
const STEPS = (process.env.STEPS || 'page,entering,game,settings,minimized').split(',');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const benign = (text) => /Failed to load resource.*404|GPU stall|GL_CLOSE_PATH|swiftshader|WebGL.*(performance|warning)|Automatic fallback to software WebGL/i.test(text);
const proof = await startOurPathWorldProof({ port: 5195 });
// A narrowed run (THEMES/WIDTHS/STORIES) updates its own rows and keeps the rest.
const report = existsSync(`${out}/report.json`) ? JSON.parse(readFileSync(`${out}/report.json`, 'utf8')) : {};
const storyCache = 'scripts/tmp/our-story.json';

async function open(width, query) {
  const height = width < 720 ? (width < 360 ? 640 : 844) : 800;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width < 720 });
  const page = await context.newPage();
  const errors = { page: [], console: [] };
  page.on('pageerror', (e) => errors.page.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errors.console.push(m.text().slice(0, 200)); });
  await page.goto(`${proof.url}?${query}`);
  await page.waitForFunction(() => window.__ready && document.querySelector('.path-world'), null, { timeout: 240_000 });
  await wait(600);
  return { page, errors, close: () => context.close() };
}
async function checks(page, errors) {
  const dom = await page.evaluate(() => {
    const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const stage = document.querySelector('.path-world__stage');
    const hud = [...document.querySelectorAll('.path-hud button')].filter(visible);
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      game: document.querySelector('.path-world')?.getAttribute('data-game') ?? null,
      stageVisible: visible(stage),
      navVisible: visible(document.querySelector('.nav')),
      headerVisible: visible(document.querySelector('.topbar')),
      pageInert: Boolean(document.querySelector('.path-world__simple')?.closest('[inert]') || document.querySelector('.path-world__simple[inert]')),
      live: document.querySelector('.path-world__host')?.getAttribute('data-live') ?? null,
      focus: document.activeElement ? `${document.activeElement.tagName.toLowerCase()}.${document.activeElement.className}`.slice(0, 80) + ` "${(document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 40)}"` : null,
      smallTargets: hud.filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((b) => b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 6),
      hudOverlaps: (() => {
        const boxes = [...document.querySelectorAll('.path-hud__corner--start, .path-hud__gear, .path-hud__mini, .path-hud__caption, .path-world__rail, .path-hud .path-world__now')].filter(visible).map((el) => ({ n: el.className.split(' ')[0], r: el.getBoundingClientRect() }));
        const out = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i].r, b = boxes[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${boxes[i].n}×${boxes[j].n}`); }
        return out;
      })(),
      offscreen: hud.filter((b) => { const r = b.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1; }).map((b) => b.textContent.trim()).slice(0, 4),
      caption: document.querySelector('.path-hud__caption')?.textContent ?? null,
      amounts: /\$\s?\d/.test(document.querySelector('.path-hud')?.textContent ?? ''),
    };
  });
  return { pageErrors: errors.page.slice(0, 3), consoleErrors: errors.console.slice(0, 3), ...dom };
}
async function shot(page, errors, file) {
  await page.screenshot({ path: `${out}/${file}` });
  report[file] = await checks(page, errors);
  console.log(file, JSON.stringify(report[file]));
}

try {
  // The Our Story habitat takes a while to grow: grow it once and reuse it.
  if (STORIES.includes('story') && !existsSync(storyCache)) {
    const { page, close } = await open(1100, 'theme=classic&story=story');
    writeFileSync(storyCache, await page.evaluate(() => JSON.stringify(window.__household)));
    await close();
  }
  for (const story of STORIES) {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const quality = width < 720 ? 'lite' : 'full';
        const query = story === 'story'
          ? `theme=${theme}&story=story&cached=1&lantern=1&quality=${quality}&motion=full&ambient=off&chrome=1`
          : `theme=${theme}&story=well&eras=demo&lantern=1&quality=${quality}&motion=full&ambient=off&chrome=1`;
        const { page, errors, close } = await open(width, query);
        const name = (step) => `${story}-${theme}-${width}-${step}.png`;
        try {
          if (STEPS.includes('page')) await shot(page, errors, name('1-page'));
          const opener = page.locator('.path-world__open');
          await opener.focus();
          await page.keyboard.press('Enter');
          if (STEPS.includes('entering')) {
            // Freeze the iris part-way (headless frames are slow and uneven), shoot, then let it finish.
            await page.waitForFunction(() => document.getAnimations().some((a) => a.effect?.target?.classList?.contains('path-world__stage')), null, { timeout: 5000 }).catch(() => undefined);
            await page.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 170; } });
            await shot(page, errors, name('2-entering'));
            await page.evaluate(() => { for (const a of document.getAnimations()) a.play(); });
          }
          await page.waitForFunction(() => document.querySelector('.path-world__host[data-live="true"]') || document.querySelector('.path-world__stage .path-world__flat'), null, { timeout: 120_000 });
          // Let the camera land where the shared focus asked (Up close on this week) before the shot.
          await page.waitForFunction(() => !document.querySelector('.path-world__host[data-live="true"]') || document.querySelector('.path-world')?.dataset.level === '3', null, { timeout: 90_000 }).catch(() => console.warn(`camera still travelling: ${story}-${theme}-${width}`));
          await wait(1500);
          if (STEPS.includes('game')) await shot(page, errors, name('3-game'));
          if (STEPS.includes('settings')) {
            await page.locator('.path-hud__gear').click();
            await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 15000 }).catch(() => undefined);
            await wait(300);
            await shot(page, errors, name('4-settings'));
            await page.keyboard.press('Escape');
            await wait(200);
          }
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => !document.querySelector('.path-world')?.dataset.game, null, { timeout: 20_000 }).catch(() => console.warn('still leaving'));
          await wait(600);
          if (STEPS.includes('minimized')) await shot(page, errors, name('5-minimized'));
        } finally { await close(); }
      }
    }
  }
} finally {
  writeFileSync(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  await proof.close();
}
