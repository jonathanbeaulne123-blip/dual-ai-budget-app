import {describe,expect,it} from 'vitest';
import {airborneChute,bailOut,ringIndex,stepChute,type ChuteEnv,type ChuteInput,type ChuteState} from '../src/harbour/horizon/movers/glider/chute.ts';
import {SOUTH_WIND} from '../src/harbour/horizon/movers/shared/wind.ts';
const idle:ChuteInput={lean:[0,0],pull:false,brake:0,yaw:0};
const env:ChuteEnv={wind:{dir:0,speed:0},ground:()=>0};
const body={x:10,y:2000,z:20,yaw:.4,velocity:[12,-17,25] as [number,number,number]};
const run=(s:ChuteState,seconds:number,input=idle,e=env)=>{for(let i=0;i<Math.round(seconds*120);i++)s=stepChute(s,input,e,1/120);return s;};

describe('unrestricted continuous airborne movement',()=>{
  it('accepts any positive clearance, including a millimetre, with the entire source velocity',()=>{
    for(const agl of [.001,.05,1,59.9,300])expect(bailOut({x:10,y:agl,z:20,vx:12,vy:-17,vz:25,heading:.4},agl)).toMatchObject({x:10,y:agl,z:20,vx:12,vy:-17,vz:25});
    expect(bailOut({x:10,y:0,z:20,vx:0,vz:0,heading:0},0)).toBeNull();
  });
  it('opens at the exact body pose and velocity; forces take effect gradually',()=>{
    const s=airborneChute(body,true);expect(s).toMatchObject({x:10,y:2000,z:20,vx:12,vy:-17,vz:25,phase:'opening',inflation:0});
    const next=stepChute(s,idle,env,1/120);expect(next.vz).toBeGreaterThan(24);expect(next.vy).toBeLessThan(-16);expect(next.y).toBeLessThan(s.y);
  });
  it('does not auto-open; holding the input toggles only once',()=>{
    const falling=run(airborneChute({...body,y:80}),1);expect(falling.phase).toBe('freefall');
    const opened=run(falling,1.3,{...idle,pull:true});expect(opened.phase).toBe('canopy');
    expect(run(opened,1,{...idle,pull:true}).phase).toBe('canopy');
  });
  it('retracts and reopens during one fall without resetting velocity or heading',()=>{
    let s=run(airborneChute(body,true),2);const before={...s};
    s=stepChute(s,{...idle,pull:true},env,1/120);expect(s.phase).toBe('freefall');expect(Math.abs(s.vy-before.vy)).toBeLessThan(.3);expect(Math.abs(s.vx-before.vx)).toBeLessThan(.3);expect(s.heading).toBe(before.heading);
    s=run(s,.3);const falling={...s};s=stepChute(s,{...idle,pull:true},env,1/120);expect(s.phase).toBe('opening');expect(s.vy).toBeLessThan(falling.vy+.3);
  });
  it('cannot pump height or reset fall speed through 60 seconds of rapid toggles',()=>{
    let s=airborneChute({...body,y:10000,velocity:[30,-20,0]});
    for(let i=0;i<7200;i++){const next=stepChute(s,{...idle,pull:i%6===0},env,1/120);expect(next.y).toBeLessThanOrEqual(s.y);expect(next.vy).toBeLessThan(0);s=next;}
    expect(s.y).toBeLessThan(9800);
  });
  it('preserves upward jump motion while gravity takes over, with bounded freefall speed',()=>{
    let s=airborneChute({...body,velocity:[0,4.2,0]});const first=stepChute(s,idle,env,1/120);expect(first.y).toBeGreaterThan(s.y);s=run(s,5);expect(s.vy).toBe(-30);
  });
  it('uses the shared wind and bank/brake forces without instantaneous turns',()=>{
    const base={...airborneChute(body),phase:'canopy' as const,inflation:1,vx:0,vz:6,vy:-3,heading:0};
    const calm=run(base,2),windy=run(base,2,idle,{...env,wind:SOUTH_WIND});expect(windy.vz).toBeLessThan(calm.vz-3);
    const turn=run(base,1,{...idle,yaw:1});expect(turn.heading).toBeCloseTo(-40*Math.PI/180,5);expect(turn.vy).toBeLessThan(-3);
    const brake=run(base,2,{...idle,brake:.5});expect(brake.vy).toBeCloseTo(-2.2,2);expect(brake.vz).toBeCloseTo(4,1);
  });
});

describe('physical support and interruption',()=>{
  it('lands while opening close to the ground and retains horizontal momentum',()=>{
    for(const height of [.001,.05,.2,1]){const s=run(airborneChute({...body,y:height,velocity:[12,-2,8]},true),2);expect(s.phase).toBe('touchdown');expect(s.y).toBe(0);expect(s.vx).toBeGreaterThan(5);expect(s.vy).toBe(0);expect(s.inflation).toBe(0);}
  });
  it('lands on a walkable downhill slope with tangent momentum instead of hovering',()=>{
    const s=run({...airborneChute({...body,x:0,y:.1,z:0,velocity:[6,-4,0]}),phase:'canopy',inflation:1,heading:Math.PI/2},2,idle,{...env,ground:x=>-.5*x,normal:()=>[1/Math.sqrt(5),2/Math.sqrt(5),0]});
    expect(s.phase).toBe('touchdown');expect(s.y).toBeCloseTo(-.5*s.x,6);expect(s.vx).toBeGreaterThan(5);expect(s.vy).toBeCloseTo(-.5*s.vx,6);
  });
  it('requires stable support instead of stowing on a brief brush',()=>{
    let s=stepChute(airborneChute({...body,y:.001}),idle,env,1/120);expect(s.phase).toBe('freefall');expect(s.contactT).toBeLessThan(.04);
    s=stepChute(s,idle,{...env,ground:()=>-10},1/120);expect(s.contactT).toBe(0);expect(s.phase).toBe('freefall');
    const steep=run(airborneChute({...body,y:.001,velocity:[0,-2,0]},true),.2,idle,{...env,normal:()=>[.866,.5,0]});expect(steep.phase).not.toBe('touchdown');
  });
  it('stops against walls and ceilings without treating them as a landing',()=>{
    const wall=run(airborneChute({...body,x:0,y:100,velocity:[30,-2,0]},true),.2,idle,{...env,blocked:(x)=>x>=1});expect(wall.x).toBeLessThan(1);expect(wall.phase).not.toBe('touchdown');expect(wall.y).toBeLessThan(100);
    const ceiling=run(airborneChute({...body,y:10,velocity:[0,5,0]}),.1,idle,{...env,ceiling:()=>11.3});expect(ceiling.y).toBeLessThanOrEqual(10.05);expect(ceiling.vy).toBeLessThanOrEqual(0);
  });
  it('holds at unloaded terrain without losing velocity and resumes when collision is ready',()=>{
    const s=airborneChute(body),held=stepChute(s,idle,{...env,ready:()=>false},1/60);expect([held.x,held.y,held.z,held.vx,held.vy,held.vz]).toEqual([s.x,s.y,s.z,s.vx,s.vy,s.vz]);expect(stepChute(held,idle,env,1/60).y).toBeLessThan(s.y);
  });
  it('bounded substeps agree across caller frame rates and preserve ring scoring',()=>{
    const s=airborneChute(body,true),a=run(s,.2),b=stepChute(s,idle,env,.2);expect(b.x).toBeCloseTo(a.x,7);expect(b.y).toBeCloseTo(a.y,7);
    expect([3,8,20,40].map(x=>ringIndex([x,0],{xy:[0,0],rings:[5,10,25]}))).toEqual([0,1,2,-1]);
  });
});
