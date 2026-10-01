import {describe,expect,it} from 'vitest';
import {roadLampFootprint,roadLampFootClear,roadLampFootSupported,selectSupportedRoadLampSetback,type RoadLampFootCandidate} from '../src/harbour/horizon/land/corridor/plan/lampFootprint';
import {planCorridor,LAMP} from '../src/harbour/horizon/land/corridor/plan';
import type {CorridorStation} from '../src/harbour/horizon/land/corridor/types';

const diagonal=(x=0):RoadLampFootCandidate=>({at:[x,0,0],head:[x+1,5,1],yaw:Math.PI/4});
describe('the actual rotated road-lantern stone foot',()=>{
  it('rejects a diagonal corner missed by the old world-axis square, then selects the next bounded supported site',()=>{
    const ground=(x:number)=>x<.4?.548*x:0;
    // The previous axis-aligned checks all pass this site; the real rotated foot does not.
    expect(Math.max(...[-.2,0,.2].map(x=>Math.abs(ground(x))))).toBeLessThan(.14);
    const points=roadLampFootprint(diagonal());
    expect(points).toHaveLength(9);
    expect(Math.max(...points.map(([x])=>Math.abs(x)))).toBeCloseTo(Math.SQRT2*.2,12);
    expect(Math.max(...points.map(([x])=>Math.abs(ground(x))))).toBeGreaterThan(.154);
    expect(roadLampFootSupported(diagonal(),{ground})).toBe(false);
    expect(selectSupportedRoadLampSetback({roadHeight:0,candidate:back=>diagonal(4*(back-.9))},{ground},LAMP.maxStep)).toBe(1.15);
  });
  it.each(['occupied','water'] as const)('rejects any one of all nine actual samples when %s',kind=>{
    const l=diagonal();
    for(const [px,pz] of roadLampFootprint(l)){
      const blocked=(x:number,z:number)=>Math.hypot(x-px,z-pz)<1e-9;
      expect(roadLampFootSupported(l,{ground:()=>0,[kind]:blocked})).toBe(false);
      expect(roadLampFootClear(l,{[kind]:blocked})).toBe(false);
    }
  });
  it('uses rounded head direction, rejects unsupported rounding and never invents a site after bounded search exhaustion',()=>{
    const l:RoadLampFootCandidate={at:[10.001,0,20.001],head:[11.132,5,21.132],yaw:0};
    const points=roadLampFootprint(l);
    expect(points[4]).toEqual([10.001,20.001]);
    expect(Math.max(...points.map(([x])=>x))-l.at[0]).toBeCloseTo(Math.SQRT2*.2,12);
    expect(roadLampFootSupported({...l,at:[10.001,.141,20.001]},{ground:()=>0})).toBe(false);
    const tried:number[]=[];
    expect(selectSupportedRoadLampSetback({roadHeight:0,candidate:back=>{tried.push(back);return diagonal(back);}},{ground:()=>0,occupied:()=>true},LAMP.maxStep)).toBeUndefined();
    expect(tried).toHaveLength(17);expect(tried[0]).toBe(.9);expect(tried.at(-1)).toBeCloseTo(4.9,12);
  });
  it('measures the exact candidate which the corridor emits through its interpolated station frame',()=>{
    const side={edge:'shoulder' as const,guard:'none' as const,paved:4,drop:0,waterEu:null};
    const stations:CorridorStation[]=Array.from({length:31},(_,i)=>{const dz=i/100,n=Math.hypot(1,dz);return{
      s:i*2,at:[i*2,0,i*i/100],tangent:[1/n,dz/n],grade:0,half:4,context:'developed',reachId:'test',left:{...side},right:{...side},
    };});
    const measured:RoadLampFootCandidate[]=[];
    const plan=planCorridor({id:'mountainV2.road',closed:false,step:2,stations,reaches:[{id:'test',label:'test',from:0,to:60,context:'developed'}]},
      {ground:()=>0,water:()=>false,occupied:()=>false,seed:'actual-lamp-foot',lampSetback:(_s,_side,sites)=>{
        const back=selectSupportedRoadLampSetback(sites,{ground:()=>0},LAMP.maxStep);
        if(back!==undefined)measured.push(sites.candidate(back));return back;
      }});
    const lamps=plan.lamps.filter(l=>l.kind==='roadLantern');expect(lamps.length).toBeGreaterThan(0);
    for(const l of lamps)expect(measured.some(m=>JSON.stringify([m.at,m.head,m.yaw])===JSON.stringify([l.at,l.head,l.yaw])),l.id).toBe(true);
  });
  it('checks the final masonry-mounted foot before accepting a steep-shoulder fallback',()=>{
    const side={edge:'shoulder' as const,guard:'stoneParapet' as const,guardOffset:4,paved:4,drop:3,waterEu:null};
    const stations:CorridorStation[]=Array.from({length:31},(_,i)=>({s:i*2,at:[i*2,0,0],tangent:[1,0],grade:0,half:4,context:'developed',reachId:'test',left:{...side},right:{...side}}));
    const checked:RoadLampFootCandidate[]=[],rejected:RoadLampFootCandidate[]=[];
    const clear=(l:RoadLampFootCandidate)=>roadLampFootClear(l,{occupied:x=>x>17&&x<43});
    const plan=planCorridor({id:'mountainV2.road',closed:false,step:2,stations,reaches:[{id:'test',label:'test',from:0,to:60,context:'developed'}]},
      {ground:()=>-3,water:()=>false,occupied:()=>false,seed:'mounted-lamp-foot',lampSetback:()=>undefined,lampMountAllowed:l=>{
        checked.push(l);if(!clear(l)){rejected.push(l);return false;}return true;
      }});
    const lamps=plan.lamps.filter(l=>l.kind==='roadLantern');
    expect(rejected.length).toBeGreaterThan(0);expect(lamps.length).toBeGreaterThan(0);
    for(const l of lamps){
      expect(clear(l),l.id).toBe(true);
      expect(checked.some(c=>JSON.stringify([c.at,c.head,c.yaw])===JSON.stringify([l.at,l.head,l.yaw])),l.id).toBe(true);
    }
  });

  it('lets required safety coverage use only explicitly validated masonry mounts',()=>{
    const side={edge:'shoulder' as const,guard:'stoneParapet' as const,guardOffset:4,paved:4,drop:3,waterEu:null};
    const stations:CorridorStation[]=Array.from({length:31},(_,i)=>({s:i*2,at:[i*2,0,0],tangent:[1,0],grade:0,half:4,context:'mountain',reachId:'test',left:{...side},right:{...side}}));
    const corridor={id:'mountainV2.road',closed:false,step:2,stations,reaches:[{id:'test',label:'test',from:0,to:60,context:'mountain' as const}]};
    const checked:RoadLampFootCandidate[]=[];
    const env={ground:()=>-3,water:()=>false,occupied:()=>false,seed:'safety-mount',lampSetback:()=>undefined,lightTargets:[[30,0] as const]};
    // No nominal mountain lights: this target must reach the safety refinement.
    expect(()=>planCorridor(corridor,env)).toThrow(/no supported lamp site/);
    expect(()=>planCorridor(corridor,{...env,lampMountAllowed:()=>false})).toThrow(/no supported lamp site/);
    const plan=planCorridor(corridor,{...env,lampMountAllowed:l=>{checked.push(l);return true;}});
    expect(plan.lamps.length).toBeGreaterThan(0);
    expect(plan.lamps.some(l=>Math.hypot(l.pool[0]-30,l.pool[2])<=l.poolRadius)).toBe(true);
    for(const l of plan.lamps)expect(checked.some(c=>JSON.stringify([c.at,c.head,c.yaw])===JSON.stringify([l.at,l.head,l.yaw])),l.id).toBe(true);
  });

  it.each([30,30.25])('finds a narrow supported site at x=%s while refining only an exhausted ordinary search',site=>{
    const side={edge:'shoulder' as const,guard:'none' as const,paved:4,drop:0,waterEu:null};
    const stations:CorridorStation[]=Array.from({length:31},(_,i)=>({s:i*2,at:[i*2,0,0],tangent:[1,0],grade:0,half:4,context:'mountain',reachId:'test',left:{...side},right:{...side}}));
    const corridor={id:'mountainV2.road',closed:false,step:2,stations,reaches:[{id:'test',label:'test',from:0,to:60,context:'mountain' as const}]};
    // Only a 0.41m-long patch accepts the real 0.4m foot. The rest remains occupied.
    const footprintEnv={ground:()=>0,occupied:(x:number)=>Math.abs(x-site)>.205,water:()=>false};
    const checked:number[]=[];
    const plan=planCorridor(corridor,{...footprintEnv,seed:'narrow-footing',lightTargets:[[30,0]],lampSetback:(_s,_side,sites)=>{
      checked.push(sites.candidate(.9).at[0]);return selectSupportedRoadLampSetback(sites,footprintEnv,LAMP.maxStep);
    }});
    expect(plan.lamps).toHaveLength(1);
    const lamp=plan.lamps[0]!;expect(lamp.at[0]).toBe(site);
    expect(roadLampFootSupported(lamp,footprintEnv)).toBe(true);
    expect(Math.hypot(lamp.pool[0]-30,lamp.pool[2])).toBeLessThanOrEqual(lamp.poolRadius);
    const ordinary=(x:number)=>Math.abs((x-18)/1.5-Math.round((x-18)/1.5))<1e-9;
    if(site===30)expect(checked.every(ordinary)).toBe(true);
    else{
      const firstFine=checked.findIndex(x=>!ordinary(x));
      expect(firstFine).toBeGreaterThanOrEqual(34); // All 17 ordinary stations, both sides, were tried first.
      expect(checked.slice(0,firstFine).every(ordinary)).toBe(true);
      expect(checked.every(x=>x>=18&&x<=42)).toBe(true); // Search reach is unchanged.
    }
  });

});
