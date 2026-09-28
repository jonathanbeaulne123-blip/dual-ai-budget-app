import {describe,expect,it} from 'vitest';
import {createFramePacer} from '../src/house/world/framePacer.ts';

describe('world refresh pacing',()=>{
  it('paints every fractional 60 Hz refresh instead of falling to 30 fps',()=>{
    const pacer=createFramePacer();
    const paints=Array.from({length:601},(_,i)=>Math.round(i*1000/60*10)/10).filter(now=>pacer.due(now,1000/60));
    expect(paints).toHaveLength(601);
  });
  it.each([90,120,144])('holds approximately 60 paints per second on a %i Hz display without drift',hz=>{
    const pacer=createFramePacer();let paints=0;
    for(let i=0;i<hz*10;i++)if(pacer.due(i*1000/hz,1000/60))paints++;
    expect(paints).toBeGreaterThanOrEqual(599);expect(paints).toBeLessThanOrEqual(601);
  });
  it('resumes immediately after a long suspension without a catch-up burst',()=>{
    const pacer=createFramePacer();pacer.due(0,1000/60);
    expect(pacer.due(10_000,1000/60)).toBe(true);
    expect(pacer.due(10_001,1000/60)).toBe(false);
    expect(pacer.due(10_016.6,1000/60)).toBe(true);
    pacer.reset();expect(pacer.due(10_017,1000/60)).toBe(true);
  });
  it('accepts invalidation immediately and changes cadence without waiting for the old deadline',()=>{
    const pacer=createFramePacer();pacer.due(0,50);
    expect(pacer.due(16.6,1000/60)).toBe(true);
    expect(pacer.due(20,0)).toBe(true);
  });
});

it('keeps every refresh when 60 Hz timestamps wobble by a millisecond',()=>{
  const pacer=createFramePacer();
  const timestamps=[0,17.1,32.3,50.4,67.1,82.5,100.3,116.1,133.9,149.0];
  expect(timestamps.filter(now=>pacer.due(now,1000/60))).toEqual(timestamps);
});
