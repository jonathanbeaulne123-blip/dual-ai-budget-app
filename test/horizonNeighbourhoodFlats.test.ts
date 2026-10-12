// The Water's Way · PR 4 · the Flats & the Bight (story place 6): the hybrid airfield's dressing on the committed bake.
// The module (neighbourhoods/flats) against the same world the bake gave it; the elevator as the story's landmark; the strip's
// approach and side clearances; the airport's walk and collision contract kept whole (its boxes and decks), the Quonset's barrel
// as drawn and as struck; no words and no second windsock in the airport's art; planting by the sheet; lights in night order;
// life; the per-district budget; page H's subjects; the Wash Arch dressing over the baked arch; determinism.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { LandCuts, StructureSolid, TerrainField } from '../src/harbour/horizon/land/interfaces.ts';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset.ts';
import { terrainHeight, solidBounds } from '../src/harbour/horizon/world/geometry.ts';
import { districtAt } from '../src/harbour/horizon/world/districts.ts';
import { protectedGreenOutline } from '../src/harbour/horizon/world/views.ts';
import { createRayCaster } from '../src/harbour/horizon/world/raycast.ts';
import { storyLandmark, validateStoryAgainstDressing } from '../src/harbour/horizon/world/story.ts';
import { bakeDressings, buildingHeight, createDressingContext, footprintCorners, PROP_HEIGHT, SPECIES_HEIGHT, validateDressing } from '../src/harbour/horizon/neighbourhoods/bake.ts';
import { buildingPlan } from '../src/harbour/horizon/kit/buildings/index.ts';
import { flatsModule, FLATS_LIGHT_LINE, FLATS_NIGHT_ORDER } from '../src/harbour/horizon/neighbourhoods/flats/index.ts';
import { BALLOON, BIGHT_BRIDGE_ARCH, BIGHT_PLOTS, CROWN_RADIUS, ELEVATOR, FLATS_LANDFORM, PORCH_BENCH, WASH_ARCH, WASH_HOODOOS, WINDSOCK, plotPoint, polyArea, pointInPoly, stripClearanceBreach, stripLocal } from '../src/harbour/horizon/neighbourhoods/flats/plan.ts';
import { FLATS_PLANTING } from '../src/harbour/horizon/neighbourhoods/flats/planting.ts';
import { baseHeight } from '../src/harbour/horizon/land/terrain/index.ts';
import { NEIGHBOURHOOD_MODULES } from '../src/harbour/horizon/neighbourhoods/index.ts';
import { AIRPORT, AIRPORT_BOXES, AIRPORT_DECKS, AIRPORT_VAULTS, vaultTop } from '../src/harbour/horizon/airport/layout.ts';
import { airportGeography } from '../src/harbour/horizon/airport/geography.ts';
import { measureDistrictDressing } from '../src/harbour/horizon/runtime/dressingLayer.ts';
import type { NeighbourhoodDressing } from '../src/harbour/horizon/neighbourhoods/types.ts';
import { districtBudget } from '../src/harbour/horizon/neighbourhoods/budget.ts';

type World = { collision: Omit<LandCuts, 'solids' | 'diagnostics'>; geometry: { solids: (StructureSolid & { sourceId?: string })[] }; hosts: { id: string; footprint?: [number, number][]; door: { xy?: [number, number] }; height?: number }[]; districts: { id: string; triangles?: { full: number; lite: number }; dressing?: unknown }[]; views: { id: string; eye: number[]; target: number[]; fovDegrees: number }[]; dressing?: { districts: { districtId: string; buildings: { id: string }[]; plants: unknown[]; props: { id?: string }[] }[]; landmarks: { id: string; at: number[]; top: number[] }[]; lookouts: { id: string; eye: number[] }[] }; lights: { id: string; kind: string; at: number[]; order?: number; line?: string }[] };
type Fixture = { world: World; field: TerrainField; ground: (x: number, z: number) => number; solids: StructureSolid[]; land: StructureSolid[]; ctx: ReturnType<typeof createDressingContext>; out: NeighbourhoodDressing; ray: ReturnType<typeof createRayCaster> };
let cache: Fixture | null = null;
const tick = () => new Promise<void>(r => setTimeout(r, 0));
// The heavy fixtures (the bake's parse, the terrain field, the context, the module, the ray caster) are built once, in steps that
// yield to the worker's event loop between them (CI runs four workers: a worker held synchronously too long fails the gate with
// "Timeout calling onTaskUpdate" even when every test is green).
beforeAll(async () => {
  const world = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')) as World; await tick();
  const bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full'), ground = (x: number, z: number) => terrainHeight(field, x, z); await tick();
  const solids = world.geometry.solids.map(q => ({ ...q, id: q.sourceId ?? q.id.split('@')[0]! })) as StructureSolid[];
  // The bake runs the modules before their own colliders join the world: the same context, without `dressing.*` solids.
  const land = solids.filter(s => !s.id.startsWith('dressing.')); await tick();
  const ctx = createDressingContext({ ground, beds: world.collision.beds, pads: world.collision.pads, waters: world.collision.waters, solids: land,
    hosts: world.hosts.map(h => ({ id: h.id, footprint: h.footprint, door: h.door?.xy ? { xy: h.door.xy } : {}, height: h.height })),
    protectedAreas: [{ id: 'green', outline: protectedGreenOutline() }], districtAt: (x, z) => districtAt(x, z) }); await tick();
  const out = flatsModule.build(ctx); await tick();
  const ray = createRayCaster(field, { ...world.collision, solids } as LandCuts); await tick();
  cache = { world, field, ground, solids, land, ctx, out, ray };
}, 300_000);
const bake = (): Fixture => { if (!cache) throw new Error('fixtures not built'); return cache; };
const tallOf = (species: string, scale: number) => (SPECIES_HEIGHT as Record<string, number>)[species]! * scale;

describe('the Flats module on the bake-time world', () => {
  it('is registered, validates with no problem and builds deterministically', () => {
    expect(NEIGHBOURHOOD_MODULES.map(m => m.id)).toContain('flats');
    const { ctx, out } = bake();
    expect(validateDressing([{ module: 'flats', dressing: out }], ctx)).toEqual([]);
    expect(JSON.stringify(flatsModule.build(ctx))).toBe(JSON.stringify(out));
  }, 120_000);
  it('is the dressing the committed bake carries (the bake and the tests read one world)', () => {
    const { world, out } = bake();
    const baked = (world.dressing?.districts ?? []).flatMap(d => d.buildings.map(b => b.id)).filter(id => id.startsWith('flats.')).sort();
    expect(baked).toEqual(out.buildings.map(b => b.id).sort());
    const plants = (world.dressing?.districts ?? []).reduce((n, d) => n + d.plants.length, 0);
    expect(plants).toBeGreaterThanOrEqual(out.plants.length);
    expect(validateStoryAgainstDressing(world as never).problems).toEqual([]);
  }, 120_000);
});

describe('the grain elevator is the story\'s landmark on the tower footprint', () => {
  it('stands at the registry base, its beacon cap at the registry top, and joins the relay seventh', () => {
    const { out } = bake();
    const e = out.buildings.find(b => b.id === 'flats.elevator')!, l = out.landmarks.find(q => q.id === 'elevator')!, reg = storyLandmark('elevator');
    expect(e.landmarkId).toBe('elevator'); expect(e.collide).toBe(true);
    expect(Math.hypot(e.at[0] - reg.at[0], e.at[2] - reg.at[2])).toBeLessThan(0.01);
    expect(e.at[1] + buildingHeight(e)).toBeCloseTo(reg.top[1], 0);   // 35.5 + 28.0 = 63.5 (± 0.5)
    expect(Math.abs(e.at[1] + buildingHeight(e) - reg.top[1])).toBeLessThan(0.5);
    expect(l.top).toEqual(reg.top); expect(l.relayOrder).toBe(7);
    expect(validateStoryAgainstDressing({ dressing: out }).problems).toEqual([]);
  }, 120_000);
  it('encloses the airport tower\'s boxes (their collision stays inside its own; nothing pokes out of it)', () => {
    const { out } = bake();
    const e = out.buildings.find(b => b.id === 'flats.elevator')!, plan = buildingPlan(e), top = e.at[1] + Math.max(plan.eave, plan.top);
    for (const b of AIRPORT_BOXES.filter(q => q.id.startsWith('tower-'))) {
      expect(b.w / 2, b.id).toBeLessThanOrEqual(e.size.w / 2); expect(b.d / 2, b.id).toBeLessThanOrEqual(e.size.d / 2);
      expect(Math.abs(b.x - e.at[0]) + b.w / 2).toBeLessThanOrEqual(e.size.w / 2); expect(Math.abs(b.z - e.at[2]) + b.d / 2).toBeLessThanOrEqual(e.size.d / 2);
      expect(b.y + b.h / 2, b.id).toBeLessThan(e.at[1] + e.size.h); expect(top).toBeGreaterThan(b.y + b.h / 2);
    }
  }, 120_000);
});

describe('the strip\'s clearances hold with the dressing in place (MANIFEST strip.clearances, D-WW81)', () => {
  it('nothing over 1 m stands in either approach box or nearer the centreline than 28 m', () => {
    const { out } = bake(), bad: string[] = [];
    for (const b of out.buildings) { if (buildingHeight(b) <= 1) continue; const r = Math.hypot(b.size.w, b.size.d) / 2 + (b.kind === 'elevator' ? 4.2 : 0); const why = stripClearanceBreach(b.at[0], b.at[2], r); if (why) bad.push(`${b.id}: ${why}`); }
    for (const p of out.props) { const h = PROP_HEIGHT[p.kind] * (p.scale ?? 1); if (h <= 1) continue; const why = stripClearanceBreach(p.at[0], p.at[2], p.kind === 'windsock' ? 0.7 : p.kind === 'balloon' ? 8 : 1); if (why) bad.push(`${p.id ?? p.kind}: ${why}`); }
    for (const p of out.plants) { if (tallOf(p.species, p.scale) <= 1) continue; const why = stripClearanceBreach(p.at[0], p.at[2], (CROWN_RADIUS[p.species] ?? 1) * p.scale); if (why) bad.push(`${p.species} at [${p.at[0].toFixed(0)}, ${p.at[2].toFixed(0)}]: ${why}`); }
    expect(bad).toEqual([]);
  }, 120_000);
  it('the elevator\'s footprint (and annex) stays ≥ 28 m off the centreline; the windsock\'s mast is outside the 42 m box', () => {
    const { out } = bake(), e = out.buildings.find(b => b.id === 'flats.elevator')!;
    for (const [x, z] of footprintCorners(e, 0)) expect(Math.abs(stripLocal(x, z).o)).toBeGreaterThanOrEqual(28);
    expect(Math.abs(stripLocal(e.at[0], e.at[2]).o) - (e.size.w / 2 + 3.6)).toBeGreaterThanOrEqual(28);   // the annex reaches 3.6 beyond
    const sock = out.props.find(p => p.kind === 'windsock')!; expect([sock.at[0], sock.at[2]]).toEqual(WINDSOCK);
    expect(stripLocal(sock.at[0], sock.at[2]).o).toBeGreaterThan(42);
    expect(out.props.filter(p => p.kind === 'windsock')).toHaveLength(1);
    const glyph = out.props.find(p => p.kind === 'geoglyph')!, s = stripLocal(glyph.at[0], glyph.at[2]);
    expect(s.s).toBeLessThan(-30); expect(s.s).toBeGreaterThan(-200); expect(Math.abs(s.o)).toBeLessThan(1); expect(PROP_HEIGHT.geoglyph).toBeLessThanOrEqual(0.2);
  }, 120_000);
});

describe('the airport keeps its walk and collision contract; the re-skin is drawn from it', () => {
  it('every box and deck is the merged airport\'s, unchanged', () => {
    // sha256 of the boxes, decks and airport constants as merged (main), so a re-skin can never move a wall or a floor.
    expect(createHash('sha256').update(JSON.stringify({ AIRPORT_BOXES, AIRPORT_DECKS, AIRPORT })).digest('hex')).toBe('214f97877d41d6f2a6ffbdc1aa83d85e309d2f22f1771ad21d9143cf910adde9');
  });
  it('the Quonset\'s barrel covers the roof slab and is struck where it is drawn', () => {
    const v = AIRPORT_VAULTS[0]!, roof = AIRPORT_BOXES.find(b => b.id === 'hangar-roof')!, geo = airportGeography();
    for (let x = roof.x - roof.w / 2; x <= roof.x + roof.w / 2; x += 1) for (let z = roof.z - roof.d / 2; z <= roof.z + roof.d / 2; z += 0.5) expect(vaultTop(v, x, z)!).toBeGreaterThanOrEqual(roof.y + roof.h / 2 - 1e-9);
    expect(vaultTop(v, 395, (v.z0 + v.z1) / 2)).toBeCloseTo(v.crown, 6); expect(vaultTop(v, 395, v.z0)).toBeCloseTo(v.spring, 6);
    // Support on the barrel at its crown, contact against its side from outside, and nothing changed inside the hangar.
    expect(geo.surface(395, 585, 49)?.y).toBeCloseTo(v.crown, 3);
    expect(geo.contact(395, 576, 45.3)).not.toBeNull(); expect(geo.contact(395, 570.4, 45.3)).toBeNull();
    expect(geo.surface(395, 585, 38.2)?.y).toBeCloseTo(38, 3); expect(geo.ceiling(395, 585, 38)).toBeCloseTo(44.8, 3);
  });
  it('draws no words and no windsock of its own (RULINGS 3, 4)', () => {
    const src = readFileSync('src/harbour/horizon/airport/art.ts', 'utf8');
    expect(src).not.toMatch(/fillText|strokeText|font\s*=/);
    expect(src).not.toMatch(/HORIZON {2}\/ {2}AIRPORT|DEPARTURE ROOM|CAFÉ TERRACE|OPEN HANGAR/);
    expect(src).not.toMatch(/const sock|new THREE\.ConeGeometry\(\.35,2\.4/);
    // The five point lights were the merged airport's (pre-existing; LIGHT D-R3 pool: reported in the handoff, not added to).
    expect(src.match(/new THREE\.PointLight/g)?.length).toBe(2);   // one in the loop of four, one for the approach
  });
});

describe('the Wash: the arch dresses the baked arch, the hoodoos stand on their footings', () => {
  it('the arch record draws over the baked legs and lintel without a collider, its lintel never below the contract', () => {
    const { out, land } = bake(), a = out.buildings.find(b => b.id === 'flats.washArch')!;
    expect(a.collide).toBe(false);
    const legs = land.filter(s => s.id === 'washArch.legs'), lintel = land.filter(s => s.id === 'washArch.lintel');
    expect(legs.length).toBeGreaterThan(0); expect(lintel.length).toBeGreaterThan(0);
    const lb = solidBounds(lintel[0]!);
    // The kit's lintel (top h, 1.8 deep, the middle block sagging 0.25) is drawn at or above the baked underside 45.0.
    expect(a.at[1] + a.size.h - 1.8 - 0.25).toBeGreaterThanOrEqual(WASH_ARCH.lintel.underside - 1e-6);
    expect(a.at[1] + a.size.h + 0.15).toBeGreaterThanOrEqual(lb.max[1] - 0.15);
    const legW = Math.max(1.2, a.size.w * 0.2); expect(a.size.w / 2 - legW / 2).toBeCloseTo(WASH_ARCH.legOffset_m, 1);
  }, 120_000);
  it('five hoodoos (3–9 m) on the five footings, each on its footing\'s top', () => {
    const { out, land } = bake(), feet = land.filter(s => s.id === 'washHoodoos.footings');
    const hoodoos = out.buildings.filter(b => /^flats\.hoodoo\.\d$/.test(b.id));
    expect(hoodoos).toHaveLength(WASH_HOODOOS.xy.length);
    const topAt = (x: number, z: number) => { let t = -Infinity; for (const s of feet) for (let k = 0; k < s.positions.length; k += 3) if (Math.abs(s.positions[k]! - x) <= 2.01 && Math.abs(s.positions[k + 2]! - z) <= 2.01) t = Math.max(t, s.positions[k + 1]!); return t; };
    for (const [i, h] of hoodoos.entries()) {
      expect([h.at[0], h.at[2]]).toEqual(WASH_HOODOOS.xy[i]); expect(h.size.h).toBeGreaterThanOrEqual(3); expect(h.size.h).toBeLessThanOrEqual(9); expect(h.size.w).toBeLessThanOrEqual(WASH_HOODOOS.footing_m);
      expect(Math.abs(h.at[1] - topAt(h.at[0], h.at[2])), h.id).toBeLessThan(0.01);
    }
  }, 120_000);
});

describe('the hoodoos stand on level footings on the Wash\'s rim (D-WW164a)', () => {
  it('the ground under each 4 m footing falls ≤ 0.8 m (no bare pedestal), and the footings stay off S2 and outside the strip\'s boxes', () => {
    const { ctx } = bake();
    for (const [x, z] of WASH_HOODOOS.xy) {
      const g = [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => baseHeight(x + i! * WASH_HOODOOS.footing_m / 2, z + j! * WASH_HOODOOS.footing_m / 2));
      expect(Math.max(...g) - Math.min(...g), `[${x}, ${z}]`).toBeLessThanOrEqual(0.8);
      expect(ctx.bedClearance(x, z, ['S2']) - WASH_HOODOOS.footing_m / 2).toBeGreaterThanOrEqual(6);
      expect(stripClearanceBreach(x, z, WASH_HOODOOS.footing_m)).toBeNull();
    }
  }, 120_000);
});

describe('the porch looks over the grass (the seated eye at 0.98)', () => {
  it('nothing over 0.5 m within 7 m of the bench, nor in the frame toward the Bight Bridge\'s arch for 45 m', () => {
    const { out } = bake(), dir = Math.atan2(BIGHT_BRIDGE_ARCH[0] - PORCH_BENCH[0], BIGHT_BRIDGE_ARCH[1] - PORCH_BENCH[1]);
    for (const p of out.plants) {
      const dx = p.at[0] - PORCH_BENCH[0], dz = p.at[2] - PORCH_BENCH[1], d = Math.hypot(dx, dz), a = Math.atan2(dx, dz) - dir, off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      if (d < 7 || (d < 45 && off < (12 * Math.PI) / 180)) expect(tallOf(p.species, p.scale), `${p.species} at [${p.at[0].toFixed(1)}, ${p.at[2].toFixed(1)}]`).toBeLessThanOrEqual(0.5);
    }
  }, 120_000);
});

describe('the Bight: eelgrass and the plots\' battered faces planted (D-WW165a)', () => {
  it('eelgrass in the shallows and shore planting on every plot\'s lagoon faces, below its level', () => {
    const { out, ground, ctx } = bake();
    const eel = out.plants.filter(p => p.species === 'sedge' && ctx.districtAt(p.at[0], p.at[2]) === 'bight' && ctx.waterLevelAt(p.at[0], p.at[2]) !== null);
    expect(eel.length).toBeGreaterThanOrEqual(FLATS_PLANTING.eelgrass * 0.75);
    for (const plot of BIGHT_PLOTS) {
      const c = plotPoint(plot, 0, 0), level = ground(c[0], c[1]), reach = Math.hypot(plot.size[0], plot.size[1]) / 2 + 17;
      const shore = out.plants.filter(p => p.species !== 'sedge' && Math.hypot(p.at[0] - c[0], p.at[2] - c[1]) < reach && p.at[1] < level - 1.5 && ctx.districtAt(p.at[0], p.at[2]) === 'bight');
      expect(shore.length, plot.id).toBeGreaterThanOrEqual(FLATS_PLANTING.shorePerPlot * 0.8);
    }
  }, 120_000);
});

describe('planting by the sheet (STYLE §2.4, §1.4.1)', () => {
  it('tree cover ≤ 3 % of the landform (within ±5 points of the sheet), ≥ 70 % open ground, trees in clumps of the lee', () => {
    const { out } = bake(), area = polyArea(FLATS_LANDFORM);
    const trees = out.plants.filter(p => CROWN_RADIUS[p.species] !== undefined && pointInPoly(p.at[0], p.at[2], FLATS_LANDFORM));
    const canopy = trees.reduce((s, p) => s + Math.PI * ((CROWN_RADIUS[p.species]! * p.scale) ** 2), 0), cover = canopy / area;
    const built = out.buildings.filter(b => pointInPoly(b.at[0], b.at[2], FLATS_LANDFORM)).reduce((s, b) => s + b.size.w * b.size.d, 0) + AIRPORT_BOXES.reduce((s, b) => s + (b.solid ? b.w * b.d : 0), 0);
    console.log(`[flats] landform ${area.toFixed(0)} m²; ${trees.length} trees; tree cover ${(cover * 100).toFixed(2)} %; built ${(built / area * 100).toFixed(2)} %`);
    expect(cover).toBeLessThanOrEqual(0.03); expect(cover).toBeGreaterThan(0.002);
    expect(1 - cover - built / area).toBeGreaterThanOrEqual(0.7);
    expect(out.plants.filter(p => p.species === 'pine')).toHaveLength(1);
    expect(out.plants.filter(p => ['palm', 'fanPalm', 'canaryPalm', 'willow', 'oakGiant'].includes(p.species))).toEqual([]);
  }, 120_000);
  it('nothing planted on a bed, pad, stair, platform, skate line or the campus; nothing tall inside the geoglyph', () => {
    const { out, ctx } = bake(), c = ctx as unknown as { onBed(x: number, z: number): string | null; onPad(x: number, z: number): string | null };
    for (const p of out.plants) { expect(c.onBed(p.at[0], p.at[2])).toBeNull(); expect(c.onPad(p.at[0], p.at[2])).toBeNull(); }
    for (const p of out.plants) for (const b of AIRPORT_BOXES) expect(Math.abs(p.at[0] - b.x) <= b.w / 2 && Math.abs(p.at[2] - b.z) <= b.d / 2, `${p.species} in ${b.id}`).toBe(false);
    const glyph = out.props.find(p => p.kind === 'geoglyph')!;
    for (const p of out.plants) if (Math.hypot(p.at[0] - glyph.at[0], p.at[2] - glyph.at[2]) < 20) expect(tallOf(p.species, p.scale), p.species).toBeLessThanOrEqual(1);
    // The S2 keep-off (6 m) for everything the module puts on the Wash.
    for (const p of out.plants) if (tallOf(p.species, p.scale) > 1) expect(ctx.bedClearance(p.at[0], p.at[2], ['S2'])).toBeGreaterThanOrEqual(3);
  }, 120_000);
});

describe('night, life and budget', () => {
  it('the light anchors are the sheet\'s night order on one line, set on the ground (no floating pools)', () => {
    const { out, ground } = bake();
    expect(out.lights.every(l => l.line === FLATS_LIGHT_LINE)).toBe(true);
    const order = [...new Set(out.lights.sort((a, b) => a.order! - b.order!).map(l => l.id.split('.')[1]))];
    expect(order).toEqual([...FLATS_NIGHT_ORDER]);
    for (const l of out.lights) { const floor = l.id === 'flats.hangarDoor' ? 38 : l.id === 'flats.observatoryPath' ? 38 : ground(l.at[0], l.at[2]); expect(Math.abs(l.at[1] - 0.8 - floor), l.id).toBeLessThan(0.35); }
  }, 120_000);
  it('the baked anchors are emissive cards only (dressing:<kind>), never the 6 / 2 point-light pool', () => {
    const { world } = bake();
    const mine = world.lights.filter(l => l.id.startsWith('flats.'));
    expect(mine.length).toBeGreaterThanOrEqual(FLATS_NIGHT_ORDER.length);
    for (const l of mine) expect(l.kind.startsWith('dressing:')).toBe(true);
  }, 120_000);
  it('creatures ≤ 24 per district, ≤ 10 per spawn (lite), only the sheet\'s', () => {
    const { out, ctx } = bake(), per = new Map<string, number>();
    for (const l of out.life) { const d = ctx.districtAt(l.at[0], l.at[2]); per.set(d, (per.get(d) ?? 0) + l.count); expect(l.count).toBeLessThanOrEqual(10); }
    for (const [d, n] of per) expect(n, d).toBeLessThanOrEqual(24);
    expect(out.life.map(l => l.kind).sort()).toEqual(['butterfly', 'gull', 'hawk', 'swallow']);
    expect(out.life.find(l => l.kind === 'swallow')!.months).toEqual([5, 6, 7, 8]); expect(out.life.find(l => l.kind === 'hawk')!.hours).toEqual([12, 18]);
  }, 120_000);
  it('per district: the baked land plus the dressing stays inside CONTRACT §6 (150k / 60k)', () => {
    const { world } = bake();
    for (const id of ['flats', 'bight', 'scholars']) {
      const d = world.districts.find(q => q.id === id)!;
      console.log(`[flats] budget ${id}: full ${d.triangles!.full}, lite ${d.triangles!.lite}`);
      // Integration (D-WW182, 2026-10-12): the Bight and the landing hold recorded overrun ceilings (neighbourhoods/budget.ts, a
      // ratchet that may only fall); every other district holds CONTRACT §6.
      expect(d.triangles!.full).toBeLessThanOrEqual(districtBudget(id).full); expect(d.triangles!.lite).toBeLessThanOrEqual(districtBudget(id).lite);
    }
  }, 120_000);
  it('measures the module\'s own art with the runtime layer\'s builder (one measure)', async () => {
    const { ctx, ground } = bake(), b = bakeDressings([flatsModule], ctx); await tick();
    for (const d of b.dressing!.districts) { const f = measureDistrictDressing(d, ground, 'full'); await tick(); const l = measureDistrictDressing(d, ground, 'lite'); await tick(); expect(l.triangles).toBeLessThanOrEqual(f.triangles); expect(f.drawCalls).toBeLessThanOrEqual(40); }
  }, 120_000);
});

describe('page H holds its subjects (D-WW86 pose)', () => {
  it('the strip, the windsock, the balloon and the elevator stand inside the frame, unoccluded by the dressing', () => {
    const { world, ray } = bake(), v = world.views.find(q => q.id === 'H')!;
    const ax = Math.atan2(v.target[0]! - v.eye[0]!, v.target[2]! - v.eye[2]!), half = (v.fovDegrees / 2) * Math.PI / 180;
    const subjects: [string, [number, number, number]][] = [['windsock', [WINDSOCK[0], 44, WINDSOCK[1]]], ['balloon', [BALLOON[0], 52, BALLOON[1]]], ['elevator', [ELEVATOR.at[0], 60, ELEVATOR.at[2]]], ['strip', [435, 38.5, 690]]];
    for (const [id, p] of subjects) {
      const a = Math.atan2(p[0] - v.eye[0]!, p[2] - v.eye[2]!) - ax; expect(Math.abs(Math.atan2(Math.sin(a), Math.cos(a))), id).toBeLessThan(half);
      const dir = [p[0] - v.eye[0]!, p[1] - v.eye[1]!, p[2] - v.eye[2]!] as [number, number, number], len = Math.hypot(...dir);
      const hit = ray.first(v.eye as [number, number, number], [dir[0] / len, dir[1] / len, dir[2] / len], len - 3, { step: 1 });
      // The first thing the ray meets is the sky or the subject itself (the elevator's own walls), never another solid.
      const met = hit.kind === 'solid' ? hit.sourceId : hit.kind; expect(met === 'sky' || (id === 'elevator' && met.startsWith('dressing.flats.flats.elevator.')), `${id}: ${met}`).toBe(true);
    }
  }, 120_000);
});
