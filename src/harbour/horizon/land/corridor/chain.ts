import type {BedCut} from '../interfaces';
import type {Point3} from '../../world/definition';
import V2 from '../mountainV2/v2-data.json';

export type RoadChain={id:string;label:string;points:Point3[];widths:{s:number;half:number}[];parts:{id:string;label:string;from:number;to:number}[]};
/** The actual through line. The Foot lane comes from the native course export, never a chord
 * invented by an audit or renderer. Stations use plan metres; native source s is spatial metres. */
export function mountainRoadChain(beds:readonly Pick<BedCut,'id'|'points'|'width'>[]):RoadChain|null{
  const approach=beds.find(b=>b.id==='V03'),mountain=beds.find(b=>b.id==='mountainV2.road');if(!approach||!mountain)return null;
  const end=approach.points.at(-1)!,foot=mountain.points[0]!,course=V2.course.points as Point3[];
  const nearest=(q:Point3)=>course.reduce((best,p,i)=>Math.hypot(p[0]-q[0],p[2]-q[2])<Math.hypot(course[best]![0]-q[0],course[best]![2]-q[2])?i:best,0);
  const lane=course.slice(nearest(foot),nearest(end)+1).reverse().filter(p=>p[2]<end[2]);
  if(!lane.length||Math.hypot(lane.at(-1)![0]-foot[0],lane.at(-1)![2]-foot[2])>.1)throw new Error('Mountain chain Foot lane no longer meets the road');
  const points:Point3[]=[],widths:RoadChain['widths']=[],parts:RoadChain['parts']=[];let s=0;
  const append=(id:string,label:string,ps:readonly Point3[],half:(i:number)=>number)=>{
    const from=s;ps.forEach((p,i)=>{const previous=points.at(-1),d=previous?Math.hypot(p[0]-previous[0],p[2]-previous[2]):0;if(previous&&d<1e-6)return;s+=d;points.push(p);widths.push({s,half:half(i)});});parts.push({id,label,from,to:s});
  };
  append('V03','Prow, tunnel and canal',approach.points,()=>approach.width/2);
  append('mountainV2.footLane','Foot town lane',lane,()=>3.5);
  append('mountainV2.road','Mountain Road to Summit Commons',mountain.points,i=>V2.road.samples[i]!.hw);
  return {id:'mountain-road',label:'Prow to Summit Commons',points,widths,parts};
}
