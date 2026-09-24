import {afterEach,describe,expect,it} from 'vitest';
import {createSkateDriver} from '../src/harbour/skate/driver.ts';
import {createSkateInput} from '../src/harbour/skate/input/index.ts';
import {courseSignature,type RaceReplay} from '../src/harbour/skate/replay.ts';
import {DEFAULT_SKATE_TABLES,setSkateTables,type RouteLike} from '../src/harbour/skate/session.ts';
const pad=()=>({connected:true,mapping:'standard',index:0,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))});
const press=(p:ReturnType<typeof pad>,n:number,on:boolean)=>{p.buttons[n]={pressed:on,value:on?1:0};};
afterEach(()=>setSkateTables(DEFAULT_SKATE_TABLES));
describe('controller-only controls during pause and replay',()=>{
 it('consumes menu presses without enqueuing respawn, marker, revert or a flick',()=>{
  const p=pad(),input=createSkateInput({getGamepads:()=>[p]});input.pollControls();
  for(const n of [2,3,8,9])press(p,n,true);p.axes[3]=1;
  expect(input.pollControls()).toEqual({pause:true,connected:true});
  expect(input.pollControls().pause).toBe(false);p.axes[3]=-1;input.pollControls();
  input.reset();
  expect(input.sample(100,false,false)).toMatchObject({respawn:false,marker:false,revert:false,pop:null});
  for(const n of [2,3,8,9])press(p,n,false);p.axes[3]=0;input.sample(200,false,false);
  press(p,3,true);expect(input.sample(300,false,false).respawn).toBe(true);
 });
 it('keeps the shared frame polling while paused, resumes on a fresh Start and drops held gameplay buttons',()=>{
  const p=pad(),driver=createSkateDriver({obstacles:[]},{getGamepads:()=>[p]});driver.mount(0,0,0);driver.step(.01);
  press(p,9,true);driver.step(.01);driver.step(.01);expect(driver.paused()).toBe(true);
  const at={...driver.present()!},progress=JSON.stringify(driver.progress());
  expect(driver.step(.1).moving).toBe(true);expect(driver.present()).toEqual(at);expect(JSON.stringify(driver.progress())).toBe(progress);
  press(p,9,false);driver.step(.01);press(p,3,true);driver.step(.01);press(p,9,true);driver.step(.01);
  expect(driver.paused()).toBe(false);expect(driver.takeCut()).toBe(true); // only the original mount cut
  driver.step(.01);expect(driver.takeCut()).toBe(false); // held Y was not queued as respawn
  driver.pause(true);p.connected=false;expect(driver.step(.1).moving).toBe(false);
 });
 it('allows Start to pause and resume playback without advancing it or banking progress while paused',()=>{
  const p=pad(),driver=createSkateDriver({obstacles:[]},{getGamepads:()=>[p]});driver.mount(0,0,0);
  const course:RouteLike={id:'control-test',name:'Test',revision:1,seconds:[3,5,10],points:[[0,0],[0,10]],gates:[0,10].map((z,i)=>({id:String(i),at:[0,0,z],normal:[0,1],halfWidth:2,halfHeight:2}))};
  const replay:RaceReplay={version:1,course:course.id,signature:courseSignature(course),seconds:2.2,samples:Array.from({length:23},(_,i)=>[i/10,0,0,i/2,0])};
  setSkateTables({routes:[course]});const cp=driver.checkpoint()!;cp.session.progress.raceReplay=replay;driver.restore(cp);driver.replay('play');driver.step(.1);
  const elapsed=driver.hud()!.replay!.time,at={...driver.present()!},progress=JSON.stringify(driver.progress());
  press(p,9,true);driver.step(.1);expect(driver.paused()).toBe(true);expect(driver.hud()!.replay!.time).toBe(elapsed);
  driver.step(.1);press(p,9,false);driver.step(.1);press(p,9,true);driver.step(.1);
  expect(driver.paused()).toBe(false);expect(driver.hud()!.replay!.time).toBeCloseTo(elapsed+.1);
  expect(driver.present()).toEqual(at);expect(JSON.stringify(driver.progress())).toBe(progress);
 });
});
