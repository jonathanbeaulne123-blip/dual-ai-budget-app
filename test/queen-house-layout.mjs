/** The house on the ACTUAL App page: the kitty banks standing where the ceramic pots stood, and the one
    axis that reaches them — a swipe, a grab-and-haul, the arrow keys and the rail. Every floor at 320×568,
    390×844, 720×900 and 1100×800, on the 3D path, with WebGL refused, and under reduced motion.
    Asserts what the rooms promise: no page scroll, no figure on the ribbon or the ledge, a cat (never a pot)
    on both paths, and every floor reachable by keyboard alone. Fictional local Development books only. */
import { startQueenWorldPageProof } from '../scripts/serve-queen-world-page-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/queen-house');
mkdirSync(output, { recursive: true });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const WIDTHS = (process.env.HEARTH_PROOF_WIDTHS || '320x568,390x844,720x900,1100x800').split(',').map((pair) => pair.split('x').map(Number));
const MONEY = /\$\s?\d|\d[\d,]*\.\d\d/;
const records = [];
const proof = await startQueenWorldPageProof();

const measure = (page, floor) => page.evaluate((floor) => {
  const doc = document.documentElement;
  const home = document.querySelector('.queen-home');
  const room = document.querySelector(floor === 'cellar' ? '.queen-room--cellar' : floor === 'loft' ? '.queen-room--loft' : '.queen-field');
  const text = (selector) => [...document.querySelectorAll(selector)].map((el) => el.textContent ?? '').join(' ');
  const rail = [...document.querySelectorAll('.queen-house-rail__stop')];
  // Only this room's own banks: both rooms are in the DOM at once, and the one you are not in is inert.
  const seats = room ? [...room.querySelectorAll('[data-room-vessel]')] : [];
  return {
    scene: home?.dataset.scene ?? null,
    world: room?.dataset.world ?? home?.dataset.world ?? null,
    overflowX: doc.scrollWidth - doc.clientWidth,
    overflowY: doc.scrollHeight - doc.clientHeight,
    rail: rail.map((stop) => ({ floor: stop.dataset.floor, here: stop.getAttribute('aria-current') === 'true', label: stop.getAttribute('aria-label') })),
    seats: seats.length,
    /** The drawn twin is the studio's cat, never the old pot path. */
    cats: room ? room.querySelectorAll('.queen-bank-flat').length : 0,
    pots: document.querySelectorAll('.queen-room .queen-vessel, .queen-room .queen-goal__glaze, .queen-room .queen-jar__mouth').length,
    liveCanvas: Boolean(document.querySelector('.queen-room-world.is-live canvas')),
    /** Everything the room says out loud, minus the one panel a bank in hand is allowed. */
    ribbonWords: text('.queen-ribbon, .queen-months, .queen-ledge, .queen-room__line, .queen-room__sub'),
  };
}, floor);

const shot = async (page, name) => page.screenshot({ path: join(output, `${name}.png`), fullPage: false });

async function travel(page, floor) {
  await page.click(`.queen-house-rail__stop[data-floor='${floor}']`);
  await page.waitForTimeout(650);
}

/** A spot the hand can actually land on: inside the house, under no app chrome, and owned by nothing nearer. */
const grabPoint = (page, within) => page.evaluate((within) => {
  const host = document.querySelector(within);
  const home = document.querySelector('.queen-home');
  if (!host || !home) return null;
  const box = host.getBoundingClientRect();
  for (const fy of [0.35, 0.5, 0.25, 0.65, 0.15]) {
    for (const fx of [0.5, 0.3, 0.7, 0.85, 0.2]) {
      const x = box.x + box.width * fx, y = box.y + box.height * fy;
      // Every element under the point, not just the top one: hit testing at a
      // fraction of a pixel does not always agree with a single probe.
      const stack = document.elementsFromPoint(x, y);
      const el = stack[0];
      if (!el || !home.contains(el)) continue;
      if (stack.some((node) => node.closest?.('[data-house-hold], input, .queen-house-rail'))) continue;
      return { x, y };
    }
  }
  return null;
}, within);

/** The grab a finger makes, made with a mouse: down, a little, a lot, up. */
async function hauled(page, point, dy) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y + dy * 0.3, { steps: 4 });
  await page.mouse.move(point.x, point.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  return page.evaluate(() => document.querySelector('.queen-home').dataset.scene);
}

for (const [w, h] of WIDTHS) {
  for (const mode of ['3d', 'flat', 'reduced']) {
    const browser = await chromium.launch({ args: GL, ...exe });
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    if (process.env.HEARTH_PROOF_LOG) console.log(`-> ${w}x${h} ${mode}`);
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    if (mode === 'flat') await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    // Web fonts are not part of what is being proved, and a blocked font host keeps the network busy forever.
    await page.route('**://fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**://fonts.gstatic.com/**', (route) => route.abort());
    await page.goto(`${proof.url}?rooms=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.queen-house-rail__stop', { state: 'attached', timeout: 240000 });
    await page.waitForTimeout(1200);

    for (const floor of ['home', 'cellar', 'loft']) {
      if (floor !== 'home') await travel(page, floor);
      const row = { width: w, height: h, mode, floor, ...(await measure(page, floor)), errors: errors.length };
      row.money = MONEY.test(row.ribbonWords);
      delete row.ribbonWords;
      records.push(row);
      if (mode === '3d') await shot(page, `${floor}-${w}x${h}`);
      else if (w === 1100 || (w === 390 && mode === 'flat')) await shot(page, `${floor}-${w}x${h}-${mode}`);

      assert.equal(row.scene, floor, `${floor} ${w}×${h} ${mode}: the house is standing on the floor the rail names`);
      assert.equal(row.overflowX, 0, `${floor} ${w}×${h} ${mode}: no sideways scroll`);
      assert.equal(row.overflowY, 0, `${floor} ${w}×${h} ${mode}: the house does not scroll`);
      assert.equal(row.money, false, `${floor} ${w}×${h} ${mode}: no figure on the ribbon or the ledge`);
      assert.equal(row.rail.length, 3, `${floor} ${w}×${h} ${mode}: three floors on the rail`);
      assert.equal(row.rail.filter((stop) => stop.here).length, 1, `${floor} ${w}×${h} ${mode}: exactly one floor is marked as here`);
      assert.equal(row.pots, 0, `${floor} ${w}×${h} ${mode}: no ceramic pot is left in a room`);
      if (floor !== 'home') assert.ok(row.seats > 0, `${floor} ${w}×${h} ${mode}: the room has banks in it`);
      if (floor !== 'home' && mode !== '3d') assert.ok(row.cats > 0, `${floor} ${w}×${h} ${mode}: the drawn path keeps the cat`);
    }

    // Back to her, then up and down the house on the keyboard alone.
    await travel(page, 'home');
    await page.locator('.queen-house-rail__stop[data-floor="home"]').focus();
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.querySelector('.queen-home').dataset.scene), 'loft', `${w}×${h} ${mode}: ArrowUp climbs to the loft`);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => document.querySelector('.queen-home').dataset.scene), 'cellar', `${w}×${h} ${mode}: ArrowDown descends past the hearth into the cellar`);

    // And a grab-and-haul with the mouse, which is the same gesture a finger makes.
    await travel(page, 'home');
    const fromHome = await grabPoint(page, '.queen-field');
    assert.ok(fromHome, `${w}×${h} ${mode}: the field has somewhere to put a hand`);
    assert.equal(await hauled(page, fromHome, -140), 'loft', `${w}×${h} ${mode}: hauling the house up reaches the loft`);
    // And down again from inside the loft, where nothing else owns the gesture.
    const fromLoft = await grabPoint(page, '.queen-room--loft');
    assert.ok(fromLoft, `${w}×${h} ${mode}: the loft has somewhere to put a hand`);
    assert.equal(await hauled(page, fromLoft, 150), 'home', `${w}×${h} ${mode}: hauling the house down comes back to her`);

    if (mode === '3d' && w === 1100) {
      for (const floor of ['loft', 'cellar']) {
        await travel(page, floor);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        records.push({ width: w, height: h, mode, floor, axe: axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })) });
        assert.equal(axe.violations.length, 0, `${floor} ${w}×${h}: axe finds nothing — ${axe.violations.map((v) => v.id).join(', ')}`);
      }
    }
    assert.equal(errors.length, 0, `${w}×${h} ${mode}: no page errors — ${errors.join(' | ')}`);
    await browser.close();
  }
}

writeFileSync(join(output, 'records.json'), `${JSON.stringify(records, null, 2)}\n`);
await proof.close();
console.log(`queen-house: ${records.length} records → ${output}`);
