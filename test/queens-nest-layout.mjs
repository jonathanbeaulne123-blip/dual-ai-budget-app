/** The Queen's Nest (Stage 1) browser evidence: one body on Household Home at 320/390/720/1100 in three themes,
    across pulse states, with axe, reduced motion, keyboard focus, touch targets and the no-scroll rule. Fictional books only. */
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/queens-nest');
mkdirSync(output, { recursive: true });
const proof = await startHouseholdHomeProof({ port: 0 });
const browser = await chromium.launch({ headless: true, ...(process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {}) });
const records = [], errors = [], notes = [];
const WIDTHS = [[320, 568], [320, 700], [390, 844], [720, 900], [1100, 800]];
const STATES = ['checking', 'needs-us', 'building', 'reset', 'grave', 'empty', 'win'];
const REGIONS = ['crown', 'vine', 'face', 'hands', 'body', 'belly', 'protect', 'build'];
const url = (params) => `${proof.url}?${new URLSearchParams({ composition: 'queen', ...params })}`;

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const rect = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    const home = document.querySelector('.queen-home');
    const targets = [...document.querySelectorAll('.queen-region, .queen-bud, .queen-bloom, .queen-stone, .queen-move')].map(el => ({ name: el.getAttribute('aria-label') || el.className, ...rect(el) }));
    return {
      overflowX: doc.scrollWidth - doc.clientWidth,
      overflowY: doc.scrollHeight - doc.clientHeight,
      homeHeight: home ? rect(home).h : 0,
      pulse: home?.dataset.pulse, posture: home?.dataset.posture, eyes: home?.dataset.eyes, gaze: home?.dataset.gaze, glaze: home?.dataset.glaze, hands: home?.dataset.hands, crown: home?.dataset.crown,
      buds: document.querySelectorAll('.queen-bud').length, stones: document.querySelectorAll('.queen-stone').length,
      caption: document.querySelector('.queen-caption')?.textContent?.trim(),
      still: document.querySelector('.queen-region--face')?.getAttribute('aria-describedby') ? document.getElementById(document.querySelector('.queen-region--face').getAttribute('aria-describedby'))?.textContent : null,
      targets,
      small: targets.filter(t => t.w < 44 || t.h < 44).map(t => `${t.name.slice(0, 40)} ${t.w}x${t.h}`),
    };
  });
}

try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));

  // 1. Every state, every width, every theme, with the App's chrome stand-ins: no horizontal overflow, no vertical scroll, no small targets, no serious axe hits.
  for (const state of STATES) for (const theme of ['classic', 'taylor', 'newfoundland']) for (const [width, height] of WIDTHS) {
    if (theme !== 'classic' && !['needs-us', 'grave'].includes(state)) continue; // theme tokens are not authored yet (Stage 4); two states per theme prove the grammar survives them.
    await page.setViewportSize({ width, height });
    await page.goto(url({ theme, state, chrome: '1' }));
    await page.waitForSelector('.queen-home');
    const m = await measure(page);
    const label = `${state} ${theme} ${width}x${height}`;
    assert.ok(m.overflowX <= 1, `${label}: horizontal overflow ${m.overflowX}px`);
    if (height >= 700) assert.ok(m.overflowY <= 0, `${label}: Home scrolls by ${m.overflowY}px`);
    else if (m.overflowY > 0) notes.push(`${label}: scrolls by ${m.overflowY}px on a very short viewport (min-height floor)`);
    assert.equal(m.small.length, 0, `${label}: targets under 44px — ${m.small.join('; ')}`);
    for (const region of REGIONS) assert.equal(await page.locator(`.queen-region--${region}`).count(), 1, `${label}: ${region} region`);
    assert.ok(m.caption && m.still, `${label}: caption and still present`);
    if (state === 'empty') assert.equal(m.hands, 'empty', `${label}: hands empty`);
    if (state === 'checking') assert.equal(m.pulse, 'checking', `${label}: pulse checking`);
    if (state === 'needs-us') assert.equal(m.eyes, 'open', `${label}: eyes open`);
    if (state === 'grave') { assert.equal(m.pulse, 'needs-us', `${label}: pulse`); assert.equal(m.posture, 'depleted', `${label}: depleted posture`); assert.equal(m.gaze, 'body', `${label}: gaze at what is held`); }
    if (state === 'reset') { assert.equal(m.pulse, 'reset', `${label}: pulse`); assert.equal(m.posture, 'tilted', `${label}: tilted posture`); assert.equal(m.gaze, 'vine', `${label}: gaze at the Chapter`); }
    if (state === 'building') assert.equal(m.pulse, 'building', `${label}: building`);
    if (width < 720) { assert.ok(m.buds <= 2 && m.stones <= 2, `${label}: phone shows fewer`); assert.equal(await page.locator('.queen-aside').count(), 0); }
    else assert.equal(await page.locator('.queen-aside').count(), 2, `${label}: office asides`);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    const file = join(output, `${state}-${theme}-${width}x${height}.png`);
    await page.screenshot({ path: file, fullPage: false });
    records.push({ state, theme, width, height, overflowX: m.overflowX, overflowY: m.overflowY, homeHeight: m.homeHeight, pulse: m.pulse, posture: m.posture, eyes: m.eyes, gaze: m.gaze, glaze: m.glaze, hands: m.hands, crown: m.crown, buds: m.buds, stones: m.stones, caption: m.caption, axeSerious: serious.map(v => `${v.id}: ${v.nodes.length}`), file });
  }

  // 2. Freshness: stale and offline stills at 390.
  for (const freshness of ['stale', 'offline']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url({ theme: 'classic', state: 'building', freshness }));
    await page.waitForSelector('.queen-home');
    const m = await measure(page);
    assert.equal(m.pulse, 'checking', `${freshness}: pulse checking`);
    assert.equal(m.glaze, freshness === 'offline' ? 'offline' : 'matte', `${freshness}: glaze`);
    await page.screenshot({ path: join(output, `freshness-${freshness}-390.png`) });
    records.push({ state: `freshness-${freshness}`, theme: 'classic', width: 390, height: 844, pulse: m.pulse, glaze: m.glaze, caption: m.caption });
  }

  // 3. Reduced motion: no animation or transition runs; the still is complete.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url({ theme: 'classic', state: 'needs-us' }));
  await page.waitForSelector('.queen-home');
  const motion = await page.evaluate(() => ({
    trace: [...document.querySelectorAll('.queen-trace')].map(el => getComputedStyle(el).animationName),
    body: getComputedStyle(document.querySelector('.queen-body')).transitionDuration,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));
  assert.ok(motion.reduced, 'context reports reduced motion');
  assert.ok(motion.trace.every(name => name === 'none'), `trace animation under reduced motion: ${motion.trace.join(',')}`);
  assert.ok(['0s', ''].includes(motion.body), `body transition under reduced motion: ${motion.body}`);

  // 4. Keyboard: Tab reaches every region and the focus ring is visible.
  const order = [];
  for (let i = 0; i < 24; i += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return { className: el.className, label: el.getAttribute('aria-label')?.slice(0, 32), outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    if (!focused) break;
    order.push(focused);
  }
  for (const region of REGIONS) assert.ok(order.some(f => String(f.className).includes(`queen-region--${region}`)), `keyboard reaches ${region}`);
  const regionOrder = order.map(f => REGIONS.find(r => String(f.className).includes(`queen-region--${r}`))).filter(Boolean);
  assert.deepEqual(regionOrder, ['crown', 'vine', 'face', 'hands', 'body', 'belly', 'protect', 'build'], `regions read top to bottom: ${regionOrder.join(' → ')}`);
  assert.ok(order.some(f => String(f.className).includes('queen-move')), 'keyboard reaches the Move');
  assert.ok(order.some(f => String(f.className).includes('queen-stone')), 'keyboard reaches a hem stone');
  for (const f of order.filter(f => /queen-/.test(String(f.className)))) assert.ok(f.outline !== 'none' && f.width >= 3, `visible focus on ${f.className}: ${f.outline} ${f.width}`);
  await page.evaluate(() => document.querySelector('.queen-region--face')?.focus());
  await page.screenshot({ path: join(output, 'keyboard-focus-face-390.png') });

  // 5. Easy read: the same local preference Hercules uses enlarges words and targets here.
  const plainName = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.queen-stone__name')).fontSize));
  await page.goto(url({ theme: 'classic', state: 'needs-us', easy: '1' }));
  await page.waitForSelector('.queen-home[data-easy-read="true"]');
  const easy = await page.evaluate(() => ({
    name: parseFloat(getComputedStyle(document.querySelector('.queen-stone__name')).fontSize),
    move: Math.round(document.querySelector('.queen-move').getBoundingClientRect().height),
    overflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  assert.ok(easy.name > plainName, `easy read enlarges hem words: ${plainName} → ${easy.name}`);
  assert.ok(easy.move >= 48, `easy read Move target ${easy.move}px`);
  await page.screenshot({ path: join(output, 'easy-read-390.png') });
  records.push({ state: 'easy-read', plainName, easyName: easy.name, moveHeight: easy.move, overflowY: easy.overflowY });
  await page.evaluate(() => localStorage.clear());

  // 6. The Move acts in one tap: Done leaves the hands empty.
  await page.goto(url({ theme: 'classic', state: 'building' }));
  await page.waitForSelector('.queen-move');
  const verbs = [];
  for (let step = 0; step < 4 && await page.locator('.queen-move').count(); step += 1) {
    const verb = await page.locator('.queen-move__verb').textContent();
    verbs.push(verb);
    const before = await page.locator('.queen-move').getAttribute('aria-label');
    await page.locator('.queen-move').click();
    await page.waitForFunction((prior) => document.querySelector('.queen-move')?.getAttribute('aria-label') !== prior, before);
  }
  assert.deepEqual(verbs, ['Done', 'I acknowledge this', 'Done'], `one tap per act: ${verbs.join(' → ')}`);
  await page.waitForFunction(() => document.querySelector('.queen-home')?.dataset.hands === 'empty');
  await page.screenshot({ path: join(output, 'after-move-done-390.png') });
  records.push({ state: 'move-one-tap', verbs });

  // 7. A bud opens the existing gallery at that goal; back returns focus to the bud.
  await page.goto(url({ theme: 'classic', state: 'building' }));
  await page.waitForSelector('.queen-bud');
  await page.locator('.queen-bud').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.kitty-room');
  await page.screenshot({ path: join(output, 'bud-opens-gallery-390.png') });
  await page.getByRole('button', { name: '← Back to Home' }).click();
  await page.waitForSelector('.kitty-room', { state: 'detached' });
  const back = await page.evaluate(() => document.activeElement?.className || '');
  assert.ok(back.includes('queen-bud'), `focus returns to the bud, got ${back}`);

  writeFileSync(join(output, 'records.json'), JSON.stringify({ records, notes, errors, keyboardOrder: order }, null, 2));
  const seriousTotal = records.reduce((sum, row) => sum + (row.axeSerious?.length ?? 0), 0);
  console.log(`queens-nest-layout: ${records.length} captures, ${seriousTotal} serious/critical axe rule hits, ${errors.length} page errors, ${notes.length} notes → ${output}`);
  for (const note of notes) console.log(`  note: ${note}`);
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(seriousTotal, 0, 'serious/critical axe hits');
} finally {
  await browser.close();
  await proof.close();
}
