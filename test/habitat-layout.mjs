/** The Hercules habitats on the ACTUAL App page: each habitat opened as the household on the device, her field,
    the cellar and the loft at 390×844 and 1100×800 on the 3D path. Asserts what the two stories promise — the Queen's
    pulse, the cellar's water and strikes, the loft's ledge — with no page scroll and no page errors. Fictional books only. */
import { startQueenWorldPageProof } from '../scripts/serve-queen-world-page-proof.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/habitat');
mkdirSync(output, { recursive: true });
const exe = process.env.HEARTH_CHROMIUM ? { executablePath: process.env.HEARTH_CHROMIUM } : {};
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const WIDTHS = (process.env.HEARTH_PROOF_WIDTHS || '390x844,1100x800').split(',').map((pair) => pair.split('x').map(Number));
const records = [];
const proof = await startQueenWorldPageProof();

const measure = (page) => page.evaluate(() => {
  const doc = document.documentElement, home = document.querySelector('.queen-home'), cellar = document.querySelector('.queen-room--cellar'), loft = document.querySelector('.queen-room--loft');
  return {
    overflowX: doc.scrollWidth - doc.clientWidth, overflowY: doc.scrollHeight - doc.clientHeight,
    scene: home?.dataset.scene, pulse: home?.dataset.pulse, world: home?.dataset.world,
    still: document.getElementById(document.querySelector('.queen-figure')?.getAttribute('aria-describedby') ?? '')?.textContent ?? null,
    name: document.querySelector('.household-switcher, [data-household-name]')?.textContent ?? document.title,
    jars: cellar ? [...cellar.querySelectorAll('.queen-jar--bill')].map((el) => ({ label: el.getAttribute('aria-label'), strike: [...el.classList].find((c) => /^queen-jar--(hammer|crack|shard|none)$/.test(c))?.slice(11) })) : [],
    cellarSub: cellar?.querySelector('.queen-room__sub')?.textContent ?? null, cellarLine: cellar?.querySelector('.queen-room__line')?.textContent ?? null,
    water: cellar?.querySelector('.queen-water')?.style.height ?? null, under: cellar?.querySelector('.queen-cellar-rail')?.classList.contains('is-under') ?? false, dry: cellar?.querySelector('.queen-cellar-rail')?.classList.contains('is-dry') ?? false,
    ledge: loft ? [...loft.querySelectorAll('.queen-goal')].map((el) => el.getAttribute('aria-label')) : [],
  };
});
const travel = async (page, floor) => { await page.click(`.queen-house-rail__stop[data-floor='${floor}']`); await page.waitForTimeout(800); };

for (const habitat of ['well', 'hard']) {
  for (const [w, h] of WIDTHS) {
    const browser = await chromium.launch({ args: GL, ...exe });
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.route('**://fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**://fonts.gstatic.com/**', (route) => route.abort());
    await page.goto(`${proof.url}?habitat=${habitat}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.queen-house-rail__stop', { state: 'attached', timeout: 300000 });
    await page.waitForTimeout(1500);
    for (const floor of ['home', 'cellar', 'loft']) {
      if (floor !== 'home') await travel(page, floor);
      const m = await measure(page);
      const label = `${habitat} ${floor} ${w}×${h}`;
      assert.equal(m.scene, floor, `${label}: standing on ${floor}`);
      assert.equal(m.overflowX, 0, `${label}: no sideways scroll`);
      assert.equal(m.overflowY, 0, `${label}: no page scroll`);
      if (floor === 'home') {
        // The story's pulse: doing well builds; doing badly needs us.
        assert.equal(m.pulse, habitat === 'well' ? 'building' : 'needs-us', `${label}: pulse ${m.pulse}`);
      }
      if (floor === 'cellar') {
        assert.ok(m.jars.length >= 6, `${label}: a month of bills on the rail (${m.jars.length})`);
        if (habitat === 'well') assert.ok(!m.jars.some((j) => j.strike === 'crack'), `${label}: nothing cracked`);
        else assert.ok(m.jars.some((j) => j.strike === 'crack'), `${label}: something is cracked`);
        if (habitat === 'hard') assert.ok(m.under || m.dry || /under the mark|runs dry/.test(m.cellarSub ?? ''), `${label}: the water is under the mark or dry (${m.cellarSub})`);
      }
      if (floor === 'loft') assert.ok(m.ledge.length >= 2, `${label}: things on the ledge (${m.ledge.length})`);
      await page.screenshot({ path: join(output, `${habitat}-${floor}-${w}x${h}.png`) });
      records.push({ habitat, floor, width: w, height: h, pulse: m.pulse, still: m.still, jars: m.jars.map((j) => `${j.label} [${j.strike}]`), cellarSub: m.cellarSub, cellarLine: m.cellarLine, water: m.water, under: m.under, dry: m.dry, ledge: m.ledge, overflowY: m.overflowY, errors: errors.length });
    }
    assert.equal(errors.length, 0, `${habitat} ${w}×${h}: no page errors — ${errors.join(' | ')}`);
    await browser.close();
  }
}
writeFileSync(join(output, 'records.json'), `${JSON.stringify(records, null, 2)}\n`);
await proof.close();
console.log(`habitat-layout: ${records.length} records → ${output}`);
