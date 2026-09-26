/** The loft's rack, browser evidence: driven into the loft by the app's own two-tap gesture on the
    `composition=queen` proof page with `loft=1` (three fictional Build goals and the lidded date night on one
    shelf) — at 320/390/720/1100: the one shelf with its weight, pin and peg; a second shelf hung and a bank put
    down onto it by hand (a real drag) and by Shift+Arrow; the weight slid, the pin dropped, a divider moved; the jug
    tilted, the pour read in words, Confirm opened and closed without posting; then one pour posted and the notice
    read. In 3D and flat, without WebGL, under reduced motion, with the keyboard. No page scroll anywhere; the house
    never scrolls even when the rack does inside itself. Fictional books only. */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/queen-loft');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const records = [], errors = [];
const WIDTHS = [[320, 568], [320, 700], [390, 844], [720, 900], [1100, 800]];
const url = (params) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome: '1', state: 'building', bills: '1', loft: '1', today: '2026-09-12', ...params })}`;
const noScroll = (m, label) => { assert.ok(m.overflowX <= 1, `${label}: horizontal overflow ${m.overflowX}px`); assert.ok(m.overflowY <= 0, `${label}: the page scrolls by ${m.overflowY}px`); };
const MONEY = /\$\s?\d|\d[\d,]*\.\d\d/;

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement, home = document.querySelector('.queen-home'), loft = document.querySelector('.queen-room--loft');
    const rect = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const inRoom = el => { const r = el.getBoundingClientRect(), c = loft.getBoundingClientRect(); return r.width === 0 || (r.top >= c.top - 1 && r.bottom <= c.bottom + 1); };
    const rack = loft.querySelector('.queen-rack');
    const shelves = [...loft.querySelectorAll('[data-room-shelf]')].map(el => ({
      id: el.dataset.roomShelf,
      weight: el.querySelector('.queen-shelf__weight')?.getAttribute('aria-valuetext') ?? null,
      pin: el.querySelector('.queen-shelf__pin')?.getAttribute('aria-valuetext') ?? null,
      banks: [...el.querySelectorAll('[data-ledge-bank]')].map(b => b.getAttribute('aria-label').split(' — ')[0]),
      dividers: [...el.querySelectorAll('.queen-divider')].map(d => d.getAttribute('aria-valuetext')),
      ledge: el.querySelector('.queen-ledge')?.getAttribute('aria-label') ?? null,
      down: Boolean(el.querySelector('.queen-shelf__down')),
      ...rect(el),
    }));
    const tilt = loft.querySelector('.queen-jug__tilt');
    const parts = ['.queen-stair', '.queen-room__head', '.queen-rack', '.queen-jug', '.queen-room__line', '.queen-room__acts'];
    return {
      overflowX: doc.scrollWidth - doc.clientWidth, overflowY: doc.scrollHeight - doc.clientHeight,
      scene: home?.dataset.scene, world: loft?.dataset.world, shelfCount: Number(loft?.dataset.shelves),
      shelves,
      /** The rack may scroll inside itself on a short frame; the house never does. */
      rackScroll: rack ? rack.scrollHeight - rack.clientHeight : 0,
      cats: loft.querySelectorAll('.queen-bank-flat').length,
      boards: Boolean(document.querySelector('.queen-room-world.is-live canvas')),
      hang: (() => { const el = loft.querySelector('.queen-rack__hang'); return el ? { text: el.textContent, disabled: el.disabled } : null; })(),
      jug: loft.querySelector('.queen-jug__safe, .queen-jug__holder')?.textContent ?? null,
      tilt: tilt ? { disabled: tilt.disabled, value: tilt.value, words: tilt.getAttribute('aria-valuetext') } : null,
      sub: loft.querySelector('.queen-room__sub')?.textContent, line: loft.querySelector('.queen-room__line')?.textContent,
      notice: loft.querySelector('.queen-cellar-notice')?.textContent ?? null,
      pour: (() => { const el = loft.querySelector('.queen-pour'); return el ? { text: el.textContent, disabled: el.disabled } : null; })(),
      /** The ledge keeps its rule: no figure on a shelf. The jug and the line are the Fund's, and may say one. */
      ledgeMoney: [...loft.querySelectorAll('.queen-ledge, .queen-shelf__weight, .queen-shelf__pin, .queen-room__sub')].some(el => /\$\s?\d|\d[\d,]*\.\d\d/.test(el.textContent ?? '')),
      allInRoom: parts.flatMap(s => [...loft.querySelectorAll(s)]).every(inRoom),
      parts: parts.flatMap(s => [...loft.querySelectorAll(s)]).map(el => ({ c: el.className.split(' ').pop(), ...rect(el) })).concat([{ c: 'room', ...rect(loft) }]),
      sheet: document.querySelector('[role=dialog].sheet')?.textContent ?? null,
      canvases: document.querySelectorAll('canvas').length,
      focus: (() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el); return { className: el.className.split(' ')[0], outline: s.outlineStyle, width: parseFloat(s.outlineWidth) }; })(),
    };
  });
}
async function clickHer(page) { const her = page.locator('.queen-figure'); const b = await her.boundingBox(); await her.click({ position: { x: b.width / 2, y: b.height * 0.3 } }); }
async function intoLoft(page, width) {
  await page.waitForSelector('.queen-home');
  await clickHer(page);
  await page.waitForSelector('.queen-home.is-expanded');
  await page.waitForTimeout(700);
  await page.locator('.queen-bank--build .queen-bank__button').click();
  await page.waitForSelector('.queen-home[data-open="build"]');
  await page.waitForTimeout(500);
  await page.locator(width >= 720 ? '.queen-bank--build .queen-bank__button' : '.queen-panel .queen-go--primary[data-door="build"]').click();
  await page.waitForSelector('.queen-home[data-scene="loft"]');
  await page.waitForTimeout(1000);
}
const stamp = async (page, name) => page.screenshot({ path: join(output, `${name}.png`) });
/** A drag the way a finger makes it: down on the bank, a little, then to the point, then up. */
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 4, from.y + 4, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}
const centre = async (locator) => { const b = await locator.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const setTilt = (page, tenths) => page.locator('.queen-room--loft .queen-jug__tilt').fill(String(tenths));

const browser = await chromium.launch({ headless: true, ...exe, args: GL });
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));

  // ---- 1. Every width: the one shelf a household that never hung another has; then a second shelf hung, a bank put down onto it, the weight and the pin worked. 3D where it can be. ----
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ world: 'auto' }));
    await intoLoft(page, width);
    const label = `one ${width}x${height}`;
    const m = await measure(page);
    noScroll(m, label);
    assert.equal(m.shelfCount, 1, `${label}: one shelf`);
    assert.equal(m.shelves[0].weight, '5 of 5', `${label}: the one shelf carries the whole weight`);
    assert.equal(m.shelves[0].pin, 'to the crown', `${label}: the pin stands at the crown`);
    // The nest's own order of two fresh goals is not fixed; the shelf is, once a hand has touched it.
    assert.deepEqual([...m.shelves[0].banks].sort(), ['Fictional date night', 'Fictional porch renovation', 'Fictional trip to the shore', 'Fictional wedding weekend'], `${label}: four things on the shelf`);
    assert.equal(m.shelves[0].dividers.length, 3, `${label}: a divider between each pair`);
    assert.equal(m.shelves[0].down, false, `${label}: the last shelf cannot be taken down`);
    assert.equal(m.hang?.text, 'Hang a shelf below', `${label}: the peg`);
    assert.equal(m.jug, '$2800.00 safe to pour', `${label}: the jug says what is safe`);
    assert.equal(m.ledgeMoney, false, `${label}: no figure on the ledge`);
    assert.ok(m.sub.startsWith('4 things on the shelf'), `${label}: ${m.sub}`);
    // 320x568 with the chrome stand-ins leaves the room about 240px tall — the same compromised frame the rooms' own evidence shows. The stair, head and rack must still be inside it; the rest may give there.
    const tiny = width === 320 && height === 568;
    const inside = (r) => tiny ? r.parts.filter(p => ['queen-stair--down', 'queen-room__head', 'queen-rack'].includes(p.c)).every(p => p.y >= r.parts.at(-1).y - 1 && p.y + p.h <= r.parts.at(-1).y + r.parts.at(-1).h + 1) : r.allInRoom;
    assert.ok(inside(m), `${label}: stair, head, rack, jug, line and acts inside the room ${JSON.stringify(m.parts)}`);
    if (width >= 390) assert.equal(m.rackScroll, 0, `${label}: one shelf fits without the rack scrolling (${m.rackScroll}px)`);
    await stamp(page, `one-${width}x${height}`);
    records.push({ scene: 'one', width, height, world: m.world, overflowY: m.overflowY, rackScroll: m.rackScroll, shelves: m.shelves.map(s => ({ weight: s.weight, pin: s.pin, banks: s.banks })), jug: m.jug, sub: m.sub, parts: m.parts });

    // 320x568 under the stand-ins leaves the rack a strip a few pixels tall that scrolls inside itself (the actual App page there stands the loft under a books banner — see queen-house evidence); the hand-work is proved from 320x700 up.
    if (tiny) { await page.locator('.queen-room--loft .queen-stair--down').click(); await page.waitForSelector('.queen-home[data-scene="home"]'); continue; }
    // Hang a shelf; drag the wedding down onto it with the mouse (a finger's gesture); slide the new shelf's weight up two, drop the top pin two.
    await page.locator('.queen-room--loft .queen-rack__hang').click();
    await page.waitForTimeout(600);
    const hung = await measure(page);
    assert.equal(hung.shelfCount, 2, `${label}: a second shelf hangs below`);
    assert.deepEqual([hung.shelves[0].weight, hung.shelves[1].weight], ['5 of 9', '4 of 9'], `${label}: the new shelf hangs one lighter (${hung.shelves.map(s => s.weight).join(', ')})`);
    assert.equal(hung.shelves[1].down, true, `${label}: the empty shelf can be taken down`);
    const wedding = page.locator('.queen-room--loft [data-ledge-bank][aria-label^="Fictional wedding weekend"]');
    const lowLedge = page.locator('.queen-room--loft [data-room-shelf]').nth(1).locator('.queen-ledge');
    await drag(page, await centre(wedding), await centre(lowLedge));
    let two = await measure(page);
    if (two.shelves[1].banks.length === 0) {
      // The frame is too short for a hand to land on the lower ledge without the rack scrolling under it; the keyboard is the same move.
      await wedding.focus(); await page.keyboard.press('Shift+ArrowDown'); await page.waitForTimeout(500);
      two = await measure(page);
      two.movedBy = 'keyboard';
    } else two.movedBy = 'drag';
    if (process.env.HEARTH_PROOF_LOG) console.log(label, JSON.stringify({ hung: hung.shelves, two: two.shelves, sub: two.sub, line: two.line }));
    assert.deepEqual(two.shelves[1].banks, ['Fictional wedding weekend'], `${label}: the wedding is on the lower shelf (${two.movedBy}) — ${JSON.stringify(two.shelves.map(s => s.banks))}`);
    assert.deepEqual(two.shelves[0].banks, m.shelves[0].banks.filter(name => !/wedding/.test(name)), `${label}: the top shelf closed the gap`);
    // The lower shelf's weight, slid along by hand: 18px a notch, two notches to the right.
    const weight = page.locator('.queen-room--loft [data-room-shelf]').nth(1).locator('.queen-shelf__weight');
    const wc = await centre(weight);
    await drag(page, wc, { x: wc.x + 36, y: wc.y });
    let slidBy = 'drag';
    if ((await measure(page)).shelves[1].weight === '4 of 9') { await weight.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); slidBy = 'keyboard'; }
    await page.locator('.queen-room--loft [data-room-shelf]').nth(0).locator('.queen-shelf__pin').focus();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    await page.locator('.queen-room--loft [data-room-shelf]').nth(0).locator('.queen-divider').first().focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    const worked = await measure(page);
    noScroll(worked, `${label} worked`);
    assert.deepEqual([worked.shelves[0].weight, worked.shelves[1].weight], ['5 of 11', '6 of 11'], `${label}: the lower shelf now outweighs the top, slid by ${slidBy} (${worked.shelves.map(s => s.weight).join(', ')})`);
    assert.equal(worked.shelves[0].pin, '18 of 20', `${label}: the top pin dropped two notches`);
    assert.equal(worked.shelves[0].dividers[0], `${two.shelves[0].banks[0]} 2, ${two.shelves[0].banks[1]} 1`, `${label}: the divider gives the first bank two parts (${worked.shelves[0].dividers[0]})`);
    assert.equal(worked.ledgeMoney, false, `${label}: still no figure on the ledge`);
    assert.ok(inside(worked), `${label} worked: everything inside the room ${JSON.stringify(worked.parts)}`);
    if (height >= 800) assert.equal(worked.rackScroll, 0, `${label}: two shelves fit without the rack scrolling (${worked.rackScroll}px)`);
    await stamp(page, `two-${width}x${height}`);
    records.push({ scene: 'two', width, height, world: worked.world, overflowY: worked.overflowY, rackScroll: worked.rackScroll, movedBy: two.movedBy, slidBy, shelves: worked.shelves.map(s => ({ weight: s.weight, pin: s.pin, banks: s.banks, dividers: s.dividers, ledge: s.ledge })), sub: worked.sub });
    await page.locator('.queen-room--loft .queen-stair--down').click();
    await page.waitForSelector('.queen-home[data-scene="home"]');
  }

  // ---- 2. The pour, at 320, 390 and 1100: tilt the jug, read the split, open Confirm, close it; then pour for real once and read the notice. ----
  for (const [width, height] of [[320, 700], [390, 844], [1100, 800]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ world: 'auto' }));
    await intoLoft(page, width);
    const label = `pour ${width}x${height}`;
    // Two shelves, 5:1 by weight, the wedding alone below.
    await page.locator('.queen-room--loft .queen-rack__hang').click(); await page.waitForTimeout(400);
    const wedding = page.locator('.queen-room--loft [data-ledge-bank][aria-label^="Fictional wedding weekend"]');
    await wedding.focus(); await page.keyboard.press('Shift+ArrowDown'); await page.waitForTimeout(400);
    const low = page.locator('.queen-room--loft [data-room-shelf]').nth(1).locator('.queen-shelf__weight');
    await low.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(300);
    const rest = await measure(page);
    assert.equal(rest.pour, null, `${label}: no Pour act until the jug tilts`);
    assert.equal(rest.tilt?.disabled, false, `${label}: the custodian can tilt`);
    await setTilt(page, 5);
    await page.waitForTimeout(400);
    const tilted = await measure(page);
    noScroll(tilted, `${label} tilted`);
    assert.equal(tilted.tilt.words, '50% of the safe surplus, $1400.00', `${label}: the tilt in words (${tilted.tilt.words})`);
    // 5:1 → $1166.67 to the top shelf split 1:1 over the two open goals (the lidded date night takes nothing), the odd cent landing whole; $233.33 to the wedding.
    const top = tilted.shelves[0].banks.filter(name => !/date night/.test(name));
    assert.equal(tilted.line, `The jug tilts. $1166.67 to the top shelf (${top[0]} $583.34, ${top[1]} $583.33); $233.33 to the bottom shelf (Fictional wedding weekend $233.33).`, `${label}: ${tilted.line}`);
    assert.equal(tilted.pour?.text, 'Move $' + (tilted.pour?.text?.match(/\$([0-9.,]+)/)?.[1] ?? '') + ' to Kitty Banks', `${label}: the act`);
    assert.equal(tilted.ledgeMoney, false, `${label}: the figures are the jug's and the line's, never the ledge's`);
    assert.ok(tilted.allInRoom, `${label} tilted: everything inside the room ${JSON.stringify(tilted.parts)}`);
    await stamp(page, `tilt-${width}x${height}`);
    await page.locator('.queen-room--loft .queen-pour').click();
    await page.waitForSelector('[role=dialog].sheet');
    const sheet = await measure(page);
    assert.match(sheet.sheet, /Pour \$1400\.00 of the Fund's surplus over the rack/, `${label}: Confirm names the pour (${sheet.sheet})`);
    assert.match(sheet.sheet, /\$1166\.67 to the top shelf/, `${label}: Confirm carries the split`);
    await stamp(page, `confirm-${width}x${height}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const closed = await measure(page);
    assert.equal(closed.sheet, null, `${label}: Escape closes Confirm`);
    assert.equal(closed.jug, '$2800.00 safe to pour', `${label}: nothing was poured`);
    records.push({ scene: 'pour-confirm', width, height, tilt: tilted.tilt, line: tilted.line, sheet: sheet.sheet, poured: false });
    if (width === 1100) {
      // Once, for real, on the fictional books: the surplus falls by what was poured, the goals fill, the notice says so.
      await page.locator('.queen-room--loft .queen-pour').click();
      await page.waitForSelector('[role=dialog].sheet');
      await page.locator('[role=dialog].sheet button', { hasText: /^Move \$[0-9.,]+ to Kitty Banks$/ }).click();
      await page.waitForTimeout(900);
      const poured = await measure(page);
      noScroll(poured, `${label} poured`);
      assert.equal(poured.sheet, null, `${label}: Confirm closed after the pour`);
      assert.equal(poured.jug, '$1400.00 safe to pour', `${label}: the jug is lighter by the pour (${poured.jug})`);
      assert.match(poured.notice ?? "", /^\$1400\.00 poured\. The banks fire as they fill\./, `${label}: the notice (${poured.notice})`);
      assert.equal(poured.tilt.value, '0', `${label}: the jug stands upright again`);
      await stamp(page, `poured-${width}x${height}`);
      records.push({ scene: 'poured', width, height, jug: poured.jug, notice: poured.notice, shelves: poured.shelves.map(s => ({ banks: s.banks, ledge: s.ledge })) });
    }
    await page.locator('.queen-room--loft .queen-stair--down').click();
    await page.waitForSelector('.queen-home[data-scene="home"]');
  }

  // ---- 3. Keyboard and the ring, flat, at 390: the first bank takes focus; Shift+ArrowRight moves it along; the weight and the pin answer arrows; the ring is visible. ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url({ world: 'flat' }));
  await intoLoft(page, 390);
  const k0 = await measure(page);
  await page.locator('.queen-room--loft [data-ledge-bank]').first().focus();
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(400);
  const k = await measure(page);
  noScroll(k, 'keyboard');
  assert.deepEqual(k.shelves[0].banks.slice(0, 2), [k0.shelves[0].banks[1], k0.shelves[0].banks[0]], `keyboard: Shift+ArrowRight moved the first bank along (${k.shelves[0].banks.join(', ')})`);
  assert.ok(k.focus && k.focus.outline !== 'none' && k.focus.width >= 2, `keyboard: ring on the focused bank (${JSON.stringify(k.focus)})`);
  await page.locator('.queen-room--loft .queen-shelf__weight').first().focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(300);
  const w = await measure(page);
  assert.equal(w.shelves[0].weight, '10 of 10', `keyboard: End takes the weight to the end of the shelf (${w.shelves[0].weight})`);
  assert.ok(w.focus && w.focus.className === 'queen-shelf__weight' && w.focus.outline !== 'none', `keyboard: ring on the weight (${JSON.stringify(w.focus)})`);
  await stamp(page, 'keyboard-focus-390x844');
  records.push({ scene: 'keyboard', width: 390, height: 844, banks: k.shelves[0].banks, weight: w.shelves[0].weight, focus: w.focus });
  const axe = await new AxeBuilder({ page }).include('.queen-room--loft').analyze();
  const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.length}`);
  records.push({ scene: 'axe', width: 390, height: 844, axeSerious: serious, all: axe.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.length}`) });

  // ---- 4. Reduced motion, 3D: the room renders with two shelves; nothing animates. ----
  await page.goto(url({ world: '3d', reduced: '1' }));
  await intoLoft(page, 390);
  await page.locator('.queen-room--loft .queen-rack__hang').click(); await page.waitForTimeout(500);
  const r = await measure(page);
  noScroll(r, 'reduced');
  const transitions = await page.evaluate(() => [...document.querySelectorAll('.queen-room--loft .queen-shelf, .queen-room--loft .queen-shelf__weight, .queen-room--loft .queen-jug__tilt')].map(el => getComputedStyle(el).transitionDuration));
  assert.ok(transitions.every(t => t === '0s'), `reduced motion: no transitions (${transitions.join(', ')})`);
  await stamp(page, 'reduced-3d-390x844');
  records.push({ scene: 'reduced', width: 390, height: 844, world: r.world, shelves: r.shelfCount, transitions });
  await context.close();

  // ---- 5. No WebGL at all: the drawn kitty banks stand on drawn shelves; everything still works. ----
  const noGl = await chromium.launch({ headless: true, ...exe, args: ['--disable-3d-apis', '--disable-gpu'] });
  try {
    const flat = await (await noGl.newContext({ reducedMotion: 'reduce' })).newPage();
    flat.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[390, 844], [1100, 800]]) {
      await flat.setViewportSize({ width, height });
      await flat.goto(url({ world: 'auto' }));
      await intoLoft(flat, width);
      await flat.locator('.queen-room--loft .queen-rack__hang').click(); await flat.waitForTimeout(400);
      const wedding = flat.locator('.queen-room--loft [data-ledge-bank][aria-label^="Fictional wedding weekend"]');
      await wedding.focus(); await flat.keyboard.press('Shift+ArrowDown'); await flat.waitForTimeout(600);
      const m = await measure(flat);
      const label = `no-webgl ${width}x${height}`;
      noScroll(m, label);
      assert.equal(m.world, 'flat', `${label}: the room degraded to flat`);
      assert.equal(m.cats, 4, `${label}: four drawn kitty banks stand in for the sculptures (${m.cats})`);
      assert.deepEqual(m.shelves.map(s => s.banks.length), [3, 1], `${label}: the same two shelves`);
      await stamp(flat, `no-webgl-${width}x${height}`);
      records.push({ scene: 'no-webgl', width, height, world: m.world, canvases: m.canvases, shelves: m.shelves.map(s => s.banks) });
    }
  } finally { await noGl.close(); }
} finally {
  await browser.close();
  await proof.close();
}

writeFileSync(join(output, 'records.json'), JSON.stringify({ records, errors }, null, 2));
const seriousTotal = records.reduce((sum, row) => sum + (row.axeSerious?.length ?? 0), 0);
console.log(`queen-loft-layout: ${records.length} records, ${seriousTotal} serious/critical axe rule hits, ${errors.length} page errors → ${output}`);
assert.equal(errors.length, 0, errors.join('\n'));
assert.equal(seriousTotal, 0, 'serious/critical axe hits');
