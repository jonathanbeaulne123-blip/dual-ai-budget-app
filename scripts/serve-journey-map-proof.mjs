/** The Journey map (Horizon Clock) on the real JourneyBoard, fictional Development books only.
    `node scripts/serve-journey-map-proof.mjs` prints the URL.
    `node scripts/serve-journey-map-proof.mjs --real-app` captures the real App's arrival (dev server already running).
    `node scripts/serve-journey-map-proof.mjs --capture` writes the browser evidence to docs/evidence/journey-map/
    (OUT=<dir>, WIDTHS=320,390,720,1100, THEMES=classic,taylor,newfoundland, PARTS=grid,extras to narrow a run).
    Household: `seedDemoHousehold({ today: "2026-09-28" })` (the Jonathan & Bianca demo kitchen, synthetic), viewed by
    Jonathan (MEM-002) — the same fixture the journey model tests use. `?empty=1` is a brand-new household template.
    Query: ?theme=classic|taylor|newfoundland  ?level=year|month|week  ?list=1  ?motion=reduced  ?quality=flat|lite|full
           ?land=fail (the land never arrives)  ?loading=1 (the land is still on its way)  ?empty=1  ?due=N (the App's
           repeating reminders count)  ?member=MEM-001  ?modes=expense,shift,income,bill,transfer (the dial's verbs)
    Nothing is stored: view state lives in an in-memory Storage seeded from the query, and every action is a stub that
    records its name in `window.__actions`. The page mirrors the App's fonts (index.html) so type renders as it does there. */
import { createServer } from 'vite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const css = [...readFileSync('src/main.tsx', 'utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([, path]) => `import '/src/${path}';`).join('\n');
const fontLinks = [...readFileSync('index.html', 'utf8').matchAll(/<link [^>]*fonts\.(?:googleapis|gstatic)[^>]*>/g)].map(([tag]) => tag).join('');
const TODAY = '2026-09-28';

const entry = `${css}
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import JourneyBoard from '/src/journey/ui/JourneyBoard.tsx';
import { seedDemoHousehold, newHouseholdTemplate } from '/src/core/seed.ts';
import { resolveThemeScene, sceneTokens } from '/src/theme/scenes.ts';
const q = new URLSearchParams(location.search);
const today = '${TODAY}';
const member = q.get('member') || 'MEM-002';
const motion = q.get('motion') === 'reduced' ? 'reduced' : 'full';
function paintTheme(theme) {
  const scene = resolveThemeScene(theme, 'plan', 'household');
  Object.assign(document.documentElement.dataset, { theme, scene: scene.id, material: scene.material, sceneLighting: scene.dark ? 'dark' : 'light', atmosphere: 'paused', motion });
  for (const [key, value] of Object.entries(sceneTokens(scene))) document.documentElement.style.setProperty(key, value);
}
document.body.style.margin = '0';
document.body.style.background = 'var(--paper)';
window.__actions = [];
window.__ready = false;
// The view state the board restores on mount (its only storage), seeded from the query; nothing reaches localStorage.
const level = ['year', 'month', 'week'].includes(q.get('level')) ? q.get('level') : 'month';
const memory = new Map();
const seeded = JSON.stringify({ version: 2, level, focusDate: null, selectedStopId: null, listMode: q.get('list') === '1' ? 'list' : 'map', lastEnter: null });
const storage = {
  get length() { return memory.size; }, key: (i) => [...memory.keys()][i] ?? null, clear: () => memory.clear(),
  getItem: (k) => memory.get(k) ?? (k.includes(':v2:') ? seeded : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k),
};
const household = q.get('empty') === '1' ? newHouseholdTemplate('development') : seedDemoHousehold({ today, environment: 'development' });
const record = (name) => (...args) => { window.__actions.push([name, ...args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a))].join(' ')); };
const actions = {
  openRecord: record('openRecord'), openBillPaid: record('openBillPaid'), openDueReview: record('openDueReview'), openPlace: record('openPlace'),
  openCampfire: record('openCampfire'), openWeeklySitdown: record('openWeeklySitdown'), openHomeBook: record('openHomeBook'), openEraPlanner: record('openEraPlanner'),
  openKitty: record('openKitty'), openCalendar: record('openCalendar'), openBooks: record('openBooks'), enterHorizon: (l) => { record('enterHorizon')(l); return true; },
  back: record('back'), openAllTools: record('openAllTools'), chooseSimpleView: record('chooseSimpleView'),
};
const seams = {};
if (['flat', 'lite', 'full'].includes(q.get('quality'))) seams.quality = q.get('quality');
if (q.get('land') === 'fail') seams.loadLand = () => Promise.reject(new Error('fictional proof: the land did not arrive'));
if (q.get('loading') === '1') seams.loadLand = () => new Promise(() => {});
function Proof() {
  const [theme, setTheme] = useState(q.get('theme') || 'classic');
  paintTheme(theme);
  return React.createElement(JourneyBoard, {
    household, memberId: member, environment: 'development', today, theme, actions, storage,
    dueReview: q.get('due') ? { count: Number(q.get('due')) } : null,
    // The App's record modes for the "+" dial (fabActionsFor): ?modes=expense,shift,income,bill,transfer.
    ...(q.get('modes') ? { recordModes: q.get('modes').split(',') } : {}),
    onChooseTheme: (t) => { record('chooseTheme')(t); setTheme(t); },
    onReady: () => { window.__ready = true; },
    ...seams,
  });
}
createRoot(document.getElementById('root')).render(React.createElement(Proof));`;

export async function startJourneyMapProof({ port = 5198 } = {}) {
  const cacheDir = mkdtempSync(join(tmpdir(), 'hearth-map-'));
  const server = await createServer({
    configFile: false, cacheDir, logLevel: 'warn', server: { host: '127.0.0.1', port, strictPort: true },
    plugins: [{
      name: 'journey-map-proof',
      resolveId(id) { if (id === '/journey-map-proof.js') return '\0journey-map-proof'; },
      load(id) { if (id === '\0journey-map-proof') return entry; },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.method === 'POST') { res.statusCode = 503; res.end('{}'); return; }
          if (req.url?.split('?')[0] !== '/journey-map-proof') return next();
          res.setHeader('Content-Type', 'text/html');
          res.end(await vite.transformIndexHtml('/journey-map-proof', `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Fictional Journey map proof</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${fontLinks}</head><body><div id="root"></div><script type="module" src="/journey-map-proof.js"></script></body></html>`));
        });
      },
    }],
  });
  await server.listen();
  return { url: `http://127.0.0.1:${server.httpServer.address().port}/journey-map-proof`, async close() { await server.close(); rmSync(cacheDir, { recursive: true, force: true }); } };
}

/* ---------------------------------------------------------------------------------------------------------------- */

const FACTS = () => {
  const vw = innerWidth, vh = innerHeight;
  const board = document.querySelector('[data-journey-board]');
  if (!board) return { board: false };
  const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden], .journey-visually-hidden'); };
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 48);
  const controls = [...board.querySelectorAll('button, input, [tabindex="0"]')].filter(shown);
  const under44 = controls.map((el) => { const r = el.getBoundingClientRect(); return { name: name(el), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((b) => b.w < 44 || b.h < 44);
  // Words and controls that run past the viewport's left or right edge (the canvas and hidden marks excluded).
  const outside = [...board.querySelectorAll('*')].filter((el) => !el.closest('canvas, .journey-stage__canvas, .journey-flat, svg') && el.tagName !== 'svg' && shown(el)).filter((el) => {
    const r = el.getBoundingClientRect(); return r.left < -1 || r.right > vw + 1;
  }).filter((el) => el.textContent.trim() || el.matches('button, input')).map((el) => ({ name: name(el), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right) }));
  const plus = board.querySelector('[data-journey-plus]');
  let plusClear = null;
  if (plus && shown(plus)) { const r = plus.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); plusClear = Boolean(hit && (hit === plus || plus.contains(hit))); }
  const stage = board.querySelector('.journey-stage');
  const text = (sel) => { const el = board.querySelector(sel); return el && shown(el) ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 140) : null; };
  return {
    viewport: [vw, vh],
    pageOverflowX: document.documentElement.scrollWidth > vw + 1,
    boardScroll: board.scrollHeight > board.clientHeight + 1 ? [board.clientHeight, board.scrollHeight] : null,
    classes: board.className,
    stageMode: stage?.dataset.stageMode ?? null,
    land: stage?.dataset.land ?? null,
    level: board.dataset.journeyLevel ?? null,
    header: text('[data-chapter-title]'),
    purse: text('.journey-purse'),
    bubble: text('[data-journey-bubble]'),
    landNote: text('[data-land-note]'),
    marksShown: board.querySelectorAll('.journey-mark:not([hidden])').length,
    callouts: [...board.querySelectorAll('[data-callout]')].filter(shown).map((c) => c.textContent.trim().replace(/\s+/g, ' ').slice(0, 80)),
    sheet: text('.journey-sheet-slot:not([hidden]) .journey-panel__title'),
    active: document.activeElement && document.activeElement !== document.body ? name(document.activeElement) : null,
    plusUnobstructed: plusClear,
    controlsUnder44: under44,
    outsideViewport: outside.slice(0, 12),
  };
};

async function capture() {
  const { existsSync, mkdirSync, writeFileSync, statSync } = await import('node:fs');
  const { chromium } = await import('@playwright/test');
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const sharp = (await import('sharp')).default;
  const out = process.env.OUT || 'docs/evidence/journey-map';
  mkdirSync(out, { recursive: true });
  const WIDTHS = (process.env.WIDTHS || '320,390,720,1100').split(',').map(Number);
  const THEMES = (process.env.THEMES || 'classic,taylor,newfoundland').split(',');
  const PARTS = (process.env.PARTS || 'grid,extras').split(','); // grid · extras (all below) · tail (offline, flat, axe)
  const HEIGHT = { 320: 568, 390: 844, 720: 900, 1100: 800 };
  const LEVELS = ['year', 'month', 'week'];
  const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  // The App's Google Fonts go through the session's HTTPS proxy when one is set; the proof server stays direct.
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
  const browser = await chromium.launch({ executablePath, proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const proof = await startJourneyMapProof({ port: Number(process.env.PORT || 5398) });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const benign = (text) => /GPU stall|swiftshader|WebGL|Failed to load resource|fonts\.g/i.test(text);
  const report = existsSync(`${out}/report.json`) ? JSON.parse(readFileSync(`${out}/report.json`, 'utf8')) : {};
  report.generated = `fictional Development demo household (seedDemoHousehold today ${TODAY}, viewer MEM-002 Jonathan); headless Chromium 141 + SwiftShader`;
  report.sha = (await import('node:child_process')).execSync('git rev-parse --short HEAD').toString().trim();
  report.shots ??= {};

  async function open(width, query, { reducedMotion = 'no-preference', height, before, ready = true } = {}) {
    const context = await browser.newContext({ viewport: { width, height: height ?? HEIGHT[width] ?? 900 }, deviceScaleFactor: 1, reducedMotion });
    // The container has 2 cores; a phone or desktop reports more. Report 8 so the App's own tiering (lite under 720 px,
    // full at and above) picks what a real device would.
    await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 8 }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errors.push(m.text().slice(0, 200)); });
    if (before) await before(page, context);
    await page.goto(`${proof.url}?${query}`);
    await page.waitForSelector('[data-journey-board]', { timeout: 180_000 });
    if (ready && !/loading=1/.test(query)) await page.waitForFunction(() => window.__ready, null, { timeout: 180_000 });
    await page.evaluate(() => document.fonts?.ready);
    await wait(2200);
    return { page, context, errors, close: () => context.close() };
  }
  async function level(page, name, ms = 2600) {
    await page.locator(`.journey-pull__lv[data-level="${name}"]`).click();
    await wait(ms);
  }
  const press = (page, selector) => page.locator(selector).first().evaluate((el) => { el.focus(); el.click(); });
  async function save(page, errors, file, extra = {}) {
    await page.screenshot({ path: `${out}/${file}.png` });
    report.shots[file] = { ...(await page.evaluate(FACTS)), errors: errors.slice(0, 3), ...extra };
    process.stdout.write(`${file} `);
  }

  if (PARTS.includes('grid')) for (const theme of THEMES) for (const width of WIDTHS) {
    const { page, errors, close } = await open(width, `theme=${theme}&level=year`);
    for (const lv of LEVELS) { if (lv !== 'year') await level(page, lv); await save(page, errors, `${lv}-${width}-${theme}`); }
    await close();
  }

  if (PARTS.includes('extras')) {
    // List view (same data, same actions) at each level.
    for (const width of [390, 1100]) {
      const { page, errors, close } = await open(width, 'theme=taylor&level=month&list=1');
      await save(page, errors, `list-month-${width}-taylor`);
      await level(page, 'week', 600);
      await save(page, errors, `list-week-${width}-taylor`);
      await level(page, 'year', 600);
      await save(page, errors, `list-year-${width}-taylor`);
      await close();
    }
    // Sheets and pops (Taylor): stop sheet, checklist, + dial, Which one?, Key.
    for (const width of [390, 1100]) {
      // The App's own record modes for the dial (fabActionsFor: expense, shift, income, bill, transfer).
      const { page, errors, close } = await open(width, 'theme=taylor&level=month&modes=expense,shift,income,bill,transfer');
      const pick = await page.evaluate(() => {
        const marks = [...document.querySelectorAll('.journey-mark--day:not([hidden])')];
        const one = marks.find((m) => m.classList.contains('journey-mark--check')) ?? marks.find((m) => !m.classList.contains('journey-mark--quiet') && !m.classList.contains('journey-mark--today'));
        return one?.dataset.markId ?? null;
      });
      if (pick) { await press(page, `.journey-mark[data-mark-id="${pick}"]`); await wait(900); await save(page, errors, `sheet-stop-${width}-taylor`, { opened: pick }); }
      await page.keyboard.press('Escape'); await wait(500);
      const opener = (await page.locator('[data-journey-bubble]').count()) ? '[data-journey-bubble]' : '[data-journey-count-chip]';
      if (await page.locator(opener).count()) { await press(page, opener); await wait(900); await save(page, errors, `sheet-checklist-${width}-taylor`); }
      await page.keyboard.press('Escape'); await wait(500);
      await press(page, '[data-journey-plus]'); await wait(700);
      await save(page, errors, `dial-${width}-taylor`);
      await page.keyboard.press('Escape'); await wait(500);
      await press(page, '[data-key-button]'); await wait(600);
      await save(page, errors, `key-month-${width}-taylor`);
      await page.keyboard.press('Escape'); await wait(400);
      // Which one?: first a real press where two 44 px day-mark hit areas overlap (the path a finger takes on a
      // crowded phone ring); then, as before, a canvas tap on a slot that holds more than one stop.
      const overlap = await page.evaluate(() => {
        const hits = [...document.querySelectorAll('.journey-mark--day:not([hidden])')].map((m) => ({ id: m.dataset.markId, r: m.getBoundingClientRect() }));
        for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
          const a = hits[i].r, b = hits[j].r;
          const l = Math.max(a.left, b.left), r = Math.min(a.right, b.right), t = Math.max(a.top, b.top), btm = Math.min(a.bottom, b.bottom);
          if (r - l > 4 && btm - t > 4) return { x: (l + r) / 2, y: (t + btm) / 2, ids: [hits[i].id, hits[j].id] };
        }
        return null;
      });
      if (overlap) { await page.mouse.click(overlap.x, overlap.y); await wait(500); }
      const fan = (await page.locator('[data-journey-fan]').count())
        ? { overlap, options: await page.locator('[data-fan-option]').allTextContents() }
        : await page.evaluate(async () => {
        const canvas = document.querySelector('.journey-stage__canvas canvas');
        const days = [...document.querySelectorAll('.journey-mark--day:not([hidden])')];
        if (!canvas) return { canvas: false };
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        for (const mark of days.sort((a, b) => (b.classList.contains('journey-mark--today') ? 1 : 0) - (a.classList.contains('journey-mark--today') ? 1 : 0))) {
          const r = mark.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
          const init = { clientX: x, clientY: y, pointerId: 7, bubbles: true, isPrimary: true, pointerType: 'touch' };
          canvas.dispatchEvent(new PointerEvent('pointerdown', init));
          await sleep(60);
          canvas.dispatchEvent(new PointerEvent('pointerup', init));
          await sleep(250);
          if (document.querySelector('[data-journey-fan]')) return { mark: mark.dataset.markId, options: [...document.querySelectorAll('[data-fan-option]')].map((o) => o.textContent) };
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await sleep(120);
        }
        return { fan: false };
      });
      await wait(400);
      if (await page.locator('[data-journey-fan]').count()) await save(page, errors, `which-one-${width}-taylor`, { fan });
      else report.shots[`which-one-${width}-taylor`] = { gap: 'no canvas tap produced the Which one? fan', fan };
      await page.keyboard.press('Escape'); await wait(400);
      await level(page, 'year');
      await press(page, '[data-key-button]'); await wait(600);
      await save(page, errors, `key-year-${width}-taylor`);
      await page.keyboard.press('Escape'); await wait(400);
      await level(page, 'week');
      const pile = page.locator('.journey-mark--pile:not([hidden])');
      if (await pile.count()) { await press(page, '.journey-mark--pile:not([hidden])'); await wait(900); await save(page, errors, `sheet-pile-week-${width}-taylor`); }
      await close();
    }
    // Reduced motion: every level change is a cut (the pull lands at once), and no CSS transition runs.
    for (const width of [390, 1100]) {
      const { page, errors, close } = await open(width, 'theme=newfoundland&level=month&motion=reduced', { reducedMotion: 'reduce' });
      const cuts = [];
      for (const lv of ['week', 'year', 'month']) {
        await page.locator(`.journey-pull__lv[data-level="${lv}"]`).click();
        await wait(80);
        cuts.push(await page.evaluate((want) => ({ want, level: document.querySelector('[data-journey-board]').dataset.journeyLevel, slider: document.querySelector('[data-level-slider]').value, still: document.querySelector('[data-journey-board]').classList.contains('journey-board--still') }), lv));
      }
      await wait(1200);
      await save(page, errors, `reduced-motion-month-${width}-newfoundland`, { cuts });
      await level(page, 'week', 1200);
      await save(page, errors, `reduced-motion-week-${width}-newfoundland`);
      await close();
    }
    // Keyboard: Tab from the top; frames on the header, the level slider, a mark, the sheet, and "+".
    for (const width of [390, 1100]) {
      const { page, errors, close } = await open(width, 'theme=classic&level=month');
      const order = [];
      const want = [['about', '[data-about]'], ['slider', '[data-level-slider]'], ['mark', '.journey-mark'], ['plus', '[data-journey-plus]']];
      const got = new Set();
      await page.evaluate(() => document.activeElement?.blur());
      for (let i = 0; i < 60 && got.size < want.length; i++) {
        await page.keyboard.press('Tab');
        await wait(120);
        const here = await page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().replace(/\s+/g, ' ').slice(0, 50) : null; });
        order.push(here);
        for (const [key, sel] of want) {
          if (got.has(key)) continue;
          if (await page.evaluate((s) => document.activeElement?.matches(s), sel)) {
            got.add(key);
            await save(page, errors, `keyboard-${got.size}-${key}-${width}-classic`, { tabStep: i + 1 });
            if (key === 'mark') {
              await page.keyboard.press('Enter'); await wait(900);
              await save(page, errors, `keyboard-${got.size}b-sheet-${width}-classic`, { tabStep: i + 1 });
              await page.keyboard.press('Tab'); await wait(200);
              await save(page, errors, `keyboard-${got.size}c-sheet-action-${width}-classic`);
              await page.keyboard.press('Escape'); await wait(500);
              order.push('after Escape → ' + await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName || '').slice(0, 50)));
            }
          }
        }
      }
      report.keyboardOrder ??= {};
      report.keyboardOrder[width] = order;
      await close();
    }
    // Empty, loading, land failure.
    for (const width of [390, 1100]) {
      for (const [name, query] of [['empty', 'empty=1'], ['loading', 'loading=1'], ['land-fail', 'land=fail']]) {
        const { page, errors, close } = await open(width, `theme=classic&level=month&${query}`);
        await save(page, errors, `${name}-month-${width}-classic`);
        if (name === 'empty') { await press(page, '[data-list-mode="list"]'); await wait(500); await save(page, errors, `empty-list-${width}-classic`); }
        await close();
      }
    }
  }

  if (PARTS.includes('extras') || PARTS.includes('tail')) {
    // Offline: the land request is held, the context goes offline, then the request fails as it would.
    for (const width of [390, 1100]) {
      const held = [];
      // The flat placeholder does not send ready while 3D is still expected, so `open` does not wait for it here.
      const { page, context, errors, close } = await open(width, 'theme=classic&level=month', {
        ready: false, before: async (p) => { await p.route(/^http:\/\/127\.0\.0\.1:\d+\/horizon\/(world|terrain)\//, (route) => { held.push(route); }); },
      });
      await context.setOffline(true);
      for (const r of held) await r.abort('internetdisconnected').catch(() => {});
      await page.unroute(/^http:\/\/127\.0\.0\.1:\d+\/horizon\/(world|terrain)\//);
      await wait(2500);
      await save(page, errors, `offline-month-${width}-classic`, { heldRequests: held.length });
      await press(page, '[data-list-mode="list"]'); await wait(600);
      await save(page, errors, `offline-list-${width}-classic`);
      await close();
    }
    // The flat tier (Simple view / no WebGL): the SVG clock and the paper discs, all three levels at 390, Month at 1100.
    {
      const { page, errors, close } = await open(390, 'theme=taylor&level=year&quality=flat');
      for (const lv of LEVELS) { if (lv !== 'year') await level(page, lv, 600); await save(page, errors, `flat-${lv}-390-taylor`); }
      await close();
    }
    {
      const { page, errors, close } = await open(1100, 'theme=newfoundland&level=month&quality=flat');
      await save(page, errors, 'flat-month-1100-newfoundland');
      await close();
    }
    // axe-core (wcag2a/aa, 2.1, 2.2 AA, best practice) on the board at rest in Month, Taylor.
    for (const width of [390, 1100]) {
      const { page, close } = await open(width, 'theme=taylor&level=month');
      const result = await new AxeBuilder({ page }).include('[data-journey-board]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      writeFileSync(`${out}/axe-${width}.json`, JSON.stringify(result, null, 1));
      report.axe ??= {};
      report.axe[width] = { violations: result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 6).map((n) => n.target.join(' ')), summary: v.nodes[0]?.failureSummary?.slice(0, 300) })), passes: result.passes.length, incomplete: result.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length })) };
      // The same scan with the list open (after the toggle's background transition has settled: SwiftShader is slow, and
      // a scan mid-transition reads a half-blended background as a contrast failure).
      await press(page, '[data-list-mode="list"]'); await wait(600);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-list-mode="list"]')).backgroundColor !== 'rgba(0, 0, 0, 0)' && document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 10_000 }).catch(() => {});
      await wait(900);
      const listResult = await new AxeBuilder({ page }).include('[data-journey-board]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      report.axe[`${width}-list`] = { violations: listResult.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 6).map((n) => n.target.join(' ')), summary: v.nodes[0]?.failureSummary?.slice(0, 300) })), passes: listResult.passes.length };
      await close();
    }
  }

  // Palette-quantise every PNG this run wrote (keeps the folder small; no visible change at these sizes).
  const { readdirSync } = await import('node:fs');
  for (const file of readdirSync(out).filter((f) => f.endsWith('.png'))) {
    const path = `${out}/${file}`;
    if (statSync(path).mtimeMs < Date.now() - 6 * 3600_000) continue;
    const buf = await sharp(path).png({ palette: true, quality: 90, effort: 7, colours: 256 }).toBuffer();
    if (buf.length < statSync(path).size) writeFileSync(path, buf);
  }
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
  await browser.close();
  await proof.close();
  console.log(`\nwrote ${Object.keys(report.shots).length} captures to ${out}`);
}

/** One pass through the real App (not the proof page): a Vite dev server with the pages.yml presentation flags must already
    be listening on APP_URL (default http://127.0.0.1:5211/; recipe in docs/evidence/journey-map/README.md). Demo
    household → "I am Jonathan" → the arrival on the Journey map, Taylor, at SIZES (default 390x844,1100x800). */
async function realApp() {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { chromium } = await import('@playwright/test');
  const OUT = process.env.OUT || 'docs/evidence/journey-map';
  const APP = process.env.APP_URL || 'http://127.0.0.1:5211/';

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const facts = {};
  for (const [w, h] of (process.env.SIZES || '390x844,1100x800').split(',').map((s) => s.split('x').map(Number))) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 8 }); try { localStorage.setItem('hearth:appearance:v1:development:guest', JSON.stringify({ appearance: { theme: 'taylor', atmosphere: false }, pending: false })); } catch {} });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const t0 = Date.now();
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open the demo household table' }).click();
  await page.waitForSelector('text=Choose yourself');
  await page.getByRole('button', { name: 'I am Jonathan' }).click();
  await page.waitForFunction(() => !document.querySelector('.welcome-card') && !!document.querySelector('.app'));
  let arrived = true;
  try { await page.waitForSelector('[data-journey-board]', { timeout: 120000 }); } catch { arrived = false; }
  await page.waitForTimeout(6000);
  const close = page.getByRole('button', { name: 'Close character choices' });
  if (await close.count()) { await close.click(); await page.waitForTimeout(800); }
  const f = await page.evaluate(() => {
    const b = document.querySelector('[data-journey-board]');
    const stage = b?.querySelector('.journey-stage');
    const plus = b?.querySelector('[data-journey-plus]');
    let plusClear = null;
    if (plus) { const r = plus.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); plusClear = !!hit && (hit === plus || plus.contains(hit)); }
    return { url: location.pathname + location.search.replace(/household=[^&]+/, 'household=<demo>'), board: !!b, theme: document.documentElement.dataset.theme, classes: b?.className, stageMode: stage?.dataset.stageMode, land: stage?.dataset.land, level: b?.dataset.journeyLevel,
      boardTop: b ? Math.round(b.getBoundingClientRect().top) : null, boardHeight: b ? Math.round(b.getBoundingClientRect().height) : null, scrollY: Math.round(scrollY), stage: (() => { const r = stage?.getBoundingClientRect(); return r ? [Math.round(r.width), Math.round(r.height)] : null; })(), plusRadius: plus ? getComputedStyle(plus).borderRadius : null, plusUnobstructed: plusClear,
      banners: [...document.querySelectorAll('.command-banner, .kitchen-notice')].map((n) => n.textContent.trim().slice(0, 80)), env: (document.body.textContent.match(/Development|Production/) || [null])[0],
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      // The App's floating Mountain/Horizon toggle must not cover the board's header (month title and its buttons).
      toggleClear: (() => { const t = document.querySelector('.harbour-world-toggle')?.getBoundingClientRect(); const h = b?.querySelector('[data-journey-header]')?.getBoundingClientRect(); if (!t || !h || !t.height) return null; return t.bottom <= h.top || t.right <= h.left || t.left >= h.right || t.top >= h.bottom; })() };
  });
  f.ms = Date.now() - t0; f.arrived = arrived; f.errors = errors.slice(0, 3);
  facts[`${w}`] = f;
  await page.screenshot({ path: `${OUT}/real-app-arrival-${w}-taylor.png` });
  console.log(w, JSON.stringify(f));
  await ctx.close();
}
writeFileSync(`${OUT}/real-app.json`, JSON.stringify(facts, null, 1));
await browser.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--capture')) await capture();
  else if (process.argv.includes('--real-app')) await realApp();
  else {
    const proof = await startJourneyMapProof({ port: Number(process.env.PORT || 5198) });
    console.log(`Journey map proof: ${proof.url}`);
    process.once('SIGINT', async () => { await proof.close(); process.exit(0); });
  }
}
