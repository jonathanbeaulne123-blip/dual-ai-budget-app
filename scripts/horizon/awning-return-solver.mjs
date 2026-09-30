/**
 * OFFLINE GENERATION ONLY. Deterministic projection of the authored awning return.
 * The first nine rows preserve the existing entry and rail, including its named 47.7853% outer triangle baseline.
 * Grade acceptance applies to every rebuilt triangle, including its connection to protected row eight.
 * No scene, filesystem, clock, renderer, or browser dependencies.
 * Inputs must come from the same authored plan / authorCurve / initial envelope as course.ts.
 * Road input should include native samples around exit station +/-31m.
 * Ground supplies the higher of native ground and any exposed Horizon portal terrain.
 *
 * @param {{points: readonly (readonly [number,number,number])[], landingRows: readonly (readonly (readonly [number,number,number])[])[], halfWidth:number}} br
 * @param {readonly {s:number, at:readonly [number,number,number]}[]} road
 * @param {(x:number,z:number)=>number} ground
 * @param {number} [lockedRows=9] Number of rows through the original primary roof deck, inclusive.
 * @returns {{points:number[][], rows:number[][][], diagnostics:object}}
 */
export function generateAwningReturn(br,road,ground,lockedRows=9){
 const rows=br.landingRows,points=rows.flat();
function near(p){let best={d:Infinity,y:0};for(let i=1;i<road.length;i++){const a=road[i-1].at,b=road[i].at,dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz)));const d=Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);if(d<best.d)best={d,y:a[1]+t*(b[1]-a[1])};}return best;}
const triangles=[],bounds=[];for(let i=1;i<rows.length;i++)for(let k=1;k<5;k++)for(const t of [[(i-1)*5+k-1,i*5+k-1,i*5+k],[(i-1)*5+k-1,i*5+k,(i-1)*5+k]]){triangles.push(t);for(let u=0;u<=10;u++)for(let v=0;v<=10-u;v++){const w=[1-(u+v)/10,u/10,v/10],p=[0,1,2].map(j=>t.reduce((s,id,k)=>s+points[id][j]*w[k],0));if(i>=lockedRows){const r=near(p);if(r.d>4.8)bounds.push({t,w,y:ground(p[0],p[2])+.025});else bounds.push({t,w,y:r.y-.0242},{t,w:w.map(v=>-v),y:-r.y-.0242});}}}
for(const t of triangles){if(t.every(i=>i<lockedRows*5))continue;const[p,q,r]=t.map(i=>points[i]),ux=q[0]-p[0],uz=q[2]-p[2],vx=r[0]-p[0],vz=r[2]-p[2],det=ux*vz-uz*vx;const add=(x,z)=>{const u=((x-p[0])*vz-(z-p[2])*vx)/det,v=(ux*(z-p[2])-uz*(x-p[0]))/det;if(u< -1e-8||v< -1e-8||u+v>1+1e-8)return;if(near([x,0,z]).d>4.8)bounds.push({t,w:[1-u-v,u,v],y:ground(x,z)+.025});};for(let x=Math.ceil(Math.min(p[0],q[0],r[0]));x<=Math.max(p[0],q[0],r[0]);x++)for(let z=Math.ceil(Math.min(p[2],q[2],r[2]));z<=Math.max(p[2],q[2],r[2]);z++)add(x,z);for(const[a,b]of [[p,q],[q,r],[r,p]])for(const axis of[0,2]){for(let grid=Math.ceil(Math.min(a[axis],b[axis]));grid<Math.max(a[axis],b[axis]);grid++){const t=(grid-a[axis])/(b[axis]-a[axis]);add(a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t);}}}
// Fix the actual road-width crossings, which a regular barycentric lattice can miss.
// These are geometry constraints, not an exemption for the thin edge sliver.
for(const t of triangles){if(t.every(i=>i<lockedRows*5))continue;for(const [ka,kb] of [[0,1],[1,2],[2,0]]){
 const a=points[t[ka]],b=points[t[kb]],insideA=near(a).d<=4.8,insideB=near(b).d<=4.8;if(insideA===insideB)continue;
 let lo=0,hi=1;for(let k=0;k<32;k++){const u=(lo+hi)/2,p=[a[0]+(b[0]-a[0])*u,0,a[2]+(b[2]-a[2])*u];if((near(p).d<=4.8)===insideA)lo=u;else hi=u;}
 const u=(lo+hi)/2,p=[a[0]+(b[0]-a[0])*u,0,a[2]+(b[2]-a[2])*u],r=near(p),w=[0,0,0];w[ka]=1-u;w[kb]=u;
 bounds.push({t,w,y:r.y-.024},{t,w:w.map(v=>-v),y:-r.y-.024});
}}
for(let i=lockedRows;i<br.points.length;i++){const a=br.points[i-1],b=br.points[i],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);for(let k=0;k<=4;k++)for(const side of[-.95,0,.95]){const t=k/4,x=a[0]+dx*t+dz/len*br.halfWidth*side,z=a[2]+dz*t-dx/len*br.halfWidth*side;bounds.push({t:[(i-1)*5+2,i*5+2],w:[1-t,t],y:aGround(x,z)-.285});for(const ids of triangles){const[p,q,r]=ids.map(n=>points[n]),ux=q[0]-p[0],uz=q[2]-p[2],vx=r[0]-p[0],vz=r[2]-p[2],det=ux*vz-uz*vx,px=x-p[0],pz=z-p[2],u=(px*vz-pz*vx)/det,v=(ux*pz-uz*px)/det;if(u< -1e-6||v< -1e-6||u+v>1+1e-6)continue;const tt=[...ids,(i-1)*5+2,i*5+2],ww=[1-u-v,u,v,-(1-t),-t];bounds.push({t:tt,w:ww,y:-.285},{t:tt,w:ww.map(v=>-v),y:-.285});break;}}}
function aGround(x,z){return ground(x,z);}
const d={points,near:points.map(near),triangles,bounds};
const y=d.points.map(p=>p[1]),fixed=y.map((_,i)=>i<lockedRows*5 ||(i>d.points.length/2&&d.near[i].d<=4.8));for(let i=0;i<y.length;i++)if(fixed[i]&&i>=lockedRows*5)y[i]=d.near[i].y;
const tris=d.triangles.map(t=>{const[a,b,c]=t.map(i=>d.points[i]),ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2],det=ux*vz-uz*vx;return {t,gx:[(uz-vz)/det,vz/det,-uz/det],gz:[(vx-ux)/det,-vx/det,ux/det]};});
for(let iter=0;iter<1500;iter++){
 for(const {t,w,y:floor}of d.bounds){const gap=floor-t.reduce((s,i,k)=>s+w[k]*y[i],0);if(gap<=0)continue;const den=t.reduce((s,i,k)=>s+(fixed[i]?0:w[k]*w[k]),0);if(den>1e-8)for(let k=0;k<t.length;k++)if(!fixed[t[k]])y[t[k]]+=gap*w[k]/den;}
 for(let i=0;i<y.length;i++){const c=Math.floor(i/5)*5+2,delta=y[i]-y[c];if(Math.abs(delta)<=.29)continue;const over=delta-Math.sign(delta)*.29,n=Number(!fixed[i])+Number(!fixed[c]);if(!n)continue;if(!fixed[i])y[i]-=over/n;if(!fixed[c])y[c]+=over/n;}
 for(const {t,gx,gz}of tris)for(let pass=0;pass<2;pass++){const x=t.reduce((s,i,k)=>s+gx[k]*y[i],0),z=t.reduce((s,i,k)=>s+gz[k]*y[i],0),n=Math.hypot(x,z);if(n<=.395)break;const dg=t.map((i,k)=>fixed[i]?0:(x*gx[k]+z*gz[k])/n),den=dg.reduce((s,v)=>s+v*v,0);if(den<1e-14)break;for(let k=0;k<3;k++)y[t[k]]-=(n-.395)*dg[k]/den;}
}
const maxGrade=Math.max(...tris.filter(({t})=>t.some(i=>i>=lockedRows*5)).map(({t,gx,gz})=>Math.hypot(t.reduce((s,i,k)=>s+gx[k]*y[i],0),t.reduce((s,i,k)=>s+gz[k]*y[i],0))));
 const maxConstraintDeficit=Math.max(...d.bounds.map(({t,w,y:floor})=>floor-t.reduce((s,i,k)=>s+w[k]*y[i],0)));
 const maxCrossfall=Math.max(...y.map((v,i)=>Math.abs(v-y[Math.floor(i/5)*5+2])));
 if(maxGrade>.4||maxConstraintDeficit>.003||maxCrossfall>.3)throw new Error(`Awning return does not converge: ${JSON.stringify({maxGrade,maxConstraintDeficit,maxCrossfall})}`);
 return {rows:br.landingRows.map((row,i)=>row.map((p,k)=>[p[0],y[i*5+k],p[2]])),points:br.points.map((p,i)=>[p[0],y[i*5+2],p[2]]),diagnostics:{maxGrade,maxConstraintDeficit,maxCrossfall,iterations:1500,vertices:points.length,triangles:triangles.length,constraints:bounds.length}};
}
