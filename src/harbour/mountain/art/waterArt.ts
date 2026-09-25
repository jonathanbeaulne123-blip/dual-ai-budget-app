/**
 * The river from the dam foot to the sea, carved into its bed, with foam where it drops;
 * the town channel with stone kerbs, culvert headwalls where the lanes cross and two
 * footbridges to the storefronts. Water goes into the card builder's water bucket, which
 * carries a flow uv for the shared sheen (see `waterMaterial`).
 */
import {groundHeightAt} from '../../scene/ground.ts';
import {RIVER,RIVER_HALF_WIDTH,type Point3} from '../definition.ts';
import {TOWN_SQUARE} from '../townSquare.ts';
import {CardBuilder,shade,mix,inkLift,type V3,type RGB} from '../../art/cardScene.ts';
import {hash2} from '../../art/cardKit.ts';
import type {MountainArtPalette} from './palette.ts';

const UP:V3=[0,1,0];
/** The river line, densified to about one unit, with its downstream arc length. */
export function riverSamples(step=1):{p:Point3;s:number;side:V3;drop:number}[]{
  const out:{p:Point3;s:number;side:V3;drop:number}[]=[];let s=0;
  for(let i=1;i<RIVER.length;i++){const a=RIVER[i-1]!,b=RIVER[i]!,l=Math.hypot(b[0]-a[0],b[2]-a[2]),n=Math.max(1,Math.ceil(l/step));
    for(let k=0;k<n;k++){const t=k/n,p:Point3=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];out.push({p,s:s+l*t,side:[0,0,0],drop:(a[1]-b[1])/(l||1)});}s+=l;}
  const last=RIVER[RIVER.length-1]!;out.push({p:last,s,side:[0,0,0],drop:0});
  for(let i=0;i<out.length;i++){const a=out[Math.max(0,i-2)]!.p,b=out[Math.min(out.length-1,i+2)]!.p,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;out[i]!.side=[dz/l,0,-dx/l];}
  return out;
}

export function buildWaterArt(bld:CardBuilder,pal:MountainArtPalette,tier:'full'|'lite'){
  const R=riverSamples(tier==='full'?1:2),hw=RIVER_HALF_WIDTH+.9;
  const white:RGB=[1,1,1];
  for(let i=1;i<R.length;i++){
    const a=R[i-1]!,b=R[i]!;
    // The water surface sits just above its line; its edges tuck under the banks.
    const A=(u:number,r:typeof a):V3=>[r.p[0]+r.side[0]*u*hw,r.p[1]+.03,r.p[2]+r.side[2]*u*hw];
    const foam=(r:typeof a)=>Math.min(1,Math.max(0,(r.drop-.12)*3.2));
    const ca=mix(white,[1.45,1.5,1.48],foam(a)),cb=mix(white,[1.45,1.5,1.48],foam(b));
    for(const [u0,u1] of [[-1,0],[0,1]] as const){
      const v0=(u0+1)/2,v1=(u1+1)/2;
      bld.water(A(u0,a),A(u1,a),A(u1,b),[a.s,v0],[a.s,v1],[b.s,v1],mix(ca,white,Math.abs(u0+u1)*.3));
      bld.water(A(u0,a),A(u1,b),A(u0,b),[a.s,v0],[b.s,v1],[b.s,v0],mix(cb,white,Math.abs(u0+u1)*.3));
    }
    // Foam lips across a drop, and pale stones in the fast water.
    if(foam(b)>.4&&i%2===0&&tier==='full'){for(let k=0;k<3;k++){const u=(hash2(i,k)-.5)*1.4,p=A(u,b);bld.box(p[0],p[2],hash2(k,i)*3,.25+hash2(i,k+4)*.2,.18,p[1]-.3,p[1]+.1,shade(pal.coping,.9),pal.stone,b.p[1]>0?bld.pencil:null);}}
  }
  // Town channel: stone kerbs lining both banks, level with the square.
  const town=R.filter(r=>r.p[2]>-40);
  for(const s of [-1,1]){
    const frames=town.map(r=>{const x=r.p[0]+r.side[0]*s*(RIVER_HALF_WIDTH+.35),z=r.p[2]+r.side[2]*s*(RIVER_HALF_WIDTH+.35);return {p:[x,groundHeightAt(x,z),z] as V3,side:[r.side[0]*s,0,r.side[2]*s] as V3,up:UP};});
    for(const run of splitRuns(frames,f=>TOWN_SQUARE.crossings.every(c=>Math.hypot(f.p[0]-c.at[0],f.p[2]-c.at[1])>c.span*.5+.5)))
      bld.sweep(run,i=>{const f=run[i]!,w=RIVER_HALF_WIDTH*.0;void w;return [[-.3,Math.max(-1.2,-(f.p[1]-.2))],[-.3,.12],[.25,.12],[.25,-.1]];},k=>k===1?pal.coping:k===0?shade(pal.stone,.8):pal.stone,{inkAt:[1,2],foot:[0]});
  }
  // Culvert headwalls where a lane crosses: a stone face on each side with a dark arch.
  for(const c of TOWN_SQUARE.crossings){
    if(c.kind==='bridge')continue;
    let best=town[0]!;for(const r of town)if(Math.hypot(r.p[0]-c.at[0],r.p[2]-c.at[1])<Math.hypot(best.p[0]-c.at[0],best.p[2]-c.at[1]))best=r;
    const tx=-best.side[2],tz=best.side[0];
    if(c.kind==='footbridge'){footbridge(bld,pal,best,tx,tz);continue;}
    for(const e of [-1,1]){
      const cx=best.p[0]+tx*e*2.1,cz=best.p[2]+tz*e*2.1,g=groundHeightAt(cx,cz),yaw=Math.atan2(best.side[0],best.side[2]);
      bld.box(cx,cz,yaw,.22,RIVER_HALF_WIDTH+.7,best.p[1]-.4,Math.max(g+.25,best.p[1]+.9),pal.coping,pal.stone);
      // The arch mouth as a dark card with its ring inked.
      const face=(u:number,v:number):V3=>[cx+best.side[0]*u+tx*e*.24,best.p[1]+v,cz+best.side[2]*u+tz*e*.24];
      for(let k=0;k<8;k++){const a0=k/8*Math.PI,a1=(k+1)/8*Math.PI,r=RIVER_HALF_WIDTH*.8;
        bld.tri(face(0,-.02),face(Math.cos(a0)*r,Math.sin(a0)*.75),face(Math.cos(a1)*r,Math.sin(a1)*.75),[.12,.13,.13]);
        bld.line(inkLift(face(Math.cos(a0)*(r+.08),Math.sin(a0)*.8)),inkLift(face(Math.cos(a1)*(r+.08),Math.sin(a1)*.8)));}
    }
  }
}
function splitRuns<T>(list:readonly T[],keep:(t:T)=>boolean):T[][]{const out:T[][]=[];let cur:T[]=[];for(const t of list){if(keep(t))cur.push(t);else if(cur.length){out.push(cur);cur=[];}}if(cur.length)out.push(cur);return out.filter(r=>r.length>1);}

/** A small timber footbridge over the town channel. */
function footbridge(bld:CardBuilder,pal:MountainArtPalette,r:{p:Point3;side:V3},tx:number,tz:number){
  const len=RIVER_HALF_WIDTH*2+1.6,y=Math.max(groundHeightAt(r.p[0]+r.side[0]*len/2,r.p[2]+r.side[2]*len/2),groundHeightAt(r.p[0]-r.side[0]*len/2,r.p[2]-r.side[2]*len/2))+.18;
  const yaw=Math.atan2(r.side[0],r.side[2]);
  bld.box(r.p[0],r.p[2],yaw,.9,len/2,y-.22,y,pal.plank,pal.timber);
  for(let k=-4;k<=4;k++){const px=r.p[0]+r.side[0]*k*len/9,pz=r.p[2]+r.side[2]*k*len/9;bld.line(inkLift([px-tx*.9,y,pz-tz*.9]),inkLift([px+tx*.9,y,pz+tz*.9]),bld.pencil);}
  for(const e of [-1,1]){const a:V3=[r.p[0]+tx*e*.85-r.side[0]*len/2,y,r.p[2]+tz*e*.85-r.side[2]*len/2],b:V3=[r.p[0]+tx*e*.85+r.side[0]*len/2,y,r.p[2]+tz*e*.85+r.side[2]*len/2];
    for(const p of [a,b])bld.box(p[0],p[2],yaw,.07,.07,y-.1,y+.95,pal.timberLight,pal.timber);bld.beam([a[0],y+.9,a[2]],[b[0],y+.9,b[2]],.1,.1,pal.timberLight);}
}
