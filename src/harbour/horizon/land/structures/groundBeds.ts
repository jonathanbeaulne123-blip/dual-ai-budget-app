import type { BedCut, HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { clamp, distance, mix, plan } from './mesh';

type Segment={bed:BedCut;a:XYZ;b:XYZ;index:number};
export interface GroundBedFill { id:string; part:number; at:XY; depth:number; reason?:string }
const CELL=32;
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
        for(const row of nearby){const {a,b,bed}=row,dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((centre[0]-a[0])*dx+(centre[1]-a[2])*dz)/(dx*dx+dz*dz||1),0,1),h=mix(a[1],b[1],t),own=s.bedIds.includes(bed.id);
          if(own&&(Math.abs(h-topMean)<.75||Math.abs(row.index-ownSegments.get(bed.id)!.index)<=4))continue;
          if(Math.max(a[1],b[1])+Math.max(bed.clearHeight,bed.kind==='cable'?8:0)<=target||Math.min(a[1],b[1])+.15>=under)continue;
          if(corridorDistance(poly,plan(a),plan(b))<=bed.width/2+bed.shoulder+.3){reason=`lower route ${bed.id}`;break;}
        }
      }
      const proof={id:s.id,part:offset/24,at:centre,depth};
      if(reason){if(depth>.3)(reason==='span or tunnel exclusion'?protectedSpans:residual).push({...proof,reason});continue;}
      for(let i=0;i<4;i++)s.positions[offset+i*3+1]=Math.min(bottoms[i]!,target);
      filled.push(proof);
    }
  }
  cuts.diagnostics.push({id:'structures.terrainBedFill',severity:residual.length?'conflict':'info',message:`Grounded ${filled.length} closed surface-bed prisms; ${residual.length} unsupported prisms retained to protect exclusions, water or lower passages`,measured:residual.length,required:0});
  return {filled,residual,protectedSpans};
}
