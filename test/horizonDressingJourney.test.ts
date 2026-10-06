import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {describe, expect, it} from 'vitest';
import {buildJourneyLand, extractJourneyLand, journeyLandFlatData, JourneyLandFlat, JOURNEY_CLAY_PALETTES} from '../src/journey/land/index.ts';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {decodeJourneyLandSlim, encodeJourneyLandSlim, JOURNEY_LAND_SLIM_FORMAT} from '../src/journey/land/slim.ts';
import {buildClayDressing, buildingTriangles, chooseDressingBuildings, DRESSING_MAP_NAME} from '../src/journey/land/dressingMap.ts';
import {CLAY_LAND_LOD, countDraws, JOURNEY_LAND_BUDGET, type ClayLandHandle} from '../src/journey/land/index.ts';
import {JOURNEY_DIORAMA} from '../src/journey/contracts.ts';
import {starterLayout} from '../src/home/model.ts';
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
  it('draws the buildings and landmark pins as one clay scatter on the diorama, inside the land budget', () => {
    const land = extractJourneyLand(dressedIndex(), TERRAIN);
    const full = buildJourneyLand(land, {theme: 'classic', tier: 'full', homes: []}) as ClayLandHandle, lite = buildJourneyLand(land, {theme: 'newfoundland', tier: 'lite', homes: []}) as ClayLandHandle;
    const f = full.stats(), l = lite.stats(), mesh = full.group.getObjectByName(DRESSING_MAP_NAME) as THREE.Mesh;
    expect(mesh).toBeTruthy();
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    // 40 four-sided blocks (8 wall + 4 roof triangles) and 7 pins (6-sided shaft 12 + icosahedron cap 20) on full.
    const tris = (m: THREE.Mesh) => m.geometry.index!.count / 3;
    expect(tris(mesh)).toBe(40 * 12 + 7 * 32);
    console.info(`[journey-dressing] full ${f.triangles} tris / ${f.drawCalls} draws · lite ${l.triangles} tris / ${l.drawCalls} draws`);
    expect(f.triangles).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.full.triangles); expect(f.drawCalls).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.full.drawCalls);
    expect(l.triangles).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.lite.triangles); expect(l.drawCalls).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.lite.drawCalls);
    // Lite keeps the landmark pins only (4-sided shaft 8 + octahedron cap 8): lite drops, never substitutes.
    expect(tris(lite.group.getObjectByName(DRESSING_MAP_NAME) as THREE.Mesh)).toBe(7 * 16);
    // Diorama units: every pin stands on the clay at its landmark (dioramaFrame), its cap above the ground there.
    const frame = full.frame, pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    let maxY = -Infinity; for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
    const oak = land.dressing!.landmarks.find(x => x.id === 'oak')!;
    expect(maxY).toBeGreaterThan(full.dioramaGroundAt(oak.top[0], oak.top[2]));
    expect(Math.abs((oak.top[0] - frame.centre[0]) * frame.scale)).toBeLessThan(JOURNEY_DIORAMA.islandUnits);
    // Recolours on theme (the clay palette, in place).
    const colours = () => Array.from(mesh.geometry.getAttribute('color').array);
    const before = colours();
    full.setTheme('taylor');
    expect(colours()).not.toEqual(before);
    // Week calm thins the far buildings but never a landmark pin, and lifts nothing above the clay it stood on.
    const trail = [[1400, 1150], [1460, 1190]] as const;
    full.setCalm({trail: trail.map(p => [p[0], p[1]] as const), clear: []}, 1);
    const extent = (m: THREE.Mesh) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox!.max.y; };
    expect(extent(mesh)).toBeGreaterThan(JOURNEY_DIORAMA.slab.top);
    full.setCalm(null);
    expect(colours()).toEqual(Array.from(mesh.geometry.getAttribute('color').array));
    full.dispose(); lite.dispose();
    expect(countDraws(full.group)).toEqual({triangles: 0, drawCalls: 0});
    expect(buildClayDressing({}, {frame, toX: x => x, toZ: z => z, groundAt: () => 0}, 'full', 1000, new THREE.MeshBasicMaterial())).toBeNull();
  });
  it('the flat (no-WebGL / reading-edition) map draws the same buildings and names every landmark (PR #588 Codex)', () => {
    const land = extractJourneyLand(dressedIndex(), TERRAIN), flat = journeyLandFlatData(land);
    expect(flat.dressing!.buildings).toHaveLength(40);
    expect(flat.dressing!.buildings.every(b => b.d.startsWith('M') && b.d.endsWith('Z'))).toBe(true);
    // Each glyph at its landmark's sighted top, the same plan point the clay pin stands on.
    expect(flat.dressing!.landmarks).toEqual(land.dressing!.landmarks.map(l => ({id: l.id, label: l.label, x: l.top[0], y: l.top[2]})));
    for (const theme of ['classic', 'taylor', 'newfoundland'] as const) {
      const p = JOURNEY_CLAY_PALETTES[theme];
      const bare = renderToStaticMarkup(createElement(JourneyLandFlat, {data: flat, theme}));
      expect(bare.match(/data-land-building="/g)).toHaveLength(40);
      expect(bare.match(/data-land-landmark="/g)).toHaveLength(7);
      // A bare flat map is decoration: the whole SVG is hidden.
      expect(bare).toMatch(/^<svg[^>]*aria-hidden="true"/);
      const read = renderToStaticMarkup(createElement(JourneyLandFlat, {data: flat, theme}, createElement('circle', {'data-overlay': 'piece', cx: 1000, cy: 900, r: 8})));
      // With the board overlay the land stays hidden, but each landmark is an image named by its landmark, with a tooltip.
      expect(read).not.toMatch(/^<svg[^>]*aria-hidden/);
      const marks = read.slice(read.indexOf('<g class="journey-land-flat__landmarks">'), read.indexOf('<g class="journey-land-flat__overlay">'));
      for (const l of flat.dressing!.landmarks) expect(marks).toContain(`role="img" aria-label="${l.label}" data-land-landmark="${l.id}"`);
      expect(marks).toContain('<title>campanile</title>');
      expect(marks).toContain(`fill="${p.honey}"`);
      // The landmark group is not inside the aria-hidden land group.
      const landOpen = read.indexOf('<g class="journey-land-flat__land" aria-hidden="true">'), landmarksAt = read.indexOf('<g class="journey-land-flat__landmarks">');
      expect(landOpen).toBeGreaterThanOrEqual(0);
      const landBody = read.slice(landOpen, landmarksAt);
      expect((landBody.match(/<g[ >]/g) ?? []).length).toBe((landBody.match(/<\/g>/g) ?? []).length);
    }
    // No dressing: no field, no glyphs.
    const plain = journeyLandFlatData(extractJourneyLand(parseHorizonIndex(INDEX.slice(0)), TERRAIN));
    expect('dressing' in plain).toBe(false);
    expect(renderToStaticMarkup(createElement(JourneyLandFlat, {data: plain, theme: 'classic'}))).not.toContain('data-land-landmark');
  });
  it('landmarks always; buildings tallest-first only while they fit the dressing triangles (a crowded island stays in budget)', () => {
    const world = dressedIndex();
    world.dressing!.journey = Array.from({length: 900}, (_, i) => { const x = 300 + (i % 30) * 40, z = 500 + Math.floor(i / 30) * 30; return {id: `row${String(i).padStart(3, '0')}`, districtId: 'harbour', footprint: [[x, z], [x + 8, z], [x + 8, z + 6], [x, z + 6]], base: 4, height: JOURNEY_MIN_HEIGHT + (i % 7), roofHeight: 2}; });
    world.dressing!.journey.push({id: 'tower', districtId: 'harbour', footprint: [[700, 380], [706, 380], [706, 386], [700, 386]], base: 40, height: 6, roofHeight: 1, landmarkId: 'library'});
    world.dressing!.landmarks.push({id: 'tower', label: 'A tower', neighbourhood: 'harbour', at: [703, 40, 383], top: [703, 50, 383]});
    const land = extractJourneyLand(world, TERRAIN);
    const chosen = chooseDressingBuildings(land.dressing!, CLAY_LAND_LOD.full.dressingTriangles);
    expect(chosen.reduce((s, b) => s + buildingTriangles(b.footprint), 0)).toBeLessThanOrEqual(CLAY_LAND_LOD.full.dressingTriangles);
    expect(chosen.length).toBeLessThan(901);
    // A landmark-carrying building is first, then the tallest.
    expect(chosen[0]!.id).toBe('tower');
    const heights = chosen.slice(1).map(b => b.height + b.roofHeight);
    expect(heights).toEqual(heights.slice().sort((a, b) => b - a));
    const homes = [{memberId: 'MEM-001', plotId: 'plot.terraces.1', layout: starterLayout()}];
    const full = buildJourneyLand(land, {theme: 'classic', tier: 'full', homes}), lite = buildJourneyLand(land, {theme: 'classic', tier: 'lite', homes});
    const f = full.stats(), l = lite.stats();
    console.info(`[journey-dressing] crowded full ${f.triangles} tris / ${f.drawCalls} draws · lite ${l.triangles} tris / ${l.drawCalls} draws`);
    expect(f.triangles).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.full.triangles); expect(f.drawCalls).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.full.drawCalls);
    expect(l.triangles).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.lite.triangles); expect(l.drawCalls).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.lite.drawCalls);
    // Every landmark pin is drawn on both tiers.
    const mesh = full.group.getObjectByName(DRESSING_MAP_NAME) as THREE.Mesh;
    expect(mesh.geometry.index!.count / 3).toBe(chosen.reduce((s, b) => s + buildingTriangles(b.footprint), 0) + land.dressing!.landmarks.length * 32);
    full.dispose(); lite.dispose();
  });
});
