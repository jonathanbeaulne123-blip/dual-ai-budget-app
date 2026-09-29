import * as THREE from 'three';
import {createSkateDriver,SKATE_CATALOGS,skateField,type SkateControls} from '../../skate/driver.ts';
import {createSkaterLook,type SkaterLook} from '../../skate/look/index.ts';
import {buildSkatePark,type SkatePark} from '../../skate/parkScene.ts';
import {createSkateCamera,SKATE_CAM,type SkateCamera} from '../../skate/camera/skateCamera.ts';
import {createHudThrottle,type SkateHudModel} from '../../skate/hud/model.ts';
import type {SkateProgress} from '../../skate/session.ts';
import type {BodyFigure} from '../../body/figure.ts';
import {groundHeightAt} from '../../scene/ground.ts';
import {worldCeilingAt,worldCollisionAt} from '../../mountain/surfaces.ts';
import {mountainFoliageAt} from '../../mountain/planting.ts';
import {sceneDressingFrom} from '../../scene/place.ts';
import {COURT_DRESSING} from '../../court/dressing.ts';
import type {ThemeId} from '../../../theme/scenes.ts';
import {MOUNTAIN_V2_OFFSET} from '../regions/mountainV2/placement.ts';

/**
 * The old Tideline skate on the Horizon (Jonathan 2026-09-29: "the old ux with the skateboard").
 *
 * Mountain v2 stands on the Horizon as a pure translation (`MOUNTAIN_V2_OFFSET`), and its town island's ground is the
 * Mountain's own ground raised by the offset (`regions/mountainV2/geography.ts`). So the skate runs exactly as it did —
 * its sim, field, park, spots, routes, the mountain race, tricks, decks and saved progress, all in native Mountain
 * space — inside one group moved by the offset. Only the edges translate: the body the Horizon reads, and the camera.
 */
export type NativeSkateFrame={model:SkateHudModel;progress:SkateProgress;revision:number};
export type HorizonBodyPose={x:number;y:number;z:number;yaw:number};
export type NativeSkate={
  /** The old skate's controls (HUD commands, settings, input), unchanged. */
  controls:SkateControls;
  /** Whether a board may be put down here: the Mountain v2 town island, where the park stands. */
  canStart(x:number,z:number):boolean;
  /** Put the board down at a Horizon position. */
  start(at:HorizonBodyPose,progress?:SkateProgress):boolean;
  /** Pick the board up; returns where the body stands on the Horizon (null if not skating). */
  stop():HorizonBodyPose|null;
  /** One frame: the ride steps, the look draws; returns whether frames are still needed and the Horizon body. */
  step(dt:number):{moving:boolean;body:HorizonBodyPose}|null;
  /** The chase camera for this frame, in Horizon space. */
  camera(dt:number,aspect:number,reduced:boolean):{eye:[number,number,number];target:[number,number,number];fov:number;roll:number}|null;
  /** Publish the HUD model (throttled; `force` for pause/enable/route changes). */
  publish(now:number,force?:boolean):void;
  setTheme(theme:ThemeId):void;
  dispose():void;
};
const O=MOUNTAIN_V2_OFFSET;
/** The town island's ground radius the region answers (`regions/mountainV2/geography.ts`), with a margin. */
export const NATIVE_SKATE_RADIUS=64;
export const toNative=(x:number,y:number,z:number)=>({x:x-O.x,y:y-O.y,z:z-O.z});

export function createNativeSkate(options:{scene:THREE.Scene;figure:BodyFigure;tier:'full'|'lite';theme?:ThemeId;reducedMotion:()=>boolean;onSkate?:(frame:NativeSkateFrame|null)=>void}):NativeSkate{
  const group=new THREE.Group();group.name='horizon-native-skate';group.position.set(O.x,O.y,O.z);options.scene.add(group);
  const field=skateField();
  let theme:ThemeId=options.theme??'classic';
  let park:SkatePark|null=null;
  function buildPark(){if(park){group.remove(park.group);park.dispose();}park=buildSkatePark(sceneDressingFrom(COURT_DRESSING[theme]),{tier:options.tier,field});group.add(park.group);}
  buildPark();
  // The Mountain's island obstacles were its village buildings; the Horizon does not draw them, so none are ridden into.
  const driver=createSkateDriver({obstacles:[]},{reducedMotion:options.reducedMotion});
  let look:SkaterLook|null=null,lookDeck=driver.deckId();
  const cam:SkateCamera=createSkateCamera({ground:(x,z)=>groundHeightAt(x,z)});
  let camLive=false;
  const throttle=createHudThrottle(100);let builtAt=-Infinity,had=false;
  function ensureLook(){
    if(!look){look=createSkaterLook({figure:options.figure,deckId:driver.deckId(),tier:options.tier,catalogs:SKATE_CATALOGS,theme});group.add(look.root);lookDeck=driver.deckId();}
    look.root.visible=true;return look;
  }
  function draw(dt:number){
    const p=driver.present();if(!p)return;
    const l=ensureLook();
    if(lookDeck!==driver.deckId()){lookDeck=driver.deckId();l.setDeck(lookDeck);}
    l.setStance(null);l.update(p,driver.paused()?null:driver.events(),driver.paused()?0:dt,options.reducedMotion()||driver.current()?.reducedEffects===true);
  }
  const bodyOf=():HorizonBodyPose|null=>{const p=driver.present();return p?{x:p.x+O.x,y:p.y+O.y,z:p.z+O.z,yaw:p.boardYaw}:null;};
  const controls:SkateControls={
    active:driver.active,heading:driver.heading,paused:driver.paused,hud:driver.hud,progress:driver.progress,revision:driver.revision,ghost:driver.ghost,replay:driver.replay,
    run:driver.run,route:driver.route,spot:driver.spot,deck:driver.deck,settings:driver.settings,current:driver.current,command:driver.command,
    checkpoint:driver.checkpoint,input:driver.input,present:driver.present,events:driver.events,takeCut:driver.takeCut,setAudio:driver.setAudio,
    pause(on){driver.pause(on);},
    restore(checkpoint){driver.restore(checkpoint);draw(0);},
    enable(on,progress){return on?Boolean(api.start(bodyOf()??{x:O.x,y:O.y,z:O.z,yaw:0},progress)):(api.stop(),true);},
  };
  const api:NativeSkate={
    controls,
    canStart(x,z){const n=toNative(x,0,z);return Math.hypot(n.x,n.z)<NATIVE_SKATE_RADIUS;},
    start(at,progress){
      if(driver.active())return true;
      const n=toNative(at.x,at.y,at.z);
      if(Math.hypot(n.x,n.z)>=NATIVE_SKATE_RADIUS)return false;
      driver.mount(n.x,n.z,at.yaw,progress,{y:n.y});camLive=false;draw(0);return true;
    },
    stop(){
      if(!driver.active())return null;
      const s=driver.unmount();
      if(look){look.release();look.root.visible=false;}
      camLive=false;
      return s?{x:s.x+O.x,y:s.y+O.y,z:s.z+O.z,yaw:s.yaw}:null;
    },
    step(dt){
      if(!driver.active())return null;
      const ride=driver.step(dt);draw(dt);
      if(ride.banked>0&&!options.reducedMotion())look?.celebrate(Math.min(1,.25+ride.banked/6000));
      const body=bodyOf();return body?{moving:ride.moving,body}:null;
    },
    camera(dt,aspect,reduced){
      const p=driver.present();if(!p)return null;
      if(!camLive||driver.takeCut()){cam.snap(p);camLive=true;}
      cam.setDistance(driver.current()?.camera==='far'?'far':'near');
      cam.setFastSpeed(driver.run()?.id==='mountain-descent'?SKATE_CAM.raceFastSpeed:SKATE_CAM.fastSpeed);
      const f=cam.update(p,driver.events(),dt,{aspect,reducedMotion:reduced||driver.current()?.reducedEffects===true,ceilingAt:worldCeilingAt,
        blocked:(x,y,z)=>y<groundHeightAt(x,z)+.05||worldCollisionAt(x,y,z,.12)||mountainFoliageAt(x,y,z,options.tier)});
      return {eye:[f.position[0]+O.x,f.position[1]+O.y,f.position[2]+O.z],target:[f.target[0]+O.x,f.target[1]+O.y,f.target[2]+O.z],fov:f.fov,roll:f.roll??0};
    },
    publish(now,force=false){
      if(!driver.active()){if(had){had=false;throttle.reset();park?.update(null);options.onSkate?.(null);}return;}
      if(!force&&now-builtAt<50&&!driver.events().length)return;
      builtAt=now;
      const model=driver.hud();if(!model)return;
      const out=force?(throttle.reset(),throttle.offer(model,now)):throttle.offer(model,now);
      if(!out)return;
      had=true;
      park?.update(out.run?{run:{id:out.run.id,checkpoint:out.run.gate+1,finished:out.run.finished}}:null);
      const progress=driver.progress();if(progress)options.onSkate?.({model:out,progress,revision:driver.revision()});
    },
    setTheme(next){if(next===theme)return;theme=next;buildPark();look?.setTheme(next);},
    dispose(){if(driver.active())api.stop();look?.dispose();park?.dispose();options.scene.remove(group);},
  };
  return api;
}
