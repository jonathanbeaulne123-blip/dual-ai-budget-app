import type {MoverBody} from '../movers/shared/mode.ts';
import type {XYZ} from '../land/interfaces.ts';
export type Perspective='activity'|'first-person'|'floating';
export const PERSPECTIVES:readonly Perspective[]=['activity','first-person','floating'];
export const perspectiveLabel=(p:Perspective)=>p==='activity'?'Activity view':p==='first-person'?'First person':'Floating view';
/** A user perspective is independent of the activity and never owns the body's movement. */
export function createPerspective(){
  let mode:Perspective='activity',viewYaw=0,pitch=-.2,distance=22;
  return{
    mode:()=>mode,
    followHeading(delta:number){if(mode==='first-person')viewYaw+=delta;},
    cycle(_body:MoverBody,eye:readonly number[],target:readonly number[]){
      mode=PERSPECTIVES[(PERSPECTIVES.indexOf(mode)+1)%PERSPECTIVES.length]!;
      viewYaw=Math.atan2(target[0]!-eye[0]!,target[2]!-eye[2]!);
      pitch=mode==='floating'?-.55:Math.max(-1.2,Math.min(1.2,Math.atan2(target[1]!-eye[1]!,Math.hypot(target[0]!-eye[0]!,target[2]!-eye[2]!))));
      return mode;
    },
    look(dx:number,dy:number){viewYaw+=dx;pitch=Math.max(-1.2,Math.min(mode==='floating'?-.1:1.2,pitch+dy));},
    zoom(delta:number){distance=Math.max(6,Math.min(80,distance*Math.exp(delta*.001)));},
    pose(body:MoverBody,blocked:(a:XYZ,b:XYZ)=>boolean,ceiling=Infinity){
      if(mode==='activity')return null;
      const yaw=viewYaw,head:XYZ=[body.x,Math.min(body.y+1.15,ceiling-.12),body.z];
      const add=(a:XYZ,b:XYZ,k:number):XYZ=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
      const direction:XYZ=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
      if(mode==='first-person')return{eye:head,target:add(head,direction,10),fov:62};
      let f=1;while(f>.02&&blocked(head,add(head,direction,-distance*f)))f-=.02;
      return{eye:add(head,direction,-distance*Math.max(0,f)),target:head,fov:55};
    },
  };
}
