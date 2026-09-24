// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {HARBOUR_WANDERS,HARBOUR_LANDMARK_SOLIDS,HARBOUR_LANES} from '../src/harbour/village/world.ts';
import {VILLAGE_SITES} from '../src/harbour/village/layout.ts';
import {courtObstacles,SHORE_RADIUS} from '../src/harbour/body/obstacles.ts';
import {findPath,pathSegmentClear} from '../src/harbour/body/pathfinder.ts';
import {placementOf,placementToWorld} from '../src/harbour/scene/place.ts';
import {groundHeightAt,SEA_LEVEL} from '../src/harbour/scene/ground.ts';
import {harbourZoomExit,ZOOM_EXIT,ZOOM_REST} from '../src/harbour/camera/worldZoom.ts';
import {avatarPreferenceKey,readAvatar,saveAvatar} from '../src/harbour/body/avatarPreference.ts';
import {createWalker} from '../src/harbour/body/walker.ts';
import {WALK_SPEED} from '../src/harbour/body/bodyModel.ts';

const destinations=[...Object.values(VILLAGE_SITES).map(site=>{
  const p=placementOf(site.entry)!;
  const [x,,z]=placementToWorld(p,[p.door[0],0,p.halfDepth+1.1]);return {id:site.entry,x,z};
}),{id:'campfire',x:0,z:65.5},...HARBOUR_WANDERS.map(w=>({id:w.id,x:w.at[0],z:w.at[1]}))];

describe('a roomy, connected island',()=>{
  it('keeps each visible path clear of walls, trees and landmark posts',()=>{
    const world={obstacles:courtObstacles('full'),shore:SHORE_RADIUS};
    for(const lane of HARBOUR_LANES)for(let i=1;i<lane.points.length;i++){
      const [x,z]=lane.points[i-1]!,[nx,nz]=lane.points[i]!;
      if(Math.hypot(x,z)<4)continue; // The fountain owns the middle of the square.
      expect(pathSegmentClear({x,z},{x:nx,z:nz},world),`${lane.id}, segment ${i}`).toBe(true);
    }
  });
  for(const tier of ['full','lite'] as const)it(`connects every destination pair without crossing a solid (${tier})`,()=>{
    const world={obstacles:courtObstacles(tier),shore:SHORE_RADIUS};
    for(const from of destinations)for(const to of destinations){
      if(from===to)continue;
      const path=findPath(from,to,world);expect(path,`${from.id} to ${to.id}`).not.toBeNull();
      let previous=from;
      for(const point of path!){expect(pathSegmentClear(previous,point,world),`${from.id} to ${to.id}`).toBe(true);previous={...point,id:'via'};}
    }
  },15000);
  it('keeps major buildings within a comfortable stroll of the square and wilderness beyond them',()=>{
    for(const site of Object.values(VILLAGE_SITES)){
      expect(Math.hypot(...site.spot)/WALK_SPEED).toBeGreaterThan(12);
      expect(Math.hypot(...site.spot)/WALK_SPEED).toBeLessThan(30);
    }
    expect(SHORE_RADIUS).toBeGreaterThan(70);
    for(let angle=0;angle<Math.PI*2;angle+=.1)expect(groundHeightAt(Math.cos(angle)*SHORE_RADIUS,Math.sin(angle)*SHORE_RADIUS)).toBeGreaterThan(SEA_LEVEL);
    for(const obstacle of HARBOUR_LANDMARK_SOLIDS)expect(courtObstacles('lite')).toContainEqual(obstacle);
  });
  it('walks around obstacles all the way to a distant door and lets manual input cancel the route',()=>{
    const target=destinations.find(d=>d.id==='boathouse')!;
    const walker=createWalker({groundHeightAt,tier:'lite',trail:false,start:{x:1,z:5}});
    expect(walker.goTo(target.x,target.z)).toBe(true);
    for(let frame=0;frame<2400;frame++)walker.step(1/60,frame/60,0);
    expect(Math.hypot(walker.state().x-target.x,walker.state().z-target.z)).toBeLessThan(.5);
    walker.goTo(1,5);walker.setInput({forward:1,strafe:0});walker.step(1/60,41,0);
    expect(walker.state().goal).toBeNull();walker.dispose();
  });
});

describe('world scale doorway',()=>{
  it('requires extra outward intent at the far limit and resets when zooming in',()=>{
    // Hearth Mountain v2 (C5): only pulls made *at* the Look camera's far limit count; the first arms the
    // "pull once more" affordance, and only a later, separate pull opens the Journey.
    const limit=ZOOM_EXIT.limit;
    expect(harbourZoomExit(limit*.8,.5,ZOOM_REST,0)).toEqual(ZOOM_REST);
    const armed=harbourZoomExit(limit,.2,ZOOM_REST,0);expect(armed.exit).toBe(false);expect(armed.armedAt).toBe(0);
    expect(harbourZoomExit(limit,.5,armed,100).exit).toBe(false);
    expect(harbourZoomExit(limit,.2,armed,ZOOM_EXIT.wait+10).exit).toBe(true);
    expect(harbourZoomExit(limit,-.1,armed,ZOOM_EXIT.wait+10)).toEqual(ZOOM_REST);
  });
  it('binds explicit avatar choices to the environment, household and member',()=>{
    const key=avatarPreferenceKey('development','house','one');localStorage.clear();
    expect(readAvatar(localStorage,key)).toBeNull();saveAvatar(localStorage,key,'bianca');
    expect(readAvatar(localStorage,key)).toBe('bianca');
    for(const other of [avatarPreferenceKey('production','house','one'),avatarPreferenceKey('development','other','one'),avatarPreferenceKey('development','house','two')])expect(readAvatar(localStorage,other)).toBeNull();
    expect(readAvatar({getItem:()=>{throw Error('denied');}},key)).toBeNull();
  });
});
