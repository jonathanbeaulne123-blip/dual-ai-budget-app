/**
 * The race's three architectural branches and the river footbridge, drawn as structures
 * that could carry a rider: plate or plank decks with real thickness, trestles to the
 * ground, and a grind rail on brackets (the dam's maintenance rail hangs off the dam's fins).
 */
import {groundHeightAt} from '../../scene/ground.ts';
import {SKILL_BRANCHES,MOUNTAIN_PATH_GRAPH,DAM_PARTS,type Point3} from '../definition.ts';
import {CardBuilder,shade,mix,inkLift,type V3} from '../../art/cardScene.ts';
import type {MountainArtPalette} from './palette.ts';

const UP:V3=[0,1,0];
type Frame={p:V3;side:V3;up:V3};
const frames=(pts:readonly Point3[]):Frame[]=>pts.map((p,i)=>{const a=pts[Math.max(0,i-1)]!,c=pts[Math.min(pts.length-1,i+1)]!,dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz)||1;return {p:[p[0],p[1],p[2]],side:[dz/l,0,-dx/l],up:UP};});

function deck(b:CardBuilder,pal:MountainArtPalette,F:Frame[],hw:number,metal:boolean,th=.32,legs=true){
  const top=metal?shade(pal.iron,1.9):pal.plank,skin=metal?mix(pal.iron,pal.glassFrame,.35):pal.timber;
  b.sweep(F,[[-hw,.02],[hw,.02]],(_k,i)=>shade(top,.95+(i%2)*.06),{bucket:'flat'});
  b.sweep(F,[[hw,.03],[hw,-th],[-hw,-th],[-hw,.03]],k=>k===1?shade(skin,.55):shade(skin,.85),{foot:[0,2],bucket:metal?'steel':'card'});
  for(const s of [-1,1])for(let i=1;i<F.length;i++){const a=F[i-1]!,c=F[i]!;b.line(inkLift([a.p[0]+a.side[0]*s*hw,a.p[1]+.02,a.p[2]+a.side[2]*s*hw]),inkLift([c.p[0]+c.side[0]*s*hw,c.p[1]+.02,c.p[2]+c.side[2]*s*hw]));}
  if(!metal)for(let i=0;i<F.length;i+=1){const f=F[i]!;b.line(inkLift([f.p[0]-f.side[0]*hw,f.p[1]+.02,f.p[2]-f.side[2]*hw]),inkLift([f.p[0]+f.side[0]*hw,f.p[1]+.02,f.p[2]+f.side[2]*hw]),b.pencil);}
  // Supports: posts (or steel legs) down to the ground wherever the deck stands clear of it.
  if(legs)for(let i=0;i<F.length;i+=3){const f=F[i]!;for(const s of [-1,1]){const x=f.p[0]+f.side[0]*s*(hw-.25),z=f.p[2]+f.side[2]*s*(hw-.25),g=groundHeightAt(x,z);if(f.p[1]-th-g<.4)continue;
    if(metal)b.post(x,z,g-.3,f.p[1]-th,.1,pal.iron,6,'steel');else b.box(x,z,Math.atan2(f.side[0],f.side[2]),.12,.12,g-.3,f.p[1]-th,pal.timberLight,pal.timber,null);}
    if(i%6===0){const g=groundHeightAt(f.p[0],f.p[2]);if(f.p[1]-th-g>2)b.beam([f.p[0]-f.side[0]*(hw-.25),g+.5,f.p[2]-f.side[2]*(hw-.25)],[f.p[0]+f.side[0]*(hw-.25),f.p[1]-th-.2,f.p[2]+f.side[2]*(hw-.25)],.1,.1,metal?pal.iron:pal.timber,null,metal?'steel':'card');}}
}

export function buildBranchArt(b:CardBuilder,pal:MountainArtPalette){
  for(const br of SKILL_BRANCHES){
    const metal=br.material==='metal';
    for(const seg of br.segments){
      if(seg.points.length<2)continue;
      const F=frames(seg.points);
      if(seg.kind==='rail'){
        // A round grind rail on short posts over a narrow catwalk; on the dam, brackets back to the fins.
        b.tube(seg.points.map(p=>[p[0],p[1]+.05,p[2]] as V3),.09,pal.brass,6);
        // On the dam the catwalk hangs from the fins on brackets (no legs to the gorge floor); elsewhere it stands on posts.
        const onDam=br.id==='dam-promenade',walk=F.map(f=>({p:[f.p[0],f.p[1]-.75,f.p[2]] as V3,side:f.side,up:f.up}));
        deck(b,pal,walk,.55,true,.18,!onDam);
        for(let i=0;i<F.length;i+=2){const f=F[i]!;b.post(f.p[0],f.p[2],f.p[1]-.75,f.p[1]+.02,.045,mix(pal.iron,pal.glassFrame,.35),5,'steel');}
        if(br.id==='dam-promenade'){const [cx,,cz]=DAM_PARTS.centre;
          for(let i=0;i<F.length;i+=4){const f=F[i]!,dx=cx-f.p[0],dz=cz-f.p[2],l=Math.hypot(dx,dz)||1,d=l-DAM_PARTS.radius;if(d<.5||d>12)continue;
            const back:V3=[f.p[0]+dx/l*(d-.1),f.p[1]-.9,f.p[2]+dz/l*(d-.1)];const steel=mix(pal.iron,pal.glassFrame,.35);b.beam([f.p[0],f.p[1]-.9,f.p[2]],back,.14,.2,steel,null,'steel');b.beam([f.p[0],f.p[1]-.9,f.p[2]],[back[0],back[1]+2.2,back[2]],.08,.08,steel,null,'steel');}}
      }else deck(b,pal,F,br.halfWidth,metal);
    }
  }
  // The river footbridge: a timber deck with posts and a rail on both sides.
  for(const e of MOUNTAIN_PATH_GRAPH.edges.filter(e=>e.kind==='bridge')){
    const F=frames(e.points);deck(b,pal,F,e.halfWidth,false,.28);
    for(const s of [-1,1]){const posts=F.filter((_,i)=>i%2===0||i===F.length-1).map(f=>[f.p[0]+f.side[0]*s*(e.halfWidth-.05),f.p[1],f.p[2]+f.side[2]*s*(e.halfWidth-.05)] as V3);
      for(const p of posts)b.box(p[0],p[2],0,.07,.07,p[1]-.28,p[1]+1,pal.timberLight,pal.timber,null);
      for(let i=1;i<posts.length;i++){const a=posts[i-1]!,c=posts[i]!;b.beam([a[0],a[1]+.95,a[2]],[c[0],c[1]+.95,c[2]],.12,.1,pal.timberLight);}}
  }
}
