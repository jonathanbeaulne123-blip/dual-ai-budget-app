// The Water's Way · PR 2 land, L3 (D-WW80…89): Scholars' Edge, the Flats and the Bight on the committed bake.
// The Bight lookout spur, ramp and raised deck; courtyard B's battered terrace; the windsock, the strip's clearances and the
// elevator's side clearance; the stargazing pad; the Wash Arch over S2 and the hoodoo footings; the Bight Shore batter.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BedCut, LandCuts, StructureSolid, TerrainField, XY } from '../src/harbour/horizon/land/interfaces';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { bightBatterAt, bightGreenwayDistance } from '../src/harbour/horizon/land/terrain/bightBatter';
import { OPEN_RAIL, stripClearanceBreach, stripLocal } from '../src/harbour/horizon/land/structures/westLand';
import { nearestOnPath } from '../src/harbour/horizon/land/structures/mesh';
import { createHorizonGeography, HORIZON_WALKABLE_DEGREES } from '../src/harbour/horizon/runtime/geography';
import { createWalkState, horizonWalkWorld, WALK_FIXED_DT, walkMove, walkTick, type WalkBody } from '../src/harbour/horizon/runtime/walkSim';
import { bedPath, pointAt, progressOf } from '../src/harbour/horizon/movers/board/situations';
import { createRayCaster, isOpenRail } from '../src/harbour/horizon/world/raycast';
import { terrainHeight } from '../src/harbour/horizon/world/geometry';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { measureStoryLink } from '../src/harbour/horizon/world/storySight';
import { storyEye, storyLandmark } from '../src/harbour/horizon/world/story';
import { registerRowKey } from '../src/harbour/horizon/world/crossings';

type World = { collision: Omit<LandCuts, 'solids' | 'diagnostics'>; geometry: { solids: (StructureSolid & { sourceId?: string })[] }; diagnostics: LandCuts['diagnostics']; extent: { w: number; h: number } };
let baked: { world: World; field: TerrainField; solids: StructureSolid[]; geo: ReturnType<typeof createHorizonGeography> } | null = null;
const bake = () => {
  if (baked) return baked;
  const world = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')) as World, bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full');
  const solids = world.geometry.solids.map(q => ({ ...q, id: q.sourceId ?? q.id.split('@')[0]! })) as StructureSolid[];
  const geo = createHorizonGeography(field, { ...world.collision, solids: world.geometry.solids, diagnostics: [] } as LandCuts);
  return (baked = { world, field, solids, geo });
};
const bedOf = (id: string) => bake().world.collision.beds.find(b => b.id === id)!;
const solidsOf = (id: string) => bake().solids.filter(s => s.id === id);
const diag = (id: string) => bake().world.diagnostics.find(d => d.id === id)!;
const edgeDistance = (xy: XY, skip: (b: BedCut) => boolean = () => false) => {
  let best = { d: Infinity, id: '' };
  for (const b of bake().world.collision.beds) { if (['cable', 'cave'].includes(b.kind) || skip(b) || b.points.length < 2) continue; const n = nearestOnPath(xy, b.points), d = n.distance - b.width / 2 - b.shoulder; if (d < best.d) best = { d, id: b.id }; }
  return best;
};
/** Box parts (8 vertices each) of a solid: their plan centre and lowest vertex. */
const parts = (s: StructureSolid) => { const out: { x: number; z: number; bottom: number; top: number }[] = []; for (let o = 0; o + 23 < s.positions.length; o += 24) { let x = 0, z = 0, b = Infinity, t = -Infinity; for (let i = 0; i < 8; i++) { x += s.positions[o + i * 3]! / 8; z += s.positions[o + i * 3 + 2]! / 8; b = Math.min(b, s.positions[o + i * 3 + 1]!); t = Math.max(t, s.positions[o + i * 3 + 1]!); } out.push({ x, z, bottom: b, top: t }); } return out; };

/** Follow a polyline with the stick (look-ahead 0.8 m) on the real walker over the baked collision, as a player would. */
function walkAlong(points: [number, number, number][], seconds = 120) {
  const { geo, world } = bake(), ww = horizonWalkWorld(geo, world.extent, () => true, HORIZON_WALKABLE_DEGREES);
  const path = bedPath({ id: 'probe', points } as never), p0 = pointAt(path, .3), s = geo.surface(p0.x, p0.z, p0.y + .5, .48)!;
  const body: WalkBody = { x: p0.x, y: s.y, z: p0.z, yaw: 0 }, state = createWalkState(body);
  const move = (dx: number, dz: number) => walkMove(ww, body, dx, dz, { swimming: false, grounded: true });
  let d = .3, last = .3, stall = 0, maxStep = 0;
  for (let t = 0; t < seconds; t += WALK_FIXED_DT) {
    d = Math.max(d, progressOf(path, body.x, body.z, d, 20).d); if (d >= path.length - .3) return { end: true, maxStep };
    if (d > last + .05) { last = d; stall = 0; } else if ((stall += WALK_FIXED_DT) > 3) return { end: false, at: [body.x, body.y, body.z], maxStep };
    const tg = pointAt(path, d + .8), dx = tg.x - body.x, dz = tg.z - body.z, l = Math.hypot(dx, dz), y0 = body.y;
    walkTick(state, body, { wishX: dx / l, wishZ: dz / l, run: false, speeds: { walk: 2.4, run: 5 } }, WALK_FIXED_DT, move);
    maxStep = Math.max(maxStep, Math.abs(body.y - y0));
    const floor = geo.surface(body.x, body.z, body.y, .02); if (!floor || body.y - floor.y > .05) return { end: false, air: true, at: [body.x, body.y, body.z], maxStep };
  }
  return { end: false, maxStep };
}

describe('Scholars\' Edge · the Bight lookout (D-WW87)', () => {
  const S = M.structures.bightLookout as unknown as { deck: { from: number[]; to: number[]; top: number }; eye: number[] };
  it('leaves the Year Walk flush at a register threshold and climbs ≤ 7 % from [747,470] to the raised deck', () => {
    const walk = bedOf('walk bightLookout'), ramp = bedOf('structure.bightLookout.ramp'), yw = bedOf('yearWalk');
    const start = walk.points[0]!, onYw = nearestOnPath([start[0], start[2]], yw.points);
    expect(onYw.distance).toBeLessThan(.5); expect(Math.abs(onYw.at[1] - start[1])).toBeLessThan(.05);
    const row = M.crossings.findIndex(c => c.a === 'walk bightLookout' && c.b === 'yearWalk' && c.resolution === 'threshold');
    expect(row).toBeGreaterThanOrEqual(0); expect(solidsOf(`${registerRowKey(row)}.marker`).length).toBeGreaterThan(0);
    expect(walk.width).toBeCloseTo(2.8, 6);
    const line = [...walk.points, ...ramp.points.slice(1)];
    const from = line.findIndex(p => Math.hypot(p[0] - 747, p[2] - 470) < .5);
    expect(from).toBeGreaterThan(0);
    for (let i = from + 1; i < line.length; i++) { const a = line[i - 1]!, b = line[i]!, g = (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[2] - a[2]); expect(g, `segment ${i}`).toBeLessThanOrEqual(.07 + 1e-6); }
    expect(ramp.points.at(-1)![1]).toBeCloseTo(S.deck.top, 6);
    expect(Math.abs(walk.points.at(-1)![1] - ramp.points[0]![1])).toBeLessThan(.01);
  }, 120_000);
  it('stands the deck on posts that reach the ground, pulled back to the cliff lip; nothing floats over the cliff', () => {
    const { field } = bake(), [x0, z0] = S.deck.from as [number, number], [x1, z1] = S.deck.to as [number, number];
    const posts = solidsOf('bightLookout.supports').flatMap(parts);
    expect(posts.length).toBeGreaterThan(10);
    // Every bearing's lowest part is sunk into the final ground; no post is taller than 3.5 eu (the lip, not the cliff face).
    const feet = new Map<string, number>(); for (const p of posts) { const k = `${p.x.toFixed(1)},${p.z.toFixed(1)}`; feet.set(k, Math.min(feet.get(k) ?? Infinity, p.bottom - terrainHeight(field, p.x, p.z))); }
    for (const [k, gap] of feet) expect(gap, `post at ${k}`).toBeLessThanOrEqual(-.15);
    for (const p of posts.filter(q => q.z > z0 - .5)) expect(S.deck.top - .35 - terrainHeight(field, p.x, p.z), `deck post at ${p.x},${p.z}`).toBeLessThan(3.5);
    // The deck's corners stand over the drawn ground within 4 eu (the lip on the 5 m lattice), and the ground never comes up through the slab.
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { const g = terrainHeight(field, x!, z!); expect(S.deck.top - g, `deck corner ${x},${z}`).toBeLessThan(4); expect(g).toBeLessThan(S.deck.top - .35); }
    expect(diag('structures.bightLookout.deck').severity).toBe('info');
  }, 120_000);
  it('rails the ramp and the deck with open rails (1.05) that stop the walker and that sight sees through', () => {
    const { geo, field, world } = bake(), rails = solidsOf('bightLookout.rails');
    expect(rails.length).toBeGreaterThan(0); for (const r of rails) { expect(r.openRail).toBe(true); expect(isOpenRail(r)).toBe(true); }
    let top = -Infinity; for (const r of rails) for (let i = 1; i < r.positions.length; i += 3) top = Math.max(top, r.positions[i]!); expect(top).toBeCloseTo(S.deck.top + OPEN_RAIL.top, 2);
    // Pushing south off the deck between two posts: the body is held on the deck.
    const ww = horizonWalkWorld(geo, world.extent, () => true, HORIZON_WALKABLE_DEGREES), body: WalkBody = { x: 743, y: S.deck.top, z: 510, yaw: 0 }, state = createWalkState(body);
    for (let i = 0; i < 240; i++) walkTick(state, body, { wishX: 0, wishZ: 1, run: false, speeds: { walk: 2.4, run: 5 } }, WALK_FIXED_DT, (dx, dz) => walkMove(ww, body, dx, dz, { swimming: false, grounded: true }));
    expect(body.z).toBeLessThan((S.deck.to as number[])[1]!); expect(body.y).toBeCloseTo(S.deck.top, 2);
    // A ray from the eye down through the south rail reaches what lies beyond it (the rail is not a hit).
    const ray = createRayCaster(field, { ...world.collision, solids: bake().solids } as LandCuts), eye: [number, number, number] = [744, S.deck.top + 1.6, 511], dir: [number, number, number] = [0, -.58, 1], l = Math.hypot(...dir);
    const hit = ray.first(eye, dir.map(v => v / l) as [number, number, number], 60);
    expect(hit.kind === 'solid' ? hit.sourceId : hit.kind).not.toBe('bightLookout.rails');
  }, 120_000);
  it('walks the spur, the ramp and the deck both ways on the real walker', () => {
    const line = [...bedOf('walk bightLookout').points, ...bedOf('structure.bightLookout.ramp').points.slice(1), [744, S.deck.top, 510.6] as [number, number, number]] as [number, number, number][];
    for (const pts of [line, [...line].reverse()]) { const r = walkAlong(pts); expect(r, JSON.stringify(r)).toMatchObject({ end: true }); }
  }, 120_000);
  it('puts the story\'s bightLookout eye on the built deck (deck + 1.6) and still sees Westwatch', () => {
    const e = storyEye('bightLookout'); expect(e.at).toEqual(S.eye); expect(e.y).toBeCloseTo(S.deck.top + 1.6, 6);
    const { geo } = bake(), floor = geo.surface(e.at[0], e.at[1], e.y!, .1); expect(floor?.y).toBeCloseTo(S.deck.top, 2);
    const { field, world, solids } = bake(), m = measureStoryLink(createRayCaster(field, { ...world.collision, solids } as LandCuts), solids, 'bightLookout', 'westwatch');
    expect(m.clearance).toBeGreaterThanOrEqual(.5);
  }, 120_000);
});

describe('Scholars\' Edge · courtyard B\'s terrace (D-WW88)', () => {
  const T = M.structures.scholarsTerrace as unknown as { h: number; batter: number; pads: Record<string, { xy: number[]; size_m: number[]; rot_deg: number; local: number[] }> };
  const local = (x: number, z: number) => { const dx = x - 740, dz = z - 400; return [.70711 * (dx - dz), .70711 * (dx + dz)] as const; };
  const inPads = (x: number, z: number, grow = 0) => { const [u, v] = local(x, z); return Object.values(T.pads).some(p => u >= p.local[0]! - grow && u <= p.local[1]! + grow && v >= p.local[2]! - grow && v <= p.local[3]! + grow); };
  it('levels the terrace with the Library (48), joined to its gable and its apron; at most ~1.9 m of fill', () => {
    const pads = bake().world.collision.pads.filter(p => p.id.startsWith('scholarsTerrace.'));
    expect(pads.map(p => p.id).sort()).toEqual(['scholarsTerrace.door', 'scholarsTerrace.main', 'scholarsTerrace.north']);
    for (const p of pads) { expect(p.centre[1]).toBe(T.h); expect(p.batter).toBe(T.batter); }
    const lib = bake().world.collision.pads.find(p => p.id === 'host.library')!; expect(lib.centre[1]).toBe(T.h);
    // Joined: the main and north pads end on the Library pad's gable line (u −22) and the door pad meets the apron (u ≥ −5).
    expect(T.pads.main!.local[1]).toBe(-22); expect(T.pads.door!.local[1]).toBeGreaterThanOrEqual(-5);
    let fill = 0; for (const p of Object.values(T.pads)) for (let u = p.local[0]!; u <= p.local[1]!; u += 1) for (let v = p.local[2]!; v <= p.local[3]!; v += 1) fill = Math.max(fill, T.h - baseHeight(740 + .70711 * (u + v), 400 + .70711 * (v - u)));
    expect(fill).toBeLessThanOrEqual(2);
  }, 120_000);
  it('batters its open edges at 1 : 1.5 at most, and never moves the Library pad or the Year Walk beside it', () => {
    const { field } = bake(), [cu, cv] = [740, 400];
    let worst = 0, inside = 0;
    for (let j = 0; j < field.rows; j++) for (let i = 0; i < field.columns; i++) {
      const x = i * field.step, z = j * field.step; if (Math.abs(x - 720) > 40 || Math.abs(z - 425) > 40) continue;
      const [u, v] = local(x, z), h = field.heights[j * field.columns + i]!;
      if (inPads(x, z)) { inside++; expect(Math.abs(h - T.h), `terrace vertex ${x},${z}`).toBeLessThan(.05); continue; }
      if (Math.abs(u) <= 22 && Math.abs(v) <= 16) { expect(Math.abs(h - T.h), `Library vertex ${x},${z}`).toBeLessThan(.05); continue; }
      // Outside: within the 1 : 1.5 cone of the terrace's level (lattice vertices within 6 eu of the pads).
      let d = Infinity; for (const p of Object.values(T.pads)) { const du = Math.max(p.local[0]! - u, 0, u - p.local[1]!), dv = Math.max(p.local[2]! - v, 0, v - p.local[3]!); d = Math.min(d, Math.hypot(du, dv)); }
      if (d < 6) worst = Math.max(worst, Math.abs(h - T.h) - d / T.batter);
    }
    expect(inside).toBeGreaterThan(10); expect(worst).toBeLessThan(.05);
    const yw = bedOf('yearWalk'); for (const p of yw.points) { const [u, v] = local(p[0], p[2]); if (u > -60 && u < 0 && v > 10 && v < 40) expect(inPads(p[0], p[2], 3.5), `Year Walk at ${p[0]},${p[2]}`).toBe(false); }
    void cu; void cv;
  }, 120_000);
});

describe('the Flats (D-WW80 · D-WW81 · D-WW84 · D-WW85 · D-WW86)', () => {
  it('stands the windsock east of the strip, clear of the 42 m approach box, ≥ 6 m off S2 and the strip', () => {
    const w = M.structures.strip.windsock as unknown as XY, pad = bake().world.collision.pads.find(p => p.id === 'windsock.footing')!;
    expect([pad.centre[0], pad.centre[2]]).toEqual(w);
    // The mast (r 0.12) and the sock streaming north (r 0.62) clear the box.
    expect(stripClearanceBreach(w[0], w[1], .62)).toBeNull();
    expect(edgeDistance(w).d).toBeGreaterThanOrEqual(6);
    expect(stripLocal(w[0], w[1]).o).toBeGreaterThan(42.6);
  }, 120_000);
  it('proves the elevator\'s side clearance on the tower footprint (D-WW81): outside both approach boxes, ≥ 28 m off the centreline', () => {
    const e = storyLandmark('elevator'), half = Math.hypot(4.5, 4.5);   // the widest head-house: the 9 × 9 tower cap's footprint
    expect([e.at[0], e.at[2]]).toEqual([395, 706]);
    expect(stripClearanceBreach(e.at[0], e.at[2], half)).toBeNull();
    const { s, o, length } = stripLocal(e.at[0], e.at[2]);
    expect(s).toBeGreaterThan(0); expect(s).toBeLessThan(length); expect(Math.abs(o) - half).toBeGreaterThanOrEqual(28);
    // The rule itself bites: the same footprint 12 m nearer the strip, or in the north approach, is refused.
    expect(stripClearanceBreach(e.at[0] + 12, e.at[2], half)).toMatch(/side/); expect(stripClearanceBreach(430, 450, half)).toMatch(/approach/);
  });
  it('builds the stargazing pad, its deck and the observatory pad in the dark tip, reached on foot from the Drive', () => {
    const S = M.structures.stargazing as unknown as { xy: number[]; h: number; deck: { top: number }; observatory: { top: number } };
    expect(stripClearanceBreach(S.xy[0]!, S.xy[1]!, 9)).toBeNull();
    expect(bake().world.collision.pads.find(p => p.id === 'stargazing')?.centre[1]).toBe(S.h);
    expect(solidsOf('stargazing.deck').length).toBe(1); expect(solidsOf('stargazing.observatory').length).toBe(1);
    expect(S.deck.top - S.h).toBeLessThanOrEqual(.48); expect(S.observatory.top - S.h).toBeLessThanOrEqual(.48);
    const row = M.crossings.findIndex(c => c.a === 'V01' && c.b === 'walk stargazing' && c.resolution === 'threshold');
    expect(row).toBeGreaterThanOrEqual(0); expect(solidsOf(`${registerRowKey(row)}.marker`).length).toBe(1);
    const walk = bedOf('walk stargazing').points as [number, number, number][], line = [...walk, [471, S.deck.top, 381] as [number, number, number]];
    for (const pts of [line, [...line].reverse()]) { const r = walkAlong(pts); expect(r, JSON.stringify(r)).toMatchObject({ end: true }); }
  }, 120_000);
  it('spans S2 with the Wash Arch: the lintel clears the rider envelope (contract ≥ 2.4) and a board or a bicycle rides under it', () => {
    const A = M.structures.washArch as unknown as { clear_eu: number; lintel: { underside: number } }, d = diag('structures.washArch.clear');
    expect(d.severity).toBe('info'); expect(d.measured!).toBeGreaterThanOrEqual(A.clear_eu); expect(d.required).toBe(A.clear_eu);
    expect(bake().world.diagnostics.some(q => q.id === 'structures.washArch.strip')).toBe(false);
    // The swept envelope along S2's first 40 m (centre ± 1.9, body contact heights and the 2.4 rider envelope): no solid.
    const { geo } = bake(), s2 = bedPath(bedOf('S2') as never);
    for (let dist = 0; dist <= 40; dist += .5) {
      const p = pointAt(s2, dist), nx = Math.cos(p.heading), nz = -Math.sin(p.heading);
      for (const off of [-1.9, -1, 0, 1, 1.9]) for (const h of [.2, .65, 1.25, 1.9, 2.4]) { const x = p.x + nx * off, z = p.z + nz * off; expect(geo.blocker(x, z, p.y + h - .2, .3), `S2 ${dist} m, offset ${off}, +${h}`).toBeNull(); }
    }
    // Its legs' foot drums stand ≥ 6 m off S2's edge (the airport brief's keep-off), above the rider envelope they lean in.
    const r0 = (M.structures.washArch as unknown as { legRadius_m: number[] }).legRadius_m[0]!, feet = parts(solidsOf('washArch.legs')[0]!).sort((a, b) => a.bottom - b.bottom).slice(0, 2);
    for (const leg of feet) expect(edgeDistance([leg.x, leg.z], b => b.id !== 'S2').d - r0).toBeGreaterThanOrEqual(5.99);
  }, 120_000);
  it('sets the hoodoo footings on the Wash\'s east bank, each ≥ 6 m off every bed edge and outside the strip\'s clearances', () => {
    const H = M.structures.washHoodoos as unknown as { xy: number[][]; footing_m: number };
    for (const p of H.xy) { const xy = p as unknown as XY; expect(edgeDistance(xy).d - H.footing_m / 2, `${xy}`).toBeGreaterThanOrEqual(6); expect(stripClearanceBreach(xy[0], xy[1], H.footing_m / 2)).toBeNull(); }
    expect(diag('structures.washHoodoos.offBeds').severity).toBe('info');
  }, 120_000);
  it('re-poses page H from over the strip\'s south end (eye [452,58,890] → [428,30,480]) and rewords the porch frame', () => {
    const v = M.views.find(q => q.id === 'H')! as unknown as { xy: number[]; eyeH: number; target: number[]; target_h: number };
    expect([v.xy[0], v.eyeH, v.xy[1]]).toEqual([452, 58, 890]); expect([v.target[0], v.target_h, v.target[1]]).toEqual([428, 30, 480]);
    expect((M.neighbourhoods.find(n => n.id === 'flats') as unknown as { porchFrames: string }).porchFrames).toBe('the take-offs, the strip and the Bight Bridge\'s arch over the rim');
  });
});

describe('the Bight · the Bight Shore batter (D-WW89)', () => {
  const R = M.reserves.bightShore;
  it('keeps the plots where they are: pads level, the same size, at their manifest centres', () => {
    R.plots.forEach((c, i) => { const p = bake().world.collision.pads.find(q => q.id === R.placeIds[i])!; expect([p.centre[0], p.centre[2]]).toEqual(c); expect(p.size).toEqual(R.size_m); expect(p.rotationDegrees).toBe(R.rot_deg[i]); });
  }, 120_000);
  it('fills each plot to its level and batters the lagoon faces no steeper than 1 : 1.5 below the walls, never within 6 m of the Greenway line', () => {
    // Where the batter raises the natural ground (outside the plots), the baked lattice carries it, and stays ≥ 6 eu off the line.
    const { field, world } = bake(); let raised = 0, near = Infinity, short = 0;
    for (let j = 0; j < field.rows; j++) for (let i = 0; i < field.columns; i++) {
      const x = i * field.step, z = j * field.step; if (x < 620 || x > 880 || z < 820 || z > 1180) continue;
      const s = bightBatterAt(world.collision.pads, baseHeight, x, z); if (!s || s.d <= 0 || s.fill <= baseHeight(x, z) + .05) continue;
      raised++; near = Math.min(near, bightGreenwayDistance(world.collision.pads, [x, z]));
      // A route beside the plot keeps its clearance (the bed ceiling: its deck less 0.05 within its raster margin, 5 √2 eu): the
      // batter yields there, as every fill does; elsewhere the lattice carries the batter.
      const yields = world.collision.beds.some(b => { if (['cable', 'cave'].includes(b.kind) || b.points.length < 2) return false; const n = nearestOnPath([x, z], b.points); return n.distance < b.width / 2 + b.shoulder + 5 * Math.SQRT2 && n.at[1] < s.fill; });
      if (!yields && field.heights[j * field.columns + i]! < s.fill - .05) short++;
      // Never above the 1 : 1.5 plane from the crest (the batter is the plane where it fits, and parallel to it below where it does not).
      expect(s.fill).toBeLessThanOrEqual(world.collision.pads.find(p => p.id === s.plot)!.centre[1] - s.d / 1.5 + 1e-6);
    }
    expect(raised).toBeGreaterThan(30); expect(near).toBeGreaterThanOrEqual(6); expect(short).toBe(0);
    for (const id of R.placeIds) { const d = diag(`structures.bightShore.batter.${id}`); expect(d.severity).toBe('info'); expect(d.measured!).toBeGreaterThanOrEqual(6); }
    // Every plot stands on its own level now (plot 1's pad stood over the lagoon).
    R.plots.forEach((c, i) => { const p = world.collision.pads.find(q => q.id === R.placeIds[i])!; expect(Math.abs(terrainHeight(field, c[0]!, c[1]!) - p.centre[1])).toBeLessThan(.05); });
  }, 120_000);
});
