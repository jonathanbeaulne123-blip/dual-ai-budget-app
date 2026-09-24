import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Point3} from './definition.ts';
import type {RenderTier} from '../scene/quality.ts';

/** Spatial material batches with a single, idempotent resource owner. */
export class MountainArtKit{
  readonly group=new THREE.Group();
  private batches=new Map<string,{colour:string;parts:THREE.BufferGeometry[]}>();
  private owned:{dispose():void}[]=[];
  private dead=false;
  constructor(private tier:RenderTier,name:string){this.group.name=name;}
  part(g:THREE.BufferGeometry,colour:string,at:Point3,scale:Point3=[1,1,1],rotation:Point3=[0,0,0]){
    const key=`${colour}:${Math.floor(at[0]/48)}:${Math.floor(at[2]/48)}`,batch=this.batches.get(key)??{colour,parts:[]};
    const plain=g.index?g.toNonIndexed():g;if(plain!==g)g.dispose();
    plain.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale)));
    batch.parts.push(plain);this.batches.set(key,batch);
  }
  box(at:Point3,size:Point3,colour:string,rotation:Point3=[0,0,0]){this.part(new THREE.BoxGeometry(...size),colour,at,[1,1,1],rotation);}
  beam(a:Point3,b:Point3,r:number,colour:string){
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r,r,from.distanceTo(to),6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize()));
    this.part(g,colour,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]);
  }
  finish(){
    const materials=new Map<string,THREE.Material>();
    for(const b of this.batches.values()){
      const g=mergeGeometries(b.parts);b.parts.forEach(p=>p.dispose());if(!g)continue;
      let m=materials.get(b.colour);if(!m){m=new THREE.MeshStandardMaterial({color:b.colour,roughness:.84,flatShading:true});materials.set(b.colour,m);this.owned.push(m);}
      this.owned.push(g);const mesh=new THREE.Mesh(g,m);mesh.name=this.group.name+' batch';mesh.castShadow=this.tier==='full';mesh.receiveShadow=true;this.group.add(mesh);
    }this.batches.clear();return this;
  }
  dispose(){if(this.dead)return;this.dead=true;this.group.removeFromParent();for(const b of this.batches.values())b.parts.forEach(p=>p.dispose());this.batches.clear();this.owned.forEach(o=>o.dispose());this.owned=[];this.group.clear();}
}
