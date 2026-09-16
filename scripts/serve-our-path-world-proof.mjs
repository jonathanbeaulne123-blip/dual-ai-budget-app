/** Our Path world (D-262) on the real component with fictional habitat books only. */
import { createServer } from 'vite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const css = [...readFileSync('src/main.tsx', 'utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([, path]) => `import '/src/${path}';`).join('\n');
const entry = `${css}
import React, { useRef, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { OurPathWorld } from '/src/path/OurPathWorld.tsx';
import { generateDemoSuite } from '/src/core/demoSuite.ts';
import { generateDemoSuiteOffThread } from '/src/demoSuiteOffThread.ts';
import { catalogHousehold, setHouseholdFundMonthPlan, savePlanBridgeDraft, sharePlanBridgeDraft } from '/src/core/index.ts';
import { saveTask } from '/src/core/tasks.ts';
import { resolveThemeScene, sceneTokens } from '/src/theme/scenes.ts';
import { agreePathProposal, pendingPathProposals, shapePathWorld } from '/src/core/pathWorld.ts';
import { crossPathEra, currentPathEra, pathEras, proposePathEra, proposePathEraPlan } from '/src/core/pathEras.ts';
// Proof only: the world handle, for camera moves in captures.
window.__pathWorld = () => liveWorld;
const q = new URLSearchParams(location.search);
const theme = q.get('theme') || 'taylor', story = q.get('story') || 'well', motion = q.get('motion') || 'reduced', lantern = q.get('lantern');
if (lantern) localStorage.setItem('hearth:pathWorld:lantern', lantern);
const quality = q.get('quality'), idle = q.get('idle');
if (quality === 'full' || quality === 'lite') localStorage.setItem('hearth:pathWorld:quality', quality);
// Proof only: frame counters for the performance note, and ?idle=off to measure the loop without the idle pause.
let liveWorld = null;
window.__pathWorldStats = () => (liveWorld ? liveWorld.stats() : null);
// Proof only: window.__pathWorldReplay(edit) re-sends the last scene through edit (e.g. a fictional step change, to watch coins fly).
let lastScene = null;
// Proof only: turn the camera around the current target (radians), to frame the road ahead.
window.__pathWorldTurn = (delta) => liveWorld?.turn(delta);
window.__pathWorldReplay = (edit) => { if (liveWorld && lastScene) liveWorld.setScene(edit(lastScene[0]), lastScene[1], false); };
// Proof only (?eras=demo): a fictional Journey of Life laid on the fictional household THROUGH THE REAL COMMANDS
// (proposePathEra, agreePathProposal, crossPathEra, proposePathEraPlan), so the page wiring is what is proven.
// Two past eras (crossed Feb and Jun 2026), the current era (survive 8 months → lanterns from the books; ?gate=open for an
// agree finish line), two future eras (one with a plan Jonathan pencilled in), and one era only Jonathan has suggested.
// ?crossing=1 has Bianca suggest crossing (with ?gate=open). In memory only; nothing is stored.
const erasDemo = q.get('eras') === 'demo';
function withFictionalJourney(h) {
  const at = '2026-02-01T12:00:00.000Z';
  const bank = (name) => h.goals.find((g) => g.name === name && g.shared)?.id;
  const spec = (over) => ({ finishLine: '', by: null, finish: { kind: 'agree' }, plans: [], ...over });
  const agreeAll = (x) => {
    for (const row of pendingPathProposals(x)) {
      if (row.kind !== 'era') continue;
      for (const memberId of ['MEM-001', 'MEM-002']) {
        const fresh = shapePathWorld(x.pathWorld).find((r) => r.id === row.id);
        if (fresh.pending && !fresh.agreedByMemberIds.includes(memberId)) x = agreePathProposal(x, { memberId, rowId: fresh.id, revision: fresh.pendingRevision, at }).household;
      }
    }
    return x;
  };
  const plan = (id, kind, label, extra = {}) => ({ id, kind, label, goalId: null, month: null, ...extra });
  try {
    const open = q.get('gate') === 'open';
    h = proposePathEra(h, { memberId: 'MEM-001', at, spec: spec({ order: 1, name: 'Fictional first flat', finishLine: 'Get the keys and unpack every box', from: '2025-10', by: '2026-01', home: 'flat', plans: [plan('PLAN-KEYS', 'milestone', 'Keys to the flat', { month: '2025-10' })] }) }).household;
    h = proposePathEra(h, { memberId: 'MEM-001', at, spec: spec({ order: 2, name: 'Fictional furnished flat', finishLine: 'A sofa we chose together', from: '2026-02', by: '2026-05', home: 'furnished', plans: [plan('PLAN-MTL', 'bank', 'A weekend away', { goalId: bank('Weekend in Montréal') }), plan('PLAN-TRIP', 'trip', 'The spring trip')] }) }).household;
    h = proposePathEra(h, { memberId: 'MEM-002', at, spec: spec({ order: 3, name: 'Fictional steady year', finishLine: 'Survive eight months without going broke', from: '2026-06', by: '2027-01', home: 'furnished', finish: open ? { kind: 'agree' } : { kind: 'survive', months: 8 }, plans: [plan('PLAN-SHORE', 'bank', 'The shore trip', { goalId: bank('A trip to the shore') })] }) }).household;
    h = proposePathEra(h, { memberId: 'MEM-001', at, spec: spec({ order: 4, name: 'Fictional first house', finishLine: 'Our own front door', from: '2027-02', by: '2029-12', home: 'house', plans: [plan('PLAN-KITCHEN', 'bank', 'A kitchen of our own', { goalId: bank('Kitchen renovation') }), plan('PLAN-MOVE', 'milestone', 'Moving day', { month: '2027-06' }), plan('PLAN-ROAD', 'trip', 'A road trip east'), plan('PLAN-CH', 'chapter', 'A calm first winter'), plan('PLAN-NOTE', 'note', 'Room for a garden')] }) }).household;
    h = proposePathEra(h, { memberId: 'MEM-002', at, spec: spec({ order: 5, name: 'Fictional porch years', from: '2030-01', home: 'porch', plans: [plan('PLAN-PORCH', 'note', 'Evenings on the porch')] }) }).household;
    h = agreeAll(h);
    h = crossPathEra(h, { memberId: 'MEM-001', rowId: currentPathEra(h, '2026-02-10').id, today: '2026-02-10', at }).household;
    h = agreeAll(h);
    h = crossPathEra(h, { memberId: 'MEM-002', rowId: currentPathEra(h, '2026-06-10').id, today: '2026-06-10', at }).household;
    h = agreeAll(h);
    const house = pathEras(h, today).find((e) => e.spec.name === 'Fictional first house');
    h = proposePathEraPlan(h, { memberId: 'MEM-002', rowId: house.id, plan: plan('PLAN-DOG', 'milestone', 'A dog, maybe'), at }).household;
    h = proposePathEra(h, { memberId: 'MEM-002', at, spec: spec({ order: 6, name: 'Fictional cabin idea', from: '2034-01', home: 'cabin', plans: [plan('PLAN-LAKE', 'trip', 'A first night by the lake')] }) }).household;
    if (q.get('crossing') === '1') h = crossPathEra(h, { memberId: 'MEM-001', rowId: currentPathEra(h, today).id, today, at }).household;
  } catch (error) { console.warn('proof journey skipped', error); }
  return h;
}
const proofWorld = { onWorld: (w) => { liveWorld = w; if (w) { const set = w.setScene; w.setScene = (...args) => { lastScene = args; return set(...args); }; } }, idleMs: idle === 'off' ? Infinity : undefined, paused: q.get('ambient') === 'off' || motion !== 'full' };
const scene = resolveThemeScene(theme, 'plan', 'household');
Object.assign(document.documentElement.dataset, { theme, scene: scene.id, material: scene.material, sceneLighting: scene.dark ? 'dark' : 'light', atmosphere: 'paused', motion });
for (const [key, value] of Object.entries(sceneTokens(scene))) document.documentElement.style.setProperty(key, value);
const today = '2026-09-15';
const present = Number(q.get('present') || '1');
function withFictionalTogether(h) {
  const at = '2026-09-03T15:00:00.000Z';
  const line = (id, label, nextStep, responsibility) => ({ id, lens: 'build', kind: 'goal-contribution', labelSnapshot: label, amountCents: 0, cadence: 'monthly', responsibility, assumptionIds: [], createdBy: 'MEM-001', decision: { funding: 'available', nextStep } });
  const version = { id: 'PLAN-VERSION-PROOF', scope: 'household', monthKey: '2026-09', sequence: 99, lines: [
    line('PROOF-LINE-1', 'Fictional winter tires', 'Book the tire swap before the first frost.', { kind: 'joint' }),
    line('PROOF-LINE-2', 'Fictional weekend away', 'Pick two dates that fit both schedules.', { kind: 'member', memberId: 'MEM-002' }),
    line('PROOF-LINE-3', 'Fictional pantry reset', 'Clear the pantry and list what we actually use.', { kind: 'member', memberId: 'MEM-001' }),
  ], assumptions: [], reason: 'Fictional proof agreement', digest: 'proof', state: 'active', createdBy: 'MEM-001', createdAt: at, activatedAt: at };
  const sitdown = { id: 'PLAN-SITDOWN-PROOF', sitDownSessionId: 'SITDOWN-PROOF', monthKey: '2026-09', planDraftId: 'PLAN-2026-09', state: 'active', startedBy: 'MEM-001', participantMemberIds: ['MEM-001'], turns: [], createdAt: at, updatedAt: at };
  return withFictionalStones({ ...h, planVersions: [...(h.planVersions ?? []), version], planHerculesSessions: [...(h.planHerculesSessions ?? []), sitdown] });
}
// Proof only (?story=well): the habitat has Calendar bills and paydays but no household tasks, so add three fictional stepping stones in memory.
function withFictionalStones(h) {
  const task = (patch) => ({ visibility: 'household', title: '', notes: '', listId: null, parentId: null, doDate: null, dueDate: null, repeat: 'none', cue: 'none', assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch });
  const rows = [
    ['TASK-PROOF-FERRY', { title: 'Fictional: book the ferry', assigneeId: 'MEM-001', backupId: 'MEM-002', dueDate: '2026-09-20' }],
    ['TASK-PROOF-HYDRO', { title: 'Fictional: pay the hydro bill', assigneeId: 'MEM-002', dueDate: '2026-09-22', expectedAmountCents: 9000 }],
    ['TASK-PROOF-FERN', { title: 'Fictional: water the fern', assigneeId: 'MEM-002', dueDate: '2026-09-10' }],
  ];
  try { for (const [id, patch] of rows) h = saveTask(h, { memberId: 'MEM-001', id, expectedRevision: 0, task: task(patch) }).household; } catch (error) { console.warn('proof stones skipped', error); }
  return withFictionalFootpaths(h, task);
}
// Proof only (?story=well): one fictional private task for MEM-001 (a footpath only MEM-001 sees), MEM-001's private Bridge draft (stage 1),
// and one offer MEM-002 shared with Our Home (stage 2, both see it). In memory only.
function withFictionalFootpaths(h, task) {
  try {
    h = saveTask(h, { memberId: 'MEM-001', id: 'TASK-PROOF-PRIVATE', expectedRevision: 0, task: task({ visibility: 'personal', title: 'Fictional: plan a quiet birthday surprise', dueDate: '2026-09-25' }) }).household;
    h = savePlanBridgeDraft(h, { monthKey: '2026-09', kind: 'responsibility', label: 'Fictional: I can take the car to the garage', memberId: 'MEM-001', createdBy: 'MEM-001' }).household;
    h = savePlanBridgeDraft(h, { monthKey: '2026-09', kind: 'contribution', label: 'Fictional: I can cover the ferry tickets', amountCents: 12000, memberId: 'MEM-002', createdBy: 'MEM-002' }).household;
    const offered = h.planBridgeDrafts.find((row) => row.ownerMemberId === 'MEM-002');
    h = sharePlanBridgeDraft(h, { draftId: offered.id, memberId: 'MEM-002', createdBy: 'MEM-002' }).household;
  } catch (error) { console.warn('proof footpaths skipped', error); }
  return h;
}
// Proof only (?mist=1): a fictional cushion far above the Fund so the forecast turns misty, in memory.
function withFictionalMist(h) {
  try { return setHouseholdFundMonthPlan(h, { memberId: h.householdFund?.custodianMemberId ?? 'MEM-001', monthKey: '2026-09', target: '0', buffer: '99999' }).household; } catch (error) { console.warn('proof mist skipped', error); return h; }
}
// Proof only (?photos=1): two fictional kept Memories and two drawn board photos, served by an in-memory media client.
function withFictionalPhotos(h) {
  const members = h.members.filter((m) => m.active).map((m) => m.id);
  const win = (id, title, shownAt) => ({ version: 1, id, chapterId: null, level: 'first', title, evidenceRefs: [], shownAt, fadedAt: null, keptByMemberIds: members, authoredNote: 'Fictional: kept by both of us.', hideAmounts: true, updatedAt: shownAt });
  const photo = (slot, mediaId, caption) => ({ id: 'BOARD-PHOTO-' + slot, version: 1, createdBy: 'MEM-001', createdAt: '2026-08-0' + slot + 'T12:00:00.000Z', updatedAt: '2026-08-0' + slot + 'T12:00:00.000Z', mediaId, caption, crop: { x: 50, y: 50, zoom: 1 } });
  return { ...h, wins: [...(h.wins ?? []), win('W-PROOF-SHORE', 'Shore day', '2026-08-10T12:00:00.000Z'), win('W-PROOF-GARDEN', 'First tomatoes', '2026-09-02T12:00:00.000Z')],
    kitchen: { ...h.kitchen, boards: { tasks: [], milestones: [], ...(h.kitchen?.boards ?? {}), photos: [photo(1, 'proof-garden', 'Fictional garden'), photo(2, 'proof-shore', 'Our fictional shore day')] } } };
}
const proofMedia = { async getBoardPhoto(mediaId) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  const shore = mediaId === 'proof-shore';
  const sky = g.createLinearGradient(0, 0, 0, 256); sky.addColorStop(0, shore ? '#8fd0e8' : '#f6d7a8'); sky.addColorStop(1, shore ? '#e9f5f2' : '#fbeee0');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#ffcf5a'; g.beginPath(); g.arc(186, 70, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = shore ? '#3f93a8' : '#6f9a5c'; g.fillRect(0, 150, 256, 106);
  g.fillStyle = shore ? '#efdcaa' : '#c9483c'; if (shore) g.fillRect(0, 205, 256, 51); else for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(40 + i * 44, 190, 14, 0, Math.PI * 2); g.fill(); }
  return await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
} };
function Proof() {
  const [state, setState] = useState(null);
  const [member, setMember] = useState('MEM-001');
  const ref = useRef(null);
  useEffect(() => {
    if (story === 'empty') { const h = catalogHousehold(); ref.current = h; setState(h); return; }
    // ?story=story: the Our Story habitat (D-268), generated in the Demo Suite worker exactly as the App does; ?today= overrides the date.
    // Dev server only: load the world module before the long generation, so Vite's dependency optimiser is not still busy when it is needed.
    void import('/src/path/world/pathWorld3d.ts');
    const started = Date.now();
    (story === 'story' && q.get('cached') === '1' ? fetch('/scripts/tmp/our-story.json').then((r) => r.json()).then((h) => new Promise((res) => setTimeout(() => res(h), Number(q.get('delay') || 0)))).then((household) => ({ household })) : story === 'story' ? generateDemoSuiteOffThread({ today: q.get('today') || '2026-09-16', profile: 'habitat-story', seed: Number(q.get('seed') || 41), buildSha: 'proof' }) : generateDemoSuite({ today, profile: story === 'hard' ? 'habitat-hard' : 'habitat-well', seed: 4242, buildSha: 'proof' })).then(({ household }) => {
      window.__generatedMs = Date.now() - started;
      if (q.get('roundtrip') === '1') household = JSON.parse(JSON.stringify(household));
      // Proof only (?story=well): the habitat has a Charter but no accepted decisions or Shared Sitdown, so add fictional ones in memory.
      if (story === 'well') household = withFictionalTogether(household);
      if (q.get('mist') === '1') household = withFictionalMist(household);
      if (q.get('photos') === '1') household = withFictionalPhotos(household);
      if (erasDemo) household = withFictionalJourney(household);
      ref.current = household; setState(household); window.__household = household; window.__ready = true;
    });
  }, []);
  if (!state) return React.createElement('p', { className: 'app' }, 'Growing fictional books…');
  const command = async (fn) => { const result = fn(ref.current); ref.current = result.household; setState(result.household); return { ...result, ok: true, kind: 'synchronized' }; };
  const body = [
    React.createElement('p', { style: { margin: '0 0 8px', fontSize: 12 } }, 'Fictional local proof — ', theme, ' / ', story, ' · acting as ', member, ' ',
      React.createElement('button', { id: 'switch-member', onClick: () => setMember(member === 'MEM-001' ? 'MEM-002' : 'MEM-001') }, 'Switch fictional member')),
    React.createElement(OurPathWorld, { household: state, memberId: member, today: story === 'story' ? (q.get('today') || '2026-09-16') : today, busy: false, onCommand: command, theme, proofWorld, presentMembers: present,
      onOpenTogether: () => { window.__opened = 'together'; }, onOpenCharter: () => { window.__opened = 'charter'; }, onOpenFund: () => { window.__opened = 'fund'; }, onOpenCalendar: () => { window.__opened = 'calendar'; }, onOpenPlanner: () => { window.__opened = 'planner'; }, onOpenInTent: (source) => { window.__opened = source; },
      onOpenPlay: q.get('play') === '0' ? undefined : () => { window.__opened = 'play'; }, onOpenTimeMachine: (monthKey) => { window.__opened = 'timeMachine:' + monthKey; },
      boardMedia: q.get('photos') === '1' ? proofMedia : null,
      renderMini: q.get('mini') === 'stub' ? (args) => React.createElement(StubMini, args) : q.get('mini') === 'none' ? null : undefined,
      classicRoom: React.createElement('div', { id: 'classic-room' }, React.createElement('h2', null, "Today's Our Path"), React.createElement('p', null, 'Chapter room and Plan Studio render here in the app.')) })];
  // ?chrome=1 (D-285): the App's own header and bottom nav around the page (real classes, real CSS), to prove game mode hides them.
  if (q.get('chrome') !== '1') return React.createElement('div', { className: 'app', 'data-ledger-tab': 'plan', style: { padding: '12px' } }, ...body);
  const nav = ['Home', 'Calendar', 'Fund', 'Our Path', 'More'].map((label) => React.createElement('button', { key: label, className: label === 'Our Path' ? 'active' : '', 'aria-current': label === 'Our Path' ? 'page' : undefined }, label));
  return React.createElement('div', { className: 'app', 'data-ledger-tab': 'plan' },
    React.createElement('div', { className: 'app-shell' },
      React.createElement('header', { className: 'topbar' }, React.createElement('div', { className: 'brand' }, React.createElement('div', null, React.createElement('h1', null, 'Hearth'), React.createElement('p', { className: 'brand__identity' }, 'Fictional member · Fictional household'))), React.createElement('button', { type: 'button', className: 'pill dev' }, 'Development')),
      React.createElement('div', { 'data-app-page': 'true' }, React.createElement('div', { className: 'world-page', style: { padding: '12px' } }, ...body)),
      React.createElement('nav', { className: 'nav', 'aria-label': 'Hearth' }, ...nav)));
}
// ?mini=stub (D-285 proof only): a stand-in for the simple view that shows the shared focus and moves it as "mini".
function StubMini({ focus: api, compact, onOpenWorld, worldOpen }) {
  const f = api.focus;
  const b = (label, change) => React.createElement('button', { type: 'button', key: label, onClick: () => api.set(change, 'mini'), style: { minHeight: 44 } }, label);
  return React.createElement('div', { className: 'stub-mini', 'data-compact': compact || undefined, style: { display: 'grid', gap: 6, padding: compact ? 8 : 16, height: '100%', boxSizing: 'border-box', background: 'var(--card)', border: compact ? 0 : '1px dashed var(--line)', borderRadius: 18, fontSize: compact ? 11 : 14, alignContent: 'start' } },
    React.createElement('strong', null, compact ? 'Mini (compact stand-in)' : 'Simple view stand-in (D-284 mounts here)'),
    React.createElement('code', { 'data-focus': '' }, [f.level, f.date, f.selected || '—', f.source + '#' + f.seq].join(' · ') + (worldOpen ? ' · world open' : '')),
    compact ? null : React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
      b('Day', { level: 'day' }), b('Week', { level: 'week' }), b('Month', { level: 'month' }), b('Era', { level: 'era', selected: null }), b('Journey', { level: 'journey', selected: null }),
      b('June', { level: 'month', date: '2026-06-10', selected: null }), b('A bill', { level: 'day', date: '2026-09-22', selected: 'bill:proof@2026-09-22' }),
      React.createElement('button', { type: 'button', key: 'open', className: 'primary', onClick: onOpenWorld, style: { minHeight: 44 } }, 'Open the world')));
}
window.__ready = story === 'empty';
createRoot(document.getElementById('root')).render(React.createElement(Proof));`;
export async function startOurPathWorldProof({ port = 5193 } = {}) {
  const cacheDir = mkdtempSync(join(tmpdir(), 'hearth-path-'));
  const server = await createServer({ configFile: false, cacheDir, logLevel: 'warn', server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{ name: 'path-proof', resolveId(id) { if (id === '/path-proof.js') return '\0path-proof'; }, load(id) { if (id === '\0path-proof') return entry; }, configureServer(vite) { vite.middlewares.use(async (req, res, next) => { if (req.method === 'POST') { res.statusCode = 503; res.end('{}'); return; } if (req.url?.split('?')[0] !== '/path-proof') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml('/path-proof', '<!doctype html><html><head><title>Fictional Our Path world proof</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/path-proof.js"></script></body></html>')); }); } }] });
  await server.listen();
  return { url: `http://127.0.0.1:${server.httpServer.address().port}/path-proof`, async close() { await server.close(); rmSync(cacheDir, { recursive: true, force: true }); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const proof = await startOurPathWorldProof(); console.log(`Our Path world proof: ${proof.url}`); process.once('SIGINT', async () => { await proof.close(); process.exit(0); }); }
