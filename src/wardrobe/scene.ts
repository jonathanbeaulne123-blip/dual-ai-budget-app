import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import type {LookV1} from '../core/herculesCompanionContracts.ts';
import {FITTING_ITEMS,WARDROBE_ASSET,canPlayReaction,fittingColour,type FittingReaction} from './catalogue.ts';
export type RoomTheme='classic'|'taylor'|'newfoundland';
export type WardrobeScene={setLook:(look:LookV1)=>void;setPose:(pose:FittingReaction)=>void;setPaused:(paused:boolean)=>void;setCamera:(angle:number,zoom:number)=>void;setMirror:(show:boolean)=>void;dispose:()=>void};
export async function createWardrobeScene(host:HTMLElement,options:{theme:RoomTheme;personal:boolean;signal:AbortSignal;paused:boolean;onError:()=>void;onReady:()=>void;onPick:(id:string)=>void}):Promise<WardrobeScene>{
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=false;renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new T.Scene(), camera=new T.PerspectiveCamera(35,1,.01,12);camera.position.set(.66,.49,1.24);camera.lookAt(0,.26,0);
 const palettes={classic:{wall:'#d7c7ac',wood:'#71513d',trim:'#baa16d',cloth:'#eee4d1',accent:'#5c6d52'},taylor:{wall:options.personal?'#b9c2b1':'#c9bca6',wood:options.personal?'#66715b':'#765845',trim:'#a78e60',cloth:'#e3d9c7',accent:'#975f45'},newfoundland:{wall:options.personal?'#718b95':'#7a606c',wood:'#394a51',trim:'#b99a57',cloth:'#d8cfbd',accent:'#be993f'}};
 const p=palettes[options.theme];scene.background=new T.Color(p.wall);const material=(colour:string,metalness=0)=>new T.MeshStandardMaterial({color:colour,roughness:metalness?.4:.82,metalness});
 const wood=material(p.wood),trim=material(p.trim,.55),cloth=material(p.cloth),wall=material(p.wall),accent=material(p.accent);
 scene.add(new T.HemisphereLight('#fff5df','#55626d',1.5));const sun=new T.DirectionalLight('#fff1d2',2);sun.position.set(-.5,1.2,1);scene.add(sun);const fill=new T.DirectionalLight('#d3e7ed',.7);fill.position.set(1,.6,-.4);scene.add(fill);
 function box(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);scene.add(m);return m;}
 function cylinder(r:number,h:number,x:number,y:number,z:number,mat:T.Material){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,32),mat);m.position.set(x,y,z);scene.add(m);return m;}
 box(1.65,.035,1.25,0,-.045,-.03,wood);box(1.6,.91,.028,0,.39,-.63,wall);
 for(let i=-5;i<=5;i++)box(.006,.91,.007,i*.145,.39,-.608,trim);
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
 if(options.theme==='taylor'){
  // Cottage shelf, stitched cushions and botanical forms; no invented personal memorabilia.
  box(.2,.025,.15,-.50,.37,-.47,wood);for(let i=0;i<3;i++)box(.034,.085,.07,-.57+i*.037,.425,-.45,i%2?cloth:accent);
  const pot=cylinder(.027,.052,.60,.17,-.32,cloth);pot.userData.decorative=true;
  for(let i=0;i<5;i++){const leaf=new T.Mesh(new T.SphereGeometry(.025,8,6),accent);leaf.scale.set(.5,1.7,.2);leaf.position.set(.60+Math.sin(i)*.027,.215+i*.009,-.32);leaf.rotation.z=i*.6;scene.add(leaf);}
 }else if(options.theme==='newfoundland'){
  // Collected music lounge: original record sleeves and a quiet brass lamp.
  for(let i=0;i<3;i++){box(.085,.085,.006,-.50+i*.018,.24+i*.004,-.37,accent);const disc=new T.Mesh(new T.CylinderGeometry(.026,.026,.003,24),wood);disc.rotation.x=Math.PI/2;disc.position.set(-.5+i*.018,.24+i*.004,-.362);scene.add(disc);}
  cylinder(.012,.21,.65,.31,-.48,trim);const shade=new T.Mesh(new T.ConeGeometry(.07,.10,24,1,true),cloth);shade.position.set(.65,.43,-.48);scene.add(shade);
 }else {box(.14,.075,.10,-.48,.23,-.44,cloth);box(.15,.018,.11,-.48,.275,-.44,trim);}
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
 function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);resizeObserver.disconnect();intersection?.disconnect();document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lose);renderer.domElement.removeEventListener('pointerup',pick);mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);scene.traverse(n=>{if(n instanceof T.SkinnedMesh)skeletons.add(n.skeleton);if(n instanceof T.Mesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);}});for(const skeleton of skeletons)skeleton.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();mirror.getRenderTarget().dispose();renderer.dispose();renderer.domElement.remove();host.dataset.animating='false';}
 options.signal.addEventListener('abort',dispose,{once:true});
 try{
  const compressed=typeof DecompressionStream!=='undefined';const response=await fetch(WARDROBE_ASSET+(compressed?'.gz':''),{signal:options.signal});if(!response.ok)throw Error('Asset unavailable');let buffer=await response.arrayBuffer();host.dataset.transferBytes=String(buffer.byteLength);
  // Explicit gzip asset works without host-specific Content-Encoding rules. A CDN may already decode it.
  if(compressed&&new Uint8Array(buffer)[0]===0x1f&&new Uint8Array(buffer)[1]===0x8b)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(disposed)throw new DOMException('Closed','AbortError');const gltf=await new GLTFLoader().parseAsync(buffer,'');model=gltf.scene;clips=gltf.animations;
  if(disposed){const lateSkeletons=new Set<T.Skeleton>();model.traverse(n=>{if(n instanceof T.SkinnedMesh)lateSkeletons.add(n.skeleton);if(n instanceof T.Mesh){n.geometry.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});for(const skeleton of lateSkeletons)skeleton.dispose();throw new DOMException('Closed','AbortError');}
  model.position.y=.047;scene.add(model);mixer=new T.AnimationMixer(model);
  // The physical shelf pieces select the same catalogue IDs as the accessible controls.
  for(const item of FITTING_ITEMS){const source=model.getObjectByName(item.node);if(!source)throw Error('Missing fitting piece');const group=new T.Group();source.traverse(n=>{if(n instanceof T.Mesh){const mesh=new T.Mesh(n.geometry,n.material);mesh.userData.fittingItemId=item.id;group.add(mesh);}});group.scale.setScalar(item.slot==='body'?.63:.8);group.position.set(item.slot==='body'?-.48:.49,item.slot==='body'?.30:item.slot==='head'?.445:.135,item.slot==='body'?-.41:-.32);scene.add(group);}
  host.dataset.assetBytes=String(buffer.byteLength);host.dataset.state='ready';resize();schedule();options.onReady();
 }catch(error){dispose();throw error;}
 return {
  setLook(next){look=next;if(!model||disposed)return;for(const item of FITTING_ITEMS){const selection=look.selections[item.slot],node=model.getObjectByName(item.node)!;node.visible=selection?.itemId===item.id;node.traverse(n=>{if(n instanceof T.Mesh)for(const mat of Array.isArray(n.material)?n.material:[n.material])if(mat instanceof T.MeshStandardMaterial&&selection)mat.color.set(fittingColour(selection.variantId));});}model.traverse(n=>{if(n.name.startsWith('torso_'))n.visible=!next.selections.body;if(n.name.startsWith('crown_'))n.visible=!next.selections.head;});render();},
  setPose(id){if(!mixer||!model||!look||!canPlayReaction(id,look))return;const clip=clips.find(c=>c.name===id);if(!clip)return;mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset().setLoop(id==='breathe-blink'?T.LoopRepeat:T.LoopOnce,id==='breathe-blink'?Infinity:1);action.clampWhenFinished=true;action.play();if(paused){mixer.update(clip.duration*.45);}host.dataset.pose=id;render();schedule();},
  setPaused(value){paused=value;schedule();render();},
  setCamera(angle,zoom){if(model)model.rotation.y=angle*Math.PI/180;camera.position.set(.66,.49,1.24).sub(new T.Vector3(0,.26,0)).multiplyScalar(zoom).add(new T.Vector3(0,.26,0));camera.lookAt(0,.26,0);render();},
  setMirror(show){mirror.visible=show;render();},dispose,
 };
}
