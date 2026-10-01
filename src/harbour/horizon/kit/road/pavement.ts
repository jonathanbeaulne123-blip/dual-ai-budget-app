/**
 * The corridor's baked solids as painted card (ROAD.md §4.1, §4.3; STYLE §1.5 `paved` / `plaza`, STYLE §3.1 Kerb and
 * Retaining wall; K3). `runtime/cards.ts` hands each corridor solid here instead of its flat single-colour path:
 *
 *  - `corridorDeck` (role deck, surface paved): the worn road `#c9b891` in swept bands like Mountain v2's ROAD_BANDS —
 *    a darker edge band (a stone gutter where a kerb stands), a slightly darker shoulder, paler wheel tracks in each lane,
 *    a paler crown — with a per-slab value step and pencil slab joints every ~6 eu across the lanes; its cut sides darken to
 *    the foot and its longitudinal top edges are inked.
 *  - `corridorKerb`: dressed stone, a chalked coping top with pencil joints every 1.2 eu, ink on the coping's edges.
 *  - `corridorWalk` (surface plaza): warm flags `#d3bf99`, a flag grid of pencil seams every 1.2 eu along and 1.1 eu
 *    across, a value per flag.
 *  - `corridorRetaining`: stacked stone in 0.5 eu courses with staggered perpends and pencil joints, a coping, weep holes
 *    every 3 eu at the foot of its visible face.
 *  - `corridorGuard` (role rail): a COLLIDER; the visible rail is the guard kit (`guards.ts`). Never drawn here.
 *
 * Bands, slabs, flags and courses are real splits of the solid's own triangles by isolines of the corridor frame
 * (lateral offset, arc length) or of height, coloured per vertex; nothing is a stretched texture and every drawn piece
 * lies exactly on the collision triangle it came from. UVs are world-planar (the shared paper grain).
 */
import {grain,hash2,mix,shade,UV_SCALE,INK_LIFT,type RGB} from '../../../art/cardKit.ts';
import type {CardBuilder} from '../../../art/cardScene.ts';
import type {StructureSolid} from '../../land/interfaces.ts';
import type {CorridorStation} from '../../land/corridor/types.ts';
import {CORRIDOR_SURFACE as K,PAVEMENT_BANDS as BAND} from './palette.ts';
import {splitBy,periodicCuts,type SV} from './split.ts';
import type {CorridorIndex} from './frames.ts';

export const CORRIDOR_SOLID_KINDS=Object.freeze(['corridorDeck','corridorKerb','corridorWalk','corridorRetaining','corridorGuard'] as const);
export type CorridorSolidKind=typeof CORRIDOR_SOLID_KINDS[number];
export const isCorridorSolid=(s:Pick<StructureSolid,'kind'>):s is StructureSolid&{kind:CorridorSolidKind}=>(CORRIDOR_SOLID_KINDS as readonly string[]).includes(s.kind);
/** Pavement rhythm (ROAD.md §4.1 / §4.3; Mountain v2 routeArt). */
export const PAVEMENT=Object.freeze({slab:6,edgeBand:.55,crown:.45,kerbJoint:1.2,flagAlong:1.2,flagAcross:1.1,course:.6,stone:1.6,weep:3});

type P3=[number,number,number];
type Bucket='card'|'flat';
const O=0,S=1,Y=2;

/** One triangle into a builder bucket, winding kept (outward faces stay outward), with the card kit's grain and UVs. */
function put(b:CardBuilder,bucket:Bucket,a:P3,c1:P3,c2:P3,ca:RGB,cb:RGB,cc:RGB,grainAmp=.025){
  const ux=c1[0]-a[0],uy=c1[1]-a[1],uz=c1[2]-a[2],vx=c2[0]-a[0],vy=c2[1]-a[1],vz=c2[2]-a[2];
  let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz);if(l<1e-10)return;nx/=l;ny/=l;nz/=l;
  const cx=(a[0]+c1[0]+c2[0])/3,cz=(a[2]+c1[2]+c2[2])/3,g=1+grainAmp*grain(cx,cz),d=b.at(cx,cz).data[bucket];
  d.positions.push(a[0],a[1],a[2],c1[0],c1[1],c1[2],c2[0],c2[1],c2[2]);d.normals.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
  d.colors.push(ca[0]*g,ca[1]*g,ca[2]*g,cb[0]*g,cb[1]*g,cb[2]*g,cc[0]*g,cc[1]*g,cc[2]*g);
  if(Math.abs(ny)>.5)d.uvs.push(a[0]*UV_SCALE,a[2]*UV_SCALE,c1[0]*UV_SCALE,c1[2]*UV_SCALE,c2[0]*UV_SCALE,c2[2]*UV_SCALE);
  else if(Math.abs(nx)>Math.abs(nz))d.uvs.push(a[2]*UV_SCALE,a[1]*UV_SCALE,c1[2]*UV_SCALE,c1[1]*UV_SCALE,c2[2]*UV_SCALE,c2[1]*UV_SCALE);
  else d.uvs.push(a[0]*UV_SCALE,a[1]*UV_SCALE,c1[0]*UV_SCALE,c1[1]*UV_SCALE,c2[0]*UV_SCALE,c2[1]*UV_SCALE);
}
function putPoly(b:CardBuilder,bucket:Bucket,poly:SV[],col:(v:SV)=>RGB,grainAmp?:number){for(let i=1;i<poly.length-1;i++){const a=poly[0]!,c=poly[i]!,d=poly[i+1]!;put(b,bucket,a.p,c.p,d.p,col(a),col(c),col(d),grainAmp);}}
const lift=(p:P3,k=4):P3=>[p[0],p[1]+INK_LIFT*k,p[2]];
/**
 * A pencil seam as a lit strip (0.05 eu) lying in its face, in the polygon-offset 'flat' bucket: it shades with the surface
 * (so it darkens at night like the paving, where an unlit line would glow) and costs two triangles per segment.
 */
function seam(b:CardBuilder,a:P3,c:P3,n:P3,across:[number,number],col:RGB,w=.05){
  const ny=Math.abs(n[1])>1e-3?n[1]:1e-3,dx=across[0]*w/2,dz=across[1]*w/2,dy=-(n[0]*dx+n[2]*dz)/ny,l=.004;
  const p0:P3=[a[0]-dx,a[1]-dy+l,a[2]-dz],p1:P3=[c[0]-dx,c[1]-dy+l,c[2]-dz],p2:P3=[c[0]+dx,c[1]+dy+l,c[2]+dz],p3:P3=[a[0]+dx,a[1]+dy+l,a[2]+dz];
  put(b,'flat',p0,p1,p2,col,col,col,0);put(b,'flat',p0,p2,p3,col,col,col,0);
}
/** A segment of the isoline f[k]=c through a polygon, as frame vertices (fields interpolated). */
function iso(poly:SV[],k:number,c:number):[SV,SV]|null{
  const out:SV[]=[];
  for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!,da=a.f[k]!-c,db=b.f[k]!-c;
    if((da<0&&db>=0)||(da>=0&&db<0)){const t=da/(da-db);out.push({p:[a.p[0]+(b.p[0]-a.p[0])*t,a.p[1]+(b.p[1]-a.p[1])*t,a.p[2]+(b.p[2]-a.p[2])*t],f:a.f.map((v,j)=>v+(b.f[j]!-v)*t)});}}
  return out.length>=2?[out[0]!,out[1]!]:null;
}
/** Clip a frame segment to lo ≤ f[k] ≤ hi. */
function clipSeg(seg:[SV,SV],k:number,lo:number,hi:number):[P3,P3]|null{
  const [a,b]=seg,fa=a.f[k]!,fb=b.f[k]!;let t0=0,t1=1;
  const d=fb-fa;if(Math.abs(d)<1e-9){if(fa<lo||fa>hi)return null;}else{let u0=(lo-fa)/d,u1=(hi-fa)/d;if(u0>u1)[u0,u1]=[u1,u0];t0=Math.max(t0,u0);t1=Math.min(t1,u1);if(t0>=t1)return null;}
  const at=(t:number):P3=>[a.p[0]+(b.p[0]-a.p[0])*t,a.p[1]+(b.p[1]-a.p[1])*t,a.p[2]+(b.p[2]-a.p[2])*t];return [at(t0),at(t1)];
}
/** Boundary edges (used by one face only) of a set of faces: the cut edges ink is drawn on. */
function boundary(faces:readonly SV[][],keep:(a:SV,b:SV)=>boolean):[P3,P3][]{
  const key=(p:P3)=>`${Math.round(p[0]*200)},${Math.round(p[1]*200)},${Math.round(p[2]*200)}`,edges=new Map<string,{a:SV;b:SV;n:number}>();
  for(const f of faces)for(let i=0;i<f.length;i++){const a=f[i]!,b=f[(i+1)%f.length]!,ka=key(a.p),kb=key(b.p),k=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;const e=edges.get(k);if(e)e.n++;else edges.set(k,{a,b,n:1});}
  const out:[P3,P3][]=[];for(const e of edges.values())if(e.n===1&&keep(e.a,e.b))out.push([e.a.p,e.b.p]);return out;
}
const longitudinal=(a:SV,b:SV)=>Math.abs(b.f[S]!-a.f[S]!)>1.5*Math.abs(b.f[O]!-a.f[O]!)&&Math.abs(b.f[S]!-a.f[S]!)>.05;

/**
 * The pavement profile across a station (ROAD.md §4.1, Mountain v2 ROAD_BANDS): knots at signed offsets, ascending, each
 * with the colour just left and just right of it. A HARD knot (different colours) is a crisp band edge (the edge band, the
 * gutter at a kerb); a SOFT knot is a vertex of a gradient (worn wheel tracks paler at their centre, the crown paler on the
 * centreline), so the soft bands cost no extra split beyond their vertex. Lite drops the wheel tracks.
 */
export type PavementKnot={o:number;left:RGB;right:RGB};
export function pavementProfile(st:Pick<CorridorStation,'half'|'left'|'right'|'median'>,tier:'full'|'lite'):PavementKnot[]{
  const L=st.left.paved,R=st.right.paved,h=st.half,m=st.median?.half??0,e=PAVEMENT.edgeBand;
  const edgeOf=(side:'left'|'right')=>{const k=st[side].edge;return k==='kerb'||k==='sidewalk'?BAND.gutter:BAND.edge;};
  const knots:PavementKnot[]=[];const soft=(o:number,c:RGB)=>knots.push({o,left:c,right:c}),hard=(o:number,l:RGB,r:RGB)=>knots.push({o,left:l,right:r});
  const shoulderL=L>h+e+.05,shoulderR=R>h+e+.05;
  hard(-L+e,edgeOf('left'),shoulderL?BAND.shoulder:BAND.lane);
  if(m){hard(-m-e,BAND.lane,BAND.gutter);hard(m+e,BAND.gutter,BAND.lane);}
  else{hard(-PAVEMENT.crown,BAND.lane,BAND.crown);hard(PAVEMENT.crown,BAND.crown,BAND.lane);}
  hard(R-e,shoulderR?BAND.shoulder:BAND.lane,edgeOf('right'));
  // Full: each lane is worn paler along its middle (a soft knot), the shoulder a touch darker (a soft knot at the lane line).
  if(tier==='full'){const lanes=m?[[-(h+m)/2,1],[(h+m)/2,1]]:[[-h*.54,1],[h*.54,1]];for(const [o] of lanes)soft(o!,BAND.wheel);if(shoulderL)soft(-h,BAND.lane);if(shoulderR)soft(h,BAND.lane);}
  knots.sort((p,q)=>p.o-q.o);
  // Drop knots that fall outside the paved width or collide (a narrow spur).
  return knots.filter((k,i)=>k.o>-L+1e-3&&k.o<R-1e-3&&(i===0||k.o-knots[i-1]!.o>.05));
}
/** The pavement colour at offset o inside interval `band` of a profile (interval i lies between knots i-1 and i). */
function profileColour(knots:readonly PavementKnot[],band:number,o:number):RGB{
  const a=knots[band-1],b=knots[band];
  if(!a)return b!.left;if(!b)return a.right;
  const t=Math.max(0,Math.min(1,(o-a.o)/Math.max(1e-6,b.o-a.o)));return mix(a.right,b.left,t);
}
/** The pavement colour at any offset (lite: the source triangle's own vertices carry it, no split). */
function colourAtOffset(knots:readonly PavementKnot[],o:number):RGB{let i=0;while(i<knots.length&&knots[i]!.o<=o)i++;return profileColour(knots,i,o);}
/** Band ids across a station (for tests and docs): the profile's colours by name. */
export function pavementBands(st:Pick<CorridorStation,'half'|'left'|'right'|'median'>,tier:'full'|'lite'):{cuts:number[];bands:(keyof typeof BAND)[]}{
  const knots=pavementProfile(st,tier),name=(c:RGB)=>(Object.keys(BAND) as (keyof typeof BAND)[]).find(k=>BAND[k]===c)??'lane';
  return {cuts:knots.map(k=>k.o),bands:[name(knots[0]!.left),...knots.map(k=>name(k.right))]};
}

type Ctx={b:CardBuilder;tier:'full'|'lite';index:CorridorIndex;only:ReadonlySet<string>};
type Located={sv:SV;st:CorridorStation|null};
function locateAll(ctx:Ctx,p:P3[]):Located[]{
  return p.map(q=>{const hit=ctx.index.locate(q[0],q[2],ctx.only)??ctx.index.locate(q[0],q[2],null);return {sv:{p:q,f:[hit?.o??0,hit?.s??0,q[1]]},st:hit&&hit.distance<40?hit.station:null};});
}
function* triangles(solid:StructureSolid,tier:'full'|'lite'):Generator<[P3,P3,P3]|null,void,void>{
  const p=tier==='lite'?(solid.litePositions??solid.positions):solid.positions,ix=tier==='lite'?(solid.liteIndices??solid.indices):solid.indices;
  for(let i=0;i<ix.length;i+=3){if(i%900===0)yield null;const v=(n:number):P3=>{const j=ix[i+n]!*3;return [p[j]!,p[j+1]!,p[j+2]!];};yield [v(0),v(1),v(2)];}
}
const normalOf=(a:P3,b:P3,c:P3):P3=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz)||1;return [nx/l,ny/l,nz/l];};
/** The corridor station for a face: the one nearest its centroid, else the first located vertex's. */
const faceStation=(ctx:Ctx,v:Located[])=>{const cx=(v[0]!.sv.p[0]+v[1]!.sv.p[0]+v[2]!.sv.p[0])/3,cz=(v[0]!.sv.p[2]+v[1]!.sv.p[2]+v[2]!.sv.p[2])/3,h=ctx.index.locate(cx,cz,ctx.only)??ctx.index.locate(cx,cz,null);return h&&h.distance<40?h.station:v.find(q=>q.st)?.st??null;};
/** A cut side's colour ladder: `foot` at the bottom of a face, full value `drop` below its top. */
function footColour(col:RGB,top:number,y:number,drop=.9,foot=.72):RGB{const t=Math.max(0,Math.min(1,1-(top-y)/drop));return shade(col,foot+(1-foot)*t);}

function* deck(ctx:Ctx,solid:StructureSolid):Generator<void,void,void>{
  const {b,tier}=ctx,tops:SV[][]=[];
  for(const t of triangles(solid,tier)){if(!t){yield;continue;}
    const n=normalOf(...t),v=locateAll(ctx,t),st=faceStation(ctx,v),poly=v.map(q=>q.sv);
    if(!st){putPoly(b,'card',poly,()=>n[1]<-.2?shade(K.road,.62):K.road);continue;}
    if(n[1]>.45){
      tops.push(poly);
      const knots=pavementProfile(st,tier);
      // Lite subtracts the crisp splits: the source triangle's vertices carry the profile's colour (a soft band read).
      if(tier==='lite'){putPoly(b,'card',poly,q=>colourAtOffset(knots,q.f[O]!),0);continue;}
      for(const piece of splitBy(poly,O,knots.map(k=>k.o))){
        const slabs=tier==='full'?splitBy(piece.poly,S,periodicCuts(piece.poly,S,PAVEMENT.slab,0,.05)):[{poly:piece.poly,band:0}];
        // The value step is per slab (a painted card road), not per triangle: no triangle patchwork on a long ribbon.
        for(const slab of slabs){const s=slab.poly.reduce((a,q)=>a+q.f[S]!,0)/slab.poly.length,g=.97+hash2(Math.floor(s/PAVEMENT.slab),piece.band+17)*.06;
          putPoly(b,'card',slab.poly,q=>shade(profileColour(knots,piece.band,q.f[O]!),g),0);}
      }
      // Pencil slab joints across the lanes (not across the edge band), like Mountain v2's road.
      if(tier==='full')for(const c of periodicCuts(poly,S,PAVEMENT.slab)){const seg=iso(poly,S,c);if(!seg)continue;const cl=clipSeg(seg,O,-st.left.paved+PAVEMENT.edgeBand,st.right.paved-PAVEMENT.edgeBand);if(cl)seam(b,cl[0],cl[1],n,[st.tangent[0],st.tangent[1]],K.seam,.04);}
    }else if(n[1]<-.2)putPoly(b,'card',poly,()=>shade(K.road,.62));
    else{const side=st[(v[0]!.sv.f[O]!+v[1]!.sv.f[O]!+v[2]!.sv.f[O]!)>=0?'right':'left'],col=side.edge==='kerb'||side.edge==='sidewalk'?K.stoneDark:mix(K.verge,K.road,.3),top=st.at[1];
      putPoly(b,'card',poly,q=>footColour(col,top,q.p[1],1.1));}
  }
  // Ink on the deck's cut edges: the longitudinal outline of its top surface.
  for(const [a,c] of boundary(tops,longitudinal))b.line(lift(a),lift(c));
}

function* kerb(ctx:Ctx,solid:StructureSolid):Generator<void,void,void>{
  const {b,tier}=ctx,tops:SV[][]=[];
  for(const t of triangles(solid,tier)){if(!t){yield;continue;}
    const n=normalOf(...t),v=locateAll(ctx,t),st=faceStation(ctx,v),poly=v.map(q=>q.sv),top=st?st.at[1]+.15:Math.max(t[0][1],t[1][1],t[2][1]);
    if(n[1]>.45){tops.push(poly);
      const pieces=tier==='full'?splitBy(poly,S,periodicCuts(poly,S,PAVEMENT.kerbJoint)):[{poly,band:0}];
      for(const piece of pieces){const s=piece.poly.reduce((a,q)=>a+q.f[S]!,0)/piece.poly.length,col=shade(K.coping,.95+hash2(Math.floor(s/PAVEMENT.kerbJoint),3)*.08);putPoly(b,'card',piece.poly,()=>col);}
      if(tier==='full'&&st)for(const c of periodicCuts(poly,S,PAVEMENT.kerbJoint)){const seg=iso(poly,S,c);if(seg)seam(b,seg[0].p,seg[1].p,n,[st.tangent[0],st.tangent[1]],K.seam,.035);}
    }else if(n[1]<-.2)putPoly(b,'card',poly,()=>shade(K.stone,.6));
    else{// The face toward the carriageway is dressed stone; the back face is the darker bed stone.
      const o=(poly[0]!.f[O]!+poly[1]!.f[O]!+poly[2]!.f[O]!)/3,toward=st?((n[0]*(-st.tangent[1])+n[2]*st.tangent[0])*Math.sign(o||1))<0:true;
      putPoly(b,'card',poly,q=>footColour(toward?K.stone:K.stoneDark,top,q.p[1],.4,.74));}
  }
  for(const [a,c] of boundary(tops,longitudinal))b.line(lift(a),lift(c));
}

function* walk(ctx:Ctx,solid:StructureSolid):Generator<void,void,void>{
  const {b,tier}=ctx,tops:SV[][]=[];
  for(const t of triangles(solid,tier)){if(!t){yield;continue;}
    const n=normalOf(...t),v=locateAll(ctx,t),st=faceStation(ctx,v),poly=v.map(q=>q.sv);
    if(n[1]>.45){tops.push(poly);
      const inner=st?(()=>{const side=(poly[0]!.f[O]!>=0)?st.right:st.left;return side.footway?.inner??side.paved+.25;})():0,sign=poly[0]!.f[O]!>=0?1:-1;
      // Flag grid: courses across every 1.2 eu along the walk, joints every 1.1 eu across from its inner edge (staggered).
      const across=(q:SV)=>(q.f[O]!*sign-inner);
      const rows=tier==='full'?splitBy(poly,S,periodicCuts(poly,S,PAVEMENT.flagAlong)):[{poly,band:0}];
      const tan:[number,number]=st?[st.tangent[0],st.tangent[1]]:[1,0],nrm:[number,number]=[-tan[1],tan[0]];
      for(const row of rows){const s=row.poly.reduce((a,q)=>a+q.f[S]!,0)/row.poly.length,r=Math.floor(s/PAVEMENT.flagAlong),phase=r%2?PAVEMENT.flagAcross/2:0;
        const withA=row.poly.map(q=>({p:q.p,f:[...q.f,across(q)]}));
        const flags=tier==='full'?splitBy(withA,3,periodicCuts(withA,3,PAVEMENT.flagAcross,phase)):[{poly:withA,band:0}];
        for(const fl of flags){const a=fl.poly.reduce((x,q)=>x+q.f[3]!,0)/fl.poly.length,col=shade(K.flags,.95+hash2(r,Math.floor((a-phase)/PAVEMENT.flagAcross)+5)*.08);putPoly(b,'card',fl.poly,()=>col);}
        if(tier==='full')for(const c of periodicCuts(withA,3,PAVEMENT.flagAcross,phase,.05)){const seg=iso(withA,3,c);if(seg)seam(b,seg[0].p,seg[1].p,n,nrm,K.seam,.035);}
      }
      for(const c of periodicCuts(poly,S,tier==='full'?PAVEMENT.flagAlong:PAVEMENT.flagAlong*2)){const seg=iso(poly,S,c);if(seg)seam(b,seg[0].p,seg[1].p,n,tan,K.seam,.04);}
    }else if(n[1]<-.2)putPoly(b,'card',poly,()=>shade(K.flags,.58));
    else{const top=Math.max(t[0][1],t[1][1],t[2][1]);putPoly(b,'card',poly,q=>footColour(K.stone,top,q.p[1],.5,.74));}
  }
  for(const [a,c] of boundary(tops,longitudinal))b.line(lift(a),lift(c));
}

function* retaining(ctx:Ctx,solid:StructureSolid):Generator<void,void,void>{
  const {b,tier}=ctx,tops:SV[][]=[],faces:{poly:SV[];n:P3;st:CorridorStation|null}[]=[];
  for(const t of triangles(solid,tier)){if(!t){yield;continue;}
    const n=normalOf(...t),v=locateAll(ctx,t),st=faceStation(ctx,v),poly=v.map(q=>q.sv);
    if(n[1]>.45){tops.push(poly);putPoly(b,'card',poly,()=>K.coping);continue;}
    if(n[1]<-.2){putPoly(b,'card',poly,()=>shade(K.mortar,.8));continue;}
    faces.push({poly,n,st});
    // Only the visible face is coursed (a cutting: the face toward the road; an embankment wall: the face away from it).
    const oMid=(poly[0]!.f[O]!+poly[1]!.f[O]!+poly[2]!.f[O]!)/3,toRoad=st?((n[0]*(-st.tangent[1])+n[2]*st.tangent[0])*Math.sign(oMid||1))<0:true,cutting=st?Math.max(...poly.map(q=>q.p[1]))>st.at[1]+.3:true;
    if(st&&toRoad!==cutting){const top=Math.max(...poly.map(q=>q.p[1]));putPoly(b,'card',poly,q=>footColour(K.stoneDark,top,q.p[1],1.2));continue;}
    // Lite: one stone value with a darker foot; the courses are pencil lines only.
    if(tier==='lite'){const top=Math.max(...poly.map(q=>q.p[1]));putPoly(b,'card',poly,q=>footColour(K.stone,top,q.p[1],1.2,.8));
      for(const cut of periodicCuts(poly,Y,PAVEMENT.course)){const seg=iso(poly,Y,cut);if(seg)b.line(seg[0].p,seg[1].p,K.pencil);}continue;}
    // Stacked stone: 0.5 eu courses of height, perpends staggered every 1.0 eu along the wall, a value per stone.
    const courses=splitBy(poly,Y,periodicCuts(poly,Y,PAVEMENT.course));
    for(const course of courses){const y=course.poly.reduce((a,q)=>a+q.p[1],0)/course.poly.length,c=Math.floor(y/PAVEMENT.course),phase=c%2?PAVEMENT.stone/2:0;
      const stones=tier==='full'?splitBy(course.poly,S,periodicCuts(course.poly,S,PAVEMENT.stone,phase)):[{poly:course.poly,band:0}];
      for(const s of stones){const sm=s.poly.reduce((a,q)=>a+q.f[S]!,0)/s.poly.length,tone=shade(K.stone,.82+hash2(c*7+3,Math.floor((sm-phase)/PAVEMENT.stone))*.22);
        putPoly(b,'card',s.poly,q=>{const yy=q.p[1]-c*PAVEMENT.course;return shade(tone,.9+.1*Math.max(0,Math.min(1,yy/PAVEMENT.course)));});}
      if(tier==='full')for(const cut of periodicCuts(course.poly,S,PAVEMENT.stone,phase)){const seg=iso(course.poly,S,cut);if(seg)b.line(lift(seg[0].p,1),lift(seg[1].p,1),K.pencil);}
    }
    for(const cut of periodicCuts(poly,Y,PAVEMENT.course)){const seg=iso(poly,Y,cut);if(seg)b.line(seg[0].p,seg[1].p,K.pencil);}
  }
  for(const [a,c] of boundary(tops,(a,c)=>Math.abs(c.f[S]!-a.f[S]!)>.05))b.line(lift(a),lift(c));
  // Weep holes every 3 eu at the foot of the visible face (a cutting: the face toward the road; an embankment: away).
  const bins=new Map<number,{foot:SV;top:number;n:P3}>();
  for(const f of faces){if(!f.st)continue;
    const o=f.poly.reduce((a,q)=>a+q.f[O]!,0)/3,toRoad=((f.n[0]*(-f.st.tangent[1])+f.n[2]*f.st.tangent[0])*Math.sign(o||1))<0,wallTop=Math.max(...f.poly.map(q=>q.p[1])),cutting=wallTop>f.st.at[1]+.3;
    if(toRoad!==cutting)continue;
    for(const c of periodicCuts(f.poly,S,PAVEMENT.weep,PAVEMENT.weep/2)){const seg=iso(f.poly,S,c);if(!seg)continue;const lo=seg[0].p[1]<seg[1].p[1]?seg[0]:seg[1],hi=Math.max(seg[0].p[1],seg[1].p[1]);
      const e=bins.get(c);if(!e)bins.set(c,{foot:lo,top:hi,n:f.n});else{if(lo.p[1]<e.foot.p[1]){e.foot=lo;e.n=f.n;}e.top=Math.max(e.top,hi);}}
  }
  for(const {foot,top,n} of bins.values()){if(top-foot.p[1]<.75)continue;
    const y=foot.p[1]+.38,cx=foot.p[0]+n[0]*.02,cz=foot.p[2]+n[2]*.02,rx=-n[2],rz=n[0],w=.09,h=.07;
    const q=(u:number,v:number):P3=>[cx+rx*u,y+v,cz+rz*u];
    const hole=shade(K.mortar,.45);put(b,'card',q(-w,-h),q(w,-h),q(w,h),hole,hole,hole);put(b,'card',q(-w,-h),q(w,h),q(-w,h),hole,hole,hole);
    put(b,'card',q(w,-h),q(-w,-h),q(w,h),hole,hole,hole);put(b,'card',q(w,h),q(-w,-h),q(-w,h),hole,hole,hole);
  }
}

/**
 * Draw one corridor solid (ROAD.md §4) into a card builder. `corridorGuard` draws nothing (a collider: the visible rail
 * is the guard kit). Cooperative: yields between batches like `addSolidSteps`.
 */
export function* addCorridorSolidSteps(b:CardBuilder,solid:StructureSolid,tier:'full'|'lite',index:CorridorIndex):Generator<void,void,void>{
  const ctx:Ctx={b,tier,index,only:new Set(solid.bedIds)};
  switch(solid.kind as CorridorSolidKind){
    case 'corridorDeck':yield* deck(ctx,solid);break;
    case 'corridorKerb':yield* kerb(ctx,solid);break;
    case 'corridorWalk':yield* walk(ctx,solid);break;
    case 'corridorRetaining':yield* retaining(ctx,solid);break;
    case 'corridorGuard':break;
  }
}
