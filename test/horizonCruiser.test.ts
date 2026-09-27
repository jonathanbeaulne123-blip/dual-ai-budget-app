import {describe,it,expect} from 'vitest';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import type {LandCuts,TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
import {solid,box} from '../src/harbour/horizon/land/structures/mesh.ts';
import {createCruiserState,stepCruiser,cruiserDismount,recoverCruiser,cruiserSpeed,validCruiserPosition} from '../src/harbour/horizon/movers/cruiser/sim.ts';
import {createCruiserController} from '../src/harbour/horizon/movers/cruiser/controller.ts';
import {CRUISER,cruiserPreferenceKey,readCruiserSkin,saveCruiserSkin} from '../src/harbour/horizon/movers/cruiser/tuning.ts';
import {createCruiserArt} from '../src/harbour/horizon/movers/cruiser/art.ts';
import type {MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import type {MoverInput} from '../src/harbour/horizon/movers/shared/mode.ts';
const field:TerrainField={revision:'horizon-geo-1',width:500,depth:500,step:250,columns:3,rows:3,heights:new Float32Array(9),surfaces:new Uint8Array(9)};
const empty:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
const flat=createHorizonGeography(field,empty),start={x:100,y:0,z:100,yaw:0};
const idle:MoverInput={forward:0,steer:0,jump:false,sprint:false,crouch:0,accept:false,look:{dx:0,dy:0}};
function run(seconds:number,input=idle,g=flat,s=createCruiserState(start)) {for(let i=0;i<Math.round(seconds/CRUISER.dt);i++)s=stepCruiser(s,input,g);return s;}
function wallAt(x=100,z=120){const wall=solid('wall','test','stone','wall');box(wall,[x,z],5,[30,.4],0);return createHorizonGeography(field,{...empty,solids:[wall]});}
describe('one forgiving Horizon cruiser',()=>{
  it('accelerates to cruise promptly and stops near a door without reversing on a held brake',()=>{
    let s=run(3,{...idle,forward:1});expect(cruiserSpeed(s)).toBeCloseTo(16,1);
    const before=s.z;s=run(2,{...idle,forward:-1},flat,s);expect(cruiserSpeed(s)).toBe(0);expect(s.z-before).toBeLessThan(8.5);expect(s.reverse).toBe(false);
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
