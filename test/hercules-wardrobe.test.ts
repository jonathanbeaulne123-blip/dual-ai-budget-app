import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {AnimationMixer,SkinnedMesh,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {COZY_LOOK,FITTING_ITEMS,FITTING_MANIFEST,FITTING_REACTIONS,canPlayReaction} from '../src/wardrobe/catalogue.ts';
import {fittingDraftKey,loadFittingDraft,parseFittingDraft,saveFittingDraft,fitEdit,fitUndo,fitRedo} from '../src/wardrobe/draft.ts';
import type {LookV1} from '../src/core/herculesCompanionContracts.ts';
const bytes=readFileSync('public/hercules-wardrobe/hercules-cozy.v1.glb');
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
describe('Hercules fitting asset contract',()=>{
 it('ships one shared skin, bone anchors, complete clips, real thumbnails and a verified delivery budget',()=>{
  const manifest=JSON.parse(readFileSync('public/hercules-wardrobe/manifest.json','utf8'));
  const compressed=readFileSync('public/hercules-wardrobe/hercules-cozy.v1.glb.gz');expect(gunzipSync(compressed).equals(bytes)).toBe(true);expect(manifest.compressedBytes).toBe(compressed.length);expect(compressed.length).toBeLessThan(2_000_000);expect(bytes.length).toBeLessThan(8_000_000);expect(manifest.bytes).toBe(bytes.length);
  expect(manifest.outputSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(manifest.sourceSha256).toBe(createHash('sha256').update(readFileSync('models/hercules.source.glb')).digest('hex'));
  expect(json.skins).toHaveLength(1);expect(json.skins[0].joints).toHaveLength(40);
  expect(new Set(json.nodes.filter((n:{skin?:number})=>n.skin!==undefined).map((n:{skin:number})=>n.skin))).toEqual(new Set([0]));
  expect(json.animations.map((a:{name:string})=>a.name).sort()).toEqual(FITTING_REACTIONS.map(r=>r.id).sort());
  for(const item of FITTING_ITEMS)expect(json.nodes.some((n:{name:string})=>n.name===item.node)).toBe(true);
  for(const item of FITTING_MANIFEST.items)expect(readFileSync(`public${item.thumbnailAssetId}`,'utf8')).toContain('<svg');
  expect(json.images??[]).toHaveLength(0);expect(json.buffers.every((b:{uri?:string})=>!b.uri)).toBe(true);
 });
 it('deforms finite bounded vertices through every reaction and keeps rigid pieces on the head',async()=>{
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const head=gltf.scene.getObjectByName('rig_head')!;
  for(const name of ['item_cozy_toque','item_cozy_glasses'])expect(gltf.scene.getObjectByName(name)?.parent).toBe(head);
  const mixer=new AnimationMixer(gltf.scene);const point=new Vector3();
  for(const clip of gltf.animations){
   expect(new Set(clip.tracks.map(t=>t.name)).size).toBe(clip.tracks.length);
   mixer.stopAllAction();mixer.clipAction(clip).reset().play();
   for(const fraction of [0,.28,.65,.95]){
    mixer.setTime(clip.duration*fraction);gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(node=>{if(!(node instanceof SkinnedMesh))return;node.skeleton.update();const position=node.geometry.attributes.position;
     for(let i=0;i<position.count;i+=Math.max(1,Math.floor(position.count/70))){
      point.fromBufferAttribute(position,i);node.applyBoneTransform(i,point);expect(point.toArray().every(Number.isFinite)).toBe(true);expect(point.length()).toBeLessThan(1);
      const weights=node.geometry.attributes.skinWeight;expect(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)).toBeCloseTo(1,5);
     }
    });
   }
  }
 });
 it('plants front and hind paws on a common neutral datum',async()=>{
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const minima=new Map<string,number>();
  gltf.scene.traverse(n=>{if(!(n instanceof SkinnedMesh))return;const p=n.geometry.attributes.position,ids=n.geometry.attributes.skinIndex;for(let i=0;i<p.count;i++){const name=n.skeleton.bones[ids.getX(i)]!.name;if(/frontAnkle|hock/.test(name))minima.set(name,Math.min(minima.get(name)??Infinity,p.getY(i)));}});
  expect(minima.size).toBe(4);expect(Math.max(...minima.values())-Math.min(...minima.values())).toBeLessThan(.001);
 });
 it('the adjusting paw reaches the glasses and the strut alternates its steps',async()=>{
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const mixer=new AnimationMixer(gltf.scene);
  const clip=gltf.animations.find(c=>c.name==='adjust-glasses')!;mixer.clipAction(clip).play();mixer.setTime(clip.duration*.45);gltf.scene.updateMatrixWorld(true);
  const paw=gltf.scene.getObjectByName('rig_frontAnkle_L')!.localToWorld(new Vector3(0,-.014,.015));const temple=gltf.scene.getObjectByName('item_cozy_glasses')!.localToWorld(new Vector3(.05,0,-.007));expect(paw.distanceTo(temple)).toBeLessThan(.01);
  const strut=gltf.animations.find(c=>c.name==='small-strut')!;expect(strut.tracks.find(t=>t.name==='rig_shoulder_L.quaternion')!.times.length).toBeGreaterThan(5);expect(strut.tracks.some(t=>t.name==='rig_hindHip_R.quaternion')).toBe(true);
 });
 it('requires the matching garment for reactions and restores the base after removing it',()=>{
  expect(canPlayReaction('adjust-glasses',COZY_LOOK)).toBe(true);expect(canPlayReaction('check-sleeve',COZY_LOOK)).toBe(true);
  expect(canPlayReaction('admire-cape',COZY_LOOK)).toBe(false);
  expect(canPlayReaction('adjust-glasses',{...COZY_LOOK,selections:{}})).toBe(false);
  expect(canPlayReaction('breathe-blink',{...COZY_LOOK,selections:{}})).toBe(true);
 });
});
describe('local fitting drafts',()=>{
 it('isolates environment, household and member with unambiguous encoded identities',()=>{
  const keys=[fittingDraftKey('development','a:b','c'),fittingDraftKey('development','a','b:c'),fittingDraftKey('production','a:b','c'),fittingDraftKey('development','a:b','d')];expect(new Set(keys).size).toBe(4);
  const rows=new Map<string,string>(),storage={getItem:(k:string)=>rows.get(k)??null,setItem:(k:string,v:string)=>{rows.set(k,v);}};
  const altered={...COZY_LOOK,selections:{}};expect(saveFittingDraft(storage,keys[0]!,altered)).toBe(true);expect(loadFittingDraft(storage,keys[0]!)).toEqual(altered);expect(loadFittingDraft(storage,keys[1]!)).toEqual(COZY_LOOK);
 });
 it('rejects malformed, unknown and oversized drafts and survives unavailable storage honestly',()=>{
  for(const raw of ['{',JSON.stringify({...COZY_LOOK,selections:{head:{itemId:'unknown',variantId:'moss'}}}),'x'.repeat(8001)])expect(parseFittingDraft(raw)).toBeNull();
  const broken={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}};
  expect(loadFittingDraft(broken,'key')).toEqual(COZY_LOOK);expect(saveFittingDraft(broken,'key',COZY_LOOK)).toBe(false);expect(saveFittingDraft(null,'key',COZY_LOOK)).toBe(false);
 });
 it('preserves immutable undo/redo, clears a branched redo and caps retained history',()=>{
  let state={past:[] as LookV1[],present:structuredClone(COZY_LOOK),future:[] as LookV1[]};
  const changed={...COZY_LOOK,selections:{}};state=fitEdit(state,changed);expect(fitUndo(state).present).toEqual(COZY_LOOK);expect(fitRedo(fitUndo(state)).present).toEqual(changed);
  expect(fitEdit(fitUndo(state),{...COZY_LOOK,name:'Another fitting'}).future).toHaveLength(0);
  for(let i=0;i<35;i++)state=fitEdit(state,{...COZY_LOOK,name:`Fitting ${i}`});expect(state.past).toHaveLength(30);expect(COZY_LOOK.selections.head?.variantId).toBe('moss');
 });
});
