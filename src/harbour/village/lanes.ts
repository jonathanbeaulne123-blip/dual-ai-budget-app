import * as THREE from 'three';
import {HARBOUR_LANES} from './world.ts';
import {groundHeightAt} from '../scene/ground.ts';

/** A single terrain-following ribbon mesh, with shared approaches drawn only once. */
export function buildHarbourLanes(material:THREE.Material):THREE.Mesh{
  const vertices:number[]=[],indices:number[]=[],seen=new Set<string>();
  for(const lane of HARBOUR_LANES)for(let i=1;i<lane.points.length;i++){
    const a=lane.points[i-1]!,b=lane.points[i]!;
    if(Math.hypot(a[0],a[1])<3.8)continue;
    const key=[...a,...b].map(n=>n.toFixed(4)).join(',');if(seen.has(key))continue;seen.add(key);
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1,nx=-dz/length*.9,nz=dx/length*.9,base=vertices.length/3;
    for(const [x,z] of [[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz]])vertices.push(x!,groundHeightAt(x!,z!)+.035,z!);
    indices.push(base,base+2,base+1,base+1,base+2,base+3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const lanes=new THREE.Mesh(geometry,material);lanes.name='village-lanes';lanes.userData.ground=true;lanes.receiveShadow=true;return lanes;
}
