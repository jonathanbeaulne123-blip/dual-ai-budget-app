import {describe,expect,it} from 'vitest';
import {FLIGHT_CAM,cameraFov,createFlightCam,distance3,flightCamera,walkCameraPose,type FlightCamKind,type FlightCamState} from '../src/harbour/horizon/movers/glider/camera.ts';
import {createGliderController} from '../src/harbour/horizon/movers/glider/controller.ts';
import {axisHeight,lateralFreedom,THROAT} from '../src/harbour/horizon/movers/glider/corridor.ts';
import {launchWing,stepWing,MAX_BANK,type WingState} from '../src/harbour/horizon/movers/glider/wing.ts';
import {angleDiff} from '../src/harbour/horizon/movers/glider/lift.ts';
import type {ModeCameraPose,Vec3} from '../src/harbour/horizon/movers/shared/mode.ts';
import {BARN,FRAME,HILL,fly,pad,realHorizon,syntheticEnv,syntheticGround} from './fixtures/horizonFlight.ts';

const DEG=Math.PI/180,HANDOFF=30;
const state=(kind:FlightCamKind,patch:Partial<FlightCamState>={}):FlightCamState=>({kind,rider:[1000,120,900],heading:.3,bank:0,velocity:[Math.sin(.3)*11,-1.2,Math.cos(.3)*11],airspeed:11,...(kind==='corridor'?{axis:{yaw:0,slope:30*DEG,floor:40}}:{}),...patch});
const KINDS:FlightCamKind[]=['glider','corridor','freefall','canopy'];
/** The eye's lateral angle about the rider in the plane across the heading (the lean as seen from behind). */
function leanOf(pose:ModeCameraPose,s:FlightCamState,yaw:number){
  const d:Vec3=[pose.eye[0]-s.rider[0],pose.eye[1]-s.rider[1],pose.eye[2]-s.rider[2]],right:Vec3=[-Math.cos(yaw),0,Math.sin(yaw)];
  return Math.asin((d[0]*right[0]+d[2]*right[2])/FLIGHT_CAM.glider.above);
}

describe('horizon-locked',()=>{
  it('roll is 0 in every phase, tier and comfort setting, at any bank',()=>{
    for(const kind of KINDS)for(const tier of ['full','lite'] as const)for(const reducedMotion of [false,true])for(const bank of [-MAX_BANK,0,MAX_BANK]){
      const out=flightCamera(state(kind,{bank}),{dt:FRAME,tier,reducedMotion});
      expect(out.pose.roll).toBe(0);
      expect([...out.pose.eye,...out.pose.look].every(Number.isFinite)).toBe(true);
    }
  });
  it('leans ≤ 8° into a turn at full tier — as a lateral eye offset — and not at all on lite or under reduced motion',()=>{
    for(const bank of [-MAX_BANK,-20*DEG,20*DEG,MAX_BANK]){
      const s=state('glider',{bank,heading:0,velocity:[0,-1.2,11]}),full=flightCamera(s,{dt:FRAME,tier:'full',reducedMotion:false});
      expect(Math.abs(full.lean)).toBeLessThanOrEqual(8*DEG+1e-12);expect(Math.sign(full.lean)).toBe(Math.sign(bank));
      expect(leanOf(full.pose,s,0)).toBeCloseTo(full.lean,9);
      for(const [tier,reducedMotion] of [['lite',false],['full',true]] as const){
        const off=flightCamera(s,{dt:FRAME,tier,reducedMotion});expect(off.lean).toBe(0);expect(leanOf(off.pose,s,0)).toBeCloseTo(0,9);
      }
    }
    expect(flightCamera(state('glider',{bank:MAX_BANK}),{dt:FRAME,tier:'full',reducedMotion:false}).lean).toBeCloseTo(8*DEG,12);
  });
  it('FOV: 55° + up to 8° at 17 m/s at full tier only; 55° fixed on lite and under reduced motion in every phase',()=>{
    expect(cameraFov('glider',11,'full',false)).toBe(55);expect(cameraFov('glider',17,'full',false)).toBe(63);expect(cameraFov('glider',14,'full',false)).toBe(59);
    expect(cameraFov('freefall',30,'full',false)).toBe(62);expect(cameraFov('corridor',17,'full',false)).toBe(55);expect(cameraFov('canopy',6,'full',false)).toBe(55);
    for(const kind of KINDS)for(const v of [8,11,14,17,30])for(const [tier,reducedMotion] of [['lite',false],['full',true],['lite',true]] as const)expect(cameraFov(kind,v,tier,reducedMotion)).toBe(55);
  });
  it('the yaw follows the heading through a 0.35 s spring and never lags more than 12°',()=>{
    let prev=null as ReturnType<typeof flightCamera>['memory']|null,worst=0,heading=0;
    for(let i=0;i<600;i++){heading+=25*DEG*FRAME;const out=flightCamera(state('glider',{heading}),{dt:FRAME,tier:'full',reducedMotion:false,prev});prev=out.memory;worst=Math.max(worst,Math.abs(angleDiff(out.memory.yaw,heading)));}
    expect(worst).toBeLessThanOrEqual(12*DEG+1e-9);expect(worst).toBeGreaterThan(1*DEG);
  });
  it('free look orbits within ±120° / −30…+45° and springs back after 1.5 s; none in the corridor or freefall',()=>{
    let prev=null as ReturnType<typeof flightCamera>['memory']|null;
    const s=state('glider');
    for(let i=0;i<60;i++){const out=flightCamera(s,{dt:FRAME,tier:'full',reducedMotion:false,prev,look:[.2,.1]});prev=out.memory;}
    expect(prev!.lookYaw).toBeCloseTo(120*DEG,9);expect(prev!.lookPitch).toBeCloseTo(45*DEG,9);
    for(let i=0;i<80;i++)prev=flightCamera(s,{dt:FRAME,tier:'full',reducedMotion:false,prev}).memory;
    expect(prev!.lookYaw).toBeCloseTo(120*DEG,9);// still held at 1.33 s
    for(let i=0;i<120;i++)prev=flightCamera(s,{dt:FRAME,tier:'full',reducedMotion:false,prev}).memory;
    expect(Math.abs(prev!.lookYaw)).toBeLessThan(.05);
    for(const kind of ['corridor','freefall'] as const)expect(flightCamera(state(kind),{dt:FRAME,tier:'full',reducedMotion:false,look:[1,1]}).memory.lookYaw).toBe(0);
  });
});

describe('never below the ground or inside a host (a recorded flight on a synthetic field)',()=>{
  const env=syntheticEnv();
  it('keeps the eye ≥ 2 m above the ground and out of the barn along a low, turning flight over the hill',()=>{
    // Launch west of the hill, fly over its 80 m crown and down past the barn's roof, turning hard at times.
    let wing:WingState={...launchWing([[500,110,700],[500,110,706]],Math.PI/2),airspeed:11};
    const cam=createFlightCam();cam.reset(wing.heading);let y=wing.y,worst=Infinity,frames=0,hostHits=0;
    const wenv=env.wingEnv(()=>y);
    for(let i=0;i<60*60&&wing.phase!=='touchdown';i++){
      const t=i*FRAME,bank=Math.sin(t*.7)*.9,bar=t>20?1:0;
      y=wing.y;wing=stepWing(wing,{bar,bank},wenv,FRAME);
      const pose=cam.update({kind:'glider',rider:[wing.x,wing.y,wing.z],heading:wing.heading,bank:wing.bank,velocity:[wing.ground![0],wing.vs,wing.ground![1]],airspeed:wing.airspeed},{dt:FRAME,tier:'full',reducedMotion:false,ground:env.groundAt,blocked:env.cameraBlocked,solid:env.solidAt});
      worst=Math.min(worst,pose.eye[1]-syntheticGround(pose.eye[0],pose.eye[2]));
      if(env.inHost(pose.eye[0],pose.eye[1],pose.eye[2]))hostHits++;
      frames++;
    }
    expect(frames).toBeGreaterThan(600);
    expect(worst).toBeGreaterThanOrEqual(FLIGHT_CAM.floor-1e-6);expect(hostHits).toBe(0);
  });
  it('pulls in (fast) when the hill comes between the rider and the eye, and never stands inside the barn',()=>{
    // The rider on the hill's east flank, climbing away east: the eye 14 m behind would sit in the hill.
    const rider:Vec3=[HILL.x+40,syntheticGround(HILL.x+40,HILL.z)+1,HILL.z];
    expect(env.cameraBlocked(HILL.x+26,rider[1]+4.5-1.27,HILL.z)).toBe(true);
    const out=flightCamera({kind:'glider',rider,heading:Math.PI/2,bank:0,velocity:[11,2,0],airspeed:11},{dt:FRAME,tier:'full',reducedMotion:false,ground:env.groundAt,blocked:env.cameraBlocked,solid:env.solidAt});
    expect(out.memory.pull).toBeLessThan(1);expect(out.pose.eye[1]-syntheticGround(out.pose.eye[0],out.pose.eye[2])).toBeGreaterThanOrEqual(2-1e-9);
    const barn=BARN.footprint!,cx=(barn[0]![0]+barn[2]![0])/2,cz=(barn[0]![1]+barn[2]![1])/2;
    const low=flightCamera({kind:'glider',rider:[cx+12,24,cz],heading:Math.PI/2,bank:0,velocity:[11,-1,0],airspeed:11},{dt:FRAME,tier:'full',reducedMotion:false,ground:env.groundAt,blocked:env.cameraBlocked,solid:env.solidAt});
    expect(env.inHost(low.pose.eye[0],low.pose.eye[1],low.pose.eye[2])).toBe(false);
  });
});

describe('every handoff ≤ 30 eu (FLIGHT.md §4)',()=>{
  const env=syntheticEnv();
  it('walk → flight at the run-off: starts on the walk cam, blends 0.8 s, never jumps',()=>{
    const {world}=realHorizon(),t=world.thresholds.find(t=>t.id==='prowPlatform')!,body={x:t.at[0],y:t.height!,z:t.at[1],yaw:0};
    const c=createGliderController({env:realHorizon().env});c.enter(t,body);
    const walk=walkCameraPose(body),frames=fly(c,()=>({bar:1,forward:1}),()=>false,4);
    expect(distance3(frames[0]!.camera.eye,walk.eye)).toBeLessThan(1e-9);
    let jump=0;for(let i=1;i<frames.length;i++)jump=Math.max(jump,distance3(frames[i]!.camera.eye,frames[i-1]!.camera.eye));
    expect(jump).toBeLessThan(2);
    const firstFlight=frames.find(f=>f.phase==='flight'||f.phase==='flare')!;
    expect(distance3(firstFlight.camera.eye,walk.eye)).toBeLessThanOrEqual(HANDOFF);
    // Both behind the rider, a few eu apart (walk 9 behind / flight 14 behind).
    expect(distance3(frames.at(-1)!.camera.eye,walkCameraPose({...body,yaw:frames.at(-1)!.pose.yaw}).eye)).toBeLessThanOrEqual(HANDOFF);
  });
  it('flight → walk at touchdown: the last flight eye is within 30 eu of the walk cam at the exit',()=>{
    const c=createGliderController({env});c.enter(pad('test',1040,1000,30),{x:1040,y:30,z:1000,yaw:0});
    const frames=fly(c,()=>{const p=c.bodyPose();return{bar:c.phase()==='run'||c.phase()==='wear'?1:p.y-20<1.5?-1:0};},()=>c.finished!(),60);
    const exit=c.exit();expect(distance3(frames.at(-1)!.camera.eye,walkCameraPose({x:exit.at[0],y:exit.at[1],z:exit.at[2],yaw:exit.yaw}).eye)).toBeLessThanOrEqual(HANDOFF);
  });
  it('the Throat mouth: a 1.0 s pull-in along the axis, never a swing, and the corridor eye stays inside the chute',()=>{
    const c=createGliderController({env});c.enter(pad('test',1300,250,115),{x:1300,y:115,z:250,yaw:0});
    let n=0;
    const frames=fly(c,()=>({bar:c.phase()==='run'||c.phase()==='wear'?1:0,bank:c.phase()==='corridor'?Math.sin(n++*.05):0}),()=>c.finished!(),60);
    const mouth=frames.findIndex(f=>f.phase==='corridor');expect(mouth).toBeGreaterThan(0);
    expect(distance3(frames[mouth]!.camera.eye,frames[mouth-1]!.camera.eye)).toBeLessThan(2);
    const settled=frames[mouth+Math.ceil(FLIGHT_CAM.blend.mouth/FRAME)+1]!;
    expect(distance3(settled.camera.eye,frames[mouth-1]!.camera.eye)).toBeLessThanOrEqual(HANDOFF);
    // After the pull-in: 8 back / 2.5 up on the axis, inside the chute's clear volume.
    let checked=0;
    for(const f of frames.slice(mouth+Math.ceil(FLIGHT_CAM.blend.mouth/FRAME)+1)){
      if(f.phase!=='corridor'&&f.phase!=='level')continue;
      const [x,y,z]=f.camera.eye,s=z-THROAT.mouth[2];if(s<8)continue;
      expect(Math.abs(x-THROAT.mouth[0])).toBeLessThanOrEqual(lateralFreedom(THROAT,s)+1e-6);
      expect(Math.abs(y-axisHeight(THROAT,s))).toBeLessThanOrEqual(THROAT.aperture[1]/2);
      expect(f.camera.roll).toBe(0);checked++;
    }
    expect(checked).toBeGreaterThan(60);
  });
  it('the pull: the freefall cam rises to the canopy pose over the 1.2 s opening without a jump',()=>{
    const cam=createFlightCam();cam.reset(0);
    const ride=(kind:FlightCamKind)=>cam.update({kind,rider:[1040,150,1000],heading:0,bank:0,velocity:[0,kind==='freefall'?-30:-3,2],airspeed:2},{dt:FRAME,tier:'full',reducedMotion:false});
    const before=ride('freefall');cam.blendFrom(FLIGHT_CAM.blend.pull,false);
    let prev=before,jump=0;for(let i=0;i<Math.ceil(1.2/FRAME)+2;i++){const p=ride('canopy');jump=Math.max(jump,distance3(p.eye,prev.eye));prev=p;}
    expect(jump).toBeLessThan(1);expect(distance3(prev.eye,before.eye)).toBeLessThanOrEqual(HANDOFF);
    // Under reduced motion every blend is a cut.
    cam.blendFrom(1,true);expect(cam.blending()).toBe(false);
  });
});
