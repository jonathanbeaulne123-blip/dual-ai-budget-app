/** Browser evidence for Plan Studio v3 integrated with the money model (D-282). Both flags ON; fictional books only.
    Studio (scripts/serve-plan-v3-integrated-proof.mjs): the rest screen, the check-in (Coming in with the split, Protect with the
    refill), drawer sheets (the Protect fund sheet with its refill, the Letter tray), the partner's yes, and the 12-tile category grid.
    Cellar (scripts/serve-household-home-proof.mjs with sorted=1): the rail with umbrella hues, the missing subscription card and the
    pay glass. Three themes × 320/390/720/1100, reduced motion at 390/1100. Writes PNGs and records.json to
    docs/evidence/plan-studio-v3-integrated/ (or HEARTH_ARTIFACTS_DIR). Set HEARTH_CHROMIUM when Playwright's browser is not installed. */
import { startPlanV3IntegratedProof } from '../scripts/serve-plan-v3-integrated-proof.mjs';
import { startHouseholdHomeProof } from '../scripts/serve-household-home-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || 'docs/evidence/plan-studio-v3-integrated');
mkdirSync(output, { recursive: true });
const THEMES = ['classic', 'taylor', 'newfoundland'];
const WIDTHS = [320, 390, 720, 1100];
const PARTS = (process.env.PARTS || 'studio,category,cellar').split(',');
// PARTS=story needs STORY_JSON: main's Our Story habitat, generated and sorted beforehand (fictional; never committed).
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const browser = await chromium.launch({ headless: true, ...exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const records = [];
const failures = [];

async function measure(page, scope) {
  return page.evaluate((scope) => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const small = [...document.querySelectorAll(`${scope} button, ${scope} summary, .pv3-veil button`)]
      .filter(el => !el.closest('.plan-studio, .chapter-close, .ritual-form, .sitdown-brief, .proof-banner') && el.getClientRects().length)
      .map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ el, r }) => `${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    return { overflow, small };
  }, scope);
}
async function axe(page, include) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).include(include).exclude('.proof-banner').exclude('[data-proof-standin]').analyze();
  return result.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`);
}
async function shot(page, name, { full = true } = {}) {
  if (full) {
    const height = await page.evaluate(() => Math.max(window.innerHeight, document.documentElement.scrollHeight));
    await page.setViewportSize({ width: page.viewportSize().width, height: Math.min(height, 4000) });
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: join(output, `${name}.png`) });
}
async function record(page, name, errors, { scope = '.pv3', axeScope = scope, runAxe = true, targets = true, extra = {} } = {}) {
  const m = await measure(page, scope);
  const violations = runAxe ? await axe(page, axeScope) : [];
  const row = { name, width: page.viewportSize().width, overflow: m.overflow, smallTargets: targets ? m.small : [], axe: violations, pageErrors: [...errors], ...extra };
  records.push(row);
  console.log('record', name);
  if (m.overflow > 1) failures.push(`${name}: horizontal overflow ${m.overflow}px`);
  if (targets && m.small.length) failures.push(`${name}: small targets ${m.small.join('; ')}`);
  if (violations.length) failures.push(`${name}: axe ${violations.join(' | ')}`);
  if (errors.length) failures.push(`${name}: page errors ${errors.join(' | ')}`);
  errors.length = 0;
}
async function newPage(options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, ...options });
  const page = await context.newPage();
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { page, errors, close: () => context.close() };
}

// ------------------------------------------------------------------ the studio
if (PARTS.includes('studio') || PARTS.includes('category')) {
  const proof = await startPlanV3IntegratedProof({ port: 0 });
  const open = async (page, query, width, height = 900) => {
    await page.setViewportSize({ width, height });
    await page.goto(`${proof.url}?${query}`);
    await page.locator(query.includes('page=category') ? '.app' : '.pv3').first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(300);
  };
  try {
    if (PARTS.includes('studio')) {
      const { page, errors, close } = await newPage();
      // 1. Rest: three worlds × four widths, the money model's figures, the split waiting and the Chapter's month reminder.
      for (const theme of THEMES) for (const width of WIDTHS) {
        await open(page, `theme=${theme}&state=sorted&lite=0`, width);
        const text = await page.locator('.pv3-rest').innerText();
        assert.match(text, /Divide \$4,000/, 'the not-divided-yet card');
        assert.match(text, /Bills covered all September/, 'Prepare reads its bills');
        assert.match(text, /still open from August/, 'the Chapter month reminder');
        assert.doesNotMatch(text, /\+\$4,000 not divided yet/, 'a landed contribution is never added on top of Now');
        await record(page, `rest-sorted-${theme}-${width}`, errors, { runAxe: theme === 'classic' || width === 390 });
        await shot(page, `rest-sorted-${theme}-${width}`);
      }
      // 2. The partner's yes to the split (390, 1100).
      for (const width of [390, 1100]) {
        await open(page, 'state=proposed&lite=0', width);
        assert.equal(await page.getByRole('button', { name: /^Yes, divide it this way/ }).count(), 1);
        await record(page, `rest-proposed-${width}`, errors);
        await shot(page, `rest-proposed-${width}`);
        if (width === 390) {
          await page.getByRole('button', { name: /^Yes, divide it this way/ }).click();
          await page.locator('.pv3-divide').waitFor({ state: 'detached' });
          await record(page, `rest-divided-after-yes-${width}`, errors);
          await shot(page, `rest-divided-after-yes-${width}`);
        }
      }
      // 3. Drawer sheets: the Protect fund sheet with the refill (custodian, then partner) and the Letter tray, per world.
      for (const theme of THEMES) for (const width of [390, 1100]) {
        await open(page, `theme=${theme}&state=divided&lite=0`, width);
        await page.getByRole('button', { name: /^Protect, our backup/ }).click();
        const sheet = page.getByRole('dialog', { name: 'Protect' });
        await sheet.waitFor();
        assert.match(await sheet.innerText(), /Waiting for Sam \(fictional\) to say yes/);
        await page.waitForTimeout(200);
        await record(page, `sheet-protect-custodian-${theme}-${width}`, errors, { axeScope: '.pv3-veil' });
        await shot(page, `sheet-protect-custodian-${theme}-${width}`, { full: false });
        await page.keyboard.press('Escape');
        await sheet.waitFor({ state: 'detached' });
        const tray = page.getByRole('button', { name: /^Letter tray/ });
        await tray.focus();
        await page.keyboard.press('Enter');
        const letters = page.getByRole('dialog', { name: 'Letter tray' });
        await letters.waitFor();
        await page.waitForTimeout(200);
        await record(page, `sheet-letter-${theme}-${width}`, errors, { axeScope: '.pv3-veil' });
        await shot(page, `sheet-letter-${theme}-${width}`, { full: false });
        await page.keyboard.press('Escape');
        await letters.waitFor({ state: 'detached' });
      }
      for (const width of [320, 390, 1100]) {
        await open(page, 'state=divided&member=MEM-002&lite=0', width);
        await page.getByRole('button', { name: /^Protect, our backup/ }).click();
        const sheet = page.getByRole('dialog', { name: 'Protect' });
        await sheet.waitFor();
        assert.equal(await sheet.getByRole('button', { name: 'Suggest a refill' }).count(), 0, 'only the custodian suggests');
        await record(page, `sheet-protect-partner-${width}`, errors, { axeScope: '.pv3-veil' });
        await shot(page, `sheet-protect-partner-${width}`, { full: false });
        await sheet.getByRole('button', { name: 'Yes, lend it' }).click();
        await sheet.getByText(/Agreed by both of you/).waitFor();
        await shot(page, `sheet-protect-partner-agreed-${width}`, { full: false });
      }
      // 4. The check-in: Coming in with the split, then Protect with the refill form (three widths in Classic, 390 in the other worlds).
      for (const [theme, width] of [['classic', 320], ['classic', 390], ['classic', 720], ['classic', 1100], ['taylor', 390], ['newfoundland', 390]]) {
        await open(page, `theme=${theme}&state=sorted&lite=0`, width);
        await page.getByRole('button', { name: 'Two chairs, start our check-in together' }).click();
        await page.getByRole('dialog', { name: 'Two chairs' }).getByRole('button', { name: /^Start our check-in together/ }).click();
        const step = id => page.locator(`.pv3-checkin[data-step="${id}"]`).waitFor();
        await step('hello');
        await page.getByRole('button', { name: "We're doing this together" }).click();
        await step('back');
        assert.match(await page.locator('.pv3-checkin').innerText(), /still open from August/);
        if (width === 390) { await record(page, `checkin-back-${theme}-${width}`, errors); await shot(page, `checkin-back-${theme}-${width}`); }
        await page.getByRole('button', { name: 'Save and continue' }).click();
        await step('in');
        assert.equal(await page.locator('.pv3-checkin .pv3-divide').count(), 1, 'the split in Coming in');
        await record(page, `checkin-in-${theme}-${width}`, errors);
        await shot(page, `checkin-in-${theme}-${width}`);
        if (theme === 'classic' && width === 390) {
          await page.locator('.pv3-checkin .pv3-divide').getByRole('button', { name: /^Propose this split/ }).click();
          await page.getByText('Waiting for Sam (fictional) to say yes.').waitFor();
          await shot(page, `checkin-in-proposed-${theme}-${width}`);
        }
        await page.getByRole('button', { name: 'Looks right' }).click();
        await step('prepare');
        await page.getByRole('button', { name: 'All here', exact: true }).click();
        await step('protect');
        assert.equal(await page.locator('.pv3-checkin .pv3-refill').count(), 1, 'the refill panel in Protect top-up');
        await record(page, `checkin-protect-${theme}-${width}`, errors);
        await shot(page, `checkin-protect-${theme}-${width}`);
      }
      // 5. Reduced motion: Lite by default, nothing animates, at 390 and 1100 (rest and the check-in).
      const reduced = await newPage({ reducedMotion: 'reduce' });
      for (const width of [390, 1100]) {
        await open(reduced.page, 'state=sorted', width);
        assert.equal(await reduced.page.locator('.pv3').getAttribute('data-lite'), 'true', 'Lite under reduced motion');
        const animations = await reduced.page.evaluate(() => document.getAnimations().length);
        await record(reduced.page, `reduced-rest-${width}`, reduced.errors, { extra: { animations } });
        if (animations) failures.push(`reduced-rest-${width}: ${animations} animations`);
        await shot(reduced.page, `reduced-rest-${width}`);
        await reduced.page.getByRole('button', { name: 'Two chairs, start our check-in together' }).click();
        await reduced.page.getByRole('dialog', { name: 'Two chairs' }).getByRole('button', { name: /^Start our check-in together/ }).click();
        await reduced.page.locator('.pv3-checkin[data-step="hello"]').waitFor();
        const checkinAnimations = await reduced.page.evaluate(() => document.getAnimations().length);
        await record(reduced.page, `reduced-checkin-${width}`, reduced.errors, { extra: { animations: checkinAnimations } });
        if (checkinAnimations) failures.push(`reduced-checkin-${width}: ${checkinAnimations} animations`);
        await shot(reduced.page, `reduced-checkin-${width}`);
      }
      await reduced.close();
      await close();
    }
    if (PARTS.includes('category')) {
      // 6. The category grid: twelve umbrellas, three funds (never Protect), three worlds × four widths.
      const { page, errors, close } = await newPage();
      for (const theme of THEMES) for (const width of WIDTHS) {
        await open(page, `page=category&theme=${theme}`, width);
        await page.locator('.umbrella-tile').first().waitFor();
        const tiles = await page.locator('.umbrella-tile').count();
        assert.equal(tiles, 12, 'twelve umbrellas');
        const input = page.locator('.app input').first();
        await input.fill('Fictional pottery');
        await page.locator('.umbrella-tile', { hasText: 'Fun' }).click();
        const funds = await page.locator('.fund-choice__option').allInnerTexts();
        assert.ok(!funds.some(text => /Protect/.test(text)), 'nothing starts in Protect');
        const clipped = await page.evaluate(() => [...document.querySelectorAll('.umbrella-tile__name, .fund-choice__option strong, .fund-choice__option small')]
          .filter(el => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > el.parentElement.getBoundingClientRect().right + 1).map(el => el.textContent));
        if (clipped.length) failures.push(`category-grid-${theme}-${width}: words spill out of their tile: ${clipped.join(', ')}`);
        await record(page, `category-grid-${theme}-${width}`, errors, { scope: '.app main', targets: false, extra: { tiles, funds, clipped } });
        await shot(page, `category-grid-${theme}-${width}`);
      }
      await close();
    }
  } finally {
    await proof.close();
  }
}

// ------------------------------------------------------------------ Our Story (main #497), sorted, both flags on
if (PARTS.includes('story')) {
  const proof = await startPlanV3IntegratedProof({ port: 0, storyJson: process.env.STORY_JSON });
  try {
    const { page, errors, close } = await newPage();
    for (const [theme, width] of [['classic', 390], ['taylor', 1100], ['newfoundland', 320], ['classic', 720]]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${proof.url}?page=story-studio&theme=${theme}&lite=0`);
      await page.locator('.pv3').waitFor({ timeout: 180_000 });
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.pv3-fund').count(), 3, 'three funds on the story household');
      await record(page, `story-rest-${theme}-${width}`, errors, { runAxe: theme === 'classic' });
      await shot(page, `story-rest-${theme}-${width}`);
      if (width === 390) {
        await page.getByRole('button', { name: /^Prepare, has to leave/ }).click();
        await page.getByRole('dialog', { name: 'Prepare' }).waitFor();
        await page.waitForTimeout(200);
        await record(page, `story-sheet-prepare-${theme}-${width}`, errors, { axeScope: '.pv3-veil' });
        await shot(page, `story-sheet-prepare-${theme}-${width}`, { full: false });
        await page.keyboard.press('Escape');
      }
    }
    await close();
  } finally {
    await proof.close();
  }
}

// ------------------------------------------------------------------ the cellar, sorted
if (PARTS.includes('cellar') || PARTS.includes('story-cellar')) {
  const onlyStory = !PARTS.includes('cellar');
  const proof = await startHouseholdHomeProof({ port: 0, fundModel: true, cellarV3: true });
  const storyProof = process.env.STORY_JSON ? await startHouseholdHomeProof({ port: 0, fundModel: true, cellarV3: true, storyJson: process.env.STORY_JSON }) : proof;
  const SIZES = [[320, 700], [390, 844], [720, 900], [1100, 800]];
  const url = (theme, height, extra = {}) => `${proof.url}?${new URLSearchParams({ composition: 'queen', chrome: height >= 800 ? '1' : '0', state: 'building', bills: '1', cellar3: '1', sorted: '1', today: '2026-09-12', theme, world: 'flat', ...extra })}`;
  const scroll = (page) => page.evaluate(() => ({ x: document.documentElement.scrollWidth - document.documentElement.clientWidth, y: document.documentElement.scrollHeight - document.documentElement.clientHeight }));
  async function clickHer(page) { const her = page.locator('.queen-figure'); await her.waitFor({ timeout: 90_000 }); const b = await her.boundingBox(); await her.click({ position: { x: b.width / 2, y: b.height * 0.3 }, timeout: 60_000, force: true }); }
  async function cellar(page, width) {
    await page.waitForSelector('.queen-home', { timeout: 180_000 });
    await page.waitForTimeout(600);
    await clickHer(page);
    await page.waitForSelector('.queen-home.is-expanded', { timeout: 120_000 });
    await page.waitForTimeout(700);
    const bank = page.locator('.queen-bank--protect .queen-bank__button, .queen-bank--prepare .queen-bank__button').first();
    await bank.click({ timeout: 60_000 });
    await page.waitForTimeout(700);
    const door = page.locator('.queen-panel .queen-go--primary[data-door]').first();
    if (width < 720 && await door.count()) await door.click({ timeout: 60_000 });
    else if (!(await page.locator('.queen-home[data-scene="cellar"]').count())) await bank.click({ timeout: 60_000 });
    await page.waitForSelector('.queen-home[data-scene="cellar"]', { timeout: 120_000 });
    await page.waitForTimeout(1200);
  }
  async function gateTo(page, day) {
    await page.locator('.queen-cellar-rail').focus();
    await page.keyboard.press('Home');
    for (let i = 1; i < day; i += 1) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
  }
  async function pick(page, kind) {
    const jar = page.locator(`.queen-jar--extra[data-kind="${kind}"].is-in-gate`).first();
    try { await jar.click({ timeout: 8_000 }); } catch { await jar.focus(); await page.keyboard.press('Enter'); }
    await page.waitForSelector('.queen-jar-card', { timeout: 60_000 });
    await page.waitForTimeout(250);
  }
  try {
    for (const theme of onlyStory ? [] : THEMES) for (const [width, height] of SIZES) {
      const tag = `${theme}-${width}`;
      const { page, errors, close } = await newPage({ viewport: { width, height } });
      await page.goto(url(theme, height));
      await cellar(page, width);
      const tints = await page.evaluate(() => [...document.querySelectorAll('.queen-billjar')].map(el => ({ hue: el.dataset.hue, tint: el.querySelector('svg')?.style.getPropertyValue('--bank-tint') || null })));
      assert.ok(tints.some(row => row.tint && row.tint.startsWith('#')), `${tag}: bill jars carry an umbrella hue`);
      const railText = await page.locator('.queen-cellar-rail').textContent();
      assert.doesNotMatch(railText ?? '', /\$\d/, `${tag}: no figure on the rail`);
      await gateTo(page, 5);
      const s = await scroll(page);
      await shot(page, `cellar-rail-${tag}`, { full: false });
      await pick(page, 'missing');
      assert.match(await page.locator('.queen-jar-card--missing').textContent(), /Fictional video club wasn't charged for Sep 5/, `${tag}: the missing words`);
      await page.waitForTimeout(150);
      await record(page, `cellar-missing-${tag}`, errors, { scope: '.queen-room--cellar', targets: false, runAxe: theme === 'classic', extra: { tints, scroll: s } });
      await shot(page, `cellar-missing-${tag}`, { full: false });
      await page.keyboard.press('Escape');
      await gateTo(page, 18);
      await pick(page, 'income');
      assert.match(await page.locator('.queen-jar-card--hypothetical').textContent(), /If all of your pay came in/, `${tag}: the glass words`);
      assert.equal(await page.getByRole('button', { name: 'Hide my pay from the jars' }).count(), 1, `${tag}: own pay can be hidden`);
      await record(page, `cellar-income-${tag}`, errors, { scope: '.queen-room--cellar', targets: false, runAxe: false });
      await shot(page, `cellar-income-${tag}`, { full: false });
      await close();
    }
    // Main's Our Story household (#497), sorted, flags on: the cellar over twenty-five fictional months.
    if (process.env.STORY_JSON) for (const [theme, width, height] of [['classic', 390, 844], ['newfoundland', 1100, 800], ['taylor', 320, 700]]) {
      const tag = `story-${theme}-${width}`;
      const { page, errors, close } = await newPage({ viewport: { width, height } });
      await page.goto(`${storyProof.url}?${new URLSearchParams({ composition: 'queen', chrome: height >= 800 ? '1' : '0', story: '1', today: '2026-09-16', theme, world: 'flat' })}`);
      await cellar(page, width);
      const railText = await page.locator('.queen-cellar-rail').textContent();
      assert.doesNotMatch(railText ?? '', /\$\d/, `${tag}: no figure on the rail`);
      const s = await scroll(page);
      if (s.x > 1 || s.y > 0) failures.push(`${tag}: page scrolls ${JSON.stringify(s)}`);
      await record(page, `cellar-${tag}`, errors, { scope: '.queen-room--cellar', targets: false, runAxe: theme === 'classic', extra: { scroll: s, extras: await page.locator('.queen-jar--extra').count() } });
      await shot(page, `cellar-${tag}`, { full: false });
      await close();
    }
    for (const [width, height] of onlyStory ? [] : [[390, 844], [1100, 800]]) {
      const { page, errors, close } = await newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      await page.goto(url('classic', height, { reduced: '1' }));
      await cellar(page, width);
      await gateTo(page, 5);
      await pick(page, 'missing');
      const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.queen-cellar-cheer i')).animationName);
      if (anim !== 'none') failures.push(`cellar-reduced-${width}: sparks animate (${anim})`);
      await record(page, `cellar-reduced-${width}`, errors, { scope: '.queen-room--cellar', targets: false, runAxe: false, extra: { sparkAnimation: anim } });
      await shot(page, `cellar-reduced-${width}`, { full: false });
      await close();
    }
  } finally {
    await proof.close();
    if (storyProof !== proof) await storyProof.close();
  }
}

await browser.close();
const name = `records${process.env.PARTS ? '-' + process.env.PARTS.replace(/[^a-z0-9]+/gi, '_') : ''}.json`;
writeFileSync(join(output, name), JSON.stringify({ generatedBy: 'test/plan-v3-integrated-layout.mjs', flags: { VITE_PLAN_STUDIO_V3: '1', VITE_FUND_MODEL_V2: '1' }, data: 'fictional only', failures, records }, null, 2));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`plan-v3 integrated layout: ${records.length} records, 0 failures → ${output}`);
process.exit(0);
