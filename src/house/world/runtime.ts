import * as THREE from "three";
import { createHomeObjects, type HomeObjectsProjection } from "./homeObjects.ts";
import { createHouseSet } from "./houseSet.ts";
import { acquireWorldRenderer } from "./rendererOwner.ts";
import { createBloomQueen, disposeObject, type BloomEvidence } from "./bloom.ts";
import { HOUSE_WALK_GRAPH, findPath, nearestNode, type WalkNode } from "./walkPaths.ts";
import { houseFramePolicy } from "./framePolicy.ts";
import type { ThemeId } from "../../theme/scenes.ts";
import type { QueenStyle } from "../queenStyle.ts";

type Pose = {center:[number,number,number];camera:[number,number,number];phoneCamera:[number,number,number]};
type Direction="left"|"right"|"up"|"down";
export type WorldDestination={zone:string;target?:string;phoneTarget?:string;overview?:boolean;queenView?:"front"|"back"|"roots"|"detail";camera?:[number,number,number]};
export type HouseRuntime={setHome:(input:HomeObjectsProjection)=>void;go:(destination:WorldDestination)=>void;walk:(direction:Direction)=>void;walkTo:(x:number,y:number)=>void;setWalking:(enabled:boolean)=>void;setQueen:(style:QueenStyle,evidence:BloomEvidence[])=>void;camera:()=>[number,number,number];dispose:()=>void};
export function mountHouseWorld(host:HTMLElement,theme:ThemeId,buttons:()=>Map<string,HTMLElement>,onReady:()=>void,onFailure:()=>void,onArrival?:(room:string,level:string)=>void):HouseRuntime{
  let disposed=false,frame=0,previous=0,visible=true,moving=true,queenGeneration=0,lastPaint=0;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const scene=new THREE.Scene();scene.background=new THREE.Color(theme==="newfoundland"?0x9bbdc0:theme==="taylor"?0xe6c8bc:0xbaa589);
  scene.fog=new THREE.Fog(scene.background,34,78);
  const lease=acquireWorldRenderer(host,{
    priority:0,
    parameters:{antialias:true,alpha:false,powerPreference:"low-power"},
    configure(renderer){renderer.domElement.className="";renderer.domElement.style.cssText="";renderer.domElement.setAttribute("aria-hidden","true");renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=false;renderer.setScissorTest(false);renderer.setClearAlpha(1);},
    onSuspend(){cancelAnimationFrame(frame);frame=0;if(!disposed){try{host.style.backgroundImage=`url(${renderer.domElement.toDataURL("image/webp",.75)})`;host.style.backgroundSize="100% 100%";}catch{/* The readable frame remains available. */}}host.dataset.renderer="suspended";},
    onResume(){host.style.backgroundImage="";host.dataset.renderer="active";previous=performance.now();resize();schedule();}
  });
  const renderer=lease.renderer;host.dataset.renderer=lease.active?"active":"suspended";
  const camera=new THREE.PerspectiveCamera(42,1,.1,120);camera.position.set(-8,6,14);
  const target=new THREE.Vector3(-9.3,4.4,0),destination=camera.position.clone(),lookDestination=target.clone();
  const set=createHouseSet(theme);scene.add(set.group);
  set.group.traverse(node=>{if(/^(loft-bank-|loft-ceramic-shelf|cellar-jar-|cellar-glass-jars)/.test(node.name))node.visible=false;});
  const home=createHomeObjects(theme);scene.add(home.group);
  scene.add(new THREE.HemisphereLight(0xfff1df,theme==="newfoundland"?0x4d7582:0x5c4230,2.6));
  const sun=new THREE.DirectionalLight(0xffe6be,3);sun.position.set(-12,18,18);scene.add(sun);
  const fill=new THREE.DirectionalLight(0xb9d5ed,1.1);fill.position.set(16,7,7);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:theme==="newfoundland"?0x7299a1:theme==="taylor"?0xc4b5a8:0x84927a,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.42;scene.add(floor);
  const avatar=new THREE.Group();avatar.name="Your optional walking avatar";
  const coat=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.34,4,10),new THREE.MeshStandardMaterial({color:0x708897}));coat.position.y=.46;avatar.add(coat);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),new THREE.MeshStandardMaterial({color:0xe2bc91}));head.position.y=.83;avatar.add(head);avatar.visible=false;scene.add(avatar);
  let arrivedNode:WalkNode|undefined,viewportPhone:boolean|undefined;
  let current:WorldDestination={zone:"home:middle"},queen:THREE.Group|null=null,steps:WalkNode[]=[],walkEnd:WalkNode|null=null;
  const projected=new THREE.Vector3();let lastProjection="",paintSamples:number[]=[];
  function project(){
    const bounds=host.getBoundingClientRect(),controls=buttons();
    const placed:{x:number;y:number;w:number;h:number}[]=[];
    const dynamic=[...home.anchors.values()].map(anchor=>({id:anchor.id,zone:anchor.zone,position:anchor.target.getWorldPosition(new THREE.Vector3()).toArray() as [number,number,number]}));
    for(const anchor of [...set.anchors,...dynamic]){
      const button=controls.get(anchor.id);if(!button)continue;
      projected.fromArray(anchor.position);projected.y+=.8;projected.project(camera);
      const inZone=current.overview?anchor.id.startsWith("door-"):anchor.zone===current.zone;
      button.dataset.projected="true";button.hidden=!inZone||projected.z>=1||Math.abs(projected.x)>=.95||Math.abs(projected.y)>=.9||(bounds.width<720&&anchor.id!==current.phoneTarget);
      if(!button.hidden){
        const w=button.offsetWidth||170,h=button.offsetHeight||44;
        const x=Math.max(w/2+14,Math.min(bounds.width-w/2-14,(projected.x*.5+.5)*bounds.width));
        let y=Math.max(80,Math.min(bounds.height-100,(-projected.y*.5+.5)*bounds.height));
        for(const other of placed)if(Math.abs(x-other.x)<(w+other.w)/2+8&&Math.abs(y-other.y)<(h+other.h)/2+8)y=other.y+(h+other.h)/2+12;
        placed.push({x,y,w,h});button.style.left=`${x}px`;button.style.top=`${y}px`;
      }
    }
  }
  function render(){
    if(!lease.active||disposed)return;
    const began=performance.now();renderer.render(scene,camera);project();
    paintSamples.push(performance.now()-began);if(paintSamples.length>60)paintSamples.shift();
    host.dataset.renderMs=(paintSamples.reduce((a,b)=>a+b,0)/paintSamples.length).toFixed(2);
    host.dataset.houseCamera=JSON.stringify(camera.position.toArray());host.dataset.drawCalls=String(renderer.info.render.calls);host.dataset.geometries=String(renderer.info.memory.geometries);host.dataset.textures=String(renderer.info.memory.textures);
  }
  function schedule(){if(!disposed&&!frame&&visible&&!document.hidden&&lease.active)frame=requestAnimationFrame(loop);}
  function finishWalk(){const end=walkEnd;walkEnd=null;if(end?.room&&end.level){host.dataset.walkNode=end.id;onArrival?.(end.room,end.level);}}
  function loop(now:number){
    frame=0;if(disposed||!visible||document.hidden||!lease.active)return;
    if(now-lastPaint<1000/30){schedule();return;}lastPaint=now;
    const dt=Math.min((now-previous)/1000,.08);previous=now;
    const movedWalker=steps.length>0,wasMoving=moving;
    if(steps.length){
      const next=steps[0]!,point=new THREE.Vector3(next.point.x,next.point.y,next.point.z),distance=avatar.position.distanceTo(point);
      if(reduced.matches){const last=steps.at(-1)!;avatar.position.set(last.point.x,last.point.y,last.point.z);steps=[];finishWalk();}
      else {avatar.position.lerp(point,Math.min(1,dt*3/Math.max(distance,.001)));if(distance<.05){avatar.position.copy(point);arrivedNode=next;steps.shift();if(!steps.length)finishWalk();}}
      if(steps.length){lookDestination.copy(avatar.position).add(new THREE.Vector3(0,1.1,-.5));destination.copy(avatar.position).add(new THREE.Vector3(camera.aspect<1?2:3,3.8,camera.aspect<1?9:12));}
    }
    moving=!reduced.matches&&(camera.position.distanceTo(destination)>.003||target.distanceTo(lookDestination)>.003);
    if(!moving){camera.position.copy(destination);target.copy(lookDestination);}else{camera.position.lerp(destination,1-Math.exp(-dt*7));target.lerp(lookDestination,1-Math.exp(-dt*7));}
    camera.lookAt(target);
    const projection=[camera.position.x,camera.position.y,camera.position.z,target.x,target.y].map(n=>n.toFixed(3)).join(":");
    const policy=houseFramePolicy({reduced:reduced.matches,moving,walking:steps.length>0,movedWalker,settledCamera:wasMoving&&!moving,projectionChanged:projection!==lastProjection});
    if(policy.animate)set.animate(now/1000);
    if(policy.render){render();lastProjection=projection;}
    if(policy.schedule)schedule();
  }
  function resize(){const {width,height}=host.getBoundingClientRect();if(width<1||height<1||!lease.active)return;const phone=width<720;if(viewportPhone!==undefined&&viewportPhone!==phone)current={...current,camera:undefined};viewportPhone=phone;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();go(current);render();}
  function poseFor(next:WorldDestination):Pose|undefined{
    if(next.overview)return {center:[0,4,0],camera:[1,12,camera.aspect<1?51:30],phoneCamera:[1,12,51]};
    const focus=next.target?set.focus[next.target]:camera.aspect<1&&next.phoneTarget?set.focus[next.phoneTarget]:undefined;
    return focus||set.zones[next.zone as keyof typeof set.zones];
  }
  function go(next:WorldDestination){
    const changed=current.zone!==next.zone;current=next;const pose=poseFor(next);if(!pose)return;
    if(changed){steps=[];walkEnd=null;}
    destination.fromArray(next.camera??(camera.aspect<1?pose.phoneCamera:pose.camera));lookDestination.fromArray(pose.center);
    if(next.queenView){const anchor=set.anchors.find(a=>a.id==="queen");if(anchor){const p=new THREE.Vector3().fromArray(anchor.position);lookDestination.copy(p).add(new THREE.Vector3(0,next.queenView==="roots"?.25:1.1,0));destination.copy(lookDestination).add(new THREE.Vector3(next.queenView==="detail"?1:0,next.queenView==="roots"?.4:.3,next.queenView==="back"?-4:next.queenView==="detail"?2.5:4.7));}}
    const [room,level]=next.zone.split(":"),node=HOUSE_WALK_GRAPH.nodes.find(node=>node.id===`room:${room}:${level}`);
    if(node&&!steps.length){avatar.position.set(node.point.x,node.point.y,node.point.z);arrivedNode=node;host.dataset.walkNode=node.id;}
    host.dataset.zone=next.zone;host.dataset.room=room;moving=true;lastProjection="";schedule();
  }
  function travel(to:WalkNode){
    if(!avatar.visible)return;
    const next=steps[0];const endpoints=[arrivedNode,next].filter((node):node is WalkNode=>Boolean(node));
    const start=endpoints.length?endpoints.sort((a,b)=>avatar.position.distanceToSquared(new THREE.Vector3(a.point.x,a.point.y,a.point.z))-avatar.position.distanceToSquared(new THREE.Vector3(b.point.x,b.point.y,b.point.z)))[0]:nearestNode(avatar.position),path=start&&findPath(start.id,to.id);if(!path)return;
    // Interrupting a route first returns along its current edge to the nearest endpoint.
    steps=[...path];walkEnd=to;schedule();
  }
  function walk(direction:Direction){
    if(!avatar.visible)return;
    const [room,level]=current.zone.split(":"),rooms=["home","study","kitchen-table","together"],levels=["below","middle","above"];
    const nextRoom=rooms[THREE.MathUtils.clamp(rooms.indexOf(room!)+(direction==="left"?-1:direction==="right"?1:0),0,3)],nextLevel=levels[THREE.MathUtils.clamp(levels.indexOf(level!)+(direction==="down"?-1:direction==="up"?1:0),0,2)];
    const node=HOUSE_WALK_GRAPH.nodes.find(node=>node.id===`room:${nextRoom}:${nextLevel}`);if(node)travel(node);
  }
  function walkTo(x:number,y:number){
    if(!avatar.visible)return;const bounds=host.getBoundingClientRect();
    const nodes=HOUSE_WALK_GRAPH.nodes.filter(node=>current.overview||`${node.room}:${node.level}`===current.zone);
    let nearest:WalkNode|undefined,best=120*120;
    for(const node of nodes){projected.set(node.point.x,node.point.y+.3,node.point.z).project(camera);if(projected.z>=1)continue;const dx=bounds.left+(projected.x*.5+.5)*bounds.width-x,dy=bounds.top+(-projected.y*.5+.5)*bounds.height-y,distance=dx*dx+dy*dy;if(distance<best){best=distance;nearest=node;}}
    if(nearest)travel(nearest);
  }
  async function setQueen(style:QueenStyle,evidence:BloomEvidence[]){
    const generation=++queenGeneration;try{const next=await createBloomQueen(style,evidence);if(disposed||generation!==queenGeneration){disposeObject(next);return;}
      if(queen){scene.remove(queen);disposeObject(queen);}queen=next;
      const anchor=set.anchors.find(a=>a.id==="queen");if(anchor)next.position.fromArray(anchor.position);scene.add(next);
      sun.color.set(style.light==="moon"?0xc4d6ff:style.light==="amber"?0xffc788:0xffe6be);render();schedule();
    }catch{host.dataset.queen="unavailable";}
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  const controlsRoot=host.parentElement;
  const controlsObserver=controlsRoot&&typeof MutationObserver!=="undefined"?new MutationObserver(()=>render()):null;
  if(controlsRoot)controlsObserver?.observe(controlsRoot,{childList:true,subtree:true,characterData:true});
  const intersection=new IntersectionObserver(([entry])=>{visible=Boolean(entry?.isIntersecting);if(visible){previous=performance.now();schedule();}else{cancelAnimationFrame(frame);frame=0;}});intersection.observe(host);
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{previous=performance.now();schedule();}};
  const removeLost=lease.listenCanvas("webglcontextlost",event=>{event.preventDefault();cancelAnimationFrame(frame);frame=0;onFailure();});
  document.addEventListener("visibilitychange",visibility);reduced.addEventListener("change",schedule);resize();onReady();
  return {setHome(input){home.update(input);render();schedule();},go,walk,walkTo,setWalking(enabled){avatar.visible=enabled;if(!enabled){steps=[];walkEnd=null;go(current);}render();schedule();},setQueen:(style,evidence)=>{void setQueen(style,evidence);},camera:()=>camera.position.toArray() as [number,number,number],dispose(){disposed=true;queenGeneration++;cancelAnimationFrame(frame);observer.disconnect();controlsObserver?.disconnect();intersection.disconnect();document.removeEventListener("visibilitychange",visibility);reduced.removeEventListener("change",schedule);removeLost();if(queen)disposeObject(queen);disposeObject(avatar);floor.geometry.dispose();(floor.material as THREE.Material).dispose();home.dispose();set.dispose();lease.release();host.style.backgroundImage="";}};
}
