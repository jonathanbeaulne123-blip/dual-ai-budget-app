import {describe,it,expect,vi} from 'vitest';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import type {LandCuts,TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
import {solid,box} from '../src/harbour/horizon/land/structures/mesh.ts';
import {createCruiserState,stepCruiser,cruiserDismount,recoverCruiser,cruiserSpeed,cruiserTopSpeed,validCruiserPosition} from '../src/harbour/horizon/movers/cruiser/sim.ts';
import {createBicycleController} from '../src/harbour/horizon/movers/bicycle/controller.ts';
import {createCruiserController} from '../src/harbour/horizon/movers/cruiser/controller.ts';
import {CRUISER,cruiserPreferenceKey,readCruiserSkin,saveCruiserSkin} from '../src/harbour/horizon/movers/cruiser/tuning.ts';
import {createCruiserArt} from '../src/harbour/horizon/movers/cruiser/art.ts';
import {createMoverRegistry,type MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import type {AirborneBody,ModeController,MoverInput} from '../src/harbour/horizon/movers/shared/mode.ts';
const field:TerrainField={revision:'horizon-geo-1',width:500,depth:500,step:250,columns:3,rows:3,heights:new Float32Array(9),surfaces:new Uint8Array(9)};
const empty:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
const flat=createHorizonGeography(field,empty),start={x:100,y:0,z:100,yaw:0};
const idle:MoverInput={forward:0,steer:0,jump:false,sprint:false,crouch:0,accept:false,look:{dx:0,dy:0}};
function run(seconds:number,input=idle,g=flat,s=createCruiserState(start)) {for(let i=0;i<Math.round(seconds/CRUISER.dt);i++)s=stepCruiser(s,input,g);return s;}
function wallAt(x=100,z=120){const wall=solid('wall','test','stone','wall');box(wall,[x,z],5,[30,.4],0);return createHorizonGeography(field,{...empty,solids:[wall]});}
describe('one forgiving Horizon cruiser',()=>{
  it('accelerates to cruise promptly and stops near a door without reversing on a held brake',()=>{
    // Changed 2026-10-04 (Jonathan: cruise at 2x): cruise is 32 m/s (was 16), so 3 s now reaches 32 and full
    // braking (24 m/s², was 16) stops it in 21.3 m (was 8 m from 16 m/s). Same shape of test, new numbers.
    let s=run(3,{...idle,forward:1});expect(cruiserSpeed(s)).toBeCloseTo(32,1);
    const before=s.z;s=run(2,{...idle,forward:-1},flat,s);expect(cruiserSpeed(s)).toBe(0);expect(s.z-before).toBeLessThan(22);expect(s.reverse).toBe(false);
    const stopped=s.z;s=run(2,{...idle,forward:-1},flat,s);expect(s.z).toBe(stopped);
    s=run(.1,idle,flat,s);s=run(1,{...idle,forward:-1},flat,s);expect(s.z).toBeLessThan(stopped);expect(cruiserSpeed(s)).toBeLessThanOrEqual(2.51);
  });
  it('turns tightly at rest and cruises off road without a route magnet',()=>{
    const s=run(1,{...idle,steer:1});expect(s.yaw).toBeCloseTo(-2.4,4);expect(s.x).toBe(100);expect(s.z).toBe(100);
    const riding=run(3,{...idle,forward:1,steer:.2});expect(riding.x).toBeLessThan(95);expect(riding.grounded).toBe(true);
  });
  it('never gains speed from sustained steering or alternating corrections',()=>{
    let s=createCruiserState(start);
    for(let i=0;i<120*60;i++){
      s=stepCruiser(s,{forward:1,steer:Math.sin(i/35),jump:false},flat);
      expect(cruiserSpeed(s)).toBeLessThanOrEqual(CRUISER.speed+1e-9);
    }
  });
  it('stops at a thin wall without tunnelling, flipping or launching',()=>{
    const s=run(6,{...idle,forward:1},wallAt());expect(s.z).toBeLessThan(119.35);expect(s.z).toBeGreaterThan(118);expect(s.y).toBe(0);expect(s.grounded).toBe(true);expect(cruiserSpeed(s)).toBeLessThan(.2);
  });
  it('uses dynamic boat collision normals and preserves camera hull bypass',()=>{
    const g=createHorizonGeography(field,empty);
    const remove=g.addDynamic({surface:()=>null,ceiling:()=>Infinity,contact:(_x,z,_y,radius=.3)=>z>120-radius?{id:'yacht-hull',nx:0,nz:-1}:null});
    const stopped=run(5,{...idle,forward:1},g);expect(stopped.z).toBeLessThan(120);expect(cruiserSpeed(stopped)).toBeLessThan(.01);
    expect(g.blocker(100,121,0)).toBe('yacht-hull');expect(g.blocker(100,121,0,.3,undefined,true)).toBeNull();
    expect(g.cameraBlocked([100,1,118],[100,1,122])).toBe(true);expect(g.cameraBlocked([100,1,118],[100,1,122],true)).toBe(false);
    remove();expect(run(5,{...idle,forward:1},g).z).toBeGreaterThan(140);
  });
  it('stops at a world corner without reflecting its velocity',()=>{
    const s=stepCruiser({...createCruiserState({x:499.53,y:0,z:499.53,yaw:Math.PI/4}),vx:11.3,vz:11.3},idle,flat);expect(s.vx).toBeGreaterThanOrEqual(-.001);expect(s.vz).toBeGreaterThanOrEqual(-.001);expect(cruiserSpeed(s)).toBeLessThan(.01);
  });
  it('retains tangent movement on glancing contact',()=>{
    const g=wallAt(),s=run(6,{...idle,forward:1},g,createCruiserState({...start,yaw:Math.PI/5}));
    expect(s.x).toBeGreaterThan(130);expect(s.y).toBe(0);expect(s.grounded).toBe(true);expect(cruiserSpeed(s)).toBeGreaterThan(3);
  });
  it('crosses a shallow kerb but respects a wall, deck and underside',()=>{
    const lip=solid('lip','test','stone','deck');box(lip,[100,106],.3,[12,2],0);lip.walkable=true;
    const deck=solid('bridge','test','stone','deck');box(deck,[100,110],8,[20,8],7.4);deck.walkable=true;
    const g=createHorizonGeography(field,{...empty,solids:[lip,deck]});
    const s=run(3,{...idle,forward:1},g);expect(s.z).toBeGreaterThan(115);expect(s.y).toBe(0);expect(s.grounded).toBe(true);
    expect(validCruiserPosition(g,{...start,z:110,y:8})?.y).toBe(8);expect(validCruiserPosition(g,{...start,z:110,y:7})).toBeNull();
  });
  it('stops before a low overhang while allowing a bridge with mounted headroom',()=>{
    const slab=solid('low-slab','test','stone','deck');box(slab,[100,110],2.2,[20,8],1.4);slab.walkable=true;
    const low=createHorizonGeography(field,{...empty,solids:[slab]});
    expect(low.blocker(100,108,0,CRUISER.radius)).toBeNull(); // The shorter walking body fits.
    const stopped=run(4,{...idle,forward:1},low);expect(stopped.z).toBeLessThanOrEqual(106-CRUISER.radius);expect(stopped.y).toBe(0);expect(cruiserSpeed(stopped)).toBe(0);
    expect(validCruiserPosition(low,{...start,z:108})).toBeNull();
    const high=solid('high-slab','test','stone','deck');box(high,[100,110],2.2,[20,8],1.7);high.walkable=true;
    expect(run(4,{...idle,forward:1},createHorizonGeography(field,{...empty,solids:[high]})).z).toBeGreaterThan(115);
  });
  it('rejects a low overhang during landing without pushing the rider beneath the floor',()=>{
    const slab=solid('low-air-slab','test','stone','deck');box(slab,[100,110],2.2,[20,8],1.4);slab.walkable=true;
    const low=createHorizonGeography(field,{...empty,solids:[slab]});
    let s={...createCruiserState({...start,z:105.4,y:.09}),grounded:false,vz:16,vy:-1};
    for(let i=0;i<30;i++){s=stepCruiser(s,idle,low);expect(s.y).toBeGreaterThanOrEqual(0);if(s.grounded)expect(validCruiserPosition(low,s)).not.toBeNull();}
    expect(s.z).toBeLessThan(106-CRUISER.radius);expect(s.grounded).toBe(true);
    // Defensive vertical resolution also retains the prior pose if contact data changes at touchdown.
    const cramped={...flat,ceiling:()=>1.4},before={...createCruiserState(start),y:.02,grounded:false,vy:-3};
    const next=stepCruiser(before,idle,cramped);expect(next.y).toBe(before.y);expect(next.grounded).toBe(false);expect(next.contact).toBe('low-headroom');
  });
  it('cannot jump through an uphill terrain face',()=>{
    const g={...flat,ground:(_x:number,z:number)=>z>102?6:0,surface:(x:number,z:number,y=0,step=.48)=>z>102?(y+step<6?null:{...flat.surface(x,z)!,y:6}):flat.surface(x,z)};
    const s=run(1,{...idle,jump:true},g,{...createCruiserState(start),vz:12});expect(s.z).toBeLessThan(102);expect(s.y).toBeGreaterThanOrEqual(0);
  });
  it('bridges a narrow road seam but leaves a real ledge airborne',()=>{
    const support=(z:number)=>z<105||z>105.08?.54:0;
    const g={...flat,surface:(x:number,z:number,y=0,step=.48)=>support(z)>y+step?null:{...flat.surface(x,z)!,y:support(z)}};
    let s=createCruiserState({...start,y:.54});
    for(let i=0;i<360;i++){s=stepCruiser(s,{...idle,forward:1},g);expect(s.y).toBeCloseTo(.54);expect(s.grounded).toBe(true);}
    expect(s.z).toBeGreaterThan(120);
    const ledge={...flat,surface:(x:number,z:number)=>({...flat.surface(x,z)!,y:z<102?2:0})};
    s=run(.3,{...idle,forward:1},ledge,{...createCruiserState({...start,y:2}),vz:12});expect(s.grounded).toBe(false);expect(s.y).toBeGreaterThan(0);
  });
  it('keeps intentional airtime until touchdown and refuses airborne dismount',()=>{
    let s=run(.2,{...idle,forward:1,jump:true});expect(s.grounded).toBe(false);expect(s.y).toBeGreaterThan(.5);expect(cruiserDismount(flat,s)).toBeNull();
    s=run(1,idle,flat,s);expect(s.grounded).toBe(true);expect(s.y).toBe(0);
  });
  it('collides with steep ground on landing instead of falling through it',()=>{
    const g={...flat,surface:(x:number,z:number)=>({...flat.surface(x,z)!,slope:50})};
    const s=run(2,idle,g,{...createCruiserState({...start,y:4}),grounded:false,vy:-1});expect(s.y).toBe(0);expect(s.vy).toBe(0);expect(s.grounded).toBe(true);
  });
  it('finds a clear dismount side, and refuses an enclosed placement',()=>{
    const wall=solid('side','test','stone','wall');box(wall,[101,100],5,[.5,10],0);
    const g=createHorizonGeography(field,{...empty,solids:[wall]});const out=cruiserDismount(g,createCruiserState(start));expect(out).not.toBeNull();expect(out!.x).toBeLessThan(100);expect(g.blocked(out!.x,out!.z,out!.y,.28)).toBe(false);
    const blocked={...flat,blocker:()=> 'enclosed'};expect(cruiserDismount(blocked,createCruiserState(start))).toBeNull();expect(recoverCruiser(blocked,createCruiserState(start))).toBeNull();
  });
  it('recovers a stuck rider to checked dry support with no residual momentum',()=>{
    const g=wallAt(100,100),s={...createCruiserState(start),vx:4,vy:-8,vz:6,safe:{...start,z:90}};
    const out=recoverCruiser(g,s)!;expect(out).not.toBeNull();expect(g.blocked(out.x,out.z,out.y,CRUISER.radius)).toBe(false);expect(cruiserSpeed(out)).toBe(0);expect(out.vy).toBe(0);
  });
  it('has the same fixed-step result at 10, 20, 30, 60 and 120 fps, independent of camera look',()=>{
    const states=[10,20,30,60,120].map(fps=>{
      const c=createCruiserController({geography:flat,reducedMotion:false,calm:false,tier:'full'} as MoverDeps);
      c.enter({id:'test',thresholdId:'test',from:'feet',to:'cruiser',at:[100,0,100],action:'Ride',label:'Ride'},start,0);c.update(0,idle,0);
      for(let i=0;i<fps*4;i++)c.update(1/fps,{...idle,forward:1,steer:.1,look:{dx:fps===30?.01:0,dy:0}},i*1000/fps);
      return c.state();
    });for(const s of states){expect(s.x).toBeCloseTo(states[0]!.x,7);expect(s.z).toBeCloseTo(states[0]!.z,7);}
  });
  it.each([false,true])('transfers exact airborne momentum to one parachute owner (open=%s), then puts the cruiser away',open=>{
    const deps={geography:flat,reducedMotion:false,calm:false,tier:'full'} as MoverDeps;
    const registry=createMoverRegistry(deps),c=createCruiserController(deps),dispose=vi.spyOn(c,'dispose');
    const enterAirborne=vi.fn(),chute={...c,id:'parachute',enterAirborne,update:()=>({} as never)} as ModeController;
    registry.register('parachute',()=>chute);
    registry.attach(c,{from:'feet',to:'cruiser'} as never,start,0);
    expect(c.airborne!()).toBeNull();expect(registry.deploy({...start,velocity:[1,2,3]},0,open)).toBe(false);
    c.update(0,idle,0);c.update(.2,{...idle,forward:1},0);c.update(.1,{...idle,forward:1,jump:true},0);
    const before=c.state(),air=c.airborne!()!;expect(air).toEqual({x:before.x,y:before.y,z:before.z,yaw:before.yaw,velocity:[before.vx,before.vy,before.vz]});
    expect(registry.deploy(air,1,open)).toBe(true);expect(enterAirborne).toHaveBeenCalledWith(air,open);
    expect(registry.active()).toBe(chute);expect(registry.stowed()).toBeNull();expect(dispose).toHaveBeenCalledTimes(1);
    registry.active()!.update(.1,idle,1);expect(c.state()).toEqual(before);
    registry.finish();expect(registry.mode()).toBe('feet');expect(registry.active()).toBeNull();
  });
  it('replaces a carried board when the rider explicitly selects the cruiser',()=>{
    const deps={geography:flat} as MoverDeps,registry=createMoverRegistry(deps),board=createCruiserController(deps);
    const dispose=vi.fn(),retained={...board,id:'board',dispose,airborne:()=>({...start,velocity:[0,2,4] as [number,number,number]}),resumeAt:()=>false} as ModeController;
    registry.attach(retained,{from:'feet',to:'board'} as never,start,0);
    registry.register('parachute',()=>({...board,id:'parachute',enterAirborne(_at:AirborneBody){}}));
    registry.deploy({...start,velocity:[0,2,4]},0);registry.finish();expect(registry.stowed()).toBe('board');
    registry.register('cruiser',createCruiserController);registry.accept({from:'feet',to:'cruiser'} as never,start,0);
    expect(dispose).toHaveBeenCalledTimes(1);expect(registry.stowed()).toBeNull();expect(registry.mode()).toBe('cruiser');
  });
  it('requires neutral input after an ownership handoff',()=>{
    const c=createCruiserController({geography:flat} as MoverDeps);c.enter({} as never,start,0);
    for(let i=0;i<60;i++)c.update(1/60,{...idle,forward:1,jump:true},0);
    expect(c.state().z).toBe(100);expect(c.state().y).toBe(0);
    c.update(1/60,idle,0);c.update(.1,{...idle,forward:1},0);expect(c.state().z).toBeGreaterThan(100);
  });
  it('changes skins without constructing another controller or changing its state',()=>{
    const c=createCruiserController({geography:flat} as MoverDeps);c.enter({} as never,start,0);const before=c.state();
    for(const theme of ['classic','taylor','newfoundland'] as const){const art=createCruiserArt(theme);art.setSkin('harley');expect(art.root.userData.skin).toBe('harley');art.setSkin('vespa');expect(c.state()).toEqual(before);art.dispose();}
  });
  it('scopes skin storage to the member and handles denied storage',()=>{
    expect(cruiserPreferenceKey('development','hh','a')).not.toBe(cruiserPreferenceKey('development','hh','b'));
    expect(readCruiserSkin({getItem:()=> 'invalid'},'x')).toBe('vespa');expect(readCruiserSkin({getItem:()=> 'harley'},'x')).toBe('harley');
    expect(saveCruiserSkin({setItem(){throw Error('blocked');}},'x','harley')).toBe(false);
  });
});
const geoDeps=(g:ReturnType<typeof createHorizonGeography>,quiet:{calm?:boolean;reducedMotion?:boolean}={}):MoverDeps=>({world:{} as MoverDeps['world'],geography:g,manifest:{} as MoverDeps['manifest'],reducedMotion:!!quiet.reducedMotion,calm:!!quiet.calm,tier:'full'});
// The new speeds cover a kilometre in ~20 s: these drives use a 20 km flat field so the world edge never stops them.
const wide=createHorizonGeography({...field,width:20000,depth:20000,step:10000},empty),far={x:10000,y:0,z:1000,yaw:0};
const go=(seconds:number,input:MoverInput,s=createCruiserState(far))=>run(seconds,input,wide,s);
const boostIn={...idle,forward:1,sprint:true};
/** Drive a controller like the runtime does (1/60 s frames) and return the frames. */
function drive(c:ModeController,seconds:number,input:MoverInput){const frames=[];for(let i=0;i<Math.round(seconds*60);i++)frames.push(c.update(1/60,input,i/60));return frames;}
describe('cruiser speed and Shift boost (Jonathan, 2026-10-04)',()=>{
  it('cruises at 32 m/s by default and boosts to 48 m/s while Shift is held',()=>{
    expect(CRUISER.speed).toBe(32);expect(CRUISER.boostSpeed).toBe(48);
    const cruise=go(6,{...idle,forward:1});expect(cruiserSpeed(cruise)).toBeCloseTo(32,6);expect(cruise.boost).toBe(0);
    const boosted=go(6,boostIn);expect(cruiserSpeed(boosted)).toBeCloseTo(48,6);expect(boosted.boost).toBe(1);expect(cruiserTopSpeed(boosted)).toBe(48);
    // Steering never adds energy, boosted or not.
    let s=boosted;for(let i=0;i<120*20;i++){s=stepCruiser(s,{...boostIn,steer:Math.sin(i/35)},wide);expect(cruiserSpeed(s)).toBeLessThanOrEqual(48+1e-9);}
  });
  it('ramps the boost in and out smoothly instead of jumping',()=>{
    let s=go(6,{...idle,forward:1});let prev=cruiserSpeed(s),maxStep=0;const at:number[]=[];
    for(let i=0;i<120*4;i++){s=stepCruiser(s,boostIn,wide);const v=cruiserSpeed(s);maxStep=Math.max(maxStep,Math.abs(v-prev));prev=v;at.push(v);}
    // At most acceleration·dt per tick (0.1 m/s), the cap takes boostRampUp to arrive, and 48 is reached in about two seconds.
    expect(maxStep).toBeLessThanOrEqual(CRUISER.acceleration*CRUISER.dt+1e-9);
    expect(at[Math.round(.25/CRUISER.dt)]!).toBeLessThan(36);expect(at[Math.round(2.5/CRUISER.dt)]!).toBeCloseTo(48,3);
    // Releasing Shift eases back to 32 at the same bounded rate: no snap.
    maxStep=0;for(let i=0;i<120*4;i++){s=stepCruiser(s,{...idle,forward:1},wide);const v=cruiserSpeed(s);maxStep=Math.max(maxStep,Math.abs(v-prev));prev=v;}
    expect(maxStep).toBeLessThanOrEqual(CRUISER.acceleration*CRUISER.dt+1e-9);expect(cruiserSpeed(s)).toBeCloseTo(32,6);expect(s.boost).toBe(0);
    // Shift alone (no throttle) and Shift in reverse never boost.
    expect(go(2,{...idle,sprint:true}).boost).toBe(0);
  });
  it('stops from a full 48 m/s boost within 50 m on the brake, and still reverses only from rest',()=>{
    let s=go(6,boostIn);const before=s.z;
    s=go(3,{...idle,forward:-1,sprint:true},s);expect(cruiserSpeed(s)).toBe(0);expect(s.z-before).toBeLessThan(50);expect(s.z-before).toBeGreaterThan(40);expect(s.reverse).toBe(false);
    s=go(.1,idle,s);s=go(1,{...idle,forward:-1,sprint:true},s);expect(s.reverse).toBe(true);expect(cruiserSpeed(s)).toBeLessThanOrEqual(CRUISER.reverseSpeed+1e-6);
  });
  it('does not tunnel through a thin wall at 48 m/s',()=>{
    // 0.4 m wall at z 120; start already at full boost 30 m away (0.4 m per tick, cut into 0.15 m pieces).
    const g=wallAt(),s0={...createCruiserState({...start,z:90}),vz:48,boost:1};
    let s=s0;for(let i=0;i<120*3;i++){s=stepCruiser(s,boostIn,g);expect(s.z).toBeLessThan(119.8);}
    expect(s.z).toBeGreaterThan(118.5);expect(s.y).toBe(0);expect(s.grounded).toBe(true);expect(cruiserSpeed(s)).toBeLessThan(.2);
  });
  it('slows to the corner speed on a full-lock bend, boosted or not, and holds a tighter arc than at 48',()=>{
    for(const input of [{...idle,forward:1,steer:1},{...boostIn,steer:1}]){
      const s=go(4,input,{...createCruiserState(far),vz:48,boost:input.sprint?1:0});expect(cruiserSpeed(s)).toBeCloseTo(CRUISER.cornerSpeed,3);
    }
    expect(CRUISER.cornerSpeed).toBe(10);
    // Turning circle at corner speed: v / yaw rate is under 6 m; at 48 m/s the rate tapers (√) to keep the arc stable.
    const rateAt=(v:number)=>{const s=stepCruiser({...createCruiserState(far),vz:v,boost:1},{...boostIn,steer:1},wide);return Math.abs(s.yaw)/CRUISER.dt;};
    expect(10/rateAt(10)).toBeLessThan(6);expect(rateAt(48)).toBeLessThan(rateAt(32));expect(rateAt(48)).toBeGreaterThan(.8);
  });
  it('caps boost at cruise speed under calm or reduced motion, with no roll and no camera pull',()=>{
    for(const quiet of [{calm:true},{reducedMotion:true}]){
      const c=createCruiserController(geoDeps(wide,quiet));c.enter({id:'x',thresholdId:'x',from:'feet',to:'cruiser',at:[10000,0,1000],action:'Ride',label:'Ride'},far,0);
      drive(c,1/30,idle);const frames=drive(c,6,{...boostIn,steer:0});const last=frames.at(-1)!;
      expect(cruiserSpeed((c as ReturnType<typeof createCruiserController>).state())).toBeCloseTo(32,4);expect(last.hud.label).toBe('Cruising');
      expect(frames.some(f=>f.sound.boost)).toBe(false);expect(last.pose.roll).toBe(0);expect(last.camera!.fov).toBe(CRUISER.cameraFov);
      const behind=Math.hypot(last.camera!.eye[0]-last.body.x,last.camera!.eye[2]-last.body.z);expect(behind).toBeCloseTo(CRUISER.cameraDistance,3);
    }
  });
  it('labels a boosted ride "Boost" with km/h, fills the arc against the boost cap and cues the boost once',()=>{
    const c=createCruiserController(geoDeps(wide));c.enter({id:'x',thresholdId:'x',from:'feet',to:'cruiser',at:[10000,0,1000],action:'Ride',label:'Ride'},far,0);
    drive(c,1/30,idle);const cruise=drive(c,6,{...idle,forward:1}).at(-1)!;
    expect(cruise.hud).toMatchObject({pace:'115 km/h',label:'Cruising'});expect(cruise.hud.arc).toBeCloseTo(32/48,3);
    const frames=drive(c,6,boostIn),last=frames.at(-1)!;
    expect(last.hud).toMatchObject({pace:'173 km/h',label:'Boost',arc:1});expect(frames.filter(f=>f.sound.boost)).toHaveLength(1);
    expect(last.camera!.fov).toBe(CRUISER.cameraFov);
    const behind=Math.hypot(last.camera!.eye[0]-last.body.x,last.camera!.eye[2]-last.body.z);expect(behind).toBeCloseTo(CRUISER.cameraDistance+CRUISER.cameraPull,1);
    const eased=drive(c,6,{...idle,forward:1}).at(-1)!;expect(eased.hud.label).toBe('Cruising');expect(eased.hud.pace).toBe('115 km/h');
  });
  it('runs the bicycle on the same sim, speeds and boost, as its own mode with its own label',()=>{
    const bike=createBicycleController(geoDeps(wide)),car=createCruiserController(geoDeps(wide));expect(bike.id).toBe('bicycle');expect(car.id).toBe('cruiser');
    for(const c of [bike,car])c.enter({id:'x',thresholdId:'x',from:'feet',to:c.id,at:[10000,0,1000],action:'Ride',label:'Ride'},far,0);
    const script:[number,MoverInput][]=[[1/30,idle],[3,{...idle,forward:1,steer:.3}],[4,boostIn],[2,{...idle,forward:-1}],[.2,idle],[1,{...idle,forward:-1}]];
    for(const [t,input] of script){const a=drive(bike,t,input).at(-1)!,b=drive(car,t,input).at(-1)!;expect(a.body).toEqual(b.body);expect(a.hud.pace).toBe(b.hud.pace);}
    const both=[bike,car].map(c=>{drive(c,6,boostIn);return (c as ReturnType<typeof createCruiserController>).state();});
    expect(cruiserSpeed(both[0]!)).toBeCloseTo(48,6);expect(both[0]).toEqual(both[1]);
    const label=(c:ModeController)=>drive(c,6,{...idle,forward:1}).at(-1)!.hud.label;expect(label(bike)).toBe('Cycling');expect(label(car)).toBe('Cruising');
    const art=createCruiserArt('classic');art.setSkin('bicycle');expect(art.root.userData.skin).toBe('bicycle');expect(art.root.children[0]!.name).toBe('Town bicycle');art.dispose();
  });
});
