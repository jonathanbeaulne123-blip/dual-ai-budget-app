import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {createHorizonFrameLoop} from '../src/harbour/horizon/runtime/frameLoop.ts';
import {createBuildTask,finishBuild} from '../src/house/world/buildTask.ts';
import {buildDistrictCardSteps,buildDistrictCards} from '../src/harbour/horizon/runtime/cards.ts';
import type {WorldDefinition,District} from '../src/harbour/horizon/world/definition.ts';
import type {TerrainField,LandCuts} from '../src/harbour/horizon/land/interfaces.ts';

function clockLoop(){
 let id=0,active=true,continuous=false,changed=false;
 const frames=new Map<number,(now:number)=>void>(),timers=new Map<number,()=>void>();
 const draw=vi.fn(()=>continuous),poll=vi.fn(()=>{const value=changed;changed=false;return value;});
 const loop=createHorizonFrameLoop({active:()=>active,request:fn=>{frames.set(++id,fn);return id;},cancel:id=>{frames.delete(id);},frame:draw,poll,delay:fn=>{timers.set(++id,fn);return id;},clearDelay:id=>{timers.delete(id);}});
 const frame=(now:number)=>{const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));};
 const timer=()=>{const batch=[...timers.values()];timers.clear();batch.forEach(fn=>fn());};
 return {loop,frames,timers,draw,poll,frame,timer,setActive:(v:boolean)=>{active=v;},animate:(v:boolean)=>{continuous=v;},change:()=>{changed=true;}};
}
describe('Horizon resting frames',()=>{
 it('sleeps settled views, detects a polled presence/date change, and resets elapsed time on wake',()=>{
  const c=clockLoop();c.loop.wake();c.loop.wake();expect(c.frames.size).toBe(1);c.frame(0);
  for(let i=0;i<20;i++)c.timer();expect(c.draw).toHaveBeenCalledTimes(1);expect(c.frames.size).toBe(0);
  c.change();c.timer();expect(c.frames.size).toBe(1);c.frame(5000);expect(c.draw).toHaveBeenLastCalledWith(5000,true);
  c.animate(true);c.loop.wake();c.frame(5100);c.frame(5116);expect(c.draw).toHaveBeenLastCalledWith(5116,false);
  c.animate(false);c.frame(5133);expect(c.frames.size).toBe(0);expect(c.timers.size).toBe(1);c.loop.dispose();
 });
 it('cancels hidden/suspended/disposed work and resumes with only one frame',()=>{
  const c=clockLoop();c.loop.wake();c.loop.suspend();c.setActive(false);c.loop.wake();expect(c.frames.size).toBe(0);
  c.setActive(true);c.loop.wake();c.frame(100);c.loop.suspend();expect(c.timers.size).toBe(0);
  c.loop.wake();c.loop.dispose();c.frame(200);c.timer();c.loop.wake();expect(c.draw).toHaveBeenCalledTimes(1);expect(c.frames.size+c.timers.size).toBe(0);
 });
 it('coalesces a mutation raised during a render without retaining an idle timer',()=>{
  const c=clockLoop();c.draw.mockImplementationOnce(()=>{c.loop.wake();return false;});c.loop.wake();c.frame(0);
  expect(c.frames.size).toBe(1);expect(c.timers.size).toBe(0);c.frame(16);expect(c.draw).toHaveBeenCalledTimes(2);c.loop.dispose();
 });
 it.each(['suspend','dispose'] as const)('does not schedule more work after %s during a render',action=>{
  const c=clockLoop();c.draw.mockImplementationOnce(()=>{c.loop[action]();return true;});c.loop.wake();c.frame(0);
  expect(c.frames.size+c.timers.size).toBe(0);c.loop.dispose();
 });
});
const field:TerrainField={revision:'horizon-geo-1',width:2000,depth:1800,step:50,columns:41,rows:37,heights:new Float32Array(41*37),surfaces:new Uint8Array(41*37)};
const cuts:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
const district={id:'harbour',solidIds:['test']} as District;
const solid={id:'test',surface:'stone',role:'deck',positions:[1400,3,1100,1400,3,1110,1410,3,1100],indices:[0,1,2]};
const world={geometry:{solids:[solid]}} as unknown as WorldDefinition;
function geometry(build:ReturnType<typeof buildDistrictCards>){const out:unknown[]=[];build.group.traverse(node=>{if(node instanceof THREE.Mesh){const geometry=node.geometry as THREE.BufferGeometry;out.push({name:node.name,cast:node.castShadow,attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([key,attr])=>[key,Array.from(attr.array)])),bounds:geometry.boundingSphere?.clone()});}});return out;}
describe('cooperative district construction',()=>{
 it.each(['full','lite'] as const)('%s finishes the exact same meshes across multiple frame budgets',tier=>{
  const direct=buildDistrictCards(world,field,cuts,district,tier),task=createBuildTask(buildDistrictCardSteps(world,field,cuts,district,tier),0);
  let result=task.advance(),frames=1;expect(result).toBeUndefined();while(!result&&frames++<2000)result=task.advance();
  expect(result).toBeDefined();expect(frames).toBeGreaterThan(5);expect(geometry(result!)).toEqual(geometry(direct));direct.dispose();result!.dispose();
 });
 it.each([10,130])('cleans resources when a district is abandoned after %i steps',steps=>{
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
  const gd=vi.spyOn(THREE.BufferGeometry.prototype,'dispose').mockImplementation(function(this:THREE.BufferGeometry){geometries.push(this);});
  const md=vi.spyOn(THREE.Material.prototype,'dispose').mockImplementation(function(this:THREE.Material){materials.push(this);});
  try{
   const task=createBuildTask(buildDistrictCardSteps(world,field,cuts,district,'full'),0);
   for(let i=0;i<steps;i++)expect(task.advance()).toBeUndefined();task.cancel();task.cancel();expect(task.advance()).toBeUndefined();
   expect(geometries.length).toBeGreaterThan(0);expect(materials.length).toBeGreaterThan(0);expect(new Set(geometries).size).toBe(geometries.length);expect(new Set(materials).size).toBe(materials.length);
  }finally{gd.mockRestore();md.mockRestore();}
 });
 it('bounds work even when the clock does not advance and closes abandoned generators',()=>{
  let steps=0,closed=0;function* work(){try{while(steps<1000){steps++;yield; }return 7;}finally{closed++;}}
  const task=createBuildTask(work(),3,()=>0);expect(task.advance()).toBeUndefined();expect(steps).toBeLessThan(1000);task.cancel();expect(closed).toBe(1);expect(finishBuild(work())).toBe(7);
 });
});
