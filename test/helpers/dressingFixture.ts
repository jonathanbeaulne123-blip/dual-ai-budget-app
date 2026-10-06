import type {DressingSource} from '../../src/harbour/horizon/neighbourhoods/bake.ts';
import type {BuildingRecord, DressingContext, NeighbourhoodDressing, NeighbourhoodModule} from '../../src/harbour/horizon/neighbourhoods/types.ts';
import type {StructureSolid, WaterCut} from '../../src/harbour/horizon/land/interfaces.ts';

/** Test-local neighbourhood dressing fixtures (the dressing engine's tests; never a registered module). */
/** A flat test island (2 eu) with one walk bed, one pad, one pond, one baked box, the protected circle and two districts. */
export const GROUND = 2;
/** The host's baked walls: a 20 × 10 box over its footprint from the pad (2) to the eave (6), as the bake names it. */
export function hostWalls(): StructureSolid {
  const [x0, x1, z0, z1, y0, y1] = [410, 430, 415, 425, GROUND, GROUND + 4];
  return {id: 'host.test.walls', kind: 'host', positions: [x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1], indices: [4, 6, 5, 4, 7, 6, 0, 1, 2, 0, 2, 3, 0, 4, 5, 0, 5, 1], surface: 'stucco', districtId: 'west', bedIds: [], walkable: false, role: 'wall'};
}
export function fixtureSource(): DressingSource {
  const box: StructureSolid = {id: 'baked.box', kind: 'test', positions: [600, 0, 600, 610, 0, 600, 610, 0, 610, 600, 0, 610, 600, 5, 600, 610, 5, 600, 610, 5, 610, 600, 5, 610], indices: [4, 6, 5, 4, 7, 6, 0, 1, 2, 0, 2, 3], surface: 'stone', districtId: 'east', bedIds: [], walkable: false, role: 'wall'};
  const pond: WaterCut = {id: 'pond', kind: 'lake', outline: [[300, 500], [340, 500], [340, 540], [300, 540]], points: [], level: 1.5, width: 0, depth: 1, bank: 1};
  const circle = Array.from({length: 24}, (_, i) => [800 + Math.cos(i / 24 * Math.PI * 2) * 60, 800 + Math.sin(i / 24 * Math.PI * 2) * 60] as const);
  return {
    ground: () => GROUND,
    beds: [{id: 'walk.a', kind: 'walk', profile: 'walk', points: [[100, GROUND, 300], [500, GROUND, 300]], width: 4}],
    pads: [{id: 'host.test', kind: 'host', centre: [420, GROUND, 420], size: [20, 10], rotationDegrees: 0}],
    waters: [pond], solids: [box, hostWalls()],
    hosts: [{id: 'test', footprint: [[410, 415], [430, 415], [430, 425], [410, 425]], door: {xy: [420, 425]}, height: GROUND}],
    protectedAreas: [{id: 'green', outline: circle}],
    districtAt: x => (x < 500 ? 'west' : 'east'),
  };
}
export const building = (id: string, x: number, z: number, more: Partial<BuildingRecord> = {}): BuildingRecord => ({id, districtId: '', kind: 'cottage', style: 'test.style', at: [x, GROUND, z], yaw: 0.3, size: {w: 8, d: 6, h: 4}, roof: {form: 'gable', pitch: 35, overhang: 0.3, material: 'slate'}, collide: true, ...more});
export const emptyDressing = (id: NeighbourhoodDressing['id']): NeighbourhoodDressing => ({id, buildings: [], plants: [], props: [], ground: [], pools: [], life: [], lights: [], landmarks: [], lookouts: []});
/** A test-local module: every record type, two districts, a seeded scatter. */
export const fixtureModule: NeighbourhoodModule = {
  id: 'hollow',
  build(ctx: DressingContext) {
    const r = ctx.rng('hollow.scatter'), d = emptyDressing('hollow');
    d.buildings.push(building('kiln', 200, 350), building('tower', 700, 350, {kind: 'studio', size: {w: 6, d: 6, h: 12}, landmarkId: 'tower'}), building('home', 420, 420, {kind: 'cottage', hostId: 'test', collide: false, yaw: 0, size: {w: 20, d: 10, h: 4}}));
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
