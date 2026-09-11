/** Local production-component proof with fictional Plan data; no hosted requests. */
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/plan-studio');
mkdirSync(output, { recursive: true });
const cacheDir = mkdtempSync(join(tmpdir(), 'hearth-plan-vite-'));
const css = [...readFileSync('src/main.tsx', 'utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([, path]) => `import '/src/${path}';`).join('\n');
const entry = `${css}
import {createElement as h,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PlanStudio} from '/src/PlanStudio.tsx';
import {catalogHousehold,savePlanDraft,proposeHouseholdPlan,lockPersonalPlan} from '/src/core/index.ts';
import {resolveThemeScene,sceneTokens} from '/src/theme/scenes.ts';
const q=new URLSearchParams(location.search),theme=q.get('theme')||'classic',view=q.get('view')||'household',memberId='MEM-001';
const scene=resolveThemeScene(theme,'plan',view);Object.assign(document.documentElement.dataset,{theme,scene:scene.id,material:scene.material,sceneLighting:scene.dark?'dark':'light',atmosphere:'paused'});
for(const[key,value]of Object.entries(sceneTokens(scene)))document.documentElement.style.setProperty(key,value);
let initial=catalogHousehold();
const line={id:'PLAN-LINE-RENT',lens:'protect',kind:'obligation',labelSnapshot:'Fictional monthly rent',amountCents:180000,cadence:'monthly',dueDate:'2026-09-01',responsibility:{kind:view==='household'?'joint':'member',...(view==='personal'?{memberId}:{})},assumptionIds:[],createdBy:memberId};
initial=savePlanDraft(initial,{id:'PLAN-DRAFT-PROOF',scope:view,memberId,targetMonth:'2026-09',lines:[line],assumptions:[],note:'Fictional local proof',createdBy:memberId}).household;
initial=view==='household'?proposeHouseholdPlan(initial,{memberId,draftId:'PLAN-DRAFT-PROOF',reason:'Fictional September agreement',createdBy:memberId}).household:lockPersonalPlan(initial,{memberId,draftId:'PLAN-DRAFT-PROOF',reason:'Fictional September plan',createdBy:memberId}).household;
function Proof(){const[state,setState]=useState(initial),ref=useRef(state);ref.current=state;const onCommand=async fn=>{const result=fn(ref.current);ref.current=result.household;setState(result.household);return result;};return h('div',{className:'app','data-ledger-tab':'plan'},h(PlanStudio,{household:state,view,memberId,today:'2026-09-11',busy:false,onCommand}));}
createRoot(document.getElementById('root')).render(h(Proof));`;
const server = await createServer({ configFile: false, cacheDir, server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'plan-studio-proof', resolveId(id) { if (id === '/plan-studio-proof.js') return '\0plan-studio-proof'; }, load(id) { if (id === '\0plan-studio-proof') return entry; },
  configureServer(vite) { vite.middlewares.use(async (req, res, next) => { if (req.url?.split('?')[0] !== '/plan-studio-proof') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml('/plan-studio-proof', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/plan-studio-proof.js"></script></body></html>')); }); },
}] });

let browser; const records = [], errors = [];
try {
  await server.listen(); browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ reducedMotion: 'reduce' }); const page = await context.newPage();
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [390, 1440]) for (const theme of ['classic', 'taylor', 'newfoundland']) for (const view of ['personal', 'household']) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto(server.resolvedUrls.local[0] + 'plan-studio-proof?theme=' + theme + '&view=' + view);
    await page.getByRole('main', { name: new RegExp(view, 'i') }).waitFor();
    const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, lenses: document.querySelectorAll('.plan-lens-card').length, rail: !!document.querySelector('.plan-studio__rail'), hercules: !!document.querySelector('.plan-hercules-launch'), minButton: Math.min(...[...document.querySelectorAll('.plan-studio button')].filter(node => getComputedStyle(node).display !== 'none').map(node => node.getBoundingClientRect().height)) }));
    assert.ok(geometry.scrollWidth <= geometry.width + 1, JSON.stringify({ width, theme, view, geometry })); assert.equal(geometry.lenses, 4); assert.equal(geometry.rail, true); assert.equal(geometry.hercules, true); assert.ok(geometry.minButton >= 43.5, JSON.stringify({ width, theme, view, minButton: geometry.minButton }));
    await page.getByRole('button', { name: 'Protect', exact: false }).first().click(); assert.equal(await page.getByRole('heading', { name: /Keep the promises/ }).isVisible(), true);
    await page.getByRole('button', { name: 'Reflection', exact: true }).click(); assert.equal(await page.getByRole('heading', { name: view === 'personal' ? /What happened/ : /Lock or acknowledge/ }).isVisible(), true);
    await page.getByLabel('One fact I may share').fill('Fictional reviewed contribution'); await page.getByLabel('Amount, if useful').fill('25'); await page.getByRole('button', { name: 'Save privately and review' }).click(); assert.equal(await page.getByText('Exact disclosure review').isVisible(), true);
    const editorGeometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth })); assert.ok(editorGeometry.scrollWidth <= editorGeometry.width + 1, JSON.stringify({ width, theme, view, editorGeometry }));
    await page.getByRole('button', { name: /Ask Hercules/ }).click(); await page.getByLabel('Ask about this Plan').fill('Why did our runway change?'); await page.getByRole('button', { name: 'Ask from visible evidence' }).click(); assert.match(await page.locator('.plan-hercules__answer').innerText(), /projection|cash|Plan/i);
    await page.getByRole('button', { name: 'Close Hercules' }).click(); await page.keyboard.press('Tab');
    const focusVisible = await page.evaluate(() => { const node = document.activeElement, style = node && getComputedStyle(node); return node !== document.body && style?.outlineStyle !== 'none' && Number.parseFloat(style?.outlineWidth || '0') > 0; }); assert.equal(focusVisible, true);
    const axe = await new AxeBuilder({ page }).include('.plan-studio').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); assert.deepEqual(axe.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], JSON.stringify({ theme, view, width }));
    if (width === 390 || width === 1440) await page.screenshot({ path: join(output, theme + '-' + view + '-' + width + '.png'), fullPage: true });
    records.push({ width, theme, view, ...geometry, axeViolations: 0, focusVisible });
  }
  assert.deepEqual(errors, []); console.log('PASS: 12 PlanStudio theme/ledger/device cases; no horizontal overflow, four lenses, 44px controls, Hercules context, keyboard focus and WCAG 2.1 AA automated checks.');
} finally { writeFileSync(join(output, 'report.json'), JSON.stringify({ records, errors }, null, 2)); await browser?.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
