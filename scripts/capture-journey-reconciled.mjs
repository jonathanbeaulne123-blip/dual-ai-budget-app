/**
 * Post-reconciliation Journey browser proof.
 *
 * Runs the synthetic `story=plan` fixture; use VITE_FUND_MODEL_V2=1 and
 * CHROME_PATH when the default Playwright browser is not installed.
 *
 *   OUT=/absolute/ignored/path node scripts/capture-journey-reconciled.mjs
 *
 * The proof is deliberately fatal: any failed assertion, page/console error,
 * failed local request, or non-local request makes the process exit non-zero.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';

const THEMES = (process.env.THEMES || 'classic,taylor,newfoundland').split(',');
const WIDTHS = (process.env.WIDTHS || '320,390,720,1100').split(',').map(Number);
const LEVELS = [
  ['Day', '0'],
  ['Week', '1'],
  ['Month', '2'],
  ['Era', '3'],
  ['Journey', '4'],
];
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const startedAt = new Date().toISOString();
const runStarted = performance.now();
const out = process.env.OUT || `/tmp/hearth-journey-reconcile-${sha.slice(0, 12)}`;
mkdirSync(out, { recursive: true });

const launch = {
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
};
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;

const report = {
  schemaVersion: 1,
  sha,
  startedAt,
  finishedAt: null,
  durationMs: null,
  matrix: { themes: THEMES, widths: WIDTHS, scenarios: ['normal', 'reduced-nowebgl'] },
  fixture: null,
  rows: {},
  failures: [],
};

function assert(value, message, detail = undefined) {
  if (value) return;
  const suffix = detail === undefined ? '' : `: ${JSON.stringify(detail)}`;
  throw new Error(`${message}${suffix}`);
}

function safeName(value) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function miniCad(cents) {
  if (cents === null) return 'Backing unavailable';
  const abs = Math.abs(Math.round(cents));
  const whole = abs % 100 === 0;
  const text = (abs / 100).toLocaleString('en-CA', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? '−' : ''}$${text}`;
}

function noWebgl() {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(kind, ...args) {
    return /webgl/i.test(String(kind)) ? null : original.call(this, kind, ...args);
  };
}

function visibleState() {
  const visible = (element) => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const pageMini = document.querySelector('.path-world__simple .journey-mini');
  const cornerMini = document.querySelector('.path-hud__mini .journey-mini');
  const active = document.activeElement;
  return {
    game: document.querySelector('.path-world')?.dataset.game ?? null,
    worldLevel: document.querySelector('.path-world')?.dataset.level ?? null,
    pageLevel: pageMini?.dataset.level ?? null,
    cornerLevel: cornerMini?.dataset.level ?? null,
    pageTitle: pageMini?.querySelector('h2')?.textContent?.trim() ?? null,
    cornerTitle: cornerMini?.querySelector('h2')?.textContent?.trim()
      ?? cornerMini?.querySelector('.journey-mini__compact-caption')?.textContent?.trim()
      ?? null,
    caption: document.querySelector('.path-hud__caption')?.textContent?.trim() ?? null,
    card: document.querySelector('.path-world__card h3')?.textContent?.trim() ?? null,
    cardEyebrow: document.querySelector('.path-world__card .kicker')?.textContent?.trim() ?? null,
    fundDisplayed: Object.fromEntries(['prepare', 'protect', 'build'].map((lane) => [lane,
      document.querySelector(`.path-hud__tracker--${lane}`)?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    ])),
    replay: document.querySelector('.path-world__slider input')?.value ?? null,
    flatFallback: Boolean(document.querySelector('.path-world__stage .path-world__flat svg')),
    liveWebgl: document.querySelector('.path-world__host')?.getAttribute('data-live') === 'true',
    bannerVisible: visible(document.querySelector('.path-hud__banner')),
    navVisible: visible(document.querySelector('.nav')),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    focus: active ? {
      tag: active.tagName.toLowerCase(),
      className: String(active.className),
      label: (active.getAttribute('aria-label') || active.textContent || '').trim().slice(0, 100),
    } : null,
  };
}

async function main() {
  const proof = await startOurPathWorldProof({ port: 0 });
  const proofUrl = new URL(proof.url);
  const proofOrigin = proofUrl.origin;
  let browser = null;
  try {
    browser = await chromium.launch(launch);
  } catch (error) {
    await proof.close();
    throw error;
  }

  async function open(theme, width, scenario) {
    const height = width < 360 ? 640 : width < 720 ? 844 : 800;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      hasTouch: width < 720,
      reducedMotion: scenario === 'reduced-nowebgl' ? 'reduce' : 'no-preference',
    });
    if (scenario === 'reduced-nowebgl') await context.addInitScript(noWebgl);
    const page = await context.newPage();
    const errors = [];
    const blocked = [];
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === proofOrigin || url.protocol === 'data:' || url.protocol === 'blob:') {
        await route.continue();
      } else {
        blocked.push(url.href);
        await route.abort('blockedbyclient');
      }
    });
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
    page.on('console', (message) => {
      const text = message.text();
      const benignNoWebgl = scenario === 'reduced-nowebgl' && /Error creating WebGL context|WebGL unavailable/i.test(text);
      const benignGpu = /GPU stall|GL_CLOSE_PATH|swiftshader|Automatic fallback to software WebGL/i.test(text);
      if (message.type() === 'error' && !benignNoWebgl && !benignGpu) errors.push(`console: ${text}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`response: ${response.status()} ${response.url()}`);
    });
    page.on('websocket', (socket) => {
      const url = new URL(socket.url());
      if (url.hostname !== proofUrl.hostname || url.port !== proofUrl.port) blocked.push(socket.url());
    });
    const quality = width < 720 ? 'lite' : 'full';
    const query = new URLSearchParams({
      theme,
      story: 'plan',
      lantern: '1',
      quality,
      motion: scenario === 'reduced-nowebgl' ? 'reduced' : 'full',
      ambient: 'off',
      chrome: '1',
    });
    await page.goto(`${proof.url}?${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ready && document.querySelector('.path-world__simple .journey-mini'), null, { timeout: 180_000 });
    const proofState = await page.evaluate(() => window.__proof ?? null);
    assert(proofState?.synthetic === true, `${theme}-${width} ${scenario}: proof fixture is not explicitly synthetic`, proofState);
    assert(proofState?.fundModel2 === true, `${theme}-${width} ${scenario}: proof fixture is not explicitly Fund v2`, proofState);
    assert(proofState?.clientFundModelVersion === 2, `${theme}-${width} ${scenario}: browser build is not reading the real v2 release flag`, proofState?.clientFundModelVersion);
    assert(proofState?.canonicalFundSummary && typeof proofState.canonicalFundSummary === 'object', `${theme}-${width} ${scenario}: canonical Fund summary is missing`, proofState);
    report.fixture ??= proofState;
    await page.waitForFunction(() => !document.querySelector('.path-world__simple .journey-mini__stage[data-busy="true"]'), null, { timeout: 120_000 });
    await page.locator('.path-world__simple').scrollIntoViewIfNeeded();
    return { context, page, errors, blocked, proofState };
  }

  async function record(page, tag, extra = {}) {
    const state = await page.evaluate(visibleState);
    await page.screenshot({ path: `${out}/${safeName(tag)}.png`, fullPage: false });
    report.rows[tag] = { at: new Date().toISOString(), ...state, ...extra };
    return state;
  }

  async function assertClean(page, errors, blocked, where) {
    await page.waitForTimeout(100);
    assert(errors.length === 0, `${where}: browser errors`, errors);
    assert(blocked.length === 0, `${where}: non-local requests attempted`, blocked);
    const state = await page.evaluate(visibleState);
    assert(!state.overflow, `${where}: horizontal overflow`, state);
  }

  async function clickPageLevel(page, label, expected) {
    const button = page.locator('.path-world__simple .journey-mini__levels button', { hasText: label }).first();
    await button.click();
    await page.waitForFunction((level) => document.querySelector('.path-world__simple .journey-mini')?.dataset.level === level, expected, { timeout: 30_000 });
    await page.waitForFunction(() => !document.querySelector('.path-world__simple .journey-mini__stage[data-busy="true"]'), null, { timeout: 60_000 });
  }

  async function openGame(page) {
    const opener = page.locator('.path-world__simple .journey-mini__open').first();
    await opener.focus();
    const openerIdentity = await opener.evaluate((element) => ({
      label: element.getAttribute('aria-label') || element.textContent.trim(),
      className: element.className,
    }));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.path-world')?.dataset.game === 'open', null, { timeout: 30_000 });
    return openerIdentity;
  }

  async function minimizeWithEscape(page, openerIdentity) {
    for (let count = 0; count < 3 && await page.evaluate(() => Boolean(document.querySelector('.path-world')?.dataset.game)); count += 1) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
    await page.waitForFunction(() => !document.querySelector('.path-world')?.dataset.game, null, { timeout: 20_000 });
    await page.waitForFunction((label) => {
      const active = document.activeElement;
      return (active?.getAttribute('aria-label') || active?.textContent || '').trim() === label;
    }, openerIdentity.label, { timeout: 10_000 });
    const state = await page.evaluate(visibleState);
    assert(state.focus?.label === openerIdentity.label, 'minimize: focus did not return to the opener', { openerIdentity, focus: state.focus });
    return state;
  }

  try {
    for (const theme of THEMES) for (const width of WIDTHS) {
      const base = `${theme}-${width}`;

      // Scenario 1: ordinary WebGL journey, including both focus directions and both exits.
      {
        const rowStarted = performance.now();
        const { context, page, errors, blocked } = await open(theme, width, 'normal');
        try {
          for (const [label, expected] of LEVELS) {
            await clickPageLevel(page, label, expected);
            const state = await record(page, `${base}-normal-page-${label}`);
            assert(state.pageLevel === expected, `${base}: page failed to reach ${label}`, state);
          }

          // Enter from Month so the world has an exact expected landing.
          await clickPageLevel(page, 'Month', '2');
          const openerIdentity = await openGame(page);
          await page.waitForSelector('.path-world__host[data-live="true"]', { timeout: 180_000 });
          await page.waitForFunction(() => document.querySelector('.path-hud__mini .journey-mini'), null, { timeout: 60_000 });
          await page.waitForFunction(() => document.documentElement.classList.contains('path-world-settled'), null, { timeout: 30_000 });
          await page.waitForFunction(() => document.querySelector('.path-world')?.dataset.level === '2', null, { timeout: 60_000 });
          const expectedFund = Object.fromEntries(['prepare', 'protect', 'build'].map((lane) => [lane, miniCad(report.fixture.canonicalFundSummary[lane].amountCents)]));
          await page.waitForFunction((expected) => Object.entries(expected).every(([lane, amount]) => {
            const hudAmount = document.querySelector(`.path-hud__tracker--${lane}`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
            const label = lane[0].toUpperCase() + lane.slice(1);
            return hudAmount.startsWith(`${label} ${amount}`);
          }), expectedFund, { timeout: 60_000 });
          let state = await record(page, `${base}-normal-game-open`);
          assert(state.game === 'open' && state.liveWebgl, `${base}: live game did not open`, state);
          assert(!state.navVisible, `${base}: app navigation remained visible in game mode`, state);
          for (const lane of ['prepare', 'protect', 'build']) {
            const label = lane[0].toUpperCase() + lane.slice(1);
            assert(state.fundDisplayed[lane]?.startsWith(`${label} ${expectedFund[lane]}`), `${base}: HUD ${lane} amount differs from the canonical Fund`, state.fundDisplayed[lane]);
          }

          // Move out to Region, then pick the always-prioritized current-month marker. At narrow
          // widths other month labels deliberately yield to nearby labels and HUD obstacles.
          await page.getByRole('button', { name: 'Region', exact: true }).click();
          await page.waitForFunction(() => document.querySelector('.path-world')?.dataset.level === '1'
            && document.querySelector('.path-hud__mini .journey-mini')?.dataset.level === '3', null, { timeout: 60_000 });
          const today = report.fixture.canonicalFundSummary.flow.today;
          const expectedMonth = {
            monthFull: new Date(`${today}T12:00:00Z`).toLocaleString('en-CA', { month: 'long', timeZone: 'UTC' }),
            monthShort: new Date(`${today}T12:00:00Z`).toLocaleString('en-CA', { month: 'short', timeZone: 'UTC' }).replace('.', ''),
          };
          await page.locator('.path-mark--now').waitFor({ state: 'visible', timeout: 30_000 });
          const worldPick = await page.evaluate(() => {
            const mark = document.querySelector('.path-mark--now');
            if (!mark) return null;
            const aria = mark.getAttribute('aria-label') || mark.textContent.trim();
            return { place: mark.dataset.place, label: aria };
          });
          assert(worldPick?.place, `${base}: no current-month world mark was available to pick`, worldPick);
          Object.assign(worldPick, expectedMonth);
          await page.locator('.path-mark--now').click();
          await page.waitForFunction(({ place, monthFull, monthShort }) => {
            const pageMini = document.querySelector('.path-world__simple .journey-mini');
            const corner = document.querySelector('.path-hud__mini .journey-mini');
            const card = document.querySelector('.path-world__card');
            const eyebrow = card?.querySelector('.kicker')?.textContent ?? '';
            const selectedMark = document.querySelector(`.path-mark[data-place="${CSS.escape(place)}"]`);
            const pageWords = `${pageMini?.querySelector('h2')?.textContent ?? ''} ${pageMini?.querySelector('.journey-mini__sub')?.textContent ?? ''}`;
            const cornerWords = corner?.querySelector('.journey-mini__compact-caption')?.textContent ?? '';
            return Boolean(selectedMark && card)
              && eyebrow.includes(monthFull)
              && pageMini?.dataset.level === '2'
              && corner?.dataset.level === '2'
              && pageWords.includes(monthFull)
              && cornerWords.includes(monthShort);
          }, worldPick, { timeout: 60_000 });
          state = await record(page, `${base}-normal-world-pick`, { worldPick });
          assert(state.pageLevel === '2' && state.cornerLevel === '2', `${base}: world month pick did not synchronize both mini views at Month`, state);
          assert(state.cardEyebrow?.includes(worldPick.monthFull), `${base}: world card does not identify the selected month`, state);
          assert(`${state.pageTitle ?? ''}`.includes(worldPick.monthFull), `${base}: page mini does not identify the selected month`, state);
          assert(`${state.cornerTitle ?? ''}`.includes(worldPick.monthShort), `${base}: compact mini does not identify the selected month`, state);

          // Move the corner minimap to Journey and pick another era. The world must land and describe it.
          await page.locator('.path-world__card .path-world__close').click();
          await page.waitForFunction(() => !document.querySelector('.path-world__card'), null, { timeout: 10_000 });
          await page.locator('.path-hud__mini .journey-mini__levels button[aria-label="Journey"]').click();
          await page.waitForFunction(() => document.querySelector('.path-hud__mini .journey-mini')?.dataset.level === '4', null, { timeout: 30_000 });
          const miniPick = await page.evaluate(() => {
            const labels = [...document.querySelectorAll('.path-hud__mini .journey-mini__label[data-place^="era:"]')].filter((element) => {
              const box = element.getBoundingClientRect();
              return !element.hidden && box.width > 0 && box.height > 0 && getComputedStyle(element).pointerEvents !== 'none';
            });
            const label = labels.find((element) => !/We are here/i.test(element.textContent)) ?? labels[0];
            if (!label) return null;
            const aria = label.getAttribute('aria-label') || '';
            const expectedTitle = aria.split(',').slice(1, -1).join(',').trim();
            label.click();
            return { place: label.dataset.place, label: aria, expectedTitle };
          });
          assert(miniPick?.place && miniPick.expectedTitle, `${base}: no named minimap era was available to pick`, miniPick);
          await page.waitForFunction(({ place, expectedTitle }) => {
            const title = document.querySelector('.path-world__card h3')?.textContent?.trim();
            const selected = document.querySelector(`.path-mark--era[data-place="${CSS.escape(place)}"]`);
            return document.querySelector('.path-world')?.dataset.level === '2'
              && Boolean(selected)
              && title === expectedTitle;
          }, miniPick, { timeout: 90_000 });
          state = await record(page, `${base}-normal-minimap-pick`, { miniPick });
          assert(state.worldLevel === '2' && state.card === miniPick.expectedTitle, `${base}: minimap era pick did not move the world to the exact era`, state);

          await minimizeWithEscape(page, openerIdentity);
          await record(page, `${base}-normal-minimized`);
          await page.waitForFunction(() => !history.state?.hearthPathWorld, null, { timeout: 10_000 });

          // Reopen and use the browser's Back entry. It must minimize and restore focus too.
          const backOpener = await openGame(page);
          await page.waitForFunction(() => document.querySelector('.path-world')?.dataset.game === 'open', null, { timeout: 30_000 });
          await page.evaluate(() => history.back());
          await page.waitForFunction(() => !document.querySelector('.path-world')?.dataset.game, null, { timeout: 20_000 });
          await page.waitForFunction((label) => {
            const active = document.activeElement;
            return (active?.getAttribute('aria-label') || active?.textContent || '').trim() === label;
          }, backOpener.label, { timeout: 10_000 });
          state = await record(page, `${base}-normal-browser-back`);
          assert(state.focus?.label === backOpener.label, `${base}: browser Back did not restore opener focus`, { backOpener, state });
          await assertClean(page, errors, blocked, `${base} normal`);
          report.rows[`${base}-normal-timing`] = { durationMs: Math.round(performance.now() - rowStarted) };
        } finally {
          await context.close();
        }
      }

      // Scenario 2: reduced motion and unavailable WebGL together, at every theme and width.
      {
        const rowStarted = performance.now();
        const { context, page, errors, blocked } = await open(theme, width, 'reduced-nowebgl');
        try {
          const openerIdentity = await openGame(page);
          await page.waitForSelector('.path-world__stage .path-world__flat svg', { timeout: 30_000 });
          await page.waitForTimeout(100);
          const animations = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length);
          const state = await record(page, `${base}-reduced-nowebgl-open`, { runningAnimations: animations });
          assert(state.game === 'open' && state.flatFallback && !state.liveWebgl, `${base}: no-WebGL fallback did not replace the live world`, state);
          assert(animations === 0, `${base}: reduced-motion entry left running animations`, { animations });
          assert(!state.bannerVisible, `${base}: reduced-motion entry showed the game banner`, state);
          await minimizeWithEscape(page, openerIdentity);
          await record(page, `${base}-reduced-nowebgl-minimized`);
          await assertClean(page, errors, blocked, `${base} reduced-nowebgl`);
          report.rows[`${base}-reduced-nowebgl-timing`] = { durationMs: Math.round(performance.now() - rowStarted) };
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser?.close();
    await proof.close();
  }
}

try {
  await main();
} catch (error) {
  report.failures.push({ at: new Date().toISOString(), message: error instanceof Error ? error.stack || error.message : String(error) });
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.durationMs = Math.round(performance.now() - runStarted);
  writeFileSync(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ out, sha, failures: report.failures.length, durationMs: report.durationMs })}\n`);
}
