import {buildMountainLandscape} from '../mountain/landscape.ts';
import type {Point3} from '../mountain/definition.ts';
import {createVillagePartner} from '../presence/villagePartner.ts';
import {buildVillageLife} from "./life.ts";
import * as THREE from 'three';
import {registerPlace,placementOf,placementLift,placementToWorld,type Anchor,type PlaceHandle,type Region,type Pose} from '../scene/place.ts';
import {buildVillageBuilding,type VillageBuildingKind} from './architecture.ts';
import {VILLAGE_SITES,VILLAGE_WATERFRONT} from './layout.ts';
import {groundHeightAt} from '../scene/ground.ts';
import {EngravedPlate} from '../court/engraved.ts';
import {HARBOUR_WANDERS} from './world.ts';
import {buildHarbourLandscape} from './landscape.ts';
import {buildHarbourLanes} from './lanes.ts';

/** The square and its seven room-sized buildings share the runtime's island. */
export const villageCourt = registerPlace({id:'court',build(scene,dressing,_reading,quality){
  const group=new THREE.Group();group.name='Little Harbour village';
  const owned:{dispose():void}[]=[], shells:ReturnType<typeof buildVillageBuilding>[]=[];
  const mountain=buildMountainLandscape(dressing,quality,_reading);group.add(mountain.group);
  const partner=createVillagePartner(dressing,_reading);group.add(partner.group);
  const life=buildVillageLife(dressing,quality);group.add(life.group);
  const landscape=buildHarbourLandscape(dressing);group.add(landscape.group);
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
  }
  const lanes=buildHarbourLanes(stone);owned.push(lanes.geometry);group.add(lanes);
  // Social spaces stay outdoors, with their existing destinations.
  const [shoreX,shoreZ]=VILLAGE_WATERFRONT.spot;
  const waterfront=new THREE.Group();waterfront.name='village-waterfront';group.add(waterfront);
  anchors.push({id:'visit:campfire',position:[shoreX,.5,shoreZ],zone:'landmark',label:'The Campfire. Walk to the waterfront.'});
  const camp=add(new THREE.TorusGeometry(.9,.12,6,20),stone,shoreX,groundHeightAt(shoreX,shoreZ)+.12,shoreZ,'outdoor-fire-ring');camp.rotation.x=Math.PI/2;camp.userData.anchor='visit:campfire';waterfront.add(camp);
  for(const x of [-1.8,1.8]){const bench=add(new THREE.BoxGeometry(.48,.23,1.8),wood,shoreX+x,groundHeightAt(shoreX+x,shoreZ-.7)+.33,shoreZ-.7,'waterfront-bench');bench.userData.anchor='visit:campfire';waterfront.add(bench);}
  regions.push({id:'visit:campfire',group:'court',label:'Waterfront campfire',objects:[camp]});
  const poses:Record<string,Pose>={court:{target:[.95,.85,5.1],r:9,theta:.15,phi:1.22},'court:phone':{target:[.95,.8,5.1],r:11,theta:.15,phi:1.17},sky:{target:[0,42,-122],r:390,theta:.18,phi:1.08}};
  group.updateMatrixWorld(true);scene.add(group);
  let disposed=false,calm=false;
  const handle:PlaceHandle & {play(id:string):string|null;setTransit(at:Point3|null):void;setCalm(on:boolean):void;setVisitor(at:Point3):void}={group,setTransit:mountain.setTransit,setVisitor:mountain.setVisitor,setCalm(on){calm=on;mountain.setCalm(on);},anchors:()=>[...mountain.anchors,...anchors,...life.anchors(),...landscape.anchors],regions:()=>[...mountain.regions,...regions,...life.regions()],poses:()=>poses,update(reading){partner.update(reading);mountain.update(reading);},play:id=>HARBOUR_WANDERS.find(w=>`wander:${w.id}`===id)?.words??life.interact(id),animate(t,dt){mountain.animate(t,dt);partner.animate(t,dt);if(!calm){life.animate(t,dt);for(const shell of shells)shell.animate(t,dt);water.scale.setScalar(1+Math.sin(t*1.8)*.018);}return true;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();mountain.dispose();life.dispose();partner.dispose();landscape.dispose();shells.forEach(s=>s.dispose());owned.forEach(x=>x.dispose());group.clear();}};
  return handle;
}});
