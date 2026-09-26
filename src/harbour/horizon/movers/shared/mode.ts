/**
 * The mover interface (HANDOFF-notes/mover-interface.md, materialised verbatim by track I).
 * Pure types: no three, no DOM. Every Horizon mover (M1 board … M9) codes against this file.
 */
import type {XYZ} from './ground/types.ts';
import type {ThresholdOffer} from './threshold.ts';
export type {ThresholdOffer} from './threshold.ts';

export type ModeId = 'feet'|'board'|'bicycle'|'gondola'|'cart'|'zip'|'glider'|'parachute'|'plane'|'balloon'|'row'|'canoe'|'dinghy'|'ferry';
export type MoverBody = {x:number;y:number;z:number;yaw:number};
/** What the runtime hands a mover every frame. Already merged from keys, pads and gamepad by the runtime. */
export interface MoverInput {
  steer:number;      // -1..1, +1 = right (D / pad right / stick right)
  forward:number;    // -1..1 (W / pad up = +1; S / pad down = -1) — the board reads push = forward>0.3, slide = forward<-0.3
  jump:boolean;      // Space / Jump bubble (edge-or-hold; the mover decides)
  sprint:boolean;    // Shift / R3
  crouch:number;     // 0..1 (held Space charge, arrows-down, etc.; 0 if the runtime has nothing)
  accept:boolean;    // E / the Enter bubble (edge)
  look:{dx:number;dy:number}; // pointer / Look pad deltas this frame (radians), consumed by the mover's camera if it wants free look
}
export interface MoverPose { lean:number; roll:number; pitch:number; crouch:number; slide:number; speed:number;  // radians / 0..1 / m/s; the figure reads it
  /** Additive (track I, fix round): the travel direction minus the board's nose heading (`body.yaw`), radians about +y, wrapped to ±π
   *  (+ = the travel is toward increasing heading, i.e. to the rider's right; riding fakie reads near ±π; 0 when stopped).
   *  The runtime faces the figure along the travel and turns the deck by −slip under it. Optional: absent, the runtime derives it from `state()` when the controller exposes one. */
  slip?:number }
export interface MoverHud { pace:string|null; arc:number; glyph:'push'|'park'|'pickup'|'offline'|null; label:string|null }  // one bubble (RIDE §10.4)
export interface MoverSound { slide:number; roll:number; bite:boolean; boost:boolean }  // 0..1 intensities; the runtime/audio decides how
export interface MoverFrame {
  body:MoverBody;                                   // where the rider is now (the runtime publishes it as the body)
  camera:{eye:XYZ;target:XYZ;fov:number}|null;      // null = keep the runtime's walk camera
  pose:MoverPose; hud:MoverHud; sound:MoverSound;
  fade:{to:MoverBody;label:string}|null;            // a 300 ms fade the runtime performs (water / off-bed return); the mover already moved its state
  events:string[];                                  // for logs and tests
}
export interface ModeController {
  readonly id:ModeId;
  enter(offer:ThresholdOffer, body:MoverBody, now:number):void;
  update(dt:number, input:MoverInput, now:number):MoverFrame;
  exit(offer:ThresholdOffer|null):MoverBody;        // where the rider stands on foot afterwards
  reducedMotion(on:boolean):void; calm(on:boolean):void; tier(t:'full'|'lite'):void;
  dispose():void;
}

export const MODE_IDS:readonly ModeId[] = ['feet','board','bicycle','gondola','cart','zip','glider','parachute','plane','balloon','row','canoe','dinghy','ferry'];
export const isModeId = (value:string):value is ModeId => (MODE_IDS as readonly string[]).includes(value);
