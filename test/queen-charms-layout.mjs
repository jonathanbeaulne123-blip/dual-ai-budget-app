/** The Queen's charms browser evidence: the 3D path, the flat path and a no-WebGL Chromium at 320/390/720/1100 with an
    empty bin, a few charms and the maximum — no scroll anywhere, the same charms drawn in every path, render on demand at
    the cap, the bin and bench as real controls (pointer press on her, a press on a reserved zone refused physically,
    keyboard walk with a visible ring), reduced motion, forced colours, easy read. Fictional books only. */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/queen-charms');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const records = [], errors = [];
const WIDTHS = [[320, 568], [320, 700], [390, 844], [720, 900], [1100, 800]];
const BINS = { none: 0, few: 3, max: 16 };
const url = (params) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome: '1', state: 'building', ...params })}`;
const noScroll = (m, label) => { assert.ok(m.overflowX <= 1, `${label}: horizontal overflow ${m.overflowX}px`); assert.ok(m.overflowY <= 0, `${label}: the page scrolls by ${m.overflowY}px`); };

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement, home = document.querySelector('.queen-home');
    const stats = window.__queenWorldStats ? window.__queenWorldStats() : null;
    const rect = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return {
      overflowX: doc.scrollWidth - doc.clientWidth, overflowY: doc.scrollHeight - doc.clientHeight,
      world: home?.dataset.world, live: document.querySelector('.queen-world')?.dataset.live ?? 'absent',
      charms: Number(home?.dataset.charms ?? 0), drawn: document.querySelectorAll('.queen-svg .queen-charm').length,
      drawnKinds: [...document.querySelectorAll('.queen-svg .queen-charm')].map(el => el.dataset.charm),
      canvases: document.querySelectorAll('canvas').length, stats,
      still: document.getElementById(document.querySelector('.queen-figure').getAttribute('aria-describedby'))?.textContent,
      mount: rect(document.querySelector('.queen-mount')),
      note: document.querySelector('.kitty-render-note, [role=status], [role=alert]')?.textContent ?? null,
      figureVisible: getComputedStyle(document.querySelector('.queen-svg')).visibility,
    };
  });
}
const waitLive = (page, live) => page.waitForFunction((want) => document.querySelector('.queen-home')?.dataset.world === (want ? '3d' : 'flat') && (want ? window.__queenWorldStats && window.__queenWorldStats().frames > 0 : true), live, { timeout: 20000 });
const charmWords = (m) => (m.still.match(/She wears (\d+) charms?: ([^.]*)\./) || [])[2] ?? '';
/* Where her features sit in the mount, as fractions: the sculpture is framed by her 4.6-unit height, the drawn figure by its 240×340 viewBox. */
const SPOTS = {
  '3d': { flank: [0.78, 0.8], eye: [0.558, 0.383], fill: [0.5, 0.8] },
  flat: { flank: [0.77, 0.715], eye: [0.44, 0.335], fill: [0.5, 0.715] },
};

const browser = await chromium.launch({ headless: true, ...exe, args: GL });
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));

  // ---- 1. Every width × both paths × empty / few / max: no scroll, the same charms in the still, the drawn figure and the world. ----
  for (const world of ['3d', 'flat']) for (const [bin, count] of Object.entries(BINS)) for (const [width, height] of WIDTHS) {
    if (bin === 'few' && width !== 390 && width !== 1100) continue;
    await page.setViewportSize({ width, height });
    await page.goto(url({ world, charms: bin }));
    await page.waitForSelector('.queen-home');
    await waitLive(page, world === '3d');
    await page.waitForTimeout(400);
    const m = await measure(page);
    const label = `${world} ${bin} ${width}x${height}`;
    noScroll(m, label);
    assert.equal(m.world, world, `${label}: path`);
    assert.equal(m.charms, count, `${label}: ${count} charms on her (${m.charms})`);
    assert.equal(m.drawn, count, `${label}: the drawn figure carries ${count} charms (${m.drawn})`);
    assert.equal((charmWords(m).match(/ on /g) || []).length, count, `${label}: the still names each charm and its seat`);
    if (world === '3d') {
      assert.equal(m.stats.charms, count, `${label}: ${count} instances in the world (${m.stats.charms})`);
      assert.ok(m.stats.charmDrawCalls <= Math.min(count, 12) * 2, `${label}: at most two draw calls per kind (${m.stats.charmDrawCalls})`);
      assert.equal(m.figureVisible, 'hidden', `${label}: the drawn figure yields to the sculpture`);
      const before = m.stats.frames;
      await page.waitForTimeout(700);
      const idle = await page.evaluate(() => window.__queenWorldStats().frames);
      assert.ok(idle - before <= 2, `${label}: no frames while nothing changes (${before} → ${idle})`);
    } else {
      assert.equal(m.canvases, 0, `${label}: no canvas`);
      assert.equal(m.figureVisible, 'visible', `${label}: the drawn figure carries the charms`);
    }
    assert.equal(m.note, null, `${label}: no note, no error`);
    await page.screenshot({ path: join(output, `${world}-${bin}-${width}x${height}.png`) });
    records.push({ path: world, bin, width, height, overflowY: m.overflowY, charms: m.charms, drawn: m.drawn, kinds: [...new Set(m.drawnKinds)].length, mount: m.mount, ...(m.stats ? { frames: m.stats.frames, lastFrameMs: +m.stats.lastFrameMs.toFixed(2), maxFrameMs: +m.stats.maxFrameMs.toFixed(2), charmDrawCalls: m.stats.charmDrawCalls, charmGeometries: m.stats.charmGeometries } : {}) });
  }

  // ---- 2. The bin and the bench, both paths: press from the bin, press her, press a reserved zone, walk with the keys, ring visible. ----
  for (const [world, width, height] of [['3d', 1100, 800], ['flat', 390, 844], ['3d', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ world, charms: 'none' }));
    await waitLive(page, world === '3d');
    await page.locator('.queen-door--status').click();
    await page.waitForTimeout(700);
    const label = `bench ${world} ${width}x${height}`;
    const bin = await page.$$eval('.queen-charm-pick', els => els.map(el => ({ label: el.getAttribute('aria-label'), disabled: el.getAttribute('aria-disabled') })));
    assert.equal(bin.length, 12, `${label}: twelve in the bin`);
    assert.equal(bin.filter(row => !row.disabled).length, 12, `${label}: the proof household earned every charm (${bin.filter(row => row.disabled).map(row => row.label).join('; ')})`);
    await page.locator('.queen-charm-pick', { hasText: 'Cat' }).click();
    await page.waitForTimeout(200);
    const row = page.locator('.queen-charm-row__pick');
    assert.match(await row.getAttribute('aria-label'), /A sitting cat on her left flank, pressed on by Alex \(fictional\); selected/, `${label}: seated and selected`);
    const target = page.locator('.queen-charm-target');
    assert.equal(await target.count(), 1, `${label}: she is the place to press it`);
    const box = await target.boundingBox();
    if (width < 720) await page.locator('.queen-panel__close').click(); // on the phone the sheet covers her; the selection survives closing it
    await page.waitForTimeout(500);
    const spot = (name) => [box.x + box.width * SPOTS[world][name][0], box.y + box.height * SPOTS[world][name][1]];
    await page.mouse.click(...spot('flank')); // her right flank
    await page.waitForTimeout(200);
    const flank = await page.$eval('.queen-svg .queen-charm', el => el.getAttribute('transform'));
    if (width >= 720) assert.match(await row.getAttribute('aria-label'), /on her right flank/, `${label}: pressed onto her right flank`);
    await page.mouse.click(...spot('eye')); // her eye: will not take
    await page.waitForTimeout(200);
    assert.equal(await page.$eval('.queen-svg .queen-charm', el => el.getAttribute('transform')), flank, `${label}: a press on her eye leaves the charm where it sat`);
    await page.mouse.click(...spot('fill')); // the belly's fill window: will not take
    await page.waitForTimeout(200);
    assert.equal(await page.$eval('.queen-svg .queen-charm', el => el.getAttribute('transform')), flank, `${label}: a press on the fill window leaves the charm where it sat`);
    await page.waitForTimeout(900); // kept as you go
    const kept = await page.evaluate(() => document.querySelector('.queen-charms-tool')?.textContent ?? '');
    if (width >= 720) assert.match(kept, /1 charm kept/, `${label}: kept`);
    await page.screenshot({ path: join(output, `bench-${world}-${width}x${height}.png`) });
    if (width < 720) { await page.locator('.queen-door--status').click(); await page.waitForTimeout(700); }
    // Keyboard: the bench in order, with a ring on each, and the arrows walk the charm.
    await page.locator('.queen-charm-row__pick').focus();
    const order = [];
    for (let i = 0; i < 6; i += 1) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const el = document.activeElement; const s = getComputedStyle(el); return { label: el.getAttribute('aria-label') ?? el.textContent, outline: s.outlineStyle, width: parseFloat(s.outlineWidth) }; })); }
    assert.deepEqual(order.map(f => f.label.split(',')[0]), ['Move with the arrow keys', 'Turn', 'Smaller', 'Bigger', 'Lean', 'Cream'], `${label}: bench order ${order.map(f => f.label).join(' → ')}`);
    for (const f of order) assert.ok(f.outline !== 'none' && f.width >= 3, `${label}: ring on ${f.label}`);
    await page.locator('.queen-charm-bench button', { hasText: 'Move' }).focus();
    const before = await page.$eval('.queen-svg .queen-charm', el => el.getAttribute('transform'));
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(150);
    const after = await page.$eval('.queen-svg .queen-charm', el => el.getAttribute('transform'));
    assert.notEqual(after, before, `${label}: ArrowUp walks the charm`);
    await page.locator('.queen-charm-bench button', { hasText: 'Move' }).focus();
    await page.screenshot({ path: join(output, `bench-keyboard-${world}-${width}x${height}.png`) });
    const serious = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.length}`);
    records.push({ path: world, scene: 'bench', width, height, order: order.map(f => f.label), axeSerious: serious });
    await page.keyboard.press('Escape');
  }

  // ---- 3. Forced colours and easy read on the flat path: the charms are still shapes, the bin still reads. ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto(url({ world: 'auto', charms: 'max', easy: '1' }));
  await page.waitForSelector('.queen-home');
  await page.waitForTimeout(800);
  const fc = await measure(page);
  noScroll(fc, 'forced colours 390x844');
  assert.equal(fc.world, 'flat', 'forced colours take the flat path');
  assert.equal(fc.drawn, 16, `forced colours: every charm drawn (${fc.drawn})`);
  await page.screenshot({ path: join(output, 'forced-colors-easy-max-390x844.png') });
  await page.locator('.queen-door--status').click();
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('.queen-charms-tool').scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: join(output, 'forced-colors-easy-bin-390x844.png') });
  records.push({ path: 'flat', scene: 'forced-colors+easy', width: 390, height: 844, drawn: fc.drawn, overflowY: fc.overflowY });
  await page.emulateMedia({ forcedColors: 'none' });
  await context.close();
} finally {
  await browser.close();
}

// ---- 4. No WebGL at all: `auto` degrades silently and the household still sees its own Queen wearing its own charms. ----
const noGl = await chromium.launch({ headless: true, ...exe, args: ['--disable-3d-apis', '--disable-gpu'] });
try {
  const context = await noGl.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const [bin, count] of Object.entries(BINS)) for (const [width, height] of WIDTHS) {
    if (bin !== 'max' && width !== 390) continue;
    await page.setViewportSize({ width, height });
    await page.goto(url({ world: 'auto', charms: bin }));
    await page.waitForSelector('.queen-home');
    await page.waitForTimeout(2500);
    const m = await measure(page);
    const label = `no-webgl ${bin} ${width}x${height}`;
    noScroll(m, label);
    assert.equal(m.world, 'flat', `${label}: degraded to flat`);
    assert.equal(m.live, 'false', `${label}: the host tried and yielded (${m.live})`);
    assert.equal(m.note, null, `${label}: no error shown`);
    assert.equal(m.drawn, count, `${label}: ${count} charms drawn (${m.drawn})`);
    await page.screenshot({ path: join(output, `no-webgl-${bin}-${width}x${height}.png`) });
    records.push({ path: 'no-webgl', bin, width, height, world: m.world, live: m.live, drawn: m.drawn, overflowY: m.overflowY });
  }
  await context.close();
} finally {
  await noGl.close();
  await proof.close();
}

writeFileSync(join(output, 'records.json'), JSON.stringify({ records, errors }, null, 2));
const seriousTotal = records.reduce((sum, row) => sum + (row.axeSerious?.length ?? 0), 0);
console.log(`queen-charms-layout: ${records.length} records, ${seriousTotal} serious/critical axe rule hits, ${errors.length} page errors → ${output}`);
assert.equal(errors.length, 0, errors.join('\n'));
assert.equal(seriousTotal, 0, 'serious/critical axe hits');
