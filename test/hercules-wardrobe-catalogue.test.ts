import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {AnimationMixer,SkinnedMesh,Vector3,Raycaster} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FITTING_ITEMS,FITTING_MANIFEST,COZY_LOOK,COLLECTION_LOOKS,canPlayReaction} from '../src/wardrobe/catalogue.ts';
import {pieceDrawing} from '../src/wardrobe/glyphs.ts';
import {decodeLook,COMPANION_SLOTS} from '../src/core/herculesCompanionContracts.ts';
import {attachCollection,disposeAsset} from '../src/wardrobe/collectionLoader.ts';
import {fitSelection,shuffleLook} from '../src/wardrobe/lookTools.ts';
import {validateLookForWear} from '../src/core/herculesCompanionContracts.ts';
import {unlockedCosmetics,COSMETICS} from '../src/core/companion.ts';
import {catalogHousehold} from '../src/core/index.ts';
const parse=async(path:string)=>{const b=readFileSync(path);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
describe('Complete original wardrobe catalogue',()=>{
 // 2026-09-11: three collections (Hearth after dark, Garden Sunday, Snow day) and the tail slot raised 36 new + 12 legacy = 48 to 54 + 12 = 66.
 it('provides exactly 54 new pieces, 12 legacy pieces and real distinct artwork',()=>{
  expect(FITTING_ITEMS.filter(i=>!i.legacy)).toHaveLength(54);expect(FITTING_ITEMS.filter(i=>i.legacy)).toHaveLength(12);expect(new Set(FITTING_ITEMS.map(i=>i.id)).size).toBe(66);
  for(const collection of ['cozy','office','rain','applause','kitchen','sunday','night','garden','snow'])expect(FITTING_ITEMS.filter(i=>i.collection===collection)).toHaveLength(6);
  expect(new Set(FITTING_ITEMS.filter(i=>!i.legacy).map(i=>readFileSync(`public/hercules-wardrobe/${i.id}.svg`,'utf8'))).size).toBe(54);
  expect(new Set(FITTING_ITEMS.map(i=>pieceDrawing(i.shape))).size).toBe(new Set(FITTING_ITEMS.map(i=>i.shape)).size);
  for(const item of FITTING_ITEMS.filter(i=>!i.legacy))expect(item.variants.length,item.id).toBeGreaterThanOrEqual(3);
  expect(FITTING_ITEMS.filter(i=>i.slot==='tail').map(i=>i.id)).toEqual(['night-ribbon','garden-tail','snow-bell']);
  for(const item of FITTING_MANIFEST.items){expect(readFileSync(`public${item.thumbnailAssetId}`,'utf8')).toContain('<svg');expect(Object.values(item.poseLayerAssetIds)).toEqual([item.id,item.id,item.id]);}
  expect(unlockedCosmetics(catalogHousehold(),'2026-09-10')).toEqual(COSMETICS);
 });
 it('loads only small collection extensions and fits all their meshes to the same live skeleton across every clip',async()=>{
  const base=await parse('public/hercules-wardrobe/hercules-cozy.v1.glb');let shared:SkinnedMesh|undefined;base.scene.traverse(n=>{if(n instanceof SkinnedMesh&&!shared)shared=n;});
  const manifest=JSON.parse(readFileSync('public/hercules-wardrobe/collections.json','utf8'));
  for(const pack of manifest.collections){const bytes=readFileSync(`public/hercules-wardrobe/${pack.collection}.v1.glb`),compressed=readFileSync(`public/hercules-wardrobe/${pack.collection}.v1.glb.gz`);expect(gunzipSync(compressed).equals(bytes)).toBe(true);expect(pack.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));expect(compressed.length).toBeLessThan(300_000);const asset=await parse(`public/hercules-wardrobe/${pack.collection}.v1.glb`);expect(asset.scene.getObjectByName('coat_furWhite')).toBeUndefined();attachCollection(base.scene,asset.scene,`/hercules-wardrobe/${pack.collection}.v1.glb`);disposeAsset(asset.scene);}
  for(const item of FITTING_ITEMS){const node=base.scene.getObjectByName(item.node)!;expect(node,item.id).toBeDefined();if(['head','eyewear'].includes(item.slot))expect(node.parent?.name).toBe('rig_head');node.traverse(n=>{if(n instanceof SkinnedMesh)expect(n.skeleton).toBe(shared!.skeleton);});}
  expect(manifest.collections.map((c:{collection:string})=>c.collection)).toEqual(['cozy','office','rain','applause','kitchen','sunday','night','garden','snow','legacy']);
  base.scene.updateMatrixWorld(true);shared!.skeleton.update();
  // Tail pieces are skinned entirely to rig_tail_04 and sit on the tail, not the body.
  const tailIndex=shared!.skeleton.bones.findIndex(b=>b.name==='rig_tail_04'),tailAt=base.scene.getObjectByName('rig_tail_04')!.getWorldPosition(new Vector3());
  for(const item of FITTING_ITEMS.filter(i=>i.slot==='tail')){let meshes=0;base.scene.getObjectByName(item.node)!.traverse(n=>{if(!(n instanceof SkinnedMesh))return;meshes++;const idx=n.geometry.attributes.skinIndex,w=n.geometry.attributes.skinWeight,p=n.geometry.attributes.position,point=new Vector3();for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/40))){expect(idx.getX(i),item.id).toBe(tailIndex);expect(w.getX(i)).toBeCloseTo(1,5);point.fromBufferAttribute(p,i);expect(point.distanceTo(tailAt),`${item.id} near the tail`).toBeLessThan(.11);}});expect(meshes,item.id).toBeGreaterThan(0);}
  // New garments keep the same shoulder binding and front clearance rules as the first six collections.
  for(const [outer,accessory,y] of [['night-robe','night-moon',.293],['garden-jacket','garden-collar',.345],['garden-jacket','garden-seeds',.279],['snow-vest','snow-flake',.279]] as const){const ray=new Raycaster(new Vector3(0,y,.5),new Vector3(0,0,-1));const front=ray.intersectObject(base.scene.getObjectByName(FITTING_ITEMS.find(p=>p.id===accessory)!.node)!,true),coat=ray.intersectObject(base.scene.getObjectByName(FITTING_ITEMS.find(p=>p.id===outer)!.node)!,true);expect(front.length,accessory).toBeGreaterThan(0);expect(coat.length,outer).toBeGreaterThan(0);expect(front[0]!.distance,accessory).toBeLessThan(coat[0]!.distance);}
  for(const id of ['night-cap','garden-hat','snow-hat','night-mask','snow-goggles'])expect(base.scene.getObjectByName(FITTING_ITEMS.find(p=>p.id===id)!.node)!.parent?.name,id).toBe('rig_head');
  for(const [outer,accessory,y] of [['rain-coat','rain-neckerchief',.305],['rain-coat','rain-puffin',.279],['office-jacket','office-tie',.305],['office-jacket','office-watch',.279]] as const){const ray=new Raycaster(new Vector3(0,y,.5),new Vector3(0,0,-1));const front=ray.intersectObject(base.scene.getObjectByName(FITTING_ITEMS.find(p=>p.id===accessory)!.node)!,true),coat=ray.intersectObject(base.scene.getObjectByName(FITTING_ITEMS.find(p=>p.id===outer)!.node)!,true);expect(front.length,accessory).toBeGreaterThan(0);expect(coat.length,outer).toBeGreaterThan(0);expect(front[0]!.distance,accessory).toBeLessThan(coat[0]!.distance);}
  // The cape stays outside the uncovered torso while its front and tail opening remain free.
  const torso:SkinnedMesh[]=[];base.scene.traverse(n=>{if(n instanceof SkinnedMesh&&n.name.startsWith('torso_'))torso.push(n);});
  for(const y of [.22,.26,.29])for(const x of [-.05,0,.05]){const ray=new Raycaster(new Vector3(x,y,-.6),new Vector3(0,0,1));const cloth=ray.intersectObject(base.scene.getObjectByName('item_applause_cape')!,true),fur=ray.intersectObjects(torso,false);if(fur.length){expect(cloth.length).toBeGreaterThan(0);expect(cloth[0]!.distance,`cape back ${x}/${y}`).toBeLessThan(fur[0]!.distance);}}
  const mixer=new AnimationMixer(base.scene),point=new Vector3();
  for(const clip of base.animations){mixer.stopAllAction();mixer.clipAction(clip).play();for(const fraction of [.28,.65]){mixer.setTime(clip.duration*fraction);base.scene.updateMatrixWorld(true);shared!.skeleton.update();for(const item of FITTING_ITEMS){base.scene.getObjectByName(item.node)!.traverse(n=>{if(!(n instanceof SkinnedMesh))return;const p=n.geometry.attributes.position;for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/12))){point.fromBufferAttribute(p,i);n.applyBoneTransform(i,point);expect(point.toArray().every(Number.isFinite),`${item.id}/${clip.name}`).toBe(true);expect(point.length(),`${item.id}/${clip.name}`).toBeLessThan(.9);}});}}}
  disposeAsset(base.scene);
 });
 it('explains exclusions, preserves locked pieces and gates actual garment reactions',()=>{
  const result=fitSelection(COZY_LOOK,'outerwear',{itemId:'office-jacket',variantId:'ink'});expect(result.replaced).toEqual(['Cable-knit sweater']);expect(result.look.selections.body).toBeUndefined();expect(()=>validateLookForWear(result.look,FITTING_MANIFEST)).not.toThrow();
  const cape=fitSelection(COZY_LOOK,'outerwear',{itemId:'applause-cape',variantId:'plum'}).look;expect(cape.selections.body).toEqual(COZY_LOOK.selections.body);expect(canPlayReaction('admire-cape',cape)).toBe(true);expect(canPlayReaction('admire-cape',result.look)).toBe(false);expect(canPlayReaction('check-sleeve',{...COZY_LOOK,selections:{body:{itemId:'sunday-vest',variantId:'oat'}}})).toBe(false);
  for(let i=0;i<20;i++){const shuffled=shuffleLook(COZY_LOOK,['head','body']);expect(shuffled.selections.head).toEqual(COZY_LOOK.selections.head);expect(shuffled.selections.body).toEqual(COZY_LOOK.selections.body);expect(()=>validateLookForWear(shuffled,FITTING_MANIFEST)).not.toThrow();}
  Object.values(COLLECTION_LOOKS).forEach(look=>expect(()=>validateLookForWear(look,FITTING_MANIFEST)).not.toThrow());expect(FITTING_ITEMS.find(i=>i.id==='office-visor')!.hiddenBodyRegions).toEqual([]);
  // The puffer vest layers over a fleece; the robe replaces a body piece; a tail piece never displaces anything.
  const vest=fitSelection({...COZY_LOOK,selections:{body:{itemId:'snow-fleece',variantId:'frost'}}},'outerwear',{itemId:'snow-vest',variantId:'navy'});expect(vest.replaced).toEqual([]);expect(vest.look.selections.body?.itemId).toBe('snow-fleece');
  expect(fitSelection(COZY_LOOK,'outerwear',{itemId:'night-robe',variantId:'plum'}).replaced).toEqual(['Cable-knit sweater']);
  const tail=fitSelection(COLLECTION_LOOKS.snow!,'tail',{itemId:'night-ribbon',variantId:'cream'});expect(tail.replaced).toEqual([]);expect(Object.keys(tail.look.selections)).toContain('tail');expect(()=>validateLookForWear(tail.look,FITTING_MANIFEST)).not.toThrow();
  for(const c of ['night','garden','snow'])expect(Object.keys(COLLECTION_LOOKS[c]!.selections)).toContain('tail');
 });
 it('keeps the widened tail slot additive: old looks decode unchanged and unknown slots are still refused',()=>{
  expect(COMPANION_SLOTS).toEqual(['head','eyewear','neckwear','body','outerwear','charm','tail']);
  const old={version:1,id:'old-look',name:'Before tails',catalogueVersion:1,selections:{head:{itemId:'cozy-toque',variantId:'moss'}}};
  expect(decodeLook(structuredClone(old))).toEqual(old);expect(()=>validateLookForWear(old,FITTING_MANIFEST)).not.toThrow();
  expect(decodeLook({...old,selections:{...old.selections,tail:{itemId:'snow-bell',variantId:'cherry'}}}).selections.tail).toEqual({itemId:'snow-bell',variantId:'cherry'});
  expect(()=>decodeLook({...old,selections:{...old.selections,paws:{itemId:'x',variantId:'y'}}})).toThrow('UNEXPECTED_FIELD');
  expect(()=>validateLookForWear({...old,selections:{tail:{itemId:'cozy-toque',variantId:'moss'}}},FITTING_MANIFEST)).toThrow('INCOMPATIBLE_COSMETIC');
  for(let i=0;i<10;i++){const look=shuffleLook(COZY_LOOK,[]);expect(()=>validateLookForWear(look,FITTING_MANIFEST)).not.toThrow();}
  expect(Array.from({length:40},()=>shuffleLook(COZY_LOOK,[])).some(l=>l.selections.tail)).toBe(true);
 });
});
