import { expect, it } from 'vitest';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { ROOM_DIMENSIONS } from '../src/harbour/horizon/land/underground/build';

it('encloses rooms and passages, preserves the only named mouths, and reports roof breaches',()=>{
  const cuts=buildLandCuts(baseHeight),f=M.underground.footprint;
  for(const [id,room]of Object.entries(M.underground.rooms)){const dim=ROOM_DIMENSIONS[id]!;for(const dx of [-dim.size[0]/2,dim.size[0]/2])for(const dz of [-dim.size[1]/2,dim.size[1]/2])expect(((room.xy[0]!+dx-f.cx)/f.rx)**2+((room.xy[1]!+dz-f.cy)/f.ry)**2).toBeLessThanOrEqual(1);expect(cuts.solids.find(s=>s.id===`underground.${id}.roof`)).toBeDefined();expect(cuts.pads.find(p=>p.id===`underground.${id}`)?.underground).toBe(true);}
  const named=['adit','throat','seaDoor','southPortal','deep.skylight'];for(const mouth of cuts.mouths)expect(named.includes(mouth.id)||/^(prowTunnel|shoulderTunnel|duneCulvert)\.portal\.[01]$/.test(mouth.id)).toBe(true);
  for(const b of cuts.beds.filter(b=>b.kind==='cave'||b.id==='ORE'))expect(b.terrainCut).toBe(false);
  const bad=buildLandCuts(()=>0);expect(bad.diagnostics.some(d=>d.id==='underground.routeCover'&&d.severity==='conflict')).toBe(true);
},60000);
