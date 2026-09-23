/**
 * Skate v2 · integration seam: SIM grind selection × TRICKS catalog on the
 * REAL Tideline field. Every one of the 15 catalog grinds/slides must be
 * reachable from the approach it is meant to come from (angle, lean, how far
 * over the line), on a real round rail and on a real ledge, and grind-start
 * must say whether it was frontside.
 */
import {describe,expect,it} from 'vitest';
import {SKATE_NO_INTENT,type SkateSimEvent} from '../src/harbour/skate/contract.ts';
import {createSkateSim} from '../src/harbour/skate/sim/index.ts';
import {resolveGrind,SKATE_GRINDS,skateCatalogs} from '../src/harbour/skate/tricks/catalog.ts';
import {createSkateScore} from '../src/harbour/skate/tricks/score.ts';
import {skateFieldFor} from '../src/harbour/skate/park.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';

const field=skateFieldFor(groundHeightAt);
const catalogs={...skateCatalogs(),resolveGrind};
const H=Math.PI/2;

/** A grindable's midpoint, its travel direction (from point 0 to 1) and right-of-travel vector. */
function lineOf(id:string){
  const g=field.grindables.find(g=>g.id===id)!;
  const [a,b]=[g.points[0]!,g.points[1]!];
  const len=Math.hypot(b[0]-a[0],b[2]-a[2]),tx=(b[0]-a[0])/len,tz=(b[2]-a[2])/len;
  const m=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2] as const;
  return {g,m,tx,tz,rx:-tz,rz:tx,psi:Math.atan2(tx,tz)};
}

type Approach={deckYaw:number;lean:number;over?:boolean;side?:1|-1;stance?:'regular'|'goofy'};
/**
 * Put a rider in the air beside the line, moving along it, board turned `deckYaw`
 * (+ = front-foot end toward the far side), coming from `side` (+1 = the right of
 * travel), and let the sim lock on. Returns the grind-start event.
 */
function lock(id:string,a:Approach){
  const L=lineOf(id),side=a.side??1;
  const sim=createSkateSim(field,catalogs,{x:L.m[0]-L.tx*2,z:L.m[2]-L.tz*2,yaw:L.psi,stance:a.stance??'regular'});
  const s=sim.save() as Record<string,unknown>;
  // Far side, in world xz: away from where we came from.
  const farX=-side*L.rx,farZ=-side*L.rz;
  const fx=Math.cos(a.deckYaw)*L.tx+Math.sin(a.deckYaw)*farX,fz=Math.cos(a.deckYaw)*L.tz+Math.sin(a.deckYaw)*farZ;
  const lat=a.over?-.12:.14; // + = on the approach side
  Object.assign(s,{
    mode:'air',x:L.m[0]+side*L.rx*lat,z:L.m[2]+side*L.rz*lat,y:L.m[1]+.05,vx:L.tx*4,vy:-.4,vz:L.tz*4,
    boardYaw:Math.atan2(fx,fz),boardPitch:0,boardRoll:0,lead:1,feetSwapped:false,lean:a.lean,
    toX:L.m[0]+side*L.rx*.8-L.tx*2,toZ:L.m[2]+side*L.rz*.8-L.tz*2,toY:L.m[1]-.3,airTime:.3,airFromPop:true,trick:null,grab:null,spinRate:0,
  });
  sim.load(s);
  const events:SkateSimEvent[]=[];
  for(let i=0;i<4&&!events.some(e=>e.kind==='grind-start');i++)events.push(...sim.step({...SKATE_NO_INTENT,lean:a.lean},1/120).events);
  return events.find(e=>e.kind==='grind-start') as Extract<SkateSimEvent,{kind:'grind-start'}>|undefined;
}

const INTENDED:Record<string,Approach>={
  '50-50':{deckYaw:0,lean:0},'5-0':{deckYaw:0,lean:-1},nosegrind:{deckYaw:0,lean:1},
  crooked:{deckYaw:-.5,lean:1},overcrook:{deckYaw:.5,lean:1},
  smith:{deckYaw:-.5,lean:0},feeble:{deckYaw:.5,lean:0},suski:{deckYaw:-.5,lean:-1},salad:{deckYaw:.5,lean:-1},
  boardslide:{deckYaw:H,lean:0},lipslide:{deckYaw:-H,lean:0},
  noseslide:{deckYaw:H,lean:1},noseblunt:{deckYaw:H,lean:1,over:true},
  tailslide:{deckYaw:H,lean:-1},bluntslide:{deckYaw:H,lean:-1,over:true},
};

describe('skate v2 integration · grinds on the real park',()=>{
  it('covers every catalog grind with an intended approach',()=>{
    expect(Object.keys(INTENDED).sort()).toEqual([...SKATE_GRINDS.keys()].sort());
  });
  for(const id of ['tideline-rolling-pin','tideline-cake-stand--z']){
    it(`reaches all 15 grinds and slides on ${id}`,()=>{
      const got:Record<string,string|undefined>={};
      for(const [want,a] of Object.entries(INTENDED)){const e=lock(id,a);got[want]=e?.grindId;expect(e?.grindableId).toBe(id);}
      expect(got).toEqual(Object.fromEntries(Object.keys(INTENDED).map(k=>[k,k])));
    });
  }
  it('names frontside from the chest facing the grindable, mirrored for goofy',()=>{
    // Regular rolling forward faces the right of travel: coming from the LEFT puts the rail on the right → frontside.
    expect(lock('tideline-rolling-pin',{deckYaw:0,lean:0,side:-1})?.frontside).toBe(true);
    expect(lock('tideline-rolling-pin',{deckYaw:0,lean:0,side:1})?.frontside).toBe(false);
    expect(lock('tideline-rolling-pin',{deckYaw:0,lean:0,side:-1,stance:'goofy'})?.frontside).toBe(false);
    expect(lock('tideline-rolling-pin',{deckYaw:0,lean:0,side:1,stance:'goofy'})?.frontside).toBe(true);
  });
  it('scores the side word the sim reports',()=>{
    const score=createSkateScore({stance:'regular'});
    const start=lock('tideline-cake-stand--z',{deckYaw:-.5,lean:0,side:1})!;
    expect(start.grindId).toBe('smith');
    score.step([start],start.t);
    score.step([{t:start.t+1,kind:'grind-end',grindId:'smith',grindableId:start.grindableId,distance:3,seconds:1,exit:'roll'}],start.t+1);
    expect(score.line().latest).toMatch(start.frontside?/^Frontside Smith/:/^Backside Smith/);
  });
});
