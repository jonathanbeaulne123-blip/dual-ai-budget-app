import { describe, expect, it } from 'vitest';
import { slab,solid } from '../src/harbour/horizon/land/structures/mesh';
import { buildHorizonCards } from '../src/harbour/horizon/sky/horizonCards';
import { sampleTerrain } from '../src/harbour/horizon/land/terrain';
import type { StructureSolid, TerrainField } from '../src/harbour/horizon/land/interfaces';

describe('Horizon distant landmark proxies', () => {
  it('samples terrain from the supplied final field and identifies resident owners', () => {
    const columns = 101, rows = 91, heights = new Float32Array(columns * rows);
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) heights[row * columns + col] = col * 0.2 + row * 0.3;
    const field: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 20, columns, rows, heights, surfaces: new Uint8Array(heights.length) };
    for (const card of buildHorizonCards(field)) {
      expect(card.indices.length / 3).toBeLessThanOrEqual(300);
      expect(card.ownerDistrictIds.length).toBeGreaterThan(0);
      if (!['crown', 'lamp'].includes(card.source)) continue;
      expect(new Set(card.positions.filter((_, i) => i % 3 === 2)).size).toBeGreaterThan(2);
      for (let i = 0; i < card.positions.length; i += 3) expect(card.positions[i + 1]).toBeCloseTo(sampleTerrain(field, card.positions[i]!, card.positions[i + 2]!), 6);
    }
  });
  it('uses actual bridge geometry and ownership instead of authored upright rectangles', () => {
    const solid: StructureSolid = { id: 'bightBridge.deck@bight', kind: 'bridge', surface: 'stone', role: 'deck', walkable: true, bedIds: ['V01'], districtId: 'bight', positions: [10, 7, 20, 14, 8, 20, 10, 7, 24], indices: [0, 2, 1] };
    const card = buildHorizonCards(undefined, [solid]).find(c => c.source === 'bightBridge')!;
    expect(card.positions).toEqual(solid.positions); expect(card.indices).toEqual(solid.indices); expect(card.ownerDistrictIds).toEqual(['bight']);
  });
});

it('keeps a curved bridge proxy within 300 triangles without straightening the full bridge',()=>{
 const deck=solid('highSpan.deck','bridge','stone','deck',['VG'],'notch');
 for(let i=0;i<40;i++)slab(deck,[i,24,Math.sin(i/15)*10],[i+1,24,Math.sin((i+1)/15)*10],10,.6);
 const before=[...deck.positions],card=buildHorizonCards(undefined,[deck]).find(c=>c.source==='highSpan')!;
 expect(card.indices.length/3).toBeLessThanOrEqual(300);expect(card.indices.length/3).toBeGreaterThan(200);
 expect(deck.positions).toEqual(before);expect(card.ownerDistrictIds).toEqual(['notch']);
 expect(new Set(card.positions.filter((_,i)=>i%3===2)).size).toBeGreaterThan(8);
});

import { horizonFog, fogFactor, FOG_SUMMIT_CHECK, HORIZON_FOG } from '../src/harbour/horizon/sky/fog';
import { nightLight, NIGHT_FLOOR, NIGHT_LIGHT_CARDS } from '../src/harbour/horizon/sky/night';
import { skyGradient } from '../src/harbour/horizon/sky/gradient';
import { shadowFrame, SHADOW_WALK_HALF } from '../src/harbour/horizon/sun/shadow';
import { HORIZON_MANIFEST } from '../src/harbour/horizon/world/manifest';
import { readFileSync } from 'node:fs';
describe('Horizon sky numbers at scale 1.0 (R1-47, R1-48, R1-50, R1-51, R1-99)', () => {
  it('puts the Crown summit, seen from the square, inside 40–60 % fog on both tiers (P30; before: 100 %)', () => {
    const m = HORIZON_MANIFEST, a = m.views.find(v => v.id === 'A')!, crown = m.landforms.find(l => l.id === 'crown')! as { summit: number[]; summitH?: number };
    const v17 = Math.hypot(a.xy[0]! - crown.summit[0]!, 158 - 13.6, a.xy[1]! - crown.summit[1]!);
    for (const tier of ['full', 'lite'] as const) for (const distance of [FOG_SUMMIT_CHECK.distanceEu, v17]) {
      const fog = horizonFog({ tier, eyeAboveGround: FOG_SUMMIT_CHECK.eyeAboveGround, elevation: 40, sunAzimuth: 180, heading: 0 }), f = fogFactor(fog, distance);
      expect(f).toBeGreaterThanOrEqual(FOG_SUMMIT_CHECK.band[0]); expect(f).toBeLessThanOrEqual(FOG_SUMMIT_CHECK.band[1]);
    }
    expect(fogFactor(horizonFog({ tier: 'full', eyeAboveGround: 1.6, elevation: 40, sunAzimuth: 0, heading: 0 }), 758)).toBeCloseTo(0.494, 3);
    // The 0.6-scale numbers the review measured put the summit at 100 %.
    expect(fogFactor({ near: 151.4, far: 702.2 }, 758)).toBe(1);
    expect(HORIZON_FOG.fogDay).toEqual({ near: 40, far: 220 });
  });
  it('fogs horizon cards like the land but caps them at 70 % so they never vanish (STYLE §1.8)', () => {
    const fog = horizonFog({ tier: 'lite', eyeAboveGround: 1.6, elevation: 40, sunAzimuth: 0, heading: 0 });
    expect(fogFactor(fog, 5000, fog.horizonMaxOpacity)).toBe(0.7); expect(fogFactor(fog, 400, 0.7)).toBeLessThan(0.7);
    const runtime = readFileSync('src/harbour/horizon/runtime/index.ts', 'utf8');
    expect(runtime).toMatch(/fogHook\(material,HORIZON_FOG\.horizonMaxOpacity\)/); expect(runtime).not.toMatch(/lerp\(new THREE\.Color\(fog\.color\),\.5\)/);
  });
  it('lights the night with a moonlit floor and light cards, never dynamic point lights (STYLE §1.2.1)', () => {
    const deep = nightLight(-30, skyGradient(-30)), dusk = nightLight(-3, skyGradient(-3)), day = nightLight(40, skyGradient(40));
    expect(deep.nightness).toBe(1); expect(deep.hemisphereIntensity).toBe(NIGHT_FLOOR.floor); expect(deep.hemisphereSky).toBe(NIGHT_FLOOR.sky); expect(deep.moonIntensity).toBe(NIGHT_FLOOR.moonIntensity); expect(deep.lightCards).toBe(true);
    // Before: hemisphere 0.32 × 2.3 = 0.74 in the zenith navy #121a2e (P28 L* mode 1–6).
    expect(deep.hemisphereIntensity).toBeGreaterThan(0.74); expect(deep.hemisphereSky).not.toBe(skyGradient(-30).zenith);
    expect(dusk.hemisphereIntensity).toBeGreaterThanOrEqual(skyGradient(-3).ambient * 2.3); expect(day.lightCards).toBe(false); expect(day.moonIntensity).toBe(0);
    expect(NIGHT_LIGHT_CARDS.lite).toBe(48);
    expect(readFileSync('src/harbour/horizon/runtime/index.ts', 'utf8')).not.toMatch(/PointLight/);
  });
  it('frames the sun shadow on what a page looks at: the dam and the Crown cast at page A (R1-99; before ±180 eu round the body)', () => {
    const a = HORIZON_MANIFEST.views.find(v => v.id === 'A')!, heading = Math.atan2(a.target[0]! - a.xy[0]!, a.target[1]! - a.xy[1]!);
    const look = shadowFrame({ tier: 'full', mode: 'look', eye: [a.xy[0]!, 13.6, a.xy[1]!], heading });
    // The light-space box's ground footprint contains the disc of radius `half` round its centre.
    const inside = (x: number, z: number) => Math.hypot(x - look.centre[0], z - look.centre[2]) <= look.half;
    expect(inside(1140, 908)).toBe(true); // the dam's glass face, 430 eu
    expect(inside(1310, 470)).toBe(true); // the Crown's summit, 735 eu
    expect(inside(1240, 1105)).toBe(true); // the High Span
    expect(2 * look.half / look.mapSize).toBeLessThan(0.52); expect(inside(a.xy[0]!, a.xy[1]!)).toBe(true);
    expect(shadowFrame({ tier: 'lite', mode: 'walk', eye: [0, 0, 0], heading: 0 }).half).toBe(SHADOW_WALK_HALF); expect(SHADOW_WALK_HALF).toBeGreaterThanOrEqual(250);
  });
});
