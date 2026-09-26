import type { StructureSolid, TerrainField, XY, XYZ } from '../land/interfaces';
import { buildOffshoreSolids } from '../land/offshore';
import { baseHeight, sampleTerrain } from '../land/terrain';
import { slab, solid as makeSolid } from '../land/structures/mesh';
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
  for (const id of ['highSpan', 'bightBridge']) {
    const selected=solids.filter(r=>is(r,`${id}.deck`)||is(r,`${id}.rails`));
    const deck=selected.find(r=>is(r,`${id}.deck`));
    if(deck&&selected.reduce((n,s)=>n+s.indices.length,0)>900&&deck.positions.length%24===0){
      // Eight closed spans sampled from the real curved deck retain its course;
      // thin coping is omitted only in this distant LOD, not from the bridge.
      const centre=(offset:number,a:number,b:number):XYZ=>[0,1,2].map(axis=>(deck.positions[offset+a*3+axis]!+deck.positions[offset+b*3+axis]!)/2) as unknown as XYZ;
      const points=[centre(0,4,5),...Array.from({length:deck.positions.length/24},(_,i)=>centre(i*24,6,7))];
      const width=Math.hypot(deck.positions[12]!-deck.positions[15]!,deck.positions[14]!-deck.positions[17]!);
      const proxy=makeSolid(`${id}.proxy`,'bridge','stone','deck',deck.bedIds,deck.districtId);
      for(let i=0;i<8;i++){
        const a=points[Math.floor(i*(points.length-1)/8)]!,b=points[Math.floor((i+1)*(points.length-1)/8)]!;
        slab(proxy,a,b,width,.6);for(const side of [-1,1])slab(proxy,a,b,.25,1.15,side*(width/2-.125),1.15);
      }
      structure(id,[proxy]);
    }else structure(id,selected);
  }
  structure('glasshouse', solids.filter(r => is(r, 'host.glasshouse.walls') || is(r, 'host.glasshouse.roof')));
  const rocks = solids.some(r => is(r, 'offshore.needle')) ? solids : buildOffshoreSolids();
  structure('offshore.needle', rocks.filter(r => is(r, 'offshore.needle')));
  for (let i = 1; i <= 3; i++) structure(`offshore.stacks.${i}`, rocks.filter(r => is(r, `offshore.stacks.${i}`)));
  return cards;
}
