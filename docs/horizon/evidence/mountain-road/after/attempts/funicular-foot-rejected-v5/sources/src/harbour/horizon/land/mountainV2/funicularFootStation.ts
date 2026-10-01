/** Exact top of the unchanged native town station plank picture. This is only
 * used by the explicitly owned Horizon path repair; native defaults retain the
 * existing station/query/art. The 5cm visible plank fringe needs real support. */
import V2 from './v2-data.json';
import type {XYZ} from '../interfaces.ts';
export function funicularFootStationTop():[XYZ,XYZ,XYZ][]{
 const st=V2.nativePlanning.surfaces.find(s=>s.id==='station:funicular:town');if(!st)throw new Error('Missing native town station');
 const a=st.points[0]!,b=st.points[st.points.length-1]!,dx=b[0]!-a[0]!,dz=b[2]!-a[2]!,length=Math.hypot(dx,dz),tx=dx/length,tz=dz/length,nx=tz,nz=-tx,half=st.halfWidth+.05;
 const A:XYZ=[a[0]!-tx*.05,a[1]!,a[2]!-tz*.05],B:XYZ=[b[0]!+tx*.05,b[1]!,b[2]!+tz*.05];
 const side=(p:XYZ,n:number):XYZ=>[p[0]+nx*half*n,p[1],p[2]+nz*half*n],q=[side(A,-1),side(B,-1),side(B,1),side(A,1)];
 return[[q[0]!,q[1]!,q[2]!],[q[0]!,q[2]!,q[3]!]];
}
