// @vitest-environment jsdom
/**
 * Pass 5 (T2): Mountain v2 placed on the Horizon — the region answers with v2's own numbers (+ the offset), hides the
 * Horizon terrain it draws over, joins its walk graph at the seams, and mounts the stripped-down scene (D-M8) in every
 * dressing and tier. Triangle and draw-call counts per tier are printed (CONTRACT §6 budget report).
 */
import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {createMountainV2Region,MOUNTAIN_V2_OFFSET as O} from '../src/harbour/horizon/regions/mountainV2/index.ts';
import {MOUNTAIN_V2_FOOTPRINT,toHorizonXYZ} from '../src/harbour/horizon/regions/mountainV2/placement.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {MOUNTAIN_ROAD_LINE,EDGE_SOLIDS,DAM_PARTS,MOUNTAIN_PATH_GRAPH} from '../src/harbour/mountain/definition.ts';
import {SCENE_DRESSING} from '../src/harbour/scene/place.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {sampleTerrain,terrainTriangleVisible} from '../src/harbour/horizon/land/terrain/index.ts';
import type {LandCuts,TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {buildTerrainMeshes} from '../src/harbour/horizon/runtime/cards.ts';
import {districtAt,useDefinitionDistricts} from '../src/harbour/horizon/world/districts.ts';
import {walkPlan,withExtraGraph,type HorizonPathGraph} from '../src/harbour/horizon/world/pathGraph.ts';

const region=createMountainV2Region();
const H=(n:readonly [number,number,number])=>toHorizonXYZ(n);
const bin=readFileSync('public/horizon/terrain/horizon-geo-1.bin');
const field:TerrainField=decodeTerrainAsset(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength) as ArrayBuffer,'full');
const index=JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.index.json.gz')).toString()) as WorldDefinition;
useDefinitionDistricts(index.districts);
/** The road sample standing highest over the gorge on a bridge. */
const highestBridge=()=>MOUNTAIN_ROAD_LINE.samples.filter(q=>q.support==='bridge').reduce((a,q)=>q.at[1]-groundHeightAt(q.at[0],q.at[2])>a.at[1]-groundHeightAt(a.at[0],a.at[2])?q:a);
const empty:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};

describe('the region answers with v2’s own numbers',()=>{
  it('ground: region.groundAt(h) is v2 groundHeightAt(native) + 54 at 20 points',()=>{
    const pts:[number,number][]=[[0,0],[-20,10],[30,-20],[-26,-44],[6,-87],[17,-156],[37,-227],[2,-294],[-2,-298],[44,-246],[58,-115],[-67,-126],[50,-177],[-73,-220],[0,-60],[-40,-100],[60,-200],[-9,-282],[20,-270],[10,-130]];
    for(const [x,z] of pts){const hx=x+O.x,hz=z+O.z;expect(region.contains(hx,hz),`contains ${x},${z}`).toBe(true);expect(region.groundAt(hx,hz)).toBe(groundHeightAt(x,z)+O.y);}
  });
  it('surface: the dam crest and a road bridge are decks; the ground elsewhere',()=>{
    const crest=DAM_PARTS.promenade[Math.floor(DAM_PARTS.promenade.length/2)]!,c=H(crest);
    const onCrest=region.surface(c[0],c[1]+.2,c[2],.48)!;
    expect(onCrest.id).toMatch(/^mountainV2:.*(promenade|dam)/);expect(onCrest.y).toBeGreaterThan(groundHeightAt(crest[0],crest[2])+O.y-.13);
    const s=highestBridge(),b=H(s.at);
    const deck=region.surface(b[0],b[1]+.2,b[2],.48)!;
    expect(deck.id).toBe('mountainV2:mountain-road');expect(deck.material).toBe('paved');expect(Math.abs(deck.y-b[1])).toBeLessThan(.3);
    expect(deck.y-(groundHeightAt(s.at[0],s.at[2])+O.y)).toBeGreaterThan(2);   // a deck over the gorge, not the ground
    const under=region.surface(b[0],groundHeightAt(s.at[0],s.at[2])+O.y+.1,b[2],.48)!;expect(under.id).toBe('terrain');
    expect(region.ceiling(b[0],under.y,b[2])).toBeLessThan(deck.y);
  });
  it('blocked: a parapet stops a body; open road does not',()=>{
    const parapet=EDGE_SOLIDS.find(e=>/parapet/.test(e.id)&&e.top-e.bottom>.8)!;
    const mx=(parapet.a[0]+parapet.b[0])/2,mz=(parapet.a[1]+parapet.b[1])/2,my=(parapet.bottom+parapet.top)/2;
    expect(region.blocked(mx+O.x,my+O.y,mz+O.z,.2)).toBe(true);
    const hit=region.provider.contact(mx+O.x,mz+O.z,parapet.top+O.y-1.1,.3);expect(hit?.id).toBe(`mountainV2:${parapet.id}`);
    const road=MOUNTAIN_ROAD_LINE.samples[Math.floor(MOUNTAIN_ROAD_LINE.samples.length/3)]!,r=H(road.at);
    expect(region.provider.contact(r[0],r[2],r[1],.3)).toBeNull();
  });
  it('contains: the footprint, its edge, v2’s sea, the Foot terrace',()=>{
    const f=MOUNTAIN_V2_FOOTPRINT;
    expect(region.contains(f.minX-1,(f.minZ+f.maxZ)/2)).toBe(false);expect(region.contains((f.minX+f.maxX)/2,f.maxZ+1)).toBe(false);
    expect(region.contains(O.x+2,O.z-294)).toBe(true);                 // the summit
    expect(region.contains(O.x,O.z)).toBe(true);                       // v2's square: the Foot terrace
    expect(region.contains(O.x+60,O.z+40)).toBe(false);                // past the Foot terrace (the Horizon's shore)
    expect(region.contains(O.x+195,O.z-100)).toBe(groundHeightAt(195,-100)>-.2);   // v2's sea edge
    // With a baked field north of the summit line, the higher Horizon face keeps its own ground.
    const north=createMountainV2Region({horizonGround:()=>999});expect(north.contains(O.x,O.z-300)).toBe(false);expect(north.contains(O.x,O.z-200)).toBe(true);
    const mouth=createMountainV2Region({exclude:(x,z)=>Math.hypot(x-(O.x+30),z-(O.z-150))<4});expect(mouth.contains(O.x+30,O.z-150)).toBe(false);
  });
});

describe('the Horizon geography under the region',()=>{
  it('the provider owns the ground: v2’s exact ground and decks win over the 5 m baked terrain',()=>{
    const geo=createHorizonGeography(field,empty),off=geo.addDynamic(region.provider);
    const s=highestBridge(),b=H(s.at);
    const g=groundHeightAt(s.at[0],s.at[2])+O.y;
    expect(geo.ground(b[0],b[2])).toBeCloseTo(g,9);
    expect(geo.surface(b[0],b[2],g+.1)?.y).toBeCloseTo(g,9);                  // in the gorge, under the bridge: v2's gorge floor
    expect(geo.surface(b[0],b[2],b[1]+.1)?.id).toBe('mountainV2:mountain-road');
    let worst=0;for(const n of MOUNTAIN_PATH_GRAPH.nodes){const h=H(n.at);if(!region.contains(h[0],h[2]))continue;worst=Math.max(worst,Math.abs(geo.ground(h[0],h[2])-(groundHeightAt(n.at[0],n.at[2])+O.y)));}
    expect(worst).toBeLessThan(1e-9);
    off();expect(geo.ground(b[0],b[2])).toBe(sampleTerrain(field,b[0],b[2]));
  });
  it('hides exactly the terrain cells whose centre is inside the region (split into `under` tiles)',()=>{
    const id='crown',st=field.step;
    const plain=buildTerrainMeshes(field,{mouths:[]},id,false,null)!,split=buildTerrainMeshes(field,{mouths:[]},id,false,null,{split:(x,z)=>region.hidesTerrainCell(x,z)})!;
    const skipped=buildTerrainMeshes(field,{mouths:[]},id,false,null,{skip:(x,z)=>region.hidesTerrainCell(x,z)})!;
    const tris=(ms:THREE.Mesh[])=>ms.reduce((n,m)=>n+m.geometry.getAttribute('position').count/3,0);
    let inside=0;for(let r=0;r<field.rows-1;r++)for(let c=0;c<field.columns-1;c++){const x=(c+.5)*st,z=(r+.5)*st;if(districtAt(x,z)!==id||!region.hidesTerrainCell(x,z))continue;
      inside+=(terrainTriangleVisible(x-st/6,z-st/6,{mouths:[]})?1:0)+(terrainTriangleVisible(x+st/6,z+st/6,{mouths:[]})?1:0);}
    expect(inside).toBeGreaterThan(1000);
    expect(tris(split.under)).toBe(inside);expect(split.under.every(m=>m.name.endsWith('.under'))).toBe(true);
    expect(tris(split.meshes)).toBe(tris(plain.meshes));
    expect(tris(skipped.meshes)).toBe(tris(plain.meshes)-inside);expect(skipped.under.length).toBe(0);
    for(const b of [plain,split,skipped])b.dispose();
  });
  it('the seam: the Horizon’s baked ground meets the region’s within 0.5 m at lattice points just inside the footprint edge',({skip})=>{
    if(!index.regions?.some(r=>r.id==='mountainV2'))skip('The committed bake predates the Mountain v2 ground override (world.regions is absent): T1’s re-bake lands it.');
    const inner=createMountainV2Region({horizonGround:(x,z)=>sampleTerrain(field,x,z)});
    // Eight edge probes: walk inward from the footprint's sides until the region begins, then compare 2 m inside.
    const starts:[number,number,number,number][]=[[1108,500,1,0],[1108,700,1,0],[1508,500,-1,0],[1508,700,-1,0],[1200,368,0,1],[1350,368,0,1],[1260,848,0,-1],[1340,848,0,-1]];
    const gaps:number[]=[];
    for(const [x0,z0,dx,dz] of starts){let x=x0,z=z0;for(let k=0;k<400&&!inner.contains(x,z);k++){x+=dx;z+=dz;}if(!inner.contains(x,z))continue;
      // The bake is a 5 m lattice: compare at a lattice point 10 m inside the edge (v2's shoreline is steep; between lattice
      // points the interpolated field cannot follow a 1 m grid, which is why the region draws its own ground — T1 land notes).
      x=Math.round((x+dx*10)/5)*5;z=Math.round((z+dz*10)/5)*5;if(!inner.contains(x,z))continue;const g=inner.groundAt(x,z);if(g===null)continue;gaps.push(Math.abs(sampleTerrain(field,x,z)-g));}
    console.log('[region seam] |baked − region| at the edge probes:',gaps.map(g=>g.toFixed(2)).join(', '));
    expect(gaps.length).toBeGreaterThanOrEqual(6);for(const g of gaps)expect(g).toBeLessThanOrEqual(.5);
  });
});

describe('the walk graph crosses the seam',()=>{
  it('v2’s graph joins the Horizon’s and walk plans run from the Horizon to the observatory',()=>{
    const extra=region.pathGraph(),graph=withExtraGraph(index.pathGraph as HorizonPathGraph,extra);
    expect(withExtraGraph(graph,extra)).toBe(graph);   // idempotent
    expect(graph.nodes.length).toBeGreaterThan(index.pathGraph!.nodes.length+extra.nodes.length-1);
    const foot=graph.joins!.find(j=>j.from==='v2:road:foot')!;
    console.log('[region seam] joins:',graph.joins!.filter(j=>j.how!=='lip').map(j=>`${j.from}→${j.to} ${j.distance.toFixed(1)} m (${j.how})`).join('; '),'; lips',graph.joins!.filter(j=>j.how==='lip').length);
    expect(foot).toBeTruthy();
    const obs=extra.nodes.find(n=>n.id==='v2:door:observatory')!.at,roadFoot=extra.nodes.find(n=>n.id==='v2:road:foot')!.at;
    const up=walkPlan(graph,[...roadFoot],[...obs])!;expect(up).toBeTruthy();expect(up.offBedDistance).toBeLessThan(1);
    const court=(index.places as unknown as {id:string;anchor:{xy:[number,number];height?:number}}[]).find(p=>p.id==='court')!,from:[number,number,number]=[court.anchor.xy[0],court.anchor.height??0,court.anchor.xy[1]];
    const across=walkPlan(graph,from,[...obs]);
    expect(across,'square → observatory on foot').toBeTruthy();expect(across!.edges.some(e=>e.startsWith('v2:'))).toBe(true);
  });
});

const triangles=(root:THREE.Object3D)=>{let n=0;root.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||!m.visible)return;const g=m.geometry,c=(g.index?g.index.count:g.getAttribute('position').count)/3;n+=c*((m as THREE.InstancedMesh).isInstancedMesh?(m as THREE.InstancedMesh).count:1);});return n;};
describe('the stripped-down scene (D-M8)',()=>{
  it('mounts in every dressing and tier, draws only the kept list, and releases everything',()=>{
    const rows:string[]=[];
    for(const tier of ['full','lite'] as const)for(const [theme,dressing] of Object.entries(SCENE_DRESSING)){
      const scene=new THREE.Scene(),m=region.mount(scene,tier,dressing);
      expect(scene.children).toContain(m.group);expect(m.group.position.toArray()).toEqual([O.x,O.y,O.z]);
      const names:string[]=[];m.group.traverse(o=>names.push(o.name));
      for(const banned of [/Chimney smoke/,/monorail/i,/Weathered fence/,/Accepted movement pulse/,/Mountain living details/,/butterfl/i,/Board /,/Goal backing lamp/])expect(names.some(n=>banned.test(n)),`${banned} drawn`).toBe(false);
      for(const kept of [/Mountain v2 ground/,/Mountain v2 card/,/Accepted Fund water/,/Summit gondola carriage/,/Mountain funicular carriage/,/Mountain planting/])expect(names.some(n=>kept.test(n)),`${kept} missing`).toBe(true);
      expect(names.includes('Mountain v2 flock')).toBe(tier==='full');
      const st=m.stats();expect(st.triangles).toBe(triangles(m.group));expect(st.benches).toBeGreaterThanOrEqual(1);
      if(theme==='classic')rows.push(`${tier}: ${st.triangles} triangles (ground ${st.groundTriangles}), ${st.drawCalls} draw calls`);
      // Rides and the Fund picture move only their own objects.
      m.setFund(.5,.25);m.setFund(null,null);
      const gondola=m.group.getObjectByName('Summit gondola carriage')!,top=region.rides.lines.gondola.stations[1]!;
      m.setTransit({at:top.at,yaw:1,pitch:0},'gondola');expect(gondola.position.toArray().map((v,i)=>v+[O.x,O.y,O.z][i]!)).toEqual(top.at);
      m.setTransit(null,'gondola');
      m.setQuiet(true);expect(m.animate(.016,1)).toBe(false);m.setQuiet(false);expect(m.animate(.016,1)).toBe(true);
      const resources=new Set<THREE.BufferGeometry|THREE.Material>();
      m.group.traverse(o=>{const x=o as THREE.Mesh;if(!x.isMesh)return;resources.add(x.geometry);for(const mat of Array.isArray(x.material)?x.material:[x.material])resources.add(mat);});
      let released=0;for(const r of resources)r.addEventListener('dispose',()=>released++);
      m.dispose();m.dispose();expect(released).toBe(resources.size);expect(scene.children).not.toContain(m.group);
    }
    console.log('[region budget]',rows.join(' | '));
  },240000);
  it('rides: v2’s lines in Horizon space; createRide is v2’s own (native)',()=>{
    const {lines,curve,createRide,toHorizon}=region.rides;
    expect(lines.gondola.stations.map(s=>s.id)).toEqual(['quay','summit']);expect(lines.funicular.stations.length).toBe(4);
    const c=curve('gondola',0,1);expect(c[0]!.at).toEqual(lines.gondola.stations[0]!.at);expect(c.at(-1)!.at).toEqual(lines.gondola.stations[1]!.at);
    expect(c.some(f=>f.cabin)).toBe(true);
    const ride=createRide('gondola',0,1,{reduced:true});expect(ride.duration).toBe(0);const end=toHorizon(ride.step(.1));
    expect([end.x,end.y,end.z]).toEqual(lines.gondola.stations[1]!.at);
  });
});
it('the committed bake is readable here',()=>{expect(existsSync('public/mountain/terrain/hearth-mountain-geo-2.bin')).toBe(true);});
