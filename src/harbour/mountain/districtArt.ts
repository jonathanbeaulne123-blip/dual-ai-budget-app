import * as THREE from 'three';
import type {PlaceDressing} from '../scene/place.ts';
import type {RenderTier} from '../scene/quality.ts';
import {mountainBaseHeight,type District,type Point3} from './definition.ts';
import {DISTRICT_FIXTURES,districtArtClear} from './artGeometry.ts';
import {MountainArtKit} from './artKit.ts';
import {mountainPalette} from './architecture.ts';

/** Streamed biome composition; every substantial prop uses a shared collision fixture. */
export function buildDistrictArt(d:District,dressing:PlaceDressing,tier:RenderTier){
  const kit=new MountainArtKit(tier,`${d.name} close detail`),p=mountainPalette(dressing);
  kit.group.userData.biome=d.biome;kit.group.userData.theme=dressing.theme;
  const box=(at:Point3,size:Point3,colour=p.wood)=>kit.box(at,size,colour);
  const birch=dressing.theme==='newfoundland'?'#c5c9bc':'#e4dcc4';
  for(const fixture of DISTRICT_FIXTURES.filter(f=>f.district===d.id)){
    const [x,h,z]=fixture.at,{height,size}=fixture;
    if(fixture.kind==='tree'){
      const orchard=d.biome==='orchard',crownY=h+height;
      kit.part(new THREE.CylinderGeometry(.12,.2,height,6),orchard?p.wood:birch,[x,h+height/2,z]);
      if(!orchard)for(let k=1;k<7;k++)box([x,h+k*.7,z+.14],[.22,.075,.04],p.wood);
      // Orchard trees spread low; birches rise in narrow, separated tiers.
      const layers=orchard?3:2;
      for(let i=0;i<layers;i++)kit.part(new THREE.IcosahedronGeometry(1,1),orchard&&i%2===0?p.flower:p.leaf,
        [x+(orchard?(i-1)*.8:0),crownY+(orchard?Math.sin(i)*.4:i*1.4),z],[size*(orchard?1:.72),orchard?1.05:1.6,size*.8]);
      if(orchard)for(let n=0;n<7;n++){const a=n*.9;kit.part(new THREE.IcosahedronGeometry(.14,0),p.trim,[x+Math.cos(a)*size,crownY-.65,z+Math.sin(a)*size*.7]);}
    }else if(fixture.kind==='rock'){
      // Flat strata make the alpine shoulders distinct from round lowland crowns.
      kit.part(new THREE.IcosahedronGeometry(1,0),p.stone,[x,h+height*.45,z],[size,height*.55,size*.8],[0,x*.13,0]);
      if(d.biome==='summit')kit.part(new THREE.IcosahedronGeometry(1,0),p.light,[x,h+height*.8,z],[size*.76,height*.2,size*.62]);
    }else if(fixture.kind==='bed'){
      box([x,h+.15,z],[3,.3,1.5]);box([x,h+.31,z],[2.75,.02,1.25],p.stone);
      for(let i=0;i<6;i++)for(const row of [-1,1])kit.part(new THREE.IcosahedronGeometry(.18,0),i%3?p.leaf:p.flower,[x-1.1+i*.44,h+.43,z+row*.32],[1,1.2,1]);
    }else{
      box([x,h+.6,z],[2.8,.15,1]);box([x,h+1,z-.52],[2.8,.6,.12]);
      for(const side of [-1,1])box([x+side,h+.28,z],[.15,.56,.8],p.stone);
      for(let n=0;n<7;n++)box([x-1.2+n*.4,h+.69,z],[.05,.02,.86],p.trim);
    }
  }
  // Low planting is intentionally permeable. Compose beds, drifts and alpine lichen,
  // rather than giving every neighbourhood the same random flower ring.
  const count=tier==='full'?180:85;
  for(let i=0;i<count;i++){
    const a=i*2.39996,band=Math.sqrt((i+.5)/count),r=10+band*18;
    const x=d.at[0]+Math.cos(a)*r,z=d.at[2]+Math.sin(a)*r,h=mountainBaseHeight(x,z);
    if(!districtArtClear(d,x,z,.2)||h<1||Math.abs(h-mountainBaseHeight(x+.4,z))>.5)continue;
    if(d.biome==='summit'||d.biome==='alpine'){
      // Snow and lichen are nearly flush tesserae, never fake landings.
      kit.part(new THREE.CircleGeometry(d.biome==='summit'?.5:.24,5),d.biome==='summit'?p.light:i%3?p.leaf:p.trim,[x,h+.025,z],[1,1,1],[-Math.PI/2,0,a]);
    }else if(d.biome==='woods'){
      for(let leaf=0;leaf<3;leaf++)kit.part(new THREE.CircleGeometry(.18,3),i%2?p.trim:p.leaf,[x+leaf*.1,h+.035,z],[1,1,1],[-Math.PI/2,0,a+leaf]);
    }else if(d.biome==='meadow'){
      // Tall seed heads and lupin-like spires form broad drifts by the Glasshouse.
      kit.part(new THREE.ConeGeometry(.13,.65,5),i%4?p.flower:p.light,[x,h+.34,z]);
      kit.part(new THREE.ConeGeometry(.12,.45,3),p.leaf,[x+.16,h+.24,z+.1],[1,1,1],[0,0,.15]);
    }else{
      kit.part(new THREE.IcosahedronGeometry(.15,0),i%3?p.flower:p.light,[x,h+.15,z],[1,.65,1]);
      if(d.biome==='orchard')for(let leaf=0;leaf<3;leaf++){const t=leaf*2.094;kit.part(new THREE.CircleGeometry(.11,5),p.leaf,[x+Math.cos(t)*.12,h+.03,z+Math.sin(t)*.12],[1,1,1],[-Math.PI/2,0,0]);}
    }
  }
  // Ground-level authored motifs give each theme a different visual language.
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2,r=d.biome==='summit'?6:9,x=d.at[0]+Math.cos(a)*r,z=d.at[2]+Math.sin(a)*r;
    if(d.biome!=='summit'&&!districtArtClear(d,x,z,.2))continue;
    const y=mountainBaseHeight(x,z)+.028;
    if(dressing.theme==='taylor')kit.part(new THREE.CircleGeometry(.22,4),i%2?p.trim:p.light,[x,y,z],[1,1,1],[-Math.PI/2,0,a]);
    else if(dressing.theme==='newfoundland')kit.part(new THREE.CircleGeometry(.18,6),i%2?p.stone:p.light,[x,y,z],[1,1,1],[-Math.PI/2,0,a]);
    else kit.box([x,y,z],[.28,.018,.12],p.trim,[0,-a,0]);
  }
  return kit.finish();
}
