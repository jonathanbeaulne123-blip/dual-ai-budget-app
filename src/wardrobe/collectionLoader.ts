import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FITTING_ITEMS} from './catalogue.ts';
export async function readWardrobeAsset(url:string,signal:AbortSignal){
 const compressed=typeof DecompressionStream!=='undefined',response=await fetch(url+(compressed?'.gz':''),{signal});
 if(!response.ok)throw new Error('Wardrobe asset unavailable');let bytes=await response.arrayBuffer();
 if(compressed&&new Uint8Array(bytes)[0]===31&&new Uint8Array(bytes)[1]===139)bytes=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 if(signal.aborted)throw new DOMException('Closed','AbortError');return bytes;
}
export function disposeAsset(root:T.Object3D){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),skeletons=new Set<T.Skeleton>();root.traverse(n=>{if(n instanceof T.SkinnedMesh)skeletons.add(n.skeleton);if(n instanceof T.Mesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);}});skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
/** Collection nodes use the exact same world bind coordinates and one live skeleton. */
export function attachCollection(model:T.Group,asset:T.Group,url:string){
 let skeleton:T.Skeleton|undefined;model.traverse(n=>{if(n instanceof T.SkinnedMesh&&!skeleton)skeleton=n.skeleton;});if(!skeleton)throw new Error('Fitting rig missing');
 const temporary=new Set<T.Skeleton>();asset.traverse(n=>{if(n instanceof T.SkinnedMesh){temporary.add(n.skeleton);if(n.skeleton.bones.length!==skeleton!.bones.length||n.skeleton.bones.some((b,i)=>b.name!==skeleton!.bones[i]!.name)||n.skeleton.boneInverses.some((m,i)=>m.elements.some((v,k)=>Math.abs(v-skeleton!.boneInverses[i]!.elements[k]!)>1e-5)))throw new Error('Incompatible fitting rig');}});
 const nodes=FITTING_ITEMS.filter(item=>item.asset===url).map(item=>{const node=asset.getObjectByName(item.node);if(!node)throw new Error('Missing fitting piece');return node;});
 for(const node of nodes){const parent=model.getObjectByName(node.parent!.name);if(!parent)throw new Error('Missing fitting anchor');node.visible=false;parent.add(node);node.traverse(n=>{if(n instanceof T.SkinnedMesh){n.bind(skeleton!,new T.Matrix4());n.frustumCulled=false;}});}
 temporary.forEach(s=>s.dispose());
}
export async function loadCollection(model:T.Group,url:string,signal:AbortSignal){const bytes=await readWardrobeAsset(url,signal),asset=(await new GLTFLoader().parseAsync(bytes,'')).scene;try{if(signal.aborted)throw new DOMException('Closed','AbortError');attachCollection(model,asset,url);}finally{disposeAsset(asset);}}
