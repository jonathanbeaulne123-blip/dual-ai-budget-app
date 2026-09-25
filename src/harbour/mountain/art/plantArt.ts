/**
 * Instanced planting from the authored plan: six tree archetypes (round, fruit, birch,
 * pine, alpine, poplar) with visible trunks and lifted crowns, shrubs, clipped hedges,
 * heath, boulders, flower clusters, grass tufts and blossom or fruit by season.
 * Crowns are faceted card with a light top and dark underside, tinted per instance; a
 * back-face ink shell outlines them on the full tier; a soft blob shadow sits under each
 * tree. Crowns, cloth-like tufts and flowers sway in the shared wind clock.
 */
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {mountainPlanting,crownOf,type TreeKind,type MountainTree} from '../planting.ts';
import {CARD_CLOCK,paperGrain,type RGB} from '../../art/cardScene.ts';
import {shade,mix} from '../../art/cardKit.ts';
import type {MountainArtPalette} from './palette.ts';

/** Vertex colours down a crown: dark under, lit on top (the painted-card gradient). */
function gradient(g:THREE.BufferGeometry,low:number,high:number,y0:number,y1:number):THREE.BufferGeometry{
  const p=g.getAttribute('position'),c=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const t=Math.max(0,Math.min(1,(p.getY(i)-y0)/(y1-y0))),k=low+(high-low)*t;c[i*3]=c[i*3+1]=c[i*3+2]=k;}
  g.setAttribute('color',new THREE.BufferAttribute(c,3));return g;
}
const ico=(r:number,x:number,y:number,z:number,sx=1,sy=1,sz=1,detail=1)=>{const g=new THREE.IcosahedronGeometry(r,detail);g.scale(sx,sy,sz);g.translate(x,y,z);return g;};
const cone=(r:number,h:number,y:number,seg=7)=>{const g=new THREE.ConeGeometry(r,h,seg,1);g.translate(0,y+h/2,0);return g;};
const merged=(parts:THREE.BufferGeometry[])=>{const plain=parts.map(p=>{const q=p.index?p.toNonIndexed():p;if(q!==p)p.dispose();q.deleteAttribute('uv');return q;});const g=mergeGeometries(plain)!;plain.forEach(p=>p.dispose());return g;};

/** Unit crowns per archetype (size 1), in the extents `crownOf` promises the camera. */
function crownGeometry(kind:TreeKind):THREE.BufferGeometry{
  const c=crownOf({kind,size:1});let g:THREE.BufferGeometry;
  switch(kind){
    case 'fruit':g=merged([ico(1.25,0,2.35,0,1.25,.75,1.2),ico(.8,.55,2.8,.3,1,.85,1,0),ico(.75,-.6,2.55,-.35,1,.8,1,0)]);break;
    case 'birch':g=merged([ico(1,0,4.4,0,1.05,1.9,1.05),ico(.7,.35,5.4,.1,1,1.3,1,0),ico(.6,-.35,3.4,-.2,1,1.1,1,0)]);break;
    case 'pine':g=merged([cone(1.8,2.2,1.1),cone(1.4,2,2.5),cone(.95,1.8,3.8),cone(.5,1.3,4.9)]);break;
    case 'alpine':g=merged([cone(1.2,1.9,.9,6),cone(.95,1.8,2.2,6),cone(.7,1.7,3.5,6),cone(.42,1.6,4.8,6)]);break;
    case 'poplar':g=merged([ico(1,0,4.3,0,1,2.9,1),ico(.6,.1,6.2,0,1,1.4,1,0)]);break;
    default:g=merged([ico(1.55,0,3.2,0,1.2,1,1.15),ico(1.05,.9,3.9,.4,1,.9,1,0),ico(1,-.9,3.5,-.5,1,.9,1,0)]);break;
  }
  return gradient(g,.58,1.12,c.base,c.top);
}
function trunkGeometry():THREE.BufferGeometry{const g=new THREE.CylinderGeometry(.62,1,1,6,1);g.translate(0,.5,0);return gradient(g,.7,1.05,0,1);}

/** Wind: sway the upper part of each instance by its position phase. */
function windy(m:THREE.MeshStandardMaterial,amp:number,key:string){
  m.onBeforeCompile=shader=>{
    shader.uniforms.uWind=CARD_CLOCK;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uWind;').replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
      float ph=instanceMatrix[3].x*.21+instanceMatrix[3].z*.17;
      #else
      float ph=0.0;
      #endif
      float bend=max(0.0,position.y-0.6);
      transformed.x+=(sin(uWind*1.25+ph)*.7+sin(uWind*2.7+ph*1.9)*.3)*${amp.toFixed(4)}*bend;
      transformed.z+=cos(uWind*1.05+ph*1.3)*${(amp*.6).toFixed(4)}*bend;`);
  };
  m.customProgramCacheKey=()=>`hearth-wind-${key}`;
  return m;
}
/** A back-face shell a little larger than the crown, in ink: the cut-paper outline. */
function outlineMaterial(ink:string,amp:number,key:string){
  const m=new THREE.MeshBasicMaterial({color:ink,side:THREE.BackSide});
  m.onBeforeCompile=shader=>{
    shader.uniforms.uWind=CARD_CLOCK;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uWind;').replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed+=normalize(position-vec3(0.0,position.y,0.0)+vec3(0.0,0.35,0.0))*0.09;
      #ifdef USE_INSTANCING
      float ph=instanceMatrix[3].x*.21+instanceMatrix[3].z*.17;
      #else
      float ph=0.0;
      #endif
      float bend=max(0.0,position.y-0.6);
      transformed.x+=(sin(uWind*1.25+ph)*.7+sin(uWind*2.7+ph*1.9)*.3)*${amp.toFixed(4)}*bend;
      transformed.z+=cos(uWind*1.05+ph*1.3)*${(amp*.6).toFixed(4)}*bend;`);
  };
  m.customProgramCacheKey=()=>`hearth-outline-${key}`;
  return m;
}

export type Planting={group:THREE.Group;flowers:THREE.InstancedMesh|null;flowerBase:THREE.Matrix4[];setCare(days:number|null):void;bend(at:readonly [number,number,number]|null):void;dispose():void};
export function buildPlantArt(pal:MountainArtPalette,tier:'full'|'lite',season:'spring'|'summer'|'autumn'|'winter'):Planting{
  const plan=mountainPlanting(tier),group=new THREE.Group();group.name='Mountain planting';
  const owned:{dispose():void}[]=[];const own=<T extends {dispose():void}>(o:T)=>{owned.push(o);return o;};
  const paper=paperGrain();
  const mat=(amp:number,key:string,extra:THREE.MeshStandardMaterialParameters={})=>own(windy(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,flatShading:true,map:paper,...extra}),amp,key));
  const dummy=new THREE.Object3D(),colour=new THREE.Color();
  const instanced=(g:THREE.BufferGeometry,m:THREE.Material,n:number,name:string,cast:boolean)=>{const mesh=new THREE.InstancedMesh(own(g),m,Math.max(1,n));mesh.count=n;mesh.name=name;mesh.castShadow=cast&&tier==='full';mesh.receiveShadow=true;group.add(mesh);owned.push(mesh);return mesh;};
  const leafFor=(t:MountainTree):RGB=>{
    const L=pal.leaf,base=t.kind==='pine'||t.kind==='alpine'?pal.pine[Math.floor(t.tint*pal.pine.length)%pal.pine.length]!:L[Math.floor(t.tint*L.length)%L.length]!;
    const autumn=season==='autumn'&&(t.kind==='round'||t.kind==='birch'||t.kind==='poplar')?mix(base,t.tint>.5?[.78,.52,.22]:[.72,.62,.25],.2+t.tint*.25):base;
    return shade(mix(autumn,t.kind==='birch'?[.75,.85,.55]:autumn,.25),.92+t.tint*.16);
  };
  // Trunks: one instanced mesh; birch white with pencil bands, the rest bark brown.
  const trees=plan.trees,trunkMat=own(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:true,map:paper}));
  const trunks=instanced(trunkGeometry(),trunkMat,trees.length,'Mountain trunks',true);
  trees.forEach((t,i)=>{const c=crownOf(t);dummy.position.set(t.x,t.y-.25,t.z);dummy.rotation.set(t.lean,t.spin,t.lean*.5);dummy.scale.set(c.trunk,c.trunkTop+.4,c.trunk);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    colour.setRGB(...(t.kind==='birch'?pal.birch:shade(pal.timber,.9+t.tint*.25)));trunks.setColorAt(i,colour);});
  trunks.instanceMatrix.needsUpdate=true;if(trunks.instanceColor)trunks.instanceColor.needsUpdate=true;
  // Crowns per archetype, with an ink shell on the full tier.
  const kinds:TreeKind[]=['round','fruit','birch','pine','alpine','poplar'];
  const crowns:THREE.InstancedMesh[]=[];
  for(const kind of kinds){
    const list=trees.filter(t=>t.kind===kind);if(!list.length)continue;
    const amp=kind==='pine'||kind==='alpine'?.012:.022,geo=crownGeometry(kind);
    const mesh=instanced(geo,mat(amp,`crown-${kind}`),list.length,`Mountain ${kind} crowns`,true);
    list.forEach((t,i)=>{dummy.position.set(t.x,t.y,t.z);dummy.rotation.set(t.lean*.5,t.spin,0);dummy.scale.setScalar(t.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);colour.setRGB(...leafFor(t));mesh.setColorAt(i,colour);});
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;crowns.push(mesh);
    if(tier==='full'){const shell=new THREE.InstancedMesh(geo,own(outlineMaterial(pal.ink,amp,`shell-${kind}`)),list.length);shell.name=`Mountain ${kind} outline`;for(let i=0;i<list.length;i++){mesh.getMatrixAt(i,dummy.matrix);shell.setMatrixAt(i,dummy.matrix);}shell.instanceMatrix.needsUpdate=true;group.add(shell);owned.push(shell);}
    // Blossom in spring, fruit in late summer and autumn, on the orchard's fruit trees.
    if(kind==='fruit'&&(season==='spring'||season==='summer'||season==='autumn')){
      const dots=season==='spring'?16:9,dotGeo=new THREE.OctahedronGeometry(season==='spring'?.2:.17,0),m=new THREE.InstancedMesh(own(dotGeo),own(new THREE.MeshStandardMaterial({roughness:.6,flatShading:true})),list.length*dots);
      m.name=season==='spring'?'Orchard blossom':'Orchard fruit';let n=0;
      list.forEach((t,i)=>{for(let k=0;k<dots;k++){const a=(k*2.399+i)%6.283,h=((k*.37+i*.13)%1),r=(1.05+h*.35)*t.size;dummy.position.set(t.x+Math.cos(a+t.spin)*r,t.y+(1.9+h*1.1)*t.size,t.z+Math.sin(a+t.spin)*r);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();m.setMatrixAt(n,dummy.matrix);
        colour.setRGB(...(season==='spring'?pal.blossom[k%pal.blossom.length]!:k%4===0?mix(pal.fruit,[.9,.75,.3],.4):pal.fruit));m.setColorAt(n,colour);n++;}});
      m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;group.add(m);owned.push(m);
    }
  }
  // Blob shadows under every tree: soft discs lying on the ground.
  {const seg=10,pos:number[]=[],col:number[]=[];for(let k=0;k<seg;k++){const a0=k/seg*Math.PI*2,a1=(k+1)/seg*Math.PI*2;pos.push(0,0,0,Math.cos(a0),0,Math.sin(a0),Math.cos(a1),0,Math.sin(a1));col.push(0,0,0,.34,0,0,0,0,0,0,0,0);}
    const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,4));
    const m=new THREE.InstancedMesh(g,own(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-3})),trees.length);m.name='Tree contact shadows';m.renderOrder=1;
    trees.forEach((t,i)=>{const c=crownOf(t);dummy.position.set(t.x+.6*t.size,t.y+.06,t.z-.3*t.size);dummy.rotation.set(0,0,0);dummy.scale.set(c.radius*1.05,1,c.radius*.95);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});
    m.instanceMatrix.needsUpdate=true;group.add(m);owned.push(m);}
  // Shrubs, hedges, heath and boulders.
  const shrubs=plan.shrubs;
  const bush=gradient(merged([ico(.7,0,.45,0,1.2,.75,1.1,0),ico(.5,.4,.62,.2,1,.8,1,0)]),.62,1.1,0,1.1);
  const hedge=gradient(new THREE.BoxGeometry(1,1,1,2,1,1).translate(0,.5,0),.66,1.08,0,1);
  const heath=gradient(ico(.6,0,.18,0,1.4,.45,1.3,0),.7,1.08,-.1,.5);
  const rock=gradient(ico(.8,0,.25,0,1.3,.75,1.05,0),.72,1.08,-.3,.9);
  const groups:Record<string,{g:THREE.BufferGeometry;list:typeof shrubs;cast:boolean}>={bush:{g:bush,list:shrubs.filter(s=>s.kind==='shrub'||s.kind==='flowering'),cast:true},hedge:{g:hedge,list:shrubs.filter(s=>s.kind==='hedge'),cast:true},heath:{g:heath,list:shrubs.filter(s=>s.kind==='heath'),cast:false},rock:{g:rock,list:shrubs.filter(s=>s.kind==='boulder'),cast:true}};
  for(const [name,{g,list,cast}] of Object.entries(groups)){
    const m=name==='rock'?own(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:true,map:paper})):mat(name==='hedge'?.004:.012,`shrub-${name}`);
    const mesh=instanced(g,m,list.length,`Mountain ${name}`,cast);
    list.forEach((s,i)=>{dummy.position.set(s.x,s.y-(name==='rock'?.25*s.size:.05),s.z);dummy.rotation.set(0,s.spin,0);dummy.scale.set(s.size*(name==='hedge'?s.stretch:1),s.size*(name==='hedge'?1.25:1),s.size*(name==='hedge'?.9:1));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      const c:RGB=name==='rock'?shade(pal.stone,.8+s.tint*.25):name==='heath'?shade(mix(pal.heath,pal.leaf[0]!,s.tint*.4),.9+s.tint*.15):name==='hedge'?shade(pal.pine[0]!,1.05+s.tint*.1):shade(pal.leaf[Math.floor(s.tint*pal.leaf.length)%pal.leaf.length]!,.85+s.tint*.2);
      colour.setRGB(...c);mesh.setColorAt(i,colour);});
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  }
  // Flowers: clusters of small cut-paper blooms, one colour per cluster (more with care).
  const blooms:{x:number;y:number;z:number;s:number;c:RGB}[]=[];
  for(const f of plan.flowers){let seed=f.seed;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const c=pal.flowers[f.colour%pal.flowers.length]!;
    for(let k=0;k<f.count;k++){const a=r()*6.283,d=Math.sqrt(r())*f.radius;blooms.push({x:f.x+Math.cos(a)*d,y:f.y,z:f.z+Math.sin(a)*d,s:.8+r()*.5,c:shade(c,.9+r()*.2)});}}
  // Order blooms so care grows whole clusters outward rather than thinning everything.
  const flowerGeo=merged([cone(.16,.42,0,5),ico(.16,0,.5,0,1,.6,1,0)]);gradient(flowerGeo,.8,1.15,0,.6);
  const flowers=blooms.length?instanced(flowerGeo,mat(.05,'flower'),blooms.length,'Flower meadows',false):null;
  const flowerBase:THREE.Matrix4[]=[];
  if(flowers){blooms.forEach((bl,i)=>{dummy.position.set(bl.x,bl.y-.04,bl.z);dummy.rotation.set(0,i*1.7,0);dummy.scale.setScalar(bl.s);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);flowerBase.push(dummy.matrix.clone());colour.setRGB(...bl.c);flowers.setColorAt(i,colour);});
    flowers.instanceMatrix.needsUpdate=true;if(flowers.instanceColor)flowers.instanceColor.needsUpdate=true;flowers.count=Math.round(blooms.length*.4);}
  // Grass tufts: a fan of five thin cut-paper blades leaning out from one root, dark at the foot.
  const tuftGeo=new THREE.BufferGeometry();{const p:number[]=[];for(let k=0;k<5;k++){const a=k/5*Math.PI*2+.3,lean=.12+(k%2)*.1,h=.34+(k%3)*.09,w=.045,ca=Math.cos(a),sa=Math.sin(a);
      p.push(-sa*w,0,ca*w, sa*w,0,-ca*w, ca*lean*1.6,h,sa*lean*1.6);}
    tuftGeo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));tuftGeo.computeVertexNormals();gradient(tuftGeo,.55,1.02,0,.45);}
  const tuftMat=mat(.08,'tuft',{side:THREE.DoubleSide});
  const tufts=instanced(tuftGeo,tuftMat,plan.tufts.length,'Grass tufts',false);
  plan.tufts.forEach((t,i)=>{dummy.position.set(t.x,t.y-.02,t.z);dummy.rotation.set(0,t.spin,0);dummy.scale.set(t.size,t.size*(1.1+t.tint*.5),t.size);dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);colour.setRGB(...shade(mix(pal.leaf[t.tint>.5?1:2]!,[.72,.7,.4],t.tint*.18),.85+t.tint*.15));tufts.setColorAt(i,colour);});
  tufts.instanceMatrix.needsUpdate=true;if(tufts.instanceColor)tufts.instanceColor.needsUpdate=true;
  let dead=false,lastVisitor:readonly [number,number,number]|null=null;
  return {group,flowers,flowerBase,
    setCare(days){if(!flowers)return;flowers.count=days==null?Math.round(blooms.length*.4):Math.min(blooms.length,Math.round(blooms.length*(.4+.6*Math.min(1,days/12))));},
    /** Flowers lean away from a visitor within 2.5 units; null straightens them all. */
    bend(at){if(!flowers)return;const old=lastVisitor;lastVisitor=at;const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();let touched=false;
      for(let i=0;i<flowerBase.length;i++){const base=flowerBase[i]!,px=base.elements[12]!,pz=base.elements[14]!;
        const near=at?Math.hypot(px-at[0],pz-at[2]):99,was=old?Math.hypot(px-old[0],pz-old[2]):99;if(near>2.5&&was>2.5)continue;
        base.decompose(p,q,s);dummy.position.copy(p);dummy.quaternion.copy(q);dummy.scale.copy(s);if(at&&near<2.5){dummy.rotateZ((1-near/2.5)*.45*Math.sign(px-at[0]||1));}dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);touched=true;}
      if(touched)flowers.instanceMatrix.needsUpdate=true;},
    dispose(){if(dead)return;dead=true;group.removeFromParent();owned.forEach(o=>o.dispose());group.clear();}};
}
