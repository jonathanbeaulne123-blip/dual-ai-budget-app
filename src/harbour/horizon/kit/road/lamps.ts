/**
 * Streetlights (ROAD.md §4.5, D-R7; STYLE §1.11, §3.1 Lantern post / Low lantern / Bollard). Every lamp is drawn once per
 * kind and dressing in a LOCAL frame — y up, +x the arm's reach toward the carriageway, the base at the origin — and
 * instanced by `runtime/corridorArt.ts`. The lamp glass is its own bucket ('glow') so the runtime can raise it at night;
 * `LAMP_HEAD` is where the light sits in that frame, and `lampPlacement` turns a `LampSpot` into the instance transform and
 * the world head the night track lights (its pool and point light).
 *
 *  - roadLantern: a 5.2 eu post on a stone plinth, an arm reaching 1.3 eu over the kerb with a scrolled brace, and the
 *    lantern hung from its end. Classic: iron post with brass bands, a four-pane brass lantern with an iron hood.
 *    Taylor: rose-card post taped with washi, a timber arm, a round washi paper lantern with a heart cut-out.
 *    Newfoundland: a white-painted post with a teal band, a gallows arm, a galvanised storm (hurricane) lantern hung on a
 *    rope from a rope bracket.
 *  - bridgeLantern: the 2.6 eu lantern post standing on a rail post (its foot at the spot's `at`), lantern on top.
 *  - tunnelLamp: a wall bracket — back plate, a short arm, a caged bulkhead lantern.
 *  - bollard: the Quay bollard light (STYLE §3.1 Bollard row, 0.9 eu), a lit band under its cap.
 */
import {CardBuilder,shade,mix,type RGB,type V3} from '../../../art/cardScene.ts';
import type {LampKind,LampSpot} from '../../land/corridor/types.ts';
import {CORRIDOR} from '../../land/corridor/types.ts';
import type {RoadKitPalette,RoadTheme} from './palette.ts';

export const ROAD_LAMP=Object.freeze({height:CORRIDOR.lampHeight,reach:1.3,armY:5.02,plinth:.36});
/** The light's centre in each lamp's local frame (x toward the road, y up). */
export const LAMP_HEAD:Record<LampKind,Record<RoadTheme,V3>>={
  roadLantern:{classic:[ROAD_LAMP.reach,4.55,0],taylor:[ROAD_LAMP.reach,4.58,0],newfoundland:[ROAD_LAMP.reach,4.42,0]},
  bridgeLantern:{classic:[0,2.83,0],taylor:[0,2.86,0],newfoundland:[0,2.8,0]},
  tunnelLamp:{classic:[.5,-.05,0],taylor:[.5,-.05,0],newfoundland:[.5,-.08,0]},
  bollard:{classic:[0,.74,0],taylor:[0,.74,0],newfoundland:[0,.74,0]},
};

/** The instance frame of a lamp: base, the unit direction of +x (toward the road) and the world head. */
export type LampPlacement={id:string;kind:LampKind;base:V3;dir:[number,number];head:V3;yaw:number};
/**
 * Where a lamp stands. The arm points from `at` toward `head` when the spot's head sits more than 0.3 eu off its base in
 * plan (the planner's own head decides the reach direction), else along `yaw` read as the direction (sin yaw, cos yaw).
 * The returned `head` is the lantern the kit actually draws.
 */
export function lampPlacement(spot:Pick<LampSpot,'id'|'kind'|'at'|'head'|'yaw'>,theme:RoadTheme):LampPlacement{
  const dx=spot.head[0]-spot.at[0],dz=spot.head[2]-spot.at[2],l=Math.hypot(dx,dz);
  const dir:[number,number]=l>.3?[dx/l,dz/l]:[Math.sin(spot.yaw),Math.cos(spot.yaw)];
  const local=LAMP_HEAD[spot.kind][theme],base:V3=[spot.at[0],spot.at[1],spot.at[2]];
  return {id:spot.id,kind:spot.kind,base,dir,yaw:Math.atan2(-dir[1],dir[0]),head:[base[0]+dir[0]*local[0]-dir[1]*local[2],base[1]+local[1],base[2]+dir[1]*local[0]+dir[0]*local[2]]};
}

type L=(x:number,y:number,z?:number)=>V3;
/** A glass cone band (the washi lantern's paper, the storm lantern's globe) into the 'glow' bucket: lit at night. */
function glowCone(b:CardBuilder,x:number,z:number,y0:number,y1:number,r0:number,r1:number,color:RGB,sides=8){
  for(let k=0;k<sides;k++){const a0=k/sides*Math.PI*2,a1=(k+1)/sides*Math.PI*2,lit=.9+.1*Math.max(0,-Math.cos((a0+a1)/2-2.6));
    const p0:V3=[x+Math.cos(a0)*r0,y0,z+Math.sin(a0)*r0],p1:V3=[x+Math.cos(a1)*r0,y0,z+Math.sin(a1)*r0],q1:V3=[x+Math.cos(a1)*r1,y1,z+Math.sin(a1)*r1],q0:V3=[x+Math.cos(a0)*r1,y1,z+Math.sin(a0)*r1];
    const c=shade(color,lit);b.tri(p0,p1,q1,c,'glow');b.tri(p0,q1,q0,c,'glow');}
}
/** Draws in a builder at an offset origin `o` (so every piece falls in one card cell). */
const at=(o:V3):L=>(x,y,z=0)=>[o[0]+x,o[1]+y,o[2]+z];

/** A four-pane lantern (Classic brass, Newfoundland galvanised variant handled separately). */
function paneLantern(b:CardBuilder,P:L,o:V3,cx:number,yb:number,r:number,body:number,frame:RGB,hood:RGB,glass:RGB,full:boolean){
  const q=(x:number,z:number,y:number)=>P(cx+x,y,z);
  for(const [a,c] of [[[-r,-r],[r,-r]],[[r,-r],[r,r]],[[r,r],[-r,r]],[[-r,r],[-r,-r]]] as const)b.glow(q(a[0],a[1],yb),q(c[0],c[1],yb),q(c[0],c[1],yb+body),q(a[0],a[1],yb+body),glass);
  if(full)for(const [u,v] of [[-r,-r],[r,-r],[r,r],[-r,r]] as const)b.post(o[0]+cx+u,o[2]+v,o[1]+yb,o[1]+yb+body,.022,frame,4,'steel');
  b.cone(o[0]+cx,o[2],o[1]+yb-.07,o[1]+yb,r*.55,r+.05,frame,4,'steel');
  if(full)b.cone(o[0]+cx,o[2],o[1]+yb+body,o[1]+yb+body+.05,r+.07,r+.07,frame,4,'steel');
  b.cone(o[0]+cx,o[2],o[1]+yb+body+.05,o[1]+yb+body+.25,r+.08,.035,hood,4,'steel',full);
  if(full)b.cone(o[0]+cx,o[2],o[1]+yb+body+.25,o[1]+yb+body+.32,.05,.05,frame,6,'steel');
}

function roadLantern(b:CardBuilder,pal:RoadKitPalette,o:V3,full:boolean){
  const P=at(o),R=ROAD_LAMP.reach,top=ROAD_LAMP.height,arm=ROAD_LAMP.armY;
  // Plinth: a dressed-stone block, the post's foot.
  b.box(o[0],o[2],0,.2,.2,o[1]-.15,o[1]+ROAD_LAMP.plinth,pal.coping,pal.stone,full?b.ink:null);
  if(pal.theme==='classic'){
    const sides=full?8:6;
    b.post(o[0],o[2],o[1]+ROAD_LAMP.plinth,o[1]+top,.075,pal.post,sides,'steel');
    for(const y of full?[ROAD_LAMP.plinth+.05,2.4,top-.08]:[])b.post(o[0],o[2],o[1]+y,o[1]+y+.09,.095,pal.postBand,sides,'steel');
    if(full)b.cone(o[0],o[2],o[1]+top,o[1]+top+.16,.1,.02,pal.postBand,sides,'steel');
    b.beam(P(-.04,arm),P(R+.08,arm),.07,.09,pal.post,full?b.ink:null,'steel');
    // Lite subtracts the scroll and finials; the post, arm, lantern and every
    // light position remain. These tiny fittings used most of the mountain's lite budget.
    if(full){const brace:V3[]=[];for(let k=0;k<=6;k++){const t=k/6;brace.push(P(.05+t*.78,arm-.62+Math.sin(t*Math.PI/2)*.58));}b.tube(brace,.028,pal.post,5);}
    if(full)b.cone(o[0]+R+.12,o[2],o[1]+arm-.05,o[1]+arm+.05,.05,.05,pal.postBand,6,'steel');
    b.line(P(R,arm-.05),P(R,4.93),pal.post);
    paneLantern(b,P,o,R,4.3,.17,.5,pal.frame,pal.lanternRoof,pal.glassNight,full);
  }else if(pal.theme==='taylor'){
    b.box(o[0],o[2],0,.075,.075,o[1]+ROAD_LAMP.plinth,o[1]+top,shade(pal.post,1.06),pal.post,full?b.ink:null,.8);
    for(const [y,c] of (full?[[1.1,pal.tape[0]!],[2.6,pal.tape[1]!],[4.1,pal.tape[2]!]]:[]) as [number,RGB][])b.box(o[0],o[2],.35,.085,.085,o[1]+y,o[1]+y+.16,c,c,null);
    if(full)b.box(o[0],o[2],0,.1,.1,o[1]+top,o[1]+top+.05,pal.paperEdge,pal.paperEdge,null);
    b.beam(P(-.05,arm),P(R+.06,arm),.08,.1,pal.timberLight,full?b.ink:null);
    if(full)b.beam(P(.06,arm-.6),P(.7,arm-.02),.06,.07,pal.timberLight,null);
    b.line(P(R,arm-.05),P(R,4.95),pal.frame);
    // Washi lantern: a round paper body that glows whole, a lilac cap and foot, a heart cut on each face.
    const cx=o[0]+R,cz=o[2],y0=o[1]+4.22;
    glowCone(b,cx,cz,y0,y0+.18,.16,.26,pal.glassNight,full?10:6);glowCone(b,cx,cz,y0+.18,y0+.52,.26,.24,pal.glassNight,full?10:6);glowCone(b,cx,cz,y0+.52,y0+.68,.24,.13,pal.glassNight,full?10:6);
    b.cone(cx,cz,y0-.05,y0,.1,.16,pal.lanternRoof,full?8:6);b.cone(cx,cz,y0+.68,y0+.74,.14,.1,pal.lanternRoof,full?8:6);
    const heart=[[0,-.1],[.09,0],[.07,.07],[0,.04],[-.07,.07],[-.09,0]] as const;
    if(full)for(const s of [-1,1]){const zc=cz+s*.262;b.flat(heart.map(([u,v])=>[u+.1,v+.1] as const),[cx-.1,y0+.3,zc],[cx+.1,y0+.3,zc],pal.lanternRoof,null);}
  }else{
    b.box(o[0],o[2],0,.08,.08,o[1]+ROAD_LAMP.plinth,o[1]+top,shade(pal.post,1.04),pal.post,full?b.ink:null,.8);
    if(full)b.box(o[0],o[2],0,.09,.09,o[1]+1.6,o[1]+1.85,pal.postBand,shade(pal.postBand,.85),null);
    if(full)b.box(o[0],o[2],0,.11,.11,o[1]+top,o[1]+top+.08,pal.postBand,shade(pal.postBand,.85),null);
    // Gallows arm with a knee brace; the rope bracket: a rope looped over the arm's end and down to the lantern's bail.
    b.beam(P(-.06,arm),P(R+.12,arm),.09,.11,pal.post,full?b.ink:null);
    if(full)b.beam(P(.06,arm-.7),P(.72,arm-.03),.07,.08,pal.post,null);
    const rope:V3[]=[P(R-.05,arm+.06),P(R,arm+.1),P(R+.05,arm+.06),P(R+.02,arm-.1),P(R,4.84)];
    if(full){b.tube(rope,.025,pal.rope,4);b.tube([P(R,4.84),P(R-.09,4.8),P(R-.11,4.72),P(R,4.69),P(R+.11,4.72),P(R+.09,4.8),P(R,4.84)],.012,pal.galvanised,4);}
    else b.line(P(R,arm),P(R,4.74),pal.rope);
    // Hurricane lantern: galvanised font, a glass globe (bulging), wire guards, a vented cap.
    const cx=o[0]+R,cz=o[2],y0=o[1]+4.08;
    b.cone(cx,cz,y0,y0+.12,.15,.16,pal.galvanised,full?8:6,'steel');
    glowCone(b,cx,cz,y0+.12,y0+.34,.1,.15,pal.glassNight,full?8:6);glowCone(b,cx,cz,y0+.34,y0+.54,.15,.08,pal.glassNight,full?8:6);
    if(full)for(let k=0;k<4;k++){const a=k/4*Math.PI*2+.4;b.line([cx+Math.cos(a)*.13,y0+.12,cz+Math.sin(a)*.13],[cx+Math.cos(a)*.17,y0+.34,cz+Math.sin(a)*.17],pal.galvanised);b.line([cx+Math.cos(a)*.17,y0+.34,cz+Math.sin(a)*.17],[cx+Math.cos(a)*.1,y0+.56,cz+Math.sin(a)*.1],pal.galvanised);}
    b.cone(cx,cz,y0+.54,y0+.6,.11,.11,pal.galvanised,full?8:6,'steel');b.cone(cx,cz,y0+.6,y0+.66,.12,.04,pal.galvanised,full?8:6,'steel');
  }
}

function bridgeLantern(b:CardBuilder,pal:RoadKitPalette,o:V3,full:boolean){
  const P=at(o),top=2.4;
  if(pal.theme==='taylor'){
    b.box(o[0],o[2],0,.06,.06,o[1]-.05,o[1]+top,shade(pal.post,1.06),pal.post,full?b.ink:null,.8);b.box(o[0],o[2],.35,.07,.07,o[1]+1.2,o[1]+1.34,pal.tape[0]!,pal.tape[0]!,null);
    const cx=o[0],cz=o[2],y0=o[1]+top+.02;
    glowCone(b,cx,cz,y0,y0+.18,.15,.24,pal.glassNight,10);glowCone(b,cx,cz,y0+.18,y0+.5,.24,.22,pal.glassNight,10);glowCone(b,cx,cz,y0+.5,y0+.64,.22,.12,pal.glassNight,10);
    b.cone(cx,cz,y0+.64,y0+.7,.13,.09,pal.lanternRoof,8);
    return;
  }
  if(pal.theme==='newfoundland'){
    b.box(o[0],o[2],0,.065,.065,o[1]-.05,o[1]+top,shade(pal.post,1.04),pal.post,full?b.ink:null,.8);b.box(o[0],o[2],0,.075,.075,o[1]+1.1,o[1]+1.3,pal.postBand,pal.postBand,null);
    const cx=o[0],cz=o[2],y0=o[1]+top;
    b.cone(cx,cz,y0,y0+.12,.14,.15,pal.galvanised,8,'steel');glowCone(b,cx,cz,y0+.12,y0+.34,.1,.14,pal.glassNight,8);glowCone(b,cx,cz,y0+.34,y0+.54,.14,.08,pal.glassNight,8);
    b.cone(cx,cz,y0+.54,y0+.62,.11,.03,pal.galvanised,8,'steel');void P;return;
  }
  b.post(o[0],o[2],o[1]-.05,o[1]+top,.06,pal.post,6,'steel');b.post(o[0],o[2],o[1]+1.1,o[1]+1.19,.08,pal.postBand,6,'steel');
  paneLantern(b,P,o,0,top+.02,.17,.45,pal.frame,pal.lanternRoof,pal.glassNight,full);
}

function tunnelLamp(b:CardBuilder,pal:RoadKitPalette,o:V3,full:boolean){
  const P=at(o);
  // Back plate on the wall, a short arm, a caged bulkhead lantern.
  b.box(o[0]+.02,o[2],0,.04,.16,o[1]-.3,o[1]+.25,pal.theme==='taylor'?pal.paperEdge:pal.stoneDark,shade(pal.stoneDark,.85),full?b.ink:null);
  b.beam(P(.02,.12),P(.5,.12),.05,.06,pal.theme==='newfoundland'?pal.galvanised:pal.post,null,'steel');
  if(pal.theme==='taylor'){glowCone(b,o[0]+.5,o[2],o[1]-.32,o[1]-.12,.1,.17,pal.glassNight,8);glowCone(b,o[0]+.5,o[2],o[1]-.12,o[1]+.08,.17,.1,pal.glassNight,8);b.cone(o[0]+.5,o[2],o[1]+.08,o[1]+.12,.08,.06,pal.lanternRoof,6);return;}
  const frame=pal.theme==='newfoundland'?pal.galvanised:pal.frame;
  paneLantern(b,P,o,.5,-.3,.12,.34,frame,pal.theme==='newfoundland'?pal.galvanised:pal.lanternRoof,pal.glassNight,full);
}

function bollard(b:CardBuilder,pal:RoadKitPalette,o:V3,full:boolean){
  const x=o[0],z=o[2],y=o[1];
  if(pal.theme==='taylor'){
    b.post(x,z,y,y+.64,.16,pal.walls[1]!,10);b.box(x,z,.2,.17,.17,y+.4,y+.48,pal.tape[0]!,pal.tape[0]!,null);
    glowCone(b,x,z,y+.64,y+.84,.14,.14,pal.glassNight,10);b.cone(x,z,y+.84,y+.9,.18,.18,pal.paperEdge,10);b.cone(x,z,y+.9,y+.98,.18,.05,pal.paperEdge,10);
    return;
  }
  const c=pal.theme==='newfoundland'?pal.walls[3]!:pal.iron;
  b.post(x,z,y,y+.62,.17,c,8,'steel');b.cone(x,z,y+.62,y+.66,.17,.19,c,8,'steel');
  glowCone(b,x,z,y+.66,y+.84,.13,.13,pal.glassNight,8);
  const cap=pal.theme==='classic'?pal.trim:pal.trim;b.cone(x,z,y+.84,y+.88,.2,.2,cap,8,'steel');b.dome(x,y+.88,z,.18,cap,8,2,'steel');
  if(pal.theme==='newfoundland'){const ring:V3[]=[];for(let k=0;k<=12;k++){const a=k/12*Math.PI*2;ring.push([x+Math.cos(a)*.2,y+.34+Math.sin(a*2)*.035,z+Math.sin(a)*.2]);}b.tube(ring,.04,pal.rope,4);}
  if(pal.theme==='classic'&&full)b.post(x,z,y+.5,y+.55,.185,pal.brass,8,'steel');
}

/** Draw one lamp kind at local origin `o` (a builder offset; x toward the road). */
export function drawLamp(b:CardBuilder,pal:RoadKitPalette,kind:LampKind,o:V3,tier:'full'|'lite'){
  const full=tier==='full';
  switch(kind){case 'roadLantern':roadLantern(b,pal,o,full);break;case 'bridgeLantern':bridgeLantern(b,pal,o,full);break;case 'tunnelLamp':tunnelLamp(b,pal,o,full);break;case 'bollard':bollard(b,pal,o,full);break;}
}
export {mix};
