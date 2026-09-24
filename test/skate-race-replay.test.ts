import {afterEach,describe,expect,it} from 'vitest';
import {courseSignature,createRaceRecorder,decodeRaceReplay,replayPose,REPLAY_MAX_SAMPLES,type RaceReplay,type ReplaySample} from '../src/harbour/skate/replay.ts';
import {createSkateSession,DEFAULT_SKATE_TABLES,decodeSkateProgress,freshSkateProgress,observeSkate,readSkateProgress,saveSkateProgress,setSkateTables,skateProgressKey,startSkateRoute,type RouteLike} from '../src/harbour/skate/session.ts';
import {createSkateDriver} from '../src/harbour/skate/driver.ts';
import {SKATE_NO_INTENT,type SkatePresent} from '../src/harbour/skate/contract.ts';
import {crossesRaceGate,MOUNTAIN_COURSE_POINTS,MOUNTAIN_GATES} from '../src/harbour/mountain/race.ts';
import {SKILL_BRANCHES,type Point3} from '../src/harbour/mountain/definition.ts';

const course:RouteLike={id:'test-descent',name:'Test',revision:'1',seconds:[3,5,10],points:[[0,0],[0,5],[0,10]],gates:[0,5,10].map((z,i)=>({id:`gate-${i}`,at:[0,0,z],normal:[0,1],halfWidth:2,halfHeight:2}))};
const samples=():ReplaySample[]=>Array.from({length:23},(_,i)=>[i/10,0,0,i/2,0]);
const recorded=():RaceReplay=>({version:1,course:course.id,signature:courseSignature(course),seconds:2.2,samples:samples()});
const base:SkatePresent={x:0,y:0,z:0,vx:0,vy:0,vz:0,speed:5,heading:0,boardYaw:0,boardPitch:0,boardRoll:0,bodyTwist:0,phase:'roll',stance:'regular',switch:false,fakie:false,crouch:0,lean:0,carve:0,balance:0,pushPhase:0,airTime:0,clearance:0,trick:null,grab:null,grind:null,manual:null,bail:null,impact:0,surface:'concrete'};
afterEach(()=>setSkateTables(DEFAULT_SKATE_TABLES));
describe('bounded, course-aware local replay',()=>{
 it('validates a completed ordered 3D run and interpolates shortest yaw',()=>{
  const replay=decodeRaceReplay(recorded(),course)!;expect(replay).not.toBeNull();expect(replayPose(replay,.15)).toMatchObject({z:.75,mode:'race'});
  replay.samples[0]=[0,0,0,0,Math.PI-.1];replay.samples[1]=[.1,0,0,.5,-Math.PI+.1];expect(replayPose(replay,.05)?.yaw).toBeCloseTo(Math.PI);
  expect(replayPose(replay,3)).toBeNull();
 });
 it('rejects stale layout/revision, wrong height, reverse, unfinished, nonfinite, oversized and teleport recordings',()=>{
  expect(decodeRaceReplay(recorded(),{...course,revision:'2'})).toBeNull();
  expect(decodeRaceReplay(recorded(),{...course,gates:course.gates!.map(g=>({...g,halfWidth:1}))})).toBeNull();
  for(const changed of [samples().map(s=>[s[0],s[1],9,s[3],s[4]]),samples().map(s=>[s[0],0,0,-s[3],0]),samples().slice(0,12),[[0,0,0,0,0],[2.2,0,0,11,0]],Array(REPLAY_MAX_SAMPLES+1).fill(samples()[0]),samples().map((s,i)=>i===10?[1,NaN,0,5,0]:s)])expect(decodeRaceReplay({...recorded(),samples:changed},course)).toBeNull();
 });
 it('records bounded samples with gate crossing evidence, and refuses cancelled recordings',()=>{
  const recorder=createRaceRecorder(course);for(const s of samples())recorder.sample(s,s[3]===5.5||s[3]===10.5);
  expect(recorder.finish(2.2)).not.toBeNull();recorder.invalidate();expect(recorder.finish(2.2)).toBeNull();
  const long=createRaceRecorder(course);long.sample([301,0,0,0,0]);expect(long.finish(301)).toBeNull();
 });
 it('keeps identity scopes distinct and storage failures playable; stale mountain times cannot survive a revision',()=>{
  setSkateTables({routes:[course]});const progress={...freshSkateProgress(),raceReplay:recorded(),routeBest:{[course.id]:2.2},routeSignatures:{[course.id]:courseSignature(course)}};
  const store=new Map<string,string>(),storage={getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>{store.set(key,value);}};
  const a=skateProgressKey('development','house','a'),b=skateProgressKey('development','house','b');expect(a).not.toBe(b);
  expect(saveSkateProgress(storage,a,progress)).toBe(true);expect(readSkateProgress(storage,a).raceReplay?.seconds).toBe(2.2);expect(readSkateProgress(storage,b).raceReplay).toBeUndefined();
  expect(saveSkateProgress({setItem(){throw Error('quota');}},a,progress)).toBe(false);
  setSkateTables({routes:[{...course,revision:'2'}]});const stale=decodeSkateProgress(JSON.stringify(progress));expect(stale.raceReplay).toBeNull();expect(stale.routeBest[course.id]).toBeUndefined();
 });
 it('publishes a ghost only after the final ordered gate, never after bail, restart or restored partial state',()=>{
  setSkateTables({routes:[course]});
  const run=(bail=false,restore=false)=>{let s=createSkateSession();startSkateRoute(s,course.id);while(s.run!.countdown>0)observeSkate(s,base,[],null,.1);if(restore)s=structuredClone(s);for(let i=1;i<=22;i++){observeSkate(s,{...base,z:i/2,phase:bail&&i===3?'bail':'roll'},[],null,.1);if(i===10)expect(s.progress.raceReplay).toBeUndefined();}return s;};
  expect(run().progress.raceReplay?.seconds).toBeCloseTo(2.1);expect(run(true).progress.raceReplay).toBeUndefined();expect(run(false,true).progress.raceReplay).toBeUndefined();
  const s=run();startSkateRoute(s,course.id);observeSkate(s,base,[],null,.1);expect(s.progress.raceReplay?.seconds).toBeCloseTo(2.1);
 });
 it('playback uses its own clock, pauses, cancels on restart/dismount, and never banks progress',()=>{
  const driver=createSkateDriver({obstacles:[]},{intent:()=>({...SKATE_NO_INTENT,push:true})});driver.mount(0,0,0);setSkateTables({routes:[course]});
  const cp=driver.checkpoint()!;cp.session.progress.raceReplay=recorded();driver.restore(cp);driver.replay('play');const progress=JSON.stringify(driver.progress()),pose={...driver.present()!};
  driver.step(.1);expect(driver.ghost()).toMatchObject({mode:'replay',z:.5});expect(driver.present()).toEqual(pose);expect(JSON.stringify(driver.progress())).toBe(progress);
  driver.pause(true);driver.step(.1);expect(driver.ghost()).toBeNull();expect(driver.hud()?.replay?.time).toBe(.1);
  driver.pause(false);driver.step(.1);expect(driver.hud()?.replay?.time).toBe(.2);driver.settings({reducedEffects:true});expect(driver.ghost()).toBeNull();driver.step(.1);expect(driver.hud()?.replay?.playing).toBe(false);
  driver.settings({reducedEffects:false});driver.replay('play');driver.command('respawn');expect(driver.hud()?.replay?.playing).toBe(false);driver.replay('play');driver.unmount();expect(driver.ghost()).toBeNull();
 });
});

describe('optional mountain routes preserve mandatory 3D gates',()=>{
 it.each(SKILL_BRANCHES.map(b=>[b.id,b] as const))('%s rejoins at its authored height and preserves all ordered gates',(_,branch)=>{
  expect(branch.points[0]).toEqual(MOUNTAIN_COURSE_POINTS[branch.entry]);expect(branch.points.at(-1)).toEqual(MOUNTAIN_COURSE_POINTS[branch.exit]);
  expect(branch.exit).toBeGreaterThan(branch.entry);expect(MOUNTAIN_GATES.some(g=>MOUNTAIN_COURSE_POINTS.indexOf(g.at)>branch.entry&&MOUNTAIN_COURSE_POINTS.indexOf(g.at)<branch.exit)).toBe(false);
  const end=MOUNTAIN_COURSE_POINTS.at(-1)!,gate=MOUNTAIN_GATES.at(-1)!;
  const path:Point3[]=[...MOUNTAIN_COURSE_POINTS.slice(0,branch.entry),...branch.points,...MOUNTAIN_COURSE_POINTS.slice(branch.exit+1),[end[0]+gate.normal[0],end[1],end[2]+gate.normal[1]]];
  let checkpoint=1;for(let i=1;i<path.length;i++){const target=MOUNTAIN_GATES[checkpoint];if(target&&crossesRaceGate(path[i-1]!,path[i]!,target))checkpoint++;}
  expect(checkpoint).toBe(MOUNTAIN_GATES.length);
 });
 it('refuses reverse and below-deck crossings at every mandatory gate',()=>{
  for(const g of MOUNTAIN_GATES){const a:Point3=[g.at[0]-g.normal[0],g.at[1],g.at[2]-g.normal[1]],b:Point3=[g.at[0]+g.normal[0],g.at[1],g.at[2]+g.normal[1]];expect(crossesRaceGate(a,b,g)).toBe(true);expect(crossesRaceGate(b,a,g)).toBe(false);expect(crossesRaceGate([a[0],a[1]-8,a[2]],[b[0],b[1]-8,b[2]],g)).toBe(false);}
 });
});
