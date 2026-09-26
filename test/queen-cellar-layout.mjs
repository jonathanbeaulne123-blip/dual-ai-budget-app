/** The cellar's bill rail, browser evidence: driven into the cellar by the app's own two-tap gesture on the
    `composition=queen` proof page with `bills=1` — a paid subscription (shard), a full house bill, the rent filling,
    a planned expense and the fixture's date night — at 320/390/720/1100, on a day before anything is due (the water sits), on the day the
    hammer is out and the rent is cracked, with a jar lifted out (rehearsal), with the Confirm sheet open, in 3D and
    flat, without WebGL, under reduced motion, with the keyboard. No page scroll anywhere. Fictional books only. */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/queen-cellar');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const records = [], errors = [];
const WIDTHS = [[320, 568], [320, 700], [390, 844], [720, 900], [1100, 800]];
const url = (params) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome: '1', state: 'building', bills: '1', ...params })}`;
const noScroll = (m, label) => { assert.ok(m.overflowX <= 1, `${label}: horizontal overflow ${m.overflowX}px`); assert.ok(m.overflowY <= 0, `${label}: the page scrolls by ${m.overflowY}px`); };

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement, home = document.querySelector('.queen-home'), cellar = document.querySelector('.queen-room--cellar');
    const rect = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const jars = [...cellar.querySelectorAll('.queen-jar--bill')].map(el => ({ label: el.getAttribute('aria-label'), strike: [...el.classList].find(c => /^queen-jar--(hammer|crack|shard|none)$/.test(c))?.slice(11), held: el.classList.contains('is-held'), inGate: el.classList.contains('is-in-gate'), form: el.querySelector('.queen-bank-flat')?.dataset.form, hue: el.querySelector('.queen-billjar')?.dataset.hue, finish: el.querySelector('.queen-billjar')?.dataset.finish, size: [...(el.querySelector('.queen-billjar')?.classList ?? [])].find(c => /--size-/.test(c))?.slice(-1), ...rect(el) }));
    const inRoom = el => { const r = el.getBoundingClientRect(), c = cellar.getBoundingClientRect(); return r.width === 0 || (r.top >= c.top - 1 && r.bottom <= c.bottom + 1); };
    return {
      overflowX: doc.scrollWidth - doc.clientWidth, overflowY: doc.scrollHeight - doc.clientHeight,
      scene: home?.dataset.scene, world: cellar?.dataset.world, rail: Boolean(cellar.querySelector('.queen-cellar-rail')),
      days: cellar.querySelectorAll('.queen-cellar-day').length, jars,
      water: cellar.querySelector('.queen-water')?.style.height ?? null, tidemark: cellar.querySelector('.queen-tidemark')?.style.bottom ?? null,
      sub: cellar.querySelector('.queen-room__sub')?.textContent, line: cellar.querySelector('.queen-room__line')?.textContent,
      acts: [...cellar.querySelectorAll('.queen-room__acts .queen-go')].map(el => ({ text: el.textContent, disabled: el.disabled, hammer: el.classList.contains('queen-hammer'), crack: el.classList.contains('queen-hammer--crack') })),
      railMoney: /\$\d/.test(cellar.querySelector('.queen-cellar-rail')?.textContent ?? ''),
      allInRoom: [...cellar.querySelectorAll('.queen-room__head, .queen-cellar-views, .queen-cellar-rail, .queen-scrub, .queen-room__line, .queen-room__acts, .queen-stair')].every(inRoom),
      parts: [...cellar.querySelectorAll('.queen-stair, .queen-room__head, .queen-cellar-views, .queen-cellar-rail, .queen-scrub, .queen-room__line, .queen-room__acts')].map(el => ({ c: el.className.split(' ').pop(), ...rect(el) })).concat([{ c: 'room', ...rect(cellar) }]),
      partsInRoom: [...cellar.querySelectorAll('.queen-stair, .queen-room__head, .queen-cellar-views, .queen-cellar-rail, .queen-scrub, .queen-room__line, .queen-room__acts')].map(inRoom),
      stairVisible: rect(cellar.querySelector('.queen-stair')).w > 0,
      sheet: document.querySelector('[role=dialog].sheet')?.textContent ?? null,
      card: (() => { const card = cellar.querySelector('.queen-jar-card'); if (!card) return null; const r = card.getBoundingClientRect(), c = cellar.getBoundingClientRect(); return { title: card.querySelector('.queen-jar-card__title')?.textContent, kicker: card.querySelector('.queen-jar-card__kicker')?.textContent, facts: Object.fromEntries([...card.querySelectorAll('.queen-jar-card__facts > div')].map(row => [row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent])), inRoom: r.top >= c.top - 1 && r.bottom <= c.bottom + 1, scrolls: card.scrollHeight > card.clientHeight + 1 }; })(),
      canvases: document.querySelectorAll('canvas').length,
      focus: (() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el); return { className: el.className.split(' ')[0], outline: s.outlineStyle, width: parseFloat(s.outlineWidth) }; })(),
    };
  });
}
async function clickHer(page) { const her = page.locator('.queen-figure'); const b = await her.boundingBox(); await her.click({ position: { x: b.width / 2, y: b.height * 0.3 } }); }
async function intoCellar(page, width) {
  await page.waitForSelector('.queen-home');
  await clickHer(page);
  await page.waitForSelector('.queen-home.is-expanded');
  await page.waitForTimeout(700);
  await page.locator('.queen-bank--protect .queen-bank__button').click();
  await page.waitForSelector('.queen-home[data-open="protect"]');
  await page.waitForTimeout(500);
  await page.locator(width >= 720 ? '.queen-bank--protect .queen-bank__button' : '.queen-panel .queen-go--primary[data-door="protect"]').click();
  await page.waitForSelector('.queen-home[data-scene="cellar"]');
  await page.waitForTimeout(800);
}
/** Put a jar in the gate the way a hand or a thumb would: click it when it is on screen, else walk the rail with the arrow keys until the line names it. */
async function pickJar(page, label) {
  const jar = page.locator(`.queen-jar--bill[aria-label^="${label}"]`);
  const box = await jar.boundingBox();
  const rail = await page.locator('.queen-cellar-rail').boundingBox();
  if (box && rail && box.x >= rail.x && box.x + box.width <= rail.x + rail.width) { await jar.click(); return; }
  await page.evaluate(() => document.querySelector('.queen-cellar-rail').focus());
  await page.keyboard.press('Home');
  for (let i = 0; i < 31; i += 1) {
    if (await page.locator(`.queen-jar--bill.is-in-gate[aria-label^="${label}"]`).count()) { await page.waitForTimeout(350); return; }
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(40);
  }
}
const stamp = async (page, name) => page.screenshot({ path: join(output, `${name}.png`) });

const browser = await chromium.launch({ headless: true, ...exe, args: GL });
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));

  // ---- 1. Every width, the day before anything is due: the water sits; no hammer anywhere. 3D where it can be. ----
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ today: '2026-09-12', world: 'auto' }));
    await intoCellar(page, width);
    const label = `early ${width}x${height}`;
    const m = await measure(page);
    noScroll(m, label);
    assert.ok(m.rail && m.days === 30, `${label}: the rail is the month (${m.days} days)`);
    assert.equal(m.jars.length, 11, `${label}: eleven jars on the rail — every purpose, six groups`);
    // The gym subscription fell due on the 10th and is full, so its hammer is out already; everything after today just holds its water.
    assert.deepEqual(m.jars.map(j => j.strike), ['shard', 'hammer', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none'], `${label}: only the overdue full one can be struck (${m.jars.map(j => j.strike).join(', ')})`);
    assert.deepEqual(m.jars.map(j => j.label.replace(/^[^—]+— /, '').replace(/, (the month's largest|large|middling|small|the smallest),.*$/, '')), ['subscription (Life › Fun)', 'subscription (Health › Care)', 'planned, not posted (Food › Groceries)', 'house bill (Housing › Electric)', 'recurring payment (Transport › Transit)', 'planned, not posted (Transport › Fuel)', 'house bill (Housing › Electric)', 'house bill (Life › Phone)', 'planned, not posted (Life › Fun)', 'house bill (Life › Fun)', 'recurring payment (Debt › Card payment)'], `${label}: every jar names its purpose and its filing`);
    assert.ok(m.jars.some(j => /the month's largest/.test(j.label)) && m.jars.some(j => /the smallest/.test(j.label)), `${label}: the size bands are said`);
    assert.equal(m.jars.filter(j => j.strike === 'shard').length, 1, `${label}: the paid subscription is a shard`);
    assert.equal(m.railMoney, false, `${label}: no figure on the rail`);
    await stamp(page, `early-${width}x${height}`);
    // 320x568 with the chrome stand-ins leaves the room about 240px tall — the same compromised frame the rooms' own evidence shows. The stair, head, pills and rail must still be inside it; the acts may give there.
    assert.ok(m.stairVisible && (width === 320 && height === 568 ? m.partsInRoom.slice(0, 4).every(Boolean) : m.allInRoom), `${label}: head, rail, scrub, line, acts and stair all inside the room ${JSON.stringify(m.parts)}`);
    assert.ok(m.sub.startsWith('11 kitty jars on the rail'), `${label}: ${m.sub}`);
    await stamp(page, `early-${width}x${height}`);
    records.push({ scene: 'early', width, height, world: m.world, overflowY: m.overflowY, jars: m.jars.map(j => `${j.label} [${j.strike}; ${j.form} ${j.hue}/${j.finish} size ${j.size}]`), water: m.water, tidemark: m.tidemark, line: m.line, acts: m.acts.map(a => a.text) });
    // The jar in the gate: pick the full early one; the words say ready, and there is no hammer.
    await pickJar(page, 'Fictional hydro');
    await page.waitForTimeout(400);
    const g = await measure(page);
    noScroll(g, `${label} gate`);
    assert.match(g.line, /^Filling\. Fictional hydro · house bill · Housing › Electric · in 3 days · \$140\.00 saved, ready/, `${label} gate: ${g.line}`);
    assert.ok(!g.acts.some(a => a.hammer), `${label} gate: no hammer early`);
    await stamp(page, `early-gate-${width}x${height}`);
    await page.locator('.queen-stair--up').click();
    await page.waitForSelector('.queen-home[data-scene="home"]');
  }

  // ---- 2. The day: hammer on the full one, crack on the rent, the Confirm sheet, the rehearsal — at 390 and 1100. ----
  for (const [width, height] of [[320, 568], [390, 844], [1100, 800]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url({ today: '2026-09-20', world: 'auto' }));
    await intoCellar(page, width);
    const label = `due ${width}x${height}`;
    const m = await measure(page);
    noScroll(m, label);
    assert.deepEqual(m.jars.map(j => j.strike), ['shard', 'hammer', 'none', 'hammer', 'hammer', 'none', 'crack', 'none', 'none', 'none', 'none'], `${label}: shard, hammers, crack, early (${m.jars.map(j => j.strike).join(', ')})`);
    // The gate opens on today, where the rent stands cracked.
    assert.match(m.line, /^Cracked\. Fictional rent · house bill · Housing › Electric · due today/, `${label}: ${m.line}`);
    assert.ok(m.acts.some(a => a.crack && a.text === 'Mark paid anyway · from the water'), `${label}: the crack pays from the water (${m.acts.map(a => a.text).join(' | ')})`);
    await stamp(page, `due-crack-${width}x${height}`);
    records.push({ scene: 'due-crack', width, height, world: m.world, overflowY: m.overflowY, line: m.line, acts: m.acts.map(a => a.text) });
    // The kitty jar's card: press the rent in the gate and it opens in the room with everything it has to say; × closes it and the jar takes focus back.
    // Pressed as a hand or a keyboard would: in the 320×568 stand-in frame the panes overlap the jar's foot, so the press is Enter on the focused jar.
    await page.locator('.queen-jar--bill.is-in-gate[aria-label^="Fictional rent"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const opened = await measure(page);
    noScroll(opened, `${label} card`);
    assert.ok(opened.card, `${label}: the card opens`);
    assert.equal(opened.card.title, 'Fictional rent', `${label}: the card's title`);
    assert.equal(opened.card.kicker, "house bill, wearing a postman's cap and an envelope", `${label}: the card's kicker`);
    assert.equal(opened.card.facts['The jar holds'], '$760.00 of $900.00', `${label}: the card's holdings`);
    assert.equal(opened.card.facts['In the kiln'], 'glazed to 8 of 10 — the rest still bisque', `${label}: the card's kiln`);
    assert.equal(opened.card.facts['The strike'], 'cracked — due and not full; you can still pay it from the water', `${label}: the card's strike`);
    assert.ok(opened.card.inRoom, `${label}: the card stands inside the room`);
    assert.ok(opened.stairVisible && opened.allInRoom, `${label}: everything else still inside the room with the card open`);
    await stamp(page, `card-${width}x${height}`);
    records.push({ scene: 'card', width, height, world: opened.world, overflowY: opened.overflowY, card: opened.card });
    await page.locator('.queen-jar-card__close').click();
    await page.waitForTimeout(300);
    assert.equal((await measure(page)).card, null, `${label}: the card closes`);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')?.slice(0, 14)), 'Fictional rent', `${label}: focus returns to the jar`);
    // Lift the rent out: the water on its day rises; nothing is written.
    const waterBefore = m.water;
    await page.locator('.queen-room__acts .queen-go', { hasText: 'Lift it out' }).click();
    await page.waitForTimeout(500);
    const lifted = await measure(page);
    noScroll(lifted, `${label} lifted`);
    assert.ok(lifted.jars.find(j => j.label.startsWith('Fictional rent')).held, `${label} lifted: the rent floats`);
    assert.ok(parseInt(lifted.water, 10) > parseInt(waterBefore, 10), `${label} lifted: water ${waterBefore} → ${lifted.water}`);
    assert.match(lifted.line, /Lifted out — a rehearsal; nothing is written\.$/, `${label} lifted: ${lifted.line}`);
    await stamp(page, `due-lifted-${width}x${height}`);
    records.push({ scene: 'due-lifted', width, height, water: [waterBefore, lifted.water], line: lifted.line });
    await page.locator('.queen-room__acts .queen-go', { hasText: 'Set it back' }).click();
    await page.waitForTimeout(300);
    // The hammer: pick the full, overdue hydro; the hammer leans; the sheet opens; cancel writes nothing.
    await pickJar(page, 'Fictional hydro');
    await page.waitForTimeout(400);
    const h = await measure(page);
    noScroll(h, `${label} hammer`);
    assert.match(h.line, /^The hammer is out\. Fictional hydro · house bill · Housing › Electric · 5 days overdue · \$140\.00 saved, ready/, `${label} hammer: ${h.line}`);
    assert.ok(h.acts.some(a => a.hammer && !a.crack && a.text === 'Break the kitty jar'), `${label} hammer: ${h.acts.map(a => a.text).join(' | ')}`);
    await stamp(page, `due-hammer-${width}x${height}`);
    await page.locator('.queen-hammer').click();
    await page.waitForSelector('[role=dialog].sheet');
    await page.waitForTimeout(300);
    const sheet = await measure(page);
    assert.match(sheet.sheet, /Break the kitty jar: Fictional hydro/, `${label} sheet: ${sheet.sheet}`);
    assert.match(sheet.sheet, /does not move money at your bank/, `${label} sheet: the boundary is said`);
    await stamp(page, `due-confirm-${width}x${height}`);
    records.push({ scene: 'due-confirm', width, height, sheet: sheet.sheet });
    await page.locator('[role=dialog].sheet button', { hasText: 'Cancel' }).click();
    await page.waitForTimeout(300);
    assert.equal((await measure(page)).jars.find(j => j.label.startsWith('Fictional hydro')).strike, 'hammer', `${label}: cancelled — the hammer is still out, nothing posted`);
    if (width === 390) {
      // Break it for real on the proof page's in-memory books: the jar becomes a shard and the hammer is gone.
      await page.locator('.queen-hammer').click();
      await page.waitForSelector('[role=dialog].sheet');
      await page.locator('[role=dialog].sheet button.primary', { hasText: 'Break it' }).click();
      await page.waitForTimeout(700);
      const broke = await measure(page);
      noScroll(broke, `${label} broken`);
      assert.equal(broke.jars.find(j => j.label.startsWith('Fictional hydro')).strike, 'shard', `${label} broken: ${broke.jars.map(j => j.strike).join(', ')}`);
      assert.ok(!broke.acts.some(a => a.hammer), `${label} broken: no hammer on a shard`);
      await stamp(page, `due-broken-${width}x${height}`);
      records.push({ scene: 'due-broken', width, height, jars: broke.jars.map(j => `${j.label} [${j.strike}]`), notice: await page.locator('.queen-cellar-notice').textContent() });
    }
    // The planned expense, once due: no hammer here; it opens in the banks.
    await page.goto(url({ today: '2026-09-27', world: 'auto' }));
    await intoCellar(page, width);
    await pickJar(page, 'Fictional winter tires');
    await page.waitForTimeout(400);
    const planned = await measure(page);
    noScroll(planned, `${label} planned`);
    assert.ok(!planned.acts.some(a => a.hammer) && planned.acts.some(a => a.text === 'Open it in the banks'), `${label} planned: ${planned.acts.map(a => a.text).join(' | ')}`);
    await stamp(page, `overdue-planned-${width}x${height}`);
    records.push({ scene: 'overdue-planned', width, height, jars: planned.jars.map(j => `${j.label} [${j.strike}]`), acts: planned.acts.map(a => a.text) });
  }

  // ---- 3. Keyboard: the rail takes focus, arrows scrub the gate, the slider follows, the ring is visible. ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url({ today: '2026-09-12', world: 'flat' }));
  await intoCellar(page, 390);
  await page.evaluate(() => document.querySelector('.queen-cellar-rail').focus());
  const before = await page.locator('.queen-scrub input').inputValue();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const after = await page.locator('.queen-scrub input').inputValue();
  assert.equal(Number(after), Number(before) + 3, `keyboard: the gate moved ${before} → ${after}`);
  const k = await measure(page);
  assert.ok(k.focus && k.focus.className === 'queen-gate-view' && k.focus.outline !== 'none' && k.focus.width >= 2, `keyboard: ring on the rail (${JSON.stringify(k.focus)})`);
  assert.match(k.line, /Fictional hydro/, `keyboard: three days on lands on the hydro (${k.line})`);
  await stamp(page, 'keyboard-focus-390x844');
  records.push({ scene: 'keyboard', width: 390, height: 844, slider: [before, after], line: k.line, focus: k.focus });
  const axe = await new AxeBuilder({ page }).include('.queen-room--cellar').analyze();
  const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.length}`);
  records.push({ scene: 'axe', width: 390, height: 844, axeSerious: serious });

  // ---- 4. Reduced motion, 3D: the room renders; the water and the ribbon do not animate. ----
  await page.goto(url({ today: '2026-09-20', world: '3d', reduced: '1' }));
  await intoCellar(page, 390);
  const r = await measure(page);
  noScroll(r, 'reduced');
  const transitions = await page.evaluate(() => ['.queen-water', '.queen-cellar-track'].map(s => getComputedStyle(document.querySelector(s)).transitionDuration));
  assert.ok(transitions.every(t => t === '0s'), `reduced motion: no transitions (${transitions.join(', ')})`);
  await stamp(page, 'reduced-3d-390x844');
  records.push({ scene: 'reduced', width: 390, height: 844, world: r.world, transitions });
  await context.close();

  // ---- 5. No WebGL at all: the drawn jars stand in; everything still works. ----
  const noGl = await chromium.launch({ headless: true, ...exe, args: ['--disable-3d-apis', '--disable-gpu'] });
  try {
    const flat = await (await noGl.newContext({ reducedMotion: 'reduce' })).newPage();
    flat.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[390, 844], [1100, 800]]) {
      await flat.setViewportSize({ width, height });
      await flat.goto(url({ today: '2026-09-20', world: 'auto' }));
      await intoCellar(flat, width);
      await flat.waitForTimeout(1500);
      const m = await measure(flat);
      const label = `no-webgl ${width}x${height}`;
      noScroll(m, label);
      assert.equal(m.world, 'flat', `${label}: the room degraded to flat`);
      assert.deepEqual(m.jars.map(j => j.strike), ['shard', 'hammer', 'none', 'hammer', 'hammer', 'none', 'crack', 'none', 'none', 'none', 'none'], `${label}: the same reading`);
      const visible = await flat.evaluate(() => getComputedStyle(document.querySelector('.queen-billjar .queen-bank-flat')).visibility);
      assert.equal(visible, 'visible', `${label}: the drawn kitty banks stand in for the sculptures`);
      await stamp(flat, `no-webgl-${width}x${height}`);
      records.push({ scene: 'no-webgl', width, height, world: m.world, canvases: m.canvases, jars: m.jars.map(j => `${j.label} [${j.strike}]`) });
    }
  } finally { await noGl.close(); }
} finally {
  await browser.close();
  await proof.close();
}

writeFileSync(join(output, 'records.json'), JSON.stringify({ records, errors }, null, 2));
const seriousTotal = records.reduce((sum, row) => sum + (row.axeSerious?.length ?? 0), 0);
console.log(`queen-cellar-layout: ${records.length} records, ${seriousTotal} serious/critical axe rule hits, ${errors.length} page errors → ${output}`);
assert.equal(errors.length, 0, errors.join('\n'));
assert.equal(seriousTotal, 0, 'serious/critical axe hits');
