/**
 * The road as data: an arc-length parameterised centreline with per-sample frame, width,
 * grade, curvature, edge kind on each side and support; bridges as explicit objects;
 * parapet/kerb/wall runs and their collision segments; retaining walls.
 */
import {ROAD_CENTRE,ORCHARD_LANE_CENTRE,ORCHARD_LANE_HALF_WIDTH,ROAD_SAMPLE_STEP as ROAD_PLAN_STEP,roadTagS} from './roadLine.ts';
import {BRIDGE_SPANS,ROAD_HALF_WIDTH,type BridgeType} from './bridges.ts';
import {baseHeight} from './terrainBase.ts';
import {mountainGround as gridGround} from './mountainGround.ts';
import {islandHeight} from './islandShape.ts';
/** The ground a body would land on beside the road: the island south of z −48, the mountain north of it. */
const mountainGround=(x:number,z:number)=>Math.max(islandHeight(x,z),z<-30?gridGround(x,z):-Infinity);
import {arcLengths,mix,type Point3} from './math.ts';
import {MOUNTAIN_PATH_GRAPH} from './pathGraph.ts';

export type EdgeKind='open'|'kerb'|'parapet'|'wall'|'bridge';
export type SupportKind='ground'|'embankment'|'bridge'|'tunnel';
export type RoadSample={s:number;at:Point3;tangent:Point3;normal:Point3;halfWidth:number;grade:number;curvature:number;left:EdgeKind;right:EdgeKind;support:SupportKind;bridgeId:string|null};
export type RoadLine={id:string;length:number;step:number;samples:readonly RoadSample[]};

/** Heights that decide an edge. A body is ~1.55 tall; a drop beyond ~1 needs a parapet. */
export const EDGE_RULES={parapetDrop:1,kerbDrop:.35,wallRise:1.6,kerbRise:.6,probe:[.6,3.2] as const,parapetHeight:1.1,kerbHeight:.22};

function classify(points:readonly Point3[],id:string,halfWidthAt:(i:number)=>number,bridgeAt:(i:number)=>string|null):RoadLine{
  const s3=arcLengths(points),samples:RoadSample[]=[];
  const n=points.length;
  for(let i=0;i<n;i++){
    const p=points[i]!,a=points[Math.max(0,i-1)]!,b=points[Math.min(n-1,i+1)]!;
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],hl=Math.hypot(dx,dz)||1,l=Math.hypot(dx,dy,dz)||1;
    const tangent:Point3=[dx/l,dy/l,dz/l],normal:Point3=[dz/hl,0,-dx/hl];
    // Signed curvature from the heading change across ±6 samples (+ turns left).
    const a3=points[Math.max(0,i-6)]!,b3=points[Math.min(n-1,i+6)]!;
    const h1=Math.atan2(p[0]-a3[0],p[2]-a3[2]),h2=Math.atan2(b3[0]-p[0],b3[2]-p[2]),turn=Math.atan2(Math.sin(h2-h1),Math.cos(h2-h1));
    const span=Math.hypot(b3[0]-a3[0],b3[2]-a3[2])||1;
    const hw=halfWidthAt(i),bridgeId=bridgeAt(i);
    const edge=(side:1|-1):EdgeKind=>{
      if(bridgeId)return 'bridge';
      let drop=0,rise=0;
      for(let o=EDGE_RULES.probe[0];o<=EDGE_RULES.probe[1];o+=.65){const x=p[0]+normal[0]*(hw+o)*side,z=p[2]+normal[2]*(hw+o)*side,g=mountainGround(x,z);drop=Math.max(drop,p[1]-g);rise=Math.max(rise,g-p[1]);}
      return drop>EDGE_RULES.parapetDrop?'parapet':rise>EDGE_RULES.wallRise?'wall':drop>EDGE_RULES.kerbDrop||rise>EDGE_RULES.kerbRise?'kerb':'open';
    };
    const fill=p[1]-baseHeight(p[0],p[2]);
    samples.push({s:s3[i]!,at:p,tangent,normal,halfWidth:hw,grade:dy/hl,curvature:turn/span,left:edge(1),right:edge(-1),
      support:bridgeId?'bridge':fill>1.5?'embankment':'ground',bridgeId});
  }
  // Edges read as runs: a short open gap between parapets is closed, a lone kerb is not a wall.
  const rank:Record<EdgeKind,number>={open:0,kerb:1,wall:2,parapet:3,bridge:4};
  for(const side of ['left','right'] as const){
    for(let pass=0;pass<2;pass++)for(let i=0;i<n;i++){
      const k=samples[i]![side];let j=i;while(j+1<n&&samples[j+1]![side]===k)j++;
      if(j-i<6&&k!=='bridge'){const before=samples[i-1]?.[side],after=samples[j+1]?.[side];const stronger=[before,after].filter((e):e is EdgeKind=>!!e).sort((x,y)=>rank[y]-rank[x])[0];
        if(stronger&&rank[stronger]>rank[k])for(let m=i;m<=j;m++)(samples[m] as {-readonly [K in keyof RoadSample]:RoadSample[K]})[side]=stronger;}
      i=j;
    }
  }
  return {id,length:s3[n-1]!,step:s3[n-1]!/(n-1),samples};
}
/** Where a skill branch leaves the road through its edge: the rail stops for the branch's width, so the
 * branch deck is the edge there (the art draws the gap because it draws `EDGE_RUNS`). Measured as the
 * branch's first leg, from its departure on the road toward its first authored point. `course.ts` builds
 * the branch from the same departure. */
export const BRANCH_DEPARTURES=[
  {id:'library-balcony',line:'mountain-road',planS:roadTagS('b2-east')-1,toward:[37,41.2,-181.6] as Point3,halfWidth:1.6},
] as const;
/** A gap in a road edge: a branch deck or a path/stair leaves the road there, so the rail, parapet or
 * retaining wall stops for it (edge samples inside it are `open` and carry no collision). */
export type EdgeOpening={id:string;line:string;side:'left'|'right';s0:number;s1:number;by:'branch'|'path'|'junction';corridor:readonly Point3[];halfWidth:number};
const OPENINGS:EdgeOpening[]=[];
export const EDGE_OPENINGS:readonly EdgeOpening[]=OPENINGS;
const OPENED={left:new WeakSet<RoadSample>(),right:new WeakSet<RoadSample>()};
/** Where each departure's first leg crosses the road edge (half-width plus a body's clearance each side). */
function departures(line:RoadLine):{id:string;by:'branch'|'path';corridor:Point3[];halfWidth:number}[]{
  const out:{id:string;by:'branch'|'path';corridor:Point3[];halfWidth:number}[]=[];
  for(const d of BRANCH_DEPARTURES){if(d.line!==line.id)continue;
    out.push({id:d.id,by:'branch',corridor:[line.samples[Math.max(0,Math.min(line.samples.length-1,Math.round(d.planS/ROAD_PLAN_STEP)))]!.at,d.toward],halfWidth:d.halfWidth});}
  // Every path and stair that starts at a junction on this line leaves it through the edge beside the junction.
  const prefix=line.id==='mountain-road'?'road:':'lane:';
  for(const e of MOUNTAIN_PATH_GRAPH.edges){if(e.kind==='road')continue;
    for(const [end,pts] of [[e.from,e.points],[e.to,[...e.points].reverse()]] as const){
      if(!end.startsWith(prefix))continue;
      const node=pts[0]!,reach=(line.id==='mountain-road'?ROAD_HALF_WIDTH:ORCHARD_LANE_HALF_WIDTH)+3,corridor:Point3[]=[];
      for(const p of pts){corridor.push(p);if(Math.hypot(p[0]-node[0],p[2]-node[2])>reach)break;}
      if(corridor.length>1)out.push({id:e.id,by:'path',corridor,halfWidth:e.halfWidth});
    }
  }
  return out;
}
/** Where two carriageways join (Orchard Lane off the road), each one's edge is open where it lies on the other. */
function openJunctions(line:RoadLine){
  const others=line.id==='mountain-road'?[{id:'orchard-lane',pts:ORCHARD_LANE_CENTRE,hw:ORCHARD_LANE_HALF_WIDTH}]:[{id:'mountain-road',pts:ROAD_CENTRE,hw:ROAD_HALF_WIDTH}];
  for(const o of others){const opened:{side:'left'|'right';s:number}[]=[];let corridor:Point3[]=[];
    for(const sample of line.samples)for(const side of ['left','right'] as const){
      const sign=side==='left'?1:-1,x=sample.at[0]+sample.normal[0]*sample.halfWidth*sign,z=sample.at[2]+sample.normal[2]*sample.halfWidth*sign;
      let best=Infinity,near:Point3|null=null;for(const q of o.pts){const e=Math.hypot(q[0]-x,q[2]-z);if(e<best){best=e;near=q;}}
      if(near&&best<o.hw-.1&&Math.abs(near[1]-sample.at[1])<1.5){(sample as {-readonly [K in keyof RoadSample]:RoadSample[K]})[side]='open';OPENED[side].add(sample);opened.push({side,s:sample.s});corridor.push(near);}
    }
    for(const side of ['left','right'] as const){const ss=opened.filter(x=>x.side===side).map(x=>x.s);if(ss.length)OPENINGS.push({id:`${line.id}:${side}:junction:${o.id}`,line:line.id,side,s0:Math.min(...ss),s1:Math.max(...ss),by:'junction',corridor,halfWidth:o.hw});}
  }
  return line;
}
/** A guarded stub of one or two samples left between two openings is no rail at all: open it too. */
function closeStubs(line:RoadLine){
  const S=line.samples;
  for(const side of ['left','right'] as const)for(let i=1;i<S.length-1;i++){
    if(S[i]![side]==='open')continue;let j=i;while(j+1<S.length&&S[j+1]![side]===S[i]![side])j++;
    if(j-i<2&&OPENED[side].has(S[i-1]!)&&j+1<S.length&&OPENED[side].has(S[j+1]!)){
      for(let m=i;m<=j;m++){(S[m] as {-readonly [K in keyof RoadSample]:RoadSample[K]})[side]='open';OPENED[side].add(S[m]!);}
      const o=OPENINGS.find(o=>o.line===line.id&&o.side===side&&(Math.abs(o.s1-S[i-1]!.s)<.01||Math.abs(o.s0-S[j+1]!.s)<.01));
      if(o){o.s0=Math.min(o.s0,S[i]!.s);o.s1=Math.max(o.s1,S[j]!.s);}
    }
    i=j;
  }
}
function openDepartures(line:RoadLine){
  openJunctions(line);
  for(const d of departures(line)){
    const reach=d.halfWidth+.9,opened:{side:'left'|'right';s:number}[]=[];
    for(const sample of line.samples)for(const side of ['left','right'] as const){
      const sign=side==='left'?1:-1,x=sample.at[0]+sample.normal[0]*sample.halfWidth*sign,z=sample.at[2]+sample.normal[2]*sample.halfWidth*sign;
      let best=Infinity,y=0;
      for(let k=1;k<d.corridor.length;k++){const a=d.corridor[k-1]!,b=d.corridor[k]!,dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1))),e=Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t);if(e<best){best=e;y=mix(a[1],b[1],t);}}
      // Only where the departure is at the road's own level (a path passing under a bridge opens nothing).
      if(best<reach&&Math.abs(y-sample.at[1])<2.5){(sample as {-readonly [K in keyof RoadSample]:RoadSample[K]})[side]='open';OPENED[side].add(sample);opened.push({side,s:sample.s});}
    }
    for(const side of ['left','right'] as const){const ss=opened.filter(o=>o.side===side).map(o=>o.s);if(ss.length)OPENINGS.push({id:`${line.id}:${side}:${d.id}`,line:line.id,side,s0:Math.min(...ss),s1:Math.max(...ss),by:d.by,corridor:d.corridor,halfWidth:d.halfWidth});}
  }
  closeStubs(line);
  return line;
}
const roadBridge=(i:number)=>BRIDGE_SPANS.find(b=>b.line==='road'&&i>=b.i0&&i<=b.i1)?.id??null;
const laneBridge=(i:number)=>BRIDGE_SPANS.find(b=>b.line==='lane'&&i>=b.i0&&i<=b.i1)?.id??null;
/** The foot tapers from mountain width to a town lane over its first 18 units. */
const TOWN_HALF_WIDTH=3.5;
export const MOUNTAIN_ROAD_LINE:RoadLine=openDepartures(classify(ROAD_CENTRE,'mountain-road',i=>mix(TOWN_HALF_WIDTH,ROAD_HALF_WIDTH,Math.min(1,i/18)),roadBridge));
export const ORCHARD_LANE_LINE:RoadLine=openDepartures(classify(ORCHARD_LANE_CENTRE,'orchard-lane',()=>ORCHARD_LANE_HALF_WIDTH,laneBridge));

/** Interpolated sample at arc length `s` (3D arc length, uphill). */
export function roadSampleAt(s:number,line:RoadLine=MOUNTAIN_ROAD_LINE):RoadSample{
  const S=line.samples;if(s<=0)return S[0]!;if(s>=line.length)return S[S.length-1]!;
  let lo=0,hi=S.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(S[m]!.s<=s)lo=m;else hi=m;}
  const a=S[lo]!,b=S[hi]!,t=(s-a.s)/((b.s-a.s)||1),m3=(u:Point3,v:Point3):Point3=>[mix(u[0],v[0],t),mix(u[1],v[1],t),mix(u[2],v[2],t)];
  const near=t<.5?a:b;
  return {...near,s,at:m3(a.at,b.at),tangent:m3(a.tangent,b.tangent),normal:m3(a.normal,b.normal),halfWidth:mix(a.halfWidth,b.halfWidth,t),grade:mix(a.grade,b.grade,t),curvature:mix(a.curvature,b.curvature,t)};
}

export type Bridge={id:string;name:string;type:BridgeType;carries:'road'|'lane'|'path'|'funicular'|'race-lane';s0:number;s1:number;a:Point3;b:Point3;span:number;deckThickness:number;clearance:number;piers:readonly Point3[];crosses:readonly string[];halfWidth:number;deck:readonly Point3[]};
function gorgeBridge(span:typeof BRIDGE_SPANS[number]):Bridge{
  const line=span.line==='road'?MOUNTAIN_ROAD_LINE:ORCHARD_LANE_LINE,deck=line.samples.slice(span.i0,span.i1+1).map(s=>s.at);
  const deckThickness=span.type==='timber'?1.1:span.type==='masonry'?(span.i1-span.i0<32?1:1.6):.9;
  let clearance=Infinity;const piers:Point3[]=[];
  const spacing=span.type==='masonry'?14:span.type==='timber'?11:18;
  // Clearance: the underside's headroom over the lowest ground (the channel) beneath the span.
  let lowest=Infinity;for(const p of deck){const g=mountainGround(p[0],p[2]);if(g<lowest){lowest=g;clearance=p[1]-deckThickness-g;}}
  for(let k=0;k<deck.length;k++){const p=deck[k]!;
    if(k>2&&k<deck.length-3&&k%spacing===0)piers.push([p[0],mountainGround(p[0],p[2]),p[2]]);}
  const a=deck[0]!,b=deck[deck.length-1]!;
  return {id:span.id,name:span.name,type:span.type,carries:span.line,s0:line.samples[span.i0]!.s,s1:line.samples[span.i1]!.s,a,b,span:Math.hypot(b[0]-a[0],b[2]-a[2]),deckThickness,clearance,piers,crosses:['gorge','river'],halfWidth:span.line==='road'?ROAD_HALF_WIDTH:ORCHARD_LANE_HALF_WIDTH,deck};
}
export const GORGE_BRIDGES:readonly Bridge[]=BRIDGE_SPANS.map(gorgeBridge);

export type EdgeRun={id:string;line:string;side:'left'|'right';kind:EdgeKind;s0:number;s1:number;points:readonly Point3[];height:number};
export type EdgeSolid={id:string;a:readonly[number,number];b:readonly[number,number];bottom:number;top:number;thickness:number};
export type RetainingWall={id:string;of:string;side:'left'|'right';foot:readonly Point3[];top:readonly Point3[];thickness:number};
/** A sample edge a departure opened: guarded rails stop short of it instead of overlapping into it. */
const departureGap=(sample:RoadSample,side:'left'|'right')=>OPENED[side].has(sample);
function runs(line:RoadLine):{edges:EdgeRun[];walls:RetainingWall[]}{
  const edges:EdgeRun[]=[],walls:RetainingWall[]=[];
  for(const side of ['left','right'] as const){
    const sign=side==='left'?1:-1;let i=0;const S=line.samples;
    while(i<S.length){
      const kind=S[i]![side];let j=i;while(j+1<S.length&&S[j+1]![side]===kind)j++;
      if(kind!=='open'){
        // Guarded runs overlap one sample into their neighbours so the rail has no gap at a joint (and a one-sample run still has length).
        const guarded=kind==='parapet'||kind==='bridge'||kind==='wall';
        const lo=guarded&&i>0&&!departureGap(S[i-1]!,side)?i-1:i,hi=guarded&&j+1<S.length&&!departureGap(S[j+1]!,side)?j+2:j+1;
        const pts=S.slice(lo,hi).map(s=>[s.at[0]+s.normal[0]*s.halfWidth*sign,s.at[1],s.at[2]+s.normal[2]*s.halfWidth*sign] as Point3);
        const id=`${line.id}:${side}:${kind}:${Math.round(S[i]!.s)}`;
        edges.push({id,line:line.id,side,kind,s0:S[i]!.s,s1:S[j]!.s,points:pts,height:kind==='kerb'?EDGE_RULES.kerbHeight:kind==='wall'?0:EDGE_RULES.parapetHeight});
        if(kind==='wall'){
          // The wall holds the cut batter: its top follows the ground just beyond the edge.
          const top=S.slice(i,j+1).map(s=>{const o=s.halfWidth+3.2,x=s.at[0]+s.normal[0]*o*sign,z=s.at[2]+s.normal[2]*o*sign;return [s.at[0]+s.normal[0]*(s.halfWidth+.3)*sign,Math.max(s.at[1]+.9,mountainGround(x,z)),s.at[2]+s.normal[2]*(s.halfWidth+.3)*sign] as Point3;});
          walls.push({id:`${id}:retaining`,of:line.id,side,foot:pts,top,thickness:.7});
        }
      }
      i=j+1;
    }
  }
  return {edges,walls};
}
const roadRuns=runs(MOUNTAIN_ROAD_LINE),laneRuns=runs(ORCHARD_LANE_LINE);
export const EDGE_RUNS:readonly EdgeRun[]=[...roadRuns.edges,...laneRuns.edges];
export const RETAINING_WALLS_ROAD:readonly RetainingWall[]=[...roadRuns.walls,...laneRuns.walls];
/** Collision segments (≈2 units long) for every parapet, bridge rail and retaining wall face. */
export const EDGE_SOLIDS:readonly EdgeSolid[]=EDGE_RUNS.filter(r=>r.kind!=='kerb').flatMap(r=>{
  const out:EdgeSolid[]=[];
  for(let k=0;k<r.points.length-1;k+=2){const a=r.points[k]!,b=r.points[Math.min(k+2,r.points.length-1)]!;
    const bottom=Math.min(a[1],b[1])-.2,top=r.kind==='wall'?Math.max(a[1],b[1])+2.4:Math.max(a[1],b[1])+r.height;
    out.push({id:`${r.id}:${k}`,a:[a[0],a[2]],b:[b[0],b[2]],bottom,top,thickness:r.kind==='wall'?.7:.3});}
  return out;
});

/** The authored dam overlook on the road/race line: the bend where the gorge, dam and town open up. */
/** Road sample at a plan (horizontal) arc length, as tags and waypoints are measured. */
export const roadSampleAtPlan=(planS:number,line:RoadLine=MOUNTAIN_ROAD_LINE)=>line.samples[Math.max(0,Math.min(line.samples.length-1,Math.round(planS/(ROAD_PLAN_STEP))))]!;
export const DAM_OVERLOOK=(()=>{
  const sample=roadSampleAtPlan(roadTagS('reservoir')+21),look:Point3=[8,78,-228];
  return {s:sample.s,at:sample.at,facing:Math.atan2(look[0]-sample.at[0],look[2]-sample.at[2]),look};
})();
