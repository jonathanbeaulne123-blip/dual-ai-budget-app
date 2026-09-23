import * as THREE from 'three';
import {groundHeightAt} from '../scene/ground.ts';
import type {Anchor,PlaceDressing} from '../scene/place.ts';
import {HARBOUR_WANDERS} from './world.ts';

/** Quiet destinations beyond the village. All decoration stays outside the walkable centre. */
export function buildHarbourLandscape(dressing:PlaceDressing){
  const group=new THREE.Group();group.name='harbour-countryside';
  const owned:{dispose():void}[]=[];
  const mat=(color:string,extra:THREE.MeshStandardMaterialParameters={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.9,...extra});owned.push(m);return m;};
  const stone=mat('#b7b5a1'),timber=mat(dressing.timber),leaves=mat('#6c8b55'),fruit=mat('#bd6548'),water=mat('#86b6b6',{roughness:.2,metalness:.25}),sail=mat('#e8d5a2');
  const add=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,name:string)=>{
    owned.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,groundHeightAt(x,z)+y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  const anchors:Anchor[]=HARBOUR_WANDERS.map(wander=>({id:`wander:${wander.id}`,zone:'landscape',label:`${wander.name}. Take the path.`,position:[wander.at[0],groundHeightAt(wander.at[0],wander.at[1])+.5,wander.at[1]]}));
  // A small orchard, with the footpath between the rows.
  const orchard=HARBOUR_WANDERS[0].at;
  for(const [dx,dz] of [[-3,-2],[-3,2],[3,-2],[3,2]] as const){
    const x=orchard[0]+dx,z=orchard[1]+dz;
    add(new THREE.CylinderGeometry(.16,.24,1.8,7),timber,x,.9,z,'orchard-trunk');
    add(new THREE.IcosahedronGeometry(1.5,1),leaves,x,2.5,z,'orchard-crown');
    for(let i=0;i<3;i++)add(new THREE.SphereGeometry(.12,6,4),fruit,x+Math.cos(i*2.1)*1.2,2.2,z+Math.sin(i*2.1)*1.2,'orchard-apple');
  }
  // An open pavilion catches the horizon; the approach stays wide open.
  const lookout=HARBOUR_WANDERS[1].at;
  const deck=add(new THREE.CylinderGeometry(3.2,3.3,.08,24),stone,lookout[0],.04,lookout[1],'lookout-floor');deck.userData.ground=true;
  for(const dx of [-2.3,2.3])for(const dz of [-1.6,1.6])add(new THREE.CylinderGeometry(.11,.13,2.8,6),timber,lookout[0]+dx,1.4,lookout[1]+dz,'lookout-post');
  const roof=add(new THREE.ConeGeometry(3.8,1.1,4),sail,lookout[0],3.3,lookout[1],'lookout-canopy');roof.rotation.y=Math.PI/4;
  // The pools are shallow ground, never an invisible movement barrier.
  const pools=HARBOUR_WANDERS[2].at;
  for(let i=0;i<3;i++){
    const x=pools[0]+(i-1)*2.4,z=pools[1]+(i%2)*2.5;
    const rim=add(new THREE.TorusGeometry(.9,.18,6,18),stone,x,.08,z,'tidepool-rim');rim.rotation.x=Math.PI/2;
    const pool=add(new THREE.CircleGeometry(.9,18),water,x,.04,z,'tidepool-water');pool.rotation.x=-Math.PI/2;pool.userData.ground=true;
  }
  // A carpet of little flowers is one draw, and sways without moving the ground.
  const meadow=HARBOUR_WANDERS[3].at,flowerGeometry=new THREE.ConeGeometry(.065,.23,4);owned.push(flowerGeometry);
  const flowers=new THREE.InstancedMesh(flowerGeometry,sail,90);flowers.name='meadow-wildflowers';
  const matrix=new THREE.Matrix4();
  for(let i=0;i<90;i++){
    const angle=i*2.39996,r=2.5+Math.sqrt(i/90)*5,x=meadow[0]+Math.cos(angle)*r,z=meadow[1]+Math.sin(angle)*r;
    matrix.makeTranslation(x,groundHeightAt(x,z)+.16,z);flowers.setMatrixAt(i,matrix);
  }
  group.add(flowers);
  for(const anchor of anchors){const marker=add(new THREE.CylinderGeometry(.08,.1,.9,6),timber,anchor.position[0]+1.5,.45,anchor.position[2],`${anchor.id}-waymarker`);marker.userData.anchor=anchor.id;}
  return {group,anchors,dispose(){group.removeFromParent();flowers.dispose();owned.forEach(item=>item.dispose());group.clear();}};
}
