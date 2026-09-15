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
import { catalogHousehold, setHouseholdFundMonthPlan, savePlanBridgeDraft, sharePlanBridgeDraft } from '/src/core/index.ts';
import { saveTask } from '/src/core/tasks.ts';
import { resolveThemeScene, sceneTokens } from '/src/theme/scenes.ts';
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
const proofWorld = { onWorld: (w) => { liveWorld = w; if (w) { const set = w.setScene; w.setScene = (...args) => { lastScene = args; return set(...args); }; } },idleMs: idle === 'off' ? Infinity : undefined, paused: motion !== 'full' };
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
    generateDemoSuite({ today, profile: story === 'hard' ? 'habitat-hard' : 'habitat-well', seed: 4242, buildSha: 'proof' }).then(({ household }) => {
      // Proof only (?story=well): the habitat has a Charter but no accepted decisions or Shared Sitdown, so add fictional ones in memory.
      if (story === 'well') household = withFictionalTogether(household);
      if (q.get('mist') === '1') household = withFictionalMist(household);
      if (q.get('photos') === '1') household = withFictionalPhotos(household);
      ref.current = household; setState(household); window.__ready = true;
    });
  }, []);
  if (!state) return React.createElement('p', { className: 'app' }, 'Growing fictional books…');
  const command = async (fn) => { const result = fn(ref.current); ref.current = result.household; setState(result.household); return { ...result, ok: true, kind: 'synchronized' }; };
  return React.createElement('div', { className: 'app', 'data-ledger-tab': 'plan', style: { padding: '12px' } },
    React.createElement('p', { style: { margin: '0 0 8px', fontSize: 12 } }, 'Fictional local proof — ', theme, ' / ', story, ' · acting as ', member, ' ',
      React.createElement('button', { id: 'switch-member', onClick: () => setMember(member === 'MEM-001' ? 'MEM-002' : 'MEM-001') }, 'Switch fictional member')),
    React.createElement(OurPathWorld, { household: state, memberId: member, today, busy: false, onCommand: command, theme, proofWorld, presentMembers: present,
      onOpenTogether: () => { window.__opened = 'together'; }, onOpenCharter: () => { window.__opened = 'charter'; }, onOpenFund: () => { window.__opened = 'fund'; }, onOpenCalendar: () => { window.__opened = 'calendar'; }, onOpenPlanner: () => { window.__opened = 'planner'; }, onOpenInTent: (source) => { window.__opened = source; },
      onOpenPlay: q.get('play') === '0' ? undefined : () => { window.__opened = 'play'; }, onOpenTimeMachine: (monthKey) => { window.__opened = 'timeMachine:' + monthKey; },
      boardMedia: q.get('photos') === '1' ? proofMedia : null,
      classicRoom: React.createElement('div', { id: 'classic-room' }, React.createElement('h2', null, "Today's Our Path"), React.createElement('p', null, 'Chapter room and Plan Studio render here in the app.')) }));
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
