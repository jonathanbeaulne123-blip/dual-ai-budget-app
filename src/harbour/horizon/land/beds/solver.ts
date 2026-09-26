import type { HeightQuery, LandDiagnostic, XY, XYZ } from '../interfaces';
import { clamp, distance, mix, plan } from '../structures/mesh';

export interface HeightPin { xy: XY; height: number; reason: string }
/** Centripetal-like tension keeps controls recognisable and avoids hairpin overshoot. */
export function sampleSpline(controls: readonly XY[], step=5): XY[] {
  if(controls.length<2||!Number.isFinite(step)||step<=0)throw new Error('A bed needs at least two controls and a positive sampling step');
  const result:XY[]=[];
  for(let i=0;i<controls.length-1;i++){
    const a=controls[Math.max(0,i-1)]!,b=controls[i]!,c=controls[i+1]!,d=controls[Math.min(controls.length-1,i+2)]!;
    const count=Math.max(1,Math.ceil(distance(b,c)/step));
    for(let k=0;k<count;k++){
      const t=k/count,t2=t*t,t3=t2*t;
      const coordinate=(n:0|1)=> (2*t3-3*t2+1)*b[n]!+(t3-2*t2+t)*(c[n]!-a[n]!)*.35+(-2*t3+3*t2)*c[n]!+(t3-t2)*(d[n]!-b[n]!)*.35;
      result.push([coordinate(0),coordinate(1)]);
    }
  }
  result.push(controls[controls.length-1]!);return result;
}
/** Pins are exact constraints. Incompatible pins produce diagnostics, never an invented pass. */
export function gradeRoute(id:string, controls:readonly XY[], height:HeightQuery, limit:number, pins:readonly HeightPin[]=[], diagnostics:LandDiagnostic[]=[], step=5, typical=limit): XYZ[] {
  const xy=sampleSpline(controls,step), chain=[0];
  for(let i=1;i<xy.length;i++)chain.push(chain[i-1]!+distance(xy[i-1]!,xy[i]!));
  const targets=xy.map(p=>height(...p));
  const fixed=new Map<number,number>();
  for(const pin of pins){
    let index=0,best=Infinity;xy.forEach((p,i)=>{const d=distance(p,pin.xy);if(d<best){best=d;index=i;}});
    if(best>40){diagnostics.push({id:`pin.${id}.${pin.reason}`,severity:'conflict',message:`${id}: ${pin.reason} is ${best.toFixed(1)} eu from its solved centreline`,at:pin.xy,measured:best,required:40});continue;}
    fixed.set(index,pin.height);
  }
  if(distance(xy[0]!,xy[xy.length-1]!)<.001){const seam=fixed.get(0)??targets[0]!;fixed.set(0,seam);fixed.set(xy.length-1,seam);}
  const anchors=[...fixed].sort((a,b)=>a[0]!-b[0]!);
  for(let j=1;j<anchors.length;j++){
    const [a,ha]=anchors[j-1]!,[b,hb]=anchors[j]!,available=chain[b]!-chain[a]!,needed=Math.abs(hb-ha)/limit;
    if(needed>available+.01)diagnostics.push({id:`grade.${id}.${j}`,severity:'conflict',message:`${id}: fixed heights need ${(needed-available).toFixed(1)} eu more route length between controls`,at:xy[a]!,measured:available,required:needed});
  }
  // The bed does not ride the maximum: between two anchors its working grade is the typical
  // grade, or just what those anchors need (+15 %) when that is steeper, never above `limit`.
  // Free ends keep `limit` (they follow the ground). Segment k joins samples k-1 and k.
  const work=chain.map((_,k)=>{
    if(!k)return limit;let j=anchors.findIndex(([a])=>a>=k);if(j<=0)return limit;
    const [a,ha]=anchors[j-1]!,[b,hb]=anchors[j]!,available=chain[b]!-chain[a]!,need=available>0?Math.abs(hb-ha)/available:limit;
    return Math.min(limit,Math.max(typical,need*1.15));
  });
  const weighted=[0];for(let i=1;i<xy.length;i++)weighted.push(weighted[i-1]!+(chain[i]!-chain[i-1]!)*work[i]!);
  // Each anchor provides a Lipschitz cone. The intersection is the feasible height interval.
  const bands=targets.map((_,i)=>{
    let lo=-Infinity,hi=Infinity;
    for(const [j,h] of anchors){const allowance=Math.abs(weighted[i]!-weighted[j]!);lo=Math.max(lo,h-allowance);hi=Math.min(hi,h+allowance);}
    return lo<=hi?[lo,hi]:[(lo+hi)/2,(lo+hi)/2];
  });
  const ys=targets.map((target,i)=>clamp(target,bands[i]![0]!,bands[i]![1]!));
  for(let pass=0;pass<48;pass++){
    for(let i=1;i<ys.length-1;i++)if(!fixed.has(i))ys[i]! =mix(ys[i]!,(ys[i-1]!+ys[i+1]!)/2,.35);
    for(let i=1;i<ys.length;i++)if(!fixed.has(i)){const delta=(chain[i]!-chain[i-1]!)*work[i]!;ys[i]! =clamp(clamp(ys[i]!,ys[i-1]!-delta,ys[i-1]!+delta),bands[i]![0]!,bands[i]![1]!);}
    for(let i=ys.length-2;i>=0;i--)if(!fixed.has(i)){const delta=(chain[i+1]!-chain[i]!)*work[i+1]!;ys[i]! =clamp(clamp(ys[i]!,ys[i+1]!-delta,ys[i+1]!+delta),bands[i]![0]!,bands[i]![1]!);}
    fixed.forEach((h,i)=>{ys[i]! =h;});
  }
  const result:XYZ[]=xy.map((p,i)=>[p[0]!,ys[i]!,p[1]!]);
  listSteepStretches(id,result,diagnostics,limit);
  return result;
}
/** Every stretch of a solved bed steeper than the review grade (8 %) is listed as its own
 * diagnostic (MANIFEST profiles: "every other stretch over 8 % is listed in the bake report");
 * a stretch over the bed's limit is a conflict. */
export function listSteepStretches(id:string,points:readonly XYZ[],diagnostics:LandDiagnostic[],limit:number,review=.08,skip?:(at:XY)=>boolean):void {
  let run:{from:number;length:number;max:number;at:XY}|null=null;
  const close=()=>{if(run&&run.length>=1)diagnostics.push({id:`gradeStretch.${id}.${Math.round(run.from)}`,severity:run.max>limit+.001?'conflict':'info',message:`${id}: ${run.length.toFixed(1)} eu over ${(review*100).toFixed(0)}% from arc ${run.from.toFixed(0)}; maximum ${(run.max*100).toFixed(2)}%`,at:run.at,measured:run.max,required:limit});run=null;};
  let arc=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!,len=distance(plan(a),plan(b)),g=Math.abs(b[1]-a[1])/(len||1),mid:XY=[(a[0]+b[0])/2,(a[2]+b[2])/2];
    if(g>review+1e-4&&!skip?.(mid)){run??={from:arc,length:0,max:0,at:plan(a)};run.length+=len;run.max=Math.max(run.max,g);}else close();
    arc+=len;
  }
  close();
}
