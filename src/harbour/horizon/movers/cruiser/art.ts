import type {SkateJointPose} from '../../../body/figure.ts';
import * as THREE from 'three';
import type {CruiserSkin} from './tuning.ts';
import type {CruiserState} from './sim.ts';
import type {VehicleDressing} from '../shared/vehicleArt.ts';

export const CRUISER_RIDER_POSE:SkateJointPose={
  carriage:{x:0,y:0,z:0,rx:0,ry:0,rz:0},head:{x:0,y:0},
  legs:[{x:-1.05,y:.12,z:-.1,bend:1.15,foot:-.1},{x:-1.05,y:-.12,z:.1,bend:1.15,foot:-.1}],
  arms:[{x:-.9,y:0,z:-.15,bend:.5},{x:-.9,y:0,z:.15,bend:.5}],
};

/** Authored silhouettes, shared footprint. No skin-dependent collision or movement. */
export function createCruiserArt(theme:VehicleDressing='classic') {
  const root=new THREE.Group(),model=new THREE.Group();root.name='Island cruiser';root.add(model);
  let wheels:THREE.Group[]=[],skin:CruiserSkin='vespa',distance=0;
  const paint={classic:['#82b6a6','#2d4248'],taylor:['#e5aa9f','#554071'],newfoundland:['#edc25e','#285461']}[theme];
  const materials=[new THREE.MeshStandardMaterial({color:paint[0],roughness:.42}),new THREE.MeshStandardMaterial({color:paint[1],roughness:.42}),new THREE.MeshStandardMaterial({color:'#cfceba',metalness:.65,roughness:.3}),new THREE.MeshStandardMaterial({color:'#272b2c',roughness:.9}),new THREE.MeshStandardMaterial({color:'#f6df9a',emissive:'#6e5520',emissiveIntensity:.4})];
  const mesh=(g:THREE.BufferGeometry,m:number,x:number,y:number,z:number)=>{const o=new THREE.Mesh(g,materials[m]);o.position.set(x,y,z);o.castShadow=true;model.add(o);return o;};
  const box=(w:number,h:number,d:number,m:number,x:number,y:number,z:number)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const tube=(a:THREE.Vector3,b:THREE.Vector3,r:number,m=2)=>{const v=b.clone().sub(a),o=mesh(new THREE.CylinderGeometry(r,r,v.length(),8),m,...a.clone().add(b).multiplyScalar(.5).toArray() as [number,number,number]);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());};
  function clear(){model.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});model.clear();wheels=[];}
  function setSkin(next:CruiserSkin){
    skin=next;clear();const scooter=skin==='vespa';model.name=scooter?'Vespa-style scooter':'Harley-Davidson-style motorcycle';
    for(const z of [-.56,.56]) {
      const wheel=new THREE.Group();wheel.position.set(0,.25,z);model.add(wheel);wheels.push(wheel);
      const tyre=new THREE.Mesh(new THREE.TorusGeometry(.18,.065,8,16),materials[3]);tyre.rotation.y=Math.PI/2;wheel.add(tyre);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.14,12),materials[2]);hub.rotation.z=Math.PI/2;wheel.add(hub);
    }
    box(.46,.12,.47,3,0,.71,-.14); // same seat anchor for both riders
    box(.44,.09,.74,2,0,.3,0);
    if(scooter){
      const rear=mesh(new THREE.SphereGeometry(1,16,10),0,0,.48,-.4);rear.scale.set(.3,.24,.36);
      const shield=mesh(new THREE.SphereGeometry(1,16,10),0,0,.62,.39);shield.scale.set(.32,.38,.09);
      box(.47,.06,.53,3,0,.35,.04);
    }else{
      const tank=mesh(new THREE.SphereGeometry(1,16,10),1,0,.67,.17);tank.scale.set(.26,.19,.34);
      for(const sign of [-1,1]){const engine=box(.3,.27,.19,2,0,.43,sign*.13);engine.rotation.x=sign*.45;}
      tube(new THREE.Vector3(-.27,.29,-.7),new THREE.Vector3(-.27,.29,.05),.055);
      box(.35,.07,.3,1,0,.53,-.58);
    }
    for(const x of [-.1,.1])tube(new THREE.Vector3(x,.25,.56),new THREE.Vector3(x,.93,.43),.025);
    tube(new THREE.Vector3(-.33,.98,.43),new THREE.Vector3(.33,.98,.43),.025);
    for(const x of [-.3,.3]){box(.12,.045,.07,3,x,.98,.43);tube(new THREE.Vector3(x,.98,.43),new THREE.Vector3(x,1.17,.43),.012);mesh(new THREE.SphereGeometry(.065,10,6),2,x,1.17,.43).scale.z=.3;}
    mesh(new THREE.SphereGeometry(.105,12,8),4,0,.89,.51).scale.z=.55;
    root.userData.skin=skin;
  }
  setSkin(skin);
  return {root,setSkin,
    update(s:CruiserState,dt:number,quiet:boolean){root.position.set(s.x,s.y,s.z);root.rotation.set(-s.pitch,s.yaw,quiet?0:-s.lean,'YXZ');distance+=Math.hypot(s.vx,s.vz)*dt*(s.reverse?-1:1);for(const wheel of wheels)wheel.rotation.x=distance/.245;},
    dispose(){clear();materials.forEach(m=>m.dispose());root.removeFromParent();},
  };
}
