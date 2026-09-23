/**
 * Skate v2 · integration seam: SIM × PARK on the REAL Tideline field.
 * Lips (vert quarterpipe, bowl, kicker, mini-ramp pumping), island solids and
 * the shoreline merged into the sim the way the driver builds it.
 */
import {describe,expect,it} from 'vitest';
import {SKATE_NO_INTENT,type SkateIntent,type SkatePresent,type SkateSimEvent} from '../src/harbour/skate/contract.ts';
import {createSkateSim} from '../src/harbour/skate/sim/index.ts';
import {resolveGrind,skateCatalogs} from '../src/harbour/skate/tricks/catalog.ts';
import {skateFieldFor} from '../src/harbour/skate/park.ts';
import {parkPoint} from '../src/harbour/skate/world/layout.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {skateSimOptions} from '../src/harbour/skate/driver.ts';
import {courtObstacles,ISLAND_BUILDINGS,SHORE_RADIUS} from '../src/harbour/body/obstacles.ts';

const field=skateFieldFor(groundHeightAt);
const catalogs={...skateCatalogs(),resolveGrind};
const o=parkPoint('tideline',0,0),ex=parkPoint('tideline',1,0);
/** World yaw of the park's local +x. */
const PLUS_X=Math.atan2(ex[0]-o[0],ex[1]-o[1]);

function rider(lx:number,lz:number,yaw:number,speed:number){
  const [x,z]=parkPoint('tideline',lx,lz);
  const sim=createSkateSim(field,catalogs,{x,z,yaw,stance:'regular',...skateSimOptions(courtObstacles('full'))});
  const s=sim.save() as Record<string,unknown>;s.vx=Math.sin(yaw)*speed;s.vz=Math.cos(yaw)*speed;sim.load(s);
  return sim;
}
function run(sim:ReturnType<typeof rider>,seconds:number,drive:(p:SkatePresent)=>Partial<SkateIntent>=()=>({})){
  const events:SkateSimEvent[]=[],frames:SkatePresent[]=[];
  for(let i=0;i<seconds*60;i++){const r=sim.step({...SKATE_NO_INTENT,...drive(sim.present())},1/60);events.push(...r.events);frames.push({...r.present});}
  return {events,frames};
}

describe('skate v2 integration · lips on the real Tideline park',()=>{
  it('airs the Chimney (vert) above the coping and comes back down INTO the transition, clean, fakie',()=>{
    const coping=field.grindables.find(g=>g.id==='tideline-chimney-coping')!.points[0]![1];
    const {events,frames}=run(rider(4,-6.7,PLUS_X,9.5),3);
    const top=Math.max(...frames.map(f=>f.y));
    expect(top-coping).toBeGreaterThan(.8);
    expect(events.some(e=>e.kind==='grind-start')).toBe(false); // not sucked onto its own coping
    const land=events.find(e=>e.kind==='land') as Extract<SkateSimEvent,{kind:'land'}>;
    expect(land).toBeDefined();
    expect(land.onFeature).toBe('tideline-chimney');
    expect(land.boardClean).toBeGreaterThan(.75);
    expect(land.fakie).toBe(true);
    expect(events.some(e=>e.kind==='bail')).toBe(false);
  });
  it('launches forward off the Hatch kicker and lands on the landing block',()=>{
    const {events,frames}=run(rider(9,2.5,PLUS_X+Math.PI,8),2);
    const pop=frames.findIndex(f=>f.phase==='air');
    expect(pop).toBeGreaterThan(0);
    const land=events.find(e=>e.kind==='land') as Extract<SkateSimEvent,{kind:'land'}>;
    // Over the planter onto the landing block, or all the way to the down-bank (NOTES-park: 2.55 / ~4 at 8 u/s).
    expect(['tideline-hatch-landing','tideline-hatch-bank']).toContain(land.onFeature);
    expect(land.gap).toBeGreaterThan(2);
    expect(land.fakie).toBe(false);
    expect(land.boardClean).toBe(1);
  });
  it('drops into the Kettle bowl from its deck and rides it without a bail',()=>{
    const {events,frames}=run(rider(-13.4,-5.8,PLUS_X,2.5),5);
    expect(events.some(e=>e.kind==='bail')).toBe(false);
    expect(Math.min(...frames.map(f=>f.y))).toBeLessThan(1.15); // down on the floor
    expect(frames.filter(f=>f.surface==='concrete').length).toBeGreaterThan(100);
  });
  it('pumps the Breadbin mini-ramp: extending in the transitions climbs higher wall by wall, into airs',()=>{
    const coping=1.649,peaks:number[]=[];let rising=false;
    const sim=rider(-9,6.4,PLUS_X,3.5);
    run(sim,12,p=>{const flat=p.y<.83&&Math.abs(p.vy)<.3;return {crouch:flat?1:0,crouchEnd:flat?'tail':null};}).frames.forEach(f=>{
      if(f.vy>.05)rising=true;if(rising&&f.vy<=0){rising=false;peaks.push(f.y-coping);}
    });
    expect(peaks.length).toBeGreaterThanOrEqual(6);
    expect(peaks[3]!).toBeGreaterThan(peaks[0]!+.15);
    expect(Math.max(...peaks)).toBeGreaterThan(.1); // above the coping
  });
  it('holds a line at a wall peak: a stall never swings the board across the transition',()=>{
    const {frames}=run(rider(-9,6.4,PLUS_X,3.5),2);
    const slow=frames.filter(f=>f.speed<.3&&f.y>1);
    expect(slow.length).toBeGreaterThan(0);
    for(const f of slow){const d=Math.atan2(Math.sin(f.boardYaw-PLUS_X),Math.cos(f.boardYaw-PLUS_X));expect(Math.min(Math.abs(d),Math.PI-Math.abs(d))).toBeLessThan(.35);}
  });
});

describe('skate v2 integration · island solids and shoreline',()=>{
  it('merges the island obstacles (buildings) into the sim',()=>{
    const opts=skateSimOptions(courtObstacles('full'));
    expect(opts.islandObstacles).toEqual(courtObstacles('full'));
    expect(opts.islandObstacles!.length).toBeGreaterThan(ISLAND_BUILDINGS.length);
    const b=ISLAND_BUILDINGS.find((o):o is Extract<typeof o,{kind:'obox'}>=>o.kind==='obox')!;
    // Ride straight at the building from 6 units out.
    const ox=b.x+6,oz=b.z,yaw=Math.atan2(b.x-ox,b.z-oz);
    const sim=createSkateSim(field,catalogs,{x:ox,z:oz,yaw,stance:'regular',...opts});
    const s=sim.save() as Record<string,unknown>;s.vx=Math.sin(yaw)*6;s.vz=Math.cos(yaw)*6;sim.load(s);
    const inside=(x:number,z:number)=>{const c=Math.cos(b.yaw),s=Math.sin(b.yaw),dx=x-b.x,dz=z-b.z;return Math.abs(dx*c-dz*s)<b.halfX&&Math.abs(dx*s+dz*c)<b.halfZ;};
    let closest=Infinity;for(let i=0;i<180;i++){const p=sim.step({...SKATE_NO_INTENT},1/60).present;expect(inside(p.x,p.z)).toBe(false);closest=Math.min(closest,Math.hypot(p.x-b.x,p.z-b.z));}
    expect(closest).toBeLessThan(6); // it really rode at the wall
  });
  it('never rides into the sea',()=>{
    const r=SHORE_RADIUS-3,yaw=0;
    const sim=createSkateSim(field,catalogs,{x:0,z:r,yaw,stance:'regular',...skateSimOptions(courtObstacles('full'))});
    const s=sim.save() as Record<string,unknown>;s.vx=0;s.vz=9;sim.load(s);
    for(let i=0;i<240;i++){const p=sim.step({...SKATE_NO_INTENT,push:true},1/60).present;expect(Math.hypot(p.x,p.z)).toBeLessThanOrEqual(SHORE_RADIUS+.01);}
  });
});
