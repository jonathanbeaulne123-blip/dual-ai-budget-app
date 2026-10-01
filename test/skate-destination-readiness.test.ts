import {describe,expect,it} from 'vitest';
import {createSkateDriver} from '../src/harbour/skate/driver.ts';
import {SKATE_NO_INTENT,type SurfaceSample} from '../src/harbour/skate/contract.ts';
import {SKATE_ROUTES,SKATE_SPOTS} from '../src/harbour/skate/park.ts';
import type {SkateWorldField} from '../src/harbour/skate/world/field.ts';
const route=SKATE_ROUTES.find(r=>r.id==='mountain-descent')!;
const flat=(y:number):SurfaceSample=>({y,nx:0,ny:1,nz:0,kind:'concrete',feature:null,lip:null});
function harness(hosted=true){
  let chunks=false,region=false,requested:{x:number;z:number}|null=null,respawn=false;
  const samples:Array<[number,number]>=[];
  const sample=(x:number,z:number)=>{samples.push([x,z]);return flat(region?12:0);};
  const field:SkateWorldField={tier:'full',ground:()=>0,pads:[],grindables:[],solids:[],spots:[],trickZoneAt:()=>false,
    sample,samplePark:()=>null,sampleInto:(x,z,out)=>Object.assign(out,sample(x,z)),heightAt:(x,z)=>sample(x,z).y};
  const driver=createSkateDriver({obstacles:[],field,physics:{shore:null}},{getGamepads:()=>[],intent:()=>({...SKATE_NO_INTENT,respawn}),
    ...(hosted?{destination:{ready:(x:number,z:number)=>{requested={x,z};return chunks&&region;},clear:()=>{requested=null;}}}:{})});
  driver.mount(100,100,0,undefined,{y:0});samples.length=0;
  return {driver,samples,request:()=>requested,chunks:()=>{chunks=true;},region:()=>{region=true;},respawn:(on:boolean)=>{respawn=on;}};
}
describe('hosted native skate destination readiness',()=>{
  it('demands the remote destination and holds pose, support sampling and race clock until chunks AND region are ready',()=>{
    const h=harness(),source=h.driver.present(),time=h.driver.checkpoint()!.simTime;
    h.driver.route('mountain-descent');
    expect(h.request()).toEqual({x:route.points[0]![0],z:route.points[0]![1]});
    for(let i=0;i<10;i++)h.driver.step(.05);
    expect(h.driver.present()).toEqual(source);expect(h.driver.run()).toBeNull();expect(h.driver.checkpoint()!.simTime).toBe(time);expect(h.samples).toEqual([]);
    h.chunks();expect(h.driver.flushDestination()).toBe(false);expect(h.samples).toEqual([]);
    h.region();expect(h.driver.flushDestination()).toBe(true);
    expect(h.driver.present()!.y).toBe(12);expect(h.driver.run()!.countdown).toBeGreaterThan(0);expect(h.request()).toBeNull();
    const count=h.samples.length;h.driver.flushDestination();expect(h.samples).toHaveLength(count);
  });
  it('cancels a queued route explicitly without a later reset',()=>{
    const h=harness(),source=h.driver.present();h.driver.route('mountain-descent');h.driver.route(null);
    h.chunks();h.region();expect(h.driver.flushDestination()).toBe(true);
    expect(h.request()).toBeNull();expect(h.driver.present()).toEqual(source);expect(h.samples).toEqual([]);
  });
  it('preserves a pause requested while the destination is loading',()=>{
    const h=harness();h.driver.route('mountain-descent');h.driver.pause(true);
    h.chunks();h.region();expect(h.driver.flushDestination()).toBe(true);
    const checkpoint=h.driver.checkpoint()!,countdown=h.driver.run()!.countdown;
    expect(h.driver.paused()).toBe(true);
    for(let i=0;i<10;i++)h.driver.step(.05);
    expect(h.driver.checkpoint()!.simTime).toBe(checkpoint.simTime);
    expect(h.driver.run()!.countdown).toBe(countdown);
    h.driver.pause(false);h.driver.step(.05);
    expect(h.driver.run()!.countdown).toBeLessThan(countdown);
  });
  it('replaces a queued route with an eligible spot and releases demand on unmount',()=>{
    const h=harness(),spot=SKATE_SPOTS.find(s=>s.id==='tideline')!;
    h.driver.route('mountain-descent');h.driver.spot('tideline');
    expect(h.request()).toEqual({x:spot.start[0],z:spot.start[1]});
    h.driver.unmount();expect(h.request()).toBeNull();h.chunks();h.region();h.driver.flushDestination();expect(h.driver.active()).toBe(false);
  });
  it('gates marker returns from input before support is queried',()=>{
    const h=harness();h.respawn(true);h.driver.step(.05);
    expect(h.request()).toEqual({x:100,z:100});expect(h.samples).toEqual([]);
    h.respawn(false);h.chunks();h.region();h.driver.flushDestination();expect(h.request()).toBeNull();
  });
  it('gates a race retry without advancing its countdown',()=>{
    const h=harness();h.chunks();h.region();h.driver.route('mountain-descent');
    // Replace readiness with an independently blocked embedding world for the retry path.
    const blocked=harness();const cp=h.driver.checkpoint()!;blocked.driver.restore(cp);blocked.driver.pause(false);blocked.samples.length=0;
    const countdown=blocked.driver.run()!.countdown;blocked.driver.command('retry');blocked.driver.step(.05);
    expect(blocked.request()).toEqual({x:route.points[0]![0],z:route.points[0]![1]});expect(blocked.driver.run()!.countdown).toBe(countdown);expect(blocked.samples).toEqual([]);
  });
  it('keeps standalone route commands synchronous without a host hook',()=>{
    const h=harness(false);h.driver.route('mountain-descent');
    expect(h.driver.run()!.id).toBe('mountain-descent');expect(h.driver.pendingDestination()).toBeNull();expect(h.samples.length).toBeGreaterThan(0);
  });
});
