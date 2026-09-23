/**
 * Tideline Skate Club v2 · the driver on the island: what v1 guaranteed,
 * kept (pause freezes the ride, rebuild checkpoints, device-local progress per
 * person/household/environment, discoveries and routes only by riding there,
 * the park and routes clear of buildings, trees and the sea), plus the v2
 * seams the driver owns (keys → flick-it → sim, stance, respawn, the wire act).
 */
import {describe,it,expect} from 'vitest';
import {SKATE_ROUTES,SKATE_SPOTS,SKATE_RAILS,skateSurface} from '../src/harbour/skate/park.ts';
import {createSkateSession,decodeSkateProgress,freshSkateProgress,observeSkate,skateProgressKey,saveSkateProgress,readSkateProgress,startSkateRoute} from '../src/harbour/skate/session.ts';
import {ISLAND_BUILDINGS,isClear,courtObstacles} from '../src/harbour/body/obstacles.ts';
import {plantPlan} from '../src/harbour/scene/planting.ts';
import {pathSegmentClear} from '../src/harbour/body/pathfinder.ts';
import {createSkateDriver,skateAct,skateField,skateGesturePath,SKATE_TRICK_BOOK} from '../src/harbour/skate/driver.ts';
import {blankPresent} from '../src/harbour/skate/look/legacy.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import type {SkatePresent} from '../src/harbour/skate/contract.ts';

/** A driver on the real island with a fake clock (ms) the key events share. */
function rig(){
  let t=1000;
  const d=createSkateDriver({obstacles:courtObstacles('full')},{now:()=>t});
  const tideline=SKATE_SPOTS.find(s=>s.id==='tideline')!;
  d.mount(tideline.start[0],tideline.start[1],tideline.startYaw,freshSkateProgress());
  const frames=(n:number,hz=60)=>{for(let i=0;i<n;i++){t+=1000/hz;d.step(1/hz);}};
  const key=(k:string,down:boolean)=>{const e={key:k,timeStamp:t};return down?d.input()!.keyDown(e):d.input()!.keyUp(e);};
  return {d,frames,key,advance:(ms:number)=>{t+=ms;},now:()=>t};
}

describe('skate v2 driver · riding',()=>{
  it('pushes along the board with W and rolls away from the spot start',()=>{
    const {d,frames,key}=rig();const start={...d.present()!};
    expect(key('w',true)).toBe(true);frames(90);key('w',false);
    const p=d.present()!;
    expect(p.speed).toBeGreaterThan(2);
    expect(Math.hypot(p.x-start.x,p.z-start.z)).toBeGreaterThan(1.5);
    expect(d.events()).toBeDefined();
  });
  it('ollies from the arrow keys (pull back, flick up) and a kickflip from ↓ then ↑+←',()=>{
    const {d,frames,key}=rig();
    key('w',true);frames(60);key('w',false);
    const seen:string[]=[];const watch=(n:number)=>{for(let i=0;i<n;i++){frames(1);for(const e of d.events())seen.push(e.kind==='pop'?`pop:${e.flipId}`:e.kind);}};
    key('ArrowDown',true);watch(8);key('ArrowDown',false);key('ArrowUp',true);watch(3);key('ArrowUp',false);watch(70);
    expect(seen).toContain('pop:null');expect(seen).toContain('land');
    seen.length=0;
    key('ArrowDown',true);watch(8);key('ArrowDown',false);key('ArrowUp',true);key('ArrowLeft',true);watch(3);key('ArrowUp',false);key('ArrowLeft',false);watch(80);
    expect(seen).toContain('pop:kickflip');
  });
  it('freezes an airborne ride while paused, clears held input, and resumes',()=>{
    const {d,frames,key}=rig();
    key('w',true);frames(60);
    key('ArrowDown',true);frames(8);key('ArrowDown',false);key('ArrowUp',true);frames(3);key('ArrowUp',false);
    for(let i=0;i<30&&d.present()!.phase!=='air';i++)frames(1);
    const air=d.present()!;expect(air.phase).toBe('air');
    const at={...air};
    d.pause(true);frames(60);
    expect(d.present()).toMatchObject({x:at.x,y:at.y,z:at.z,phase:'air'});expect(d.paused()).toBe(true);
    d.pause(false);frames(120);
    // W was held when paused: pause reset the input, so the rider coasts (no pushes) and has landed.
    expect(d.present()!.phase).not.toBe('air');
    expect(d.events().some(e=>e.kind==='push')).toBe(false);
  });
  it('restores a route and the board after a renderer rebuild, safely paused',()=>{
    const {d,frames,key}=rig();
    d.route('coast-run');key('w',true);frames(260);
    const checkpoint=d.checkpoint()!;
    const again=createSkateDriver({obstacles:courtObstacles('full')});
    again.restore(checkpoint);
    expect(again.paused()).toBe(true);expect(again.present()!.x).toBe(d.present()!.x);expect(again.run()).toEqual(d.run());
    const elapsed=again.run()!.elapsed;again.step(1);expect(again.run()!.elapsed).toBe(elapsed);
    again.pause(false);again.step(.1);expect(again.run()!.elapsed).toBeGreaterThan(elapsed);
    expect(again.takeCut()).toBe(true);expect(again.takeCut()).toBe(false);
  });
  it('respawn returns to the marker, drops the open line and cuts the camera',()=>{
    const {d,frames,key}=rig();d.takeCut();
    const marker={...d.present()!};
    key('w',true);frames(90);key('w',false);
    d.command('respawn');
    expect(Math.hypot(d.present()!.x-marker.x,d.present()!.z-marker.z)).toBeLessThan(.01);
    expect(d.takeCut()).toBe(true);
  });
  it('stance flows from settings to the sim, the input and the scorer',()=>{
    const {d,frames}=rig();
    d.settings({stance:'goofy'});frames(2);
    expect(d.present()!.stance).toBe('goofy');expect(d.current()!.stance).toBe('goofy');
    expect(d.progress()!.settings.stance).toBe('goofy');
    d.settings({controls:'easy'});expect(d.input()!.mode()).toBe('easy');
  });
  it('builds a HUD model with the real hints and the seven spots',()=>{
    const {d,frames}=rig();frames(2);
    const m=d.hud()!;
    expect(m.spotTotal).toBe(7);
    expect(m.hints.map(h=>h.id)).toContain('manual');
    expect(skateGesturePath('kickflip','regular')).toMatch(/^M/);
    expect(SKATE_TRICK_BOOK.grinds!.length).toBe(15);
  });
  it('uses one park field for the ride and for the walk',()=>{
    expect(skateField()).toBe(skateField());
    const at=SKATE_SPOTS[0]!.start;
    expect(skateSurface(at[0],at[1],groundHeightAt).y).toBeCloseTo(skateField().sample(at[0],at[1]).y,9);
  });
});

describe('skate v2 · what a partner sees on the wire',()=>{
  const p=(o:Partial<SkatePresent>):SkatePresent=>({...blankPresent(),...o});
  it('maps the present to a bounded, coarse skate act',()=>{
    expect(skateAct(null)).toBeNull();
    expect(skateAct(p({phase:'roll'}))).toEqual({act:'skate',p:0});
    expect(skateAct(p({phase:'push',pushPhase:.4}))).toEqual({act:'skate',p:.4});
    expect(skateAct(p({phase:'air',trick:{flipId:'kickflip',u:.5}}))).toEqual({act:'skate-kickflip',p:.5});
    expect(skateAct(p({phase:'air',trick:{flipId:'varial-heelflip',u:.2}}))!.act).toBe('skate-heelflip');
    expect(skateAct(p({phase:'air',trick:{flipId:'360-flip',u:.2}}))!.act).toBe('skate-360-flip');
    expect(skateAct(p({phase:'air',trick:{flipId:'pop-shove-it',u:.2}}))!.act).toBe('skate-shuvit');
    expect(skateAct(p({phase:'air',trick:{flipId:'impossible',u:.2}}))!.act).toBe('skate-ollie');
    expect(skateAct(p({phase:'air',grab:{grabId:'indy',weight:1},airTime:.45}))).toEqual({act:'skate-grab',p:.5});
    expect(skateAct(p({phase:'grind',balance:1}))).toEqual({act:'skate-grind',p:1});
    expect(skateAct(p({phase:'manual',manual:'manual',balance:-1}))).toEqual({act:'skate-manual',p:0});
    expect(skateAct(p({phase:'bail',bail:{t:2,reason:'wall',dirX:0,dirZ:1}}))).toEqual({act:'skate-bail',p:1});
  });
});

describe('island topology and recreational progress',()=>{
  it('keeps all spot starts, rails and checkpoints on the island and out of walls',()=>{
    for(const p of [...SKATE_SPOTS.map(s=>s.start),...SKATE_ROUTES.flatMap(r=>[...r.points]),...SKATE_RAILS.flatMap(r=>[r.a,r.b])]){expect(Math.hypot(...p)).toBeLessThan(73.2);expect(isClear(p[0],p[1],.26,ISLAND_BUILDINGS),JSON.stringify(p)).toBe(true);}
  });
  it('plants no trees inside the skate pads in either render tier',()=>{
    for(const tier of ['full','lite'] as const)for(const tree of plantPlan(tier).trees)for(const s of SKATE_SPOTS)expect(Math.abs(tree.x-s.x)>s.halfWidth||Math.abs(tree.z-s.z)>s.halfDepth).toBe(true);
  });
  it('preserves collision-free practice starts',()=>{for(const s of SKATE_SPOTS)expect(isClear(s.start[0],s.start[1],.24,courtObstacles('full')),s.id).toBe(true);});
  it('keeps every timed route segment clear in full and lite planting',()=>{
    const blocked:string[]=[];
    for(const tier of ['full','lite'] as const)for(const route of SKATE_ROUTES)for(let n=1;n<route.points.length;n++){
      const a=route.points[n-1]!,b=route.points[n]!;if(!pathSegmentClear({x:a[0],z:a[1]},{x:b[0],z:b[1]},{obstacles:courtObstacles(tier)}))blocked.push(`${tier}:${route.id}:${n} ${a} -> ${b}`);
    }
    expect(blocked).toEqual([]);
  });
  it('discovers only spots visited and earns the explorer milestone after all seven',()=>{
    const session=createSkateSession(),at=(x:number,z:number)=>({...blankPresent(),x,z});
    observeSkate(session,at(0,0),[],null,.016);expect(session.progress.discovered).toEqual([]);
    for(const spot of SKATE_SPOTS)observeSkate(session,at(spot.x,spot.z),[],null,.016);
    expect(session.progress.discovered).toHaveLength(7);expect(session.progress.stamps).toContain('explorer');
  });
  it('requires sequential physical checkpoints, respects the countdown and records a finish',()=>{
    const session=createSkateSession(),r=SKATE_ROUTES[1]!,at=(p:readonly [number,number])=>({...blankPresent(),x:p[0],z:p[1]});startSkateRoute(session,r.id);
    for(let i=0;i<50;i++)observeSkate(session,at(r.points.at(-1)!),[],null,.1);expect(session.run!.checkpoint).toBe(1);expect(session.progress.routeBest[r.id]).toBeUndefined();
    for(const p of r.points.slice(1))observeSkate(session,at(p),[],null,.1);expect(session.run!.finished).toBe(true);expect(session.progress.routeBest[r.id]).toBeGreaterThan(0);
  });
  it('bounds corrupt saves and keys each person, household and environment separately',()=>{
    expect(decodeSkateProgress('{broken')).toEqual(freshSkateProgress());const p=decodeSkateProgress(JSON.stringify({version:1,deck:'islander',bestLine:Infinity,discovered:['alien','tideline','tideline'],routeBest:{'first-line':-3},stamps:['secret']}));expect(p.deck).toBe('tideline');expect(p.discovered).toEqual(['tideline']);expect(p.routeBest).toEqual({});expect(p.stamps).toEqual([]);
    const a=skateProgressKey('development','hh:a','member');expect(a).not.toBe(skateProgressKey('production','hh:a','member'));expect(a).not.toBe(skateProgressKey('development','hh','a:member'));
  });
  it('continues with unavailable device storage',()=>{const store={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};expect(readSkateProgress(store,'key')).toEqual(freshSkateProgress());expect(saveSkateProgress(store,'key',freshSkateProgress())).toBe(false);});
});
