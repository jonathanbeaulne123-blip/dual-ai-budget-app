/**
 * Crags: the mountain's steep faces as stacked cut-card strata rather than one smooth,
 * faceted sheet. Wherever the land is steeper than a scramble and nothing walks, a few
 * horizontal slabs of rock stand out of the face one above another, each stepped back into
 * the hill so the stack follows the slope: lit ledge tops, darker cut sides, an inked top
 * edge, and the land's own shadow under each lip. Pure placement data plus a card drawing.
 *
 * The slabs never touch a road, lane, path, stair, platform, plot, the dam or the reservoir
 * bowl (`plantingClearance`), stand only on slopes a body cannot climb, and do not collide.
 */
import {mountainBaseHeight} from '../definition.ts';
import {plantingClearance} from '../planting.ts';
import {CardBuilder,shade,mix,type V3} from '../../art/cardScene.ts';
import {hash2} from '../../art/cardKit.ts';
import type {MountainArtPalette} from './palette.ts';

export type Crag={x:number;z:number;y:number;
  /** Unit horizontal downslope direction (out of the face). */
  out:readonly [number,number];
  /** The face's gradient (rise over run). */
  grade:number;
  /** Half length along the contour. */
  reach:number;layers:number;seed:number};

/** Steeper than this (rise over run, about 47°) is a face, not a slope. */
export const CRAG_GRADE=1.08;
const slope=(x:number,z:number):[number,number]=>[(mountainBaseHeight(x+1,z)-mountainBaseHeight(x-1,z))/2,(mountainBaseHeight(x,z+1)-mountainBaseHeight(x,z-1))/2];

const cache=new Map<string,readonly Crag[]>();
/** Every crag on the mountain, deterministic per tier (the lite tier keeps the larger ones, farther apart). */
export function mountainCrags(tier:'full'|'lite'):readonly Crag[]{
  const hit=cache.get(tier);if(hit)return hit;
  const out:Crag[]=[],step=tier==='full'?5:7.5;
  for(let gz=-392;gz<=-50;gz+=step)for(let gx=-192;gx<=192;gx+=step){
    const i=Math.round(gx/step),j=Math.round(gz/step),x=gx+(hash2(i,j)-.5)*step*.8,z=gz+(hash2(j,i)-.5)*step*.8;
    const y=mountainBaseHeight(x,z);if(y<2.5)continue;
    const [sx,sz]=slope(x,z),g=Math.hypot(sx,sz);if(g<CRAG_GRADE)continue;
    // Faces on both sides of the sample must agree (a real face, not a crease).
    const [ax,az]=slope(x+sz/g*2,z-sx/g*2),[bx,bz]=slope(x-sz/g*2,z+sx/g*2);if(Math.hypot(ax,az)<CRAG_GRADE*.8||Math.hypot(bx,bz)<CRAG_GRADE*.8)continue;
    if(plantingClearance(x,z)<3)continue;
    const u=hash2(i*3+1,j*7+2);
    out.push({x,z,y,out:[-sx/g,-sz/g],grade:g,reach:1.6+u*2.2,layers:2+Math.floor(hash2(j*5,i*3)*3),seed:i*131+j*17});
  }
  cache.set(tier,out);return out;
}

/** The crags as card: each a short stack of irregular slabs following the face. */
export function buildRockArt(b:CardBuilder,pal:MountainArtPalette,tier:'full'|'lite'){
  const rock=pal.rock,moss=pal.leaf[2]!;
  for(const c of mountainCrags(tier)){
    const [ux,uz]=c.out,tx=-uz,tz=ux;
    // Low crags carry a little moss on their ledges; high ones are bare and paler.
    const ledge=c.y<60?mix(shade(rock,1.08),moss,.28*(1-c.y/60)):shade(rock,1.1+Math.min(.08,(c.y-60)/500));
    let rise=0;
    for(let k=0;k<c.layers;k++){
      const h=.5+hash2(c.seed,k)*.35,top=c.y+.18+rise,back=rise/c.grade,w=c.reach*(1-.14*k)*(.85+hash2(k,c.seed)*.3);
      const lip=.6+hash2(c.seed+k,3)*.55,depth=2.2+h/c.grade;
      const cx=c.x-ux*back,cz=c.z-uz*back;
      // A rounded front (seven points) and a straight back buried in the hill.
      const loop:[number,number][]=[];
      for(let n=0;n<=6;n++){const a=-Math.PI/2+n/6*Math.PI,j=.78+hash2(c.seed*7+n,k)*.4;loop.push([cx+tx*Math.sin(a)*w+ux*Math.cos(a)*lip*j,cz+tz*Math.sin(a)*w+uz*Math.cos(a)*lip*j]);}
      loop.push([cx+tx*w*.9-ux*depth,cz+tz*w*.9-uz*depth],[cx-tx*w*.9-ux*depth,cz-tz*w*.9-uz*depth]);
      // Wind the loop counter-clockwise in (x, z) so the prism's top faces up.
      let area=0;for(let n=0;n<loop.length;n++){const p=loop[n]!,q=loop[(n+1)%loop.length]!;area+=p[0]*q[1]-q[0]*p[1];}
      if(area<0)loop.reverse();
      const tone=shade(rock,.9+hash2(c.seed,k+11)*.16);
      // The lowest slab reaches down into the slope under its lip; the ones above are ledges.
      b.prism(loop,k===0?c.y-c.grade*lip*1.1-.25:top-h,top,k===c.layers-1?ledge:mix(tone,ledge,.5),shade(tone,.84),tier==='full'?b.ink:null,.66);
      rise+=h+.1+hash2(k,c.seed*3)*.25;
    }
  }
}
export type {V3};
