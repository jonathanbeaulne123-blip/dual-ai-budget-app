import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {describe, expect, it} from 'vitest';
import {buildJourneyLand, extractJourneyLand} from '../src/journey/land/index.ts';
import {decodeJourneyLandSlim, encodeJourneyLandSlim, JOURNEY_LAND_SLIM_FORMAT} from '../src/journey/land/slim.ts';
import {buildDressingMap, DRESSING_MAP_NAME} from '../src/journey/land/dressingMap.ts';
import {parseHorizonIndex} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {bakeDressings, createDressingContext} from '../src/harbour/horizon/neighbourhoods/bake.ts';
import {JOURNEY_MIN_HEIGHT, type WorldDressing} from '../src/harbour/horizon/neighbourhoods/types.ts';
import {fixtureModule, fixtureSource} from './helpers/dressingFixture.ts';

const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const INDEX = toArrayBuffer(readFileSync('public/horizon/world/horizon-geo-1.index.json.gz'));
const TERRAIN = decodeTerrainAsset(toArrayBuffer(readFileSync('public/horizon/terrain/horizon-geo-1.bin')), 'journey');
const source = {index: '/horizon/world/horizon-geo-1.index.json.gz', indexSha256: 'a', terrainSha256: 'b'};

/** The baked index with a story's worth of dressing: 40 tall buildings around the harbour and the seven landmarks. */
function dressedIndex() {
  const world = parseHorizonIndex(INDEX.slice(0));
  const journey: NonNullable<WorldDressing['journey']> = Array.from({length: 40}, (_, i) => { const x = 1400 + (i % 8) * 12, z = 1150 + Math.floor(i / 8) * 12; return {id: `harbour.row${i}`, districtId: 'harbour', footprint: [[x, z], [x + 8, z], [x + 8, z + 6], [x, z + 6]], base: 4, height: JOURNEY_MIN_HEIGHT + (i % 4), roofHeight: 2.5}; });
  const landmarks: WorldDressing['landmarks'] = [['westwatch', 1036, 86, 318, 97], ['oak', 1125, 16, 1165, 52], ['osprey', 1292, 4.1, 1268, 15.6], ['campanile', 1423, 4, 1187, 42.3], ['wheel', 1010, 6, 1648, 32.6], ['elevator', 395, 35.5, 706, 63.5], ['library', 740, 40, 400, 64]].map(([id, x, y, z, top]) => ({id: id as string, label: id as string, neighbourhood: 'harbour' as const, at: [x as number, y as number, z as number] as const, top: [x as number, top as number, z as number] as const}));
  world.dressing = {districts: [], landmarks, lookouts: [], journey};
  return world;
}

describe('the Journey map carries the dressing (slim format 4)', () => {
  it('an undressed index extracts no dressing (the baked slim is unchanged but for its format)', () => {
    const land = extractJourneyLand(parseHorizonIndex(INDEX.slice(0)), TERRAIN);
    expect(land.dressing).toBeUndefined();
    const slim = JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.journey.json.gz')).toString());
    expect(slim.format).toBe(JOURNEY_LAND_SLIM_FORMAT);
    expect('dressing' in slim.land).toBe(false);
  });
  it('tall buildings and every landmark extract, encode and decode exactly (round trip)', () => {
    const land = extractJourneyLand(dressedIndex(), TERRAIN);
    expect(land.dressing!.buildings).toHaveLength(40);
    expect(land.dressing!.landmarks.map(l => l.id)).toEqual(['westwatch', 'oak', 'osprey', 'campanile', 'wheel', 'elevator', 'library']);
    const decoded = decodeJourneyLandSlim(JSON.parse(JSON.stringify(encodeJourneyLandSlim(land, source))));
    expect(decoded).toStrictEqual(land);
  });
  it('the bake’s own Journey shapes (grammar buildingJourneyShape) flow into the index and the map', () => {
    const baked = bakeDressings([fixtureModule], createDressingContext(fixtureSource()));
    const world = parseHorizonIndex(INDEX.slice(0)); world.dressing = {...baked.dressing!, districts: []};
    const land = extractJourneyLand(world, TERRAIN);
    expect(land.dressing!.buildings.map(b => b.id)).toEqual(['tower']);
    expect(land.dressing!.buildings[0]!.height).toBe(12);
    expect(land.dressing!.landmarks.map(l => l.id)).toEqual(['oak', 'tower']);
  });
  it('a malformed slim dressing is refused (the loader falls back to the index)', () => {
    const slim = encodeJourneyLandSlim(extractJourneyLand(dressedIndex(), TERRAIN), source);
    const broken = JSON.parse(JSON.stringify(slim)); broken.land.dressing.buildings[0].footprint = [[0, 0]];
    expect(() => decodeJourneyLandSlim(broken)).toThrow(/dressing building/);
    const noTop = JSON.parse(JSON.stringify(slim)); noTop.land.dressing.landmarks[0].top = [0, 'x', 0];
    expect(() => decodeJourneyLandSlim(noTop)).toThrow(/landmark/);
  });
  it('draws the buildings and landmark glyphs in one mesh and keeps the Journey land budget', () => {
    const land = extractJourneyLand(dressedIndex(), TERRAIN);
    const full = buildJourneyLand(land, {theme: 'classic', tier: 'full', homes: []}), lite = buildJourneyLand(land, {theme: 'newfoundland', tier: 'lite', homes: []});
    const f = full.stats(), l = lite.stats(), mesh = full.group.getObjectByName(DRESSING_MAP_NAME) as THREE.Mesh;
    expect(mesh).toBeTruthy();
    // 40 four-sided blocks (8 wall + 4 roof triangles) and 7 glyphs (8 needle + 8 cap triangles).
    expect(mesh.geometry.getAttribute('position').count / 3).toBe(40 * 12 + 7 * 16);
    console.info(`[journey-dressing] full ${f.triangles} tris / ${f.drawCalls} draws · lite ${l.triangles} tris / ${l.drawCalls} draws`);
    expect(f.triangles).toBeLessThanOrEqual(25_000); expect(f.drawCalls).toBeLessThanOrEqual(20); expect(l.triangles).toBeLessThanOrEqual(15_000); expect(l.drawCalls).toBeLessThanOrEqual(20);
    // Lite keeps the landmark glyphs only.
    expect((lite.group.getObjectByName(DRESSING_MAP_NAME) as THREE.Mesh).geometry.getAttribute('position').count / 3).toBe(7 * 16);
    const before = Array.from(mesh.geometry.getAttribute('color').array.slice(0, 3));
    full.setTheme('taylor');
    expect(Array.from(mesh.geometry.getAttribute('color').array.slice(0, 3))).not.toEqual(before);
    full.dispose(); lite.dispose();
    expect(buildDressingMap({}, {heightAt: () => 0}, {} as never).mesh).toBeNull();
  });
});
