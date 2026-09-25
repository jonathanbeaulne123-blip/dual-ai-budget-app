export type Point3 = readonly [number, number, number];
export const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export const wrapAngle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
/** Arc lengths of a polyline, horizontal or full 3D. */
export function arcLengths(points:readonly Point3[],horizontal=false):number[]{
  const out=[0];
  for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!;out.push(out[i-1]!+Math.hypot(b[0]-a[0],horizontal?0:b[1]-a[1],b[2]-a[2]));}
  return out;
}
/** Point at arc length `s` on a polyline with precomputed arc lengths. */
export function pointAt(points:readonly Point3[],lengths:readonly number[],s:number):Point3{
  if(s<=0)return points[0]!;
  const end=lengths[lengths.length-1]!;if(s>=end)return points[points.length-1]!;
  let lo=0,hi=lengths.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(lengths[m]!<=s)lo=m;else hi=m;}
  const a=points[lo]!,b=points[hi]!,t=(s-lengths[lo]!)/((lengths[hi]!-lengths[lo]!)||1);
  return [mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
}
/**
 * Centripetal Catmull-Rom through plan waypoints, resampled at a uniform horizontal step.
 * Elevation is carried as a separate channel: piecewise linear in arc length between
 * waypoints, then eased with two box passes of `ease` units (parabolic vertical curves).
 */
export function authorCurve(way:readonly Point3[],step=1,ease=24,flatEnds=false):{points:Point3[];wayS:number[];step:number}{
  const dense:[number,number][]=[],denseWay:number[]=[];
  const P=(i:number)=>way[Math.max(0,Math.min(way.length-1,i))]!;
  for(let i=0;i<way.length-1;i++){
    const p0=P(i-1),p1=P(i),p2=P(i+1),p3=P(i+2);
    const knot=(a:Point3,b:Point3)=>Math.max(1e-4,Math.pow(Math.hypot(b[0]-a[0],b[2]-a[2]),.5));
    const t0=0,t1=t0+knot(p0,p1)+(i===0?1e-3:0),t2=t1+knot(p1,p2),t3=t2+knot(p2,p3)+(i===way.length-2?1e-3:0);
    const n=Math.max(4,Math.ceil(Math.hypot(p2[0]-p1[0],p2[2]-p1[2])*4));
    denseWay.push(dense.length);
    for(let k=0;k<n;k++){
      const t=t1+(t2-t1)*k/n;
      const L=(a:Point3,b:Point3,ta:number,tb:number,j:0|2)=>ta===tb?a[j]:(tb-t)/(tb-ta)*a[j]+(t-ta)/(tb-ta)*b[j];
      const pt=(j:0|2)=>{
        const A1=L(p0,p1,t0,t1,j),A2=L(p1,p2,t1,t2,j),A3=L(p2,p3,t2,t3,j);
        const B1=(t2-t)/(t2-t0)*A1+(t-t0)/(t2-t0)*A2,B2=(t3-t)/(t3-t1)*A2+(t-t1)/(t3-t1)*A3;
        return (t2-t)/(t2-t1)*B1+(t-t1)/(t2-t1)*B2;
      };
      dense.push([pt(0),pt(2)]);
    }
  }
  denseWay.push(dense.length);dense.push([way[way.length-1]![0],way[way.length-1]![2]]);
  const ds=[0];for(let i=1;i<dense.length;i++)ds.push(ds[i-1]!+Math.hypot(dense[i]![0]-dense[i-1]![0],dense[i]![1]-dense[i-1]![1]));
  const total=ds[ds.length-1]!,wayS=denseWay.map(i=>ds[i]!);
  const count=Math.max(2,Math.round(total/step)),out:[number,number,number][]=[];
  let j=0;
  for(let k=0;k<=count;k++){
    const s=total*k/count;while(j<ds.length-2&&ds[j+1]!<s)j++;
    const t=(s-ds[j]!)/((ds[j+1]!-ds[j]!)||1),a=dense[j]!,b=dense[j+1]!;
    let w=0;while(w<wayS.length-2&&wayS[w+1]!<s)w++;
    const u=clamp((s-wayS[w]!)/((wayS[w+1]!-wayS[w]!)||1));
    out.push([mix(a[0],b[0],t),mix(way[w]![1],way[w+1]![1],u),mix(a[1],b[1],t)]);
  }
  if(ease>0){
    const half=Math.max(1,Math.round(ease/step/2));
    if(!flatEnds)for(let pass=0;pass<2;pass++){
      const ys=out.map(p=>p[1]),prefix=[0];for(const y of ys)prefix.push(prefix[prefix.length-1]!+y);
      for(let k=0;k<out.length;k++){
        const r=Math.min(half,k,out.length-1-k);
        out[k]![1]=(prefix[k+r+1]!-prefix[k-r]!)/(2*r+1);
      }
    }
    else {
    // The ends are held level (padded with their own height) so each end eases in from flat,
    // then pinned back exactly with a long, gentle correction.
    const y0=out[0]![1],y1=out[out.length-1]![1],n=out.length;
    for(let pass=0;pass<2;pass++){
      const ys=out.map(p=>p[1]),prefix=[0],at=(k:number)=>k<0?y0:k>=n?y1:ys[k]!;
      for(let k=-half;k<n+half;k++)prefix.push(prefix[prefix.length-1]!+at(k));
      for(let k=0;k<n;k++)out[k]![1]=(prefix[k+2*half+1]!-prefix[k]!)/(2*half+1);
    }
    const d0=out[0]![1]-y0,d1=out[n-1]![1]-y1,fade=Math.min(n/2,half*6);
    for(let k=0;k<n;k++){const a=clamp(1-k/fade),b=clamp(1-(n-1-k)/fade);out[k]![1]-=d0*a*a*(3-2*a)+d1*b*b*(3-2*b);}
    }
  }
  return {points:out,wayS,step:total/count};
}
