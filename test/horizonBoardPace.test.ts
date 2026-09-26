import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography, HORIZON_G} from '../src/harbour/horizon/runtime/geography.ts';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest.ts';
import type {Bed, WorldDefinition} from '../src/harbour/horizon/world/definition.ts';
import {bedAt, createBoardContact, isPickupThreshold, paceOf, type BoardContact} from '../src/harbour/horizon/movers/shared/ground/contact.ts';
import {BOARD_TEST_PROFILE} from '../src/harbour/horizon/movers/shared/ground/synthetic.ts';
import type {GroundProfile, Pace} from '../src/harbour/horizon/movers/shared/ground/types.ts';

// The real baked world (the same assets the runtime loads): geometry v1 is unchanged by MANIFEST v1.7.
let world: WorldDefinition, geography: ReturnType<typeof createHorizonGeography>, board: BoardContact, bicycle: BoardContact;
const BICYCLE: GroundProfile = {...BOARD_TEST_PROFILE, pop: false, beds: ['road', 'trail', 'pad']};
const paces = M.paces as unknown as Record<string, {roll: number | null; pushGrip: number | null}>;
const surfaces = M.surfaces as unknown as Record<string, {pace: string; grip: number | null}>;
const bed = (id: string): Bed => world.beds.find(b => b.id === id)!;
function distanceToBed(b: Bed, x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < b.points.length; i++) {
    const a = b.points[i - 1]!, c = b.points[i]!, dx = c[0] - a[0], dz = c[2] - a[2], d = dx * dx + dz * dz;
    const f = d ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / d)) : 0;
    best = Math.min(best, Math.hypot(x - a[0] - dx * f, z - a[2] - dz * f));
  }
  return best;
}
/** A point `offset` metres to the side of bed point i (left of travel). */
function beside(b: Bed, i: number, offset: number): [number, number] {
  const a = b.points[i]!, c = b.points[i + 1]!, len = Math.hypot(c[0] - a[0], c[2] - a[2]);
  return [a[0] - (c[2] - a[2]) / len * offset, a[2] + (c[0] - a[0]) / len * offset];
}

beforeAll(() => {
  const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz'), terrain = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const loaded = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const field = decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset, terrain.byteOffset + terrain.byteLength) as ArrayBuffer, 'full');
  world = loaded;
  geography = createHorizonGeography(field, {...loaded.collision, solids: loaded.geometry.solids, diagnostics: loaded.diagnostics ?? []});
  board = createBoardContact(geography, world, M, BOARD_TEST_PROFILE);
  bicycle = createBoardContact(geography, world, M, BICYCLE);
}, 120000);

describe('MANIFEST v1.7 paces resolve (RIDE §8.3)', () => {
  it('has one gravity (D40)', () => expect(HORIZON_G).toBe(12));
  it('resolves every surface id and every skate segment pace to one paces row', () => {
    for (const [id, row] of Object.entries(surfaces)) expect(Object.hasOwn(paces, row.pace), id).toBe(true);
    for (const id of ['S1', 'S2', 'S3', 'S4'] as const) for (const seg of M.skate[id].segments) {
      expect(Object.hasOwn(paces, seg.pace), `${id} ${seg.name}`).toBe(true);
      expect(Object.hasOwn(surfaces, seg.surface), `${id} ${seg.name}`).toBe(true);
    }
    // Every bed segment in the baked world carries a pace the manifest defines.
    for (const b of world.beds) for (const seg of b.surfaceSegments ?? []) expect(Object.hasOwn(paces, seg.pace), b.id).toBe(true);
  });
});

describe('the board contact adapter over the real world', () => {
  it('samples every built threshold pad legal for the board and the bicycle: threshold pace, or a pick-up pad at its line\'s pace', () => {
    const built = world.thresholds.filter(t => t.built);
    expect(built.length).toBeGreaterThan(100);
    const pads = new Map(world.collision!.pads.map(p => [p.id, p]));
    const byPad = new Map(world.thresholds.map(t => [t.padId, t]));
    for (const t of built) {
      const pad = pads.get(t.padId!)!;
      expect(pad, t.id).toBeDefined();
      for (const query of [board, bicycle]) {
        const s = query.sample(pad.centre[0], pad.centre[2], pad.centre[1]);
        expect(s, t.id).not.toBeNull();
        expect(s!.legal, t.id).toBe(true);
        // Two thresholds may share one spot (skateLineStarts.3 and upperStreetSpur): either pad is the ground.
        const found = pads.get(s!.padId!)!, owner = byPad.get(s!.padId!)!;
        expect(Math.hypot(found.centre[0] - pad.centre[0], found.centre[2] - pad.centre[2]), t.id).toBeLessThan(Math.hypot(...pad.size) / 2);
        if (isPickupThreshold(owner.modes)) {
          expect(s!.pace, `${t.id} → ${owner.id}`).not.toBe('threshold');
          expect(s!.roll).toBe(paces[s!.pace]!.roll);
        } else {
          expect({id: t.id, pace: s!.pace}).toEqual({id: t.id, pace: 'threshold'});
          expect(s!.roll).toBe(1.8); expect(s!.pushGrip).toBe(0.5);
        }
      }
    }
  });
  it('rolls a pick-up pad at the pace of the line it starts; park pads and crossings stay threshold', () => {
    expect(isPickupThreshold(['feet→board'])).toBe(true);
    expect(isPickupThreshold(['feet→bicycle'])).toBe(true);
    for (const m of [['board→feet'], ['feet→feet'], ['canoe→feet→canoe'], ['feet→board', 'board→feet'], []]) expect(isPickupThreshold(m), m.join()).toBe(false);
    const pads = new Map(world.collision!.pads.map(p => [p.id, p]));
    const at = (id: string) => { const t = world.thresholds.find(q => q.id === id)!, p = pads.get(t.padId!)!; return board.sample(p.centre[0], p.centre[2], p.centre[1])!; };
    for (const n of [1, 2, 3, 4]) {
      const s = at(`skateLineStarts.${n}`), line = bed(s.bedId!);
      expect(line, `skateLineStarts.${n}`).toBeDefined();
      expect(line.kind === 'skate' || line.profile.startsWith('skate'), `skateLineStarts.${n} on ${s.bedId}`).toBe(true);
      expect(s, `skateLineStarts.${n}`).toMatchObject({legal: true, padId: `threshold.skateLineStarts.${n}`, pace: line.surfaceSegments![0]!.pace});
      expect(['fast', 'flow']).toContain(s.pace);
      expect(s.roll).toBe(paces[s.pace]!.roll); expect(s.pushGrip).toBe(paces[s.pace]!.pushGrip ?? 1);
    }
    // Pushing off skateLineStarts.1 rolls at S1's Crown-drop pace, not the pad's brake.
    expect(at('skateLineStarts.1')).toMatchObject({bedId: 'S1', pace: 'fast', roll: .12, pushGrip: 1});
    const crossing = world.thresholds.find(t => t.built && t.id.startsWith('crossing.') && t.modes.includes('board→feet'))!;
    for (const id of ['landingQuay', 'stairTop', 'quayWest', crossing.id]) expect(at(id), id).toMatchObject({legal: true, pace: 'threshold', roll: 1.8, pushGrip: .5});
    // The bicycle on skateLineStarts.3's spot gets upperStreetSpur's dismount pad, still threshold.
    const shared = pads.get('threshold.upperStreetSpur')!;
    expect(bicycle.sample(shared.centre[0], shared.centre[2], shared.centre[1])).toMatchObject({padId: 'threshold.upperStreetSpur', pace: 'threshold', legal: true});
  });
  it('rolls S1\'s Crown drop fast on paving', () => {
    const s1 = bed('S1'), i = Math.round((s1.points.length - 1) * .08), p = s1.points[i]!;
    const s = board.sample(p[0], p[2], p[1] + .1)!;
    expect(s).toMatchObject({legal: true, pace: 'fast', material: 'paved', bedId: 'S1', padId: null, roll: .12, pushGrip: 1, grip: 1});
    expect(paceOf(s)).toBe('fast');
    expect(bedAt(world, p[0], p[2])?.segment?.pace).toBe('fast');
    expect(s.n[1]).toBeGreaterThan(.9);
  });
  it('reads every S1–S4 slice\'s own pace at its middle, including S3\'s square at threshold pace', () => {
    for (const id of ['S1', 'S2', 'S3', 'S4']) {
      const b = bed(id), segs = b.surfaceSegments!;
      segs.forEach((seg, k) => {
        const i = Math.floor((seg.from + seg.to) / 2 * (b.points.length - 1)), p = b.points[i]!;
        const s = board.sample(p[0], p[2], p[1] + .1)!;
        expect(s.legal, `${id}.${k}`).toBe(true);
        // A pad on the line (a crossing) is threshold pace whatever the slice says.
        expect(s.pace, `${id}.${k}`).toBe(s.padId && !board.padAt(p[0], p[2], s.y)?.pickup ? 'threshold' : seg.pace);
        if (!s.padId) expect(s.bedId).toBe(id);
        // On the line's own deck the material is the slice's surface (a crossing's bridge deck reports its own).
        if (geography.surface(p[0], p[2], p[1] + .1, .5)!.id.startsWith(`${id}.surface.`)) expect(s.material, `${id}.${k}`).toBe(seg.surface);
      });
    }
    const s3 = bed('S3'), square = s3.surfaceSegments![2]!;
    expect(square).toMatchObject({pace: 'threshold', surface: 'plaza'});
    const p = s3.points[Math.floor(.5 * (s3.points.length - 1))]!;
    expect(bedAt(world, p[0], p[2], p[1])).toMatchObject({bedId: 'S3', segmentIndex: 2});
    expect(board.sample(p[0], p[2], p[1] + .1)).toMatchObject({pace: 'threshold', legal: true, roll: 1.8});
  });
  it('counts the edge of the deck plus the margin as the bed, and grass beyond it as offbed', () => {
    const s1 = bed('S1'), i = Math.round((s1.points.length - 1) * .08), p = s1.points[i]!;
    const [ex, ez] = beside(s1, i, (s1.width ?? 4) / 2 + .2);
    expect(board.bedAt(ex, ez, p[1])?.bedId).toBe('S1');
    const [ox, oz] = beside(s1, i, 12), off = board.sample(ox, oz, p[1] + 20);
    expect(off).not.toBeNull();
    expect(off).toMatchObject({legal: false, pace: 'offbed', roll: BOARD_TEST_PROFILE.roll.offbed, pushGrip: 0, grip: .6});
  });
  it('samples terrain 30 m off any bed as offbed and illegal', () => {
    const s1 = bed('S1');
    let found: [number, number] | null = null;
    for (let i = 10; i < s1.points.length - 1 && !found; i += 7) for (const side of [30, -30, 45, -45]) {
      const [x, z] = beside(s1, i, side);
      if (world.beds.every(b => distanceToBed(b, x, z) >= 30) && geography.surface(x, z)?.id === 'terrain' && !geography.submerged(x, z, geography.surface(x, z)!.y)) { found = [x, z]; break; }
    }
    expect(found).not.toBeNull();
    const [x, z] = found!, g = geography.surface(x, z)!, s = board.sample(x, z, g.y + .1)!;
    expect(s).toMatchObject({material: 'grass', pace: 'offbed', legal: false, bedId: null, padId: null, pushGrip: 0});
    expect(paceOf(s)).toBe('offbed');
    expect(paceOf(null)).toBe('offbed');
    expect(bicycle.sample(x, z, g.y + .1)).toMatchObject({pace: 'offbed', legal: false});
  });
  it('gives the bicycle roads and trails, and puts it offbed on the skate lines', () => {
    const v01 = bed('V01');
    let checked = 0;
    for (let i = 5; i < v01.points.length && checked < 5; i += 23) {
      const p = v01.points[i]!, hit = board.bedAt(p[0], p[2], p[1]);
      if (board.padAt(p[0], p[2], p[1]) || hit?.kind === 'skate') continue;
      const s = bicycle.sample(p[0], p[2], p[1] + .1)!;
      expect(s, `V01 ${i}`).toMatchObject({legal: true, bedId: 'V01'});
      expect(['fast', 'flow', 'slow']).toContain(s.pace);
      checked++;
    }
    expect(checked).toBe(5);
    const s1 = bed('S1'), p = s1.points[Math.round((s1.points.length - 1) * .08)]!;
    expect(bicycle.sample(p[0], p[2], p[1] + .1)).toMatchObject({legal: false, pace: 'offbed', bedId: 'S1'});
    // And the board on a road is offbed.
    const road = v01.points[5]!;
    if (!board.padAt(road[0], road[2], road[1])) expect(board.sample(road[0], road[2], road[1] + .1)).toMatchObject({legal: false, pace: 'offbed'});
  });
  it('fades back to the nearest point of the bed from 20 m beside S1', () => {
    const s1 = bed('S1');
    for (const f of [.08, .3, .55]) {
      const i = Math.round((s1.points.length - 1) * f), [x, z] = beside(s1, i, 20), pt = board.nearestBedPoint(x, z)!;
      expect(pt).not.toBeNull();
      expect(distanceToBed(s1, pt[0], pt[2]), `S1 at ${f}`).toBeLessThan(3);
      expect(Math.hypot(pt[0] - x, pt[2] - z)).toBeLessThan(21);
      const back = board.sample(pt[0], pt[2], pt[1] + .1)!;
      expect(back.legal).toBe(true);
    }
  });
  it('fades back to dry deck, never into the water on S2\'s submerged Bight Bridge stretch', () => {
    const s2 = bed('S2');
    let arc = 0;
    const wet: [number, number, number][] = [];
    for (let i = 0; i < s2.points.length; i++) {
      if (i) arc += Math.hypot(s2.points[i]![0] - s2.points[i - 1]![0], s2.points[i]![2] - s2.points[i - 1]![2]);
      const p = s2.points[i]!, g = geography.surface(p[0], p[2], p[1], .5);
      if (arc > 760 && arc < 830 && g && geography.submerged(p[0], p[2], g.y)) wet.push([p[0], p[1], p[2]]);
    }
    expect(wet.length, 'S2 has a submerged stretch near 789–803 m').toBeGreaterThan(0);
    // The middle of the wet stretch: the nearest dry deck is furthest away there.
    const [x, , z] = wet[wet.length >> 1]!, pt = board.nearestBedPoint(x, z)!;
    expect(pt).not.toBeNull();
    expect(geography.submerged(pt[0], pt[2], pt[1])).toBe(false);
    expect(geography.submerged(pt[0], pt[2], pt[1] - .2), 'not on the water\'s very edge').toBe(false);
    expect(Math.hypot(pt[0] - x, pt[2] - z)).toBeLessThan(40);
    const back = board.sample(pt[0], pt[2], pt[1] + .1)!;
    expect(back).not.toBeNull();
    expect(back.legal).toBe(true);
  });
  it('grips pads and the park like pavement (the stone row), with the park at flow pace', () => {
    expect(surfaces.stone).toMatchObject({pace: 'threshold', grip: 1});
    // A built pad whose own slab is the ground reports stone and grips 1.0; a pad lying in a street or on a deck
    // reports that surface's material and grips by its row. None falls to the unlisted 0.6 on stone any more.
    const built = world.collision!.pads.filter(p => world.thresholds.some(t => t.built && t.padId === p.id));
    const samples = built.map(p => board.sample(p.centre[0], p.centre[2], p.centre[1])!);
    const onStone = samples.filter(s => s.material === 'stone');
    expect(onStone.length).toBeGreaterThan(20);
    const pickup = new Set(world.thresholds.filter(t => isPickupThreshold(t.modes)).map(t => t.padId));
    for (const s of onStone) expect(s, s.padId!).toMatchObject({legal: true, grip: 1});
    for (const s of onStone) if (!pickup.has(s.padId!)) expect(s.pace, s.padId!).toBe('threshold');
    for (const s of samples) expect(s.grip, `${s.padId} ${s.material}`).toBe(surfaces[s.material]?.grip ?? .6);
    const park = M.skate.park, [px, pz] = [park.xy[0]!, park.xy[1]!];
    let found: ReturnType<BoardContact['sample']> = null;
    for (let dx = 0; dx <= 20 && !found; dx += 2) for (const sx of [1, -1]) {
      const x = px + dx * sx, g = geography.surface(x, pz);
      if (!g || g.material !== 'stone' || board.padAt(x, pz, g.y)) continue;
      const q = board.sample(x, pz, g.y + .1);
      if (q && !q.bedId) { found = q; break; }
    }
    expect(found, 'a stone point in the park box off any bed').not.toBeNull();
    expect(found).toMatchObject({legal: true, pace: 'flow', material: 'stone', grip: 1});
  });
  it('delegates water and solids to the geography', () => {
    const s1 = bed('S1'), p = s1.points[40]!;
    expect(board.submerged(p[0], p[2], p[1])).toBe(geography.submerged(p[0], p[2], p[1]));
    expect(board.blocked(p[0], p[2], p[1], .3, [1, 0])).toBe(geography.blocker(p[0], p[2], p[1], .3, [1, 0]) !== null);
    expect(board.submerged(1000, 50, -2)).toBe(true);
  });
  it('is cheap enough for three samples per 1/120 s step', () => {
    const s1 = bed('S1'), t0 = performance.now();
    let n = 0;
    for (let k = 0; k < 1200; k++) { const p = s1.points[k % s1.points.length]!; for (const d of [-.22, 0, .22]) { board.sample(p[0] + d, p[2], p[1] + .1); n++; } }
    const perSample = (performance.now() - t0) / n;
    expect(perSample).toBeLessThan(.5);
  });
});

it('keeps the pace vocabulary the kernel knows', () => {
  const kernel: Pace[] = ['fast', 'flow', 'slow', 'threshold', 'skate', 'offbed'];
  for (const key of Object.keys(paces)) if (key !== 'n/a') expect(kernel).toContain(key);
});
