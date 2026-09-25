import {describe,expect,it} from 'vitest';
import {MONORAIL_STOPS,DISTRICTS,transportPoint,mountainBaseHeight} from '../src/harbour/mountain/definition.ts';
import {advanceMonorail,boardMonorail,monorailOrder,monorailPosition,selectMonorailStop} from '../src/harbour/mountain/monorail.ts';
import {VILLAGE_SITES,VILLAGE_WATERFRONT} from '../src/harbour/village/layout.ts';

const run=(start:ReturnType<typeof boardMonorail>,seconds=300)=>{
  let state=start,previous=state.station;const served:number[]=[];
  for(let i=0;i<seconds*20;i++){
    state=advanceMonorail(state,.05);
    if(state.station!==previous&&state.phase==='doors-open')served.push(state.station);
    previous=state.station;
    if(!state.queue.length&&state.phase==='doors-open'&&i>0)break;
  }
  return {state,served};
};

describe('island monorail',()=>{
  const summit=MONORAIL_STOPS.length-1;
  it('has a platform for the shore, town buildings, all six neighbourhoods and summit',()=>{
    expect(MONORAIL_STOPS.map(s=>s.id)).toEqual(['quay','studio','boathouse','bank','town',...DISTRICTS.map(d=>d.id)]);
    const doors={quay:VILLAGE_WATERFRONT.spot,studio:VILLAGE_SITES.studio.spot,boathouse:VILLAGE_SITES.boathouse.spot,bank:VILLAGE_SITES.bank.spot,hearth:VILLAGE_SITES.home.spot,orchard:VILLAGE_SITES.cottage.spot,library:VILLAGE_SITES.library.spot,glasshouse:VILLAGE_SITES.glasshouse.spot};
    for(const [id,door] of Object.entries(doors)){const stop=MONORAIL_STOPS.find(s=>s.id===id)!;expect(Math.hypot(stop.at[0]-door[0],stop.at[2]-door[1])).toBeLessThan(25);}
    for(let i=0;i<MONORAIL_STOPS.length-1;i++){
      expect(transportPoint('monorail',i,i+1,0)).toEqual(MONORAIL_STOPS[i]!.at);
      transportPoint('monorail',i,i+1,1).forEach((v,j)=>expect(v).toBeCloseTo(MONORAIL_STOPS[i+1]!.at[j]!,6));
      for(let k=1;k<20;k++){const p=transportPoint('monorail',i,i+1,k/20);expect(p[1]).toBeGreaterThanOrEqual(mountainBaseHeight(p[0],p[2]));}
    }
    for(let i=1;i<MONORAIL_STOPS.length-1;i++){
      const at=MONORAIL_STOPS[i]!.at,before=transportPoint('monorail',i-1,i,.999),after=transportPoint('monorail',i,i+1,.001);
      const incoming=[at[0]-before[0],at[2]-before[2]],outgoing=[after[0]-at[0],after[2]-at[2]];
      expect(Math.hypot(...incoming)).toBeLessThan(1);
      expect(Math.hypot(...outgoing)).toBeLessThan(1);
      expect(incoming[0]!*outgoing[0]!+incoming[1]!*outgoing[1]!).toBeGreaterThan(0);
    }
  });
  it('serves selected floors in route order, passing unselected platforms',()=>{
    expect(monorailOrder(0,[summit,6,8,6])).toEqual([6,8,summit]);
    let ride=boardMonorail(0,true);
    for(const stop of [summit,6,8])ride=selectMonorailStop(ride,stop);
    const result=run(ride);
    expect(result.served).toEqual([6,8,summit]);
    expect(result.state.station).toBe(summit);
    expect(result.state.companion).toBe(true);
  });
  it('rides straight to the summit, then reverses on request',()=>{
    let ride=selectMonorailStop(boardMonorail(0),summit);
    const outbound=run(ride);
    expect(outbound.served).toEqual([summit]);
    ride=selectMonorailStop(outbound.state,0);
    const home=run(ride);
    expect(home.served).toEqual([0]);
    expect(monorailPosition(home.state)).toEqual(MONORAIL_STOPS[0]!.at);
  });
  it('holds in pause and lets passengers add a stop while moving',()=>{
    let ride=selectMonorailStop(boardMonorail(0),summit);
    for(let i=0;i<80;i++)ride=advanceMonorail(ride,.05);
    expect(ride.phase).toBe('moving');
    ride=selectMonorailStop(ride,7);
    expect(ride.queue).toEqual([7,summit]);
    expect(advanceMonorail({...ride,paused:true},.1).progress).toBe(ride.progress);
    let braking={...ride,brake:true};
    for(let i=0;i<100;i++)braking=advanceMonorail(braking,.05);
    expect(braking.speed).toBe(0);
    const held=braking.progress;
    expect(advanceMonorail(braking,.1).progress).toBe(held);
    expect(advanceMonorail({...braking,brake:false},.1).progress).toBeGreaterThan(held);
    expect(run(ride).served).toEqual([7,summit]);
  });
});
