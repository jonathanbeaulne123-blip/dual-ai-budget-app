/**
 * Rock faces as stacked cut card: wherever the mountain is a real cliff (steeper than a
 * scramble and falling a long way), the land is read as a pile of card contours. Thin
 * ledges follow the contour lines every few units up the face — a lit top, a darker cut
 * front, a pencil line on the lip — so a cliff reads as strata in a hand-built model rather
 * than one smooth faceted sheet. Pure placement data (`mountainStrata`) plus a card drawing.
 *
 * The ledges never touch a road, lane, path, stair, platform, plot or the dam (`plantingClearance`);
 * they do line the reservoir bowl's walls, where they read as the water's level marks. They stand
 * only on faces a body cannot climb, and do not collide.
 */
import {mountainBaseHeight} from '../definition.ts';
import {plantingClearance} from '../planting.ts';
import {CardBuilder,shade,mix,inkLift,type V3} from '../../art/cardScene.ts';
import {hash2} from '../../art/cardKit.ts';
import type {MountainArtPalette} from './palette.ts';

/** Steeper than this (rise over run, about 52°) is a rock face, not a grassy bank. */
export const STRATA_GRADE=1.3;
/** A face must fall at least this far over twelve units across it (a cliff, not a terrace bank). */
export const STRATA_FALL=9;
/** One ledge: a contour segment at `y`, its lip pushed `lip` out along the downslope `out`. */
export type Ledge={a:readonly [number,number];b:readonly [number,number];y:number;out:readonly [number,number];lip:number;grade:number};

const gradient=(x:number,z:number):[number,number]=>[(mountainBaseHeight(x+1,z)-mountainBaseHeight(x-1,z))/2,(mountainBaseHeight(x,z+1)-mountainBaseHeight(x,z-1))/2];
/** Slide a point along the fall line onto the land's own contour at `y` (two Newton steps). */
function onContour(p:[number,number],y:number):[number,number]{
  let [x,z]=p;
  for(let k=0;k<2;k++){const [gx,gz]=gradient(x,z),g2=gx*gx+gz*gz;if(g2<1e-6)break;const d=(mountainBaseHeight(x,z)-y)/g2,m=Math.max(-1.2,Math.min(1.2,d*Math.sqrt(g2)))/Math.sqrt(g2);x-=gx*m;z-=gz*m;}
  return [x,z];
}
const cache=new Map<string,readonly Ledge[]>();
/**
 * The strata: marching squares over the baked ground at a fixed contour interval, kept only
 * where the cell is a cliff and clear of every corridor. Deterministic per tier (the lite
 * tier samples coarser, with a wider interval).
 */
export function mountainStrata(tier:'full'|'lite'):readonly Ledge[]{
  const hit=cache.get(tier);if(hit)return hit;
  const step=tier==='full'?1.5:2.5,interval=tier==='full'?2.4:4.2,out:Ledge[]=[];
  const x0=-194,z0=-392,nx=Math.floor(388/step),nz=Math.floor(340/step);
  const H=new Float32Array((nx+1)*(nz+1));
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++)H[j*(nx+1)+i]=mountainBaseHeight(x0+i*step,z0+j*step);
  const at=(i:number,j:number)=>H[j*(nx+1)+i]!;
  const X=(n:number)=>x0+n*step,Z=(n:number)=>z0+n*step;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const h00=at(i,j),h10=at(i+1,j),h01=at(i,j+1),h11=at(i+1,j+1),lo=Math.min(h00,h10,h01,h11),hi=Math.max(h00,h10,h01,h11);
    if(hi<3||hi-lo<STRATA_GRADE*step*.9)continue;
    const cx=X(i+.5),cz=Z(j+.5),[gx,gz]=gradient(cx,cz),g=Math.hypot(gx,gz);
    if(g<STRATA_GRADE)continue;
    if(mountainBaseHeight(cx+gx/g*6,cz+gz/g*6)-mountainBaseHeight(cx-gx/g*6,cz-gz/g*6)<STRATA_FALL)continue;
    if(plantingClearance(cx,cz,{bowl:false})<2.5)continue;
    const dir:[number,number]=[-gx/g,-gz/g];
    for(let k=Math.ceil(lo/interval);k*interval<hi;k++){
      const y=k*interval,pts:[number,number][]=[];
      // Edge crossings (bottom, right, top, left) where the contour passes.
      const edge=(ha:number,hb:number,ax:number,az:number,bx:number,bz:number)=>{if((ha<y)!==(hb<y)){const t=(y-ha)/(hb-ha);pts.push([ax+(bx-ax)*t,az+(bz-az)*t]);}};
      edge(h00,h10,X(i),Z(j),X(i+1),Z(j));edge(h10,h11,X(i+1),Z(j),X(i+1),Z(j+1));edge(h11,h01,X(i+1),Z(j+1),X(i),Z(j+1));edge(h01,h00,X(i),Z(j+1),X(i),Z(j));
      for(let n=0;n+1<pts.length;n+=2){const a=onContour(pts[n]!,y),b=onContour(pts[n+1]!,y);if(Math.hypot(b[0]-a[0],b[1]-a[1])<.05)continue;
        // Drop a ledge that would not sit on the face (a crease or a sheer step the contour cannot follow).
        if(Math.abs(mountainBaseHeight(a[0],a[1])-y)>.3||Math.abs(mountainBaseHeight(b[0],b[1])-y)>.3||Math.abs(mountainBaseHeight((a[0]+b[0])/2,(a[1]+b[1])/2)-y)/g>.45)continue;
        if(Math.hypot(a[0]-cx,a[1]-cz)>step*1.5||Math.hypot(b[0]-cx,b[1]-cz)>step*1.5||plantingClearance((a[0]+b[0])/2,(a[1]+b[1])/2,{bowl:false})<2)continue;
        out.push({a,b,y,out:dir,lip:.42+hash2(i*3+k,j*5)*.3,grade:g});}
    }
  }
  cache.set(tier,out);return out;
}

/** The ledges as card: a thin lit shelf with a darker cut front and a pencilled lip. */
export function buildRockArt(b:CardBuilder,pal:MountainArtPalette,tier:'full'|'lite'){
  const rock=pal.rock,th=tier==='full'?.26:.34;
  for(const l of mountainStrata(tier)){
    const [ox,oz]=l.out,inx=-ox*.5,inz=-oz*.5,lx=ox*l.lip,lz=oz*l.lip;
    // Paler with height; a hint of lichen low down.
    const top=l.y<55?mix(shade(rock,1.12),pal.leaf[2]!,.12*(1-l.y/55)):shade(rock,1.1+Math.min(.1,(l.y-55)/400));
    const front=shade(rock,.78+hash2(Math.round(l.a[0]*3),Math.round(l.a[1]*3))*.1);
    const A:V3=[l.a[0]+inx,l.y,l.a[1]+inz],B:V3=[l.b[0]+inx,l.y,l.b[1]+inz],C:V3=[l.b[0]+lx,l.y,l.b[1]+lz],D:V3=[l.a[0]+lx,l.y,l.a[1]+lz];
    b.quad(A,B,C,D,top);
    b.quadV([D[0],l.y-th,D[2]],[C[0],l.y-th,C[2]],C,D,shade(front,.8),shade(front,.8),front,front);
    if(tier==='full')b.line(inkLift(D),inkLift(C),b.pencil);
  }
}
