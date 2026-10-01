import * as THREE from 'three';
import {describe, expect, it} from 'vitest';
import {packInstances, packedMatrixShader} from '../src/harbour/horizon/runtime/packedInstances';
import {createCorridorPlanting, corridorPlantingDistricts} from '../src/harbour/horizon/runtime/corridorPlanting';
import {sampleCorridor, SAMPLE_ORIGIN} from '../src/harbour/horizon/kit/plants/sample';

function source(key: string, count: number, capacity: number, indexed: boolean) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,2,0],3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0,0,1, 0,0,1, 0,0,1],3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([.2,.3,.4, .3,.4,.5, .4,.5,.6],3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));
  if (indexed) geometry.setIndex([2,1,0]);
  geometry.setAttribute('aFar', new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(150),1));
  geometry.setAttribute('aBorn', new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(3.25),1));
  const mesh = new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial(),capacity);
  for (let i=0;i<capacity;i++) mesh.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(100+i*7,10,50),new THREE.Quaternion().setFromEuler(new THREE.Euler(.1,.7,.2)),new THREE.Vector3(1,2,3)));
  mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3).fill(.75),3);
  mesh.count=count;mesh.castShadow=true;mesh.receiveShadow=true;
  return {key,mesh,wind:.022};
}

describe('portable packed geometry preserves source records',()=>{
  it('keeps local vertices, UVs, normals, Float32 matrices, winding and dynamics, with no unused submitted slots',()=>{
    const a=source('tree',1,3,true),b=source('bush',2,2,false);
    const batch=packInstances([a,b],new THREE.MeshStandardMaterial(),{name:'test',plant:true});
    const g=batch.mesh.geometry,index=g.index!;
    expect((batch.mesh as THREE.InstancedMesh).isInstancedMesh).not.toBe(true);
    expect(g.drawRange.count).toBe(9); // Three active triangles, not five capacity triangles.
    expect(Array.from(index.array.slice(0,9))).toEqual([2,1,0,9,10,11,12,13,14]);
    for(const [s,base] of [[a,0],[b,9]] as const) for(let slot=0;slot<s.mesh.count;slot++) for(let v=0;v<3;v++){
      const vertex=base+slot*3+v;
      for(const name of ['position','normal','color','uv']){
        const original=s.mesh.geometry.getAttribute(name),actual=g.getAttribute(name);
        expect(Array.from(actual.array.slice(vertex*actual.itemSize,(vertex+1)*actual.itemSize))).toEqual(Array.from(original.array.slice(v*original.itemSize,(v+1)*original.itemSize)));
      }
      expect(Array.from(g.getAttribute('aInstanceMatrix').array.slice(vertex*16,(vertex+1)*16))).toEqual(Array.from(s.mesh.instanceMatrix.array.slice(slot*16,(slot+1)*16)));
      expect(g.getAttribute('aFar').getX(vertex)).toBe(150);expect(g.getAttribute('aBorn').getX(vertex)).toBe(3.25);
      expect(g.getAttribute('aWind').getX(vertex)).toBe(Math.fround(.022));expect(g.getAttribute('aWind').getY(vertex)).toBe(Math.fround(.0132));
      expect(g.getAttribute('aPart').getX(vertex)).toBe(0); // Bushes are not incorrectly made immobile trunks.
    }
    expect(g.boundingSphere!.containsPoint(a.mesh.boundingSphere!.center)).toBe(true);
    a.mesh.count=0;b.mesh.count=1;batch.sync();expect(g.drawRange.count).toBe(3);expect(Array.from(index.array.slice(0,3))).toEqual([9,10,11]);
    b.mesh.count=0;batch.sync();expect(g.drawRange.count).toBe(0);expect(batch.mesh.visible).toBe(false);
    batch.dispose();for(const s of [a,b]){s.mesh.geometry.dispose();(s.mesh.material as THREE.Material).dispose();s.mesh.dispose();}
  });
  it('uses installed Three transform chunks in color and depth paths without enabling instancing or multi-draw',()=>{
    for(const colour of [false,true]){
      const shader={vertexShader:'#include <common>\n#include <defaultnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>\n#include <worldpos_vertex>\n#include <color_vertex>'};
      packedMatrixShader(shader,colour);
      expect(shader.vertexShader).toContain('attribute mat4 aInstanceMatrix;');
      expect(shader.vertexShader).toContain('mvPosition = aInstanceMatrix * mvPosition;');
      expect(shader.vertexShader).toContain('worldPosition = aInstanceMatrix * worldPosition;');
      expect(shader.vertexShader).toContain('mat3 im = mat3( aInstanceMatrix );');
      expect(shader.vertexShader).not.toContain('#define USE_INSTANCING');
    }
  });
  it('reports the exact submitted triangle range across themes, tiers, seasons and residency changes',()=>{
    const world={corridors:[sampleCorridor()]},resident=corridorPlantingDistricts(world);
    for(const theme of ['classic','taylor','newfoundland'] as const)for(const tier of ['full','lite'] as const){
      const p=createCorridorPlanting(world,{theme,tier,season:'summer'}),camera=new THREE.PerspectiveCamera();
      camera.position.set(SAMPLE_ORIGIN.avenue[0]+20,20,SAMPLE_ORIGIN.avenue[1]);camera.updateMatrixWorld();
      for(const season of ['summer','autumn','winter','spring'] as const){p.setSeason(season);
        for(const res of [resident,new Set<string>(),resident]){
          p.update(camera,res);let triangles=0,calls=0;
          p.group.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||!m.visible)return;const g=m.geometry,total=g.index?.count??g.getAttribute('position').count,n=Math.min(total-g.drawRange.start,g.drawRange.count);triangles+=n/3*((m as THREE.InstancedMesh).isInstancedMesh?(m as THREE.InstancedMesh).count:1);calls++;});
          expect(triangles).toBe(p.stats().triangles);expect(calls).toBe(p.stats().drawCalls);
          expect(p.activeRecords().reduce((n,r)=>n+r.triangles,0)).toBe(triangles);
          expect(new Set(p.activeRecords().map(r=>r.batch)).size).toBe(calls);
        }
      }p.dispose();
    }
  });
});
