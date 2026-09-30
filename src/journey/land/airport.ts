import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {AIRPORT,AIRPORT_BOXES,AIRPORT_DECKS} from '../../harbour/horizon/airport/layout.ts';
import {compressHeight} from '../contracts.ts';
/** One static map mesh, shared airport coordinates; no aircraft model, clock or lamps. */
export function buildAirportMap(roof:string,road:string){
 const parts:THREE.BufferGeometry[]=[],colors:('roof'|'road')[]=[];
 function box(x:number,y:number,z:number,w:number,h:number,d:number,yaw:number,kind:'roof'|'road'){
  const g=new THREE.BoxGeometry(w,h,d).toNonIndexed();g.rotateY(yaw);g.translate(x,compressHeight(y)+1,z);parts.push(g);colors.push(kind);
 }
 for(const b of AIRPORT_BOXES)if(b.roof)box(b.x,b.y,b.z,b.w,Math.max(1,b.h),b.d,0,'roof');
 for(const d of [...AIRPORT_DECKS,{id:'strip',a:AIRPORT.runway.a,b:AIRPORT.runway.b,width:30}]){if(d.id==='roof-ramp'||d.id==='roof-link')continue;const dx=d.b[0]-d.a[0],dz=d.b[2]-d.a[2];box((d.a[0]+d.b[0])/2,(d.a[1]+d.b[1])/2,(d.a[2]+d.b[2])/2,d.width,.2,Math.hypot(dx,dz),Math.atan2(dx,dz),'road');}
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());const material=new THREE.MeshLambertMaterial({vertexColors:true});const mesh=new THREE.Mesh(geometry,material);mesh.name=AIRPORT.id;
 function recolour(r:string,p:string){const values:number[]=[];for(let i=0;i<parts.length;i++){const c=new THREE.Color(colors[i]==='roof'?r:p);for(let n=0;n<parts[i]!.getAttribute('position').count;n++)values.push(c.r,c.g,c.b);}geometry.setAttribute('color',new THREE.Float32BufferAttribute(values,3));}
 recolour(roof,road);return{mesh,recolour,dispose(){geometry.dispose();material.dispose();}};
}
