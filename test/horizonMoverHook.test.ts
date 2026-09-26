import {describe,expect,it,vi} from 'vitest';
import {createMoverHook,MOVER_DETACH_BLEND_MS} from '../src/harbour/horizon/runtime/moverHook.ts';
import {IDLE_INPUT,type ModeController,type ModeInput} from '../src/harbour/horizon/movers/shared/mode.ts';

function glider(){
  let x=1310,y=160,z=440,done=false;const inputs:ModeInput[]=[];
  const c:ModeController={id:'glider',enter:vi.fn(),update(dt,input){inputs.push(input);z+=11*dt;y-=1.2*dt;if(y<150)done=true;},
    exit:()=>({at:[x,y,z],yaw:Math.PI}),bodyPose:()=>({x,y,z,yaw:Math.PI,pitch:.1,bank:.4}),
    camera:()=>({eye:[x,y+4.5,z-14],look:[x,y,z+22],fov:58,roll:0}),sound:()=>inputs.length===1?'snap':null,
    reducedMotionCut:()=>({landings:[]}),hud:()=>({height:y-20,lift:.8}),finished:()=>done};
  return {c,inputs};
}
const ground=(x:number,z:number)=>x>2000?5:20+z*0;

describe('Horizon mover hook',()=>{
  it('lets an attached controller own the body pose and the exact camera, horizon-locked',()=>{
    const body={x:0,y:0,z:0,yaw:0},hook=createMoverHook({body,ground}),{c,inputs}=glider();
    expect(hook.frame(.016,IDLE_INPUT)).toBeNull();
    hook.attach(c);expect(hook.attached()).toBe(c);
    const frame=hook.frame(.5,{...IDLE_INPUT,bar:1,bank:-.5})!;
    expect(inputs[0]).toMatchObject({bar:1,bank:-.5});
    expect(body).toEqual({x:1310,y:159.4,z:445.5,yaw:Math.PI});
    expect(frame.figure).toEqual({position:[1310,159.4,445.5],rotation:{x:-.1,y:Math.PI,z:.4,order:'YXZ'}});
    expect(frame.camera).toEqual({eye:[1310,163.9,431.5],look:[1310,159.4,467.5],fov:58,roll:0});
    expect(frame.sound).toBe('snap');expect(frame.hud).toMatchObject({lift:.8});expect(frame.finished).toBe(false);
    expect(hook.frame(.5,IDLE_INPUT)!.sound).toBeNull();
    for(let i=0;i<20;i++)hook.frame(.5,IDLE_INPUT);expect(hook.frame(.5,IDLE_INPUT)!.finished).toBe(true);
  });
  it('detaches onto the ground with the walk blend, and cuts instantly under reduced motion',()=>{
    const body={x:0,y:0,z:0,yaw:0},hook=createMoverHook({body,ground}),{c}=glider();
    hook.attach(c);hook.frame(.1,IDLE_INPUT);
    expect(hook.detach({x:1040,y:31,z:1065,yaw:.5},false)).toEqual({body:{x:1040,y:20,z:1065,yaw:.5},blendMs:MOVER_DETACH_BLEND_MS});
    expect(hook.attached()).toBeNull();expect(body).toEqual({x:1040,y:20,z:1065,yaw:.5});
    // Walk is restored: further frames do nothing to the body.
    expect(hook.frame(.1,IDLE_INPUT)).toBeNull();expect(body.y).toBe(20);
    hook.attach(c);expect(hook.detach({x:1230,y:40,z:1190,yaw:0},true).blendMs).toBe(0);
  });
  it('lands on a deck or jetty under the point before falling back to the terrain',()=>{
    const body={x:0,y:0,z:0,yaw:0},surface=vi.fn((x:number,_z:number,y:number)=>x===1300&&y>=40?40.6:null);
    const hook=createMoverHook({body,ground:()=>210,surface});
    // The Deep's jetty is inside the Crown: terrain above is 210, the jetty floor 40.6.
    expect(hook.detach({x:1300,y:41,z:440,yaw:0},true).body.y).toBe(40.6);expect(surface).toHaveBeenCalledWith(1300,440,41.5);
    expect(hook.detach({x:900,y:41,z:440,yaw:0},true).body.y).toBe(210);
  });
});
