import { expect, it } from 'vitest';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { ROOM_DIMENSIONS } from '../src/harbour/horizon/land/underground/build';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

it('encloses rooms and passages, preserves the only named mouths, and reports roof breaches',()=>{
  const cuts=buildLandCuts(baseHeight),f=M.underground.footprint;
  for(const [id,room]of Object.entries(M.underground.rooms)){const dim=ROOM_DIMENSIONS[id]!;for(const dx of [-dim.size[0]/2,dim.size[0]/2])for(const dz of [-dim.size[1]/2,dim.size[1]/2])expect(((room.xy[0]!+dx-f.cx)/f.rx)**2+((room.xy[1]!+dz-f.cy)/f.ry)**2).toBeLessThanOrEqual(1);expect(cuts.solids.find(s=>s.id===`underground.${id}.roof`)).toBeDefined();expect(cuts.pads.find(p=>p.id===`underground.${id}`)?.underground).toBe(true);}
  const named=['adit','throat','seaDoor','southPortal','deep.skylight'];for(const mouth of cuts.mouths)expect(named.includes(mouth.id)||/^(prowTunnel|shoulderTunnel|duneCulvert)\.portal\.[01]$/.test(mouth.id)).toBe(true);
  for(const b of cuts.beds.filter(b=>b.kind==='cave'||b.id==='ORE'))expect(b.terrainCut).toBe(false);
  const meshes=cuts.solids.map(s=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(s.positions,3));g.setIndex(s.indices);const mesh=new Mesh(g,new MeshBasicMaterial({side:DoubleSide}));mesh.updateMatrixWorld();return {s,mesh};});
  const eye=new Vector3(1300,42.2,440),direction=new Vector3(1300,110,300).sub(eye).normalize();
  for(const {s,mesh} of meshes)expect(new Raycaster(eye,direction,0,150).intersectObject(mesh),`${s.id} obstructs the Deep-to-Throat sightline`).toHaveLength(0);
  // Page G (R1-53): every ray from the jetty eye to the Throat's mouth of daylight (y 112–127) is clear of the Deep roof and the skylight.
  for(const y of [112,115,119,123,126])for(const x of [1292,1300,1308]){const d=new Vector3(x,y,300).sub(eye),len=d.length();d.normalize();
    for(const {s,mesh} of meshes){if(/^underground\.throat\./.test(s.id))continue;expect(new Raycaster(eye,d,0,len-8).intersectObject(mesh),`${s.id} blocks the mouth ray to [${x},${y}]`).toHaveLength(0);}}
  const bad=buildLandCuts(()=>0);expect(bad.diagnostics.some(d=>d.id==='underground.routeCover'&&d.severity==='conflict')).toBe(true);
},120000);
it('gives every underground solid a unique id and opens the Deep roof only along the Throat and at the manifest skylight',()=>{
  const cuts=buildLandCuts(baseHeight),ids=cuts.solids.map(s=>s.id),dupes=ids.filter((id,i)=>ids.indexOf(id)!==i);
  expect(dupes).toEqual([]);
  for(const room of ['lanternCave','bellGallery','sealedDrift'])expect(ids).toContain(`underground.${room}.passage.walls`);
  const roof=cuts.solids.find(s=>s.id==='underground.deep.roof')!,sky=M.underground.rooms.deep.skylight.to;
  const covered=(x:number,z:number)=>{for(let o=0;o+23<roof.positions.length;o+=24){const xs=[0,1,2,3].map(i=>roof.positions[o+i*3]!),zs=[0,1,2,3].map(i=>roof.positions[o+i*3+2]!);if(x>Math.min(...xs)&&x<Math.max(...xs)&&z>Math.min(...zs)&&z<Math.max(...zs))return true;}return false;};
  for(let x=1288;x<=1312;x+=4)for(let z=391;z<=403;z+=3)expect(covered(x,z),`roof over the Throat at [${x},${z}]`).toBe(false);
  expect(covered(sky[0]!,sky[1]!)).toBe(false);expect(covered(1280,430)).toBe(true);expect(covered(1300,412)).toBe(true);
  const mouth=cuts.mouths.find(m=>m.id==='deep.skylight')!;expect(mouth.outline.reduce((n,p)=>n+p[0],0)/4).toBe(sky[0]);expect(mouth.ceiling).toBe(M.underground.rooms.deep.skylight.topH);
  expect(Math.abs(sky[0]!-1300)).toBeGreaterThanOrEqual(20);
},120000);
