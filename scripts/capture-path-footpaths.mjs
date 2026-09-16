/** Evidence for Our Path private footpaths and bridges (fictional books only). `node scripts/capture-path-footpaths.mjs` */
import { chromium } from '@playwright/test';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';

const out = 'docs/evidence/our-path-world';
const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const report = {};
async function page(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const p = await context.newPage();
  p.on('pageerror', (error) => errors.push(`${width}: ${error.message}`));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const marks = (p) => p.evaluate(() => [...document.querySelectorAll('.path-world__outline button')].map((b) => b.textContent));
async function outline(p, text) {
  await p.evaluate(() => { const d = document.querySelector('.path-world__outline'); if (d) d.open = true; });
  await p.locator('.path-world__outline button', { hasText: text }).first().click();
  await p.evaluate(() => { document.querySelector('.path-world__outline').open = false; });
}
const toStage = (p) => p.evaluate(() => window.scrollTo(0, document.querySelector('.path-world__stage').getBoundingClientRect().top + window.scrollY - 8));
const ready = (p) => p.waitForFunction(() => window.__ready && document.querySelector('.path-world__host[data-live="true"]'), null, { timeout: 90_000 });
function assert(ok, message) { if (!ok) { errors.push(`assert: ${message}`); } }

const proof = await startOurPathWorldProof({ port: 5198 });
try {
  // 1. Classic, 1100: my footpath card, up close.
  {
    const p = await page(1100, 860);
    await p.goto(`${proof.url}?theme=classic&story=well&lantern=1&quality=full`);
    await ready(p);
    const list = await marks(p);
    report.ownerMarks = list.filter((t) => /only you|Our Home|plank/.test(t));
    assert(list.includes('Fictional: plan a quiet birthday surprise · only you see this'), 'owner sees the footpath');
    await outline(p, 'Fictional: plan a quiet birthday surprise');
    await wait(1800);
    await p.getByRole('button', { name: 'Up close', exact: true }).click();
    await wait(1800);
    await toStage(p);
    await wait(300);
    report.footpathCard = await p.locator('.path-world__card').innerText();
    report.footpathMarkShown = await p.evaluate(() => [...document.querySelectorAll('.path-mark--footpath')].some((m) => !m.hidden));
    await p.screenshot({ path: `${out}/footpaths-classic-1100.png` });
    await p.getByRole('button', { name: 'Open my planner' }).click();
    report.footpathLink = await p.evaluate(() => window.__opened);
    await p.context().close();
  }
  // 2. Taylor, 1100: the stage-2 bridge card and its link into the tent.
  {
    const p = await page(1100, 860);
    await p.goto(`${proof.url}?theme=taylor&story=well&lantern=1&quality=full`);
    await ready(p);
    await outline(p, 'Fictional: I can cover the ferry tickets');
    await toStage(p);
    await wait(3000);
    await toStage(p);
    await wait(300);
    report.bridgeCard = await p.locator('.path-world__card').innerText();
    assert(report.bridgeCard.includes('Offered to Our Home — waiting'), 'stage-2 words');
    assert(!/\$|120/.test(report.bridgeCard), 'no amount on the bridge card');
    await p.screenshot({ path: `${out}/bridge-taylor-1100.png` });
    await p.getByRole('button', { name: 'Open the Bridge' }).click();
    report.bridgeLink = await p.evaluate(() => ({ opened: window.__opened, tent: !document.querySelector('.path-world__room').hidden }));
    await p.context().close();
  }
  // 3. Newfoundland, 1100: the same island as MEM-002. No footpath marks, no private plank.
  {
    const p = await page(1100, 860);
    await p.goto(`${proof.url}?theme=newfoundland&story=well&lantern=1&quality=full`);
    await ready(p);
    await p.locator('#switch-member').click();
    await wait(1500);
    const list = await marks(p);
    report.partnerMarks = list.filter((t) => /only you|Our Home|plank/.test(t));
    const footpathMarks = await p.evaluate(() => document.querySelectorAll('.path-mark--footpath').length);
    report.partnerFootpathMarks = footpathMarks;
    assert(footpathMarks === 0, 'partner has no footpath marks');
    assert(!list.some((t) => /birthday surprise|car to the garage/.test(t)), 'partner sees neither the private task nor the private plank');
    assert(list.includes('Fictional: I can cover the ferry tickets · Offered to Our Home — waiting'), 'partner sees the shared offer');
    // Frame the same month as the owner's shot: the shared bridge is there, the footpath and private plank are not.
    await outline(p, 'Fictional: I can cover the ferry tickets');
    await toStage(p);
    await wait(3000);
    report.partnerFootpathShown = await p.evaluate(() => [...document.querySelectorAll('.path-mark--footpath')].some((m) => !m.hidden));
    assert(!report.partnerFootpathShown, 'no footpath mark visible for the partner');
    await p.screenshot({ path: `${out}/footpaths-partner-1100.png` });
    await p.context().close();
  }
  // 4. Phones: no horizontal scroll with the Mine toggle, and Mine hides the footpath (390 and 320, Lite).
  for (const width of [390, 320]) {
    const p = await page(width, 844);
    await p.goto(`${proof.url}?theme=taylor&story=well&lantern=1&quality=lite`);
    await ready(p);
    await p.getByRole('button', { name: 'Mine', exact: true }).click();
    const list = await marks(p);
    report[`phone-${width}`] = { overflow: await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), footpathAfterMine: list.some((t) => t.includes('birthday surprise')) };
    assert(!report[`phone-${width}`].overflow && !report[`phone-${width}`].footpathAfterMine, `phone ${width}`);
    await p.context().close();
  }
} finally {
  await proof.close();
  await browser.close();
}
console.log(JSON.stringify({ report, errors }, null, 2));
if (errors.length) process.exitCode = 1;
