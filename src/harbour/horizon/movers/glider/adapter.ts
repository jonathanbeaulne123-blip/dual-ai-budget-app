/**
 * Bridges the M6 flight seam into the shared M1–M9 ride registry.
 * The flight simulation intentionally keeps its older, smaller input/camera
 * contract; this adapter is the only place where it is translated to the
 * Horizon ride frame used by the board and bicycle.
 */
import type {ModeController, MoverFrame, MoverInput} from '../shared/mode.ts';
import type {MoverDeps} from '../shared/registry.ts';
import type {ThresholdOffer} from '../shared/threshold.ts';
import type {Threshold} from '../../world/definition.ts';
import type {FlightController} from './controller.ts';

function thresholdFor(deps:MoverDeps, offer:ThresholdOffer):Threshold {
  const source=deps.world.thresholds.find(t=>t.id===offer.thresholdId);
  return source?{...source,at:[offer.at[0],offer.at[2]],height:offer.at[1]}:{id:offer.thresholdId,at:[offer.at[0],offer.at[2]],height:offer.at[1],modes:[`${offer.from}→${offer.to}`],action:offer.action};
}

function flightInput(input:MoverInput){
  return {forward:input.forward,strafe:input.steer,run:input.sprint,bar:input.forward,bank:input.steer,pull:input.action==='pull'||input.jump,look:[input.look.dx,input.look.dy] as const,fold:input.action==='fold'};
}

export function adaptFlightController(flight:FlightController,deps:MoverDeps):ModeController {
  return {
    id:flight.id,
    enter(offer,body){flight.enter(thresholdFor(deps,offer),body);},
    update(dt,input,_now):MoverFrame {
      flight.update(dt,flightInput(input));
      const body=flight.bodyPose(),camera=flight.camera(),hud=flight.hud(),sound=flight.sound(),probe=flight.probe();
      const place=hud.place;
      return {
        body:{x:body.x,y:body.y,z:body.z,yaw:body.yaw},
        camera:{eye:[...camera.eye] as [number,number,number],target:[...camera.look] as [number,number,number],fov:camera.fov},
        pose:{lean:0,roll:body.bank??0,pitch:body.pitch??0,crouch:0,slide:0,speed:probe.groundSpeed},
        hud:{pace:null,arc:0,glyph:place?.action==='fold'||place?.action==='pull'?'park':null,label:place?.label??null,height:hud.height,lift:hud.lift,place},
        sound:{slide:0,roll:0,bite:sound==='snap',boost:sound==='splashEcho'},
        fade:null,
        events:sound?[sound]:[],
      };
    },
    exit(){const out=flight.exit();return{x:out.at[0],y:out.at[1],z:out.at[2],yaw:out.yaw};},
    reducedMotion(){},
    calm(){},
    tier(){},
    reducedMotionCut(){return flight.reducedMotionCut();},
    dispose(){},
    finished(){return flight.finished?.()===true;},
  };
}
