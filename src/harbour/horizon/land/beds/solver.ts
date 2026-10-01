import type { HeightQuery, LandDiagnostic, XY, XYZ } from '../interfaces';
import { clamp, distance, mix, plan } from '../structures/mesh';

export interface HeightPin { xy: XY; height: number; reason: string; /** Sample index on the route when the pin was taken from a sample: a route that passes a
 * point twice (two lanes of one walk) keeps each pin on its own lane (W3-A). */ index?: number }
/** Centripetal-like tension keeps controls recognisable and avoids hairpin overshoot.
 * road (L1): `straight` names control segments (index i: controls[i] → controls[i+1]) that are laid as a straight line (a
 * straight bridge the road must follow exactly, the Bight Bridge between its manifest ends). The tangent at both ends of such
 * a segment is turned onto its axis (keeping its length), so the neighbouring segments blend into it without a kink. */
export function sampleSpline(controls: readonly XY[], step=5, straight?: ReadonlySet<number>): XY[] {
  if(controls.length<2||!Number.isFinite(step)||step<=0)throw new Error('A bed needs at least two controls and a positive sampling step');
  const result:XY[]=[],last=controls.length-1;
  const tangent=(j:number):XY=>{
    const a=controls[Math.max(0,j-1)]!,c=controls[Math.min(last,j+1)]!,t:XY=[c[0]-a[0],c[1]-a[1]];
    const k=straight?.has(j)?j:straight?.has(j-1)?j-1:-1;if(k<0||k>=last)return t;
    const p=controls[k]!,q=controls[k+1]!,len=distance(p,q)||1,m=Math.hypot(t[0],t[1]);return [(q[0]-p[0])/len*m,(q[1]-p[1])/len*m];
  };
  for(let i=0;i<last;i++){
    const b=controls[i]!,c=controls[i+1]!,mb=tangent(i),mc=tangent(i+1);
    const count=Math.max(1,Math.ceil(distance(b,c)/step));
    for(let k=0;k<count;k++){
      const t=k/count,t2=t*t,t3=t2*t;
      const coordinate=(n:0|1)=> (2*t3-3*t2+1)*b[n]!+(t3-2*t2+t)*mb[n]!*.35+(-2*t3+3*t2)*c[n]!+(t3-t2)*mc[n]!*.35;
      result.push([coordinate(0),coordinate(1)]);
    }
  }
  result.push(controls[last]!);return result;
}
/** Pins are exact constraints. Incompatible pins produce diagnostics, never an invented pass. */
export function gradeRoute(id:string, controls:readonly XY[], height:HeightQuery, limit:number, pins:readonly HeightPin[]=[], diagnostics:LandDiagnostic[]=[], step=5, typical=limit, options:{straight?:ReadonlySet<number>;fair?:boolean}={}): XYZ[] {
  const xy=sampleSpline(controls,step,options.straight), chain=[0];
  for(let i=1;i<xy.length;i++)chain.push(chain[i-1]!+distance(xy[i-1]!,xy[i]!));
  const targets=xy.map(p=>height(...p));
  const fixed=new Map<number,number>();
  for(const pin of pins){
    let index=0,best=Infinity;
    if(pin.index!==undefined&&pin.index>=0&&pin.index<xy.length&&distance(xy[pin.index]!,pin.xy)<1){index=pin.index;best=distance(xy[index]!,pin.xy);}
    else xy.forEach((p,i)=>{const d=distance(p,pin.xy);if(d<best){best=d;index=i;}});
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
  let result:XYZ[]=xy.map((p,i)=>[p[0]!,ys[i]!,p[1]!]);
  // road (L1): a road's profile is faired into vertical curves (no grade change sharper than ROAD_CURVE per 10 m) with
  // every pin held exactly.
  if(options.fair)result=fairProfile(result,new Set(fixed.keys()),limit);
  listSteepStretches(id,result,diagnostics,limit);
  return result;
}
/** road (L1, ROAD.md §2.4): the sharpest grade change a road may make per 10 m (a crest or sag at 16 m/s never lifts a wheel). */
export const ROAD_CURVE=.04;
/** road (L1): the grade change (rise/run) between the 10 m before and the 10 m after every point of a profile, and its worst. */
export function profileCurvature(points:readonly XYZ[],window=10):{worst:number;at:number;grade:number} {
  const arcs=[0];for(let i=1;i<points.length;i++)arcs.push(arcs[i-1]!+distance(plan(points[i-1]!),plan(points[i]!)));
  const total=arcs.at(-1)!;let j=0;
  const y=(s:number)=>{s=clamp(s,0,total);while(j>0&&arcs[j]!>s)j--;while(j<arcs.length-2&&arcs[j+1]!<s)j++;const a=arcs[j]!,b=arcs[j+1]??a,t=b>a?(s-a)/(b-a):0;return mix(points[j]![1],points[Math.min(points.length-1,j+1)]![1],t);};
  let worst=0,at=0,grade=0;
  for(let s=window;s<=total-window;s+=1){const g0=(y(s)-y(s-window))/window,g1=(y(s+window)-y(s))/window;grade=Math.max(grade,Math.abs(g1));if(Math.abs(g1-g0)>worst){worst=Math.abs(g1-g0);at=s;}}
  return {worst,at,grade};
}
/** road (L1): fair a road profile: the heights nearest (least squares) to the solved ones such that no segment is steeper than
 * `limit` and the grade changes by at most `maxChange` per 10 m at every point (a vertical curve), holding `fixed` exactly.
 * The feasible set is an intersection of half-spaces (two per segment, two per point); Hildreth's method (Dykstra's
 * alternating projections for half-spaces) converges to the projection onto it. Where the held points make it infeasible the
 * result is the last iterate, then clamped to `limit`. Plan positions never move. A closed profile (first point = last) is
 * faired round its seam. */
export function fairProfile(points:readonly XYZ[],fixed:ReadonlySet<number>,limit:number,options:{maxChange?:number;sweeps?:number}={}):XYZ[] {
  const n0=points.length;if(n0<4)return [...points];
  const closed=distance(plan(points[0]!),plan(points[n0-1]!))<.001,n=closed?n0-1:n0;
  const idx=(i:number)=>closed?((i%n)+n)%n:i,segs=closed?n:n-1;
  const d:number[]=[];for(let i=0;i<segs;i++)d.push(Math.max(.05,distance(plan(points[i]!),plan(points[idx(i+1)]!))));
  const y=points.slice(0,n).map(p=>p[1]),free=y.map(()=>1);
  for(const i of fixed){if(i<n)free[i]=0;else if(closed&&i===n0-1)free[0]=0;}
  if(!closed){free[0]=0;free[n-1]=0;}
  // Per 10 m the grade may change by maxChange: between two segments meeting at a point the allowance is maxChange/10 per eu of
  // their mean length; kept 10 % inside the bound so the 10 m windowed measure holds it.
  const rate=(options.maxChange??ROAD_CURVE)*.9/10;
  type H={v:number[];w:number[];b:number;z:number};const hs:H[]=[];
  for(let i=0;i<segs;i++){const j=idx(i+1);for(const sign of [1,-1])hs.push({v:[i,j],w:[-sign/d[i]!,sign/d[i]!],b:limit,z:0});}
  for(let k=closed?0:1;k<(closed?n:n-1);k++){const a=d[closed?idx(k-1):k-1]!,c=d[closed?idx(k):k]!,cap=rate*(a+c)/2;
    for(const sign of [1,-1])hs.push({v:[idx(k-1),k,idx(k+1)],w:[-sign/a,sign*(1/a+1/c),-sign/c].map(x=>-x),b:cap,z:0});}
  // Only free coordinates move: each half-space's normal restricted to them.
  const norm=hs.map(h=>h.w.reduce((s,w,m)=>s+(free[h.v[m]!]?w*w:0),0));
  for(let sweep=0;sweep<(options.sweeps??60000);sweep++){let change=0;
    for(let q=0;q<hs.length;q++){const h=hs[q]!,nn=norm[q]!;if(nn<1e-12)continue;
      // Dykstra/Hildreth: add back this set's correction, project, store the new correction (a multiple of the normal, z ≥ 0).
      let dot=0;for(let m=0;m<h.v.length;m++)dot+=h.w[m]!*y[h.v[m]!]!;
      const next=Math.max(0,h.z-(h.b-dot)/nn),delta=next-h.z;if(!delta)continue;
      for(let m=0;m<h.v.length;m++){const v=h.v[m]!;if(free[v])y[v]=y[v]!-delta*h.w[m]!;}
      h.z=next;change=Math.max(change,Math.abs(delta));}
    if(change<1e-7)break;}
  // Never steeper than the limit, whatever the held points did: a Lipschitz clamp both ways.
  for(let pass=0;pass<4;pass++){
    for(let i=1;i<(closed?n+1:n);i++){const j=idx(i),p=idx(i-1);if(!free[j])continue;const m=d[closed?idx(i-1):i-1]!*limit;y[j]=clamp(y[j]!,y[p]!-m,y[p]!+m);}
    for(let i=(closed?n-1:n-2);i>=0;i--){const j=idx(i),q=idx(i+1);if(!free[j])continue;const m=d[i]!*limit;y[j]=clamp(y[j]!,y[q]!-m,y[q]!+m);}
  }
  return points.map((p,i):XYZ=>[p[0],i<n?y[i]!:y[0]!,p[2]]);
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
