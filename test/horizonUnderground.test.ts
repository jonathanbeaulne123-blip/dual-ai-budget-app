import {setImmediate as yieldEventLoop} from 'node:timers/promises';
import { afterEach, expect, it } from 'vitest';
import type {LandCuts} from '../src/harbour/horizon/land/interfaces';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { buildUnderground, ROOM_DIMENSIONS, THROAT_COFFER } from '../src/harbour/horizon/land/underground/build';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

// Separate synchronous source builds with a real IPC turn; test deadlines stay unchanged.
afterEach(async()=>{await yieldEventLoop();});

it('encloses rooms and passages, preserves the only named mouths, and reports roof breaches',()=>{
  const cuts=buildLandCuts(baseHeight),f=M.underground.footprint;
  for(const [id,room]of Object.entries(M.underground.rooms)){const dim=ROOM_DIMENSIONS[id]!;for(const dx of [-dim.size[0]/2,dim.size[0]/2])for(const dz of [-dim.size[1]/2,dim.size[1]/2])expect(((room.xy[0]!+dx-f.cx)/f.rx)**2+((room.xy[1]!+dz-f.cy)/f.ry)**2).toBeLessThanOrEqual(1);expect(cuts.solids.find(s=>s.id===`underground.${id}.roof`)).toBeDefined();expect(cuts.pads.find(p=>p.id===`underground.${id}`)?.underground).toBe(true);}
  const named=['adit','throat','seaDoor','southPortal','deep.skylight'];for(const mouth of cuts.mouths)expect(named.includes(mouth.id)||/^(prowTunnel|mountainRoadTunnel|stillwaterTunnel|duneCulvert)\.portal\.[01]$/.test(mouth.id)).toBe(true);   // v2.6 (D-M4): the Shoulder Tunnel is retired; V03's tunnel is new
  // D-M7: the Ore Line's South Portal stands at Mountain v2's ground (67.5); every Undercroft room keeps ≥ 40 eu of rock under the new surface.
  expect(cuts.mouths.find(m=>m.id==='southPortal')!.floor).toBe(67.5);
  for(const [id,room]of Object.entries(M.underground.rooms)){const dim=ROOM_DIMENSIONS[id]!;expect(baseHeight(room.xy[0]!,room.xy[1]!)-(dim.floor+dim.clear),id).toBeGreaterThanOrEqual(id==='deep'?0:40);}
  for(const b of cuts.beds.filter(b=>b.kind==='cave'||b.id==='ORE'))expect(b.terrainCut).toBe(false);
  const meshes=cuts.solids.map(s=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(s.positions,3));g.setIndex(s.indices);const mesh=new Mesh(g,new MeshBasicMaterial({side:DoubleSide}));mesh.updateMatrixWorld();return {s,mesh};});
  const eye=new Vector3(1300,42.2,440),direction=new Vector3(1300,110,300).sub(eye).normalize();
  for(const {s,mesh} of meshes)expect(new Raycaster(eye,direction,0,150).intersectObject(mesh),`${s.id} obstructs the Deep-to-Throat sightline`).toHaveLength(0);
  // Page G (R1-53, v1.9 W3-C A5): the Deep's ceiling is closed over the Throat, so from the jetty eye the mouth of daylight
  // reads through the Throat's opening under the ceiling (57.5-68 at the north wall): its lower band (y 110-112.5) is clear
  // of every solid; the band above it (y >= 115) is cut by the closed ceiling at the north wall (68 at z 390).
  const mouthRay=(x:number,y:number)=>{const d=new Vector3(x,y,300).sub(eye),len=d.length();d.normalize();return meshes.filter(({s,mesh})=>!/^underground\.throat\./.test(s.id)&&new Raycaster(eye,d,0,len-8).intersectObject(mesh).length).map(({s})=>s.id);};
  for(const y of [110.5,112])for(const x of [1292,1300,1308])expect(mouthRay(x,y),`mouth ray to [${x},${y}]`).toEqual([]);
  for(const x of [1292,1300,1308])expect(mouthRay(x,119)).toContain('underground.deep.roof');
  // Isolate the missing-rock diagnostic: a wholly flattened world also makes
  // Stillwater's fixed native Foot connection impossible, which must keep failing
  // its independent strict grade check. No valid road is implied by this fixture.
  const bad:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  buildUnderground(bad,()=>0);
  expect(bad.diagnostics.some(d=>d.id==='underground.routeCover'&&d.severity==='conflict')).toBe(true);
},120000);
it('gives every underground solid a unique id and opens the Deep roof only at the manifest skylight (v1.9: closed over the Throat)',()=>{
  const cuts=buildLandCuts(baseHeight),ids=cuts.solids.map(s=>s.id),dupes=ids.filter((id,i)=>ids.indexOf(id)!==i);
  expect(dupes).toEqual([]);
  for(const room of ['lanternCave','bellGallery','sealedDrift'])expect(ids).toContain(`underground.${room}.passage.walls`);
  const roof=cuts.solids.find(s=>s.id==='underground.deep.roof')!,sky=M.underground.rooms.deep.skylight.to;
  const covered=(x:number,z:number)=>{for(let o=0;o+23<roof.positions.length;o+=24){const xs=[0,1,2,3].map(i=>roof.positions[o+i*3]!),zs=[0,1,2,3].map(i=>roof.positions[o+i*3+2]!);if(x>Math.min(...xs)&&x<Math.max(...xs)&&z>Math.min(...zs)&&z<Math.max(...zs))return true;}return false;};
  for(let x=1288;x<=1312;x+=4)for(let z=391;z<=403;z+=3)expect(covered(x,z),`roof over the Throat at [${x},${z}]`).toBe(true);
  // The Throat's lining ends at the Deep's north wall (z 390); the collar carries that wall from the ceiling (68) to 76.7.
  const lining=cuts.solids.find(s=>s.id==='underground.throat.roof')!,liningZ=[...Array(lining.positions.length/3).keys()].map(i=>lining.positions[i*3+2]!);
  expect(Math.max(...liningZ)).toBeLessThanOrEqual(390.01);
  const collar=cuts.solids.find(s=>s.id==='underground.deep.throatCollar')!,cy=[...Array(collar.positions.length/3).keys()].map(i=>collar.positions[i*3+1]!);
  expect(Math.min(...cy)).toBeCloseTo(68+THROAT_COFFER,1);expect(Math.max(...cy)).toBeCloseTo(76.7,1);
  expect(covered(sky[0]!,sky[1]!)).toBe(false);expect(covered(1280,430)).toBe(true);expect(covered(1300,412)).toBe(true);
  const mouth=cuts.mouths.find(m=>m.id==='deep.skylight')!;expect(mouth.outline.reduce((n,p)=>n+p[0],0)/4).toBe(sky[0]);expect(mouth.ceiling).toBe(M.underground.rooms.deep.skylight.topH);
  expect(Math.abs(sky[0]!-1300)).toBeGreaterThanOrEqual(20);
},120000);
it('v2.0: checks the Throat against the collar aperture and keeps ceilings off the Ore Line and its branches',()=>{
  const cuts=buildLandCuts(baseHeight),throat=cuts.beds.find(b=>b.id==='underground.throat')!;
  // D-C3: the passage is checked against doors.throat.collarAperture_m (10.8); the mouth stays 26 x 18.
  expect(throat.clearHeight).toBe(10.8);const ap=cuts.diagnostics.find(d=>d.id==='underground.throat.collarAperture')!;expect(ap.severity).toBe('info');expect(ap.measured!).toBeGreaterThanOrEqual(10.8);
  const mouth=cuts.mouths.find(m=>m.id==='throat')!;expect(mouth.ceiling-mouth.floor).toBe(18);
  // The Deep's ceiling follows its ellipse: nothing over the Ore Line's tube at [1270.6,449.4] (it hung 0.60 over ORE).
  const roof=cuts.solids.find(s=>s.id==='underground.deep.roof')!;
  const over=(x:number,z:number)=>{for(let o=0;o+23<roof.positions.length;o+=24){const xs=[0,1,2,3].map(i=>roof.positions[o+i*3]!),zs=[0,1,2,3].map(i=>roof.positions[o+i*3+2]!);if(x>Math.min(...xs)&&x<Math.max(...xs)&&z>Math.min(...zs)&&z<Math.max(...zs))return true;}return false;};
  expect(over(1270.6,449.4)).toBe(false);expect(over(1300,420)).toBe(true);
  // ORE's roof never stands lower than the siding's (3.2) or the lantern cave passage's (8) clearance over them.
  const ore=cuts.solids.find(s=>s.id==='oreTunnel.roof')!;
  for(const id of ['ORE.siding','underground.lanternCave']){const b=cuts.beds.find(x=>x.id===id)!;
    for(let o=0;o+23<ore.positions.length;o+=24){const v=[0,1,2,3,4,5,6,7].map(i=>[ore.positions[o+i*3]!,ore.positions[o+i*3+1]!,ore.positions[o+i*3+2]!] as const),c=[v.reduce((n,q)=>n+q[0],0)/8,v.reduce((n,q)=>n+q[2],0)/8] as const,under=Math.min(...v.map(q=>q[1]));
      let best=Infinity,h=0;for(const p of b.points){const d=Math.hypot(p[0]-c[0],p[2]-c[1]);if(d<best){best=d;h=p[1];}}
      if(best<b.width/2&&h<under)expect(under-h,`${id} under ORE's roof at [${c.map(n=>n.toFixed(1))}]`).toBeGreaterThanOrEqual(b.clearHeight-.01);}}
},120000);
it('gives the Deep a floor, carries the Ore Line across it on a trestle and opens the tubes onto the lake (page G, Wave 7)',()=>{
  const cuts=buildLandCuts(baseHeight),deep=M.underground.rooms.deep.xy,dim=ROOM_DIMENSIONS.deep!;
  const prisms=(id:string)=>{const s=cuts.solids.find(q=>q.id===id);if(!s)return [];const out:{x:number;z:number;bottom:number;top:number}[]=[];for(let o=0;o+23<s.positions.length;o+=24){let x=0,z=0,b=Infinity,t=-Infinity;for(let k=0;k<8;k++){x+=s.positions[o+k*3]!/8;z+=s.positions[o+k*3+2]!/8;b=Math.min(b,s.positions[o+k*3+1]!);t=Math.max(t,s.positions[o+k*3+1]!);}out.push({x,z,bottom:b,top:t});}return out;};
  const inDeep=(p:{x:number;z:number})=>((p.x-deep[0]!)/(dim.size[0]/2-.5))**2+((p.z-deep[1]!)/(dim.size[1]/2-.5))**2<1;
  // Every room has a floor at its floor height; the Deep's covers its centre and the rim under the jetty.
  for(const [id,room] of Object.entries(M.underground.rooms)){const f=prisms(`underground.${id}.floor`);expect(f.length,id).toBeGreaterThan(10);expect(Math.max(...f.map(p=>p.top)),id).toBe(ROOM_DIMENSIONS[id]!.floor);
    const c=f.some(p=>Math.abs(p.x-room.xy[0]!)<ROOM_DIMENSIONS[id]!.size[0]/15&&p.bottom<ROOM_DIMENSIONS[id]!.floor);expect(c,id).toBe(true);}
  // No tube piece (the Ore Line's floor, footings, walls, roof; the Sea Passage's walls and roof) stands inside the Deep.
  for(const id of ['oreTunnel.floor','oreTunnel.footings','oreTunnel.walls','oreTunnel.roof','seaPassage.walls','seaPassage.roof'])expect(prisms(id).filter(inDeep),id).toEqual([]);
  // The Ore Line crosses on a trestle: a deck under the rails, bents from under it to the room floor.
  const bents=prisms('ORE.deepTrestle.supports');expect(bents.length).toBeGreaterThanOrEqual(6);for(const b of bents)expect(b.bottom).toBeCloseTo(dim.floor-.25,5);
  expect(prisms('ORE.deepTrestle.deck').length).toBeGreaterThan(3);
},120000);
