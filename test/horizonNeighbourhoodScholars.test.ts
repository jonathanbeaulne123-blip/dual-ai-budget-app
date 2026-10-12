// The Water's Way, story place 7: Scholars' Edge (layout B) — the dressing module against the committed bake.
// passes/03 "Tests to add" plus the place's own contracts: the Library on its baked shell, the woods' canopy (60–70 %
// within 110 m), the courtyard's golden-hour sun (≥ 70 %), the story's sightlines and the lookout's open water clear of
// every crown, the Lookout kit on the built deck, racks at the wheels → feet thresholds, the night order, the life cap,
// determinism, and the per-district budget with the baked land (CONTRACT §6: 150k / 60k).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import type { LandCuts, StructureSolid } from '../src/harbour/horizon/land/interfaces.ts';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset.ts';
import { sampleTerrain } from '../src/harbour/horizon/land/terrain/index.ts';
import { buildingPlan } from '../src/harbour/horizon/kit/buildings/index.ts';
import { bakeDressings, createDressingContext, footprintCorners, footprintFit, validateDressing, type DressingContextImpl } from '../src/harbour/horizon/neighbourhoods/bake.ts';
import { NEIGHBOURHOOD_MODULES } from '../src/harbour/horizon/neighbourhoods/index.ts';
import { scholars } from '../src/harbour/horizon/neighbourhoods/scholars/index.ts';
import { DECK, LOC, LOOKOUT_EYE, LOOKOUT_VIEW, SHELL_ROOF, sunWindowAt } from '../src/harbour/horizon/neighbourhoods/scholars/frame.ts';
import { bearing, canopyCover, crownClearance, crownOf, storySightlines, sunlitShare } from '../src/harbour/horizon/neighbourhoods/scholars/measure.ts';
import { ANCHOR_LIFT, LIFE_CAP, LIBRARY_DRAWN, NIGHT_ORDER } from '../src/harbour/horizon/neighbourhoods/scholars/place.ts';
import { DISTRICT, WOODS, openness } from '../src/harbour/horizon/neighbourhoods/scholars/woods.ts';
import type { NeighbourhoodDressing } from '../src/harbour/horizon/neighbourhoods/types.ts';
import { measureDistrictDressing } from '../src/harbour/horizon/runtime/dressingLayer.ts';
import { isWildSet } from '../src/harbour/horizon/runtime/corridorPlanting.ts';
import { FLOWER_SET, setOf } from '../src/harbour/horizon/kit/plants/sets.ts';
import { districtAt } from '../src/harbour/horizon/world/districts.ts';
import type { District } from '../src/harbour/horizon/world/definition.ts';
import { createRayCaster } from '../src/harbour/horizon/world/raycast.ts';
import { measureStoryLink } from '../src/harbour/horizon/world/storySight.ts';
import { SIGHT_MIN_CLEARANCE, storyLandmark, validateStoryAgainstDressing } from '../src/harbour/horizon/world/story.ts';
import { protectedGreenOutline } from '../src/harbour/horizon/world/views.ts';

type Json = { collision: LandCuts & { beds: LandCuts['beds'] }; geometry: { solids: (StructureSolid & { sourceId?: string })[] }; hosts: { id: string; footprint: [number, number][]; door?: { xy?: [number, number] }; height: number }[]; thresholds: { id: string; at: [number, number]; modes: string[] }[] };
let json: Json, ground: (x: number, z: number) => number, ctx: DressingContextImpl, d: NeighbourhoodDressing;
let field: ReturnType<typeof decodeTerrainAsset>, baked: ReturnType<typeof bakeDressings>;
/** Hand the worker back to the runner between heavy steps (CI runs four workers: a long synchronous hold times out its RPC). */
const yieldToRunner = () => new Promise<void>(r => setTimeout(r, 0));

/** The bake's own world for the module: the committed bake's ground, beds, pads, water, solids (partitions merged back into
 * their source solids, this module's own `dressing.` colliders left out) and hosts (scripts/horizon/bake-dressing.ts). */
beforeAll(async () => {
  json = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')) as Json;
  await yieldToRunner();
  const bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full');
  ground = (x, z) => sampleTerrain(field, x, z);
  await yieldToRunner();
  const merged = new Map<string, { id: string; positions: number[]; indices: number[] }>();
  for (const q of json.geometry.solids) {
    const id = q.sourceId ?? q.id.split('@')[0]!; if (id.startsWith('dressing.')) continue;
    let m = merged.get(id); if (!m) merged.set(id, m = { id, positions: [], indices: [] });
    const base = m.positions.length / 3; for (const v of q.positions) m.positions.push(v); for (const i of q.indices) m.indices.push(i + base);
  }
  ctx = createDressingContext({ ground, beds: json.collision.beds, pads: json.collision.pads, waters: json.collision.waters, solids: [...merged.values()],
    hosts: json.hosts.map(h => ({ id: h.id, footprint: h.footprint, door: { ...(h.door?.xy ? { xy: h.door.xy } : {}) }, height: h.height })),
    protectedAreas: [{ id: 'green', outline: protectedGreenOutline() }], districtAt: (x, z) => districtAt(x, z) });
  await yieldToRunner();
  d = scholars.build(ctx);
  await yieldToRunner();
  baked = bakeDressings([scholars], ctx);
  await yieldToRunner();
}, 120_000);

describe("Scholars' Edge: the module", () => {
  it('is registered once, deterministic, and valid against the bake (beds, pads, water, solids, ids)', () => {
    expect(NEIGHBOURHOOD_MODULES.filter(m => m.id === 'scholars')).toHaveLength(1);
    expect(JSON.stringify(scholars.build(ctx))).toBe(JSON.stringify(d));
    expect(validateDressing([{ module: 'scholars', dressing: d }], ctx)).toEqual([]);
    expect(validateStoryAgainstDressing({ dressing: { landmarks: d.landmarks, lookouts: d.lookouts } }).problems).toEqual([]);
  });
  it('dresses only its own district (the woods\' budget is the scholars district\'s)', () => {
    const where = [...d.buildings.map(b => b.at), ...d.plants.map(p => p.at), ...d.props.map(p => p.at), ...d.life.map(l => l.at)].map(([x, , z]) => districtAt(x, z));
    expect(new Set(where)).toEqual(new Set([DISTRICT]));
  });
  it('re-dresses the Library on its baked shell: footprint, floor, eave; the 50° verdigris roofs inside the shell; the landmark top', () => {
    const lib = d.buildings.find(b => b.id === 'library')!, host = json.hosts.find(h => h.id === 'library')!;
    expect([lib.kind, lib.hostId, lib.collide, lib.landmarkId]).toEqual(['library', 'library', false, 'library']);
    expect(footprintFit(footprintCorners(lib, 0), host.footprint)).toBeLessThan(0.05);
    const plan = buildingPlan(lib) as ReturnType<typeof buildingPlan> & { rise: number };
    expect(plan.eave).toBeCloseTo(LIBRARY_DRAWN.eaveH, 6);
    expect(Math.atan2(plan.rise, lib.size.d / 4) * 180 / Math.PI).toBeGreaterThan(48);
    // The ridge caps meet the shell's roof plane (the baked roof slab the cards no longer draw), within the cap.
    expect(lib.at[1] + plan.eave + plan.rise - (host.height + SHELL_ROOF)).toBeLessThanOrEqual(LIBRARY_DRAWN.ridgeCap + 0.4);
    const mark = d.landmarks.find(l => l.id === 'library')!, reg = storyLandmark('library');
    expect(Math.abs(mark.top[1] - reg.top[1])).toBeLessThanOrEqual(1.5);
    expect(mark.relayOrder).toBe(reg.relayOrder);
  });
});

describe("Scholars' Edge: the woods", () => {
  it('holds 60–70 % canopy within 110 m (the sheet\'s figure, ±5 points of 65)', () => {
    const cover = canopyCover(d.plants);
    console.info(`[scholars] canopy within 110 m: ${(cover * 100).toFixed(1)} %`);
    expect(cover).toBeGreaterThanOrEqual(0.6); expect(cover).toBeLessThanOrEqual(0.7);
  });
  it('real trees stand in the front rows and woodland cards only behind them; ≤ 130 broadleaf front-row trees; no front-row maple', () => {
    const trees = d.plants.filter(p => crownOf(p)), cards = trees.filter(p => p.species === 'woodlandCard'), real = trees.filter(p => p.species !== 'woodlandCard');
    expect(real.filter(p => p.species === 'birch' || p.species === 'round').length).toBeLessThanOrEqual(130);
    expect(real.some(p => p.species === 'round')).toBe(false);
    expect(real.length).toBeLessThanOrEqual(WOODS.front.max);
    for (const c of cards) expect(openness(ctx, c.at[0], c.at[2]), `card at ${c.at[0]},${c.at[2]}`).toBeGreaterThan(0.3);
    console.info(`[scholars] trees: ${real.length} real (${Object.entries(real.reduce<Record<string, number>>((o, p) => ({ ...o, [p.species]: (o[p.species] ?? 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`).join(', ')}), ${cards.length} cards`);
  });
  it('plants the woodland floor: fern clumps and woodland drifts that grow wild (no edged bed; D-WW171), on no tread', () => {
    const drifts = d.plants.filter(p => p.species === 'flowerBed'), ferns = d.plants.filter(p => p.species === 'fern');
    expect(drifts.length).toBeGreaterThan(0); expect(ferns.length).toBeGreaterThan(100);
    for (const p of drifts) expect(setOf(p.tint)).toBe(FLOWER_SET.woodland);
    expect(isWildSet(FLOWER_SET.woodland)).toBe(true);
    for (const p of [...drifts, ...ferns]) expect(ctx.occupied(p.at[0], p.at[2], 0.5), `${p.species} at ${p.at[0]},${p.at[2]}`).toBe(false);
  });
  it('keeps trunks off every tread (2 m), out of the sun window, the glades\' cores and the lookout clearing', () => {
    for (const p of d.plants.filter(q => crownOf(q))) {
      if (!p.keep) expect(ctx.occupied(p.at[0], p.at[2], 1.9), `tree at ${p.at[0]},${p.at[2]}`).toBe(false);
      expect(sunWindowAt(p.at[0], p.at[2])).toBe(false);
      expect(Math.hypot(p.at[0] - LOOKOUT_EYE[0], p.at[2] - LOOKOUT_EYE[2])).toBeGreaterThanOrEqual(WOODS.lookoutClear - 9);
    }
  });
  it('puts the courtyard in golden-hour sun (sun 10°, WNW): ≥ 70 % of its samples past the Library, the ground and every crown', () => {
    const crowns = d.plants.map(crownOf).filter((c): c is NonNullable<typeof c> => !!c);
    const sun = sunlitShare(crowns, ground);
    console.info(`[scholars] courtyard in golden-hour sun: ${(sun.share * 100).toFixed(1)} % of ${sun.samples} samples`);
    expect(sun.share).toBeGreaterThanOrEqual(0.7);
  });
  it('keeps every story sightline over the woods ≥ 0.5 m clear of every crown (the elevator → the Library, the lookout → Westwatch, the oak, the Lamp)', () => {
    const lines = storySightlines(ground), crowns = d.plants.map(crownOf).filter((c): c is NonNullable<typeof c> => !!c);
    const touched = new Set<string>();
    for (const l of lines) for (const c of crowns) { const clear = crownClearance(l, c); if (clear !== Infinity) touched.add(`${l.from}→${l.to}`); expect(clear, `${l.from} → ${l.to} over the crown at ${c.x.toFixed(1)},${c.z.toFixed(1)}`).toBeGreaterThanOrEqual(SIGHT_MIN_CLEARANCE); }
    expect(touched).toContain('elevatorTop→library'); expect(touched).toContain('bightLookout→westwatch');
  });
  it('keeps the lookout\'s open water (bearings 55°–175°) free of canopy above the eye', () => {
    for (const c of d.plants.map(crownOf)) {
      if (!c) continue;
      const dist = Math.hypot(c.x - LOOKOUT_EYE[0], c.z - LOOKOUT_EYE[2]), b = bearing([LOOKOUT_EYE[0], LOOKOUT_EYE[2]], [c.x, c.z]);
      if (dist > LOOKOUT_VIEW.frame && dist < LOOKOUT_VIEW.reach && b >= LOOKOUT_VIEW.from && b <= LOOKOUT_VIEW.to) expect(c.hi, `crown at ${c.x},${c.z}`).toBeLessThan(LOOKOUT_EYE[1]);
    }
  });
  it('frames the lookout with a pine and a birch, both kept on lite', () => {
    const near = d.plants.filter(p => p.keep && Math.hypot(p.at[0] - LOOKOUT_EYE[0], p.at[2] - LOOKOUT_EYE[2]) < 16);
    expect(near.map(p => p.species)).toEqual(expect.arrayContaining(['pine', 'birch']));
  });
});

describe("Scholars' Edge: the place", () => {
  it('sets the Lookout kit on the built deck: standing and seated viewers, a bench, a panel, the lantern (the open rail is the land\'s)', () => {
    const on = d.props.filter(p => p.at[0] >= DECK.x0 && p.at[0] <= DECK.x1 && p.at[2] >= DECK.z0 && p.at[2] <= DECK.z1);
    expect(on.map(p => p.kind).sort()).toEqual(['bench', 'lantern', 'panel', 'viewer', 'viewer', 'viewerSeated']);
    for (const p of on) expect(p.at[1]).toBe(DECK.top);
    expect(json.geometry.solids.some(s => (s.sourceId ?? s.id).startsWith('bightLookout.rails'))).toBe(true);
    const look = d.lookouts[0]!;
    expect([look.id, look.viewer, look.targets[0]]).toEqual(['bightLookout', 'both', 'westwatch']);
    expect(look.targets).toContain('lamp');
  });
  it('the binoculars find their targets from the eye on the bake (the elevator too, past baked solids)', async () => {
    const solids = json.geometry.solids.map(q => ({ ...q, id: q.sourceId ?? q.id.split('@')[0]! })) as StructureSolid[];
    await yieldToRunner();
    const ray = createRayCaster(field, { ...json.collision, solids } as LandCuts);
    for (const t of d.lookouts[0]!.targets) { await yieldToRunner(); const m = measureStoryLink(ray, solids, 'bightLookout', t); expect(m.clearance, `bightLookout → ${t} (${m.blocker})`).toBeGreaterThanOrEqual(SIGHT_MIN_CLEARANCE); }
  }, 60_000);
  it('furnishes courtyard B on the terrace: four reading tables, benches, planters, the cart, the feeder and the lantern; walls on the battered edges', () => {
    const kinds = d.props.filter(p => p.id?.startsWith('courtyard.')).map(p => p.kind);
    for (const k of ['readingTable', 'bench', 'planter', 'bookCart', 'birdFeeder', 'lantern'] as const) expect(kinds).toContain(k);
    expect(kinds.filter(k => k === 'readingTable')).toHaveLength(4);
    expect(d.buildings.filter(b => b.kind === 'wall').length).toBeGreaterThan(0);
    expect(d.ground.filter(g => g.surface === 'travertine')).toHaveLength(3);
  });
  it('racks every wheels → feet threshold in the district within 12.5 m', () => {
    const racks = d.props.filter(p => p.kind === 'bikeRack'), wheels = json.thresholds.filter(t => t.modes.some(m => m.startsWith('wheels')) && districtAt(t.at[0], t.at[1]) === DISTRICT);
    expect(wheels.length).toBeGreaterThan(0);
    for (const t of wheels) expect(Math.min(...racks.map(r => Math.hypot(r.at[0] - t.at[0], r.at[2] - t.at[1]))), t.id).toBeLessThanOrEqual(12.5);
  });
  it('lights in the sheet\'s night order: windows → bollards → the courtyard lantern → the lookout lantern; emissive anchors only', () => {
    const kinds = { window: 'window', bollard: 'bollard', courtyard: 'lantern|tableLamp', lookout: 'lantern' } as const;
    for (const l of d.lights) { expect(l.id.startsWith('scholars.')).toBe(true); expect(l.order).toBeGreaterThanOrEqual(0); expect(new RegExp(`^(${kinds[NIGHT_ORDER[l.order!]!]})$`).test(l.kind)).toBe(true); }
    expect([...new Set([...d.lights].sort((a, b) => a.order! - b.order!).map(l => NIGHT_ORDER[l.order!]))]).toEqual([...NIGHT_ORDER]);
    // A module anchor is the runtime's bead AT it and pool ANCHOR_LIFT below it: each bollard's anchor is its lit cap.
    const bollards = d.props.filter(p => p.kind === 'bollard');
    expect(bollards.length).toBe(d.lights.filter(l => l.kind === 'bollard').length);
    for (const b of bollards) expect(d.lights.find(l => l.id === `scholars.${b.id}`)!.at[1] - b.at[1]).toBeCloseTo(ANCHOR_LIFT, 6);
    // The window anchors stand inside the Library (bead hidden, pool spilling out of the wall).
    for (const l of d.lights.filter(q => q.kind === 'window')) { const [u, v] = LOC(l.at[0], l.at[2]); expect(Math.abs(u) < 21 && Math.abs(v) < 15).toBe(true); }
  });
  it('spawns chickadees and moths: ≤ 24 creatures, the lite share (the first spawns) ≤ 10', () => {
    const total = d.life.reduce((n, l) => n + l.count, 0);
    expect(total).toBeLessThanOrEqual(LIFE_CAP.full);
    let lite = 0; for (const l of d.life) { if (lite + l.count > LIFE_CAP.lite) break; lite += l.count; }
    expect(lite).toBeGreaterThan(0); expect(new Set(d.life.map(l => l.kind))).toEqual(new Set(['chickadee', 'moth']));
  });
  it('fits the per-district budget with the baked land: ≤ 150k full / 60k lite triangles, ≤ 400 / 180 draw calls', async () => {
    const dist = baked.dressing!.districts.find(x => x.districtId === DISTRICT)!;
    expect(baked.dressing!.districts.map(x => x.districtId)).toEqual([DISTRICT]);
    const index = JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.index.json.gz')).toString()) as { districts: District[] };
    const row = index.districts.find(x => x.id === DISTRICT)!, land = { full: row.triangles!.full - (row.dressing?.full.triangles ?? 0), lite: row.triangles!.lite - (row.dressing?.lite.triangles ?? 0) };
    await yieldToRunner();
    const full = measureDistrictDressing(dist, ground, 'full');
    await yieldToRunner();
    const lite = measureDistrictDressing(dist, ground, 'lite');
    console.info(`[scholars] budget: land ${land.full} / ${land.lite}; dressing ${full.triangles} / ${lite.triangles} (${full.drawCalls} / ${lite.drawCalls} draws); district ${land.full + full.triangles} / ${land.lite + lite.triangles}`);
    expect(land.full + full.triangles).toBeLessThanOrEqual(150_000); expect(land.lite + lite.triangles).toBeLessThanOrEqual(60_000);
    expect((row.drawCalls ?? 0) - (row.dressing?.full.drawCalls ?? 0) + full.drawCalls).toBeLessThanOrEqual(400); expect(lite.drawCalls).toBeLessThanOrEqual(180);
  }, 120_000);
});
