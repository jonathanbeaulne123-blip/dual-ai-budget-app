/**
 * The runtime's mover hook (FLIGHT.md §9 integrator ask 2). While a `ModeController` is attached
 * it owns the body's place and pose and the camera: the runtime's own gravity, collision and walk
 * camera stand aside. Detaching drops the body on foot and hands back to the walk camera.
 * Pure: the runtime applies the returned transforms to its figure and camera.
 */
import type {ModeCameraPose,FlightModeController,ModeHud,ModeInput,MoverBody,Vec3} from '../movers/shared/mode.ts';

export interface MoverHookHost{
  /** The runtime's body, mutated in place. */
  body:MoverBody;
  /** Terrain height (`geography.ground`). */
  ground(x:number,z:number):number;
  /** The walkable surface at or just under `y` (`geography.surface`): decks, jetties, cave floors. */
  surface?(x:number,z:number,y:number):number|null;
}
/** The figure group's transform for this frame: yaw about +y, then pitch (nose up +) and bank (right wing down +). Apply with Euler order 'YXZ'. */
export interface FigureTransform{position:Vec3;rotation:{x:number;y:number;z:number;order:'YXZ'}}
export interface MoverFrame{figure:FigureTransform;camera:ModeCameraPose;sound:string|null;hud:ModeHud;finished:boolean}
/** The walk hand-back: the touchdown blend (FLIGHT.md §4, 0.6 s) or a cut under reduced motion. */
export const MOVER_DETACH_BLEND_MS=600;

export function createMoverHook(host:MoverHookHost){
  let controller:FlightModeController|null=null;
  const place=(x:number,y:number,z:number)=>{
    const deck=host.surface?.(x,z,y+.5);
    return deck!==null&&deck!==undefined&&Number.isFinite(deck)?deck:host.ground(x,z);
  };
  return{
    attached:()=>controller,
    /** Attach a controller, or `null` to stand it down without moving the body (a reduced-motion sheet takes over). */
    attach(next:FlightModeController|null){controller=next;},
    /** One frame: update the controller, move the body to its pose, return the figure and exact camera (roll 0). */
    frame(dt:number,input:ModeInput):MoverFrame|null{
      const c=controller;if(!c)return null;
      c.update(dt,input);
      const pose=c.bodyPose(),camera=c.camera();
      host.body.x=pose.x;host.body.y=pose.y;host.body.z=pose.z;host.body.yaw=pose.yaw;
      return{
        figure:{position:[pose.x,pose.y,pose.z],rotation:{x:-(pose.pitch??0),y:pose.yaw,z:pose.bank??0,order:'YXZ'}},
        camera:{eye:[camera.eye[0],camera.eye[1],camera.eye[2]],look:[camera.look[0],camera.look[1],camera.look[2]],fov:camera.fov,roll:0},
        sound:c.sound(),hud:c.hud(),finished:c.finished?.()===true,
      };
    },
    /** Drop the body on foot at `at` (y snapped to the walkable surface there, else the ground) and say how long the walk camera blends back. */
    detach(at:{x:number;y:number;z:number;yaw:number},reducedMotion:boolean):{body:MoverBody;blendMs:number}{
      controller=null;
      host.body.x=at.x;host.body.z=at.z;host.body.y=place(at.x,at.y,at.z);host.body.yaw=at.yaw;
      return{body:{...host.body},blendMs:reducedMotion?0:MOVER_DETACH_BLEND_MS};
    },
  };
}
export type MoverHook=ReturnType<typeof createMoverHook>;
