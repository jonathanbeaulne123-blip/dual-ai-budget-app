/**
 * The seam every Horizon mover implements (passes/02-movers.md, FLIGHT.md §9).
 * Pure types and constants: no scene, renderer or runtime import, so simulation
 * modules and headless tests can depend on it freely.
 */
import type {Threshold} from '../../world/definition.ts';

/** Fourteen ways to be on the island. `feet` is the runtime's own walk and never has a controller. */
export type ModeId='feet'|'board'|'bicycle'|'gondola'|'cart'|'zip'|'glider'|'parachute'|'plane'|'balloon'|'row'|'canoe'|'dinghy'|'ferry';
export const MODE_IDS:readonly ModeId[]=['feet','board','bicycle','gondola','cart','zip','glider','parachute','plane','balloon','row','canoe','dinghy','ferry'];
export function isModeId(value:unknown):value is ModeId{return typeof value==='string'&&(MODE_IDS as readonly string[]).includes(value);}

/**
 * One frame of player intent, already merged from keyboard, the two touch pads and any HUD bubble.
 * Numbers are -1…1, booleans are held/pressed.
 * - `forward` / `strafe`: the raw Move pad / W S and D A axes (+ forward, + right).
 * - `bar`: +1 = pulled in (W, pad forward: faster), -1 = pushed out (S, pad back: slower / flare). Equals `forward` unless a HUD sets it.
 * - `bank`: +1 = right (D, pad right), -1 = left (A, pad left). Equals `strafe` unless a HUD sets it.
 * - `run`: Shift / the run toggle.
 * - `pull`: Space held, or the Pull bubble pressed this frame (the controller decides edge vs hold).
 * - `look`: this frame's free-look delta in radians `[yaw, pitch]` from pointer drag or the Look pad; never steers.
 * - `fold`: the Fold bubble was pressed this frame (land now; FLIGHT.md §2.4). Optional so older controllers ignore it.
 */
export interface ModeInput{forward:number;strafe:number;run:boolean;bar:number;bank:number;pull:boolean;look:readonly [number,number];fold?:boolean}
export const IDLE_INPUT:ModeInput=Object.freeze({forward:0,strafe:0,run:false,bar:0,bank:0,pull:false,look:[0,0] as const});

export type Vec3=readonly [number,number,number];
/** Engine-space camera pose. `roll` is always 0: every mover camera is horizon-locked (FLIGHT.md §4). */
export interface ModeCameraPose{eye:Vec3;look:Vec3;fov:number;roll:0}
/**
 * The body in engine units. `yaw` follows the runtime's convention: `atan2(dx, dz)`, 0 faces +z (south).
 * `pitch` (nose up +) and `bank` (right wing down +) are radians and rotate the figure group when present.
 */
export interface MoverBody{x:number;y:number;z:number;yaw:number}
export interface ModeBodyPose extends MoverBody{pitch?:number;bank?:number}
/**
 * Where the body stands when a mode ends: always on foot. `cut` asks the runtime for a cut to the walk camera
 * instead of the blend (every fade, FLIGHT.md §4); `label` is the fade's place ("→ the square") for the HUD.
 */
export interface ModeExit{at:Vec3;yaw:number;cut?:boolean;label?:string}
/** A reduced-motion destination offered by the launch sheet (FLIGHT.md §6). `xy` is engine x/z. */
export interface ReducedMotionLanding{id:string;label:string;xy:readonly [number,number];height?:number}
export interface ReducedMotionCut{landings:ReducedMotionLanding[]}
/** Screen-space HUD data (FLIGHT.md §7). The stage renders it; nothing is world-space. */
export interface ModeHud{height?:number;lift?:number;place?:{label:string;distance:number;action:'fold'|'pull'|'gate'}}

/**
 * One mode of movement. The registry holds at most one active controller; the runtime's
 * mover hook drives it each frame while attached.
 */
export interface ModeController{
  readonly id:ModeId;
  /** Called once when the threshold offer is accepted; the body is where the rider stands (or sits) now. */
  enter(threshold:Threshold,body:MoverBody):void;
  update(dt:number,input:ModeInput):void;
  /** Ends the mode and says where the body stands on foot. Called by the registry/runtime, never mid-frame by the controller. */
  exit():ModeExit;
  bodyPose():ModeBodyPose;
  camera():ModeCameraPose;
  /** The one on-purpose sound this frame (`MOVER_SOUNDS`), or null. */
  sound():string|null;
  reducedMotionCut():ReducedMotionCut;
  hud():ModeHud;
  /** Optional: true once the mode has ended itself (a landing, a fade). The runtime then calls `exit()` and returns to feet. */
  finished?():boolean;
}

/** Sound ids the runtime knows how to play through `mountain/audio.ts`. */
export const MOVER_SOUNDS={snap:'snap',splashEcho:'splashEcho',bell:'bell'} as const;
