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
import { catalogHousehold } from '/src/core/index.ts';
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
window.__pathWorldReplay = (edit) => { if (liveWorld && lastScene) liveWorld.setScene(edit(lastScene[0]), lastScene[1], false); };
const proofWorld = { onWorld: (w) => { liveWorld = w; if (w) { const set = w.setScene; w.setScene = (...args) => { lastScene = args; return set(...args); }; } },idleMs: idle === 'off' ? Infinity : undefined, paused: motion !== 'full' };
const scene = resolveThemeScene(theme, 'plan', 'household');
Object.assign(document.documentElement.dataset, { theme, scene: scene.id, material: scene.material, sceneLighting: scene.dark ? 'dark' : 'light', atmosphere: 'paused', motion });
for (const [key, value] of Object.entries(sceneTokens(scene))) document.documentElement.style.setProperty(key, value);
const today = '2026-09-15';
function Proof() {
  const [state, setState] = useState(null);
  const [member, setMember] = useState('MEM-001');
  const ref = useRef(null);
  useEffect(() => {
    if (story === 'empty') { const h = catalogHousehold(); ref.current = h; setState(h); return; }
    generateDemoSuite({ today, profile: story === 'hard' ? 'habitat-hard' : 'habitat-well', seed: 4242, buildSha: 'proof' }).then(({ household }) => { ref.current = household; setState(household); window.__ready = true; });
  }, []);
  if (!state) return React.createElement('p', { className: 'app' }, 'Growing fictional books…');
  const command = async (fn) => { const result = fn(ref.current); ref.current = result.household; setState(result.household); return { ...result, ok: true, kind: 'synchronized' }; };
  return React.createElement('div', { className: 'app', 'data-ledger-tab': 'plan', style: { padding: '12px' } },
    React.createElement('p', { style: { margin: '0 0 8px', fontSize: 12 } }, 'Fictional local proof — ', theme, ' / ', story, ' · acting as ', member, ' ',
      React.createElement('button', { id: 'switch-member', onClick: () => setMember(member === 'MEM-001' ? 'MEM-002' : 'MEM-001') }, 'Switch fictional member')),
    React.createElement(OurPathWorld, { household: state, memberId: member, today, busy: false, onCommand: command, theme, proofWorld,
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
