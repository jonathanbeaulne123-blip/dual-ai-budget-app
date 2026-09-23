import * as THREE from 'three';
import {registerPlace,type PlaceHandle,type Region,type Anchor} from '../scene/place.ts';
import {buildBankHall} from './architecture.ts';
import {buildBankDetails} from './bankDetails.ts';

export type QueenHost = PlaceHandle & {attachQueen(object:THREE.Object3D,regions?:()=>Region[]):void;detachQueen():THREE.Object3D|null};
export const bankPlace=registerPlace({id:'bank',build(scene,dressing,_reading,tier){
  const art=buildBankHall(dressing,tier);const group=art.group,details=buildBankDetails(dressing,tier);group.add(details.group);
  const queenSlot=new THREE.Group();queenSlot.name='The Queen in the banking hall';queenSlot.position.set(0,.16,.8);group.add(queenSlot);
  let queenRegions:(()=>Region[])|null=null;
  const exit:Anchor={id:'village-exit',position:[0,0,3.35],zone:'stair',label:'Step outside to the village'};
  scene.add(group);
  return {group,update(){},animate(t,dt){return Boolean(art.animate(t,dt)||details.animate(t));},dispose(){details.dispose();art.dispose();},
    anchors:()=>[...art.anchors(),exit],regions:()=>[...art.regions(),...(queenRegions?.()??[])],
    poses:()=>({court:{target:[0,1,-.25],r:9.6,theta:0,phi:.83},'court:phone':{target:[0,1,-.2],r:9.4,theta:.06,phi:.7},'object:queen':{target:[0,1.2,.8],r:4.4,theta:.12,phi:1.05}}),
    attachQueen(object:THREE.Object3D,regions?:()=>Region[]){queenSlot.clear();queenSlot.add(object);queenRegions=regions?()=>regions().map(r=>({...r,box:r.box?.clone().translate(queenSlot.position)})):null;},
    detachQueen(){const object=queenSlot.children[0]??null;queenSlot.clear();queenRegions=null;return object;},
  } satisfies QueenHost;
}});
