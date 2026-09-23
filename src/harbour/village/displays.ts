import * as THREE from 'three';
import {createKittySculpture} from '../../kitty/sculpture.ts';
import type {KittyPieceV1} from '../../core/types.ts';
import type {NestOrnament} from '../../kitty/nestAppearance.ts';
import {EngravedPlate} from '../court/engraved.ts';
import type {Anchor,PlaceDressing,Region} from '../scene/place.ts';
export type VillageDisplayContent={kind:'piece';id:string;designId:string;piece:KittyPieceV1;appearance?:NestOrnament}|{kind:'memory';id:string;title:string};
/** Exact approved objects only; callers clear the shelf synchronously when eligibility changes. */
export function buildVillageDisplays(dressing:PlaceDressing){
 const group=new THREE.Group();group.name='Shared display shelf';
 let owned:{dispose():void}[]=[],anchors:Anchor[]=[],regions:Region[]=[];
 const clear=()=>{owned.forEach(o=>o.dispose());owned=[];group.clear();anchors=[];regions=[];};
 return {group,anchors:()=>anchors,regions:()=>regions,show(contents:VillageDisplayContent[]){clear();contents.slice(0,2).forEach((item,i)=>{
  const x=2.85,z=.1+i*1.35,id=`shared-display:${i}`;
  const geometry=new THREE.CylinderGeometry(.48,.5,.65,12),material=new THREE.MeshStandardMaterial({color:dressing.timber,roughness:.8});owned.push(geometry,material);const stand=new THREE.Mesh(geometry,material);stand.position.set(x,.33,z);group.add(stand);
  if(item.kind==='piece'){const sculpture=createKittySculpture(item.piece,{brass:dressing.metal,wood:dressing.timber,reducedMotion:true,ornament:item.appearance});sculpture.group.scale.setScalar(.48);sculpture.group.position.set(x,.67,z);group.add(sculpture.group);owned.push(sculpture);sculpture.group.traverse(n=>{n.userData.anchor=id;});}
  else {const plate=new EngravedPlate({stone:dressing.stone,ink:'#293c34',width:640,fit:true,size:'small'},.85,.58);plate.set(item.title);plate.mesh.position.set(x,1.05,z);plate.mesh.userData.anchor=id;group.add(plate.mesh);owned.push(plate);}
  anchors.push({id,position:[x,1,z],zone:'display',label:item.kind==='memory'?item.title:'Your shared artwork',door:item.kind==='piece'?{target:'pottery',object:`piece/${item.id}/${item.designId}`}:{target:'memories',object:`memory/${item.id}`}});
  regions.push({id,group:'display',label:anchors.at(-1)!.label,box:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x,.75,z),new THREE.Vector3(1,1.5,1))});
 });},dispose(){clear();group.removeFromParent();}};
}
