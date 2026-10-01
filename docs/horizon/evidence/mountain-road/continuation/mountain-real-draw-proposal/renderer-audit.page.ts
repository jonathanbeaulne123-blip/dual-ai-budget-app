/** Temporary diagnostic only. Uses shipped builders; never imports the source world/terrain solver. */
import * as THREE from 'three';
import {createCorridorArt} from '@repo/src/harbour/horizon/runtime/corridorArt.ts';
import {createCorridorPlanting} from '@repo/src/harbour/horizon/runtime/corridorPlanting.ts';
import {createRoadLights} from '@repo/src/harbour/horizon/runtime/roadLights.ts';
import {ROAD_LIGHTS} from '@repo/src/harbour/horizon/sky/night.ts';
import {useDefinitionDistricts,districtAt} from '@repo/src/harbour/horizon/world/districts.ts';
import {decodeTerrainAsset} from '@repo/src/harbour/horizon/land/terrain/asset.ts';
import {sampleTerrain} from '@repo/src/harbour/horizon/land/terrain/index.ts';
import {CARD_CLOCK} from '@repo/src/harbour/art/cardScene.ts';

type Pose={id:string;kind:string;eye:number[];target:number[];fov:number;district:string;source?:string};
const api:any={ready:false};(window as any).__mountainDrawAudit=api;
const [world,terrainBytes,config]=await Promise.all([
 fetch('/world.json').then(r=>r.json()),fetch('/terrain.bin').then(r=>r.arrayBuffer()),fetch('/config.json').then(r=>r.json()),
]);
useDefinitionDistricts(world.districts);
const field=decodeTerrainAsset(terrainBytes,'full'),ground=(x:number,z:number)=>sampleTerrain(field,x,z);
const byDistrict=(p:readonly number[])=>districtAt(p[0]!,p[2]!,1);
const wanted=config.corridorIds==='all'?world.corridors.map((c:any)=>c.id):config.corridorIds;
const selected=world.corridors.filter((c:any)=>wanted.includes(c.id));
for(const id of wanted)if(!selected.some((c:any)=>c.id===id))throw Error(`Missing corridor ${id}`);
const localWorld={...world,corridors:selected};
const renderer=new THREE.WebGLRenderer({antialias:config.tier==='full',alpha:false,preserveDrawingBuffer:false});
renderer.setSize(config.width,config.height);renderer.setPixelRatio(1);
// Compare the existing ROAD base-pass budget. Shadow/extra passes are explicitly not measured.
renderer.shadowMap.enabled=false;renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
renderer.info.autoReset=false;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(58,config.width/config.height,.08,4500);
scene.background=new THREE.Color('#b8c5ca');
const hemi=new THREE.HemisphereLight('#d9e7e8','#786b57',1.2),sun=new THREE.DirectionalLight('#fff0d5',2.2);
sun.position.set(200,500,100);scene.add(hemi,sun);
const art=createCorridorArt(localWorld,{tier:config.tier,theme:config.theme,ground,externalLampHalos:true});
art.prebuild(config.districts);scene.add(art.group);
// Whole-world light competition stays intact even when furniture/plants are isolated to one district.
const lightPlan=createCorridorArt(world,{tier:config.tier,theme:config.theme,ground,externalLampHalos:true});
const anchors=lightPlan.lampAnchors(),lights=createRoadLights(scene,world,{tier:config.tier,corridorAnchors:anchors,ground:(x,z)=>ground(x,z)});
const glows=scene.getObjectByName('lightCards.roadGlows') as THREE.InstancedMesh;
const pools=scene.getObjectByName('lightCards.roadPools') as THREE.Mesh;
if(!glows||!pools)throw Error('Road-light mesh identity changed');
// Door/threshold cards still compete for the shared cap; their two independent meshes are outside ROAD corridor attribution.
for(const name of ['lightCards.anchorPools','lightCards.beads']){const mesh=scene.getObjectByName(name);if(!mesh)throw Error(`Missing ${name}`);mesh.layers.set(1);}
if(lights.lights.length!==(lights.stats().roadLamps?ROAD_LIGHTS.pointLights[config.tier]:0))throw Error('Shared road point-light pool changed');
const debug=renderer.getContext().getExtension('WEBGL_debug_renderer_info');
const gl=renderer.getContext();
api.renderer={version:gl.getParameter(gl.VERSION),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),webglMultiDraw:renderer.extensions.has('WEBGL_multi_draw'),threeRevision:THREE.REVISION,shadowMapEnabled:renderer.shadowMap.enabled,viewport:[config.width,config.height],pixelRatio:renderer.getPixelRatio(),near:camera.near,far:camera.far};

const poses:Pose[]=[],seen=new Set<string>();
function add(p:Pose){
 if(p.eye.length!==3||p.target.length!==3||![...p.eye,...p.target,p.fov].every(Number.isFinite)||Math.hypot(...p.eye.map((v,k)=>v-p.target[k]!))<1e-6)throw Error(`Invalid pose ${p.id}`);
 const key=[...p.eye,...p.target,p.fov,p.kind].join(',');if(seen.has(key))return;seen.add(key);poses.push(p);
}
function nominal(at:number[],dx:number,dz:number,id:string,kind:string){const eye=[at[0]!,at[1]!+1.65,at[2]!];add({id,kind,eye,target:[eye[0]!+dx,eye[1]!,eye[2]!+dz],fov:58,district:byDistrict(at),source:'Baked anchor +1.65m; no composed surface seating claim'});}
for(const c of selected){
 for(let i=0;i<c.stations.length;i++)if(i%12===0||i===c.stations.length-1){
  const a=c.stations[Math.max(0,i-1)].at,b=c.stations[Math.min(c.stations.length-1,i+1)].at;let dx=b[0]-a[0],dz=b[2]-a[2];const len=Math.hypot(dx,dz);if(len<1e-9){dx=1;dz=0;}else{dx/=len;dz/=len;}
  for(const sign of [-1,1])nominal(c.stations[i].at,dx*sign,dz*sign,`${c.id}:station:${i}:${sign}`,'budget-route');
 }
 for(const group of c.planting)for(let i=0;i<group.items.length;i++){
  // The old budget inventory sampled every plant root without camera headings.
  // Four explicit headings make these GPU diagnostic views reproducible.
  for(const [h,[dx,dz]] of [[1,0],[0,1],[-1,0],[0,-1]].entries())nominal(group.items[i].at,dx!,dz!,`${group.id}:root:${i}:heading:${h}`,'plant-root');
 }
}
const selectedLampIds=new Set(art.lampAnchors().map(a=>a.id));
for(const a of anchors)if(selectedLampIds.has(a.id))for(const sign of [-1,1])nominal([...(a.pool??a.at)],sign,0,`${a.id}:pool:${sign}`,'budget-lamp-pool');
add({id:'review:mountain-air',kind:'review-air',eye:[1480,290,890],target:[1260,95,625],fov:58,district:byDistrict([1480,290,890]),source:'capture-mountain-finish.mjs authored aerial'});
for(const view of config.reviewViews??[])add({...view,district:byDistrict(view.eye)});
api.inventory=poses;

let current:any=null,planting:ReturnType<typeof createCorridorPlanting>|null=null,index=0,frame=0,now=0,active:Pose[]=[];
let frameDraws:any[]=[];
const instrumented=new WeakSet<THREE.Object3D>();
function instrument(group:THREE.Object3D,category:string){group.traverse((o:any)=>{
 if(!(o.isMesh||o.isLine||o.isPoints)||instrumented.has(o))return;instrumented.add(o);
 const before=o.onBeforeRender,after=o.onAfterRender;let startCalls=0,startTriangles=0,startLines=0;
 o.onBeforeRender=function(...args:any[]){before.apply(this,args);startCalls=renderer.info.render.calls;startTriangles=renderer.info.render.triangles;startLines=renderer.info.render.lines;};
 o.onAfterRender=function(...args:any[]){after.apply(this,args);const calls=renderer.info.render.calls-startCalls;if(calls)frameDraws.push({category,name:o.name,uuid:o.uuid,calls,triangles:renderer.info.render.triangles-startTriangles,lines:renderer.info.render.lines-startLines,instances:o.isInstancedMesh?o.count:null});};
});}
instrument(art.group,'furniture');instrument(glows,'shared-road-night');instrument(pools,'shared-road-night');
function unculledCalls(group:THREE.Object3D,activeOnly=false){
 const objects:any[]=[];
 group.traverse((o:any)=>{
  if(!(o.isMesh||o.isLine||o.isPoints)||!o.geometry||activeOnly&&!o.visible||o.isInstancedMesh&&o.count===0)return;
  const geometry=o.geometry,total=geometry.index?.count??geometry.getAttribute('position')?.count??0;
  if(!total||geometry.drawRange.count===0)return;
  const materials=Array.isArray(o.material)?geometry.groups.filter((g:any)=>g.count>0).map((g:any)=>o.material[g.materialIndex]):[o.material];
  const calls=materials.filter((m:any)=>m&&m.visible).reduce((n:number,m:any)=>n+(m.transparent&&m.side===THREE.DoubleSide&&!m.forceSinglePass?2:1),0);
  if(calls)objects.push({name:o.name,calls,instances:o.isInstancedMesh?o.count:null});
 });
 return{calls:objects.reduce((n,o)=>n+o.calls,0),objects};
}
api.begin=({district,season,time}:any)=>{
 if(!config.districts.includes(district))throw Error(`Unrequested district ${district}`);
 // A prior district can expire after20s; rebuild before measuring, never record a partial art build.
 art.prebuild([district]);instrument(art.group,'furniture');
 planting?.dispose();planting=createCorridorPlanting(localWorld,{tier:config.tier,theme:config.theme,season});scene.add(planting.group);instrument(planting.group,'plants');
 current={district,season,time};index=0;
 active=poses.filter(p=>p.district===district||p.kind.startsWith('review-'));
 if(!active.length)throw Error(`No diagnostic poses for ${district}`);
 art.setNight(time==='night'?1:0);lights.refresh();
 const districtArt=art.group.getObjectByName(`horizon.corridorArt.${district}`);
 return {count:active.length,furnitureCapacity:art.stats().districts[district]??null,furnitureWebglCallUpperBoundIgnoringFrustumAndDetail:districtArt?unculledCalls(districtArt):{calls:0,objects:[]},poseKinds:Object.fromEntries([...new Set(active.map(p=>p.kind))].map(kind=>[kind,active.filter(p=>p.kind===kind).length]))};
};
api.next=async(limit=8)=>{
 if(!current||!planting)throw Error('Begin a case first');const records=[];
 for(let n=0;n<limit&&index<active.length;n++,index++){
  const p=active[index]!;camera.position.set(p.eye[0]!,p.eye[1]!,p.eye[2]!);camera.fov=p.fov;camera.lookAt(p.target[0]!,p.target[1]!,p.target[2]!);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const resident=new Set<string>([current.district]);art.update(camera,resident);if(art.building())throw Error(`Incomplete district art at ${p.id}`);planting.update(camera,resident);
  lights.refresh();let settled=false;
  for(let k=0;k<80;k++){lights.update(camera,current.time==='night'?-12:30,now+=100,{at:p.eye as [number,number,number]});if(!lights.busy(now)){settled=true;break;}}
  if(!settled)throw Error(`Road lights did not settle at ${p.id}`);
  const ls=lights.stats();if(ls.cards>ls.cap||ls.pointLightsLit>ROAD_LIGHTS.pointLights[config.tier])throw Error('Shared light cap violated');
  CARD_CLOCK.value=now/1000;
  // No zero-alpha or zero-shader-scale exemptions: if WebGL submits it, it counts.
  frameDraws=[];renderer.info.reset();const started=performance.now();renderer.render(scene,camera);const renderSubmitMs=performance.now()-started;
  const info={...renderer.info.render},sum=frameDraws.reduce((a,r)=>a+r.calls,0);
  if(sum!==info.calls)throw Error(`Unattributed draw calls: hooks=${sum}, renderer=${info.calls}`);
  const glError=gl.getError();if(glError!==gl.NO_ERROR)throw Error(`WebGL error ${glError} at ${p.id}`);
  const totals=Object.fromEntries(['furniture','plants','shared-road-night'].map(category=>[category,frameDraws.filter(r=>r.category===category).reduce((a,r)=>a+r.calls,0)]));
  records.push({...current,frame:frame++,pose:p,renderer:info,draws:frameDraws,byCategory:totals,activePlantLayers:planting.stats(),unculledActivePlantCalls:unculledCalls(planting.group,true),lightStats:ls,renderSubmitMs});
 }
 await new Promise<void>(r=>requestAnimationFrame(()=>r()));
 return {records,done:index===active.length,next:index,total:active.length};
};
api.dispose=()=>{planting?.dispose();art.dispose();lightPlan.dispose();lights.dispose();renderer.dispose();renderer.forceContextLoss();};
api.ready=true;
