import type {ModeController,MoverFrame,MoverInput,MoverBody} from '../shared/mode.ts';
import type {MoverDeps} from '../shared/registry.ts';
import type {XYZ} from '../shared/ground/types.ts';
import {CRUISER as C} from './tuning.ts';
import {createCruiserState,stepCruiser,cruiserSpeed,cruiserDismount,recoverCruiser,type CruiserState} from './sim.ts';

/** Which registry mode this vehicle answers as. The bicycle is a skin of the cruiser: the same
 * sim, speeds and boost; only its id (registry, thresholds, art) and its HUD word differ. */
export interface CruiserControllerOptions {id?:'cruiser'|'bicycle';rideLabel?:string}
/** The HUD word for a boosted ride (Shift / the touch Boost toggle). */
export const CRUISER_BOOST_LABEL='Boost';
/** Above this ramp the HUD and sound report the ride as boosted. */
const BOOSTED=.05;

export interface CruiserController extends ModeController {
  state():CruiserState;
  dismount():MoverBody|null;
  recover():boolean;
  resetInput():void;
}
/** The same controller is used by both cosmetic identities. Skin is intentionally absent. */
export function createCruiserController(deps:MoverDeps,options:CruiserControllerOptions={}):CruiserController {
  const id=options.id??'cruiser',rideLabel=options.rideLabel??(id==='bicycle'?'Cycling':'Cruising');
  let state=createCruiserState({x:0,y:0,z:0,yaw:0}),acc=0,neutral=true,quiet=deps.reducedMotion||deps.calm;
  let cameraYaw=0,lookYaw=0,lookPitch=0,cameraY=0,recovered=false,wasBoosted=false;
  const resetInput=()=>{neutral=true;acc=0;state={...state,brakeHeld:false,jumpHeld:false};lookYaw=0;lookPitch=0;};
  function camera(dt:number,input:MoverInput):NonNullable<MoverFrame['camera']> {
    lookYaw=Math.max(-1.6,Math.min(1.6,lookYaw+input.look.dx));lookPitch=Math.max(-.6,Math.min(.6,lookPitch+input.look.dy));
    if(!input.look.dx)lookYaw*=Math.exp(-dt*1.8);if(!input.look.dy)lookPitch*=Math.exp(-dt*1.8);
    const k=quiet?1:1-Math.exp(-7*dt);
    cameraYaw+=Math.atan2(Math.sin(state.yaw-cameraYaw),Math.cos(state.yaw-cameraYaw))*k;
    cameraY+=(state.y-cameraY)*(quiet?1:1-Math.exp(-12*dt));
    // No speed FOV, camera roll, shake or connection from camera yaw into steering. Outside calm and
    // reduced motion the camera eases back up to cameraPull at boost speed (it follows the smooth speed).
    const speed=cruiserSpeed(state),heading=cameraYaw+lookYaw,lead=Math.min(C.cameraLead,speed*.07);
    const distance=C.cameraDistance+(quiet?0:C.cameraPull*Math.min(1,speed/C.boostSpeed));
    const target:XYZ=[state.x+Math.sin(state.yaw)*lead,cameraY+1.05,state.z+Math.cos(state.yaw)*lead];
    const from:XYZ=[state.x,state.y+1.05,state.z];
    const desired:XYZ=[state.x-Math.sin(heading)*distance,cameraY+C.cameraHeight+lookPitch*3,state.z-Math.cos(heading)*distance];
    let f=1;while(f>.08&&deps.geography.cameraBlocked(from,[from[0]+(desired[0]-from[0])*f,from[1]+(desired[1]-from[1])*f,from[2]+(desired[2]-from[2])*f]))f-=.04;
    return {eye:[from[0]+(desired[0]-from[0])*f,from[1]+(desired[1]-from[1])*f,from[2]+(desired[2]-from[2])*f],target,fov:C.cameraFov};
  }
  return {
    id,
    enter(_offer,body){state=createCruiserState(body);cameraYaw=body.yaw;cameraY=body.y;wasBoosted=false;resetInput();},
    update(dt,input){
      if(neutral&&Math.abs(input.forward)<.1&&Math.abs(input.steer)<.1&&!input.jump)neutral=false;
      // Calm and reduced motion keep the ride at cruise: Shift does not boost there.
      const use=neutral?{forward:0,steer:0,jump:false,sprint:false}:{forward:input.forward,steer:input.steer,jump:input.jump,sprint:input.sprint&&!quiet};
      acc+=Math.max(0,Math.min(.25,dt));
      while(acc+1e-9>=C.dt){state=stepCruiser(state,use,deps.geography);acc-=C.dt;}
      const speed=cruiserSpeed(state),boosted=state.grounded&&!state.reverse&&state.boost>BOOSTED&&speed>1;
      // sound.boost is an edge, like the board's boost event: the runtime plays one cue per engagement.
      const boostCue=boosted&&!wasBoosted;wasBoosted=boosted;
      const frame:MoverFrame={
        body:{x:state.x,y:state.y,z:state.z,yaw:state.yaw},camera:camera(Math.max(0,dt),input),
        pose:{lean:quiet?0:state.lean,roll:quiet?0:state.lean,pitch:state.pitch,crouch:0,slide:0,speed,slip:0},
        hud:{pace:`${Math.round(speed*3.6)} km/h`,arc:Math.min(1,speed/C.boostSpeed),glyph:null,label:state.reverse?'Reverse':!state.grounded?'Airborne':boosted?CRUISER_BOOST_LABEL:rideLabel},
        sound:{slide:0,roll:0,bite:false,boost:boostCue},
        fade:recovered?{to:{...state},label:'Ready to ride.'}:null,events:recovered?['recovered']:[],
      };recovered=false;return frame;
    },
    exit(offer){return offer?{x:offer.at[0],y:offer.at[1],z:offer.at[2],yaw:state.yaw}:{...state.safe};},
    // A physical exit hands the complete world velocity to the shared airborne owner.
    // No resumeAt: the cruiser is put away, so a landing returns on foot without duplicate equipment.
    airborne:()=>state.grounded?null:{x:state.x,y:state.y,z:state.z,yaw:state.yaw,velocity:[state.vx,state.vy,state.vz]},
    state:()=>({...state,safe:{...state.safe}}),
    dismount:()=>cruiserDismount(deps.geography,state),
    recover(){const next=recoverCruiser(deps.geography,state);if(!next)return false;state=next;cameraYaw=state.yaw;cameraY=state.y;resetInput();recovered=true;return true;},
    resetInput,
    reducedMotion(on){quiet=on||deps.calm;},calm(on){quiet=on||deps.reducedMotion;},tier(){},dispose(){},
  };
}
