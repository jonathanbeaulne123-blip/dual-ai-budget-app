/**
 * The road corridor's dressing at runtime (ROAD.md §4, §6, §8): markings, guard kits, lamps and scenic-stop furniture from
 * `world.corridors`, built per district with the road kit (`kit/road/**`) and shown only while that district is
 * resident. The baked corridor solids (deck, kerbs, sidewalks, retaining walls) are drawn by `runtime/cards.ts`; guard
 * COLLIDERS (`corridorGuard`) are never drawn — the visible rail is built here from the same `GuardRun.line`.
 *
 * - Per district: one CardBuilder (a single card cell) → a handful of merged draws (card, steel, markings, glow, shade,
 *   ink); lamps, rail posts and bollards are INSTANCED per kind (one opaque + one glass draw per kind), their ink and
 *   contact shadows merged into the district's batches.
 * - Materials are shared by every district (one card / steel / markings / glass / shade / ink set, the card kit's
 *   parameters and the shared paper grain), exposed as `materials` so the runtime's fog stage (`fogHook`) takes them.
 * - Detail with distance (STYLE §1.2 rule 7, §1.13): ink fades per pixel from 60 to 180 eu (no pop, no CPU work); the
 *   markings and contact shadows of a district hide beyond 320 eu of it and return inside 280 eu (hysteresis), so nothing
 *   within 280 eu of the camera ever changes — a rider at 16 m/s sees no piece vanish ahead. Lite subtracts (posts every
 *   5 eu, no wheel tracks, no slab or flag joints, no rail bands, no weep-hole ink) and never substitutes. Lamp bodies are
 *   NOT dropped by distance on lite (a per-instance cut would pop by day); at night the halo glow cards carry distant
 *   lamps on both tiers.
 * - Night: `setNight(k)` (0 day → 1 night) raises the lamp glass from day glass to lit `#ffd98e`, fades in the halo
 *   glow cards (the slot N drives), and gives the markings the night chalk (`NIGHT_LIGHT_CARDS.chalk`).
 */
import * as THREE from 'three';
import { packInstances, packedMatrixShader, type PackedInstances } from './packedInstances';
import {orderContactShade} from './orderedContactShade';
import {createBuildTask,finishBuild} from '../../../house/world/buildTask.ts';
import {CardBuilder,paperGrain,type CardBuild,type V3} from '../../art/cardScene.ts';
import type {Bucket} from '../../art/cardKit.ts';
import type {WorldDefinition,LightAnchor} from '../world/definition.ts';
import type {Corridor,GuardRun,LampKind,LampSpot} from '../land/corridor/types.ts';
import {districtAt} from '../world/districts.ts';
import {NIGHT_LIGHT_CARDS} from '../sky/night.ts';
import {roadKitPalette,type RoadKitPalette,type RoadTheme} from '../kit/road/palette.ts';
import {corridorSampler} from '../kit/road/frames.ts';
import {markingQuads} from '../kit/road/markings.ts';
import {buildGuardRun,buildRailPost,type GuardPost} from '../kit/road/guards.ts';
import {corridorLightAnchors,lampsForTier} from '../land/corridor/lights';
import {CORRIDOR} from '../land/corridor/types';
import {drawLamp,lampPlacement,LAMP_HEAD,type LampPlacement} from '../kit/road/lamps.ts';
import {buildScenicStop,stopLayout} from '../kit/road/stops.ts';

export type CorridorArtOptions={
  tier:'full'|'lite';theme:RoadTheme;
  /** District of a plan point (default: the runtime partition, `world/districts.ts districtAt`). */
  districtOf?:(x:number,z:number)=>string;
  /** Ground under a point (parapet outer faces, stop walls, benches). Default: each piece's own anchor height. */
  ground?:(x:number,z:number)=>number;
  /** Finished road surface at (x,z) (markings); default: the station line's height. */
  deck?:(x:number,z:number,fallback:number)=>number;
  /** Stops whose floor a baked solid already carries (their flags are not drawn again). */
  bakedStopFloors?:ReadonlySet<string>;
  /** The live road light system owns capped, clock-sequenced halos. Standalone kit previews retain their own. */
  externalLampHalos?:boolean;
};
export type CorridorArtStats={districts:Record<string,{drawCalls:number;triangles:number;instances:number}>;lamps:number};
export type CorridorArt={
  group:THREE.Group;
  /** Show resident districts' art (building one missing district per call), thin detail by distance. */
  update(camera:THREE.Camera,resident:ReadonlySet<string>):void;
  /** Every corridor lamp head as the kit draws it (world), for the night track's pools and point-light pool. */
  lampHeads():readonly {id:string;head:[number,number,number]}[];
  /** Every retained fixture, including a stop's fallback, at its actual themed head. */
  lampAnchors():readonly LightAnchor[];
  /** 0 day → 1 night: lamp glass, halo glow cards, markings' night chalk. */
  setNight(k:number):void;
  /** The shared materials (for the runtime's fog stage) and the night hooks N may drive directly. */
  materials:Record<string,THREE.Material>;
  night:{value:number};
  /** Build every listed district now (tests, kit sheets). */
  prebuild(ids:Iterable<string>):void;
  /** True while a resident district's art is still being built (the frame loop keeps painting until it is done). */
  building():boolean;
  stats():CorridorArtStats;
  dispose():void;
};

/** Distance hysteresis for a district's small detail (markings, contact shadows). */
export const CORRIDOR_DETAIL={hideBeyond:320,showWithin:280,inkFull:60,inkZero:180,haloSize:1.2,releaseMs:20_000};

type Proto={geometry:THREE.BufferGeometry|null;ink:{p:number[];c:number[]};shade:{p:number[];c:number[]}};
type Piece={kind:LampKind|'railPost';at:V3;yaw:number;sy:number};
type DistrictArt={id:string;build:CardBuild;instanced:THREE.InstancedMesh[];packed:PackedInstances|null;detail:THREE.Object3D[];box:THREE.Box3;detailOn:boolean;lastResident:number;triangles:number;drawCalls:number;instances:number};

function cardMaterials(tier:'full'|'lite',theme:RoadKitPalette){
  const paper=paperGrain(),night={value:0};
  const std=(p:THREE.MeshStandardMaterialParameters)=>new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,...p});
  const card=std({map:paper,roughness:.9,flatShading:true}),steel=std({metalness:.3,roughness:.45,flatShading:true});
  // Markings: a flat, polygon-offset decal material (never z-fights the deck); night chalk is an emissive lift.
  const markings=std({map:paper,roughness:.8,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
  // Lamps (instanced): one draw per kind for body AND glass. `aGlow` marks the glass; its vertex colour is the LIT colour
  // (#ffd98e); by day it reads as the dressing's glass, at night it lifts to lit and glows (emissive, no dynamic light).
  const lamp=std({map:paper,roughness:.62,metalness:.12,flatShading:true});
  const dayGlass=new THREE.Color().setRGB(...theme.glassDay);
  lamp.onBeforeCompile=shader=>{shader.uniforms.uNight=night;shader.uniforms.uDayGlass={value:dayGlass};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float aGlow;varying float vGlow;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGlow=aGlow;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uNight;uniform vec3 uDayGlass;varying float vGlow;')
      .replace('#include <color_fragment>','#include <color_fragment>\nvec3 roadLit=diffuseColor.rgb;diffuseColor.rgb=mix(diffuseColor.rgb,mix(uDayGlass,roadLit,uNight),vGlow);')
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=roadLit*vGlow*uNight*1.35;');};
  lamp.customProgramCacheKey=()=>'horizon-road-lamp-1';
  // Capture the kit stage before the runtime independently wraps both materials with fog.
  const lampCompile=lamp.onBeforeCompile;
  const packedLamp=lamp.clone();packedLamp.onBeforeCompile=(shader,renderer)=>{lampCompile(shader,renderer);packedMatrixShader(shader,false);};packedLamp.customProgramCacheKey=()=>'horizon-road-lamp-packed-1';
  const lampDepth=new THREE.MeshDepthMaterial();
  lampDepth.onBeforeCompile=shader=>packedMatrixShader(shader,false);lampDepth.customProgramCacheKey=()=>'horizon-road-lamp-packed-depth-1';
  const shade=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-3});
  // Explicit old back/front passes share source material state and get independent fog hooks.
  const shadeBack=shade.clone(),shadeFront=shade.clone();shadeBack.side=THREE.BackSide;shadeFront.side=THREE.FrontSide;
  // Ink: 1 px lines whose opacity fades with view depth (STYLE §1.2 rule 7: full to 60 eu, 0 at 180 eu).
  const ink=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:tier==='full'?.78:.62});
  ink.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vInkDepth;').replace('#include <project_vertex>','#include <project_vertex>\nvInkDepth=-mvPosition.z;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vInkDepth;')
      .replace('#include <color_fragment>',`#include <color_fragment>\ndiffuseColor.a*=1.0-smoothstep(${CORRIDOR_DETAIL.inkFull.toFixed(1)},${CORRIDOR_DETAIL.inkZero.toFixed(1)},vInkDepth);`);};
  ink.customProgramCacheKey=()=>'horizon-road-ink-1';
  const halo=haloMaterial(tier);
  return {materials:{card,steel,markings,lamp,packedLamp,lampDepth,shade,shadeBack,shadeFront,ink,halo} as Record<string,THREE.Material>,night,halo,markings,lamp,packedLamp,lampDepth};
}

/** The halo glow card (STYLE §1.11): a camera-facing soft disc, additive, fogged, instanced. Opacity is the night level. */
function haloMaterial(tier:'full'|'lite'){
  const uniforms=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{color:{value:new THREE.Color(NIGHT_LIGHT_CARDS.pool)},opacity:{value:0},uFar:{value:0}}]);void tier;
  return new THREE.ShaderMaterial({uniforms,fog:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`#include <common>
#include <fog_pars_vertex>
varying vec2 vUv;varying float vDepth;
void main(){vUv=uv;float s=length(instanceMatrix[0].xyz);vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);mvPosition.xy+=position.xy*s;vDepth=-mvPosition.z;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader:`uniform vec3 color;uniform float opacity;uniform float uFar;varying vec2 vUv;varying float vDepth;
#include <common>
#include <fog_pars_fragment>
void main(){float r=length(vUv*2.-1.);float a=pow(clamp(1.-r,0.,1.),1.7)*opacity;if(uFar>0.)a*=1.-smoothstep(uFar,uFar+10.,vDepth);
#ifdef USE_FOG
a*=1.-smoothstep(fogNear,fogFar,vFogDepth);
#endif
if(a<.003)discard;gl_FragColor=vec4(color*a,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
}

/** One kind's prototype: built at a far origin into one card cell, re-centred, opaque buckets merged, glass apart. */
function prototype(pal:RoadKitPalette,tier:'full'|'lite',kind:LampKind|'railPost'):Proto{
  const O=512,b=new CardBuilder(`horizon.road.proto.${kind}`,tier,{ink:pal.ink,cell:4096,shadows:tier==='full'});
  // Built with the origin offset so every piece lands in one cell (0:0), then re-centred.
  const o:V3=[O,0,O];
  if(kind==='railPost')buildPostAt(b,pal,tier,o);else drawLamp(b,pal,kind,o,tier);
  // A soft contact shadow under a standing lamp (STYLE §1.1); a tunnel lamp hangs on a wall.
  if(kind==='roadLantern'||kind==='bridgeLantern'||kind==='bollard')b.shadow(O,O,kind==='roadLantern'?.42:.3,kind==='roadLantern'?.42:.3,0,()=>0,.26);
  const d=b.at(O,O).data,pos:number[]=[],nor:number[]=[],col:number[]=[],uv:number[]=[],glow:number[]=[];
  for(const [k,g] of [[d.card,0],[d.steel,0],[d.flat,0],[d.glow,1]] as const){
    for(let i=0;i<k.positions.length;i+=3)pos.push(k.positions[i]!-O,k.positions[i+1]!,k.positions[i+2]!-O);
    const n=k.positions.length/3;nor.push(...(k.normals.length===n*3?k.normals:new Array(n*3).fill(0).map((_,j)=>j%3===1?1:0)));col.push(...k.colors);
    if(k.uvs.length===n*2)uv.push(...k.uvs);else for(let i=0;i<n;i++)uv.push(0,0);
    for(let i=0;i<n;i++)glow.push(g);
  }
  let geometry:THREE.BufferGeometry|null=null;
  if(pos.length){geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('aGlow',new THREE.Float32BufferAttribute(glow,1));geometry.computeBoundingSphere();}
  const shift=(src:{positions:number[];colors:number[]})=>{const p:number[]=[];for(let i=0;i<src.positions.length;i+=3)p.push(src.positions[i]!-O,src.positions[i+1]!,src.positions[i+2]!-O);return {p,c:[...src.colors]};};
  return {geometry,ink:shift(d.ink),shade:shift(d.shade)};
}
function buildPostAt(b:CardBuilder,pal:RoadKitPalette,tier:'full'|'lite',o:V3){
  // buildRailPost draws at (0,0); draw into a builder whose cell covers the origin by translating after the fact.
  const t=new CardBuilder('horizon.road.proto.post',tier,{ink:pal.ink,cell:1e6});buildRailPost(t,pal,tier);
  const src=t.at(0,0).data,dst=b.at(o[0],o[2]).data;
  const copy=(from:Bucket,to:Bucket)=>{for(let i=0;i<from.positions.length;i+=3)to.positions.push(from.positions[i]!+o[0],from.positions[i+1]!+o[1],from.positions[i+2]!+o[2]);to.normals.push(...from.normals);to.colors.push(...from.colors);to.uvs.push(...from.uvs);};
  copy(src.card,dst.card);copy(src.steel,dst.steel);
  for(let i=0;i<src.ink.positions.length;i+=3)dst.ink.positions.push(src.ink.positions[i]!+o[0],src.ink.positions[i+1]!+o[1],src.ink.positions[i+2]!+o[2]);dst.ink.colors.push(...src.ink.colors);
}

/** Split a guard run into per-district pieces (sub-runs continue across the seam: no pier or end there). */
function splitRun(run:GuardRun,districtOf:(x:number,z:number)=>string):{district:string;run:GuardRun}[]{
  const L=run.line;if(L.length<2)return [];
  const out:{district:string;run:GuardRun}[]=[];let cur:{district:string;pts:(typeof L)[number][]}|null=null;
  for(let i=1;i<L.length;i++){const a=L[i-1]!,c=L[i]!,d=districtOf((a[0]+c[0])/2,(a[2]+c[2])/2);
    if(!cur||cur.district!==d){if(cur)out.push({district:cur.district,run:{...run,line:cur.pts}});cur={district:d,pts:[a]};}cur.pts.push(c);}
  if(cur)out.push({district:cur.district,run:{...run,line:cur.pts}});
  return out.map((p,i)=>({district:p.district,run:{...p.run,id:out.length>1?`${run.id}#${i}`:run.id,ends:[i===0?run.ends[0]:'continues',i===out.length-1?run.ends[1]:'continues'] as const}}));
}

export function createCorridorArt(world:WorldDefinition,opts:CorridorArtOptions):CorridorArt{
  const tier=opts.tier,pal=roadKitPalette(opts.theme),corridors:readonly Corridor[]=world.corridors??[];
  const districtOf=opts.districtOf??((x:number,z:number)=>districtAt(x,z));
  const {materials,night,halo,markings,lamp,packedLamp,lampDepth}=cardMaterials(tier,pal);
  const group=new THREE.Group();group.name='horizon.corridorArt';
  // ---- Plan: every piece's district, computed once (pure data; geometry is built lazily per district). ----
  type Plan={markings:{q:[V3,V3,V3,V3][]};guards:GuardRun[];lamps:LampPlacement[];stops:{corridor:Corridor;stop:Corridor['stops'][number]}[]};
  const plans=new Map<string,Plan>(),plan=(id:string)=>{let p=plans.get(id);if(!p)plans.set(id,p={markings:{q:[]},guards:[],lamps:[],stops:[]});return p;};
  const heads:{id:string;head:[number,number,number]}[]=[];
  const anchors:LightAnchor[]=[],planned=new Map(corridorLightAnchors(corridors.map(c=>({...c,lamps:[...lampsForTier(c,tier)]}))).map(a=>[a.id,a]));
  for(const c of corridors){
    if(!c.stations.length)continue;
    const f=corridorSampler(c);
    for(const run of c.markings)for(const q of markingQuads(run,f,opts.deck)){const cx=(q[0][0]+q[2][0])/2,cz=(q[0][2]+q[2][2])/2;plan(districtOf(cx,cz)).markings.q.push(q);}
    for(const run of c.guards){if(run.owner==='region'||run.kind!=='stoneParapet'&&run.kind!=='postRail')continue;for(const p of splitRun(run,districtOf))plan(p.district).guards.push(p.run);}
    for(const spot of lampsForTier(c,tier)){const place=placeLamp(spot,opts.theme);plan(districtOf(place.base[0],place.base[2])).lamps.push(place);heads.push({id:place.id,head:[place.head[0],place.head[1],place.head[2]]});anchors.push({...planned.get(place.id)!,head:[...place.head]});}
    for(const stop of c.stops){plan(districtOf(stop.at[0],stop.at[2])).stops.push({corridor:c,stop});
      const lay=stopLayout(stop,opts.ground??(()=>stop.at[1]));
      if(lay.lamp&&!c.lamps.some(l=>Math.hypot(l.at[0]-lay.lamp!.at[0],l.at[2]-lay.lamp!.at[2])<6)){
        const place=placeLamp({id:`${stop.id}.lamp`,kind:'bridgeLantern',at:lay.lamp.at,head:lay.lamp.at,yaw:stop.facing},opts.theme);
        plan(districtOf(place.base[0],place.base[2])).lamps.push(place);heads.push({id:place.id,head:[place.head[0],place.head[1],place.head[2]]});
        anchors.push({id:place.id,kind:'bridgeLantern',at:[...place.base],head:[...place.head],pool:[...place.base],poolRadius:CORRIDOR.lampPoolRadius,corridorId:c.id,line:`${c.id}:stop:${stop.id}`,order:0});}}
  }
  // ---- Instanced prototypes (built on first use) ----
  const protos=new Map<LampKind|'railPost',Proto>();
  const protoOf=(k:LampKind|'railPost')=>{let p=protos.get(k);if(!p){p=prototype(pal,tier,k);protos.set(k,p);}return p;};
  const districts=new Map<string,DistrictArt>();
  const haloGeometry=new THREE.PlaneGeometry(2,2);let haloMesh:THREE.InstancedMesh|null=null,haloKey='';

  function* buildDistrictSteps(id:string):Generator<void,DistrictArt,void>{
    const p=plans.get(id)??{markings:{q:[]},guards:[],lamps:[],stops:[]};
    const b=new CardBuilder(`horizon.corridorArt.${id}`,tier,{ink:pal.ink,pencil:`#${new THREE.Color().setRGB(...pal.pencil).getHexString()}`,cell:8192,shadows:tier==='full'});
    for(const q of p.markings.q)b.quad(q[0],q[1],q[2],q[3],pal.marking,'flat');
    yield;
    const pieces:Piece[]=[];
    for(const run of p.guards){const out=buildGuardRun(b,pal,run,{tier,...(opts.ground?{ground:opts.ground}:{})});for(const post of out.posts)pieces.push(postPiece(post));yield;}
    for(const {stop} of p.stops){buildScenicStop(b,pal,stop,{tier,ground:opts.ground??(()=>stop.at[1]),flags:!stop.existingFloor&&!opts.bakedStopFloors?.has(stop.id)});yield;}
    for(const l of p.lamps)pieces.push({kind:l.kind,at:l.base,yaw:l.yaw,sy:1});
    // Instanced pieces: their ink and contact shadows join the district's merged batches.
    const byKind=new Map<LampKind|'railPost',Piece[]>();for(const q of pieces){let l=byKind.get(q.kind);if(!l)byKind.set(q.kind,l=[]);l.push(q);}
    const m=new THREE.Matrix4(),v=new THREE.Vector3(),cell=b.at(0,0).data,UPV=new THREE.Vector3(0,1,0),matrix=(q:Piece)=>m.compose(new THREE.Vector3(...q.at),new THREE.Quaternion().setFromAxisAngle(UPV,q.yaw),new THREE.Vector3(1,q.sy,1));
    for(const [kind,list] of byKind){const pr=protoOf(kind);
      for(const q of list){matrix(q);
        for(let i=0;i<pr.ink.p.length;i+=3){v.set(pr.ink.p[i]!,pr.ink.p[i+1]!,pr.ink.p[i+2]!).applyMatrix4(m);cell.ink.positions.push(v.x,v.y,v.z);}cell.ink.colors.push(...pr.ink.c);
        for(let i=0;i<pr.shade.p.length;i+=3){v.set(pr.shade.p[i]!,pr.shade.p[i+1]!,pr.shade.p[i+2]!).applyMatrix4(m);cell.shade.positions.push(v.x,v.y,v.z);}cell.shade.colors.push(...pr.shade.c);}
      yield;}
    const build=yield* b.finishSteps();
    // Share materials: every district's meshes draw with the one corridor set (the builder's own set is released).
    const detail:THREE.Object3D[]=[],replaced=new Set<THREE.Material>();
    for(const obj of [...build.group.children]){const mesh=obj as THREE.Mesh,key=Object.entries(build.materials).find(([,mat])=>mat===mesh.material)?.[0];
      const to=key==='flat'?markings:key==='glow'?lamp:key&&materials[key]?materials[key]:null;if(to){replaced.add(mesh.material as THREE.Material);mesh.material=to;}
      if(key==='shade')orderContactShade(mesh,{back:materials.shadeBack as THREE.MeshBasicMaterial,front:materials.shadeFront as THREE.MeshBasicMaterial});
      if(key==='flat'||key==='shade')detail.push(mesh);}
    // The builder's own copies of the replaced materials are released now (any it keeps, e.g. decals, stay with the build).
    for(const mat of replaced)mat.dispose();
    const instanced:THREE.InstancedMesh[]=[];let instances=0;
    for(const [kind,list] of byKind){const pr=protoOf(kind);instances+=list.length;if(!pr.geometry)continue;
      const im=new THREE.InstancedMesh(pr.geometry,lamp,list.length);im.name=`horizon.corridorArt.${id}.${kind}`;
      list.forEach((q,i)=>im.setMatrixAt(i,matrix(q)));
      im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.castShadow=tier==='full';im.receiveShadow=true;instanced.push(im);}
    const packed=instanced.length?packInstances(instanced.map(mesh=>({key:mesh.name,mesh})),packedLamp,{name:`horizon.corridorArt.${id}.fixtures`,depth:lampDepth}):null;
    if(packed)build.group.add(packed.mesh);
    const box=new THREE.Box3().setFromObject(build.group);
    // Packed positions remain local; use the source instance bounds for detail residency.
    for(const im of instanced){im.computeBoundingBox();if(im.boundingBox)box.union(im.boundingBox);}
    let triangles=0,drawCalls=0;build.group.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.geometry)return;const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];drawCalls+=mats.reduce((n,m)=>n+(m.transparent&&m.side===THREE.DoubleSide&&!m.forceSinglePass?2:1),0);if(o instanceof THREE.LineSegments)return;const g=mesh.geometry,total=g.index?g.index.count:g.getAttribute('position').count,n=Math.min(total-g.drawRange.start,g.drawRange.count);
      triangles+=n/3*((o as THREE.InstancedMesh).isInstancedMesh?(o as THREE.InstancedMesh).count:1);});
    build.group.name=`horizon.corridorArt.${id}`;build.group.visible=false;group.add(build.group);
    return {id,build,instanced,packed,detail,box,detailOn:true,lastResident:performance.now(),triangles,drawCalls,instances};
  }
  function postPiece(post:GuardPost):Piece{return {kind:'railPost',at:post.at,yaw:post.yaw,sy:post.height};}
  const haloIds=new Set<string>();
  function refreshHalos(resident:ReadonlySet<string>){
    if(opts.externalLampHalos)return;
    // Every frame: an allocation-free membership check; the halo set is rebuilt only when the built resident districts change
    // (haloKey '' forces it, as a district build or release does).
    let same=haloKey!=='',n=0;if(same)for(const id of resident){if(!districts.has(id))continue;n++;if(!haloIds.has(id)){same=false;break;}}
    if(same&&n===haloIds.size)return;haloIds.clear();for(const id of resident)if(districts.has(id))haloIds.add(id);haloKey='built';
    const list:V3[]=[];for(const id of resident){if(!districts.has(id))continue;for(const l of plans.get(id)?.lamps??[])list.push(l.head);}
    if(haloMesh){group.remove(haloMesh);haloMesh.dispose();haloMesh=null;}
    if(!list.length)return;
    haloMesh=new THREE.InstancedMesh(haloGeometry,halo,list.length);haloMesh.name='horizon.corridorArt.halos';haloMesh.renderOrder=5;haloMesh.frustumCulled=false;
    const m=new THREE.Matrix4();list.forEach((h,i)=>{m.makeScale(CORRIDOR_DETAIL.haloSize,CORRIDOR_DETAIL.haloSize,CORRIDOR_DETAIL.haloSize).setPosition(h[0],h[1],h[2]);haloMesh!.setMatrixAt(i,m);});
    haloMesh.instanceMatrix.needsUpdate=true;haloMesh.visible=night.value>0;group.add(haloMesh);
  }
  const eye=new THREE.Vector3();
  let pending=false;
  let task:{id:string;run:ReturnType<typeof createBuildTask<DistrictArt>>}|null=null;
  function update(camera:THREE.Camera,resident:ReadonlySet<string>){
    const now=performance.now();
    // One district builds at a time, a few ms per frame (house/world/buildTask.ts), like the district cards.
    if(task&&!resident.has(task.id)){task.run.cancel();task=null;}
    if(!task)for(const id of resident)if(!districts.has(id)&&plans.has(id)){task={id,run:createBuildTask(buildDistrictSteps(id))};break;}
    if(task){const done=task.run.advance();if(done){districts.set(task.id,done);task=null;haloKey='';}}
    pending=task!==null;if(!pending)for(const id of resident)if(!districts.has(id)&&plans.has(id)){pending=true;break;}
    camera.getWorldPosition(eye);
    for(const [id,d] of districts){
      const on=resident.has(id);d.build.group.visible=on;if(on)d.lastResident=now;
      else if(now-d.lastResident>CORRIDOR_DETAIL.releaseMs){group.remove(d.build.group);d.build.dispose();d.packed?.dispose();for(const im of d.instanced)im.dispose();districts.delete(id);haloKey='';continue;}
      const dist=d.box.distanceToPoint(eye);
      if(d.detailOn&&dist>CORRIDOR_DETAIL.hideBeyond)d.detailOn=false;else if(!d.detailOn&&dist<CORRIDOR_DETAIL.showWithin)d.detailOn=true;
      for(const o of d.detail)o.visible=d.detailOn;
    }
    refreshHalos(resident);
  }
  function setNight(kIn:number){
    const k=Math.max(0,Math.min(1,kIn));night.value=k;(halo.uniforms.opacity as {value:number}).value=k*.85;if(haloMesh)haloMesh.visible=k>0;
    const chalk=new THREE.Color(NIGHT_LIGHT_CARDS.chalk);markings.emissive.copy(chalk).multiplyScalar(.34*k);
  }
  return {group,update,setNight,materials,night,building:()=>pending,
    lampHeads:()=>heads,lampAnchors:()=>anchors,
    prebuild(ids){for(const id of ids)if(!districts.has(id)&&plans.has(id))districts.set(id,finishBuild(buildDistrictSteps(id)));const all=new Set(districts.keys());for(const d of districts.values())d.build.group.visible=true;refreshHalos(all);},
    stats(){const out:CorridorArtStats={districts:{},lamps:heads.length};for(const [id,d] of districts)out.districts[id]={drawCalls:d.drawCalls,triangles:d.triangles,instances:d.instances};return out;},
    dispose(){for(const d of districts.values()){d.build.dispose();d.packed?.dispose();for(const im of d.instanced)im.dispose();}districts.clear();
      if(haloMesh){haloMesh.dispose();}haloGeometry.dispose();task?.run.cancel();task=null;for(const p of protos.values())p.geometry?.dispose();protos.clear();
      for(const mat of Object.values(materials))mat.dispose();group.removeFromParent();group.clear();},
  };
}

/** A lamp's instance placement; a tunnel lamp hangs from the wall at its head (its `at` may be on the floor). */
function placeLamp(spot:Pick<LampSpot,'id'|'kind'|'at'|'head'|'yaw'>,theme:RoadTheme):LampPlacement{
  if(spot.kind!=='tunnelLamp')return lampPlacement(spot,theme);
  const p=lampPlacement(spot,theme),local=LAMP_HEAD.tunnelLamp[theme];
  // Put the kit's head on the spot's head: the bracket's origin sits `local` back from it.
  const base:V3=[spot.head[0]-(p.dir[0]*local[0]-p.dir[1]*local[2]),spot.head[1]-local[1],spot.head[2]-(p.dir[1]*local[0]+p.dir[0]*local[2])];
  return {...p,base,head:[spot.head[0],spot.head[1],spot.head[2]]};
}
