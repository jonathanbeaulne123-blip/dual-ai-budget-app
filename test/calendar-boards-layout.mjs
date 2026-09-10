/** Local synthetic Chromium geometry proof. Run: node test/calendar-boards-layout.mjs */
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const cacheDir = mkdtempSync(join(tmpdir(), 'hearth-calendar-vite-'));
const css = [...readFileSync('src/main.tsx', 'utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([, path]) => `import '/src/${path}';`).join('\n');
const entry = `${css}
import { createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarPage } from '/src/Calendar.tsx';
import { PotentialExpenseConfirmSheet } from '/src/PotentialExpenseConfirmSheet.tsx';
import { catalogHousehold, addPotentialExpense, addRecurrence } from '/src/core/index.ts';
import { resolveThemeScene, sceneTokens } from '/src/theme/scenes.ts';
const query = new URLSearchParams(location.search), theme = query.get('theme'), view = query.get('view');
const scene = resolveThemeScene(theme, 'calendar', view);
Object.assign(document.documentElement.dataset, { theme, scene: scene.id, material: scene.material, sceneLighting: scene.dark ? 'dark' : 'light', atmosphere: 'paused' });
for (const [key, value] of Object.entries(sceneTokens(scene))) document.documentElement.style.setProperty(key, value);
let household = addRecurrence(catalogHousehold(), { nextDate: '2026-09-08', cadence: 'weekly', type: 'expense', accountId: 'ACC-CHEQUING', subcategoryId: 'SUB-FOOD-GROCERIES', amount: '20', note: 'Fictional groceries with a long calendar title' }).household;
household = addPotentialExpense(household, { date: '2026-09-08', title: 'Fictional future purchase', amount: '60', accountId: 'ACC-CHEQUING', subcategoryId: 'SUB-LIFE-FUN', createdBy: 'MEM-001', visibility: 'household' }).household;
const noop = () => {};
function Proof(){const [confirm,setConfirm]=useState(false);return h('main', { className: 'app', 'data-ledger-tab': 'calendar', style: { margin: '0 auto', padding: 8, maxWidth: 1100 } },
 h(CalendarPage, { household, today: '2026-09-08', environment: 'development', memberId: 'MEM-001', view, busy: false, onCommand: noop, onAskPost: noop, onAskPostDue: noop, onAskSaveRepeating: noop, onAskVisit: noop, onAskSettle: noop, onAskWriteOff: noop, onAskStartJar: noop, onOpenPlan: noop, onOpenShiftEnvelope: noop, onAskQuickPotential:()=>setConfirm(true), onReviewPotential:noop }),
 h('nav',{className:'nav','aria-label':'Hearth'},h('button',null,'Home'),h('button',null,'Cal')),
 confirm?h(PotentialExpenseConfirmSheet,{plan:household.potentialExpenses[0],household,busy:false,onCancel:()=>setConfirm(false),onConfirm:noop}):null);
}
createRoot(document.getElementById('root')).render(h(Proof));
`;
const server = await createServer({ configFile: false, cacheDir, server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'calendar-proof',
  resolveId(id) { if (id === '/calendar-proof.js') return '\0calendar-proof'; },
  load(id) { if (id === '\0calendar-proof') return entry; },
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url?.split('?')[0] !== '/calendar-proof') return next();
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml('/calendar-proof', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/calendar-proof.js"></script></body></html>'));
    });
  },
}] });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // This proof never reads or writes a hosted service.
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  let cases = 0;
  for (const width of [320, 390, 720, 1100, 1440]) for (const theme of ['classic', 'taylor', 'newfoundland']) for (const view of ['household', 'personal']) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${server.resolvedUrls.local[0]}calendar-proof?theme=${theme}&view=${view}`);
    await page.locator('.cal-day').first().waitFor();
    const geometry = await page.evaluate(() => {
      const grid = document.querySelector('.cal-grid'), upcoming = document.querySelector('.calendar-upcoming'), google = document.querySelector('.calendar-integration');
      const cells = [...grid.children].slice(0, 7).map(node => node.getBoundingClientRect());
      return { columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, sameRow: cells.every(cell => Math.abs(cell.top - cells[0].top) < 1), overflow: document.documentElement.scrollWidth > innerWidth, upcomingBelow: upcoming.getBoundingClientRect().top >= grid.getBoundingClientRect().bottom, googleBelow: google.getBoundingClientRect().top >= upcoming.getBoundingClientRect().bottom, selected: document.querySelector('[aria-pressed="true"]').getAttribute('data-calendar-date') };
    });
    assert.deepEqual(geometry, { columns: 7, sameRow: true, overflow: false, upcomingBelow: true, googleBelow: true, selected: '2026-09-08' }, `${theme}/${view}/${width}`);
    await page.locator('[data-calendar-date="2026-09-22"]').click();
    await page.getByRole('tab', { name: 'Month', exact: true }).click();
    assert.equal(await page.locator('.weight-day time').getAttribute('datetime'), '2026-09-22');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Month overflow: ${theme}/${view}/${width}`);
    await page.getByRole('tab', { name: 'Month', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('tab', { name: 'Calendar', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
    cases++;
  }
  for(const width of [320,390])for(const theme of ['classic','taylor','newfoundland']){
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${server.resolvedUrls.local[0]}calendar-proof?theme=${theme}&view=household`);
    await page.locator('[data-calendar-date="2026-09-08"]').click();
    const cellAdd=page.locator('[data-calendar-date="2026-09-08"] + .cal-add');
    assert.equal(await cellAdd.isVisible(),true,`${theme}/${width}: first mobile tap reveals Add`);
    await cellAdd.click();
    const save=page.locator('.potential-expense-sheet .primary');await save.scrollIntoViewIfNeeded();
    const saveBox=await save.boundingBox(),navBox=await page.locator('.nav').boundingBox();
    assert.ok(saveBox&&navBox&&saveBox.y+saveBox.height<=navBox.y,`${theme}/${width}: Save plan stays above mobile navigation`);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.locator('.calendar-selected-day').getByRole('button',{name:'Quick Confirm',exact:true}).click();
    const finalConfirm=page.getByRole('button',{name:/^Final Confirm/});await finalConfirm.scrollIntoViewIfNeeded();
    const confirmBox=await finalConfirm.boundingBox();
    assert.ok(confirmBox&&navBox&&confirmBox.y+confirmBox.height<=navBox.y,`${theme}/${width}: Final Confirm stays above mobile navigation`);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${cases} Chromium theme/scope/width cases; seven columns, no overflow, retained Month selection, mobile two-tap Add, and Save/Final Confirm above navigation. Local synthetic data only.`);
} finally { await browser?.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
