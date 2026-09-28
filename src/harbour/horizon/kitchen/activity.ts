import * as THREE from 'three';
import {toLocal,toWorld,type Fleet} from '../movers/fleet/model.ts';
import type {VehicleDressing} from '../movers/shared/vehicleArt.ts';
import type {Perspective} from '../runtime/perspective.ts';
import {createKitchenEngine} from './model.ts';
import {stationsFor} from './config.ts';
import {createKitchenInput,selectKitchenTarget,selectTossTarget,type KitchenTossTarget} from './input.ts';
import {createKitchenStorage} from './storage.ts';
import {createKitchenArt} from './art.ts';
import {kitchenCameraFrame} from './camera.ts';
import {createKitchenAudio} from './audio.ts';
import {atKitchenBoard,moveKitchenChef,kitchenWalkable,kitchenSightBlocked} from './geometry.ts';
import type {ChefId,ChefPose,KitchenChefInput,KitchenCommand,KitchenView} from './types.ts';

export type KitchenActivityOptions={fleet:Fleet;scene:THREE.Scene;storageKey:string;theme:VehicleDressing;
 viewport:()=>{width:number;height:number};body:()=>ChefPose;setBody:(body:ChefPose)=>void;canOpen:()=>boolean;canPlay:()=>boolean;
 movementYaw?:()=>number;perspective:()=>Perspective;choosePerspective:(value:Perspective)=>void;
 status:(message:string)=>void;clearWorldInput:()=>void;reducedMotion:()=>boolean;
};
/** One yacht-local activity owns movement and time while its menu/service is open. */
export function createKitchenActivity(options:KitchenActivityOptions){
 const {fleet}=options,blocked=(a:ChefPose|{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>kitchenSightBlocked(fleet,a,b);
 const engine=createKitchenEngine({seed:crypto.getRandomValues(new Uint32Array(1))[0],canReach:(pose,station)=>!blocked(pose,station.approach)}),input=createKitchenInput(),storage=createKitchenStorage(options.storageKey);
 let art=createKitchenArt(options.theme);options.scene.add(art.root);
 const audio=createKitchenAudio();let sound=false,lastEvent=0,saveElapsed=0,resultSaved:string|null=null,previousPerspective:Perspective='activity',aftWasOpen=false;
 let sessionWarning:string|null=null;
 let saved=storage.loadSession(),progress=storage.loadProgress(),targets:Partial<Record<ChefId,KitchenTossTarget>>={};
 // Validate persisted sessions before offering Resume. Restore never starts a timer.
 if(saved!==null){if(!engine.restore(saved)||!engine.state().chefs.every(chef=>kitchenWalkable(fleet,chef.pose,engine.state().service==='sunset',stationsFor(engine.state())))){sessionWarning='The interrupted kitchen could not be restored safely. Start a fresh service; completed results are kept.';saved=null;storage.saveSession(null);}engine.exit();}
 let controls=input.sample(2),cameraFit:ReturnType<typeof kitchenCameraFrame>|null=null,cameraKey='',framedCamera:THREE.PerspectiveCamera|null=null;
 const active=()=>engine.state().phase!=='idle';
 const available=()=>!active()&&options.canOpen()&&atKitchenBoard(fleet,options.body());
 const syncBody=()=>{const chef=engine.state().chefs[0];if(chef)options.setBody({...toWorld(fleet.yacht,chef.pose),yaw:chef.pose.yaw+fleet.yacht.yaw});};
 function save(){if(active()&&!['menu','results'].includes(engine.state().phase)){const snapshot=engine.snapshot();saved=snapshot;storage.saveSession(snapshot);}else if(engine.state().phase==='results'){saved=null;storage.saveSession(null);}}
 function pause(reason='Service paused. Both chefs and every timer are resting.'){
  if(!active())return;engine.pause(reason);input.clear();audio.pause();save();
 }
 function reserve(){fleet.yacht.anchor=true;fleet.resetInput();fleet.doors.add('galley-aft-door');options.clearWorldInput();options.choosePerspective('activity');}
 function exit(){
  if(!active())return;const leavingService=engine.state().phase!=='menu';syncBody();engine.exit();
  // Closing the menu must not discard an interrupted service offered for resume.
  if(leavingService){saved=null;storage.saveSession(null);}input.clear();audio.pause();targets={};
  const local=toLocal(fleet.yacht,options.body());if(!aftWasOpen&&!(Math.abs(local.x)<1.35&&Math.abs(local.z+12.5)<.55))fleet.doors.delete('galley-aft-door');options.choosePerspective(previousPerspective);options.clearWorldInput();options.status('Back aboard the yacht. The anchor remains down; the helm is available.');
 }
 function act(chef:ChefId,action:Parameters<typeof engine.action>[1]){
  if(action.type==='toss'){const to=targets[chef];if(!to){options.status('Face a clear counter or your teammate to toss a loose ingredient.');return;}action={...action,to};}
  // A UI action cannot select a remote station. The live facing target is authoritative.
  if(action.type!=='ready')action={...action,target:engine.state().chefs.find(c=>c.id===chef)?.target??undefined};
  const result=engine.action(chef,action);if(!result.ok)options.status(result.message);
 }
 function command(command:KitchenCommand){
  if(command.type==='open'){
   if(engine.state().phase==='results'){engine.open();input.clear();return true;}
   if(!available())return false;
   previousPerspective=options.perspective();aftWasOpen=fleet.doors.has('galley-aft-door');
   options.clearWorldInput();input.clear();engine.open();const body=options.body();engine.setPose(0,{...toLocal(fleet.yacht,body),yaw:body.yaw-fleet.yacht.yaw});options.choosePerspective('activity');
   if(sound)void audio.enabled(true);return true;
  }
  if(!active())return false;
  if(command.type==='exit'){exit();return true;}
  if(command.type==='pause'){pause();return true;}
  if(command.type==='camera'){options.choosePerspective('activity');return true;}
  if(command.type==='discard-saved'){saved=null;storage.saveSession(null);return true;}
  if(!options.canPlay())return false;
  switch(command.type){
   case 'start':{
    const connections=input.sample(command.players).connections;if(command.players===2&&!connections.every(c=>c.connected)){options.status('Connect a controller for each chef, or use keyboard and one controller.');return false;}
    const pose=engine.state().chefs[0]?.pose;if(pose&&!kitchenWalkable(fleet,pose,command.service==='sunset')){sessionWarning='Walk back into the galley before starting this service. Close the menu to return to yacht exploration.';options.status(sessionWarning);return false;}sessionWarning=null;reserve();engine.start(command.service,command.players,command.assists);if(pose)engine.setPose(0,pose);
    controls=input.sample(command.players);input.clear();audio.reset();lastEvent=0;resultSaved=null;syncBody();save();break;
   }
   case 'resume-saved':if(saved!==null&&engine.restore(saved)){reserve();controls=input.sample(engine.state().players);input.clear();audio.reset();lastEvent=engine.state().eventSeq;syncBody();}break;
   case 'resume':{
    controls=input.sample(engine.state().players);if(!controls.connections.filter(c=>c.chef<engine.state().players).every(c=>c.connected)){options.status('Reconnect the missing controller or continue solo.');return false;}
    for(const c of engine.state().chefs)engine.reconnect(c.id);input.clear();engine.resume();break;
   }
   case 'restart':{const {service,players,assists}=engine.state();reserve();engine.start(service,players,assists);input.clear();audio.reset();lastEvent=0;resultSaved=null;syncBody();save();break;}
   case 'leave-partner':engine.leaveChef(1);input.clear();controls=input.sample(1);break;
   case 'action':act(command.chef,command.action);break;
  }
  if(sound)void audio.enabled(true);return true;
 }
 function update(seconds:number){
  const state=engine.state();controls=input.sample(state.phase==='idle'||state.phase==='menu'?2:state.players);
  if(!active())return;
  for(const id of controls.disconnected)if(id<state.players){engine.disconnect(id);pause(`Chef ${id+1}'s controller disconnected. Reconnect it or continue solo.`);}
  for(const connection of controls.connections)if(connection.chef<state.players&&connection.connected&&!state.chefs[connection.chef]?.connected)engine.reconnect(connection.chef);
  if(!options.canPlay())return;
  const stations=stationsFor(state),deck=state.service==='sunset',phaseBefore=state.phase;
  const sharedPause=state.chefs.some(chef=>controls.chefs[chef.id].pause);
  if(sharedPause&&phaseBefore!=='ready'){
   if(phaseBefore==='paused')command({type:'resume'});else pause();
   return; // Consume this frame once, even when both controllers pressed Start.
  }
  for(const chef of state.chefs){
   const value=controls.chefs[chef.id];
   if(value.ready||value.pause){
    if(phaseBefore==='ready')act(chef.id,{type:'ready'});
    else if(phaseBefore==='playing'&&state.service==='practice')act(chef.id,{type:'ready'});
   }
   if(state.phase!=='playing')continue;
   const heading=options.movementYaw?.()??0,moveX=-Math.cos(heading)*value.x+Math.sin(heading)*value.z,moveZ=Math.sin(heading)*value.x+Math.cos(heading)*value.z;
   engine.setPose(chef.id,moveKitchenChef(fleet,chef.pose,moveX,moveZ,seconds,deck,stations));
   const station=selectKitchenTarget(chef.pose,stations,blocked,chef.target);engine.setTarget(chef.id,station?.id??null);
   const held=chef.held?state.items[chef.held]??null:null;targets[chef.id]=selectTossTarget(chef,held,stations,state.chefs,blocked,targets[chef.id],state.items)??undefined;
   if(value.cycle)act(chef.id,{type:'cycle'});if(value.interact)act(chef.id,{type:'interact'});if(value.prepare)act(chef.id,{type:'prepare'});engine.setPreparing(chef.id,value.prepareHeld);if(value.toss)act(chef.id,{type:'toss'});
  }
  engine.update(seconds);syncBody();
  for(const event of state.events)if(event.seq>lastEvent){if(sound)audio.sound(event,state.assists.warning==='gentle');lastEvent=event.seq;}
  if(state.result&&resultSaved!==state.result.id){progress=storage.complete(state.result);resultSaved=state.result.id;saved=null;storage.saveSession(null);}
  saveElapsed+=seconds;if(saveElapsed>=2){saveElapsed=0;save();}
 }
 function view():KitchenView{const state=engine.snapshot();return{state,stations:stationsFor(state),available:available(),connections:controls.connections,progress,storageWarning:sessionWarning??(storage.failed()?'Kitchen progress is available for this visit only. Device storage could not save it.':null),resumable:saved!==null,tossTargets:Object.fromEntries(Object.entries(targets).filter(([,target])=>target).map(([id,target])=>[id,target!.point])),targetLabels:Object.fromEntries(state.chefs.map(chef=>[chef.id,stationsFor(state).find(s=>s.id===chef.target)?.label??'']))};}
 function render(camera:THREE.PerspectiveCamera,target:THREE.Vector3,visible:boolean){
  const state=engine.state();art.root.position.set(fleet.yacht.x,fleet.yacht.y,fleet.yacht.z);art.root.rotation.y=fleet.yacht.yaw;
  art.root.visible=visible;art.update(state,stationsFor(state),Object.fromEntries(Object.entries(targets).filter(([,value])=>value).map(([id,value])=>[id,value!.point])),{firstPersonChef:active()&&state.players===1&&options.perspective()==='first-person'?0:undefined,reducedMotion:options.reducedMotion(),unlocks:progress.unlocks});
  if(!active()||!visible||options.perspective()!=='activity'&&state.players===1){framedCamera?.clearViewOffset();framedCamera=null;return;}
  const deck=state.service==='sunset'&&!['menu','idle'].includes(state.phase),size=options.viewport(),key=`${size.width}:${size.height}:${deck}`;
  if(!cameraFit||key!==cameraKey){cameraKey=key;cameraFit=kitchenCameraFrame(size.width,size.height,deck);}
  const fit=cameraFit,eye=toWorld(fleet.yacht,fit.eye),at=toWorld(fleet.yacht,fit.target);
  camera.position.set(eye.x,eye.y,eye.z);target.set(at.x,at.y,at.z);camera.fov=48;camera.setViewOffset(fit.width,fit.height,0,fit.offsetY,fit.width,fit.height);camera.lookAt(target);framedCamera=camera;
 }
 return{active,available,view,command,update,render,pause,save,exit,
  keyDown:input.keyDown,keyUp:input.keyUp,clear:input.clear,input:(chef:ChefId,value:Partial<KitchenChefInput>)=>input.touch(chef,value),
  setSound(on:boolean,gesture=false){sound=on;if(!on)void audio.enabled(false);else if(gesture)void audio.enabled(true);},
  setTheme(theme:VehicleDressing){art.dispose();options.scene.remove(art.root);art=createKitchenArt(theme);options.scene.add(art.root);},
  dispose(){framedCamera?.clearViewOffset();pause('The kitchen was closed. Resume at the galley menu board.');save();input.dispose();audio.dispose();options.scene.remove(art.root);art.dispose();},
 };
}
