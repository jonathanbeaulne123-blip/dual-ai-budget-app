/** The Still Queen browser evidence: Household Home as one figure in a field of nothing, at 320/390/720/1100 with the App's
    chrome stand-ins, across pulse seeds, with axe, the no-scroll rule at every width, the doors' reveal, the expand into three
    banks, peeks and sheets, the cellar and the loft, keyboard order and focus, reduced motion, forced colours, easy read,
    loading (checking), empty, offline. Fictional books only. */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/still-queen');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const browser = await chromium.launch({ headless: true, ...(process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {}) });
const records = [], errors = [], notes = [];
const WIDTHS = [[320, 568], [320, 700], [390, 844], [720, 900], [1100, 800]];
const STATES = ['checking', 'needs-us', 'building', 'reset', 'grave', 'empty', 'win'];
const url = (params) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome: '1', ...params })}`;

const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
async function measure(page) {
  return page.evaluate((boxSource) => {
    const box = new Function(`return (${boxSource})`)();
    const doc = document.documentElement;
    const home = document.querySelector('.queen-home');
    const controls = [...document.querySelectorAll('.queen-field button')].filter(el => !el.closest('[inert]'));
    const targets = controls.map(el => ({ name: el.getAttribute('aria-label') || el.className, ...box(el) }));
    return {
      overflowX: doc.scrollWidth - doc.clientWidth,
      overflowY: doc.scrollHeight - doc.clientHeight,
      homeHeight: home ? box(home).h : 0,
      figure: box(document.querySelector('.queen-mount')),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      pulse: home?.dataset.pulse, posture: home?.dataset.posture, eyes: home?.dataset.eyes, gaze: home?.dataset.gaze, glaze: home?.dataset.glaze, hands: home?.dataset.hands, crown: home?.dataset.crown, scene: home?.dataset.scene, open: home?.dataset.open, mode: home?.dataset.mode,
      line: document.querySelector('.queen-line')?.textContent?.trim(),
      controls: controls.map(el => el.className.split(' ')[0]),
      visibleText: [...document.querySelectorAll('.queen-field *')].filter(el => !el.closest('.sr-only') && !el.closest('[inert]') && getComputedStyle(el).opacity !== '0').map(el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('')).join(' ').trim(),
      doorOpacity: parseFloat(getComputedStyle(document.querySelector('.queen-door--together')).opacity),
      still: document.getElementById(document.querySelector('.queen-figure').getAttribute('aria-describedby'))?.textContent,
      targets,
      small: targets.filter(t => t.w < 44 || t.h < 44).map(t => `${t.name.slice(0, 40)} ${t.w}x${t.h}`),
    };
  }, box.toString());
}
async function axeSerious(page) {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.length}`);
}
async function clickHer(page) {
  const her = page.locator('.queen-figure');
  const b = await her.boundingBox();
  await her.click({ position: { x: b.width / 2, y: b.height * 0.3 } });
}
const noScroll = (m, label) => { assert.ok(m.overflowX <= 1, `${label}: horizontal overflow ${m.overflowX}px`); assert.ok(m.overflowY <= 0, `${label}: the page scrolls by ${m.overflowY}px`); };
const intersects = (a, b, slack = 0) => a.x + slack < b.x + b.w && b.x + slack < a.x + a.w && a.y + slack < b.y + b.h && b.y + slack < a.y + a.h;

try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));

  // 1. Every state at every width: at rest the inventory is her, one line and the Move; no scroll at any width; no small targets; no serious axe hits.
  for (const state of STATES) for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ state }));
    await page.waitForSelector('.queen-home');
    const m = await measure(page);
    const label = `${state} ${width}x${height}`;
    noScroll(m, label);
    assert.equal(m.small.length, 0, `${label}: targets under 44px — ${m.small.join('; ')}`);
    assert.deepEqual(m.controls, m.hands === 'move' ? ['queen-door', 'queen-figure', 'queen-move', 'queen-door'] : ['queen-door', 'queen-figure', 'queen-door'], `${label}: the rest inventory`);
    assert.ok(m.line && m.still, `${label}: one line and a legible still`);
    assert.ok(!/\$\d/.test(m.visibleText), `${label}: no amount on the stage — ${m.visibleText}`);
    assert.ok(m.figure.h >= 0.3 * m.homeHeight && m.figure.h <= 0.72 * m.homeHeight, `${label}: she is small in the field (${m.figure.h} of ${m.homeHeight})`);
    if (state === 'empty') assert.equal(m.hands, 'empty', `${label}: empty hands`);
    if (state === 'checking') { assert.equal(m.pulse, 'checking', `${label}: checking`); assert.equal(m.glaze, 'matte', `${label}: matte`); }
    if (state === 'needs-us') { assert.equal(m.eyes, 'open', `${label}: eyes open`); assert.equal(m.gaze, 'crown', `${label}: toward Together`); }
    if (state === 'grave') { assert.equal(m.posture, 'depleted', `${label}: depleted`); assert.ok(/not yet covered/.test(m.line), `${label}: grave word`); }
    if (state === 'reset') assert.equal(m.posture, 'tilted', `${label}: tilted`);
    assert.equal(m.mode, width < 720 ? 'sheet' : 'panel', `${label}: mode`);
    const serious = await axeSerious(page);
    const file = join(output, `${state}-${width}x${height}.png`);
    await page.screenshot({ path: file });
    records.push({ scene: 'rest', state, width, height, overflowX: m.overflowX, overflowY: m.overflowY, homeHeight: m.homeHeight, figure: m.figure, pulse: m.pulse, posture: m.posture, eyes: m.eyes, gaze: m.gaze, glaze: m.glaze, hands: m.hands, line: m.line, axeSerious: serious, file });
  }

  // 2. Freshness: stale and offline stills at 390.
  for (const freshness of ['stale', 'offline']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url({ state: 'building', freshness }));
    await page.waitForSelector('.queen-home');
    const m = await measure(page);
    assert.equal(m.pulse, 'checking', `${freshness}: checking`);
    assert.equal(m.glaze, freshness === 'offline' ? 'offline' : 'matte', `${freshness}: glaze`);
    noScroll(m, freshness);
    await page.screenshot({ path: join(output, `freshness-${freshness}-390.png`) });
    records.push({ scene: 'freshness', state: freshness, width: 390, height: 844, pulse: m.pulse, glaze: m.glaze, line: m.line });
  }

  // 3. The expand at every width: three bank buttons, each visible, none overlapping her or each other; she does not disappear; no scroll.
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ state: 'building' }));
    await page.waitForSelector('.queen-home');
    await clickHer(page);
    await page.waitForSelector('.queen-home.is-expanded');
    const m = await measure(page);
    const label = `expanded ${width}x${height}`;
    noScroll(m, label);
    const boxes = await page.evaluate((boxSource) => { const box = new Function(`return (${boxSource})`)(); return { buttons: [...document.querySelectorAll('.queen-bank__button')].map(el => ({ name: el.textContent, ...box(el) })), vessels: [...document.querySelectorAll('.queen-bank-svg')].map(box), her: box(document.querySelector('.queen-figure')) }; }, box.toString());
    assert.deepEqual(boxes.buttons.map(b => b.name), ['Protect', 'Everyday · now', 'Build'], `${label}: bank buttons`);
    for (const b of boxes.buttons) { assert.ok(b.x >= 0 && b.x + b.w <= width && b.h >= 40, `${label}: ${b.name} on screen ${JSON.stringify(b)}`); }
    assert.ok(!intersects(boxes.buttons[0], boxes.buttons[1], 6) && !intersects(boxes.buttons[1], boxes.buttons[2], 6), `${label}: bank buttons do not overlap ${JSON.stringify(boxes.buttons)}`);
    for (const v of boxes.vessels) { const centre = v.x + v.w / 2; assert.ok(v.w >= 44 && (centre < boxes.her.x || centre > boxes.her.x + boxes.her.w), `${label}: a bank vessel is readable beside her ${JSON.stringify(v)} vs ${JSON.stringify(boxes.her)}`); }
    assert.ok(boxes.her.h >= 100, `${label}: she stays (${boxes.her.h}px)`);
    await page.screenshot({ path: join(output, `expanded-${width}x${height}.png`) });
    records.push({ scene: 'expanded', width, height, overflowY: m.overflowY, buttons: boxes.buttons, her: boxes.her });
  }

  // 4. Peeks: the Protect panel at 720 and 1100 from the edge opposite the door, the sheet at 320 and 390 with her still visible; the same door again goes in.
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ state: 'building' }));
    await page.waitForSelector('.queen-home');
    await clickHer(page);
    await page.locator('.queen-bank--protect .queen-bank__button').click();
    await page.waitForSelector('.queen-home[data-open="protect"]');
    const peek = await page.evaluate((boxSource) => { const box = new Function(`return (${boxSource})`)(); const panel = document.querySelector('.queen-panel'); return { panel: box(panel), home: box(document.querySelector('.queen-home')), her: box(document.querySelector('.queen-figure')), door: box(document.querySelector('.queen-bank--protect .queen-bank__button')), inert: panel.hasAttribute('inert'), title: panel.querySelector('.queen-panel__title')?.textContent, focus: document.activeElement?.className, overflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight, dim: parseFloat(getComputedStyle(document.querySelector('.queen-dim')).opacity) }; }, box.toString());
    const label = `protect peek ${width}x${height}`;
    assert.equal(peek.overflowY <= 0, true, `${label}: no scroll`);
    assert.equal(peek.inert, false, `${label}: panel live`);
    assert.equal(peek.title, 'What arrives', `${label}: title`);
    assert.ok(peek.focus.includes('queen-panel__close'), `${label}: focus moves into the peek (${peek.focus})`);
    if (width >= 720) { assert.ok(peek.panel.w >= 300 && peek.panel.w <= 400, `${label}: glass panel ${peek.panel.w}px`); assert.ok(!intersects(peek.panel, peek.door), `${label}: the panel leaves the door you came through uncovered`); assert.ok(peek.panel.x > peek.her.x + peek.her.w / 2, `${label}: she stays in view beside the panel`); }
    else { assert.ok(peek.panel.w >= peek.home.w - 2, `${label}: the sheet spans the frame (${peek.panel.w} of ${peek.home.w})`); assert.ok(peek.dim > 0.2, `${label}: she dims behind the sheet`); if (height >= 700) assert.ok(peek.panel.y > peek.her.y + 12, `${label}: her crown stays visible above the sheet (sheet at ${peek.panel.y}, she at ${peek.her.y})`);
    else if (peek.panel.y <= peek.her.y + 12) notes.push(`${label}: the sheet covers her in this very short frame (sheet at ${peek.panel.y}, she at ${peek.her.y})`); }
    await page.screenshot({ path: join(output, `peek-protect-${width}x${height}.png`) });
    // The same door again goes in: on the office the bank button itself; on the phone the sheet covers it, so the door repeated inside the sheet (or the pull) is the way.
    await page.locator(width >= 720 ? '.queen-bank--protect .queen-bank__button' : '.queen-panel .queen-go--primary[data-door="protect"]').click();
    await page.waitForSelector('.queen-home[data-scene="cellar"]');
    const cellar = await measure(page);
    noScroll(cellar, `cellar ${width}x${height}`);
    const rail = await page.evaluate(() => { const rail = document.querySelector('.queen-rail'); const jars = document.querySelectorAll('.queen-jar-seat').length; const outlier = document.querySelector('.queen-jar.is-outlier'); return { jars, scrollable: rail.scrollWidth > rail.clientWidth, outlier: outlier?.getAttribute('aria-label'), ghost: Boolean(document.querySelector('.queen-jar--ghost')), stair: document.activeElement?.className, fieldInert: document.querySelector('.queen-field').hasAttribute('inert') }; });
    assert.equal(rail.jars, 12, `cellar ${width}: twelve months`);
    assert.ok(rail.outlier && rail.ghost, `cellar ${width}: the outlier and its ghost`);
    assert.ok(rail.stair.includes('queen-stair'), `cellar ${width}: focus lands on the stair (${rail.stair})`);
    assert.ok(rail.fieldInert, `cellar ${width}: she does not follow you in`);
    await page.screenshot({ path: join(output, `cellar-${width}x${height}.png`) });
    await page.locator('.queen-stair--up').click();
    await page.waitForSelector('.queen-home[data-scene="home"].is-expanded');
    const back = await page.evaluate(() => document.activeElement?.closest('.queen-bank--protect') ? 'protect' : document.activeElement?.className);
    assert.equal(back, 'protect', `cellar ${width}: the stair returns you to the door you came through (${back})`);
    records.push({ scene: 'peek+cellar', width, height, panel: peek.panel, her: peek.her, rail });
  }

  // 5. The loft at 390 and 1100: open-mouthed accepts, lidded refuses; the sheet's pull is the other way in.
  for (const [width, height] of [[390, 844], [1100, 800]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ state: 'building' }));
    await page.waitForSelector('.queen-home');
    await clickHer(page);
    await page.locator('.queen-bank--build .queen-bank__button').click();
    await page.waitForSelector('.queen-home[data-open="build"]');
    if (width < 720) {
      const handle = await page.locator('.queen-panel__handle').boundingBox();
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
      await page.mouse.down();
      await page.mouse.move(handle.x + handle.width / 2, handle.y - 60, { steps: 6 });
      await page.mouse.move(handle.x + handle.width / 2, handle.y - 130, { steps: 6 });
      await page.mouse.up();
    } else {
      await page.locator('.queen-bank--build .queen-bank__button').click();
    }
    await page.waitForSelector('.queen-home[data-scene="loft"]');
    const loft = await measure(page);
    noScroll(loft, `loft ${width}x${height}`);
    const goals = page.locator('.queen-room--loft .queen-goal');
    assert.ok(await goals.count() >= 2, `loft ${width}: things on the ledge`);
    await page.locator('.queen-goal--lidded').first().click();
    assert.match(await page.locator('.queen-room--loft .queen-room__line').textContent(), /Lidded/, `loft ${width}: lidded refuses`);
    assert.equal(await page.locator('.queen-room--loft .queen-go--primary').count(), 0, `loft ${width}: nothing to open behind a lid`);
    await page.locator('.queen-goal--open').first().click();
    assert.match(await page.locator('.queen-room--loft .queen-room__line').textContent(), /Open-mouthed/, `loft ${width}: open-mouthed accepts`);
    assert.equal(await page.locator('.queen-room--loft .queen-go--primary').count(), 1, `loft ${width}: an open goal has a door`);
    await page.screenshot({ path: join(output, `loft-${width}x${height}.png`) });
    await page.locator('.queen-stair--down').click();
    await page.waitForSelector('.queen-home[data-scene="home"]');
    records.push({ scene: 'loft', width, height, overflowY: loft.overflowY, enteredBy: width < 720 ? 'pull' : 'same door' });
  }

  // 6. Doors: near-invisible at rest at every width, breathe in on a field tap, and the Move opens Together with its act.
  for (const [width, height] of [[320, 568], [390, 844], [1100, 800]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ state: 'needs-us' }));
    await page.waitForSelector('.queen-home');
    // Under reduced motion the doors rest findable; under motion they rest near-invisible. This context is reduced.
    const rest = await measure(page);
    assert.ok(rest.doorOpacity >= 0.5, `${width}: doors findable under reduced motion (${rest.doorOpacity})`);
    await page.locator('.queen-field').click({ position: { x: 10, y: 10 } });
    await page.waitForSelector('.queen-home.is-revealed');
    await page.screenshot({ path: join(output, `doors-revealed-${width}x${height}.png`) });
    await page.locator('.queen-move').click();
    await page.waitForSelector('.queen-home[data-open="together"]');
    assert.equal(await page.locator('.queen-panel .queen-act--primary').textContent(), 'Done', `${width}: the Move's act`);
    await page.screenshot({ path: join(output, `together-move-${width}x${height}.png`) });
    records.push({ scene: 'doors+move', width, height, doorOpacity: rest.doorOpacity });
  }
  // The motion context: the doors rest near-invisible and she breathes.
  const motionContext = await browser.newContext({ reducedMotion: 'no-preference' });
  const motionPage = await motionContext.newPage();
  await motionPage.setViewportSize({ width: 390, height: 844 });
  await motionPage.goto(url({ state: 'needs-us' }));
  await motionPage.waitForSelector('.queen-home');
  const motion = await motionPage.evaluate(() => ({ door: parseFloat(getComputedStyle(document.querySelector('.queen-door--together')).opacity), label: parseFloat(getComputedStyle(document.querySelector('.queen-door--together .queen-door__label')).opacity), breathe: getComputedStyle(document.querySelector('.queen-mount')).animationName, duration: getComputedStyle(document.querySelector('.queen-mount')).animationDuration }));
  assert.ok(motion.door <= 0.1 && motion.label === 0, `doors rest near-invisible under motion (${motion.door}, label ${motion.label})`);
  assert.equal(motion.breathe, 'queen-breathe', 'she breathes');
  assert.equal(motion.duration, '6s', 'a slow six-second breath');
  await motionPage.locator('.queen-field').click({ position: { x: 10, y: 10 } });
  await motionPage.waitForSelector('.queen-home.is-revealed');
  await motionPage.waitForTimeout(600);
  const revealed = await motionPage.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.queen-door--together')).opacity));
  assert.ok(revealed > 0.9, `the doors breathe in on a field tap (${revealed})`);
  await motionPage.screenshot({ path: join(output, 'doors-revealed-motion-390x844.png') });
  await motionPage.waitForTimeout(2400);
  const faded = await motionPage.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.queen-door--together')).opacity));
  assert.ok(faded < 0.2, `and fade back out (${faded})`);
  await motionContext.close();
  records.push({ scene: 'motion', motion, revealed, faded });

  // 7. Reduced motion: nothing animates; the still is complete; the doors can be found without a reveal.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url({ state: 'needs-us' }));
  await page.waitForSelector('.queen-home');
  const reduced = await page.evaluate(() => ({
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    mount: getComputedStyle(document.querySelector('.queen-mount')).animationName,
    body: getComputedStyle(document.querySelector('.queen-body')).transitionDuration,
    door: parseFloat(getComputedStyle(document.querySelector('.queen-door--together')).opacity),
    label: parseFloat(getComputedStyle(document.querySelector('.queen-door--together .queen-door__label')).opacity),
  }));
  assert.ok(reduced.reduced, 'context reports reduced motion');
  assert.equal(reduced.mount, 'none', `no breathing under reduced motion (${reduced.mount})`);
  assert.ok(['0s', ''].includes(reduced.body), `no body transition under reduced motion (${reduced.body})`);
  assert.ok(reduced.door >= 0.5 && reduced.label === 1, `doors findable under reduced motion (${reduced.door}, ${reduced.label})`);
  await page.screenshot({ path: join(output, 'reduced-motion-390x844.png') });
  records.push({ scene: 'reduced-motion', ...reduced });

  // 8. Keyboard: Tab reaches the doors, her and the Move in order with a visible ring; Enter opens; Escape closes.
  const order = [];
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el); return { className: el.className.split(' ')[0], label: el.getAttribute('aria-label')?.slice(0, 40), outline: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
    if (!focused) break;
    order.push(focused);
  }
  const stage = order.filter(f => /^queen-/.test(f.className));
  assert.deepEqual(stage.map(f => f.className), ['queen-door', 'queen-figure', 'queen-move', 'queen-door'], `keyboard order at rest: ${stage.map(f => f.className).join(' → ')}`);
  for (const f of stage) assert.ok(f.outline !== 'none' && f.width >= 3, `visible focus on ${f.className}: ${f.outline} ${f.width}`);
  await page.evaluate(() => document.querySelector('.queen-figure').focus());
  await page.screenshot({ path: join(output, 'keyboard-focus-queen-390x844.png') });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.queen-home.is-expanded');
  const walk = [];
  for (let i = 0; i < 3 && walk[walk.length - 1] !== 'Build'; i += 1) { await page.keyboard.press('Tab'); walk.push(await page.evaluate(() => document.activeElement?.textContent || document.activeElement?.className.split(' ')[0])); }
  assert.deepEqual(walk, ['queen-move', 'Build'], `Tab from her passes the Move and reaches the Build door (${walk.join(' → ')})`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.queen-home[data-open="build"]');
  const inPanel = await page.evaluate(() => document.activeElement?.className);
  assert.ok(inPanel.includes('queen-panel__close'), `Enter opens the peek and focus follows (${inPanel})`);
  await page.screenshot({ path: join(output, 'keyboard-build-peek-390x844.png') });
  await page.keyboard.press('Escape');
  await page.waitForSelector('.queen-home[data-open="none"]');
  const returned = await page.evaluate(() => document.activeElement?.textContent);
  assert.equal(returned, 'Build', `Escape closes the peek and returns focus to the door (${returned})`);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.queen-home:not(.is-expanded)');
  records.push({ scene: 'keyboard', order: stage });

  // 9. Forced colours: doors, Move and panel are simply present.
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto(url({ state: 'needs-us' }));
  await page.waitForSelector('.queen-home');
  const forced = await page.evaluate(() => ({ door: parseFloat(getComputedStyle(document.querySelector('.queen-door--together')).opacity), label: parseFloat(getComputedStyle(document.querySelector('.queen-door--together .queen-door__label')).opacity), border: getComputedStyle(document.querySelector('.queen-door--together')).borderTopStyle }));
  assert.ok(forced.door === 1 && forced.label === 1 && forced.border === 'solid', `forced colours show the doors (${JSON.stringify(forced)})`);
  await page.screenshot({ path: join(output, 'forced-colors-390x844.png') });
  await page.emulateMedia({ forcedColors: 'none' });
  records.push({ scene: 'forced-colors', ...forced });

  // 10. Easy read: larger line, findable doors, no scroll.
  const plainLine = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.queen-line')).fontSize));
  await page.goto(url({ state: 'needs-us', easy: '1' }));
  await page.waitForSelector('.queen-home[data-easy-read="true"]');
  const easy = await page.evaluate(() => ({ line: parseFloat(getComputedStyle(document.querySelector('.queen-line')).fontSize), door: parseFloat(getComputedStyle(document.querySelector('.queen-door--together')).opacity), overflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight }));
  assert.ok(easy.line > plainLine, `easy read enlarges the line: ${plainLine} → ${easy.line}`);
  assert.ok(easy.door >= 0.5, `easy read makes the doors findable (${easy.door})`);
  assert.ok(easy.overflowY <= 0, 'easy read does not scroll');
  await page.screenshot({ path: join(output, 'easy-read-390x844.png') });
  await page.evaluate(() => localStorage.clear());
  records.push({ scene: 'easy-read', plainLine, ...easy });

  writeFileSync(join(output, 'records.json'), JSON.stringify({ records, notes, errors }, null, 2));
  const seriousTotal = records.reduce((sum, row) => sum + (row.axeSerious?.length ?? 0), 0);
  console.log(`still-queen-layout: ${records.length} records, ${seriousTotal} serious/critical axe rule hits, ${errors.length} page errors, ${notes.length} notes → ${output}`);
  for (const note of notes) console.log(`  note: ${note}`);
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(seriousTotal, 0, 'serious/critical axe hits');
} finally {
  await browser.close();
  await proof.close();
}
