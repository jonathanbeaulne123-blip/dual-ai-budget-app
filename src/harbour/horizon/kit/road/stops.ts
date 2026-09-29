/**
 * Scenic stop furniture (ROAD.md §4.7; STYLE §3.1 Bench / Parapet rows): a flagged pull-off with a low stone wall and
 * coping on its view side, a bench facing the view, and a lamp. The stop's `outline` is the pull-off (plan, engine
 * units); `facing` is the view direction (radians, the direction (sin f, cos f)). Its flags are drawn here only when no
 * baked solid carries them (the fixture and a stop the bake leaves as an outline): `flags:false` when L2 bakes a
 * `corridorWalk`/pad for it.
 *
 * The wall follows the outline's edges whose outward normal faces the view (within 70°), never the edge toward the road,
 * so the pull-off stays open to the carriageway. The bench stands 1.6 eu in from the wall, facing the view; the lamp at
 * the road-side corner. Dressings follow STYLE §1.3.4 (stone, bench materials) as the rest of the kit.
 */
import type {ScenicStop} from '../../land/corridor/types.ts';
import {CardBuilder,shade,mix,type V3} from '../../../art/cardScene.ts';
import {hash2} from '../../../art/cardKit.ts';
import type {RoadKitPalette} from './palette.ts';

export const STOP_KIT=Object.freeze({wall:.62,wallHalf:.24,coping:.1,bench:{half:1.45,depth:.36,seat:.52,back:.62},benchIn:1.6});
export type StopPieces={bench:{at:V3;yaw:number}|null;lamp:{at:V3;yaw:number}|null;wall:[V3,V3][]};

type Ground=(x:number,z:number)=>number;
const signedArea=(o:readonly (readonly [number,number])[])=>{let a=0;for(let i=0;i<o.length;i++){const p=o[i]!,q=o[(i+1)%o.length]!;a+=p[0]*q[1]-q[0]*p[1];}return a/2;};

/** Plan pieces of a stop: which edges carry the wall, where the bench and the lamp stand. Pure (tests read it). */
export function stopLayout(stop:ScenicStop,ground:Ground):StopPieces{
  const O=stop.outline,n=O.length,vx=Math.sin(stop.facing),vz=Math.cos(stop.facing),ccw=signedArea(O)>0;
  const wall:[V3,V3][]=[];let far=-Infinity,near=Infinity,nearPt:[number,number]|null=null;
  for(let i=0;i<n;i++){const a=O[i]!,b=O[(i+1)%n]!,dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.2)continue;
    // Outward normal in (x,z): for a counter-clockwise loop (x→z) the outward normal of edge a→b is (dz,-dx).
    const nx=(ccw?dz:-dz)/l,nz=(ccw?-dx:dx)/l,dot=nx*vx+nz*vz;
    if(dot>Math.cos(70*Math.PI/180))wall.push([[a[0],ground(a[0],a[1]),a[1]],[b[0],ground(b[0],b[1]),b[1]]]);
    for(const p of [a,b]){const d=p[0]*vx+p[1]*vz;far=Math.max(far,d);if(d<near){near=d;nearPt=[p[0],p[1]];}}}
  // Bench: the outline's centroid pushed toward the view until 1.6 eu short of the far edge.
  let cx=0,cz=0;for(const p of O){cx+=p[0];cz+=p[1];}cx/=n;cz/=n;
  const c=cx*vx+cz*vz,push=Math.max(0,far-STOP_KIT.benchIn-c),bx=cx+vx*push,bz=cz+vz*push;
  const bench=n>=3?{at:[bx,ground(bx,bz),bz] as V3,yaw:stop.facing}:null;
  // Lamp: at the road-side corner (the outline point furthest from the view), pulled 0.6 eu in.
  const lamp=nearPt?(()=>{const lx=nearPt[0]+(cx-nearPt[0])*.12,lz=nearPt[1]+(cz-nearPt[1])*.12;return {at:[lx,ground(lx,lz),lz] as V3,yaw:stop.facing};})():null;
  return {bench,lamp,wall};
}

/** A bench (STYLE §3.1 Bench row): Classic timber slats on stone ends, Taylor paper slats with a scalloped back, NF painted plank on driftwood. */
export function drawBench(b:CardBuilder,pal:RoadKitPalette,at:V3,yaw:number,ground:Ground,tier:'full'|'lite'){
  const K=STOP_KIT.bench,c=Math.cos(yaw),s=Math.sin(yaw),W=(lx:number,lz:number,y:number):V3=>[at[0]+lx*c+lz*s,y,at[2]+lz*c-lx*s],y0=at[1],seat=y0+K.seat;
  // Local: x along the bench, z toward the view (the sitter faces +z); the back is at −z.
  const slat=pal.theme==='taylor'?pal.walls[0]!:pal.theme==='newfoundland'?pal.walls[2]!:pal.plank,full=tier==='full';
  for(const lx of [-1.2,1.2]){
    const q=W(lx,0,0);
    if(pal.theme==='classic')b.box(q[0],q[2],yaw,.12,.3,y0-.1,seat-.04,pal.coping,pal.stone,full?b.ink:null);
    else if(pal.theme==='taylor')b.box(q[0],q[2],yaw,.07,.3,y0-.05,seat-.04,pal.paperEdge,shade(pal.paperEdge,.85),full?b.ink:null);
    else{const d=mix(pal.plank,[.85,.82,.76],.35);b.box(q[0],q[2],yaw+.08,.1,.28,y0-.1,seat-.04,d,shade(d,.8),full?b.ink:null);}
  }
  const slats=full?3:1;for(let k=0;k<slats;k++){const z=slats===1?0:-.22+k*.22,q=W(0,z,0);b.box(q[0],q[2],yaw,K.half,slats===1?.3:.085,seat-.05,seat,shade(slat,1+k*.02),shade(slat,.8),full?b.ink:null);}
  // Back: two rails on posts; Taylor's top rail scalloped (three low arcs of card).
  for(const lx of [-1.2,1.2]){const q=W(lx,-.3,0);b.box(q[0],q[2],yaw,.05,.05,seat-.05,seat+K.back,pal.theme==='classic'?pal.iron:shade(slat,.85),shade(slat,.7),null);}
  for(let k=0;k<(full?2:1);k++){const q=W(0,-.3,0);b.box(q[0],q[2],yaw,K.half,.04,seat+.24+k*.22,seat+.4+k*.22,slat,shade(slat,.8),full?b.ink:null);}
  if(pal.theme==='taylor'&&full)for(let k=-1;k<=1;k++){const q=W(k*.95,-.31,0),top=seat+.62;b.flat([[0,0],[.9,0],[.8,.1],[.6,.16],[.3,.16],[.1,.1]],[q[0]-c*.45,top,q[2]+s*.45],[q[0]+c*.45,top,q[2]-s*.45],pal.paperEdge,b.ink);}
  b.shadow(at[0],at[2],1.6,.55,yaw,ground,.28);
}

export type StopOptions={tier:'full'|'lite';ground:Ground;/** Draw the flagged floor (false when a baked solid carries it). */flags?:boolean};
/** Build a scenic stop's static furniture (wall, bench, flags). The lamp is instanced by the caller at `pieces.lamp`. */
export function buildScenicStop(b:CardBuilder,pal:RoadKitPalette,stop:ScenicStop,o:StopOptions):StopPieces{
  const pieces=stopLayout(stop,o.ground),full=o.tier==='full',K=STOP_KIT;
  if(o.flags!==false&&stop.outline.length>=3){
    const loop=stop.outline.map(p=>[p[0],p[1]] as [number,number]),top=Math.max(...loop.map(p=>o.ground(p[0],p[1])))+.08;
    b.prism(signedArea(loop)>0?loop:[...loop].reverse(),(x,z)=>o.ground(x,z)-.25,top,shade(pal.coping,.97),pal.stone,full?b.ink:null);
    // Flag joints: a 1.2 eu grid aligned with the view.
    if(full){const vx=Math.sin(stop.facing),vz=Math.cos(stop.facing),rx=vz,rz=-vx;let lo=Infinity,hi=-Infinity,lo2=Infinity,hi2=-Infinity;
      for(const p of loop){const a=p[0]*vx+p[1]*vz,c=p[0]*rx+p[1]*rz;lo=Math.min(lo,a);hi=Math.max(hi,a);lo2=Math.min(lo2,c);hi2=Math.max(hi2,c);}
      const inside=(x:number,z:number)=>{let w=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i]!,c=loop[j]!;if((a[1]>z)!==(c[1]>z)&&x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0])w=!w;}return w;};
      const seg=(p0:[number,number],p1:[number,number])=>{const N=Math.max(2,Math.ceil(Math.hypot(p1[0]-p0[0],p1[1]-p0[1])/.4));let prev:V3|null=null;
        for(let k=0;k<=N;k++){const x=p0[0]+(p1[0]-p0[0])*k/N,z=p0[1]+(p1[1]-p0[1])*k/N;if(!inside(x,z)){prev=null;continue;}const p:V3=[x,top+.004,z];if(prev)b.line(prev,p,b.pencil);prev=p;}};
      for(let a=Math.ceil(lo/1.2)*1.2;a<hi;a+=1.2)seg([vx*a+rx*lo2,vz*a+rz*lo2],[vx*a+rx*hi2,vz*a+rz*hi2]);
      for(let c=Math.ceil(lo2/1.2)*1.2;c<hi2;c+=1.2)seg([vx*lo+rx*c,vz*lo+rz*c],[vx*hi+rx*c,vz*hi+rz*c]);}
  }
  // The low wall on the view side: coursed stone with a coping (the parapet's language at seat height).
  for(const [a,c] of pieces.wall){
    const dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz);if(l<.3)continue;
    const path:{p:V3;side:V3;up:V3}[]=[],N=Math.max(1,Math.ceil(l/1.5));
    for(let k=0;k<=N;k++){const t=k/N,x=a[0]+dx*t,z=a[2]+dz*t;path.push({p:[x,o.ground(x,z),z],side:[dz/l,0,-dx/l],up:[0,1,0]});}
    const h=K.wall,top=h+K.coping;
    b.sweep(path,[[-K.wallHalf,-.25],[-K.wallHalf,h],[-K.wallHalf-.05,h],[-K.wallHalf-.05,top],[K.wallHalf+.05,top],[K.wallHalf+.05,h],[K.wallHalf,h],[K.wallHalf,-.25]],
      k=>k===3?(pal.theme==='taylor'?pal.paperEdge:pal.coping):k===0||k===6?pal.stone:shade(pal.coping,.82),{inkAt:full?[3,4]:[3],foot:[0,6],caps:false});
    if(full){for(let k=1;k<path.length;k++){const p=path[k-1]!.p,q=path[k]!.p;b.line([p[0],p[1]+h*.5,p[2]],[q[0],q[1]+h*.5,q[2]],pal.theme==='taylor'?pal.paperEdge:b.pencil);}
      for(let d=.55,k=0;d<l-.2;d+=.9,k++){const t=d/l,x=a[0]+dx*t,z=a[2]+dz*t,y=o.ground(x,z),lo=k%2?0:h*.5,ox=-dz/l*(K.wallHalf+.012),oz=dx/l*(K.wallHalf+.012);b.line([x+ox,y+lo+.02,z+oz],[x+ox,y+lo+h*.5-.02,z+oz],pal.theme==='taylor'?pal.paperEdge:b.pencil);}}
    for(const e of [a,c])b.box(e[0],e[2],Math.atan2(dx,dz),.3,.3,e[1]-.25,e[1]+top+.08,pal.coping,pal.stone,full?b.ink:null);
    void hash2;
  }
  if(pieces.bench)drawBench(b,pal,pieces.bench.at,pieces.bench.yaw,o.ground,o.tier);
  return pieces;
}
