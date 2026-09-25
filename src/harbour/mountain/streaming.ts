import * as THREE from 'three';
/** Detail ownership is separate from the permanent land, collision and silhouettes. */
export type DetailResource={dispose():void};
export type DetailSite={id:string;at:readonly[number,number];radius:number};
export function createDetailStream<T extends DetailResource>(sites:readonly DetailSite[],build:(site:DetailSite)=>T){
  const live=new Map<string,T>(),outsideSince=new Map<string,number>();let dead=false;
  return {
    live,
    update(x:number,z:number,pinned=false,now=performance.now()):boolean{
      if(dead)return false;let changed=false,built=false,pending=false;
      for(const site of sites){
        const distance=Math.hypot(x-site.at[0],z-site.at[1]),resident=live.get(site.id);
        if(!resident&&built&&(pinned||distance<=site.radius))pending=true;
        // A 24-unit release band prevents rebuilding while crossing a district edge.
        if(pinned||distance<=site.radius+24)outsideSince.delete(site.id);
        if(!resident&&!built&&(pinned||distance<=site.radius)){live.set(site.id,build(site));changed=true;built=true;}
        else if(resident&&!pinned&&distance>site.radius+24){const since=outsideSince.get(site.id)??now;outsideSince.set(site.id,since);if(now-since>=4000){resident.dispose();live.delete(site.id);outsideSince.delete(site.id);changed=true;}}
      }
      return changed||pending;
    },
    dispose(){if(dead)return;dead=true;for(const item of live.values())item.dispose();live.clear();},
  };
}

/** Held still (calm view, reduced motion): streamed detail appears at once, with no fade. */
const activeFades=new Set<()=>void>();
let quietStream=false;
export function setStreamQuiet(on:boolean){quietStream=on;if(on)for(const restore of [...activeFades])restore();}
export const DETAIL_FADE_MS=450;
/**
 * A short opacity fade for freshly streamed detail, so a district's close props arrive
 * rather than pop. Driven by the frames the world is already painting (an onBeforeRender
 * on each mesh); held still, or with no clock, it is fully opaque at once.
 */
export function fadeIn(group:THREE.Object3D){
  const now=()=>typeof performance!=='undefined'?performance.now():0;
  const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  if(quietStream||reduced||(typeof document!=='undefined'&&document.documentElement.dataset.motion==='reduced')||typeof window==='undefined')return {cancel(){}};
  const states:{m:THREE.Material&{opacity:number;transparent:boolean};opacity:number;transparent:boolean;depthWrite:boolean}[]=[];
  const seen=new Set<THREE.Material>();
  group.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.material)return;for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){if(seen.has(m))continue;seen.add(m);const mm=m as THREE.Material&{opacity:number;transparent:boolean};states.push({m:mm,opacity:mm.opacity,transparent:mm.transparent,depthWrite:mm.depthWrite});mm.transparent=true;mm.opacity=0;mm.needsUpdate=true;}});
  let start:number|null=null,done=false;
  const restore=()=>{if(done)return;done=true;activeFades.delete(restore);for(const s of states){s.m.opacity=s.opacity;s.m.transparent=s.transparent;s.m.depthWrite=s.depthWrite;s.m.needsUpdate=true;}hooks.forEach(o=>{o.onBeforeRender=()=>{};});};
  const hooks:THREE.Object3D[]=[];
  group.traverse(o=>{if(!(o as THREE.Mesh).isMesh&&!(o as THREE.LineSegments).isLineSegments)return;hooks.push(o);o.onBeforeRender=()=>{
    if(done)return;const t=now();start??=t;const u=Math.min(1,(t-start)/DETAIL_FADE_MS);
    for(const s of states)s.m.opacity=s.opacity*u*u*(3-2*u);if(u>=1)restore();};});
  activeFades.add(restore);
  return {cancel:restore};
}
