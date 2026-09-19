/** Our Path accessibility pass and next-level evidence (fictional books only).
    `node scripts/capture-path-next-level.mjs` — ONLY=axe|keys|shots to run one part. Writes JSON next to the PNGs. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';

const out = 'docs/evidence/our-path-world/next-level';
mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const only = process.env.ONLY;
const THEMES = ['classic', 'taylor', 'newfoundland'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const noWebgl = () => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; };
// swiftshader in a headless container logs GPU stall/perf warnings as console errors; they are not the page's.
const benign = (text) => /GPU stall|GL_CLOSE_PATH|swiftshader|WebGL.*(performance|warning)|Automatic fallback to software WebGL/i.test(text);

const proof = await startOurPathWorldProof({ port: 5193 });

/** One page with the checks every capture records. */
async function open(width, query, { webgl = true, reduced = false, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const errors = { page: [], console: [], ignored: 0, failed: [], expected: [] };
  page.on('pageerror', (e) => errors.page.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // With WebGL blocked on purpose, three.js reports the refused context once; that is the scenario, not a fault.
    if (!webgl && /Error creating WebGL context/.test(m.text())) { errors.expected.push(m.text().slice(0, 120)); return; }
    if (benign(m.text())) errors.ignored += 1; else errors.console.push(m.text().slice(0, 200));
  });
  page.on('response', (r) => { if (r.status() >= 400) errors.failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  if (!webgl) await page.addInitScript(noWebgl);
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${proof.url}?${query}`);
  await page.waitForFunction((live) => window.__ready && document.querySelector('.path-world') && (live ? document.querySelector('.path-world__host[data-live="true"]') : document.querySelector('.path-world__flat svg')), webgl, { timeout: 120_000 });
  await wait(1200);
  return { page, errors, close: () => context.close() };
}
async function checks(page, errors) {
  const dom = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 1, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, live: document.querySelector('.path-world__host')?.dataset.live ?? null }));
  return { pageErrors: errors.page.length, consoleErrors: errors.console.length, consoleErrorText: errors.console.slice(0, 3), failedRequests: errors.failed.slice(0, 5), expectedNoWebglErrors: errors.expected.length, ignoredGpuWarnings: errors.ignored, overflow: dom.overflow, scrollWidth: dom.scrollWidth, innerWidth: dom.innerWidth, live: dom.live };
}
async function level(page, name) {
  const b = page.locator('.path-world__rail button', { hasText: name }).first();
  if (await b.isEnabled()) { await b.click(); await wait(2200); }
}
async function outlineOpen(page) { await page.evaluate(() => { const d = document.querySelector('.path-world__outline'); if (d) d.open = true; }); }
async function fromOutline(page, match) {
  await outlineOpen(page);
  const found = await page.evaluate((src) => {
    const re = new RegExp(src);
    const b = [...document.querySelectorAll('.path-world__outline button')].find((x) => re.test(x.textContent ?? ''));
    if (!b) return null;
    b.click();
    return b.textContent;
  }, match);
  return found;
}
async function toStage(page) {
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.path-world__stage').getBoundingClientRect().top + window.scrollY - 8));
  await wait(400);
}

const report = { axe: {}, keyboard: {}, shots: {} };
try {
  // ------------------------------------------------------------------ 1. axe
  if (!only || only === 'axe') {
    const states = [];
    for (const theme of THEMES) {
      for (const width of [390, 1100]) states.push({ name: `${theme}-live-${width}`, theme, width, query: `theme=${theme}&story=well&lantern=2&quality=lite`, webgl: true });
      states.push({ name: `${theme}-nowebgl-390`, theme, width: 390, query: `theme=${theme}&story=well&lantern=2`, webgl: false });
      states.push({ name: `${theme}-reduced-1100`, theme, width: 1100, query: `theme=${theme}&story=well&lantern=2&motion=reduced&quality=lite`, webgl: true, reduced: true });
    }
    for (const s of states) {
      const { page, errors, close } = await open(s.width, s.query, s);
      try {
        await level(page, 'Region');
        const opened = await fromOutline(page, '^We are here');
        await page.evaluate(() => { for (const d of document.querySelectorAll('.path-world__panel')) if (d.tagName === 'DETAILS') d.open = true; });
        await wait(1500);
        const result = await new AxeBuilder({ page }).include('.path-world').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
        report.axe[s.name] = {
          opened,
          card: await page.locator('.path-world__card').count(),
          visibleMarks: await page.evaluate(() => [...document.querySelectorAll('.path-mark')].filter((b) => !b.hidden).length),
          violations: result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length, targets: v.nodes.slice(0, 6).map((n) => n.target.join(' ')), summary: v.nodes[0]?.failureSummary?.slice(0, 300) })),
          incomplete: result.incomplete.map((v) => ({ id: v.id, count: v.nodes.length })),
          checks: await checks(page, errors),
        };
        console.log('axe', s.name, report.axe[s.name].violations.map((v) => `${v.id}:${v.impact}×${v.count}`).join(', ') || 'clean');
      } finally { await close(); }
    }
  }

  // ------------------------------------------------------------------ 2. keyboard (world live, 1100)
  if (!only || only === 'keys') {
    const { page, errors, close } = await open(1100, 'theme=taylor&story=well&lantern=1&quality=lite');
    try {
      await level(page, 'Region');
      await toStage(page);
      const visible = await page.evaluate(() => [...document.querySelectorAll('.path-mark')].filter((b) => !b.hidden).map((b) => b.dataset.place));
      await page.evaluate(() => document.querySelector('.path-world__head .path-world__link').focus());
      const walk = [];
      for (let i = 0; i < 160; i++) {
        await page.keyboard.press('Tab');
        const f = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || !el.closest('.path-world')) return null;
          const target = el.classList.contains('path-mark') ? el.querySelector('.path-mark__label') : el;
          const style = getComputedStyle(target);
          return { place: el.dataset.place ?? null, cls: el.className?.toString().split(' ')[0] || el.tagName.toLowerCase(), name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2, hidden: el.hidden };
        });
        if (!f) break;
        walk.push(f);
      }
      const reached = new Set(walk.filter((f) => f.place).map((f) => f.place));
      const marksInWalk = walk.filter((f) => f.cls === 'path-mark');
      report.keyboard.walk = walk.map((f) => `${f.cls}${f.place ? `[${f.place}]` : ''} ${f.name}${f.ring ? '' : ' (NO RING)'}`);
      report.keyboard.visibleMarks = visible.length;
      report.keyboard.marksReached = visible.filter((id) => reached.has(id)).length;
      report.keyboard.missed = visible.filter((id) => !reached.has(id));
      report.keyboard.hiddenFocused = walk.filter((f) => f.hidden).length;
      report.keyboard.withoutRing = walk.filter((f) => !f.ring).map((f) => `${f.cls} ${f.name}`);
      report.keyboard.marksFirst = marksInWalk.length ? walk.findIndex((f) => f.cls === 'path-mark') : -1;

      // Enter on a visible mark opens its card; Tab moves into the card; Escape closes it and focus returns to the mark.
      const markId = visible.find((id) => id?.startsWith('month:')) ?? visible[0];
      await page.focus(`.path-mark[data-place="${markId}"]`);
      await page.keyboard.press('Enter');
      await wait(1500);
      report.keyboard.enterOpensCard = await page.locator('.path-world__card').count() === 1;
      report.keyboard.focusAfterEnter = await page.evaluate(() => (document.activeElement?.closest('.path-world__card') ? 'card' : document.activeElement?.className?.toString()));
      await page.keyboard.press('Tab');
      report.keyboard.tabAfterMarkLandsIn = await page.evaluate(() => (document.activeElement?.closest('.path-world__card') ? 'card' : document.activeElement?.className?.toString()));
      await page.keyboard.press('Escape');
      await wait(300);
      report.keyboard.escapeCloses = await page.locator('.path-world__card').count() === 0;
      report.keyboard.focusAfterEscape = await page.evaluate(() => document.activeElement?.dataset.place ?? document.activeElement?.className?.toString());
      // Tent: open with Enter, focus lands on Back; Back returns focus to the tent button.
      await page.focus('.path-world__tent');
      await page.keyboard.press('Enter');
      await wait(400);
      report.keyboard.tentFocus = await page.evaluate(() => document.activeElement?.textContent);
      await page.keyboard.press('Enter');
      await wait(600);
      report.keyboard.backFocus = await page.evaluate(() => document.activeElement?.textContent);
      report.keyboard.checks = await checks(page, errors);
      console.log('keys', JSON.stringify({ ...report.keyboard, walk: undefined }));
    } finally { await close(); }
  }

  // ------------------------------------------------------------------ 3. evidence
  if (!only || only === 'shots') {
    const shots = [];
    for (const theme of THEMES) for (const width of [320, 390, 720, 1100, 1440]) shots.push({ file: `${theme}-well-${width}.png`, width, query: `theme=${theme}&story=well&lantern=1&quality=${width < 720 ? 'lite' : 'full'}`, level: 'Region', stage: true });
    shots.push({ file: 'taylor-hard-stop-1100.png', width: 1100, query: 'theme=taylor&story=hard&lantern=1&quality=full', level: 'Stop', storm: true, stage: true });
    shots.push({ file: 'classic-reduced-720.png', width: 720, query: 'theme=classic&story=well&lantern=1&motion=reduced', reduced: true, level: 'Region', stage: true });
    shots.push({ file: 'newfoundland-nowebgl-390.png', width: 390, query: 'theme=newfoundland&story=well&lantern=1', webgl: false, stage: true });
    shots.push({ file: 'taylor-outline-390.png', width: 390, query: 'theme=taylor&story=well&lantern=1&quality=lite', outline: true });
    shots.push({ file: 'classic-tent-1100.png', width: 1100, query: 'theme=classic&story=well&lantern=1&quality=full', tent: true });
    shots.push({ file: 'taylor-empty-390.png', width: 390, query: 'theme=taylor&story=empty&lantern=1&quality=lite', emptyStory: true, stage: true });
    for (const s of shots) {
      const webgl = s.webgl !== false;
      let opened;
      try { opened = await open(s.width, s.query, { webgl, reduced: s.reduced, height: s.width < 720 ? 844 : 900 }); }
      catch (error) {
        // An empty household may have no WebGL-ready state within the window; fall back to whichever face it shows.
        if (!s.emptyStory) throw error;
        opened = null;
      }
      if (!opened) { report.shots[s.file] = { error: 'did not settle' }; continue; }
      const { page, errors, close } = opened;
      try {
        const extra = {};
        if (s.level) await level(page, s.level);
        if (s.storm) {
          extra.monthRows = await page.evaluate(() => [...document.querySelectorAll('.path-world__outline button[data-place^="month:"]')].map((b) => b.textContent));
          extra.stormCard = await fromOutline(page, '· Storm$');
          // The hard habitat may have no storm month in its window: fall back to its steepest month and say so.
          if (!extra.stormCard) extra.fallbackCard = await fromOutline(page, '· Lean · uphill$');
          await page.evaluate(() => { document.querySelector('.path-world__outline').open = false; });
          await wait(2500);
          extra.cardTitle = await page.locator('.path-world__card h3').textContent().catch(() => null);
          extra.cardEyebrow = await page.locator('.path-world__card .kicker').textContent().catch(() => null);
        }
        if (s.stage) await toStage(page);
        if (s.outline) {
          await outlineOpen(page);
          await page.evaluate(() => document.querySelector('.path-world__outline').scrollIntoView({ block: 'start' }));
          await wait(400);
          extra.outlineRows = await page.locator('.path-world__outline button').count();
        }
        if (s.tent) {
          await page.getByRole('button', { name: 'Open the Plan Studio tent' }).click();
          await wait(600);
          extra.tentOpen = await page.evaluate(() => !document.querySelector('.path-world__room').hidden && document.querySelector('.path-world__island').hidden);
          extra.focus = await page.evaluate(() => document.activeElement?.textContent);
        }
        extra.visibleMarks = await page.evaluate(() => [...document.querySelectorAll('.path-mark')].filter((b) => !b.hidden).length);
        await page.screenshot({ path: `${out}/${s.file}` });
        report.shots[s.file] = { ...(await checks(page, errors)), ...extra };
        console.log('shot', s.file, JSON.stringify(report.shots[s.file]));
      } finally { await close(); }
    }
  }
} finally {
  await proof.close();
  await browser.close();
}
writeFileSync(`${out}/${only ? `report-${only}` : 'report'}.json`, `${JSON.stringify(report, null, 2)}\n`);
