import {HARBOUR_DEV} from '../../flag.ts';
import * as THREE from 'three';
import {acquireWorldRenderer} from '../../../house/world/rendererOwner.ts';
import {createBodyFigure} from '../../body/figure.ts';
import type {PlaceWalkSource} from '../../scene/place.ts';
import type {HouseBodyReturn} from '../../../house/navigation.ts';
import {HORIZON_GEOGRAPHY,HORIZON_PRESENCE_WORLD} from '../../../worldGeography.ts';
import {loadHorizonAssets,type HorizonAssets} from '../../../house/world/horizonAssets.ts';
import {createHorizonGeography,HORIZON_WALKABLE_DEGREES,HORIZON_BODY_HEIGHT} from './geography.ts';
import {buildDistrictCards,buildWaterCards,buildHorizonRing} from './cards.ts';
import {createDistrictStream} from '../world/districts.ts';
import {HORIZON_MANIFEST} from '../world/manifest.ts';
import {restoreHorizonPosition} from './savedPosition.ts';
import {walkPlan} from '../world/pathGraph.ts';
import {solarPosition,solarReviewDate} from '../sun/solar.ts';
import {skyGradient} from '../sky/gradient.ts';
import {horizonFog} from '../sky/fog.ts';
import type {XYZ} from '../land/interfaces.ts';
import type {Host,SketchbookPose} from '../world/definition.ts';

export type HorizonBody={x:number;y:number;z:number;yaw:number};
export type HorizonMode='walk'|'look'|'journey';
export type HorizonRuntime=ReturnType<typeof createRuntime>;
export type HorizonOptions={tier:'full'|'lite';signal?:AbortSignal;reducedMotion?:boolean;onDoor?:(host:Host,body:HouseBodyReturn)=>void;onReady?:()=>void;onStatus?:(text:string)=>void;partner?:()=>PlaceWalkSource|null;initialBody?:HouseBodyReturn};
export async function mountHorizon(host:HTMLElement,options:HorizonOptions){
  const assets=await loadHorizonAssets(options.tier,options.signal);if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  return createRuntime(host,assets,options);
}
function createRuntime(host:HTMLElement,assets:HorizonAssets,options:HorizonOptions){
  const {world,field,journey,cuts}=assets,tier=options.tier,start=performance.now(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.08,4500);
  const geography=createHorizonGeography(field,cuts),figure=createBodyFigure(),partner=createBodyFigure({coat:'#af8760'});
  scene.add(figure.group,partner.group);partner.group.visible=false;
  const coarse=new Map(world.districts.map(d=>{const cards=buildDistrictCards(world,journey,cuts,d,tier,true);scene.add(cards.group);return[d.id,cards] as const;}));
  const water=buildWaterCards(cuts,tier),ring=buildHorizonRing(assets.horizonCards,tier);scene.add(water.group,ring.group);
  const skyCanvas=document.createElement('canvas');skyCanvas.width=8;skyCanvas.height=256;const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;
  const ambient=new THREE.HemisphereLight('#d9e7e8','#786b57',1.2),sun=new THREE.DirectionalLight('#fff0d5',2.2),moon=new THREE.DirectionalLight('#9badcd',.26);
  sun.castShadow=true;sun.shadow.mapSize.set(tier==='full'?2048:1024,tier==='full'?2048:1024);sun.shadow.camera.near=1;sun.shadow.camera.far=1400;
  sun.shadow.camera.left=sun.shadow.camera.bottom=-180;sun.shadow.camera.right=sun.shadow.camera.top=180;sun.shadow.normalBias=.05;sun.shadow.bias=-.00006;
  scene.add(ambient,sun,sun.target,moon);
  const interactiveAt=performance.now();
  let doorCooldown=0;
  let frame=0,disposed=false,paused=false,mode:HorizonMode='look',last=0,lastSun=-Infinity,shotId='A',distance=12,pitch=.2,yaw=0,drag:{x:number;y:number;id:number;travel:number}|null=null;
  let transition:{eye:THREE.Vector3;target:THREE.Vector3;toEye:THREE.Vector3;toTarget:THREE.Vector3;at:number;duration:number}|null=null;
  let controls={forward:0,strafe:0,run:false},path:XYZ[]=[],velocityY=0,jumpRequested=false,currentTime:Date|null=null;
  const body:HorizonBody={x:1400,y:22,z:1210,yaw:0},target=new THREE.Vector3(),keys=new Set<string>(),frameTimes:number[]=[],drawSamples:{at:number;calls:number;triangles:number;resident:number}[]=[];
  const configure=(r:THREE.WebGLRenderer)=>{r.setPixelRatio(Math.min(window.devicePixelRatio||1,tier==='full'?1.5:1));r.shadowMap.enabled=true;r.shadowMap.autoUpdate=false;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.25;};
  const lease=acquireWorldRenderer(host,{priority:0,parameters:{antialias:tier==='full',alpha:false,preserveDrawingBuffer:HARBOUR_DEV},configure,onSuspend:()=>{keys.clear();controls={forward:0,strafe:0,run:false};},onResume:()=>{last=0;schedule();}}),renderer=lease.renderer;
  const fades=new WeakMap<THREE.Material,{opacity:number;transparent:boolean;depthWrite:boolean}>();
  function fade(materials:Record<string,THREE.Material>,amount:number){for(const material of Object.values(materials)){let original=fades.get(material);if(!original){original={opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite};fades.set(material,original);}const transparent=original.transparent||amount<1;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.opacity=original.opacity*amount;material.depthWrite=original.depthWrite&&amount>=1;}}
  const stream=createDistrictStream(world,d=>{const cards=buildDistrictCards(world,field,cuts,d,tier);scene.add(cards.group);renderer.shadowMap.needsUpdate=true;return{cards,at:performance.now(),dispose(){scene.remove(cards.group);cards.dispose();coarse.get(d.id)!.group.visible=true;}};},tier);
  function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function setLight(date:Date){
    const position=solarPosition(date),colors=skyGradient(position.elevation),lookHeight=camera.position.y-geography.ground(camera.position.x,camera.position.z),fog=horizonFog({tier,eyeAboveGround:Math.max(0,lookHeight),elevation:position.elevation,sunAzimuth:position.azimuth,heading:yaw*180/Math.PI});
    const context=skyCanvas.getContext('2d')!;const gradient=context.createLinearGradient(0,0,0,256);gradient.addColorStop(0,colors.zenith);gradient.addColorStop(.6,colors.horizonAway);gradient.addColorStop(1,colors.horizonSun);context.fillStyle=gradient;context.fillRect(0,0,8,256);skyTexture.needsUpdate=true;scene.background=skyTexture;
    for(const material of Object.values(ring.materials))if('color'in material)(material as THREE.MeshStandardMaterial).color.set('#ffffff').lerp(new THREE.Color(fog.color),.5);
    scene.fog=mode==='journey'?null:new THREE.Fog(fog.color,fog.near,fog.far);
    ambient.color.set(colors.zenith);ambient.groundColor.set(position.elevation<0?'#546071':'#b8a580');ambient.intensity=colors.ambient*2.3;
    sun.color.set(colors.sunColor);sun.intensity=colors.sunIntensity*2;sun.position.set(body.x+position.direction[0]*700,body.y+position.direction[1]*700,body.z+position.direction[2]*700);sun.target.position.set(body.x,body.y,body.z);
    moon.position.set(body.x+colors.moonDirection[0]*500,500,body.z+colors.moonDirection[2]*500);moon.intensity=position.elevation<0?.38:0;renderer.shadowMap.needsUpdate=true;
  }
  function lookAt(pose:SketchbookPose){
    camera.position.fromArray([...pose.eye]);target.fromArray([...pose.target]);camera.lookAt(target);
    const delta=target.clone().sub(camera.position),horizontal=Math.hypot(delta.x,delta.z);yaw=Math.atan2(delta.x,delta.z);pitch=Math.atan2(delta.y,horizontal);distance=delta.length();
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(pose.fovDegrees)/2)/(pose.aspect??16/9)));camera.updateProjectionMatrix();
  }
  function shot(id:string){const pose=world.views.find(p=>p.id===id);if(!pose)return false;shotId=id;mode='look';path=[];transition=null;lookAt(pose);body.x=pose.eye[0];body.z=pose.eye[2];body.y=pose.eye[1]-1.6;body.yaw=yaw;lastSun=-Infinity;return true;}
  function restore(saved:HouseBodyReturn){
    const next=restoreHorizonPosition(saved,world.pathGraph!,geography.ground);
    Object.assign(body,{x:next.x,y:next.y!,z:next.z,yaw:next.yaw});yaw=body.yaw;mode='walk';path=[];velocityY=0;updateCamera();
  }

  function savedBody():HouseBodyReturn{return{...body,place:'court',world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY};}
  function enterDoor(hostId?:string){const h=hostId?world.hosts.find(h=>h.id===hostId):world.hosts.find(h=>'xy'in h.door&&Math.hypot(body.x-h.door.xy[0],body.z-h.door.xy[1],body.y-(h.door.height??0))<2.4);if(!h)return false;
    doorCooldown=performance.now()+1800;const out=h.returnAt;if(out){Object.assign(body,{x:out[0],y:out[1],z:out[2],yaw:h.facing??0});yaw=body.yaw;}path=[];options.onDoor?.(h,savedBody());return true;
  }
  function setMode(next:HorizonMode){
    const fromEye=camera.position.clone(),fromTarget=target.clone();mode=next;path=[];
    if(next==='journey'){camera.position.set(1000,2100,2100);target.set(1000,20,850);camera.lookAt(target);camera.fov=50;camera.updateProjectionMatrix();}
    else if(next==='walk'){const at=geography.surface(body.x,body.z,body.y);if(at&&at.slope<=HORIZON_WALKABLE_DEGREES)body.y=at.y;distance=9;pitch=-.26;updateCamera();}
    transition={eye:fromEye,target:fromTarget,toEye:camera.position.clone(),toTarget:target.clone(),at:performance.now(),duration:options.reducedMotion?300:1100};camera.position.copy(fromEye);target.copy(fromTarget);camera.lookAt(target);
    lastSun=-Infinity;
  }
  function updateCamera(){if(mode!=='walk')return;
    const eye:XYZ=[body.x,body.y+1.15,body.z],desired:XYZ=[body.x-Math.sin(yaw)*distance,body.y+1.15-Math.sin(pitch)*distance,body.z-Math.cos(yaw)*distance];
    let f=1;while(f>.12&&geography.cameraBlocked(eye,[eye[0]+(desired[0]-eye[0])*f,eye[1]+(desired[1]-eye[1])*f,eye[2]+(desired[2]-eye[2])*f]))f-=.08;
    camera.position.set(eye[0]+(desired[0]-eye[0])*f,eye[1]+(desired[1]-eye[1])*f,eye[2]+(desired[2]-eye[2])*f);target.set(...eye);camera.lookAt(target);
  }
  function move(dx:number,dz:number,dt:number){
    const length=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(length/.2));let moved=0;
    for(let i=0;i<steps;i++){
      const x=body.x+dx/steps,z=body.z+dz/steps,hit=geography.surface(x,z,body.y,.48);
      if(!hit||hit.slope>HORIZON_WALKABLE_DEGREES||hit.y<-.65||geography.blocked(x,z,Math.max(body.y,hit.y)))break;
      body.x=x;body.z=z;if(velocityY===0)body.y=Math.max(hit.y,body.y-6*dt/steps);moved+=length/steps;
    }return moved;
  }
  function step(dt:number,now:number){
    let forward=controls.forward+(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),strafe=controls.strafe+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    let dx=Math.sin(yaw)*forward+Math.cos(yaw)*strafe,dz=Math.cos(yaw)*forward-Math.sin(yaw)*strafe;
    if(dx||dz)path=[];
    else if(path.length){const p=path[0]!;dx=p[0]-body.x;dz=p[2]-body.z;if(Math.hypot(dx,dz)<.35){path.shift();dx=0;dz=0;}}
    const length=Math.hypot(dx,dz),speed=controls.run||keys.has('shift')?HORIZON_MANIFEST.speeds_ms.run:HORIZON_MANIFEST.speeds_ms.walk;
    let moved=0;if(length){dx=dx/length*Math.min(length,speed*dt);dz=dz/length*Math.min(length,speed*dt);body.yaw=Math.atan2(dx,dz);moved=move(dx,dz,dt);if(path.length&&moved<.001){path=[];options.onStatus?.('That path is blocked. Choose another approach.');}}
    if(jumpRequested&&velocityY===0)velocityY=4.2;jumpRequested=false;
    if(velocityY!==0){velocityY-=12*dt;body.y+=velocityY*dt;const floor=geography.surface(body.x,body.z,body.y+.5);if(floor&&body.y<=floor.y){body.y=floor.y;velocityY=0;}if(geography.ceiling(body.x,body.z,body.y)<body.y+HORIZON_BODY_HEIGHT){body.y=geography.ceiling(body.x,body.z,body.y)-HORIZON_BODY_HEIGHT;velocityY=Math.min(0,velocityY);}}
    if(moved>0&&now>doorCooldown){const door=world.hosts.find(h=>'xy'in h.door&&Math.hypot(body.x-h.door.xy[0],body.z-h.door.xy[1],body.y-(h.door.height??0))<1.15);if(door)enterDoor(door.id);}
    figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.y=body.yaw;figure.pose(now*.007,moved>0?1:0,now/1000);updateCamera();
  }
  function tick(now:number){if(disposed)return;const dt=Math.min(.05,Math.max(0,(now-(last||now))/1000));if(last)frameTimes.push(now-last);if(frameTimes.length>3600)frameTimes.shift();last=now;
    if(!paused){if(mode==='walk'&&!transition)step(dt,now);if(mode!=='journey')stream.update({x:body.x,z:body.z,now,mode:mode==='look'?'look':'walk'});}
    for(const resource of stream.live.values()){resource.cards.group.visible=mode!=='journey';fade(resource.cards.materials,Math.min(1,Math.max(0,(now-resource.at)/(options.reducedMotion?300:500))));}
    for(const [id,cards]of coarse){const resource=stream.live.get(id),amount=mode==='journey'||!resource?1:Math.max(0,1-(now-resource.at)/(options.reducedMotion?300:500));cards.group.visible=amount>0;fade(cards.materials,amount);}
    if(transition){const t=Math.min(1,Math.max(0,(now-transition.at)/transition.duration)),ease=t*t*(3-2*t);camera.position.lerpVectors(transition.eye,transition.toEye,ease);target.lerpVectors(transition.target,transition.toTarget,ease);camera.lookAt(target);if(t===1)transition=null;}figure.group.visible=mode==='walk';
    const peer=options.partner?.()?.pose(now);partner.group.visible=Boolean(peer)&&mode!=='journey';if(peer){partner.group.position.set(peer.x,peer.y??geography.ground(peer.x,peer.z),peer.z);partner.group.rotation.y=peer.yaw;partner.pose(now*.007,peer.moving?1:0,now/1000);}
    if(now-lastSun>=60_000){setLight(currentTime??solarReviewDate(new Date(),location.search,{dev:HARBOUR_DEV,reducedMotion:options.reducedMotion}));lastSun=now;}
    renderer.render(scene,camera);if(drawSamples.length===0||now-drawSamples.at(-1)!.at>500){drawSamples.push({at:now,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resident:stream.live.size});if(drawSamples.length>600)drawSamples.shift();}schedule();
  }
  function schedule(){if(!disposed&&lease.active)frame=lease.requestFrame(tick);}
  const interactive=(event:KeyboardEvent)=>event.composedPath().some(t=>t instanceof Element&&Boolean(t.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],[role="textbox"]')));
  function keyDown(e:KeyboardEvent){if(paused||interactive(e)||!host.contains(document.activeElement))return;const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' '].includes(key)){e.preventDefault();if(key===' ')jumpRequested=true;else keys.add(key);}if(key==='e'){e.preventDefault();enterDoor();}if(key==='escape')path=[];}
  function keyUp(e:KeyboardEvent){keys.delete(e.key.toLowerCase());}
  function clear(){keys.clear();controls={forward:0,strafe:0,run:false};path=[];drag=null;}
  const unlisten=[lease.listenCanvas<PointerEvent>('pointerdown',e=>{if(paused)return;host.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,id:e.pointerId,travel:0};renderer.domElement.setPointerCapture(e.pointerId);}),lease.listenCanvas<PointerEvent>('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.travel+=Math.hypot(dx,dy);drag.x=e.clientX;drag.y=e.clientY;yaw-=dx*.005;pitch=Math.max(-1.2,Math.min(.8,pitch-dy*.004));if(mode==='look'){target.set(camera.position.x+Math.sin(yaw)*Math.cos(pitch)*distance,camera.position.y+Math.sin(pitch)*distance,camera.position.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);}}),lease.listenCanvas<PointerEvent>('pointerup',e=>{const click=drag&&drag.travel<5;drag=null;if(!click||mode!=='walk'||paused)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=ray.intersectObjects([...stream.live.values()].map(r=>r.cards.group),true);const hit=hits[0];if(hit){const plan=walkPlan(world.pathGraph!,[body.x,body.y,body.z],[hit.point.x,hit.point.y,hit.point.z],{stepFree:true});if(plan)path=[...plan.points];else options.onStatus?.('No connected walking route reaches that point.');}}),lease.listenCanvas<WheelEvent>('wheel',e=>{if(paused)return;e.preventDefault();distance=Math.max(2,Math.min(45,distance*Math.exp(e.deltaY*.001)));updateCamera();},{passive:false})];
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clear);host.addEventListener('blur',clear);
  shot(new URLSearchParams(location.search).get('shot')??'A');if(options.initialBody)restore(options.initialBody);resize();schedule();options.onReady?.();
  const api={world,assets,scene,camera,geography,shot,setMode,restore,savedBody,enterDoor,
    arrive(hostId:string){const h=world.hosts.find(h=>h.id===hostId);if(!h||!h.returnAt)return false;restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:h.returnAt[0],y:h.returnAt[1],z:h.returnAt[2],yaw:(h.facing??0)+Math.PI});return true;},
    simulateWalk(seconds:number){if(!HARBOUR_DEV)throw new Error('Simulation is a review-only control.');const count=Math.ceil(Math.max(0,Math.min(seconds,3600))/.05);for(let i=0;i<count&&path.length;i++)step(.05,performance.now()+i*50);return{body:{...body},remaining:path.length};},
    body:()=>({...body}),mode:()=>mode,shotId:()=>shotId,
    input(next:Partial<typeof controls>){controls={...controls,...next};},jump(){jumpRequested=true;},look(dx:number,dy:number){yaw+=dx;pitch=Math.max(-1.2,Math.min(.8,pitch+dy));},
    pause(value:boolean){paused=value;if(value)clear();},setDate(date:Date){currentTime=date;lastSun=-Infinity;},
    walkTo(p:XYZ){const plan=walkPlan(world.pathGraph!,[body.x,body.y,body.z],p,{stepFree:true});path=plan?[...plan.points]:[];return plan;},
    stats(){const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),revision:world.geographyRevision,terrainBytes:assets.bytes,firstInteractiveMs:interactiveAt-start,mode,shot:shotId,body:{...body},frames:[...frameTimes],drawSamples:[...drawSamples],stream:[...stream.history],camera:{eye:camera.position.toArray(),target:target.toArray(),fov:camera.fov},diagnostics:world.diagnostics};},
    dispose(){disposed=true;lease.cancelFrame(frame);observer.disconnect();for(const fn of unlisten)fn();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clear);host.removeEventListener('blur',clear);stream.dispose();for(const c of coarse.values())c.dispose();water.dispose();ring.dispose();skyTexture.dispose();figure.dispose();partner.dispose();sun.shadow.map?.dispose();lease.release();}
  };
  return api;
}
