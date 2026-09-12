import * as THREE from "three";
import { nestMotif, type NestOrnament } from "./nestAppearance.ts";

/** Fired clay geometry: these cast shadows and have depth, rather than texture stickers. */
export function createNestSculptedProp(ornament: NestOrnament, fired: boolean) {
  const motif = nestMotif(ornament);
  const group = new THREE.Group();
  group.name = `nest-prop:${motif}`;
  const geometries: THREE.BufferGeometry[] = [];
  const colors = ornament.theme === "newfoundland" ? ["#356f78", "#e2bb70", "#f2e5c7"] : ornament.theme === "taylor" ? ["#a57c37", "#ded0a4", "#395f59"] : ["#61764e", "#bd8d48", "#e4cfab"];
  const materials = colors.map(color => new THREE.MeshPhysicalMaterial({ color, roughness: fired ? .23 : .86, clearcoat: fired ? 1 : 0, metalness: .03 }));
  const mesh = (geometry: THREE.BufferGeometry, position: [number, number, number], color = 0) => {
    geometries.push(geometry);
    const object = new THREE.Mesh(geometry, materials[color]);
    object.position.set(...position); object.castShadow = true; object.receiveShadow = true; group.add(object); return object;
  };
  const polygon = (points: [number,number][], color=0, z=0) => {
    const shape = new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
    return mesh(new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,steps:1}),[0,0,z],color);
  };
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,color=0)=>mesh(new THREE.BoxGeometry(w,h,d),[x,y,z],color);
  const orb=(r:number,x:number,y:number,z:number,color=0)=>mesh(new THREE.SphereGeometry(r,18,12),[x,y,z],color);
  const ring=(r:number,t:number,x:number,y:number,z:number,color=0)=>mesh(new THREE.TorusGeometry(r,t,12,32),[x,y,z],color);
  if (motif === "crown") {
    const rim=mesh(new THREE.TorusGeometry(.34,.075,12,32),[0,.07,0],1);rim.rotation.x=Math.PI/2;
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const point=mesh(new THREE.ConeGeometry(.12,.33,5),[Math.sin(a)*.3,.22,Math.cos(a)*.3],1);point.rotation.z=-Math.sin(a)*.1;orb(.055,Math.sin(a)*.3,.39,Math.cos(a)*.3,2);}
  } else if(motif === "shield") { polygon([[-.35,.35],[0,.48],[.35,.35],[.29,-.08],[0,-.44],[-.29,-.08]]);box(.1,.47,.08,0,.04,.21,1);box(.37,.1,.08,0,.08,.21,1); }
  else if(motif === "cup") {mesh(new THREE.CylinderGeometry(.3,.24,.53,24),[0,0,0],2);ring(.19,.055,.32,.02,0,1);}
  else if(motif === "sprout") {box(.06,.66,.08,0,0,0);const a=orb(.22,-.16,.15,0);a.scale.set(1.4,.6,.5);a.rotation.z=-.5;const b=orb(.22,.17,.33,0);b.scale.set(1.4,.6,.5);b.rotation.z=.5;}
  else if(motif === "clock" || motif === "sun") {ring(.31,.065,0,0,0,1);if(motif==="clock"){box(.035,.25,.06,0,.1,.08,0);const hand=box(.035,.22,.06,.075,-.04,.08,0);hand.rotation.z=-1;}else for(let i=0;i<8;i++){const a=i*Math.PI/4;const ray=box(.045,.14,.075,Math.sin(a)*.44,Math.cos(a)*.44,0,1);ray.rotation.z=-a;}}
  else if(motif === "star") {polygon(Array.from({length:10},(_,i)=>{const a=i*Math.PI/5,r=i%2?.18:.43;return [Math.sin(a)*r,Math.cos(a)*r] as [number,number];}),1);}
  else if(motif === "flower") {for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const petal=orb(.18,Math.sin(a)*.24,Math.cos(a)*.24,0,2);petal.scale.z=.45;}orb(.12,0,0,.1,1);}
  else if(motif === "guitar") {const a=orb(.24,-.11,-.19,0,1);a.scale.set(1,.9,.38);const b=orb(.18,.04,.02,0,1);b.scale.z=.4;const neck=box(.08,.53,.08,.18,.25,0,0);neck.rotation.z=-.38;orb(.07,-.03,-.06,.105,0);}
  else if(motif === "lighthouse") {mesh(new THREE.CylinderGeometry(.16,.24,.65,16),[0,0,0],2);mesh(new THREE.CylinderGeometry(.2,.2,.14,16),[0,.33,0],0);mesh(new THREE.ConeGeometry(.26,.2,16),[0,.49,0],1);ring(.17,.055,0,-.08,.15,0);}
  else if(motif === "rowhouse") {box(.55,.5,.24,0,-.05,0,0);polygon([[-.34,.2],[0,.5],[.34,.2]],1,.05);for(const x of [-.15,.15])box(.1,.12,.06,x,.02,.16,2);box(.12,.2,.06,0,-.2,.16,1);}
  else if(motif === "sailboat") {polygon([[-.46,-.22],[.42,-.22],[.28,-.43],[-.3,-.43]],0);box(.04,.85,.05,0,.06,.04,1);polygon([[-.04,.45],[-.04,-.15],[-.36,-.15]],2);polygon([[.04,.3],[.04,-.15],[.34,-.15]],1);}
  else if(motif === "lifering") {ring(.32,.11,0,0,0,2);for(const [x,y] of [[-.23,.23],[.23,.23],[-.23,-.23],[.23,-.23]]){const stripe=box(.19,.14,.2,x!,y!,0,0);stripe.rotation.z=x!*y!>0?-.75:.75;}}
  return {group,dispose:()=>{group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
