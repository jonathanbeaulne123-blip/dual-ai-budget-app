import {it} from 'vitest';
import {createLabCore} from './browser/skateLabCore.ts';
import {LAB_SCENARIOS} from './browser/skateLabScenarios.ts';
import {skateField} from '../src/harbour/skate/driver.ts';
import {skateDressingSolids} from '../src/harbour/skate/world/dressingSolids.ts';
import {worldToFrame} from '../src/harbour/skate/world/profiles.ts';
import {SPOT_LAYOUTS} from '../src/harbour/skate/world/layout.ts';
it('probe',()=>{
  const sc=LAB_SCENARIOS.find(s=>s.name==='line')!;
  const lab=createLabCore();lab.load(sc.load);lab.script(sc.script);lab.step(sc.frames);
  const tr=lab.trace() as any[];const solids=skateDressingSolids(skateField());
  const fr=(SPOT_LAYOUTS as any).find((l:any)=>l.id==='tideline').frame;
  const bi=tr.findIndex(f=>f.events?.some((e:any)=>e.kind==='bail'));
  for(let i=Math.max(0,bi-40);i<=bi;i+=5){const p=tr[i].present;const n=solids.map(s=>[s.id,Math.hypot(s.x-p.x,s.z-p.z)] as const).sort((a,b)=>a[1]-b[1])[0];console.log(i,p.phase,p.x.toFixed(2),p.z.toFixed(2),'local',worldToFrame(fr,p.x,p.z).map((v:number)=>v.toFixed(2)).join(','),p.speed?.toFixed?.(2),n);}
  console.log(JSON.stringify(tr[bi].events));
});
