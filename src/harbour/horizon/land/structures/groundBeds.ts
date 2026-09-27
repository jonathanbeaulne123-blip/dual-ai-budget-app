import type { BedCut, HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { HORIZON_MANIFEST as M } from '../../world/manifest';
import { clamp, distance, mix, plan } from './mesh';

type Segment={bed:BedCut;a:XYZ;b:XYZ;index:number};
export interface GroundBedFill { id:string; part:number; at:XY; depth:number; reason?:string }
const CELL=32;
const SWITCHBACKS=Object.values(M.structures as unknown as Record<string,{kind?:string;route?:string;bbox?:number[][]}>).filter((r):r is {kind:string;route:string;bbox:number[][]}=>!!r&&typeof r==='object'&&r.kind==='switchbackRamp'&&!!r.bbox);
function inside(p:XY,poly:readonly XY[]):boolean {let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i]!,b=poly[j]!;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function segmentDistance(p:XY,a:XY,b:XY):number {const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return distance(p,[a[0]+t*dx,a[1]+t*dz]);}
function polygonDistance(p:XY,poly:readonly XY[]):number {return inside(p,poly)?0:Math.min(...poly.map((a,i)=>segmentDistance(p,a,poly[(i+1)%poly.length]!)));}
function crosses(a:XY,b:XY,c:XY,d:XY):boolean {const cross=(p:XY,q:XY,r:XY)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]));}
function corridorDistance(poly:readonly XY[],a:XY,b:XY):number {if(inside(a,poly)||inside(b,poly)||poly.some((p,i)=>crosses(p,poly[(i+1)%poly.length]!,a,b)))return 0;return Math.min(polygonDistance(a,poly),polygonDistance(b,poly),...poly.map(p=>segmentDistance(p,a,b)));}
function polygonsOverlap(a:readonly XY[],b:readonly XY[]):boolean {return a.some(p=>inside(p,b))||b.some(p=>inside(p,a))||a.some((p,i)=>b.some((q,j)=>crosses(p,a[(i+1)%a.length]!,q,b[(j+1)%b.length]!)));}

/** Ground surface beds against the decoded terrain without moving their walking face.
 * Authored prisms must be supplied before world compaction. Protected voids remain explicit residuals. */
export function groundTerrainBeds(cuts:LandCuts,finalHeight:HeightQuery):{filled:GroundBedFill[];residual:GroundBedFill[];protectedSpans:GroundBedFill[]} {
  const filled:GroundBedFill[]=[],residual:GroundBedFill[]=[],protectedSpans:GroundBedFill[]=[],cells=new Map<string,Segment[]>(),beds=new Map(cuts.beds.map(b=>[b.id,b]));
  for(const bed of cuts.beds)for(let i=1;i<bed.points.length;i++){
    const a=bed.points[i-1]!,b=bed.points[i]!,margin=bed.width/2+bed.shoulder+.3,segment={bed,a,b,index:i-1};
    for(let x=Math.floor((Math.min(a[0],b[0])-margin)/CELL);x<=Math.floor((Math.max(a[0],b[0])+margin)/CELL);x++)for(let z=Math.floor((Math.min(a[2],b[2])-margin)/CELL);z<=Math.floor((Math.max(a[2],b[2])+margin)/CELL);z++){const key=`${x}:${z}`,list=cells.get(key)??[];list.push(segment);cells.set(key,list);}
  }
  for(const s of cuts.solids.filter(s=>s.role==='deck'&&['bed','shoulder'].includes(s.kind))){
    const sources=s.bedIds.map(id=>beds.get(id)).filter((b):b is BedCut=>!!b&&b.terrainCut);if(!sources.length)continue;
    for(let offset=0;offset+23<s.positions.length;offset+=24){
      const poly:XY[]=Array.from({length:4},(_,i)=>[s.positions[offset+i*3]!,s.positions[offset+i*3+2]!]),bottoms=poly.map((_,i)=>s.positions[offset+i*3+1]!),tops=poly.map((_,i)=>s.positions[offset+(i+4)*3+1]!),centre:XY=[poly.reduce((n,p)=>n+p[0],0)/4,poly.reduce((n,p)=>n+p[1],0)/4],samples=[...poly,centre,...poly.map((p,i):XY=>[(p[0]+poly[(i+1)%4]![0])/2,(p[1]+poly[(i+1)%4]![1])/2])],target=Math.min(...samples.map(p=>finalHeight(...p)))-.1,under=Math.max(...bottoms),depth=under-target;
      if(!Number.isFinite(target)||target>=Math.min(...bottoms)-.03)continue;
      let reason=sources.flatMap(b=>b.terrainExclusions??[]).some(e=>polygonDistance(e.at,poly)<=e.radius)?'span or tunnel exclusion':undefined;
      if(!reason){const mouth=cuts.mouths.find(m=>m.ceiling>target&&m.floor<under&&polygonsOverlap(poly,m.outline));if(mouth)reason=`named mouth ${mouth.id}`;}
      if(!reason)for(const w of cuts.waters){
        if(w.kind==='dry')continue;
        if(w.kind==='sea'){if(target<w.level&&under>w.level-w.depth)reason=`water ${w.id}`;}
        else if(w.points.length>1){for(let i=1;i<w.points.length;i++){const a=w.points[i-1]!,b=w.points[i]!;if(Math.max(a[1],b[1])+4>target&&Math.min(a[1],b[1])-w.depth<under&&corridorDistance(poly,plan(a),plan(b))<=w.width/2){reason=`water ${w.id}`;break;}}}
        else if(w.level+4>target&&w.level-w.depth<under&&w.outline.length>2&&polygonsOverlap(poly,w.outline))reason=`water ${w.id}`;
        if(reason)break;
      }
      if(!reason){const nearby=new Set<Segment>();for(let x=Math.floor(Math.min(...poly.map(p=>p[0]))/CELL);x<=Math.floor(Math.max(...poly.map(p=>p[0]))/CELL);x++)for(let z=Math.floor(Math.min(...poly.map(p=>p[1]))/CELL);z<=Math.floor(Math.max(...poly.map(p=>p[1]))/CELL);z++)for(const row of cells.get(`${x}:${z}`)??[])nearby.add(row);
        const ownSegments=new Map<string,{index:number;score:number}>(),topMean=tops.reduce((a,b)=>a+b,0)/4;
        for(const row of nearby)if(s.bedIds.includes(row.bed.id)){const score=segmentDistance(centre,plan(row.a),plan(row.b))+Math.abs((row.a[1]+row.b[1])/2-topMean)*4;if(score<(ownSegments.get(row.bed.id)?.score??Infinity))ownSegments.set(row.bed.id,{index:row.index,score});}
        // W3-A: a footway and its host share one surface (BedCut.sharedEdges): neither is the other's "lower route".
        // v1.9 switchback ramps (MANIFEST structures.<id>.kind switchbackRamp): inside the ramp's box a leg over the
        // leg below is carried on the retaining wall between them, so the upper leg's shoulder is grounded (the wall).
        const inRamp=SWITCHBACKS.some(r=>r.route&&s.bedIds.includes(r.route)&&centre[0]>=r.bbox[0]![0]!&&centre[0]<=r.bbox[1]![0]!&&centre[1]>=r.bbox[0]![1]!&&centre[1]<=r.bbox[1]![1]!);
        const partners=new Set(sources.flatMap(src=>(src.sharedEdges??[]).filter(e=>e.at.some((p,i)=>i>0&&segmentDistance(centre,e.at[i-1]!,p)<4)).map(e=>e.other)));
        for(const row of nearby){const {a,b,bed}=row,dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((centre[0]-a[0])*dx+(centre[1]-a[2])*dz)/(dx*dx+dz*dz||1),0,1),h=mix(a[1],b[1],t),own=s.bedIds.includes(bed.id);
          if(partners.has(bed.id)||inRamp&&own)continue;
          if(own&&(Math.abs(h-topMean)<.75||Math.abs(row.index-ownSegments.get(bed.id)!.index)<=4))continue;
          // W3-A: the lower route's own height where it passes the prism (h), not its segment's
          // min/max: a footway beside a host on a 12 % grade read the host's low end as "under" it.
          if(h+Math.max(bed.clearHeight,bed.kind==='cable'?8:0)<=target||h+.15>=under)continue;
          // W5-A: the lower route's walking width (+0.3), not its shoulder: a prism beside a lower lane is grounded, its fill
          // face standing on the lower route's shoulder as a retaining edge (the Year Walk's side-by-side lanes at two heights
          // counted the 1.2 m shoulder and hung unsupported beside each other).
          if(corridorDistance(poly,plan(a),plan(b))<=bed.width/2+.3){reason=`lower route ${bed.id}`;break;}
        }
      }
      const proof={id:s.id,part:offset/24,at:centre,depth};
      if(reason){if(depth>.3)(reason==='span or tunnel exclusion'?protectedSpans:residual).push({...proof,reason});continue;}
      for(let i=0;i<4;i++)s.positions[offset+i*3+1]=Math.min(bottoms[i]!,target);
      filled.push(proof);
    }
  }
  cuts.diagnostics.push({id:'structures.terrainBedFill',severity:residual.length?'conflict':'info',message:`Grounded ${filled.length} closed surface-bed prisms; ${residual.length} unsupported prisms (bake errors listed below by place)`,measured:residual.length,required:0});
  // Never a silent retain: every unsupported run is its own located bake error (clustered
  // within 12 m per bed and reason), with the deepest void under it.
  const clusters:{bed:string;reason:string;at:XY;depth:number;n:number}[]=[];
  for(const r of [...residual].sort((a,b)=>b.depth-a.depth)){
    const bedId=r.id.replace(/\.(bed|shoulders|surface)(\.\d+)?(\.[a-z]+)?$/i,''),c=clusters.find(c=>c.bed===bedId&&c.reason===r.reason&&distance(c.at,r.at)<12);
    if(c)c.n++;else clusters.push({bed:bedId,reason:r.reason??'',at:r.at,depth:r.depth,n:1});
  }
  clusters.forEach((c,i)=>cuts.diagnostics.push({id:`structures.terrainBedFill.residual.${i}`,severity:'conflict',message:`${c.bed}: ${c.n} bed prisms hang up to ${c.depth.toFixed(2)} eu over the ground (${c.reason}); a bed that cannot be grounded needs a named structure with bearings or a different alignment`,at:c.at,measured:c.depth,required:0}));
  // FINISH-PROMPT A1.1: a residual deeper than RESIDUAL_LIMIT fails the bake unless it is reserved (RESERVED_VOIDS, D-C10 only)
  // or a named, owned open item (OPEN_VOIDS, each with its owner and request - to be emptied, never grown silently).
  const failing=residualBakeErrors(clusters);
  if(failing.length)throw new Error(`Unsupported beds deeper than ${RESIDUAL_LIMIT} eu (A1.1): ${failing.map(c=>`${c.bed} ${c.depth.toFixed(2)} eu at [${c.at.map(v=>v.toFixed(1)).join(',')}] (${c.reason})`).join('; ')}`);
  return {filled,residual,protectedSpans};
}
/** A residual void deeper than this under a bed fails the bake (A1.1). */
export const RESIDUAL_LIMIT=1.25;
export interface VoidAllowance { bed:string; at:XY; r:number; decision:string; owner?:string; why:string }
/** Reserved by Jonathan's rulings: only the Hollow neck (D-C10, keep reserved until the other crossings are done). */
export const RESERVED_VOIDS:readonly VoidAllowance[]=[
  {bed:'*',at:[895,605],r:36,decision:'D-C10',why:'the Hollow neck: the brook under the Garden Walk, S4 and the Year Walk (hollowBridge)'},
];
/** Open, owned items measured on the W5-A scratch bake (2026-09-27). Each names its owner and the request that closes it. */
export const OPEN_VOIDS:readonly VoidAllowance[]=[
  {bed:'yearWalk',at:[1605,690],r:16,decision:'W5-DATA Beds',owner:'W5-T',why:'Year Walk lane over its own lane at the Prow November loop: a lane re-route or a named overpass (manifest journey.yearWalk)'},
  {bed:'yearWalk',at:[892.5,471.7],r:16,decision:'W5-DATA Beds',owner:'W5-T',why:'Year Walk lane stacking at Scholars (two legs 4.1 apart): lane re-route'},
  {bed:'yearWalk',at:[914.9,601.5],r:10,decision:'W5-DATA Beds',owner:'W5-T',why:'Year Walk April/June lanes on S4 stacked at the Hollow: lane re-route'},
  {bed:'yearWalk',at:[1512,1026],r:12,decision:'W5-DATA Beds',owner:'W5-T',why:'Year Walk lane stacking at the harbour: lane re-route'},
  {bed:'yearWalk',at:[1384.8,687.9],r:10,decision:'D-C7',owner:'W5-T',why:'turning circle: the January lane over the V02 footway lane (D-C7 re-route of one lane)'},
  {bed:'yearWalk',at:[1461.6,698.8],r:10,decision:'W5-DATA Beds',owner:'W5-T',why:'Year Walk lanes stacked on the Crown Road shelf'},
  {bed:'yearWalk',at:[1400.9,869.8],r:10,decision:'W5-DATA Beds',owner:'W5-T',why:'Year Walk lanes stacked on the Shoulder'},
  {bed:'yearWalk',at:[1448.5,376.2],r:10,decision:'W5-DATA Beds',owner:'W5-T',why:'Year Walk lanes stacked at Crown Road\'s foot'},
  {bed:'yearWalk',at:[418,896],r:20,decision:'D-A7 #34',owner:'W5-S',why:'Year Walk footways at the Bight Bridge west abutment (embankment 14 × 24, structures)'},
  {bed:'walk bightPier',at:[415,897],r:14,decision:'D-A7 #34',owner:'W5-S/W5-A',why:'the pier walk over the Drive and its footways at #34: v2.0 moved the Drive to 21.3 there (28.4 on candidate 3); flush needs the west abutment profile'},
  {bed:'V01',at:[420,932],r:36,decision:'D-A7 #34',owner:'W5-S',why:'the Drive over its own July/August footway lanes on the Bight Bridge west approach (the abutment embankment carries them)'},
  {bed:'homestead.lane',at:[1515.2,1190.5],r:6,decision:'R2-04',owner:'W5-A',why:'the lane leaves the yard 3.5 over the Year Walk: a yard-edge stair or a lane start moved west (next W5-A pass)'},
  {bed:'walk reach',at:[1250,1155],r:30,decision:'R2-20',owner:'W3-C/W5-A',why:'the Reach walk on the river lower\'s bank: the bank at the water level + 0.3 (water) or a boardwalk (beds)'},
  {bed:'walk flats',at:[349.8,879],r:5,decision:'R2-04',owner:'W5-A',why:'the Flats trail end 3.2 over the pier walk\'s start (a flush junction owed)'},
  {bed:'host.glasshouse.approach',at:[998.2,812.3],r:6,decision:'R2-04',owner:'W5-S',why:'the Glasshouse approach over the glasshouse steps (authored flat at 50; a stair from the spur at 34)'},
  {bed:'plot.bight.1.service',at:[857.2,935.1],r:6,decision:'D-C8',owner:'W5-A',why:'the moved plot\'s service drive crosses the June lane 2.2 over it (P31: the clear spot is 25 m WSW, not 12)'},
  {bed:'strip',at:[419.5,690.9],r:6,decision:'R2-04',owner:'W5-S',why:'the airstrip edge 1.9 over the Year Walk lane beside it'},
  {bed:'host.bank.approach',at:[1434.9,1146.4],r:6,decision:'R2-36',owner:'W5-A',why:'the bank approach over its own lower leg (the Kitty plaza lip)'},
  {bed:'VBS',at:[872.4,944.5],r:8,decision:'D-C9',owner:'W5-S/W5-T',why:'VBS 1.5 over S4 just south of structures.bightSpurTrestle: extend the trestle ≈ 12 m south'},
];
const covered=(c:{bed:string;at:XY},list:readonly VoidAllowance[])=>list.some(v=>(v.bed==='*'||v.bed===c.bed)&&distance(c.at,v.at)<=v.r);
/** The residual clusters that fail the bake: deeper than RESIDUAL_LIMIT and on neither list. */
export function residualBakeErrors<T extends {bed:string;at:XY;depth:number;reason:string}>(clusters:readonly T[]):T[] {
  return clusters.filter(c=>c.depth>RESIDUAL_LIMIT&&!covered(c,RESERVED_VOIDS)&&!covered(c,OPEN_VOIDS));
}
