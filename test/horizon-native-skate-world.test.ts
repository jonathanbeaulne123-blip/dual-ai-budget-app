import {describe,expect,it} from 'vitest';
import {createHorizonSkateWorld,type HorizonSkateGeography} from '../src/harbour/horizon/skate/world.ts';
import type {SkateWorldField} from '../src/harbour/skate/world/field.ts';
import {createSkateSim} from '../src/harbour/skate/sim/index.ts';
import {SKATE_NO_INTENT,type SurfaceSample,type SkateField} from '../src/harbour/skate/contract.ts';
import {MOUNTAIN_V2_OFFSET as O} from '../src/harbour/horizon/regions/mountainV2/placement.ts';

const flat=(y=0):SurfaceSample=>({y,nx:0,ny:1,nz:0,kind:'concrete',feature:null,lip:null});
const catalog={flips:new Map(),grabs:new Map(),grinds:new Map()};
function park(authored:SurfaceSample|null=null):SkateWorldField {
  // A deliberately different native base proves it is never treated as a visible host surface.
  return {tier:'full',ground:()=>999,pads:[],grindables:[],solids:[],spots:[],trickZoneAt:()=>false,
    sample:()=>flat(999),samplePark:()=>authored,sampleInto:(_x,_z,out)=>Object.assign(out,flat(999)),heightAt:()=>999};
}
function geography():HorizonSkateGeography {
  return {surface:()=>({id:'visible-road',y:70,nx:0,ny:1,nz:0,material:'paved',slope:0}),
    ground:()=>10,ceiling:()=>80,contact:()=>null,submerged:()=>false,blocked:()=>false};
}

describe('native skate on the embedding Horizon geography',()=>{
  it('uses visible host support and translated ceiling, never native terrain',()=>{
    const g=geography();let queried:unknown;
    g.surface=(x,z,y)=>{queried=[x,z,y];return {id:'visible-road',y:70,nx:0,ny:1,nz:0,material:'paved',slope:0};};
    const world=createHorizonSkateWorld(g,park()),sample=world.field.sample(100,40,16);
    expect(queried).toEqual([100+O.x,40+O.z,70]);
    expect(sample.y).toBe(16);expect(sample.kind).toBe('path');expect(sample.feature).toBe('visible-road');
    expect(world.field.ceilingAt!(100,40,16)).toBe(26);
    expect(world.physics.shore).toBeNull();
  });
  it('preserves the authored park height, normal and lip exactly',()=>{
    const authored={...flat(20),feature:'quarter',nx:0,ny:.6,nz:.8,lip:{lipYaw:1,vert:true}};
    const sample=createHorizonSkateWorld(geography(),park(authored)).field.sample(0,0,20);
    expect(sample).toEqual(authored);
  });
  it('does not pull a rider underneath a park deck up through it',()=>{
    const sample=createHorizonSkateWorld(geography(),park(flat(20))).field.sample(0,0,16);
    expect(sample.feature).toBe('visible-road');expect(sample.y).toBe(16);
  });
  it('uses occupancy checks for recovery and leaves overhead ducking to the native sim',()=>{
    const g=geography();let query:unknown[]=[];
    g.contact=(...args)=>{query=args;return {id:'wall',nx:-1,nz:0};};
    const w=createHorizonSkateWorld(g,park());
    expect(w.physics.contact!(0,0,16,.3,[0,0])?.id).toBe('wall');
    expect(query[4]).toBeUndefined();expect(query[6]).toBe(1.08);
  });
  it('marks missing support instead of substituting either native or hidden ground',()=>{
    const g=geography();g.surface=()=>null;
    const world=createHorizonSkateWorld(g,park());
    expect(world.field.sample(0,0,16).supported).toBe(false);
    expect(world.canStart(O.x,O.z,70)).toBe(false);
  });
  it('rejects wet starts and preserves dry support above water',()=>{
    const g=geography();g.submerged=(_x,_z,y)=>y<69;
    const world=createHorizonSkateWorld(g,park());
    expect(world.canStart(O.x+100,O.z+40,70)).toBe(true);
    g.submerged=()=>true;expect(world.canStart(O.x+100,O.z+40,70)).toBe(false);
  });
});

describe('optional world physics keeps the native sim responsible for movement',()=>{
  const field=(sample:SkateField['sample']):SkateField=>({sample,grindables:[],solids:[],spots:[]});
  it('falls through an explicit support gap without inventing a floor',()=>{
    const sim=createSkateSim(field((_x,_z,y)=>({...flat(y??0),supported:false})),catalog,{x:0,z:0,y:2,yaw:0,stance:'regular'});
    for(let i=0;i<30;i++)sim.step(SKATE_NO_INTENT,1/60);
    expect(sim.present().phase).toBe('air');expect(sim.present().y).toBeLessThan(1);
  });
  it.each(['throw','non-finite'])('does not fabricate support for a %s sample',reason=>{
    const sim=createSkateSim(field(()=>{if(reason==='throw')throw new Error('missing field');return flat(NaN);}),catalog,{x:0,z:0,y:2,yaw:0,stance:'regular'});
    for(let i=0;i<30;i++)sim.step(SKATE_NO_INTENT,1/60);
    expect(sim.present().phase).toBe('air');expect(sim.present().y).toBeLessThan(1);
  });
  it('tests host walls in the short sweep and stops before penetration',()=>{
    let contacted=false;
    const sim=createSkateSim(field(()=>flat()),catalog,{x:0,z:0,yaw:Math.PI/2,stance:'regular',contact:(x)=>{
      if(x<.4)return null;contacted=true;return {id:'host-wall',nx:-1,nz:0};
    }});
    for(let i=0;i<300&&!contacted;i++)sim.step({...SKATE_NO_INTENT,push:true},1/120);
    expect(contacted).toBe(true);expect(sim.present().x).toBeLessThan(.4);
  });
  it('bails in actual water and refuses a marker there',()=>{
    const sim=createSkateSim(field(()=>flat()),catalog,{x:0,z:0,yaw:0,stance:'regular',submerged:()=>true});
    expect(sim.setMarker()).toBe(false);
    expect(sim.step(SKATE_NO_INTENT,1/120).events).toContainEqual(expect.objectContaining({kind:'bail',reason:'water'}));
  });
});
