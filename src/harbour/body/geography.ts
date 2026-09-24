/**
 * Movement's view of the world's geography — the ONE seam between the body /
 * skate / ride code and the authored mountain data.
 *
 * Every function here is a small adapter over whatever the geography exports
 * today. At integration each is pointed at the geography contract's new
 * exports (see the `CONTRACT` notes on each) without the movement code that
 * calls it changing. Pure: no three.js, no DOM, no clock.
 */
import {DISTRICTS,FOOTPATHS,MOUNTAIN_ROAD,RESERVED_PLOTS,TRANSPORT_STOPS,WORLD_BOUNDS,mountainBaseHeight,nearestOnRoute,transportPoint,type Point3,type TransportKind} from '../mountain/definition.ts';
import {SKILL_BRANCHES,WORLD_SOLIDS,queryWorldSurface,worldCeilingAt,type WorldSolid,type WorldSurfaceHit} from '../mountain/surfaces.ts';
import {MOUNTAIN_COURSE_POINTS,MOUNTAIN_GATES,type RaceGate} from '../mountain/race.ts';
import {groundHeightAt} from '../scene/ground.ts';
import {HARBOUR_LAND,HARBOUR_LANES} from '../village/world.ts';

export type {Point3,TransportKind};

/* ───────────────────────────────────────────────────────────── ground */

/**
 * The terrain height the renderer draws. One function for the whole world:
 * the walker, the skater and the camera never keep a second copy.
 * CONTRACT: `groundHeightAt` (scene/ground.ts) — unchanged name.
 */
export const terrainHeightAt = (x:number,z:number):number=>groundHeightAt(x,z);

/**
 * The surface that supports a body at (x, z), given where its feet are and
 * what it last stood on. Stacked decks, bridges and the ground under them
 * resolve by altitude, never by a second, partial sampler.
 * CONTRACT: `queryWorldSurface` (mountain/surfaces.ts).
 */
export function supportAt(x:number,z:number,y:number|undefined,supportId:string|null|undefined,terrain:(x:number,z:number)=>number=terrainHeightAt,stepHeight=.48):WorldSurfaceHit{
  return queryWorldSurface({x,z,...(y===undefined?{}:{y}),supportId:supportId??null,stepHeight},terrain);
}

/**
 * The underside of whatever stands over the feet, for BOTH the walker and the
 * skater. A deck lower than `OVERHEAD_MIN` above the feet is not somewhere a
 * body can pass beneath — it is a ramp mouth or a ledge's side — so it is
 * never a ceiling (the dead-stop the race met at every branch and footpath
 * mouth). A real overhead passage returns its underside.
 * CONTRACT: `worldCeilingAt` (mountain/surfaces.ts).
 */
export const OVERHEAD_MIN = 1.7;
export function overheadAt(x:number,z:number,feet:number,radius=.2):number{
  let ceiling=worldCeilingAt(x,z,feet,radius);
  // Undersides are deck − 0.28: a deck within OVERHEAD_MIN of the feet is a mouth, not a roof.
  for(let guard=0;guard<4&&Number.isFinite(ceiling)&&ceiling+.28<feet+OVERHEAD_MIN;guard++){
    ceiling=worldCeilingAt(x,z,ceiling+.29,radius);
  }
  return ceiling;
}

/* ───────────────────────────────────────────────────────────── edges */

/** What stands at the side of a walkable surface. */
export type EdgeKind='parapet'|'wall'|'bridge'|'kerb'|'open';
/** Edges that nothing on foot crosses — not by walking, not by a jump. */
export const HARD_EDGES:ReadonlySet<EdgeKind>=new Set(['parapet','wall','bridge']);
/**
 * The edge beside a supported point. Today's data carries no per-sample kinds,
 * so every road/path edge reads as `open` (a soft lip protects drops beyond a
 * body height) — which is the fair default until parapets and kerbs arrive.
 * CONTRACT: geography's per-sample road edge kinds (`roadEdgeKindAt(x,z)` /
 * `ROAD_SAMPLES[i].edges`), keyed by the support id.
 */
export function edgeKindAt(supportId:string|null|undefined,_x:number,_z:number):EdgeKind{
  void supportId;return 'open';
}

/* ───────────────────────────────────────────────────────────── solids and bounds */

/**
 * Walking/skating obstacle volumes for authored objects (parapets, abutments,
 * storefronts, cabins, station posts).
 * CONTRACT: `WORLD_SOLIDS` (mountain/surfaces.ts).
 */
export const worldSolids=():readonly WorldSolid[]=>WORLD_SOLIDS;

/** A closed polygon in the ground plane, [x, z] pairs. */
export type Polygon=readonly (readonly [number,number])[];
let boundary:Polygon|null=null;
/**
 * The mountain's walkable outline: where land stands above the sea, traced
 * once from the same terrain the renderer draws. The town island keeps its
 * authored shore circle; the world bound is the union of the two.
 * CONTRACT: `WORLD_BOUNDARY` (a polygon the geography draws a visible edge along).
 */
export function worldBoundary():Polygon{
  if(boundary)return boundary;
  const cx=0,cz=-185,rays=144,out:[number,number][]=[];
  for(let i=0;i<rays;i++){
    const a=i/rays*Math.PI*2,dx=Math.sin(a),dz=Math.cos(a);let last=0;
    for(let r=0;r<=270;r+=2){
      const x=cx+dx*r,z=cz+dz*r;
      if(x<WORLD_BOUNDS.minX||x>WORLD_BOUNDS.maxX||z<WORLD_BOUNDS.minZ||z>-40)break;
      if(mountainBaseHeight(x,z)>-.3||nearestOnRoute(x,z).distance<5)last=r;
    }
    out.push([cx+dx*Math.max(0,last-.6),cz+dz*Math.max(0,last-.6)]);
  }
  boundary=out;return boundary;
}
function insidePolygon(x:number,z:number,poly:Polygon):boolean{
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [xi,zi]=poly[i]!,[xj,zj]=poly[j]!;
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/((zj-zi)||1e-12)+xi)inside=!inside;
  }
  return inside;
}
function nearestOnPolygon(x:number,z:number,poly:Polygon):{x:number;z:number;d:number}{
  let best={x,z,d:Infinity};
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [ax,az]=poly[j]!,[bx,bz]=poly[i]!,dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz;
    const t=l?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l)):0,px=ax+dx*t,pz=az+dz*t,d=Math.hypot(x-px,z-pz);
    if(d<best.d)best={x:px,z:pz,d};
  }
  return best;
}
/**
 * Hold a point inside the world: the town's shore circle or the mountain's
 * land outline. A point already inside is returned unchanged. Outside, it goes
 * to the NEAREST boundary point — a clamp, never a re-projection onto a road.
 */
export function holdInsideWorld(x:number,z:number,shore:number=HARBOUR_LAND.shore):{x:number;z:number;inside:boolean}{
  const r=Math.hypot(x,z);
  if(r<=shore)return {x,z,inside:true};
  const poly=worldBoundary();
  if(z<-40&&insidePolygon(x,z,poly))return {x,z,inside:true};
  const k=r>0?shore/r:0,cx=x*k,cz=z*k,edge=nearestOnPolygon(x,z,poly);
  // The polygon only covers the mountain (z < −40); its projection must itself be inside the world.
  if(edge.d<Math.hypot(x-cx,z-cz))return {x:edge.x,z:edge.z,inside:false};
  return {x:cx,z:cz,inside:false};
}

/* ───────────────────────────────────────────────────────────── the walk graph */

export type WalkNode={id:number;x:number;y:number;z:number;supportId:string;kind:'road'|'path'|'lane'|'station'|'stairs'};
export type WalkGraph={nodes:readonly WalkNode[];edges:readonly (readonly {to:number;cost:number}[])[]};
let graph:WalkGraph|null=null;
/**
 * The pedestrian network: road, footpaths (and, from the geography contract,
 * stairs, bridges, aprons and overlooks), the town's lanes and the stations.
 * Tap-to-walk plans over this; safe returns land on its nodes.
 * CONTRACT: `PATH_GRAPH` {nodes:[{id,at,supportId,kind}], edges:[{a,b,kind}]}.
 */
export function walkGraph():WalkGraph{
  if(graph)return graph;
  const nodes:WalkNode[]=[],edges:{to:number;cost:number}[][]=[];
  const add=(x:number,y:number,z:number,supportId:string,kind:WalkNode['kind'])=>{nodes.push({id:nodes.length,x,y,z,supportId,kind});edges.push([]);return nodes.length-1;};
  const link=(a:number,b:number)=>{if(a===b)return;const p=nodes[a]!,q=nodes[b]!,c=Math.hypot(p.x-q.x,p.z-q.z)+Math.abs(p.y-q.y)*.5;edges[a]!.push({to:b,cost:c});edges[b]!.push({to:a,cost:c});};
  const lines:number[][]=[];
  const polyline=(points:readonly (readonly [number,number,number])[],supportId:string,kind:WalkNode['kind'],spacing=3)=>{
    const ids:number[]=[];
    for(let i=0;i<points.length;i++){
      const p=points[i]!;
      if(i>0){const q=points[i-1]!,n=Math.floor(Math.hypot(p[0]-q[0],p[2]-q[2])/spacing);
        for(let k=1;k<=n;k++){const t=k/(n+1);ids.push(add(q[0]+(p[0]-q[0])*t,q[1]+(p[1]-q[1])*t,q[2]+(p[2]-q[2])*t,supportId,kind));}}
      ids.push(add(p[0],p[1],p[2],supportId,kind));
    }
    for(let i=1;i<ids.length;i++)link(ids[i-1]!,ids[i]!);
    lines.push(ids);return ids;
  };
  polyline(MOUNTAIN_ROAD,'mountain-road','road',6);
  for(const p of FOOTPATHS)polyline(p.points,`path:${p.id}`,'path');
  for(const lane of HARBOUR_LANES)polyline(lane.points.map(([x,z])=>[x,groundHeightAt(x,z),z] as const),'terrain','lane',3);
  for(const [kind,stops] of Object.entries(TRANSPORT_STOPS))for(const s of stops)lines.push([add(s.at[0],s.at[1],s.at[2],`station:${kind}:${s.id}`,'station')]);
  // Junctions: a line's ends meet the nearest node of any other line; crossings meet where they touch.
  const owner=new Map<number,number>();lines.forEach((ids,l)=>ids.forEach(id=>owner.set(id,l)));
  for(let l=0;l<lines.length;l++){
    const ids=lines[l]!,ends=new Set([ids[0]!,ids[ids.length-1]!]);
    for(const a of ids){
      const reach=ends.has(a)?(nodes[a]!.kind==='station'?14:6.5):2.2;
      let best=-1,bestD=Infinity;
      for(const b of nodes){if(owner.get(b.id)===l)continue;const p=nodes[a]!,d=Math.hypot(p.x-b.x,p.z-b.z);if(d<reach&&Math.abs(p.y-b.y)<1.6&&d<bestD){best=b.id;bestD=d;}}
      if(best>=0)link(a,best);
    }
  }
  graph={nodes,edges};return graph;
}
/** Dijkstra over the walk graph between two node ids. */
export function walkGraphRoute(from:number,to:number):WalkNode[]|null{
  const g=walkGraph(),n=g.nodes.length,cost=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),done=new Uint8Array(n);
  cost[from]=0;
  for(;;){
    let u=-1,best=Infinity;for(let i=0;i<n;i++)if(!done[i]&&cost[i]!<best){best=cost[i]!;u=i;}
    if(u<0)return null;if(u===to)break;done[u]=1;
    for(const e of g.edges[u]!){const c=best+e.cost;if(c<cost[e.to]!){cost[e.to]=c;prev[e.to]=u;}}
  }
  const out:WalkNode[]=[];for(let i=to;i>=0;i=prev[i]!)out.push(g.nodes[i]!);
  return out.reverse();
}
/** Walk-graph nodes nearest a point, nearest first; a tapped height prefers its own level. */
export function nearestWalkNodes(x:number,z:number,y?:number,limit=6):WalkNode[]{
  return [...walkGraph().nodes].map(n=>({n,d:Math.hypot(n.x-x,n.z-z)+(y===undefined?0:Math.max(0,Math.abs(n.y-y)-1)*3)})).sort((a,b)=>a.d-b.d).slice(0,limit).map(o=>o.n);
}
/**
 * Where a body that fell lands again: the path node nearest the place it left.
 * CONTRACT: nearest `PATH_GRAPH` node (safe-arrival nodes preferred).
 */
export function safeReturnPoint(x:number,y:number,z:number):{x:number;y:number;z:number;supportId:string}{
  const [n]=nearestWalkNodes(x,z,y,1);
  return n?{x:n.x,y:n.y,z:n.z,supportId:n.supportId}:{x:0,y:groundHeightAt(0,0),z:0,supportId:'terrain'};
}
/** Where arriving at a district means arriving: its apron, a few units in from its footpath. */
export function districtArrival(id:string):Point3|null{
  const d=[...DISTRICTS,...RESERVED_PLOTS].find(d=>d.id===id),path=FOOTPATHS.find(p=>p.id===id);if(!d||!path)return null;
  const a=path.points[0]!,b=path.points[1]!,l=Math.hypot(b[0]-a[0],b[2]-a[2])||1,t=Math.max(0,1-6/l);
  return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
}

/* ───────────────────────────────────────────────────────────── transport */

export type TransportFrame={at:Point3;yaw:number;pitch:number};
export type TransportCurve={kind:TransportKind;from:number;to:number;length:number;cruise:number;frame(s:number):TransportFrame};
const curves=new Map<string,TransportCurve>();
/** Cruise speed along each line, units per second. CONTRACT: the spline's own `cruise`. */
export const TRANSPORT_CRUISE:Readonly<Record<TransportKind,number>>={funicular:7,gondola:9};
/**
 * The line a cabin rides between two stops, by ARC LENGTH, with its facing.
 * Today the alignment is `transportPoint`'s lerp: it is re-sampled here and
 * re-parameterised so equal time is equal distance (no 65 u/s spans).
 * CONTRACT: `TRANSPORT_SPLINES[kind]` with orientation frames (`transportFrame`).
 */
export function transportCurve(kind:TransportKind,from:number,to:number):TransportCurve{
  const key=`${kind}:${from}:${to}`,cached=curves.get(key);if(cached)return cached;
  const N=720,pts:Point3[]=[],cum:number[]=[0];
  // transportPoint eases its own parameter; invert smoothstep so samples are spread evenly along the line.
  const unsmooth=(u:number)=>{let t=u;for(let i=0;i<8;i++){const f=t*t*(3-2*t)-u,df=6*t*(1-t);if(df<1e-6)break;t=Math.max(0,Math.min(1,t-f/df));}return t;};
  for(let i=0;i<=N;i++){pts.push(transportPoint(kind,from,to,unsmooth(i/N)));if(i)cum.push(cum[i-1]!+Math.hypot(pts[i]![0]-pts[i-1]![0],pts[i]![1]-pts[i-1]![1],pts[i]![2]-pts[i-1]![2]));}
  const length=cum[N]!;
  const frame=(s:number):TransportFrame=>{
    const at=Math.max(0,Math.min(length,s));let lo=0,hi=N;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(cum[mid]!<=at)lo=mid;else hi=mid;}
    const seg=cum[hi]!-cum[lo]!,t=seg>1e-9?(at-cum[lo]!)/seg:0,a=pts[lo]!,b=pts[hi]!;
    const p:Point3=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
    // Facing: along the line over a few units, so a cabin turns with its track and does not jitter.
    const ahead=Math.min(N,hi+6),behind=Math.max(0,lo-6),q=pts[ahead]!,r=pts[behind]!,dx=q[0]-r[0],dz=q[2]-r[2];
    return {at:p,yaw:Math.hypot(dx,dz)>1e-6?Math.atan2(dx,dz):0,pitch:Math.atan2(q[1]-r[1],Math.hypot(dx,dz)||1)};
  };
  const curve={kind,from,to,length,cruise:TRANSPORT_CRUISE[kind],frame};curves.set(key,curve);return curve;
}
/** Platforms you can walk onto to board. CONTRACT: `TRANSPORT_STOPS` (+ platform extents). */
export function stationPlatforms():{kind:TransportKind;index:number;id:string;name:string;at:Point3}[]{
  return (Object.entries(TRANSPORT_STOPS) as [TransportKind,readonly {id:string;name:string;at:Point3}[]][]).flatMap(([kind,stops])=>stops.map((s,index)=>({kind,index,id:s.id,name:s.name,at:s.at})));
}
export const transportStopCount=(kind:TransportKind):number=>TRANSPORT_STOPS[kind].length;

/* ───────────────────────────────────────────────────────────── the race */

export type RaceSegmentKind='main'|'finish'|'runout';
/**
 * Is (x, z) on the race corridor — the mountain road or the town line it runs
 * into — where a skater feels the real slope?
 * CONTRACT: `RACE_SEGMENTS` / race corridor polyline + half width.
 */
export function raceCorridorAt(x:number,z:number):boolean{
  if(z<-40)return nearestOnRoute(x,z).distance<=7||SKILL_BRANCHES.some(b=>nearestOnRoute(x,z,b.points).distance<=b.halfWidth+2);
  return nearestOnRoute(x,z,MOUNTAIN_COURSE_POINTS).distance<=6;
}
/** Units of braking room the finish owns past its line. CONTRACT: the `runout` race segment's length. */
export const RUNOUT_LENGTH=24;
/** The ordered 3D gates. CONTRACT: `MOUNTAIN_GATES` (race.ts) — per named segment. */
export const raceGates=():readonly RaceGate[]=>MOUNTAIN_GATES;
