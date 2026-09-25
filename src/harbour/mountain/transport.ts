/**
 * Transport on authored splines. Both lines are arc-length parameterised with orientation
 * frames and ride at a constant cruise speed.
 *  - Funicular: a monotonic incline (the track never descends), two rails, platforms aligned
 *    to the track, trestles where the ground falls away and clearance over every road.
 *  - Gondola: catenary spans between towers from the waterfront to the summit, crossing the
 *    gorge high in front of the dam.
 */
import {baseHeight} from './terrainBase.ts';
import {islandHeight} from './islandShape.ts';
import {arcLengths,mix,type Point3} from './math.ts';

export type TransportKind='funicular'|'gondola';
export type TransportFrame={s:number;at:Point3;tangent:Point3;up:Point3;side:Point3};
export type TransportPlatform={at:Point3;yaw:number;half:readonly[number,number]};
export type TransportStation={id:string;name:string;s:number;at:Point3;platform:TransportPlatform};
export type TransportLine={kind:TransportKind;length:number;cruise:number;stations:readonly TransportStation[];
  at(s:number):TransportFrame;frames(step?:number):TransportFrame[];towers:readonly Point3[];path:readonly Point3[];rails?:readonly [readonly Point3[],readonly Point3[]]};

const ground=(x:number,z:number)=>z>-48?islandHeight(x,z):Math.max(islandHeight(x,z),baseHeight(x,z));

/** Monotone cubic (Fritsch–Carlson) through (t, y) knots. */
function pchip(ts:readonly number[],ys:readonly number[]){
  const n=ts.length,d:number[]=[],m:number[]=new Array(n).fill(0);
  for(let i=0;i<n-1;i++)d.push((ys[i+1]!-ys[i]!)/((ts[i+1]!-ts[i]!)||1));
  m[0]=d[0]!;m[n-1]=d[n-2]!;
  for(let i=1;i<n-1;i++)m[i]=d[i-1]!*d[i]!<=0?0:3*(d[i-1]!+d[i]!)/((2*d[i]!+d[i-1]!)/d[i-1]!+(d[i]!+2*d[i-1]!)/d[i]!);
  return (t:number)=>{
    if(t<=ts[0]!)return ys[0]!;if(t>=ts[n-1]!)return ys[n-1]!;
    let i=0;while(i<n-2&&ts[i+1]!<t)i++;
    const h=ts[i+1]!-ts[i]!,u=(t-ts[i]!)/h,u2=u*u,u3=u2*u;
    return (2*u3-3*u2+1)*ys[i]!+(u3-2*u2+u)*h*m[i]!+(-2*u3+3*u2)*ys[i+1]!+(u3-u2)*h*m[i+1]!;
  };
}
/** Smooth plan curve through control points (centripetal Catmull–Rom), densely sampled. */
function planCurve(ctrl:readonly (readonly[number,number])[],perUnit=2):[number,number][]{
  const out:[number,number][]=[],P=(i:number)=>ctrl[Math.max(0,Math.min(ctrl.length-1,i))]!;
  for(let i=0;i<ctrl.length-1;i++){
    const p0=P(i-1),p1=P(i),p2=P(i+1),p3=P(i+2),k=(a:readonly[number,number],b:readonly[number,number])=>Math.max(1e-4,Math.sqrt(Math.hypot(b[0]-a[0],b[1]-a[1])));
    const t0=0,t1=k(p0,p1)+(i===0?1e-3:0),t2=t1+k(p1,p2),t3=t2+k(p2,p3)+(i===ctrl.length-2?1e-3:0),n=Math.max(4,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])*perUnit));
    for(let q=0;q<n;q++){const t=t1+(t2-t1)*q/n,L=(a:number,b:number,ta:number,tb:number)=>ta===tb?a:(tb-t)/(tb-ta)*a+(t-ta)/(tb-ta)*b;
      const c=(j:0|1)=>{const A1=L(p0[j],p1[j],t0,t1),A2=L(p1[j],p2[j],t1,t2),A3=L(p2[j],p3[j],t2,t3),B1=(t2-t)/(t2-t0)*A1+(t-t0)/(t2-t0)*A2,B2=(t3-t)/(t3-t1)*A2+(t-t1)/(t3-t1)*A3;return (t2-t)/(t2-t1)*B1+(t-t1)/(t2-t1)*B2;};
      out.push([c(0),c(1)]);}
  }
  out.push([ctrl[ctrl.length-1]![0],ctrl[ctrl.length-1]![1]]);return out;
}
function makeLine(kind:TransportKind,path:readonly Point3[],cruise:number,stations:{id:string;name:string;index:number;side:1|-1}[],towers:readonly Point3[],rails:boolean,hang:number):TransportLine{
  const S=arcLengths(path),length=S[S.length-1]!;
  const frameAt=(s:number):TransportFrame=>{
    const c=Math.max(0,Math.min(length,s));let lo=0,hi=S.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(S[m]!<=c)lo=m;else hi=m;}
    const a=path[lo]!,b=path[hi]!,t=(c-S[lo]!)/((S[hi]!-S[lo]!)||1),at:Point3=[mix(a[0],b[0],t),mix(a[1],b[1],t)-hang,mix(a[2],b[2],t)];
    const i0=Math.max(0,lo-1),i1=Math.min(path.length-1,hi+1),p=path[i0]!,q=path[i1]!,dx=q[0]-p[0],dy=q[1]-p[1],dz=q[2]-p[2],l=Math.hypot(dx,dy,dz)||1;
    const tangent:Point3=[dx/l,dy/l,dz/l],dot=tangent[1],ux=-tangent[0]*dot,uy=1-tangent[1]*dot,uz=-tangent[2]*dot,ul=Math.hypot(ux,uy,uz)||1,up:Point3=[ux/ul,uy/ul,uz/ul];
    const side:Point3=[tangent[1]*up[2]-tangent[2]*up[1],tangent[2]*up[0]-tangent[0]*up[2],tangent[0]*up[1]-tangent[1]*up[0]];
    return {s:c,at,tangent,up,side};
  };
  const built:TransportStation[]=stations.map(st=>{
    const s=S[st.index]!,f=frameAt(s),yaw=Math.atan2(f.tangent[0],f.tangent[2]),offset=kind==='funicular'?2.6:2.4;
    const hx=f.tangent[2],hz=-f.tangent[0],hl=Math.hypot(hx,hz)||1,px=f.at[0]+hx/hl*offset*st.side,pz=f.at[2]+hz/hl*offset*st.side,py=f.at[1];
    return {id:st.id,name:st.name,s,at:[f.at[0],f.at[1],f.at[2]] as Point3,platform:{at:[px,py,pz] as Point3,yaw,half:[3.2,1.6] as const}};
  });
  const railPts=(side:number)=>path.filter((_,i)=>i%2===0).map(p=>{const f=frameAt(S[path.indexOf(p)]!);return [f.at[0]+f.side[0]*.8*side,f.at[1]+f.side[1]*.8*side,f.at[2]+f.side[2]*.8*side] as Point3;});
  return {kind,length,cruise,stations:built,towers,path,at:frameAt,frames(step=1){const out:TransportFrame[]=[];for(let s=0;s<length;s+=step)out.push(frameAt(s));out.push(frameAt(length));return out;},...(rails?{rails:[railPts(-1),railPts(1)] as const}:{})};
}

/** Funicular: town, the lower neighbourhood, Library Woods and Reservoir Heights. */
const FUNICULAR_CONTROL:readonly {at:readonly[number,number];y:number;station?:{id:string;name:string;side:1|-1}}[]=[
  // Town station west of the north lane (clear of the Northlight run and the lane's end), up past
  // Northlight, over the harbour bridge and the river, to the lower-neighbourhood station.
  {at:[-19.5,-36],y:islandHeight(-19.5,-36)+.3,station:{id:'town',name:'Town square',side:-1}},
  {at:[-19,-45],y:3},{at:[-17.8,-54],y:5.8},{at:[-14.5,-62.5],y:8.8},{at:[-10.5,-70],y:11.6},{at:[-7.5,-78],y:13.6},{at:[-4.5,-84],y:14.6},{at:[0,-87.5],y:15.2},
  {at:[5,-89],y:15.6,station:{id:'hearth',name:'Lower neighbourhood',side:-1}},
  {at:[9.5,-94],y:19.6},{at:[11.2,-100],y:24.2},{at:[12.2,-106],y:26.6},{at:[13.2,-116],y:29.2},{at:[15.6,-134],y:33.6},{at:[18.4,-148],y:37.6},
  {at:[20,-156],y:39.6,station:{id:'library',name:'Library Woods',side:1}},
  {at:[22,-168],y:45.5},{at:[25,-186],y:60},{at:[29,-206],y:80.6},{at:[34,-218],y:86},
  {at:[39,-226],y:87.6,station:{id:'reservoir',name:'Reservoir Heights',side:1}},
];
function funicular():TransportLine{
  const plan=planCurve(FUNICULAR_CONTROL.map(c=>c.at),4),ps=[0];for(let i=1;i<plan.length;i++)ps.push(ps[i-1]!+Math.hypot(plan[i]![0]-plan[i-1]![0],plan[i]![1]-plan[i-1]![1]));
  // Control arc positions on the plan curve (nearest dense sample to each control point).
  const cs=FUNICULAR_CONTROL.map(c=>{let best=0,d=Infinity;plan.forEach((p,i)=>{const e=Math.hypot(p[0]-c.at[0],p[1]-c.at[1]);if(e<d){d=e;best=i;}});return ps[best]!;});
  const y=pchip(cs,FUNICULAR_CONTROL.map(c=>c.y));
  const path=plan.map((p,i)=>[p[0],y(ps[i]!),p[1]] as Point3);
  const stations=FUNICULAR_CONTROL.flatMap((c,k)=>c.station?[{...c.station,index:plan.findIndex((_,i)=>ps[i]!>=cs[k]!-1e-6)}]:[]);
  return makeLine('funicular',path,5,stations,[],true,0);
}
/** Cabins hang this far below the cable; at a station the cabin floor meets the platform. */
const GONDOLA_HANG=3.1,SUMMIT_STATION_Y=104.05;
/** Gondola: tower tops and stations; each span sags as a catenary (parabolic approximation). */
const GONDOLA_SUPPORTS:readonly {at:readonly[number,number];top:number;station?:{id:string;name:string}}[]=[
  {at:[-26,46],top:islandHeight(-26,46)+.05+GONDOLA_HANG,station:{id:'quay',name:'Waterfront'}},
  {at:[-58,-54],top:46},
  {at:[-80,-150],top:74},
  {at:[62,-214],top:104},
  {at:[-8,-284],top:SUMMIT_STATION_Y+GONDOLA_HANG,station:{id:'summit',name:'Summit Commons'}},
];
function gondola():TransportLine{
  const path:Point3[]=[],supportIndex:number[]=[];
  for(let k=0;k<GONDOLA_SUPPORTS.length-1;k++){
    const a=GONDOLA_SUPPORTS[k]!,b=GONDOLA_SUPPORTS[k+1]!,span=Math.hypot(b.at[0]-a.at[0],b.at[1]-a.at[1]),sag=span*.032,n=Math.ceil(span);
    supportIndex.push(path.length);
    for(let q=0;q<n;q++){const t=q/n;path.push([mix(a.at[0],b.at[0],t),mix(a.top,b.top,t)-sag*4*t*(1-t),mix(a.at[1],b.at[1],t)]);}
  }
  const last=GONDOLA_SUPPORTS[GONDOLA_SUPPORTS.length-1]!;supportIndex.push(path.length);path.push([last.at[0],last.top,last.at[1]]);
  const towers=GONDOLA_SUPPORTS.slice(1,-1).map(t=>[t.at[0],ground(t.at[0],t.at[1]),t.at[1]] as Point3);
  const stations=GONDOLA_SUPPORTS.flatMap((t,k)=>t.station?[{...t.station,index:supportIndex[k]!,side:1 as const}]:[]);
  return makeLine('gondola',path,8,stations,towers,false,GONDOLA_HANG);
}
export const FUNICULAR_LINE=funicular();
export const GONDOLA_LINE=gondola();
export const TRANSPORT_LINES:Record<TransportKind,TransportLine>={funicular:FUNICULAR_LINE,gondola:GONDOLA_LINE};
export const transportSpline=(kind:TransportKind)=>TRANSPORT_LINES[kind];
/** Where a rider steps on and off: the boarding point on each platform. */
export const FUNICULAR_STOPS=FUNICULAR_LINE.stations.map(s=>({id:s.id,name:s.name,at:s.platform.at}));
export const GONDOLA_STOPS=GONDOLA_LINE.stations.map(s=>({id:s.id,name:s.name,at:s.platform.at}));
export const TRANSPORT_STOPS={funicular:FUNICULAR_STOPS,gondola:GONDOLA_STOPS};
/**
 * @deprecated Use `transportSpline(kind).at(s)` with a constant cruise speed.
 * Kept for one release: eases along the line's arc length between two stations (no longer
 * equal time per segment), stepping from the platform into the cabin and out again.
 */
export function transportPoint(kind:TransportKind,from:number,to:number,t:number):Point3{
  const line=TRANSPORT_LINES[kind],a=line.stations[from]!,b=line.stations[to]!,u=Math.max(0,Math.min(1,t)),e=u*u*(3-2*u);
  if(u<=0)return a.platform.at;if(u>=1)return b.platform.at;
  const on=line.at(mix(a.s,b.s,e)).at,board=Math.min(1,u/.05),alight=Math.min(1,(1-u)/.05);
  const m=(p:Point3,w:number):Point3=>[mix(p[0],on[0],w),mix(p[1],on[1],w),mix(p[2],on[2],w)];
  return board<1?m(a.platform.at,board):alight<1?m(b.platform.at,alight):on;
}
