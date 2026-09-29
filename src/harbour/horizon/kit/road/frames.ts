/**
 * Corridor frames (ROAD.md §1): the stations of a corridor as a continuous sampler, and a plan index that answers
 * "which station, which lateral offset" for any point near a road. Everything the road kit draws reads these, so the
 * pavement bands, the markings and the guard kits follow the same line the deck and its collision were built from.
 *
 * Conventions follow `land/corridor/types.ts`: `s` is arc length along the station order; `o > 0` is the RIGHT-hand
 * side facing increasing `s`, right(t) = (-t.z, t.x). Pure (no three.js, no scene).
 */
import type {Corridor,CorridorSide,CorridorStation} from '../../land/corridor/types.ts';

export type CorridorFrame={x:number;y:number;z:number;tx:number;tz:number;rx:number;rz:number;s:number;i:number;u:number};
export type CorridorSampler={
  corridor:Corridor;length:number;closed:boolean;
  /** Frame at arc length s (wraps on a closed corridor; clamps otherwise). `i`/`u`: the station interval and its fraction. */
  at(s:number):CorridorFrame;
  /** The world point at (s, o), on the station line's height (no cross-fall); a deck sampler refines y. */
  point(s:number,o:number):[number,number,number];
  /** Nearest station index to s. */
  station(s:number):CorridorStation;
  /** Wrap (closed) or clamp s into [0, length]. */
  wrap(s:number):number;
};

export function corridorSampler(corridor:Corridor):CorridorSampler{
  const S=corridor.stations,n=S.length;
  if(n===0)throw new Error(`corridor ${corridor.id} has no stations`);
  const last=S[n-1]!,closeGap=corridor.closed&&n>1?Math.hypot(S[0]!.at[0]-last.at[0],S[0]!.at[2]-last.at[2]):0;
  const length=last.s+(corridor.closed?closeGap:0),s0=S[0]!.s;
  const wrap=(s:number)=>{if(corridor.closed&&length>0){const L=length-s0;let v=(s-s0)%L;if(v<0)v+=L;return v+s0;}return Math.max(s0,Math.min(last.s,s));};
  const find=(s:number)=>{let lo=0,hi=n-1;if(s>=last.s)return n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(S[m]!.s<=s)lo=m;else hi=m;}return lo;};
  const at=(sIn:number):CorridorFrame=>{
    const s=wrap(sIn),i=find(s),a=S[i]!,wrapIdx=corridor.closed&&i===n-1,b=wrapIdx?S[0]!:S[Math.min(n-1,i+1)]!;
    const span=wrapIdx?closeGap:b.s-a.s,u=span>1e-9?Math.max(0,Math.min(1,(s-a.s)/span)):0;
    let tx=a.tangent[0]+(b.tangent[0]-a.tangent[0])*u,tz=a.tangent[1]+(b.tangent[1]-a.tangent[1])*u;const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
    return {x:a.at[0]+(b.at[0]-a.at[0])*u,y:a.at[1]+(b.at[1]-a.at[1])*u,z:a.at[2]+(b.at[2]-a.at[2])*u,tx,tz,rx:-tz,rz:tx,s,i,u};
  };
  return {corridor,length,closed:corridor.closed,at,wrap,
    point(s,o){const f=at(s);return [f.x+f.rx*o,f.y,f.z+f.rz*o];},
    station(s){const f=at(s);return S[f.u<.5?f.i:(f.i+1)%n]!;}};
}

/** One side of a station by the sign of an offset. */
export const sideOf=(st:CorridorStation,o:number):CorridorSide=>o>=0?st.right:st.left;

type Hit={corridor:Corridor;station:CorridorStation;index:number;s:number;o:number;distance:number};
/**
 * A plan index over every corridor's stations (grid cells of `cell` eu). `locate(x,z)` returns the nearest station,
 * the arc length projected onto its interval and the signed lateral offset — the frame a deck vertex, a kerb or a
 * footway triangle is painted in.
 */
export function corridorIndex(corridors:readonly Corridor[],cell=16){
  const grid=new Map<string,{c:number;k:number}[]>(),key=(i:number,j:number)=>`${i}:${j}`;
  corridors.forEach((c,ci)=>c.stations.forEach((st,k)=>{const i=Math.floor(st.at[0]/cell),j=Math.floor(st.at[2]/cell);let l=grid.get(key(i,j));if(!l)grid.set(key(i,j),l=[]);l.push({c:ci,k});}));
  const samplers=new Map<Corridor,CorridorSampler>();
  const sampler=(c:Corridor)=>{let s=samplers.get(c);if(!s){s=corridorSampler(c);samplers.set(c,s);}return s;};
  function locate(x:number,z:number,only?:ReadonlySet<string>|null,reach=2):Hit|null{
    const i0=Math.floor(x/cell),j0=Math.floor(z/cell);let best:{c:number;k:number;d:number}|null=null;
    // Rings outward; once something is found, one more ring (a nearer station can sit in the next cell).
    for(let r=0,stop=reach;r<=stop;r++){
      for(let i=i0-r;i<=i0+r;i++)for(let j=j0-r;j<=j0+r;j++){
        if(r>0&&Math.abs(i-i0)!==r&&Math.abs(j-j0)!==r)continue;
        for(const e of grid.get(key(i,j))??[]){const c=corridors[e.c]!;if(only&&only.size&&!only.has(c.id))continue;const st=c.stations[e.k]!,d=(st.at[0]-x)**2+(st.at[2]-z)**2;if(!best||d<best.d)best={...e,d};}
      }
      if(best&&stop===reach)stop=Math.min(reach,r+1);
    }
    if(!best)return null;
    const c=corridors[best.c]!,S=c.stations,n=S.length,st=S[best.k]!;
    // Project onto the better of the two intervals that touch the nearest station.
    let s=st.s,o=(x-st.at[0])*-st.tangent[1]+(z-st.at[2])*st.tangent[0];
    const along=(x-st.at[0])*st.tangent[0]+(z-st.at[2])*st.tangent[1];
    const nb=along>=0?(best.k+1<n?best.k+1:c.closed?0:-1):(best.k>0?best.k-1:c.closed?n-1:-1);
    if(nb>=0){const q=S[nb]!,dx=q.at[0]-st.at[0],dz=q.at[2]-st.at[2],L=Math.hypot(dx,dz);
      if(L>1e-6){const u=Math.max(0,Math.min(1,((x-st.at[0])*dx+(z-st.at[2])*dz)/(L*L)));const f=sampler(c);
        const sq=nb===0&&best.k===n-1?f.length:nb===n-1&&best.k===0?st.s-L:q.s;s=st.s+(sq-st.s)*u;
        // Refine: the frame's normal turns along the interval, so step s by the residual along the tangent (converges in 2–3).
        let fr=f.at(s);for(let it=0;it<3;it++){const ds=(x-fr.x)*fr.tx+(z-fr.z)*fr.tz;if(Math.abs(ds)<1e-4)break;s=fr.s+ds;fr=f.at(s);}
        o=(x-fr.x)*fr.rx+(z-fr.z)*fr.rz;s=fr.s;}}
    return {corridor:c,station:st,index:best.k,s,o,distance:Math.sqrt(best.d)};
  }
  return {locate,sampler,corridors};
}
export type CorridorIndex=ReturnType<typeof corridorIndex>;
