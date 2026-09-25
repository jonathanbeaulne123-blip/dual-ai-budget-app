/**
 * The mountain's natural landform, before any road, path or foundation is cut into it.
 * A sum of authored shape primitives: one asymmetric massif, two arms (ridges) that
 * embrace a central gorge, spurs and hollows, alternating plateaus, the carved gorge,
 * the reservoir hollow and a little deterministic surface variety.
 *
 * Evaluated once per grid node when `terrain.ts` bakes the heightfield; never per frame.
 */
import {GORGE_POINTS,RESERVOIR_BOWL,RIVER_BED_DEPTH,type Terrace} from './places.ts';
import {clamp,smooth,mix} from './math.ts';

/** Crest line points: [x, z, crest height, crest rounding radius]. */
type Spine=readonly (readonly [x:number,z:number,h:number,w:number])[];

/** Crest lines. Heights are crest heights; widths are the half-width of the shoulder. */
export const RIDGES:readonly {id:string;spine:Spine;slope?:number}[]=[
  {id:'crown',spine:[[-8,-304,110,6],[-4,-300,110,6]]},
  {id:'east-arm',slope:.78,spine:[[4,-302,106,30],[40,-292,100,30],[74,-276,96,28],[96,-248,86,30],[108,-210,64,30],[112,-170,42,30],[110,-130,28,30],[100,-94,14,26],[88,-64,3,22]]},
  {id:'west-arm',slope:.78,spine:[[4,-302,106,30],[-38,-290,102,30],[-70,-264,90,32],[-96,-236,74,32],[-114,-198,58,32],[-116,-160,44,32],[-106,-126,34,30],[-90,-94,18,28],[-76,-64,4,24]]},
  // Inner spurs: gorge rims, shoulders and the saddles the road uses.
  {id:'library-shoulder',spine:[[86,-176,34,20],[60,-184,40,18],[36,-181,41,14],[22,-180,40,8]]},
  {id:'reservoir-spur',spine:[[92,-232,82,16],[80,-214,78,16],[56,-210,73,14],[30,-212,68,8]]},
  {id:'west-rim',spine:[[-64,-204,52,18],[-36,-198,47,14],[-18,-194,45,8]]},
  {id:'orchard-north',spine:[[-104,-150,44,18],[-70,-148,40,16],[-30,-144,34,12]]},
  {id:'orchard-rim',spine:[[-26,-150,38,10],[-24,-134,36,10],[-22,-118,28,10],[-22,-106,22,10]]},
  {id:'gorge-east-rim',spine:[[22,-150,38,8],[26,-136,37,8],[26,-124,30,8]]},
  {id:'dam-west',spine:[[-60,-252,92,20],[-28,-242,91,14],[-14,-238,90,8]]},
  {id:'dam-east',spine:[[70,-256,94,20],[44,-244,92,14],[30,-238,90,8]]},
];
/** Hollows are negative blobs; they keep the valley open toward town. */
const BLOBS:readonly {at:readonly[number,number];r:readonly[number,number];yaw:number;dh:number}[]=[
  {at:[4,-130],r:[24,70],yaw:0,dh:-8},
];

function segment(x:number,z:number,ax:number,az:number,bx:number,bz:number){
  const dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz,t=clamp(((x-ax)*dx+(z-az)*dz)/(l||1));
  return {d:Math.hypot(x-ax-dx*t,z-az-dz*t),t};
}
const bump=(u:number)=>u>=1?0:(1-u*u)*(1-u*u);
/** Smooth maximum and minimum keep every blend differentiable, so a 2–3 unit lattice can draw it. */
export const smax=(a:number,b:number,k:number)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.max(a,b)+h*h*k/4;};
export const smin=(a:number,b:number,k:number)=>-smax(-a,-b,k);

export function ridgeHeight(spine:Spine,x:number,z:number,slope=.62):number{
  let best=-Infinity;
  for(let i=1;i<spine.length;i++){
    const a=spine[i-1]!,b=spine[i]!,{d,t}=segment(x,z,a[0],a[1],b[0],b[1]);
    const h=mix(a[2],b[2],t),w=mix(a[3],b[3],t);
    // A rounded crest (radius ~w) falling away at the ridge's side slope.
    best=Math.max(best,h-slope*(Math.sqrt(d*d+w*w)-w));
  }
  return best;
}

/** The central massif: an asymmetric dome, long toward town and short behind the summit. */
export function massif(x:number,z:number):number{
  const sx=0,sz=-292;
  const dx=(x-sx)/140,dz=z>sz?(z-sz)/262:(sz-z)/88;
  const q=Math.hypot(dx,dz),soft=Math.sqrt(q*q+.01)-.1;
  if(soft>=1)return -(soft-1)*40-.6;
  return 106*Math.pow(1-soft,1.7)-.6;
}

/** Deterministic value noise, two octaves, for surface variety only. */
function hash(ix:number,iz:number){let h=Math.imul(ix,374761393)^Math.imul(iz,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function valueNoise(x:number,z:number){
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return mix(mix(hash(ix,iz),hash(ix+1,iz),u),mix(hash(ix,iz+1),hash(ix+1,iz+1),u),v)*2-1;
}
export function surfaceNoise(x:number,z:number):number{return valueNoise(x/38,z/38)*1.6+valueNoise(x/13+17,z/13-9)*.45;}

export function terraceWeight(t:Terrace,x:number,z:number):number{
  const c=Math.cos(t.yaw),s=Math.sin(t.yaw),dx=x-t.at[0],dz=z-t.at[2],u=dx*c-dz*s,v=dx*s+dz*c;
  const e=Math.hypot(u/t.radii[0],v/t.radii[1]);
  if(e<=1)return 1;
  return 1-smooth((e-1)*Math.min(t.radii[0],t.radii[1])/t.bank);
}

/** River channel profile across the water line: a shallow bed, soft banks and steep gorge walls. */
export function channelProfile(d:number,wall:number):number{
  if(d<3)return -RIVER_BED_DEPTH;
  if(d<6)return mix(-RIVER_BED_DEPTH,.6,smooth((d-3)/3));
  return .6+wall*(d-6)*smooth((d-6)/5);
}
export type RiverHit={d:number;y:number;s:number;wall:number};
const riverLengths:number[]=[0];for(let i=1;i<GORGE_POINTS.length;i++){const a=GORGE_POINTS[i-1]!,b=GORGE_POINTS[i]!;riverLengths.push(riverLengths[i-1]!+Math.hypot(b[0]-a[0],b[2]-a[2]));}
export function nearestRiver(x:number,z:number):RiverHit{
  let best={d:Infinity,y:0,s:0,wall:1.4};
  for(let i=1;i<GORGE_POINTS.length;i++){
    const a=GORGE_POINTS[i-1]!,b=GORGE_POINTS[i]!,{d,t}=segment(x,z,a[0],a[2],b[0],b[2]);
    if(d<best.d)best={d,y:mix(a[1],b[1],t),s:mix(riverLengths[i-1]!,riverLengths[i]!,t),wall:mix(a[3],b[3],t)};
  }
  return best;
}

/** The broad landform: massif, arms, spurs, hollows, surface variety and coastline. */
export function macroHeight(x:number,z:number):number{
  let h=massif(x,z);
  // Ridges below the current surface by more than the blend width contribute nothing.
  for(const r of RIDGES){const ridge=ridgeHeight(r.spine,x,z,r.slope);if(ridge>h-10)h=smax(h,ridge,10);}
  for(const b of BLOBS){const c=Math.cos(b.yaw),s=Math.sin(b.yaw),dx=x-b.at[0],dz=z-b.at[1],u=dx*c-dz*s,v=dx*s+dz*c;h+=b.dh*bump(Math.hypot(u/b.r[0],v/b.r[1]));}
  // The coastline: a superellipse footprint whose south shore merges with the island's.
  const cz=z>-190?(z+190)/150:(-190-z)/196,cx=Math.abs(x)/170,foot=Math.pow(Math.pow(cx,2.6)+Math.pow(Math.abs(cz),2.6),1/2.6);
  h=mix(Math.min(h,-3.5),h,smooth((1-foot)/.1));
  // Where the mountain meets the harbour island the foothills settle to town grade.
  if(z>-84)h=mix(Math.min(h,1+(-48-z)*.12),h,smooth((-48-z)/36));
  h+=surfaceNoise(x,z)*smooth((h+2)/6);
  // Inland ground never dips to the sea: a floor that rises gently away from the coast.
  const inland=smooth((.93-foot)/.12);
  return Math.max(h,mix(-9,.9+Math.max(0,-48-z)*.09,inland));
}
export function bowlHeight(x:number,z:number):number{
  const bowl=RESERVOIR_BOWL,bx=(x-bowl.at[0])/bowl.radii[0],bz=(z-bowl.at[1])/bowl.radii[1],br=Math.hypot(bx,bz);
  return br<2.4?bowl.floor+Math.max(0,br-.55)*(br-.55)*bowl.rise:Infinity;
}
