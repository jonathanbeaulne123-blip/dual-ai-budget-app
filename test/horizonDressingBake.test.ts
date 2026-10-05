import {describe, expect, it} from 'vitest';
import {bakeDressings, collisionPartMesh, createDressingContext, hashSeed, mulberry32, validateDressing, type DressingSource} from '../src/harbour/horizon/neighbourhoods/bake.ts';
import {NEIGHBOURHOOD_MODULES} from '../src/harbour/horizon/neighbourhoods/index.ts';
import type {BuildingRecord, DressingContext, NeighbourhoodDressing, NeighbourhoodModule} from '../src/harbour/horizon/neighbourhoods/types.ts';
import type {StructureSolid, TerrainField, WaterCut} from '../src/harbour/horizon/land/interfaces.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {createRayCaster} from '../src/harbour/horizon/world/raycast.ts';
import {createLandWorld} from '../src/harbour/horizon/world/build.ts';
import {splitHorizonDefinition, serializeHorizonJson} from '../scripts/horizon/artifacts.mjs';
import {appendChunkDressing, parseHorizonChunkPayload} from '../src/house/world/horizonAssets.ts';
import {createHash} from 'node:crypto';

/** A flat test island (2 eu) with one walk bed, one pad, one pond, one baked box, the protected circle and two districts. */
const GROUND = 2;
export function fixtureSource(): DressingSource {
  const box: StructureSolid = {id: 'baked.box', kind: 'test', positions: [600, 0, 600, 610, 0, 600, 610, 0, 610, 600, 0, 610, 600, 5, 600, 610, 5, 600, 610, 5, 610, 600, 5, 610], indices: [4, 6, 5, 4, 7, 6, 0, 1, 2, 0, 2, 3], surface: 'stone', districtId: 'east', bedIds: [], walkable: false, role: 'wall'};
  const pond: WaterCut = {id: 'pond', kind: 'lake', outline: [[300, 500], [340, 500], [340, 540], [300, 540]], points: [], level: 1.5, width: 0, depth: 1, bank: 1};
  const circle = Array.from({length: 24}, (_, i) => [800 + Math.cos(i / 24 * Math.PI * 2) * 60, 800 + Math.sin(i / 24 * Math.PI * 2) * 60] as const);
  return {
    ground: () => GROUND,
    beds: [{id: 'walk.a', kind: 'walk', profile: 'walk', points: [[100, GROUND, 300], [500, GROUND, 300]], width: 4}],
    pads: [{id: 'host.test', kind: 'host', centre: [420, GROUND, 420], size: [20, 10], rotationDegrees: 0}],
    waters: [pond], solids: [box],
    hosts: [{id: 'test', footprint: [[410, 415], [430, 415], [430, 425], [410, 425]], door: {xy: [420, 425]}, height: GROUND}],
    protectedAreas: [{id: 'green', outline: circle}],
    districtAt: x => (x < 500 ? 'west' : 'east'),
  };
}
const building = (id: string, x: number, z: number, more: Partial<BuildingRecord> = {}): BuildingRecord => ({id, districtId: '', kind: 'cottage', style: 'test.style', at: [x, GROUND, z], yaw: 0.3, size: {w: 8, d: 6, h: 4}, roof: {form: 'gable', pitch: 35, overhang: 0.3, material: 'slate'}, collide: true, ...more});
const empty = (id: NeighbourhoodDressing['id']): NeighbourhoodDressing => ({id, buildings: [], plants: [], props: [], ground: [], pools: [], life: [], lights: [], landmarks: [], lookouts: []});
/** A test-local module: every record type, two districts, a seeded scatter. */
export const fixtureModule: NeighbourhoodModule = {
  id: 'hollow',
  build(ctx: DressingContext) {
    const r = ctx.rng('hollow.scatter'), d = empty('hollow');
    d.buildings.push(building('kiln', 200, 350), building('tower', 700, 350, {kind: 'studio', size: {w: 6, d: 6, h: 12}, landmarkId: 'tower'}), building('home', 420, 420, {kind: 'cottage', hostId: 'test', collide: false}));
    for (let i = 0; i < 12; i++) { const x = 150 + r() * 300, z = 200 + r() * 60; if (!ctx.occupied(x, z, 1)) d.plants.push({species: 'birch', at: [x, ctx.heightAt(x, z), z], scale: 0.8 + r() * 0.4, yaw: r() * 6}); }
    d.plants.push({species: 'reed', at: [320, 1.5, 520], scale: 1, yaw: 0}, {species: 'oakGiant', at: [800, GROUND, 800], scale: 1, yaw: 0, keep: true}, {species: 'grassTuft', at: [790, GROUND, 790], scale: 1, yaw: 0});
    d.props.push({id: 'bench', kind: 'bench', at: [250, GROUND, 330], yaw: 0, collide: true}, {id: 'swing', kind: 'swing', at: [805, GROUND, 805], yaw: 0}, {kind: 'buoy', at: [310, 1.5, 510], yaw: 0}, {kind: 'bollard', at: [780, GROUND, 800], yaw: 0});
    d.ground.push({polygon: [[150, 320], [180, 320], [180, 340], [150, 340]], surface: 'gravel'}, {polygon: [[620, 320], [650, 320], [650, 340]], surface: 'cobble', tone: 0.2});
    d.pools.push({id: 'scrape', outline: [[700, 200], [720, 200], [720, 215]], level: 1.8});
    d.life.push({kind: 'heron', at: [320, 1.5, 520], radius: 20, count: 2});
    d.lights.push({id: 'hollow.lantern.1', at: [260, GROUND, 330], kind: 'islandLantern', line: 'hollow:ring', order: 0});
    d.landmarks.push({id: 'oak', label: 'The Old Oak', neighbourhood: 'hollow', at: [800, GROUND, 800], top: [800, 38, 800], relayOrder: 2}, {id: 'tower', label: 'A tower', neighbourhood: 'hollow', at: [700, GROUND, 350], top: [700, 20, 350]});
    d.lookouts.push({id: 'hollow.lookout', label: 'Lookout', eye: [250, GROUND + 1.6, 340], facing: 1, targets: ['oak'], viewer: 'standing', bestHour: 'dusk'});
    d.allowInProtected = ['swing'];
    return d;
  },
};

describe('neighbourhood dressing bake (neighbourhoods/bake.ts)', () => {
  it('the registry starts empty and an empty registry bakes nothing', () => {
    expect(NEIGHBOURHOOD_MODULES).toEqual([]);
    expect(bakeDressings([], createDressingContext(fixtureSource()))).toEqual({dressing: null, solids: [], lights: []});
  });
  it('seeded streams are deterministic and distinct per seed', () => {
    const a = mulberry32(hashSeed('x')), b = mulberry32(hashSeed('x')), c = mulberry32(hashSeed('y'));
    const sa = Array.from({length: 5}, a), sb = Array.from({length: 5}, b), sc = Array.from({length: 5}, c);
    expect(sa).toEqual(sb); expect(sa).not.toEqual(sc);
    for (const v of sa) expect(v >= 0 && v < 1).toBe(true);
  });
  it('bakes byte-identically twice (determinism) and splits records per district', () => {
    const one = bakeDressings([fixtureModule], createDressingContext(fixtureSource())), two = bakeDressings([fixtureModule], createDressingContext(fixtureSource()));
    expect(serializeHorizonJson(one).equals(serializeHorizonJson(two))).toBe(true);
    const d = one.dressing!;
    expect(d.districts.map(x => x.districtId)).toEqual(['east', 'west']);
    const west = d.districts.find(x => x.districtId === 'west')!, east = d.districts.find(x => x.districtId === 'east')!;
    expect(west.buildings.map(b => b.id).sort()).toEqual(['home', 'kiln']);
    expect(east.buildings.map(b => b.id)).toEqual(['tower']);
    for (const b of [...west.buildings, ...east.buildings]) expect(b.districtId).toBe(b.at[0] < 500 ? 'west' : 'east');
    expect(east.plants.some(p => p.species === 'oakGiant')).toBe(true);
    expect(west.plants.some(p => p.species === 'reed')).toBe(true);
    expect(west.ground).toHaveLength(1); expect(east.ground).toHaveLength(1); expect(east.pools.map(p => p.id)).toEqual(['scrape']);
    expect(d.landmarks.map(l => l.id)).toEqual(['oak', 'tower']); expect(d.lookouts.map(l => l.id)).toEqual(['hollow.lookout']);
    expect(d.redressedHosts).toEqual(['test']);
    // Journey: the 12 eu tower (≥ JOURNEY_MIN_HEIGHT and a landmark), not the 4 eu kiln.
    expect(d.journey!.map(j => j.id)).toEqual(['tower']);
    expect(d.journey![0]!.footprint).toHaveLength(4);
    expect(one.lights.map(l => l.id)).toEqual(['hollow.lantern.1']);
    // No plant of the scatter landed on the walk bed (the module asked `occupied`).
    for (const p of west.plants.filter(p => p.species === 'birch')) expect(Math.abs(p.at[2] - 300)).toBeGreaterThan(2);
  });
  it('emits building and prop collision as dressing solids with stable ids, closed and outward', () => {
    const {solids} = bakeDressings([fixtureModule], createDressingContext(fixtureSource()));
    expect(solids.map(s => s.id).sort()).toEqual(['dressing.hollow.bench.0', 'dressing.hollow.kiln.0', 'dressing.hollow.tower.0']);
    for (const s of solids) {
      expect(s.kind).toBe('dressing'); expect(s.positions.every(Number.isFinite)).toBe(true);
      // Divergence theorem: a closed, outward-wound mesh has a positive signed volume.
      let v = 0; const P = s.positions;
      for (let i = 0; i < s.indices.length; i += 3) { const a = s.indices[i]! * 3, b = s.indices[i + 1]! * 3, c = s.indices[i + 2]! * 3; v += (P[a]! * (P[b + 1]! * P[c + 2]! - P[b + 2]! * P[c + 1]!) - P[a + 1]! * (P[b]! * P[c + 2]! - P[b + 2]! * P[c]!) + P[a + 2]! * (P[b]! * P[c + 1]! - P[b + 1]! * P[c]!)) / 6; }
      expect(v, s.id).toBeGreaterThan(0);
    }
    expect(solids.find(s => s.id === 'dressing.hollow.tower.0')!.districtId).toBe('east');
  });
  it('a walkable deck part is a floor the body stands on; a wall part blocks it (walkable-correct)', () => {
    const deck = collisionPartMesh({kind: 'box', centre: [100, 100], size: [6, 4], yaw: 0.4, bottom: 0, top: 1.2, role: 'deck', walkable: true, surface: 'timber'});
    const wall = collisionPartMesh({kind: 'prism', corners: [[200, 3, 100], [206, 3, 100], [206, 4, 104], [200, 4, 104]], bottom: 0, role: 'wall', walkable: false, surface: 'stone'});
    const solid = (id: string, m: {positions: number[]; indices: number[]}, walkable: boolean, role: StructureSolid['role']): StructureSolid => ({id, kind: 'dressing', ...m, surface: 's', districtId: 'west', bedIds: [], walkable, role});
    const field: TerrainField = {revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 50, columns: 41, rows: 37, heights: new Float32Array(41 * 37), surfaces: new Uint8Array(41 * 37)};
    const geo = createHorizonGeography(field, {beds: [], pads: [], mouths: [], waters: [], solids: [solid('dressing.t.deck.0', deck, true, 'deck'), solid('dressing.t.wall.0', wall, false, 'wall')], diagnostics: []});
    expect(geo.surface(100, 100, 1.2)?.id).toBe('dressing.t.deck.0');
    expect(geo.surface(100, 100, 1.2)!.y).toBeCloseTo(1.2, 6);
    expect(geo.surface(203, 102, 4)?.id).toBe('terrain'); // a wall is never a floor
    expect(geo.contact(199.9, 102, 0, 0.3, [1, 0])?.id).toBe('dressing.t.wall.0');
    // Ray casts (view proofs, the camera) see dressing solids.
    const ray = createRayCaster(field, {solids: [solid('dressing.t.wall.0', wall, false, 'wall')], waters: [], mouths: []}).first([180, 2, 102], [1, 0, 0], 50);
    expect(ray.kind === 'solid' && ray.sourceId).toBe('dressing.t.wall.0');
  });
  it('validation names every problem: beds, pads, water, solids, protected heights, ids, numbers', () => {
    const ctx = createDressingContext(fixtureSource());
    const bad = empty('hollow');
    bad.buildings.push(building('onBed', 300, 300), building('onPad', 420, 420), building('inPond', 320, 520), building('inBox', 605, 605), building('inGreen', 800, 790, {size: {w: 2, d: 2, h: 3}}), building('dup', 200, 600), building('dup', 200, 650), building('nan', NaN, 10));
    bad.buildings.push(building('deck', 300, 301, {kind: 'deck'}), building('allowed', 250, 299, {params: {allowOnBed: true}}));
    bad.plants.push({species: 'birch', at: [300, GROUND, 300], scale: 1, yaw: 0}, {species: 'shrub', at: [420, GROUND, 421], scale: 1, yaw: 0}, {species: 'birch', at: [320, GROUND, 520], scale: 1, yaw: 0}, {species: 'reed', at: [321, 1.5, 521], scale: 1, yaw: 0}, {species: 'pine', at: [810, GROUND, 800], scale: 1, yaw: 0}, {species: 'grassTuft', at: [811, GROUND, 801], scale: 1, yaw: 0});
    bad.props.push({id: 'kite', kind: 'kite', at: [800, GROUND, 805], yaw: 0}, {id: 'stool', kind: 'bench', at: [300, GROUND, 300], yaw: 0}, {kind: 'bollard', at: [300, GROUND, 301.9], yaw: 0}, {kind: 'fence', at: [300, GROUND, 300], yaw: 0, line: [[290, GROUND, 300], [310, GROUND, 300]]});
    bad.pools.push({id: 'p', outline: [[0, 0], [1, 0]], level: 1});
    bad.landmarks.push({id: 'x', label: 'x', neighbourhood: 'harbour', at: [0, 0, 0], top: [0, 1, 0]});
    const problems = validateDressing([{module: 'hollow', dressing: bad}], ctx), has = (re: RegExp) => problems.some(p => re.test(p));
    expect(has(/building onBed: .* on walk\.a/)).toBe(true);
    expect(has(/building onPad: .* on host\.test/)).toBe(true);
    expect(has(/building inPond: .* on water/)).toBe(true);
    expect(has(/building inBox: .* on baked\.box/)).toBe(true);
    expect(has(/building inGreen: .* inside protected green/)).toBe(true);
    expect(has(/duplicate building id dup/)).toBe(true);
    expect(has(/building nan: a non-finite number/)).toBe(true);
    expect(has(/building deck/)).toBe(false); expect(has(/building allowed/)).toBe(false);
    expect(has(/plant #0 \(birch\): on walk\.a/)).toBe(true);
    expect(has(/plant #1 \(shrub\): on host\.test/)).toBe(true);
    expect(has(/plant #2 \(birch\): on water/)).toBe(true);
    expect(has(/plant #3/)).toBe(false); // reeds grow in water
    expect(has(/plant #4 \(pine\): .* inside protected green/)).toBe(true);
    expect(has(/plant #5/)).toBe(false); // a tuft is under 0.85
    expect(has(/prop kite: kite .* inside protected green/)).toBe(true);
    expect(has(/prop stool: bench stands on walk\.a/)).toBe(true);
    expect(has(/prop #2/)).toBe(false); // a bollard at the bed's edge
    expect(has(/prop #3/)).toBe(false); // a fence follows its line
    expect(has(/pool p: needs ≥ 3/)).toBe(true);
    expect(has(/landmark x: belongs to harbour/)).toBe(true);
    expect(() => bakeDressings([{id: 'hollow', build: () => bad}], ctx)).toThrow(/Neighbourhood dressing is invalid/);
    // The fixture's exceptions are honoured: the listed swing and the oak at its own landmark's base.
    expect(validateDressing([{module: 'hollow', dressing: fixtureModule.build(ctx)}], ctx)).toEqual([]);
    expect(() => bakeDressings([fixtureModule, fixtureModule], ctx)).toThrow(/Duplicate neighbourhood module/);
  });
  it('the context answers from the world: bed clearance, occupied, water, districts, hosts', () => {
    const ctx = createDressingContext(fixtureSource());
    expect(ctx.bedClearance(300, 310)).toBeCloseTo(8, 6);
    expect(ctx.bedClearance(300, 300)).toBeCloseTo(-2, 6);
    expect(ctx.bedClearance(300, 310, ['road'])).toBe(Infinity);
    expect(ctx.occupied(300, 300)).toBe(true); expect(ctx.occupied(300, 310)).toBe(false); expect(ctx.occupied(300, 303, 2)).toBe(true);
    expect(ctx.occupied(605, 605)).toBe(true); expect(ctx.occupied(420, 420)).toBe(true);
    expect(ctx.waterLevelAt(320, 520)).toBe(1.5); expect(ctx.waterLevelAt(100, 100)).toBeNull();
    expect(ctx.districtAt(10, 10)).toBe('west'); expect(ctx.hosts.map(h => h.id)).toEqual(['test']);
  });
});

describe('the baked world carries the dressing (world/build.ts, artifacts.mjs, the chunk loader)', () => {
  const field: TerrainField = {revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 100, columns: 21, rows: 19, heights: new Float32Array(21 * 19).fill(2), surfaces: new Uint8Array(21 * 19)};
  const cuts = {beds: [], pads: [], mouths: [], waters: [], solids: [], diagnostics: []};
  it('no dressing: no field, no extra lights (an empty registry leaves the definition unchanged)', () => {
    const plain = createLandWorld(field, cuts), same = createLandWorld(field, cuts, {});
    expect('dressing' in plain).toBe(false);
    expect(serializeHorizonJson(plain).equals(serializeHorizonJson(same))).toBe(true);
  });
  it('with dressing: the payload, its lights and solids, and each district budget including the dressing art', () => {
    const baked = bakeDressings([fixtureModule], createDressingContext({...fixtureSource(), districtAt: () => 'green'}));
    const plain = createLandWorld(field, cuts);
    const world = createLandWorld(field, cuts, {extraSolids: baked.solids, dressing: {...baked, budget: {green: {full: {triangles: 1000, drawCalls: 7}, lite: {triangles: 400, drawCalls: 5}}}}});
    expect(world.dressing!.landmarks.map(l => l.id)).toEqual(['oak', 'tower']);
    expect(world.lights.at(-1)!.id).toBe('hollow.lantern.1');
    expect(world.geometry!.solids.filter(s => s.kind === 'dressing').length).toBeGreaterThan(0);
    const g = world.districts.find(d => d.id === 'green')!, g0 = plain.districts.find(d => d.id === 'green')!;
    // Dressing colliders are collision only: the district's triangles grow by the measured art alone.
    expect(g.triangles!.full - g0.triangles!.full).toBe(1000); expect(g.triangles!.lite - g0.triangles!.lite).toBe(400);
    expect(g.drawCalls! - g0.drawCalls!).toBe(7); expect(g.dressing!.full.triangles).toBe(1000);
    const over = createLandWorld(field, cuts, {dressing: {...baked, budget: {green: {full: {triangles: 150_001, drawCalls: 1}, lite: {triangles: 1, drawCalls: 1}}}}});
    expect(over.diagnostics!.some(d => d.id === 'budget.green' && d.severity === 'conflict')).toBe(true);
  });
  it('the split puts each district dressing in its chunk and keeps only island-wide parts in the index', () => {
    const baked = bakeDressings([fixtureModule], createDressingContext(fixtureSource()));
    const world = {geographyRevision: 'horizon-geo-1', districts: [{id: 'west'}, {id: 'east'}], geometry: {solids: baked.solids}, dressing: baked.dressing};
    const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex'), split = splitHorizonDefinition(world, sha);
    const index = JSON.parse(split.index.toString());
    expect(index.dressing.districts).toEqual([]);
    expect(index.dressing.landmarks.map((l: {id: string}) => l.id)).toEqual(['oak', 'tower']);
    expect(index.dressing.redressedHosts).toEqual(['test']);
    const loaded = {dressing: index.dressing};
    for (const chunk of split.chunks) {
      const ref = index.chunks.find((c: {districtId: string}) => c.districtId === chunk.districtId);
      const bytes = chunk.json.buffer.slice(chunk.json.byteOffset, chunk.json.byteOffset + chunk.json.byteLength);
      const payload = parseHorizonChunkPayload(bytes, ref);
      expect(payload.dressing!.districtId).toBe(chunk.districtId);
      appendChunkDressing(loaded, payload.dressing);
    }
    expect(loaded.dressing.districts.map((d: {districtId: string}) => d.districtId).sort()).toEqual(['east', 'west']);
    // A chunk without dressing keeps the old shape exactly.
    const bare = splitHorizonDefinition({...world, dressing: undefined}, sha);
    expect(bare.chunks.every(c => !('dressing' in JSON.parse(c.json.toString())))).toBe(true);
    expect('dressing' in JSON.parse(bare.index.toString())).toBe(false);
  });
});
