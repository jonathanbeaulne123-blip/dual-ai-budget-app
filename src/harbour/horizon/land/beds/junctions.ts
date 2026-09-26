import type { BedCut, HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { addFlatPad, emitBedGeometry } from './profiles';
import { gradeRoute, type HeightPin } from './solver';
import { gradePadApproaches } from './padApproaches';
import { box, clamp, distance, districtAt, maxGrade, mix, nearestOnPath, plan, prism, slab, solid } from '../structures/mesh';

export interface ComputedCrossing {
  id:string;a:string;b:string;sourceA?:string;sourceB?:string;at:XY;heightA:number;heightB:number;
  resolution:'threshold'|'over'|'under';requiredClearance:number;built?:boolean;clearancePass?:boolean;
  kind?:string;
}
// Junction cuts only remove geometry, so the original bounds remain conservative
// for every later cut of this solid. Most walls are nowhere near a given join.
const edgeBounds=new WeakMap<StructureSolid,readonly number[]>();
function clipEdgePrisms(piece:StructureSolid,at:XY,radius:number,height:number,passageClearance?:number,maxTop=Infinity,minTop=-Infinity):void {
  if(!piece.positions.length)return;
  let limits=edgeBounds.get(piece);
  if(!limits){
    const p=piece.positions,b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity,0];
    for(let i=0;i<p.length;i+=3)for(let axis=0;axis<3;axis++){b[axis]=Math.min(b[axis]!,p[i+axis]!);b[axis+3]=Math.max(b[axis+3]!,p[i+axis]!);}
    for(let i=0;i+23<p.length;i+=24)b[6]=Math.max(b[6]!,Math.min(Math.hypot(p[i+12]!-p[i+15]!,p[i+14]!-p[i+17]!),Math.hypot(p[i+15]!-p[i+18]!,p[i+17]!-p[i+20]!))/2);
    limits=b;edgeBounds.set(piece,limits);
  }
  const dx=Math.max(limits[0]!-at[0],0,at[0]-limits[3]!),dz=Math.max(limits[2]!-at[1],0,at[1]-limits[5]!);
  // Include the old cutter's rounded end-cap allowance as well as its radius.
  if(Math.hypot(dx,dz)>radius+limits[6]!||limits[4]!<height-.6||limits[1]!>height+1.3)return;
  const kept={...piece,positions:[] as number[],indices:[] as number[]};
  const reach=radius+limits[6]!+.5;
  for(let vertex=0;vertex<piece.positions.length/3;vertex+=8){
    // Fast path: a prism wholly outside the cut's reach is copied unchanged.
    let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(let k=0;k<8;k++){const x=piece.positions[(vertex+k)*3]!,z=piece.positions[(vertex+k)*3+2]!;if(x<x0)x0=x;if(x>x1)x1=x;if(z<z0)z0=z;if(z>z1)z1=z;}
    const far=x1<at[0]-reach||x0>at[0]+reach||z1<at[1]-reach||z0>at[1]+reach;
    if(far&&piece.indices.length===piece.positions.length/3/8*36){const offset=kept.positions.length/3;for(let k=0;k<24;k++)kept.positions.push(piece.positions[vertex*3+k]!);for(let k=0;k<36;k++)kept.indices.push(piece.indices[vertex/8*36+k]!-vertex+offset);continue;}
    let p=Array.from({length:8},(_,k):XYZ=>[piece.positions[(vertex+k)*3]!,piece.positions[(vertex+k)*3+1]!,piece.positions[(vertex+k)*3+2]!]);
    if(distance(plan(p[4]!),plan(p[5]!))>distance(plan(p[5]!),plan(p[6]!)))p=[p[3]!,p[0]!,p[1]!,p[2]!,p[7]!,p[4]!,p[5]!,p[6]!];
    // A battered face can meet feet several metres away from its top edge.
    // Locate the opening at body height, not along the coping line.
    const section=p.slice(0,4).map((bottom,i):XYZ=>{const top=p[i+4]!,t=clamp((height+(passageClearance??1.25)/2-bottom[1])/(top[1]-bottom[1]||1),0,1);return[mix(bottom[0],top[0],t),mix(bottom[1],top[1],t),mix(bottom[2],top[2],t)];});
    const start:XYZ=[(section[0]![0]+section[1]![0])/2,(section[0]![1]+section[1]![1])/2,(section[0]![2]+section[1]![2])/2],end:XYZ=[(section[2]![0]+section[3]![0])/2,(section[2]![1]+section[3]![1])/2,(section[2]![2]+section[3]![2])/2],hit=nearestOnPath(at,[start,end]);
    const append=(from:number,to:number,minY=-Infinity,maxY=Infinity)=>{
      const interpolate=(a:XYZ,b:XYZ,t:number):XYZ=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
      let top=[interpolate(p[4]!,p[7]!,from),interpolate(p[5]!,p[6]!,from),interpolate(p[5]!,p[6]!,to),interpolate(p[4]!,p[7]!,to)];
      let bottom=[interpolate(p[0]!,p[3]!,from),interpolate(p[1]!,p[2]!,from),interpolate(p[1]!,p[2]!,to),interpolate(p[0]!,p[3]!,to)];
      const originalTop=top,originalBottom=bottom;
      const slice=(i:number,y:number)=>interpolate(originalBottom[i]!,originalTop[i]!,clamp((y-originalBottom[i]![1])/(originalTop[i]![1]-originalBottom[i]![1]||1),0,1));
      top=top.map((v,i)=>slice(i,Math.min(v[1],maxY)));bottom=bottom.map((v,i)=>slice(i,Math.max(v[1],minY)));
      if(top.every((v,i)=>v[1]-bottom[i]![1]<.001))return;
      const offset=kept.positions.length;prism(kept,top,bottom.map(p=>p[1]));bottom.forEach((p,i)=>kept.positions.splice(offset+i*3,3,...p));
    };
    const thickness=Math.max(...p.slice(4).map(p=>p[1]))-Math.min(...p.slice(0,4).map(p=>p[1]));
    const radiusWithWidth=radius+distance(plan(p[4]!),plan(p[5]!))/2;
    if(hit.distance>=radiusWithWidth||hit.at[1]<height-.6||hit.at[1]>maxTop||hit.at[1]<minTop||hit.at[1]-thickness>height+1.3){append(0,1);continue;}
    const half=Math.sqrt(Math.max(0,radiusWithWidth*radiusWithWidth-hit.distance*hit.distance))/(distance(plan(start),plan(end))||1),lo=clamp(hit.t-half,0,1),hi=clamp(hit.t+half,0,1);
    if(lo>1e-5)append(0,lo);if(hi<1-1e-5)append(hi,1);
    // A passage keeps the masonry below the floor and a lintel ≥ 0.6 thick above the headroom; a wall too
    // low for a lintel is opened to the floor (its upper bed stays a reported unsupported run, never a wall across a route).
    if(passageClearance!==undefined){append(lo,hi,-Infinity,height-.1);if(Math.min(...p.slice(4).map(p=>p[1]))>=height+passageClearance+.6)append(lo,hi,height+passageClearance);}
  }
  piece.positions=kept.positions;piece.indices=kept.indices;
}

/** Edge protection follows the exported ground, including later water/bed cuts.
 * Reopen junctions after regeneration, using the same visible collision solids. */
export function settleBedEdges(cuts:LandCuts,ground:HeightQuery):void {
  const pads=cuts.pads.filter(p=>!p.underground&&p.kind!=='host');
  for(const b of cuts.beds){
    if(!b.terrainCut||!['road','walk','trail','skate','boardwalk'].includes(b.kind))continue;
    const prefixes=['kerbs','edges','retaining'].map(kind=>`${b.id}.${kind}`),owns=(s:StructureSolid)=>prefixes.some(p=>s.id===p||s.id.startsWith(`${p}.`));
    const generated:LandCuts={...cuts,solids:[]};emitBedGeometry(b,generated,ground,pads.map(p=>plan(p.centre)));
    cuts.solids=cuts.solids.filter(s=>!owns(s));cuts.solids.push(...generated.solids.filter(owns));
  }
  // Guards are never cut as a circle around a pad (that removed 573 m of guard over real
  // drops). Every route instead keeps its own corridor clear of other routes' walls and
  // rails at its own height: that opens exactly the approach mouths of every junction.
  clearRouteCorridors(cuts);
  // Garden Walk and Year Walk share the Hollow approach for longer than a
  // junction pad. Keep each lane's outside protection, but remove rail pieces
  // from the other route that physically occupy its walking corridor.
  const shared=cuts.beds.filter(b=>['walk garden','yearWalk'].includes(b.id));
  for(const b of shared){
    const rails=cuts.solids.filter(s=>['handrail','parapet','kerb'].includes(s.kind)&&s.bedIds.some(id=>shared.some(other=>other.id===id&&other!==b))&&!s.bedIds.includes(b.id));
    for(let i=1;i<b.points.length;i++){
      const a=b.points[i-1]!,end=b.points[i]!,steps=Math.max(1,Math.ceil(distance(plan(a),plan(end))/2));
      for(let j=0;j<=steps;j++){const t=j/steps;for(const rail of rails)clipEdgePrisms(rail,[mix(a[0],end[0],t),mix(a[2],end[2],t)],b.width/2+.4,mix(a[1],end[1],t));}
    }
  }
  cuts.solids=cuts.solids.filter(s=>s.indices.length>0);
}
const EDGE_KINDS=['retainingWall','kerb','parapet','handrail'];
/** The body's step: a join between two beds is flush at or below this (runtime lip 0.48 eu). */
const LIP=.48;
/** Keep every route's own corridor free of other routes' walls, kerbs and rails at the route's
 * height (P17b: a neighbour's retaining wall across a bed is an invisible wall). Low pieces are
 * cut through; a tall retaining wall keeps its masonry above the route's clearance as a lintel. */
export function clearRouteCorridors(cuts:LandCuts,beds:readonly BedCut[]=cuts.beds):void {
  // Prism-level cells (4 eu): a step only visits the pieces that actually have a prism near it.
  // Clipping only shrinks or splits prisms in place, so a stale cell stays conservative.
  const CELL=4,index=new Map<string,Set<StructureSolid>>();
  for(const s of cuts.solids){
    if(!(EDGE_KINDS.includes(s.kind)&&(s.role==='wall'||s.role==='rail')||s.kind==='shoulder')||!s.positions.length)continue;
    for(let o=0;o+23<s.positions.length;o+=24){
      let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;for(let k=0;k<8;k++){const x=s.positions[o+k*3]!,z=s.positions[o+k*3+2]!;if(x<x0)x0=x;if(x>x1)x1=x;if(z<z0)z0=z;if(z>z1)z1=z;}
      for(let x=Math.floor(x0/CELL);x<=Math.floor(x1/CELL);x++)for(let z=Math.floor(z0/CELL);z<=Math.floor(z1/CELL);z++){const key=`${x}:${z}`;let set=index.get(key);if(!set){set=new Set();index.set(key,set);}set.add(s);}
    }
  }
  const byId=new Map(cuts.beds.map(b=>[b.id,b]));
  for(const b of beds){
    if(b.id.startsWith('structure.')||!['road','walk','trail','boardwalk','skate'].includes(b.kind))continue;
    const radius=b.width/2+.75;
    for(let i=1;i<b.points.length;i++){
      const a=b.points[i-1]!,end=b.points[i]!,steps=Math.max(1,Math.ceil(distance(plan(a),plan(end))/2));
      for(let j=0;j<=steps;j++){
        const t=j/steps,p:XY=[mix(a[0],end[0],t),mix(a[2],end[2],t)],h=mix(a[1],end[1],t);
        const seen=new Set<StructureSolid>(),onOwner=new Map<string,boolean>();
        // Standing on the owner bed's own deck (a route ending on another route's centreline):
        // that bed's far edge is not this route's mouth, so its pieces are left alone there.
        const standsOn=(id:string)=>{let v=onOwner.get(id);if(v===undefined){const o=byId.get(id),n=o?nearestOnPath(p,o.points):undefined;v=!!n&&n.distance<o!.width/2-.2&&Math.abs(n.at[1]-h)<.6;onOwner.set(id,v);}return v;};
        for(let x=Math.floor((p[0]-radius-1)/CELL);x<=Math.floor((p[0]+radius+1)/CELL);x++)for(let z=Math.floor((p[1]-radius-1)/CELL);z<=Math.floor((p[1]+radius+1)/CELL);z++)for(const piece of index.get(`${x}:${z}`)??[]){
          if(seen.has(piece)||piece.bedIds.includes(b.id))continue;seen.add(piece);
          if(piece.bedIds.some(standsOn))continue;
          if(piece.kind==='retainingWall'){clipEdgePrisms(piece,p,radius,h,undefined,h+3);clipEdgePrisms(piece,p,radius,h,Math.max(2.4,b.clearHeight));}
          // Another route's verge only blocks where it stands above the step: cut just that part.
          else if(piece.kind==='shoulder')clipEdgePrisms(piece,p,radius,h,undefined,Infinity,h+LIP);
          else clipEdgePrisms(piece,p,radius,h);
        }
      }
    }
  }
  cuts.solids=cuts.solids.filter(s=>s.indices.length>0);
}
/** A plan point on a bridge deck or inside a tunnel of either route. */
const onStructure=(b:BedCut|undefined,at:XY)=>!!b&&(b.id.startsWith('structure.')||(b.terrainExclusions??[]).some(e=>e.openSpan&&distance(at,e.at)<e.radius));
const FOOT=['walk','trail','boardwalk','stair'];
/** Retaining walls must share the real openings of separated route crossings.
 * Keep closed masonry above and below the passage rather than deleting a wall
 * or disabling its collision. A minimum 0.6 m lintel remains above headroom. */
export function openRetainingPassages(cuts:LandCuts,proofs:readonly ComputedCrossing[]):void {
  for(const row of proofs){
    if(row.kind==='waterConfluence'||row.kind==='modeTransfer')continue;
    const a=routeFor(cuts,row.sourceA,row.a),b=routeFor(cuts,row.sourceB,row.b);
    if(!a||!b)continue;
    const heightA=nearestOnPath(row.at,a.points).at[1],heightB=nearestOnPath(row.at,b.points).at[1];
    const lower=heightA<heightB?a:b,upper=lower===a?b:a,height=Math.min(heightA,heightB);
    if(!['road','walk','trail','boardwalk'].includes(lower.kind))continue;
    const clearance=Math.max(2.4,lower.clearHeight),radius=upper.width/2+upper.shoulder+lower.width/2+2;
    if(Math.abs(heightA-heightB)<clearance+.6)continue;
    const walls=cuts.solids.filter(piece=>piece.kind==='retainingWall'&&piece.bedIds.includes(upper.id));
    for(const piece of walls)clipEdgePrisms(piece,row.at,radius,height,clearance);
    // The lower route crosses the upper's wall line away from the centreline crossing when the angle is
    // shallow: open the passage along the lower route itself wherever it runs through the upper's wall band.
    const band=upper.width/2+upper.shoulder+4,from=nearestOnPath(row.at,lower.points).along;
    for(let i=1,along=0;i<lower.points.length;i++){
      const a=lower.points[i-1]!,b=lower.points[i]!,len=distance(plan(a),plan(b)),steps=Math.max(1,Math.ceil(len));
      for(let k=0;k<=steps;k++){const t=k/steps,d=along+len*t;if(Math.abs(d-from)>40)continue;const q:XY=[mix(a[0],b[0],t),mix(a[2],b[2],t)],h=mix(a[1],b[1],t),u=nearestOnPath(q,upper.points);
        if(u.distance<=band&&u.at[1]-h>=clearance+.6)for(const piece of walls){clipEdgePrisms(piece,q,lower.width/2+lower.shoulder+.8,h,clearance);dropPrismsInPassage(piece,q,lower.width/2+lower.shoulder+.5,h,clearance);}}
      along+=len;
    }
  }
}
/** After a passage clip, any prism left in the passage's body envelope (a battered wall on a steep bank can
 * slice into a twisted remnant) is removed: only masonry wholly below the floor or wholly above the headroom stays. */
function dropPrismsInPassage(piece:StructureSolid,at:XY,half:number,floor:number,clearance:number):void {
  const P=piece.positions,n=P.length/24;if(!n||piece.indices.length!==n*36)return;
  const keep:number[]=[];
  for(let k=0;k<n;k++){let lo=Infinity,hi=-Infinity,near=false;for(let v=0;v<8;v++){const o=(k*8+v)*3;lo=Math.min(lo,P[o+1]!);hi=Math.max(hi,P[o+1]!);if(Math.hypot(P[o]!-at[0],P[o+2]!-at[1])<=half)near=true;}{let cx=0,cz=0;for(let v=0;v<8;v++){cx+=P[(k*8+v)*3]!/8;cz+=P[(k*8+v)*3+2]!/8;}if(Math.hypot(cx-at[0],cz-at[1])<=half+1.5)near=true;}
    if(near&&lo<floor+clearance-.01&&hi>floor+.1)continue;keep.push(k);}
  if(keep.length===n)return;
  const positions:number[]=[],indices:number[]=[];
  for(const k of keep){const base=positions.length/3;for(let i=0;i<24;i++)positions.push(P[k*24+i]!);for(let i=0;i<36;i++)indices.push(piece.indices[k*36+i]!-k*8+base);}
  piece.positions=positions;piece.indices=indices;
}
function routeFor(cuts:LandCuts,id:string|undefined,logical:string):BedCut|undefined {
  return cuts.beds.find(b=>b.id===id)??cuts.beds.find(b=>b.id===logical);
}
/** Solve ordinary at-grade joins against the same grade cones used for route construction.
 * Existing span heights, station levels, doors and route endpoints remain hard constraints. */
function alignSurfaceJoins(cuts:LandCuts,proofs:readonly ComputedCrossing[],base:HeightQuery):void {
  type Context={bed:BedCut;pins:HeightPin[];arcs:number[];targets:{at:XY;height:number;along:number}[]};
  const contexts=new Map<string,Context>();
  const context=(b:BedCut):Context=>{
    let c=contexts.get(b.id);if(c)return c;
    const arcs=[0];for(let i=1;i<b.points.length;i++)arcs.push(arcs[i-1]!+distance(plan(b.points[i-1]!),plan(b.points[i]!)));
    const pins:HeightPin[]=[{xy:plan(b.points[0]!),height:b.points[0]![1],reason:'fixed start'},{xy:plan(b.points.at(-1)!),height:b.points.at(-1)![1],reason:'fixed finish'}];
    for(const row of proofs)if(row.resolution==='threshold'&&Math.abs(row.heightA-row.heightB)<=.5&&[row.sourceA??row.a,row.sourceB??row.b].includes(b.id))pins.push({xy:row.at,height:nearestOnPath(row.at,b.points).at[1],reason:'existing connected junction'});
    b.points.forEach(p=>{if(b.terrainExclusions?.some(e=>distance(plan(p),e.at)<=e.radius))pins.push({xy:plan(p),height:p[1],reason:'structure profile'});});
    const upperStreet=cuts.pads.find(p=>p.id==='town.upperStreet');if(upperStreet)for(const p of b.points)if(Math.abs(p[0]-upperStreet.centre[0])<=upperStreet.size[0]/2+4&&Math.abs(p[2]-upperStreet.centre[2])<=upperStreet.size[1]/2+4&&Math.abs(p[1]-upperStreet.centre[1])<.01)pins.push({xy:plan(p),height:upperStreet.centre[1],reason:'fixed upper street floor'});
    // Keep the level Cottage landing when reconciling neighbouring crossings;
    // otherwise a later solve can dip this approach below the Year Walk deck.
    if(b.id==='walk garden')for(const p of b.points)if(p[0]>=899&&p[0]<=916&&p[2]>=637&&p[2]<=642)pins.push({xy:plan(p),height:p[1],reason:'fixed Cottage front bench'});
    for(const pad of cuts.pads.filter(p=>p.serviceBedId===b.id)){const at=pad.door??pad.centre,hit=nearestOnPath(plan(at),b.points);if(hit.distance<Math.max(5,pad.margin+b.width))pins.push({xy:plan(hit.at),height:hit.at[1],reason:pad.id});}
    c={bed:b,pins,arcs,targets:[]};contexts.set(b.id,c);return c;
  };
  const range=(b:BedCut,at:XY):[number,number]=>{
    const hit=nearestOnPath(at,b.points);if(!b.terrainCut||!['road','walk','trail','skate','boardwalk'].includes(b.kind))return [hit.at[1],hit.at[1]];
    const c=context(b);let lo=-Infinity,hi=Infinity;
    for(const pin of c.pins){const d=Math.abs(nearestOnPath(pin.xy,b.points).along-hit.along)*Math.min(.12,b.maxGrade);lo=Math.max(lo,pin.height-d);hi=Math.min(hi,pin.height+d);}
    return [lo,hi];
  };
  for(const row of proofs.filter(p=>p.resolution==='threshold'&&Math.abs(p.heightA-p.heightB)>.01)){
    const a=routeFor(cuts,row.sourceA,row.a),b=routeFor(cuts,row.sourceB,row.b);if(!a||!b||![a,b].every(b=>['road','walk','trail','skate','boardwalk'].includes(b.kind)))continue;
    const ra=range(a,row.at),rb=range(b,row.at),lo=Math.max(ra[0],rb[0]),hi=Math.min(ra[1],rb[1]);if(lo>hi)continue;
    // The Year Walk on a shared stretch is its host's footway at the host's solved height: the other route meets it there.
    const preferred=a.id==='yearWalk'?row.heightA:b.id==='yearWalk'?row.heightB:a.kind==='road'?row.heightA:b.kind==='road'?row.heightB:(row.heightA+row.heightB)/2,h=clamp(preferred,lo,hi);
    for(const bed of [a,b])if(bed.terrainCut){const c=context(bed),hit=nearestOnPath(row.at,bed.points);c.pins.push({xy:row.at,height:h,reason:row.id});c.targets.push({at:row.at,height:h,along:hit.along});}
  }
  const markerPositions=cuts.pads.filter(p=>p.kind==='threshold').map(p=>plan(p.centre));
  for(const c of contexts.values()){
    if(!c.targets.length)continue;
    const points=[...c.bed.points.map((p,i)=>({at:plan(p),along:c.arcs[i]!})),...c.targets,...c.pins.map(p=>({at:p.xy,along:nearestOnPath(p.xy,c.bed.points).along}))].sort((a,b)=>a.along-b.along).filter((v,i,all)=>!i||distance(v.at,all[i-1]!.at)>.001).map(p=>p.at);
    const old=c.bed.points,diagnostics:LandCuts['diagnostics']=[],next=gradeRoute(c.bed.id,points,(x,z)=>nearestOnPath([x,z],old).at[1],Math.min(.12,c.bed.maxGrade),c.pins,diagnostics);
    if(maxGrade(next)>Math.min(.12,c.bed.maxGrade)+.00001)continue;
    c.bed.points=next;
    const prefixes=['bed','surface','kerbs','edges','retaining','shoulders'].map(s=>`${c.bed.id}.${s}`);
    cuts.solids=cuts.solids.filter(s=>!prefixes.some(prefix=>s.id===prefix||s.id.startsWith(`${prefix}.`)));
    emitBedGeometry(c.bed,cuts,base,markerPositions);
  }
}
/** Called once after C measures logical routes, before A applies the final terrain cuts. */
/** W3-A: junction aprons. A foot route that meets a road at grade at a shallow angle runs inside
 * the road's corridor for a few metres before the centreline hit; there it must already stand at
 * the road's height (the Reach walk met Horizon Drive 0.5 eu under the road's bed edge at
 * [1372.7,1275] and the Boathouse door walk stopped in the browser). Guest samples inside the host
 * corridor within 20 eu of the junction take the host's height; the samples beyond ease back to
 * their own profile at the guest's grade limit. Only the touched stretch is re-emitted. */
function junctionAprons(cuts:LandCuts,proofs:readonly ComputedCrossing[],base:HeightQuery):void {
  const touched=new Set<BedCut>();
  for(const row of proofs){
    if(row.resolution!=='threshold'||row.kind==='waterConfluence'||row.kind==='modeTransfer')continue;
    const a=routeFor(cuts,row.sourceA,row.a),b=routeFor(cuts,row.sourceB,row.b);if(!a||!b||a===b)continue;
    const [host,guest]=a.width>=b.width?[a,b]:[b,a];
    if(host.kind!=='road'||!['walk','trail'].includes(guest.kind)||guest.id==='yearWalk'||!guest.terrainCut)continue;
    if(Math.abs(nearestOnPath(row.at,host.points).at[1]-nearestOnPath(row.at,guest.points).at[1])>.5)continue;
    const pts=guest.points,arcs=[0];for(let i=1;i<pts.length;i++)arcs.push(arcs[i-1]!+distance(plan(pts[i-1]!),plan(pts[i]!)));
    const along=nearestOnPath(row.at,pts).along,reach=host.width/2+host.shoulder+.6,limit=Math.min(.12,guest.maxGrade),fixed=new Set<number>();
    const next=pts.map(p=>[p[0],p[1],p[2]] as [number,number,number]);
    pts.forEach((p,i)=>{if(Math.abs(arcs[i]!-along)>20)return;const n=nearestOnPath(plan(p),host.points);if(n.distance>reach)return;next[i]![1]=n.at[1];fixed.add(i);});
    if(![...fixed].some(i=>Math.abs(next[i]![1]-pts[i]![1])>.02))continue;
    // Ease outwards from the fixed samples: each free sample stays within the grade cone of its neighbour.
    for(const dir of [1,-1])for(let i=dir>0?1:pts.length-2;i>=0&&i<pts.length;i+=dir){if(fixed.has(i))continue;const j=i-dir,d=Math.abs(arcs[i]!-arcs[j]!)*limit;next[i]![1]=clamp(next[i]![1],next[j]![1]-d,next[j]![1]+d);}
    guest.points=next as unknown as XYZ[];touched.add(guest);
  }
  if(!touched.size)return;
  const markerPositions=cuts.pads.filter(p=>p.kind==='threshold').map(p=>plan(p.centre));
  for(const bed of touched){
    const prefixes=['bed','surface','kerbs','edges','retaining','shoulders'].map(s=>`${bed.id}.${s}`);
    cuts.solids=cuts.solids.filter(s=>!prefixes.some(prefix=>s.id===prefix||s.id.startsWith(`${prefix}.`)));
    emitBedGeometry(bed,cuts,base,markerPositions);
  }
}
export function resolveComputedCrossings(cuts:LandCuts,proofs:readonly ComputedCrossing[],base:HeightQuery):void {
  alignSurfaceJoins(cuts,proofs,base);
  junctionAprons(cuts,proofs,base);
  for(const row of proofs){
    if(row.kind==='waterConfluence'||row.kind==='modeTransfer')continue;
    // A pad can already exist while a regenerated bed still has a wall across it.
    // Every at-grade junction must cut its visible approach openings.
    const a=routeFor(cuts,row.sourceA,row.a),b=routeFor(cuts,row.sourceB,row.b),heightA=a?nearestOnPath(row.at,a.points).at[1]:row.heightA,heightB=b?nearestOnPath(row.at,b.points).at[1]:row.heightB,difference=Math.abs(heightA-heightB);
    const wet=[row.sourceA??row.a,row.sourceB??row.b].some(id=>id==='DEEP_RUN'||cuts.waters.some(w=>w.id===id&&w.kind!=='dry'));
    if(row.resolution==='threshold'&&wet){
      cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:'A land or rail route intersects open water without a separated deck or named boarding interface; no dry pad was placed in the channel',at:row.at,measured:difference});continue;
    }
    // A bed inside a water body's outline is the crossing proof's diagnostic (a bridge, causeway or
    // re-route is owed): never a dry pad in the water (T4 request 3).
    if(row.kind==='waterBody')continue;
    // Flush path meetings (junction, shared stretch, Year Walk footway) are one walking surface:
    // no pad, no marker, no mode change (R1-88); approach mouths are opened by clearRouteCorridors.
    if((row.kind==='junction'||row.kind==='sharedStretch'||row.kind==='footway')&&difference<=LIP)continue;
    if(row.resolution==='threshold'&&difference<=LIP){
      if(!a&&!b)continue; // A confluence is one water surface, never a dry threshold pad.
      const height=(heightA+heightB)/2,pedestrian=[a,b].every(b=>b&&['walk','trail','boardwalk'].includes(b.kind)),width=pedestrian?Math.max(3,a?.width??0,b?.width??0)+1:Math.max(6,a?.width??0,b?.width??0)+2;
      // A pad in the middle of a bridge deck would strip its parapets: that needs a widened,
      // guarded deck (a structure), so it is reported instead of paved.
      if(onStructure(a,row.at)||onStructure(b,row.at)){cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:'An at-grade junction lies on a bridge deck: a threshold there needs a widened, guarded deck; no pad was placed and no parapet was cut',at:row.at,measured:difference});continue;}
      let pad=cuts.pads.find(p=>p.kind==='threshold'&&distance(plan(p.centre),row.at)<3&&Math.abs(p.centre[1]-height)<LIP);
      const underground=height<base(...row.at)-3&&[a,b].some(b=>b&&['cave','rail'].includes(b.kind));
      // The junction is the two graded beds meeting flush (≤ 0.48 eu): no flat slab is laid on
      // top of them, and the pad never flattens the terrain under a graded bed.
      if(!pad){pad={id:`crossing.${row.id}`,kind:'threshold',centre:[row.at[0],height,row.at[1]],size:[width,width],rotationDegrees:0,margin:0,blend:0,underground,deck:true};cuts.pads.push(pad);}else if(underground)pad.underground=true;
      const markerId=`${pad.id}.marker`;if(!cuts.solids.some(s=>s.id===markerId)){
        const marker=solid(markerId,'threshold','stone','marker',[row.a,row.b],districtAt(...row.at));box(marker,row.at,height+.025,[2,.6],height-.05);cuts.solids.push(marker);
      }
      const footCaveJoin=[a,b].some(b=>b?.kind==='cave')&&[a,b].every(b=>!b||!['rail','cable'].includes(b.kind)&&b.id!=='underground.throat');
      if(footCaveJoin)for(const piece of cuts.solids)if((piece.role==='wall'||piece.role==='rail')&&['tunnel','cavern'].includes(piece.kind))clipEdgePrisms(piece,row.at,Math.max(8,width*.7),height);
      // Approach mouths are opened by clearRouteCorridors (each route's own corridor), below.
      continue;
    }
    if(row.resolution==='threshold'){
      // A registered at-grade row is never silently turned into a generated over/under.
      cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:'The registered at-grade junction has incompatible heights; fixed grades remain. Any separated physical passage still requires design reconciliation.',at:row.at,measured:difference,required:LIP});continue;
    }
    const upper=heightA>=heightB?a:b,lower=heightA>=heightB?b:a,upperHeight=Math.max(heightA,heightB);
    // Cable load paths and underground linings are already built by their specialised modules.
    if(!upper||upper.kind==='cable'||upper.kind==='cave'||upper.kind==='rail'||lower?.kind==='cave'||lower?.kind==='rail')continue;
    // Water is never "a lower route needing headroom": a route over water is on its named
    // bridge, or it meets the water at grade and needs a footbridge or a new line.
    if((!lower||wet)&&difference<row.requiredClearance+.6){
      if(onStructure(upper,row.at))continue;
      cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:`${upper.id} meets open water without a named footbridge or bridge span; re-route it or add the footbridge (no deck is generated over water)`,at:row.at,measured:difference});continue;
    }
    // Two foot routes at different heights: a generated deck here lies across a walker's own
    // grade (the summit walk was blocked 23 m short of L02). Report instead.
    if(lower&&FOOT.includes(upper.kind)&&FOOT.includes(lower.kind)){
      if(onStructure(upper,row.at)||onStructure(lower,row.at))continue;
      cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:`Two foot routes (${upper.id} over ${lower.id}) cross ${difference.toFixed(2)} eu apart: a named footbridge or a regraded at-grade junction is needed; no deck is generated across a foot route`,at:row.at,measured:difference,required:LIP});continue;
    }
    const supported=cuts.solids.some(s=>s.role==='support'&&s.bedIds.includes(upper.id)&&s.positions.some((_,i)=>i%3===0&&distance([s.positions[i]!,s.positions[i+2]!],row.at)<32));
    if(supported&&row.clearancePass)continue;
    const requiredClearance=row.requiredClearance;
    if(difference<requiredClearance+.6){
      cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:'The crossing cannot fit a thick deck plus lower-route clearance without regrading',at:row.at,measured:difference,required:requiredClearance+.6});continue;
    }
    const centre=nearestOnPath(row.at,upper.points),half=Math.max(16,(lower?.width??8)+6),prefix=`crossing.${row.id}`;
    if(cuts.solids.some(s=>s.id===`${prefix}.deck`))continue;
    const deck=solid(`${prefix}.deck`,'bridge',upper.surface,'deck',[upper.id],districtAt(...row.at)),supports=solid(`${prefix}.supports`,'pier','stone','support',[upper.id],deck.districtId),beams=solid(`${prefix}.beams`,'beam','stone','support',[upper.id],deck.districtId),rails=solid(`${prefix}.rails`,'handrail','metal','rail',[upper.id],deck.districtId);
    const distances=[0];for(let i=1;i<upper.points.length;i++)distances.push(distances[i-1]!+distance(plan(upper.points[i-1]!),plan(upper.points[i]!)));
    let previous:XYZ|undefined,refused:XY|undefined;
    for(let i=0;i<upper.points.length&&!refused;i++){
      const p=upper.points[i]!;if(Math.abs(distances[i]!-centre.along)>half+5)continue;
      if(previous){slab(deck,previous,p,upper.width+upper.shoulder*2,.6);for(const side of [-1,1])slab(rails,previous,p,.09,.09,side*(upper.width/2+upper.shoulder),1.05);}
      if(Math.abs(distances[i]!-centre.along)>half-6){
        const next=upper.points[Math.min(i+1,upper.points.length-1)]!,dx=next[0]-p[0],dz=next[2]-p[2],len=Math.hypot(dx,dz)||1;
        for(const side of [-1,1]){
          const anchor:XY=[p[0]-dz/len*side*(upper.width/2+.4),p[2]+dx/len*side*(upper.width/2+.4)];
          // A pier belongs outside every lower route, not merely away from the
          // intersection centre. Sweeping curves can run beneath a span end.
          let xy:XY|undefined;
          for(let offset=0;offset<=20;offset+=1){
            const candidate:XY=[anchor[0]-dz/len*side*offset,anchor[1]+dx/len*side*offset];
            const blocked=cuts.beds.some(b=>{
              if(b.kind==='cable')return false;
              const margin=b.width/2+b.shoulder+1.1;
              // Check every local segment: Year Walk can revisit the same x/z
              // at different heights, so a single planar nearest hit is unsafe.
              return b.points.some((end,j)=>{
                if(!j)return false;const start=b.points[j-1]!;
                if(candidate[0]<Math.min(start[0],end[0])-margin||candidate[0]>Math.max(start[0],end[0])+margin||candidate[1]<Math.min(start[2],end[2])-margin||candidate[1]>Math.max(start[2],end[2])+margin)return false;
                const dx=end[0]-start[0],dz=end[2]-start[2],t=clamp(((candidate[0]-start[0])*dx+(candidate[1]-start[2])*dz)/(dx*dx+dz*dz||1),0,1);
                return mix(start[1],end[1],t)<p[1]-1.25&&distance(candidate,[mix(start[0],end[0],t),mix(start[2],end[2],t)])<margin;
              });
            });
            if(!blocked){xy=candidate;break;}
          }
          // Never a deck with a silently missing pier: the whole span is refused and reported.
          if(!xy){refused=anchor;break;}
          const ground=Math.min(base(...xy),p[1]-.8);
          box(supports,xy,p[1]-.5,[.7,.7],ground-.25);box(supports,xy,ground+.3,[1.5,1.5],ground-.25);
          if(distance(xy,anchor)>.01)slab(beams,[anchor[0],p[1]-.4,anchor[1]],[xy[0],p[1]-.4,xy[1]],1.2,.6);
        }
      }
      previous=p;
    }
    if(refused){cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:`No safe footing outside the lower route corridors within 20 m of [${refused.map(v=>v.toFixed(1)).join(',')}]; the generated span was refused (a bespoke load path is required)`,at:row.at,measured:difference});continue;}
    if(!deck.indices.length||!supports.indices.length){cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:'The crossing lies too close to a route endpoint for a supported span',at:row.at});continue;}
    cuts.solids.push(deck,supports,rails);if(beams.indices.length)cuts.solids.push(beams);upper.structureIds.push(prefix);(upper.terrainExclusions??=[]).push({at:row.at,radius:half+5,openSpan:true});
    cuts.diagnostics.push({id:`junction.${row.id}`,severity:'info',message:`Supported crossing at existing upper bed height ${upperHeight.toFixed(2)} eu`,at:row.at,measured:difference,required:requiredClearance+.6});
  }
  // At the south end of the Bight spur span, Year Walk runs beside the
  // abutment rather than beneath its central opening. A graded common landing
  // brings feet above the low edge beams instead of squeezing beneath them.
  const bightSpur=cuts.beds.find(b=>b.id==='VBS'),year=cuts.beds.find(b=>b.id==='yearWalk');
  let bightLanding:import('../interfaces').PadCut|undefined;
  const bightAt:XY=[887.3,923.4];
  if(bightSpur&&year&&nearestOnPath(bightAt,year.points).distance<4&&Math.abs(nearestOnPath(bightAt,year.points).at[1]-nearestOnPath(bightAt,bightSpur.points).at[1])<LIP){
    const at=bightAt,height=nearestOnPath(at,bightSpur.points).at[1];
    bightLanding=addFlatPad(cuts,'crossing.bightWalkLanding','threshold',at,height,[8,8]);
    const marker=solid(`${bightLanding.id}.marker`,'threshold','stone','marker',['VBS','yearWalk'],'bight');box(marker,at,height+.025,[2,.6],height-.05);cuts.solids.push(marker);
  }
  const junctionPads=cuts.pads.filter(p=>p.kind==='threshold'&&!p.underground);
  const rebuilt=new Set(gradePadApproaches(cuts,junctionPads.filter(p=>distance(plan(p.centre),[1400,1060])<1||p.id.includes('Host')||p.id.startsWith('crossing.crossVGSpur'))));
  // The access lane's endpoint is an implementation detail, not an authored
  // fixed station. Match the entire road shoulder footprint after grading the
  // fixed 24 m junction, then carry that landing back down the access lane.
  const access=cuts.beds.find(b=>b.id==='town.northLink'),drive=cuts.beds.find(b=>b.id==='V01');
  if(access&&drive){
    const end=access.points.at(-1)!,pad=junctionPads.find(p=>distance(plan(p.centre),plan(end))<1);
    if(pad){
      const radius=Math.hypot(...pad.size)/2+.65,height=Math.max(...drive.points.filter(p=>distance(plan(p),plan(end))<=radius+3).map(p=>p[1]),end[1]);
      const delta=height-pad.centre[1];pad.centre=[pad.centre[0],height,pad.centre[2]];
      for(const piece of cuts.solids.filter(s=>s.id.startsWith(`${pad.id}.`)))for(let i=1;i<piece.positions.length;i+=3)piece.positions[i]!+=delta;
      access.points=gradeRoute(access.id,access.points.map(plan),base,.12,[{xy:plan(access.points[0]!),height:access.points[0]![1],reason:'bank walk'},{xy:plan(end),height,reason:'drive landing'}],cuts.diagnostics);
      rebuilt.add(access);for(const bed of gradePadApproaches(cuts,[pad],3))rebuilt.add(bed);
    }
  }
  if(bightLanding)for(const b of gradePadApproaches(cuts,[bightLanding],3))rebuilt.add(b);
  for(const b of rebuilt){
    const prefixes=['bed','surface','kerbs','edges','retaining','shoulders'].map(s=>`${b.id}.${s}`);
    cuts.solids=cuts.solids.filter(s=>!prefixes.some(prefix=>s.id===prefix||s.id.startsWith(`${prefix}.`)));
    emitBedGeometry(b,cuts,base,junctionPads.map(p=>plan(p.centre)));
  }
  clearRouteCorridors(cuts);
}
