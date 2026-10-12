// The Green (STORY place 2, module `lakeside`; D-WW110…119): the module on the committed bake's world, and the baked
// records. Contracts: determinism; the protected Green (nothing over 0.85 inside r 160 but the oak, its swing and the
// kites); no planting on beds, pads, stairs or water; the oak's clearings (ring bench clear of the roots, the swing under
// the swing limb, no tree within the crown's reach, no drift under the crown); the Oak Clock (January north, clockwise,
// facing the trunk) and the Lantern Ring (outside r 160, ≥ 8 m from every month stone, ≥ 4 m from the baskets); the
// sightlines to the oak from Fallswatch, the belfry, the wheel, the elevator and the Bight lookout, and oak → osprey,
// clear of the module's own trees; the night order; creatures ≤ 24 per district; per-district budgets with the land.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {describe, expect, it} from 'vitest';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {terrainHeight} from '../src/harbour/horizon/world/geometry.ts';
import {districtAt} from '../src/harbour/horizon/world/districts.ts';
import {createDressingContext, PROP_HEIGHT, SPECIES_HEIGHT, validateDressing, buildingHeight} from '../src/harbour/horizon/neighbourhoods/bake.ts';
import {lakeside} from '../src/harbour/horizon/neighbourhoods/lakeside/index.ts';
import {inGlasshouseView} from '../src/harbour/horizon/neighbourhoods/lakeside/shore.ts';
import {BASKETS, CENTRE, CLOCK_R, OAK_AT, OAK_CROWN, PROTECT_R, RING_STONE_CLEAR, bearing, dist, monthStones} from '../src/harbour/horizon/neighbourhoods/lakeside/plan.ts';
import {OAK, oakLimbs} from '../src/harbour/horizon/kit/plants/oak.ts';
import {NEIGHBOURHOOD_MODULES} from '../src/harbour/horizon/neighbourhoods/index.ts';
import {aimPoint, storyEye, storyLandmark, validateStoryAgainstDressing} from '../src/harbour/horizon/world/story.ts';
import type {NeighbourhoodDressing, WorldDressing} from '../src/harbour/horizon/neighbourhoods/types.ts';
import type {District, Point2} from '../src/harbour/horizon/world/definition.ts';

const json = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8'));
const bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
const field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full');
const ground = (x: number, z: number) => terrainHeight(field, x, z);
/** The bake's context rebuilt from the committed world (its own dressing solids left out, as the bake had them). */
const context = () => createDressingContext({
  ground, beds: json.collision.beds, pads: json.collision.pads, waters: json.collision.waters,
  solids: json.geometry.solids.map((q: {id: string; sourceId?: string}) => ({...q, id: q.sourceId ?? q.id.split('@')[0]})).filter((s: {id: string}) => !s.id.startsWith('dressing.')),
  hosts: json.hosts.map((h: {id: string; footprint?: Point2[]; door?: {xy?: Point2}; height?: number}) => ({id: h.id, footprint: h.footprint, door: h.door?.xy ? {xy: h.door.xy} : {}, height: h.height})),
  protectedAreas: json.protected.map((p: {id: string; outline: Point2[]}) => ({id: p.id, outline: p.outline})), districtAt,
});
const ctx = context();
let built: NeighbourhoodDressing | null = null;
const green = () => (built ??= lakeside.build(ctx));
const baked = json.dressing as WorldDressing;
const MY_DISTRICTS = ['green', 'lakeside', 'notch'];
const TREES = new Set(['round', 'poplar', 'birch', 'pine', 'fruit', 'alpine', 'willow', 'tamarack', 'spruce', 'balsam', 'cypress', 'olive', 'stonePine', 'cedar', 'apple', 'dogwood']);

describe('the Green (module lakeside) on the committed world', () => {
  it('is registered once, builds deterministically and passes the bake\'s validation', () => {
    expect(NEIGHBOURHOOD_MODULES.filter(m => m.id === 'lakeside')).toHaveLength(1);
    const a = JSON.stringify(green()), b = JSON.stringify(lakeside.build(context()));
    expect(a).toBe(b);
    expect(validateDressing([{module: 'lakeside', dressing: green()}], ctx)).toEqual([]);
  }, 120_000);

  it('the committed bake carries what the module builds (the oak landmark, the story registry agrees)', () => {
    expect(baked).toBeTruthy();
    expect(baked.landmarks.find(l => l.id === 'oak')).toBeTruthy();
    expect(validateStoryAgainstDressing({dressing: baked}).problems).toEqual([]);
    const ids = (d: {props: {id?: string}[]}[]) => d.flatMap(x => x.props.map(p => p.id).filter(Boolean)).sort();
    expect(ids(baked.districts.map(d => ({props: d.props.filter(p => p.id?.startsWith('green.') || p.id?.startsWith('lakeside.'))})))).toEqual(ids([green()]));
  });

  it('keeps the protected Green: nothing over 0.85 eu inside r 160 but the oak and what it carries (the swing, the kites)', () => {
    const d = green(), inside = (x: number, z: number) => dist([x, z], CENTRE) < PROTECT_R;
    expect(d.allowInProtected?.sort()).toEqual(['green.kite.1', 'green.kite.2', 'green.oak.swing']);
    for (const p of d.props) if ([[p.at[0], p.at[2]], ...(p.line ?? []).map(q => [q[0], q[2]])].some(([x, z]) => inside(x!, z!)) && PROP_HEIGHT[p.kind] * (p.scale ?? 1) > 0.85) expect(['swing', 'kite'], p.id).toContain(p.kind);
    for (const b of d.buildings) expect(inside(b.at[0], b.at[2]) && buildingHeight(b) > 0.85, b.id).toBe(false);
    const tall = d.plants.filter(p => inside(p.at[0], p.at[2]) && SPECIES_HEIGHT[p.species] * p.scale > 0.85);
    expect(tall.map(p => p.species)).toEqual(['oakGiant']);
  });

  it('plants nothing on a bed, pad, stair, apron or (but the marsh plants) water', () => {
    for (const p of green().plants) {
      expect(ctx.onBed(p.at[0], p.at[2]), `${p.species} at ${p.at}`).toBeNull();
      expect(ctx.onPad(p.at[0], p.at[2]), `${p.species} at ${p.at}`).toBeNull();
      if (!['reed', 'cattail', 'sedge', 'lily'].includes(p.species)) expect(ctx.inWater(p.at[0], p.at[2]), `${p.species} at ${p.at}`).toBe(false);
    }
  });

  it('the Old Oak\'s clearings: the ring bench clear of the roots, the swing under the swing limb, no tree within its reach, no drift under the crown', () => {
    const d = green(), oak = d.plants.find(p => p.species === 'oakGiant')!;
    expect([oak.at[0], oak.at[2]]).toEqual(OAK_AT); expect(oak.keep).toBe(true); expect(d.plants.filter(p => p.species === 'oakGiant')).toHaveLength(1);
    const bench = d.props.find(p => p.kind === 'ringBench')!; expect(dist([bench.at[0], bench.at[2]], OAK_AT)).toBeLessThan(0.01);
    expect(OAK.rootReach).toBeLessThan(6.2 - 0.4);
    // The swing hangs from limb 0, which points over the meadow at the Drop Zone (bearing ≈ 299°).
    const swing = d.props.find(p => p.kind === 'swing')!, r = dist([swing.at[0], swing.at[2]], OAK_AT);
    expect(r).toBeGreaterThan(13); expect(r).toBeLessThan(19); expect(Math.abs(bearing(OAK_AT, [swing.at[0], swing.at[2]]) - 299)).toBeLessThan(6);
    expect(swing.at[1] + swing.scale!).toBeCloseTo(oak.at[1] + oakLimbs()[0]!.kink[1] + (oakLimbs()[0]!.tip[1] - oakLimbs()[0]!.kink[1]) * 0.62 - 0.5, 3);
    for (const p of d.plants) {
      const q = dist([p.at[0], p.at[2]], OAK_AT);
      if (TREES.has(p.species)) expect(q, p.species).toBeGreaterThan(OAK_CROWN + 15);
      if (p.species === 'flowerBed') expect(q, 'drift under the crown').toBeGreaterThan(OAK_CROWN - 2.5);
    }
  });

  it('a wild meadow, not a lawn: long grass in drifts, straw paint, the mown paths and the landing target clear (D-WW113)', () => {
    const d = green(), inPoly = (x: number, z: number, poly: readonly Point2[]) => { let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
    const mown = d.ground.filter(g => g.surface === 'mown'), tufts = d.plants.filter(p => p.species === 'grassTuft'), beds = d.plants.filter(p => p.species === 'flowerBed');
    for (const p of [...tufts, ...beds]) expect(mown.some(g => inPoly(p.at[0], p.at[2], g.polygon)), `${p.species} on a mown path at ${p.at}`).toBe(false);
    // long grass: most tufts outside the protected circle knee-high; inside it never over 0.85 (nominal height × scale)
    const long = tufts.filter(p => p.scale >= 0.82);
    expect(long.length).toBeGreaterThan(2500);
    // the sheaf's real top: 0.47 eu × scale × the planting's ≤ 1.6 instance stretch
    for (const p of tufts) if (dist([p.at[0], p.at[2]], CENTRE) < PROTECT_R) expect(0.47 * 1.6 * p.scale).toBeLessThanOrEqual(0.85);
    // the landing field's mown target (r 30 round the Drop Zone) carries nothing; the straw paint is there and never on a path
    const dz: Point2 = [1037.2, 1115.8];
    for (const p of d.plants) expect(dist([p.at[0], p.at[2]], dz), `${p.species} on the landing target`).toBeGreaterThanOrEqual(30);
    const straw = d.ground.filter(g => g.surface === 'sedge'); expect(straw.length).toBeGreaterThan(400); for (const g of straw) expect(g.fullOnly).toBe(true);
    for (const g of straw) { const c = g.polygon.reduce<Point2>((a, q) => [a[0] + q[0] / g.polygon.length, a[1] + q[1] / g.polygon.length], [0, 0]); expect(mown.some(m => inPoly(c[0], c[1], m.polygon))).toBe(false); }
    // the June clocks and the summer drifts are there
    expect(beds.filter(b => Math.floor(b.tint!) === 10).length).toBeGreaterThanOrEqual(15);
  });

  it('the Oak Clock: twelve stones, January due north, clockwise every 30°, facing the trunk; the Lantern Ring outside r 160, ≥ 8 m off the stones, ≥ 4 m off the baskets', () => {
    const d = green(), stones = d.props.filter(p => p.kind === 'monthStone').sort((a, b) => a.variant! - b.variant!);
    expect(stones.map(s => s.variant)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    stones.forEach((s, m) => {
      expect(dist([s.at[0], s.at[2]], OAK_AT)).toBeCloseTo(CLOCK_R, 5);
      expect((bearing(OAK_AT, [s.at[0], s.at[2]]) - m * 30 + 360) % 360 < 1e-6 || (bearing(OAK_AT, [s.at[0], s.at[2]]) - m * 30 + 360) % 360 > 360 - 1e-6).toBe(true);
      // local +z (the notched face) toward the trunk
      const f: Point2 = [Math.sin(s.yaw), Math.cos(s.yaw)], to: Point2 = [OAK_AT[0] - s.at[0], OAK_AT[1] - s.at[2]];
      expect((f[0] * to[0] + f[1] * to[1]) / Math.hypot(...to)).toBeGreaterThan(0.999);
    });
    const posts = d.props.filter(p => p.kind === 'lantern' && p.id?.startsWith('green.lanternRing.'));
    expect(posts.length).toBeGreaterThanOrEqual(18);
    for (const p of posts) {
      expect(dist([p.at[0], p.at[2]], CENTRE)).toBeGreaterThan(PROTECT_R);
      for (const s of monthStones()) expect(dist([p.at[0], p.at[2]], s.at), p.id).toBeGreaterThanOrEqual(RING_STONE_CLEAR);
      for (const b of BASKETS) expect(dist([p.at[0], p.at[2]], b), p.id).toBeGreaterThanOrEqual(4);
      expect(ctx.bedClearance(p.at[0], p.at[2])).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps its own trees out of the sightlines to the oak (Fallswatch, the belfry, the wheel, the elevator, the Bight lookout) and of oak → osprey', () => {
    const trees = green().plants.filter(p => TREES.has(p.species));
    const clear = (eye: readonly [number, number, number], aim: readonly [number, number, number]) => trees.every(t => {
      const H = SPECIES_HEIGHT[t.species] * t.scale, R = Math.max(2.5, H * 0.45), ax = aim[0] - eye[0], az = aim[2] - eye[2], L2 = ax * ax + az * az;
      const u = Math.max(0, Math.min(1, ((t.at[0] - eye[0]) * ax + (t.at[2] - eye[2]) * az) / L2)), px = eye[0] + ax * u, pz = eye[2] + az * u, y = eye[1] + (aim[1] - eye[1]) * u;
      return Math.hypot(t.at[0] - px, t.at[2] - pz) > R || y > t.at[1] + H + 0.5;
    });
    const oakAim = aimPoint(storyLandmark('oak'));
    for (const id of ['fallswatch', 'belfry', 'wheelTop', 'elevatorTop', 'bightLookout']) {
      const e = storyEye(id), eye: [number, number, number] = [e.at[0], e.y ?? ground(e.at[0], e.at[1]) + e.lift!, e.at[1]];
      expect(clear(eye, oakAim), `${id} → oak`).toBe(true);
    }
    const o = storyEye('oak'); expect(clear([o.at[0], ground(o.at[0], o.at[1]) + 1.6, o.at[1]], aimPoint(storyLandmark('osprey'))), 'oak → osprey').toBe(true);
  });

  it('keeps the Glasshouse\'s view over Stillwater free of trees', () => {
    for (const p of green().plants) if (TREES.has(p.species)) expect(inGlasshouseView([p.at[0], p.at[2]]), `${p.species} at ${p.at}`).toBe(false);
  });

  it('lights in the night order: the Glasshouse terrace first, then the Lantern Ring outward from the oak, the pavilion last', () => {
    const lights = green().lights, glass = lights.filter(l => l.line === 'lakeside.glasshouse'), ring = lights.filter(l => l.line === 'green.lanternRing');
    expect(lights.slice(0, glass.length)).toEqual(glass);
    expect(glass.map(l => l.order)).toEqual(glass.map((_, i) => i));
    expect(ring.map(l => l.order)).toEqual(ring.map((_, i) => i + 1));
    expect(ring.at(-1)!.id).toBe('green.pavilion.lantern');
    // outward from the oak: the angular distance from the oak's bearing never decreases along the order
    const oakB = bearing(CENTRE, OAK_AT), ang = (p: Point2) => Math.abs(((bearing(CENTRE, p) - oakB + 540) % 360) - 180);
    const posts = ring.slice(0, -1).map(l => ang([l.at[0], l.at[2]]));
    for (let i = 1; i < posts.length; i++) expect(posts[i]!).toBeGreaterThanOrEqual(posts[i - 1]! - 1e-9);
    for (const l of baked ? json.lights.filter((x: {id: string}) => lights.some(m => m.id === x.id)) : []) expect(l.kind.startsWith('dressing:')).toBe(true);
  });

  it('keeps creatures ≤ 24 per district', () => {
    const per = new Map<string, number>();
    for (const l of green().life) per.set(districtAt(l.at[0], l.at[2]), (per.get(districtAt(l.at[0], l.at[2])) ?? 0) + l.count);
    for (const [d, n] of per) expect(n, d).toBeLessThanOrEqual(24);
  });

  it('fits every district it dresses in 150k / 60k triangles with its baked land (CONTRACT §6)', () => {
    const index = JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.index.json.gz')).toString()) as {districts: District[]};
    const touched = new Set(baked.districts.map(d => d.districtId));
    for (const id of [...MY_DISTRICTS, ...touched]) {
      const d = index.districts.find(x => x.id === id)!;
      console.info(`[green-budget] ${id}: ${d.triangles!.full} / ${d.triangles!.lite} (dressing ${d.dressing?.full.triangles ?? 0} / ${d.dressing?.lite.triangles ?? 0}), draws ${d.drawCalls}`);
      expect(d.triangles!.full, `${id} full`).toBeLessThanOrEqual(150_000);
      expect(d.triangles!.lite, `${id} lite`).toBeLessThanOrEqual(60_000);
    }
  });
});
