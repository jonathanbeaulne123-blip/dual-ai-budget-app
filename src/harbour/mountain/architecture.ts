import * as THREE from 'three';
import type {PlaceDressing} from '../scene/place.ts';
import type {RenderTier} from '../scene/quality.ts';
import type {TransportKind} from './definition.ts';
import {MountainArtKit} from './artKit.ts';
import {CardBuilder} from '../art/cardScene.ts';
import {mountainArtPalette} from './art/palette.ts';
import {buildTransportArt,buildCabin} from './art/transportArt.ts';
import {buildTownArt} from './art/townArt.ts';

export function mountainPalette(d:PlaceDressing){
  return d.theme==='taylor'?{stone:'#b4a592',wood:'#665650',trim:'#d7b8bd',roof:'#72606c',light:'#eee1cd',leaf:'#8b9a71',flower:'#c98eac',metal:'#ad9665'}:
    d.theme==='newfoundland'?{stone:'#87928d',wood:'#486e70',trim:'#d7bd82',roof:'#325c65',light:'#e7e5d3',leaf:'#729080',flower:'#b5a8cf',metal:'#af9a6b'}:
      {stone:d.stone,wood:d.timber,trim:'#be9c5d',roof:d.gate,light:d.plinth,leaf:d.lawn,flower:'#dfbe75',metal:d.metal};
}
/** The transport and town architecture on the painted-card kit (stations, towers, huts, storefronts). */
export function buildMountainArchitecture(d:PlaceDressing,tier:RenderTier){
  const pal=mountainArtPalette(d),b=new CardBuilder('Mountain civic craft',tier,{ink:pal.ink});
  buildTransportArt(b,pal,tier);buildTownArt(b,pal);
  return b.finish();
}

/** A ride's cabin (its origin at the rider's feet); `setTransit` places it on the line. */
export function buildMountainCabin(d:PlaceDressing,tier:RenderTier,kind:TransportKind){
  if(kind!=='monorail'){const pal=mountainArtPalette(d);return buildCabin(kind,pal,tier,kind==='gondola'?pal.accent:pal.walls[0]!);}
  const kit=new MountainArtKit(tier,kind==='monorail'?'Island monorail carriage':kind==='gondola'?'Summit gondola carriage':'Mountain funicular carriage'),p=mountainPalette(d);
  const long=kind==='monorail',depth=long?5:2;
  kit.box([0,-.94,0],[2.8,.16,depth],p.wood);kit.box([0,-.8,0],[2.65,.06,depth-.15],p.light);
  kit.box([0,1.55,0],[3,.15,depth+.25],p.roof);
  for(const x of [-1.3,1.3])for(const z of long?[-2.35,0,2.35]:[-.9,.9])kit.box([x,.25,z],[.07,2.5,.07],p.metal);
  for(const x of [-1.3,1.3]){kit.box([x,-.16,0],[.08,.08,long?4.5:1.8],p.trim);kit.box([x,-.66,0],[.12,.28,long?4.5:1.8],p.roof);}
  {
    // Two real passenger seats, a forward cab and open panoramic window bays.
    for(const x of [-.7,.7]){
      kit.box([x,-.43,-.55],[.85,.13,.82],p.trim);
      kit.box([x,-.04,-.96],[.85,.72,.13],p.roof);
      for(const z of [-.82,-.28])kit.box([x-.31,-.7,z],[.08,.5,.08],p.metal);
    }
    kit.box([0,-.32,1.8],[1.35,.72,.18],p.wood);
    kit.box([0,.09,1.7],[1.3,.12,.52],p.metal);
    for(const z of [-1.9,-.2,1.5])for(const x of [-1.32,1.32])kit.box([x,.16,z],[.045,1.3,.055],p.trim);
    for(const z of [-1.9,1.5])kit.box([0,-1.08,z],[2.4,.18,.28],p.metal);
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
