import { describe, expect, it } from 'vitest';
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
