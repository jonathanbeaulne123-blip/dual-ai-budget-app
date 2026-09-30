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
 return {...original,points:rows.map(row=>row[2]),landingRows:rows,halfWidth:1.2};
}
