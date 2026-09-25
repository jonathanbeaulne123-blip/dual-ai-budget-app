// @vitest-environment jsdom
/**
 * The whole dressed mountain, as the court builds it: every theme and tier builds within its
 * triangle budget, rides place their cabins on setTransit's yaw and pitch, calm view holds the
 * moving things still, and disposal releases every GPU resource once.
 */
import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {buildMountainLandscape} from '../src/harbour/mountain/landscape.ts';
import {SCENE_DRESSING} from '../src/harbour/scene/place.ts';

const triangles=(root:THREE.Object3D)=>{let n=0;root.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||!m.visible)return;const g=m.geometry,c=(g.index?g.index.count:g.getAttribute('position').count)/3;n+=c*((m as THREE.InstancedMesh).isInstancedMesh?(m as THREE.InstancedMesh).count:1);});return n;};
const find=(root:THREE.Object3D,name:string)=>{let hit:THREE.Object3D|null=null;root.traverse(o=>{if(!hit&&o.name===name)hit=o;});return hit as THREE.Object3D|null;};

describe('the dressed mountain',()=>{
  for(const tier of ['lite','full'] as const)it(`builds every theme on the ${tier} tier within its budget and releases it all`,()=>{
    for(const dressing of Object.values(SCENE_DRESSING)){
      const land=buildMountainLandscape(dressing,tier,null);
      const tris=triangles(land.group);
      expect(tris).toBeGreaterThan(tier==='lite'?100000:250000);
      expect(tris).toBeLessThan(tier==='lite'?260000:560000);
      const resources=new Set<THREE.BufferGeometry|THREE.Material>();
      land.group.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh&&!(o as THREE.LineSegments).isLineSegments)return;resources.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:[m.material])resources.add(mat);});
      let released=0;for(const r of resources)r.addEventListener('dispose',()=>released++);
      land.dispose();land.dispose();
      expect(released).toBe(resources.size);
    }
  });
  it('hangs the ride cabins on setTransit, with the ride’s yaw and pitch',()=>{
    const land=buildMountainLandscape(SCENE_DRESSING.classic,'lite',null);
    const gondola=find(land.group,'Summit gondola carriage')!,funicular=find(land.group,'Mountain funicular carriage')!;
    land.setTransit([10,60,-150],'gondola',{yaw:.7,pitch:.1});
    expect(gondola.position.toArray()).toEqual([10,60,-150]);expect(gondola.rotation.y).toBeCloseTo(.7,6);
    land.setTransit([5,20,-90],'funicular',{yaw:-.4,pitch:.35});
    expect(funicular.position.toArray()).toEqual([5,20,-90]);expect(funicular.rotation.y).toBeCloseTo(-.4,6);
    // The chassis pitches with the track; the body stays level.
    const tilted=funicular.children.some(c=>Math.abs(c.rotation.x+.35)<1e-6);expect(tilted).toBe(true);
    land.setTransit(null);expect(funicular.position.toArray()).toEqual([5,20,-90]);
    land.dispose();
  });
  it('holds smoke, cloth and flight still in calm view',()=>{
    const land=buildMountainLandscape(SCENE_DRESSING.newfoundland,'lite',null);
    const smoke=find(land.group,'Chimney smoke') as THREE.InstancedMesh,m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    land.animate(3,.05);smoke.getMatrixAt(1,m);m.decompose(p,q,s);expect(s.x).toBeGreaterThan(.1);
    land.setCalm(true);land.animate(4,.05);
    for(let i=0;i<smoke.count;i++){smoke.getMatrixAt(i,m);m.decompose(p,q,s);expect(s.x).toBeLessThan(.001);}
    const birds:THREE.Object3D[]=[];land.group.traverse(o=>{if(o.name==='Flying bird')birds.push(o);});
    expect(birds.length).toBeGreaterThan(0);expect(birds.every(b=>!b.visible)).toBe(true);
    land.dispose();
  });
});
