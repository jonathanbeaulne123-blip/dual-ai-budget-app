// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {decodeWorldPresence,WORLD_BOUND,WorldPresenceError} from '../src/ledgerSync/worldPresenceWire.ts';
import {createWorldTrack,WORLD_LIVE_MS,WORLD_FADE_MS,WORLD_RECKON_MS,WORLD_RENDER_DELAY_MS} from '../src/ledgerSync/worldMotion.ts';
import {SHORE_RADIUS} from '../src/harbour/body/obstacles.ts';
import {SCENE_DRESSING,type PlaceReading} from '../src/harbour/scene/place.ts';
import '../src/harbour/body/characterWalker.ts';
import {createVillagePartner} from '../src/harbour/presence/villagePartner.ts';
import {placeGround} from '../src/harbour/body/places.ts';

const step=(over:Record<string,unknown>={})=>({type:'world-step',version:1,x:1,z:2,yaw:0,moving:true,...over});

describe('bounded skate presence',()=>{
  it('uses the playable shore radius and clamps corners as a complete point',()=>{
    expect(WORLD_BOUND).toBe(SHORE_RADIUS);
    for(const [x,z] of [[84,84],[5000,-5000],[0,900]]){
      const message=decodeWorldPresence(step({x,z}));expect(message.type).toBe('world-step');
      if(message.type==='world-step')expect(Math.hypot(message.x,message.z)).toBeLessThanOrEqual(SHORE_RADIUS);
    }
  });
  it('admits bounded altitude only for an explicitly known skate act',()=>{
    expect(decodeWorldPresence(step({act:'skate-kickflip',p:.3,y:100}))).toMatchObject({act:'skate-kickflip',y:16});
    expect(decodeWorldPresence(step({act:'skate',y:-30}))).toMatchObject({y:-8});
    expect(decodeWorldPresence(step({act:'jump',y:3}))).not.toHaveProperty('y');
    expect(decodeWorldPresence(step({y:3}))).not.toHaveProperty('y');
    expect(()=>decodeWorldPresence(step({act:'skate-bank-transfer',y:3}))).toThrow(WorldPresenceError);
    expect(()=>decodeWorldPresence(step({act:'skate',y:Infinity}))).toThrow(WorldPresenceError);
  });
  it('smooths a shared aerial trick, clears altitude on walking and on stale data',()=>{
    const track=createWorldTrack();
    track.push({x:0,z:0,y:1,yaw:0,moving:true,act:'skate-ollie',p:.2,at:1000});
    track.push({x:0,z:1,y:3,yaw:0,moving:true,act:'skate-ollie',p:.6,at:1100});
    expect(track.pose(1050+WORLD_RENDER_DELAY_MS)).toMatchObject({y:2,p:.4,act:'skate-ollie'});
    expect(track.pose(1200+WORLD_RENDER_DELAY_MS)).toMatchObject({y:3});
    expect(track.pose(1100+WORLD_LIVE_MS+1)).not.toHaveProperty('y');
    track.push({x:0,z:2,yaw:0,moving:true,at:1200});
    expect(track.pose(1180+WORLD_RENDER_DELAY_MS)).toMatchObject({act:null});
    expect(track.pose(1180+WORLD_RENDER_DELAY_MS)).not.toHaveProperty('y');
  });
  it('never extrapolates a speeding rider beyond the shoreline',()=>{
    const track=createWorldTrack();
    track.push({x:72,z:0,y:2,yaw:0,moving:true,act:'skate',at:1000});
    track.push({x:73.2,z:0,y:2,yaw:0,moving:true,act:'skate',at:1100});
    const pose=track.pose(1100+WORLD_RENDER_DELAY_MS+WORLD_RECKON_MS)!;
    expect(Math.hypot(pose.x,pose.z)).toBeLessThanOrEqual(SHORE_RADIUS);expect(pose.y).toBe(2);
  });
});

describe('the real village partner',()=>{
  beforeEach(()=>{vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);});
  afterEach(()=>vi.restoreAllMocks());
  it('shows a real board at the received height, then walks and disappears on stale feed',()=>{
    const track=createWorldTrack();
    const reading={partner:{fresh:true,name:'Test partner',walk:track}} as unknown as PlaceReading;
    const partner=createVillagePartner(SCENE_DRESSING.classic,reading);
    expect(partner.group.visible).toBe(false);
    track.push({x:15,z:-8,y:3,yaw:1,moving:true,act:'skate-kickflip',p:.5,at:1000});
    partner.animate(1,1/60,1000+WORLD_RENDER_DELAY_MS);
    expect(partner.group.visible).toBe(true);expect(partner.group.position.y).toBeCloseTo(3,5);
    expect(partner.group.getObjectByName('Harbour skateboard')!.visible).toBe(true);expect(partner.group.getObjectByName('skater-look')!.visible).toBe(true);
    track.push({x:15,z:-8,yaw:1,moving:false,at:1200});partner.animate(1.2,1/60,1200+WORLD_RENDER_DELAY_MS);
    expect(partner.group.getObjectByName('skater-look')!.visible).toBe(false); // the v2 look is put away
    expect(partner.group.position.y).toBeCloseTo(placeGround('court')(15,-8),5);
    partner.animate(5,1/60,1200+WORLD_LIVE_MS+WORLD_FADE_MS+1);expect(partner.group.visible).toBe(false);
    partner.update(null);expect(partner.animate(6,1/60,6000)).toBe(false);partner.dispose();
  });
});
