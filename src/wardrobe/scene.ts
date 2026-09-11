import {loadCollection} from './collectionLoader.ts';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import type {LookV1} from '../core/herculesCompanionContracts.ts';
import {FITTING_ITEMS,WARDROBE_ASSET,canPlayReaction,fittingColour,type FittingReaction} from './catalogue.ts';
import {createRoom} from './room.ts';
import type {RoomPalette} from './roomPalette.ts';
export type {RoomTheme} from './roomPalette.ts';
export type WardrobeScene={setLook:(look:LookV1)=>void;setCollection:(id:string)=>void;setKeepsake:(id:string|null)=>void;setPose:(pose:FittingReaction)=>void;setPaused:(paused:boolean)=>void;setCamera:(angle:number,zoom:number)=>void;setMirror:(show:boolean)=>void;setRoom:(palette:RoomPalette)=>void;dispose:()=>void};
export async function createWardrobeScene(host:HTMLElement,options:{palette:RoomPalette;signal:AbortSignal;paused:boolean;onError:()=>void;onReady:()=>void;onPick:(id:string)=>void;onFittingState?:(state:'loading'|'ready'|'error')=>void;onCollectionState?:(state:'loading'|'ready'|'error')=>void}):Promise<WardrobeScene>{
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=false;renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new T.Scene(), camera=new T.PerspectiveCamera(35,1,.01,12);camera.position.set(.66,.49,1.24);camera.lookAt(0,.26,0);
 // The room shell, lights and set dressing are authored per theme and tinted from the live scene tokens.
 const room=createRoom(scene,options.palette);const {wood,trim,cloth,accent}=room.materials;host.dataset.roomLighting=options.palette.dark?'dark':'light';
 function box(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);scene.add(m);return m;}
 function cylinder(r:number,h:number,x:number,y:number,z:number,mat:T.Material){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,32),mat);m.position.set(x,y,z);scene.add(m);return m;}
 cylinder(.32,.045,0,-.008,.015,wood);cylinder(.3,.012,0,.02,.015,cloth);
 const mirror=new Reflector(new T.PlaneGeometry(.43,.67),{color:'#cbc9bb',textureWidth:512,textureHeight:512,clipBias:.004,multisample:0});mirror.position.set(.03,.35,-.56);scene.add(mirror);
 for(const x of [-.197,.257])box(.022,.71,.035,x,.35,-.552,trim);for(const y of [.006,.696])box(.474,.025,.035,.03,y,-.552,trim);
 // Left open rail and drawers. Right hat stand and lined accessory trays.
 for(const x of [-.67,-.29])box(.025,.71,.23,x,.32,-.43,wood);
 for(const y of [-.022,.145,.69])box(.405,.027,.23,-.48,y,-.43,wood);
 const rail=new T.Mesh(new T.CylinderGeometry(.008,.008,.35,10),trim);rail.rotation.z=Math.PI/2;rail.position.set(-.48,.615,-.35);scene.add(rail);
 for(const x of [-.60,-.48]){const hanger=new T.Mesh(new T.TorusGeometry(.04,.003,4,3),trim);hanger.rotation.z=Math.PI;hanger.position.set(x,.56,-.35);scene.add(hanger);}
 for(const y of [.025,.105]){box(.33,.065,.15,-.48,y,-.4,cloth);cylinder(.012,.01,-.48,y,-.315,trim).rotation.x=Math.PI/2;}
 box(.29,.03,.21,.49,.23,-.34,wood);cylinder(.013,.18,.49,.33,-.34,trim);cylinder(.07,.02,.49,.43,-.34,trim);
 box(.30,.16,.22,.49,.05,-.34,wood);for(const y of [.014,.09]){box(.265,.057,.017,.49,y,-.22,cloth);box(.038,.006,.01,.49,y,-.206,trim);}
 const collectionAbort=new AbortController();options.signal.addEventListener('abort',()=>collectionAbort.abort(),{once:true});
 const shelves=new T.Group();scene.add(shelves);
 const keepsake=new T.Group();const littleHouse=new T.Mesh(new T.BoxGeometry(.065,.065,.045),cloth),roof=new T.Mesh(new T.ConeGeometry(.055,.042,4),accent);roof.position.y=.052;roof.rotation.y=Math.PI/4;keepsake.add(littleHouse,roof);keepsake.position.set(.61,.15,-.29);keepsake.visible=false;scene.add(keepsake);const patio=new T.Group();const deck=new T.Mesh(new T.BoxGeometry(.1,.007,.07),wood),table=new T.Mesh(new T.CylinderGeometry(.025,.025,.005,16),cloth),leg=new T.Mesh(new T.CylinderGeometry(.003,.003,.037,6),trim);table.position.y=.04;leg.position.y=.02;patio.add(deck,table,leg);for(const x of [-.039,.039]){const seat=new T.Mesh(new T.BoxGeometry(.022,.005,.023),accent),back=new T.Mesh(new T.BoxGeometry(.005,.038,.023),accent);seat.position.set(x,.018,0);back.position.set(x,.026,0);patio.add(seat,back);}patio.position.copy(keepsake.position);patio.visible=false;scene.add(patio);
 let lookToken=0,shelfToken=0;const loaded=new Set([WARDROBE_ASSET]),loading=new Map<string,Promise<void>>();
 function ensure(url:string){if(loaded.has(url))return Promise.resolve();if(loading.has(url))return loading.get(url)!;const promise=loadCollection(model!,url,collectionAbort.signal).then(()=>{loaded.add(url);}).finally(()=>loading.delete(url));loading.set(url,promise);return promise;}
 let model:T.Group|undefined,mixer:T.AnimationMixer|undefined,clips:T.AnimationClip[]=[],look:LookV1|undefined,disposed=false,paused=options.paused,visible=true,frame=0,last=0,frames=0;
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),skeletons=new Set<T.Skeleton>();
 function render(){if(disposed)return;renderer.render(scene,camera);host.dataset.frames=String(++frames);host.dataset.drawCalls=String(renderer.info.render.calls);}
 function loop(now:number){frame=0;if(disposed||paused||!visible||document.hidden)return;mixer?.update(last?Math.min((now-last)/1000,.06):0);last=now;render();frame=requestAnimationFrame(loop);}
 function schedule(){cancelAnimationFrame(frame);frame=0;last=0;if(!disposed&&!paused&&visible&&!document.hidden)frame=requestAnimationFrame(loop);host.dataset.animating=String(Boolean(frame));}
 const visibility=()=>schedule();document.addEventListener('visibilitychange',visibility);
 const intersection=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([entry])=>{visible=entry?.isIntersecting??true;schedule();});intersection?.observe(host);
 const resize=()=>{if(disposed)return;const w=Math.max(host.clientWidth,1),h=Math.max(host.clientHeight,1);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
 const lose=(event:Event)=>{event.preventDefault();dispose();options.onError();};renderer.domElement.addEventListener('webglcontextlost',lose);
 const pick=(event:PointerEvent)=>{if(!model)return;const rect=renderer.domElement.getBoundingClientRect();const point=new T.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),ray=new T.Raycaster();ray.setFromCamera(point,camera);const hit=ray.intersectObjects(scene.children,true).find(hit=>hit.object.userData.fittingItemId);if(hit)options.onPick(hit.object.userData.fittingItemId as string);};renderer.domElement.addEventListener('pointerup',pick);
 function dispose(){collectionAbort.abort();if(disposed)return;disposed=true;cancelAnimationFrame(frame);resizeObserver.disconnect();intersection?.disconnect();document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lose);renderer.domElement.removeEventListener('pointerup',pick);mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);scene.traverse(n=>{if(n instanceof T.SkinnedMesh)skeletons.add(n.skeleton);if(n instanceof T.Mesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);}});for(const skeleton of skeletons)skeleton.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();mirror.getRenderTarget().dispose();room.dispose();renderer.dispose();renderer.domElement.remove();host.dataset.animating='false';}
 options.signal.addEventListener('abort',dispose,{once:true});
 try{
  const compressed=typeof DecompressionStream!=='undefined';const response=await fetch(WARDROBE_ASSET+(compressed?'.gz':''),{signal:options.signal});if(!response.ok)throw Error('Asset unavailable');let buffer=await response.arrayBuffer();host.dataset.transferBytes=String(buffer.byteLength);
  // Explicit gzip asset works without host-specific Content-Encoding rules. A CDN may already decode it.
  if(compressed&&new Uint8Array(buffer)[0]===0x1f&&new Uint8Array(buffer)[1]===0x8b)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(disposed)throw new DOMException('Closed','AbortError');const gltf=await new GLTFLoader().parseAsync(buffer,'');model=gltf.scene;clips=gltf.animations;
  if(disposed){const lateSkeletons=new Set<T.Skeleton>();model.traverse(n=>{if(n instanceof T.SkinnedMesh)lateSkeletons.add(n.skeleton);if(n instanceof T.Mesh){n.geometry.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});for(const skeleton of lateSkeletons)skeleton.dispose();throw new DOMException('Closed','AbortError');}
  model.position.y=.047;scene.add(model);mixer=new T.AnimationMixer(model);
  for(const item of FITTING_ITEMS){const node=model.getObjectByName(item.node);if(node)node.visible=false;}
  host.dataset.assetBytes=String(buffer.byteLength);host.dataset.state='ready';resize();schedule();options.onReady();
 }catch(error){dispose();throw error;}
 return {
  setLook(next){look=next;const token=++lookToken;if(!model||disposed)return;const urls=[...new Set(Object.values(next.selections).map(s=>FITTING_ITEMS.find(p=>p.id===s.itemId)?.asset).filter((s):s is string=>Boolean(s)))];
   const apply=()=>{if(disposed||token!==lookToken||!model)return;const hidden=new Set<string>();
    for(const item of FITTING_ITEMS){const selection=next.selections[item.slot],node=model.getObjectByName(item.node);if(!node)continue;node.visible=selection?.itemId===item.id;if(node.visible)item.hiddenBodyRegions.forEach(r=>hidden.add(r));node.traverse(n=>{if(n instanceof T.Mesh)for(const mat of Array.isArray(n.material)?n.material:[n.material])if(mat instanceof T.MeshStandardMaterial&&selection&&(mat.name.startsWith('tint_')||item.asset===WARDROBE_ASSET))mat.color.set(fittingColour(selection.variantId,item.id));});}
    model.traverse(n=>{if(n.name.startsWith('torso_'))n.visible=!hidden.has('torso');if(n.name.startsWith('crown_'))n.visible=!hidden.has('crown');});options.onFittingState?.('ready');render();};
   if(urls.every(u=>loaded.has(u))){apply();return;}options.onFittingState?.('loading');Promise.all(urls.map(ensure)).then(apply).catch(()=>{if(!disposed&&token===lookToken)options.onFittingState?.('error');});
  },
  setCollection(id){const token=++shelfToken;shelves.clear();options.onCollectionState?.('loading');render();Promise.all([...new Set(FITTING_ITEMS.filter(i=>i.collection===id).map(i=>i.asset))].map(ensure)).then(()=>{if(disposed||token!==shelfToken||!model)return;shelves.clear();const items=FITTING_ITEMS.filter(i=>i.collection===id);let garments=0,hats=0,trinkets=0;items.forEach(item=>{const source=model!.getObjectByName(item.node);if(!source)return;const group=new T.Group();source.traverse(n=>{if(n instanceof T.Mesh){const m=new T.Mesh(n.geometry,n.material);m.userData.fittingItemId=item.id;group.add(m);}});const bounds=new T.Box3().setFromObject(group),centre=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());group.children.forEach(n=>n.position.sub(centre));const hanging=['body','outerwear'].includes(item.slot);group.scale.setScalar((hanging?.17:.09)/Math.max(size.x,size.y,size.z));if(hanging||item.slot==='neckwear'){const n=garments++;group.position.set(n%2?-.43:-.59,.50-Math.floor(n/2)*.19,-.35);}else if(item.slot==='head'){const n=hats++;group.position.set(.49+n*.115,.445+size.y*group.scale.y/2,-.34);}else{const n=trinkets++;group.position.set(.43+n*.08,.139+size.y*group.scale.y/2,-.27);}shelves.add(group);});options.onCollectionState?.('ready');render();}).catch(()=>{if(!disposed&&token===shelfToken)options.onCollectionState?.('error');});},
  setKeepsake(id){keepsake.visible=Boolean(id)&&id!=='patio';patio.visible=id==='patio';keepsake.scale.y=id==='townhouse'?1.5:1;render();},
  setPose(id){if(!mixer||!model||!look||!canPlayReaction(id,look))return;const clip=clips.find(c=>c.name===id);if(!clip)return;mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset().setLoop(id==='breathe-blink'?T.LoopRepeat:T.LoopOnce,id==='breathe-blink'?Infinity:1);action.clampWhenFinished=true;action.play();if(paused){mixer.update(clip.duration*.45);}host.dataset.pose=id;render();schedule();},
  setPaused(value){paused=value;schedule();render();},
  setCamera(angle,zoom){if(model)model.rotation.y=angle*Math.PI/180;camera.position.set(.66,.49,1.24).sub(new T.Vector3(0,.26,0)).multiplyScalar(zoom).add(new T.Vector3(0,.26,0));camera.lookAt(0,.26,0);render();},
  setMirror(show){mirror.visible=show;render();},
  setRoom(palette){room.apply(palette);host.dataset.roomLighting=palette.dark?'dark':'light';render();},dispose,
 };
}
