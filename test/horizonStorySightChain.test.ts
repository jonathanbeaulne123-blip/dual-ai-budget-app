// The Water's Way (docs/horizon/STORY.md, D-303): the story registry and its sight-chain proofs on the committed bake.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LandCuts, StructureSolid, TerrainField } from '../src/harbour/horizon/land/interfaces.ts';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset.ts';
import { createRayCaster, type RayCaster } from '../src/harbour/horizon/world/raycast.ts';
import { terrainHeight } from '../src/harbour/horizon/world/geometry.ts';
import { HORIZON_MANIFEST } from '../src/harbour/horizon/world/manifest.ts';
import { measureStoryLink } from '../src/harbour/horizon/world/storySight.ts';
import {
  EVENING_RELAY, LAMP_MIN_LOOKOUTS, NOON_BELLS, RELAY_TOTAL_SECONDS, relayStartSeconds, SIGHT_CHAIN, SIGHT_EXTRAS, SIGHT_MIN_CLEARANCE,
  STORY_EYES, STORY_LANDMARKS, STORY_PLACES, STORY_ROUTES, storyEye, storyLandmark, validateStoryAgainstDressing, type SightLink,
} from '../src/harbour/horizon/world/story.ts';

describe('the story registry is one consistent definition', () => {
  it('orders seven places and the Hollow interlude, each with its landmark and lookout', () => {
    const ordered = STORY_PLACES.filter(p => p.order !== null);
    expect(ordered.map(p => p.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(ordered.map(p => p.id)).toEqual(['highlands', 'green', 'reach', 'harbour', 'longSands', 'flats', 'scholars']);
    const hollow = STORY_PLACES.find(p => p.id === 'hollow')!;
    expect([hollow.order, hollow.landmarkId, hollow.lookoutId]).toEqual([null, null, null]);
    const districts = HORIZON_MANIFEST.districts.map(d => d.id);
    for (const p of STORY_PLACES) {
      for (const d of p.districts) expect(districts).toContain(d);
      if (p.landmarkId) expect(storyLandmark(p.landmarkId).kind).not.toBe('feature');
      if (p.lookoutId) expect(storyEye(p.lookoutId).id).toBe(p.lookoutId);
    }
    for (const list of [STORY_LANDMARKS, STORY_EYES, STORY_PLACES]) expect(new Set(list.map(q => q.id)).size).toBe(list.length);
    // No place is ever labelled a "Chapter" (a Chapter is a month at the Sitdown).
    expect(JSON.stringify([STORY_PLACES, STORY_LANDMARKS, STORY_EYES, STORY_ROUTES])).not.toMatch(/chapter/i);
  });
  it('chains each place\'s lookout to the next place\'s landmark, in story order', () => {
    const ordered = STORY_PLACES.filter(p => p.order !== null);
    expect(SIGHT_CHAIN.map(l => [l.from, l.to])).toEqual(ordered.map((p, i) => [p.lookoutId, (ordered[i + 1] ?? ordered[0]!).landmarkId]));
    for (const l of [...SIGHT_CHAIN, ...SIGHT_EXTRAS]) { expect(storyEye(l.from).targets).toContain(l.to); storyLandmark(l.to); }
    for (const e of STORY_EYES) { expect(e.targets).toContain('lamp'); expect((e.y === undefined) !== (e.lift === undefined)).toBe(true); }
  });
  it('lights the relay in story order inside ~40 s and rings the three noon bells in order', () => {
    const storyOrder = STORY_PLACES.filter(p => p.order !== null).map(p => p.landmarkId);
    expect(EVENING_RELAY.order.filter(id => storyOrder.includes(id))).toEqual(storyOrder);
    expect(EVENING_RELAY.order.indexOf('fallswatch')).toBe(1);   // the Fallswatch lamp answers the chapel lantern
    expect(RELAY_TOTAL_SECONDS).toBeCloseTo(40, 6);
    expect(EVENING_RELAY.order.map(relayStartSeconds)).toEqual(EVENING_RELAY.order.map((_, i) => i * EVENING_RELAY.spacingSeconds));
    for (const [i, id] of EVENING_RELAY.order.entries()) expect(storyLandmark(id).relayOrder).toBe(i + 1);
    expect(STORY_LANDMARKS.filter(l => l.relayOrder !== undefined)).toHaveLength(EVENING_RELAY.order.length);
    expect(NOON_BELLS.chain.map(b => [b.id, b.beat])).toEqual([['westwatch', 0], ['summit', 1], ['campanile', 2]]);
    expect(storyLandmark('westwatch').bell).toBe('westwatch'); expect(storyLandmark('campanile').bell).toBe('campanile');
    const l02 = HORIZON_MANIFEST.places.find(p => p.id === 'L02')!;
    expect([NOON_BELLS.chain[1]!.bell[0], NOON_BELLS.chain[1]!.bell[2]]).toEqual(l02.xy);
  });
  it('names every way round by its MANIFEST definition; the ferry runs the coast clockwise 4 → 7', () => {
    const at = (path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], HORIZON_MANIFEST);
    for (const r of STORY_ROUTES) {
      if (r.manifest === null) { expect(r.owed).toBeTruthy(); continue; }
      expect(at(r.manifest), r.manifest).toBeTruthy();
    }
    expect(STORY_ROUTES.map(r => r.id)).toEqual(['yearWalk', 'S1', 'RIVER_RUN', 'greenway', 'FERRY', 'damRun', 'lampHop']);
    const order = (id: string) => STORY_PLACES.find(p => p.id === id)!.order!;
    expect(STORY_ROUTES.find(r => r.id === 'FERRY')!.places.map(order)).toEqual([4, 5, 6, 7]);
    // Clockwise with north up and z south: the ferry line's piers come in the order landing → bight → flats → scholars' cove.
    const ferry = HORIZON_MANIFEST.water_routes.FERRY, piers = ferry.piers as Record<string, number[]>;
    const index = (xy: readonly number[]) => ferry.pts.reduce((best, p, i) => Math.hypot(p[0]! - xy[0]!, p[1]! - xy[1]!) < Math.hypot(ferry.pts[best]![0]! - xy[0]!, ferry.pts[best]![1]! - xy[1]!) ? i : best, 0);
    const seq = ['landing', 'bight', 'flats', 'scholarsCove'].map(k => index(piers[k]!));
    expect(seq).toEqual([...seq].sort((a, b) => a - b)); expect(new Set(seq).size).toBe(4);
  });
  it('checks module Landmark and Lookout records against the registry, and skips a world without dressing', () => {
    expect(validateStoryAgainstDressing({})).toEqual({ skipped: true, checked: 0, problems: [] });
    const records = STORY_LANDMARKS.map(l => ({ id: l.id, at: l.at, top: l.top }));
    expect(validateStoryAgainstDressing({ dressing: { landmarks: records, lookouts: [] } })).toEqual({ skipped: false, checked: records.length, problems: [] });
    const off = validateStoryAgainstDressing({ dressing: { landmarks: [{ id: 'oak', at: [1125, 16.1, 1165], top: [1131, 49, 1165] }, { id: 'tower', at: [0, 0, 0], top: [0, 9, 0] }], lookouts: [{ id: 'belfry', eye: [1423, 30, 1187] }] } });
    expect(off.problems).toEqual([
      'landmark oak: top 6.00 m off the registry in plan (> 3)', 'landmark oak: top -3.00 m off the registry height 52 (> ±1.5)',
      'landmark tower: not in the story registry', 'lookout belfry: eye height 30 vs the registry 34.4 (> ±1.5)',
    ]);
  });
});

// ---- the proofs on the committed bake (the same world the bake writes and the view proof reads) ----
let world: { field: TerrainField; solids: StructureSolid[]; ray: RayCaster } | null = null;
const baked = () => {
  if (world) return world;
  const json = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')), bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full');
  const solids = json.geometry.solids.map((q: { id: string; sourceId?: string }) => ({ ...q, id: q.sourceId ?? q.id.split('@')[0] })) as StructureSolid[];
  const cuts = { ...json.collision, solids } as LandCuts;
  return (world = { field, solids, ray: createRayCaster(field, cuts) });
};
const measure = (from: string, to: string, owed: readonly string[] = []) => {
  const { ray, solids } = baked();
  return measureStoryLink(ray, solids, from, to, owed.length ? { ignore: s => owed.some(p => ((s as StructureSolid & { sourceId?: string }).sourceId ?? s.id).startsWith(p)) } : {});
};

describe('the sight chain holds on the bake (≥ 0.5 m clear to the sighted top − 2 m, baked solids included)', () => {
  it('stands every ground landmark on the baked ground it names', () => {
    const { field } = baked();
    for (const id of ['westwatch', 'fallswatch', 'oak', 'osprey', 'campanile', 'elevator', 'library']) {
      const l = storyLandmark(id); expect(Math.abs(terrainHeight(field, l.at[0], l.at[2]) - l.at[1]), id).toBeLessThan(1.2);
    }
  }, 60_000);
  const rows: string[] = [];
  const prove = (link: SightLink) => {
    const m = measure(link.from, link.to), owed = link.owedOccluders ?? [];
    rows.push(`${link.from} → ${link.to}: ${m.clearance.toFixed(2)} m over ${m.distance.toFixed(0)} m${m.blocker ? ` (first limit: ${m.blocker})` : ''}`);
    if (!owed.length) { expect(m.clearance, `${link.from} → ${link.to} limited by ${m.blocker}`).toBeGreaterThanOrEqual(SIGHT_MIN_CLEARANCE); return; }
    // An owed occluder (its replacement approved, `dependsOn`): it must be the one limit today, and the line must clear with it
    // opened. Once the bake no longer limits the line by it, this fails until the registry entry drops `owedOccluders`.
    expect(m.clearance, `${link.from} → ${link.to}: the owed occluder ${owed.join(', ')} no longer limits the line; remove owedOccluders`).toBeLessThan(SIGHT_MIN_CLEARANCE);
    expect(owed.some(p => m.blocker?.startsWith(p)), `${link.from} → ${link.to} limited by ${m.blocker}, not an owed occluder`).toBe(true);
    const opened = measure(link.from, link.to, owed);
    rows.push(`${link.from} → ${link.to} with ${owed.join(', ')} opened: ${opened.clearance.toFixed(2)} m${opened.blocker ? ` (first limit: ${opened.blocker})` : ''}`);
    expect(opened.clearance, `${link.from} → ${link.to} limited by ${opened.blocker}`).toBeGreaterThanOrEqual(SIGHT_MIN_CLEARANCE);
  };
  const registered = [...SIGHT_CHAIN, ...SIGHT_EXTRAS];
  for (const link of registered) {
    // fallswatch → oak / Veil lip depend on the V3.1 west buttress (PR 2): they pass on today's bake at the ground eye.
    it(`${link.from} → ${link.to}${link.dependsOn ? ` (depends on ${link.dependsOn})` : ''}`, () => prove(link), 60_000);
  }
  it('finds every binocular target other than the Lamp from its eye', () => {
    const pairs = STORY_EYES.flatMap(e => e.targets.filter(t => t !== 'lamp').map(to => ({ from: e.id, to })));
    for (const pair of pairs) prove(registered.find(l => l.from === pair.from && l.to === pair.to) ?? { ...pair, measured: NaN });
  }, 120_000);
  it('sees the Lamp from at least six story eyes', () => {
    const seen = STORY_EYES.map(e => ({ id: e.id, m: measure(e.id, 'lamp') }));
    for (const s of seen) rows.push(`${s.id} → lamp: ${s.m.clearance.toFixed(2)} m over ${s.m.distance.toFixed(0)} m${s.m.blocker ? ` (${s.m.blocker})` : ''}`);
    console.log(rows.join('\n'));
    expect(seen.filter(s => s.m.clearance >= SIGHT_MIN_CLEARANCE).length).toBeGreaterThanOrEqual(LAMP_MIN_LOOKOUTS);
  }, 120_000);
});
