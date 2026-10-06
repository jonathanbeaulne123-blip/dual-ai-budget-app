// The Water's Way PR 3 · the Highlands (module `crown`, D-WW100…109): the crofting hamlet, Westwatch Chapel, Fallswatch,
// High Shieling Ranch, the drag lift, the planting and the paint, on the committed bake (the records the bake wrote) and
// re-run against the same world for determinism and the bake's own validation.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LandCuts, StructureSolid } from '../src/harbour/horizon/land/interfaces.ts';
import type { BuildingRecord, DistrictDressing, PropRecord, WorldDressing } from '../src/harbour/horizon/neighbourhoods/types.ts';
import type { LightAnchor } from '../src/harbour/horizon/world/definition.ts';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset.ts';
import { terrainHeight } from '../src/harbour/horizon/world/geometry.ts';
import { pointInPolygon } from '../src/harbour/horizon/world/geometry.ts';
import { districtAt } from '../src/harbour/horizon/world/districts.ts';
import { protectedGreenOutline } from '../src/harbour/horizon/world/views.ts';
import { createDressingContext, SPECIES_HEIGHT, TUNNEL_COVER, validateDressing } from '../src/harbour/horizon/neighbourhoods/bake.ts';
import { buildingPlan } from '../src/harbour/horizon/kit/buildings/index.ts';
import { drawProp } from '../src/harbour/horizon/kit/props/index.ts';
import { wwVariant } from '../src/harbour/horizon/kit/plants/species.ts';
import { CardBuilder } from '../src/harbour/art/cardScene.ts';
import { crown, CHAPEL, COTE_TOP, HAMLET, LIFT, ORCHARD, SPRUCE_SCALE } from '../src/harbour/horizon/neighbourhoods/crown/index.ts';
import { onV2Footprint, SHOULDER } from '../src/harbour/horizon/neighbourhoods/crown/site.ts';
import { V3_BENCHES, benchWeight } from '../src/harbour/horizon/land/mountainV3/landform.ts';
import { storyEye, storyLandmark, validateStoryAgainstDressing } from '../src/harbour/horizon/world/story.ts';

type Baked = { dressing: WorldDressing; lights: LightAnchor[]; districts: { id: string; triangles: { full: number; lite: number }; drawCalls?: number }[] };
let cache: { json: Baked & Record<string, any>; ground: (x: number, z: number) => number } | null = null;
const world = () => {
  if (cache) return cache;
  const json = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')), bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full');
  return (cache = { json, ground: (x, z) => terrainHeight(field, x, z) });
};
/** The module's own records as baked (ids are the module's; the bake files them per district). */
const mine = () => {
  const d = world().json.dressing, crownDistricts = d.districts as DistrictDressing[];
  const ours = <T extends { id?: string }>(list: T[]) => list;
  const buildings = crownDistricts.flatMap(x => x.buildings.filter(b => b.style === 'crown.croft'));
  const props = crownDistricts.flatMap(x => x.props.filter(p => /^(hamlet|westwatch|fallswatch|ranch|lift|rim|col|springs|orchard)\./.test(p.id ?? '')));
  return { buildings: ours(buildings), props, lights: world().json.lights.filter(l => l.id.startsWith('crown.')), landmarks: d.landmarks.filter(l => l.neighbourhood === 'crown'), lookouts: d.lookouts.filter(l => l.id === 'fallswatch') };
};
const corners = (b: BuildingRecord) => { const c = Math.cos(b.yaw), s = Math.sin(b.yaw), hx = b.size.w / 2, hz = b.size.d / 2; return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([u, v]) => [b.at[0] + u! * c + v! * s, b.at[2] + v! * c - u! * s] as const); };
/** The module re-run against the baked world (without its own baked colliders, which did not exist when it ran). */
function rerun() {
  const { json, ground } = world();
  const solids = (json.geometry.solids as (StructureSolid & { sourceId?: string })[]).map(q => ({ ...q, id: q.sourceId ?? q.id.split('@')[0]! })).filter(q => !q.id.startsWith('dressing.'));
  const cuts = { ...json.collision, solids } as LandCuts;
  const ctx = createDressingContext({ ground, beds: cuts.beds, pads: cuts.pads, waters: cuts.waters, solids, hosts: json.hosts.map((h: any) => ({ id: h.id, footprint: h.footprint, door: h.door?.xy ? { xy: h.door.xy } : {}, height: h.height })), protectedAreas: [{ id: 'green', outline: protectedGreenOutline() }], districtAt: (x, z) => districtAt(x, z) });
  return { ctx, a: crown.build(ctx), b: crown.build(ctx) };
}

describe('the Highlands dressing on the bake (D-WW100…109)', () => {
  it('builds nine crofts on Bench Hamlet\'s shelf beside the lanes, each with its walled yard and door to the lane', () => {
    const shelf = V3_BENCHES.find(b => b.id === 'bench.hamlet')!, crofts = mine().buildings.filter(b => b.kind === 'croft');
    expect(crofts).toHaveLength(HAMLET.crofts);
    expect(crofts.filter(c => c.size.w >= 10)).toHaveLength(HAMLET.big);
    const { ground } = world();
    for (const c of crofts) {
      expect(benchWeight(shelf, c.at[0], c.at[2]), c.id).toBeGreaterThan(.5);
      const g = corners(c).map(([x, z]) => ground(x, z));
      expect(Math.max(...g) - Math.min(...g), `${c.id} ground span`).toBeLessThanOrEqual(HAMLET.maxSpan + .3);
      expect(c.at[1] - Math.max(...g), `${c.id} floor on its ground`).toBeLessThan(.4);
      expect(mine().props.filter(p => p.kind === 'drystoneWall' && p.id!.startsWith(`${c.id}.yard`)).length, `${c.id} yard`).toBeGreaterThan(0);
    }
    for (let i = 0; i < crofts.length; i++) for (let j = i + 1; j < crofts.length; j++) expect(Math.hypot(crofts[i]!.at[0] - crofts[j]!.at[0], crofts[i]!.at[2] - crofts[j]!.at[2])).toBeGreaterThan(9);
    // The township's walls and fank: strips, the roadside dyke from the north pass, the fank.
    const walls = mine().props.filter(p => p.kind === 'drystoneWall');
    expect(walls.some(w => w.id!.includes('.strip.'))).toBe(true);
    expect(walls.some(w => w.id!.startsWith('hamlet.dyke'))).toBe(true);
    expect(mine().props.some(p => p.kind === 'sheepFank')).toBe(true);
  });
  it('raises Westwatch Chapel\'s verdigris cote to the registry\'s landmark top and rings the first bell', () => {
    const chapel = mine().buildings.find(b => b.id === 'westwatch.chapel')!;
    expect(chapel.kind).toBe('chapel'); expect(chapel.landmarkId).toBe('westwatch');
    const plan = buildingPlan(chapel) as ReturnType<typeof buildingPlan> & { coteTop: number };
    expect(chapel.at[1] + plan.coteTop).toBeCloseTo(COTE_TOP, 2);
    expect(COTE_TOP).toBeGreaterThanOrEqual(96);
    const lm = mine().landmarks.find(l => l.id === 'westwatch')!, reg = storyLandmark('westwatch');
    expect(lm.bell).toBe('westwatch'); expect(lm.relayOrder).toBe(1);
    expect(Math.hypot(lm.top[0] - reg.top[0], lm.top[2] - reg.top[2])).toBeLessThan(.5);
    expect(Math.abs(chapel.yaw - CHAPEL.yaw)).toBeLessThan(1e-9);
    expect(validateStoryAgainstDressing(world().json)).toMatchObject({ skipped: false, problems: [] });
  });
  it('dresses Fallswatch as a lookout: the registry eye on its deck, viewers with the free lever, a bench, a panel, open rails, the lamp', () => {
    const lk = mine().lookouts[0]!, eye = storyEye('fallswatch');
    expect(Math.hypot(lk.eye[0] - eye.at[0], lk.eye[2] - eye.at[1])).toBeLessThan(.01);
    expect(lk.targets).toEqual(['oak', 'veilLip', 'lamp']);
    const deck = mine().buildings.find(b => b.id === 'fallswatch.deck')!;
    expect(deck.kind).toBe('deck'); expect(deck.params?.rails).toBe('front,back');
    expect(lk.eye[1] - deck.at[1]).toBeCloseTo(1.6, 3);
    const kinds = mine().props.filter(p => p.id!.startsWith('fallswatch.')).map(p => p.kind);
    for (const k of ['viewer', 'viewerSeated', 'bench', 'panel', 'lantern'] as const) expect(kinds, k).toContain(k);
    const lm = mine().landmarks.find(l => l.id === 'fallswatch')!;
    expect(lm.relayOrder).toBe(2);
  });
  it('lights in night order: chapel lantern → hamlet windows → Fallswatch deck lamp → ranch window (emissive cards only)', () => {
    const lights = mine().lights;
    expect(lights.every(l => l.kind.startsWith('dressing:') && l.line === 'crown.night')).toBe(true);
    const order = (p: RegExp) => [...new Set(lights.filter(l => p.test(l.id)).map(l => l.order))];
    expect(order(/westwatch/)).toEqual([0]); expect(order(/hamlet/)).toEqual([1]); expect(order(/fallswatch/)).toEqual([2]); expect(order(/ranch/)).toEqual([3]);
    expect(lights.filter(l => /hamlet/.test(l.id)).length).toBeGreaterThanOrEqual(3);
  });
  it('builds the ranch and the drag lift (towers on the manifest points, a station at each end, the rope with T-bars)', () => {
    const b = mine().buildings;
    for (const id of ['ranch.longhouse', 'ranch.barn']) expect(b.map(x => x.id)).toContain(id);
    expect(mine().props.some(p => p.kind === 'fence' && p.id!.startsWith('ranch.paddock'))).toBe(true);
    const towers = b.filter(x => x.id.startsWith('lift.tower.'));
    expect(towers.map(t => [t.at[0], t.at[2]])).toEqual(LIFT.towers);
    expect(b.filter(x => x.kind === 'liftStation')).toHaveLength(2);
    const ropes = mine().props.filter(p => p.id!.startsWith('lift.rope.'));
    expect(ropes.map(r => r.variant).sort()).toEqual([1, 2]);
    expect(ropes.every(r => r.line!.length === LIFT.towers.length + 2 && !r.collide)).toBe(true);
  });
  it('keeps every record off Mountain v2\'s own footprint and out of the protected Green', () => {
    const d = world().json.dressing.districts as DistrictDressing[], green = protectedGreenOutline();
    const ours = rerun().a;
    const pts: [string, number, number][] = [
      ...ours.buildings.flatMap(b => corners(b).map(([x, z]) => [b.id, x, z] as [string, number, number])),
      ...ours.plants.map((p, i) => [`plant ${i}`, p.at[0], p.at[2]] as [string, number, number]),
      ...ours.props.flatMap(p => [[p.id ?? p.kind, p.at[0], p.at[2]], ...(p.line ?? []).map(q => [p.id ?? p.kind, q[0], q[2]])] as [string, number, number][]),
    ];
    for (const [id, x, z] of pts) { expect(onV2Footprint(x, z), `${id} at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false); expect(pointInPolygon(x, z, green), id).toBe(false); }
    for (const g of ours.ground) { const c = g.polygon.reduce((a, p) => [a[0] + p[0] / g.polygon.length, a[1] + p[1] / g.polygon.length], [0, 0]); expect(onV2Footprint(c[0]!, c[1]!)).toBe(false); }
    expect(d.length).toBeGreaterThan(0);
  }, 120_000);
  it('plants no tree above the Shoulder (110) but the walled dwarf orchard; dwarf spruce is tuckamore in Newfoundland', () => {
    const { ground } = world(), ours = rerun().a.plants, trees = ours.filter(p => (SPECIES_HEIGHT[p.species] ?? 0) >= 3);
    const orchard = V3_BENCHES.find(b => b.id === ORCHARD.bench)!;
    for (const t of trees) {
      if (ground(t.at[0], t.at[2]) <= SHOULDER) continue;
      expect(t.species, `${t.species} at ${t.at.join(',')}`).toBe('apple');
      expect(t.scale).toBeLessThanOrEqual(ORCHARD.scale[1]);
      expect(benchWeight(orchard, t.at[0], t.at[2])).toBeGreaterThan(.3);
    }
    const spruce = ours.filter(p => p.species === 'spruce');
    expect(spruce.length).toBeGreaterThan(100);
    for (const s of spruce) { expect(s.scale).toBeLessThanOrEqual(SPRUCE_SCALE[1]); expect(wwVariant('spruce', 'newfoundland', s.scale, .5).variant).toBe('tuck'); }
    expect(ours.filter(p => p.species === 'birch').length).toBeGreaterThan(8);
    expect(ours.filter(p => p.species === 'apple').length).toBeGreaterThan(6);
    // Highland flowers are the highland set (FLOWER_SET.highland = 5) and lilies float only on water.
    for (const f of ours.filter(p => p.species === 'flowerBed')) expect(Math.floor(f.tint!)).toBe(5);
  }, 120_000);
  it('keeps the binocular lines clear of its own planting: Fallswatch → oak / Veil lip / Lamp and the Bight lookout → the cote', () => {
    const { ground } = world(), ours = rerun().a.plants;
    const lines = [...['oak', 'veilLip', 'lamp'].map(t => ({ from: [1086, ground(1086, 694.3) + 1.6, 694.3], to: storyLandmark(t).top })),
      { from: [744, storyEye('bightLookout').y!, 511], to: storyLandmark('westwatch').top }];
    for (const p of ours) for (const l of lines) {
      const dx = l.to[0]! - l.from[0]!, dz = l.to[2]! - l.from[2]!, t = Math.max(0, Math.min(1, ((p.at[0] - l.from[0]!) * dx + (p.at[2] - l.from[2]!) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(l.from[0]! + dx * t - p.at[0], l.from[2]! + dz * t - p.at[2]) > 1.5 || t < .01) continue;
      const lineY = l.from[1]! + (l.to[1]! - 2 - l.from[1]!) * t;
      expect(p.at[1] + (SPECIES_HEIGHT[p.species] ?? 10) * p.scale, `${p.species} under a sightline`).toBeLessThan(lineY - .5);
    }
  }, 120_000);
  it('is deterministic and valid against the baked world, and stays inside the district budgets', () => {
    const { ctx, a, b } = rerun();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(validateDressing([{ module: 'crown', dressing: a }], ctx)).toEqual([]);
    // Creatures: ≤ 10 per district from this module (≤ 24 full / 10 lite per district in all; lite keeps every spawn).
    const perDistrict = new Map<string, number>(); for (const l of a.life) perDistrict.set(districtAt(l.at[0], l.at[2]), (perDistrict.get(districtAt(l.at[0], l.at[2])) ?? 0) + l.count);
    for (const [, n] of perDistrict) expect(n).toBeLessThanOrEqual(10);
    expect(a.life.some(l => l.kind === 'sheep')).toBe(true); expect(a.life.some(l => l.kind === 'raven')).toBe(true);
    // The baked district budgets (CONTRACT §6) with the land: ≤ 150k / 60k triangles, ≤ 400 draw calls.
    for (const d of world().json.districts.filter(x => ['crown', 'hollow', 'lakeside', 'prow'].includes(x.id))) {
      expect(d.triangles.full, d.id).toBeLessThanOrEqual(150_000); expect(d.triangles.lite, d.id).toBeLessThanOrEqual(60_000);
      expect(d.drawCalls ?? 0).toBeLessThanOrEqual(400);
    }
  }, 180_000);
});

describe('the engine and kit additions the Highlands needed', () => {
  it('treats a bed stretch buried ≥ TUNNEL_COVER under the ground as tunnel, not as ground (the cover ridge over the Stillwater road)', () => {
    const base = { pads: [], waters: [], solids: [], hosts: [], protectedAreas: [], districtAt: () => 'x' };
    const tunnel = createDressingContext({ ...base, ground: () => 60, beds: [{ id: 'tunnel', kind: 'road', profile: 'road', points: [[0, 60 - TUNNEL_COVER - 1, 0], [100, 60 - TUNNEL_COVER - 1, 0]], width: 8 }] });
    const road = createDressingContext({ ...base, ground: () => 60, beds: [{ id: 'road', kind: 'road', profile: 'road', points: [[0, 60, 0], [100, 60, 0]], width: 8 }] });
    expect(tunnel.onBed(50, 0)).toBeNull(); expect(tunnel.occupied(50, 0)).toBe(false);
    expect(road.onBed(50, 0)).toBe('road');
  });
  it('draws the drag lift\'s haul rope (festoon variant 1 with T-bars, 2 bare) with no glow bulbs', () => {
    const rope = (variant: number): PropRecord => ({ kind: 'festoon', at: [0, 10, 0], yaw: 0, variant, line: [[0, 10, 0], [40, 14, 0], [80, 18, 0]] });
    for (const theme of ['classic', 'taylor', 'newfoundland'] as const) {
      const mk = () => new CardBuilder('t', 'full', { ink: '#5b5447' }), one = mk(), two = mk(), lights = mk();
      drawProp(one, rope(1), theme, () => 0, 'full'); drawProp(two, rope(2), theme, () => 0, 'full'); drawProp(lights, rope(0), theme, () => 0, 'full');
      const count = (b: CardBuilder, bucket: string) => [...(b as unknown as { cells: Map<string, { data: Record<string, { positions: number[] }> }> }).cells.values()].reduce((n, c) => n + (c.data[bucket]?.positions.length ?? 0), 0);
      expect(count(one, 'glow') + count(two, 'glow')).toBe(0);          // a rope, never a string of bulbs
      expect(count(lights, 'glow')).toBeGreaterThan(0);                  // variant 0 is still the festoon
      expect(count(one, 'steel')).toBeGreaterThan(count(two, 'steel'));  // the T-bars hang from the up side only
    }
  });
});
