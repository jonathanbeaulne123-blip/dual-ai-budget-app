/**
 * The glass dam and the Household Fund's water.
 *
 * Structure (static card): a battered stone plinth across the gorge up to the scale's zero
 * line, curved glass panels in steel frames from there to the crest, steel fins on the
 * town face, heavy dressed-stone abutments with stepped buttresses, a crest walkway with
 * rails on both sides, a stone apron with training walls and the river's outlet, the
 * Kitty reserve chambers as glass-and-brass cylinders on the west slope with a brass pipe
 * to the dam, and a brass gauge strip on the glass.
 *
 * Water (dynamic): the reservoir surface at the accepted level, the water's face seen
 * through the glass, the chambers' water and a brass float on the gauge. Unknown evidence
 * frosts the glass rather than showing an empty basin.
 */
import * as THREE from 'three';
import {groundHeightAt} from '../../scene/ground.ts';
import {DAM_PARTS,RESERVOIR,KITTY_CHAMBERS,type Point3} from '../definition.ts';
import {CardBuilder,shade,mix,inkLift,waterMaterial,type V3,type CardBuild} from '../../art/cardScene.ts';
import {hash2} from '../../art/cardKit.ts';
import type {MountainArtPalette} from './palette.ts';

const {centre:C,radius:R,halfAngle:HA,crest:CREST}=DAM_PARTS;
/** The scale's zero line: the plinth top, where the glass begins. */
export const DAM_ZERO=RESERVOIR.bottom;
export const DAM_FULL=RESERVOIR.level;
const onArc=(a:number,r:number,y:number):V3=>[C[0]+Math.sin(a)*r,y,C[2]+Math.cos(a)*r];
const ARC=24;
const g=(x:number,z:number)=>groundHeightAt(x,z);

/** The water plan inside the bowl at a level: rays from the bowl until the ground rises above it, the glass is met or the bowl's reach ends. */
export function reservoirOutline(level=DAM_FULL):[number,number][]{
  const cx=C[0]-2,cz=C[2]-6,out:[number,number][]=[];
  for(let k=0;k<64;k++){const a=k/64*Math.PI*2;let r=1;
    for(;r<34;r+=.5){const x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r;
      if(Math.hypot(x-C[0],z-C[2])>=R-.6&&Math.abs(Math.atan2(x-C[0],z-C[2]))<HA*1.02)break;
      if(g(x,z)>level+.25)break;}
    out.push([cx+Math.sin(a)*r,cz+Math.cos(a)*r]);}
  return out;
}
export type DamPlaques={fund:{at:V3;yaw:number};scale:{at:V3;yaw:number};chambers:{at:V3;yaw:number}};
/** The dam's static card into the shared builder; returns where its engraved plaques hang. */
export function buildDamStructure(b:CardBuilder,glassB:CardBuilder,pal:MountainArtPalette,tier:'full'|'lite'):DamPlaques{
  const stone=pal.stone,dark=pal.stoneDark,steel=pal.iron,fin=mix(pal.iron,pal.glassFrame,.35);
  // Plinth: a battered stone wall across the gorge, coursed.
  const courses=Math.max(3,Math.round((DAM_ZERO-DAM_PARTS.foot)/2.4));
  for(let k=0;k<ARC;k++){
    const a0=-HA+2*HA*k/ARC,a1=-HA+2*HA*(k+1)/ARC,f0=Math.min(g(...xz(onArc(a0,R+3,0))),g(...xz(onArc(a0,R,0))))-1,f1=Math.min(g(...xz(onArc(a1,R+3,0))),g(...xz(onArc(a1,R,0))))-1;
    if(f0>DAM_ZERO&&f1>DAM_ZERO)continue;
    for(let c=0;c<courses;c++){
      const y0=DAM_PARTS.foot-2+c*(DAM_ZERO-DAM_PARTS.foot+2)/courses,y1=DAM_PARTS.foot-2+(c+1)*(DAM_ZERO-DAM_PARTS.foot+2)/courses;
      const batter=(y:number)=>R+.6+(DAM_ZERO-y)*.2;
      const tone=shade(stone,.84+hash2(k,c)*.16);
      b.quadV(onArc(a0,batter(y0),y0),onArc(a1,batter(y0),y0),onArc(a1,batter(y1),y1),onArc(a0,batter(y1),y1),shade(tone,.85),shade(tone,.85),tone,tone);
      b.line(inkLift(onArc(a0,batter(y1)+.02,y1)),inkLift(onArc(a1,batter(y1)+.02,y1)),b.pencil);
      if((k+c)%2===0)b.line(onArc(a0,batter(y0)+.03,y0),onArc(a0,batter(y1)+.03,y1),b.pencil);
    }
    // Plinth top (a ledge under the glass) and its back face into the reservoir.
    b.quad(onArc(a0,R-1.4,DAM_ZERO),onArc(a1,R-1.4,DAM_ZERO),onArc(a1,R+.6,DAM_ZERO),onArc(a0,R+.6,DAM_ZERO),pal.coping);
    b.side(onArc(a0,R-1.4,DAM_PARTS.foot-2),onArc(a1,R-1.4,DAM_PARTS.foot-2),onArc(a1,R-1.4,DAM_ZERO),onArc(a0,R-1.4,DAM_ZERO),dark);
    b.line(inkLift(onArc(a0,R+.6,DAM_ZERO)),inkLift(onArc(a1,R+.6,DAM_ZERO)));
  }
  // Glass skin in frames: panels between mullions and transoms, fins on the town face.
  const rows=tier==='full'?8:5;
  for(let k=0;k<ARC;k++){
    const a0=-HA+2*HA*k/ARC,a1=-HA+2*HA*(k+1)/ARC;
    for(let j=0;j<rows;j++){const y0=DAM_ZERO+(CREST-1.4-DAM_ZERO)*j/rows,y1=DAM_ZERO+(CREST-1.4-DAM_ZERO)*(j+1)/rows;
      glassB.glass(onArc(a0,R,y0),onArc(a1,R,y0),onArc(a1,R,y1),onArc(a0,R,y1),mix(pal.glass,[1,1,1],.1*((k+j)%2)));
      b.line(onArc(a0,R+.05,y1),onArc(a1,R+.05,y1),shade(fin,.8));}
  }
  // Mullions: slender bright frames on every joint, deep fins every fourth, all inked.
  const frameCol=mix(pal.brass,pal.coping,.35);
  for(let k=0;k<=ARC;k++){
    const a=-HA+2*HA*k/ARC,big=k%4===0,top=CREST-1.4;
    if(big){const d=1.3,inner=onArc(a,R+.02,DAM_ZERO),outer=onArc(a,R+d,DAM_ZERO);b.steelBox((inner[0]+outer[0])/2,(inner[2]+outer[2])/2,a,.13,d/2,DAM_ZERO,top,frameCol,b.ink);
      b.line(onArc(a,R+d+.02,DAM_ZERO),onArc(a,R+d+.02,top));
      for(let j=1;j<rows;j++){const y=DAM_ZERO+(top-DAM_ZERO)*j/rows;b.line(onArc(a-.012,R+d*.5,y),onArc(a+.012,R+d*.5,y),b.pencil);}}
    else{const p=onArc(a,R+.08,0);b.steelBox(p[0],p[2],a,.06,.07,DAM_ZERO,top,frameCol,null);}
  }
  // Crest: a deep beam carrying the walkway, rails on both sides.
  for(let k=0;k<ARC;k++){
    const a0=-HA+2*HA*k/ARC,a1=-HA+2*HA*(k+1)/ARC;
    b.quad(onArc(a0,R-1.7,CREST),onArc(a1,R-1.7,CREST),onArc(a1,R+3.1,CREST),onArc(a0,R+3.1,CREST),mix(pal.coping,pal.plank,.25));
    b.side(onArc(a0,R+3.1,CREST-1.5),onArc(a1,R+3.1,CREST-1.5),onArc(a1,R+3.1,CREST),onArc(a0,R+3.1,CREST),shade(stone,.95),.7);
    b.side(onArc(a1,R-1.7,CREST-1.5),onArc(a0,R-1.7,CREST-1.5),onArc(a0,R-1.7,CREST),onArc(a1,R-1.7,CREST),shade(stone,.9),.7);
    b.quad(onArc(a0,R-1.7,CREST-1.5),onArc(a1,R-1.7,CREST-1.5),onArc(a1,R+3.1,CREST-1.5),onArc(a0,R+3.1,CREST-1.5),shade(stone,.5));
    for(const r of [R-1.7,R+3.1])b.line(inkLift(onArc(a0,r,CREST)),inkLift(onArc(a1,r,CREST)));
    b.line(inkLift(onArc(a0,R+.7,CREST)),inkLift(onArc(a0,R+2.5,CREST)),b.pencil);
  }
  for(const r of [R-1.55,R+2.95]){
    const rail:V3[]=[];for(let k=0;k<=ARC*2;k++){const a=-HA+2*HA*k/(ARC*2);rail.push(onArc(a,r,CREST+1.1));if(k%2===0)b.post(...postAt(onArc(a,r,0)),CREST,CREST+1.1,.05,steel,5,'steel');}
    b.tube(rail,.055,pal.brass,5);
    const mid:V3[]=rail.map(p=>[p[0],p[1]-.55,p[2]]);b.tube(mid,.03,steel,4);
  }
  // Abutments: dressed stone masses with stepped buttresses on the town side.
  for(const ab of DAM_PARTS.abutments){
    const a=ab.side==='west'?-HA*1.04:HA*1.04,[w,,d]=ab.size,yaw=a,x=ab.at[0],z=ab.at[2],foot=Math.min(g(x,z),DAM_PARTS.foot)-2,top=CREST+2;
    b.box(x,z,yaw,w/2,d/2,foot,top,pal.coping,stone);
    b.box(x,z,yaw,w/2+.4,d/2+.4,top,top+.5,shade(pal.coping,1.03),shade(pal.coping,.85));
    // Rusticated quoins: alternating long and short blocks proud of each corner.
    {const cs=Math.cos(yaw),sn=Math.sin(yaw);for(let c=0;c*1.5<top-foot;c++){const y0=foot+c*1.5,long=c%2===0;for(const [lx,lz] of [[-w/2,d/2],[w/2,d/2]] as const){const bx=x+lx*cs+lz*sn,bz=z+lz*cs-lx*sn;b.box(bx,bz,yaw,long?.9:.5,long?.5:.9,y0+.05,y0+1.4,shade(pal.coping,.98),shade(stone,.9),b.ink);}}}
    {const cs=Math.cos(yaw),sn=Math.sin(yaw),W=(lx:number,lz:number,y:number):V3=>[x+lx*cs+lz*sn,y,z+lz*cs-lx*sn];
      for(let c=1;c<Math.floor((top-foot)/3);c++){const y=foot+c*3;b.line(W(-w/2,d/2+.02,y),W(w/2,d/2+.02,y),b.pencil);b.line(W(-w/2-.02,-d/2,y),W(-w/2-.02,d/2,y),b.pencil);b.line(W(w/2+.02,-d/2,y),W(w/2+.02,d/2,y),b.pencil);
        const jx=((c%2)-.5)*w*.4;b.line(W(jx,d/2+.02,y),W(jx,d/2+.02,y+3),b.pencil);}}
    // Buttresses: three steps down the town face.
    const out=[Math.sin(a),Math.cos(a)] as const,side=[Math.cos(a),-Math.sin(a)] as const;
    for(const s of [-1,1])for(let st=0;st<3;st++){
      const r=d/2+1.2+st*1.8,bx=x+out[0]*r+side[0]*s*(w/2-1),bz=z+out[1]*r+side[1]*s*(w/2-1),bt=top-6-st*9;
      if(bt<=foot+1)continue;b.box(bx,bz,yaw,.9,1.2,Math.min(g(bx,bz),foot)-1,bt,pal.coping,shade(stone,.92));
    }
  }
  // Apron, training walls and the river's outlet under the plinth.
  const [ax,ay,az]=DAM_PARTS.apron.at,[ahx,ahz]=DAM_PARTS.apron.half;
  b.box(ax,az,0,ahx,ahz,Math.min(ay,g(ax,az))-1.2,ay+.05,shade(pal.coping,.92),stone);
  for(let i=-ahx;i<=ahx;i+=2)b.line(inkLift([ax+i,ay+.05,az-ahz]),inkLift([ax+i,ay+.05,az+ahz]),b.pencil);
  for(const s of [-1,1])b.box(ax+s*(ahx+.4),az,0,.45,ahz+1,ay-1,ay+1.4,pal.coping,stone);
  const mouth=onArc(0,R+4.2,DAM_PARTS.foot);
  for(let k=0;k<8;k++){const a0=k/8*Math.PI,a1=(k+1)/8*Math.PI,P=(t:number,r:number):V3=>[mouth[0]+Math.cos(t)*r,DAM_PARTS.foot+.1+Math.sin(t)*r*.9,mouth[2]+.05];
    b.tri(P(0,0),P(a0,1.6),P(a1,1.6),[.12,.13,.14]);b.line(P(a0,1.75),P(a1,1.75));}
  // Kitty reserve chambers: stone base, glass drum in brass bands, a brass lid; a pipe to the dam.
  for(const ch of KITTY_CHAMBERS){
    const [x,y,z]=ch.at,rr=ch.radius,h=ch.depth;
    b.cone(x,z,y-.8,y+.6,rr+.5,rr+.4,pal.coping,14);
    for(const band of [y+.6,y+h*.45,y+h-1.2])b.cone(x,z,band,band+.22,rr+.08,rr+.08,pal.brass,16,'steel');
    for(let k=0;k<16;k++){const a0=k/16*Math.PI*2,a1=(k+1)/16*Math.PI*2,P=(a:number,yy:number):V3=>[x+Math.cos(a)*rr,yy,z+Math.sin(a)*rr];
      b.glass(P(a0,y+.6),P(a1,y+.6),P(a1,y+h-1),P(a0,y+h-1),pal.glass);if(k%4===0)b.steelBox(...xzAt(P(a0,0)),0,.05,.05,y+.6,y+h-1,pal.brass);}
    b.dome(x,y+h-1,z,rr+.15,pal.brass,14,4,'steel');b.post(x,z,y+h-1+rr*.95,y+h+rr*.95-.2,.08,pal.brass,6,'steel');
    const damEnd=onArc(-HA*.92,R+.8,DAM_ZERO+1.5);
    b.tube([[x+rr*.6,y+1,z+rr*.6],[x+rr+1.2,y+1,z+rr*.4],[damEnd[0],Math.max(y+1,damEnd[1]),damEnd[2]]],.22,pal.brass,6);
  }
  const east=DAM_PARTS.abutments.find(a=>a.side==='east')!,ea=HA*1.04,face=[Math.sin(ea),Math.cos(ea)] as const,cs=Math.cos(ea),sn=Math.sin(ea);
  const plateAt=(lx:number,y:number):V3=>[east.at[0]+face[0]*(east.size[2]/2+.06)+cs*lx,y,east.at[2]+face[1]*(east.size[2]/2+.06)-sn*lx];
  const ch=KITTY_CHAMBERS[0]!;
  return {fund:{at:plateAt(0,CREST-4.2),yaw:ea},scale:{at:plateAt(0,CREST-6.4),yaw:ea},chambers:{at:[ch.at[0]+ch.radius+.8,ch.at[1]+1.6,ch.at[2]+1.5],yaw:Math.atan2(1,1)}};
}
const xz=(p:V3):[number,number]=>[p[0],p[2]];
const postAt=(p:V3):[number,number]=>[p[0],p[2]];
const xzAt=(p:V3):[number,number]=>[p[0],p[2]];

/** The Fund's water: moves with the reading; frosts when the level is unknown. */
export function buildDamWater(pal:MountainArtPalette,glassMaterial:THREE.Material|undefined,tier:'full'|'lite'){
  const group=new THREE.Group();group.name='Accepted Fund water';
  const owned:{dispose():void}[]=[];const own=<T extends {dispose():void}>(o:T)=>{owned.push(o);return o;};
  const surfaceMat=own(waterMaterial(pal.water,1)),faceMat=own(waterMaterial(pal.water,.94));
  // Surface: the bowl's outline at the current level, as a fan at y = 0 raised by position.y.
  // Rebuilt only when the level moves by more than a quarter unit (a reading, an easing).
  const cx=C[0]-2,cz=C[2]-6,sg=own(new THREE.BufferGeometry());let outlineAt=-1;
  const reshape=(y:number)=>{if(Math.abs(y-outlineAt)<.25)return;outlineAt=y;const outline=reservoirOutline(y),pos:number[]=[],flow:number[]=[],col:number[]=[];
    for(let k=0;k<outline.length;k++){const p=outline[k]!,q=outline[(k+1)%outline.length]!;
      pos.push(cx,0,cz,p[0],0,p[1],q[0],0,q[1]);for(const v of [[cx,cz],p,q])flow.push(v[0]!*.6,v[1]!*.6+.5);col.push(.8,.85,.9,1,1,1,1,1,1);}
    sg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));sg.setAttribute('flowUv',new THREE.Float32BufferAttribute(flow,2));sg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));sg.computeVertexNormals();sg.computeBoundingSphere();};
  reshape(DAM_FULL);
  const surface=new THREE.Mesh(sg,surfaceMat);surface.name='Reservoir surface';surface.receiveShadow=true;surface.renderOrder=1;group.add(surface);
  // The water's face behind the glass, unit height from the zero line, scaled to the level.
  const fp:number[]=[],ff:number[]=[],fc:number[]=[];
  for(let k=0;k<ARC;k++){const a0=-HA+2*HA*k/ARC,a1=-HA+2*HA*(k+1)/ARC,p0=onArc(a0,R-.5,0),p1=onArc(a1,R-.5,0);
    fp.push(p0[0],0,p0[2],p1[0],0,p1[2],p1[0],1,p1[2],p0[0],0,p0[2],p1[0],1,p1[2],p0[0],1,p0[2]);
    ff.push(k,.9,k+1,.9,k+1,.1,k,.9,k+1,.1,k,.1);const dk=.62,lt=1;fc.push(dk,dk,dk,dk,dk,dk,lt,lt,lt,dk,dk,dk,lt,lt,lt,lt,lt,lt);}
  const fg=own(new THREE.BufferGeometry());fg.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));fg.setAttribute('flowUv',new THREE.Float32BufferAttribute(ff,2));fg.setAttribute('color',new THREE.Float32BufferAttribute(fc,3));fg.computeVertexNormals();
  const front=new THREE.Mesh(fg,faceMat);front.name='Fund water behind the glass';front.position.y=DAM_ZERO;group.add(front);
  // Kitty chamber water: unit cylinders scaled by the reserve level.
  const chambers=KITTY_CHAMBERS.map(ch=>{const m=new THREE.Mesh(own(new THREE.CylinderGeometry(ch.radius-.12,ch.radius-.12,1,tier==='full'?20:12)),faceMat);m.position.set(ch.at[0],ch.at[1]+.6,ch.at[2]);m.name='Kitty reserve water';group.add(m);return {m,ch};});
  // A brass float on the gauge strip (west glass, a quarter in from the abutment).
  const floatMat=own(new THREE.MeshStandardMaterial({color:new THREE.Color(...pal.brass),metalness:.5,roughness:.35,flatShading:true}));
  const gaugeA=-HA*.8,float=new THREE.Mesh(own(new THREE.OctahedronGeometry(.55,0)),floatMat);float.scale.set(1,.6,1);const gp=onArc(gaugeA,R+.9,0);float.position.set(gp[0],DAM_ZERO,gp[2]);float.name='Fund level float';group.add(float);
  const glassBase=glassMaterial instanceof THREE.MeshStandardMaterial?{opacity:glassMaterial.opacity,color:glassMaterial.color.clone()}:null;
  let frosted=false;
  return {group,
    /** Level and reserve are 0…1 of the session scale; null is unknown (frost, keep the last water). */
    set(level:number|null,reserve:number|null){
      const known=level!==null;
      if(known){const y=DAM_ZERO+Math.max(.003,level)*(DAM_FULL-DAM_ZERO);reshape(y);surface.position.y=y;front.scale.y=Math.max(.01,y-DAM_ZERO);float.position.y=y;surface.visible=front.visible=true;}
      for(const {m,ch} of chambers){const r=reserve??0,h=Math.max(.02,r*(ch.depth-1.8));m.scale.y=h;m.position.y=ch.at[1]+.6+h/2;m.visible=reserve!==null;}
      if(glassBase&&glassMaterial instanceof THREE.MeshStandardMaterial&&frosted===known){frosted=!known;glassMaterial.opacity=frosted?.82:glassBase.opacity;glassMaterial.color.copy(glassBase.color);if(frosted)glassMaterial.color.lerp(new THREE.Color('#f4f6f2'),.7);glassMaterial.needsUpdate=true;}
      float.visible=known;
    },
    dispose(){group.removeFromParent();owned.forEach(o=>o.dispose());group.clear();}};
}
export type DamWater=ReturnType<typeof buildDamWater>;
export type {CardBuild,Point3};
