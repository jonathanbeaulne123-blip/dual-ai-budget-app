/** The journey's simple view (D-284) on the real JourneyMini component, fictional books only.
    `node scripts/serve-journey-mini-proof.mjs` prints the URL.
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const proof = await startJourneyMiniProof({ port: Number(process.env.PORT || 5196) });
  console.log(`Journey simple view proof: ${proof.url}`);
  process.once('SIGINT', async () => { await proof.close(); process.exit(0); });
}
