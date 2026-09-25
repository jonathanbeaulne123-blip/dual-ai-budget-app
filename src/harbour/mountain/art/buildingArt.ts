/**
 * Small buildings on the painted-card kit, authored per theme as architecture:
 *  - Classic: a dressed-stone plinth, plaster walls with a timber frame, a tiled gable.
 *  - Taylor: pastel card walls with white paper edges, a scalloped eave, stencilled hearts.
 *  - Newfoundland: clapboard in a jellybean colour, white corner boards, a saltbox roof.
 * Used for the storefronts, the station huts, the goal pavilion and the observatory.
 * Everything stands on a plinth sunk to the lowest ground under its footprint.
 */
import {groundHeightAt} from '../../scene/ground.ts';
import {CardBuilder,shade,mix,inkLift,type V3,type RGB} from '../../art/cardScene.ts';
import {ICON} from '../../art/cardKit.ts';
import type {MountainArtPalette} from './palette.ts';
import {footGround} from './placements.ts';
import {OBSERVATORY_FORM} from '../artGeometry.ts';

export type SignSpot={at:V3;yaw:number;w:number;h:number};
type Frame={x:number;z:number;yaw:number;W:(lx:number,lz:number,y:number)=>V3};
const frame=(x:number,z:number,yaw:number):Frame=>{const c=Math.cos(yaw),s=Math.sin(yaw);return {x,z,yaw,W:(lx,lz,y)=>[x+lx*c+lz*s,y,z+lz*c-lx*s]};};

/** A window on a wall face at local (lx, y) on the face lz (±hz) or lx face; `out` is the face normal sign. */
function windowOn(b:CardBuilder,pal:MountainArtPalette,F:Frame,u:number,y:number,face:{axis:'x'|'z';at:number;out:number},w=.8,h=1){
  const P=(a:number,v:number,o=0):V3=>face.axis==='z'?F.W(u+a,face.at+face.out*(.02+o),y+v):F.W(face.at+face.out*(.02+o),u+a,y+v);
  const trim=pal.theme==='newfoundland'?pal.trim:pal.theme==='taylor'?pal.paperEdge:pal.timberLight;
  b.quad(P(-w/2-.1,-.1,.01),P(w/2+.1,-.1,.01),P(w/2+.1,h+.1,.01),P(-w/2-.1,h+.1,.01),trim);
  b.quad(P(-w/2,0,.02),P(w/2,0,.02),P(w/2,h,.02),P(-w/2,h,.02),mix(pal.glass,[.25,.3,.32],.55));
  b.line(P(0,0,.03),P(0,h,.03),trim);b.line(P(-w/2,h/2,.03),P(w/2,h/2,.03),trim);
  for(const [a,c] of [[P(-w/2-.1,-.1,.04),P(w/2+.1,-.1,.04)],[P(w/2+.1,-.1,.04),P(w/2+.1,h+.1,.04)],[P(w/2+.1,h+.1,.04),P(-w/2-.1,h+.1,.04)],[P(-w/2-.1,h+.1,.04),P(-w/2-.1,-.1,.04)]] as const)b.line(a,c);
  // Sill.
  const s0=P(-w/2-.18,-.12,0),s1=P(w/2+.18,-.12,0),s2=P(w/2+.18,-.12,.16),s3=P(-w/2-.18,-.12,.16);b.quad(s0,s1,s2,s3,shade(trim,1.05));
  if(pal.theme==='taylor'){b.decal(P(0,h+.35,.05),face.axis==='z'?[Math.cos(F.yaw),0,-Math.sin(F.yaw)]:[Math.sin(F.yaw),0,Math.cos(F.yaw)],[0,1,0],.16,ICON.hearth,pal.accent);}
}
function doorOn(b:CardBuilder,pal:MountainArtPalette,F:Frame,u:number,y:number,face:{axis:'x'|'z';at:number;out:number},w=1.05,h=2.05,colour:RGB=pal.timber){
  const P=(a:number,v:number,o=0):V3=>face.axis==='z'?F.W(u+a,face.at+face.out*(.02+o),y+v):F.W(face.at+face.out*(.02+o),u+a,y+v);
  const trim=pal.theme==='newfoundland'?pal.trim:pal.theme==='taylor'?pal.paperEdge:pal.timberLight;
  b.quad(P(-w/2-.12,0,.01),P(w/2+.12,0,.01),P(w/2+.12,h+.14,.01),P(-w/2-.12,h+.14,.01),trim);
  b.quad(P(-w/2,0,.02),P(w/2,0,.02),P(w/2,h,.02),P(-w/2,h,.02),colour);
  for(const v of [.35,h*.55])b.line(P(-w/2+.12,v,.03),P(w/2-.12,v,.03),shade(colour,.6));
  b.line(P(w/2-.2,h*.45,.04),P(w/2-.2,h*.5,.04),pal.brass);
  for(const [a,c] of [[P(-w/2-.12,0,.04),P(-w/2-.12,h+.14,.04)],[P(-w/2-.12,h+.14,.04),P(w/2+.12,h+.14,.04)],[P(w/2+.12,h+.14,.04),P(w/2+.12,0,.04)]] as const)b.line(a,c);
}

export type HouseOptions={wall:RGB;wallH:number;roofRise:number;door?:{u:number;face:'front'|'side'};windows?:readonly {u:number;y:number;face:'front'|'back'|'left'|'right'}[];chimney?:boolean;plinth?:number};
/**
 * A house on the theme's kit. Local +z is the front. Returns the chimney top (for smoke)
 * and the eave height.
 */
export function house(b:CardBuilder,pal:MountainArtPalette,x:number,z:number,yaw:number,hx:number,hz:number,o:HouseOptions):{chimney:V3|null;floor:number;eave:number}{
  const F=frame(x,z,yaw),g=footGround(x,z,yaw,hx+.3,hz+.3),floor=g.max+(o.plinth??.25),eave=floor+o.wallH;
  // Plinth: dressed stone (granite in Newfoundland), sunk to the lowest ground.
  b.box(x,z,yaw,hx+.18,hz+.18,g.min-.35,floor,pal.coping,pal.stoneDark);
  const wall=o.wall,sideWall=shade(wall,.9);
  // Walls: four cut faces, darker to the foot, inked at the eaves.
  b.box(x,z,yaw,hx,hz,floor,eave,wall,sideWall);
  if(pal.wall==='clapboard'){
    for(let y=floor+.26;y<eave-.05;y+=.26)for(const [a,c] of [[F.W(-hx,hz+.012,y),F.W(hx,hz+.012,y)],[F.W(hx,-hz-.012,y),F.W(-hx,-hz-.012,y)],[F.W(hx+.012,-hz,y),F.W(hx+.012,hz,y)],[F.W(-hx-.012,hz,y),F.W(-hx-.012,-hz,y)]] as const)b.line(a,c,shade(wall,.62));
    for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const){const p=F.W(sx*(hx-.06),sz*(hz-.06),0);b.box(p[0],p[2],yaw,.1,.1,floor,eave,pal.trim,shade(pal.trim,.85),null);}
  }else if(pal.wall==='stone-timber'){
    // Stone ground course and a timber frame on the plaster above.
    b.box(x,z,yaw,hx+.04,hz+.04,floor,floor+.7,pal.stone,pal.stoneDark);
    for(const lz of [-hz,hz])for(let lx=-hx;lx<=hx+1e-6;lx+=hx/2){const a=F.W(lx,lz+Math.sign(lz)*.03,floor+.7),c=F.W(lx,lz+Math.sign(lz)*.03,eave);b.line(a,c,pal.timber);}
    for(const lz of [-hz,hz]){b.line(F.W(-hx,lz+Math.sign(lz)*.03,eave-.2),F.W(hx,lz+Math.sign(lz)*.03,eave-.2),pal.timber);b.line(F.W(-hx,lz+Math.sign(lz)*.03,floor+.7),F.W(0,lz+Math.sign(lz)*.03,eave-.2),pal.timber);}
  }else{
    // Paper: white edges round every face, like a card cut-out mounted on the page.
    for(const [a,c,d,e] of [[F.W(-hx,hz+.012,floor),F.W(hx,hz+.012,floor),F.W(hx,hz+.012,eave),F.W(-hx,hz+.012,eave)],[F.W(hx,-hz-.012,floor),F.W(-hx,-hz-.012,floor),F.W(-hx,-hz-.012,eave),F.W(hx,-hz-.012,eave)]] as const){
      const edge=.12,L=(p:V3,q:V3,t:number):V3=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t];
      b.quad(a,c,L(c,d,edge/o.wallH),L(a,e,edge/o.wallH),pal.paperEdge);b.quad(L(a,e,1-edge/o.wallH),L(c,d,1-edge/o.wallH),d,e,pal.paperEdge);}
  }
  // Roof.
  const rise=o.roofRise,roof=pal.roofTile;
  if(pal.roof==='saltbox'){
    // A short front slope and a long back slope that sweeps lower.
    const ex=hx+.3,rz=-hz*.35,front=F.W(-ex,hz+.35,eave-.1),front1=F.W(ex,hz+.35,eave-.1),ridge0=F.W(-ex,rz,eave+rise),ridge1=F.W(ex,rz,eave+rise),back0=F.W(-ex,-hz-.4,eave-.9),back1=F.W(ex,-hz-.4,eave-.9);
    b.quad(front,front1,ridge1,ridge0,shade(roof,1.02));b.quad(back1,back0,ridge0,ridge1,shade(roof,.82));
    for(const sx of [-1,1]){b.tri(F.W(sx*hx,hz,eave),F.W(sx*hx,-hz,eave-.8),F.W(sx*hx,rz,eave+rise-.02),shade(wall,.88));}
    b.box(x,z,yaw,hx,hz,eave-.8,eave,wall,sideWall,null);
    for(const [a,c] of [[front,front1],[ridge0,ridge1],[back0,back1],[front,ridge0],[front1,ridge1],[back0,ridge0],[back1,ridge1]] as const)b.line(inkLift(a),inkLift(c));
    for(const [a,c] of [[front,front1],[back1,back0]] as const)b.side([a[0],a[1]-.14,a[2]],[c[0],c[1]-.14,c[2]],c,a,shade(pal.trim,.9));
  }else{
    b.gable(x,z,yaw,hx,hz,eave,rise,roof,wall,.4);
    if(pal.roof==='scallop'){
      // Paper scallops hanging from both eaves.
      for(const lz of [1,-1]){const ez=(hz+.24)*lz,n=Math.max(4,Math.round(hx*2/.5));
        for(let k=0;k<n;k++){const u0=-hx-.4+(2*hx+.8)*k/n,u1=-hx-.4+(2*hx+.8)*(k+1)/n,um=(u0+u1)/2,y=eave-.4*rise/hz*.6-.02;
          for(let q=0;q<5;q++){const t0=q/5*Math.PI,t1=(q+1)/5*Math.PI,r=(u1-u0)/2;b.tri(F.W(um,ez,y),F.W(um+Math.cos(t0)*r,ez,y-Math.sin(t0)*r*.8),F.W(um+Math.cos(t1)*r,ez,y-Math.sin(t1)*r*.8),k%2?pal.paperEdge:pal.roofAlt);}}}
    }
  }
  // Openings.
  const faceOf=(f:'front'|'back'|'left'|'right')=>f==='front'?{axis:'z' as const,at:hz,out:1}:f==='back'?{axis:'z' as const,at:-hz,out:-1}:f==='left'?{axis:'x' as const,at:-hx,out:-1}:{axis:'x' as const,at:hx,out:1};
  if(o.door)doorOn(b,pal,F,o.door.u,floor,faceOf(o.door.face==='front'?'front':'right'),1.05,Math.min(2.1,o.wallH-.35),pal.theme==='newfoundland'?pal.walls[(Math.round(x*7)%pal.walls.length+pal.walls.length)%pal.walls.length]!:pal.timber);
  for(const w of o.windows??[])windowOn(b,pal,F,w.u,floor+w.y,faceOf(w.face));
  // Doorstep.
  if(o.door){const s=F.W(o.door.u,hz+.45,0);b.box(s[0],s[2],yaw,.75,.3,g.min-.2,floor-.02,pal.coping,pal.stone);}
  let chimney:V3|null=null;
  if(o.chimney){const c=F.W(hx*.55,-hz*.3,0),top=eave+rise*.9+.9;b.box(c[0],c[2],yaw,.32,.32,eave-.5,top,pal.theme==='newfoundland'?pal.walls[0]!:pal.stone,pal.stoneDark);b.box(c[0],c[2],yaw,.4,.4,top,top+.12,pal.coping,pal.stoneDark);chimney=[c[0],top+.15,c[2]];}
  return {chimney,floor,eave};
}

/** A striped cloth awning on iron brackets over a shopfront (local front face). */
export function awning(b:CardBuilder,pal:MountainArtPalette,x:number,z:number,yaw:number,hz:number,u0:number,u1:number,y:number,colours:readonly RGB[]){
  const F=frame(x,z,yaw),n=Math.max(3,Math.round((u1-u0)/.45)),depth=1.25,drop=.55;
  for(let k=0;k<n;k++){const a=u0+(u1-u0)*k/n,c=u0+(u1-u0)*(k+1)/n,col=colours[k%colours.length]!;
    b.quad(F.W(a,hz+.02,y),F.W(c,hz+.02,y),F.W(c,hz+depth,y-drop),F.W(a,hz+depth,y-drop),col);
    // The valance: straight in Classic, scalloped paper in Taylor, plain canvas board in Newfoundland.
    if(pal.theme==='taylor'){const m=(a+c)/2,r=(c-a)/2;for(let q=0;q<5;q++){const t0=q/5*Math.PI,t1=(q+1)/5*Math.PI;b.tri(F.W(m,hz+depth,y-drop),F.W(m+Math.cos(t0)*r,hz+depth,y-drop-Math.sin(t0)*r),F.W(m+Math.cos(t1)*r,hz+depth,y-drop-Math.sin(t1)*r),col);}}
    else b.quad(F.W(a,hz+depth,y-drop),F.W(c,hz+depth,y-drop),F.W(c,hz+depth,y-drop-.22),F.W(a,hz+depth,y-drop-.22),shade(col,.9));
  }
  b.line(inkLift(F.W(u0,hz+depth,y-drop)),inkLift(F.W(u1,hz+depth,y-drop)));b.line(F.W(u0,hz+.02,y),F.W(u1,hz+.02,y));
  for(const u of [u0+.1,u1-.1])b.beam(F.W(u,hz+.02,y-.9),F.W(u,hz+depth-.05,y-drop-.02),.05,.05,pal.iron,null,'steel');
}

/** An iron bracket from a wall with a hanging board; returns where the engraved plate goes. */
export function hangingSign(b:CardBuilder,pal:MountainArtPalette,x:number,z:number,yaw:number,hx:number,hz:number,y:number,side:1|-1,w=1.3,h=.62):SignSpot{
  const F=frame(x,z,yaw),root=F.W(side*hx,hz+.05,y),tip=F.W(side*(hx+w+.25),hz+.05,y);
  b.beam(root,tip,.06,.08,pal.iron,null,'steel');b.beam(F.W(side*hx,hz+.05,y-.5),F.W(side*(hx+.5),hz+.05,y),.04,.04,pal.iron,null,'steel');
  const cx=side*(hx+.2+w/2),board=F.W(cx,hz+.05,y-.18-h/2);
  for(const e of [-1,1])b.line(F.W(cx+e*(w/2-.1),hz+.05,y),F.W(cx+e*(w/2-.1),hz+.05,y-.18),pal.iron);
  // The board: a thick card, the plate hangs on its front and back.
  const edge=pal.theme==='taylor'?pal.paperEdge:pal.theme==='newfoundland'?pal.trim:pal.brass;
  b.box(board[0],board[2],yaw+Math.PI/2,.045,w/2+.06,board[1]-h/2-.06,board[1]+h/2+.06,edge,shade(edge,.8));
  if(pal.theme==='taylor')for(const e of [-1,1]){const t=F.W(cx+e*(w/2-.05),hz+.05,board[1]+h/2+.02);b.box(t[0],t[2],yaw+e*.5,.18,.05,t[1]-.08,t[1]+.08,pal.tape[0]!,pal.tape[0]!,null);}
  return {at:board,yaw:yaw+Math.PI/2,w,h};
}

/** The goal pavilion beside the dam: a stepped plinth, eight columns, a hipped roof with a lantern. */
export function pavilion(b:CardBuilder,pal:MountainArtPalette,x:number,z:number,yaw:number,hx:number,hz:number,columns?:readonly (readonly [number,number])[]):{floor:number;inner:V3[]}{
  const F=frame(x,z,yaw),g=footGround(x,z,yaw,hx+1,hz+1),floor=g.max+.15;
  b.box(x,z,yaw,hx+1,hz+1,g.min-.4,floor-.08,pal.stone,pal.stoneDark);b.box(x,z,yaw,hx+.6,hz+.6,floor-.08,floor,pal.coping,pal.stone);
  const cols:readonly (readonly [number,number])[]=columns??[[-hx,-hz],[0,-hz],[hx,-hz],[hx,0],[hx,hz],[-hx,hz],[-hx,0]];
  const has=(lx:number,lz:number)=>cols.some(c=>Math.abs(c[0]-lx)<1e-6&&Math.abs(c[1]-lz)<1e-6);
  const colour=pal.theme==='newfoundland'?pal.trim:pal.theme==='taylor'?pal.paperEdge:pal.coping,top=floor+3.1;
  for(const [lx,lz] of cols){const p=F.W(lx,lz,0);b.post(p[0],p[2],floor,top,.2,colour,8);b.box(p[0],p[2],yaw,.3,.3,floor,floor+.25,pal.coping,pal.stone);b.box(p[0],p[2],yaw,.3,.3,top-.2,top,pal.brass,shade(pal.brass,.8));}
  // Entablature and a balustrade on three sides.
  b.box(x,z,yaw,hx+.35,hz+.35,top,top+.45,pal.theme==='newfoundland'?pal.walls[2]!:pal.coping,pal.stone);
  for(const [a,c] of ([[F.W(-hx,-hz,0),F.W(hx,-hz,0),has(-hx,-hz)&&has(hx,-hz)&&has(0,-hz)],[F.W(-hx,-hz,0),F.W(-hx,hz,0),has(-hx,-hz)&&has(-hx,hz)&&has(-hx,0)],[F.W(hx,-hz,0),F.W(hx,hz,0),has(hx,-hz)&&has(hx,hz)&&has(hx,0)]] as const).filter(r=>r[2])){b.beam([a[0],floor+.95,a[2]],[c[0],floor+.95,c[2]],.16,.12,colour);for(let t=.1;t<1;t+=.1)b.post(a[0]+(c[0]-a[0])*t,a[2]+(c[2]-a[2])*t,floor,floor+.9,.06,colour,5);}
  // Hipped roof rising to a small lantern and a finial.
  const ey=top+.45,rise=2.2,ex=hx+.8,ez=hz+.8,apex=F.W(0,0,ey+rise),C=[F.W(-ex,-ez,ey),F.W(ex,-ez,ey),F.W(ex,ez,ey),F.W(-ex,ez,ey)];
  const roof=pal.theme==='taylor'?pal.roofAlt:pal.roofTile;
  for(let i=0;i<4;i++){const a=C[i]!,c=C[(i+1)%4]!;b.tri(a,c,[apex[0],apex[1]-.7,apex[2]],shade(roof,i%2?.86:1));b.line(inkLift(a),inkLift(c));b.line(inkLift(a),inkLift([apex[0],apex[1]-.7,apex[2]]));}
  b.box(apex[0],apex[2],yaw,.55,.55,apex[1]-.75,apex[1]-.1,pal.glass,pal.brass);b.cone(apex[0],apex[2],apex[1]-.1,apex[1]+.4,.7,0,pal.brass,8,'steel');b.post(apex[0],apex[2],apex[1]+.4,apex[1]+1,.05,pal.brass,5,'steel');
  if(pal.theme==='taylor')for(let i=0;i<4;i++){const a=C[i]!,c=C[(i+1)%4]!;for(let t=.08;t<1;t+=.12){const p:V3=[a[0]+(c[0]-a[0])*t,ey-.02,a[2]+(c[2]-a[2])*t];b.tri(p,[p[0]+(c[0]-a[0])*.05,p[1],p[2]+(c[2]-a[2])*.05],[p[0]+(c[0]-a[0])*.025,p[1]-.28,p[2]+(c[2]-a[2])*.025],i%2?pal.tape[0]!:pal.tape[1]!);}}
  // Inner plinths for the goal backing details (lit in turn by the reading).
  const inner:V3[]=[];for(let i=0;i<10;i++){const a=i/10*Math.PI*2,p=F.W(Math.cos(a)*(hx-.9),Math.sin(a)*(hz-.9),floor);inner.push(p);}
  return {floor,inner};
}

/**
 * The summit observatory: an open astronomical pavilion. A low stone drum (a parapet with a
 * gateway at its door), eight slender columns carrying a ring beam, a ribbed copper dome
 * closed at its crown and open between its ribs so the view (and every camera) passes
 * through, and a brass telescope on a stone pier in the middle, aimed at the southern sky.
 */
export {OBSERVATORY_FORM};
export function observatory(b:CardBuilder,pal:MountainArtPalette,x:number,z:number,r:number,doorYaw:number):{floor:number;eye:V3;sign:SignSpot}{
  const g=footGround(x,z,0,r,r),floor=g.max+.15,sides=16,top=floor+OBSERVATORY_FORM.columns;
  const stone=pal.theme==='newfoundland'?pal.stone:pal.coping,wall=pal.theme==='newfoundland'?pal.walls[3]!:pal.theme==='taylor'?pal.walls[1]!:pal.plaster;
  // Platform.
  b.cone(x,z,g.min-.4,floor,r+.7,r+.6,stone,sides);
  for(let k=0;k<sides;k+=2){const a=k/sides*Math.PI*2;b.line([x,floor+.01,z],[x+Math.cos(a)*(r+.6),floor+.01,z+Math.sin(a)*(r+.6)],b.pencil);}
  // Parapet drum with a gateway toward the door.
  const door=Math.atan2(Math.cos(doorYaw),Math.sin(doorYaw));
  for(let k=0;k<sides;k++){const a0=k/sides*Math.PI*2,a1=(k+1)/sides*Math.PI*2,mid=Math.atan2(Math.sin((a0+a1)/2-door),Math.cos((a0+a1)/2-door));if(Math.abs(mid)<.3)continue;
    const P=(a:number,rr:number,y:number):V3=>[x+Math.cos(a)*rr,y,z+Math.sin(a)*rr];
    b.quadV(P(a0,r,floor),P(a1,r,floor),P(a1,r,floor+OBSERVATORY_FORM.parapet),P(a0,r,floor+OBSERVATORY_FORM.parapet),shade(wall,.75),shade(wall,.75),wall,wall);
    b.quadV(P(a1,r-.4,floor),P(a0,r-.4,floor),P(a0,r-.4,floor+OBSERVATORY_FORM.parapet),P(a1,r-.4,floor+OBSERVATORY_FORM.parapet),shade(wall,.7),shade(wall,.7),shade(wall,.9),shade(wall,.9));
    b.quad(P(a0,r-.45,floor+OBSERVATORY_FORM.parapet),P(a1,r-.45,floor+OBSERVATORY_FORM.parapet),P(a1,r+.08,floor+OBSERVATORY_FORM.parapet),P(a0,r+.08,floor+OBSERVATORY_FORM.parapet),pal.coping);
    b.line(P(a0,r+.09,floor+OBSERVATORY_FORM.parapet+.01),P(a1,r+.09,floor+OBSERVATORY_FORM.parapet+.01));}
  // Columns and a ring beam.
  const colour=pal.theme==='taylor'?pal.paperEdge:pal.theme==='newfoundland'?pal.trim:pal.coping;
  for(let k=0;k<8;k++){const a=k/8*Math.PI*2+Math.PI/16;b.post(x+Math.cos(a)*(r-.2),z+Math.sin(a)*(r-.2),floor,top,.14,colour,6);}
  b.cone(x,z,top,top+.3,r+.1,r+.1,pal.theme==='taylor'?pal.roofAlt:pal.brass,24,'steel',true);
  // Ribbed dome: a copper band at the spring, open ribs, a closed crown and a finial.
  const dome=pal.theme==='taylor'?pal.roofAlt:pal.theme==='newfoundland'?pal.walls[0]!:mix(pal.roofTile,[.55,.7,.62],.5);
  const D=(a:number,t:number):V3=>[x+Math.cos(a)*Math.cos(t)*(r+.1),top+.3+Math.sin(t)*(r+.1)*OBSERVATORY_FORM.domeRise,z+Math.sin(a)*Math.cos(t)*(r+.1)];
  for(let k=0;k<24;k++){const a0=k/24*Math.PI*2,a1=(k+1)/24*Math.PI*2;b.quad(D(a0,0),D(a1,0),D(a1,.28),D(a0,.28),shade(dome,.9));b.quad(D(a0,1.1),D(a1,1.1),D(a1,Math.PI/2),D(a0,Math.PI/2),shade(dome,1.05));b.line(D(a0,.28),D(a1,.28));b.line(D(a0,1.1),D(a1,1.1));}
  for(let k=0;k<12;k++){const a=k/12*Math.PI*2;for(let j=0;j<6;j++){const t0=.28+j/6*(1.1-.28),t1=.28+(j+1)/6*(1.1-.28);b.beam(D(a,t0),D(a,t1),.12,.12,dome,null,'steel');}}
  b.post(x,z,top+.3+(r+.1)*OBSERVATORY_FORM.domeRise,top+.9+(r+.1)*OBSERVATORY_FORM.domeRise,.06,pal.brass,5,'steel');
  // The telescope: a stone pier, a brass fork mount, the tube aimed at the southern sky.
  const aim=doorYaw+.55,tx=Math.sin(aim),tz=Math.cos(aim),pivot:V3=[x,floor+1.9,z],eye:V3=[x+tx*2.6,floor+3.3,z+tz*2.6],tail:V3=[x-tx*1.3,floor+1.2,z-tz*1.3];
  b.cone(x,z,floor,floor+1.3,.55,.42,pal.stone,8);b.post(x,z,floor+1.3,floor+1.9,.16,pal.iron,6,'steel');
  // A round brass tube with a dew shield at the sky end, a finder alongside and an eyepiece at the tail.
  const along=(u:number,side=0,up=0):V3=>[tail[0]+(eye[0]-tail[0])*u+Math.cos(aim)*side,tail[1]+(eye[1]-tail[1])*u+up,tail[2]+(eye[2]-tail[2])*u-Math.sin(aim)*side];
  b.tube([along(0),along(.82)],.19,pal.brass,10);b.tube([along(.8),along(1)],.24,shade(pal.brass,.85),10);
  for(const u of [.15,.5,.78])b.tube([along(u-.02),along(u+.02)],.215,shade(pal.brass,.75),10);
  b.tube([along(.35,.26,.12),along(.7,.26,.12)],.055,pal.iron,6);b.tube([along(-.08),along(.02)],.07,pal.iron,6);
  b.beam([pivot[0]-Math.cos(aim)*.35,pivot[1]-.3,pivot[2]+Math.sin(aim)*.35],[pivot[0]-Math.cos(aim)*.35,pivot[1]+.2,pivot[2]+Math.sin(aim)*.35],.08,.08,pal.brass,null,'steel');
  b.beam([pivot[0]+Math.cos(aim)*.35,pivot[1]-.3,pivot[2]-Math.sin(aim)*.35],[pivot[0]+Math.cos(aim)*.35,pivot[1]+.2,pivot[2]-Math.sin(aim)*.35],.08,.08,pal.brass,null,'steel');
  // The gateway: two posts at the parapet's ends and a lintel board for the sign.
  const gx=Math.sin(doorYaw),gz=Math.cos(doorYaw),px=Math.cos(doorYaw),pz=-Math.sin(doorYaw),gw=r*Math.sin(.3)+.1;
  for(const s of [-1,1])b.box(x+gx*r+px*gw*s,z+gz*r+pz*gw*s,doorYaw,.16,.16,floor,floor+2.75,colour,shade(colour,.8));
  b.beam([x+gx*r-px*(gw+.25),floor+2.62,z+gz*r-pz*(gw+.25)],[x+gx*r+px*(gw+.25),floor+2.62,z+gz*r+pz*(gw+.25)],.3,.35,pal.timber);
  b.shadow(x,z,r+.9,r+.9,0,groundHeightAt,.25);
  return {floor,eye,sign:{at:[x+gx*(r+.2),floor+2.25,z+gz*(r+.2)],yaw:doorYaw,w:gw*2-.1,h:.45}};
}
export {groundHeightAt};
