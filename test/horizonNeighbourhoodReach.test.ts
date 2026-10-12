// The Water's Way, PR 3 — the Reach and the Greenway (STORY place 3; neighbourhoods/landing/reach.ts; D-WW120…129).
// Proofs on the committed bake (the same world the bake dressed): the module rebuilds the baked records deterministically,
// validates clean, keeps the story's sightlines and the lookouts' binocular lines clear of planting, dresses the six lookouts
// with the Lookout kit, carries the osprey pole, lights in night order, keeps the rail gaps, the life cap and the budget.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { StructureSolid } from '../src/harbour/horizon/land/interfaces.ts';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset.ts';
import { greenwayGaps, greenwayLine } from '../src/harbour/horizon/land/structures/greenway.ts';
import { sampleTerrain } from '../src/harbour/horizon/land/terrain/index.ts';
import { districtAt } from '../src/harbour/horizon/world/districts.ts';
import { createDressingContext, validateDressing, type DressingContextImpl } from '../src/harbour/horizon/neighbourhoods/bake.ts';
import { NEIGHBOURHOOD_MODULES } from '../src/harbour/horizon/neighbourhoods/index.ts';
import { buildReachDetailed, NOTCH_IN_GREEN, REACH_TREE_COVER } from '../src/harbour/horizon/neighbourhoods/landing/reach.ts';
import { UNIT_H } from '../src/harbour/horizon/neighbourhoods/landing/reach/marsh.ts';
import { NIGHT_LINE, OPEN_WATER } from '../src/harbour/horizon/neighbourhoods/landing/reach/fixtures.ts';
import { createSite, LOOKOUTS, OSPREY, REACH_POLY } from '../src/harbour/horizon/neighbourhoods/landing/reach/site.ts';
import { blocksSight, inPoly, polyDist, polyEdgeDist } from '../src/harbour/horizon/neighbourhoods/landing/reach/geom.ts';
import { storyLandmark, validateStoryAgainstDressing } from '../src/harbour/horizon/world/story.ts';
import type { NeighbourhoodDressing, PlantRecord, WorldDressing } from '../src/harbour/horizon/neighbourhoods/types.ts';
import type { District, LightAnchor } from '../src/harbour/horizon/world/definition.ts';

type Baked = { dressing?: WorldDressing; districts: District[]; lights: LightAnchor[]; collision: { beds: never[]; pads: never[]; waters: never[] }; geometry: { solids: StructureSolid[] }; hosts: { id: string; footprint?: [number, number][]; door: { xy?: [number, number] }; height?: number }[]; protected: { id: string; outline: [number, number][] }[] };
let world: Baked, ctx: DressingContextImpl, built: ReturnType<typeof buildReachDetailed>, r: NeighbourhoodDressing, again: string, site: ReturnType<typeof createSite>, problems: string[];

// Heavy fixtures once, asynchronously, yielding between the steps (CI runs four workers: a worker held synchronously for long
// fails the gate with "Timeout calling onTaskUpdate" even when every test is green).
const tick = () => new Promise(res => setTimeout(res, 0));
beforeAll(async () => {
  world = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')); await tick();
  const bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin'), field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full'); await tick();
  ctx = createDressingContext({ ground: (x, z) => sampleTerrain(field, x, z), beds: world.collision.beds, pads: world.collision.pads, waters: world.collision.waters, solids: world.geometry.solids.filter(s => s.kind !== 'dressing'),
    hosts: world.hosts.map(h => ({ id: h.id, footprint: h.footprint, door: h.door.xy ? { xy: h.door.xy } : {}, height: h.height })), protectedAreas: world.protected.map(p => ({ id: p.id, outline: p.outline })), districtAt: (x, z) => districtAt(x, z) });
  await tick();
  built = buildReachDetailed(ctx); r = built.dressing; await tick();
  again = JSON.stringify(buildReachDetailed(ctx).dressing); await tick();
  site = createSite(ctx); await tick();
  problems = validateDressing([{ module: 'landing', dressing: r }], ctx); await tick();
}, 400_000);

const bakedPlants = () => world.dressing!.districts.flatMap(d => d.plants);
const bakedProps = () => world.dressing!.districts.flatMap(d => d.props);
const L = greenwayLine();
const nearGreenway = (x: number, z: number, d = 60) => polyDist(x, z, L.full.map(p => [p[0], p[2]])).d < d;
const inReach = (x: number, z: number) => inPoly(x, z, REACH_POLY) || polyEdgeDist(x, z, REACH_POLY) < 14;

describe('the Reach and the Greenway (neighbourhoods/landing, STORY place 3)', () => {
  it('is registered as the landing module and rebuilds the baked records exactly (deterministic, one definition)', () => {
    expect(NEIGHBOURHOOD_MODULES.map(m => m.id)).toContain('landing');
    expect(again).toBe(JSON.stringify(r));
    const plants = new Set(bakedPlants().map(p => JSON.stringify(p))), props = new Map(bakedProps().filter(p => p.id).map(p => [p.id!, JSON.stringify(p)]));
    expect(r.plants.filter(p => !plants.has(JSON.stringify(p)))).toEqual([]);
    expect(r.props.filter(p => props.get(p.id!) !== JSON.stringify(p)).map(p => p.id)).toEqual([]);
    expect(world.dressing!.landmarks.find(l => l.id === 'osprey')).toEqual(r.landmarks[0]);
  });

  it('validates clean against the bake-time world (beds, pads, water, solids, the protected Green)', () => {
    expect(problems).toEqual([]);
    // Only Notch Bluff's Lookout kit stands in the protected circle, by name.
    expect(r.allowInProtected).toEqual([...NOTCH_IN_GREEN]);
  });

  it('plants the marsh at the place\'s scale: thousands of reeds and cattails, sedge, drifts, groves; no palm anywhere', () => {
    const n = (s: PlantRecord['species']) => r.plants.filter(p => p.species === s).length;
    expect(n('reed') + n('cattail')).toBeGreaterThan(3000);
    expect(n('sedge')).toBeGreaterThan(1200);
    expect(n('flowerBed')).toBeGreaterThan(24);   // wild drifts are few and large (D-WW122)
    expect(n('willow') + n('tamarack')).toBeGreaterThan(40);
    expect(n('dogwood')).toBeGreaterThan(40);
    expect(n('pine') + n('spruce')).toBeGreaterThan(10);
    const palms = bakedPlants().filter(p => ['palm', 'fanPalm', 'canaryPalm'].includes(p.species) && (inReach(p.at[0], p.at[2]) || nearGreenway(p.at[0], p.at[2])));
    expect(palms).toEqual([]);
  });

  it('keeps the story lines (Spring Bay → campanile, oak → osprey) and every lookout\'s binocular lines clear of planting', () => {
    const drawn = (p: PlantRecord) => (UNIT_H as Record<string, number>)[p.species] ?? 1;
    const blocked = r.plants.map(p => ({ p, hit: blocksSight(site.lines, p.at[0], p.at[2], p.at[1] + drawn(p) * p.scale, 0.3) })).filter(q => q.hit);
    expect(blocked.map(q => `${q.p.species} at ${q.p.at.map(v => v.toFixed(1)).join(',')} → ${q.hit}`)).toEqual([]);
    expect(site.lines.map(l => l.id)).toEqual(expect.arrayContaining(['springBay→campanile', 'oak→osprey', 'notchBluff→osprey', 'sunsetRail→osprey']));
  });

  it('dresses the six lookouts with the Lookout kit and matches the story registry', () => {
    for (const l of LOOKOUTS) {
      const kit = r.props.filter(p => p.id?.startsWith(`reach.${l.id}.`)).map(p => p.kind).sort();
      // Spring Bay's ring round the boardwalk's meeting square (kept clear) has no room for a bench.
      expect(kit, l.id).toEqual(l.kind === 'hide' ? ['bench'] : l.id === 'springBay' ? ['panel', 'viewer', 'viewerSeated'] : ['bench', 'panel', 'viewer', 'viewerSeated']);
      expect(r.lookouts.find(q => q.id === l.id)?.targets, l.id).toEqual(expect.arrayContaining(l.id === 'harbourBellLanding' ? ['lamp', 'osprey'] : ['osprey', 'lamp']));
    }
    expect(validateStoryAgainstDressing({ dressing: world.dressing! })).toMatchObject({ skipped: false, problems: [] });
    // Every viewer is free (a lever, no coin): the kit draws VIEWER_PARTS; a viewer faces its lookout's view.
    for (const p of r.props.filter(q => q.kind === 'viewer' || q.kind === 'viewerSeated')) expect(p.collide).toBe(true);
  });

  it('stands the osprey pole on its footing [1292, 1268], colliding, its top the registry\'s (15.6 ± 1.5), clear of tall planting (r 9)', () => {
    const pole = r.props.find(p => p.kind === 'ospreyPole')!;
    expect([pole.at[0], pole.at[2]]).toEqual(OSPREY); expect(pole.collide).toBe(true);
    const lm = r.landmarks.find(l => l.id === 'osprey')!, reg = storyLandmark('osprey');
    expect(Math.abs(lm.top[1] - reg.top[1])).toBeLessThanOrEqual(1.5); expect(lm.relayOrder).toBe(reg.relayOrder);
    expect(r.plants.filter(p => Math.hypot(p.at[0] - OSPREY[0], p.at[2] - OSPREY[1]) < 9 && (UNIT_H as Record<string, number>)[p.species]! * p.scale > 0.9)).toEqual([]);
  });

  it('lights in night order (STYLE: the High Span → the boardwalk\'s edge lamps → the Greenway\'s lanterns), emissive cards only', () => {
    const mine = world.lights.filter(l => l.line === NIGHT_LINE);
    expect(mine.length).toBe(r.lights.length);
    expect(mine.every(l => l.kind === 'dressing:islandLantern' || l.kind === 'dressing:railLamp')).toBe(true);
    const order = (prefix: string) => mine.filter(l => l.id.startsWith(prefix)).map(l => l.order!);
    const bw = order('reach.boardwalk.'), gw = order('greenway.');
    expect(bw).toHaveLength(12); expect(Math.max(...bw)).toBeLessThan(Math.min(...gw));
    expect(gw).toEqual([...gw].sort((a, b) => a - b));
    // Each lantern prop has its anchor over it; the Greenway's run outward from the Gate (s increasing with order).
    // Each island lantern's anchor stands over its prop; over the open water (s 612–955) the lamps ride the rail posts.
    for (const l of r.lights.filter(q => q.kind === 'islandLantern')) expect(r.props.some(p => p.kind === 'lantern' && `${p.id}.light` === l.id), l.id).toBe(true);
    for (const l of r.lights.filter(q => q.kind === 'railLamp')) { const s0 = polyDist(l.at[0], l.at[2], L.full.map(p => [p[0], p[2]])).s; expect((s0 > OPEN_WATER[0] && s0 < OPEN_WATER[1]) || districtAt(l.at[0], l.at[2]) === 'bight', l.id).toBe(true); }
    // No island lantern post stands in the Bight district (its land holds the budget, D-WW126).
    expect(r.props.filter(p => p.kind === 'lantern' && districtAt(p.at[0], p.at[2]) === 'bight').map(p => p.id)).toEqual([]);
    const s = r.lights.filter(l => l.id.startsWith('greenway.')).map(l => polyDist(l.at[0], l.at[2], L.full.map(p => [p[0], p[2]])).s);
    expect(s).toEqual([...s].sort((a, b) => a - b));
  });

  it('keeps the rail gaps open: no lantern in the Channel Hide\'s gap nor within 1 m of a Greenway gap', () => {
    for (const p of r.props.filter(q => q.id?.startsWith('reach.boardwalk.lantern'))) { const s = (p.at[0] - site.bw.a[0]) * site.bw.dir[0] + (p.at[2] - site.bw.a[1]) * site.bw.dir[1], west = (p.at[0] - site.bw.a[0]) * site.bw.n[0] + (p.at[2] - site.bw.a[1]) * site.bw.n[1] < 0;
      expect(west && s > 54.4 - 0.5 && s < 58 + 0.5, p.id).toBe(false); }
    const gaps = { [-1]: greenwayGaps(-1), [1]: greenwayGaps(1) } as Record<number, number[][]>;
    for (const p of r.props.filter(q => q.id?.startsWith('greenway.lantern'))) {
      const s = polyDist(p.at[0], p.at[2], L.full.map(q => [q[0], q[2]])).s, q = L.at(s), side = Math.sign((p.at[0] - q.p[0]) * q.r[0] + (p.at[2] - q.p[2]) * q.r[1]);
      expect(gaps[side]!.some(g => s > g[0]! - 1 && s < g[1]! + 1), p.id).toBe(false);
    }
  });

  it('floats twelve reed rafts on the Bight, tethered to the deck, clear of the Arch Pier, the Paddle Dock and the Sunset Balcony', () => {
    const rafts = r.props.filter(p => p.kind === 'raft');
    expect(rafts).toHaveLength(12);
    for (const p of rafts) {
      expect(ctx.waterLevelAt(p.at[0], p.at[2]), p.id).not.toBeNull();
      expect(p.line).toHaveLength(2);
      const s = polyDist(p.at[0], p.at[2], L.full.map(q => [q[0], q[2]])).s;
      expect(s).toBeGreaterThan(620); expect(s).toBeLessThan(955);
      for (const [place, gap] of [[690, 14], [790, 16], [962, 14]] as const) if (Math.abs(s - place) < gap) expect(Math.sign((p.at[0] - L.at(s).p[0]) * L.at(s).r[0] + (p.at[2] - L.at(s).p[2]) * L.at(s).r[1]), p.id).toBe(1);
    }
  });

  it('stands the muskrat lodges in the Reach channels\' shallow water, off the River Run, the first in the Channel Hide\'s slot view', () => {
    const lodges = r.props.filter(p => p.kind === 'lodge');
    expect(lodges.length).toBeGreaterThanOrEqual(2);
    const river = [[1140, 905], [1170, 980], [1220, 1060], [1250, 1140], [1280, 1220], [1330, 1290], [1350, 1345], [1364, 1390]] as [number, number][];
    for (const p of lodges) {
      const lvl = ctx.waterLevelAt(p.at[0], p.at[2]);
      expect(lvl, p.id).not.toBeNull(); expect(p.at[1]).toBeCloseTo(lvl! - 0.3, 3); expect(p.collide).toBe(true);
      expect(polyDist(p.at[0], p.at[2], river).d, p.id).toBeGreaterThanOrEqual(7);
    }
    expect(Math.hypot(lodges[0]!.at[0] - 1236, lodges[0]!.at[2] - 1292)).toBeLessThan(4);
  });

  it('keeps creatures ≤ 24 per district (the Reach\'s own share leaves room for Long Sands and the Flats)', () => {
    const per = new Map<string, number>();
    for (const d of world.dressing!.districts) per.set(d.districtId, d.life.reduce((n, l) => n + l.count, 0));
    for (const [id, n] of per) expect(n, id).toBeLessThanOrEqual(24);
    const mine = new Map<string, number>(); for (const l of r.life) { const d = districtAt(l.at[0], l.at[2]); mine.set(d, (mine.get(d) ?? 0) + l.count); }
    expect(mine.get('reach')).toBeLessThanOrEqual(24); expect(mine.get('landing') ?? 0).toBeLessThanOrEqual(12); expect(mine.get('bight') ?? 0).toBeLessThanOrEqual(8);
  });

  it('leaves the land\'s proofs as they were: the bridges\' meeting squares stay clear, the Bluff End junction stays open', () => {
    const diag = (world as unknown as { diagnostics: { id: string; severity: string }[] }).diagnostics;
    const conflicts = diag.filter(d => d.severity === 'conflict' && (/^bridges\.(reachBoardwalk|quayBridge|reachFootbridge|highSpan)\./.test(d.id) || d.id.startsWith('cross.greenway') || d.id.startsWith('structures.greenway') || d.id.startsWith('structures.channelHide') || d.id.startsWith('structures.notchBluff') || d.id.startsWith('structures.sunsetRail')));
    expect(conflicts.map(d => d.id)).toEqual([]);
  });

  it('parks bicycles and boards at both Greenway thresholds (a rack within 15 m)', () => {
    for (const [x, z] of [[1222, 1317.5], [868.07, 734.67]] as const) expect(r.props.some(p => p.kind === 'bikeRack' && Math.hypot(p.at[0] - x, p.at[2] - z) < 15)).toBe(true);
  });

  it(`holds the Reach's tree cover over its unbuilt ground at ${REACH_TREE_COVER} % ± 5`, () => {
    const crown: Record<string, number> = { willow: 4.2, tamarack: 2.2, dogwood: 1.1, pine: 2.4, spruce: 2.2 };
    let canopy = 0, ground = 0;
    for (let x = 1160; x < 1370; x += 2) for (let z = 1180; z < 1360; z += 2) { if (!inPoly(x, z, REACH_POLY) || ctx.occupied(x, z)) continue; ground += 4; }
    for (const p of r.plants) if (crown[p.species] && inPoly(p.at[0], p.at[2], REACH_POLY)) canopy += Math.PI * (crown[p.species]! * p.scale) ** 2;
    const cover = 100 * canopy / ground;
    expect(Math.abs(cover - REACH_TREE_COVER)).toBeLessThanOrEqual(5);
  });

  it('fits the per-district budget (CONTRACT §6: ≤ 150k / 60k triangles, the baked land included); the Bight is the land\'s', () => {
    for (const id of ['reach', 'notch', 'landing', 'green', 'hollow']) {
      const d = world.districts.find(q => q.id === id)!;
      expect(d.triangles!.full, `${id} full`).toBeLessThanOrEqual(150_000); expect(d.triangles!.lite, `${id} lite`).toBeLessThanOrEqual(60_000);
    }
    // The Bight held 145.0k / 59.4k from the land alone (PR 2), so no dressing fits its lite cap; the Reach's share there stays
    // within this allowance (the Greenway's Bight stretch: lanterns on land, rail lamps over the water, rafts, the balcony,
    // the Arch Pier, the bluff) and the overrun is the integrator's (D-WW129). Shares measured with the Reach alone dressing.
    const bight = world.districts.find(q => q.id === 'bight')!.dressing!;
    expect(bight.full.triangles).toBeLessThanOrEqual(15_000); expect(bight.lite.triangles).toBeLessThanOrEqual(7_000);
    expect(world.districts.find(q => q.id === 'reach')!.dressing).toBeTruthy();
  });
});
