/** The Queen's world browser evidence: the 3D path (one renderer, one scene, still camera) and the flat path at
    320/390/720/1100 with the App's chrome stand-ins — no scroll in either, the same rest inventory, the banks as studio
    sculptures in both, render-on-demand frame timings, breath only under motion at rest, a context-creation failure
    degrading silently, keyboard/focus over the canvas, reduced motion, checking, empty, offline. Fictional books only. */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/queen-world');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const records = [], errors = [], notes = [];
const WIDTHS = [[320, 568], [320, 700], [390, 844], [720, 900], [1100, 800]];
const url = (params) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome: '1', ...params })}`;
const noScroll = (m, label) => { assert.ok(m.overflowX <= 1, `${label}: horizontal overflow ${m.overflowX}px`); assert.ok(m.overflowY <= 0, `${label}: the page scrolls by ${m.overflowY}px`); };

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement, home = document.querySelector('.queen-home');
    const controls = [...document.querySelectorAll('.queen-field button')].filter(el => !el.closest('[inert]'));
    const stats = window.__queenWorldStats ? window.__queenWorldStats() : null;
    const canvas = document.querySelector('.queen-world__canvas');
    const rect = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return {
      overflowX: doc.scrollWidth - doc.clientWidth, overflowY: doc.scrollHeight - doc.clientHeight,
      world: home?.dataset.world, live: document.querySelector('.queen-world')?.dataset.live ?? 'absent',
      controls: controls.map(el => el.className.split(' ')[0]),
      canvases: document.querySelectorAll('canvas').length,
      canvas: canvas ? rect(canvas) : null, field: rect(document.querySelector('.queen-field')),
      stats, pulse: home?.dataset.pulse, glaze: home?.dataset.glaze, hands: home?.dataset.hands,
      still: document.getElementById(document.querySelector('.queen-figure').getAttribute('aria-describedby'))?.textContent,
      portraits: [...document.querySelectorAll('.queen-bank-portrait')].filter(el => !el.closest('[inert]')).map(el => ({ id: el.dataset.worldBank, fired: el.dataset.fired, ...rect(el), flatVisible: getComputedStyle(el.querySelector('.queen-bank-flat')).visibility })),
      figureVisible: getComputedStyle(document.querySelector('.queen-svg')).visibility,
      mountAnimation: getComputedStyle(document.querySelector('.queen-mount')).animationName,
      note: document.querySelector('.kitty-render-note, [role=status], [role=alert]')?.textContent ?? null,
    };
  });
}
async function clickHer(page) { const her = page.locator('.queen-figure'); const b = await her.boundingBox(); await her.click({ position: { x: b.width / 2, y: b.height * 0.3 } }); }
const waitLive = (page, live) => page.waitForFunction((want) => document.querySelector('.queen-home')?.dataset.world === (want ? '3d' : 'flat') && (want ? window.__queenWorldStats && window.__queenWorldStats().frames > 0 : true), live, { timeout: 15000 });

const browser = await chromium.launch({ headless: true, ...exe, args: GL });
try {
  // ---- 1. The 3D path, reduced motion (the evidence context): every width, rest and expanded, no scroll, one canvas, still camera. ----
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const state of ['needs-us', 'building', 'grave', 'checking', 'empty']) for (const [width, height] of WIDTHS) {
    if (state !== 'building' && width !== 390 && width !== 1100) continue;
    await page.setViewportSize({ width, height });
    await page.goto(url({ state, world: '3d' }));
    await page.waitForSelector('.queen-home');
    await waitLive(page, true);
    await page.waitForTimeout(300);
    const m = await measure(page);
    const label = `3d ${state} ${width}x${height}`;
    noScroll(m, label);
    assert.equal(m.world, '3d', `${label}: world live`);
    assert.equal(m.canvases, 1, `${label}: one canvas for the whole world (${m.canvases})`);
    assert.ok(m.canvas && Math.abs(m.canvas.w - m.field.w) <= 2 && Math.abs(m.canvas.h - m.field.h) <= 2, `${label}: the canvas covers the field ${JSON.stringify(m.canvas)} vs ${JSON.stringify(m.field)}`);
    assert.deepEqual(m.controls, m.hands === 'move' ? ['queen-door', 'queen-figure', 'queen-move', 'queen-door'] : ['queen-door', 'queen-figure', 'queen-door'], `${label}: the rest inventory over the canvas`);
    assert.equal(m.figureVisible, 'hidden', `${label}: the drawn figure yields to the sculpture`);
    assert.equal(m.mountAnimation, 'none', `${label}: the DOM breath is off when the world breathes`);
    assert.equal(m.stats.breathing, false, `${label}: no breath under reduced motion`);
    assert.ok(/In the world: body/.test(m.still), `${label}: the 3D still is in words`);
    assert.equal(m.note, null, `${label}: no note, no error`);
    if (state === 'checking') assert.ok(/matte/.test(m.still), `${label}: matte still`);
    if (state === 'empty') assert.equal(m.hands, 'empty', `${label}: empty hands`);
    const framesBefore = m.stats.frames;
    await page.waitForTimeout(700);
    const idle = await page.evaluate(() => window.__queenWorldStats().frames);
    assert.ok(idle - framesBefore <= 2, `${label}: no frames while nothing changes (${framesBefore} → ${idle})`);
    const serious = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.length}`);
    await page.screenshot({ path: join(output, `3d-${state}-${width}x${height}.png`) });
    records.push({ path: '3d', scene: 'rest', state, width, height, overflowY: m.overflowY, frames: m.stats.frames, lastFrameMs: +m.stats.lastFrameMs.toFixed(2), maxFrameMs: +m.stats.maxFrameMs.toFixed(2), sculptures: m.stats.sculptures, axeSerious: serious });

    if (state !== 'building') continue;
    await clickHer(page);
    await page.waitForSelector('.queen-home.is-expanded');
    await page.waitForTimeout(900);
    const e = await measure(page);
    noScroll(e, `${label} expanded`);
    assert.ok(e.portraits.length >= 3, `${label} expanded: Protect, Build and a goal bank are placed (${e.portraits.map(p => p.id).join(', ')})`);
    for (const p of e.portraits) { assert.equal(p.flatVisible, 'hidden', `${label} expanded: ${p.id} flat twin yields to the sculpture`); assert.ok(p.w >= 20 && p.h >= 20, `${label} expanded: ${p.id} has a seat`); }
    assert.equal(e.stats.sculptures, 1 + e.portraits.length, `${label} expanded: one sculpture per placed bank plus her (${e.stats.sculptures})`);
    await page.screenshot({ path: join(output, `3d-expanded-${width}x${height}.png`) });
    records.push({ path: '3d', scene: 'expanded', width, height, overflowY: e.overflowY, portraits: e.portraits, sculptures: e.stats.sculptures, lastFrameMs: +e.stats.lastFrameMs.toFixed(2), maxFrameMs: +e.stats.maxFrameMs.toFixed(2) });
    await page.locator('.queen-bank--protect .queen-bank__button').click();
    await page.waitForSelector('.queen-home[data-open="protect"]');
    await page.waitForTimeout(600);
    noScroll(await measure(page), `${label} peek`);
    await page.screenshot({ path: join(output, `3d-peek-protect-${width}x${height}.png`) });
    await page.locator(width >= 720 ? '.queen-bank--protect .queen-bank__button' : '.queen-panel .queen-go--primary[data-door="protect"]').click();
    await page.waitForSelector('.queen-home[data-scene="cellar"]');
    await page.waitForTimeout(600);
    const c = await measure(page);
    noScroll(c, `${label} cellar`);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.queen-field')).opacity), '0', `${label} cellar: she does not follow you in`);
    await page.screenshot({ path: join(output, `3d-cellar-${width}x${height}.png`) });
    await page.locator('.queen-stair--up').click();
    await page.waitForSelector('.queen-home[data-scene="home"]');
  }

  // ---- 2. Keyboard over the canvas: the same walk as the flat path, ring visible. ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url({ state: 'needs-us', world: '3d' }));
  await waitLive(page, true);
  const order = [];
  for (let i = 0; i < 6; i += 1) { await page.keyboard.press('Tab'); const f = await page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el); return { className: el.className.split(' ')[0], outline: s.outlineStyle, width: parseFloat(s.outlineWidth) }; }); if (!f) break; order.push(f); }
  const stage = order.filter(f => /^queen-/.test(f.className));
  assert.deepEqual(stage.map(f => f.className), ['queen-door', 'queen-figure', 'queen-move', 'queen-door'], `keyboard over the canvas: ${stage.map(f => f.className).join(' → ')}`);
  for (const f of stage) assert.ok(f.outline !== 'none' && f.width >= 3, `ring on ${f.className}`);
  await page.evaluate(() => document.querySelector('.queen-figure').focus());
  await page.screenshot({ path: join(output, '3d-keyboard-focus-390x844.png') });
  records.push({ path: '3d', scene: 'keyboard', order: stage });

  // ---- 3. Freshness in 3D: offline is matte and unglazed, in words and in the material. ----
  await page.goto(url({ state: 'building', world: '3d', freshness: 'offline' }));
  await waitLive(page, true);
  const off = await measure(page);
  assert.equal(off.glaze, 'offline');
  assert.ok(/offline/.test(off.still), 'offline still');
  await page.screenshot({ path: join(output, '3d-offline-390x844.png') });
  records.push({ path: '3d', scene: 'offline', still: off.still });

  // ---- 4. Motion: she breathes at rest, on a 6s loop, and stops when expanded or when a peek is open. ----
  const motionContext = await browser.newContext({ reducedMotion: 'no-preference' });
  const motionPage = await motionContext.newPage();
  motionPage.on('pageerror', error => errors.push(error.message));
  await motionPage.setViewportSize({ width: 390, height: 844 });
  await motionPage.goto(url({ state: 'needs-us', world: '3d' }));
  await waitLive(motionPage, true);
  await motionPage.waitForTimeout(300);
  const b0 = await motionPage.evaluate(() => window.__queenWorldStats());
  assert.equal(b0.breathing, true, 'she breathes at rest under motion');
  await motionPage.waitForTimeout(1000);
  const b1 = await motionPage.evaluate(() => window.__queenWorldStats());
  assert.ok(b1.frames > b0.frames + 3, `breath frames flow (${b0.frames} → ${b1.frames}; software GL here is slow)`);
  await clickHer(motionPage);
  await motionPage.waitForSelector('.queen-home.is-expanded');
  await motionPage.waitForTimeout(400);
  const b2 = await motionPage.evaluate(() => window.__queenWorldStats());
  assert.equal(b2.breathing, false, 'expanded, she is still');
  await motionPage.waitForTimeout(700);
  const b3 = await motionPage.evaluate(() => window.__queenWorldStats());
  assert.ok(b3.frames - b2.frames <= 3, `no frames while expanded and untouched (${b2.frames} → ${b3.frames})`);
  await motionPage.screenshot({ path: join(output, '3d-motion-expanded-390x844.png') });
  records.push({ path: '3d', scene: 'motion', restBreathing: b0.breathing, breathFramesPerSecond: b1.frames - b0.frames, expandedBreathing: b2.breathing, framesWhileStill: b3.frames - b2.frames, lastFrameMs: +b3.lastFrameMs.toFixed(2), maxFrameMs: +b3.maxFrameMs.toFixed(2) });
  await motionContext.close();

  // ---- 5. The flat path by choice (`world=flat`): the same inventory, no canvas, the banks as flat studio pieces. ----
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ state: 'building', world: 'flat' }));
    await page.waitForSelector('.queen-home');
    await page.waitForTimeout(300);
    const m = await measure(page);
    const label = `flat ${width}x${height}`;
    noScroll(m, label);
    assert.equal(m.world, 'flat', `${label}`);
    assert.equal(m.live, 'absent', `${label}: no world host at all`);
    assert.equal(m.canvases, 0, `${label}: no canvas`);
    assert.equal(m.figureVisible, 'visible', `${label}: the drawn figure carries the still`);
    assert.ok(!/In the world:/.test(m.still) && /eyes (open|closed)/.test(m.still), `${label}: the flat still`);
    await clickHer(page);
    await page.waitForSelector('.queen-home.is-expanded');
    await page.waitForTimeout(700);
    const e = await measure(page);
    noScroll(e, `${label} expanded`);
    assert.ok(e.portraits.length >= 3 && e.portraits.every(p => p.flatVisible === 'visible' && p.w >= 20), `${label} expanded: flat studio pieces visible (${e.portraits.map(p => `${p.id}:${p.fired}`).join(', ')})`);
    await page.screenshot({ path: join(output, `flat-expanded-${width}x${height}.png`) });
    records.push({ path: 'flat', scene: 'expanded', width, height, overflowY: e.overflowY, portraits: e.portraits });
  }
  await context.close();
} finally {
  await browser.close();
}

// ---- 6. A browser with no WebGL at all: `auto` degrades silently — no note, no empty box, the flat reading intact. ----
const noGl = await chromium.launch({ headless: true, ...exe, args: ['--disable-3d-apis', '--disable-gpu'] });
try {
  const context = await noGl.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const [width, height] of [[390, 844], [1100, 800]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ state: 'building', world: 'auto' }));
    await page.waitForSelector('.queen-home');
    await page.waitForTimeout(2500);
    const m = await measure(page);
    const label = `no-webgl ${width}x${height}`;
    noScroll(m, label);
    assert.equal(m.world, 'flat', `${label}: degraded to flat`);
    assert.equal(m.live, 'false', `${label}: the host tried and yielded (${m.live})`);
    assert.equal(m.note, null, `${label}: no error shown`);
    assert.equal(m.figureVisible, 'visible', `${label}: the drawn figure is present`);
    assert.equal(m.canvases <= 1, true, `${label}: at most an inert canvas`);
    await clickHer(page);
    await page.waitForSelector('.queen-home.is-expanded');
    await page.waitForTimeout(700);
    const e = await measure(page);
    assert.ok(e.portraits.length >= 3 && e.portraits.every(p => p.flatVisible === 'visible'), `${label} expanded: banks readable without WebGL`);
    await page.screenshot({ path: join(output, `no-webgl-expanded-${width}x${height}.png`) });
    records.push({ path: 'no-webgl', scene: 'expanded', width, height, world: m.world, live: m.live, note: m.note, portraits: e.portraits.map(p => p.id) });
  }
  await context.close();
} finally {
  await noGl.close();
  await proof.close();
}

writeFileSync(join(output, 'records.json'), JSON.stringify({ records, notes, errors }, null, 2));
const seriousTotal = records.reduce((sum, row) => sum + (row.axeSerious?.length ?? 0), 0);
console.log(`queen-world-layout: ${records.length} records, ${seriousTotal} serious/critical axe rule hits, ${errors.length} page errors → ${output}`);
assert.equal(errors.length, 0, errors.join('\n'));
assert.equal(seriousTotal, 0, 'serious/critical axe hits');
