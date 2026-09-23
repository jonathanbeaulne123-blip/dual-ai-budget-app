import * as THREE from 'three';
import type {PlaceDressing} from '../scene/place.ts';
import type {RenderTier} from '../scene/quality.ts';
import {groundHeightAt} from '../scene/ground.ts';
import {EngravedPlate} from '../court/engraved.ts';
import {SKATE_ROUTES} from './park.ts';
import {createSkateField,type SkateWorldField} from './world/field.ts';
import {buildParkMeshData,type Bucket} from './world/meshes.ts';
import {skatePalette,type SkatePalette} from './world/palette.ts';

/**
 * Tideline Skate Club v2 · the park you can see.
 *
 * Every spot is tessellated from the same `SkateField` the board rides on
 * (`world/meshes.ts`), then merged into one mesh per material: pads, card
 * bodies, steel, paint, wax, stencils, paper lanterns and one ink-line set —
 * eight draw calls for the whole island, plus a plate per spot and the
 * checkpoint ring. Painted card under raking light: a paper-grain/pencil
 * CanvasTexture is generated at runtime (no downloaded assets).
 */
export type SkateParkRunLike={run?:{id:string;checkpoint:number;finished:boolean}|null}|null;
export type SkatePark={
  group:THREE.Group;
  /** The field the park was built from; integration may hand this same instance to the sim. */
  field:SkateWorldField;
  checkpoint:THREE.Mesh;
  update(snapshot:SkateParkRunLike):void;
  dispose():void;
};

const hasCanvas=()=>typeof document!=='undefined'&&typeof document.createElement==='function';

/** Deterministic paper grain + pencil hatching, mean ≈ white so vertex colours stay authored. */
function paperTexture():THREE.CanvasTexture|null{
  if(!hasCanvas())return null;
  const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const g=canvas.getContext('2d');if(!g)return null;
  g.fillStyle='#ffffff';g.fillRect(0,0,size,size);
  let seed=0x51a7e;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<2600;i++){const v=200+Math.floor(rand()*50);g.fillStyle=`rgba(${v},${v-4},${v-10},${.18+rand()*.25})`;g.fillRect(rand()*size,rand()*size,1+rand()*1.5,1+rand()*1.5);}
  // Fibres.
  g.lineCap='round';
  for(let i=0;i<70;i++){const x=rand()*size,y=rand()*size,a=rand()*Math.PI,l=6+rand()*16;g.strokeStyle=`rgba(150,140,125,${.08+rand()*.08})`;g.lineWidth=.6;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+Math.cos(a+.5)*l*.5,y+Math.sin(a+.5)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();}
  // Pencil hatching in loose patches.
  for(let p=0;p<9;p++){const cx=rand()*size,cy=rand()*size,r=18+rand()*26;g.strokeStyle=`rgba(90,84,76,${.06+rand()*.05})`;g.lineWidth=.8;
    for(let k=-r;k<r;k+=4+rand()*2){g.beginPath();g.moveTo(cx+k-r*.4,cy+r*.4);g.lineTo(cx+k+r*.4,cy-r*.4);g.stroke();}}
  const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;return t;
}

/** A 2×2 stencil atlas (white on clear): lantern, hearth, kitty paw, wave. Original drawings. */
function stencilAtlas():THREE.CanvasTexture|null{
  if(!hasCanvas())return null;
  const size=256,h=size/2,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const g=canvas.getContext('2d');if(!g)return null;
  g.clearRect(0,0,size,size);g.fillStyle='#fff';g.strokeStyle='#fff';g.lineJoin='round';g.lineCap='round';
  // flipY: v 0..½ is the bottom half of the canvas. Icon i sits at u=(i%2)/2, v=floor(i/2)/2.
  const cell=(i:number)=>({x:(i%2)*h,y:(1-Math.floor(i/2))*h});
  { // 0 lantern: a paper lantern with its cap and a stencil bridge.
    const {x,y}=cell(0);g.save();g.translate(x+h/2,y+h/2);
    g.fillRect(-18,-44,36,8);g.beginPath();g.ellipse(0,4,30,38,0,0,Math.PI*2);g.fill();
    g.globalCompositeOperation='destination-out';g.fillRect(-30,-4,60,5);g.fillRect(-30,14,60,5);
    g.globalCompositeOperation='source-over';g.lineWidth=5;g.beginPath();g.arc(0,-50,10,Math.PI,0);g.stroke();g.fillRect(-10,40,20,8);g.restore();
  }
  { // 1 hearth: a little house with a heart for a fire.
    const {x,y}=cell(1);g.save();g.translate(x+h/2,y+h/2+6);
    g.beginPath();g.moveTo(-40,-6);g.lineTo(0,-42);g.lineTo(40,-6);g.lineTo(32,-6);g.lineTo(32,40);g.lineTo(-32,40);g.lineTo(-32,-6);g.closePath();g.fill();
    g.globalCompositeOperation='destination-out';
    g.beginPath();g.moveTo(0,30);g.bezierCurveTo(-22,14,-20,-6,-8,-6);g.bezierCurveTo(-3,-6,0,-2,0,2);g.bezierCurveTo(0,-2,3,-6,8,-6);g.bezierCurveTo(20,-6,22,14,0,30);g.fill();
    g.restore();
  }
  { // 2 kitty paw.
    const {x,y}=cell(2);g.save();g.translate(x+h/2,y+h/2+8);
    g.beginPath();g.ellipse(0,14,24,20,0,0,Math.PI*2);g.fill();
    for(const [dx,dy,r] of [[-30,-10,10],[-12,-28,11],[12,-28,11],[30,-10,10]] as const){g.beginPath();g.ellipse(dx,dy,r,r*1.25,dx*.02,0,Math.PI*2);g.fill();}
    g.restore();
  }
  { // 3 wave.
    const {x,y}=cell(3);g.save();g.translate(x+h/2,y+h/2);g.lineWidth=9;
    for(const dy of [-14,14]){g.beginPath();g.moveTo(-44,dy);for(let k=0;k<=88;k+=4)g.lineTo(-44+k,dy+Math.sin(k/88*Math.PI*3)*9);g.stroke();}
    g.restore();
  }
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function geometryOf(b:Bucket,withUv:boolean):THREE.BufferGeometry{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(b.colors,3));
  if(withUv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildSkatePark(dressing:PlaceDressing,opts:{tier?:RenderTier;field?:SkateWorldField}={}):SkatePark{
  const tier=opts.tier??'full';
  const field=opts.field??createSkateField(groundHeightAt,{tier});
  const palette:SkatePalette=skatePalette(dressing.theme);
  const data=buildParkMeshData(field,palette,tier);
  const group=new THREE.Group();group.name='Harbour skate spots';
  const owned:{dispose():void}[]=[];
  const own=<T extends {dispose():void}>(o:T):T=>{owned.push(o);return o;};
  const paper=paperTexture(),atlas=stencilAtlas();if(paper)own(paper);if(atlas)own(atlas);

  const std=(p:THREE.MeshStandardMaterialParameters)=>own(new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,...p}));
  const materials={
    pad:std({map:paper,roughness:.95,flatShading:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2}),
    card:std({map:paper,roughness:.88,flatShading:true}),
    steel:std({metalness:.55,roughness:.38,flatShading:true}),
    paint:std({map:paper,roughness:.72,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),
    wax:std({roughness:.22,metalness:.05,transparent:true,opacity:.32,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),
    decals:std({map:atlas,roughness:.8,transparent:true,opacity:.84,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),
    glow:own(new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})),
  };
  const add=(name:string,b:Bucket,material:THREE.Material,cast:boolean,withUv=true)=>{
    if(!b.positions.length)return null;
    const mesh=new THREE.Mesh(own(geometryOf(b,withUv)),material);mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=cast;group.add(mesh);return mesh;
  };
  const padMesh=add('skate-pads',data.pad,materials.pad,false);if(padMesh)padMesh.userData.ground=true;
  const cardMesh=add('skate-features',data.card,materials.card,true);if(cardMesh)cardMesh.userData.ground=true;
  add('skate-steel',data.steel,materials.steel,true,false);
  add('skate-paint',data.paint,materials.paint,false);
  if(data.wax.positions.length)add('skate-wax',data.wax,materials.wax,false,false);
  if(atlas)add('skate-stencils',data.decals,materials.decals,false);
  const glow=add('skate-lanterns',data.glow,materials.glow,false,false);if(glow)glow.receiveShadow=false;
  if(data.ink.positions.length){
    const geometry=own(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.ink.positions,3));
    const ink=new THREE.LineSegments(geometry,own(new THREE.LineBasicMaterial({color:palette.ink,transparent:true,opacity:tier==='full'?.72:.6})));ink.name='skate-ink';group.add(ink);
  }
  // Signs: an engraved plate at each spot's village side (its posts are in the card mesh).
  if(hasCanvas())for(const sign of data.signs){
    const plate=own(new EngravedPlate({stone:palette.post,highlight:palette.paint,ink:palette.lantern,width:768,size:'small',fit:true},sign.w,sign.h));
    plate.set(sign.name.toUpperCase());plate.mesh.name=`skate-sign-${sign.id}`;plate.mesh.userData.anchor=`skate:${sign.id}`;
    plate.mesh.position.set(sign.x,sign.y+1.05,sign.z);plate.mesh.rotation.y=sign.yaw;plate.mesh.castShadow=true;group.add(plate.mesh);
  }
  // The next checkpoint: a painted hoop that hugs the ground, with a paper arrow over it.
  const ringMaterial=own(new THREE.MeshStandardMaterial({color:palette.paint,roughness:.6,emissive:new THREE.Color(palette.paint),emissiveIntensity:.25}));
  const checkpoint:THREE.Mesh<THREE.BufferGeometry,THREE.Material>=new THREE.Mesh(own(new THREE.TorusGeometry(2.4,.065,6,40)),ringMaterial);checkpoint.name='skate-next-checkpoint';checkpoint.visible=false;group.add(checkpoint);
  const beam=new THREE.Mesh(own(new THREE.ConeGeometry(.28,.65,4)),ringMaterial);beam.name='skate-checkpoint-arrow';beam.visible=false;beam.rotation.z=Math.PI;group.add(beam);
  let gateKey='';
  return {group,field,checkpoint,
    update(s){
      const run=s?.run,route=run?SKATE_ROUTES.find(r=>r.id===run.id):null,at=run&&!run.finished?route?.points[run.checkpoint]:null;
      checkpoint.visible=beam.visible=Boolean(at);
      if(!at)return;
      const key=at.join(',');if(key===gateKey)return;gateKey=key;
      const points=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2,x=at[0]+Math.cos(a)*2.4,z=at[1]+Math.sin(a)*2.4;return new THREE.Vector3(x,field.heightAt(x,z)+.08,z);});
      const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),64,.045,6,true);
      const old=checkpoint.geometry,i=owned.indexOf(old);if(i>=0)owned[i]=geometry;else owned.push(geometry);old.dispose();
      checkpoint.geometry=geometry;checkpoint.rotation.set(0,0,0);
      beam.position.set(at[0],field.heightAt(at[0],at[1])+2,at[1]);
    },
    dispose(){group.removeFromParent();for(const o of owned)o.dispose();owned.length=0;group.clear();}};
}
