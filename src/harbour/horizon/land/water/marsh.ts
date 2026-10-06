import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { LandCuts, WaterCut, XY, XYZ } from '../interfaces';
import { box, districtAt, mitredSlab, nearestOnPath, prism, solid } from '../structures/mesh';
import { greenwayLine } from '../structures/greenway';
import { OPEN_RAIL_KIND, openRail } from '../structures/openRail';

/**
 * The Water's Way — scraped marsh pools along the Greenway and the Reach's side trail (D-WW23: "scraped pools ≤ 0.3 m";
 * MANIFEST structures.greenway.pools). The prototype's rule (_marsh.mjs `pools()`, mulberry32 seed 4242) regenerated on the
 * real line and the bake's own ground before the pools (createTerrainCutSampler over the finished cuts): eight anchors, then
 * fill pools along the land stretches until 34. Each pool: 22-vertex outline r·(0.82 + 0.16 sin(3a + φ) + 0.1 sin(5a + φ2)),
 * accepted on ground ≥ 1.6 with ≤ 0.55 relief (0.9 for an anchor), never within 5.5 of a route's centreline, a plot, the Green,
 * the Reach meadow and polygon, the maze, the overlook or the reserved osprey footing; level y = clamp(median + 0.05,
 * min + 0.08, min + 0.32). A pool is a `scrape` water body (terrain/index.ts applyWaters): inside its outline the ground is
 * the level less a depth that grows from 0.03 at the edge to max_depth_m (0.3) three metres in, so no pool is deeper than
 * 0.3; outside, the ground is only ever raised to the level (+ 0.02) under the lattice's straddling triangles (a soft lip), so
 * no sheet of water hangs over lower ground. A pool the Greenway's deck crosses keeps its level ≥ 0.55 under the deck.
 * The dipping platform on the Reed Maze trail stands at its pool.
 */
export function mulberry32(seed: number): () => number {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export interface MarshPool { id: string; c: XY; r: number; outline: XY[]; level: number; ground: { min: number; max: number; median: number }; anchor: boolean }
const PROTECT = new Set(['road', 'rail', 'stair', 'walk', 'boardwalk', 'skate', 'trail']);
const PLOTS: readonly [XY, number][] = [[[814, 919], 39], [[771, 973], 45], [[729, 1032], 24], [[705, 1107], 11]];
const inPlot = (x: number, z: number, m: number) => PLOTS.some(([[cx, cz], rot]) => { const a = rot * Math.PI / 180, u = (x - cx) * Math.cos(a) + (z - cz) * Math.sin(a), v = -(x - cx) * Math.sin(a) + (z - cz) * Math.cos(a); return Math.abs(u) < 32 + m && Math.abs(v) < 22 + m; });
const inPoly = (x: number, z: number, poly: readonly (readonly number[])[]) => { let hit = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if ((a[1]! > z) !== (b[1]! > z) && x < (b[0]! - a[0]!) * (z - a[1]!) / (b[1]! - a[1]!) + a[0]!) hit = !hit; } return hit; };
export let marshPools: MarshPool[] = [];
/** Generates the pools on `ground` (the bake's pre-pool terrain) and returns their water bodies (scrapes). */
export function generateMarshPools(cuts: LandCuts, ground: (x: number, z: number) => number): MarshPool[] {
  const P = M.structures.greenway.pools, L = greenwayLine(), rnd = mulberry32(P.seed), out: MarshPool[] = [];
  // The prototype's route distance (export.py roadDist): every route's centreline, not the Greenway's own deck (deckDist keeps
  // the fill pools off it) nor its places that stand over the water by design (the Marsh Hide over the hide pool, the piers).
  const OWN = /^structure\.greenway(\.(terrace|gateBridge|marshHide|archPier|paddleDock|sunsetBalcony|bluffEnd))?$/;
  const routes = cuts.beds.filter(b => PROTECT.has(b.kind) && b.points.length > 1 && !OWN.test(b.id));
  const roadDist = (x: number, z: number) => { let d = Infinity; for (const b of routes) { const xs = b.points; let near = false; for (const p of xs) if (Math.abs(p[0] - x) < 60 && Math.abs(p[2] - z) < 60) { near = true; break; } if (!near) continue; d = Math.min(d, nearestOnPath([x, z], b.points).distance); } return d; };
  const deck = L.pts, deckDist = (x: number, z: number) => nearestOnPath([x, z], deck).distance;
  const green = M.structures.greenway.keepOff.green, keep = P.keepOut;
  const blocked = (x: number, z: number, m: number) => roadDist(x, z) < m || inPlot(x, z, 4) || Math.hypot(x - green[0]!, z - green[1]!) < green[2]! + 4
    || (x > 1150 && inPoly(x, z, P.reachPoly)) || keep.some(k => Math.hypot(x - k[0]!, z - k[1]!) < k[2]!);
  const at = (s: number, off: number): XY => { const q = L.at(s); return [q.p[0] + q.r[0] * off, q.p[2] + q.r[1] * off]; };
  const tryPool = (cx: number, cz: number, r: number, force = false): boolean => {
    const n = 22, ph = rnd() * 6.28, ph2 = rnd() * 6.28, outline: XY[] = [];
    for (let k = 0; k < n; k++) { const a = k / n * 6.283, rr = r * (.82 + .16 * Math.sin(3 * a + ph) + .1 * Math.sin(5 * a + ph2)); outline.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
    const samp: XY[] = [...outline, [cx, cz]]; for (let k = 0; k < 10; k++) { const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * r * .8; samp.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
    // The plan tests before the ground (each ground sample is a full terrain-cut solve): the same pools, in the same order, since
    // every test is pure and the random draws above are already made (land integration: the build ran 13 s here).
    if (out.some(q => Math.hypot(q.c[0] - cx, q.c[1] - cz) < q.r + r + 4)) return false;
    for (const [x, z] of outline) if (blocked(x, z, 5.5)) return false;
    const gs = samp.map(([x, z]) => ground(x, z)).sort((a, b) => a - b), gmin = gs[0]!, gmax = gs.at(-1)!, med = gs[gs.length >> 1]!;
    if (gmin < 1.6 || gmax - gmin > (force ? .9 : .55)) return false;
    let y = Math.min(Math.max(med + .05, gmin + .08), gmin + .32);
    // A pool under the Greenway: its surface stays ≥ 0.55 under the deck (the crossing register's water-body rule is 0.5).
    for (const [x, z] of [...outline, [cx, cz] as XY]) { const hit = nearestOnPath([x, z], deck); if (hit.distance < 3.6) y = Math.min(y, hit.at[1] - .55); }
    if (y <= gmin + .02) return false;
    out.push({ id: `water.marsh.${out.length + 1}`, c: [cx, cz], r, outline, level: Number(y.toFixed(3)), ground: { min: gmin, max: gmax, median: med }, anchor: force }); return true;
  };
  for (const a of P.anchors) tryPool(...at(a[0]!, a[1]!), a[2]!, true);
  for (const a of P.anchorXY) tryPool(a[0]!, a[1]!, a[2]!, true);
  for (let k = 0; k < 900 && out.length < P.count; k++) {
    const s = rnd() < .86 ? 10 + rnd() * 590 : 960 + rnd() * (L.length - 960), side = rnd() < .5 ? -1 : 1, off = side * (7 + Math.pow(rnd(), 1.3) * 42), r = 4 + rnd() * 9;
    const [x, z] = at(s, off); if (deckDist(x, z) < r + 3.5) continue; tryPool(x, z, r);
  }
  marshPools = out;
  return out;
}
export function marshWaters(pools: readonly MarshPool[]): WaterCut[] {
  const depth = M.structures.greenway.pools.max_depth_m;
  return pools.map(p => ({ id: p.id, kind: 'lake', outline: p.outline.map(q => [Number(q[0].toFixed(2)), Number(q[1].toFixed(2))] as XY), points: [], level: p.level, width: 2 * p.r, depth, bank: .02, scrape: true }));
}
/** B · the dipping platform at the Reed Maze trail's pool: a deck 4.2 × 3.2 at the level + 0.4, an open rail on three sides,
 * four posts, and a 1.8 low walk from the dunes trail to its land edge (no bed: see below). */
export function buildDippingPlatform(cuts: LandCuts, pools: readonly MarshPool[], ground: (x: number, z: number) => number): void {
  const D = M.structures.greenway.places.B.dip, pl = pools.find(q => Math.hypot(q.c[0] - D.pool[0]!, q.c[1] - D.pool[1]!) < 3);
  if (!pl) { cuts.diagnostics.push({ id: 'structures.greenway.dip', severity: 'info', message: 'greenway: the Reed Maze trail\'s pool was not accepted on this ground; no dipping platform', at: D.pool as unknown as XY }); return; }
  const y = pl.level + .4, c: XY = [1066.6, pl.c[1] + pl.r * .62], f: XY = [0, -1], r: XY = [1, 0], Wd = (u: number, v: number): XY => [c[0] + r[0] * u + f[0] * v, c[1] + r[1] * u + f[1] * v];
  const d = districtAt(...c), ids = ['greenway.dip'], deck = solid('greenway.dip.deck', 'lookoutDeck', 'boardwalk', 'deck', ids, d), posts = solid('greenway.dip.posts', 'pile', 'timber', 'support', ids, d), rails = solid('greenway.dip.rails', OPEN_RAIL_KIND, 'timber', 'rail', ids, d);
  const corners: XY[] = [Wd(-2.1, -1.0), Wd(-2.1, 2.2), Wd(2.1, 2.2), Wd(2.1, -1.0)];
  let a = 0; for (let i = 0; i < 4; i++) { const p = corners[i]!, q = corners[(i + 1) % 4]!; a += p[0] * q[1] - q[0] * p[1]; } if (a > 0) corners.reverse();
  prism(deck, corners.map(p => [p[0], y, p[1]] as XYZ), y - .2);
  for (const u of [-1.9, 1.9]) for (const v of [-.8, 2.0]) { const w = Wd(u, v); box(posts, w, y - .2, [.2, .2], Math.min(y - .6, ground(w[0], w[1]) - .3)); }
  const rl = [Wd(-2.05, -.95), Wd(-2.05, 2.15), Wd(2.05, 2.15), Wd(2.05, -.95)].map(p => [p[0], y, p[1]] as XYZ);
  for (let i = 1; i < rl.length; i++) openRail(rails, [rl[i - 1]!, rl[i]!], 0, { height: .98 });
  // The low walk: from the dunes trail to the platform's back edge (the deck's open side faces the walk).
  const from: XY = M.structures.greenway.places.B.dip.walkFrom as unknown as XY, to = Wd(.4, -1.0), lw = solid('greenway.dip.walk', 'lowBoardwalk', 'boardwalk', 'deck', ids, d), lp = solid('greenway.dip.walkPosts', 'pile', 'timber', 'support', ids, d);
  const n = Math.max(2, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 1.5)), path: XYZ[] = [];
  for (let k = 0; k <= n; k++) { const t = k / n, x = from[0] + (to[0] - from[0]) * t, z = from[1] + (to[1] - from[1]) * t; path.push([x, Math.max(ground(x, z) + .45, k === n ? y : -Infinity), z]); }
  for (let k = 1; k < path.length; k++) { const p = path[k]!; path[k] = [p[0], Math.max(p[1], path[k - 1]![1] - .08 * 1.5), p[2]]; }
  path[path.length - 1] = [to[0], y, to[1]];
  // ≤ 8 % up to the platform: the walk rises from the trail rather than stepping up at the deck.
  for (let k = path.length - 2; k >= 0; k--) { const p = path[k]!, q = path[k + 1]!; path[k] = [p[0], Math.max(p[1], q[1] - .08 * Math.hypot(q[0] - p[0], q[2] - p[2])), p[2]]; }
  for (let i = 1; i < path.length; i++) mitredSlab(lw, path, i, 1.8, .2);
  path.forEach((p, i) => { if (i % 2) return; box(lp, [p[0], p[2]], p[1] - .2, [.16, .16], Math.min(p[1] - .5, ground(p[0], p[2]) - .3)); });
  cuts.solids.push(deck, posts, rails, lw, lp);
  // No bed: the platform and its walk are a structure stepped onto from the dunes trail (collision is what's drawn). A bed
  // keeps the ground 0.65 under its deck across a raster diagonal, and a dipping deck stands 0.4 over its pool, so a bed here
  // would dig the scrape to ≈ 0.45 under the platform (the pools are ≤ 0.3, D-WW23).
}
