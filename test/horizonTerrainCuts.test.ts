import { describe, expect, it } from 'vitest';
import type { BedCut } from '../src/harbour/horizon/land/interfaces';
import { createBedSampler } from '../src/harbour/horizon/land/terrain';
import { linePoint, mix, smooth } from '../src/harbour/horizon/land/terrain/geometry';

describe('Horizon spatial bed cut solver', () => {
  it('retains exact brute-force cut heights across bin boundaries, route crossings and excluded spans', () => {
    const bed = (id: string, points: BedCut['points'], extra: Partial<BedCut> = {}): BedCut => ({ id, kind: 'road', profile: 'road', surface: 'paved', points, width: 10, shoulder: 2, blend: 15, clearHeight: 5, maxGrade: 0.12, terrainCut: true, structureIds: [], districtIds: [], ...extra });
    const beds = [
      bed('ring', [[20, 5, 20], [480, 20, 20], [480, 25, 480], [20, 12, 480], [20, 5, 20]]),
      bed('zigzag', [[20, 5, 20], [400, 17, 100], [40, 10, 280], [380, 30, 470]], { terrainExclusions: [{ at: [260, 150], radius: 55 }] }),
      bed('crossing', [[0, 40, 170], [420, 20, 230]]),
      bed('bridge', [[50, 100, 50], [400, 100, 400]], { terrainCut: false }),
    ];
    const indexed = createBedSampler(beds);
    for (let z = -8; z <= 512; z += 7.25) for (let x = -8; x <= 512; x += 7.25) {
      let height = 3 + x * 0.02 - z * 0.004;
      const original = height;
      for (const b of beds) {
        if (!b.terrainCut || b.terrainExclusions?.some(e => Math.hypot(x - e.at[0], z - e.at[1]) < e.radius)) continue;
        const hit = linePoint(b.points, x, z);
        height = mix(height, hit.height, 1 - smooth((hit.distance - b.width / 2 - b.shoulder) / 15));
      }
      expect(indexed(x, z, original).height, `${x},${z}`).toBeCloseTo(height, 9);
    }
  });
});
