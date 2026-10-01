import type {RoadLine,RoadSample} from './roads.ts';
/** D-MR19: native-road repair approved by Jonathan on 2026-10-01.
 * Fair transverse frames at three folded hairpins (third approved D-MR20). Centreline stations/heights, nominal
 * perpendicular width and bridge frames stay authored. Branch centrelines and skill-rail
 * points stay authored; road edge rails follow repaired frames.
 * Keep the original unit normal for seeded plants and free-standing props: changing
 * a planting acceptance branch can otherwise consume different random numbers and
 * relocate later scenery across the whole mountain. */
export function fairMountainRoadFrames(line:RoadLine):RoadLine{
 const source=line.samples,span=10,anchors=[[70,-77],[85,-284],[19,-93]] as const;
 const centres=anchors.map(([x,z])=>source.reduce((best,s,i)=>Math.hypot(s.at[0]-x,s.at[2]-z)<Math.hypot(source[best]!.at[0]-x,source[best]!.at[2]-z)?i:best,0));
 const samples=source.map((s,i):RoadSample=>{
  const distance=Math.min(...centres.map(c=>Math.abs(i-c)));
  if(distance>=2*span||s.bridgeId||source[i-1]?.bridgeId||source[i+1]?.bridgeId)return s;
  const blend=distance<=span?1:(1+Math.cos((distance-span)/span*Math.PI))/2;
  let nx=0,nz=0;
  for(let j=Math.max(0,i-span);j<=Math.min(source.length-1,i+span);j++){
   const weight=Math.exp(-(((i-j)/(span/2))**2));nx+=source[j]!.normal[0]*weight;nz+=source[j]!.normal[2]*weight;
  }
  let length=Math.hypot(nx,nz);nx=nx/length*blend+s.normal[0]*(1-blend);nz=nz/length*blend+s.normal[2]*(1-blend);
  length=Math.hypot(nx,nz);nx/=length;nz/=length;
  // A mitred transverse frame: retain the full perpendicular width instead of
  // shrinking it by cos(turn). Its length can exceed one; offsets remain metres
  // perpendicular to the unchanged authored tangent.
  const perpendicular=nx*s.normal[0]+nz*s.normal[2];
  return {...s,placementNormal:s.placementNormal??s.normal,normal:[nx/perpendicular,0,nz/perpendicular]};
 });
 return {...line,samples};
}
