/**
 * The terrain's render lattice and its painting (vertex colours only; heights are
 * `groundHeightAt`'s, untouched).
 *
 * The lattice is finer over the island and the gorge band (|x| < 90) so the coast and the
 * river read smooth, and every cell is split along its flatter diagonal so contours do not
 * zig-zag. Painting reads masks baked once per tier — slope in every direction, concavity
 * (baked occlusion in gullies, a chalk lift on ridges), the sun's cast shadow across the
 * heightfield, distance to the road, lanes, paths and water — and mixes a theme palette
 * through them: soft district biomes, rock on steep faces, scree below cliffs, a snow
 * crown with a dithered edge, worn verges, damp banks, level marks in the reservoir bowl,
 * a warm lit side and a cool shadow side, and a cooler, greyer tone with height.
 */
import * as THREE from 'three';
import {DISTRICTS,MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,RIVER,RIVER_HALF_WIDTH,RESERVOIR,DAM_PARTS,type Point3,type Biome} from '../mountain/definition.ts';
import {PATH_EDGES} from '../mountain/pathGraph.ts';
import {TOWN_RACE_ROAD,TOWN_LANE_HALF_WIDTH} from '../mountain/course.ts';
import {HARBOUR_LAND} from '../village/world.ts';
import type {PlaceDressing} from './place.ts';
import type {RenderTier} from './quality.ts';
import {SUN_TOWARD} from './lightRig.ts';

export type Lattice={positions:Float32Array;indices:Uint32Array;cols:number;rows:number;xs:Float32Array;zs:Float32Array};
export {SUN_TOWARD};

/** Coordinates with a fine band and coarse outer ranges (each ascending, ends exact). */
function axis(min:number,max:number,fineMin:number,fineMax:number,fine:number,coarse:number):Float32Array{
  const out:number[]=[];const run=(a:number,b:number,step:number)=>{const n=Math.max(1,Math.round((b-a)/step));for(let i=0;i<n;i++)out.push(a+(b-a)*i/n);};
  run(min,fineMin,coarse);run(fineMin,fineMax,fine);run(fineMax,max,coarse);out.push(max);return new Float32Array(out);
}
export function buildLattice(bounds:{minX:number;maxX:number;minZ:number;maxZ:number},tier:RenderTier,height:(x:number,z:number)=>number):Lattice{
  const full=tier==='full';
  const xs=axis(bounds.minX,bounds.maxX,-90,90,full?1.25:2,full?2:3),zs=axis(bounds.minZ,bounds.maxZ,-64,bounds.maxZ-4,full?1.25:2,full?2:3);
  const cols=xs.length-1,rows=zs.length-1,positions=new Float32Array((cols+1)*(rows+1)*3),indices=new Uint32Array(cols*rows*6);
  for(let iz=0;iz<=rows;iz++)for(let ix=0;ix<=cols;ix++){const i=iz*(cols+1)+ix,x=xs[ix]!,z=zs[iz]!;positions[i*3]=x;positions[i*3+1]=height(x,z);positions[i*3+2]=z;}
  let k=0;
  for(let iz=0;iz<rows;iz++)for(let ix=0;ix<cols;ix++){
    const a=iz*(cols+1)+ix,b=a+1,c=a+cols+1,d=c+1;
    // Split along the flatter diagonal: contours stay smooth instead of stair-stepping.
    const ad=Math.abs(positions[a*3+1]!-positions[d*3+1]!),bc=Math.abs(positions[b*3+1]!-positions[c*3+1]!);
    if(ad<=bc){indices[k++]=a;indices[k++]=c;indices[k++]=d;indices[k++]=a;indices[k++]=d;indices[k++]=b;}
    else{indices[k++]=a;indices[k++]=c;indices[k++]=b;indices[k++]=b;indices[k++]=c;indices[k++]=d;}
  }
  return {positions,indices,cols,rows,xs,zs};
}

export type GroundMasks={
  n:number;slope:Float32Array;nx:Float32Array;ny:Float32Array;nz:Float32Array;
  /** + in gullies (occlusion), − on ridges (a chalk lift). */
  cavity:Float32Array;
  /** 0 lit … 1 in the heightfield's own cast shadow. */
  sun:Float32Array;
  /** Signed distance past the road/lane/town-lane edge (negative under the deck). */
  road:Float32Array;path:Float32Array;river:Float32Array;
  /** 0…1: steep ground just uphill (scree fans below cliffs). */
  scree:Float32Array;
  /** Soft biome weights, one array per biome. */
  biome:Record<Biome,Float32Array>;
  /** 0 island … 1 mountain. */
  mountain:Float32Array;
  /** Inside the reservoir bowl below the full level. */
  bowl:Float32Array;
  grain:Float32Array;
};
const BIOMES:readonly Biome[]=['garden','orchard','woods','meadow','alpine','summit'];
/** Altitude bands (biome, lower edge) for ground away from every district. */
const ALTITUDE:readonly (readonly [Biome,number])[]=[['garden',-1e9],['woods',26],['meadow',48],['alpine',70],['summit',92]];
const hash=(x:number,z:number)=>{const s=Math.sin(x*12.9898+z*78.233)*43758.5453;return s-Math.floor(s);};

/** Rasterise a polyline's corridor into a distance field over the lattice (min edge distance). */
function stamp(field:Float32Array,L:Lattice,points:readonly Point3[],halfWidth:number|((i:number)=>number),reach:number,keep:(p:Point3,i:number)=>boolean=()=>true){
  const {xs,zs,cols}=L,col=(x:number)=>{let lo=0,hi=xs.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(xs[m]!<=x)lo=m;else hi=m;}return lo;},row=(z:number)=>{let lo=0,hi=zs.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(zs[m]!<=z)lo=m;else hi=m;}return lo;};
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!;if(!keep(a,i-1)&&!keep(b,i))continue;
    const hw=typeof halfWidth==='number'?halfWidth:halfWidth(i),r=hw+reach;
    const x0=col(Math.min(a[0],b[0])-r),x1=col(Math.max(a[0],b[0])+r)+1,z0=row(Math.min(a[2],b[2])-r),z1=row(Math.max(a[2],b[2])+r)+1;
    const dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz||1;
    for(let iz=z0;iz<=Math.min(z1,zs.length-1);iz++)for(let ix=x0;ix<=Math.min(x1,xs.length-1);ix++){
      const x=xs[ix]!,z=zs[iz]!,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/l)),d=Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t)-hw,k=iz*(cols+1)+ix;
      if(d<field[k]!)field[k]=d;
    }
  }
}

const maskCache=new Map<RenderTier,GroundMasks>();
export function groundMasks(L:Lattice,tier:RenderTier,height:(x:number,z:number)=>number):GroundMasks{
  const cached=maskCache.get(tier);if(cached)return cached;
  const n=L.positions.length/3,P=L.positions,F=()=>new Float32Array(n);
  const m:GroundMasks={n,slope:F(),nx:F(),ny:F(),nz:F(),cavity:F(),sun:F(),road:F().fill(99),path:F().fill(99),river:F().fill(99),scree:F(),
    biome:Object.fromEntries(BIOMES.map(b=>[b,F()])) as Record<Biome,Float32Array>,mountain:F(),bowl:F(),grain:F()};
  const sx=SUN_TOWARD[0],sz=SUN_TOWARD[2],sh=Math.hypot(sx,sz),rise=SUN_TOWARD[1]/sh,ux=sx/sh,uz=sz/sh;
  const [bcx,,bcz]=DAM_PARTS.centre;
  for(let i=0;i<n;i++){
    const x=P[i*3]!,y=P[i*3+1]!,z=P[i*3+2]!;
    const gx=(height(x+1,z)-height(x-1,z))/2,gz=(height(x,z+1)-height(x,z-1))/2,g=Math.hypot(gx,gz),nl=Math.hypot(gx,1,gz);
    m.slope[i]=g;m.nx[i]=-gx/nl;m.ny[i]=1/nl;m.nz[i]=-gz/nl;
    m.grain[i]=hash(Math.floor(x*.9),Math.floor(z*.9))*.6+hash(Math.floor(x*.23),Math.floor(z*.23))*.4;
    // Concavity: the ring average against the point, at two scales.
    let near=0,far=0;for(let k=0;k<8;k++){const a=k*Math.PI/4;near+=height(x+Math.cos(a)*3.5,z+Math.sin(a)*3.5);far+=height(x+Math.cos(a)*9,z+Math.sin(a)*9);}
    m.cavity[i]=(near/8-y)*.6+(far/8-y)*.25;
    // The sun's cast shadow across the heightfield: march toward the sun.
    let shadow=0;
    if(z<-30||y>1)for(let s=2.5;s<=70;s+=2.5){const h=height(x+ux*s,z+uz*s),ray=y+.4+s*rise;if(h>ray){shadow=Math.min(1,shadow+(h-ray)*.45);if(shadow>=1)break;}}
    m.sun[i]=shadow;
    // Scree: steep ground a few units uphill of a gentler foot.
    if(g>.05&&z<-44){const dx=gx/g,dz=gz/g;const up=Math.hypot((height(x+dx*5+1,z+dz*5)-height(x+dx*5-1,z+dz*5))/2,(height(x+dx*5,z+dz*5+1)-height(x+dx*5,z+dz*5-1))/2);m.scree[i]=Math.max(0,Math.min(1,(up-1.3)*1.4))*Math.max(0,Math.min(1,(1.25-g)*2));}
    // Mountain vs island: the harbour's own painting holds south of the mountain foot.
    const r=Math.hypot(x,z);m.mountain[i]=z<-44?Math.min(1,Math.max(y>1.4?1:0,(-44-z)/14,r>HARBOUR_LAND.radius-6&&y>.6?1:0)):y>2.2&&z<-30?Math.min(1,(y-2.2)/2):0;
    // Biomes: soft weights around each district, the rest by altitude.
    let total=0;for(const b of BIOMES)m.biome[b]![i]=0;
    for(const d of DISTRICTS){const dd=Math.hypot(x-d.at[0],z-d.at[2]),R=d.radius+26,w=Math.exp(-(dd/R)*(dd/R)*1.6);m.biome[d.biome]![i]+=w;total+=w;}
    // The rest by altitude, each band fading into the next over a few units (no contour seams).
    const base=.35;for(let k=0;k<ALTITUDE.length;k++){const lo=ALTITUDE[k]![1],hi=ALTITUDE[k+1]?.[1]??1e9,w=(sm(lo-8,lo+8,y)-sm(hi-8,hi+8,y))*base;if(w>0){m.biome[ALTITUDE[k]![0]]![i]+=w;total+=w;}}
    for(const b of BIOMES)m.biome[b]![i]/=total;
    // The reservoir bowl below the full level.
    const bowlR=Math.hypot(x-bcx,z-bcz+6);m.bowl[i]=y<RESERVOIR.level+.4&&y>RESERVOIR.bottom-2&&bowlR<44&&z<-236?1:0;
  }
  const onGround=(p:Point3)=>Math.abs(p[1]-height(p[0],p[2]))<1.6;
  stamp(m.road,L,MOUNTAIN_ROAD_LINE.samples.map(s=>s.at),i=>MOUNTAIN_ROAD_LINE.samples[i]!.halfWidth,4,onGround);
  stamp(m.road,L,ORCHARD_LANE_LINE.samples.map(s=>s.at),ORCHARD_LANE_LINE.samples[0]!.halfWidth,4,onGround);
  stamp(m.road,L,TOWN_RACE_ROAD,TOWN_LANE_HALF_WIDTH,3);
  for(const e of PATH_EDGES)if(e.kind==='path'||e.kind==='stair')stamp(m.path,L,e.points,e.halfWidth,2.5,onGround);
  const dense:Point3[]=[];for(let i=1;i<RIVER.length;i++){const a=RIVER[i-1]!,b=RIVER[i]!,k=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/2);for(let j=0;j<k;j++){const t=j/k;dense.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}}
  dense.push(RIVER[RIVER.length-1]!);stamp(m.river,L,dense,RIVER_HALF_WIDTH,6);
  maskCache.set(tier,m);return m;
}

type Col=[number,number,number];
const col=(hex:string):Col=>{const c=new THREE.Color(hex);return [c.r,c.g,c.b];};
const lerp=(a:Col,b:Col,t:number):Col=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const mul=(a:Col,k:number):Col=>[a[0]*k,a[1]*k,a[2]*k];
const sat=(v:number)=>v<0?0:v>1?1:v;
const sm=(e0:number,e1:number,v:number)=>{const t=sat((v-e0)/(e1-e0));return t*t*(3-2*t);};

/** The mountain palette for a dressing: grasses per biome, rock, scree, snow, earth, damp. */
function groundPalette(d:PlaceDressing){
  const lawn=col(d.lawn),moss=col(d.moss),stone=col(d.stone),joint=col(d.joint),plinth=col(d.plinth);
  const theme=d.theme;
  const rock=theme==='taylor'?lerp(col('#c0b3a8'),joint,.18):theme==='newfoundland'?lerp(stone,col('#56636a'),.45):lerp(col('#978a74'),col('#7c776c'),.45);
  const grass={
    garden:lerp(lawn,moss,.12),
    orchard:lerp(lawn,col(theme==='taylor'?'#d8d59a':'#b9b35e'),.22),
    woods:lerp(moss,col('#3f5a36'),theme==='taylor'?.05:.25),
    meadow:lerp(lawn,col(theme==='taylor'?'#e7dba8':'#c7c078'),.2),
    alpine:lerp(lerp(moss,rock,.3),col('#8f9a78'),.25),
    summit:lerp(col(theme==='taylor'?'#bba0b2':theme==='newfoundland'?'#7b6f6f':'#8a7a68'),moss,.35),
  } satisfies Record<Biome,Col>;
  return {grass,rock,scree:lerp(rock,col('#d9d0bf'),.3),snow:col(theme==='taylor'?'#fbf4f6':'#eef2ef'),earth:lerp(col(theme==='taylor'?'#c9ab9f':'#9d7f5c'),plinth,.15),
    gravel:lerp(stone,col('#d8ccb4'),.3),damp:lerp(moss,col('#3d5a55'),.4),bed:lerp(stone,col('#6f7a72'),.45),bowl:lerp(rock,col('#6f7f7a'),.25),
    sand:lerp(stone,col(d.sea),.25),sea:col(d.sea),terrace:col(d.terrace),joint,moss,lawn,
    warm:(theme==='taylor'?[1.05,1,.98]:[1.06,1.01,.92]) as Col,cool:(theme==='newfoundland'?[.9,.96,1.06]:[.9,.94,1.05]) as Col,high:col(theme==='taylor'?'#d7cfe0':'#b9c2c6')};
}

/** Paint the lattice for a dressing from the baked masks. Cheap: a theme change repaints only. */
export function paintGround(colors:Float32Array,L:Lattice,m:GroundMasks,d:PlaceDressing){
  const P=L.positions,pal=groundPalette(d),[sx,sy,sz]=SUN_TOWARD;
  const TR=HARBOUR_LAND.terrace,LR=HARBOUR_LAND.lawn,GR=HARBOUR_LAND.radius;
  for(let i=0;i<m.n;i++){
    const x=P[i*3]!,y=P[i*3+1]!,z=P[i*3+2]!,r=Math.hypot(x,z),g=m.slope[i]!,grain=m.grain[i]!;
    // The harbour island: terrace, lawn and shore, as the court has always been painted.
    let island:Col;
    if(r<=TR)island=lerp(pal.terrace,pal.joint,r>TR-.6?.55:.08);
    else if(r<=LR)island=lerp(pal.lawn,pal.sand,Math.max(0,(r-TR)/(LR-TR)-.8)*2.5);
    else{const t=(r-LR)/(GR-LR);island=lerp(pal.sand,mul(pal.sea,.7),sat((t-.5)*1.6));}
    let c:Col=island;
    const wm=m.mountain[i]!;
    if(wm>0){
      let land:Col=[0,0,0];
      for(const b of ['garden','orchard','woods','meadow','alpine','summit'] as const){const w=m.biome[b]![i]!;if(w>0){const gc=pal.grass[b];land=[land[0]+gc[0]*w,land[1]+gc[1]*w,land[2]+gc[2]*w];}}
      // Grass varies in patches (a painter's dabs), then rock takes the steep faces.
      land=mul(land,.94+grain*.12);
      const rockW=sm(.85,1.45,g+(grain-.5)*.25);
      land=lerp(land,mul(pal.rock,.92+grain*.14),rockW);
      land=lerp(land,pal.scree,m.scree[i]!*.75*(1-rockW));
      // A snow crown fading by height, dithered at its edge, thinner on steep rock.
      const snow=sm(99,108,y+(grain-.5)*5)*(1-sm(1.1,1.8,g));land=lerp(land,pal.snow,snow);
      // Shore of the sea: shingle at the waterline.
      if(y<.9)land=lerp(land,pal.sand,sat((.9-y)/.8));
      c=lerp(island,land,wm);
    }
    // Worn earth under and along the road verges; gravel on the paths.
    const rd=m.road[i]!,pd=m.path[i]!,rv=m.river[i]!;
    if(rd<2.2)c=lerp(c,rd<.2?pal.earth:lerp(pal.earth,c,.35),sat(1-(rd-.2)/2)*(z<-44?.85:.55));
    if(pd<1.4)c=lerp(c,pal.gravel,sat(1-pd/1.4)*.8);
    // Damp banks along the river; a pebble bed under the water.
    if(rv<4.5)c=lerp(c,rv<0?pal.bed:pal.damp,rv<0?.85:sat(1-rv/4.5)*.55);
    // The reservoir bowl: wet rock with level marks every three units.
    if(m.bowl[i]!>0){const band=Math.abs(((y-RESERVOIR.bottom)/3)%1-.5)<.06?.82:1;c=lerp(c,mul(pal.bowl,band),.8);}
    // Light: a warm lit side and a cool shade side, occlusion in gullies, chalk on ridges,
    // the heightfield's own shadow, and a cooler, greyer tone with height.
    const lit=sat(m.nx[i]!*sx+m.ny[i]!*sy+m.nz[i]!*sz);
    const tone=lerp(pal.cool,pal.warm,sm(.15,.75,lit));c=[c[0]*tone[0],c[1]*tone[1],c[2]*tone[2]];
    const cav=m.cavity[i]!;
    if(cav>0)c=mul(c,1-sat(cav/3.2)*.3);else c=lerp(c,[1,.98,.92],sat(-cav/4)*.16);
    const sh=m.sun[i]!*wm;if(sh>0)c=lerp(c,[c[0]*.72,c[1]*.76,c[2]*.86],sh);
    if(y>55&&wm>0)c=lerp(c,pal.high,sat((y-55)/70)*.22);
    colors[i*3]=c[0];colors[i*3+1]=c[1];colors[i*3+2]=c[2];
  }
}
