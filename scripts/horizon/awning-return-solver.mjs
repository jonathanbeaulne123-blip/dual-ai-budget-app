/**
 * OFFLINE GENERATION ONLY. Deterministic projection of the authored awning return.
 * The first nine input rows are fixed: the D-MR19 entry and original first rail,
 * including the rail's named 47.7853% outer triangle baseline.
 * Grade acceptance applies to every rebuilt triangle, including its connection to protected row eight.
 * No scene, filesystem, clock, renderer, or browser dependencies.
 * Inputs must come from the same authored plan / authorCurve / initial envelope as course.ts.
 * Road callback supplies exact drawn triangle membership and height. The native
 * coarse projection remains diagnostic only. Null means outside the drawn road.
 * Ground supplies the higher of native ground and any exposed Horizon portal terrain.
 *
 * @param {{points: readonly (readonly [number,number,number])[], landingRows: readonly (readonly (readonly [number,number,number])[])[], halfWidth:number}} br
 * @param {(x:number,z:number)=>({y:number,drawnY:number,nativeY:number|null}|null)} roadFloor
 * @param {(x:number,z:number)=>number} ground
 * @param {number} [lockedRows=9] Number of rows through the original primary roof deck, inclusive.
 * @returns {{points:number[][], rows:number[][][], diagnostics:object}}
 */
export function generateAwningReturn(br,roadFloor,ground,lockedRows=9){
 const rows=br.landingRows,points=rows.flat();
// A swept road is not the fixed-width capsule around its nearest centreline.
// Keep membership and every target height on the actual source-owned surfaces.
const roadAt=p=>roadFloor(p[0],p[2]);
const addRoadBounds=(t,w,r)=>{
 // The support-equality regression is 1cm. With the unchanged 3mm convergence
 // allowance, this stronger lower bound leaves at most 7mm of a higher road exposed.
 // Keep the existing 3cm visible-road lip ceiling against the actual drawn road; native projection differences are diagnostic.
 bounds.push({t,w,y:r.y-.004},{t,w:w.map(v=>-v),y:-r.drawnY-.024});
};
const triangles=[],bounds=[];for(let i=1;i<rows.length;i++)for(let k=1;k<5;k++)for(const t of [[(i-1)*5+k-1,i*5+k-1,i*5+k],[(i-1)*5+k-1,i*5+k,(i-1)*5+k]]){triangles.push(t);for(let u=0;u<=10;u++)for(let v=0;v<=10-u;v++){const w=[1-(u+v)/10,u/10,v/10],p=[0,1,2].map(j=>t.reduce((s,id,k)=>s+points[id][j]*w[k],0));if(i>=lockedRows){const r=roadAt(p);if(!r)bounds.push({t,w,y:ground(p[0],p[2])+.025});else addRoadBounds(t,w,r);}}}
for(const t of triangles){if(t.every(i=>i<lockedRows*5))continue;const[p,q,r]=t.map(i=>points[i]),ux=q[0]-p[0],uz=q[2]-p[2],vx=r[0]-p[0],vz=r[2]-p[2],det=ux*vz-uz*vx;const add=(x,z)=>{const u=((x-p[0])*vz-(z-p[2])*vx)/det,v=(ux*(z-p[2])-uz*(x-p[0]))/det;if(u< -1e-8||v< -1e-8||u+v>1+1e-8)return;if(!roadAt([x,0,z]))bounds.push({t,w:[1-u-v,u,v],y:ground(x,z)+.025});};for(let x=Math.ceil(Math.min(p[0],q[0],r[0]));x<=Math.max(p[0],q[0],r[0]);x++)for(let z=Math.ceil(Math.min(p[2],q[2],r[2]));z<=Math.max(p[2],q[2],r[2]);z++)add(x,z);for(const[a,b]of [[p,q],[q,r],[r,p]])for(const axis of[0,2]){for(let grid=Math.ceil(Math.min(a[axis],b[axis]));grid<Math.max(a[axis],b[axis]);grid++){const t=(grid-a[axis])/(b[axis]-a[axis]);add(a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t);}}}
// Find swept-footprint boundary transitions along each landing edge.
// Subdivision also finds entry+exit when both edge endpoints are outside the road.
for(const t of triangles){if(t.every(i=>i<lockedRows*5))continue;for(const [ka,kb] of [[0,1],[1,2],[2,0]]){
 const a=points[t[ka]],b=points[t[kb]],at=u=>[a[0]+(b[0]-a[0])*u,0,a[2]+(b[2]-a[2])*u];
 for(let part=0;part<16;part++){
  let lo=part/16,hi=(part+1)/16;const insideLo=!!roadAt(at(lo));if(insideLo===!!roadAt(at(hi)))continue;
  for(let k=0;k<32;k++){const u=(lo+hi)/2;if(!!roadAt(at(u))===insideLo)lo=u;else hi=u;}
  // Take the inside limit: an exact edge can round a few ulps outside a triangle.
  const u=insideLo?lo:hi,r=roadAt(at(u));if(!r)throw new Error('Missing awning road-boundary support');
  const w=[0,0,0];w[ka]=1-u;w[kb]=u;addRoadBounds(t,w,r);
 }
}}
for(let i=lockedRows;i<br.points.length;i++){const a=br.points[i-1],b=br.points[i],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);for(let k=0;k<=4;k++)for(const side of[-.95,0,.95]){const t=k/4,x=a[0]+dx*t+dz/len*br.halfWidth*side,z=a[2]+dz*t-dx/len*br.halfWidth*side;bounds.push({t:[(i-1)*5+2,i*5+2],w:[1-t,t],y:aGround(x,z)-.285});for(const ids of triangles){const[p,q,r]=ids.map(n=>points[n]),ux=q[0]-p[0],uz=q[2]-p[2],vx=r[0]-p[0],vz=r[2]-p[2],det=ux*vz-uz*vx,px=x-p[0],pz=z-p[2],u=(px*vz-pz*vx)/det,v=(ux*pz-uz*px)/det;if(u< -1e-6||v< -1e-6||u+v>1+1e-6)continue;const tt=[...ids,(i-1)*5+2,i*5+2],ww=[1-u-v,u,v,-(1-t),-t];bounds.push({t:tt,w:ww,y:-.285},{t:tt,w:ww.map(v=>-v),y:-.285});break;}}}
function aGround(x,z){return ground(x,z);}
// A bounded downhill crest on the rebuilt return keeps ordinary riding contact through
// its turn. The supplied rows 0..8 remain exact. A grade drop of <=0.08 per metre
// is below g/v^2 = 14/12^2 at the original 12m/s regression speed; unlike the
// overall 40% grade cap this prevents an abrupt convex lip from launching the rider.
// The five actual longitudinal mesh columns constrain the visible floor, not only
// a centreline that could conceal a steep outer ribbon. No physics value changes.
const crestCurvature=.08;
const fixedRoadCrests=[];
for(let i=lockedRows;i<rows.length-1;i++)for(let k=0;k<5;k++){
 const ids=[(i-1)*5+k,i*5+k,(i+1)*5+k],a=points[ids[0]],b=points[ids[1]],c=points[ids[2]];
 const before=Math.hypot(b[0]-a[0],b[2]-a[2]),after=Math.hypot(c[0]-b[0],c[2]-b[2]);
 if(before<1e-6||after<1e-6)continue;
 // Once all three vertices coincide with the existing road, its fixed surface
 // owns this profile. Constrain every transition with an adjustable return vertex;
 // retain a numeric record of the unmodified road instead of asking an offline
 // landing solve to alter the through-road's heights.
 if(ids.every(id=>id>points.length/2&&roadAt(points[id])!==null)){
  const heights=ids.map(id=>roadAt(points[id]).y);
  fixedRoadCrests.push({row:i,column:k,gradeDropPerMetre:((heights[1]-heights[0])/before-(heights[2]-heights[1])/after)/((before+after)/2)});
  continue;
 }
 bounds.push({t:ids,w:[1/before,-1/before-1/after,1/after],y:-crestCurvature*(before+after)/2});
}
const d={points,road:points.map(roadAt),triangles,bounds};
const y=d.points.map(p=>p[1]),fixed=y.map((_,i)=>i<lockedRows*5 ||(i>d.points.length/2&&d.road[i]!==null));for(let i=0;i<y.length;i++)if(fixed[i]&&i>=lockedRows*5)y[i]=d.road[i].y;
// The final centre is the exact authored course point. Barycentric interpolation
// at that same point may round by one ulp; preserve the original endpoint bits.
y[y.length-3]=br.points.at(-1)[1];fixed[y.length-3]=true;
const tris=d.triangles.map(t=>{const[a,b,c]=t.map(i=>d.points[i]),ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2],det=ux*vz-uz*vx;return {t,gx:[(uz-vz)/det,vz/det,-uz/det],gz:[(vx-ux)/det,-vx/det,ux/det]};});
// Offline only: crest and terrain projections need more passes than the original
// grade-only solve. Keep all geometric tolerances fixed.
const iterations=6000;
for(let iter=0;iter<iterations;iter++){
 for(const {t,w,y:floor}of d.bounds){const gap=floor-t.reduce((s,i,k)=>s+w[k]*y[i],0);if(gap<=0)continue;const den=t.reduce((s,i,k)=>s+(fixed[i]?0:w[k]*w[k]),0);if(den>1e-8)for(let k=0;k<t.length;k++)if(!fixed[t[k]])y[t[k]]+=gap*w[k]/den;}
 for(let i=0;i<y.length;i++){const c=Math.floor(i/5)*5+2,delta=y[i]-y[c];if(Math.abs(delta)<=.29)continue;const over=delta-Math.sign(delta)*.29,n=Number(!fixed[i])+Number(!fixed[c]);if(!n)continue;if(!fixed[i])y[i]-=over/n;if(!fixed[c])y[c]+=over/n;}
 for(const {t,gx,gz}of tris)for(let pass=0;pass<2;pass++){const x=t.reduce((s,i,k)=>s+gx[k]*y[i],0),z=t.reduce((s,i,k)=>s+gz[k]*y[i],0),n=Math.hypot(x,z);if(n<=.395)break;const dg=t.map((i,k)=>fixed[i]?0:(x*gx[k]+z*gz[k])/n),den=dg.reduce((s,v)=>s+v*v,0);if(den<1e-14)break;for(let k=0;k<3;k++)y[t[k]]-=(n-.395)*dg[k]/den;}
}
const maxGrade=Math.max(...tris.filter(({t})=>t.some(i=>i>=lockedRows*5)).map(({t,gx,gz})=>Math.hypot(t.reduce((s,i,k)=>s+gx[k]*y[i],0),t.reduce((s,i,k)=>s+gz[k]*y[i],0))));
 const maxConstraintDeficit=Math.max(...d.bounds.map(({t,w,y:floor})=>floor-t.reduce((s,i,k)=>s+w[k]*y[i],0)));
 const roadFieldDifferenceAtVertices=Math.max(0,...d.road.filter(r=>r&&r.nativeY!==null).map(r=>Math.abs(r.nativeY-r.drawnY)));
 const maxCrossfall=Math.max(...y.map((v,i)=>Math.abs(v-y[Math.floor(i/5)*5+2])));
 if(maxGrade>.4||maxConstraintDeficit>.003||maxCrossfall>.3){
  const worst=bounds.map(({t,w,y:floor})=>({t,w,floor,deficit:floor-t.reduce((s,i,k)=>s+w[k]*y[i],0),vertices:t.map(i=>[points[i][0],y[i],points[i][2]])})).sort((a,b)=>b.deficit-a.deficit).slice(0,5);
  throw new Error(`Awning return does not converge: ${JSON.stringify({maxGrade,maxConstraintDeficit,maxCrossfall,worst})}`);
 }
 return {rows:br.landingRows.map((row,i)=>row.map((p,k)=>[p[0],y[i*5+k],p[2]])),points:br.points.map((p,i)=>[p[0],y[i*5+2],p[2]]),diagnostics:{maxGrade,maxConstraintDeficit,maxCrossfall,iterations,vertices:points.length,triangles:triangles.length,constraints:bounds.length,fixedRoadCrests,roadFieldDifferenceAtVertices}};
}
