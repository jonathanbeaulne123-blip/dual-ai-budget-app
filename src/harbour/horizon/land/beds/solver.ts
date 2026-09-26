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
export function gradeRoute(id:string, controls:readonly XY[], height:HeightQuery, limit:number, pins:readonly HeightPin[]=[], diagnostics:LandDiagnostic[]=[], step=5): XYZ[] {
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
  // Each anchor provides a Lipschitz cone. The intersection is the feasible height interval.
  const ys=targets.map((target,i)=>{
    let lo=-Infinity,hi=Infinity;
    for(const [j,h] of anchors){const allowance=Math.abs(chain[i]!-chain[j]!)*limit;lo=Math.max(lo,h-allowance);hi=Math.min(hi,h+allowance);}
    return lo<=hi?clamp(target,lo,hi):(lo+hi)/2;
  });
  for(let pass=0;pass<48;pass++){
    for(let i=1;i<ys.length-1;i++)if(!fixed.has(i))ys[i]! =mix(ys[i]!,(ys[i-1]!+ys[i+1]!)/2,.35);
    for(let i=1;i<ys.length;i++)if(!fixed.has(i)){const delta=(chain[i]!-chain[i-1]!)*limit;ys[i]! =clamp(ys[i]!,ys[i-1]!-delta,ys[i-1]!+delta);}
    for(let i=ys.length-2;i>=0;i--)if(!fixed.has(i)){const delta=(chain[i+1]!-chain[i]!)*limit;ys[i]! =clamp(ys[i]!,ys[i+1]!-delta,ys[i+1]!+delta);}
    fixed.forEach((h,i)=>{ys[i]! =h;});
  }
  const result:XYZ[]=xy.map((p,i)=>[p[0]!,ys[i]!,p[1]!]);
  let above=0,max=0;
  for(let i=1;i<result.length;i++){const len=distance(plan(result[i-1]!),plan(result[i]!));const grade=Math.abs(result[i]![1]!-result[i-1]![1]!)/(len||1);max=Math.max(max,grade);if(grade>.08)above+=len;}
  if(above>0)diagnostics.push({id:`gradeReview.${id}`,severity:max>limit+.001?'conflict':'info',message:`${id}: ${above.toFixed(1)} eu over 8%; maximum ${(max*100).toFixed(2)}%`,measured:max,required:limit});
  return result;
}
