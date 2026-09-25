/**
 * World-space painted card: the shared kit (`cardKit.ts`) bound to spatial cells, with the
 * higher-level pieces a landscape needs (beams, swept profiles, prisms, gables, discs,
 * glass and water) and one `finish()` that turns the buckets into a few batched meshes.
 *
 * The look is the Skate v2 one — flat card with a grain, cut sides darkening to the foot,
 * ink on cut edges, pencil on joints, chalk on lit edges, soft contact shadows — so the
 * mountain, the town and the park read as one hand-built model.
 *
 * Draw calls are bounded: every bucket is merged per spatial cell (default 96 units), so
 * frustum culling still works across a 400-unit world without one draw per object.
 */
import * as THREE from 'three';
import {emptyMeshData,makeKit,rgb,shade,mix,INK_LIFT,type Bucket,type Kit,type ParkMeshData,type RGB,type V3} from './cardKit.ts';

export type {RGB,V3} from './cardKit.ts';
export {rgb,shade,mix} from './cardKit.ts';
export type CardTier='full'|'lite';
/** Extra buckets the park does not need: glass panels and running water. */
type CellData=ParkMeshData&{glass:Bucket;water:Bucket;flat:Bucket};
type Cell={data:CellData;kit:Kit};
export type CardOptions={ink:string;pencil?:string;chalk?:string;cell?:number;shadows?:boolean};
export type CardBuild={group:THREE.Group;water:THREE.Mesh[];materials:Record<string,THREE.Material>;dispose():void};

const cellData=():CellData=>({...emptyMeshData(),glass:{positions:[],normals:[],colors:[],uvs:[]},water:{positions:[],normals:[],colors:[],uvs:[]},flat:{positions:[],normals:[],colors:[],uvs:[]}});
const hasCanvas=()=>typeof document!=='undefined'&&typeof document.createElement==='function';
let paperShared:THREE.CanvasTexture|null|undefined;
/** Paper grain with a little pencil hatching, mean near white so vertex colours stay authored. Shared, never disposed. */
export function paperGrain():THREE.CanvasTexture|null{
  if(paperShared!==undefined)return paperShared;
  if(!hasCanvas())return paperShared=null;
  const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const g=canvas.getContext('2d');if(!g)return paperShared=null;
  g.fillStyle='#ffffff';g.fillRect(0,0,size,size);
  let seed=0x6d0a1;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<2400;i++){const v=205+Math.floor(rand()*45);g.fillStyle=`rgba(${v},${v-3},${v-9},${.16+rand()*.22})`;g.fillRect(rand()*size,rand()*size,1+rand()*1.5,1+rand()*1.5);}
  g.lineCap='round';
  for(let i=0;i<60;i++){const x=rand()*size,y=rand()*size,a=rand()*Math.PI,l=6+rand()*14;g.strokeStyle=`rgba(150,140,125,${.07+rand()*.07})`;g.lineWidth=.6;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+Math.cos(a+.5)*l*.5,y+Math.sin(a+.5)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();}
  for(let p=0;p<7;p++){const cx=rand()*size,cy=rand()*size,r=16+rand()*24;g.strokeStyle=`rgba(90,84,76,${.05+rand()*.04})`;g.lineWidth=.8;
    for(let k=-r;k<r;k+=4+rand()*2){g.beginPath();g.moveTo(cx+k-r*.4,cy+r*.4);g.lineTo(cx+k+r*.4,cy-r*.4);g.stroke();}}
  const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;return paperShared=t;
}

/** A shared clock for every animated card material (water sheen, wind). Quiet worlds hold it still. */
export const CARD_CLOCK={value:0};
/**
 * Running water: the card colour with a slow sheen that travels along the flow (uv.x is
 * the distance downstream, uv.y across), plus a soft bank darkening. Cheap: one sin pair.
 */
export function waterMaterial(color:string,opacity=.92):THREE.MeshStandardMaterial{
  const m=new THREE.MeshStandardMaterial({color,roughness:.22,metalness:.08,vertexColors:true,transparent:opacity<1,opacity,depthWrite:opacity>=1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  m.onBeforeCompile=shader=>{
    shader.uniforms.uFlow=CARD_CLOCK;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 flowUv;\nvarying vec2 vFlow;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFlow=flowUv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uFlow;\nvarying vec2 vFlow;')
      .replace('#include <color_fragment>',`#include <color_fragment>
      float across=abs(vFlow.y*2.0-1.0);
      float streak=sin(vFlow.x*0.9-uFlow*1.7+sin(vFlow.y*6.2831)*1.3)*0.5+0.5;
      float glint=smoothstep(0.82,1.0,streak*(1.0-across*0.7));
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*0.72,smoothstep(0.55,1.0,across));
      diffuseColor.rgb+=vec3(0.16,0.17,0.15)*glint;`);
  };
  m.customProgramCacheKey=()=>'hearth-card-water';
  return m;
}

/**
 * One builder per authored piece. Every primitive writes into the bucket of the spatial
 * cell under its anchor point; `finish()` merges each bucket per cell into a single mesh.
 */
export class CardBuilder{
  readonly tier:CardTier;
  readonly ink:RGB;readonly pencil:RGB;readonly chalk:RGB;
  private cells=new Map<string,Cell>();
  private cellSize:number;private shadows:boolean;
  constructor(readonly name:string,tier:CardTier,options:CardOptions){
    this.tier=tier;this.ink=rgb(options.ink);this.pencil=rgb(options.pencil??'#6f675c');this.chalk=rgb(options.chalk??'#fbf4e2');
    this.cellSize=options.cell??96;this.shadows=options.shadows??tier==='full';
  }
  /** The cell (data + kit) that owns a world point. */
  at(x:number,z:number):Cell{
    const key=`${Math.floor(x/this.cellSize)}:${Math.floor(z/this.cellSize)}`;let c=this.cells.get(key);
    if(!c){const data=cellData();c={data,kit:makeKit(data,this.ink)};this.cells.set(key,c);}return c;
  }
  /* ── Primitive wrappers ─────────────────────────────────────────────── */
  /** A turned box (card): top colour, sides darkening to the foot, inked top edges. */
  box(x:number,z:number,yaw:number,hx:number,hz:number,y0:number,y1:number,top:RGB,side:RGB=shade(top,.86),ink:RGB|null=this.ink,foot=.74){
    const c=this.at(x,z);c.kit.box(c.data.card,x,z,yaw,hx,hz,y0,y1,top,side,ink,foot);
  }
  /** A steel (painted metal) box: no paper grain, a little sheen. */
  steelBox(x:number,z:number,yaw:number,hx:number,hz:number,y0:number,y1:number,color:RGB,ink:RGB|null=null){
    const c=this.at(x,z);c.kit.box(c.data.steel,x,z,yaw,hx,hz,y0,y1,color,shade(color,.8),ink,.85);
  }
  line(a:V3,b:V3,color:RGB=this.ink){this.at(a[0],a[2]).kit.line(a,b,color);}
  tri(a:V3,b:V3,c:V3,color:RGB,bucket:'card'|'steel'|'paint'|'glow'|'flat'='card',vc?:readonly [RGB,RGB,RGB]){
    const cell=this.at((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3);cell.kit.tri(cell.data[bucket],a,b,c,color,.03,vc);
  }
  quad(p0:V3,p1:V3,p2:V3,p3:V3,color:RGB,bucket:'card'|'steel'|'paint'|'glow'|'flat'='card'){
    const cell=this.at((p0[0]+p2[0])/2,(p0[2]+p2[2])/2);cell.kit.quad(cell.data[bucket],p0,p1,p2,p3,color);
  }
  /** A quad with a colour per corner (p0,p1 → c0,c1; p2,p3 → c2,c3). */
  quadV(p0:V3,p1:V3,p2:V3,p3:V3,c0:RGB,c1:RGB,c2:RGB,c3:RGB,bucket:'card'|'steel'|'paint'|'flat'='card'){
    const cell=this.at((p0[0]+p2[0])/2,(p0[2]+p2[2])/2);cell.kit.quadV(cell.data[bucket],p0,p1,p2,p3,c0,c1,c2,c3,.03);
  }
  /** A cut side: bottom edge a0→a1, top edge b1→b0, darker at its foot. */
  side(a0:V3,a1:V3,b1:V3,b0:V3,color:RGB,foot=.72,bucket:'card'|'steel'='card'){
    const cell=this.at((a0[0]+b1[0])/2,(a0[2]+b1[2])/2);cell.kit.side(cell.data[bucket],a0,a1,b1,b0,color,foot);
  }
  post(x:number,z:number,y0:number,y1:number,r:number,color:RGB,sides=6,bucket:'card'|'steel'='card'){
    const c=this.at(x,z);c.kit.cylinder(c.data[bucket],x,z,y0,y1,r,color,sides,true);
  }
  tube(points:readonly V3[],r:number,color:RGB,sides=5){if(points.length<2)return;const p=points[0]!,c=this.at(p[0],p[2]);c.kit.tube(c.data.steel,points,r,color,sides);}
  flat(outline:readonly (readonly [number,number])[],a:V3,b:V3,color:RGB,ink:RGB|null=this.ink,inkBase=false){const c=this.at(a[0],a[2]);c.kit.flat(c.data.card,outline,a,b,color,ink,inkBase);}
  /** A soft contact shadow: an ellipse of alpha under a thing, lying on `groundAt`. */
  shadow(x:number,z:number,rx:number,rz:number,yaw:number,groundAt:(x:number,z:number)=>number,alpha=.34,color:RGB=[.1,.09,.08]){
    const c=this.at(x,z),s=c.data.shade,seg=this.tier==='full'?12:8,cy=Math.cos(yaw),sy=Math.sin(yaw);
    const P=(a:number,k:number):V3=>{const lx=Math.cos(a)*rx*k,lz=Math.sin(a)*rz*k,px=x+lx*cy+lz*sy,pz=z+lz*cy-lx*sy;return [px,groundAt(px,pz)+.05,pz];};
    const centre:V3=[x,groundAt(x,z)+.05,z];
    for(let i=0;i<seg;i++){const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2,i0=P(a0,.55),i1=P(a1,.55),o0=P(a0,1),o1=P(a1,1);
      const put=(p:V3,a:number)=>{s.positions.push(p[0],p[1],p[2]);s.colors.push(color[0],color[1],color[2],a);};
      put(centre,alpha);put(i0,alpha*.8);put(i1,alpha*.8);
      put(i0,alpha*.8);put(o0,0);put(o1,0);put(i0,alpha*.8);put(o1,0);put(i1,alpha*.8);}
  }
  /** A generic shade quad (alpha per edge pair), e.g. the dark foot of a wall on the grass. */
  shadeQuad(p0:V3,p1:V3,p2:V3,p3:V3,a0:number,a1:number,color:RGB=[.1,.09,.08]){const c=this.at(p0[0],p0[2]);c.kit.shadeQuad(p0,p1,p2,p3,color,a0,a1);}
  decal(c:V3,right:V3,up:V3,r:number,icon:number,color:RGB,normal?:V3){const cell=this.at(c[0],c[2]);cell.kit.decal(c,right,up,r,icon,[0,0,0],color,normal);}

  /* ── Composite pieces ───────────────────────────────────────────────── */
  /**
   * A square-section beam from a to b (width across, height up), like a sawn timber or a
   * stone lintel: lit top, darker sides, darkest underside; inked along its upper edges.
   */
  beam(a:V3,b:V3,w:number,h:number,color:RGB,ink:RGB|null=this.ink,bucket:'card'|'steel'='card'){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-6)return;
    const t=[dx/l,dy/l,dz/l];let sx=-t[2]!,sz=t[0]!;const sl=Math.hypot(sx,sz);
    if(sl<1e-6){sx=1;sz=0;}else{sx/=sl;sz/=sl;}
    // up = side × tangent
    const ux=0*t[2]!-sz*t[1]!,uy=sz*t[0]!-sx*t[2]!,uz=sx*t[1]!-0*t[0]!,ul=Math.hypot(ux,uy,uz)||1,u=[ux/ul,uy/ul,uz/ul];
    const off=(p:V3,s:number,v:number):V3=>[p[0]+sx*s*w/2+u[0]!*v*h/2,p[1]+u[1]!*v*h/2,p[2]+sz*s*w/2+u[2]!*v*h/2];
    const A=[off(a,-1,-1),off(a,1,-1),off(a,1,1),off(a,-1,1)],B=[off(b,-1,-1),off(b,1,-1),off(b,1,1),off(b,-1,1)];
    const top=shade(color,1.04),sideC=shade(color,.86),under=shade(color,.62);
    this.quad(A[3]!,A[2]!,B[2]!,B[3]!,top,bucket);
    this.quadV(A[0]!,B[0]!,B[3]!,A[3]!,shade(sideC,.82),shade(sideC,.82),sideC,sideC,bucket);
    this.quadV(A[1]!,B[1]!,B[2]!,A[2]!,shade(sideC,.82),shade(sideC,.82),sideC,sideC,bucket);
    this.quad(A[0]!,A[1]!,B[1]!,B[0]!,under,bucket);
    this.quad(A[0]!,A[1]!,A[2]!,A[3]!,sideC,bucket);this.quad(B[0]!,B[1]!,B[2]!,B[3]!,sideC,bucket);
    if(ink){this.line(lift(A[3]!),lift(B[3]!),ink);this.line(lift(A[2]!),lift(B[2]!),ink);}
  }
  /**
   * Sweep a 2D cross-section along a path. `profile` is a list of [across, up] points (an
   * open polyline or closed loop) in the frame {side, up} at each path point; `colorOf`
   * colours each profile segment (k) at each path step (i). Ink runs along chosen profile
   * vertices (`inkAt`), e.g. a kerb's top outer edge.
   */
  sweep(path:readonly {p:V3;side:V3;up:V3}[],profile:readonly (readonly [number,number])[]|((i:number)=>readonly (readonly [number,number])[]),colorOf:(k:number,i:number)=>RGB,options:{closed?:boolean;inkAt?:readonly number[];inkColor?:RGB;caps?:boolean;bucket?:'card'|'steel'|'flat';foot?:readonly number[]}={}){
    const prof=typeof profile==='function'?profile:()=>profile,n=prof(0).length,segs=options.closed?n:n-1,bucket=options.bucket??'card';
    const cache=new Map<number,readonly (readonly [number,number])[]>(),at=(i:number)=>{let p=cache.get(i);if(!p){p=prof(i);cache.set(i,p);}return p;};
    const P=(i:number,k:number):V3=>{const f=path[i]!,[s,v]=at(i)[k]!;return [f.p[0]+f.side[0]*s+f.up[0]*v,f.p[1]+f.side[1]*s+f.up[1]*v,f.p[2]+f.side[2]*s+f.up[2]*v];};
    for(let i=1;i<path.length;i++)for(let k=0;k<segs;k++){
      const k2=(k+1)%n,c=colorOf(k,i),footDark=options.foot?.includes(k);
      if(footDark)this.quadV(P(i-1,k),P(i,k),P(i,k2),P(i-1,k2),shade(c,.7),shade(c,.7),c,c,bucket==='flat'?'flat':bucket);
      else this.quad(P(i-1,k),P(i,k),P(i,k2),P(i-1,k2),c,bucket);
    }
    if(options.caps&&options.closed&&n>=3)for(const i of [0,path.length-1]){const pts=at(i).map((_,k)=>P(i,k)),c=shade(colorOf(0,Math.max(1,i)),.9);for(let k=1;k<n-1;k++)this.tri(pts[0]!,pts[k]!,pts[k+1]!,c,bucket==='steel'?'steel':'card');}
    if(options.inkAt)for(const k of options.inkAt)for(let i=1;i<path.length;i++)this.line(lift(P(i-1,k)),lift(P(i,k)),options.inkColor??this.ink);
  }
  /**
   * A polygon prism (x,z loop) from a floor (`y0`, per vertex allowed) to a top (`y1`).
   * Lit top, sides darkening to the foot, inked top outline.
   */
  prism(loop:readonly (readonly [number,number])[],y0:number|((x:number,z:number)=>number),y1:number,top:RGB,sideC:RGB=shade(top,.86),ink:RGB|null=this.ink,foot=.72){
    const Y0=typeof y0==='number'?()=>y0:y0,n=loop.length;
    const faces=THREE.ShapeUtils.triangulateShape(loop.map(([x,z])=>new THREE.Vector2(x,z)),[]);
    for(const f of faces){const a=loop[f[0]!]!,b=loop[f[1]!]!,c=loop[f[2]!]!;this.tri([a[0],y1,a[1]],[b[0],y1,b[1]],[c[0],y1,c[1]],top);}
    for(let i=0;i<n;i++){const a=loop[i]!,b=loop[(i+1)%n]!;
      this.side([a[0],Y0(a[0],a[1]),a[1]],[b[0],Y0(b[0],b[1]),b[1]],[b[0],y1,b[1]],[a[0],y1,a[1]],sideC,foot);
      if(ink)this.line([a[0],y1+INK_LIFT,a[1]],[b[0],y1+INK_LIFT,b[1]],ink);}
  }
  /**
   * A pitched (gable) roof over a turned rectangle: two slopes, two gable triangles filled
   * with the wall colour, a ridge and eave ink, and overhang `eave`.
   */
  gable(x:number,z:number,yaw:number,hx:number,hz:number,y:number,rise:number,roof:RGB,wall:RGB,eave=.35,thickness=.14){
    const c=Math.cos(yaw),s=Math.sin(yaw),W=(lx:number,lz:number,h:number):V3=>[x+lx*c+lz*s,h,z+lz*c-lx*s];
    const ex=hx+eave,ez=hz+eave*.6;
    // Ridge runs along local x.
    const r0=W(-ex,0,y+rise),r1=W(ex,0,y+rise),f0=W(-ex,ez,y-eave*rise/hz*.6),f1=W(ex,ez,y-eave*rise/hz*.6),b0=W(-ex,-ez,y-eave*rise/hz*.6),b1=W(ex,-ez,y-eave*rise/hz*.6);
    this.quad(f0,f1,r1,r0,shade(roof,1.02));this.quad(b1,b0,r0,r1,shade(roof,.82));
    // Undersides (thickness) so the eaves read from below.
    const dn=(p:V3):V3=>[p[0],p[1]-thickness,p[2]];
    this.quad(dn(f1),dn(f0),dn(r0),dn(r1),shade(roof,.55));this.quad(dn(b0),dn(b1),dn(r1),dn(r0),shade(roof,.55));
    this.quad(f0,f1,dn(f1),dn(f0),shade(roof,.7));this.quad(b1,b0,dn(b0),dn(b1),shade(roof,.7));
    for(const sx of [-1,1]){const g0=W(sx*hx,hz,y),g1=W(sx*hx,-hz,y),g2=W(sx*hx,0,y+rise);this.tri(g0,g1,g2,shade(wall,sx>0?.9:.8));}
    this.line(lift(r0),lift(r1));this.line(lift(f0),lift(f1));this.line(lift(b0),lift(b1));this.line(lift(f0),lift(r0));this.line(lift(f1),lift(r1));this.line(lift(b0),lift(r0));this.line(lift(b1),lift(r1));
  }
  /** A disc or cone (a crown, a dome segment, a cairn stone) as flat facets. */
  cone(x:number,z:number,y0:number,y1:number,r0:number,r1:number,color:RGB,sides=8,bucket:'card'|'steel'='card',ink=false){
    for(let k=0;k<sides;k++){const a0=k/sides*Math.PI*2,a1=(k+1)/sides*Math.PI*2;
      const p0:V3=[x+Math.cos(a0)*r0,y0,z+Math.sin(a0)*r0],p1:V3=[x+Math.cos(a1)*r0,y0,z+Math.sin(a1)*r0],q1:V3=[x+Math.cos(a1)*r1,y1,z+Math.sin(a1)*r1],q0:V3=[x+Math.cos(a0)*r1,y1,z+Math.sin(a0)*r1];
      const lit=.84+.2*Math.max(0,-Math.cos((a0+a1)/2-2.6));
      if(r1<1e-4)this.tri(p0,p1,q0,shade(color,lit),bucket);else this.quadV(p0,p1,q1,q0,shade(color,lit*.8),shade(color,lit*.8),shade(color,lit),shade(color,lit),bucket==='steel'?'steel':'card');
      if(r1>1e-4)this.tri([x,y1,z],q0,q1,shade(color,1.05),bucket);
      if(ink&&r1>1e-4)this.line(lift(q0),lift(q1));
    }
  }
  /** A dome (half sphere) of `rings` bands. */
  dome(x:number,y:number,z:number,r:number,color:RGB,sides=12,rings=5,bucket:'card'|'steel'='card'){
    for(let j=0;j<rings;j++){const t0=j/rings*Math.PI/2,t1=(j+1)/rings*Math.PI/2;
      this.cone(x,z,y+Math.sin(t0)*r,y+Math.sin(t1)*r,Math.cos(t0)*r,Math.cos(t1)*r,shade(color,.9+.1*j/rings),sides,bucket);}
  }
  /** A glass panel (both faces), tinted; frames are separate beams. */
  glass(p0:V3,p1:V3,p2:V3,p3:V3,color:RGB){const c=this.at((p0[0]+p2[0])/2,(p0[2]+p2[2])/2);c.kit.quad(c.data.glass,p0,p1,p2,p3,color,0);}
  /** Water: vertices with explicit flow uvs (u along the flow, v across 0..1). */
  water(a:V3,b:V3,c:V3,ua:readonly [number,number],ub:readonly [number,number],uc:readonly [number,number],color:RGB){
    const cell=this.at((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3),w=cell.data.water;
    // Wind every water triangle counter-clockwise from above, so its front (lit) face is up.
    const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    if(ny<0){const t=b;b=c;c=t;const tu=ub;ub=uc;uc=tu;}
    for(const [p,u] of [[a,ua],[b,ub],[c,uc]] as const){w.positions.push(p[0],p[1],p[2]);w.normals.push(0,1,0);w.colors.push(color[0],color[1],color[2]);w.uvs.push(u[0],u[1]);}
  }
  glow(p0:V3,p1:V3,p2:V3,p3:V3,color:RGB){this.quad(p0,p1,p2,p3,color,'glow');}

  finish(opts:{glassOpacity?:number;glassColor?:string;waterColor?:string;water?:THREE.Material}={}):CardBuild{
    const group=new THREE.Group();group.name=this.name;
    const owned:{dispose():void}[]=[];const own=<T extends {dispose():void}>(o:T):T=>{owned.push(o);return o;};
    const paper=paperGrain();
    const std=(p:THREE.MeshStandardMaterialParameters)=>own(new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,...p}));
    let materials:Record<string,THREE.Material>|null=null;
    const mats=()=>materials??=({
      card:std({map:paper,roughness:.9,flatShading:true}),
      flat:std({map:paper,roughness:.95,flatShading:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),
      steel:std({metalness:.3,roughness:.45,flatShading:true}),
      paint:std({map:paper,roughness:.75,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),
      glass:std({roughness:.08,metalness:.1,transparent:true,opacity:opts.glassOpacity??.34,depthWrite:false}),
      water:opts.water??own(waterMaterial(opts.waterColor??'#ffffff')),
      glow:own(new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})),
      decals:std({roughness:.8,transparent:true,opacity:.84,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),
      shade:own(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-3})),
      ink:own(new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:this.tier==='full'?.78:.62})),
    });
    const water:THREE.Mesh[]=[];
    for(const [key,cell] of this.cells){
      const d=cell.data,label=`${this.name} ${key}`;
      const add=(b:Bucket,m:string,cast:boolean,uv:'kit'|'flow'|'none'='kit')=>{
        if(!b.positions.length)return null;
        const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.colors,3));
        if(uv==='kit'&&b.uvs.length)g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));
        if(uv==='flow')g.setAttribute('flowUv',new THREE.Float32BufferAttribute(b.uvs,2));
        g.computeBoundingSphere();const mesh=new THREE.Mesh(g,mats()[m]!);mesh.name=`${label} ${m}`;mesh.castShadow=cast&&this.shadows;mesh.receiveShadow=m!=='glow';group.add(mesh);return mesh;
      };
      add(d.pad,'flat',false);add(d.flat,'flat',false);
      add(d.card,'card',true);add(d.steel,'steel',true,'none');add(d.paint,'paint',false);
      const g=add(d.glass,'glass',false,'none');if(g)g.renderOrder=2;
      const w=add(d.water,'water',false,'flow');if(w){w.renderOrder=1;water.push(w);}
      add(d.glow,'glow',false,'none');
      if(d.shade.positions.length){const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(d.shade.positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(d.shade.colors,4));geo.computeBoundingSphere();
        const m=new THREE.Mesh(geo,mats().shade!);m.name=`${label} shade`;m.renderOrder=1;group.add(m);}
      if(d.ink.positions.length){const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(d.ink.positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(d.ink.colors,3));geo.computeBoundingSphere();
        const l=new THREE.LineSegments(geo,mats().ink!);l.name=`${label} ink`;l.renderOrder=2;group.add(l);}
    }
    this.cells.clear();
    let dead=false;
    return {group,water,materials:materials??{},dispose(){if(dead)return;dead=true;group.removeFromParent();owned.forEach(o=>o.dispose());group.clear();}};
  }
}
const lift=(p:V3):V3=>[p[0],p[1]+INK_LIFT*4,p[2]];
export {lift as inkLift};
/** A small palette helper: a hex into the value ladder (dark, mid, light). */
export const ladder=(hex:string):{dark:RGB;mid:RGB;light:RGB}=>{const c=rgb(hex);return {dark:shade(c,.7),mid:c,light:mix(c,[1,1,1],.18)};};
