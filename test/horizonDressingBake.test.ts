import {describe, expect, it} from 'vitest';
import {bakeDressings, collisionPartMesh, collisionSolids, createDressingContext, hashSeed, mulberry32, validateDressing} from '../src/harbour/horizon/neighbourhoods/bake.ts';
import {building, emptyDressing as empty, fixtureModule, fixtureSource, GROUND} from './helpers/dressingFixture.ts';
import {NEIGHBOURHOOD_MODULES} from '../src/harbour/horizon/neighbourhoods/index.ts';
import type {StructureSolid, TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {createRayCaster} from '../src/harbour/horizon/world/raycast.ts';
import {createLandWorld} from '../src/harbour/horizon/world/build.ts';
import {splitHorizonDefinition, serializeHorizonJson} from '../scripts/horizon/artifacts.mjs';
import {appendChunkDressing, parseHorizonChunkPayload} from '../src/house/world/horizonAssets.ts';
import {createHash} from 'node:crypto';

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
    // One solid per collider part (the grammar's support, walls, roof wedges …), ids `dressing.<nbhd>.<record>.<i>`.
    const records = new Set(solids.map(s => s.id.replace(/\.\d+$/, '')));
    expect([...records].sort()).toEqual(['dressing.hollow.bench', 'dressing.hollow.kiln', 'dressing.hollow.tower']);
    for (const s of solids) expect(s.id).toMatch(/^dressing\.hollow\.(bench|kiln|tower)\.\d+$/);
    for (const s of solids) if (s.walkable) expect(['floor', 'deck', 'roof']).toContain(s.role);
    for (const s of solids) {
      expect(s.kind).toBe('dressing'); expect(s.positions.every(Number.isFinite)).toBe(true);
      // Divergence theorem: a closed, outward-wound mesh has a positive signed volume.
      let v = 0; const P = s.positions;
      for (let i = 0; i < s.indices.length; i += 3) { const a = s.indices[i]! * 3, b = s.indices[i + 1]! * 3, c = s.indices[i + 2]! * 3; v += (P[a]! * (P[b + 1]! * P[c + 2]! - P[b + 2]! * P[c + 1]!) - P[a + 1]! * (P[b]! * P[c + 2]! - P[b + 2]! * P[c]!) + P[a + 2]! * (P[b]! * P[c + 1]! - P[b + 1]! * P[c]!)) / 6; }
      expect(v, s.id).toBeGreaterThan(0);
    }
    expect(solids.filter(s => s.id.startsWith('dressing.hollow.tower.')).every(s => s.districtId === 'east')).toBe(true);
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
  it('collider rules: a roof wedge may meet its bottom at the eave; walkable only on floors, decks and flat roofs', () => {
    const problems: string[] = [];
    const wedge = {kind: 'prism' as const, corners: [[0, 5, 0], [4, 5, 0], [4, 7, 3], [0, 7, 3]] as [number, number, number][], bottom: 5, role: 'roof' as const, walkable: false, surface: 'tile'};
    expect(collisionSolids('t', 'w', 'west', [wedge], problems)).toHaveLength(1); expect(problems).toEqual([]);
    collisionSolids('t', 'pitched', 'west', [{...wedge, walkable: true}], problems);
    collisionSolids('t', 'under', 'west', [{...wedge, bottom: 6}], problems);
    collisionSolids('t', 'flat', 'west', [{kind: 'box', centre: [0, 0], size: [4, 4], yaw: 0, bottom: 5, top: 6, role: 'roof', walkable: true, surface: 'lead'}], problems);
    collisionSolids('t', 'wallWalk', 'west', [{kind: 'box', centre: [0, 0], size: [4, 4], yaw: 0, bottom: 5, top: 6, role: 'wall', walkable: true, surface: 'lead'}], problems);
    expect(problems.map(p => p.split(':')[0])).toEqual(['dressing.t.pitched.0', 'dressing.t.under.0', 'dressing.t.wallWalk.0']);
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
