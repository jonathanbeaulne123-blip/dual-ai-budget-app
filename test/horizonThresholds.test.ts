import { expect, it } from 'vitest';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';

it('gives every manifest threshold and at-grade crossing a graded pad and visible marker',()=>{
  const cuts=buildLandCuts(baseHeight);
  for(const row of M.thresholds){expect(cuts.pads.some(p=>p.id===`threshold.${row.id}`||p.id.startsWith(`threshold.${row.id}.`))).toBe(true);expect(row.modes.length).toBeGreaterThan(0);}
  M.crossings.forEach((c,i)=>{if(c.resolution==='threshold'&&(Array.isArray(c.at)||c.at.includes('465,700'))){expect(cuts.pads.find(p=>p.id===`crossing.${i}`)).toBeDefined();expect(cuts.solids.find(s=>s.id===`crossing.${i}.marker`)!.role).toBe('marker');}});
},60000);
