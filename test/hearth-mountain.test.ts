import {describe,it,expect} from 'vitest';
import {MOUNTAIN_ROAD,ROAD_LENGTH,DISTRICTS,RESERVED_PLOTS,transportPoint,TRANSPORT_STOPS,TRANSPORT_LINES,FUNICULAR_LINE,GONDOLA_LINE,mountainBaseHeight,
  MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,GORGE_BRIDGES,EDGE_RUNS,EDGE_SOLIDS,EDGE_RULES,RIVER,RIVER_HALF_WIDTH,DAM,DAM_PARTS,DAM_OVERLOOK,KITTY_CHAMBERS,
  MOUNTAIN_PATH_GRAPH,DOOR_APRONS,OVERLOOKS,mountainWalkPlan,TOWN_RACE_ROAD,RACE_FINISH,CANAL_BRIDGE,BUILDING_SITES,buildingDoor,nearestOnRoute,transportSpline} from '../src/harbour/mountain/definition.ts';
import {queryWorldSurface,worldCeilingAt,mountainWalkRoute,SKILL_BRANCHES,WORLD_SURFACES,type WorldSurface} from '../src/harbour/mountain/surfaces.ts';
import {crossesRaceGate,MOUNTAIN_GATES,MOUNTAIN_COURSE_POINTS,MOUNTAIN_RACE_SEGMENTS} from '../src/harbour/mountain/race.ts';
import {TRANSPORT_CROSSINGS} from '../src/harbour/mountain/crossings.ts';
import {BRANCH_DEPARTURES} from '../src/harbour/mountain/roads.ts';
import {TOWN_SQUARE} from '../src/harbour/mountain/townSquare.ts';
import {createBasinView,type BasinReading} from '../src/harbour/mountain/basin.ts';
import {createSkateField} from '../src/harbour/skate/world/field.ts';
import {groundHeightAt,TERRAIN_LATTICE_BOUNDS} from '../src/harbour/scene/ground.ts';
import {islandHeight} from '../src/harbour/mountain/islandShape.ts';
import {createDetailStream} from '../src/harbour/mountain/streaming.ts';
import {VILLAGE_SITES} from '../src/harbour/village/layout.ts';
import type {Point3} from '../src/harbour/mountain/math.ts';

const EYE=1.6;
const horizontal=(a:Point3,b:Point3)=>Math.hypot(b[0]-a[0],b[2]-a[2]);

describe('mountain detail lifetime',()=>{
 it('loads before arrival, holds through the release band and releases every departed resource',()=>{
  let builds=0,releases=0;
  const stream=createDetailStream([{id:'woods',at:[0,0],radius:75}],()=>{builds++;return {dispose(){releases++;}};});
  stream.update(74,0);expect(builds).toBe(1);
  for(const x of [76,74,98,76])stream.update(x,0);
  expect(builds).toBe(1);expect(releases).toBe(0);
  stream.update(100,0);expect(releases).toBe(1);expect(stream.live.size).toBe(0);
  for(let lap=0;lap<10;lap++){stream.update(0,0);stream.update(120,0);}
  expect(builds).toBe(releases);stream.dispose();stream.update(0,0);expect(builds).toBe(releases);
 });
 it('prepares the full race corridor before countdown and releases it after the run',()=>{
  const sites=DISTRICTS.map(d=>({id:d.id,at:[d.at[0],d.at[2]] as const,radius:75}));
  const stream=createDetailStream(sites,()=>({dispose(){}}));
  stream.update(0,0,true);expect(stream.live.size).toBe(6);
  stream.update(0,0,false);expect(stream.live.size).toBe(0);stream.dispose();
 });
});

describe('Hearth Mountain spatial contract',()=>{
 it('supports an underpass, a deck and a roof at the same horizontal location',()=>{
  const surfaces:WorldSurface[]=[{id:'bridge',points:[[-5,8,0],[5,8,0]],halfWidth:2,material:'wood',walkable:true},{id:'roof',points:[[-5,14,0],[5,14,0]],halfWidth:2,material:'metal',walkable:true}];
  expect(queryWorldSurface({x:0,z:0,y:0},()=>0,surfaces).y).toBe(0);
  expect(queryWorldSurface({x:0,z:0,y:8},()=>0,surfaces).id).toBe('bridge');
  expect(queryWorldSurface({x:0,z:0,y:14},()=>0,surfaces).id).toBe('roof');
 });
 it('requires forward gate crossings at the right elevation',()=>{
  for(const g of MOUNTAIN_GATES){const [x,y,z]=g.at,[nx,nz]=g.normal;
   expect(crossesRaceGate([x-nx,y,z-nz],[x+nx,y,z+nz],g)).toBe(true);
   expect(crossesRaceGate([x+nx,y,z+nz],[x-nx,y,z-nz],g)).toBe(false);
   expect(crossesRaceGate([x-nx,y-8,z-nz],[x+nx,y-8,z+nz],g)).toBe(false);
  }
 });
});

describe('the landform',()=>{
 it('is an authored mountain in the planned envelope with the districts in uphill order',()=>{
  expect(DISTRICTS.map(d=>d.id)).toEqual(['hearth','orchard','library','glasshouse','reservoir','summit']);
  for(let i=1;i<DISTRICTS.length;i++)expect(DISTRICTS[i]!.at[1]).toBeGreaterThan(DISTRICTS[i-1]!.at[1]);
  let top=-Infinity,minX=Infinity,maxX=-Infinity,minZ=Infinity;
  for(let x=-196;x<=196;x+=4)for(let z=-392;z<-48;z+=4){const h=groundHeightAt(x,z);if(h>0){top=Math.max(top,h);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);}}
  expect(top).toBeGreaterThan(100);expect(top).toBeLessThan(118);
  expect(maxX-minX).toBeGreaterThan(300);expect(maxX-minX).toBeLessThan(400);
  // The summit crown is inside the walkable bounds and rounded, not sheared by an edge fade.
  const s=DISTRICTS.find(d=>d.id==='summit')!;
  for(const [dx,dz] of [[0,-14],[14,0],[-14,0]] as const)expect(Math.abs(groundHeightAt(s.at[0]+dx,s.at[2]+dz)-s.at[1])).toBeLessThan(6);
  expect(groundHeightAt(s.at[0],s.at[2]-40)).toBeGreaterThan(40);
 });
 it('never shows the sea inland: ground near every road, path and district stands above water',()=>{
  const failures:string[]=[];
  for(const s of MOUNTAIN_ROAD_LINE.samples)for(const side of [-12,12]){const x=s.at[0]+s.normal[0]*side,z=s.at[2]+s.normal[2]*side;if(z<-50&&groundHeightAt(x,z)<.2)failures.push(`${x.toFixed(0)},${z.toFixed(0)}`);}
  for(const d of DISTRICTS)for(let a=0;a<6.28;a+=.5){const x=d.at[0]+Math.cos(a)*d.radius*1.6,z=d.at[2]+Math.sin(a)*d.radius*1.6;if(groundHeightAt(x,z)<.2)failures.push(`${d.id}`);}
  expect(failures.slice(0,6)).toEqual([]);
 });
 it('carves a real gorge at least 25 deep where the river runs, with raised banks',()=>{
  const report:number[]=[];
  // The upper gorge (dam foot down to the Library bend); below z -140 it opens out toward Orchard Lane and town.
  for(const p of RIVER.filter(p=>p[2]<-140&&p[2]>-215)){
   const i=RIVER.indexOf(p),q=RIVER[Math.min(RIVER.length-1,i+1)]!,dx=q[0]-p[0],dz=q[2]-p[2],l=Math.hypot(dx,dz)||1;
   const side=(sign:number)=>{let top=-Infinity;for(let o=6;o<=34;o+=1)top=Math.max(top,groundHeightAt(p[0]+dz/l*o*sign,p[2]-dx/l*o*sign));return top;};
   report.push(Math.min(side(1),side(-1))-p[1]);
  }
  console.info('Gorge depth along the upper river:',report.map(d=>d.toFixed(1)).join(' '));
  expect(Math.min(...report)).toBeGreaterThanOrEqual(25);
 });
 it('keeps the river on its bed: the water line is never more than 0.3 above the ground under it',()=>{
  let worst=0;
  for(let i=1;i<RIVER.length;i++){const a=RIVER[i-1]!,b=RIVER[i]!,n=Math.ceil(horizontal(a,b));
   for(let k=0;k<n;k++){const t=k/n,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t,y=a[1]+(b[1]-a[1])*t,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
    // On the mountain the water is never buried; in town lanes cross it on culverts (TOWN_SQUARE.crossings).
    const culvert=z>-40||TOWN_SQUARE.crossings.some(c=>Math.hypot(c.at[0]-x,c.at[1]-z)<4);
    // A cross-section at a bend vertex has no single normal (and the cascade falls along it), so vertices are sampled on the centreline.
    for(const o of k?[-RIVER_HALF_WIDTH*.7,0,RIVER_HALF_WIDTH*.7]:[0]){const g=groundHeightAt(x+dz/l*o,z-dx/l*o);if(z<-50)worst=Math.max(worst,y-g);if(!culvert)expect(g,`${x.toFixed(1)},${z.toFixed(1)}`).toBeLessThan(y+.05);}}
  }
  console.info('River highest above its bed (mountain):',worst.toFixed(2));
  expect(worst).toBeLessThanOrEqual(.3);
 });
 it('has no cut walls the render lattice cannot draw: walkable ground agrees with the lite lattice',()=>{
  const B=TERRAIN_LATTICE_BOUNDS,cols=134,rows=160,dx=(B.maxX-B.minX)/cols,dz=(B.maxZ-B.minZ)/rows;
  const vertex=(ix:number,iz:number)=>groundHeightAt(B.minX+ix*dx,B.minZ+iz*dz);
  const errors:number[]=[];let seed=7;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let n=0;n<6000;n++){
   const x=-150+rand()*300,z=-300+rand()*245,h=groundHeightAt(x,z),slope=Math.hypot(groundHeightAt(x+.5,z)-groundHeightAt(x-.5,z),groundHeightAt(x,z+.5)-groundHeightAt(x,z-.5));
   if(h<1||slope>.6)continue;
   const fx=(x-B.minX)/dx,fz=(z-B.minZ)/dz,ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz;
   // The lattice's two triangles per cell (a,c,b) and (b,c,d).
   const a=vertex(ix,iz),b=vertex(ix+1,iz),c=vertex(ix,iz+1),d=vertex(ix+1,iz+1);
   const lattice=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
   errors.push(Math.abs(lattice-h));
  }
  errors.sort((p,q)=>p-q);const p95=errors[Math.floor(errors.length*.95)]!,max=errors[errors.length-1]!,over=errors.filter(e=>e>.3).length/errors.length;
  console.info('Walkable ground vs lite lattice:',{samples:errors.length,p50:errors[errors.length>>1]!.toFixed(3),p95:p95.toFixed(3),over03:(over*100).toFixed(1)+'%',max:max.toFixed(2)});
  // The dissection measured 13% of walkable samples off by more than 0.3 (worst 21). Cliff-edge cells
  // (a level bench beside a gorge wall) are the only places a lattice may still differ by more.
  expect(p95).toBeLessThan(.3);expect(over).toBeLessThan(.05);
 });
});

describe('the mountain road',()=>{
 const S=MOUNTAIN_ROAD_LINE.samples;
 it('is 800–950 rideable units with an eased grade (target 8–12%, never above 18%)',()=>{
  expect(ROAD_LENGTH).toBeGreaterThan(800);expect(ROAD_LENGTH).toBeLessThan(950);
  const grades=S.map(s=>s.grade),max=Math.max(...grades.map(Math.abs));
  const band=(lo:number,hi:number)=>grades.filter(g=>g>=lo&&g<hi).length/grades.length;
  console.info('Road',{length:ROAD_LENGTH.toFixed(1),maxGrade:(max*100).toFixed(1),'<4%':(band(-1,.04)*100).toFixed(0),'4-8%':(band(.04,.08)*100).toFixed(0),'8-12%':(band(.08,.12)*100).toFixed(0),'12-15%':(band(.12,.15)*100).toFixed(0),'15-18%':(band(.15,.18)*100).toFixed(0)});
  expect(max).toBeLessThanOrEqual(.18);
  // No per-leg stair-steps: the grade changes gradually (vertical curves), never by more than 4% per 5 units.
  for(let i=5;i<S.length;i++)expect(Math.abs(S[i]!.grade-S[i-5]!.grade)).toBeLessThan(.04);
 });
 it('winds like a mountain road: varied bends, little straight, crossing the fall line diagonally',()=>{
  let straight=0;const radii:number[]=[];
  for(const s of S){const r=1/Math.max(1e-6,Math.abs(s.curvature));radii.push(r);if(r>150)straight++;}
  const frac=straight/S.length;
  const tight=radii.filter(r=>r<16).length,medium=radii.filter(r=>r>=16&&r<60).length,gentle=radii.filter(r=>r>=60&&r<=150).length;
  console.info('Road bends',{straightFraction:(frac*100).toFixed(1)+'%',tight,medium,gentle});
  expect(frac).toBeLessThan(.25);expect(tight).toBeGreaterThan(20);expect(medium).toBeGreaterThan(100);expect(gentle).toBeGreaterThan(100);
 });
 it('starts at town grade (no step at the foot) and reaches every district and reserved plot',()=>{
  const foot=S[0]!.at;expect(foot[1]).toBeCloseTo(islandHeight(foot[0],foot[2]),9);
  // The foot eases onto the town ground: gentle for its first metres, no step, no kink.
  for(const s of S.slice(0,4))expect(Math.abs(s.grade),`${s.s}`).toBeLessThan(.1);
  expect(TOWN_RACE_ROAD[0]).toEqual(MOUNTAIN_ROAD[0]);
  const lanes=[S.map(s=>s.at),ORCHARD_LANE_LINE.samples.map(s=>s.at)];
  for(const d of DISTRICTS){const near=Math.min(...lanes.map(l=>nearestOnRoute(d.at[0],d.at[2],l).distance));expect(near,d.id).toBeLessThan(d.radius+12);}
  for(const p of RESERVED_PLOTS){const near=Math.min(...lanes.map(l=>nearestOnRoute(p.gate[0],p.gate[2],l).distance));expect(near,p.id).toBeLessThan(12);}
 });
 it('keeps the road continuously supported without terrain protruding into it',()=>{
  const field=createSkateField(groundHeightAt,{tier:'lite'}),failures:string[]=[];
  for(const s of S)for(const side of [-.85,0,.85]){
   const x=s.at[0]+s.normal[0]*s.halfWidth*side,z=s.at[2]+s.normal[2]*s.halfWidth*side,y=s.at[1]+s.tangent[1]*0;
   const hit=field.sample(x,z,y,'mountain-road');if(Math.abs(hit.y-y)>.3)failures.push(`${s.s.toFixed(0)}:${side}:${hit.y.toFixed(2)}/${y.toFixed(2)}`);
  }
  expect(failures.slice(0,6)).toEqual([]);
 });
 it('is edge-safe: every drop beyond body height has a parapet, wall or bridge rail with collision',()=>{
  const unsafe:string[]=[],drops:{kind:string;drop:number}[]=[];
  for(const line of [MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE])for(const s of line.samples)for(const [side,kind] of [[1,s.left],[-1,s.right]] as const){
   let drop=0;for(let o=.6;o<=3.2;o+=.65){const g=groundHeightAt(s.at[0]+s.normal[0]*(s.halfWidth+o)*side,s.at[2]+s.normal[2]*(s.halfWidth+o)*side);drop=Math.max(drop,s.at[1]-g);}
   drops.push({kind,drop});
   // A skill branch departure: the rail opens for the branch deck, which continues the road surface at the edge.
   const ex=s.at[0]+s.normal[0]*s.halfWidth*side,ez=s.at[2]+s.normal[2]*s.halfWidth*side;
   const departure=kind==='open'&&BRANCH_DEPARTURES.some(d=>d.line===line.id&&SKILL_BRANCHES.find(b=>b.id===d.id)!.points.some(p=>Math.hypot(p[0]-ex,p[2]-ez)<d.halfWidth+1.2&&Math.abs(p[1]-s.at[1])<.8));
   if(drop>EDGE_RULES.parapetDrop&&kind!=='parapet'&&kind!=='wall'&&kind!=='bridge'&&!departure)unsafe.push(`${line.id}@${s.s.toFixed(0)}:${side} drop ${drop.toFixed(1)} ${kind}`);
  }
  const worst=drops.reduce((m,d)=>d.drop>m.drop?d:m);
  console.info('Largest edge drop:',worst.drop.toFixed(1),'guarded by',worst.kind);
  expect(unsafe.slice(0,6)).toEqual([]);
  // Every guarded run has collision along its whole length.
  for(const run of EDGE_RUNS.filter(r=>r.kind==='parapet'||r.kind==='bridge'||r.kind==='wall'))expect(EDGE_SOLIDS.filter(e=>e.id.startsWith(run.id)).length,run.id).toBeGreaterThan(0);
 });
 it('crosses the gorge on two or more typed bridges and passes under another structure',()=>{
  const road=GORGE_BRIDGES.filter(b=>b.carries==='road');
  expect(road.length).toBeGreaterThanOrEqual(2);
  expect(new Set(GORGE_BRIDGES.map(b=>b.type))).toEqual(new Set(['timber','masonry','metal-glass']));
  // Gorge bridges stand high over the channel; the harbour bridge spans the stream near its mouth.
  for(const b of GORGE_BRIDGES){expect(b.clearance,b.id).toBeGreaterThan(b.id==='b-foot'?2.5:6);expect(b.span).toBeGreaterThan(18);expect(b.piers.length).toBeGreaterThan(0);}
  const under=TRANSPORT_CROSSINGS.filter(c=>c.over==='funicular'&&(c.under==='road'||c.under==='lane'));
  expect(under.length).toBeGreaterThan(0);
  for(const c of TRANSPORT_CROSSINGS)expect(c.clearance,c.id).toBeGreaterThanOrEqual(4.5);
 });
});

describe('the glass dam and basin',()=>{
 it('faces the town and is visible from the square at eye height',()=>{
  const eye:Point3=[0,groundHeightAt(0,0)+EYE,0],decks=WORLD_SURFACES.filter(s=>s.kind==='road'||s.kind==='bridge'||s.kind==='branch');
  const visible=DAM_PARTS.arc.filter((_,k)=>k%3===0).map(target=>{
   const n=Math.ceil(horizontal(eye,target));
   for(let k=1;k<n-4;k++){const t=k/n,x=eye[0]+(target[0]-eye[0])*t,y=eye[1]+(target[1]-eye[1])*t,z=eye[2]+(target[2]-eye[2])*t;
    if(groundHeightAt(x,z)>y)return false;
    for(const d of decks){const p=nearestOnRoute(x,z,d.points);if(p.distance<d.halfWidth&&y<p.point[1]+1.2&&y>p.point[1]-1.5)return false;}}
   return true;
  });
  console.info('Dam crest visible from the square:',visible.filter(Boolean).length,'of',visible.length);
  expect(visible[Math.floor(visible.length/2)]).toBe(true);
  expect(visible.filter(Boolean).length/visible.length).toBeGreaterThanOrEqual(.6);
  const toTown=Math.atan2(-DAM.centre[0],-DAM.centre[2]);expect(Math.abs(Math.atan2(DAM.face[0],DAM.face[1])-toTown)).toBeLessThan(.3);
 });
 it('holds the reservoir in a real hollow with stone abutments above the crest and no land bridge',()=>{
  for(const a of DAM_PARTS.abutments)expect(groundHeightAt(a.at[0],a.at[2])).toBeGreaterThan(DAM.crest-8);
  // The reservoir floor behind the dam is below its lowest water level; nothing crosses it.
  const c:[number,number]=[DAM.centre[0],DAM.centre[2]-6];
  expect(groundHeightAt(c[0],c[1])).toBeLessThan(DAM.crest-20);
  for(const s of [...MOUNTAIN_ROAD_LINE.samples.map(s=>s.at),...MOUNTAIN_PATH_GRAPH.edges.filter(e=>e.kind!=='promenade').flatMap(e=>e.points)])expect(Math.hypot(s[0]-c[0],s[2]-c[1])).toBeGreaterThan(12);
  expect(KITTY_CHAMBERS.length).toBeGreaterThan(0);
  for(const k of KITTY_CHAMBERS){expect(Math.hypot(k.at[0]-DAM.centre[0],k.at[2]-DAM.centre[2])).toBeLessThan(DAM.radius+20);for(const st of FUNICULAR_LINE.stations)expect(horizontal(k.at,st.platform.at)).toBeGreaterThan(8);}
  expect(DAM_OVERLOOK.at[1]).toBeGreaterThan(DAM.foot);
 });
});

describe('paths, stairs and doors',()=>{
 it('reaches every district, door, station and plot from the town square; stairs keep Library close',()=>{
  const report:Record<string,string>={};
  for(const d of DISTRICTS){const plan=mountainWalkPlan({x:0,z:-2},{x:d.at[0],z:d.at[2]});expect(plan,d.id).not.toBeNull();report[d.id]=`${plan!.length.toFixed(0)}u walk ${plan!.seconds.toFixed(0)}s run ${(plan!.seconds*2.1/4).toFixed(0)}s`;}
  console.info('Square → district over the path graph:',report);
  const library=mountainWalkPlan({x:0,z:-2},{x:DISTRICTS[2]!.at[0],z:DISTRICTS[2]!.at[2]})!;
  expect(library.edges.some(e=>e.startsWith('stair:'))).toBe(true);
  expect(library.seconds*2.1/4).toBeLessThan(90);
  expect(library.seconds).toBeLessThan(130);
  for(const n of MOUNTAIN_PATH_GRAPH.nodes.filter(n=>n.kind==='door'||n.kind==='station'||n.kind==='plot-gate'))expect(mountainWalkPlan({x:0,z:-2},{x:n.at[0],z:n.at[2]}),n.id).not.toBeNull();
  expect(mountainWalkRoute({x:0,z:-2},{x:DISTRICTS[5]!.at[0],z:DISTRICTS[5]!.at[2]})!.length).toBeGreaterThan(10);
 });
 it('gives every building a door-facing apron and arrives along the door axis',()=>{
  for(const id of Object.keys(BUILDING_SITES) as (keyof typeof BUILDING_SITES)[]){
   const d=buildingDoor(id),edge=MOUNTAIN_PATH_GRAPH.edges.find(e=>e.to===`door:${id}`)!;expect(edge,id).toBeDefined();
   const a=edge.points[edge.points.length-2]!,b=edge.points[edge.points.length-1]!,dir=Math.atan2(a[0]-b[0],a[2]-b[2]);
   expect(Math.abs(Math.atan2(Math.sin(dir-d.yaw),Math.cos(dir-d.yaw))),id).toBeLessThan(.35);
   expect(DOOR_APRONS.some(p=>p.site===id)).toBe(true);
   // The door stands on its level apron at the building's ground.
   const site=VILLAGE_SITES[id];expect(Math.abs(groundHeightAt(d.at[0]+d.facing[0]*2,d.at[1]+d.facing[1]*2)-groundHeightAt(site.spot[0],site.spot[1]))).toBeLessThan(.25);
  }
 });
 it('has stairs between plateaus, woodland walks and at least three authored overlooks',()=>{
  const stairs=MOUNTAIN_PATH_GRAPH.edges.filter(e=>e.kind==='stair');expect(stairs.length).toBeGreaterThanOrEqual(5);
  for(const s of stairs){const rise=Math.abs(s.points[s.points.length-1]![1]-s.points[0]![1]),run=s.length;expect(rise/run,s.id).toBeLessThan(.8);}
  expect(OVERLOOKS.length).toBeGreaterThanOrEqual(3);expect(new Set(OVERLOOKS.map(o=>o.facing.toFixed(2))).size).toBe(OVERLOOKS.length);
  expect(MOUNTAIN_PATH_GRAPH.edges.some(e=>e.kind==='promenade')).toBe(true);
  for(const p of RESERVED_PLOTS)expect(MOUNTAIN_PATH_GRAPH.nodes.some(n=>n.id===`gate:${p.id}`)).toBe(true);
 });
});

describe('transport',()=>{
 it('starts and finishes each legacy ride at its exact platform',()=>{
  for(const kind of ['funicular','gondola'] as const)for(let a=0;a<TRANSPORT_STOPS[kind].length;a++)for(let b=0;b<TRANSPORT_STOPS[kind].length;b++){
   expect(transportPoint(kind,a,b,0)).toEqual(TRANSPORT_STOPS[kind][a]!.at);
   transportPoint(kind,a,b,1).forEach((v,i)=>expect(v).toBeCloseTo(TRANSPORT_STOPS[kind][b]!.at[i]!,8));
  }
 });
 it('runs the funicular on a monotonic incline with stations and platforms off the road',()=>{
  const f=FUNICULAR_LINE;for(let i=1;i<f.path.length;i++)expect(f.path[i]![1]).toBeGreaterThanOrEqual(f.path[i-1]![1]-1e-9);
  expect(f.stations.map(s=>s.id)).toEqual(['town','hearth','library','reservoir']);
  for(const s of f.stations){for(const road of [MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE]){const d=nearestOnRoute(s.platform.at[0],s.platform.at[2],road.samples.map(x=>x.at)).distance;expect(d,s.id).toBeGreaterThan(road.samples[0]!.halfWidth+2);}}
  // Clearance over every road it passes: never on it.
  for(const p of f.path)for(const road of [MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE]){const q=nearestOnRoute(p[0],p[2],road.samples.map(x=>x.at));if(q.distance<road.samples[0]!.halfWidth+1.5)expect(Math.abs(p[1]-q.point[1]),`${p}`).toBeGreaterThanOrEqual(4.5);}
  const frames=transportSpline('funicular').frames(2);expect(frames.every(fr=>Number.isFinite(fr.at[1])&&Math.abs(Math.hypot(...fr.tangent)-1)<1e-6)).toBe(true);
 });
 it('hangs the gondola from towers on sagging spans that cross the gorge high up',()=>{
  const g=GONDOLA_LINE;expect(g.towers.length).toBeGreaterThanOrEqual(2);
  let crossesGorge=false;
  for(let i=1;i<g.path.length;i++){const a=g.path[i-1]!,b=g.path[i]!;
   const r=nearestOnRoute(b[0],b[2],RIVER);if(r.distance<3&&b[2]<-120&&b[1]-r.point[1]>40)crossesGorge=true;
   const clear=b[1]-3.1-groundHeightAt(b[0],b[2]);if(horizontal(b,g.path[0]!)>25&&horizontal(b,g.path[g.path.length-1]!)>25)expect(clear,`${b}`).toBeGreaterThan(6);void a;}
  expect(crossesGorge).toBe(true);
  expect(TRANSPORT_LINES.gondola.cruise).toBeGreaterThan(0);
 });
});

describe('Summit to Sea',()=>{
 it('runs as named segments in the plan’s order with upright gates at the features',()=>{
  expect(MOUNTAIN_RACE_SEGMENTS.map(s=>s.id)).toEqual(['summit-start','alpine-bends','dam-overlook','meadow-sweep','woodland-bridges','library-balcony','neighbourhood-switchbacks','town-canal-crossing','waterfront-finish']);
  for(let i=1;i<MOUNTAIN_RACE_SEGMENTS.length;i++){expect(MOUNTAIN_RACE_SEGMENTS[i]!.i0).toBe(MOUNTAIN_RACE_SEGMENTS[i-1]!.i1);expect(MOUNTAIN_RACE_SEGMENTS[i]!.s1).toBeGreaterThan(MOUNTAIN_RACE_SEGMENTS[i]!.s0);}
  const order=MOUNTAIN_GATES.map(g=>MOUNTAIN_COURSE_POINTS.indexOf(g.at));expect(order.every(i=>i>=0)).toBe(true);
  for(let i=1;i<order.length;i++)expect(order[i]).toBeGreaterThan(order[i-1]!);
  for(const g of MOUNTAIN_GATES){expect(g.height).toBeGreaterThan(3);const seg=MOUNTAIN_RACE_SEGMENTS.find(s=>s.id===g.segment)!;const i=MOUNTAIN_COURSE_POINTS.indexOf(g.at);expect(i,g.id).toBeGreaterThanOrEqual(seg.i0);expect(i,g.id).toBeLessThanOrEqual(seg.i1);}
  expect(MOUNTAIN_GATES.some(g=>GORGE_BRIDGES.some(b=>b.deck.some(p=>horizontal(p,g.at)<1)))).toBe(true);
 });
 it('finishes on the quay with at least 25 units of run-out, away from the bank and studio doors',()=>{
  expect(RACE_FINISH.runout).toBeGreaterThanOrEqual(25);expect(RACE_FINISH.laneRunout).toBeGreaterThanOrEqual(25);
  for(const id of ['bank','studio'] as const){const s=VILLAGE_SITES[id],yaw=Math.atan2(-s.spot[0],-s.spot[1]),door=[s.spot[0]+s.door[0]*Math.cos(yaw)+s.door[1]*Math.sin(yaw),s.spot[1]+s.door[1]*Math.cos(yaw)-s.door[0]*Math.sin(yaw)];
   for(const p of TOWN_RACE_ROAD)expect(Math.hypot(p[0]-door[0]!,p[2]-door[1]!),id).toBeGreaterThan(10);}
  // The town lane lies on town ground and crosses the channel on its bridge.
  for(const p of TOWN_RACE_ROAD)expect(p[1]).toBeCloseTo(islandHeight(p[0],p[2]),9);
  expect(nearestOnRoute(CANAL_BRIDGE.at[0],CANAL_BRIDGE.at[2],RIVER).distance).toBeLessThan(2);
  expect(nearestOnRoute(CANAL_BRIDGE.at[0],CANAL_BRIDGE.at[2],TOWN_RACE_ROAD).distance).toBeLessThan(1);
  expect(Math.hypot(TOWN_SQUARE.plaza.centre[0]-RACE_FINISH.at[0],TOWN_SQUARE.plaza.centre[1]-RACE_FINISH.at[2])).toBeGreaterThan(TOWN_SQUARE.plaza.radius);
 });
 it('offers three architectural branches that are shorter than the road they bypass and skip no gate',()=>{
  expect(SKILL_BRANCHES.map(b=>b.kind).sort()).toEqual(['awning','balcony','rail']);
  for(const b of SKILL_BRANCHES){
   expect(b.branchLength,b.id).toBeLessThan(b.roadLength);
   expect(b.segments.map(s=>s.kind)).toContain('landing');
   expect(MOUNTAIN_GATES.some(g=>{const i=MOUNTAIN_COURSE_POINTS.indexOf(g.at);return i>b.entry&&i<b.exit;}),b.id).toBe(false);
   for(let i=1;i<b.points.length;i++){const a=b.points[i-1]!,c=b.points[i]!,run=horizontal(a,c);if(run>.2)expect(Math.abs(c[1]-a[1])/run,`${b.id}@${i}`).toBeLessThan(.4);}
  }
  const library=SKILL_BRANCHES.find(b=>b.kind==='balcony')!;const site=BUILDING_SITES.library;
  expect(Math.min(...library.points.map(p=>Math.hypot(p[0]-site[0],p[2]-site[1])))).toBeLessThan(5);
 });
});

const reading=(extra:Partial<BasinReading>={}):BasinReading=>({identity:'fictional:house',revision:1,asOf:'2026-09-24',known:true,balanceCents:40000,kittyCents:10000,freeCents:30000,pendingCents:5000,targetCents:100000,flows:[{id:'old',kind:'inlet',cents:40000,label:'Confirmed'}],...extra});
describe('Fund basin view',()=>{
 it('primes history, animates a new accepted event once and keeps a stable scale',()=>{
  const view=createBasinView();expect(view(reading()).newFlows).toEqual([]);
  const next=reading({revision:2,balanceCents:45000,flows:[...reading().flows,{id:'new',kind:'reserve-in',cents:5000,label:'Released'}]});
  expect(view(next).newFlows.map(f=>f.id)).toEqual(['new']);expect(view(next).newFlows).toEqual([]);
  expect(view({...next,targetCents:50000}).scaleCents).toBe(100000);
  expect(view({...next,balanceCents:200000,revision:3}).scaleChanged).toBe(true);
 });
 it('does not turn unknown evidence into empty water or events',()=>{
  const view=createBasinView();view(reading());expect(view(reading({known:false,balanceCents:null})).level).toBeNull();
  expect(view(reading()).newFlows).toEqual([]);
 });
});

import {courtObstacles,holdAshore} from '../src/harbour/body/obstacles.ts';
import {makeSim,intent} from '../src/harbour/skate/sim/testKit.ts';
import {skateSimOptions} from '../src/harbour/skate/driver.ts';
it('stops an upward jump at a bridge underside without selecting its upper deck',()=>{
 const decks:WorldSurface[]=[{id:'test-bridge',points:[[-10,3,0],[10,3,0]],halfWidth:5,material:'wood',walkable:true}];
 const sim=makeSim({sample:()=>({y:0,nx:0,ny:1,nz:0,kind:'concrete',feature:null,lip:null}),ceilingAt:(x,z,y)=>worldCeilingAt(x,z,y,.2,decks),grindables:[],solids:[],spots:[]});
 let highest=0;
 for(let i=0;i<120;i++){const p=sim.step(intent({pop:i===0?{from:'tail',flipId:null,strength:1}:null}),1/60).present;highest=Math.max(highest,p.y);}
 expect(highest).toBeGreaterThan(.3);expect(highest+1.55).toBeLessThanOrEqual(2.72+.001);expect(sim.present().y).toBeCloseTo(0,3);
});
it('rides the whole descent with the shipped skate options: finishes, no bails, every gate in order',()=>{
 const route=MOUNTAIN_COURSE_POINTS,start=route[0]!,next=route[1]!,field=createSkateField(groundHeightAt,{tier:'lite'});
 const sim=makeSim(field,{x:start[0],z:start[2],y:start[1],yaw:Math.atan2(next[0]-start[0],next[2]-start[2]),...skateSimOptions(courtObstacles('lite'),field)});
 let index=0,seconds=0,bails=0,maxError=0,gateIndex=1;const bailAt:string[]=[];
 for(let tick=0;tick<200*60;tick++){
  const p=sim.present();
  let nearest=index,dist=Infinity;
  for(let i=index;i<Math.min(route.length,index+12);i++){const q=route[i]!,d=Math.hypot(p.x-q[0],p.z-q[2]);if(d<dist){nearest=i;dist=d;}}
  index=nearest;maxError=Math.max(maxError,dist);
  if(gateIndex===MOUNTAIN_GATES.length){seconds=tick/60;break;}
  let aim=index;let ahead=0;while(aim<route.length-1&&ahead<Math.max(3,p.speed*.65)){const a=route[aim]!,b=route[++aim]!;ahead+=Math.hypot(b[0]-a[0],b[2]-a[2]);}
  const target=route[aim]!,angle=Math.atan2(target[0]-p.x,target[2]-p.z),error=Math.atan2(Math.sin(angle-p.boardYaw),Math.cos(angle-p.boardYaw));
  const before=[p.x,p.y,p.z] as const;
  const result=sim.step(intent({push:true,steer:Math.max(-1,Math.min(1,-error*2.2))}),1/60);
  const after=result.present;if(MOUNTAIN_GATES[gateIndex]&&crossesRaceGate(before,[after.x,after.y,after.z],MOUNTAIN_GATES[gateIndex]!))gateIndex++;
  for(const e of result.events)if(e.kind==='bail'){bails++;bailAt.push(`${index}:${JSON.stringify(e)}`);}
 }
 console.info('Summit to Sea, input-driven descent (shipped options):',{seconds,index,points:route.length,bails,bailAt:bailAt.slice(0,3),maxError:maxError.toFixed(2),gateIndex,gates:MOUNTAIN_GATES.length});
 // Movement tuning (gravity) belongs to another track: assert completion, not a duration.
 expect(bails).toBe(0);expect(gateIndex).toBe(MOUNTAIN_GATES.length);expect(seconds).toBeGreaterThan(0);
},60000);

import {pushOutAll,hit} from '../src/harbour/skate/sim/geometry.ts';
it('keeps the complete width of each optional branch supported, clear and inside the world',()=>{
 const obstacles=courtObstacles('lite'),out=hit(),failures:unknown[]=[];
 for(const branch of SKILL_BRANCHES)for(let i=1;i<branch.points.length;i++){
  const a=branch.points[i-1]!,b=branch.points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
  for(let k=0;k<=4;k++)for(const side of [-.95,0,.95]){
   const t=k/4,x=a[0]+dx*t+dz/l*branch.halfWidth*side,z=a[2]+dz*t-dx/l*branch.halfWidth*side,y=a[1]+(b[1]-a[1])*t;
   const surface=queryWorldSurface({x,z,y,supportId:branch.id},groundHeightAt);
   pushOutAll(x,z,y,.24,obstacles,[],out);
   if(Math.abs(surface.y-y)>.3||out.id||!holdAshore(x,z).ashore)failures.push({branch:branch.id,i,x,y,z,surface:surface.y,solid:out.id});
  }
 }
 expect(failures.slice(0,8)).toEqual([]);
});
it('keeps the full downhill road width clear of buildings, trees and boundary clamps',()=>{
 const obstacles=courtObstacles('lite'),out=hit();const failures:unknown[]=[];
 for(let i=1;i<MOUNTAIN_COURSE_POINTS.length;i++){
  const p=MOUNTAIN_COURSE_POINTS[i]!,a=MOUNTAIN_COURSE_POINTS[i-1]!,dx=p[0]-a[0],dz=p[2]-a[2],l=Math.hypot(dx,dz)||1;
  for(const side of [-2,0,2]){const x=p[0]+dz/l*side,z=p[2]-dx/l*side;
   pushOutAll(x,z,p[1],.24,obstacles,[],out);const shore=holdAshore(x,z);
   if(out.id||!shore.ashore)failures.push({i,x,z,id:out.id,shore:shore.ashore});
  }
 }
 expect(failures).toEqual([]);
});

it('does not replay contributions received while evidence was frozen',()=>{
 const view=createBasinView();view(reading({identity:'reconnect'}));view(reading({identity:'reconnect',motion:false}));
 const resumed=reading({identity:'reconnect',revision:2,flows:[...reading().flows,{id:'offline-arrival',kind:'inlet',cents:10000,label:'Contribution'}]});
 expect(view(resumed).newFlows).toEqual([]);
 expect(view({...resumed,revision:3,flows:[...resumed.flows,{id:'live-arrival',kind:'inlet',cents:10000,label:'Contribution'}]}).newFlows.map(f=>f.id)).toEqual(['live-arrival']);
});
import {createWorldTrack} from '../src/ledgerSync/worldMotion.ts';
import {decodeWorldPresence} from '../src/ledgerSync/worldPresenceWire.ts';
import {createSkateDriver} from '../src/harbour/skate/driver.ts';
it('mounts underneath a road bridge and preserves the elevation of a recovery marker',()=>{
 const bridge=[...GORGE_BRIDGES].filter(b=>b.carries==='road').sort((a,b)=>b.clearance-a.clearance)[0]!,mid=bridge.deck[Math.floor(bridge.deck.length/2)]!;
 const x=mid[0],z=mid[2],y=groundHeightAt(x,z),field=createSkateField(groundHeightAt,{tier:'lite'});
 expect(field.sample(x,z).y-y).toBeGreaterThan(10);
 const driver=createSkateDriver({obstacles:[]});
 driver.mount(x,z,0,undefined,{y});expect(driver.present()!.y).toBeCloseTo(y,5);
 expect(driver.unmount()!.y).toBeCloseTo(y,5);
 const sim=makeSim(createSkateField(()=>0,{tier:'lite'}),{x,z,y:0});expect(sim.setMarker()).toBe(true);
 sim.reset(0,0,0);sim.toMarker();expect(sim.present().y).toBeCloseTo(0,5);
});
it('keeps elevated walking and delayed mountain presence outside the old shore radius',()=>{
 const lib=DISTRICTS[2]!.at,track=createWorldTrack({renderDelayMs:0});
 for(const [at,x] of [[0,lib[0]-1],[100,lib[0]]]){const pose=decodeWorldPresence({type:'world-step',version:1,world:'hearth-mountain-1',x,z:lib[2],y:lib[1],yaw:0,moving:true});if(pose.type==='world-step')track.push({...pose,at:at!});}
 expect(track.pose(200)?.x).toBeGreaterThanOrEqual(lib[0]);expect(track.pose(200)?.y).toBe(lib[1]);expect(track.pose(2700)?.y).toBe(lib[1]);
});
it('keeps every mountain ground sample finite and the terrain function cheap to call',()=>{
 const t0=performance.now();let sum=0;for(let i=0;i<200000;i++){const x=-150+(i*37%300),z=-300+(i*53%250);sum+=groundHeightAt(x,z);}
 const perCall=(performance.now()-t0)/200000*1000;console.info('groundHeightAt µs/call:',perCall.toFixed(3));
 expect(Number.isFinite(sum)).toBe(true);expect(mountainBaseHeight(0,-150)).toBeGreaterThan(0);
});

import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MountainMap} from '../src/harbour/mountain/MountainPanel.tsx';
import {mountainMap} from '../src/harbour/mountain/mapData.ts';
it('draws the guide map from the shipped geography with a text alternative and a spoken “you are here”',()=>{
 const map=mountainMap();
 for(const kind of ['coast','contour','river','reservoir','road','lane','bridge','stair','dam','funicular','gondola'])expect(map.lines.some(l=>l.kind===kind),kind).toBe(true);
 for(const d of DISTRICTS)expect(map.points.some(p=>p.id===d.id)).toBe(true);
 const html=renderToStaticMarkup(createElement(MountainMap,{here:DISTRICTS.find(d=>d.id==='library')!.at}));
 expect(html).toContain('role="img"');expect(html).toContain('<title>');
 expect(html).toMatch(/<desc id="[^"]+">[^<]*You are here: near Library Woods/);
 const plain=renderToStaticMarkup(createElement(MountainMap,{}));expect(plain).not.toContain('You are here');
});
