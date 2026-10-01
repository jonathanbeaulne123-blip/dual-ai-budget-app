/** Offline source definition. original is the original hearth-awning branch, before any generated mesh.
 * authorCurve and ground must be the existing native functions, targetEnd the native course sample
 * selected by courseIndexAt(roadTagS('hairpin-2')+2). Runtime consumes only the generated product. */
export function awningReturnInput(original,targetEnd,authorCurve,ground){
 const points=authorCurve([original.points[0],[35,17.9,-96.6],[33,17.1,-93.4],[29,16.1,-92],[24.5,15.6,-90],targetEnd],1,6).points;
 points[0]=original.points[0];points[points.length-1]=targetEnd;
 for(let i=1;i<points.length-1;i++){
  const p=points[i],a=points[i-1],b=points[i+1],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
  points[i]=[p[0],Math.max(p[1],...[-1,0,1].map(side=>ground(p[0]+dz/l*1.5*side,p[2]-dx/l*1.5*side)+.03)),p[2]];
 }
 const strip=(points,taper)=>points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1,w=taper?1.5-.3*Math.max(0,Math.min(1,(i-8)/4)):1.5;return Array.from({length:5},(_,k)=>[p[0]+dz/l*w*(k/2-1),p[1],p[2]-dx/l*w*(k/2-1)]);});
 const originalRows=strip(original.points,false),returnRows=strip(points,true);
 const coarse=[...originalRows.slice(0,9),...returnRows.slice(9)],rows=coarse.slice(0,9);
 // Half-metre return bands resolve the terrain-mask and road-width boundaries without
 // changing the approved plan or the protected first rail.
 for(let i=9;i<coarse.length;i++){
  rows.push(coarse[i].map((p,k)=>p.map((v,j)=>(v+coarse[i-1][k][j])/2)));
  rows.push(coarse[i]);
 }
 // The old whole-strip splice rotates its inner edge backwards in bands 8..10.
 // Fair only return rows 9..17. Row 8 (the rail) and row 18 onward stay exact.
 // Cubic tangents use the actual fixed cross sections, not a mismatching new
 // authorCurve tangent. Resample by arc length before rebuilding the five columns.
 const first=8,last=18,a=rows[first][2],d=rows[last][2];
 const tangent=row=>{const dx=row[4][0]-row[0][0],dz=row[4][2]-row[0][2],n=Math.hypot(dx,dz);return [-dz/n,dx/n];};
 const ta=tangent(rows[first]),td=tangent(rows[last]),handle=.4*Math.hypot(d[0]-a[0],d[2]-a[2]);
 const c=[a[0]+ta[0]*handle,a[1],a[2]+ta[1]*handle],e=[d[0]-td[0]*handle,d[1],d[2]-td[1]*handle];
 const at=t=>{const s=1-t;return a.map((v,k)=>s*s*s*v+3*s*s*t*c[k]+3*s*t*t*e[k]+t*t*t*d[k]);};
 const dense=Array.from({length:201},(_,j)=>at(j/200)),arc=[0];
 for(let j=1;j<dense.length;j++)arc.push(arc[j-1]+Math.hypot(dense[j][0]-dense[j-1][0],dense[j][2]-dense[j-1][2]));
 const endWidth=Math.hypot(rows[last][4][0]-rows[last][0][0],rows[last][4][2]-rows[last][0][2])/2;
 for(let i=first+1;i<last;i++){
  const f=(i-first)/(last-first),distance=arc.at(-1)*f;let j=1;while(arc[j]<distance)j++;
  const t=(j-1+(distance-arc[j-1])/(arc[j]-arc[j-1]))/200,s=1-t,p=at(t);
  const dx=3*s*s*(c[0]-a[0])+6*s*t*(e[0]-c[0])+3*t*t*(d[0]-e[0]);
  const dz=3*s*s*(c[2]-a[2])+6*s*t*(e[2]-c[2])+3*t*t*(d[2]-e[2]);
  const n=Math.hypot(dx,dz),width=1.5+(endWidth-1.5)*f;
  rows[i]=Array.from({length:5},(_,k)=>[p[0]+dz/n*width*(k/2-1),p[1],p[2]-dx/n*width*(k/2-1)]);
 }
 // Fail generation on any reversed/degenerate rebuilt cell; a height solver cannot
 // repair a folded plan. The protected original rail remains outside this gate.
 for(let i=9;i<rows.length;i++)for(let k=1;k<5;k++)for(const [p,q,r] of [[rows[i-1][k-1],rows[i][k-1],rows[i][k]],[rows[i-1][k-1],rows[i][k],rows[i-1][k]]]){
  const area=(q[0]-p[0])*(r[2]-p[2])-(q[2]-p[2])*(r[0]-p[0]);
  if(area>=-1e-8)throw new Error(`Folded awning return cell ${i}/${k}: ${area}`);
 }
 return {...original,points:rows.map(row=>row[2]),landingRows:rows,halfWidth:1.2};
}
