/**
 * Sample corridor planting (fictional; for the kit sheet and tests, not the island). Four composed verges along straight
 * road strips (x axis, paved half 5), each an example of the plan conventions `runtime/corridorPlanting.ts` reads:
 *  A. Long Sands: a palm grove behind a flower-bed verge (shore set), grass at the bed ends; the far side a smaller grove.
 *  B. Harbour Avenue: a maple avenue (v2 `round`) at 11 eu with hedge segments between, meadow beds at the ends.
 *  C. Crown Coast: a wind-bent pine and heath framing group inland; the sea side open.
 *  D. The Flats: prairie drifts (wild beds, prairie set) and bluestem tufts, with gaps at the views.
 * Groves follow STYLE §1.4.1 (5–12 per grove, 2.5–5 eu spacing, clearings between); drifts are one species each.
 */
import type { Corridor, CorridorStation, PlantItem, PlantingGroup } from '../../land/corridor/types.ts';
import { FLOWER_SET } from './sets.ts';

export type SampleVerge = 'palms' | 'avenue' | 'pines' | 'prairie';
/** The strip origin of each sample (x east, z south); the road runs along +x from the origin for 90 eu. */
export const SAMPLE_ORIGIN: Record<SampleVerge, readonly [number, number]> = { palms: [1000, 1400], avenue: [1400, 1150], pines: [1200, 300], prairie: [420, 700] };
export const SAMPLE_LENGTH = 90, SAMPLE_Y = 10;

const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
/** Items at (along, offset) from a strip origin. Facing +x, right(t) = (−t.z, t.x) = (0, 1): offset > 0 is the right side, +z. */
function place(origin: readonly [number, number], along: number, offset: number): [number, number, number] {
  return [origin[0] + along, SAMPLE_Y, origin[1] + offset];
}
/** Beds run along +x (yaw 0 on a +x road); a road with tangent t takes yaw = atan2(−t.z, t.x). */
const ALONG = 0;

export function samplePlanting(verge: SampleVerge, reachId = `sample.${verge}`): PlantingGroup[] {
  const o = SAMPLE_ORIGIN[verge], r = rng({ palms: 11, avenue: 23, pines: 37, prairie: 41 }[verge]), groups: PlantingGroup[] = [];
  const g = (id: string, kind: PlantingGroup['kind'], side: PlantingGroup['side'], items: PlantItem[]) => groups.push({ id: `${reachId}.${id}`, kind, reachId, side, items });
  const it = (species: PlantItem['species'], along: number, offset: number, scale: number, yaw: number, tint?: number, lean?: number): PlantItem => ({ species, at: place(o, along, offset), scale, yaw, ...(tint !== undefined ? { tint } : {}), ...(lean !== undefined ? { lean } : {}) });
  if (verge === 'palms') {
    // Right verge: a bed run (three beds, a gap for a crossing, two beds), grass at the run ends.
    const beds: PlantItem[] = [];
    for (const a of [8, 12.6, 17.2, 30, 34.6]) beds.push(it('flowerBed', a, 7.4, 1, ALONG, FLOWER_SET.shore + r()));
    for (const a of [5.4, 19.8, 27.4, 37.2]) for (let k = 0; k < 3; k++) beds.push(it('grassTuft', a + (r() - 0.5) * 1.2, 7.4 + (r() - 0.5) * 1.2, 0.7 + r() * 0.4, r() * 6.28, FLOWER_SET.shore + r()));
    g('verge.right', 'flowerBed', 'right', beds);
    // The grove behind it: seven palms, two heights, leaning away from the road (local +x → +z: yaw −π/2).
    const grove: PlantItem[] = [];
    for (const [a, off] of [[10, 11.5], [14.2, 13.8], [17.5, 11], [21, 14.5], [24.6, 12], [12, 16.8], [19.4, 17.6]] as const) grove.push(it('palm', a + (r() - 0.5), off + (r() - 0.5), 0.9 + r() * 0.2, -Math.PI / 2 + (r() - 0.5) * 1.4, r()));
    g('grove.right', 'palmGrove', 'right', grove);
    // Left: a smaller grove with a bed at its foot, then open to the water.
    const left: PlantItem[] = [];
    for (const [a, off] of [[40, -11], [43.5, -13.4], [46.8, -10.6], [44.6, -16.2], [49.6, -14]] as const) left.push(it('palm', a, off, 0.88 + r() * 0.22, Math.PI / 2 + (r() - 0.5) * 1.2, r()));
    g('grove.left', 'palmGrove', 'left', left);
    g('verge.left', 'flowerBed', 'left', [it('flowerBed', 42, -7.4, 1, ALONG, FLOWER_SET.shore + r()), it('flowerBed', 46.6, -7.4, 1, ALONG, FLOWER_SET.shore + r())]);
  }
  if (verge === 'avenue') {
    for (const side of [1, -1] as const) {
      const trees: PlantItem[] = [], hedges: PlantItem[] = [];
      for (let k = 0; k < 7; k++) {
        const a = 6 + k * 11 + (side < 0 ? 5.5 : 0); trees.push(it('round', a, side * 8.2, 0.92 + r() * 0.14, r() * 6.28, r()));
        if (k < 6) for (const h of [3.2, 5.3, 7.4]) hedges.push(it('hedge', a + h, side * 6.4, 0.8, ALONG, r()));
      }
      g(`avenue.${side > 0 ? 'right' : 'left'}`, 'avenue', side > 0 ? 'right' : 'left', trees);
      g(`hedgerow.${side > 0 ? 'right' : 'left'}`, 'hedgerow', side > 0 ? 'right' : 'left', hedges);
    }
    g('beds', 'flowerBed', 'right', [it('flowerBed', 2, 7, 1, ALONG, FLOWER_SET.meadow + r()), it('flowerBed', 84, 7, 1, ALONG, FLOWER_SET.meadow + r())]);
  }
  if (verge === 'pines') {
    // Inland (left) framing: five wind-bent pines leaning away from the sea wind (the sea is +z; local +x → −z is yaw π/2).
    const pines: PlantItem[] = [];
    for (const [a, off, s] of [[14, -11, 1.05], [18, -14.5, 0.9], [22.5, -11.8, 1], [17, -19, 0.8], [26, -16, 0.85]] as const) pines.push(it('pine', a + (r() - 0.5), off, s, Math.PI / 2 + (r() - 0.5) * 0.3, r(), 0.34));
    g('framing.left', 'framingTrees', 'left', pines);
    const heath: PlantItem[] = [];
    for (let k = 0; k < 16; k++) heath.push(it('heath', 8 + r() * 26, -7 - r() * 9, 0.7 + r() * 0.6, r() * 6.28, r()));
    for (let k = 0; k < 10; k++) heath.push(it('grassTuft', 6 + r() * 30, -6.4 - r() * 6, 0.7 + r() * 0.4, r() * 6.28, FLOWER_SET.shore + r()));
    g('heath.left', 'shrubCluster', 'left', heath);
    // A second, smaller group further on: two upright pines (v2's own `pine`) and heath.
    g('framing.left.2', 'framingTrees', 'left', [it('pine', 58, -12, 1, 0, 0.3), it('pine', 61.5, -14.5, 0.85, 1, 0.7), ...Array.from({ length: 6 }, () => it('heath', 54 + r() * 12, -7.5 - r() * 7, 0.6 + r() * 0.5, r() * 6.28, r()))]);
  }
  if (verge === 'prairie') {
    for (const side of [1, -1] as const) {
      const drifts: PlantItem[] = [];
      // Drifts of 2–3 wild beds (8–12 eu), gaps between them where the view opens.
      for (const start of side > 0 ? [4, 30, 58] : [16, 46]) {
        const n = 2 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) drifts.push(it('flowerBed', start + k * 4.3, side * (7.6 + r() * 1.4), 0.95 + r() * 0.15, ALONG + (r() - 0.5) * 0.3, FLOWER_SET.prairie + r()));
        for (let k = 0; k < 7; k++) drifts.push(it('grassTuft', start - 2 + r() * (n * 4.3 + 4), side * (6.2 + r() * 4.5), 0.8 + r() * 0.5, r() * 6.28, FLOWER_SET.prairie + r()));
      }
      g(`drifts.${side > 0 ? 'right' : 'left'}`, 'flowerBed', side > 0 ? 'right' : 'left', drifts);
    }
  }
  return groups;
}
/** A sample corridor carrying the four verges' planting (and a minimal straight station list, for the contract). */
export function sampleCorridor(verges: readonly SampleVerge[] = ['palms', 'avenue', 'pines', 'prairie']): Corridor {
  const stations: CorridorStation[] = [0, SAMPLE_LENGTH].map(s => ({ s, at: [SAMPLE_ORIGIN.palms[0] + s, SAMPLE_Y, SAMPLE_ORIGIN.palms[1]], tangent: [1, 0], grade: 0, context: 'boulevard', reachId: 'sample', half: 4,
    left: { edge: 'shoulder', guard: 'none', drop: 0, waterEu: null, paved: 5 }, right: { edge: 'shoulder', guard: 'none', drop: 0, waterEu: null, paved: 5 } }));
  return { id: 'SAMPLE', closed: false, step: 2, stations, reaches: [{ id: 'sample', label: 'Sample', from: 0, to: SAMPLE_LENGTH, context: 'boulevard' }], markings: [], guards: [], lamps: [], planting: verges.flatMap(v => samplePlanting(v)), stops: [] };
}
