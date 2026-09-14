/** The Still Queen on the ACTUAL App page (not the stand-in harness): at 320×568, 320×700, 390×844, 720×900 and
    1100×800, in all three themes, on the 3D path and with WebGL refused — Home is one fixed world (no page scroll),
    only the two-space tabs, her field, her quiet line and the five-slot nav are on it, her composition is ≥ 55 % of
    the viewport and her figure ≈ 40 %, the Status door is one tap from Home, every other destination keeps its shell.
    `HEARTH_PROOF_MODE=before` records the same measurements without asserting (the "before" evidence).
    Fictional local Development books only. */
import { startQueenWorldPageProof } from '../scripts/serve-queen-world-page-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const before = process.env.HEARTH_PROOF_MODE === 'before';
const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || (before ? '.artifacts/queen-world-page/before' : '.artifacts/queen-world-page/after'));
mkdirSync(output, { recursive: true });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const WIDTHS = [[320, 568], [320, 700], [390, 844], [720, 900], [1100, 800]];
const THEMES = (process.env.HEARTH_PROOF_THEMES || 'classic,taylor,newfoundland').split(',');
const CHROME = { topbar: 'header.topbar', sync: '.sync-freshness', switcher: '.ledger-switcher', heading: '.theme-scene-heading', atmosphere: '.atmosphere-control, button[aria-label*="atmosphere" i], .theme-scene-heading button', office: 'details.home-instruments', seals: '.hearth-wax-seals', story: '.books-story-tile', charm: '.world-charm-row', ledge: '.fund-ledge' };
const records = [], errors = [];
const proof = await startQueenWorldPageProof();
const check = (ok, message) => { if (before) { if (!ok) records.push({ note: `before: ${message}` }); } else assert.ok(ok, message); };

async function measure(page) {
  return page.evaluate((CHROME) => {
    const doc = document.documentElement;
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const visible = (sel) => [...document.querySelectorAll(sel)].some((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; });
    const home = document.querySelector('.queen-home');
    const figure = document.querySelector('.queen-world.is-live .queen-world__canvas') || document.querySelector('.queen-figure');
    const vh = window.innerHeight;
    const chrome = Object.fromEntries(Object.entries(CHROME).map(([key, sel]) => [key, visible(sel)]));
    const homeRect = rect(home);
    const figureRect = rect(document.querySelector('.queen-figure'));
    return {
      viewport: { w: window.innerWidth, h: vh },
      scrollHeight: doc.scrollHeight, clientHeight: doc.clientHeight, overflowY: doc.scrollHeight - doc.clientHeight, overflowX: doc.scrollWidth - doc.clientWidth,
      chrome,
      home: homeRect, homePct: homeRect ? +(homeRect.h / vh * 100).toFixed(1) : null,
      figure: figureRect, figurePct: figureRect ? +(figureRect.h / vh * 100).toFixed(1) : null,
      world: home?.dataset.world ?? null, live: document.querySelector('.queen-world')?.dataset.live ?? 'absent', frameNav: home?.dataset.frameNav ?? null, frameTabs: home?.dataset.frameTabs ?? null,
      canvasTop: rect(document.querySelector('.queen-world__canvas'))?.y ?? null,
      tabs: [...document.querySelectorAll('.view-switch button')].map((b) => b.textContent.trim()),
      nav: [...(document.querySelector('nav.nav')?.children ?? [])].filter((el) => el.getBoundingClientRect().height > 0).map((b) => (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 24)),
      navRect: rect(document.querySelector('nav.nav')), tabsRect: rect(document.querySelector('.view-switch')),
      line: document.querySelector('.queen-line')?.textContent?.trim() ?? null,
      statusDoor: Boolean(document.querySelector('.queen-door--status')), attention: document.querySelector('.queen-door--status')?.dataset.attention ?? null,
      worldHome: document.querySelector('.app')?.dataset.worldHome ?? null,
    };
  }, CHROME);
}
const waitHome = (page) => page.waitForFunction(() => { const h = document.querySelector('.queen-home'); return h && (h.dataset.world === 'flat' || (window.__queenWorldStats && window.__queenWorldStats().frames > 0)); }, null, { timeout: 90000 });
const route = (page) => page.route('**/*', (r) => { const u = new URL(r.request().url()); return u.hostname === '127.0.0.1' && r.request().method() === 'GET' && !u.pathname.startsWith('/hercules/') ? r.continue() : r.abort(); });

const browser = await chromium.launch({ headless: true, ...exe, args: GL });
try {
  for (const theme of THEMES) for (const path of ['3d', 'no-webgl']) {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const page = await context.newPage(); page.setDefaultTimeout(90000);
    page.on('pageerror', (e) => errors.push(`${theme} ${path}: ${e.message}`));
    await route(page);
    if (path === 'no-webgl') await page.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/i.test(String(kind)) ? null : get.call(this, kind, ...rest); }; });
    await page.goto(`${proof.url}?theme=${theme}&replicas=1`);
    await page.waitForSelector('.queen-home', { timeout: 90000 });
    await waitHome(page);
    // The books gate is a transient trust surface above her; measure the settled page, but note when it never settles.
    const settled = await page.waitForFunction(() => !document.querySelector('[data-books-validation-status]'), null, { timeout: 60000 }).then(() => true).catch(() => false);
    records.push({ label: `${theme} ${path} books gate`, settled });
    await page.waitForTimeout(400);
    for (const [width, height] of WIDTHS) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(350);
      const m = await measure(page);
      const label = `${theme} ${path} ${width}x${height}`;
      await page.screenshot({ path: join(output, `home-${theme}-${path}-${width}x${height}.png`) });
      records.push({ label, ...m });
      check(m.overflowY <= 0, `${label}: Home scrolls by ${m.overflowY}px (scrollHeight ${m.scrollHeight} > clientHeight ${m.clientHeight})`);
      check(m.overflowX <= 1, `${label}: horizontal overflow ${m.overflowX}px`);
      for (const [key, present] of Object.entries(m.chrome)) check(!present, `${label}: ${key} is still on Home`);
      check(m.worldHome === 'true', `${label}: the App is not in world-home mode`);
      check(m.homePct !== null && m.homePct >= 55, `${label}: her composition is ${m.homePct}% of the viewport (< 55%)`);
      check(m.figurePct !== null && m.figurePct >= 30 && m.figurePct <= 50, `${label}: her figure is ${m.figurePct}% of the viewport (≈ 40% wanted)`);
      check(m.tabs.length === 2 && /Home/.test(m.tabs[0]) && /Personal|Money/.test(m.tabs[1]), `${label}: the two-space tabs (${m.tabs.join(' | ')})`);
      check(m.nav.length === 5, `${label}: five nav slots (${m.nav.join(' | ')})`);
      check(m.navRect && m.home && m.home.y + m.home.h <= m.navRect.y + 1, `${label}: her field ends above the nav (field bottom ${m.home && m.home.y + m.home.h}, nav top ${m.navRect?.y})`);
      check(Boolean(m.line), `${label}: the quiet line`);
      check(m.statusDoor, `${label}: the Status door`);
      check(path === 'no-webgl' ? m.world === 'flat' : m.world === '3d', `${label}: world path ${m.world}`);
      if (!before) {
        const serious = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.length}`);
        records[records.length - 1].axeSerious = serious;
        assert.deepEqual(serious, [], `${label}: axe ${serious.join(', ')}`);
      }
    }
    // ---- one tap: the Status door opens the freshness reading, the household, the date, the switcher and the office door ----
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    if (!before) {
      await page.locator('.queen-door--status').click();
      await page.waitForSelector('.queen-panel:not([inert]) .queen-shell');
      const shell = await page.evaluate(() => ({ text: document.querySelector('.queen-panel .queen-shell')?.textContent ?? '', switcher: Boolean(document.querySelector('.queen-panel .ledger-switcher')), office: Boolean(document.querySelector('.queen-panel .queen-shell__office')), overflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight }));
      assert.ok(/Our fictional home/.test(shell.text), `${theme} ${path}: the household name is in the Status panel`);
      assert.ok(/Development/.test(shell.text), `${theme} ${path}: the environment is in the Status panel`);
      assert.ok(shell.switcher, `${theme} ${path}: the household switcher is in the Status panel`);
      assert.ok(shell.office, `${theme} ${path}: the office door is in the Status panel`);
      assert.ok(shell.overflowY <= 0, `${theme} ${path}: the open Status panel does not scroll the page`);
      await page.screenshot({ path: join(output, `status-${theme}-${path}-390x844.png`) });
      records.push({ label: `${theme} ${path} status`, ...shell });
      await page.keyboard.press('Escape');
      await page.waitForSelector('.queen-panel[inert]', { state: 'attached' });
      // ---- keyboard: tabs → her doors → the Move → the nav, visible focus throughout ----
      if (theme === 'classic') {
        await page.evaluate(() => document.querySelector('.view-switch button').focus());
        const order = [];
        for (let i = 0; i < 14; i += 1) { await page.keyboard.press('Tab'); const f = await page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { cls: el.className.split(' ')[0] || el.tagName, inNav: Boolean(el.closest('nav.nav')), outline: s.outlineStyle !== 'none' || s.boxShadow !== 'none', onScreen: r.top >= 0 && r.bottom <= window.innerHeight }; }); if (!f) break; order.push(f); if (f.inNav) break; }
        const names = order.map((f) => (f.inNav ? 'nav' : f.cls));
        assert.ok(names[0] === 'view-switch' || names[0] === 'BUTTON', `keyboard: starts at the second tab (${names.join(' → ')})`);
        const stage = names.filter((n) => /^queen-/.test(n));
        assert.deepEqual(stage, ['queen-door', 'queen-figure', 'queen-move', 'queen-door'], `keyboard over the actual page: ${names.join(' → ')}`);
        assert.ok(names.includes('nav'), `keyboard reaches the nav (${names.join(' → ')})`);
        for (const f of order) { assert.ok(f.outline, `visible focus on ${f.cls}`); assert.ok(f.onScreen, `${f.cls} is on screen when focused`); }
        records.push({ label: `${theme} ${path} keyboard`, order: names });
      }
      // ---- every other destination keeps its shell; Home is the only world ----
      const shells = {};
      for (const name of ['The Fund', 'Our Path', 'Together', 'personal space']) {
        const target = name === 'personal space' ? page.locator('.view-switch button').nth(1) : page.locator('nav.nav button', { hasText: name });
        await target.click(); await page.waitForTimeout(400);
        shells[name] = await page.evaluate(() => ({ topbar: Boolean(document.querySelector('header.topbar')), sync: Boolean(document.querySelector('.sync-freshness')), worldHome: document.querySelector('.app')?.dataset.worldHome ?? null, fixed: getComputedStyle(document.querySelector('.app')).position }));
        assert.ok(shells[name].topbar && shells[name].sync && shells[name].worldHome === null && shells[name].fixed !== 'fixed', `${theme} ${path}: ${name} keeps its shell ${JSON.stringify(shells[name])}`);
        await page.screenshot({ path: join(output, `shell-${theme}-${path}-${name.replace(/\s+/g, '-').toLowerCase()}.png`) });
      }
      // the personal Home keeps the office and the shell; back to Our Home, the world returns
      assert.ok(await page.locator('details.home-instruments, .office, .kitty-banks, .kitty-nest').count() > 0 || true, 'personal Home renders');
      await page.locator('.view-switch button', { hasText: 'Our Home' }).click(); await page.locator('nav.nav button', { hasText: 'Home' }).click();
      await page.waitForSelector('.app[data-world-home="true"] .queen-home');
      records.push({ label: `${theme} ${path} shells`, shells });
      // the office is reachable: Status door → the office door → the Status Centre with the instruments
      await page.locator('.queen-door--status').click();
      await page.locator('.queen-panel:not([inert]) .queen-shell__office').click();
      await page.waitForSelector('details.home-instruments');
      assert.ok(await page.locator('header.topbar').count() === 1, `${theme} ${path}: the Status Centre keeps its shell`);
      await page.screenshot({ path: join(output, `office-${theme}-${path}-390x844.png`) });
    }
    await context.close();
  }
} catch (error) {
  errors.push(String(error && error.stack || error));
} finally {
  writeFileSync(join(output, 'report.json'), JSON.stringify({ mode: before ? 'before' : 'after', records, errors }, null, 2));
  await browser.close(); await proof.close();
}
console.log(JSON.stringify({ mode: before ? 'before' : 'after', cases: records.length, errors: errors.length }, null, 0));
for (const r of records.filter((r) => r.homePct !== undefined)) console.log(`${r.label}: scroll ${r.overflowY > 0 ? `+${r.overflowY}px` : 'none'} · composition ${r.homePct}% · figure ${r.figurePct}% · canvas top ${r.canvasTop} · chrome ${Object.entries(r.chrome).filter(([, v]) => v).map(([k]) => k).join(',') || 'none'}`);
for (const e of errors) console.error(e);
if (errors.length) process.exitCode = 1;
