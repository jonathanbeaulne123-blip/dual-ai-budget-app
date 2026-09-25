import * as THREE from 'three';
import type {PlaceDressing} from '../scene/place.ts';
import type {RenderTier} from '../scene/quality.ts';
import {groundHeightAt} from '../scene/ground.ts';
import type {District} from './definition.ts';
import {DISTRICT_FIXTURES,districtArtClear} from './artGeometry.ts';
import {CardBuilder,shade,mix,type V3} from '../art/cardScene.ts';
import {hash2} from '../art/cardKit.ts';
import {mountainArtPalette} from './art/palette.ts';
import {fadeIn} from './streaming.ts';

/**
 * Streamed close detail for one district, on the painted-card kit: the fixtures a body
 * bumps into (raised beds, log stacks, crates, boulders — each with its shared collision
 * solid) and the low ground detail that makes each biome its own place (stepping stones
 * and lupins in the meadows, clover and windfalls in the orchard, leaf litter and ferns in
 * the woods, lichen and snow patches up high, herb edging at the Hearth). Fades in.
 */
export function buildDistrictArt(d:District,dressing:PlaceDressing,tier:RenderTier){
  const pal=mountainArtPalette(dressing),b=new CardBuilder(`${d.name} close detail`,tier,{ink:pal.ink,cell:Infinity});
  for(const f of DISTRICT_FIXTURES.filter(f=>f.district===d.id)){
    const [x,y,z]=f.at,top=f.solid.max[1];
    if(f.kind==='bed'){
      const wood=pal.theme==='newfoundland'?pal.walls[(Math.round(x)%pal.walls.length+pal.walls.length)%pal.walls.length]!:pal.theme==='taylor'?pal.walls[3]!:pal.plank;
      b.box(x,z,f.yaw,1.5,.75,y-.2,top,wood,shade(wood,.8));b.box(x,z,f.yaw,1.38,.63,top-.06,top+.02,mix(pal.verge,[.25,.18,.12],.45),shade(pal.verge,.6),null);
      const c=Math.cos(f.yaw),s=Math.sin(f.yaw);
      for(let i=0;i<7;i++)for(const row of [-.3,.3]){const lx=-1.15+i*.38,px=x+lx*c+row*s,pz=z+row*c-lx*s,col=i%3===0?pal.flowers[(i+(row>0?1:3))%pal.flowers.length]!:pal.leaf[i%pal.leaf.length]!;
        b.cone(px,pz,top,top+.28+hash2(i,row*10)*.14,.14,.02,col,5);}
    }else if(f.kind==='logs'){
      const c=Math.cos(f.yaw),s=Math.sin(f.yaw);
      for(let row=0;row<3;row++)for(let k=0;k<4-row;k++){const lx=-.55+k*.36+row*.18,ly=y+.15+row*.28,a:V3=[x+lx*c-.5*s,ly,z-.5*c-lx*s],e:V3=[x+lx*c+.5*s,ly,z+.5*c-lx*s];
        b.beam(a,e,.3,.28,shade(pal.timberLight,.9+hash2(k,row)*.2),null);b.cone(e[0],e[2],ly-.15,ly+.15,.001,.001,pal.plank,6);}
      b.shadow(x,z,1.2,.7,f.yaw,groundHeightAt,.3);
    }else if(f.kind==='crate'){
      b.box(x,z,f.yaw,.45,.45,y-.05,y+.65,pal.plank,shade(pal.plank,.8));
      for(let k=0;k<5;k++){const c=Math.cos(f.yaw+k*1.26),s=Math.sin(f.yaw+k*1.26);b.cone(x+c*.18,z+s*.18,y+.62,y+.78,.12,.08,pal.fruit,6);}
      b.shadow(x,z,.6,.6,f.yaw,groundHeightAt,.28);
    }else{
      const col=shade(pal.stone,.86+hash2(Math.round(x),Math.round(z))*.2);
      b.cone(x,z,y-.3,y+f.height*.55,f.size*1.05,f.size*.8,col,7);b.cone(x,z,y+f.height*.55,y+f.height,f.size*.8,f.size*.25,shade(col,1.08),7,'card',true);
      if(d.biome==='summit')b.cone(x,z,y+f.height*.92,y+f.height*.98,f.size*.35,f.size*.18,pal.chalk,6);
      b.shadow(x+.3,z-.2,f.size*1.3,f.size*1.1,0,groundHeightAt,.3);
    }
  }
  // Low ground detail, clear of every walk, composed by biome.
  const count=tier==='full'?110:50;
  for(let i=0;i<count;i++){
    const a=i*2.39996,band=Math.sqrt((i+.5)/count),r=d.radius*.5+band*(d.radius+14),x=d.at[0]+Math.cos(a)*r,z=d.at[2]+Math.sin(a)*r,h=groundHeightAt(x,z);
    if(!districtArtClear(d,x,z,.3)||Math.abs(h-groundHeightAt(x+.5,z))>.35)continue;
    if(d.biome==='summit'||d.biome==='alpine'){
      // Lichen and, in the lee of stones, a little old snow: nearly flush.
      const snow=d.biome==='summit'&&i%3===0;b.cone(x,z,h-.05,h+.04,snow?.7:.3,snow?.55:.24,snow?pal.chalk:i%2?mix(pal.leaf[0]!,[.8,.78,.55],.5):mix(pal.heath,pal.stone,.4),snow?7:5);
    }else if(d.biome==='woods'){
      if(i%3===0){for(let k=0;k<5;k++){const t=k*1.256;b.beam([x,h+.05,z],[x+Math.cos(t)*.55,h+.32,z+Math.sin(t)*.55],.16,.03,shade(pal.pine[0]!,1.2),null);}}
      else b.cone(x,z,h-.03,h+.03,.22,.2,i%2?mix([.7,.45,.2],pal.leaf[0]!,.3):pal.leaf[2]!,5);
    }else if(d.biome==='meadow'){
      if(i%5===0){b.cone(x,z,h-.08,h+.06,.45,.42,pal.coping,7);}
      else{b.cone(x,z,h,h+.7+hash2(i,1)*.3,.12,.02,i%4?pal.flowers[2]!:pal.flowers[3]!,5);b.cone(x+.18,z+.1,h,h+.45,.1,.02,pal.leaf[1]!,4);}
    }else if(d.biome==='orchard'){
      if(i%4===0)b.cone(x,z,h,h+.12,.1,.08,pal.fruit,5);
      else for(let k=0;k<3;k++){const t=k*2.094;b.cone(x+Math.cos(t)*.12,z+Math.sin(t)*.12,h-.02,h+.04,.12,.1,mix(pal.leaf[1]!,[.9,.9,.8],(k===0?.4:0)),5);}
    }else{
      b.cone(x,z,h,h+.3,.2,.12,i%3?pal.leaf[0]!:pal.flowers[i%pal.flowers.length]!,6);
    }
  }
  const built=b.finish();
  built.group.userData.biome=d.biome;built.group.userData.theme=dressing.theme;
  const fade=fadeIn(built.group);
  return {group:built.group,dispose(){fade.cancel();built.dispose();}};
}
export type {THREE};
