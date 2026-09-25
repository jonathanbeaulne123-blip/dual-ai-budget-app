import * as THREE from 'three';
import type {PlaceDressing} from '../scene/place.ts';
import type {RenderTier} from '../scene/quality.ts';
import {groundHeightAt} from '../scene/ground.ts';
import {EngravedPlate} from '../court/engraved.ts';
import {SKATE_ROUTES} from './park.ts';
import {createSkateField,type SkateWorldField} from './world/field.ts';
import {buildParkMeshData,type Bucket,type DressingFootprint} from './world/meshes.ts';
import {ATLAS_GRID,ICON,emptyMeshData,makeKit,mix,rgb,shade,type V3} from './world/meshesKit.ts';
import type {RaceGate} from '../mountain/race.ts';
import {rememberDressing} from './world/dressingSolids.ts';
import {skatePalette,type SkatePalette} from './world/palette.ts';

/**
 * Tideline Skate Club v2 · the park you can see.
 *
 * Every spot is tessellated from the same `SkateField` the board rides on
 * (`world/meshes.ts`), dressed round its edges (`world/meshesDressing.ts`),
 * then merged into one mesh per material: pads, card bodies (features and
 * dressing), steel, paint, wax, stencils, paper lanterns, contact shade and
 * one ink/pencil/chalk line set — nine draw calls for the whole island, plus
 * a plate per spot and the checkpoint ring. Painted card under raking light:
 * a paper-grain CanvasTexture and a 3×3 stencil atlas are drawn once at
 * runtime (no downloaded assets).
 */
export type SkateParkRunLike={run?:{id:string;checkpoint:number;finished:boolean}|null}|null;
export type SkatePark={
  group:THREE.Group;
  /** The field the park was built from; integration may hand this same instance to the sim. */
  field:SkateWorldField;
  checkpoint:THREE.Mesh;
  /**
   * The decorative pieces standing round the spots (hedges, fence flats, lamps, bleachers,
   * masts, pots…). None of them is in `field.solids`; the ride merges them in as sim solids
   * (`world/dressingSolids.ts`, handed over here so they are not built twice).
   */
  dressing:readonly DressingFootprint[];
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

/**
 * A 3×3 stencil atlas (white on clear), original drawings: lantern, hearth,
 * kitty paw / wave, coin, shell / star, arrow, apple (see `ICON`).
 */
function stencilAtlas():THREE.CanvasTexture|null{
  if(!hasCanvas())return null;
  const cellPx=128,size=cellPx*ATLAS_GRID,h=cellPx,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const g=canvas.getContext('2d');if(!g)return null;
  g.clearRect(0,0,size,size);g.fillStyle='#fff';g.strokeStyle='#fff';g.lineJoin='round';g.lineCap='round';
  // flipY: v 0..⅓ is the bottom row of the canvas. Icon i sits at u=(i%3)/3, v=floor(i/3)/3.
  const at=(i:number,draw:()=>void)=>{const x=(i%ATLAS_GRID)*h,y=(ATLAS_GRID-1-Math.floor(i/ATLAS_GRID))*h;g.save();g.translate(x+h/2,y+h/2);g.globalCompositeOperation='source-over';draw();g.restore();};
  at(ICON.lantern,()=>{ // a paper lantern with its cap and stencil bridges
    g.fillRect(-18,-44,36,8);g.beginPath();g.ellipse(0,4,30,38,0,0,Math.PI*2);g.fill();
    g.globalCompositeOperation='destination-out';g.fillRect(-30,-4,60,5);g.fillRect(-30,14,60,5);
    g.globalCompositeOperation='source-over';g.lineWidth=5;g.beginPath();g.arc(0,-50,10,Math.PI,0);g.stroke();g.fillRect(-10,40,20,8);
  });
  at(ICON.hearth,()=>{ // a little house with a heart for a fire
    g.translate(0,6);g.beginPath();g.moveTo(-40,-6);g.lineTo(0,-42);g.lineTo(40,-6);g.lineTo(32,-6);g.lineTo(32,40);g.lineTo(-32,40);g.lineTo(-32,-6);g.closePath();g.fill();
    g.globalCompositeOperation='destination-out';
    g.beginPath();g.moveTo(0,30);g.bezierCurveTo(-22,14,-20,-6,-8,-6);g.bezierCurveTo(-3,-6,0,-2,0,2);g.bezierCurveTo(0,-2,3,-6,8,-6);g.bezierCurveTo(20,-6,22,14,0,30);g.fill();
  });
  at(ICON.paw,()=>{
    g.translate(0,8);g.beginPath();g.ellipse(0,14,24,20,0,0,Math.PI*2);g.fill();
    for(const [dx,dy,r] of [[-30,-10,10],[-12,-28,11],[12,-28,11],[30,-10,10]] as const){g.beginPath();g.ellipse(dx,dy,r,r*1.25,dx*.02,0,Math.PI*2);g.fill();}
  });
  at(ICON.wave,()=>{
    g.lineWidth=9;
    for(const dy of [-14,14]){g.beginPath();g.moveTo(-44,dy);for(let k=0;k<=88;k+=4)g.lineTo(-44+k,dy+Math.sin(k/88*Math.PI*3)*9);g.stroke();}
  });
  at(ICON.coin,()=>{ // a stamped coin: rim, a hearth-heart in the middle
    g.lineWidth=7;g.beginPath();g.arc(0,0,44,0,Math.PI*2);g.stroke();g.lineWidth=3;g.beginPath();g.arc(0,0,34,0,Math.PI*2);g.stroke();
    g.beginPath();g.moveTo(0,20);g.bezierCurveTo(-22,4,-18,-18,-6,-18);g.bezierCurveTo(-2,-18,0,-14,0,-10);g.bezierCurveTo(0,-14,2,-18,6,-18);g.bezierCurveTo(18,-18,22,4,0,20);g.fill();
  });
  at(ICON.shell,()=>{ // a scallop shell
    g.beginPath();g.moveTo(0,40);for(let k=0;k<=12;k++){const a=Math.PI*(1.08+k/12*.84);const r=k%2?40:46;g.lineTo(Math.cos(a)*r,Math.sin(a)*r+8);}g.closePath();g.fill();
    g.fillRect(-12,36,24,10);
    g.globalCompositeOperation='destination-out';g.lineWidth=3;
    for(let k=1;k<6;k++){const a=Math.PI*(1.1+k/6*.8);g.beginPath();g.moveTo(0,36);g.lineTo(Math.cos(a)*38,Math.sin(a)*38+8);g.stroke();}
  });
  at(ICON.star,()=>{ // a five-point star
    g.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,r=k%2?20:48;g.lineTo(Math.cos(a)*r,Math.sin(a)*r+4);}g.closePath();g.fill();
  });
  at(ICON.arrow,()=>{ // a chalk arrow pointing +u (stencil "right")
    g.lineWidth=10;g.beginPath();g.moveTo(-44,6);g.quadraticCurveTo(-10,-10,34,0);g.stroke();
    g.beginPath();g.moveTo(46,0);g.lineTo(18,-22);g.lineTo(22,18);g.closePath();g.fill();
  });
  at(ICON.apple,()=>{
    g.beginPath();g.moveTo(0,-18);g.bezierCurveTo(-30,-34,-50,0,-30,30);g.bezierCurveTo(-18,46,-6,40,0,36);g.bezierCurveTo(6,40,18,46,30,30);g.bezierCurveTo(50,0,30,-34,0,-18);g.fill();
    g.lineWidth=5;g.beginPath();g.moveTo(0,-18);g.lineTo(4,-38);g.stroke();g.beginPath();g.ellipse(16,-34,12,6,-.5,0,Math.PI*2);g.fill();
  });
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

/**
 * One race gate as a standing object on the painted-card kit: two posts at
 * the gate's true width, a banner spanning between them at the height its
 * crossing test reaches, a fringe of paper pennants under it, ink on every cut
 * edge and a stencil on the banner (the finish gets a star, every other gate
 * an arrow). Posts stand down to whatever ground is under them.
 */
function gateMesh(gate:RaceGate,index:number,finish:boolean,palette:SkatePalette,material:THREE.Material):THREE.Group{
  const data=emptyMeshData(),ink=rgb(palette.ink),kit=makeKit(data,ink);
  const [x,y,z]=gate.at,[nx,nz]=gate.normal,rx=nz,rz=-nx,w=gate.halfWidth,top=y+gate.halfHeight+.7;
  const postC=rgb(palette.post),banner=rgb(finish?palette.coping:palette.paint),trim=rgb(palette.chalk),alt=rgb(palette.wood);
  const yaw=Math.atan2(nx,nz);
  for(const side of [-1,1]){
    const px=x+rx*(w+.18)*side,pz=z+rz*(w+.18)*side,foot=Math.min(y,groundHeightAt(px,pz))-.15;
    kit.box(data.card,px,pz,yaw,.13,.13,foot,top+.22,shade(postC,1.08),postC,ink);
    kit.box(data.card,px,pz,yaw,.2,.2,top+.22,top+.36,trim,shade(trim,.9),ink);
    // A foot plate where the post meets its ground.
    kit.box(data.card,px,pz,yaw,.3,.3,foot,Math.max(foot+.1,Math.min(y,groundHeightAt(px,pz))+.06),shade(postC,.9),shade(postC,.7),ink);
  }
  // The banner: a thick paper band across the full width, faces both ways.
  const L=(s:number,h:number):V3=>[x+rx*(w+.18)*s,h,z+rz*(w+.18)*s];
  kit.box(data.card,x,z,yaw,.05,w+.1,top-.62,top,banner,shade(banner,.82),ink);
  // Pennants: alternating card triangles hanging from the banner's lower edge.
  const count=Math.max(6,Math.round(w*1.6));
  for(let i=0;i<count;i++){
    const t0=-1+2*i/count,t1=-1+2*(i+1)/count,tm=(t0+t1)/2,c=i%2?banner:alt;
    for(const off of [-.06,.06]){
      const a=L(t0,top-.62),b=L(t1,top-.62),m=L(tm,top-1.02);
      const shift=(p:V3):V3=>[p[0]+nx*off,p[1],p[2]+nz*off];
      kit.tri(data.card,shift(a),shift(b),shift(m),mix(c,trim,.08),.02);
      kit.line(shift(a),shift(m),shade(ink,1));kit.line(shift(m),shift(b),shade(ink,1));
    }
  }
  // A stencil on each face of the banner.
  for(const face of [-1,1]){
    const c:V3=[x+nx*.06*face,top-.31,z+nz*.06*face],right:V3=[rx*face,0,rz*face],up:V3=[0,1,0];
    kit.decal(c,right,up,.26,finish?ICON.star:ICON.arrow,[nx*.004*face,0,nz*.004*face],trim,[nx*face,0,nz*face]);
  }
  const group=new THREE.Group();group.name=`race-gate-${index}`;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.card.positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(data.card.normals,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.card.colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.card.uvs,2));
  geometry.computeBoundingSphere();
  const body=new THREE.Mesh(geometry,material);body.castShadow=true;body.receiveShadow=true;body.name='race-gate-card';group.add(body);
  if(data.ink.positions.length){
    const lines=new THREE.BufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute(data.ink.positions,3));lines.setAttribute('color',new THREE.Float32BufferAttribute(data.ink.colors,3));
    const inkMesh=new THREE.LineSegments(lines,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.8}));inkMesh.name='race-gate-ink';group.add(inkMesh);
  }
  if(data.decals.positions.length){
    const decals=new THREE.BufferGeometry();decals.setAttribute('position',new THREE.Float32BufferAttribute(data.decals.positions,3));decals.setAttribute('normal',new THREE.Float32BufferAttribute(data.decals.normals,3));decals.setAttribute('color',new THREE.Float32BufferAttribute(data.decals.colors,3));decals.setAttribute('uv',new THREE.Float32BufferAttribute(data.decals.uvs,2));
    group.userData.decals=decals;
  }
  return group;
}

export function buildSkatePark(dressing:PlaceDressing,opts:{tier?:RenderTier;field?:SkateWorldField}={}):SkatePark{
  const tier=opts.tier??'full';
  const field=opts.field??createSkateField(groundHeightAt,{tier});
  const palette:SkatePalette=skatePalette(dressing.theme);
  const data=buildParkMeshData(field,palette,tier);
  rememberDressing(field,data.dressing);
  const group=new THREE.Group();group.name='Harbour skate spots';
  const owned:{dispose():void}[]=[];
  const own=<T extends {dispose():void}>(o:T):T=>{owned.push(o);return o;};
  const paper=paperTexture(),atlas=stencilAtlas();if(paper)own(paper);if(atlas)own(atlas);

  const std=(p:THREE.MeshStandardMaterialParameters)=>own(new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,...p}));
  const materials={
    pad:std({map:paper,roughness:.95,flatShading:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2}),
    card:std({map:paper,roughness:.88,flatShading:true}),
    // Painted rails and bright coping: a little metal, mostly paint, so their colour holds under the bright rig.
    steel:std({metalness:.25,roughness:.42,flatShading:true}),
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
  // Contact shade, polish and rail shadows: unlit, alpha per vertex, drawn over the pads.
  if(data.shade.positions.length){
    const geometry=own(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.shade.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.shade.colors,4));
    geometry.computeBoundingSphere();
    const shadeMesh=new THREE.Mesh(geometry,own(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-3})));
    shadeMesh.name='skate-shade';shadeMesh.renderOrder=1;group.add(shadeMesh);
  }
  // Ink, pencil and chalk: one LineSegments, a colour per vertex.
  if(data.ink.positions.length){
    const geometry=own(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.ink.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.ink.colors,3));geometry.computeBoundingSphere();
    const ink=new THREE.LineSegments(geometry,own(new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:tier==='full'?.78:.66})));ink.name='skate-ink';ink.renderOrder=2;group.add(ink);
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
  // Race gates: built once per course on first use, the next two standing and the rest hidden.
  const gateSets=new Map<string,THREE.Group[]>();
  const gateGroup=new THREE.Group();gateGroup.name='race-gates';group.add(gateGroup);
  const gateDecals=materials.decals;
  function gatesFor(id:string):THREE.Group[]{
    let set=gateSets.get(id);if(set)return set;
    const route=SKATE_ROUTES.find(r=>r.id===id),gates=route&&'gates' in route?route.gates as readonly RaceGate[]:null;
    set=(gates??[]).map((gate,i,all)=>{
      const g=gateMesh(gate,i,i===all.length-1,palette,materials.card);
      const d=g.userData.decals as THREE.BufferGeometry|undefined;
      if(d){own(d);const m=new THREE.Mesh(d,gateDecals);m.name='race-gate-stencil';g.add(m);}
      g.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)own(m.geometry);if((o as THREE.LineSegments).isLineSegments)own((o as THREE.LineSegments).material as THREE.Material);});
      g.visible=false;gateGroup.add(g);return g;
    });
    gateSets.set(id,set);return set;
  }
  return {group,field,checkpoint,dressing:data.dressing,
    update(s){
      const run=s?.run,route=run?SKATE_ROUTES.find(r=>r.id===run.id):null,at=run&&!run.finished?route?.points[run.checkpoint]:null;
      // A course with 3D gates shows them as standing gates (the next two); the flat routes keep the painted ring.
      const standing=run&&route&&'gates' in route?gatesFor(run.id):null;
      for(const [id,set] of gateSets)set.forEach((g,i)=>{g.visible=Boolean(standing&&id===run!.id&&!run!.finished&&i>=run!.checkpoint&&i<=run!.checkpoint+1);});
      if(standing){checkpoint.visible=false;beam.visible=Boolean(at);if(at){const gate=(route as {gates:readonly RaceGate[]}).gates[run!.checkpoint];if(gate)beam.position.set(gate.at[0],gate.at[1]+gate.halfHeight+2.1,gate.at[2]);}return;}
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
