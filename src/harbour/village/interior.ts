import {buildVillageDisplays,type VillageDisplayContent} from "./displays.ts";
import * as THREE from 'three';
import {PLACES,type Anchor,type PlaceHandle,type PlaceReading,type Region} from '../scene/place.ts';
import type {HarbourPlaceId} from '../flag.ts';
import {ROOM_PORTALS} from './layout.ts';
import {buildHomeFittings} from './architecture.ts';
import {buildRoomPlaything,type PlaythingRoom} from './playthings.ts';
import {buildRoomDressing,type RoomLook} from './roomDressing.ts';
import {buildCellarDetails} from './cellarDetails.ts';

export type VillageInterior=PlaceHandle & {play?:(id:string)=>string|null;decorate?:(look:RoomLook|null)=>void;display?:(contents:VillageDisplayContent[])=>void};
const prepared=new WeakSet<object>();

/** Adapt existing functional rooms without replacing their readings or tools. */
export function prepareVillageInterior(id:HarbourPlaceId):void{
  const original=PLACES[id];if(!original||prepared.has(original)||id==='court')return;
  const wrapped={...original,build:((scene,dressing,reading,tier,context)=>{
    const base=original.build(scene,dressing,reading,tier,context);
    const owned:{dispose():void}[]=[];
    const fixtures=new THREE.Group();fixtures.name='Village room furnishings';base.group.add(fixtures);
    const timber=new THREE.MeshStandardMaterial({color:dressing.timber,roughness:.8}),brass=new THREE.MeshStandardMaterial({color:'#ba9456',metalness:.3,roughness:.4});owned.push(timber,brass);
    const anchors:Anchor[]=[],regions:Region[]=[];
    const add=(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,name:string)=>{owned.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.name=name;mesh.castShadow=tier==='full';mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    if(id==='cellar'){
      // Open the existing vaulted room as a house cutaway, retaining its real jar rail.
      for(const name of ['cellar-walls','cellar-mortar','cellar-soffit','cellar-vault','cellar-ribs','cellar-stair','cellar-handrail']){const part=base.group.getObjectByName(name);if(part)part.visible=false;}
      const stone=new THREE.MeshStandardMaterial({color:dressing.stone,roughness:.95});owned.push(stone);
      add(fixtures,new THREE.BoxGeometry(9,2.15,.18),stone,0,1.075,-3.4,'cellar-cutaway-back');
      for(const x of [-4.4,4.4])add(fixtures,new THREE.BoxGeometry(.18,2.15,6.8),stone,x,1.075,0,'cellar-cutaway-side');
      const details=buildCellarDetails(dressing,tier);fixtures.add(details.group);owned.push(details);
      details.group.children.forEach((part,index)=>{
        if(!(part instanceof THREE.Mesh)||!part.name.startsWith('cellar-side-'))return;
        part.updateMatrix();part.geometry.computeBoundingBox();
        if(part.geometry.boundingBox)regions.push({id:`cellar-store-${index}`,group:'furniture',label:'Cellar stores',box:part.geometry.boundingBox.clone().applyMatrix4(part.matrix)});
      });
    }
    let fittings:ReturnType<typeof buildHomeFittings>|null=null;
    if(id==='kitchen'){fittings=buildHomeFittings(id,dressing,tier);fixtures.add(fittings.group);}
    const portals=ROOM_PORTALS[id]??[];
    for(const portal of portals){
      const stair=new THREE.Group();stair.name=portal.label;stair.position.set(...portal.at);fixtures.add(stair);
      const rising=portal.id.includes('up');
      for(let i=0;i<7;i++)add(stair,new THREE.BoxGeometry(.8,.13,.2),timber,0,.06+i*.13,(rising?-1:1)*i*.16,`${portal.id}-tread-${i}`);
      for(const side of [-1,1])add(stair,new THREE.CylinderGeometry(.025,.025,1.15,6),brass,side*.43,.55,0,`${portal.id}-rail`);
      stair.traverse(n=>{n.userData.anchor=portal.id;});
      anchors.push({id:portal.id,position:portal.at,zone:'portal',label:portal.label});regions.push({id:portal.id,group:'court',label:portal.label,objects:[stair]});
    }
    const plaything=buildRoomPlaything(id as PlaythingRoom,dressing,tier);fixtures.add(plaything.group);
    const display=buildVillageDisplays(dressing);fixtures.add(display.group);
    const furniture=buildRoomDressing(id as PlaythingRoom,dressing,tier);fixtures.add(furniture.group);
    // Keep secondary furnishings away from the cellar stair and existing workstations.
    if(id==='cellar')furniture.group.position.set(-1.3,0,-.2);
    if(id==='bank')furniture.group.position.set(4.8,0,-.5);
    if(id==='cottage'||id==='kiln'||id==='library'){furniture.group.scale.setScalar(.72);furniture.group.position.z=-.4;}
    let disposed=false;
    const originalAnchors=base.anchors.bind(base),originalRegions=base.regions.bind(base),originalAnimate=base.animate.bind(base),originalUpdate=base.update.bind(base),originalDispose=base.dispose.bind(base),originalPoses=base.poses.bind(base);
    const oldWays=new Set(originalAnchors().filter(a=>portals.length&&(a.zone==='stair'||a.zone==='portal')).map(a=>a.id));
    const furnitureRegions=():Region[]=>{
      base.group.updateWorldMatrix(true,true);
      const inverse=base.group.matrixWorld.clone().invert(),result:Region[]=[];
      furniture.group.traverse(part=>{
        if(!part.name.endsWith('-group')&&!part.name.endsWith('-living-plant'))return;
        const box=new THREE.Box3();part.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.computeBoundingBox();if(child.geometry.boundingBox)box.union(child.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,child.matrixWorld)));}});
        result.push({id:`furniture:${part.name}`,group:'furniture',label:'Room furniture',box});
      });return result;
    };
    const allAnchors=()=>[...originalAnchors().filter(a=>!(portals.length&&(a.zone==='stair'||a.zone==='portal'))), ...anchors,...plaything.anchors(),...display.anchors()];
    return Object.assign(base,{
      anchors:allAnchors,regions:()=>[...originalRegions().filter(r=>!oldWays.has(r.id)),...regions,...plaything.regions(),...display.regions(),...furnitureRegions()],
      poses:()=>({...originalPoses(),...(id==='cellar'?{'cellar:desktop':{target:[0,1,-.6] as const,r:10.2,theta:.08,phi:.86},'cellar:phone':{target:[0,1,-.8] as const,r:11.8,theta:.08,phi:.68}}:id==='glasshouse'?{'glasshouse:desktop':{target:[0,.8,-.55] as const,r:8.1,theta:.08,phi:.95},'glasshouse:phone':{target:[0,1,-.55] as const,r:10.5,theta:.03,phi:.9}}:{})}),
      update(next:PlaceReading|null){originalUpdate(next);},
      display(contents:VillageDisplayContent[]){display.show(contents);context.invalidate();},
      play:plaything.interact,
      decorate(look:RoomLook|null){furniture.apply(look);context.invalidate();},
      animate(t:number,dt:number){const moved=originalAnimate(t,dt);fittings?.animate(t,dt);return plaything.animate(t,dt)||moved;},
      dispose(){if(disposed)return;disposed=true;display.dispose();plaything.dispose();furniture.dispose();fittings?.dispose();owned.forEach(o=>o.dispose());fixtures.removeFromParent();originalDispose();},
    }) as VillageInterior;
  }) satisfies NonNullable<typeof original>['build']};
  prepared.add(wrapped);PLACES[id]=wrapped;
}
