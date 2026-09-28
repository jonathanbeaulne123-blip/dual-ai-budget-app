import * as THREE from 'three';
import type {Point} from '../movers/fleet/layout.ts';

export type KitchenCameraFrame={eye:Point;target:Point;offsetY:number;width:number;height:number;work:{left:number;right:number;top:number;bottom:number}};
/** Fit the actual work area between orders and touch/chef controls, including counter tops and hats. */
export function kitchenCameraFrame(width:number,height:number,deck:boolean):KitchenCameraFrame{
 const w=Math.max(1,width),h=Math.max(1,height),phone=w<=700;
 const work={left:12,right:w-12,top:phone?270:230,bottom:h-(phone?310:170)};
 // Short landscape uses the same physical area with a smaller reserved strip.
 if(work.bottom-work.top<160){work.top=Math.min(work.top,h*.33);work.bottom=Math.max(work.bottom,h*.70);}
 const target={x:0,y:4.5,z:deck?-10.6:-7.35},camera=new THREE.PerspectiveCamera(48,w/h,.08,4500);
 const points:THREE.Vector3[]=[];
 for(const x of[-6.65,6.65])for(const z of(deck?[-19,-2.3]:[-12.2,-2.3]))for(const y of[3.85,5.8])points.push(new THREE.Vector3(x,y,z));
 let distance=18,eye={x:0,y:0,z:0},minY=0,maxY=0;
 for(let pass=0;pass<24;pass++){
  eye={x:0,y:target.y+distance*.88,z:target.z-distance*.475};camera.position.set(eye.x,eye.y,eye.z);camera.lookAt(target.x,target.y,target.z);camera.updateMatrixWorld(true);
  const projected=points.map(point=>point.clone().project(camera));
  const minX=Math.min(...projected.map(p=>p.x)),maxX=Math.max(...projected.map(p=>p.x));minY=Math.min(...projected.map(p=>p.y));maxY=Math.max(...projected.map(p=>p.y));
  const factor=Math.max((maxX-minX)*w/2/(work.right-work.left),(maxY-minY)*h/2/(work.bottom-work.top));
  if(factor<=.98)break;distance*=Math.max(1.025,factor*1.025);
 }
 const currentCenter=(1-(minY+maxY)/2)*h/2,desiredCenter=(work.top+work.bottom)/2;
 return{eye,target,offsetY:currentCenter-desiredCenter,width:w,height:h,work};
}
