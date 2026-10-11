/** Journey map before / after captures for a Horizon PR (AGENTS.md, Jonathan 2026-10-05: a big structural Horizon change is
    reflected on the Journey map, re-baked, and its Journey map captures are attached to the PR).

    The same renderer (this tree's `src/journey`) draws two baked Journey lands side by side, so the only difference in a pair
    is the land: BEFORE is `public/horizon/world/<revision>.journey.json.gz` at BEFORE_REF (git), AFTER is this tree's file.
    - `board`: the real JourneyBoard (Month, the Horizon Clock) on the fictional Development demo kitchen
      (`seedDemoHousehold({ today: "2026-09-28" })`, viewed by MEM-002, as scripts/serve-journey-map-proof.mjs), loaded through
      its `loadLand` seam; one capture per theme × tier, before and after composed into one JPEG.
    - `land`: the clay land alone (`buildJourneyLand` + `createClayLights`, the board's camera: fov 30, looking north from the
      south at ELEVATION degrees) framed on a concept-metre point; before | after in one page, one JPEG per area × theme × tier.

    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/horizon/capture-journey-land-diff.mjs \
      [BEFORE_REF=origin/main] [OUT=docs/horizon/evidence/<pr>/journey] [THEMES=classic,taylor,newfoundland] [TIERS=full,lite] \
      [BOARD=1] [AREAS='[{"id":"highlands","at":[1080,460],"span":520,"themes":["classic"]}]']
    Headless Chromium with SwiftShader: not device evidence. Nothing is stored; no household data is read. */
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REVISION = readFileSync('src/worldGeography.ts', 'utf8').match(/HORIZON_GEOGRAPHY\s*=\s*["'`]([^"'`]+)/)?.[1] ?? 'horizon-geo-1';
const FILE = `public/horizon/world/${REVISION}.journey.json.gz`;
const BEFORE_REF = process.env.BEFORE_REF ?? 'origin/main';
const OUT = process.env.OUT ?? 'docs/horizon/evidence/journey-land';
const THEMES = (process.env.THEMES ?? 'classic,taylor,newfoundland').split(',');
const TIERS = (process.env.TIERS ?? 'full,lite').split(',');
const AREAS = JSON.parse(process.env.AREAS ?? '[]');
const ELEVATION = Number(process.env.ELEVATION ?? 50);
const QUALITY = Number(process.env.JPEG_QUALITY ?? 80);
const lands = { before: execFileSync('git', ['show', `${BEFORE_REF}:${FILE}`], { maxBuffer: 1 << 26 }), after: readFileSync(FILE) };
const beforeSha = execFileSync('git', ['rev-parse', '--short', BEFORE_REF]).toString().trim();
const beforeName = beforeSha.startsWith(BEFORE_REF) ? beforeSha : `${BEFORE_REF} (${beforeSha})`;
const afterSha = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
const css = [...readFileSync('src/main.tsx', 'utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([, path]) => `import '/src/${path}';`).join('\n');

const entry = `${css}
import * as THREE from 'three';
import React from 'react';
import { createRoot } from 'react-dom/client';
import JourneyBoard from '/src/journey/ui/JourneyBoard.tsx';
import { buildJourneyLand, createClayLights } from '/src/journey/land/index.ts';
import { parseJourneyLandSlim } from '/src/journey/land/slim.ts';
import { boardPalette } from '/src/journey/board/palette.ts';
import { JOURNEY_DIORAMA } from '/src/journey/contracts.ts';
import { seedDemoHousehold } from '/src/core/seed.ts';
import { resolveThemeScene, sceneTokens } from '/src/theme/scenes.ts';
const q = new URLSearchParams(location.search), theme = q.get('theme') || 'classic', tier = q.get('tier') || 'full';
const scene = resolveThemeScene(theme, 'plan', 'household');
Object.assign(document.documentElement.dataset, { theme, scene: scene.id, material: scene.material, sceneLighting: scene.dark ? 'dark' : 'light', atmosphere: 'paused', motion: 'reduced' });
for (const [key, value] of Object.entries(sceneTokens(scene))) document.documentElement.style.setProperty(key, value);
document.body.style.margin = '0'; document.body.style.background = 'var(--paper)';
window.__ready = false;
const land = (which) => fetch('/__journey-land/' + which).then((r) => r.arrayBuffer()).then((b) => parseJourneyLandSlim(b));
if (q.get('mode') === 'board') {
  const memory = new Map(), seeded = JSON.stringify({ version: 2, level: 'month', focusDate: null, selectedStopId: null, listMode: 'map', lastEnter: null });
  const storage = { get length() { return memory.size; }, key: (i) => [...memory.keys()][i] ?? null, clear: () => memory.clear(),
    getItem: (k) => memory.get(k) ?? (k.includes(':v2:') ? seeded : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };
  const noop = () => {}, actions = new Proxy({}, { get: (_t, name) => (name === 'enterHorizon' ? () => true : noop) });
  createRoot(document.getElementById('root')).render(React.createElement(JourneyBoard, {
    household: seedDemoHousehold({ today: '2026-09-28', environment: 'development' }), memberId: 'MEM-002', environment: 'development', today: '2026-09-28',
    theme, actions, storage, dueReview: null, onChooseTheme: noop, quality: tier, loadLand: () => land(q.get('land')), onReady: () => { window.__ready = true; },
  }));
} else {
  const at = q.get('at').split(',').map(Number), span = Number(q.get('span')), elevation = Number(q.get('elevation')) * Math.PI / 180;
  const root = document.getElementById('root');
  root.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px;background:#222;font:600 15px system-ui,sans-serif;color:#fff';
  const stats = {};
  for (const which of ['before', 'after']) {
    const data = await land(which), cell = document.createElement('div'), label = document.createElement('div');
    label.textContent = (which === 'before' ? 'Before · ' : 'After · ') + q.get(which + 'Label');
    label.style.cssText = 'padding:4px 6px';
    const w = Math.floor((innerWidth - 18) / 2), h = innerHeight - 40;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(w, h); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = tier === 'full'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const sceneGraph = new THREE.Scene(); sceneGraph.background = new THREE.Color(boardPalette(theme).water);
    const built = buildJourneyLand(data, { theme, tier, homes: [] }), lights = createClayLights(theme, tier);
    sceneGraph.add(built.group, lights.group);
    const frame = built.frame, x = (at[0] - frame.centre[0]) * frame.scale, z = (at[1] - frame.centre[1]) * frame.scale, y = built.dioramaGroundAt(at[0], at[1]);
    const camera = new THREE.PerspectiveCamera(JOURNEY_DIORAMA.fovDeg, w / h, 0.01, 200), dist = (span * frame.scale / 2) / Math.tan(JOURNEY_DIORAMA.fovDeg * Math.PI / 360);
    camera.position.set(x, y + dist * Math.sin(elevation), z + dist * Math.cos(elevation)); camera.lookAt(x, y, z);
    renderer.render(sceneGraph, camera);
    stats[which] = built.stats ? built.stats() : null;
    cell.append(label, renderer.domElement); root.append(cell);
  }
  window.__stats = stats; window.__ready = true;
}`;

const cacheDir = mkdtempSync(join(tmpdir(), 'hearth-jland-'));
const server = await createServer({
  configFile: false, cacheDir, logLevel: 'warn',
  // Pre-bundle from the board and the land only (the default scan walks every evidence harness's HTML in the tree).
  optimizeDeps: { entries: ['src/journey/ui/JourneyBoard.tsx', 'src/journey/land/index.ts', 'src/core/seed.ts'] },
  server: { host: '127.0.0.1', port: 5231, strictPort: true },
  plugins: [{
    name: 'journey-land-diff',
    resolveId(id) { if (id === '/journey-land-diff.js') return '\0journey-land-diff'; },
    load(id) { if (id === '\0journey-land-diff') return entry; },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        if (path.startsWith('/__journey-land/')) { const which = path.slice(16); res.setHeader('Content-Type', 'application/octet-stream'); res.end(lands[which]); return; }
        if (path !== '/journey-land-diff') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml(path, '<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Journey land diff</title></head><body><div id="root"></div><script type="module" src="/journey-land-diff.js"></script></body></html>'));
      });
    },
  }],
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/journey-land-diff`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true, executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  // The App's fonts come from Google Fonts through the agent proxy when there is one (as serve-journey-map-proof.mjs).
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const records = [], errors = [];
const shoot = async (url, viewport, file, settle = 400) => {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push({ file, error: e.message }));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240_000 });
  await page.waitForTimeout(settle);
  const stats = await page.evaluate(() => window.__stats ?? null);
  await page.screenshot({ path: file, type: 'jpeg', quality: QUALITY });
  await page.close();
  return stats;
};
try {
  if (process.env.BOARD !== '0') for (const tier of TIERS) for (const theme of THEMES) {
    const parts = [];
    for (const which of ['before', 'after']) {
      const file = join(cacheDir, `board-${theme}-${tier}-${which}.jpg`);
      await shoot(`${base}?mode=board&theme=${theme}&tier=${tier}&land=${which}`, { width: 1100, height: 800 }, file, 2500);
      parts.push(file);
    }
    const file = join(OUT, `board-${theme}-${tier}.jpg`);
    // Before | after, labelled, one JPEG (ImageMagick).
    execFileSync('convert', [
      '(', parts[0], '-gravity', 'North', '-background', '#222', '-fill', 'white', '-pointsize', '22', '-splice', '0x34', '-annotate', '+0+5', `Before · ${beforeName}`, ')',
      '(', parts[1], '-gravity', 'North', '-background', '#222', '-fill', 'white', '-pointsize', '22', '-splice', '0x34', '-annotate', '+0+5', `After · this branch (${afterSha})`, ')',
      '+append', '-resize', '1800x', '-quality', String(QUALITY), file]);
    records.push({ file, mode: 'board', theme, tier }); console.log(file);
  }
  for (const area of AREAS) for (const tier of area.tiers ?? TIERS) for (const theme of area.themes ?? THEMES) {
    const file = join(OUT, `${area.id}-${theme}-${tier}.jpg`);
    const url = `${base}?mode=land&theme=${theme}&tier=${tier}&at=${area.at.join(',')}&span=${area.span}&elevation=${area.elevation ?? ELEVATION}`
      + `&beforeLabel=${encodeURIComponent(beforeName)}&afterLabel=${encodeURIComponent(`this branch (${afterSha})`)}`;
    const stats = await shoot(url, { width: 1600, height: 640 }, file);
    records.push({ file, mode: 'land', area, theme, tier, stats }); console.log(file);
  }
} catch (e) { errors.push({ fatal: true, error: e.message }); }
finally {
  writeFileSync(join(OUT, 'captures.json'), JSON.stringify({ method: 'Journey map renderer of this tree on two baked Journey lands; headless Chromium SwiftShader, not device evidence', before: { ref: BEFORE_REF, sha: beforeSha }, after: { sha: afterSha, worktree: 'HEAD + uncommitted' }, records, errors }, null, 2) + '\n');
  await browser.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true });
  if (errors.length) { console.error(errors); process.exitCode = 1; }
}
