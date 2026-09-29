/**
 * The road kit's render sheet (dev only; `scripts/horizon/kit-sheet-road.mjs` drives it through `sheet.html`). The
 * synthetic fixture (`fixture.ts`) is drawn with the real pieces: its baked corridor solids through `runtime/cards.ts`
 * (`addCorridorOrSolidSteps` into a CardBuilder, the district path), the corridor art through `createCorridorArt`, a
 * terrain mesh from the fixture's ground with the Horizon's `terrainMaterial`, the sky dome, fog, sun, moon and hemisphere
 * from the same sky modules the runtime uses (`sky/gradient`, `sky/night`, `sky/fog`, `sun/solar`), ACES tone mapping at
 * the runtime's exposure. `window.__roadSheet.pose(name)` / `.time(hhmm)` / `.theme(t)` set the frame; `.ready` resolves.
 */
import * as THREE from 'three';
import {CardBuilder,paperGrain,rgb,mix,type RGB} from '../../../art/cardScene.ts';
import {finishBuild} from '../../../../house/world/buildTask.ts';
import {addCorridorOrSolidSteps,terrainMaterial} from '../../runtime/cards.ts';
import {createCorridorArt,type CorridorArt} from '../../runtime/corridorArt.ts';
import {skyGradient} from '../../sky/gradient.ts';
import {nightLight,nightDome,NIGHT_FLOOR} from '../../sky/night.ts';
import {horizonFog} from '../../sky/fog.ts';
import {createSkyDome} from '../../sky/dome.ts';
import {solarPosition} from '../../sun/solar.ts';
import {roadFixture,FIXTURE} from './fixture.ts';
import type {RoadTheme} from './palette.ts';

type Pose={eye:[number,number,number];target:[number,number,number];fov:number};
const fx=roadFixture(),P=fx.point;
/** Driver height: the eye 1.9 over the right lane (the capture-road convention), looking 40 ahead. */
const driver=(s:number,dir=1,lane=2,ahead=40):Pose=>{const e=P(s,lane*dir),t=P(s+ahead*dir,lane*dir*.5);return {eye:[e[0],e[1]+1.9,e[2]],target:[t[0],t[1]+1.1,t[2]],fov:58};};
export const SHEET_POSES:Record<string,Pose>={
  'driver-developed':driver(1.5),
  'driver-coastal':driver(40),
  'driver-mountain':driver(84),
  'driver-mountain-back':driver(131,-1),
  'kerbside':(()=>{const e=P(9,7.1),t=P(22,3);return {eye:[e[0],e[1]+1.75,e[2]],target:[t[0],t[1]+1.2,t[2]],fov:52};})(),
  'parapet-close':(()=>{const e=P(106,2.8),t=P(114,5.4);return {eye:[e[0],e[1]+1.6,e[2]],target:[t[0],t[1]+.4,t[2]],fov:50};})(),
  'stop':(()=>{const e=P(58.5,4),t=P(70,14);return {eye:[e[0],e[1]+1.8,e[2]],target:[t[0],t[1]-.5,t[2]],fov:55};})(),
  'aerial':(()=>{const c=P(66,-6),e=P(20,-70);return {eye:[e[0],c[1]+64,e[2]],target:[c[0],c[1],c[2]],fov:50};})(),
  'aerial-sea':(()=>{const c=P(80,2),e=P(116,58);return {eye:[e[0],c[1]+40,e[2]],target:[c[0],c[1]-2,c[2]],fov:50};})(),
};

/** The Horizon's ground colours by place (the sheet's terrain paint). */
const turf=rgb('#7d9a58'),long=rgb('#a9a86c'),verge=rgb('#9c8663'),sand=rgb('#e0cfa5'),rock=rgb('#9a9489'),ledge=rgb('#c4bba9');
function groundColour(x:number,z:number,y:number,o:number,s:number):RGB{
  let k:RGB=mix(turf,long,Math.max(0,Math.min(1,.3+.35*Math.sin(x*.05+z*.031)*Math.sin(z*.043-x*.02))));
  const a=Math.abs(o);if(s>-2&&s<FIXTURE.length+2&&a<FIXTURE.paved+3)k=mix(k,verge,Math.max(0,Math.min(1,1-(a-FIXTURE.paved-.4)/2.6))*.5);
  if(y<FIXTURE.sea+2.2)k=mix(k,sand,Math.max(0,Math.min(1,(FIXTURE.sea+2.2-y)/1.6)));
  return k;
}
/**
 * The sheet's terrain: a lattice in the corridor frame (rows every 1 eu along s, columns at the section's break offsets)
 * for |o| ≤ 30 — so no triangle straddles a kerb, a wall foot or a cutting edge, as the bake's terrain does against a bed —
 * and a 2 eu world grid beyond it (overlapping by 1.5 eu on the same height function). The Horizon terrain material draws
 * strata on faces steeper than 35°.
 */
function terrain(paper:THREE.Texture|null){
  const pos:number[]=[],nor:number[]=[],col:number[]=[],uv:number[]=[],rb:number[]=[],rl:number[]=[],ri:number[]=[];
  const put=(A:[number,number,number],B:[number,number,number],D:[number,number,number],ka:RGB,kb:RGB,kd:RGB)=>{
    let ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2],vx=D[0]-A[0],vy=D[1]-A[1],vz=D[2]-A[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;
    // Wind every ground triangle counter-clockwise from above (its lit front face up), like the Horizon terrain.
    if(ny<0){[B,D]=[D,B];[kb,kd]=[kd,kb];nx=-nx;ny=-ny;nz=-nz;ux=0;uy=0;uz=0;vx=0;vy=0;vz=0;}const deg=Math.acos(Math.min(1,ny/l))*180/Math.PI,w=Math.max(0,Math.min(1,(deg-35)/10));
    for(const [p,k] of [[A,ka],[B,kb],[D,kd]] as const){pos.push(...p);nor.push(nx/l,ny/l,nz/l);col.push(...k);uv.push(p[0]*.03,p[2]*.03);rb.push(...rock);rl.push(...ledge);ri.push(w,2.4);}};
  // Lattice in (s, o). Beyond the fixture's ends it carries on along the end tangent.
  const E=FIXTURE.paved,cols=[0,E-.02,E+.1,E+.16,E+.4,E+.6,E+.9,E+1.25,E+1.6,E+2.2,E+3,E+4,E+5.5,E+7,9,10,11.5,13,15,17.5,20,23,26.5,30].filter((v,i,a)=>a.indexOf(v)===i).sort((p,q)=>p-q);
  const O=[...cols.slice(1).reverse().map(v=>-v),...cols],S0=-50,S1=FIXTURE.length+50;
  const at=(s:number,o:number):[number,number,number]=>{const sc=Math.max(0,Math.min(FIXTURE.length,s)),ex=s-sc,q=P(sc,o),q2=P(sc+(ex>0?-.5:.5),o),k=ex>0?-2:2,x=q[0]+(q2[0]-q[0])*k*ex,z=q[2]+(q2[2]-q[2])*k*ex;return [x,fx.ground(x,z)-.03,z];};
  const rows:number[]=[];for(let s=S0;s<=S1;s+=1)rows.push(s);
  const L:[number,number,number][][]=rows.map(s=>O.map(o=>at(s,o)));
  const K:RGB[][]=rows.map((s,r)=>O.map((o,c)=>{const p=L[r]![c]!;return groundColour(p[0],p[2],p[1],o,s);}));
  for(let r=0;r<rows.length-1;r++)for(let c=0;c<O.length-1;c++){const a=L[r]![c]!,b=L[r+1]![c]!,d=L[r]![c+1]!,e=L[r+1]![c+1]!;
    put(a,b,d,K[r]![c]!,K[r+1]![c]!,K[r]![c+1]!);put(d,b,e,K[r]![c+1]!,K[r+1]![c]!,K[r+1]![c+1]!);}
  // World grid beyond.
  const x0=-200,x1=340,z0=-240,z1=280,st=2,nx=(x1-x0)/st,nz=(z1-z0)/st;
  for(let r=0;r<nz;r++)for(let c=0;c<nx;c++){const x=x0+c*st,z=z0+r*st,{s,o}=fx.locate(x+st/2,z+st/2);if(Math.abs(o)<28.5&&s>S0+1&&s<S1-1)continue;
    const V=[[x,z],[x+st,z],[x,z+st],[x+st,z+st]].map(([px,pz])=>{const y=fx.ground(px!,pz!)-.03,loc=fx.locate(px!,pz!);return {p:[px!,y,pz!] as [number,number,number],k:groundColour(px!,pz!,y,loc.o,loc.s)};});
    put(V[0]!.p,V[2]!.p,V[1]!.p,V[0]!.k,V[2]!.k,V[1]!.k);put(V[1]!.p,V[2]!.p,V[3]!.p,V[1]!.k,V[2]!.k,V[3]!.k);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setAttribute('rockBase',new THREE.Float32BufferAttribute(rb,3));geo.setAttribute('rockLedge',new THREE.Float32BufferAttribute(rl,3));geo.setAttribute('rockInfo',new THREE.Float32BufferAttribute(ri,2));
  const m=new THREE.Mesh(geo,terrainMaterial(paper));m.receiveShadow=true;m.castShadow=true;m.name='sheet.terrain';return m;
}
function sea(){
  const g=new THREE.PlaneGeometry(4000,4000).rotateX(-Math.PI/2),m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#6f9ea3',roughness:.35,metalness:.05}));
  const c=P(66,0);m.position.set(c[0],FIXTURE.sea,c[2]);m.receiveShadow=true;m.name='sheet.sea';return m;
}

export function mountSheet(host:HTMLElement,tier:'full'|'lite'){
  const renderer=new THREE.WebGLRenderer({antialias:tier==='full',preserveDrawingBuffer:true});
  renderer.setSize(host.clientWidth,host.clientHeight);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(58,host.clientWidth/host.clientHeight,.08,4500),paper=paperGrain();
  const ambient=new THREE.HemisphereLight('#d9e7e8','#786b57',1.2),sun=new THREE.DirectionalLight('#fff0d5',2.2),moon=new THREE.DirectionalLight('#9badcd',.26);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const sc=sun.shadow.camera;sc.left=sc.bottom=-110;sc.right=sc.top=110;sc.near=1;sc.far=600;sun.shadow.normalBias=.08;sun.shadow.bias=-.0001;
  scene.add(ambient,sun,sun.target,moon);
  const dome=createSkyDome();scene.add(dome.mesh);
  scene.add(terrain(paper),sea());
  // The baked corridor solids through the district-card path (runtime/cards.ts).
  const b=new CardBuilder('horizon.district.fixture',tier,{ink:'#5b5447',cell:256});
  for(const solid of fx.solids)finishBuild(addCorridorOrSolidSteps(b,solid,tier,fx.world.corridors));
  const cards=b.finish();scene.add(cards.group);
  let theme:RoadTheme='classic',art:CorridorArt|null=null,night=0;
  const build=()=>{art?.dispose();art=createCorridorArt(fx.world,{tier,theme,districtOf:()=>FIXTURE.district,ground:fx.ground});art.prebuild([FIXTURE.district]);scene.add(art.group);art.setNight(night);};
  build();
  // Night stand-in for N's light pools (so the sheet shows what the lamps are for): a warm additive disc under each head.
  const pools=new THREE.Group();pools.name='sheet.pools';scene.add(pools);
  const poolGeo=new THREE.CircleGeometry(1,40).rotateX(-Math.PI/2),poolMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{k:{value:0},c:{value:new THREE.Color('#e7c48c')}},
    vertexShader:'varying vec2 vP;void main(){vP=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float k;uniform vec3 c;varying vec2 vP;void main(){float r=length(vP);float a=pow(max(0.,1.-r),1.6)*k*.55;gl_FragColor=vec4(c*a,a);}',polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8});
  const placePools=()=>{pools.clear();for(const h of art!.lampHeads()){const r=h.id.startsWith('fixture.b')?2.2:7.5,m=new THREE.Mesh(poolGeo,poolMat);m.scale.setScalar(r);m.position.set(h.head[0],fx.ground(h.head[0],h.head[2])+.07,h.head[2]);
      // Pools land on the road where the head overhangs it.
      const {s,o}=fx.locate(h.head[0],h.head[2]);if(Math.abs(o)<5.3)m.position.y=P(Math.max(0,Math.min(FIXTURE.length,s)),o)[1]+.03;pools.add(m);}};
  placePools();
  let date=new Date('2026-06-21T13:00:00-04:00');
  const setLight=()=>{
    const pos=solarPosition(date),colors=skyGradient(pos.elevation),floor=nightLight(pos.elevation,colors),fog=horizonFog({tier,eyeAboveGround:camera.position.y-8,elevation:pos.elevation,sunAzimuth:pos.azimuth,heading:0});
    dome.update(nightDome(colors,floor.nightness),fog.color,pos.direction);scene.fog=new THREE.Fog(fog.color,fog.near,fog.far);
    ambient.color.set(floor.hemisphereSky);ambient.groundColor.set(floor.hemisphereGround);ambient.intensity=floor.hemisphereIntensity;
    const c=P(66,0);sun.color.set(colors.sunColor);sun.intensity=colors.sunIntensity*2;sun.position.set(c[0]+pos.direction[0]*300,c[1]+pos.direction[1]*300,c[2]+pos.direction[2]*300);sun.target.position.set(c[0],c[1],c[2]);sun.target.updateMatrixWorld();
    moon.color.set(NIGHT_FLOOR.moon);moon.position.set(c[0]+colors.moonDirection[0]*500,c[1]+500,c[2]+colors.moonDirection[2]*500);moon.target.position.set(c[0],c[1],c[2]);moon.target.updateMatrixWorld();moon.intensity=floor.moonIntensity;
    night=Math.max(0,Math.min(1,(2-pos.elevation)/8));art!.setNight(night);(poolMat.uniforms.k as {value:number}).value=night;
    return {elevation:pos.elevation,night};
  };
  const api={
    scene,camera,
    poses:Object.keys(SHEET_POSES),
    pose(name:string){const p=SHEET_POSES[name];if(!p)return false;camera.position.set(...p.eye);camera.lookAt(...p.target);camera.fov=p.fov;camera.updateProjectionMatrix();setLight();dome.follow(camera);return true;},
    time(hhmm:string){const [h,m]=hhmm.split(':').map(Number);date=new Date('2026-06-21T12:00:00-04:00');date.setHours(h!,m!,0,0);return setLight();},
    theme(t:RoadTheme){theme=t;build();placePools();setLight();return true;},
    render(){art!.update(camera,new Set([FIXTURE.district]));dome.follow(camera);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);const info=renderer.info.render;return {calls:info.calls,triangles:info.triangles,art:art!.stats()};},
  };
  (window as unknown as {__roadSheet:typeof api}).__roadSheet=api;
  api.pose('aerial');api.render();
  return api;
}
