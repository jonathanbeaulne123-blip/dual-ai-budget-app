import { expect, it } from 'vitest';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { distance, maxGrade, plan } from '../src/harbour/horizon/land/structures/mesh';

it('reserves seven served flat rotated plots and two small sites, outside the protected Green',()=>{
  const cuts=buildLandCuts(baseHeight),pads=cuts.pads.filter(p=>p.kind==='reserve');expect(pads).toHaveLength(9);expect(pads.some(p=>p.placeId==='plot.terraces.4')).toBe(false);
  for(const area of ['terraces','bightShore']as const){const data=M.reserves[area];data.placeIds.forEach((id,i)=>{const p=pads.find(p=>p.id===id)!;expect(p.size).toEqual([64,44]);expect(p.margin).toBe(6);expect(p.rotationDegrees).toBe(data.rot_deg[i]);expect(p.placeId).toBe(id);expect(maxGrade(cuts.beds.find(b=>b.id===p.serviceBedId)!.points)).toBeLessThanOrEqual(.12001);for(const other of pads.filter(p=>data.placeIds.includes(p.id)&&p.id!==id))expect(distance(plan(p.centre),plan(other.centre))).toBeGreaterThanOrEqual(56);});}
  expect(cuts.diagnostics.filter(d=>d.id.startsWith('reserve.')&&d.severity==='conflict')).toEqual([]);
},60000);
