/**
 * The funicular and the gondola on their contract splines.
 *
 * Funicular: two rails on sleepers a little below the cabin floor (so a platform meets
 * the floor level), the haul cable on its pulleys, a ballast bed on the ground and braced
 * timber trestles where the land falls away; each station is a planked platform aligned to
 * the track with a canopy over it and a small hut at its outer side.
 * Gondola: the rope follows the catenary spans; each tower is a tapered steel lattice with
 * a crossarm and sheave wheels; the terminals have a bullwheel under a roof.
 * The cabins are separate objects placed by `setTransit` with the ride's yaw and pitch;
 * idle cabins wait at the station where they last stopped.
 */
import * as THREE from 'three';
import {groundHeightAt} from '../../scene/ground.ts';
import {FUNICULAR_LINE,GONDOLA_LINE,type TransportKind,type TransportLine,type Point3} from '../definition.ts';
import {CardBuilder,shade,mix,inkLift,type V3,type RGB} from '../../art/cardScene.ts';
import {hash2} from '../../art/cardKit.ts';
import {corridorClearance} from './placements.ts';
import type {MountainArtPalette} from './palette.ts';

/** The funicular's rail tops sit this far below the cabin floor (the ride's y). */
export const RAIL_DROP=.55;
const UP:V3=[0,1,0];
const G=(x:number,z:number)=>groundHeightAt(x,z);

function funicularTrack(b:CardBuilder,pal:MountainArtPalette,tier:'full'|'lite'){
  const L=FUNICULAR_LINE,step=tier==='full'?.8:1.6,frames=L.frames(step);
  const hside=(f:typeof frames[number]):V3=>{const l=Math.hypot(f.side[0],f.side[2])||1;return [f.side[0]/l,0,f.side[2]/l];};
  const railY=(f:typeof frames[number])=>f.at[1]-RAIL_DROP;
  // Rails (steel), sleepers (timber) and the cable between them.
  for(const s of [-1,1]){const pts=frames.map(f=>{const h=hside(f);return [f.at[0]+h[0]*.8*s,railY(f),f.at[2]+h[2]*.8*s] as V3;});
    for(let i=1;i<pts.length;i++)b.beam(pts[i-1]!,pts[i]!,.12,.14,shade(pal.iron,1.4),null,'steel');}
  frames.forEach((f,i)=>{const h=hside(f),y=railY(f)-.1;const yaw=Math.atan2(h[0],h[2]);
    b.box(f.at[0],f.at[2],yaw,1.15,.12,y-.14,y,shade(pal.timber,.9+hash2(i,2)*.12),pal.timber,null);
    if(i%10===0)b.post(f.at[0],f.at[2],y,y+.12,.14,pal.iron,6,'steel');});
  b.tube(frames.filter((_,i)=>i%2===0).map(f=>[f.at[0],railY(f)-.02,f.at[2]] as V3),.035,pal.iron,4);
  // Ballast bed on the ground, trestles where the track stands clear of it.
  let run:V3[][]=[];let cur:{l:V3;r:V3}[]=[];
  const flush=()=>{if(cur.length>1)run.push(cur.flatMap(c=>[c.l,c.r]));cur=[];};
  frames.forEach((f,i)=>{
    const h=hside(f),gy=G(f.at[0],f.at[2]),bed=railY(f)-.26;
    if(bed-gy<.9){cur.push({l:[f.at[0]-h[0]*1.5,bed,f.at[2]-h[2]*1.5],r:[f.at[0]+h[0]*1.5,bed,f.at[2]+h[2]*1.5]});}
    else{flush();
      if(i%Math.round(3.2/step)===0){
        // A bent: two raked legs, a cap under the sleepers, a brace or two.
        const top=bed-.1,foot=Math.min(gy,G(f.at[0]-h[0]*1.6,f.at[2]-h[2]*1.6),G(f.at[0]+h[0]*1.6,f.at[2]+h[2]*1.6))-.3,rake=Math.min(1.5,(top-foot)*.08);
        const leg=(s:number,y:number):V3=>{const u=(y-foot)/Math.max(.1,top-foot),w=1.1+(1-u)*rake;return [f.at[0]+h[0]*w*s,y,f.at[2]+h[2]*w*s];};
        for(const s of [-1,1])b.beam(leg(s,foot),leg(s,top),.26,.26,pal.timber,null);
        b.beam(leg(-1,top),leg(1,top),.3,.3,pal.timberLight);
        const storeys=Math.max(1,Math.round((top-foot)/3.5));
        for(let k=0;k<storeys;k++){const y0=foot+(top-foot)*k/storeys,y1=foot+(top-foot)*(k+1)/storeys;b.beam(leg(-1,y0),leg(1,y1),.12,.12,shade(pal.timber,.85),null);if(k)b.beam(leg(-1,y0),leg(1,y0),.16,.16,pal.timber,null);}
        for(const s of [-1,1]){const p=leg(s,foot);b.box(p[0],p[2],0,.35,.35,p[1]-.4,p[1]+.25,pal.stone,pal.stoneDark,null);}
      }
    }
  });
  flush();
  // Stringers along the trestled spans (the deck under the sleepers).
  for(const s of [-1,1]){let prev:V3|null=null;frames.forEach(f=>{const h=hside(f),bed=railY(f)-.26,gy=G(f.at[0],f.at[2]);const p:V3=[f.at[0]+h[0]*.9*s,bed-.1,f.at[2]+h[2]*.9*s];
    if(bed-gy>=.9){if(prev)b.beam(prev,p,.22,.34,shade(pal.timber,.95),null);prev=p;}else prev=null;});}
  for(const strip of run){for(let i=2;i<strip.length;i+=2){const a=strip[i-2]!,c=strip[i-1]!,d=strip[i+1]!,e=strip[i]!;
    b.quad(a,c,d,e,mix(pal.gravel,pal.stoneDark,.25),'flat');
    for(const [p,q] of [[a,e],[c,d]] as const)b.side([p[0],G(p[0],p[2])-.3,p[2]],[q[0],G(q[0],q[2])-.3,q[2]],q,p,shade(pal.gravel,.75));}}
}

/** A station: planks level with the cabin floor, a canopy on the outer side, a small hut. */
function station(b:CardBuilder,pal:MountainArtPalette,line:TransportLine,st:TransportLine['stations'][number],roof:RGB):{hut:{x:number;z:number;yaw:number}|null}{
  const p=st.platform,c=Math.cos(p.yaw),s=Math.sin(p.yaw),[hl,hw]=p.half;
  // Local frame: +along (sin yaw, cos yaw), +across (cos yaw, −sin yaw).
  const W=(along:number,across:number,y:number):V3=>[p.at[0]+s*along+c*across,y,p.at[2]+c*along-s*across];
  const y=p.at[1];
  // Which side of the platform faces the track?
  const f=line.at(st.s),toTrack=Math.sign((f.at[0]-p.at[0])*c-(f.at[2]-p.at[2])*s)||1;
  const gmin=Math.min(...[[-hl,-hw],[hl,-hw],[hl,hw],[-hl,hw]].map(([a,b2])=>{const q=W(a!,b2!,0);return G(q[0],q[2]);}));
  // A stone plinth where the ground is near; where it falls away, a deck on braced legs.
  const plinthFoot=Math.max(Math.min(gmin,y-.3)-.4,y-2.4);
  b.box(p.at[0],p.at[2],p.yaw,hw,hl,plinthFoot,y-.12,pal.stone,pal.stoneDark);
  if(gmin<plinthFoot-.2)for(const [a,d] of [[-1,-1],[1,-1],[1,1],[-1,1],[0,-1],[0,1]] as const){const q=W(a*(hl-.3),d*(hw-.3),0),gy=G(q[0],q[2]);if(gy<plinthFoot){b.beam([q[0],gy-.3,q[2]],[q[0],plinthFoot+.1,q[2]],.3,.3,pal.timber,null);}}
  b.box(p.at[0],p.at[2],p.yaw,hw+.05,hl+.05,y-.12,y,pal.plank,shade(pal.plank,.8));
  for(let k=-hl;k<=hl+1e-6;k+=.6)b.line(inkLift(W(k,-hw,y)),inkLift(W(k,hw,y)),b.pencil);
  // A painted safety line along the track edge.
  b.quad(W(-hl,toTrack*(hw-.35),y+.012),W(hl,toTrack*(hw-.35),y+.012),W(hl,toTrack*(hw-.15),y+.012),W(-hl,toTrack*(hw-.15),y+.012),pal.second,'paint');
  // Canopy: posts on the outer edge, a roof sloping toward the track.
  const outer=-toTrack*(hw-.2),top=y+3.2;
  for(const a of [-hl+.4,0,hl-.4]){const q=W(a,outer,0);b.box(q[0],q[2],p.yaw,.1,.1,y,top,pal.timberLight,pal.timber);}
  const r0=W(-hl-.4,outer-.6*toTrack,top+.35),r1=W(hl+.4,outer-.6*toTrack,top+.35),r2=W(hl+.4,toTrack*(hw+.6),top-.1),r3=W(-hl-.4,toTrack*(hw+.6),top-.1);
  b.quad(r0,r1,r2,r3,roof);b.quad([r0[0],r0[1]-.12,r0[2]],[r3[0],r3[1]-.12,r3[2]],[r2[0],r2[1]-.12,r2[2]],[r1[0],r1[1]-.12,r1[2]],shade(roof,.55));
  for(const [a2,b2] of [[r0,r1],[r1,r2],[r2,r3],[r3,r0]] as const){b.line(inkLift(a2),inkLift(b2));b.side([a2[0],a2[1]-.12,a2[2]],[b2[0],b2[1]-.12,b2[2]],b2,a2,shade(roof,.8));}
  b.beam(W(-hl-.2,outer,top),W(hl+.2,outer,top),.18,.24,pal.timberLight);
  // A lantern hangs from the beam at each end of the platform.
  for(const end of [-1,1]){const q=W(end*(hl-.9),outer+toTrack*.25,0);hangingLantern(b,pal,q[0],q[2],top-.12);}
  // Hut beyond the outer edge at the clearer end.
  let hut:{x:number;z:number;yaw:number}|null=null;
  for(const end of [1,-1]){const q=W(end*(hl-1.2),outer-toTrack*2.3,0);if(corridorClearance(q[0],q[2])>1.6){hut={x:q[0],z:q[2],yaw:p.yaw};break;}}
  return {hut};
}

function gondolaTower(b:CardBuilder,pal:MountainArtPalette,base:Point3,top:number,dir:readonly [number,number]){
  const [x,g,z]=base,h=top-g,steel=mix(pal.iron,pal.glassFrame,.25),yaw=Math.atan2(dir[0],dir[1]);
  const c=Math.cos(yaw),s=Math.sin(yaw),W=(lx:number,lz:number,y:number):V3=>[x+lx*c+lz*s,y,z+lz*c-lx*s];
  const half=(y:number)=>{const u=(y-g)/h;return 2.4-(2.4-.7)*u;};
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]] as const;
  for(const [sx,sz] of corners)b.beam(W(sx*half(g-.4),sz*half(g-.4),g-.4),W(sx*half(top-1.4),sz*half(top-1.4),top-1.4),.28,.28,steel,null,'steel');
  const storeys=Math.max(2,Math.round(h/5));
  for(let k=0;k<=storeys;k++){const y=g+(top-1.4-g)*k/storeys,hw=half(y);
    for(let e=0;e<4;e++){const a=corners[e]!,d=corners[(e+1)%4]!;b.beam(W(a[0]*hw,a[1]*hw,y),W(d[0]*hw,d[1]*hw,y),.14,.14,steel,null,'steel');
      if(k<storeys){const y1=g+(top-1.4-g)*(k+1)/storeys,hw1=half(y1);b.beam(W(a[0]*hw,a[1]*hw,y),W(d[0]*hw1,d[1]*hw1,y1),.1,.1,shade(steel,.9),null,'steel');}}}
  for(const [sx,sz] of corners){const q=W(sx*half(g),sz*half(g),0);b.box(q[0],q[2],yaw,.7,.7,G(q[0],q[2])-.8,G(q[0],q[2])+.35,pal.stone,pal.stoneDark);}
  // Head: a crossarm across the line, sheave trains under each rope.
  b.beam(W(-3.2,0,top-1),W(3.2,0,top-1),.4,.5,shade(steel,1.1),b.ink,'steel');
  for(const lx of [0,2.4])for(const lz of [-1.1,-.4,.4,1.1]){const q=W(lx,lz,top-.28);b.cone(q[0],q[2],top-.36,top-.2,.28,.28,pal.brass,8,'steel');}
  for(const lx of [0,2.4])b.beam(W(lx,-1.4,top-.55),W(lx,1.4,top-.55),.12,.24,steel,null,'steel');
}

function gondolaStation(b:CardBuilder,pal:MountainArtPalette,st:TransportLine['stations'][number],roof:RGB){
  const p=st.platform,c=Math.cos(p.yaw),s=Math.sin(p.yaw),[hl,hw]=p.half,y=p.at[1];
  const W=(along:number,across:number,yy:number):V3=>[p.at[0]+s*along+c*across,yy,p.at[2]+c*along-s*across];
  const gmin=Math.min(G(p.at[0],p.at[2]),...[[-hl,-hw],[hl,hw],[hl,-hw],[-hl,hw]].map(([a,d])=>{const q=W(a!,d!,0);return G(q[0],q[2]);}));
  b.box(p.at[0],p.at[2],p.yaw,hw,hl,gmin-.5,y-.1,pal.stone,pal.stoneDark);b.box(p.at[0],p.at[2],p.yaw,hw+.05,hl+.05,y-.1,y,pal.plank,shade(pal.plank,.8));
  for(let k=-hl;k<=hl+1e-6;k+=.6)b.line(inkLift(W(k,-hw,y)),inkLift(W(k,hw,y)),b.pencil);
  // The bullwheel at the line's end, on a steel frame, under a pitched roof on four columns.
  const f=st.at,cable=f[1]+3.1;
  b.cone(f[0],f[2],cable-.25,cable+.05,2.2,2.2,pal.iron,18,'steel');b.cone(f[0],f[2],cable+.05,cable+.25,.6,.4,pal.brass,10,'steel');
  for(const [a,d] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const){const q=W(a*(hl+.6),d*(hw+2.2),0);b.box(q[0],q[2],p.yaw,.14,.14,G(q[0],q[2])-.2,cable+1.4,pal.timberLight,pal.timber);}
  b.gable(p.at[0]+c*(-.6),p.at[2]-s*(-.6),p.yaw+Math.PI/2,hw+2.5,hl+.8,cable+1.4,1.6,roof,pal.plaster);
  for(const end of [-1,1]){const q=W(end*(hl-.3),-hw+.4,0);b.beam([q[0],cable+1.35,q[2]],[q[0]+c*.6,cable+1.35,q[2]-s*.6],.12,.14,pal.timber,null);hangingLantern(b,pal,q[0],q[2],cable+1.3);}
}

/** A lantern hanging on a short chain from a beam: brass frame, glowing panes, a little roof. */
export function hangingLantern(b:CardBuilder,pal:MountainArtPalette,x:number,z:number,hook:number){
  const top=hook-.45,body=.42,L=(u:number,v:number,y:number):V3=>[x+u,y,z+v];
  b.line([x,hook,z],[x,top+.02,z],pal.iron);
  if(pal.theme==='taylor'){b.cone(x,z,top-body,top-body*.45,.18,.24,pal.lamp,8);b.cone(x,z,top-body*.45,top,.24,.14,pal.lamp,8);b.cone(x,z,top,top+.06,.1,.1,pal.roofAlt,6);return;}
  const r=.15,frame=pal.theme==='newfoundland'?pal.accent:pal.brass;
  for(const [a,c] of [[[-r,-r],[r,-r]],[[r,-r],[r,r]],[[r,r],[-r,r]],[[-r,r],[-r,-r]]] as const)b.glow(L(a[0],a[1],top-body),L(c[0],c[1],top-body),L(c[0],c[1],top),L(a[0],a[1],top),pal.lamp);
  for(const [u,v] of [[-r,-r],[r,-r],[r,r],[-r,r]] as const)b.post(x+u,z+v,top-body,top,.02,frame,4,'steel');
  b.cone(x,z,top,top+.16,r+.07,.03,frame,4,'steel');b.cone(x,z,top-body-.05,top-body,r*.6,r+.04,frame,4,'steel');
}

export function buildTransportArt(b:CardBuilder,pal:MountainArtPalette,tier:'full'|'lite'){
  funicularTrack(b,pal,tier);
  const huts:{x:number;z:number;yaw:number;name:string;kind:TransportKind}[]=[];
  for(const st of FUNICULAR_LINE.stations){const r=station(b,pal,FUNICULAR_LINE,st,pal.roofTile);if(r.hut)huts.push({...r.hut,name:st.name,kind:'funicular'});}
  // Gondola rope (and its return line to one side), towers and terminals.
  const path=GONDOLA_LINE.path,sparse=path.filter((_,i)=>i%2===0||i===path.length-1);
  b.tube(sparse as V3[],.05,mix(pal.iron,[.7,.7,.68],.45),6);
  const ret=sparse.map((p,i)=>{const a=sparse[Math.max(0,i-1)]!,c=sparse[Math.min(sparse.length-1,i+1)]!,dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz)||1;return [p[0]+dz/l*2.4,p[1],p[2]-dx/l*2.4] as V3;});
  b.tube(ret,.045,mix(pal.iron,[.7,.7,.68],.45),6);
  GONDOLA_LINE.towers.forEach((t,i)=>{const k=path.findIndex(p=>Math.hypot(p[0]-t[0],p[2]-t[2])<.8),q=path[Math.min(path.length-1,k+2)]!,pp=path[Math.max(0,k-2)]!;
    const top=(k>=0?path[k]![1]:t[1]+20)+.1;gondolaTower(b,pal,t,top,[q[0]-pp[0],q[2]-pp[2]]);void i;});
  for(const st of GONDOLA_LINE.stations)gondolaStation(b,pal,st,pal.roofAlt);
  return {huts};
}

/* ── Cabins ──────────────────────────────────────────────────────────────── */
export type Cabin={group:THREE.Group;body:THREE.Group;chassis:THREE.Group;dispose():void};
/** A cabin as its own small card model; origin at the rider's feet on the floor. */
export function buildCabin(kind:TransportKind,pal:MountainArtPalette,tier:'full'|'lite',wall:RGB):Cabin{
  const group=new THREE.Group();group.name=kind==='gondola'?'Summit gondola carriage':'Mountain funicular carriage';
  const body=new THREE.Group(),chassis=new THREE.Group();group.add(chassis,body);
  const b=new CardBuilder(`${group.name} body`,tier,{ink:pal.ink,cell:Infinity}),k=new CardBuilder(`${group.name} chassis`,tier,{ink:pal.ink,cell:Infinity});
  const glass=pal.glass,frame=kind==='gondola'?pal.iron:pal.timber,roof=kind==='gondola'?pal.roofAlt:pal.roofTile;
  if(kind==='funicular'){
    const hx=1.1,hz=1.9;
    b.box(0,0,0,hx,hz,-.25,0,pal.plank,shade(pal.plank,.75));
    for(let z=-hz;z<=hz;z+=.4)b.line(inkLift([-hx,0,z]),inkLift([hx,0,z]),b.pencil);
    // Waist panels (painted), corner posts, window frames and glass, and a roof.
    for(const s of [-1,1]){b.box(s*hx,0,0,.06,hz,0,1,wall,shade(wall,.8));b.box(0,s*hz,0,hx,.06,0,1,wall,shade(wall,.8));}
    for(const [x,z] of [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz],[-hx,0],[hx,0]] as const)b.box(x,z,0,.07,.07,1,2.3,frame,shade(frame,.8));
    for(const s of [-1,1]){b.glass([s*hx,1.05,-hz],[s*hx,1.05,hz],[s*hx,2.2,hz],[s*hx,2.2,-hz],glass);b.glass([-hx,1.05,s*hz],[hx,1.05,s*hz],[hx,2.2,s*hz],[-hx,2.2,s*hz],glass);}
    b.box(0,0,0,hx+.15,hz+.2,2.3,2.45,shade(roof,.9),shade(roof,.7));b.box(0,0,0,hx-.2,hz-.3,2.45,2.62,roof,shade(roof,.75));
    b.box(0,-hz+.35,0,hx-.1,.25,0,.5,pal.timberLight,pal.timber);b.box(0,hz-.35,0,hx-.1,.25,0,.5,pal.timberLight,pal.timber);
    // Chassis (pitched along the track): frame, bogies, wheels on the rails below.
    k.box(0,0,0,.95,1.8,-.55,-.25,pal.iron,shade(pal.iron,.8),null);
    for(const z of [-1.3,1.3])for(const x of [-.8,.8]){k.cone(x,z,-RAIL_DROP+.02,-RAIL_DROP+.1,.25,.25,shade(pal.iron,1.3),8,'steel');}
  }else{
    const hx=1.15,hz=1.15;
    b.box(0,0,0,hx,hz,-.2,0,pal.plank,shade(pal.plank,.75));
    for(const s of [-1,1]){b.box(s*hx,0,0,.05,hz,0,.9,wall,shade(wall,.8));b.box(0,s*hz,0,hx,.05,0,.9,wall,shade(wall,.8));}
    for(const [x,z] of [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]] as const)b.box(x,z,0,.06,.06,.9,2.2,frame,shade(frame,.8),null);
    for(const s of [-1,1]){b.glass([s*hx,.95,-hz],[s*hx,.95,hz],[s*hx,2.15,hz],[s*hx,2.15,-hz],glass);b.glass([-hx,.95,s*hz],[hx,.95,s*hz],[hx,2.15,s*hz],[-hx,2.15,s*hz],glass);
      b.line([s*(hx+.01),1.55,-hz],[s*(hx+.01),1.55,hz],b.pencil);}
    b.box(0,0,0,hx+.12,hz+.12,2.2,2.34,shade(roof,.9),shade(roof,.7));b.cone(0,0,2.34,2.8,hx+.05,.25,roof,4);
    for(const s of [-1,1])b.box(s*(hx-.35),0,0,.28,hz-.1,0,.45,pal.timberLight,pal.timber);
    // Hanger to the grip on the rope, 3.1 up.
    b.beam([0,2.75,0],[0,3.1,0],.12,.12,pal.iron,null,'steel');b.box(0,0,0,.12,.45,3.0,3.2,pal.brass,shade(pal.brass,.8),null);
  }
  const bb=b.finish({glassOpacity:.28}),kb=k.finish();body.add(bb.group);chassis.add(kb.group);
  let dead=false;return {group,body,chassis,dispose(){if(dead)return;dead=true;bb.dispose();kb.dispose();group.removeFromParent();group.clear();}};
}
