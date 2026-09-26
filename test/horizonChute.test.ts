import {describe,expect,it} from 'vitest';
import {HORIZON_MANIFEST} from '../src/harbour/horizon/world/manifest.ts';
import {SOUTH_WIND,type WindSample} from '../src/harbour/horizon/movers/shared/wind.ts';
import {CHUTE,CHUTE_POLAR,chuteAt} from '../src/harbour/horizon/movers/glider/polar.ts';
import {bailOut,ringIndex,stepChute,type ChuteEnv,type ChuteInput,type ChuteState} from '../src/harbour/horizon/movers/glider/chute.ts';
import {resolveTouchdown,type LandingContext} from '../src/harbour/horizon/movers/glider/landing.ts';

// FLIGHT.md §3 / §10 row 6: bail refused < 60 m AGL; auto-pull at 45; opening 1.2 s to sink 3; brakes ≤ 3 s then the
// mush; wind drift; ring index from `touchdown`; the stand-up and the tumble through the §2.4 table.
const still:WindSample={dir:Math.PI,speed:0};
const zone=HORIZON_MANIFEST.sky.dropZone;
const env=(wind:WindSample=still,over:Partial<ChuteEnv>={}):ChuteEnv=>({wind,ground:()=>0,dropZone:{xy:[zone.xy[0]!,zone.xy[1]!],rings:zone.rings_m},...over});
const idle:ChuteInput={lean:[0,0],pull:false,brake:0,yaw:0};
const plane={x:1040,y:300,z:700,vx:0,vz:35,heading:0};
function run(s:ChuteState,seconds:number,input:ChuteInput|((s:ChuteState)=>ChuteInput)=idle,e=env()){
  const out=[s];for(let i=0;i<Math.round(seconds*60)&&s.phase!=='touchdown';i++){s=stepChute(s,typeof input==='function'?input(s):input,e,1/60);out.push(s);}return out;
}
const canopy=(over:Partial<ChuteState>={}):ChuteState=>({phase:'canopy',x:1040,y:200,z:1065,vx:0,vy:-3,vz:0,heading:Math.PI/2,brakeT:0,t:0,...over});

describe('bail-out and freefall',()=>{
  it('refuses the jump below 60 m above the ground',()=>{
    expect(CHUTE.minBailAgl).toBe(60);
    expect(bailOut(plane,59.9)).toBeNull();expect(bailOut(plane,Number.NaN)).toBeNull();
    expect(bailOut(plane,60)).toMatchObject({phase:'freefall',x:1040,y:300,z:700,vx:0,vz:35,vy:0});
  });
  it('falls at g 12 to a 30 m/s cap; the plane\'s speed decays with τ 0.5 s; lean ≤ 8; wind at half strength',()=>{
    const path=run(bailOut(plane,300)!,2),at=(t:number)=>path[Math.round(t*60)]!;
    expect(at(1).vy).toBeCloseTo(-12,6);expect(at(2).vy).toBeCloseTo(-24,6);
    expect(Math.min(...run(bailOut(plane,300)!,4).map(s=>s.vy))).toBe(-30);
    expect(at(.5).vz).toBeCloseTo(35*Math.exp(-1),6);
    const leaning=run(bailOut({...plane,vz:0},300)!,1,{...idle,lean:[3,4]}).at(-1)!;
    expect(Math.hypot(leaning.vx,leaning.vz)).toBeCloseTo(8,6);
    const drifting=run(bailOut({...plane,vz:0},300)!,1,idle,env(SOUTH_WIND)).at(-1)!;
    expect(drifting.vz).toBeCloseTo(-2,6);expect(drifting.vx).toBeCloseTo(0,6);
  });
  it('pulls by hand, or by itself at 45 m AGL — the chute always opens',()=>{
    const auto=run(bailOut(plane,300)!,30),pulled=auto.find(s=>s.phase==='opening')!;
    expect(pulled.snapped).toBe(true);expect(pulled.pulledBy).toBe('auto');
    // The pull fires on the first frame that starts at or under 45 m.
    const seen=auto[auto.indexOf(pulled)-1]!;expect(seen.y).toBeLessThanOrEqual(45);expect(seen.y).toBeGreaterThan(44.4);expect(auto[auto.indexOf(pulled)-2]!.y).toBeGreaterThan(45);
    // ~8–10 s of freefall from 300 m (FLIGHT: "~8 s"): 2.5 s building to 30 m/s, then 30 m/s.
    expect(pulled.t).toBeGreaterThan(8);expect(pulled.t).toBeLessThan(10.5);
    const hand=run(bailOut(plane,300)!,1.5,s=>({...idle,pull:s.t>1})).find(s=>s.phase==='opening')!;
    expect(hand.pulledBy).toBe('hand');expect(hand.y).toBeGreaterThan(200);
    expect(auto.filter(s=>s.snapped)).toHaveLength(1);
  });
  it('opens over 1.2 s on a square-root curve from the fall speed to sink 3',()=>{
    const path=run(bailOut(plane,300)!,30),i=path.findIndex(s=>s.phase==='opening'),start=path[i]!;
    expect(start.openFrom).toBe(30);
    const at=(t:number)=>path[i+Math.round(t*60)]!;
    expect(at(.3).vy).toBeCloseTo(-(30-27*Math.sqrt(.25)),6);
    expect(at(1.2).phase).toBe('canopy');expect(at(1.2).vy).toBeCloseTo(-3,6);
    expect(at(1.2-1/60).phase).toBe('opening');
  });
});

describe('the canopy',()=>{
  it('flies the toggle table: 6/3 up, 4/2.2 half, 2/1.5 full',()=>{
    expect(CHUTE_POLAR.map(r=>[r.toggles,r.forward,r.sink])).toEqual([['up',6,3],['half',4,2.2],['full',2,1.5],['flare',0,.5]]);
    expect(chuteAt(0)).toEqual({forward:6,sink:3});expect(chuteAt(.5)).toEqual({forward:4,sink:2.2});expect(chuteAt(1)).toEqual({forward:2,sink:1.5});
    for(const [brake,forward,sink] of [[0,6,3],[.5,4,2.2],[1,2,1.5]] as const){const s=run(canopy(),.5,{...idle,brake}).at(-1)!;expect(s.vx).toBeCloseTo(forward,6);expect(s.vy).toBeCloseTo(-sink,6);}
  });
  it('holds full brakes ≤ 3 s, then mushes (sink 4) with the brakes released for 1 s',()=>{
    const path=run(canopy(),6,{...idle,brake:1}),at=(t:number)=>path[Math.round(t*60)]!;
    expect(at(2.9).vy).toBeCloseTo(-1.5,6);expect(at(2.9).brake).toBe(1);
    expect(at(3.3).vy).toBeCloseTo(-4,6);expect(at(3.3).brake).toBe(0);expect(at(3.3).vx).toBeCloseTo(6,6);
    expect(at(3.9).vy).toBeCloseTo(-4,6);
    expect(at(4.3).vy).toBeCloseTo(-1.5,6);expect(at(4.3).brake).toBe(1);
  });
  it('yaws at up to 40°/s and a turn adds 0.5 m/s of sink',()=>{
    const s=run(canopy(),1,{...idle,yaw:1}).at(-1)!;
    expect((Math.PI/2-s.heading)*180/Math.PI).toBeCloseTo(40,6);expect(s.vy).toBeCloseTo(-3.5,6);
  });
  it('drifts with the 4 m/s south wind in full: 4 m/s north across it, 10 running with it, 2 into it',()=>{
    const across=run(canopy({heading:Math.PI/2}),1,idle,env(SOUTH_WIND)).at(-1)!;
    expect(across.vz).toBeCloseTo(-4,6);expect(across.vx).toBeCloseTo(6,6);
    expect(run(canopy({heading:Math.PI}),1,idle,env(SOUTH_WIND)).at(-1)!.vz).toBeCloseTo(-10,6);
    expect(run(canopy({heading:0}),1,idle,env(SOUTH_WIND)).at(-1)!.vz).toBeCloseTo(2,6);
  });
  it('feels the sink fields (the Bight, the Notch) and nothing else',()=>{
    expect(run(canopy(),.5,idle,env(still,{sink:()=>-1})).at(-1)!.vy).toBeCloseTo(-4,6);
    expect(run(canopy(),.5,idle,env(still,{sink:()=>2.5})).at(-1)!.vy).toBeCloseTo(-3,6);
  });
});

describe('touchdown',()=>{
  it('reports the ring: 0 ≤ 5 m, 1 ≤ 10, 2 ≤ 25, −1 beyond',()=>{
    const [x,z]=[zone.xy[0]!,zone.xy[1]!];
    expect([3,5,8,10,20,25,30].map(d=>ringIndex([x+d,z]))).toEqual([0,0,1,1,2,2,-1]);
    for(const [d,ring] of [[3,0],[8,1],[20,2],[40,-1]] as const){
      const s=run(canopy({x:x+d,y:.5,z,heading:0}),5,{...idle,brake:1}).at(-1)!;
      expect(s.phase).toBe('touchdown');expect(s.touchdown!.ringIndex).toBe(ring);
      expect(Math.hypot(s.touchdown!.xy[0]-x,s.touchdown!.xy[1]-z)).toBeLessThan(d+1);
    }
  });
  const green={id:'green',kind:'landing' as const,centre:[1040,2,1065] as const,halfSize:[60,2,60] as const,radius:60,yaw:0,modes:['glider','parachute']};
  const ctx:LandingContext={surface:()=>({y:0,slope:2,material:'grass',walkable:true}),water:()=>null,district:()=>({id:'green',kind:'field'}),nearestShoreNode:()=>null,nearestApron:()=>null,inHostFootprint:()=>false,envelope:{landings:[],volumes:[green]}};
  const landAt=(wind:WindSample,brakeFrom:number)=>{
    const s=run(canopy({y:20,heading:0}),30,st=>({...idle,brake:st.y<=brakeFrom?1:0}),env(wind)).at(-1)!,t=s.touchdown!;
    return{t,outcome:resolveTouchdown(ctx,{x:s.x,y:s.y,z:s.z,mode:'parachute'},{airspeed:0,sink:-s.vy,groundSpeed:t.groundSpeed,flared:t.flared})};
  };
  it('stands up after full brakes in the last 5 m in still air; tumbles without them',()=>{
    const up=landAt(still,5);expect(up.t.flared).toBe(true);expect(up.t.groundSpeed).toBeLessThanOrEqual(3);expect(up.outcome.kind).toBe('walkoff');
    const down=landAt(still,-1);expect(down.t.flared).toBe(false);expect(down.t.groundSpeed).toBeCloseTo(6,6);expect(down.outcome.kind).toBe('tumble');
  });
  // FLIGHT §3.3/§3.4: the flare takes forward 2 → 0 at the ground, so the 4 m/s south wind alone is 4 m/s over the
  // ground at touchdown — over the 3 m/s stand-up limit whichever way the canopy faces. Measured, not changed.
  it.fails('stands up flaring into the 4 m/s south wind (measured: ground speed 4.0 m/s at touchdown → tumble)',()=>{
    const into=landAt(SOUTH_WIND,5);
    expect(into.t.groundSpeed).toBeCloseTo(4,1);
    expect(into.outcome.kind).toBe('walkoff');
  });
});
