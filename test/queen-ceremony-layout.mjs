/** The Queen's creation and history — browser evidence: the wheel, a tipped Queen, rings at one and twelve, a portrait shelf
    of ten and the living light at four points in the year, across the 3D path, the flat path and a no-WebGL Chromium at
    320/390/720/1100 with the maximum of charms — no scroll anywhere, render on demand, keyboard-only ceremony, reduced
    motion, forced colours, easy read. Fictional books only. */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/queen-ceremony');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const records = [], errors = [];
const WIDTHS = [[320, 568], [390, 844], [720, 900], [1100, 800]];
/* The full load: twelve rings, sixteen charms, a shelf of ten, thrown, on a day after the tenth year has closed. */
const FULL = { rings: '12', charms: 'max', portraits: '10', wheel: '1', today: '2036-01-04', clock: '13' };
const url = (params) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome: '1', state: 'building', ...params })}`;
const noScroll = (m, label) => { assert.ok(m.overflowX <= 1, `${label}: horizontal overflow ${m.overflowX}px`); assert.ok(m.overflowY <= 0, `${label}: the page scrolls by ${m.overflowY}px`); };

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement, home = document.querySelector('.queen-home');
    const stats = window.__queenWorldStats ? window.__queenWorldStats() : null;
    return {
      overflowX: doc.scrollWidth - doc.clientWidth, overflowY: doc.scrollHeight - doc.clientHeight,
      world: home?.dataset.world, live: document.querySelector('.queen-world')?.dataset.live ?? 'absent',
      rings: Number(home?.dataset.rings ?? 0), thrown: home?.dataset.thrown, tipped: home?.dataset.tipped, portraits: Number(home?.dataset.portraits ?? 0),
      charms: Number(home?.dataset.charms ?? 0), drawn: document.querySelectorAll('.queen-figure .queen-svg .queen-charm').length,
      ringsDrawn: document.querySelectorAll('.queen-figure .queen-svg .queen-ring').length,
      underside: document.querySelectorAll('.queen-figure .queen-underside').length,
      canvases: document.querySelectorAll('canvas').length, stats,
      light: { level: home?.style.getPropertyValue('--queen-light-level'), warmth: home?.style.getPropertyValue('--queen-light-warmth') },
      still: document.getElementById(document.querySelector('.queen-figure').getAttribute('aria-describedby'))?.textContent,
      note: document.querySelector('.kitty-render-note, [role=status], [role=alert]')?.textContent ?? null,
      figureVisible: getComputedStyle(document.querySelector('.queen-figure .queen-svg')).visibility,
    };
  });
}
const waitLive = (page, live) => page.waitForFunction((want) => document.querySelector('.queen-home')?.dataset.world === (want ? '3d' : 'flat') && (want ? window.__queenWorldStats && window.__queenWorldStats().frames > 0 : true), live, { timeout: 20000 });

const browser = await chromium.launch({ headless: true, ...exe, args: GL });
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));

  // ---- 1. Every width × both paths at the full load, and rings at one: no scroll, the rings, the shelf and the wheel all present in the still. ----
  for (const world of ['3d', 'flat']) for (const [load, params] of [['full', FULL], ['one-ring', { rings: '1', charms: 'none' }]]) for (const [width, height] of WIDTHS) {
    if (load === 'one-ring' && width !== 390 && width !== 1100) continue;
    await page.setViewportSize({ width, height });
    await page.goto(url({ world, ...params }));
    await page.waitForSelector('.queen-home');
    await waitLive(page, world === '3d');
    await page.waitForTimeout(400);
    const m = await measure(page);
    const label = `${world} ${load} ${width}x${height}`;
    noScroll(m, label);
    assert.equal(m.world, world, `${label}: path`);
    assert.equal(m.rings, Number(params.rings), `${label}: ${params.rings} rings (${m.rings})`);
    assert.equal(m.ringsDrawn, Number(params.rings), `${label}: the drawn figure carries ${params.rings} ring arcs (${m.ringsDrawn})`);
    assert.match(m.still, new RegExp(`${params.rings} growth rings?`), `${label}: the still counts the rings`);
    if (load === 'full') {
      assert.equal(m.portraits, 10, `${label}: a shelf of ten (${m.portraits})`);
      assert.equal(m.thrown, 'true', `${label}: thrown`);
      assert.equal(m.charms, 16, `${label}: sixteen charms (${m.charms})`);
      assert.match(m.still, /Thrown on the wheel: form pulled by Alex \(fictional\), rim opened by Sam \(fictional\)/, `${label}: the still names both turns`);
    }
    if (world === '3d') {
      assert.equal(m.stats.rings, Number(params.rings), `${label}: the sculpture carries the rings (${m.stats.rings})`);
      assert.equal(m.figureVisible, 'hidden', `${label}: the drawn figure yields to the sculpture`);
      const before = m.stats.frames;
      await page.waitForTimeout(700);
      const idle = await page.evaluate(() => window.__queenWorldStats().frames);
      assert.ok(idle - before <= 2, `${label}: no frames while nothing changes (${before} → ${idle})`);
    } else assert.equal(m.canvases, 0, `${label}: no canvas`);
    assert.equal(m.note, null, `${label}: no note, no error`);
    await page.screenshot({ path: join(output, `${world}-${load}-${width}x${height}.png`) });
    records.push({ path: world, load, width, height, overflowY: m.overflowY, rings: m.rings, ringsDrawn: m.ringsDrawn, charms: m.charms, portraits: m.portraits, thrown: m.thrown, ...(m.stats ? { frames: m.stats.frames, lastFrameMs: +m.stats.lastFrameMs.toFixed(2), maxFrameMs: +m.stats.maxFrameMs.toFixed(2) } : {}) });
  }

  // ---- 2. The wheel, by keyboard alone, in both paths: whose turn, the hand-over, the different part, kept — no progress bar, no skip. ----
  for (const [world, width, height] of [['3d', 1100, 800], ['flat', 390, 844], ['3d', 320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ world, rings: '3', charms: 'few' }));
    await waitLive(page, world === '3d');
    await page.locator('.queen-door--status').click();
    await page.waitForTimeout(700);
    const label = `wheel ${world} ${width}x${height}`;
    const wheel = page.locator('.queen-wheel');
    await wheel.scrollIntoViewIfNeeded();
    const t1 = await wheel.locator('.queen-wheel__title').textContent();
    assert.equal(t1, 'Alex (fictional) pulls the form', `${label}: whose turn (${t1})`);
    assert.equal(await wheel.locator('progress, [role=progressbar]').count(), 0, `${label}: no progress bar`);
    assert.doesNotMatch(await wheel.textContent(), /step \d|skip/i, `${label}: no step counter, no skip`);
    const range = wheel.locator('input[type=range]');
    // Keyboard modality: reach the wheel with Tab, as a keyboard user would.
    await range.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.type), 'range', `${label}: Tab reaches the wheel`);
    const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { outline: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
    assert.ok(ring.outline !== 'none' && ring.width >= 3, `${label}: a ring on the wheel`);
    const vesselBefore = await page.$eval('.queen-wheel__preview .queen-wheel__part:nth-of-type(2) .queen-vessel', el => el.getAttribute('d'));
    const collarBefore = await page.$eval('.queen-wheel__preview .queen-wheel__part:nth-of-type(1) .queen-vessel', el => el.getAttribute('style'));
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    const vesselPulled = await page.$eval('.queen-wheel__preview .queen-wheel__part:nth-of-type(2) .queen-vessel', el => el.getAttribute('d'));
    const collarPulled = await page.$eval('.queen-wheel__preview .queen-wheel__part:nth-of-type(1) .queen-vessel', el => el.getAttribute('style'));
    assert.notEqual(vesselPulled, vesselBefore, `${label}: the pull changes the belly`);
    assert.equal(collarPulled, collarBefore, `${label}: the pull leaves the collar`);
    const liveWhilePulling = await measure(page);
    if (width >= 720) assert.equal(liveWhilePulling.stats ? liveWhilePulling.stats.rings : liveWhilePulling.rings, 3, `${label}: she keeps her rings while she is thrown`);
    await page.screenshot({ path: join(output, `wheel-pull-${world}-${width}x${height}.png`) });
    await page.locator('.queen-wheel .queen-act--primary', { hasText: 'Hand the wheel to Sam (fictional)' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const t2 = await wheel.locator('.queen-wheel__title').textContent();
    assert.equal(t2, 'Sam (fictional) opens the rim', `${label}: handed over (${t2})`);
    await range.focus();
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(150);
    const vesselRim = await page.$eval('.queen-wheel__preview .queen-wheel__part:nth-of-type(2) .queen-vessel', el => el.getAttribute('d'));
    const collarRim = await page.$eval('.queen-wheel__preview .queen-wheel__part:nth-of-type(1) .queen-vessel', el => el.getAttribute('style'));
    assert.notEqual(collarRim, collarPulled, `${label}: the rim changes the collar`);
    assert.notEqual(vesselRim, vesselBefore, `${label}: the belly keeps the pull`);
    await page.screenshot({ path: join(output, `wheel-rim-${world}-${width}x${height}.png`) });
    await page.locator('.queen-wheel .queen-act--primary', { hasText: 'Keep her' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const kept = await wheel.textContent();
    assert.match(kept, /Thrown together/, `${label}: kept`);
    assert.match(kept, /Form pulled by Alex \(fictional\).*rim opened by Alex \(fictional\)/, `${label}: each turn names who was signed in on this device — the same person here, which is the open shared-authorship item`);
    const after = await measure(page);
    assert.equal(after.thrown, 'true', `${label}: thrown on the record`);
    await page.screenshot({ path: join(output, `wheel-kept-${world}-${width}x${height}.png`) });
    const serious = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.length}`);
    records.push({ path: world, scene: 'wheel', width, height, turns: [t1, t2], axeSerious: serious, overflowY: after.overflowY });
    await page.keyboard.press('Escape');
  }

  // ---- 3. Tipped over, by keyboard: ArrowDown on her shows the underside with both marks and the date; ArrowUp rights her. ----
  for (const [world, width, height] of [['3d', 1100, 800], ['flat', 390, 844], ['3d', 390, 844], ['flat', 320, 568], ['3d', 720, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ world, ...FULL }));
    await waitLive(page, world === '3d');
    const label = `tipped ${world} ${width}x${height}`;
    await page.locator('.queen-figure').focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);
    const m = await measure(page);
    noScroll(m, label);
    assert.equal(m.tipped, 'true', `${label}: tipped`);
    assert.match(m.still, /Tipped over: her underside shows the makers' marks A and S and the date she was last worked on/, `${label}: the still says what the underside shows`);
    if (world === 'flat') { assert.equal(m.underside, 1, `${label}: the flat underside`); assert.equal(m.drawn, 0, `${label}: no charm on the underside`); }
    else assert.equal(m.stats.tipped, true, `${label}: the sculpture is tipped`);
    await page.screenshot({ path: join(output, `tipped-${world}-${width}x${height}.png`) });
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(300);
    assert.equal((await measure(page)).tipped, 'false', `${label}: righted`);
    records.push({ path: world, scene: 'tipped', width, height, overflowY: m.overflowY, underside: m.underside });
  }

  // ---- 4. The shelf: ten portraits in Status, both paths, no canvas for any of them. ----
  for (const [world, width, height] of [['3d', 1100, 800], ['flat', 390, 844], ['3d', 320, 568]]) {
    await page.setViewportSize({ width, height });
    let bare = null;
    if (world === '3d') { await page.goto(url({ world, ...FULL, portraits: '0' })); await waitLive(page, true); bare = await page.evaluate(() => window.__queenWorldStats().sculptures); }
    await page.goto(url({ world, ...FULL }));
    await waitLive(page, world === '3d');
    await page.locator('.queen-door--status').click();
    await page.waitForTimeout(700);
    const label = `shelf ${world} ${width}x${height}`;
    await page.locator('.queen-story').scrollIntoViewIfNeeded();
    const shelf = await page.evaluate(() => ({
      portraits: document.querySelectorAll('.queen-portrait').length, canvases: document.querySelectorAll('.queen-story canvas').length,
      years: [...document.querySelectorAll('.queen-portrait figcaption b')].map(el => el.textContent),
      charms: document.querySelectorAll('.queen-story .queen-charm').length, rings: document.querySelectorAll('.queen-story .queen-ring').length,
      width: document.querySelector('.queen-shelf-portraits').getBoundingClientRect().width, panel: document.querySelector('.queen-panel').getBoundingClientRect().width,
      stats: window.__queenWorldStats ? window.__queenWorldStats() : null,
    }));
    assert.equal(shelf.portraits, 10, `${label}: ten on the shelf (${shelf.portraits})`);
    assert.equal(shelf.canvases, 0, `${label}: stills, no canvas`);
    assert.deepEqual(shelf.years, ['2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033', '2034', '2035'], `${label}: the years`);
    assert.ok(shelf.width <= shelf.panel, `${label}: the shelf wraps inside the panel`);
    if (shelf.stats) assert.equal(shelf.stats.sculptures, bare, `${label}: no sculpture per portrait (${shelf.stats.sculptures} with ten, ${bare} with none)`);
    await page.screenshot({ path: join(output, `shelf-${world}-${width}x${height}.png`) });
    records.push({ path: world, scene: 'shelf', width, height, portraits: shelf.portraits, charms: shelf.charms, rings: shelf.rings, sculptures: shelf.stats?.sculptures ?? null });
    await page.keyboard.press('Escape');
  }

  // ---- 5. The living light at four points in the year, 3D at 720 and flat at 390: the lamps move, the glaze axis does not. ----
  const POINTS = [['2026-02-10', '18.5', 'february-evening'], ['2026-07-10', '13', 'july-noon'], ['2026-10-20', '7', 'october-dawn'], ['2026-12-21', '0', 'december-night']];
  for (const [world, width, height] of [['3d', 720, 900], ['flat', 390, 844]]) for (const [today, clock, name] of POINTS) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ world, rings: '3', charms: 'few', today, clock }));
    await waitLive(page, world === '3d');
    await page.waitForTimeout(300);
    const m = await measure(page);
    const label = `light ${world} ${name}`;
    noScroll(m, label);
    assert.match(m.still, /Glazed: the evidence is fresh/, `${label}: the glaze axis still reads fresh`);
    assert.ok(m.light.level !== '' && m.light.warmth !== '', `${label}: the light is on the root`);
    if (world === '3d') {
      assert.ok(m.stats.keyLight >= 1.9 * 0.62 - 1e-6 && m.stats.keyLight <= 1.9 + 1e-6, `${label}: the key lamp within its floor (${m.stats.keyLight})`);
      const before = m.stats.frames;
      await page.waitForTimeout(700);
      assert.ok((await page.evaluate(() => window.__queenWorldStats().frames)) - before <= 2, `${label}: the light never animates`);
    }
    await page.screenshot({ path: join(output, `light-${name}-${world}-${width}x${height}.png`) });
    records.push({ path: world, scene: 'light', point: name, width, height, level: Number(m.light.level), warmth: Number(m.light.warmth), keyLight: m.stats?.keyLight ?? null, keyHeight: m.stats?.keyHeight ?? null, keyColor: m.stats?.keyColor ?? null, words: (m.still.match(/(Low, blue night light|Low light|High light|Daylight), (warm|even|cool)\./) || [])[0] });
  }
  const lights = records.filter(r => r.scene === 'light' && r.path === '3d');
  assert.ok(lights.find(r => r.point === 'february-evening').keyLight < lights.find(r => r.point === 'july-noon').keyLight, 'February evening is lower than July noon');
  assert.ok(lights.find(r => r.point === 'february-evening').warmth < lights.find(r => r.point === 'july-noon').warmth, 'February evening is cooler than July noon');

  // ---- 6. Forced colours and easy read on the flat path: the rings are lines, the underside is a shape, the shelf still reads. ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto(url({ world: 'auto', ...FULL, easy: '1' }));
  await page.waitForSelector('.queen-home');
  await page.waitForTimeout(800);
  const fc = await measure(page);
  noScroll(fc, 'forced colours 390x844');
  assert.equal(fc.world, 'flat', 'forced colours take the flat path');
  assert.equal(fc.ringsDrawn, 12, `forced colours: twelve rings drawn (${fc.ringsDrawn})`);
  await page.screenshot({ path: join(output, 'forced-colors-easy-full-390x844.png') });
  await page.locator('.queen-figure').focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(output, 'forced-colors-easy-tipped-390x844.png') });
  await page.keyboard.press('ArrowUp');
  await page.locator('.queen-door--status').click();
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('.queen-story').scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: join(output, 'forced-colors-easy-shelf-390x844.png') });
  records.push({ path: 'flat', scene: 'forced-colors+easy', width: 390, height: 844, ringsDrawn: fc.ringsDrawn, overflowY: fc.overflowY });
  await page.emulateMedia({ forcedColors: 'none' });
  await context.close();
} finally {
  await browser.close();
}

// ---- 7. No WebGL at all: `auto` yields silently; rings, shelf and the tip are the flat expression. ----
const noGl = await chromium.launch({ headless: true, ...exe, args: ['--disable-3d-apis', '--disable-gpu'] });
try {
  const context = await noGl.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ world: 'auto', ...FULL }));
    await page.waitForSelector('.queen-home');
    await page.waitForTimeout(2500);
    const m = await measure(page);
    const label = `no-webgl full ${width}x${height}`;
    noScroll(m, label);
    assert.equal(m.world, 'flat', `${label}: degraded to flat`);
    assert.equal(m.live, 'false', `${label}: the host tried and yielded (${m.live})`);
    assert.equal(m.note, null, `${label}: no error shown`);
    assert.equal(m.ringsDrawn, 12, `${label}: twelve rings drawn (${m.ringsDrawn})`);
    assert.equal(m.drawn, 16, `${label}: sixteen charms drawn (${m.drawn})`);
    await page.screenshot({ path: join(output, `no-webgl-full-${width}x${height}.png`) });
    if (width === 390) {
      await page.locator('.queen-figure').focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      assert.equal((await measure(page)).underside, 1, `${label}: tipped, flat`);
      await page.screenshot({ path: join(output, `no-webgl-tipped-${width}x${height}.png`) });
      await page.keyboard.press('ArrowUp');
    }
    records.push({ path: 'no-webgl', load: 'full', width, height, world: m.world, live: m.live, ringsDrawn: m.ringsDrawn, drawn: m.drawn, overflowY: m.overflowY });
  }
  await context.close();
} finally {
  await noGl.close();
  await proof.close();
}

writeFileSync(join(output, 'records.json'), JSON.stringify({ records, errors }, null, 2));
const seriousTotal = records.reduce((sum, row) => sum + (row.axeSerious?.length ?? 0), 0);
console.log(`queen-ceremony-layout: ${records.length} records, ${seriousTotal} serious/critical axe rule hits, ${errors.length} page errors → ${output}`);
assert.equal(errors.length, 0, errors.join('\n'));
assert.equal(seriousTotal, 0, 'serious/critical axe hits');
