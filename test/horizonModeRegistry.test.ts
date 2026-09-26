import {describe,expect,it,vi} from 'vitest';
import {createModeRegistry} from '../src/harbour/horizon/movers/registry.ts';
import {offersAt,thresholdTransitions} from '../src/harbour/horizon/movers/shared/threshold.ts';
import {MODE_IDS,type ModeController,type ModeId} from '../src/harbour/horizon/movers/shared/mode.ts';
import type {Threshold} from '../src/harbour/horizon/world/definition.ts';

const T=(id:string,at:[number,number],modes:string[],action:string,extra:Partial<Threshold>={}):Threshold=>({id,at,modes:modes as Threshold['modes'],action,height:0,...extra});
const thresholds:Threshold[]=[
  T('crownLaunch',[1310,440],['feet→glider'],'run off',{height:160}),
  T('prowPlatform',[1610,640],['feet→zip','feet→glider'],'clip in / run off',{height:100}),
  T('strip',[435,690],['feet→plane'],'climb in'),
  T('zipLanding',[1130,1440],['zip→feet'],'unclip'),
  T('bailOut',[NaN,NaN],['plane→parachute'],'jump',{carried:'plane',minAgl:60,height:undefined}),
  T('damPortage',[1150,910],['canoe→feet→canoe'],'carry the canoe'),
];
function fake(id:ModeId,log:string[]):ModeController{
  let body={x:0,y:0,z:0,yaw:0};
  return{id,enter(t,b){log.push(`enter ${id} @${t.id}`);body={...b};},update(){},exit(){log.push(`exit ${id}`);return{at:[body.x,body.y,body.z],yaw:body.yaw};},
    bodyPose:()=>body,camera:()=>({eye:[0,0,0],look:[0,0,1],fov:55,roll:0}),sound:()=>null,reducedMotionCut:()=>({landings:[]}),hud:()=>({})};
}
const at=(x:number,y:number,z:number)=>({x,y,z,yaw:0});

describe('Horizon mode registry',()=>{
  it('names all fourteen modes, feet included',()=>{
    expect(MODE_IDS).toHaveLength(14);expect(new Set(MODE_IDS).size).toBe(14);expect(MODE_IDS).toContain('parachute');
  });
  it('maps manifest mode words and labels each sequence of a shared threshold',()=>{
    expect(thresholdTransitions(thresholds[1]!)).toEqual([{from:'feet',to:'zip',action:'Clip in'},{from:'feet',to:'glider',action:'Run off'}]);
    expect(thresholdTransitions(thresholds[5]!).map(t=>`${t.from}→${t.to}`)).toEqual(['canoe→feet','feet→canoe']);
    expect(thresholdTransitions(T('x',[0,0],['feet→boat'],'untie')).map(t=>t.action)).toEqual(['Untie (row)','Untie (canoe)','Untie (dinghy)']);
    expect(thresholdTransitions(T('x',[0,0],['feet→feet'],'pause'))).toEqual([]);
  });
  it('offers by proximity and height, nearest first, and never offers a carried row without its vehicle',()=>{
    expect(offersAt(thresholds,at(1311,160,441)).map(o=>o.to)).toEqual(['glider']);
    expect(offersAt(thresholds,at(1311,20,441))).toEqual([]);// under the pad, not on it
    expect(offersAt(thresholds,at(1320,160,441))).toEqual([]);// out of reach
    expect(offersAt(thresholds,at(0,0,0)).some(o=>o.thresholdId==='bailOut')).toBe(false);
  });
  it('keeps exactly one active mode and changes it only by accepting a valid offer',()=>{
    const log:string[]=[],registry=createModeRegistry(thresholds);registry.register('glider',()=>fake('glider',log));registry.register('zip',()=>fake('zip',log));
    expect(registry.active()).toBe('feet');expect(registry.controller()).toBeNull();
    // Unregistered modes are not offered; registered ones are, from feet only.
    expect(registry.offers(at(435,0,690))).toEqual([]);
    const offers=registry.offers(at(1610,100,640));expect(offers.map(o=>o.action)).toEqual(['Clip in','Run off']);
    // A forged or stale offer is refused: wrong place, or not from the active mode.
    expect(registry.accept(offers[1]!,at(0,0,0))).toBeNull();
    expect(registry.accept({...offers[1]!,thresholdId:'crownLaunch'},at(1610,100,640))).toBeNull();
    const taken=registry.accept(offers[1]!,at(1610,100,640))!;
    expect(taken.controller?.id).toBe('glider');expect(registry.active()).toBe('glider');expect(log).toEqual(['enter glider @prowPlatform']);
    // While gliding, a feet offer at another launch is not available: one mode at a time.
    expect(registry.offers(at(1310,160,440))).toEqual([]);
    expect(registry.accept({thresholdId:'crownLaunch',from:'feet',to:'glider',action:'Run off',at:[1310,440],height:160},at(1310,160,440))).toBeNull();
    expect(registry.active()).toBe('glider');
    // The mode ends itself only back to feet.
    expect(registry.finish()).toEqual({at:[1610,100,640],yaw:0});expect(registry.active()).toBe('feet');expect(registry.finish()).toBeNull();
  });
  it('hands plane → parachute across the carried bailOut threshold only while the plane supplies it',()=>{
    const log:string[]=[],registry=createModeRegistry(thresholds);
    registry.register('plane',()=>fake('plane',log));registry.register('parachute',()=>fake('parachute',log));
    registry.accept(registry.offers(at(435,0,690))[0]!,at(435,0,690));expect(registry.active()).toBe('plane');
    let door:{at:[number,number];height:number}|null=null;const stop=registry.carried('bailOut',()=>door);
    expect(registry.offers(at(900,200,900))).toEqual([]);// "Too low to jump": the plane offers nothing
    door={at:[900,900],height:200};
    const [jump]=registry.offers(at(900,200,900));expect(jump).toMatchObject({thresholdId:'bailOut',from:'plane',to:'parachute',action:'Jump',at:[900,900],height:200});
    const taken=registry.accept(jump!,at(900,200,900))!;
    expect(taken.threshold).toMatchObject({id:'bailOut',carried:'plane',at:[900,900],height:200});
    expect(registry.active()).toBe('parachute');expect(log).toEqual(['enter plane @strip','exit plane','enter parachute @bailOut']);
    // Stale carried offer (door moved on / provider gone) is refused.
    registry.finish();stop();expect(registry.accept(jump!,at(900,200,900))).toBeNull();
  });
  it('returns to feet at an X→feet threshold with the exit point',()=>{
    const log:string[]=[],registry=createModeRegistry(thresholds);registry.register('zip',()=>fake('zip',log));
    registry.accept(registry.offers(at(1610,100,640)).find(o=>o.to==='zip')!,at(1610,100,640));
    const land=registry.offers(at(1130,0,1440));expect(land.map(o=>`${o.from}→${o.to}`)).toEqual(['zip→feet']);
    expect(registry.accept(land[0]!,at(1130,0,1440))).toMatchObject({controller:null,exit:{at:[1610,100,640]}});expect(registry.active()).toBe('feet');
  });
  it('holds a flagged mode back from offers and accepts until re-enabled',()=>{
    const factory=vi.fn(()=>fake('glider',[])),registry=createModeRegistry(thresholds);registry.register('glider',factory);
    registry.flag('glider',false);expect(registry.enabled('glider')).toBe(false);
    expect(registry.offers(at(1310,160,440))).toEqual([]);
    expect(registry.accept({thresholdId:'crownLaunch',from:'feet',to:'glider',action:'Run off',at:[1310,440],height:160},at(1310,160,440))).toBeNull();expect(factory).not.toHaveBeenCalled();
    registry.flag('feet',false);expect(registry.enabled('feet')).toBe(true);
    registry.flag('glider',true);expect(registry.offers(at(1310,160,440))).toHaveLength(1);
  });
});
