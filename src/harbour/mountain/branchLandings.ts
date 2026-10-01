import {smooth,type Point3} from './math.ts';

/** Shared by the branch's visible apron and all surface/ceiling/body queries. */
export type LandingRows=readonly (readonly Point3[])[];
type Row=Point3[];
type RoadSample={s:number;at:Point3};
function gradient(a:Point3,b:Point3,c:Point3):number{
  const ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2],det=ux*vz-uz*vx;if(Math.abs(det)<1e-10)return 0;
  const dy=b[1]-a[1],ey=c[1]-a[1];return Math.hypot((dy*vz-ey*uz)/det,(ux*ey-vx*dy)/det);
}
function bandGrade(a:Row,b:Row):number{let max=0;for(let k=1;k<a.length;k++)max=Math.max(max,gradient(a[k-1]!,b[k-1]!,b[k]!),gradient(a[k-1]!,b[k]!,a[k]!));return max;}
const softMin=(a:number,b:number)=>{const k=.05,h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
/** Regrade the exit upstream from its true road overlap. A backward grade envelope includes
 * the inside of the curved deck, where plan arc alone understates slope. Earlier skill features
 * remain at authored height; the 5cm soft minimum eases the start of the changed approach. */
export function repairBranchLanding(authored:readonly Point3[],halfWidth:number,road:readonly RoadSample[],grade:number):{points:Point3[];rows:LandingRows}{
  const rows:Row[]=authored.map((p,i)=>{
    const a=authored[Math.max(0,i-1)]!,b=authored[Math.min(authored.length-1,i+1)]!,dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1;
    return Array.from({length:5},(_,k):Point3=>[p[0]+dz/len*halfWidth*(k/2-1),p[1],p[2]-dx/len*halfWidth*(k/2-1)]);
  });
  const arc=[0];for(let i=1;i<rows.length;i++)arc.push(arc[i-1]!+1/bandGrade(rows[i-1]!.map(p=>[p[0],0,p[2]]),rows[i]!.map(p=>[p[0],1,p[2]])));
  function near(p:Point3,station?:number){
    let hit={d:Infinity,y:p[1],s:0};for(let j=1;j<road.length;j++){
      if(station!==undefined&&(road[j]!.s<station-30||road[j-1]!.s>station+30))continue;
      const a=road[j-1]!.at,b=road[j]!.at,dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1))),d=Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);
      if(d<hit.d)hit={d,y:a[1]+t*(b[1]-a[1]),s:road[j-1]!.s+t*(road[j]!.s-road[j-1]!.s)};
    }return hit;
  }
  const n=rows.length,end=authored[n-1]!,endStation=near(end).s,nearest=rows.map(row=>row.map(p=>near(p,endStation)));
  const overlap=rows.findIndex((row,i)=>i>n/2&&row.some((p,k)=>Math.hypot(p[0]-end[0],p[2]-end[2])<28&&nearest[i]![k]!.d<=4.8));
  const first=overlap<0?-1:Math.max(0,overlap-1);
  if(first<0)return {points:[...authored],rows};
  const target=nearest.map(row=>row[2]!.y);
  const heights=authored.map((p,i)=>{if(i>=first)return target[i]!;let upper=Infinity;for(let j=first;j<n;j++)upper=Math.min(upper,target[j]!+grade*(arc[j]!-arc[i]!));return softMin(p[1],upper);});
  const start=Math.max(0,first-8);
  const repaired=rows.map((row,i)=>{const w=smooth((arc[i]!-arc[start]!)/(arc[first]!-arc[start]!));return row.map((p,k):Point3=>[p[0],heights[i]!+w*(nearest[i]![k]!.y-target[i]!),p[2]]);});
  return {points:authored.map((p,i):Point3=>[p[0],heights[i]!,p[2]]),rows:repaired};
}
/** A point on the actual deck triangles. `band` ends at rows[band], `along` runs
 * from its preceding row, and `across` runs from the first to the last column.
 * Barycentric interpolation follows the rendered a-b-c / a-c-d diagonal; a
 * bilinear height would invent a different surface on a cross-falling cell. */
export function landingPointAt(rows:LandingRows,band:number,along:number,across:number):Point3{
  const a=rows[band-1],b=rows[band];
  if(!a||!b||a.length<2||a.length!==b.length||!Number.isFinite(along)||!Number.isFinite(across)||along<0||along>1||across<0||across>1)throw new RangeError('Invalid landing band coordinate');
  const column=across*(a.length-1),k=Math.min(a.length-2,Math.floor(column)),v=column-k;
  const [p,q,r]:readonly [Point3,Point3,Point3]=along>=v?[a[k]!,b[k]!,b[k+1]!]:[a[k]!,b[k+1]!,a[k+1]!];
  const w:readonly [number,number,number]=along>=v?[1-along,along-v,v]:[1-v,along,v-along];
  return [p[0]*w[0]!+q[0]*w[1]!+r[0]*w[2]!,p[1]*w[0]!+q[1]*w[1]!+r[1]*w[2]!,p[2]*w[0]!+q[2]*w[1]!+r[2]*w[2]!];
}
/** Local plan half-width of those same rows. This is descriptive metadata, not
 * an inflated capsule or a substitute for exact triangle membership. */
export function landingHalfWidthAt(rows:LandingRows,band:number,along:number):number{
  const centre=landingPointAt(rows,band,along,.5),left=landingPointAt(rows,band,along,0),right=landingPointAt(rows,band,along,1);
  return Math.max(Math.hypot(left[0]-centre[0],left[2]-centre[2]),Math.hypot(right[0]-centre[0],right[2]-centre[2]));
}

/** Exact triangle height/gradient, using the same diagonal as the rendered apron. */
export function landingSample(rows:LandingRows,x:number,z:number):{y:number;gx:number;gz:number}|null{
  for(let i=1;i<rows.length;i++)for(let k=1;k<rows[i]!.length;k++){
    const a=rows[i-1]![k-1]!,b=rows[i]![k-1]!,c=rows[i]![k]!,d=rows[i-1]![k]!;
    if(x<Math.min(a[0],b[0],c[0],d[0])-1e-6||x>Math.max(a[0],b[0],c[0],d[0])+1e-6||z<Math.min(a[2],b[2],c[2],d[2])-1e-6||z>Math.max(a[2],b[2],c[2],d[2])+1e-6)continue;
    for(const [p,q,r] of [[a,b,c],[a,c,d]]){
      const ux=q![0]-p![0],uz=q![2]-p![2],vx=r![0]-p![0],vz=r![2]-p![2],det=ux*vz-uz*vx;if(Math.abs(det)<1e-10)continue;
      const px=x-p![0],pz=z-p![2],u=(px*vz-pz*vx)/det,v=(ux*pz-uz*px)/det;
      if(u< -1e-6||v< -1e-6||u+v>1+1e-6)continue;
      const dy=q![1]-p![1],ey=r![1]-p![1];return {y:p![1]+dy*u+ey*v,gx:(dy*vz-ey*uz)/det,gz:(ux*ey-vx*dy)/det};
    }
  }
  return null;
}
