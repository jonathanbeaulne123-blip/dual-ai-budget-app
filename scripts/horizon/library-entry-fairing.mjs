/** Offline entry fairing for the shared library deck. The roof starts at row12;
 * only the road mouth and the approach before that roof may change here.
 * @param {readonly (readonly (readonly [number,number,number])[])[]} rows
 * @param {readonly {s:number,at:readonly [number,number,number]}[]} road Native road samples near the entry.
 * @param {(x:number,z:number)=>number} ground Native ground, including the small outer-road mound.
 * @param {number} [grade=.24]
 */
export function fairLibraryEntry(rows,road,ground,grade=.24){
 const roofStartsAt=12;
 if(rows.length<=roofStartsAt)throw new Error('Library entry requires its complete authored roof');
 // The old straight mouth crossed a native road edge buried by 7.5cm of ground.
 // Ease the visible apron 1.8m around that mound, retaining the original join and
 // every protected roof row. The same repaired rows drive art and all floor queries.
 const smooth=t=>(t=Math.max(0,Math.min(1,t)),t*t*(3-2*t));
 rows=rows.map((row,i)=>i>=roofStartsAt?row:row.map(p=>[p[0],p[1],p[2]+1.8*smooth(i/4)*(1-smooth((i-7)/5))]));
 const points=rows.map(row=>row[2]);
 // Keep the authored usable width normal to the shifted centreline. Translating
 // old cross-sections alone narrows the real walking strip on the return curve.
 rows=rows.map((row,i)=>{
  if(i===0||i>=roofStartsAt)return row;
  const a=points[i-1],b=points[i+1],p=points[i],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
  const halfWidth=Math.hypot(row[4][0]-row[0][0],row[4][2]-row[0][2])/2;
  return row.map((old,k)=>[p[0]+dz/length*halfWidth*(k/2-1),old[1],p[2]-dx/length*halfWidth*(k/2-1)]);
 });
 const nearest=p=>{
  let hit={distance:Infinity,y:0};
  for(let i=1;i<road.length;i++){
   const a=road[i-1].at,b=road[i].at,dx=b[0]-a[0],dz=b[2]-a[2];
   const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz)));
   const distance=Math.hypot(p[0]-a[0]-dx*t,p[2]-a[2]-dz*t);
   if(distance<hit.distance)hit={distance,y:a[1]+(b[1]-a[1])*t};
  }
  return hit;
 };
 const arc=[0];
 for(let i=1;i<points.length;i++)arc.push(arc[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]));
 const roadAt=rows.map(row=>row.map(nearest));
 let lastRoadRow=0;
 for(let i=0;i<roofStartsAt;i++)if(roadAt[i].some(p=>p.distance<=4.8))lastRoadRow=i;
 // Conform one extra row so the triangles crossing the actual road edge are flat too.
 lastRoadRow++;
 if(lastRoadRow+4>=roofStartsAt)throw new Error('Library entry would require changing the protected roof');
 const target=roadAt.map(row=>row[2].y);
 const height=points.map((p,i)=>{
  if(i<=lastRoadRow)return target[i];
  let upper=Infinity;
  for(let j=0;j<=lastRoadRow;j++)upper=Math.min(upper,target[j]+grade*(arc[i]-arc[j]));
  return Math.min(p[1],upper);
 });
 const repaired=rows.map((row,i)=>{
  if(i>lastRoadRow+4)return row;
  const blend=1-smooth((arc[i]-arc[lastRoadRow])/(arc[lastRoadRow+4]-arc[lastRoadRow]));
  return row.map((p,k)=>{
   const y=height[i]+blend*(roadAt[i][k].y-target[i]);
   // Vertex clearance is checked densely over the rendered triangles in regression.
   return [p[0],i<=lastRoadRow?Math.max(y,ground(p[0],p[2])+.012):y,p[2]];
  });
 });
 return {rows:repaired,points:repaired.map(row=>row[2]),lastRoadRow,preservedFromRow:roofStartsAt};
}
