import {expect,it,vi} from 'vitest';
import {createDetailStream} from '../src/harbour/mountain/streaming.ts';

it('defers ten Walk/Look toggles and builds at most one detail site per frame',()=>{
  const build=vi.fn(()=>({dispose:vi.fn()}));
  const districts=createDetailStream(Array.from({length:6},(_,i)=>({id:`district-${i}`,at:[i*10,0] as const,radius:75})),build);
  const exteriors=createDetailStream(Array.from({length:7},(_,i)=>({id:`exterior-${i}`,at:[i*10,0] as const,radius:75})),build);
  const update=(now:number,allowBuild:boolean)=>{
    const before=districts.live.size;
    const a=districts.update(0,0,true,now,allowBuild);
    const b=exteriors.update(0,0,true,now,allowBuild&&districts.live.size===before);
    return a||b;
  };
  for(let i=0;i<10;i++){expect(update(i*200,false)).toBe(true);expect(build).toHaveBeenCalledTimes(0);}
  for(let frame=0;frame<13;frame++){
    const before=build.mock.calls.length;
    update(2000+frame*16,true);
    expect(build.mock.calls.length-before).toBeLessThanOrEqual(1);
  }
  expect(build).toHaveBeenCalledTimes(13);
  districts.dispose();exteriors.dispose();
});

it('holds departing detail for four seconds before disposal',()=>{
  const dispose=vi.fn(),stream=createDetailStream([{id:'one',at:[0,0] as const,radius:10}],()=>({dispose}));
  stream.update(0,0,false,0);
  stream.update(100,0,false,1);
  stream.update(100,0,false,4000);expect(dispose).not.toHaveBeenCalled();
  stream.update(100,0,false,4001);expect(dispose).toHaveBeenCalledTimes(1);
});
