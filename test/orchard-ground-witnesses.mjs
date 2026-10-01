// Independent witness construction: vertices contained in the other triangle +
// pairwise edge intersections. Does not call the production clipping algorithm.
export function checkGround(positions,indices,roadPoints,roadIndices){
 const epsilon=1e-8;
 const bary=(p,t)=>{const [a,b,c]=t,ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2],de=ux*vz-uz*vx,u=((p[0]-a[0])*vz-(p[2]-a[2])*vx)/de,v=(ux*(p[2]-a[2])-uz*(p[0]-a[0]))/de;return {u,v,inside:u>=-epsilon&&v>=-epsilon&&u+v<=1+epsilon,y:a[1]+u*(b[1]-a[1])+v*(c[1]-a[1])};};
 const crossing=(a,b,c,d)=>{const ux=b[0]-a[0],uz=b[2]-a[2],vx=d[0]-c[0],vz=d[2]-c[2],de=ux*vz-uz*vx;if(Math.abs(de)<1e-12)return null;const dx=c[0]-a[0],dz=c[2]-a[2],u=(dx*vz-dz*vx)/de,v=(dx*uz-dz*ux)/de;return u>=-epsilon&&u<=1+epsilon&&v>=-epsilon&&v<=1+epsilon?[a[0]+ux*u,0,a[2]+uz*u]:null;};
 const grid=new Map(),size=3,ground=[];
 for(let i=0;i<indices.length;i+=3){const t=[0,1,2].map(k=>{const j=indices[i+k];return [positions[3*j],positions[3*j+1],positions[3*j+2]];}),n=ground.length;ground.push(t);for(let x=Math.floor(Math.min(...t.map(p=>p[0]))/size);x<=Math.floor(Math.max(...t.map(p=>p[0]))/size);x++)for(let z=Math.floor(Math.min(...t.map(p=>p[2]))/size);z<=Math.floor(Math.max(...t.map(p=>p[2]))/size);z++){const key=`${x}:${z}`,list=grid.get(key)??[];list.push(n);grid.set(key,list);}}
 let worst={value:-Infinity},witnesses=0,pairs=0;
 for(let ri=0;ri<roadIndices.length;ri++){
  const r=roadIndices[ri].map(i=>roadPoints[i]),near=new Set();for(let x=Math.floor(Math.min(...r.map(p=>p[0]))/size);x<=Math.floor(Math.max(...r.map(p=>p[0]))/size);x++)for(let z=Math.floor(Math.min(...r.map(p=>p[2]))/size);z<=Math.floor(Math.max(...r.map(p=>p[2]))/size);z++)for(const g of grid.get(`${x}:${z}`)??[])near.add(g);
  for(const gi of near){const g=ground[gi],candidates=[];for(const p of r)if(bary(p,g).inside)candidates.push(p);for(const p of g)if(bary(p,r).inside)candidates.push(p);for(let a=0;a<3;a++)for(let b=0;b<3;b++){const p=crossing(r[a],r[(a+1)%3],g[b],g[(b+1)%3]);if(p)candidates.push(p);}if(!candidates.length)continue;pairs++;
   for(const p of candidates){witnesses++;const gy=bary(p,g).y,ry=bary(p,r).y,value=gy-ry;if(value>worst.value)worst={value,at:[p[0],gy,p[2]],roadY:ry,roadTriangle:ri,groundTriangle:gi};}
  }
 }
 return {pairs,witnesses,worst,pass:worst.value<=-.07998};
}
