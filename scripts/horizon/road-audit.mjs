#!/usr/bin/env node
/**
 * Horizon road audit — a driver's-eye, read-only audit of the committed bake with the REAL cruiser sim.
 *
 *   node scripts/horizon/road-audit.mjs [--root <repo>] [--out <dir>] [--station 2] [--beds V01,VG] [--no-drive] [--no-static]
 *
 * Loads the baked world exactly as test/horizonRideSituations.test.ts does (parseHorizonDefinition on the .json.gz monolith,
 * decodeTerrainAsset 'full', createHorizonGeography with the solids and diagnostics, plus the Mountain v2 region's dynamic
 * provider), then for every road bed:
 *  1. drives the cruiser with `stepCruiser` at CRUISER.dt in both directions, on the centreline and keeping right at +2 m,
 *     with a pure-pursuit driver (lookahead 6–8 m) and a curvature/braking speed plan (no position snapping, no assist);
 *  2. probes the corridor statically at `--station` m stations (width, drops and guards, buried/floating deck, headroom,
 *     kerbs, scenery in the carriageway, lips along five lateral lines, junction/pad lips, bridge/tunnel transitions);
 *  3. writes audit.json and AUDIT.md under --out (default docs/horizon/evidence/road/audit-<--title, default before>).
 * Nothing under src/ or public/ is written; audit query helpers live in this file and native-road-guards.mjs.
 */
import {build} from 'esbuild';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import {nativeRoadGuardOwnership} from './native-road-guards.mjs';
import {nativeStationMap, kinematics, localPlanStation} from './mountain-audit-telemetry.mjs';

const T0 = Date.now();
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
const flag = name => argv.includes(name);
const HERE = dirname(fileURLToPath(import.meta.url)), OWN_REPO = resolve(HERE, '../..');
const ROOT = resolve(arg('--root', process.cwd()));
const NATURAL_DOWNHILL = flag('--natural-downhill'), SCENARIO = NATURAL_DOWNHILL ? 'natural-downhill' : 'paced';
const OUT = resolve(ROOT, arg('--out', `docs/horizon/evidence/road/audit-${arg('--title', 'before')}${NATURAL_DOWNHILL ? '-natural-downhill' : ''}`)); // default follows --title, so an 'after' run never overwrites the before evidence
// Reject cross-scenario overwrite even when an explicit --out points at existing evidence.
if (existsSync(resolve(OUT, 'audit.json'))) {
  const previous = JSON.parse(readFileSync(resolve(OUT, 'audit.json'), 'utf8'));
  if ((previous.meta?.scenario?.id ?? 'paced') !== SCENARIO) throw new Error('Use a separate --out for paced and natural-downhill evidence');
}
const STATION = Number(arg('--station', '2'));
const ONLY = arg('--beds', null)?.split(',');
const DRIVE = !flag('--no-drive'), STATIC = !flag('--no-static');
// The shared baked Prow-to-Summit chain, including its variable-width native section.
const MOUNTAIN_CHAIN = flag('--mountain-chain');
/** --trace V01:fwd:2:3580:3605 prints every step of that pass inside that station window (debugging a finding). */
const TRACE = arg('--trace', null)?.split(':');
/** --probe-line x0,z0,x1,z1,y prints the physical surface every 0.1 m along a line and exits (debugging a lip). */
const PROBE = arg('--probe-line', null)?.split(',').map(Number);
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);

// ─── Load the real modules and the committed bake ────────────────────────────────────────────────────────────────────
const bundle = await build({
  stdin: {contents: [
    `export {SPANS, structureStretches} from './src/harbour/horizon/land/structures/build.ts';`,
    `export {parseHorizonDefinition} from './src/house/world/horizonAssets.ts';`,
    `export {decodeTerrainAsset} from './src/harbour/horizon/land/terrain/asset.ts';`,
    `export {sampleTerrain, terrainTriangleVisible} from './src/harbour/horizon/land/terrain/index.ts';`,
    `export {createHorizonGeography} from './src/harbour/horizon/runtime/geography.ts';`,
    `export {createMountainV2Region, terraceBedExclusion, mouthExclusion} from './src/harbour/horizon/regions/mountainV2/index.ts';`,
    `export {stepCruiser, createCruiserState, validCruiserPosition, cruiserSpeed} from './src/harbour/horizon/movers/cruiser/sim.ts';`,
    `export {CRUISER} from './src/harbour/horizon/movers/cruiser/tuning.ts';`,
    `export {mountainPlanting, crownOf} from './src/harbour/mountain/planting.ts';`,
    `export {MOUNTAIN_V2_OFFSET} from './src/harbour/horizon/regions/mountainV2/placement.ts';`,
    `export {mountainRoadChain} from './src/harbour/horizon/land/corridor/chain.ts';`,
    `export {GORGE_BRIDGES, EDGE_SOLIDS, EDGE_RUNS, MOUNTAIN_ROAD_LINE} from './src/harbour/mountain/roads.ts';`,
  ].join('\n'), resolveDir: ROOT, loader: 'ts'},
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error',
  nodePaths: [resolve(ROOT, 'node_modules'), resolve(OWN_REPO, 'node_modules')],
  loader: {'.png': 'empty', '.jpg': 'empty', '.svg': 'empty', '.css': 'empty', '.glb': 'empty', '.wav': 'empty', '.mp3': 'empty'},
});
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {CRUISER: C} = api;
const WORLD_PATH = resolve(ROOT, 'public/horizon/world/horizon-geo-1.json.gz'), TERRAIN_PATH = resolve(ROOT, 'public/horizon/terrain/horizon-geo-1.bin');
const baselineRef = arg('--baseline-ref', null);
const assetBytes = path => baselineRef ? execFileSync('git', ['-C', ROOT, 'show', `${baselineRef}:${relative(ROOT, path)}`], {maxBuffer: 64 * 1024 * 1024}) : readFileSync(path);
const worldBytes = assetBytes(WORLD_PATH), terrainBytes = assetBytes(TERRAIN_PATH);
const ab = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const world = api.parseHorizonDefinition(ab(worldBytes));
const field = api.decodeTerrainAsset(ab(terrainBytes), 'full');
const g = api.createHorizonGeography(field, {...world.collision, solids: world.geometry.solids, diagnostics: world.diagnostics ?? []});
const region = api.createMountainV2Region({walkingJoinSolids:world.geometry.solids,horizonGround: (x, z) => api.sampleTerrain(field, x, z), yield: api.terraceBedExclusion(world.collision.beds), exclude: api.mouthExclusion(world.collision.mouths), terrainStep: field.step});
g.addDynamic(region.provider);
const sha = b => createHash('sha256').update(b).digest('hex');
let rootSha = 'unknown'; try { rootSha = execFileSync('git', ['-C', ROOT, 'rev-parse', baselineRef ?? 'HEAD']).toString().trim(); } catch { /* not a checkout */ }
log('loaded', ROOT, rootSha.slice(0, 10));

// ─── Read-only helpers over the baked solids (a second index, never written back) ────────────────────────────────────
const SOLIDS = world.geometry.solids.filter(s => s.role !== 'marker');
const solidById = new Map(world.geometry.solids.map(s => [s.id, s]));
const CELL = 8, cellKey = (ix, iz) => ix * 4096 + iz;
const triCount = SOLIDS.reduce((n, s) => n + s.indices.length / 3, 0);
const TV = new Float64Array(triCount * 9), TS = new Int32Array(triCount), TN = new Float32Array(triCount * 3), TB = new Float32Array(triCount * 2);
const grid = new Map();
{ let t = 0;
  SOLIDS.forEach((s, si) => { const p = s.positions;
    for (let i = 0; i < s.indices.length; i += 3) {
      for (let k = 0; k < 3; k++) { const j = s.indices[i + k] * 3; TV[t * 9 + k * 3] = p[j]; TV[t * 9 + k * 3 + 1] = p[j + 1]; TV[t * 9 + k * 3 + 2] = p[j + 2]; }
      const o = t * 9, ux = TV[o + 3] - TV[o], uy = TV[o + 4] - TV[o + 1], uz = TV[o + 5] - TV[o + 2], vx = TV[o + 6] - TV[o], vy = TV[o + 7] - TV[o + 1], vz = TV[o + 8] - TV[o + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz); if (l < 1e-9) continue;
      TN[t * 3] = nx / l; TN[t * 3 + 1] = ny / l; TN[t * 3 + 2] = nz / l; TS[t] = si;
      TB[t * 2] = Math.min(TV[o + 1], TV[o + 4], TV[o + 7]); TB[t * 2 + 1] = Math.max(TV[o + 1], TV[o + 4], TV[o + 7]);
      const x0 = Math.floor(Math.min(TV[o], TV[o + 3], TV[o + 6]) / CELL), x1 = Math.floor(Math.max(TV[o], TV[o + 3], TV[o + 6]) / CELL);
      const z0 = Math.floor(Math.min(TV[o + 2], TV[o + 5], TV[o + 8]) / CELL), z1 = Math.floor(Math.max(TV[o + 2], TV[o + 5], TV[o + 8]) / CELL);
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const k = cellKey(ix, iz); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(t); }
      t++;
    }
  });
}
function trisNear(x, z, r) {
  const out = new Set();
  for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++) for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) for (const t of grid.get(cellKey(ix, iz)) ?? []) out.add(t);
  return out;
}
/** Same test as runtime/geography.ts touchesAtHeight: the face's section at height y passes within r of (x, z). */
function touches(t, y, x, z, r) {
  let n = 0, ax = 0, az = 0, bx = 0, bz = 0; const o = t * 9;
  for (let i = 0; i < 3; i++) {
    const a = o + i * 3, b = o + ((i + 1) % 3) * 3, ya = TV[a + 1], yb = TV[b + 1];
    if ((y - ya) * (y - yb) > 0 || Math.abs(yb - ya) < 1e-8) continue;
    const f = (y - ya) / (yb - ya), px = TV[a] + f * (TV[b] - TV[a]), pz = TV[a + 2] + f * (TV[b + 2] - TV[a + 2]);
    if (n++ === 0) { ax = px; az = pz; } else { bx = px; bz = pz; break; }
  }
  if (n < 2) return false;
  const dx = bx - ax, dz = bz - az, d = dx * dx + dz * dz, f = d ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / d)) : 0;
  return Math.hypot(x - ax - f * dx, z - az - f * dz) < r;
}
/** Every static solid whose non-horizontal faces cross any of `levels` within r of (x, z): Map solid → lowest level hit. */
function solidsAt(x, z, levels, r, keep = () => true) {
  const hits = new Map();
  for (const t of trisNear(x, z, r)) {
    if (Math.abs(TN[t * 3 + 1]) > .95) continue; const si = TS[t]; if (hits.has(si) || !keep(SOLIDS[si])) continue;
    for (const y of levels) { if (y < TB[t * 2] || y > TB[t * 2 + 1]) continue; if (touches(t, y, x, z, r)) { hits.set(si, y); break; } }
  }
  return hits;
}
function project(t, x, z) {
  const o = t * 9, ax = TV[o], ay = TV[o + 1], az = TV[o + 2], bx = TV[o + 3], by = TV[o + 4], bz = TV[o + 5], cx = TV[o + 6], cy = TV[o + 7], cz = TV[o + 8];
  const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(det) < 1e-8) return null;
  const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
  return u >= -1e-6 && v >= -1e-6 && u + v <= 1.000001 ? u * ay + v * by + (1 - u - v) * cy : null;
}
/** Static faces projecting over (x, z): upward (floors) and downward (ceilings) with their solids. */
function column(x, z) {
  const out = [];
  for (const t of grid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []) {
    const ny = TN[t * 3 + 1]; if (Math.abs(ny) < .001) continue; const y = project(t, x, z); if (y === null) continue;
    out.push({y, up: ny > 0, solid: SOLIDS[TS[t]]});
  }
  return out.sort((a, b) => a.y - b.y);
}
/** The solid that answers geography.ceiling (static only; a dynamic ceiling is named 'mountainV2'). */
function ceilingId(x, z, y, value) {
  if (!Number.isFinite(value)) return null;
  const hit = column(x, z).find(c => !c.up && Math.abs(c.y - value) < .02);
  return hit ? hit.solid.id : 'mountainV2 (dynamic)';
}
const describe = id => {
  if (!id) return null; if (id.startsWith('mountainV2:')) return {id, kind: 'mountainV2', role: 'dynamic'};
  const s = solidById.get(id); return s ? {id, kind: s.kind, role: s.role} : {id, kind: id, role: 'sim'};
};
const r3 = v => Math.round(v * 1000) / 1000, r2 = v => Math.round(v * 100) / 100, r1 = v => Math.round(v * 10) / 10;
const P3 = (x, y, z) => [r2(x), r2(y), r2(z)];
function inPoly(poly, x, z) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
const districtAt = (x, z) => world.districts.find(d => inPoly(d.outline, x, z))?.id ?? '—';

if (PROBE) { const [x0, z0, x1, z1, y] = PROBE, L = Math.hypot(x1 - x0, z1 - z0), pts = [];
  for (let d = 0; d <= L; d += .1) pts.push({x: x0 + (x1 - x0) * d / L, z: z0 + (z1 - z0) * d / L, s: d, ...(d ? {} : {y})});
  for (const q of pts) { const f = g.surface(q.x, q.z, (q.y ?? y) + 1, 2); console.log(r2(q.s), r2(q.x), r2(q.z), f?.id, f ? r3(f.y) : '-', 'ground', r3(g.ground(q.x, q.z))); }
  console.log('lipLine →', JSON.stringify(lipLine(pts, y).map(l => ({s: r2(l.s), dy: r3(l.dy), seam: l.seam, from: l.from, to: l.to}))));
  process.exit(0); }
// ─── Beds and resampled centrelines ──────────────────────────────────────────────────────────────────────────────────
const BEDS = [...world.collision.beds];
let chainReaches = null;
let chainWidths = null;
if (MOUNTAIN_CHAIN) {
  const chain = world.roadChains?.find(c=>c.id==='mountain-road') ?? api.mountainRoadChain(BEDS);
  if (!chain) throw new Error('Mountain Road chain missing');
  const mountain=BEDS.find(b=>b.id==='mountainV2.road');
  chainWidths=chain.widths.map(w=>({s:w.s,hw:w.half}));
  chainReaches={approachEnd:chain.parts[0].to,mountainStart:chain.parts[2].from,parts:chain.parts,note:'Shared multi-owner chain; all lengths are plan metres. Native surface and guard queries use the drawn region.'};
  const sourcePath = resolve(ROOT, 'src/harbour/horizon/land/mountainV2/v2-data.json');
  chainReaches.nativeStationMap = nativeStationMap(JSON.parse(readFileSync(sourcePath, 'utf8')).road.samples, mountain.points, chain);
  chainReaches.nativeSourceSha256 = sha(readFileSync(sourcePath));
  BEDS.push({...mountain,id:'mountain-chain',shoulder:0,points:chain.points});
}
function halfAt(bedId,s) {
  if(bedId!=='mountain-chain')return bedById.get(bedId).width/2;
  let lo=0,hi=chainWidths.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(chainWidths[m].s<=s)lo=m;else hi=m;}
  const a=chainWidths[lo],b=chainWidths[hi],t=Math.max(0,Math.min(1,(s-a.s)/(b.s-a.s||1)));return a.hw+(b.hw-a.hw)*t;
}

const bedById = new Map(BEDS.map(b => [b.id, b]));
const ROAD_IDS = MOUNTAIN_CHAIN ? ['mountain-chain'] : BEDS.filter(b => b.kind === 'road' && (['V01', 'VG', 'V03', 'VBS'].includes(b.id) || b.id.startsWith('spur ') || /^plot\..*\.service$/.test(b.id))).map(b => b.id)
  .filter(id => !ONLY || ONLY.includes(id));
const MAIN = new Set(['V01', 'VG', 'V03']);
function resample(points, closed, ds = .5) {
  const arc = [0]; for (let i = 1; i < points.length; i++) arc.push(arc[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]));
  const L = arc.at(-1), out = []; let seg = 1;
  for (let s = 0; s <= L + 1e-9; s += ds) {
    while (seg < points.length - 1 && arc[seg] < s) seg++;
    const a = points[seg - 1], b = points[seg], len = arc[seg] - arc[seg - 1] || 1, t = Math.max(0, Math.min(1, (s - arc[seg - 1]) / len));
    out.push({x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, s});
  }
  const n = out.length, W = 4; // tangent over ±2 m
  for (let i = 0; i < n; i++) {
    const a = closed ? out[(i - W + n) % n] : out[Math.max(0, i - W)], b = closed ? out[(i + W) % n] : out[Math.min(n - 1, i + W)];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; out[i].tx = dx / l; out[i].tz = dz / l;
  }
  for (let i = 0; i < n; i++) { // plan curvature over ±3 m
    const K = 6, a = closed ? out[(i - K + n) % n] : out[Math.max(0, i - K)], b = closed ? out[(i + K) % n] : out[Math.min(n - 1, i + K)];
    let da = Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz); da = Math.atan2(Math.sin(da), Math.cos(da));
    out[i].k = Math.abs(da) / Math.max(.5, (closed ? K * 2 : (Math.min(n - 1, i + K) - Math.max(0, i - K))) * ds);
  }
  return {pts: out, length: L, closed};
}
const PATHS = new Map(ROAD_IDS.map(id => { const b = bedById.get(id), p = b.points, closed = Math.hypot(p[0][0] - p.at(-1)[0], p[0][2] - p.at(-1)[2]) < .01; return [id, resample(p, closed)]; }));
function nearestOn(path, x, z) { let best = Infinity, bi = 0; for (let i = 0; i < path.pts.length; i += 2) { const p = path.pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bi = i; } } for (let i = Math.max(0, bi - 3); i < Math.min(path.pts.length, bi + 4); i++) { const p = path.pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bi = i; } } return {i: bi, d: Math.sqrt(best), p: path.pts[bi]}; }

// Structure beds that carry the audited roads (their spans are transitions).
const structureOwners = new Map([...api.SPANS.map(s => [s.id, s.route]), ...api.structureStretches(BEDS).map(s => [s.structureId, s.bedId])]);
const nativeStructureBeds = MOUNTAIN_CHAIN ? (world.corridors ?? []).flatMap(c => (c.sourceBridges ?? []).map(b => ({id:`native.${b.id}`,points:b.axis,width:b.width,auditOwner:c.id}))) : [];
const STRUCTURE_BEDS = [...BEDS.filter(b => b.id.startsWith('structure.') || b.id === 'prowTunnel'), ...nativeStructureBeds];
// Keep longitudinal probes inside the carriageway with body clearance. Edge/drop probes remain independent.
const roadScanOffsets = (id, five = false, station = 0) => { const edge = Math.min(3, Math.max(0, halfAt(id,station) - .3)); return five ? [-edge, -edge / 2, 0, edge / 2, edge] : [-edge, 0, edge]; };
const YEAR_WALK = bedById.get('yearWalk');
const events = [];
const telemetry = [];
let eid = 0;
function event(e) { e.id = `e${++eid}`; events.push(e); return e; }

// ─── 1. Driving: pure pursuit on the lane line, real stepCruiser, both directions, centre and keep-right ────────────────
const A_LAT = 4, B_DEC = 5, HARD = new Set(['terrain', 'terrain-face', 'low-headroom', 'steep-ground', 'water', 'world-boundary']);
function lanePath(path, dir, lane) {
  const n = path.pts.length, pts = [];
  for (let k = 0; k < n; k++) {
    const i = dir === 'fwd' ? k : n - 1 - k, p = path.pts[i], tx = dir === 'fwd' ? p.tx : -p.tx, tz = dir === 'fwd' ? p.tz : -p.tz;
    const rx = -tz, rz = tx; // the rider's right (D decreases yaw; heading = (sin yaw, cos yaw))
    pts.push({x: p.x + rx * lane, z: p.z + rz * lane, y: p.y, cx: p.x, cz: p.z, s: p.s, tx, tz, rx, rz, k: p.k, d: k * .5});
  }
  // Speed plan: comfortable lateral acceleration, braked into curves at B_DEC; an open road stops at its far end.
  const v = pts.map(p => Math.min(C.speed, Math.sqrt(A_LAT / Math.max(p.k, 1e-6))));
  if (!path.closed) v[n - 1] = 0;
  for (let pass = 0; pass < (path.closed ? 2 : 1); pass++) for (let k = n - 2 + (path.closed ? 1 : 0); k >= 0; k--) { const nx = (k + 1) % n; v[k] = Math.min(v[k], Math.sqrt(v[nx] ** 2 + 2 * B_DEC * .5)); }
  pts.forEach((p, k) => p.v = v[k]);
  return pts;
}
/** Station span of an event, in driving order; on a closed loop a span across the seam reads [3885, 3] rather than [3, 3885]. */
const spanOf = (path, a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b); return path.closed && hi - lo > path.length / 2 ? [r1(hi), r1(lo)] : [r1(lo), r1(hi)]; };
function runDrive(bedId, dir, lane) {
  const bed = bedById.get(bedId), path = PATHS.get(bedId), Q = lanePath(path, dir, lane), n = Q.length, closed = path.closed;
  let half = bed.width / 2; const pass = `${dir}/${lane ? 'right+2' : 'centre'}`;
  const tag = {bed: bedId, dir, lane, pass};
  const at = k => closed ? Q[((k % n) + n) % n] : Q[Math.max(0, Math.min(n - 1, k))];
  const total = closed ? path.length + 10 : path.length - 1.5;
  const stats = {...tag, distance: 0, simSeconds: 0, steps: 0, maxSpeed: 0, meanSpeed: 0, contacts: 0, airborneSteps: 0, offBedSteps: 0, brakeSteps: 0, throttleSteps: 0, coastSteps: 0, restarts: [], kernelRecoveries: 0, completed: false, reason: 'start-invalid'};
  function place(k0) {
    for (let k = k0; k < k0 + (NATURAL_DOWNHILL ? 1 : 120); k += 2) { const q = at(k); if (!closed && k >= n - 1) return null;
      // A (re)start stands on the road at its own bed height (never on ground seen through a crack under a deck).
      const yaw = Math.atan2(q.tx, q.tz), surf = g.surface(q.x, q.z, q.y + .3, .8); if (!surf || Math.abs(surf.y - q.y) > .7) continue;
      const ok = api.validCruiserPosition(g, {x: q.x, y: surf.y, z: q.z, yaw}); if (ok) return {state: api.createCruiserState(ok), k}; }
    return null;
  }
  let placed = place(0); if (!placed) { event({...tag, type: 'start-invalid', severity: 'BLOCKER', station: [0, 0], at: P3(Q[0].x, Q[0].y, Q[0].z), note: NATURAL_DOWNHILL ? 'the exact starting pose is invalid; no search ahead in natural-downhill' : 'no valid cruiser position within 60 m of the start'}); return stats; }
  let s = placed.state, k = placed.k, progress = k * .5, t = 0;
  stats.startStationPlanM = at(k).s; stats.startPosition = [s.x, s.y, s.z]; stats.reason = 'time-limit';
  let lastFrame = null, lastTraceStep = -1;
  function recordFrame(frame) {
    if (!frame || lastTraceStep === frame.step || !(MOUNTAIN_CHAIN || NATURAL_DOWNHILL)) return;
    const {before, next, q, k: frameK, forward, steer, time, step, segment} = frame;
    const projection = localPlanStation(Q, frameK, next.x, next.z, closed);
    telemetry.push({...tag, s:r2(q.s), speed:r2(api.cruiserSpeed(next)), radius:q.k ? r2(1/q.k):null,
      lateralDemand:r2(api.cruiserSpeed(next)**2*q.k), gripModel:C.grip, x:r2(next.x), y:r2(next.y), z:r2(next.z),
      timeSeconds:time, simulationStep:step, segment, ...projection, chainS:bedId === 'mountain-chain' ? projection.stationPlanM : null,
      position:[next.x,next.y,next.z], ...kinematics(before,next,C.dt,steer), forward, brake:forward < -.15,
      grounded:next.grounded, contact:next.contact??null, discontinuity:next.contact === 'water',
      offBed:projection.distanceFromCentreM > halfAt(bedId,projection.stationPlanM)});
    lastTraceStep = step;
  }
  let stallT = 0, stallOpen = null, air = null, slide = null, off = null, corner = null, mism = null, lastContact = null, lastContactT = -1;
  const maxT = total / 3 + 180; let speedSum = 0;
  function closeSlide(sl) {
      const d = describe(sl.idKey), inLane = MOUNTAIN_CHAIN ? sl.inLane : sl.nearestIn <= half - C.radius;
      event({...tag, type: 'contact', severity: inLane ? 'MAJOR' : 'MINOR', station: spanOf(path, sl.start, sl.end), at: sl.at, ids: [sl.idKey], role: d?.role, kind: d?.kind,
        value: r2(sl.steps * C.dt), unit: 's', speedIn: sl.speedIn, minSpeed: r1(sl.minSpeed), offCentre: sl.offCentre,
        note: `${inLane ? 'in-lane' : 'edge'} contact with ${sl.idKey} (${d?.kind}/${d?.role}) for ${(sl.steps * C.dt).toFixed(2)} s, ${sl.speedIn}→${r1(sl.minSpeed)} m/s`});
    }
  const restart = (why, skip) => {
    if (NATURAL_DOWNHILL) { stats.reason = why; return false; }
    const k1 = k + Math.round(skip / .5), p = place(k1);
    stats.restarts.push({why, fromStation: r1(at(k).s), skip});
    if (!p) { stats.reason = `restart-unavailable: ${why}`; return false; } s = p.state; progress += (p.k - k) * .5; k = p.k; stallT = 0; stallOpen = null; air = null; slide = null; return true;
  };
  while (progress < total && t < maxT) {
    // Track the nearest lane sample ahead (a window: the driver never jumps to another arm of the road).
    let best = Infinity, bk = k;
    for (let j = k - 6; j <= k + 40; j++) { if (!closed && (j < 0 || j >= n)) continue; const q = at(j), d = (q.x - s.x) ** 2 + (q.z - s.z) ** 2; if (d < best) { best = d; bk = j; } }
    progress += (bk - k) * .5; k = bk;
    const q = at(k), speed = api.cruiserSpeed(s);
    if (MOUNTAIN_CHAIN) half = halfAt(bedId,q.s);
    const L = Math.max(6, Math.min(8, 6 + speed * .125)), tgt = at(k + Math.round(L / .5));
    const alpha = Math.atan2(Math.sin(Math.atan2(tgt.x - s.x, tgt.z - s.z) - s.yaw), Math.cos(Math.atan2(tgt.x - s.x, tgt.z - s.z) - s.yaw));
    const D = Math.max(1, Math.hypot(tgt.x - s.x, tgt.z - s.z)), kappa = 2 * Math.sin(alpha) / D;
    const rate = C.steerLow + (C.steerHigh - C.steerLow) * Math.max(0, Math.min(1, speed / C.speed));
    const steer = Math.max(-1, Math.min(1, -kappa * Math.max(speed, 2) / rate));
    const vT = Math.min(C.speed, q.v), cruise = C.speed - (C.speed - C.cornerSpeed) * Math.abs(steer) ** 1.5;
    let forward = NATURAL_DOWNHILL ? (speed < 1.5 ? 1 : 0) : speed > vT + 2 && speed > 1 ? -1 : speed > vT + .6 ? 0 : Math.max(.2, Math.min(1, vT / cruise));
    const next = api.stepCruiser(s, {forward, steer, jump: false}, g);
    if (TRACE && TRACE[0] === bedId && TRACE[1] === dir && Number(TRACE[2]) === lane && q.s >= Number(TRACE[3]) && q.s <= Number(TRACE[4])) { const u = g.surface(next.x, next.z, next.y + .05, .1); console.log('trace', r2(q.s), P3(next.x, next.y, next.z).join(','), 'v', r2(api.cruiserSpeed(next)), 'vy', r2(next.vy), next.grounded ? 'G' : 'AIR', 'contact', next.contact, 'under', u?.id, u ? r2(u.y) : '-', 'off', r2((next.x - q.cx) * q.rx + (next.z - q.cz) * q.rz), 'steer', r2(steer), 'fwd', r2(forward)); }
    t += C.dt; stats.steps++;
    lastFrame = {before:s,next,q,k,forward,steer,time:t,step:stats.steps,segment:stats.restarts.length};
    if (stats.steps % 12 === 0 || stats.steps === 1) recordFrame(lastFrame);
    if (forward < -.15) stats.brakeSteps++; else if (forward > .15) stats.throttleSteps++; else stats.coastSteps++;
    const ns = api.cruiserSpeed(next); speedSum += ns; stats.maxSpeed = Math.max(stats.maxSpeed, ns);
    const offC = (next.x - q.cx) * q.rx + (next.z - q.cz) * q.rz;
    if (Math.abs(offC) > half) stats.offBedSteps++;
    if (next.contact === 'water') {
      stats.kernelRecoveries++;
      if (NATURAL_DOWNHILL) { stats.contacts++; stats.reason = 'kernel-water-recovery'; s = next; break; }
    }
    const where = () => ({station: r1(q.s), at: P3(next.x, next.y, next.z)});
    // Lips on the driven line: height change in one step beyond the bed's own grade.
    if (s.grounded && next.grounded) {
      const ds = Math.hypot(next.x - s.x, next.z - s.z), nq = at(k + 1), grade = (nq.y - q.y) / .5, dy = next.y - s.y - grade * ds * (dir === 'fwd' ? 1 : 1);
      if (Math.abs(dy) > .08 && ds > .01) {
        const a = g.surface(s.x, s.z, s.y + .05, .1), b = g.surface(next.x, next.z, next.y + .05, .1);
        event({...tag, type: 'drive-lip', severity: Math.abs(dy) > .15 && Math.abs(offC) <= half ? 'MAJOR' : 'MINOR', ...where(), value: r3(dy), unit: 'm', ids: [a?.id, b?.id].filter(Boolean), offCentre: r2(offC), speed: r1(ns), note: `${dy > 0 ? 'step up' : 'step down'} ${Math.abs(dy).toFixed(2)} m between ${a?.id ?? '?'} and ${b?.id ?? '?'}`});
      }
    }
    // Contacts.
    if (next.contact) { stats.contacts++; lastContact = next.contact; lastContactT = t; }
    if (next.contact && !HARD.has(next.contact)) {
      if (!slide || slide.idKey !== next.contact) {
        if (slide) closeSlide(slide);
        slide = {...tag, type: 'contact', idKey: next.contact, ...where(), start: q.s, end: q.s, steps: 0, speedIn: r1(speed), minSpeed: ns, nearestIn: Math.abs(offC), offCentre: r2(offC)};
      }
      slide.inLane ||= Math.abs(offC) <= half-C.radius;
      slide.steps++; slide.end = q.s; slide.minSpeed = Math.min(slide.minSpeed, ns); slide.nearestIn = Math.min(slide.nearestIn, Math.abs(offC)); // the closest approach to the centreline: a slide that reaches into the lane at any point is in-lane
    } else if (slide) { closeSlide(slide); slide = null; }
    // Airborne.
    if (s.grounded && !next.grounded) { const a = g.surface(s.x, s.z, s.y + .05, .1); air = {takeoff: {x: s.x, y: s.y, z: s.z}, t: 0, minVy: 0, from: a?.id ?? null, station: q.s, speed: speed}; }
    if (air && !next.grounded) { air.t += C.dt; air.minVy = Math.min(air.minVy, next.vy); stats.airborneSteps++; }
    if (air && next.grounded) {
      const b = g.surface(next.x, next.z, next.y + .05, .1), drop = air.takeoff.y - next.y;
      if (air.t > .1) {
        const cause = air.from === b?.id ? 'crest (same surface)' : /\.(bed|shoulders|surface\.\d+)/.test(air.from ?? '') || solidById.get(air.from)?.role === 'deck' || solidById.get(air.from)?.role === 'floor' ? (b?.id === 'terrain' ? 'deck edge onto terrain' : 'deck/structure seam') : 'lip';
        event({...tag, type: 'airborne', severity: 'BLOCKER', station: [r1(air.station), r1(q.s)], at: P3(air.takeoff.x, air.takeoff.y, air.takeoff.z), value: r2(drop), unit: 'm drop', airtime: r2(air.t), impact: r2(-air.minVy), speed: r1(air.speed), ids: [air.from, b?.id].filter(Boolean), cause, offCentre: r2(offC),
          note: `launched ${air.t.toFixed(2)} s at ${air.speed.toFixed(1)} m/s, ${drop.toFixed(2)} m drop, landing ${(-air.minVy).toFixed(1)} m/s: ${cause} ${air.from ?? '?'} → ${b?.id ?? '?'}`});
      } else stats.hops = (stats.hops ?? 0) + 1;
      air = null;
    }
    // Stalls (throttling, not moving).
    if (forward > .15 && ns < .5 && t > .5) {
      stallT += C.dt;
      if (stallT > .25 && !stallOpen) {
        const probe = g.contact(next.x + Math.sin(next.yaw) * .3, next.z + Math.cos(next.yaw) * .3, next.y, C.radius);
        const id = next.contact ?? (t - lastContactT < .3 ? lastContact : null) ?? probe?.id ?? 'unknown';
        const d = describe(id);
        stallOpen = event({...tag, type: 'stall', severity: 'BLOCKER', ...where(), ids: [id, probe?.id].filter((v, i, a) => v && a.indexOf(v) === i), kind: d?.kind, role: d?.role, offCentre: r2(offC),
          note: `stalled against ${id} (${d?.kind}/${d?.role})`});
      }
      if (stallT > 2) { if (NATURAL_DOWNHILL) s = next; if (!restart(`stall ${stallOpen?.ids?.[0]}`, 8)) break; continue; }
    } else { stallT = 0; stallOpen = null; }
    // Off-bed excursions and lost vehicle.
    const out = Math.abs(offC) > half;
    if (out) { if (!off) off = {start: q.s, max: 0, at: null}; if (Math.abs(offC) > off.max) { off.max = Math.abs(offC); off.at = P3(next.x, next.y, next.z); } off.end = q.s; }
    else if (off) { event({...tag, type: 'off-bed', severity: off.max > half + (bed.shoulder ?? 0) ? 'MAJOR' : 'MINOR', station: spanOf(path, off.start, off.end), at: off.at, value: r2(off.max), unit: 'm from centre', note: `left the ${bed.width} m carriageway: ${off.max.toFixed(2)} m from centre (half width ${half})`}); off = null; }
    // Physical surface disagreeing with the bed line while on the carriageway (buried deck or a hollow).
    if (next.grounded && !out) {
      const dy = next.y - (q.y); // bed height at this station (no cross-fall in the bake)
      if (Math.abs(dy) > .3) { if (!mism) mism = {start: q.s, max: 0}; if (Math.abs(dy) > Math.abs(mism.max)) { mism.max = dy; mism.at = P3(next.x, next.y, next.z); mism.id = g.surface(next.x, next.z, next.y + .05, .1)?.id; } mism.end = q.s; }
      else if (mism) { event({...tag, type: 'surface-mismatch', severity: Math.abs(mism.max) > .48 ? 'MAJOR' : 'MINOR', station: spanOf(path, mism.start, mism.end), at: mism.at, value: r2(mism.max), unit: 'm vs bed', ids: [mism.id], note: `rode ${mism.max > 0 ? 'above' : 'below'} the bed line by ${Math.abs(mism.max).toFixed(2)} m on ${mism.id}`}); mism = null; }
    }
    // Corners where the plan asked for less than cornerSpeed.
    if (!NATURAL_DOWNHILL && vT < C.cornerSpeed && t > 3) { if (!corner) corner = {start: q.s, minR: Infinity, minV: Infinity}; corner.minR = Math.min(corner.minR, 1 / Math.max(q.k, 1e-6)); corner.minV = Math.min(corner.minV, ns); corner.end = q.s; corner.at ??= P3(next.x, next.y, next.z); }
    else if (corner) { if (Math.abs(corner.end - corner.start) > 1 || corner.minR < 30) event({...tag, type: 'slow-corner', severity: 'MINOR', station: spanOf(path, corner.start, corner.end), at: corner.at, value: r1(corner.minR), unit: 'm radius', minSpeed: r1(corner.minV), note: `${corner.minR < 12 ? 'hairpin' : 'tight curve'}: radius ${corner.minR.toFixed(1)} m, driver down to ${corner.minV.toFixed(1)} m/s (cornerSpeed ${C.cornerSpeed})`}); corner = null; }
    // Lost: far off the road or fallen well below it.
    if (Math.abs(offC) > half + (bed.shoulder ?? 0) + 5 || next.y < q.y - 4) {
      event({...tag, type: 'lost', severity: 'BLOCKER', ...where(), value: r2(Math.abs(offC)), unit: 'm from centre', note: `vehicle left the corridor (${offC.toFixed(1)} m lateral, ${(next.y - q.y).toFixed(1)} m vertical); ${NATURAL_DOWNHILL ? 'stopped without restart' : 'restarted'}`});
      s = next; if (!restart('lost', 6)) break; continue;
    }
    s = next;
  }
  recordFrame(lastFrame);
  if (slide) closeSlide(slide);
  if (NATURAL_DOWNHILL && off) event({...tag,type:'off-bed',severity:off.max > half + (bed.shoulder ?? 0) ? 'MAJOR' : 'MINOR',station:spanOf(path,off.start,off.end),at:off.at,value:r2(off.max),unit:'m from centre',note:'attempt ended during an off-bed excursion'});
  stats.finalPosition = [s.x,s.y,s.z]; stats.endStationPlanM = at(k).s; stats.timeLimitSeconds = maxT;
  stats.completed = progress >= total && (!NATURAL_DOWNHILL || stats.reason === 'time-limit'); stats.distance = r1(progress); stats.simSeconds = r1(t); stats.meanSpeed = r2(speedSum / Math.max(1, stats.steps));
  if (stats.completed) stats.reason = 'end';
  if (!stats.completed) event({...tag, type: 'incomplete', severity: 'BLOCKER', station: [r1(at(k).s), r1(at(k).s)], at: P3(s.x, s.y, s.z), note: `drive did not finish (${progress.toFixed(0)} of ${total.toFixed(0)} m in ${t.toFixed(0)} s)`});
  return stats;
}

// ─── 2. Static corridor probes ──────────────────────────────────────────────────────────────────────────────────────
const ownOf = bedId => s => (bedId==='mountain-chain'?['V03','mountainV2.road']: [bedId]).some(id=>s.id.startsWith(`${id}.`) || (s.bedIds ?? []).includes(id));
const nativeOwnGuard = nativeRoadGuardOwnership({solids:api.EDGE_SOLIDS,runs:api.EDGE_RUNS,line:api.MOUNTAIN_ROAD_LINE,offset:api.MOUNTAIN_V2_OFFSET});
const ownGuardAt = (bedId,id,p,half,radius=0) => bedId==='mountain-chain' && nativeOwnGuard(id,p,half,radius);
function nativeBridgeAt(x,z,h) {
  const O=api.MOUNTAIN_V2_OFFSET; x-=O.x;z-=O.z;h-=O.y;
  for(const bridge of api.GORGE_BRIDGES.filter(b=>b.carries==='road'))for(let i=1;i<bridge.deck.length;i++){
    const a=bridge.deck[i-1],b=bridge.deck[i],dx=b[0]-a[0],dz=b[2]-a[2],raw=((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1);
    if(raw<0||raw>1)continue;
    if(Math.hypot(x-a[0]-raw*dx,z-a[2]-raw*dz)<=bridge.halfWidth&&Math.abs(h-a[1]-raw*(b[1]-a[1]))<.1)return `mountainV2:${bridge.id}`;
  }
  return null;
}
function supportBelow(x, z, h) {
  const s = g.surface(x, z, h - .5, 0), ground = g.ground(x, z), w = g.waterLevel(x, z);
  let y = s ? s.y : ground; const wet = w !== null && w > y; if (wet) y = w;
  return {y, wet, id: wet ? 'water' : s?.id ?? 'terrain'};
}
function lateralScan(p, side, h, maxD, bedId) {
  let yPrev = h, cracks = 0; const rx = -p.tz * side, rz = p.tx * side;
  /** Surface resumes at the running height within 0.6 m further out: a crack between prisms, not an edge. */
  const resumes = d => {
    const x = p.x + rx * d, z = p.z + rz * d, flat = q => q && Math.abs(q.y - yPrev) < .1;
    // A crack between segment prisms runs across the road: the deck continues 0.15 m either side along the road.
    if (flat(g.surface(x + p.tx * .15, z + p.tz * .15, yPrev, .1)) && flat(g.surface(x - p.tx * .15, z - p.tz * .15, yPrev, .1))) return .25;
    for (let e = .1; e <= .6 + 1e-9; e += .1) if (flat(g.surface(p.x + rx * (d + e), p.z + rz * (d + e), yPrev, .1))) return e;
    return 0; };
  for (let d = .25; d <= maxD + 1e-9; d += .25) {
    const x = p.x + rx * d, z = p.z + rz * d;
    const hit = g.contact(x, z, yPrev, .2);
    if (hit) return {kind: 'blocker', d, id: hit.id, y: yPrev, cracks, ownedGuard:ownGuardAt(bedId,hit.id,p,halfAt(bedId,p.s))};
    const s = g.surface(x, z, yPrev, .48);
    const dropHere = !s || s.y < yPrev - .5;
    if (dropHere) { const e = resumes(d); if (e) { cracks++; d += Math.ceil(e / .25) * .25 - .25; continue; } }
    if (!s) {
      if (g.ground(x, z) > yPrev + .48 && api.terrainTriangleVisible(x, z, world.collision)) return {kind: 'bank', d, y: g.ground(x, z), cracks};
      const b = supportBelow(x, z, h); return {kind: 'drop', d, depth: h - b.y, onto: b.id, wet: b.wet, cracks};
    }
    if (g.submerged(x, z, s.y)) return {kind: 'water', d, cracks};
    if (s.slope > C.maxSlope) return {kind: 'steep', d, slope: s.slope, cracks};
    if (s.y < h - .5) { const b = supportBelow(x, z, h); let depth = h - b.y; for (const e of [.5, 1]) { const q = supportBelow(x + rx * e, z + rz * e, h); depth = Math.max(depth, h - q.y); } return {kind: 'drop', d, depth, onto: b.id, wet: b.wet, cracks}; }
    if (s.y > h + .5) return {kind: 'bank', d, y: s.y, cracks};
    yPrev = s.y;
  }
  return {kind: 'open', d: maxD, cracks};
}
/** Physical surface along a line of samples ({x,z,s} every 0.1 m): steps > 0.08 m between consecutive samples with the local
 * grade removed. A drop that comes back up within 0.6 m (or a rise that comes back down) is one narrow seam/crack or ridge,
 * which the cruiser's wheelbase (1.12 m) bridges; it is reported as such, not as two lips. */
function lipLine(samples, y0) {
  const raw = []; y0 = samples[0].y ?? y0; let prev = g.surface(samples[0].x, samples[0].z, y0 + .3, .8), yPrev = prev ? prev.y : y0, idPrev = prev?.id ?? null, gradeRef = 0, anchor = null;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    // Up to 1 m above; within 0.6 m of a drop, back up to the height it dropped from (+0.3): climbing out of a crack is one crack.
    if (anchor && b.s - anchor.s > .6) anchor = null;
    const recover = anchor ? Math.max(1, anchor.y - yPrev + .3) : 1;
    let s = g.surface(b.x, b.z, yPrev, recover);
    if (!s) s = g.surface(b.x, b.z, yPrev + 3, 0); // a bank or face higher than that: the surface it rises to (≤ 3 m)
    if (!s) { raw.push({i, s: b.s, x: b.x, z: b.z, y: yPrev, dy: Infinity, from: idPrev, to: null}); continue; }
    const ds = Math.hypot(b.x - a.x, b.z - a.z), dy = s.y - yPrev - gradeRef * ds;
    if (Math.abs(dy) > .08) { raw.push({i, s: b.s, x: b.x, z: b.z, y: s.y, dy, from: idPrev, to: s.id}); if (dy < 0 && !anchor) anchor = {s: a.s, y: yPrev}; }
    else if (!anchor) gradeRef = ds > 1e-6 ? Math.max(-.2, Math.min(.2, (s.y - yPrev) / ds)) : gradeRef;
    yPrev = s.y; idPrev = s.id;
  }
  // A run of steps that returns to its starting height within 0.6 m is one narrow gap (crack) or ridge, which the cruiser's
  // 1.12 m wheelbase bridges; it is reported as such, not as separate lips.
  const out = [];
  for (let k = 0; k < raw.length; k++) {
    const a = raw[k]; let merged = false;
    if (Number.isFinite(a.dy)) { let sum = 0, extreme = 0;
      for (let j = k; j < raw.length && raw[j].s - a.s <= .6 && Number.isFinite(raw[j].dy); j++) {
        sum += raw[j].dy; if (Math.abs(sum) > Math.abs(extreme)) extreme = sum;
        if (j > k && Math.abs(sum) < .1 + .05 * Math.abs(extreme) && Math.sign(extreme) === Math.sign(a.dy)) {
          out.push({...a, dy: extreme, seam: extreme < 0 ? 'gap' : 'ridge', width: r2(raw[j].s - a.s + .1), depth: Math.abs(extreme), via: a.to}); k = j; merged = true; break; } } }
    if (!merged) out.push(a);
  }
  return out;
}
/** One severity rule for every lip: an up-step over stepHeight stops the cruiser, a down-step over groundSnap launches it,
 * no surface is a hole; a narrow gap (≤ 0.6 m, both sides level) is bridged by the wheelbase and stays MAJOR/MINOR. */
function lipSeverity(l) {
  if (!Number.isFinite(l.dy)) return 'BLOCKER';
  const size = Math.abs(l.dy);
  // A crack the wheelbase bridges: MAJOR when it is deeper than groundSnap (a foot, a board wheel or a body centre falls in), else MINOR.
  if (l.seam === 'gap' && l.width <= .3) return size > C.groundSnap ? 'MAJOR' : 'MINOR';
  if (l.seam === 'gap') return size > .15 ? 'MAJOR' : 'MINOR';
  if ((l.dy > 0 && size > C.stepHeight) || (l.dy < 0 && size > C.groundSnap)) return 'BLOCKER';
  return size > .15 ? 'MAJOR' : 'MINOR';
}
const lipText = l => !Number.isFinite(l.dy) ? 'hole (no surface)' : l.seam ? `${l.seam === 'gap' ? 'crack' : 'ridge'} ${Math.abs(l.dy).toFixed(2)} m ${l.seam === 'gap' ? 'deep' : 'high'}, ${r2(l.width)} m wide between prisms (${l.from ?? '?'} | ${l.via ?? '?'} showing)` : `${l.dy > 0 ? 'step up' : 'step down'} ${Math.abs(l.dy).toFixed(2)} m ${l.from ?? '?'} → ${l.to ?? '?'}`;
const lipRank = l => (SEVR[lipSeverity(l)] * 100) - (Number.isFinite(l.dy) ? Math.abs(l.dy) : 99);
const SEVR = {BLOCKER: 0, MAJOR: 1, MINOR: 2};
function staticAudit(bedId) {
  const bed = bedById.get(bedId), path = PATHS.get(bedId), sh = bed.shoulder ?? 0;
  const rows = [], own = ownOf(bedId);
  const stride = Math.max(1, Math.round(STATION / .5));
  const structureAt = (x, z, h) => { const kinds = column(x, z).filter(c => c.up && Math.abs(c.y - h) < .8 && ['bridge', 'tunnel', 'trestle', 'truss'].includes(c.solid.kind)).map(c => c.solid.id); return kinds[0] ?? null; };
  for (let i = 0; i < path.pts.length; i += stride) {
    const p = path.pts[i], half=halfAt(bedId,p.s),edge=half+sh,h = p.y, rx = -p.tz, rz = p.tx, row = {half,edge,minWidth:half>=4?7:half*2-.5,s: r1(p.s), x: r2(p.x), y: r2(h), z: r2(p.z)};
    const centre = g.surface(p.x, p.z, h + .3, .8); row.surface = centre?.id ?? null; row.surfaceY = centre ? r3(centre.y) : null;
    row.structure = structureAt(p.x, p.z, h) ?? (bedId==='mountain-chain'?nativeBridgeAt(p.x,p.z,h):null);
    // Headroom over the whole carriageway (every 0.5 m across), from the physical surface there.
    // Headroom: every downward-facing static face whose plan (edges sampled every 0.2 m) falls inside this station's carriageway
    // box (±half, 0…STATION along) with its underside 0.1–5 m above the deck, plus the dynamic ceiling on a 0.5 m grid. This
    // road's own rail or wall underside (its parapet coping over the edge) is the guard itself, not a roof.
    row.ceiling = null;
    const setRoof = (gap, id, d) => { if (row.ceiling === null || gap < row.ceiling) { row.ceiling = r2(gap); row.ceilingId = id; row.ceilingAt = r2(d); } };
    for (const t of trisNear(p.x + p.tx * STATION / 2, p.z + p.tz * STATION / 2, half + STATION)) {
      if (TN[t * 3 + 1] >= -.001 || TB[t * 2] < h + .1 || TB[t * 2] > h + 5) continue; const sol = SOLIDS[TS[t]]; if (['rail', 'wall'].includes(sol.role) && own(sol)) continue;
      const o = t * 9;
      for (let e = 0; e < 3; e++) { const a = o + e * 3, b = o + ((e + 1) % 3) * 3, L = Math.hypot(TV[b] - TV[a], TV[b + 2] - TV[a + 2]), n = Math.max(1, Math.ceil(L / .2));
        for (let k = 0; k <= n; k++) { const f = k / n, x = TV[a] + (TV[b] - TV[a]) * f, y = TV[a + 1] + (TV[b + 1] - TV[a + 1]) * f, z = TV[a + 2] + (TV[b + 2] - TV[a + 2]) * f;
          const along = (x - p.x) * p.tx + (z - p.z) * p.tz, lat = (x - p.x) * rx + (z - p.z) * rz; if (along < 0 || along > STATION || Math.abs(lat) > half) continue;
          const fl = g.surface(x, z, h + .3, .8), base = fl && Math.abs(fl.y - h) < .7 ? fl.y : h; if (y > base + .1) setRoof(y - base, sol.id, lat); } }
    }
    for (let d = -(half - .25); d <= half - .25 + 1e-9; d += .5) { const x = p.x + rx * d, z = p.z + rz * d, f = g.surface(x, z, h + .3, .8), y = f && Math.abs(f.y - h) < .7 ? f.y : h, c = g.ceiling(x, z, y);
      if (Number.isFinite(c) && !column(x, z).some(q => !q.up && Math.abs(q.y - c) < .02)) setRoof(c - y, 'mountainV2 (dynamic)', d); }
    // Width, drops, guards.
    const L = lateralScan(p, -1, h, edge + 3, bedId), R = lateralScan(p, 1, h, edge + 3, bedId);
    const pick = v => ({kind: v.kind, d: v.d, id: v.id, depth: v.depth !== undefined ? r2(v.depth) : undefined, onto: v.onto, wet: v.wet, cracks: v.cracks, ownedGuard: v.ownedGuard});
    row.left = pick(L); row.right = pick(R);
    row.width = r2(L.d + R.d);
    // Kerbs present (own kerb solid at ±half, faces between h and h+0.15).
    for (const [side, key] of [[-1, 'kerbL'], [1, 'kerbR']]) { const hits = new Map([...solidsAt(p.x + rx * side * half, p.z + rz * side * half, [h + .07], .3, s => s.id.startsWith(`${bedId}.kerbs`)), ...solidsAt(p.x + rx * side * edge, p.z + rz * side * edge, [h + .07], .3, s => s.id.startsWith(`${bedId}.corridor.kerb`))]); row[key] = hits.size > 0; }
    // Edge guards (own parapet / edges) and retaining.
    for (const [side, key] of [[-1, 'guardL'], [1, 'guardR']]) { const hits = solidsAt(p.x + rx * side * edge, p.z + rz * side * edge, [h + .5], .45, s => s.role === 'rail' || s.role === 'wall' && !s.id.includes('.kerbs') && !s.id.includes('.corridor.kerb')); row[key] = [...hits.keys()].map(si => SOLIDS[si].id); if(bedId==='mountain-chain'){const native=region.provider.contact(p.x+rx*side*edge,p.z+rz*side*edge,h,.45);if(native&&ownGuardAt(bedId,native.id,p,half,.45))row[key].push(native.id);} }
    // Buried deck: visible terrain above the deck inside the carriageway.
    let buried = 0, buriedAt = null;
    for (const f of [-1, -.5, 0, .5, 1]) { const d = f * (half - .5), x = p.x + rx * d, z = p.z + rz * d; if (!api.terrainTriangleVisible(x, z, world.collision)) continue; const gr = g.ground(x, z), roof = g.ceiling(x, z, h); if (Number.isFinite(roof) && gr >= roof - .1) continue; const t = gr - h; if (t > buried) { buried = t; buriedAt = [x, z]; } }
    row.buried = r3(buried); row.buriedAt = buriedAt ? buriedAt.map(r2) : null;
    // Floating edge: gap between the deck-edge bottom (h − 0.6) and the terrain just outside, with no wall or rail there.
    row.float = {};
    if (!row.structure) for (const side of [-1, 1]) {
      // Region-owned edges are absent from the static triangle index. Recognize only a measured
      // drawn native rail/wall here; ordinary Horizon support probes retain the original method.
      if(bedId==='mountain-chain'&&row[side<0?'guardL':'guardR'].some(id=>ownGuardAt(bedId,id,p,half,.45)))continue;
      const x = p.x + rx * side * (edge + .3), z = p.z + rz * side * (edge + .3), ground = g.ground(x, z), gap = h - .6 - ground;
      if (gap > .3) {
        const lv = []; for (let y = ground + .1; y < h - .6; y += .25) lv.push(y);
        const support = solidsAt(p.x + rx * side * (edge + .5), p.z + rz * side * (edge + .5), lv.length ? lv : [h - .7], .6, s => !s.walkable || /retaining|parapet|abutment|pier/.test(s.kind));
        row.float[side < 0 ? 'L' : 'R'] = {gap: r2(gap), supported: [...support.keys()].map(si => SOLIDS[si].id)};
      }
    }
    // Scenery in the carriageway + 1 m (static, non-walkable, not this road's own pieces) at body and head heights.
    const levels = [h + .3, h + .8, h + 1.25, h + 2, h + 3, h + 4.5], scen = new Map();
    for (let d = -(half + 1); d <= half + 1 + 1e-9; d += 1) {
      const x = p.x + rx * d, z = p.z + rz * d;
      for (const [si, y] of solidsAt(x, z, levels, .5, s => !own(s) && !s.walkable)) { const prev = scen.get(si); if (!prev || Math.abs(d) < Math.abs(prev.d)) scen.set(si, {d, y: y - h}); }
      const dyn = region.provider.contact(x, z, h, .5); if (dyn && !ownGuardAt(bedId,dyn.id,p,half,.5)) { const prev=scen.get(dyn.id); if(!prev || Math.abs(d)<Math.abs(prev.d)) scen.set(dyn.id, {d, y: .5, dynamic: true}); }
    }
    row.scenery = [...scen].map(([k, v]) => ({id: typeof k === 'number' ? SOLIDS[k].id : k, d: r2(v.d), above: r2(v.y), dynamic: !!v.dynamic}));
    row.district = districtAt(p.x, p.z); row.v2 = region.contains(p.x, p.z);
    rows.push(row);
  }
  return rows;
}
/** Points every 0.1 m along the road's line at lateral `off`, from station index i0 over d0…d1 metres, interpolating position and
 * tangent between the 0.5 m samples (an offset line never cuts a corner). Each point carries the bed height as y. */
function offsetLine(path, i0, d0, d1, off) {
  const n = path.pts.length, out = [];
  for (let d = d0; d <= d1 + 1e-9; d += .1) {
    const f = i0 + d / .5; let k = Math.floor(f), t = f - k;
    const idx = j => path.closed ? ((j % n) + n) % n : Math.max(0, Math.min(n - 1, j)), a = path.pts[idx(k)], b = path.pts[idx(k + 1)];
    if (!path.closed && (k < 0 || k >= n - 1)) t = 0;
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t, tx = a.tx + (b.tx - a.tx) * t, tz = a.tz + (b.tz - a.tz) * t, l = Math.hypot(tx, tz) || 1;
    const lateral=typeof off==='function'?off(i0*.5+d):off;
    out.push({x: x - tz / l * lateral, z: z + tx / l * lateral, y, s: d});
  }
  return out;
}
/** Lips along five lateral lines of the whole bed, 0.1 m apart. */
function lipSweep(bedId) {
  const bed = bedById.get(bedId), path = PATHS.get(bedId), offs = [-.75, -.375, 0, .375, .75], out = [];
  for (const off of offs) {
    const lateral=bedId==='mountain-chain'?s=>off*halfAt(bedId,s):off*bed.width/2;
    const samples=offsetLine(path,0,0,(path.pts.length-1)*.5,lateral).map((q,i)=>i?{x:q.x,z:q.z,s:q.s}:q);
    for (const l of lipLine(samples, path.pts[0].y)) out.push({...l, off:off*halfAt(bedId,l.s)});
  }
  return out;
}

// ─── 3. Junctions, pads, transitions, planting ──────────────────────────────────────────────────────────────────────
function linePoints(pts, from, len, step = .1) { // walk along a polyline [x,y,z] from nearest index `from`, len metres (signed)
  const out = []; let i = from, acc = 0, dir = Math.sign(len), cur = {x: pts[i][0], z: pts[i][2]}; out.push({...cur, s: 0});
  while (acc < Math.abs(len)) { const j = i + dir; if (j < 0 || j >= pts.length) break; const nx = pts[j][0], nz = pts[j][2], seg = Math.hypot(nx - cur.x, nz - cur.z); if (seg < 1e-6) { i = j; continue; }
    const take = Math.min(step, seg); cur = {x: cur.x + (nx - cur.x) / seg * take, z: cur.z + (nz - cur.z) / seg * take}; acc += take; out.push({...cur, s: acc}); if (take >= seg - 1e-9) i = j; }
  return out;
}
function junctionAudit() {
  const R = new Set(ROAD_IDS), rows = [];
  for (const c of world.crossings) {
    if (!(R.has(c.a) || R.has(c.b)) || c.resolution !== 'threshold') continue;
    const road = R.has(c.a) ? c.a : c.b, other = road === c.a ? c.b : c.a, ob = bedById.get(other), path = PATHS.get(road);
    const n = nearestOn(path, c.at[0], c.at[1]), row = {crossing: c.id, road, other, station: r1(n.p.s), at: P3(c.at[0], n.p.y, c.at[1]), lips: []};
    const scans = [];
    if (ob) { let bi = 0, bd = Infinity; ob.points.forEach((q, i) => { const d = Math.hypot(q[0] - c.at[0], q[2] - c.at[1]); if (d < bd) { bd = d; bi = i; } }); scans.push(['other+', linePoints(ob.points, bi, 20).map((q, i) => i ? q : {...q, y: ob.points[bi][1]})], ['other-', linePoints(ob.points, bi, -20).map((q, i) => i ? q : {...q, y: ob.points[bi][1]})]); }
    else row.note = `other route ${other} has no collision bed (skate/line only)`;
    for (const off of roadScanOffsets(road, false, n.p.s)) scans.push([`road${off >= 0 ? '+' : ''}${off}`, offsetLine(path, n.i, -15, 15, off).map((q, i) => i ? {x: q.x, z: q.z, s: q.s} : q)]);
    for (const [name, pts] of scans) if (pts.length > 2) for (const l of lipLine(pts, n.p.y)) { const bedR = bedById.get(road); if (name.startsWith('road') ? Math.abs(l.s) > (ob ? ob.width / 2 + 4 : 8) : Math.abs(l.s) > bedR.width / 2 + (bedR.shoulder ?? 0) + 6) continue; row.lips.push({line: name, s: r2(l.s), at: P3(l.x, l.y, l.z), dy: l.dy, seam: l.seam, width: l.width, via: l.via, from: l.from, to: l.to}); };
    rows.push(row);
  }
  return rows;
}
const inPad = (p, x, z) => { const a = p.rotationDegrees * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), dx = x - p.centre[0], dz = z - p.centre[2]; return Math.abs(dx * c + dz * sn) <= p.size[0] / 2 && Math.abs(-dx * sn + dz * c) <= p.size[1] / 2; };
function padAudit() {
  const rows = [];
  for (const pad of world.collision.pads) {
    if (pad.kind === 'threshold' || pad.underground) continue;
    for (const id of ROAD_IDS) {
      const bed = bedById.get(id), path = PATHS.get(id), n = nearestOn(path, pad.centre[0], pad.centre[2]), reach = Math.hypot(pad.size[0], pad.size[1]) / 2;
      if (n.d > reach + bed.width / 2 + (bed.shoulder ?? 0) + 2 || Math.abs(n.p.y - pad.centre[1]) > 3) continue;
      // Scan from the road centre straight through the pad centre and two parallels ±size/3 along the road.
      const dx = pad.centre[0] - n.p.x, dz = pad.centre[2] - n.p.z, l = Math.hypot(dx, dz) || 1, ux = l > .5 ? dx / l : -n.p.tz, uz = l > .5 ? dz / l : n.p.tx, row = {pad: pad.id, kind: pad.kind, road: id, station: r1(n.p.s), padY: r2(pad.centre[1]), roadY: r2(n.p.y), centreOffset: r2(n.d), lips: []};
      for (const par of [-reach / 1.5, 0, reach / 1.5]) { const k = Math.max(0, Math.min(path.pts.length - 1, n.i + Math.round(par / .5))), o = path.pts[k], pts = [];
        // A guard (rail or wall at body height) between the road and the pad closes the line: nothing drives past it.
        let inside = -1, railed = false; for (let d = 0; d <= l + 2; d += .1) { const x = o.x + ux * d, z = o.z + uz * d; if (d > 1 && solidsAt(x, z, [n.p.y + .5, n.p.y + .8], .15, s => s.role === 'rail' || s.role === 'wall' && !/\.(kerbs|corridor\.kerb)/.test(s.id)).size) { railed = true; break; } if (inside < 0 && inPad(pad, x, z)) inside = d; if (inside >= 0 && d > inside + 4) break; pts.push({x, z, s: d, ...(d ? {} : {y: o.y})}); }
        if (railed) { row.railed = (row.railed ?? 0) + 1; continue; }
        if (inside < 0) continue;
        for (const lp of lipLine(pts, n.p.y)) row.lips.push({par: r1(par), s: r2(lp.s), at: P3(lp.x, lp.y, lp.z), dy: lp.dy, seam: lp.seam, width: lp.width, via: lp.via, from: lp.from, to: lp.to}); }
      rows.push(row);
    }
  }
  return rows;
}
function transitionAudit() {
  const rows = [];
  for (const sb of STRUCTURE_BEDS) {
    for (const id of ROAD_IDS) {
      const owner = sb.auditOwner ?? structureOwners.get(sb.id.replace(/^structure\./, '').split('.')[0]);
      if (id === 'mountain-chain' ? !chainReaches.parts.some(p => p.id === owner) : owner !== id) continue;
      const path = PATHS.get(id);
      for (const [end, q] of [['start', sb.points[0]], ['end', sb.points.at(-1)]]) {
        const n = nearestOn(path, q[0], q[2]); // A nearby side bay is not a longitudinal road handover. Its connector is audited as a crossing.
        if (n.d > halfAt(id,n.p.s)) continue;
        const row = {structure: sb.id, road: id, end, station: r1(n.p.s), structureY: r2(q[1]), roadBedY: r2(n.p.y), bedStep: r2(q[1] - n.p.y), offset: r2(n.d), lips: []};
        for (const off of roadScanOffsets(id, true, n.p.s)) { const pts = offsetLine(path, n.i, -15, 15, off).map((q, i) => i ? {x: q.x, z: q.z, s: q.s} : q);
          for (const l of lipLine(pts, n.p.y)) row.lips.push({off, s: r2(l.s), at: P3(l.x, l.y, l.z), dy: l.dy, seam: l.seam, width: l.width, via: l.via, from: l.from, to: l.to}); }
        rows.push(row);
      }
    }
  }
  return rows;
}
function bightMismatch() {
  const bb = bedById.get('structure.bightBridge'), path = PATHS.get('V01'); if (!bb || !path) return null;
  const [a, b] = [bb.points[0], bb.points.at(-1)], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), out = [];
  for (const p of path.pts) { const t = ((p.x - a[0]) * dx + (p.z - a[2]) * dz) / (L * L); if (t < 0 || t > 1) continue; const lat = ((p.x - a[0]) * -dz + (p.z - a[2]) * dx) / L; if (Math.abs(lat) > 15) continue; out.push({s: r1(p.s), t: r3(t), lateral: r2(lat), headingDeg: r1(Math.acos(Math.max(-1, Math.min(1, (p.tx * dx + p.tz * dz) / L))) * 180 / Math.PI)}); }
  const max = out.reduce((m, r) => Math.abs(r.lateral) > Math.abs(m.lateral) ? r : m, {lateral: 0});
  return {frame: [a, b].map(v => v.map(r2)), deckWidth: bb.width, stations: out.filter((_, i) => i % 10 === 0), max, v01Edge: bedById.get('V01').width / 2 + bedById.get('V01').shoulder, deckHalf: bb.width / 2};
}
function doubleParapets(rows, bedId) { // stations where two or more rail solids stand on one side within the scan
  const path = PATHS.get(bedId), out = [];
  for (const row of rows) { if (!row.structure) continue; const i = Math.round(row.s / .5), p = path.pts[Math.min(path.pts.length - 1, i)];
    for (const side of [-1, 1]) { const ids = new Map(); for (let d = 3; d <= 12; d += .25) { const x = p.x - p.tz * side * d, z = p.z + p.tx * side * d; for (const [si] of solidsAt(x, z, [p.y + .6], .15, s => s.role === 'rail')) if (!ids.has(SOLIDS[si].id)) ids.set(SOLIDS[si].id, d); }
      if (ids.size >= 2) out.push({s: row.s, side: side < 0 ? 'L' : 'R', rails: [...ids].map(([id, d]) => ({id, d}))}); } }
  return out;
}
function plantingAudit() {
  const O = api.MOUNTAIN_V2_OFFSET, plan = api.mountainPlanting('full'), out = [];
  const trees = plan.trees.map(t => ({...t, hx: t.x + O.x, hy: t.y + O.y, hz: t.z + O.z})).filter(t => region.contains(t.hx, t.hz));
  const shrubs = plan.shrubs.map(t => ({...t, hx: t.x + O.x, hy: t.y + O.y, hz: t.z + O.z})).filter(t => region.contains(t.hx, t.hz) && t.kind !== 'heath');
  for (const id of ROAD_IDS) {
    const bed = bedById.get(id), path = PATHS.get(id), half = bed.width / 2;
    const xs = path.pts.map(p => p.x), zs = path.pts.map(p => p.z), box = [Math.min(...xs) - 20, Math.min(...zs) - 20, Math.max(...xs) + 20, Math.max(...zs) + 20];
    for (const t of trees) { if (t.hx < box[0] || t.hx > box[2] || t.hz < box[1] || t.hz > box[3]) continue; const n = nearestOn(path, t.hx, t.hz); if (Math.abs(t.hy - n.p.y) > 6) continue;
      const c = api.crownOf(t), trunkIn = n.d - c.trunk < half, trunkNear = n.d - c.trunk < half + 1, crownOver = n.d - c.radius < half && t.hy + c.base < n.p.y + 2.8;
      if (trunkIn || trunkNear || crownOver) out.push({road: id, what: `tree:${t.kind}`, station: r1(n.p.s), at: P3(t.hx, t.hy, t.hz), centreDistance: r2(n.d), trunk: r2(c.trunk), crownRadius: r2(c.radius), crownBase: r2(t.hy + c.base - n.p.y),
        severity: trunkIn ? 'MAJOR' : 'MINOR', note: trunkIn ? 'trunk inside the carriageway (drawn, no collision: the rider passes through it)' : trunkNear ? 'trunk within 1 m of the carriageway edge' : 'crown hangs over the carriageway below rider head height'}); }
    for (const t of shrubs) { if (t.hx < box[0] || t.hx > box[2] || t.hz < box[1] || t.hz > box[3]) continue; const n = nearestOn(path, t.hx, t.hz); if (Math.abs(t.hy - n.p.y) > 3) continue;
      const r = t.size * (t.kind === 'hedge' ? t.stretch / 2 : .6); if (n.d - r < half + 1) out.push({road: id, what: `shrub:${t.kind}`, station: r1(n.p.s), at: P3(t.hx, t.hy, t.hz), centreDistance: r2(n.d), radius: r2(r), severity: 'MINOR', note: n.d - r < half ? 'shrub inside the carriageway (drawn, no collision)' : 'shrub within 1 m of the carriageway edge'}); }
  }
  return {trees: trees.length, shrubs: shrubs.length, hits: out};
}
function context(bedId, rows) { // 50 m bins: district, elevation, sea, cliff, Year Walk, town pads, section type
  const path = PATHS.get(bedId), bins = [], yw = YEAR_WALK?.points ?? [];
  const pads = world.collision.pads.filter(p => ['station', 'place', 'host', 'homestead', 'landing', 'reserve'].includes(p.kind) && !p.underground);
  const crossings = world.crossings.filter(c => (c.a === bedId || c.b === bedId) && c.resolution === 'threshold').map(c => nearestOn(path, c.at[0], c.at[1]).p.s);
  for (let s0 = 0; s0 < path.length; s0 += 50) {
    const sub = rows.filter(r => r.s >= s0 && r.s < s0 + 50); if (!sub.length) continue; const mid = sub[Math.floor(sub.length / 2)];
    let sea = null, drop = 0;
    for (const r of sub.filter((_, i) => i % 5 === 0)) { const i = Math.round(r.s / .5), p = path.pts[Math.min(path.pts.length - 1, i)];
      for (const side of [-1, 1]) for (let d = 6; d <= 80; d += 4) { const x = p.x - p.tz * side * d, z = p.z + p.tx * side * d, gr = g.ground(x, z); if (d <= 40) drop = Math.max(drop, p.y - gr);
        if (gr <= .3 && (sea === null || d < sea.d)) { sea = {d, side: side < 0 ? 'left' : 'right'}; break; } } }
    let ywd = Infinity, ywdh = 0; for (const q of yw) { const d = Math.hypot(q[0] - mid.x, q[2] - mid.z); if (d < ywd) { ywd = d; ywdh = q[1] - mid.y; } }
    const nearPads = pads.filter(p => Math.hypot(p.centre[0] - mid.x, p.centre[2] - mid.z) < 45).map(p => p.id);
    const types = new Set(sub.map(r => r.structure ? (/prowTunnel|Tunnel/.test(r.structure) ? 'gallery/tunnel' : 'bridge') : null).filter(Boolean));
    if (crossings.some(c => c >= s0 - 10 && c < s0 + 60)) types.add('junction');
    if (!types.size) types.add('open road');
    bins.push({from: s0, to: Math.min(path.length, s0 + 50), at: [mid.x, mid.y, mid.z], district: mid.district, elevation: mid.y, v2: sub.some(r => r.v2), types: [...types], sea: sea ? `${sea.d} m ${sea.side}` : null, maxDrop40: r1(drop), yearWalk: ywd < 20 ? `${r1(ywd)} m (Δh ${r1(ywdh)})` : null, pads: nearPads, minWidth: Math.min(...sub.map(r => r.width))});
  }
  return bins;
}

// ─── Run ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const drives = [], skippedDrives = [], statics = {}, lipsByBed = {};
if (DRIVE) for (const id of ROAD_IDS) for (const dir of ['fwd', 'rev']) for (const lane of [0, 2]) {
  if (bedById.get(id).width < 6 && lane) continue; // a 5 m spur has no second lane: the +2 m pass would run on its kerb
  if (NATURAL_DOWNHILL) {
    const path = PATHS.get(id), points = path.pts, a = dir === 'fwd' ? points[0] : points.at(-1), b = dir === 'fwd' ? points.at(-1) : points[0];
    if (path.closed || b.y >= a.y - .5) { skippedDrives.push({bed:id,dir,lane,reason:path.closed ? 'closed-loop has no downhill direction' : 'net endpoint drop below 0.5 m',startY:a.y,endY:b.y}); continue; }
  }
  const t = Date.now(), r = runDrive(id, dir, lane); r.wallMs = Date.now() - t; drives.push(r);
  log('drive', id, dir, lane ? 'right+2' : 'centre', `${r.distance} m`, `${r.simSeconds} s sim`, `${r.wallMs} ms`, r.completed ? 'done' : 'INCOMPLETE', `restarts ${r.restarts.length}`);
}
if (STATIC) for (const id of ROAD_IDS) { const t = Date.now(); statics[id] = staticAudit(id); lipsByBed[id] = lipSweep(id); log('static', id, statics[id].length, 'stations', lipsByBed[id].length, 'lip samples', `${Date.now() - t} ms`); }
const junctions = STATIC ? junctionAudit() : [], padRows = STATIC ? padAudit() : [], transitions = STATIC ? transitionAudit() : [];
const bight = STATIC ? bightMismatch() : null, planting = STATIC ? plantingAudit() : {hits: []};
const doubles = STATIC && statics.V01 ? doubleParapets(statics.V01, 'V01') : [];
const contexts = Object.fromEntries(Object.entries(statics).map(([id, rows]) => [id, context(id, rows)]));
log('probes done');

// ─── Static rows → events (runs of consecutive stations) ───────────────────────────────────────────────────────────
function runs(rows, test, make) { let cur = null; const flush = () => { if (cur) { make(cur); cur = null; } };
  for (const r of rows) { const v = test(r); if (v) { if (!cur) cur = {from: r.s, to: r.s, rows: [], worst: null}; cur.to = r.s; cur.rows.push({r, v}); if (!cur.worst || v.score > cur.worst.v.score) cur.worst = {r, v}; } else flush(); }
  flush(); }
for (const [id, rows] of Object.entries(statics)) {
  const bed = bedById.get(id), half = bed.width / 2, edgeOf = half + (bed.shoulder ?? 0), minWidth = bed.width >= 8 ? 7 : bed.width - .5, tag = {bed: id, dir: 'static'};
  const span = c => [c.from, c.to], atOf = r => P3(r.x, r.y, r.z);
  runs(rows, r => r.width < r.minWidth ? {score: r.minWidth - r.width} : null, c => { const r = c.worst.r; event({...tag, type: 'narrow', severity: 'MAJOR', station: span(c), at: atOf(r), value: r.width, unit: 'm usable', ids: [r.left.id, r.right.id].filter(Boolean),
    note: `usable width ${r.width} m (< ${r.minWidth}): left ${r.left.kind}${r.left.id ? ' ' + r.left.id : ''} at ${r.left.d} m, right ${r.right.kind}${r.right.id ? ' ' + r.right.id : ''} at ${r.right.d} m`}); });
  for (const side of ['left', 'right']) {
    runs(rows, r => r[side].kind === 'drop' && r[side].depth > 1.25 && r[side].d <= r.edge + 1.5 ? {score: r[side].depth} : null, c => { const r = c.worst.r; event({...tag, type: 'missing-guard', severity: 'MAJOR', side, station: span(c), at: atOf(r), value: r[side].depth, unit: 'm drop', lateral: r[side].d, ids: [r[side].onto],
      note: `${side} edge: ${r[side].depth} m drop at ${r[side].d} m from centre with no guard (onto ${r[side].onto}${r.structure ? ', on ' + r.structure : ''}) over ${r1(c.to - c.from + STATION)} m`}); });
    runs(rows, r => r[side].kind === 'drop' && r[side].depth > 1.25 && r[side].d > r.edge + 1.5 ? {score: r[side].depth} : null, c => { const r = c.worst.r; event({...tag, type: 'verge-drop', severity: 'MINOR', side, station: span(c), at: atOf(r), value: r[side].depth, unit: 'm drop', lateral: r[side].d,
      note: `${side}: ${r[side].depth} m drop ${r[side].d} m from centre (beyond the ${edgeOf} m edge + 1.5 m verge; no guard needed by the bake rule)`}); });
    runs(rows, r => r[side].kind === 'drop' && r[side].depth > .5 && r[side].depth <= 1.25 && r[side].d <= r.half + (bed.shoulder ?? 0) + .5 ? {score: r[side].depth} : null, c => { const r = c.worst.r; event({...tag, type: 'unguarded-step', severity: 'MINOR', side, station: span(c), at: atOf(r), value: r[side].depth, unit: 'm drop', lateral: r[side].d,
      note: `${side} edge: ${r[side].depth} m step off at ${r[side].d} m (launches the cruiser if it drifts out: groundSnap ${C.groundSnap})`}); });
    runs(rows, r => r.float?.[side[0].toUpperCase()] && !r.float[side[0].toUpperCase()].supported.length ? {score: r.float[side[0].toUpperCase()].gap} : null, c => { const r = c.worst.r, f = r.float[side[0].toUpperCase()]; event({...tag, type: 'floating-edge', severity: f.gap > 1 ? 'MAJOR' : 'MINOR', side, station: span(c), at: atOf(r), value: f.gap, unit: 'm gap',
      note: `${side} deck edge hangs ${f.gap} m over the terrain with no retaining wall or parapet, over ${r1(c.to - c.from + STATION)} m`}); });
    runs(rows, r => r[side].kind === 'blocker' && !r[side].ownedGuard && r[side].d < r.half ? {score: r.half - r[side].d} : null, c => { const r = c.worst.r, d = describe(r[side].id); event({...tag, type: 'obstruction', severity: 'MAJOR', side, station: span(c), at: atOf(r), value: r[side].d, unit: 'm from centre', ids: [r[side].id], kind: d?.kind, role: d?.role,
      note: `${d?.kind}/${d?.role} ${r[side].id} inside the carriageway at ${r[side].d} m from centre`}); });
  }
  runs(rows, r => r.buried > .05 ? {score: r.buried} : null, c => { const r = c.worst.r; event({...tag, type: 'buried', severity: r.buried > .48 ? 'BLOCKER' : r.buried > .15 ? 'MAJOR' : 'MINOR', station: span(c), at: r.buriedAt ? P3(r.buriedAt[0], r.y + r.buried, r.buriedAt[1]) : atOf(r), value: r.buried, unit: 'm terrain above deck',
    note: `visible terrain ${r.buried} m above the deck inside the carriageway over ${r1(c.to - c.from + STATION)} m${r.v2 ? ' (Mountain v2 ground)' : ''}`}); });
  runs(rows, r => r.ceiling !== null && r.ceiling < 5 ? {score: 5 - r.ceiling} : null, c => { const r = c.worst.r; event({...tag, type: 'headroom', severity: r.ceiling < C.height + .05 ? 'BLOCKER' : 'MAJOR', station: span(c), at: atOf(r), value: r.ceiling, unit: 'm clear', ids: [r.ceilingId],
    note: `${r.ceiling} m headroom under ${r.ceilingId} at ${r.ceilingAt} m from centre (profile clear 5 m; cruiser needs ${C.height} m)`}); });
  // Scenery: aggregate by solid id.
  const scen = new Map(); for (const r of rows) for (const s of r.scenery) { const e = scen.get(s.id) ?? {id: s.id, from: r.s, to: r.s, minD: Infinity, lowest: Infinity, dynamic: s.dynamic, r}; e.to = r.s; if (Math.abs(s.d) < e.minD) { e.minD = Math.abs(s.d); e.r = r; } e.lowest = Math.min(e.lowest, s.above); scen.set(s.id, e); }
  for (const e of scen.values()) { const d = describe(e.id), inside = e.minD <= e.r.half, body = e.lowest <= 1.25;
    event({...tag, type: 'scenery', severity: inside && body ? 'MAJOR' : 'MINOR', station: [e.from, e.to], at: atOf(e.r), value: r2(e.minD), unit: 'm from centre', ids: [e.id], kind: d?.kind, role: d?.role,
      note: `${d?.kind}/${d?.role} ${e.id} ${inside ? 'inside the carriageway' : 'within 1 m of it'} (${r2(e.minD)} m from centre, lowest face ${r2(e.lowest)} m above the deck)`}); }
  // Grade per 10 m on the physical centre surface.
  const ys = rows.map(r => r.surfaceY ?? r.y), per = Math.max(1, Math.round(10 / STATION));
  const grades = rows.map((r, i) => i + per < rows.length ? Math.abs(ys[i + per] - ys[i]) / (rows[i + per].s - r.s) : 0);
  runs(rows.map((r, i) => ({...r, grade: grades[i]})), r => r.grade > .08 ? {score: r.grade} : null, c => { const r = c.worst.r; event({...tag, type: 'grade', severity: r.grade > .12 ? 'MAJOR' : 'MINOR', station: [c.from, c.to + 10], at: atOf(r), value: r2(r.grade * 100), unit: '% max', length: r1(c.to - c.from + 10),
    note: `${r1(c.to - c.from + 10)} m over 8 % (max ${r1(r.grade * 100)} % per 10 m)${r.grade > .12 ? ' — over the 12 % profile maximum' : ''}`}); });
  // Kerb coverage (fact, not an event).
  statics[id].kerbCoverage = {left: r2(rows.filter(r => r.kerbL).length / rows.length), right: r2(rows.filter(r => r.kerbR).length / rows.length)};
  // Lips along the lateral lines: merge within 1 m.
  const lips = (lipsByBed[id] ?? []).filter(l => Math.abs(l.off) <= halfAt(id,l.s)).sort((a, b) => a.s - b.s); let cur = null;
  const flushLip = () => { if (!cur) return; const w = cur.worst;
    event({...tag, type: w.seam ? 'seam' : 'lip', severity: lipSeverity(w), station: [r1(cur.from), r1(cur.to)], at: P3(w.x, w.y, w.z), value: Number.isFinite(w.dy) ? r3(w.dy) : null, unit: 'm step', ids: [w.from, w.to ?? w.via].filter(Boolean), lines: [...new Set(cur.offs)].map(r2),
      note: `${lipText(w)} on lines ${[...new Set(cur.offs)].map(r2).join(', ')} m`}); cur = null; };
  for (const l of lips) { if (cur && l.s - cur.to <= 1) { cur.to = l.s; cur.offs.push(l.off); if (lipRank(l) < lipRank(cur.worst)) cur.worst = l; } else { flushLip(); cur = {from: l.s, to: l.s, offs: [l.off], worst: l}; } }
  flushLip();
}
for (const j of junctions) { if (!j.lips.length) continue; const w = [...j.lips].sort((x, y) => lipRank(x) - lipRank(y))[0];
  event({bed: j.road, dir: 'static', type: 'junction-lip', severity: lipSeverity(w), station: [j.station, j.station], at: w.at, value: Number.isFinite(w.dy) ? r3(w.dy) : null, unit: 'm step', ids: [w.from, w.to].filter(Boolean), junction: j.crossing, count: j.lips.length,
    note: `junction ${j.crossing} (${j.road} × ${j.other}): ${j.lips.length} lips > 0.08 m; worst on ${w.line} at ${w.s} m: ${lipText(w)}`}); }
for (const p of padRows) { if (!p.lips.length) continue; const w = [...p.lips].sort((x, y) => lipRank(x) - lipRank(y))[0];
  event({bed: p.road, dir: 'static', type: 'pad-lip', severity: lipSeverity(w), station: [p.station, p.station], at: w.at, value: Number.isFinite(w.dy) ? r3(w.dy) : null, unit: 'm step', ids: [w.from, w.to].filter(Boolean), pad: p.pad, count: p.lips.length,
    note: `pad ${p.pad} (${p.kind}, top ${p.padY} vs road bed ${p.roadY}): ${p.lips.length} lips between the road and 4 m inside the pad; worst ${w.s} m out from the road centre: ${lipText(w)}`}); }
for (const t of transitions) { const w = [...t.lips].sort((x, y) => lipRank(x) - lipRank(y))[0];
  if (Math.abs(t.bedStep) > .05 || w) event({bed: t.road, dir: 'static', type: 'transition', severity: w ? lipSeverity(w) : 'MINOR', station: [t.station, t.station], at: w?.at ?? null, value: w && Number.isFinite(w.dy) ? r3(w.dy) : t.bedStep, unit: 'm step', ids: w ? [w.from, w.to].filter(Boolean) : [t.structure], structure: t.structure,
    note: `${t.structure} ${t.end}: structure bed ${t.structureY} vs road bed ${t.roadBedY} (Δ ${t.bedStep} m, plan offset ${t.offset} m)${w ? `; ${t.lips.length} lips > 0.08 m within ±15 m, worst on line ${w.off} m at ${w.s} m: ${lipText(w)}` : '; no lip > 0.08 m within ±15 m'}`}); }
for (const p of planting.hits) event({bed: p.road, dir: 'static', type: 'planting', severity: p.severity, station: [p.station, p.station], at: p.at, value: p.centreDistance, unit: 'm from centre', ids: [p.what], note: `Mountain v2 ${p.what} ${p.note} (${p.centreDistance} m from centre)`});
if (bight && Math.abs(bight.max.lateral) > .25) event({bed: 'V01', dir: 'static', type: 'frame-mismatch', severity: bight.v01Edge + Math.abs(bight.max.lateral) > bight.deckHalf ? 'MAJOR' : 'MINOR', station: [bight.stations[0]?.s ?? 0, bight.stations.at(-1)?.s ?? 0], at: null, value: bight.max.lateral, unit: 'm lateral', ids: ['bightBridge.deck'],
  note: `V01 spline vs the Bight Bridge straight frame: up to ${bight.max.lateral} m lateral at station ${bight.max.s} (deck half-width ${bight.deckHalf}, V01 edge ${bight.v01Edge})`});
if (doubles.length) { const byS = doubles.map(d => d.s); event({bed: 'V01', dir: 'static', type: 'double-parapet', severity: 'MINOR', station: [Math.min(...byS), Math.max(...byS)], at: null, value: doubles.length, unit: 'station-sides', ids: [...new Set(doubles.flatMap(d => d.rails.map(r => r.id)))],
  note: `two or more rail solids on one side of the deck at ${doubles.length} station-sides (${[...new Set(doubles.flatMap(d => d.rails.map(r => r.id)))].join(', ')})`}); }

// Static findings carry what the real drives did within ±6 m of them (so "a lip exists" and "the cruiser felt it" are separate facts).
{ const drivingTypes = new Set(['stall', 'airborne', 'contact', 'drive-lip', 'off-bed', 'lost', 'surface-mismatch']);
  const st = e => Array.isArray(e.station) ? e.station : [e.station, e.station];
  for (const e of events) { if (e.dir !== 'static' || !Array.isArray(e.station)) continue; const [a, b] = st(e);
    const near = events.filter(d => d.bed === e.bed && drivingTypes.has(d.type) && st(d)[0] <= b + 6 && st(d)[1] >= a - 6);
    if (near.length) e.drive = [...new Set(near.map(d => `${d.type}:${d.pass}`))]; } }
// ─── Aggregation and output ─────────────────────────────────────────────────────────────────────────────────────────
const SEV = {BLOCKER: 0, MAJOR: 1, MINOR: 2};
const stationOf = e => Array.isArray(e.station) ? e.station[0] : e.station;
/** Driving events of the same type within 6 m across passes collapse into one issue listing the passes that saw it. */
function issues(bedId) {
  const list = events.filter(e => e.bed === bedId), out = [];
  const drivingTypes = new Set(['stall', 'airborne', 'contact', 'drive-lip', 'off-bed', 'lost', 'slow-corner', 'surface-mismatch', 'incomplete', 'start-invalid']);
  const groups = new Map();
  for (const e of list) { if (!drivingTypes.has(e.type)) { out.push({...e, passes: ['static']}); continue; }
    const key = `${e.type}|${e.ids?.[0] ?? ''}`, arr = groups.get(key) ?? []; groups.set(key, arr);
    const s = stationOf(e), hit = arr.find(gp => Math.abs(gp.s - s) <= 6 || (Array.isArray(e.station) && e.station[0] <= gp.s1 + 6 && e.station[1] >= gp.s - 6));
    if (hit) { hit.events.push(e); hit.s1 = Math.max(hit.s1, Array.isArray(e.station) ? e.station[1] : s); } else arr.push({s, s1: Array.isArray(e.station) ? e.station[1] : s, events: [e]}); }
  for (const arr of groups.values()) for (const gp of arr) { const worst = gp.events.reduce((a, b) => SEV[b.severity] < SEV[a.severity] || (SEV[b.severity] === SEV[a.severity] && Math.abs(b.value ?? 0) > Math.abs(a.value ?? 0)) ? b : a);
    out.push({...worst, station: [r1(Math.min(...gp.events.map(stationOf))), r1(gp.s1)], passes: [...new Set(gp.events.map(e => e.pass))], count: gp.events.length}); }
  return out.sort((a, b) => SEV[a.severity] - SEV[b.severity] || stationOf(a) - stationOf(b));
}
const byBed = Object.fromEntries(ROAD_IDS.map(id => [id, issues(id)]));
const totals = Object.fromEntries(ROAD_IDS.map(id => [id, {BLOCKER: 0, MAJOR: 0, MINOR: 0, ...Object.fromEntries(Object.entries(byBed[id].reduce((m, e) => (m[e.severity] = (m[e.severity] ?? 0) + 1, m), {})))}]));
const wallSeconds = r1((Date.now() - T0) / 1000);
const command = `node scripts/horizon/road-audit.mjs ${argv.join(' ')}`.trim();
mkdirSync(OUT, {recursive: true});
let currentCodeHead = 'unknown'; try { currentCodeHead = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(); } catch { /* not a checkout */ }
const meta = {scenario:{id:SCENARIO, downhillOnly:NATURAL_DOWNHILL, minimumEndpointDropM:NATURAL_DOWNHILL ? .5 : null,
    recoveryThrottleBelowMps:NATURAL_DOWNHILL ? 1.5 : null, brakePolicy:NATURAL_DOWNHILL ? 'always zero; forward is 1 below recovery speed, otherwise 0' : 'existing curvature/braking plan',
    restartPolicy:NATURAL_DOWNHILL ? 'none; exact initial pose only; stop at first stall/loss/kernel recovery' : 'existing logged 6–8 m restart after stall/loss',
    unchangedPhysics:true, physicalGripMargin:null,
    limits:['Cruiser grip is lateral velocity damping exp(-22*dt), not a finite tyre-force limit.',
      'Grounded cruiser motion has no downhill gravitational acceleration; zero input coasts toward rest. The natural-downhill scenario uses unpaced/no-brake input; it is not a gravitational free-roll test.',
      'Original time limit total/3+180 seconds and failure thresholds are unchanged; low-speed recovery can exhaust this limit before the endpoint.',
      'steeringInputReserve=1-abs(steer) is command headroom, not physical grip margin; old radius/lateralDemand fields are centreline estimates.']},
  telemetry:{sampleIntervalSeconds:12*C.dt, includesFirstAndLastStep:true, station:'post-step local projection into canonical plan metres; legacy s is the pre-step 0.5 m nearest sample',
    derivatives:'one real controller timestep; velocity curvature only above 0.25 m/s at both ends', physicalGripMargin:null},
  baselineRef, auditorSha256: sha(readFileSync(fileURLToPath(import.meta.url))), currentCodeHead, comparisonMethod: 'Both asset sets use current auditor and controller/geography source; not a historical runtime replay.', generated: new Date().toISOString(), command, root: ROOT, rootSha, wallSeconds, node: process.version, cpus: os.cpus().length,
  sourceProof: {runtimeBundleSha256:sha(bundle.outputFiles[0].text),telemetryHelperSha256:sha(readFileSync(resolve(ROOT,'scripts/horizon/mountain-audit-telemetry.mjs'))),auditSha256:sha(readFileSync(resolve(ROOT,'scripts/horizon/road-audit.mjs')))},
  bake: {world: WORLD_PATH.replace(ROOT + '/', ''), worldSha256: sha(worldBytes), terrain: TERRAIN_PATH.replace(ROOT + '/', ''), terrainSha256: sha(terrainBytes), revision: world.geographyRevision},
  cruiser: {...C}, driver: {speedPlanApplied:!NATURAL_DOWNHILL,lookahead: '6–8 m (6 + 0.125·v)', lateralAccel: A_LAT, planDecel: B_DEC, laneOffsets: [0, 2], note: NATURAL_DOWNHILL ? 'same pure pursuit through stepCruiser at CRUISER.dt; zero brake, low-speed recovery throttle only, no audit restart' : 'pure pursuit on the lane line through stepCruiser at CRUISER.dt; no snapping; a restart (logged) only after a 2 s stall or leaving the corridor'},
  driveEnabled:DRIVE, staticEnabled:STATIC, mountainChain:MOUNTAIN_CHAIN, stationStep: STATION, roads: ROAD_IDS};
writeFileSync(resolve(OUT, 'audit.json'), JSON.stringify({meta, chainReaches, telemetry, totals, drives, skippedDrives, issues: byBed, events, junctions, pads: padRows.filter(p => p.lips.length), transitions, bightBridge: bight, doubleParapets: doubles,
  planting: {trees: planting.trees, shrubs: planting.shrubs, hits: planting.hits}, context: contexts, kerbCoverage: Object.fromEntries(Object.entries(statics).map(([id, r]) => [id, r.kerbCoverage])),
  stations: Object.fromEntries(Object.entries(statics).map(([id, rows]) => [id, rows.map(r => ({s: r.s, at: [r.x, r.y, r.z], w: r.width, L: r.left.kind, Ld: r.left.d, R: r.right.kind, Rd: r.right.d, st: r.structure, ceil: r.ceiling, bur: r.buried, kL: r.kerbL, kR: r.kerbR, surf: r.surface, leftEdge:r.left, rightEdge:r.right}))]))}, null, 1));

// Markdown.
const fmtAt = a => a ? `[${a.map(v => Math.round(v * 10) / 10).join(', ')}]` : '—';
const fmtSt = s => Array.isArray(s) ? (s[0] === s[1] ? `${s[0]}` : `${s[0]}–${s[1]}`) : `${s}`;
const esc = t => String(t ?? '').replace(/\|/g, '\\|');
let md = `# Horizon road audit — ${arg('--title', 'before')}\n\nDriver's-eye audit of the committed bake with the real cruiser sim (\`stepCruiser\`, CRUISER.dt = 1/120 s). Read-only: nothing under \`src/\` or \`public/\` was changed.\n\n`;
md += `- Command: \`${command}\` (from ${ROOT === process.cwd() ? 'the repo root' : `\`${relative(process.cwd(), ROOT) || '.'}\``})\n- Checkout: \`${rootSha}\`; world \`${meta.bake.world}\` sha256 \`${meta.bake.worldSha256.slice(0, 16)}…\`, terrain sha256 \`${meta.bake.terrainSha256.slice(0, 16)}…\` (${world.geographyRevision})\n`;
md += `- Wall-clock: **${wallSeconds} s** on ${meta.cpus} CPUs (${process.version}); generated ${meta.generated}\n- Roads: ${ROAD_IDS.join(', ')}\n\n`;
md += `**Scope:** drive ${DRIVE ? 'enabled' : 'disabled'}; static sweep ${STATIC ? 'enabled' : 'disabled'}. ${MOUNTAIN_CHAIN ? 'The mountain chain shares its source with the bake and varies width at each station. Endpoint completion after restarts is not uninterrupted acceptance.' : ''}\n\n`;
md += `## Method\n\n- **World**: \`parseHorizonDefinition(horizon-geo-1.json.gz)\` + \`decodeTerrainAsset(bin,'full')\` + \`createHorizonGeography(field,{...collision, solids, diagnostics})\` + \`addDynamic(createMountainV2Region(...).provider)\` — the loader of \`test/horizonRideSituations.test.ts\`.\n`;
if (NATURAL_DOWNHILL) md += `- **Drive (separate natural-downhill scenario)**: the same pure pursuit, on open routes with more than 0.5 m net endpoint descent only. Ordinary input is throttle 1 below 1.5 m/s and coast 0 otherwise; brake and jump are always zero. No curvature speed target is applied. Each pass starts once at its first resampled endpoint pose; no search ahead, audit restart, position snapping or controller tuning. First stall/loss/kernel recovery ends the attempt. Existing time limit and failure thresholds are unchanged.\n`;
else md += `- **Drive**: pure pursuit (lookahead 6–8 m) on the lane line; target speed = min(${C.speed}, √(${A_LAT}/κ)) braked back at ${B_DEC} m/s²; throttle/coast/brake only through \`stepCruiser\` inputs; no snapping. Passes: forward and reverse, centreline and keep-right +2 m (5 m-wide spurs: centreline only). V01 is driven round the whole loop (+10 m). A stall longer than 2 s, or leaving the corridor (> half-width + shoulder + 5 m, or 4 m below the bed), is logged and the drive restarts 6–8 m further on (listed per pass).\n`;
md += `- **Telemetry and limits**: actual velocity, body heading, input steer and one-step heading/velocity derivatives are sampled every ${12*C.dt} s plus first/last steps. Native spatial hairpin stations are explicitly mapped to chain plan stations from matching baked/source points. Steering reserve is input headroom only. Grip is damping exp(-22·dt), so physical tyre-force margin is unavailable. The grounded cruiser has no downhill gravitational acceleration; coasting decelerates toward rest. This scenario cannot measure an inertial downhill top speed.\n`;
md += `- **Static** (every ${STATION} m station, no driving): *lateral scan* both sides in 0.25 m steps from the centreline at the deck height — \`geography.contact\` (r 0.2) at the rider's body band, surface continuity (±0.5 m), water, > ${C.maxSlope}°, or no ground; a transverse crack between segment prisms (deck continues 0.15 m either side along the road, or within 0.6 m further out) is stepped over, not an edge → usable width, drop depth beyond the first edge. *Missing guard* = a drop > 1.25 m that starts within the bed edge + 1.5 m with no rail/wall stopping the scan first (drops further out are listed as MINOR \`verge-drop\`). *Unguarded step* = 0.5–1.25 m drop at the edge. *Buried* = visible terrain above the deck at five points across the carriageway (skipped under a roof whose underside is below that terrain). *Floating edge* = deck-edge bottom (deck − 0.6 m) more than 0.3 m above the terrain 0.3 m outside the edge with no wall/rail/support solid below it (not on structures). *Headroom* = every downward-facing static face whose plan falls inside the carriageway box of that station with its underside 0.1–5 m above the deck (this road's own parapet coping excluded), plus the dynamic (Mountain v2) ceiling. *Native owned guards* remain physical width limits and controller contacts; only duplicate scenery/obstruction labels are omitted when source endpoints, station, level and edge placement agree. Intrusions and adjacent road levels retain their findings. *Kerbs* = own kerb solid at ±half-width. *Scenery* = non-walkable static solids not belonging to the road, and v2 dynamic solids except verified same-station, same-level native edge guards, within the carriageway + 1 m, 0.3–4.5 m above the deck.\n`;
md += `- **Lips** (every 0.1 m along five lines at 0, ±0.375, ±0.75 × half-width, interpolated so a line never cuts a corner): step in the physical surface with the local grade removed, > 0.08 m. A run of steps that returns to its starting height within 0.6 m is one *crack* (gap) or *ridge* — the 1.12 m wheelbase bridges a crack ≤ 0.3 m wide, so such a crack is MAJOR only when deeper than groundSnap (a foot, a board wheel or the rider's centre can fall in), else MINOR. *Junctions*: every threshold crossing of a road — the other route's bed ±20 m (to the road edge + 6 m) and the road ±15 m on three lines. *Pads*: every non-threshold pad within reach of a road — three lines from the road into 4 m inside the pad. *Transitions*: ±15 m on five lines at every structure-bed end within 12 m of a road. *v2 planting*: \`mountainPlanting('full')\` trees and shrubs kept where the region draws them, against every road (trunk inside the carriageway, within 1 m of it, or crown below 2.8 m over it).\n`;
md += `- **Cross-reference**: every static finding lists the driving events (type:pass) within ±6 m of it, so "a lip exists" and "the cruiser felt it" stay separate facts.\n`;
md += `- **Sampling**: nothing was sub-sampled beyond the steps above; the whole run took ${wallSeconds} s.\n`;
md += `- **Severity**: BLOCKER = stops or launches the cruiser (stall, airborne > 0.1 s, lip up > ${C.stepHeight} m or down > ${C.groundSnap} m that is not a narrow crack, hole), buries it (terrain > 0.48 m over the deck), or headroom < ${C.height} m. MAJOR = lip > 0.15 m, crack deeper than ${C.groundSnap} m, missing guard over a > 1.25 m drop, usable width < 7 m (8 m roads) / < width − 0.5 m (5 m spurs), grade > 12 % per 10 m, contact while inside the carriageway, obstruction inside the carriageway at body height, buried 0.15–0.48 m, floating edge > 1 m, headroom < 5 m, v2 tree trunk in the carriageway, the Bight Bridge frame mismatch when V01's edge leaves the deck. MINOR otherwise.\n\n`;
md += `## Totals\n\n| Road | Length m | BLOCKER | MAJOR | MINOR | Drives (dir/lane: distance, restarts) | Kerb cover L/R |\n|---|---:|---:|---:|---:|---|---|\n`;
for (const id of ROAD_IDS) { const d = drives.filter(r => r.bed === id); md += `| ${id} | ${r1(PATHS.get(id).length)} | ${totals[id].BLOCKER} | ${totals[id].MAJOR} | ${totals[id].MINOR} | ${d.map(r => `${r.pass}: ${r.distance} m${r.completed ? '' : ' (incomplete)'}, ${r.restarts.length}r`).join('; ')} | ${statics[id]?.kerbCoverage ? `${Math.round(statics[id].kerbCoverage.left * 100)}% / ${Math.round(statics[id].kerbCoverage.right * 100)}%` : '—'} |\n`; }
const all = ROAD_IDS.reduce((m, id) => { for (const k of ['BLOCKER', 'MAJOR', 'MINOR']) m[k] += totals[id][k]; return m; }, {BLOCKER: 0, MAJOR: 0, MINOR: 0});
md += `| **all** | | **${all.BLOCKER}** | **${all.MAJOR}** | **${all.MINOR}** | | |\n\n`;
md += `Issue counts are after merging the same driving event (same type and solid within 6 m) across passes and merging static stations into runs.\n\n`;
// Top issues: BLOCKER then MAJOR, main roads first, then by magnitude; one line each.
{ const order = ['V01', 'VG', 'V03', 'VBS'], rank = id => { const i = order.indexOf(id); return i < 0 ? 9 : i; };
  const all = ROAD_IDS.flatMap(id => byBed[id].map(e => ({...e, bed: id})));
  const top = all.filter(e => e.severity !== 'MINOR' && !['seam'].includes(e.type) || e.severity === 'BLOCKER')
    .sort((a, b) => SEV[a.severity] - SEV[b.severity] || rank(a.bed) - rank(b.bed) || Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0)).slice(0, 60);
  md += `## Top issues (BLOCKER, then MAJOR; main roads first)\n\n| # | Sev | Road | Station m | At [x, y, z] | Type | Cause | Seen by drives |\n|---:|---|---|---|---|---|---|---|\n`;
  top.forEach((e, i) => { md += `| ${i + 1} | ${e.severity} | ${e.bed} | ${fmtSt(e.station)} | ${fmtAt(e.at)} | ${e.type} | ${esc(e.note)} | ${e.dir === 'static' ? esc((e.drive ?? []).join(', ') || '—') : esc((e.passes ?? []).join(', '))} |\n`; });
  md += `\n`; }
// Route context: consecutive 50 m bins of V01 merged by character.
if (contexts.V01) {
  const kind = b => b.types.includes('bridge') ? 'bridge' : b.types.includes('gallery/tunnel') ? 'gallery' : b.sea && parseFloat(b.sea) <= 40 && b.maxDrop40 > 15 ? 'coastal cliff' : b.sea && parseFloat(b.sea) <= 80 ? 'coastal' : b.pads.some(p => /^town\.|^station\.|^host\.|^homestead|^place\.|tidelinePark|kittyPlaza/.test(p)) ? 'developed' : 'open';
  const groups = []; for (const b of contexts.V01) { const k = kind(b), last = groups.at(-1); if (last && last.kind === k) { last.to = b.to; last.bins.push(b); } else groups.push({kind: k, from: b.from, to: b.to, bins: [b]}); }
  md += `## V01 route character (derived from the 50 m bins below)\n\n| Stations m | Character | Districts | Elevation m | Year Walk beside | Pads |\n|---|---|---|---|---|---|\n`;
  for (const gp of groups) { const d = [...new Set(gp.bins.map(b => b.district))].join(', '), el = gp.bins.map(b => b.elevation), yw = gp.bins.filter(b => b.yearWalk).length, pads = [...new Set(gp.bins.flatMap(b => b.pads))];
    md += `| ${gp.from}–${r1(gp.to)} | ${gp.kind} | ${d} | ${r1(Math.min(...el))}–${r1(Math.max(...el))} | ${yw ? `${yw}/${gp.bins.length} bins` : '—'} | ${esc(pads.slice(0, 5).join(', '))}${pads.length > 5 ? ' …' : ''} |\n`; }
  md += `\nRule: bridge/gallery from the deck under the centreline; *coastal cliff* = sea (terrain ≤ 0.3) within 40 m of the centreline and more than 15 m of drop within 40 m; *coastal* = sea within 80 m; *developed* = a station, town, host, homestead or place pad within 45 m; else *open*.\n\n`;
}
if (statics.V01) {
  md += `## V01 station chart (50 m bins)\n\n| Station m | Section | District | Elev m | Sea | Max drop ≤40 m | Year Walk alongside | Min width m | Pads within 45 m |\n|---|---|---|---:|---|---:|---|---:|---|\n`;
  for (const b of contexts.V01) md += `| ${b.from}–${r1(b.to)} | ${b.types.join(', ')}${b.v2 ? ' (v2 ground)' : ''} | ${b.district} | ${r1(b.elevation)} | ${b.sea ?? '—'} | ${b.maxDrop40} | ${b.yearWalk ?? '—'} | ${b.minWidth} | ${esc(b.pads.slice(0, 4).join(', '))}${b.pads.length > 4 ? ' …' : ''} |\n`;
  md += `\n`;
}
for (const id of ROAD_IDS) {
  const list = byBed[id]; md += `## ${id} — ${bedById.get(id).width} m bed, ${r1(PATHS.get(id).length)} m${PATHS.get(id).closed ? ' (closed loop)' : ''}\n\n`;
  const d = drives.filter(r => r.bed === id);
  if (d.length) { md += `Drives: ${d.map(r => `**${r.pass}** ${r.distance} m in ${r.simSeconds} s sim (mean ${r.meanSpeed} m/s, max ${r1(r.maxSpeed)}), ${r.contacts} contact steps, ${r.airborneSteps} airborne steps${r.hops ? `, ${r.hops} hops ≤ 0.1 s` : ''}${r.restarts.length ? `, restarts: ${r.restarts.map(x => `${x.why} @${x.fromStation}`).join('; ')}` : ''}`).join(' · ')}\n\n`; }
  if (!list.length) { md += `No issues.\n\n`; continue; }
  md += `| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |\n|---|---|---|---|---|---|---|\n`;
  for (const e of list) md += `| ${e.severity} | ${e.type} | ${fmtSt(e.station)} | ${fmtAt(e.at)} | ${e.value ?? '—'} ${e.unit ?? ''} | ${esc((e.passes ?? []).join(', '))}${e.count > 1 ? ` (${e.count}×)` : ''} | ${esc(e.note)} |\n`;
  md += `\n`;
}
if (bight) { md += `## Bight Bridge frame vs V01 spline\n\nStraight frame ${JSON.stringify(bight.frame)} (deck ${bight.deckWidth} m); V01 half-width + shoulder ${bight.v01Edge} m. Max lateral offset of the V01 centreline from the frame: **${bight.max.lateral} m** at station ${bight.max.s}.\n\n| V01 station | t on frame | lateral m | heading Δ° |\n|---:|---:|---:|---:|\n${bight.stations.map(r => `| ${r.s} | ${r.t} | ${r.lateral} | ${r.headingDeg} |`).join('\n')}\n\n`; }
md += `## Structure transitions\n\n| Structure | End | Road | Station | Structure bed y | Road bed y | Δ | Lips > 0.08 (±15 m, 5 lines) | Worst |\n|---|---|---|---:|---:|---:|---:|---:|---|\n`;
for (const t of transitions) { const w = [...t.lips].sort((a, b) => lipRank(a) - lipRank(b))[0]; md += `| ${t.structure} | ${t.end} | ${t.road} | ${t.station} | ${t.structureY} | ${t.roadBedY} | ${t.bedStep} | ${t.lips.length} | ${w ? `${lipSeverity(w)}: ${esc(lipText(w))} @ ${fmtAt(w.at)}` : '—'} |\n`; }
md += `\n## Junctions (threshold crossings)\n\n| Crossing | Road | Other | Station | Lips > 0.08 | Worst |\n|---|---|---|---:|---:|---|\n`;
for (const j of junctions) { const w = [...j.lips].sort((a, b) => lipRank(a) - lipRank(b))[0]; md += `| ${j.crossing} | ${j.road} | ${esc(j.other)} | ${j.station} | ${j.lips.length} | ${w ? `${lipSeverity(w)}: ${esc(lipText(w))} on ${esc(w.line)} @ ${fmtAt(w.at)}` : '—'}${j.note ? ` (${j.note})` : ''} |\n`; }
md += `\n## Pads touching a road\n\n| Pad | Kind | Road | Station | Pad top | Road bed | Lips | Worst |\n|---|---|---|---:|---:|---:|---:|---|\n`;
for (const p of padRows) { const w = [...p.lips].sort((a, b) => lipRank(a) - lipRank(b))[0]; md += `| ${p.pad} | ${p.kind} | ${p.road} | ${p.station} | ${p.padY} | ${p.roadY} | ${p.lips.length} | ${w ? `${lipSeverity(w)}: ${esc(lipText(w))} @ ${fmtAt(w.at)}` : '—'} |\n`; }
md += `\n## Limits of this audit\n\n- Board, bicycle and walker bodies are not driven here (their kernels treat 0.10–0.12 m as a wall); only the cruiser.\n- Visual-only checks (markings, lighting, texture) are out of scope; \`scenery\` covers collision solids and v2 planting positions only. Horizon land has no planting of its own in this bake.\n- The Mountain v2 provider is registered always-drawn (\`provider\`), as the ride tests do; at runtime its decks answer only while its scene is drawn.\n- The driver is scripted: a human steers differently. Contacts on the +2 m lane on narrow stretches are expected physics, graded by whether the rider was still inside the carriageway.\n- Only the cruiser's own collision queries are used; the camera (\`cameraBlocked\`) and visual pop-in are not audited.\n- Debug aids: \`--trace <bed>:<fwd|rev>:<0|2>:<from>:<to>\` prints every step of one pass in a station window; \`--probe-line x0,z0,x1,z1,y\` prints the surface every 0.1 m along a line and the lips found.\n`;
writeFileSync(resolve(OUT, 'AUDIT.md'), md);
log('wrote', resolve(OUT, 'audit.json'), resolve(OUT, 'AUDIT.md'), `events ${events.length}`, JSON.stringify(all));
