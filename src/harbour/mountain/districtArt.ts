import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {PlaceDressing} from '../scene/place.ts';
import type {RenderTier} from '../scene/quality.ts';
import {BASIN,FOOTPATHS,RESERVED_PLOTS,SKILL_BRANCHES,RIVER,nearestOnRoute,mountainBaseHeight,type District,type Point3} from './definition.ts';

/** Neighbourhood detail can be released while permanent terrain and destinations remain. */
export function buildDistrictArt(d:District,dressing:PlaceDressing,tier:RenderTier){
  const group=new THREE.Group();group.name=`${d.name} close detail`;
  const owned:{dispose():void}[]=[],batches=new Map<string,{material:THREE.Material;parts:THREE.BufferGeometry[]}>();
  const colours={wood:dressing.timber,stone:dressing.stone,leaf:dressing.lawn,light:dressing.plinth,trim:dressing.gate,
    blossom:dressing.theme==='taylor'?'#d8a2b7':dressing.theme==='newfoundland'?'#c4c0de':'#e8cc90',birch:dressing.theme==='newfoundland'?'#afbcb3':'#ede4ce'};
  const pose=new THREE.Object3D();
  function part(g:THREE.BufferGeometry,colour:string,at:Point3,scale:Point3=[1,1,1],rotation:Point3=[0,0,0]){
    let batch=batches.get(colour);if(!batch){const material=new THREE.MeshStandardMaterial({color:colour,roughness:.86,flatShading:true});owned.push(material);batch={material,parts:[]};batches.set(colour,batch);}
    pose.position.set(...at);pose.scale.set(...scale);pose.rotation.set(...rotation);pose.updateMatrix();
    const plain=g.index?g.toNonIndexed():g;if(plain!==g)g.dispose();plain.applyMatrix4(pose.matrix);batch.parts.push(plain);
  }
  const box=(at:Point3,size:Point3,colour=colours.wood)=>part(new THREE.BoxGeometry(...size),colour,at);
  const rock=(x:number,z:number,size:number,colour=colours.stone)=>part(new THREE.IcosahedronGeometry(1,0),colour,[x,mountainBaseHeight(x,z)+size*.25,z],[size,size*.6,size*.8],[.1,x*.17,.2]);
  const cylinder=(at:Point3,r:number,h:number,colour=colours.wood)=>part(new THREE.CylinderGeometry(r,r,h,6),colour,at);
  const clear=(x:number,z:number)=>Math.hypot(x-(cx-7),z-(cz+6))>8&&nearestOnRoute(x,z).distance>7&&nearestOnRoute(x,z,RIVER).distance>4&&Math.hypot(x-BASIN.x,z-BASIN.z)>BASIN.radius+3&&
    FOOTPATHS.every(p=>nearestOnRoute(x,z,p.points).distance>3)&&SKILL_BRANCHES.every(p=>nearestOnRoute(x,z,p.points).distance>p.halfWidth+2)&&
    RESERVED_PLOTS.every(p=>Math.abs(x-p.at[0])>p.half[0]+3||Math.abs(z-p.at[2])>p.half[1]+3);
  let seed=d.id.split('').reduce((n,c)=>n+c.charCodeAt(0),17);const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const [cx,,cz]=d.at;
  // Plant in small irregular islands, leaving entrances and travel corridors legible.
  for(let patch=0;patch<12;patch++){
    const angle=patch*2.399,r=13+random()*17,x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r;
    if(!clear(x,z))continue;
    const h=mountainBaseHeight(x,z);if(h<1||Math.abs(h-mountainBaseHeight(x+1,z))>1.5)continue;
    if(d.biome==='alpine'||d.biome==='summit'){
      rock(x,z,1+random()*1.8);if(patch%3===0)rock(x+1,z-1,.8,colours.light);
    }else if(d.biome==='woods'||d.biome==='orchard'){
      const height=3.5+random()*2,orchard=d.biome==='orchard';
      cylinder([x,h+height*.5,z],orchard?.18:.13,height,orchard?colours.wood:colours.birch);
      if(!orchard)for(let k=1;k<5;k++)box([x,h+k*.65,z+.13],[.21,.08,.04],colours.wood);
      part(new THREE.IcosahedronGeometry(1,1),orchard?colours.blossom:colours.leaf,[x,h+height,z],[orchard?2:1.5,orchard?1.6:2.1,1.6]);
      if(orchard)for(let fruit=0;fruit<5;fruit++){const a=fruit*1.25;part(new THREE.IcosahedronGeometry(.13,0),colours.trim,[x+Math.cos(a)*1.3,h+height-.7,z+Math.sin(a)*1.3]);}
    }
    const flowers=tier==='full'?28:12;
    for(let j=0;j<flowers;j++){
      const a=random()*6.28,r=Math.sqrt(random())*2.4,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r,py=mountainBaseHeight(px,pz);
      if(!clear(px,pz)||Math.abs(py-h)>1.4)continue;
      part(new THREE.IcosahedronGeometry(1,0),j%3?colours.blossom:colours.light,[px,py+.2,pz],[.12,.18,.12]);
    }
  }
  // Individual authored resting places. These stay outside all travel surfaces.
  for(const side of [-1,1]){
    const x=cx+side*12,z=cz+10;if(!clear(x,z))continue;const h=mountainBaseHeight(x,z);
    box([x,h+.6,z],[2.7,.16,.7]);box([x,h+1,z-.35],[2.7,.65,.12]);
    for(const dx of [-1,1])box([x+dx,h+.28,z],[.15,.55,.6],colours.stone);
    cylinder([x+2,h+1.8,z],.06,3.6);box([x+2,h+3.3,z],[.35,.5,.35],colours.light);
    box([x+2,h+3.6,z],[.55,.1,.55],colours.trim);
  }
  if(d.biome==='garden'||d.biome==='meadow')for(let i=0;i<5;i++){
    const x=cx-13,z=cz-8+i*3;if(!clear(x,z))continue;const h=mountainBaseHeight(x,z);
    box([x,h+.15,z],[3,.3,1.5]);box([x,h+.32,z],[2.7,.06,1.2],colours.stone);
    for(let j=0;j<5;j++)part(new THREE.IcosahedronGeometry(.24,0),j%2?colours.leaf:colours.blossom,[x-1+j*.5,h+.55,z]);
  }
  if(d.biome==='summit'){
    const x=cx+9,z=cz+3,h=mountainBaseHeight(x,z);
    cylinder([x,h+.8,z],.15,1.6);part(new THREE.CylinderGeometry(.38,.28,2,10),colours.trim,[x,h+1.9,z],[1,1,1],[Math.PI/3,0,0]);
    part(new THREE.CylinderGeometry(.31,.31,.05,10),colours.light,[x,h+2.41,z+.87],[1,1,1],[Math.PI/3,0,0]);
  }
  for(const batch of batches.values()){
    const geometry=mergeGeometries(batch.parts);batch.parts.forEach(p=>p.dispose());if(!geometry)continue;owned.push(geometry);
    const mesh=new THREE.Mesh(geometry,batch.material);mesh.castShadow=tier==='full';mesh.receiveShadow=true;group.add(mesh);
  }
  let dead=false;return {group,dispose(){if(dead)return;dead=true;group.removeFromParent();owned.forEach(o=>o.dispose());group.clear();}};
}
