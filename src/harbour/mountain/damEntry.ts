import {landingSample,type LandingRows} from './branchLandings.ts';
import {smooth,type Point3} from './math.ts';
type RoadSample={s:number;at:Point3;normal:Point3;halfWidth:number};
/** Dam entry only. The shared deck rows follow the existing road before easing back
 * into the authored ramp. The rail and all later branch structure stay untouched. */
export function repairDamEntry(landing:{points:Point3[];rows:LandingRows},road:readonly RoadSample[]):{points:Point3[];rows:LandingRows}{
  const first=landing.points[0]!,entry=road.reduce((a,b)=>Math.hypot(a.at[0]-first[0],a.at[2]-first[2])<Math.hypot(b.at[0]-first[0],b.at[2]-first[2])?a:b);
  const local=road.filter(s=>Math.abs(s.s-entry.s)<24),roadRows=local.map(s=>[-s.halfWidth,-s.halfWidth+.55,-.45,.45,s.halfWidth-.55,s.halfWidth].map(w=>[s.at[0]+s.normal[0]*w,s.at[1],s.at[2]+s.normal[2]*w] as Point3));
  function roadTop(p:Point3){
    const direct=landingSample(roadRows,p[0],p[2]);if(direct)return direct.y;
    let nearest={d:Infinity,x:0,z:0,hw:0};for(let i=1;i<local.length;i++){
      const a=local[i-1]!,b=local[i]!,dx=b.at[0]-a.at[0],dz=b.at[2]-a.at[2],t=Math.max(0,Math.min(1,((p[0]-a.at[0])*dx+(p[2]-a.at[2])*dz)/(dx*dx+dz*dz||1))),x=a.at[0]+dx*t,z=a.at[2]+dz*t,d=Math.hypot(p[0]-x,p[2]-z);
      if(d<nearest.d)nearest={d,x,z,hw:a.halfWidth+(b.halfWidth-a.halfWidth)*t};
    }
    const f=Math.min(1,(nearest.hw-.1)/(nearest.d||1)),x=nearest.x+(p[0]-nearest.x)*f,z=nearest.z+(p[2]-nearest.z)*f,hit=landingSample(roadRows,x,z);
    if(!hit)throw new Error('Dam entry lost its existing road plane');
    return hit.y+hit.gx*(p[0]-x)+hit.gz*(p[2]-z);
  }
  // A 20mm crown outside the road keeps the eased entry above its unchanged benched ground.
  const rows=landing.rows.map((row,i)=>i>=13?row:row.map((p):Point3=>{const w=1-smooth((i-5)/8);const lift=.02*smooth(i-4)*(1-smooth((i-8)/5));return [p[0],p[1]+w*(roadTop(p)-p[1])+lift,p[2]];}));
  return {points:landing.points.map((p,i):Point3=>i===0||i>=13?p:[p[0],rows[i]![2]![1],p[2]]),rows};
}
