import type { StructureSolid } from '../land/interfaces';
import { buildNeedleArch, buildOffshoreSolids } from '../land/offshore';
import { HORIZON_MANIFEST, requireScaleFactor } from '../world/manifest';

export interface HorizonCard { id: string; positions: number[]; indices: number[]; maxFog: 0.7; source: string }
/** Greybox silhouettes only. The ring keeps distant geography recognisable without
 * drawing a replacement land mesh or placing any prop on the island. */
export function buildHorizonCards(): HorizonCard[] {
  const s = requireScaleFactor();
  const silhouette = (id: string, points: number[][]): HorizonCard => {
    const positions = points.flatMap(p => [p[0]! * s, p[1]! * s, p[2]! * s]), indices: number[] = [];
    for (let i = 1; i < points.length - 1; i++) indices.push(0, i + 1, i);
    return { id: `horizon.${id}`, source: id, positions, indices, maxFog: 0.7 };
  };
  const solid = (r: StructureSolid): HorizonCard => ({ id: `horizon.${r.id}`, source: r.id, positions: r.positions, indices: r.indices, maxFog: 0.7 });
  const glasshouse = HORIZON_MANIFEST.hosts.find(h => h.id === 'glasshouse')!;
  const gx = glasshouse.xy[0]!, gz = glasshouse.xy[1]!, gh = glasshouse.h;
  return [
    silhouette('crown', [[1100, 70, 500], [1110, 115, 500], [1215, 140, 500], [1310, 158, 470], [1380, 145, 500], [1520, 110, 500], [1520, 70, 500]]),
    silhouette('dam', [[1118, 22, 905], [1118, 52, 905], [1162, 52, 905], [1162, 22, 905]]),
    silhouette('highSpan', [[1210, 23.4, 1105], [1210, 25.15, 1105], [1270, 25.15, 1105], [1270, 23.4, 1105]]),
    silhouette('bightBridge', [[455, 11.4, 1100], [455, 13.15, 1100], [685, 13.15, 1100], [685, 11.4, 1100]]),
    silhouette('lamp', [[500, 0, 1230], [520, 7, 1230], [555, 8, 1230], [580, 0, 1230]]),
    solid(buildNeedleArch()),
    ...buildOffshoreSolids().filter(r => r.id.startsWith('offshore.stacks')).map(solid),
    silhouette('glasshouse', [[gx - 15, gh, gz], [gx - 15, gh + 6 / s, gz], [gx, gh + 9 / s, gz], [gx + 15, gh + 6 / s, gz], [gx + 15, gh, gz]]),
  ];
}
