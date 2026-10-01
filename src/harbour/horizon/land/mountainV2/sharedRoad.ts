/** The native race course and road are two samplings of one authored road.
 * Prove their segment correspondence without changing either polyline. The course
 * continues down the town lane; those later segments do not own mountain road. */
import V2 from './v2-data.json';
import type {XY,XYZ} from '../interfaces';
export interface SharedRoadSegment {
  source:'mountain-v2:mountain-road';owner:'mountainV2.road';segment:number;
  /** Inclusive range of original owner segment indices, independent of direction. */
  ownerSegments:readonly [number,number];
}
export interface SharedRoadProof extends SharedRoadSegment {
  match:'segment'|'start-touch'|'end-touch'|'foot-touch';
  hitSegment:number;ownerSegment:number;
  endpoint?:{courseRow:number;ownerVertex:number;courseAt:XYZ;ownerAt:XYZ};
}
const EXPORT_AXIS_ERROR=.005001;
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i]!)<1e-7);
/** Only unchanged source vertices may declare ownership. Route names alone do not
 * authorize sharing, and a different switchback remains an ordinary crossing. */
export function mountainSharedRoadSegments(course:readonly XYZ[],road:readonly XYZ[]):SharedRoadSegment[]{
  const sourceRoad=V2.road.samples,sourceCourse=V2.course.points;
  if(road.length!==sourceRoad.length||road.some((p,i)=>!same(p,sourceRoad[i]!.at)))return[];
  // Source course exports centimetres, road exports microns. Test the full XYZ
  // quantization box, not a rounded key that can flip at a half-centimetre tie.
  // An ambiguous source vertex fails closed; no nearest unrelated route can win.
  const sourceIndex=(p:readonly number[]):number|undefined=>{
    const matches:number[]=[];
    sourceRoad.forEach((s,i)=>{if(s.at.every((v,axis)=>Math.abs(v-p[axis]!)<=EXPORT_AXIS_ERROR))matches.push(i);});
    return matches.length===1?matches[0]:undefined;
  };
  const out:SharedRoadSegment[]=[];
  let expected=sourceRoad.length-1;
  for(let i=0;i<Math.min(course.length,sourceCourse.length)-1&&expected>0;i++){
    const a=sourceIndex(sourceCourse[i]!),b=sourceIndex(sourceCourse[i+1]!);
    // Native course travels summit→Foot over every third source road vertex;
    // the summit remainder may be shorter. Stop at Foot, before the town lane.
    if(a!==expected||b===undefined||a<=b||a-b>3)break;
    expected=b;
    if(!same(course[i]!,sourceCourse[i]!)||!same(course[i+1]!,sourceCourse[i+1]!))continue;
    out.push({source:'mountain-v2:mountain-road',owner:'mountainV2.road',segment:i,ownerSegments:[b,a-1]});
  }
  return out;
}
/** Match an interior source interval, or a quantized endpoint touch. Adjacent
 * segment indices alone are never sufficient. The town lane owns no road span. */
export function sharedRoadSegmentAt(spans:readonly SharedRoadSegment[]|undefined,owner:string,segment:number,ownerSegment:number,heightDifference:number,at:XY):SharedRoadProof|null{
  // Source proof bounds only; no collision/controller tolerance changes.
  if(!Number.isFinite(heightDifference)||Math.abs(heightDifference)>.02||!at.every(Number.isFinite)||!Number.isInteger(ownerSegment)||ownerSegment<0||ownerSegment>=V2.road.samples.length-1)return null;
  const owned=spans?.filter(s=>s.owner===owner)??[];
  const exact=owned.find(s=>s.segment===segment&&ownerSegment>=s.ownerSegments[0]&&ownerSegment<=s.ownerSegments[1]);
  if(exact)return{...exact,match:'segment',hitSegment:segment,ownerSegment};
  const touch=(s:SharedRoadSegment,courseRow:number,ownerVertex:number,match:SharedRoadProof['match']):SharedRoadProof|null=>{
    const c=V2.course.points[courseRow],r=V2.road.samples[ownerVertex]?.at;
    if(!c||!r)return null;
    // The hit must be inside BOTH endpoint quantization boxes. This admits only
    // the centimetre-export rounding discrepancy, not an extended shared lane.
    const near=(p:readonly number[])=>Math.abs(at[0]-p[0]!)<=EXPORT_AXIS_ERROR&&Math.abs(at[1]-p[2]!)<=EXPORT_AXIS_ERROR;
    if(!near(c)||!near(r))return null;
    return{...s,match,hitSegment:segment,ownerSegment,endpoint:{courseRow,ownerVertex,courseAt:[c[0]!,c[1]!,c[2]!],ownerAt:[r[0]!,r[1]!,r[2]!]}};
  };
  const span=owned.find(s=>s.segment===segment);
  if(span){
    // Course runs in the reverse road direction: its start is the high index.
    if(ownerSegment===span.ownerSegments[1]+1)return touch(span,segment,ownerSegment,'start-touch');
    if(ownerSegment===span.ownerSegments[0]-1)return touch(span,segment+1,span.ownerSegments[0],'end-touch');
  }
  // The first town-lane segment may TOUCH the already-proven Foot endpoint.
  // Its interior and every later town-lane segment receive no ownership.
  const foot=owned.find(s=>s.ownerSegments[0]===0&&s.segment+1===segment);
  return foot&&ownerSegment===0?touch(foot,segment,0,'foot-touch'):null;
}
