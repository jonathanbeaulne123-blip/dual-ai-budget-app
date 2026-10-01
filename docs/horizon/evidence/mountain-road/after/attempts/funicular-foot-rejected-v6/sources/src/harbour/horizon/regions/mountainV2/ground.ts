/**
 * Mountain v2's own ground on the Horizon: v2's render lattice and paint (`scene/groundPaint.ts buildLattice`,
 * `groundMasks`, `paintGround` over `scene/ground.ts groundHeightAt` — never `createGround`, which owns the sky, the fog
 * and a sea), in native space, one mesh per tier, parented under the region's host group.
 *
 * Which triangles: a lattice triangle is drawn when any of its corners is inside the region's `contains`, or lies in a
 * Horizon terrain cell the region hides (a cell whose centre is inside `contains`, `runtime/cards.ts buildTerrainSteps`
 * `skip`). So every hidden Horizon cell is covered by v2's ground and the seam overlaps by at most one lattice cell plus
 * one Horizon cell (≤ ~5 m) — the Horizon's baked ground there is v2's own (T1, D-M2), so the overlap is the same surface,
 * never a gap.
 */
import * as THREE from 'three';
import {groundHeightAt,TERRAIN_LATTICE_BOUNDS} from '../../../scene/ground.ts';
import {buildLattice,groundMasks,paintGround,type GroundMasks,type Lattice} from '../../../scene/groundPaint.ts';
import type {PlaceDressing} from '../../../scene/place.ts';
import {paperGrain} from '../../../art/cardScene.ts';
import {MOUNTAIN_V2_OFFSET as O} from './placement.ts';

type Tier='full'|'lite';
export type PreparedGround={lattice:Lattice;masks:GroundMasks;index:Uint32Array};
/** Shared per tier when the footprint does not depend on a runtime's baked field (tests, tools). */
const prepared=new Map<string,PreparedGround>();
/** Hidden Horizon cell test at a Horizon point: the cell (of `step`) holding it has its centre inside `contains`. */
export function hiddenCell(contains:(hx:number,hz:number)=>boolean,step:number){
  const memo=new Map<number,boolean>();
  return (hx:number,hz:number)=>{const c=Math.floor(hx/step),r=Math.floor(hz/step),k=r*65536+c;let v=memo.get(k);if(v===undefined){v=contains((c+.5)*step,(r+.5)*step);memo.set(k,v);}return v;};
}
/** The lattice, its masks (dressing-free) and the kept triangles, once per tier and footprint. */
export function prepareRegionGround(tier:Tier,contains:(hx:number,hz:number)=>boolean,terrainStep:number,cache:Map<string,PreparedGround>=prepared,ceiling?:(hx:number,hz:number)=>number|null,capLattice?:(lattice:Lattice)=>unknown):PreparedGround{
  const id=`${tier}:${terrainStep}${ceiling?':yield':''}`,hit=cache.get(id);if(hit)return hit;
  // road (L1): the drawn ground stays under a yielded Horizon deck (its `ceiling`, Horizon heights): the lawn was drawn over V03.
  const height=ceiling?(x:number,z:number)=>{const g=groundHeightAt(x,z),c=ceiling(x+O.x,z+O.z);return c===null?g:Math.min(g,c-O.y);}:groundHeightAt;
  const lattice=buildLattice(TERRAIN_LATTICE_BOUNDS,tier,height);capLattice?.(lattice);
  const masks=groundMasks(lattice,tier,height),p=lattice.positions,n=p.length/3;
  const hidden=hiddenCell(contains,terrainStep),flag=new Uint8Array(n);
  for(let i=0;i<n;i++){const hx=p[i*3]!+O.x,hz=p[i*3+2]!+O.z;flag[i]=contains(hx,hz)||hidden(hx,hz)?1:0;}
  const kept:number[]=[];const ix=lattice.indices;
  for(let t=0;t<ix.length;t+=3){const a=ix[t]!,b=ix[t+1]!,c=ix[t+2]!;if(flag[a]||flag[b]||flag[c])kept.push(a,b,c);}
  const result={lattice,masks,index:new Uint32Array(kept)};cache.set(id,result);return result;
}
export type RegionGround={mesh:THREE.Mesh;triangles:number;setDressing(d:PlaceDressing):void;dispose():void};
export function buildRegionGround(tier:Tier,dressing:PlaceDressing,contains:(hx:number,hz:number)=>boolean,terrainStep:number,cache?:Map<string,PreparedGround>,ceiling?:(hx:number,hz:number)=>number|null,capLattice?:(lattice:Lattice)=>unknown):RegionGround{
  const {lattice,masks,index}=prepareRegionGround(tier,contains,terrainStep,cache,ceiling,capLattice),positions=lattice.positions,colors=new Float32Array(positions.length);
  paintGround(colors,lattice,masks,dressing);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  // Paper grain in world space, as v2 lays it (the ground is the same card as everything on it).
  const uvs=new Float32Array(positions.length/3*2);for(let i=0;i<uvs.length/2;i++){uvs[i*2]=positions[i*3]!/9;uvs[i*2+1]=positions[i*3+2]!/9;}
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geometry.setIndex(new THREE.BufferAttribute(index,1));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:true,map:paperGrain()});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Mountain v2 ground';mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.ground=true;
  return {mesh,triangles:index.length/3,
    setDressing(d){paintGround(colors,lattice,masks,d);geometry.getAttribute('color').needsUpdate=true;},
    dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();}};
}
