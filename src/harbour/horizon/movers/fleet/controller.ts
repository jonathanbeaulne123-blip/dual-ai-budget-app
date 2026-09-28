import type {ModeController,MoverBody,MoverFrame} from '../shared/mode.ts';
import {HANDLING,type CraftId,type Fleet} from './model.ts';
/** The runtime steps the fleet once. This adapter only owns input and the seated body. */
export function createWatercraftController(fleet:Fleet,id:CraftId):ModeController{
 let last:MoverBody=fleet.seatBody(fleet.get(id));
 return{id,enter(){last=fleet.seatBody(fleet.get(id));},
  update(_dt,input):MoverFrame{fleet.drive(id,input);const v=fleet.get(id);last=fleet.seatBody(v);return{body:last,camera:null,pose:{lean:0,roll:0,pitch:0,crouch:0,slide:0,speed:Math.abs(v.speed)},hud:{pace:`${Math.round(Math.abs(v.speed)*3.6)} km/h`,arc:0,glyph:null,label:HANDLING[id].label},sound:{slide:0,roll:0,bite:false,boost:false},fade:null,events:[]};},
  exit(){fleet.stopDriving();return last;},reducedMotion(){},calm(){},tier(){},dispose(){fleet.resetInput();},
 };
}
