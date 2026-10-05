/**
 * The building grammar's shared construction (STYLE §1.1, §1.6): a local frame per record, faces and openings,
 * wall skins per dressing, roofs whose drawn planes ARE their collision planes, plinths to the lowest ground, open
 * rails at 1.05 and the soft foot shade. Generalised from `mountain/art/buildingArt.ts` (`house()`, `windowOn`,
 * `doorOn`, `awning`) so the town and the island read as one kit; that file is the live Mountain v2 region and is
 * not modified. Everything here is pure card-kit drawing into a caller's `CardBuilder`.
 *
 * Frame: local +z is the front (the `house()` frame): W(lx, lz, y) = [x + lx·cos + lz·sin, y, z + lz·cos − lx·sin].
 */
import {CardBuilder,shade,mix,inkLift,type V3,type RGB} from '../../../art/cardScene.ts';
import {ICON} from '../../../art/cardKit.ts';
import type {BuildingRecord,DressingTheme,Face} from '../../neighbourhoods/types.ts';
import type {StructureSolid} from '../../land/interfaces.ts';
import type {BuildingPalette} from './palette.ts';

export type Ground=(x:number,z:number)=>number;
export type Fr={x:number;z:number;yaw:number;c:number;s:number;W:(lx:number,lz:number,y:number)=>V3;P:(lx:number,lz:number)=>[number,number]};
export const frameOf=(x:number,z:number,yaw:number):Fr=>{const c=Math.cos(yaw),s=Math.sin(yaw);return {x,z,yaw,c,s,W:(lx,lz,y)=>[x+lx*c+lz*s,y,z+lz*c-lx*s],P:(lx,lz)=>[x+lx*c+lz*s,z+lz*c-lx*s]};};

/* ------------------------------------------------------------------ the one massing definition */

export type Role=StructureSolid['role'];
/**
 * Collision volumes in the record's local frame; y is relative to the finished floor, `'ground'` = sunk to the lowest
 * ground under the part, `{g: h}` (box tops only) = `h` above the highest ground under the part; a prism with `gTop`
 * measures each corner's y from the ground under that corner (terrain-following walls).
 */
export type Vol=
  |{t:'box';x:number;z:number;hx:number;hz:number;yaw?:number;y0:number|'ground';y1:number|{g:number};role:Role;walk?:boolean;surf:string}
  |{t:'prism';pts:readonly (readonly [number,number,number])[];y0:number|'ground';role:Role;walk?:boolean;surf:string;gTop?:boolean};
export interface Plan {
  vols:Vol[];
  /** Eave (or shaft) height above the floor, and the top of the building above the floor. */
  eave:number;
  top:number;
}
export interface DrawCtx {
  b:CardBuilder;rec:BuildingRecord;pal:BuildingPalette;ground:Ground;tier:'full'|'lite';full:boolean;theme:DressingTheme;
  F:Fr;floor:number;
  /** Deterministic hash in [0, 1) of the record id and a salt. */
  h:(salt:number)=>number;
}
export interface KindDef<P extends Plan=Plan> {plan(rec:BuildingRecord):P;draw(c:DrawCtx,p:P):void}

export const box=(x:number,z:number,hx:number,hz:number,y0:number|'ground',y1:number|{g:number},role:Role,surf:string,walk=false,yaw=0):Vol=>({t:'box',x,z,hx,hz,yaw,y0,y1,role,surf,walk});
export const prism=(pts:readonly (readonly [number,number,number])[],y0:number|'ground',role:Role,surf:string,walk=false):Vol=>({t:'prism',pts,y0,role,surf,walk});

/** Deterministic string hash → [0, 1). */
export function hashOf(id:string,salt=0):number{let h=2166136261^salt;for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>13;h=Math.imul(h,0x5bd1e995);h^=h>>>15;return (h>>>0)/4294967296;}
export const pick=<T>(a:readonly T[],i:number):T=>a[((Math.floor(i)%a.length)+a.length)%a.length]!;
export const num=(rec:BuildingRecord,k:string,d:number):number=>{const v=rec.params?.[k];return typeof v==='number'&&Number.isFinite(v)?v:d;};
export const flag=(rec:BuildingRecord,k:string,d:boolean):boolean=>{const v=rec.params?.[k];return typeof v==='boolean'?v:d;};
export const str=(rec:BuildingRecord,k:string,d:string):string=>{const v=rec.params?.[k];return typeof v==='string'?v:d;};
export const paintOf=(c:DrawCtx,list:readonly RGB[],salt=0):RGB=>pick(list,(c.rec.paint??Math.floor(c.h(salt)*997))+salt);

/** Lowest and highest ground under a turned rectangle (3×3 samples plus corners, grown by `m`). */
export function groundUnder(g:Ground,F:Fr,cx:number,cz:number,hx:number,hz:number,m=.3):{min:number;max:number}{
  let min=Infinity,max=-Infinity;
  for(const u of [-1,-.5,0,.5,1])for(const v of [-1,-.5,0,.5,1]){const [x,z]=F.P(cx+u*(hx+m),cz+v*(hz+m)),y=g(x,z);if(y<min)min=y;if(y>max)max=y;}
  return {min,max};
}

/* ------------------------------------------------------------------ faces */

export type Rect={cx:number;cz:number;hx:number;hz:number};
export const rectOf=(hx:number,hz:number,cx=0,cz=0):Rect=>({cx,cz,hx,hz});
/** A point on a face: u runs left→right as seen from outside, y absolute, o outward from the face plane. */
export function facePt(F:Fr,r:Rect,face:Face,u:number,y:number,o=0):V3{
  switch(face){
    case 'front':return F.W(r.cx+u,r.cz+r.hz+o,y);
    case 'back':return F.W(r.cx-u,r.cz-r.hz-o,y);
    case 'right':return F.W(r.cx+r.hx+o,r.cz-u,y);
    default:return F.W(r.cx-r.hx-o,r.cz+u,y);
  }
}
export const faceHalf=(r:Rect,face:Face)=>face==='front'||face==='back'?r.hx:r.hz;
export const FACES:readonly Face[]=['front','right','back','left'];
/** Outward unit normal (world) and the face's right direction (world). */
export function faceAxes(F:Fr,face:Face):{n:V3;right:V3}{
  const n=face==='front'?[F.s,0,F.c]:face==='back'?[-F.s,0,-F.c]:face==='right'?[F.c,0,-F.s]:[-F.c,0,F.s];
  const right=face==='front'?[F.c,0,-F.s]:face==='back'?[-F.c,0,F.s]:face==='right'?[-F.s,0,-F.c]:[F.s,0,F.c];
  return {n:n as unknown as V3,right:right as unknown as V3};
}
/** A flat rectangle on a face from (u0, y0) to (u1, y1), standing `o` proud. */
export function facePanel(b:CardBuilder,F:Fr,r:Rect,face:Face,u0:number,u1:number,y0:number,y1:number,col:RGB,o=.02,bucket:'card'|'glow'|'paint'='card'){
  b.quad(facePt(F,r,face,u0,y0,o),facePt(F,r,face,u1,y0,o),facePt(F,r,face,u1,y1,o),facePt(F,r,face,u0,y1,o),col,bucket);
}
/** A semicircular head (fan) on a face, centre (u, y), radius rad, `n` segments. */
export function faceArch(b:CardBuilder,F:Fr,r:Rect,face:Face,u:number,y:number,rad:number,col:RGB,o=.02,n=6,bucket:'card'|'glow'='card'){
  const c=facePt(F,r,face,u,y,o);
  for(let k=0;k<n;k++){const a0=k/n*Math.PI,a1=(k+1)/n*Math.PI;b.tri(c,facePt(F,r,face,u+Math.cos(a0)*rad,y+Math.sin(a0)*rad,o),facePt(F,r,face,u+Math.cos(a1)*rad,y+Math.sin(a1)*rad,o),col,bucket);}
}
export function faceArchLine(b:CardBuilder,F:Fr,r:Rect,face:Face,u:number,y:number,rad:number,col:RGB,o=.03,n=6){
  for(let k=0;k<n;k++){const a0=k/n*Math.PI,a1=(k+1)/n*Math.PI;b.line(facePt(F,r,face,u+Math.cos(a0)*rad,y+Math.sin(a0)*rad,o),facePt(F,r,face,u+Math.cos(a1)*rad,y+Math.sin(a1)*rad,o),col);}
}
const outline=(b:CardBuilder,F:Fr,r:Rect,face:Face,u0:number,u1:number,y0:number,y1:number,col:RGB,o=.035)=>{
  const p=[facePt(F,r,face,u0,y0,o),facePt(F,r,face,u1,y0,o),facePt(F,r,face,u1,y1,o),facePt(F,r,face,u0,y1,o)];for(let i=0;i<4;i++)b.line(p[i]!,p[(i+1)%4]!,col);
};

export type WindowOpts={lit?:boolean;arch?:boolean;shutters?:'open'|'closed'|'half'|false;shutter?:RGB;surround?:number;sill?:boolean;mullion?:boolean;head?:'cornice'|'pediment'|false;box?:RGB|false};
/**
 * A window on a face: a surround (trim), the glass (dark by day), the night glow card (the `glow` bucket) when lit,
 * a sill, mullion ink, shutters (persiane) open, half or closed, an optional head (cornicetta or pediment) and an
 * optional flower box. Lite keeps the opening, frame, glass and glow; it drops shutters, heads and boxes.
 */
export function windowAt(c:DrawCtx,r:Rect,face:Face,u:number,y:number,w:number,h:number,o:WindowOpts={}){
  const {b,pal,F,full}=c,s=o.surround??.14,arch=o.arch??false,rad=w/2,rectTop=arch?y+h-rad:y+h;
  // Surround.
  facePanel(b,F,r,face,u-w/2-s,u+w/2+s,y-s,rectTop+(arch?0:s),pal.trim,.015);
  if(arch)faceArch(b,F,r,face,u,rectTop,rad+s,pal.trim,.015,full?6:4);
  // Glass and glow.
  facePanel(b,F,r,face,u-w/2,u+w/2,y,rectTop,pal.glass,.03);
  if(arch)faceArch(b,F,r,face,u,rectTop,rad,pal.glass,.03,full?6:4);
  if(o.lit){facePanel(b,F,r,face,u-w/2+.04,u+w/2-.04,y+.04,rectTop,pal.glow,.04,'glow');if(arch)faceArch(b,F,r,face,u,rectTop,rad-.04,pal.glow,.04,full?6:4,'glow');}
  // Frame ink: mullion and transom (pencil in the frame colour), outline in ink.
  if(o.mullion!==false){b.line(facePt(F,r,face,u,y,.05),facePt(F,r,face,u,arch?rectTop+rad:rectTop,.05),pal.frame);b.line(facePt(F,r,face,u-w/2,y+(rectTop-y)*.6,.05),facePt(F,r,face,u+w/2,y+(rectTop-y)*.6,.05),pal.frame);}
  outline(b,F,r,face,u-w/2-s,u+w/2+s,y-s,rectTop+(arch?0:s),b.ink);
  if(arch)faceArchLine(b,F,r,face,u,rectTop,rad+s,b.ink,.035,full?6:4);
  if(o.sill!==false&&full){const a=facePt(F,r,face,u-w/2-s-.06,y-s,0),e=facePt(F,r,face,u+w/2+s+.06,y-s,0),{n}=faceAxes(F,face);b.quad(a,e,[e[0]+n[0]*.16,e[1],e[2]+n[2]*.16],[a[0]+n[0]*.16,a[1],a[2]+n[2]*.16],shade(pal.trim,1.04));}
  if(!full)return;
  if(o.head==='cornice')facePanel(b,F,r,face,u-w/2-s-.12,u+w/2+s+.12,rectTop+s+.04,rectTop+s+.2,shade(pal.trim,.95),.06);
  else if(o.head==='pediment'){const y0=rectTop+s+.06;b.tri(facePt(F,r,face,u-w/2-s-.15,y0,.07),facePt(F,r,face,u+w/2+s+.15,y0,.07),facePt(F,r,face,u,y0+.45,.07),shade(pal.trim,.97));b.line(facePt(F,r,face,u-w/2-s-.15,y0,.08),facePt(F,r,face,u,y0+.45,.08));b.line(facePt(F,r,face,u,y0+.45,.08),facePt(F,r,face,u+w/2+s+.15,y0,.08));}
  if(o.shutters){const sc=o.shutter??pal.shutters[0]!,lw=w/2+.02,top=arch?rectTop+rad*.6:rectTop;
    if(o.shutters==='closed'){facePanel(b,F,r,face,u-w/2,u+w/2,y,top,sc,.06);for(let k=1;k<6;k++)b.line(facePt(F,r,face,u-w/2,y+(top-y)*k/6,.07),facePt(F,r,face,u+w/2,y+(top-y)*k/6,.07),shade(sc,.7));b.line(facePt(F,r,face,u,y,.07),facePt(F,r,face,u,top,.07),shade(sc,.6));}
    else{for(const sd of o.shutters==='half'?[1]:[-1,1]){const u0=u+sd*(w/2+s+.02),u1=u0+sd*lw;facePanel(b,F,r,face,Math.min(u0,u1),Math.max(u0,u1),y,top,sc,.03);for(let k=1;k<5;k++)b.line(facePt(F,r,face,u0,y+(top-y)*k/5,.04),facePt(F,r,face,u1,y+(top-y)*k/5,.04),shade(sc,.7));}}}
  if(o.box){const {n}=faceAxes(F,face),a=facePt(F,r,face,u-w/2-.05,y-s,0),e=facePt(F,r,face,u+w/2+.05,y-s,0),d=.3;
    b.quad([a[0]+n[0]*d,a[1]-.26,a[2]+n[2]*d],[e[0]+n[0]*d,e[1]-.26,e[2]+n[2]*d],[e[0]+n[0]*d,e[1],e[2]+n[2]*d],[a[0]+n[0]*d,a[1],a[2]+n[2]*d],o.box);
    b.quad([a[0]+n[0]*.05,a[1]+.02,a[2]+n[2]*.05],[e[0]+n[0]*.05,e[1]+.02,e[2]+n[2]*.05],[e[0]+n[0]*d,e[1]+.22,e[2]+n[2]*d],[a[0]+n[0]*d,a[1]+.22,a[2]+n[2]*d],pick(pal.flowers,Math.floor(u*7+y*3)));}
}
/** A door: surround, leaf with panel ink and a brass pull, optionally arched, optionally with a fanlight glow. */
export function doorAt(c:DrawCtx,r:Rect,face:Face,u:number,y:number,w:number,h:number,col:RGB,o:{arch?:boolean;lit?:boolean;step?:boolean}={}){
  const {b,pal,F}=c,s=.14,rad=w/2,rectTop=o.arch?y+h-rad:y+h;
  facePanel(b,F,r,face,u-w/2-s,u+w/2+s,y,rectTop+(o.arch?0:s),pal.trim,.015);if(o.arch)faceArch(b,F,r,face,u,rectTop,rad+s,pal.trim,.015,5);
  facePanel(b,F,r,face,u-w/2,u+w/2,y,rectTop,col,.03);if(o.arch)faceArch(b,F,r,face,u,rectTop,rad,o.lit?pal.glass:col,.03,5);
  if(o.arch&&o.lit)faceArch(b,F,r,face,u,rectTop,rad-.05,pal.glow,.04,5,'glow');
  for(const v of [.35,(rectTop-y)*.55])b.line(facePt(F,r,face,u-w/2+.12,y+v,.05),facePt(F,r,face,u+w/2-.12,y+v,.05),shade(col,.6));
  b.line(facePt(F,r,face,u,y,.05),facePt(F,r,face,u,rectTop,.05),shade(col,.55));
  b.line(facePt(F,r,face,u+w/2-.18,y+h*.45,.06),facePt(F,r,face,u+w/2-.18,y+h*.52,.06),pal.brass);
  outline(b,F,r,face,u-w/2-s,u+w/2+s,y,rectTop+(o.arch?0:s),b.ink);
}

/* ------------------------------------------------------------------ walls, plinths, shade */

/** A plinth under a rectangle from below the lowest ground to the floor; returns the ground span. */
export function plinth(c:DrawCtx,r:Rect,top=c.floor,grow=.18,col?:RGB):{min:number;max:number}{
  const g=groundUnder(c.ground,c.F,r.cx,r.cz,r.hx,r.hz);
  if(top>g.min-.05){const [x,z]=c.F.P(r.cx,r.cz);c.b.box(x,z,c.F.yaw,r.hx+grow,r.hz+grow,g.min-.35,top,col??c.pal.plinth,c.pal.plinthDark);}
  return g;
}
/** The soft dark foot round a footprint (STYLE §1.2 rule 3: sun-independent, ≤ 0.6 tall): four shade strips on the ground. */
export function footShade(c:DrawCtx,r:Rect,grow=.2,reach=1.1,alpha=.3){
  const {F,b,ground}=c,P=(lx:number,lz:number):V3=>{const [x,z]=F.P(lx,lz);return [x,ground(x,z)+.04,z];};
  const hx=r.hx+grow,hz=r.hz+grow,R=reach;
  const loops:[[number,number],[number,number],[number,number],[number,number]][]=[
    [[-hx,hz],[hx,hz],[hx+R,hz+R],[-hx-R,hz+R]],[[hx,hz],[hx,-hz],[hx+R,-hz-R],[hx+R,hz+R]],[[hx,-hz],[-hx,-hz],[-hx-R,-hz-R],[hx+R,-hz-R]],[[-hx,-hz],[-hx,hz],[-hx-R,hz+R],[-hx-R,-hz-R]]];
  for(const q of loops)b.shadeQuad(P(r.cx+q[0][0],r.cz+q[0][1]),P(r.cx+q[1][0],r.cz+q[1][1]),P(r.cx+q[2][0],r.cz+q[2][1]),P(r.cx+q[3][0],r.cz+q[3][1]),alpha,0,[.1,.09,.08]);
}
/**
 * Walls of a rectangle from y0 to y1 in the dressing's construction: stucco/render (flat, the caller adds bands),
 * stone (coursed, quoined), board (board-and-batten), paper (white deckled edges round every face), clapboard
 * (lapped courses and white corner boards), shingle (coursed shingle), tin (corrugation).
 * `faces` limits the detail to the faces a row house shows (its party walls carry none).
 */
export function walls(c:DrawCtx,r:Rect,y0:number,y1:number,col:RGB,o:{skin?:BuildingPalette['skin'];faces?:readonly Face[];battenStep?:number;corner?:RGB}={}){
  const {b,F,pal,full}=c,skin=o.skin??pal.skin,faces=o.faces??FACES,[x,z]=F.P(r.cx,r.cz);
  b.box(x,z,F.yaw,r.hx,r.hz,y0,y1,shade(col,1.02),shade(col,.9));
  const H=y1-y0;
  const courses=(step:number,lineCol:RGB)=>{for(const f of faces){const hl=faceHalf(r,f);for(let y=y0+step;y<y1-.04;y+=step)b.line(facePt(F,r,f,-hl,y,.012),facePt(F,r,f,hl,y,.012),lineCol);}};
  if(skin==='clapboard'||skin==='shingle'){
    courses(skin==='shingle'?.3:.26,shade(col,.66));
    if(skin==='shingle'&&full)for(const f of faces){const hl=faceHalf(r,f);let k=0;for(let y=y0+.3;y<y1-.04;y+=.3,k++)for(let u=-hl+(k%2?.25:.5);u<hl;u+=.5)b.line(facePt(F,r,f,u,y,.012),facePt(F,r,f,u,y-.3,.012),shade(col,.74));}
    const cb=o.corner??pal.trim;
    for(const f of faces){const hl=faceHalf(r,f);facePanel(b,F,r,f,-hl-.01,-hl+.16,y0,y1,cb,.02);facePanel(b,F,r,f,hl-.16,hl+.01,y0,y1,cb,.02);}
  }else if(skin==='stone'){
    courses(.42,shade(col,.7));
    if(full)for(const f of faces){const hl=faceHalf(r,f);let k=0;for(let y=y0;y<y1-.05;y+=.42,k++)for(let u=-hl+(k%2?.38:.75)+(k%3)*.11;u<hl-.2;u+=.62+((k*7+Math.floor(u*3))%3)*.14)b.line(facePt(F,r,f,u,y,.012),facePt(F,r,f,u,Math.min(y1,y+.42),.012),shade(col,.72));}
    if(full)for(const f of faces){const hl=faceHalf(r,f);let k=0;for(let y=y0;y<y1-.2;y+=.42,k++){const w=k%2?.55:.32;facePanel(b,F,r,f,-hl,-hl+w,y,Math.min(y1,y+.42),pal.stoneLit,.014);facePanel(b,F,r,f,hl-w,hl,y,Math.min(y1,y+.42),pal.stoneLit,.014);}}
  }else if(skin==='board'){
    const step=o.battenStep??1.2,bat=pal.timberDark;
    for(const f of faces){const hl=faceHalf(r,f);for(let u=-hl+step/2;u<hl;u+=step){if(full)facePanel(b,F,r,f,u-.06,u+.06,y0,y1,bat,.03);else b.line(facePt(F,r,f,u,y0,.02),facePt(F,r,f,u,y1,.02),bat);}}
  }else if(skin==='paper'){
    const e=Math.min(.14,H*.06),edge=pal.paperEdge;
    for(const f of faces){const hl=faceHalf(r,f);facePanel(b,F,r,f,-hl,hl,y0,y0+e,edge,.016);facePanel(b,F,r,f,-hl,hl,y1-e,y1,edge,.016);if(full){facePanel(b,F,r,f,-hl,-hl+e,y0,y1,edge,.016);facePanel(b,F,r,f,hl-e,hl,y0,y1,edge,.016);}}
  }else if(skin==='tin'){
    for(const f of faces){const hl=faceHalf(r,f);for(let u=-hl+.2;u<hl;u+=.4)b.line(facePt(F,r,f,u,y0,.012),facePt(F,r,f,u,y1,.012),shade(col,.72));}
  }
}
/** A horizontal band (cornice, stringcourse, zoccolo) round a rectangle, `proud` out from the wall. */
export function band(c:DrawCtx,r:Rect,y0:number,y1:number,col:RGB,proud=.06){const [x,z]=c.F.P(r.cx,r.cz);c.b.box(x,z,c.F.yaw,r.hx+proud,r.hz+proud,y0,y1,shade(col,1.04),shade(col,.88));}
/** A heart (Taylor) or star stencil on a face. */
export function stencil(c:DrawCtx,r:Rect,face:Face,u:number,y:number,rad:number,icon:number,col:RGB){const {n,right}=faceAxes(c.F,face);c.b.decal(facePt(c.F,r,face,u,y,.05),right,[0,1,0],rad,icon,col,n);}
export {ICON};

/* ------------------------------------------------------------------ roofs (drawn planes = collision planes) */

export type RoofOpts={col:RGB;wall:RGB;ridge?:RGB;under?:RGB;thick?:number;ink?:boolean;finish?:BuildingPalette['eave'];edge?:RGB;seams?:number;seamCol?:RGB};
/** Gable roof over a rectangle, ridge along local x at z = r.cz; eaves overhang `ov` (sides) and `ovx` (verges). */
export function gableGeom(r:Rect,eave:number,rise:number,ov:number,ovx=ov){
  const ex=r.hx+ovx,ez=r.hz+ov,drop=ov*rise/r.hz,low=eave-drop,top=eave+rise;
  return {ex,ez,low,top,drop};
}
export function gableVols(r:Rect,eave:number,rise:number,ov:number,ovx=ov,surf='tile'):Vol[]{
  const g=gableGeom(r,eave,rise,ov,ovx),{cx,cz}=r;
  return [prism([[cx-g.ex,cz+g.ez,g.low],[cx+g.ex,cz+g.ez,g.low],[cx+g.ex,cz,g.top],[cx-g.ex,cz,g.top]],g.low,'roof',surf),
    prism([[cx-g.ex,cz,g.top],[cx+g.ex,cz,g.top],[cx+g.ex,cz-g.ez,g.low],[cx-g.ex,cz-g.ez,g.low]],g.low,'roof',surf)];
}
export function roofGable(c:DrawCtx,r:Rect,eave:number,rise:number,ov:number,o:RoofOpts,ovx=ov){
  const {b,F,pal,full}=c,g=gableGeom(r,eave,rise,ov,ovx),W=(lx:number,lz:number,y:number)=>F.W(r.cx+lx,r.cz+lz,y),t=o.thick??.16;
  const f0=W(-g.ex,g.ez,g.low),f1=W(g.ex,g.ez,g.low),r0=W(-g.ex,0,g.top),r1=W(g.ex,0,g.top),k0=W(-g.ex,-g.ez,g.low),k1=W(g.ex,-g.ez,g.low);
  b.quad(f0,f1,r1,r0,shade(o.col,1.03));b.quad(k1,k0,r0,r1,shade(o.col,.84));
  const dn=(p:V3):V3=>[p[0],p[1]-t,p[2]],under=o.under??shade(o.col,.55);
  b.quad(dn(f1),dn(f0),dn(r0),dn(r1),under);b.quad(dn(k0),dn(k1),dn(r1),dn(r0),under);
  b.quad(f0,f1,dn(f1),dn(f0),shade(o.col,.7));b.quad(k1,k0,dn(k0),dn(k1),shade(o.col,.7));
  for(const sx of [-1,1])b.tri(W(sx*r.hx,r.hz,eave),W(sx*r.hx,-r.hz,eave),W(sx*r.hx,0,g.top-.02),shade(o.wall,sx>0?.9:.8));
  for(const [a,e] of [[r0,r1],[f0,f1],[k0,k1],[f0,r0],[f1,r1],[k0,r0],[k1,r1]] as const)b.line(inkLift(a),inkLift(e));
  if(o.ridge)b.quad(W(-g.ex,.22,g.top-.22*rise/r.hz+.04),W(g.ex,.22,g.top-.22*rise/r.hz+.04),W(g.ex,-.22,g.top-.22*rise/r.hz+.04),W(-g.ex,-.22,g.top-.22*rise/r.hz+.04),o.ridge);
  // Courses (pencil) and standing seams.
  if(full){const n=Math.max(2,Math.round(r.hz/.55));for(let k=1;k<n;k++){const t2=k/n;for(const sz of [1,-1])b.line(W(-g.ex,sz*g.ez*(1-t2),g.low+(g.top-g.low)*t2+.01),W(g.ex,sz*g.ez*(1-t2),g.low+(g.top-g.low)*t2+.01),shade(o.col,.72));}}
  if(o.seams)for(let x=-g.ex+o.seams/2;x<g.ex;x+=o.seams)for(const sz of [1,-1])b.line(W(x,sz*g.ez,g.low+.02),W(x,0,g.top+.02),o.seamCol??shade(o.col,.8));
  eaveFinish(c,o.finish??pal.eave,[[f0,f1],[k1,k0]],[[f0,r0],[f1,r1],[k0,r0],[k1,r1]],o.edge);
}
/** Hip roof: ridge along x (length 2·(hx−hz) when hx > hz, a point when square), four planes. */
export function hipGeom(r:Rect,eave:number,rise:number,ov:number){const ex=r.hx+ov,ez=r.hz+ov,hr=Math.min(ex,ez),drop=ov*rise/Math.max(.1,Math.min(r.hx,r.hz)),rl=Math.max(0,ex-hr),rw=Math.max(0,ez-hr);return {ex,ez,low:eave-drop,top:eave+rise,rl,rw};}
export function hipVols(r:Rect,eave:number,rise:number,ov:number,surf='tile'):Vol[]{
  const g=hipGeom(r,eave,rise,ov),{cx,cz}=r,A:[number,number,number][]=[[cx-g.ex,cz+g.ez,g.low],[cx+g.ex,cz+g.ez,g.low],[cx+g.ex,cz-g.ez,g.low],[cx-g.ex,cz-g.ez,g.low]];
  const R0:[number,number,number]=[cx-g.rl,cz-g.rw,g.top],R1:[number,number,number]=[cx+g.rl,cz+g.rw,g.top];
  // Square hip → four triangles to the apex; long hip → two trapezoids and two triangles.
  if(g.rl<1e-6&&g.rw<1e-6)return [0,1,2,3].map(i=>prism([A[i]!,A[(i+1)%4]!,[cx,cz,g.top]],g.low,'roof',surf));
  if(g.rl>=g.rw)return [prism([A[0]!,A[1]!,[cx+g.rl,cz,g.top],[cx-g.rl,cz,g.top]],g.low,'roof',surf),prism([A[2]!,A[3]!,[cx-g.rl,cz,g.top],[cx+g.rl,cz,g.top]],g.low,'roof',surf),
    prism([A[1]!,A[2]!,[cx+g.rl,cz,g.top]],g.low,'roof',surf),prism([A[3]!,A[0]!,[cx-g.rl,cz,g.top]],g.low,'roof',surf)];
  return [prism([A[1]!,A[2]!,[cx,cz-g.rw,g.top],[cx,cz+g.rw,g.top]],g.low,'roof',surf),prism([A[3]!,A[0]!,[cx,cz+g.rw,g.top],[cx,cz-g.rw,g.top]],g.low,'roof',surf),
    prism([A[0]!,A[1]!,[cx,cz+g.rw,g.top]],g.low,'roof',surf),prism([A[2]!,A[3]!,[cx,cz-g.rw,g.top]],g.low,'roof',surf)];
  void R0;void R1;
}
export function roofHip(c:DrawCtx,r:Rect,eave:number,rise:number,ov:number,o:RoofOpts){
  const {b,F,pal,full}=c,g=hipGeom(r,eave,rise,ov),W=(lx:number,lz:number,y:number)=>F.W(r.cx+lx,r.cz+lz,y);
  const A=[W(-g.ex,g.ez,g.low),W(g.ex,g.ez,g.low),W(g.ex,-g.ez,g.low),W(-g.ex,-g.ez,g.low)];
  const along=g.rl>=g.rw,R0=along?W(-g.rl,0,g.top):W(0,g.rw,g.top),R1=along?W(g.rl,0,g.top):W(0,-g.rw,g.top);
  const lit=[1.03,.92,.8,.88],t=o.thick??.16,dn=(p:V3):V3=>[p[0],p[1]-t,p[2]],under=o.under??shade(o.col,.55);
  // Planes: front, right, back, left (the ridge ends serve as the apexes).
  const planes:V3[][]=along?[[A[0]!,A[1]!,R1,R0],[A[1]!,A[2]!,R1],[A[2]!,A[3]!,R0,R1],[A[3]!,A[0]!,R0]]:[[A[0]!,A[1]!,R0],[A[1]!,A[2]!,R1,R0],[A[2]!,A[3]!,R1],[A[3]!,A[0]!,R0,R1]];
  planes.forEach((p,i)=>{const col=shade(o.col,lit[i]!);if(p.length===4){b.quad(p[0]!,p[1]!,p[2]!,p[3]!,col);if(full)b.quad(dn(p[1]!),dn(p[0]!),dn(p[3]!),dn(p[2]!),under);}else{b.tri(p[0]!,p[1]!,p[2]!,col);if(full)b.tri(dn(p[1]!),dn(p[0]!),dn(p[2]!),under);}
    b.quad(p[0]!,p[1]!,dn(p[1]!),dn(p[0]!),shade(o.col,.7));});
  for(let i=0;i<4;i++){b.line(inkLift(A[i]!),inkLift(A[(i+1)%4]!));}
  b.line(inkLift(A[0]!),inkLift(along?R0:R0));b.line(inkLift(A[1]!),inkLift(along?R1:R0));b.line(inkLift(A[2]!),inkLift(R1));b.line(inkLift(A[3]!),inkLift(along?R0:R1));if(g.rl+g.rw>1e-6)b.line(inkLift(R0),inkLift(R1));
  if(o.ridge&&g.rl>.2)b.quad(W(-g.rl,.2,g.top+.02),W(g.rl,.2,g.top+.02),W(g.rl,-.2,g.top+.02),W(-g.rl,-.2,g.top+.02),o.ridge);
  if(full){const n=Math.max(2,Math.round(Math.min(g.ex,g.ez)/.6));for(let k=1;k<n;k++){const s=k/n,Lp=(p:V3,q:V3):V3=>[p[0]+(q[0]-p[0])*s,p[1]+(q[1]-p[1])*s,p[2]+(q[2]-p[2])*s];
    const a0=Lp(A[0]!,along?R0:R0),a1=Lp(A[1]!,along?R1:R0),a2=Lp(A[2]!,R1),a3=Lp(A[3]!,along?R0:R1);for(const [p,q] of [[a0,a1],[a1,a2],[a2,a3],[a3,a0]] as const)b.line([p[0],p[1]+.01,p[2]],[q[0],q[1]+.01,q[2]],shade(o.col,.72));}}
  eaveFinish(c,o.finish??pal.eave,[[A[0]!,A[1]!],[A[1]!,A[2]!],[A[2]!,A[3]!],[A[3]!,A[0]!]],[],o.edge);
}
/** A flat roof slab with a parapet (coping on top); returns nothing, collision is a slab + parapet boxes. */
export function roofFlat(c:DrawCtx,r:Rect,eave:number,parapet:number,col:RGB,wall:RGB,coping:RGB){
  const {b,F}=c,t=.25,W=(lx:number,lz:number,y:number)=>F.W(r.cx+lx,r.cz+lz,y);
  b.quad(W(-r.hx,r.hz,eave+.04),W(r.hx,r.hz,eave+.04),W(r.hx,-r.hz,eave+.04),W(-r.hx,-r.hz,eave+.04),col);
  if(parapet>0){const y1=eave+parapet,cy=y1+.08;
    // Parapet walls: their outer and inner faces (the coping ring caps them).
    const C=[[-r.hx,r.hz],[r.hx,r.hz],[r.hx,-r.hz],[-r.hx,-r.hz]] as const,I=[[-r.hx+t,r.hz-t],[r.hx-t,r.hz-t],[r.hx-t,-r.hz+t],[-r.hx+t,-r.hz+t]] as const;
    for(let i=0;i<4;i++){const j=(i+1)%4;b.side(W(C[i]![0],C[i]![1],eave),W(C[j]![0],C[j]![1],eave),W(C[j]![0],C[j]![1],y1),W(C[i]![0],C[i]![1],y1),shade(wall,.92));b.side(W(I[j]![0],I[j]![1],eave+.04),W(I[i]![0],I[i]![1],eave+.04),W(I[i]![0],I[i]![1],y1),W(I[j]![0],I[j]![1],y1),shade(wall,.8),.85);}
    // Coping: one lit ring on top, inked round its outer edge.
    const o=.05,ri=[W(-r.hx+t,r.hz-t,cy),W(r.hx-t,r.hz-t,cy),W(r.hx-t,-r.hz+t,cy),W(-r.hx+t,-r.hz+t,cy)],ro=[W(-r.hx-o,r.hz+o,cy),W(r.hx+o,r.hz+o,cy),W(r.hx+o,-r.hz-o,cy),W(-r.hx-o,-r.hz-o,cy)];
    for(let i=0;i<4;i++){const j=(i+1)%4;b.quad(ro[i]!,ro[j]!,ri[j]!,ri[i]!,coping);b.quad(ro[i]!,ro[j]!,[ro[j]![0],y1,ro[j]![2]],[ro[i]![0],y1,ro[i]![2]],shade(coping,.8));b.line(inkLift(ro[i]!),inkLift(ro[j]!));}}
}
export function flatVols(r:Rect,eave:number,parapet:number,surf='plaza'):Vol[]{
  const t=.25,v:Vol[]=[box(r.cx,r.cz,r.hx,r.hz,eave-.05,eave+.04,'roof',surf,true)];
  if(parapet>0)for(const [px,pz,hx,hz] of [[0,r.hz-t/2,r.hx,t/2],[0,-r.hz+t/2,r.hx,t/2],[r.hx-t/2,0,t/2,r.hz-t],[-r.hx+t/2,0,t/2,r.hz-t]] as const)v.push(box(r.cx+px,r.cz+pz,hx+.05,hz+.05,eave,eave+parapet+.08,'rail','stone'));
  return v;
}
/** Mono-pitch roof: high at the back (−z), low at the front (+z). */
export function shedGeom(r:Rect,eave:number,rise:number,ov:number){const ex=r.hx+ov,ez=r.hz+ov,k=rise/(2*r.hz);return {ex,ez,hi:eave+rise+ov*k,lo:eave-ov*k};}
export function shedVols(r:Rect,eave:number,rise:number,ov:number,surf='tile'):Vol[]{const g=shedGeom(r,eave,rise,ov);return [prism([[r.cx-g.ex,r.cz+g.ez,g.lo],[r.cx+g.ex,r.cz+g.ez,g.lo],[r.cx+g.ex,r.cz-g.ez,g.hi],[r.cx-g.ex,r.cz-g.ez,g.hi]],g.lo,'roof',surf)];}
export function roofShed(c:DrawCtx,r:Rect,eave:number,rise:number,ov:number,o:RoofOpts){
  const {b,F,pal}=c,g=shedGeom(r,eave,rise,ov),W=(lx:number,lz:number,y:number)=>F.W(r.cx+lx,r.cz+lz,y),t=o.thick??.14;
  const a=W(-g.ex,g.ez,g.lo),e=W(g.ex,g.ez,g.lo),h1=W(g.ex,-g.ez,g.hi),h0=W(-g.ex,-g.ez,g.hi),dn=(p:V3):V3=>[p[0],p[1]-t,p[2]];
  b.quad(a,e,h1,h0,shade(o.col,1.02));b.quad(dn(e),dn(a),dn(h0),dn(h1),o.under??shade(o.col,.55));
  for(const [p,q] of [[a,e],[e,h1],[h1,h0],[h0,a]] as const){b.quad(p,q,dn(q),dn(p),shade(o.col,.7));b.line(inkLift(p),inkLift(q));}
  // The raised back wall's two side triangles and the back strip, in the wall colour.
  for(const sx of [-1,1])b.tri(W(sx*r.hx,r.hz,eave),W(sx*r.hx,-r.hz,eave),W(sx*r.hx,-r.hz,eave+rise),shade(o.wall,sx>0?.9:.8));
  b.quad(W(r.hx,-r.hz,eave),W(-r.hx,-r.hz,eave),W(-r.hx,-r.hz,eave+rise),W(r.hx,-r.hz,eave+rise),shade(o.wall,.82));
  eaveFinish(c,o.finish??pal.eave,[[a,e]],[[a,h0],[e,h1]],o.edge);
}
/** Eave finishes per dressing: Taylor hangs paper scallops; Newfoundland nails a white fascia and verge boards. */
export function eaveFinish(c:DrawCtx,finish:BuildingPalette['eave'],eaves:readonly (readonly [V3,V3])[],verges:readonly (readonly [V3,V3])[],edge?:RGB){
  const {b,pal,full}=c;
  if(finish==='scallop'){
    for(const [p,q] of eaves){const L=Math.hypot(q[0]-p[0],q[2]-p[2]),n=Math.max(3,Math.round(L/(full?.7:1.1)));
      for(let k=0;k<n;k++){const t0=k/n,t1=(k+1)/n,tm=(t0+t1)/2,A=(t:number):V3=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t-.02,p[2]+(q[2]-p[2])*t],m=A(tm),rad=L/n/2;
        const s0=A(t0),s1=A(t1),lo:V3=[m[0],m[1]-rad*.8,m[2]];b.tri(s0,s1,lo,k%2?pal.paperEdge:(edge??pal.tape[0]!));if(full){b.tri(s0,lo,[ (s0[0]+lo[0])/2,(s0[1]+lo[1])/2-rad*.25,(s0[2]+lo[2])/2],k%2?pal.paperEdge:(edge??pal.tape[0]!));b.tri(lo,s1,[(s1[0]+lo[0])/2,(s1[1]+lo[1])/2-rad*.25,(s1[2]+lo[2])/2],k%2?pal.paperEdge:(edge??pal.tape[0]!));}}}
  }else if(finish==='fascia'){
    const col=edge??pal.trim;
    for(const [p,q] of [...eaves,...verges])b.quad([p[0],p[1]+.02,p[2]],[q[0],q[1]+.02,q[2]],[q[0],q[1]-.24,q[2]],[p[0],p[1]-.24,p[2]],col);
  }
}

/* ------------------------------------------------------------------ small fixtures */

/** A wall lantern on an iron bracket at a face point: the glass glows at night (glow bucket). */
export function wallLantern(c:DrawCtx,r:Rect,face:Face,u:number,y:number,body?:RGB,k=1){
  const {b,pal,F}=c,{n}=faceAxes(F,face),root=facePt(F,r,face,u,y,0),tip:V3=[root[0]+n[0]*.45*k,y,root[2]+n[2]*.45*k];
  b.line(root,tip,pal.iron);b.line(facePt(F,r,face,u,y-.35*k,0),tip,pal.iron);
  const {right}=faceAxes(F,face),q=(du:number,dv:number):V3=>[tip[0]+right[0]*du*k,y+(-.1+dv)*k,tip[2]+right[2]*du*k];
  b.quad(q(-.13,-.42),q(.13,-.42),q(.13,0),q(-.13,0),body??pal.lamp,'glow');
  b.tri(q(-.18,0),q(.18,0),[tip[0],y+.16*k,tip[2]],pal.iron);
}
/** A square rod between two points: four lit/shaded sides, no end caps (cheaper than a beam). */
export function rod(b:CardBuilder,a:V3,e:V3,w:number,col:RGB,bucket:'card'|'steel'='steel'){
  const dx=e[0]-a[0],dy=e[1]-a[1],dz=e[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-6)return;
  const t=[dx/l,dy/l,dz/l];let s=[-t[2]!,0,t[0]!];const sl=Math.hypot(s[0]!,s[2]!);if(sl<1e-6)s=[1,0,0];else s=[s[0]!/sl,0,s[2]!/sl];
  const u=[s[1]!*t[2]!-s[2]!*t[1]!,s[2]!*t[0]!-s[0]!*t[2]!,s[0]!*t[1]!-s[1]!*t[0]!],h=w/2;
  const O=(p:V3,i:number,j:number):V3=>[p[0]+s[0]!*i*h+u[0]!*j*h,p[1]+s[1]!*i*h+u[1]!*j*h,p[2]+s[2]!*i*h+u[2]!*j*h];
  const ring=[[-1,-1],[1,-1],[1,1],[-1,1]] as const,lit=[.66,.86,1.04,.86];
  for(let k=0;k<4;k++){const [i0,j0]=ring[k]!,[i1,j1]=ring[(k+1)%4]!;b.quad(O(a,i0,j0),O(a,i1,j1),O(e,i1,j1),O(e,i0,j0),shade(col,lit[k]!),bucket);}
}

/** A free-standing post (box section) from y0 to y1 at local (lx, lz). */
export function postAt(c:DrawCtx,lx:number,lz:number,y0:number,y1:number,w:number,col:RGB,ink=true){const [x,z]=c.F.P(lx,lz);c.b.box(x,z,c.F.yaw,w/2,w/2,y0,y1,col,shade(col,.84),ink?c.b.ink:null);}

/**
 * An open rail along local points (STYLE §1.6.4: 1.05, real bars): posts every ≤ 2.1 m, a top rail, a mid rail and a
 * kicker in timber (Classic), paper-doily pickets with washi tape (Taylor), white pickets on grey posts (Newfoundland).
 * Returns the collision volumes (thin walls at the drawn height).
 */
export function openRail(c:DrawCtx,pts:readonly (readonly [number,number])[],y:number,o:{h?:number;col?:RGB;draw?:boolean}={}):Vol[]{
  const {b,F,pal,full,theme}=c,H=o.h??1.05,col=o.col??(theme==='newfoundland'?pal.trim:theme==='taylor'?pal.paperEdge:mix(pal.timberLight,pal.timber,.15)),vols:Vol[]=[];
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1]!,e=pts[i]!,L=Math.hypot(e[0]-a[0],e[1]-a[1]);if(L<1e-3)continue;
    const yaw=Math.atan2(e[0]-a[0],e[1]-a[1])-Math.PI/2;
    vols.push(box((a[0]+e[0])/2,(a[1]+e[1])/2,L/2,.05,y,y+H,'rail','timber',false,yaw));
    if(o.draw===false)continue;
    const n=Math.max(1,Math.ceil(L/2.1)),A=(t:number,yy:number):V3=>F.W(a[0]+(e[0]-a[0])*t,a[1]+(e[1]-a[1])*t,yy);
    for(let k=0;k<=n;k++){if(k===0&&i>1)continue;const p=A(k/n,0);b.box(p[0],p[2],F.yaw+yaw,.055,.055,y-.02,y+H+.04,col,shade(col,.84));}
    b.beam(A(0,y+H),A(1,y+H),.1,.08,col);
    if(theme==='taylor'){const m=Math.max(2,Math.round(L/(full?.5:.9)));for(let k=1;k<m;k++){const p=A(k/m,y);b.line(p,[p[0],p[1]+H-.08,p[2]],col);b.tri([p[0]-.03,p[1]+H-.1,p[2]],[p[0]+.03,p[1]+H-.1,p[2]],[p[0],p[1]+H+.02,p[2]],pal.tape[k%pal.tape.length]!);}}
    else{b.beam(A(0,y+.5),A(1,y+.5),.05,.05,col,null);if(full)b.beam(A(0,y+.07),A(1,y+.07),.05,.12,shade(col,.92),null);
      if(theme==='newfoundland'&&full){const m=Math.max(2,Math.round(L/.4));for(let k=1;k<m;k++){const p=A(k/m,y+.1);b.line(p,[p[0],p[1]+H-.2,p[2]],pal.trim);}}}
  }
  return vols;
}
/**
 * A quarter-turned view of the record's frame (+90°): local′ (x′, z′) = local (z′, −x′). Kinds whose ridge runs
 * along the record's depth (the chapel's nave, the covered bridge) draw and plan in it; `turnVols` maps the plan back.
 */
export const turnedCtx=(c:DrawCtx):DrawCtx=>({...c,F:frameOf(c.F.x,c.F.z,c.F.yaw+Math.PI/2)});
export const turnVols=(vs:readonly Vol[]):Vol[]=>vs.map(v=>v.t==='box'?{...v,x:v.z,z:-v.x,yaw:(v.yaw??0)+Math.PI/2}:{...v,pts:v.pts.map(([x,z,y])=>[z,-x,y] as const)});
/** Plan corners of a turned w×d rectangle about the record origin (world x, z). */
export function footprintOf(rec:BuildingRecord):[number,number][]{const F=frameOf(rec.at[0],rec.at[2],rec.yaw),hx=rec.size.w/2,hz=rec.size.d/2;return [F.P(-hx,hz),F.P(hx,hz),F.P(hx,-hz),F.P(-hx,-hz)];}
/** Face of a record's door, defaulting to the front. */
export const doorFace=(rec:BuildingRecord):Face=>rec.door?.face??'front';
export {shade,mix,inkLift};
export type {V3,RGB};
