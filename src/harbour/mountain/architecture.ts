import * as THREE from 'three';
import type {PlaceDressing} from '../scene/place.ts';
import type {RenderTier} from '../scene/quality.ts';
import {groundHeightAt} from '../scene/ground.ts';
import {RESERVED_PLOTS,TRANSPORT_STOPS,RIVER,SKILL_BRANCHES,nearestOnRoute,mountainBaseHeight,type Point3,type TransportKind} from './definition.ts';
import {STATION_SOLIDS,SUMMIT_ART_SOLIDS,SUMMIT_OBSERVATORY} from './artGeometry.ts';
import {MountainArtKit} from './artKit.ts';

export function mountainPalette(d:PlaceDressing){
  return d.theme==='taylor'?{stone:'#b4a592',wood:'#665650',trim:'#d7b8bd',roof:'#72606c',light:'#eee1cd',leaf:'#8b9a71',flower:'#c98eac',metal:'#ad9665'}:
    d.theme==='newfoundland'?{stone:'#87928d',wood:'#486e70',trim:'#d7bd82',roof:'#325c65',light:'#e7e5d3',leaf:'#729080',flower:'#b5a8cf',metal:'#af9a6b'}:
      {stone:d.stone,wood:d.timber,trim:'#be9c5d',roof:d.gate,light:d.plinth,leaf:d.lawn,flower:'#dfbe75',metal:d.metal};
}
/** Station craft, route fascia and flush town/plot markings. No new walkable decks. */
export function buildMountainArchitecture(d:PlaceDressing,tier:RenderTier){
  const kit=new MountainArtKit(tier,'Mountain civic craft'),p=mountainPalette(d);
  for(const solid of STATION_SOLIDS){const size=solid.max.map((v,i)=>v-solid.min[i]!) as unknown as Point3,at=solid.max.map((v,i)=>(v+solid.min[i]!)/2) as unknown as Point3;kit.box(at,size,solid.id.includes(':fin:')?p.roof:p.wood);}
  for(const [kind,stops] of Object.entries(TRANSPORT_STOPS))for(const stop of stops){
    const [x,y,z]=stop.at;
    // Slatted overhead fins leave sky and camera visibility; their undersides clear a jump.
    // Thin boarding lines sit on the exact supported platform, never above the feet.
    for(const end of [-1,1])kit.box([x,y+.047,z+end*1.65],[5.7,.014,.12],p.trim);
    for(let n=-2;n<=2;n++)kit.box([x+n,y+.055,z+.8],[.32,.014,.48],p.light);
    kit.box([x,y+3.56,z+2.35],[5.2,.42,.12],p.roof);
    if(kind==='gondola'){
      // Visible bullwheel explains the suspended line without enclosing the rider.
      kit.part(new THREE.TorusGeometry(.72,.1,5,16),p.metal,[x,y+3.55,z],[1,1,1],[Math.PI/2,0,0]);
    }else for(const side of [-1,1])kit.box([x+side*.8,y+.056,z],[.08,.016,3.8],p.metal);
    if(d.theme==='taylor')for(let n=0;n<5;n++)kit.part(new THREE.ConeGeometry(.2,.4,3),n%2?p.trim:p.light,[x-2+n,y+3.07,z+2.4],[1,1,1],[0,0,Math.PI]);
    if(d.theme==='newfoundland')for(const side of [-1,1])kit.part(new THREE.TorusGeometry(.27,.06,5,12),p.trim,[x+side*2.3,y+3.4,z+2.44]);
  }
  const [ox,oy,oz]=SUMMIT_OBSERVATORY.at,{radius,spring}=SUMMIT_OBSERVATORY;
  for(const solid of SUMMIT_ART_SOLIDS.filter(s=>s.id.includes(':post:')))kit.box([(solid.min[0]+solid.max[0])/2,112,(solid.min[2]+solid.max[2])/2],[.22,4,.22],p.wood);
  // A pale copper dome and brass meridians form the mountain's long-distance crown.
  kit.part(new THREE.SphereGeometry(radius,16,8,0,Math.PI*2,0,Math.PI/2),p.roof,[ox,oy+spring,oz]);
  kit.part(new THREE.TorusGeometry(radius,.1,5,24),p.trim,[ox,oy+spring,oz],[1,1,1],[Math.PI/2,0,0]);
  for(let meridian=0;meridian<6;meridian++){
    const a=meridian*Math.PI/3;
    for(let n=0;n<8;n++){
      const t=n/8*Math.PI/2,u=(n+1)/8*Math.PI/2;
      kit.beam([ox+Math.cos(a)*Math.cos(t)*(radius+.02),oy+spring+Math.sin(t)*(radius+.02),oz+Math.sin(a)*Math.cos(t)*(radius+.02)],
        [ox+Math.cos(a)*Math.cos(u)*(radius+.02),oy+spring+Math.sin(u)*(radius+.02),oz+Math.sin(a)*Math.cos(u)*(radius+.02)],.045,p.trim);
    }
  }
  // The same curve and width produce a continuous fascia, entirely below each support deck.
  for(const branch of SKILL_BRANCHES)for(let i=1;i<branch.points.length;i++){
    const a=branch.points[i-1]!,b=branch.points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1;
    for(const side of [-1,1]){
      const offset=branch.halfWidth-.08,oa:Point3=[a[0]-dz/length*offset*side,a[1]-.16,a[2]+dx/length*offset*side],ob:Point3=[b[0]-dz/length*offset*side,b[1]-.16,b[2]+dx/length*offset*side];
      kit.beam(oa,ob,.09,branch.id==='dam-promenade'?p.metal:p.wood);
    }
    if(i%3===0){const y=a[1]+.053;kit.box([a[0],y,a[2]],[branch.halfWidth*1.8,.012,.09],p.trim,[0,-Math.atan2(dx,dz),0]);}
  }
  // Reserved ground stays visibly unbuilt: inset corner stitches and a low meadow weave.
  for(const plot of RESERVED_PLOTS)for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=plot.at[0]+sx*(plot.half[0]-1),z=plot.at[2]+sz*(plot.half[1]-1);
    for(let i=0;i<5;i++){
      const px=x-sx*i*.5,pz=z-sz*i*.5;
      kit.box([px,mountainBaseHeight(px,z)+.03,z],[.4,.025,.15],p.trim);
      kit.box([x,mountainBaseHeight(x,pz)+.03,pz],[.15,.025,.4],p.trim);
    }
  }
  // Mosaic rings around the existing town fountain and a compass at the social quay.
  for(const [cx,cz,r] of [[0,0,3.3],[-14,42,3.8]] as const)for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
    kit.box([x,groundHeightAt(x,z)+.06,z],[.5,.025,.22],i%4===0?p.trim:p.stone,[0,-a,0]);
    if(cx!==0&&i%8===0)kit.box([cx+Math.cos(a)*1.1,groundHeightAt(cx+Math.cos(a)*1.1,cz+Math.sin(a)*1.1)+.06,cz+Math.sin(a)*1.1],[1.2,.025,.12],p.light,[0,-a,0]);
  }
  // Water remains the existing shared channel. Low bank tesserae reveal its town course.
  for(let z=-32;z<44;z+=1.6){const q=nearestOnRoute(-8,z,RIVER);if(q.point[2]>46)continue;
    for(const side of [-1,1]){const x=q.point[0]+side*2.5,h=groundHeightAt(x,z);kit.box([x,h+.045,z],[.5,.025,.9],p.stone);}
  }
  return kit.finish();
}

/** Open carriage sides preserve the third-person view; both models share ride authority. */
export function buildMountainCabin(d:PlaceDressing,tier:RenderTier,kind:TransportKind){
  const kit=new MountainArtKit(tier,kind==='gondola'?'Summit gondola carriage':'Mountain funicular carriage'),p=mountainPalette(d);
  kit.box([0,-.94,0],[2.8,.16,2],p.wood);kit.box([0,-.8,0],[2.65,.06,1.85],p.light);
  kit.box([0,1.55,0],[3,.15,2.25],p.roof);
  for(const x of [-1.3,1.3])for(const z of [-.9,.9])kit.box([x,.25,z],[.07,2.5,.07],p.metal);
  for(const x of [-1.3,1.3]){kit.box([x,-.16,0],[.08,.08,1.8],p.trim);kit.box([x,-.66,0],[.12,.28,1.8],p.roof);}
  if(kind==='gondola'){
    kit.beam([0,1.65,0],[0,1.97,0],.07,p.metal);kit.box([0,1.95,0],[.2,.12,1],p.metal);
    for(const z of [-.35,.35])kit.part(new THREE.CylinderGeometry(.14,.14,.16,8),p.metal,[0,2,z],[1,1,1],[0,0,Math.PI/2]);
  }else{
    for(const x of [-.8,.8])for(const z of [-.65,.65])kit.part(new THREE.CylinderGeometry(.22,.22,.12,8),p.metal,[x,-1.08,z],[1,1,1],[0,0,Math.PI/2]);
    for(let z=-.6;z<.8;z+=.4)kit.box([0,-.76,z],[2.3,.012,.045],p.trim);
  }
  if(d.theme==='newfoundland')kit.part(new THREE.TorusGeometry(.28,.065,5,12),p.trim,[1.37,-.4,0],[1,1,1],[0,Math.PI/2,0]);
  if(d.theme==='taylor')for(const z of [-.6,0,.6])kit.box([-1.37,-.55,z],[.018,.18,.15],p.trim);
  return kit.finish();
}

/** Cheap, recognisable distant massing behind the existing streamed room exteriors. */
export function buildDestinationSilhouette(kind:import('../village/architecture.ts').VillageBuildingKind,d:PlaceDressing,tier:RenderTier){
  const kit=new MountainArtKit(tier,`Distant ${kind} silhouette`),p=mountainPalette(d);
  const footprint={home:[4.5,3.5],bank:[4.6,3.6],library:[4.4,3.4],glasshouse:[4,3],studio:[3.8,2.9],cottage:[3.2,2.6],boathouse:[3.6,3]} as const;
  const [hx,hz]=footprint[kind],height=kind==='home'?6.2:kind==='bank'?3.5:3.05;
  const gable=(x:number,y:number,z:number,width:number,depth:number,rise:number)=>{
    const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(0,rise);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geo.translate(0,0,-depth/2);kit.part(geo,p.roof,[x,y,z]);
  };
  if(kind==='glasshouse'){
    // Open iron nave, visibly lighter than the masonry destinations at every distance.
    for(const x of [-hx,0,hx])for(const z of [-hz,hz])kit.box([x,1.55,z],[.18,3.1,.18],p.wood);
    for(const z of [-hz,0,hz])for(const side of [-1,1])kit.beam([side*hx,3.1,z],[0,4.5,z],.12,p.roof);
    kit.beam([0,4.5,-hz],[0,4.5,hz],.12,p.trim);
    kit.box([0,.3,0],[hx*2,.6,hz*2],p.stone);
    for(const x of [-2.5,0,2.5])kit.part(new THREE.IcosahedronGeometry(.8,0),p.leaf,[x,1.5,0]);
  }else{
    kit.box([0,height/2,0],[hx*2,height,hz*2],kind==='boathouse'?p.wood:p.light);
    if(kind==='bank'){
      kit.box([0,3.65,0],[9.4,.3,7.4],p.stone);kit.part(new THREE.CylinderGeometry(.8,.8,1,6),p.trim,[0,4.3,-1]);kit.part(new THREE.ConeGeometry(1,.85,6),p.roof,[0,5.2,-1]);
    }else gable(0,height,0,hx*2+.25,hz*2+.25,kind==='home'?1.38:1.05);
    if(kind==='home'){
      for(const x of [-1.75,1.55]){kit.box([x,7,hz-.4],[1.55,.8,1.2],p.light);gable(x,7.4,hz-.4,1.85,1.5,.6);}
      kit.box([hx-.7,4.8,-hz+.55],[.8,4.1,.9],p.stone);
      kit.box([0,2.8,hz+.4],[hx*2,.18,1.3],p.roof);
      kit.box([0,3.1,hz+.05],[hx*2,.38,.12],p.wood);
    }else if(kind==='library'){
      kit.part(new THREE.CylinderGeometry(.9,.9,4.4,8),p.light,[-2.85,2.2,hz-.23]);kit.part(new THREE.ConeGeometry(1.16,1.6,8),p.roof,[-2.85,5.2,hz-.23]);
    }else if(kind==='studio'){
      kit.box([hx-1,4.1,-hz+.85],[1.02,2.5,1],p.wood);kit.box([hx-1,5.4,-hz+.85],[1.3,.18,1.25],p.stone);
    }else if(kind==='cottage'){
      kit.box([-hx+.8,3.9,-hz+.6],[.6,1.6,.65],p.stone);
      kit.part(new THREE.CircleGeometry(.55,12),p.trim,[-.7,2.2,hz+.02]);
    }else if(kind==='boathouse'){
      kit.box([0,1.35,hz+.02],[2.5,2.5,.035],p.roof);
      kit.box([0,1.35,hz+.05],[.1,2.5,.06],p.trim);
    }
    // A sparse warm window rhythm survives the long view without detailed facade draws.
    for(const x of [-hx*.6,hx*.6])kit.box([x,1.85,hz+.03],[.75,1,.035],p.trim);
  }
  return kit.finish();
}
