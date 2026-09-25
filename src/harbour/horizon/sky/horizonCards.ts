import type { StructureSolid, TerrainField, XY } from '../land/interfaces';
import { buildOffshoreSolids } from '../land/offshore';
import { baseHeight, sampleTerrain } from '../land/terrain';
import { requireScaleFactor } from '../world/manifest';

export interface HorizonCard {
  id: string;
  positions: number[];
  indices: number[];
  maxFog: 0.7;
  source: string;
  /** Data stays resident; its distant proxy hides whenever an owner is resident. */
  ownerDistrictIds: string[];
}
/** Distant LODs are sampled from the final land and copied from real structures.
 * There are no upright landmark planes intersecting the walking world. Renderers
 * must hide a proxy whenever any owner district's detailed mesh is resident. */
export function buildHorizonCards(field?: TerrainField, solids: readonly StructureSolid[] = []): HorizonCard[] {
  const s = requireScaleFactor(), cards: HorizonCard[] = [];
  const terrain = (id: string, owner: string, min: XY, max: XY): void => {
    const positions: number[] = [], indices: number[] = [], cells = 12;
    for (let row = 0; row <= cells; row++) for (let col = 0; col <= cells; col++) {
      const x = (min[0] + (max[0] - min[0]) * col / cells) * s, z = (min[1] + (max[1] - min[1]) * row / cells) * s;
      positions.push(x, field ? sampleTerrain(field, x, z) : baseHeight(x, z), z);
    }
    for (let row = 0; row < cells; row++) for (let col = 0; col < cells; col++) {
      const i = row * (cells + 1) + col, j = i + cells + 1;
      indices.push(i, j, i + 1, i + 1, j, j + 1);
    }
    cards.push({ id: `horizon.${id}`, source: id, positions, indices, maxFog: 0.7, ownerDistrictIds: [owner] });
  };
  const structure = (id: string, selected: readonly StructureSolid[], face?: (solid: StructureSolid, a: number, b: number, c: number) => boolean): void => {
    if (!selected.length) return;
    const positions: number[] = [], indices: number[] = [], owners = new Set<string>();
    for (const solid of selected) {
      const offset = positions.length / 3; positions.push(...solid.positions); owners.add(solid.districtId);
      for (let i = 0; i < solid.indices.length; i += 3) {
        const a = solid.indices[i]!, b = solid.indices[i + 1]!, c = solid.indices[i + 2]!;
        if (!face || face(solid, a, b, c)) indices.push(offset + a, offset + b, offset + c);
      }
    }
    if (indices.length > 900) throw new Error(`Horizon ${id} proxy exceeds 300 triangles; authored simplification required`);
    cards.push({ id: `horizon.${id}`, source: id, positions, indices, maxFog: 0.7, ownerDistrictIds: [...owners] });
  };
  const is = (solid: StructureSolid, id: string): boolean => solid.id === id || solid.id.startsWith(`${id}@`);
  terrain('crown', 'crown', [1100, 300], [1520, 640]);
  terrain('lamp', 'offshore', [490, 1180], [590, 1270]);
  // The dam's actual north/south wall faces retain the real spillway aperture;
  // internal block sides are immaterial to its distant silhouette. The crest is solid.
  structure('dam', solids.filter(r => is(r, 'dam.wall') || is(r, 'dam.crest')), (solid, a, b, c) => {
    if (is(solid, 'dam.crest')) return true;
    const p = solid.positions, ux = p[b * 3]! - p[a * 3]!, uy = p[b * 3 + 1]! - p[a * 3 + 1]!, uz = p[b * 3 + 2]! - p[a * 3 + 2]!;
    const vx = p[c * 3]! - p[a * 3]!, vy = p[c * 3 + 1]! - p[a * 3 + 1]!, vz = p[c * 3 + 2]! - p[a * 3 + 2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    return Math.abs(nz) > 0.9 * Math.hypot(nx, ny, nz);
  });
  for (const id of ['highSpan', 'bightBridge']) structure(id, solids.filter(r => is(r, `${id}.deck`) || is(r, `${id}.rails`)));
  structure('glasshouse', solids.filter(r => is(r, 'host.glasshouse.walls') || is(r, 'host.glasshouse.roof')));
  const rocks = solids.some(r => is(r, 'offshore.needle')) ? solids : buildOffshoreSolids();
  structure('offshore.needle', rocks.filter(r => is(r, 'offshore.needle')));
  for (let i = 1; i <= 3; i++) structure(`offshore.stacks.${i}`, rocks.filter(r => is(r, `offshore.stacks.${i}`)));
  return cards;
}
