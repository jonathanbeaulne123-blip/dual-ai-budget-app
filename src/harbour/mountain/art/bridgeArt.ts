/**
 * Every bridge by its declared type, double-sided with real thickness and undersides:
 *  - masonry: a stone deck on segmental arches between piers with cutwaters, spandrel
 *    faces, a parapet with coping, abutments into the bank;
 *  - timber: a planked deck on stringers carried by braced trestle bents down to the
 *    gorge floor, post-and-rail parapets with diagonal braces;
 *  - metal-glass: a steel box deck over an underslung Warren truss on tall braced steel
 *    piers, glass balustrade panels between steel posts with a handrail.
 * The funicular's viaducts use the same three languages at their own gauge.
 */
import {groundHeightAt} from '../../scene/ground.ts';
import {BRIDGES,MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,type Bridge,type Point3} from '../definition.ts';
import {CardBuilder,shade,mix,inkLift,type V3,type RGB} from '../../art/cardScene.ts';
import {hash2} from '../../art/cardKit.ts';
import {ROAD_BANDS,roadBandColour} from './routeArt.ts';
import type {MountainArtPalette} from './palette.ts';

const UP:V3=[0,1,0];
type Frame={p:V3;side:V3;up:V3;hw:number};
/** Deck frames: the carrying line's samples where it has them (normal = left), else the polyline. */
function deckFrames(b:Bridge):Frame[]{
  if(b.carries==='road'||b.carries==='lane'){
    const line=b.carries==='road'?MOUNTAIN_ROAD_LINE:ORCHARD_LANE_LINE,S=line.samples;
    const i0=S.findIndex(s=>s.bridgeId===b.id),i1=S.length-1-[...S].reverse().findIndex(s=>s.bridgeId===b.id);
    if(i0>=0)return S.slice(Math.max(0,i0-1),Math.min(S.length,i1+2)).map(s=>({p:s.at as V3,side:s.normal as V3,up:UP,hw:s.halfWidth}));
  }
  return b.deck.map((p,i,all)=>{const a=all[Math.max(0,i-1)]!,c=all[Math.min(all.length-1,i+1)]!,dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz)||1;return {p:p as V3,side:[dz/l,0,-dx/l] as V3,up:UP,hw:b.halfWidth};});
}
const at=(f:Frame,across:number,up=0):V3=>[f.p[0]+f.side[0]*across,f.p[1]+up,f.p[2]+f.side[2]*across];
const ground=(p:V3)=>groundHeightAt(p[0],p[2]);
const atY=(f:Frame,across:number,y:number):V3=>[f.p[0]+f.side[0]*across,y,f.p[2]+f.side[2]*across];

/** The deck slab: road bands on top, cut sides, a darker underside. */
function deck(bld:CardBuilder,pal:MountainArtPalette,b:Bridge,F:Frame[],top:(k:number,i:number)=>RGB,skin:RGB){
  const th=b.deckThickness;
  if(b.carries==='road'||b.carries==='lane')bld.sweep(F,i=>ROAD_BANDS(F[i]!.hw),top,{bucket:'flat'});
  else bld.sweep(F,i=>[[-F[i]!.hw,.05],[F[i]!.hw,.05]],top,{bucket:'flat'});
  bld.sweep(F,i=>{const hw=F[i]!.hw+.05;return [[hw,.04],[hw,-th],[-hw,-th],[-hw,.04]];},k=>k===1?shade(skin,.58):shade(skin,.86),{foot:[0,2]});
  for(const s of [-1,1])for(let i=1;i<F.length;i++)bld.line(inkLift(at(F[i-1]!,s*(F[i-1]!.hw+.05),.05)),inkLift(at(F[i]!,s*(F[i]!.hw+.05),.05)));
}
/** Abutments: a stone block at each end, stepping down into the bank. */
function abutments(bld:CardBuilder,pal:MountainArtPalette,F:Frame[],th:number){
  for(const [f,dir] of [[F[0]!,-1],[F[F.length-1]!,1]] as const){
    // An abutment only where the deck meets the bank; a free end is carried by its trestles.
    if(f.p[1]-th-ground(f.p)>3)continue;
    const n=F.length,g=F[dir<0?Math.min(2,n-1):Math.max(0,n-3)]!,tx=g.p[0]-f.p[0],tz=g.p[2]-f.p[2],yaw=Math.atan2(tx,tz);
    const x=f.p[0],z=f.p[2],foot=Math.min(ground(f.p),f.p[1]-th)-1.2;
    bld.box(x,z,yaw,f.hw+.9,1.6,foot,f.p[1]-th+.02,pal.stone,pal.stoneDark);
    bld.box(x,z,yaw,f.hw+1.2,2.1,foot-.8,Math.min(f.p[1]-th-.6,foot+.6),shade(pal.stone,.9),pal.stoneDark);
  }
}
/** A stone parapet along one side of a deck. */
function parapet(bld:CardBuilder,pal:MountainArtPalette,F:Frame[],sign:number){
  const E=F.map(f=>({p:at(f,sign*f.hw),side:[f.side[0]*sign,0,f.side[2]*sign] as V3,up:UP}));
  bld.sweep(E,[[0,-.05],[0,.95],[-.07,.95],[-.07,1.1],[.57,1.1],[.57,.95],[.5,.95],[.5,-.3]],k=>k===3?pal.coping:k===6?pal.stoneDark:k===0?pal.stone:shade(pal.coping,.82),{inkAt:[3,4],foot:[6]});
  for(let i=1;i<E.length;i++){const a=E[i-1]!,c=E[i]!;bld.line(inkLift([a.p[0],a.p[1]+.48,a.p[2]]),inkLift([c.p[0],c.p[1]+.48,c.p[2]]),bld.pencil);}
}

function masonry(bld:CardBuilder,pal:MountainArtPalette,b:Bridge,F:Frame[]){
  const th=b.deckThickness;
  deck(bld,pal,b,F,(k,i)=>b.carries==='funicular'?pal.stone:roadBandColour(pal,k,i),pal.stone);
  for(const s of [-1,1])if(b.carries!=='funicular')parapet(bld,pal,F,s);
  abutments(bld,pal,F,th);
  // Supports along the deck: the ends and each pier; arches spring between them.
  const n=F.length,idx=[0,...b.piers.map(p=>{let best=0,d=Infinity;F.forEach((f,i)=>{const e=Math.hypot(f.p[0]-p[0],f.p[2]-p[2]);if(e<d){d=e;best=i;}});return best;}),n-1].filter((v,i,a)=>a.indexOf(v)===i).sort((x,y)=>x-y);
  for(let k=1;k<idx.length;k++){
    const i0=idx[k-1]!,i1=idx[k]!;if(i1-i0<2)continue;
    const spring=Math.max(ground(F[i0]!.p),ground(F[i1]!.p),Math.min(F[i0]!.p[1],F[i1]!.p[1])-th-Math.max(1.2,(i1-i0)*.55));
    for(let i=i0;i<i1;i++){
      const u0=(i-i0)/(i1-i0),u1=(i+1-i0)/(i1-i0),A=F[i]!,B=F[i+1]!;
      const deckY=(f:Frame)=>f.p[1]-th;
      const archY=(u:number,f:Frame)=>Math.min(deckY(f)-.35,spring+(deckY(f)-.35-spring)*Math.sqrt(Math.max(0,1-(2*u-1)**2)));
      const ya0=archY(u0,A),ya1=archY(u1,B);
      for(const s of [-1,1]){
        const a0=atY(A,s*(A.hw+.05),ya0),a1=atY(B,s*(B.hw+.05),ya1),d1=atY(B,s*(B.hw+.05),deckY(B)),d0=atY(A,s*(A.hw+.05),deckY(A));
        // Spandrel face between the arch and the deck, with the arch ring inked.
        bld.quadV(a0,a1,d1,d0,shade(pal.stone,.8),shade(pal.stone,.8),pal.stone,pal.stone);
        const r0=atY(A,s*(A.hw+.08),ya0),r1=atY(B,s*(B.hw+.08),ya1);bld.line(r0,r1);
        // Voussoir joints radiating from the ring.
        if((i-i0)%2===0)bld.line(r0,[r0[0],Math.min(deckY(A),ya0+.6),r0[2]],bld.pencil);
      }
      // The arch soffit.
      bld.quad(atY(A,-A.hw,ya0),atY(A,A.hw,ya0),atY(B,B.hw,ya1),atY(B,-B.hw,ya1),shade(pal.stone,.55));
    }
  }
  // Piers with cutwaters, down to the gorge floor.
  for(const k of idx.slice(1,-1)){
    const f=F[k]!,tx=F[Math.min(n-1,k+1)]!.p[0]-F[Math.max(0,k-1)]!.p[0],tz=F[Math.min(n-1,k+1)]!.p[2]-F[Math.max(0,k-1)]!.p[2],yaw=Math.atan2(tx,tz),g=ground(f.p);
    bld.box(f.p[0],f.p[2],yaw+Math.PI/2,f.hw+.3,1,g-.6,f.p[1]-th,pal.stone,pal.stoneDark);
    for(const s of [-1,1]){const cx=f.p[0]+f.side[0]*s*(f.hw+.6),cz=f.p[2]+f.side[2]*s*(f.hw+.6);bld.box(cx,cz,yaw+Math.PI/4,.7,.7,g-.6,Math.min(f.p[1]-th-1,g+3.5),pal.stone,pal.stoneDark);}
  }
}

function timber(bld:CardBuilder,pal:MountainArtPalette,b:Bridge,F:Frame[]){
  const th=b.deckThickness,n=F.length;
  // Planked deck: planks across with pencil gaps.
  deck(bld,pal,b,F,(k,i)=>b.carries==='road'||b.carries==='lane'?(k===0||k===4?shade(pal.plank,.9):shade(pal.plank,.95+hash2(i,k)*.1)):shade(pal.plank,.95+hash2(i,1)*.1),pal.timber);
  for(let i=0;i<n;i++){const f=F[i]!;bld.line(inkLift(at(f,-f.hw,.05)),inkLift(at(f,f.hw,.05)),bld.pencil);}
  // Stringers under the deck.
  for(const s of [-.8,-.3,.3,.8]){const pts=F.map(f=>at(f,s*f.hw,-th-.25));for(let i=1;i<n;i++)bld.beam(pts[i-1]!,pts[i]!,.35,.5,shade(pal.timber,.9),null);}
  // Parapets: posts every 1.6, two rails, a brace in each bay.
  for(const s of [-1,1]){
    const posts:V3[]=[];for(let i=0;i<n;i+=2){const f=F[i]!;posts.push(at(f,s*(f.hw+.1)));}
    for(const p of posts)bld.box(p[0],p[2],0,.11,.11,p[1]-th,p[1]+1.15,pal.timberLight,pal.timber);
    for(let i=1;i<posts.length;i++){const a=posts[i-1]!,c=posts[i]!;bld.beam([a[0],a[1]+1.08,a[2]],[c[0],c[1]+1.08,c[2]],.16,.12,pal.timberLight);bld.beam([a[0],a[1]+.55,a[2]],[c[0],c[1]+.55,c[2]],.1,.1,pal.timber,null);
      bld.beam([a[0],a[1]+.12,a[2]],[c[0],c[1]+1.0,c[2]],.08,.08,shade(pal.timber,.9),null);}
  }
  abutments(bld,pal,F,th);
  // Trestle bents: every few units, two raked posts, a cap, sills and X bracing to the ground.
  const spacing=b.carries==='funicular'?3:4;
  for(let i=spacing;i<n-spacing+1;i+=spacing){
    const f=F[i]!,g=Math.min(ground(at(f,-f.hw)),ground(at(f,f.hw)),ground(f.p));if(f.p[1]-th-g<1)continue;
    const capY=f.p[1]-th-.5,foot=g-.4,rake=Math.min(.18,.02+(capY-foot)*.012);
    const legTop=(s:number)=>at(f,s*(f.hw-.3),capY-f.p[1]),legFoot=(s:number)=>{const p=at(f,s*(f.hw-.3+(capY-foot)*rake),0);return [p[0],foot,p[2]] as V3;};
    for(const s of [-1,1])bld.beam(legFoot(s),legTop(s),.36,.36,pal.timber,null);
    bld.beam(at(f,-(f.hw+.4),capY-f.p[1]),at(f,f.hw+.4,capY-f.p[1]),.45,.4,pal.timberLight);
    // X bracing in storeys of about four units, with a sill at each storey.
    const storeys=Math.max(1,Math.round((capY-foot)/4));
    for(let k=0;k<storeys;k++){
      const y0=foot+(capY-foot)*k/storeys,y1=foot+(capY-foot)*(k+1)/storeys;
      const L=(s:number,y:number):V3=>{const u=(y-foot)/(capY-foot),a=legFoot(s),c=legTop(s);return [a[0]+(c[0]-a[0])*u,y,a[2]+(c[2]-a[2])*u];};
      bld.beam(L(-1,y0),L(1,y1),.16,.16,shade(pal.timber,.85),null);bld.beam(L(1,y0),L(-1,y1),.16,.16,shade(pal.timber,.85),null);
      if(k>0)bld.beam(L(-1,y0),L(1,y0),.22,.22,pal.timber,null);
    }
    bld.box(f.p[0],f.p[2],Math.atan2(f.side[0],f.side[2]),.6,f.hw+.3+(capY-foot)*rake,foot-.6,foot+.25,pal.stone,pal.stoneDark);
  }
}

function metalGlass(bld:CardBuilder,pal:MountainArtPalette,b:Bridge,F:Frame[]){
  const th=b.deckThickness,n=F.length,steel=pal.iron,paint=mix(pal.iron,pal.glassFrame,.3);
  deck(bld,pal,b,F,(k,i)=>b.carries==='road'||b.carries==='lane'?roadBandColour(pal,k,i):shade(pal.coping,.9),shade(steel,1.3));
  // Glass balustrade between slender posts, a round handrail.
  for(const s of [-1,1]){
    const E=F.map(f=>at(f,s*(f.hw+.02)));
    for(let i=0;i<n;i+=2){const p=E[i]!;bld.steelBox(p[0],p[2],0,.06,.06,p[1],p[1]+1.12,paint);}
    for(let i=2;i<n;i+=2){const a=E[i-2]!,c=E[i]!;bld.glass([a[0],a[1]+.12,a[2]],[c[0],c[1]+.12,c[2]],[c[0],c[1]+1.02,c[2]],[a[0],a[1]+1.02,a[2]],pal.glass);
      bld.line([a[0],a[1]+.12,a[2]],[c[0],c[1]+.12,c[2]],shade(pal.glass,.6));}
    bld.tube(E.map(p=>[p[0],p[1]+1.12,p[2]] as V3),.05,pal.brass,5);
  }
  // Underslung Warren truss: bottom chords two units down, diagonals alternating.
  const depth=b.carries==='funicular'?1.2:2.4;
  for(const s of [-1,1]){
    const top=F.map(f=>at(f,s*(f.hw-.2),-th)),bot=F.map(f=>at(f,s*(f.hw-.6),-th-depth));
    for(let i=1;i<n;i++)bld.beam(bot[i-1]!,bot[i]!,.22,.22,steel,null,'steel');
    for(let i=0;i+3<n;i+=3){bld.beam(top[i]!,bot[i+3>n-1?n-1:i+3]!,.14,.14,paint,null,'steel');bld.beam(bot[i+3>n-1?n-1:i+3]!,top[Math.min(n-1,i+6)]!,.14,.14,paint,null,'steel');}
  }
  for(let i=0;i<n;i+=3){const f=F[i]!;bld.beam(at(f,-(f.hw-.6),-th-depth),at(f,f.hw-.6,-th-depth),.14,.14,paint,null,'steel');}
  abutments(bld,pal,F,th+depth*.5);
  // Tall braced steel piers: two columns, cross ties and K-bracing, on a stone footing.
  for(const p of b.piers){
    let k=0,d=Infinity;F.forEach((f,i)=>{const e=Math.hypot(f.p[0]-p[0],f.p[2]-p[2]);if(e<d){d=e;k=i;}});
    const f=F[k]!,top=f.p[1]-th-depth,g=ground(f.p),storeys=Math.max(1,Math.round((top-g)/6));
    const col=(s:number,y:number):V3=>{const u=(y-g)/Math.max(1,top-g),spread=(f.hw-.6)+(1-u)*Math.min(3,(top-g)*.05);return at(f,s*spread,y-f.p[1]);};
    for(const s of [-1,1])bld.beam(col(s,g-.3),col(s,top),.5,.5,steel,null,'steel');
    for(let j=1;j<=storeys;j++){const y0=g+(top-g)*(j-1)/storeys,y1=g+(top-g)*j/storeys;bld.beam(col(-1,y1),col(1,y1),.24,.24,paint,null,'steel');bld.beam(col(-1,y0),col(1,y1),.14,.14,paint,null,'steel');bld.beam(col(1,y0),col(-1,y1),.14,.14,paint,null,'steel');}
    bld.box(f.p[0],f.p[2],Math.atan2(f.side[0],f.side[2]),1.2,f.hw+1.6,g-1,g+.4,pal.stone,pal.stoneDark);
  }
}

export function buildBridgeArt(bld:CardBuilder,pal:MountainArtPalette){
  for(const b of BRIDGES){
    const F=deckFrames(b);if(F.length<2)continue;
    if(b.type==='masonry')masonry(bld,pal,b,F);else if(b.type==='timber')timber(bld,pal,b,F);else metalGlass(bld,pal,b,F);
  }
}
export type {Point3};
