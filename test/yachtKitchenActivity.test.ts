// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {createFleet,toLocal,toWorld} from '../src/harbour/horizon/movers/fleet/model.ts';
import {createKitchenActivity} from '../src/harbour/horizon/kitchen/activity.ts';
import {KITCHEN_BOARD,kitchenWalkable} from '../src/harbour/horizon/kitchen/geometry.ts';
import type {KitchenAction,KitchenStation,ChefPose} from '../src/harbour/horizon/kitchen/types.ts';
import type {Perspective} from '../src/harbour/horizon/runtime/perspective.ts';
vi.mock('../src/harbour/horizon/kitchen/art.ts',()=>({createKitchenArt:()=>({root:new THREE.Group(),update:vi.fn(),dispose:vi.fn()})}));
vi.mock('../src/harbour/horizon/kitchen/audio.ts',()=>({createKitchenAudio:()=>({enabled:vi.fn(async()=>{}),sound:vi.fn(),reset:vi.fn(),pause:vi.fn(),dispose:vi.fn()})}));
beforeEach(()=>{localStorage.clear();Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});});
function setup(){
 const fleet=createFleet({water:()=>0,ground:()=>-12,blocked:()=>false,width:2200,depth:1800});
 let body:ChefPose={...toWorld(fleet.yacht,KITCHEN_BOARD),yaw:0},perspective:Perspective='floating',canPlay=true;
 const scene=new THREE.Scene(),status=vi.fn(),a=createKitchenActivity({fleet,scene,storageKey:'test-kitchen',theme:'classic',body:()=>body,setBody:v=>{body=v;},canOpen:()=>canPlay,canPlay:()=>canPlay,perspective:()=>perspective,choosePerspective:v=>{perspective=v;},status,clearWorldInput:vi.fn(),reducedMotion:()=>false});
 return{fleet,a,scene,status,body:()=>body,perspective:()=>perspective,setBody:(v:ChefPose)=>{body=v;},setCanPlay:(v:boolean)=>{canPlay=v;}};
}
const sid=(name:string)=>'yacht.galley.'+name;
function action(a:ReturnType<typeof setup>['a'],value:KitchenAction){a.command({type:'action',chef:0,action:value});a.update(.05);}
function advance(a:ReturnType<typeof setup>['a'],seconds:number){for(let i=0;i<Math.ceil(seconds/.05);i++)a.update(.05);}
/** Traverse actual floor/contact nodes with ordinary chef movement, never set a chef pose. */
function walk(t:ReturnType<typeof setup>,station:KitchenStation){
 const a=t.a,stations=a.view().stations,deck=a.view().state.service==='sunset',start=a.view().state.chefs[0]!.pose,scale=4;
 const key=(x:number,z:number)=>x+','+z,begin=[Math.round(start.x*scale),Math.round(start.z*scale)],goal=[Math.round(station.approach.x*scale),Math.round(station.approach.z*scale)];
 const queue=[begin],parents=new Map<string,string|null>([[key(begin[0]!,begin[1]!),null]]);let found:string|null=null;
 for(let i=0;i<queue.length;i++){const [x,z]=queue[i]!;if(Math.hypot(x!-goal[0]!,z!-goal[1]!)<=1){found=key(x!,z!);break;}for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x!+dx!,nz=z!+dz!,k=key(nx,nz);if(parents.has(k)||!kitchenWalkable(t.fleet,{x:nx/scale,y:3.85,z:nz/scale},deck,stations))continue;parents.set(k,key(x!,z!));queue.push([nx,nz]);}}
 expect(found,`route to ${station.id}`).not.toBeNull();const path:number[][]=[];for(let k=found;k;k=parents.get(k)??null)path.unshift(k.split(',').map(Number));
 for(const [px,pz]of path.slice(1)){for(let i=0;i<12;i++){const p=a.view().state.chefs[0]!.pose,dx=px!/scale-p.x,dz=pz!/scale-p.z,n=Math.hypot(dx,dz);if(n<.045)break;a.input(0,{x:-dx/Math.max(.16,n),z:dz/Math.max(.16,n)});a.update(.05);}}
 const p=a.view().state.chefs[0]!.pose,dx=station.at.x-p.x,dz=station.at.z-p.z,n=Math.hypot(dx,dz);a.input(0,{x:-dx/n,z:dz/n});a.update(.005);a.input(0,{x:0,z:0});a.update(.05);
 expect(a.view().state.chefs[0]!.target,`target ${station.id}`).toBe(station.id);
}
function go(t:ReturnType<typeof setup>,name:string){walk(t,t.a.view().stations.find(s=>s.id===sid(name))!);}
describe('physical yacht kitchen activity integration',()=>{
 it('requires physical arrival, keeps the vessel in place, reserves helm and restores camera/control ownership',()=>{
  const t=setup(),{a}=t;t.setBody({x:0,y:0,z:0,yaw:0});expect(a.command({type:'open'})).toBe(false);t.setBody({...toWorld(t.fleet.yacht,KITCHEN_BOARD),yaw:0});expect(a.command({type:'open'})).toBe(true);
  const vessel={...t.fleet.yacht};a.command({type:'start',service:'practice',players:1,assists:{}});expect(t.fleet.yacht.x).toBe(vessel.x);expect(t.fleet.yacht.z).toBe(vessel.z);expect(t.fleet.yacht.anchor).toBe(true);expect(t.perspective()).toBe('activity');action(a,{type:'ready'});
  const local=a.view().state.chefs[0]!.pose;t.fleet.yacht.x+=7;t.fleet.yacht.z-=4;t.fleet.yacht.yaw=.8;a.update(.05);expect(toLocal(t.fleet.yacht,t.body()).x).toBeCloseTo(local.x);expect(toLocal(t.fleet.yacht,t.body()).z).toBeCloseTo(local.z);
  const camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3();a.render(camera,target,true);expect(t.scene.children[0]!.position.x).toBe(t.fleet.yacht.x);expect(t.scene.children[0]!.rotation.y).toBe(.8);
  a.command({type:'exit'});expect(a.active()).toBe(false);expect(t.perspective()).toBe('floating');expect(t.fleet.doors.has('galley-aft-door')).toBe(false);a.dispose();expect(t.scene.children).toHaveLength(0);
 });
 it('walks the real counter loop to cook, chop, assemble, deliver and wash the complete First Service',()=>{
  const t=setup(),{a}=t;a.command({type:'open'});a.command({type:'start',service:'first',players:1,assists:{}});action(a,{type:'ready'});
  go(t,'pantry');action(a,{type:'interact',ingredient:'bread'});go(t,'hob');action(a,{type:'interact'});advance(a,7);action(a,{type:'interact'});go(t,'plate');action(a,{type:'interact'});
  go(t,'cold');action(a,{type:'interact',ingredient:'tomato'});go(t,'prep-port');action(a,{type:'interact'});action(a,{type:'prepare'});advance(a,3);action(a,{type:'interact'});go(t,'plate');action(a,{type:'interact'});action(a,{type:'interact'});go(t,'serve');action(a,{type:'interact'});
  expect(a.view().state.served).toBe(1);advance(a,6);go(t,'return');action(a,{type:'interact'});go(t,'wash');action(a,{type:'interact'});action(a,{type:'prepare'});advance(a,3);
  expect(a.view().state.phase).toBe('results');expect(a.view().progress.unlocks).toContain('chef-apron');expect(Object.keys(a.view().progress.completed)).toHaveLength(1);advance(a,2);expect(Object.keys(a.view().progress.completed)).toHaveLength(1);a.dispose();
 });
 it('freezes tools/focus pauses, suppresses held input and resumes a saved service only at the board',()=>{
  const t=setup(),{a}=t;a.command({type:'open'});a.command({type:'start',service:'lunch',players:1,assists:{}});action(a,{type:'ready'});a.keyDown({key:'w'});a.update(.1);a.pause('Tools open');const paused=a.view().state;a.update(50);expect(a.view().state.elapsed).toBe(paused.elapsed);expect(a.view().state.chefs[0]!.pose).toEqual(paused.chefs[0]!.pose);a.dispose();
  const second=setup();expect(second.a.view().resumable).toBe(true);expect(second.a.command({type:'resume-saved'})).toBe(false);second.a.command({type:'open'});second.a.command({type:'resume-saved'});expect(second.a.view().state.phase).toBe('paused');expect(second.a.view().state.elapsed).toBe(paused.elapsed);second.a.command({type:'resume'});second.a.update(.1);expect(second.a.view().state.elapsed).toBeCloseTo(paused.elapsed+.1);second.a.dispose();
 });
 it('requires a real second input connection and pauses both chefs on its loss',()=>{
  let pads:any[]=[];Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pads});const t=setup(),{a}=t;a.command({type:'open'});expect(a.command({type:'start',service:'lunch',players:2,assists:{}})).toBe(false);
  pads=[{index:0,connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))}];expect(a.command({type:'start',service:'lunch',players:2,assists:{}})).toBe(true);action(a,{type:'ready'});a.command({type:'action',chef:1,action:{type:'ready'}});a.update(.05);expect(a.view().state.phase).toBe('playing');pads=[];a.update(.05);expect(a.view().state.phase).toBe('paused');expect(a.command({type:'resume'})).toBe(false);a.command({type:'leave-partner'});expect(a.command({type:'resume'})).toBe(true);expect(a.view().state.players).toBe(1);a.dispose();
 });
});
