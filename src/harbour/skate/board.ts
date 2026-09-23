import * as THREE from 'three';
import {SKATE_DECKS,type SkateDeckId} from './park.ts';

/** A complete original deck, grip, kicked ends, trucks and four rolling wheels. */
export function createSkateboard(deck:SkateDeckId='tideline'){
  const group=new THREE.Group();group.name='Harbour skateboard';
  const owned:{dispose():void}[]=[];
  const mat=(colour:string,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color:colour,roughness:metalness?.32:.8,metalness});owned.push(m);return m;};
  const colour=mat(SKATE_DECKS.find(d=>d.id===deck)!.colour),grip=mat('#202d32'),wood=mat('#d4b68b'),metal=mat('#b6c7c7',.75),urethane=mat('#f3e6c6');
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,parent=group)=>{owned.push(g);const node=new THREE.Mesh(g,m);node.position.set(x,y,z);node.castShadow=true;node.receiveShadow=true;parent.add(node);return node;};
  mesh(new THREE.BoxGeometry(.32,.028,.82),wood,0,.095,0);
  mesh(new THREE.BoxGeometry(.322,.012,.82),colour,0,.074,0);
  mesh(new THREE.BoxGeometry(.3,.008,.79),grip,0,.114,0);
  for(const sign of [-1,1]){
    const end=mesh(new THREE.BoxGeometry(.3,.025,.16),colour,0,.119,sign*.47);end.rotation.x=-sign*.25;
    const tape=mesh(new THREE.BoxGeometry(.282,.005,.15),grip,0,.137,sign*.47);tape.rotation.x=-sign*.25;
    mesh(new THREE.BoxGeometry(.21,.045,.055),metal,0,.055,sign*.29);
  }
  // Inlaid stripe and brass bolts keep the top readable from the chase camera.
  mesh(new THREE.BoxGeometry(.028,.004,.73),colour,.07,.12,0);
  for(const z of [-.3,.3])for(const x of [-.09,.09])mesh(new THREE.CylinderGeometry(.012,.012,.005,6),metal,x,.122,z);
  const wheels:THREE.Mesh[]=[];
  for(const z of [-.29,.29])for(const x of [-.16,.16]){const wheel=mesh(new THREE.CylinderGeometry(.045,.045,.045,12),urethane,x,.046,z);wheel.rotation.z=Math.PI/2;wheels.push(wheel);}
  // The island's people are 1.25 m tall; keep the board in their scale.
  for(const child of group.children){child.position.z*=.65;child.scale.z*=.65;}
  return {group,setDeck(id:SkateDeckId){colour.color.set(SKATE_DECKS.find(d=>d.id===id)?.colour??'#43c7b6');},
    pose(speed:number,dt:number,act:string,p:number,pitch=0,bank=0){
      group.rotation.set(pitch,0,bank*.12);
      if(act==='skate-kickflip')group.rotation.z+=p*Math.PI*2;
      if(act==='skate-heelflip')group.rotation.z-=p*Math.PI*2;
      if(act==='skate-shuvit')group.rotation.y=p*Math.PI;
      if(act==='skate-360-flip'){group.rotation.y=p*Math.PI*2;group.rotation.z=p*Math.PI*2;}
      if(act==='skate-manual')group.rotation.x=-.17;
      if(act==='skate-grab')group.rotation.z=.25*Math.sin(p*Math.PI);
      for(const wheel of wheels)wheel.rotation.x+=speed*dt/.045;
    },dispose(){group.removeFromParent();owned.forEach(o=>o.dispose());group.clear();}};
}
