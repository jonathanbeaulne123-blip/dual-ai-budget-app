import {buildVillageLife} from "./life.ts";
import * as THREE from 'three';
import {registerPlace,placementOf,placementLift,placementToWorld,type Anchor,type PlaceHandle,type Region,type Pose} from '../scene/place.ts';
import {buildVillageBuilding,type VillageBuildingKind} from './architecture.ts';
import {VILLAGE_SITES} from './layout.ts';
import {groundHeightAt} from '../scene/ground.ts';
import {EngravedPlate} from '../court/engraved.ts';

/** The square and its seven room-sized buildings share the runtime's island. */
export const villageCourt = registerPlace({id:'court',build(scene,dressing,_reading,quality){
  const group=new THREE.Group();group.name='Little Harbour village';
  const owned:{dispose():void}[]=[], shells:ReturnType<typeof buildVillageBuilding>[]=[];
  const life=buildVillageLife(dressing,quality);group.add(life.group);
  const anchors:Anchor[]=[],regions:Region[]=[];
  const stone=new THREE.MeshStandardMaterial({color:'#b7ac92',roughness:.95});
  const wood=new THREE.MeshStandardMaterial({color:dressing.timber,roughness:.87});
  const brass=new THREE.MeshStandardMaterial({color:'#ba9959',metalness:.35,roughness:.5});
  owned.push(stone,wood,brass);
  const add=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,name:string)=>{owned.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.name=name;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const plaza=add(new THREE.CylinderGeometry(4,4,.09,quality==='full'?48:24),stone,0,0,0,'village-square');
  plaza.userData.ground=true;
  // A village fountain, independent of the Fund's real values.
  const bowl=add(new THREE.TorusGeometry(.85,.14,8,32),stone,0,.22,0,'fountain-rim');bowl.rotation.x=Math.PI/2;
  const waterMaterial=new THREE.MeshStandardMaterial({color:dressing.sea,metalness:.22,roughness:.18});owned.push(waterMaterial);
  const water=add(new THREE.CircleGeometry(.78,32),waterMaterial,0,.21,0,'fountain-water');water.rotation.x=-Math.PI/2;
  add(new THREE.CylinderGeometry(.16,.24,.75,10),stone,0,.43,0,'fountain-stem');
  add(new THREE.SphereGeometry(.2,12,8),brass,0,.9,0,'fountain-finial');
  for(const [kind,site] of Object.entries(VILLAGE_SITES)){
    const placement=placementOf(site.entry)!;
    const shell=buildVillageBuilding(kind as VillageBuildingKind,dressing,quality);
    shell.group.name=site.exterior;shell.group.position.set(site.spot[0],placementLift(placement),site.spot[1]);shell.group.rotation.y=placement.yaw;
    shell.group.userData.villageShell=true;shell.group.userData.building=kind;
    shell.group.traverse(n=>{n.userData.anchor=`visit:${site.entry}`;});
    shells.push(shell);group.add(shell.group);
    const doorstep=placementToWorld(placement,[site.door[0],.3,site.door[1]+1]);
    anchors.push({id:`visit:${site.entry}`,position:doorstep,zone:'landmark',label:`${site.name}. Walk to the door.`});
    const sign=new EngravedPlate({stone:'#f0e1c2',highlight:'#fff7df',ink:'#3e463e',size:'small',width:640,fit:true},2.3,.56);
    sign.mesh.name=`sign-${kind}`;sign.set(site.name);sign.mesh.position.set(doorstep[0],doorstep[1]+.85,doorstep[2]);sign.mesh.rotation.y=placement.yaw;sign.mesh.userData.anchor=`visit:${site.entry}`;group.add(sign.mesh);owned.push(sign);
    regions.push({id:`visit:${site.entry}`,group:'court',label:site.name,objects:[sign.mesh]});
    const roadEnd=placementToWorld(placement,[site.door[0],0,site.door[1]+1.1]);
    const distance=Math.hypot(roadEnd[0],roadEnd[2]);
    for(let n=0;n<Math.ceil(distance/.65);n++){
      const k=n/(Math.ceil(distance/.65));const x=roadEnd[0]*k,z=roadEnd[2]*k;
      if(Math.hypot(x,z)<3.4)continue;
      const paving=add(new THREE.BoxGeometry(1.35,.035,.57),stone,x,groundHeightAt(x,z)+.035,z,`${kind}-lane-${n}`);
      paving.rotation.y=Math.atan2(roadEnd[0],roadEnd[2]);paving.userData.ground=true;
    }
  }
  // Social spaces stay outdoors, with their existing destinations.
  anchors.push({id:'visit:campfire',position:[0,.5,17.5],zone:'landmark',label:'The Campfire. Walk to the waterfront.'});
  const camp=add(new THREE.TorusGeometry(.9,.12,6,20),stone,0,groundHeightAt(0,17.5)+.12,17.5,'outdoor-fire-ring');camp.rotation.x=Math.PI/2;camp.userData.anchor='visit:campfire';
  for(const x of [-1.8,1.8]){const bench=add(new THREE.BoxGeometry(.48,.23,1.8),wood,x,.33,16.8,'waterfront-bench');bench.userData.anchor='visit:campfire';}
  regions.push({id:'visit:campfire',group:'court',label:'Waterfront campfire',objects:[camp]});
  const poses:Record<string,Pose>={court:{target:[0,.7,0],r:43,theta:.28,phi:.65},'court:phone':{target:[0,.5,0],r:48,theta:.25,phi:.45},sky:{target:[0,0,0],r:37,theta:.1,phi:.36}};
  group.updateMatrixWorld(true);scene.add(group);
  let disposed=false;
  const handle:PlaceHandle & {play(id:string):string|null}={group,anchors:()=>[...anchors,...life.anchors()],regions:()=>[...regions,...life.regions()],poses:()=>poses,update(){},play:life.interact,animate(t,dt){life.animate(t,dt);for(const shell of shells)shell.animate(t,dt);water.scale.setScalar(1+Math.sin(t*1.8)*.018);return true;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();life.dispose();shells.forEach(s=>s.dispose());owned.forEach(x=>x.dispose());group.clear();}};
  return handle;
}});
