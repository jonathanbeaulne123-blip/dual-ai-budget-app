/** The journey's simple view (D-284) on the real JourneyMini component, fictional books only.
    `node scripts/serve-journey-mini-proof.mjs` prints the URL.
    `node scripts/serve-journey-mini-proof.mjs --capture` writes the browser evidence to docs/evidence/journey-simple-view/mini/
    (OUT=<dir>, WIDTHS=320,390,720,1100, THEMES=classic,taylor,newfoundland to narrow a run). The Our Story household is
    generated once into scripts/tmp/our-story.json (git-ignored) when it is not there yet.
    Query: ?story=story|plan-life  ?theme=classic|taylor|newfoundland  ?level=day|week|month|era|journey  ?date=YYYY-MM-DD
           ?quality=full|lite  ?motion=reduced|full  ?compact=1  ?member=MEM-001  ?cached=1 (reads scripts/tmp/our-story.json)  ?today=
    The page shows the simple view; "Open the world" opens a stand-in full-screen world (the integrator mounts OurPathWorld there)
    with the compact minimap in its corner, so both ends of the shared focus can be seen. Nothing is stored. */
import { createServer } from 'vite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const css = [...readFileSync('src/main.tsx', 'utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([, path]) => `import '/src/${path}';`).join('\n');
const entry = `${css}
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JourneyMini } from '/src/path/mini/JourneyMini.tsx';
import { useJourneyFocus, JOURNEY_LEVEL_LABEL } from '/src/path/journeyFocus.ts';
import { generateDemoSuiteOffThread } from '/src/demoSuiteOffThread.ts';
import { resolveThemeScene, sceneTokens } from '/src/theme/scenes.ts';
const q = new URLSearchParams(location.search);
const theme = q.get('theme') || 'classic', story = q.get('story') || 'story', motion = q.get('motion') || 'full';
const today = q.get('today') || (story === 'story' ? '2026-09-16' : '2026-09-15');
const scene = resolveThemeScene(theme, 'plan', 'household');
Object.assign(document.documentElement.dataset, { theme, scene: scene.id, material: scene.material, sceneLighting: scene.dark ? 'dark' : 'light', atmosphere: 'paused', motion });
for (const [key, value] of Object.entries(sceneTokens(scene))) document.documentElement.style.setProperty(key, value);
document.body.style.margin = '0';
document.body.style.background = 'var(--paper)';
window.__opened = [];
let liveMini = null;
window.__mini = () => liveMini;
async function load() {
  if (story === 'plan-life') {
    const { planLifeFixture } = await import('/test/fixtures/plan-life.ts');
    const { openChapter } = await import('/src/core/index.ts');
    const { saveTask } = await import('/src/core/tasks.ts');
    let h = planLifeFixture('household');
    h = openChapter(h, { memberId: 'MEM-001', foundationId: 'make-rent-boring', at: '2026-07-01T12:00:00.000Z' }).household;
    const task = (patch) => ({ visibility: 'household', title: '', notes: '', listId: null, parentId: null, doDate: null, dueDate: null, repeat: 'none', cue: 'none', assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch });
    h = saveTask(h, { memberId: 'MEM-001', id: 'TASK-PROOF-VET', expectedRevision: 0, task: task({ title: 'Fictional: book the vet', assigneeId: 'MEM-002', dueDate: '2026-09-17' }) }).household;
    h = saveTask(h, { memberId: 'MEM-002', id: 'TASK-PROOF-SECRET', expectedRevision: 0, task: task({ visibility: 'personal', title: 'Fictional: a surprise only Sam sees', dueDate: '2026-09-16' }) }).household;
    return h;
  }
  if (q.get('cached') === '1') return fetch('/scripts/tmp/our-story.json').then((r) => r.json());
  const { household } = await generateDemoSuiteOffThread({ today, profile: 'habitat-story', seed: Number(q.get('seed') || 41), buildSha: 'proof' });
  return household;
}
function FocusReadout({ api }) {
  const f = api.focus;
  window.__focus = f;
  return React.createElement('p', { className: 'proof-focus', style: { margin: '10px 0 0', fontSize: 12, color: 'var(--muted)' } },
    'Shared focus (fictional proof): ', JOURNEY_LEVEL_LABEL[f.level], ' · ', f.date, ' · ', f.selected ?? 'nothing picked', ' · from ', f.source);
}
function Proof() {
  const [household, setHousehold] = useState(null);
  const [world, setWorld] = useState(q.get('world') === '1');
  const focus = useJourneyFocus(today, q.get('level') || 'week');
  useEffect(() => { load().then((h) => { setHousehold(h); window.__ready = true; }); }, []);
  useEffect(() => { if (q.get('date')) focus.set({ date: q.get('date') }, 'page'); }, []);
  useEffect(() => {
    if (!world) return;
    const onKey = (e) => { if (e.key === 'Escape') setWorld(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [world]);
  if (!household) return React.createElement('p', { style: { padding: 16 } }, 'Growing fictional books…');
  const member = q.get('member') || 'MEM-001';
  const quality = q.get('quality') === 'lite' ? 'lite' : 'full';
  const compact = q.get('compact') === '1';
  const common = { household, memberId: member, today, focus, theme, quality, onOpenWorld: () => { window.__opened.push('world'); setWorld(true); }, onOpenFund: () => window.__opened.push('fund'), proofWorld: (w) => { liveMini = w; } };
  return React.createElement('main', { className: 'app', style: { maxWidth: 1100, margin: '0 auto', padding: compact ? 16 : '14px 12px 24px', boxSizing: 'border-box' } },
    compact
      ? React.createElement('div', { style: { width: q.get('size') ? Number(q.get('size')) : 200 } }, React.createElement(JourneyMini, { ...common, compact: true }))
      : React.createElement(React.Fragment, null,
          React.createElement('p', { style: { margin: '0 0 10px', fontSize: 17, fontFamily: 'var(--theme-display, Georgia)' } }, 'Our Path · fictional ', story === 'story' ? 'Our Story' : 'plan-life', ' household'),
          React.createElement(JourneyMini, common),
          React.createElement(FocusReadout, { api: focus })),
    world && React.createElement('div', { role: 'dialog', 'aria-label': 'Open world (stand-in)', style: { position: 'fixed', inset: 0, zIndex: 50, background: 'linear-gradient(#cfd9c0, #8fa36c)', display: 'grid', placeItems: 'center' } },
      React.createElement('div', { style: { textAlign: 'center', fontFamily: 'var(--theme-display, Georgia)', color: '#1b1712' } },
        React.createElement('p', { style: { fontSize: 28, margin: 0 } }, 'Open world (OurPathWorld mounts here)'),
        React.createElement('p', { style: { margin: '6px 0 14px' } }, 'Focus: ', JOURNEY_LEVEL_LABEL[focus.focus.level], ' · ', focus.focus.date, ' · ', focus.focus.selected ?? '—'),
        React.createElement('button', { type: 'button', onClick: () => setWorld(false), style: { minHeight: 44, padding: '0 18px', borderRadius: 999 } }, 'Back to the app')),
      React.createElement('div', { style: { position: 'absolute', right: 16, bottom: 16, width: 'min(220px, 44vw)' } }, React.createElement(JourneyMini, { ...common, compact: true, proofWorld: undefined }))));
}
window.__ready = false;
createRoot(document.getElementById('root')).render(React.createElement(Proof));`;

export async function startJourneyMiniProof({ port = 5196 } = {}) {
  const cacheDir = mkdtempSync(join(tmpdir(), 'hearth-mini-'));
  const server = await createServer({
    configFile: false, cacheDir, logLevel: 'warn', server: { host: '127.0.0.1', port, strictPort: true },
    plugins: [{
      name: 'mini-proof',
      resolveId(id) { if (id === '/mini-proof.js') return '\0mini-proof'; },
      load(id) { if (id === '\0mini-proof') return entry; },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.method === 'POST') { res.statusCode = 503; res.end('{}'); return; }
          if (req.url?.split('?')[0] !== '/mini-proof') return next();
          res.setHeader('Content-Type', 'text/html');
          res.end(await vite.transformIndexHtml('/mini-proof', '<!doctype html><html lang="en"><head><title>Fictional journey simple view proof</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/mini-proof.js"></script></body></html>'));
        });
      },
    }],
  });
  await server.listen();
  return { url: `http://127.0.0.1:${server.httpServer.address().port}/mini-proof`, async close() { await server.close(); rmSync(cacheDir, { recursive: true, force: true }); } };
}
async function capture() {
  const { existsSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { chromium } = await import('@playwright/test');
  if (!existsSync('scripts/tmp/our-story.json')) {
    const { generateDemoSuite } = await (await import('vite')).createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true } }).then(async (vite) => { const mod = await vite.ssrLoadModule('/src/core/demoSuite.ts'); await vite.close(); return mod; });
    const { household } = await generateDemoSuite({ today: '2026-09-16', seed: 41, profile: 'habitat-story', numberStyle: 'realistic', buildSha: 'proof' });
    mkdirSync('scripts/tmp', { recursive: true });
    writeFileSync('scripts/tmp/our-story.json', JSON.stringify(household));
  }
  const out = process.env.OUT || 'docs/evidence/journey-simple-view/mini';
  mkdirSync(out, { recursive: true });
  const WIDTHS = (process.env.WIDTHS || '320,390,720,1100').split(',').map(Number);
  const THEMES = (process.env.THEMES || 'classic,taylor,newfoundland').split(',');
  const LEVELS = ['day', 'week', 'month', 'era', 'journey'];
  const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const proof = await startJourneyMiniProof({ port: Number(process.env.PORT || 5397) });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const benign = (text) => /GPU stall|swiftshader|WebGL|Failed to load resource/i.test(text);
  const noWebgl = () => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; };
  const PARTS = (process.env.PARTS || 'grid,extras').split(',');
  const { readFileSync: read } = await import('node:fs');
  // Runs can be split (PARTS=grid THEMES=taylor …); the report merges into what earlier runs wrote.
  const report = existsSync(`${out}/report.json`) ? JSON.parse(read(`${out}/report.json`, 'utf8')) : { generated: 'fictional Our Story and plan-life households only', shots: {} };
  async function open(width, query, { webgl = true, reducedMotion = 'no-preference', height } = {}) {
    const context = await browser.newContext({ viewport: { width, height: height ?? (width < 720 ? 844 : 900) }, deviceScaleFactor: 1, reducedMotion });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errors.push(m.text().slice(0, 200)); });
    if (!webgl) await page.addInitScript(noWebgl);
    await page.goto(`${proof.url}?cached=1&${query}`);
    await page.waitForFunction(() => window.__ready && document.querySelector('.journey-mini') && !document.querySelector('.journey-mini__loading'), null, { timeout: 180_000 });
    await wait(1800);
    return { page, errors, close: () => context.close() };
  }
  async function level(page, name, ms = 2600) {
    await page.locator('.journey-mini__levels button', { hasText: new RegExp(`^${name}$`, 'i') }).first().click();
    await wait(ms);
  }
  async function facts(page, errors) {
    return page.evaluate((errs) => {
      const mini = document.querySelector('.journey-mini');
      const small = [...mini.querySelectorAll('button, input')].filter((el) => el.offsetParent !== null && !el.closest('.journey-mini--compact')).map((el) => { const r = el.getBoundingClientRect(); return { name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((b) => b.h < 44 && b.name && !/Move through time/.test(b.name));
      return {
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        cardHeight: Math.round(mini.getBoundingClientRect().height),
        flat: mini.dataset.flat,
        heading: mini.querySelector('h2')?.textContent ?? null,
        sub: mini.querySelector('.journey-mini__sub')?.textContent ?? null,
        labels: [...mini.querySelectorAll('.journey-mini__label')].filter((b) => !b.hidden).map((b) => b.textContent),
        controlsUnder44: small,
        errors: errs.slice(0, 3),
      };
    }, errors);
  }
  const save = async (page, errors, file, target = '.journey-mini') => {
    await page.locator(target).first().screenshot({ path: `${out}/${file}.png` });
    report.shots[file] = await facts(page, errors);
    process.stdout.write(`${file} `);
  };
  // Every width × theme × level.
  if (PARTS.includes('grid')) for (const theme of THEMES) for (const width of WIDTHS) {
    const { page, errors, close } = await open(width, `theme=${theme}&level=day`);
    for (const lv of LEVELS) { await level(page, lv); await save(page, errors, `${width}-${theme}-${lv}`); }
    await close();
  }
  if (!PARTS.includes('extras')) { writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1)); await browser.close(); await proof.close(); return; }
  // A contribution day (the Queen splits into the three lanes) and its week.
  for (const width of [390, 1100]) {
    const { page, errors, close } = await open(width, 'theme=classic&level=day&date=2026-09-02');
    await save(page, errors, `${width}-classic-day-contributions`);
    await level(page, 'week');
    await save(page, errors, `${width}-classic-week-contributions`);
    await close();
  }
  // The morph between levels, caught halfway (straight → curling → lap → islands).
  {
    const { page, errors, close } = await open(1100, 'theme=classic&level=day');
    for (const z of [0.5, 1.5, 2.5, 3.5]) {
      await page.evaluate((v) => window.__mini().setView({ z: v }, true), z);
      await wait(900);
      await save(page, errors, `1100-classic-morph-z${String(z).replace('.', '_')}`, '.journey-mini__stage');
    }
    await close();
  }
  // Card, list and keyboard focus.
  for (const width of [390, 1100]) {
    const { page, errors, close } = await open(width, 'theme=taylor&level=day');
    await page.locator('.journey-mini__label[data-place="today"]').click();
    await wait(600);
    await save(page, errors, `${width}-taylor-card-today`);
    await page.keyboard.press('Escape');
    await level(page, 'era');
    const bank = page.locator('.journey-mini__label[data-place="finish"]');
    if (await bank.isVisible()) { await bank.click(); await wait(600); await save(page, errors, `${width}-taylor-card-finish-line`); await page.keyboard.press('Escape'); }
    await page.getByRole('button', { name: 'List' }).click();
    await wait(500);
    await save(page, errors, `${width}-taylor-list-era`);
    await level(page, 'month', 800);
    await save(page, errors, `${width}-taylor-list-month`);
    await page.getByRole('button', { name: 'Map' }).click();
    await level(page, 'day');
    await page.locator('.journey-mini__stage').focus();
    await page.keyboard.press('Tab');
    await wait(300);
    await save(page, errors, `${width}-taylor-keyboard-focus`);
    await close();
  }
  // Reduced motion: level changes are cuts (the renderer lands on the level at once).
  {
    const { page, errors, close } = await open(390, 'theme=newfoundland&level=day&motion=reduced', { reducedMotion: 'reduce' });
    const cuts = [];
    for (const lv of ['week', 'month', 'era', 'journey']) {
      await page.locator('.journey-mini__levels button', { hasText: new RegExp(`^${lv}$`, 'i') }).click();
      await wait(120);
      cuts.push(await page.evaluate(() => window.__mini().view()));
    }
    await save(page, errors, '390-newfoundland-reduced-motion-journey');
    report.reducedMotionCuts = cuts.map((v) => ({ z: v.z, target: v.zTarget, cut: v.z === v.zTarget }));
    await close();
  }
  // Lite (the world's quality setting) and no WebGL at all.
  for (const [width, theme] of [[390, 'classic'], [1100, 'newfoundland']]) {
    const { page, errors, close } = await open(width, `theme=${theme}&level=day&quality=lite`);
    for (const lv of LEVELS) { await level(page, lv, 500); await save(page, errors, `${width}-${theme}-lite-${lv}`); }
    await close();
  }
  {
    const { page, errors, close } = await open(320, 'theme=taylor&level=week', { webgl: false });
    await save(page, errors, '320-taylor-no-webgl-week');
    await close();
  }
  // Compact: the corner minimap in game mode (stand-in world), and on its own in each theme.
  for (const [width, lv] of [[390, 'week'], [1100, 'era']]) {
    const { page, errors, close } = await open(width, `theme=classic&level=${lv}&world=1`);
    await page.screenshot({ path: `${out}/${width}-classic-compact-in-world-${lv}.png` });
    report.shots[`${width}-classic-compact-in-world-${lv}`] = { errors: errors.slice(0, 3), overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1) };
    await close();
  }
  for (const theme of THEMES) {
    const { page, errors, close } = await open(390, `theme=${theme}&level=month&compact=1&size=220`);
    await save(page, errors, `compact-${theme}-month`);
    await level(page, 'Day', 2200);
    await save(page, errors, `compact-${theme}-day`);
    await close();
  }
  // The plan-life fixture (a small household without a journey).
  for (const lv of ['day', 'era']) {
    const { page, errors, close } = await open(1100, `story=plan-life&theme=classic&level=${lv}`);
    await save(page, errors, `1100-classic-plan-life-${lv}`);
    await close();
  }
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
  await browser.close();
  await proof.close();
  console.log(`\nwrote ${Object.keys(report.shots).length} captures to ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--capture')) await capture();
  else {
    const proof = await startJourneyMiniProof({ port: Number(process.env.PORT || 5196) });
    console.log(`Journey simple view proof: ${proof.url}`);
    process.once('SIGINT', async () => { await proof.close(); process.exit(0); });
  }
}
