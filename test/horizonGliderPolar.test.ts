import {describe,expect,it} from 'vitest';
import {HORIZON_MANIFEST} from '../src/harbour/horizon/world/manifest.ts';
import {FLIGHT_POLAR,GLIDER_POLAR,GLIDER_TRIM_MS,PULL_ACCEL,PUSH_ACCEL,STALL_MS,barTarget,glideRatio,sinkAt} from '../src/harbour/horizon/movers/glider/polar.ts';
import {BANK_IN_RATE,BANK_OUT_RATE,MAX_BANK,launchWing,stepWing,turnRadius,turnRate,type WingEnv,type WingState} from '../src/harbour/horizon/movers/glider/wing.ts';

// FLIGHT.md §10 row 1: sink is monotone above 9; trim = 11 / 1.2 (9.17 : 1); stall below 7.5 recovers to 9 in ≤ 1.5 s
// losing ≤ 6 m; airspeed never exceeds 17.
const still:WingEnv={wind:{dir:Math.PI,speed:0},lift:()=>0,ground:()=>-1000};
const flying=(over:Partial<WingState>={}):WingState=>({x:0,y:500,z:0,heading:0,bank:0,airspeed:11,vs:0,phase:'flight',stallT:0,t:0,...over});
function run(state:WingState,seconds:number,input={bar:0,bank:0},env=still){let s=state;for(let i=0;i<Math.round(seconds*60);i++)s=stepWing(s,input,env,1/60);return s;}

describe('the glider polar',()=>{
  it('reads the manifest polar, which matches FLIGHT §2.2',()=>{
    expect(GLIDER_POLAR).toEqual(HORIZON_MANIFEST.sky.gliderPolar);
    expect(GLIDER_POLAR).toEqual(FLIGHT_POLAR);
  });
  it('passes through the five points and is flat at min sink',()=>{
    for(const [v,sink] of GLIDER_POLAR)expect(sinkAt(v)).toBeCloseTo(sink,10);
    for(let v=8;v<=17;v+=.05)expect(sinkAt(v)).toBeGreaterThanOrEqual(1.05-1e-9);
  });
  it('is monotone above 9 m/s and smooth between the points',()=>{
    let last=sinkAt(9);
    for(let v=9.01;v<=17.0001;v+=.01){const s=sinkAt(v);expect(s).toBeGreaterThanOrEqual(last-1e-12);expect(Math.abs(s-last)).toBeLessThan(.01);last=s;}
  });
  it('clamps outside 8…17',()=>{expect(sinkAt(5)).toBe(sinkAt(8));expect(sinkAt(25)).toBe(sinkAt(17));expect(sinkAt(17)).toBeCloseTo(3,10);});
  it('trims at 11 m/s, 1.2 m/s sink: 9.17 : 1',()=>{
    expect(GLIDER_TRIM_MS).toBe(11);expect(sinkAt(11)).toBeCloseTo(1.2,10);expect(glideRatio(11)).toBeCloseTo(9.17,2);
    // Best glide really is at trim (within the polar's resolution).
    for(let v=8;v<=17;v+=.1)expect(glideRatio(v)).toBeLessThanOrEqual(glideRatio(11)+.05);
  });
  it('maps the bar linearly each side: −1 = 8, 0 = 11, +1 = 17',()=>{
    expect(barTarget(-1)).toBe(8);expect(barTarget(0)).toBe(11);expect(barTarget(1)).toBe(17);
    expect(barTarget(.5)).toBe(14);expect(barTarget(-.5)).toBe(9.5);expect(barTarget(-2/3)).toBeCloseTo(9,10);expect(barTarget(9)).toBe(17);
  });
});

describe('stepWing speed, stall and turns',()=>{
  it('pulls in at 2 m/s² and pushes out at 1.5 m/s²',()=>{
    expect(PULL_ACCEL).toBe(2);expect(PUSH_ACCEL).toBe(1.5);
    expect(run(flying(),1,{bar:1,bank:0}).airspeed).toBeCloseTo(13,6);
    expect(run(flying(),1,{bar:-1,bank:0}).airspeed).toBeCloseTo(9.5,6);
    expect(run(flying(),10,{bar:1,bank:0}).airspeed).toBe(17);
  });
  it('never exceeds 17 m/s, even handed a faster state',()=>{
    let s=flying({airspeed:22}),max=0;
    for(let i=0;i<1200;i++){s=stepWing(s,{bar:1,bank:i%120<60?1:-1},still,1/60);max=Math.max(max,s.airspeed);}
    expect(max).toBeLessThanOrEqual(17);
  });
  it('stalls below 7.5: recovers to 9 in ≤ 1.5 s, loses ≤ 6 m, ignores the bar, never spins',()=>{
    expect(STALL_MS).toBe(7.5);
    for(const bar of [1,-1,0]){
      let s=stepWing(flying({airspeed:7}),{bar,bank:0},still,1/60);
      expect(s.stallT).toBeGreaterThan(0);
      const y0=500;let t=1/60;
      while(s.stallT>0&&t<3){s=stepWing(s,{bar,bank:0},still,1/60);t+=1/60;}
      expect(t).toBeLessThanOrEqual(1.5+1e-6);
      expect(s.airspeed).toBeCloseTo(9,6);
      expect(y0-s.y).toBeLessThanOrEqual(6+1e-6);expect(y0-s.y).toBeGreaterThan(5.5);
      expect(s.heading).toBe(0);expect(s.phase).toBe('flight');
    }
  });
  it('turns at ω = 4.9 tan(bank) / airspeed, right bank → heading decreases: 45° at 11 m/s is 25°/s on a ~25 m radius',()=>{
    expect(turnRate(Math.PI/4,11)).toBeCloseTo(-.4455,4);
    expect(Math.abs(turnRate(Math.PI/4,11))*180/Math.PI).toBeCloseTo(25.5,1);
    expect(turnRadius(Math.PI/4,11)).toBeCloseTo(24.7,1);
    const s=run(flying({bank:Math.PI/4}),1,{bar:0,bank:.9});
    expect(s.heading).toBeLessThan(0);
  });
  it('rolls in at 60°/s to ±50°, out at 90°/s',()=>{
    expect(MAX_BANK).toBeCloseTo(50*Math.PI/180,10);expect(BANK_IN_RATE).toBeCloseTo(Math.PI/3,10);expect(BANK_OUT_RATE).toBeCloseTo(Math.PI/2,10);
    const deg=(r:number)=>r*180/Math.PI;
    expect(deg(run(flying(),.5,{bar:0,bank:1}).bank)).toBeCloseTo(30,6);
    const full=run(flying(),2,{bar:0,bank:-1});expect(deg(full.bank)).toBeCloseTo(-50,6);
    expect(deg(run(full,.5,{bar:0,bank:0}).bank)).toBeCloseTo(-5,6);
  });
  it('costs height in a turn: sink × 1 / cos(bank)',()=>{
    const level=stepWing(flying(),{bar:0,bank:0},still,1/60),banked=stepWing(flying({bank:Math.PI/4}),{bar:0,bank:.9},still,1/60);
    expect(level.vs).toBeCloseTo(-1.2,6);expect(banked.vs).toBeCloseTo(-1.2/Math.cos(Math.PI/4),6);
  });
  it('runs off the pad: forward input runs three steps and lifts at 9 m/s; letting go stops at the lip',()=>{
    const edge=[[0,100,0],[6,100,0]] as const,start=launchWing(edge,0,{run:true});
    expect(start.phase).toBe('run');
    expect(run(start,2,{bar:0,bank:0})).toMatchObject({phase:'run',x:start.x,z:start.z});
    let s=start;for(let i=0;i<60&&s.phase==='run';i++)s=stepWing(s,{bar:1,bank:0},still,1/60);
    expect(s.phase).toBe('flight');expect(s.airspeed).toBe(9);expect(s.z).toBeCloseTo(0,1);
    expect(launchWing(edge,0)).toMatchObject({phase:'flight',airspeed:9,x:3,y:100,z:0});
  });
});
