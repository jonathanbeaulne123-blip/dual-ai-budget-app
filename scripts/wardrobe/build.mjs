/** Reproducible original garment authoring + reduction of Hearth's own canonical stage export. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
class Reader { readAsArrayBuffer(blob) { blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();}); } readAsDataURL(blob) { blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();}); } }
globalThis.FileReader = Reader;
const root = new URL('../../',import.meta.url), output = new URL('public/hercules-wardrobe/',root);
const bytes = await readFile(new URL('models/hercules.source.glb',root));
const source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
source.updateMatrixWorld(true);
const scene = new T.Scene(); scene.name='HerculesFittingV1';
const rig = new T.Group(); rig.name='Hercules'; scene.add(rig);
const originals=[]; source.traverse(n=>{if(n.name.startsWith('rig_'))originals.push(n);});
const bones=originals.map(n=>{const b=new T.Bone();b.name=n.name;return b;});
const byName=new Map(bones.map(b=>[b.name,b]));
for(let i=0;i<bones.length;i++) {
 const n=originals[i], bone=bones[i]; let parent=n.parent;while(parent&&!byName.has(parent.name))parent=parent.parent;
 const matrix=n.matrixWorld.clone();if(parent)matrix.premultiply(parent.matrixWorld.clone().invert());
 matrix.decompose(bone.position,bone.quaternion,bone.scale);(parent?byName.get(parent.name):rig).add(bone);
}
rig.updateMatrixWorld(true); const skeleton=new T.Skeleton(bones); skeleton.calculateInverses();
const index=name=>bones.findIndex(b=>b.name===name);
const buckets=new Map(), materials=new Map();let sourceMeshes=0;
function weights(g,boneName,soft=false) {
 const p=g.attributes.position, ids=[], values=[];
 for(let i=0;i<p.count;i++) {
  const y=p.getY(i);let a=boneName,b=boneName,t=0;
  if(soft){ if(y<.22){a='rig_hips';b='rig_spine';t=T.MathUtils.clamp((y-.13)/.09,0,1);}else{a='rig_spine';b='rig_chest';t=T.MathUtils.clamp((y-.22)/.10,0,1);} }
  ids.push(index(a),index(b),0,0);values.push(1-t,t,0,0);
 }
 g.setAttribute('skinIndex',new T.Uint8BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Uint8BufferAttribute(values.map((value,i)=>i%4===1?255-Math.round(values[i-1]*255):Math.round(value*255)),4,true));return g;
}
function clean(g){for(const name of Object.keys(g.attributes))if(!['position','normal'].includes(name))g.deleteAttribute(name);if(!g.attributes.normal)g.computeVertexNormals();return g.index?g.toNonIndexed():g;}
function bucket(name,g,mat){if(!buckets.has(name))buckets.set(name,[]);buckets.get(name).push(g);materials.set(name,mat);}
source.traverse(n=>{
 if(!n.isMesh)return;sourceMeshes++;let ancestor=n;while(ancestor&&!byName.has(ancestor.name))ancestor=ancestor.parent;
 const boneName=ancestor?.name??'rig_root', torso=['rig_hips','rig_spine','rig_chest'].includes(boneName);
 // Reduce and shorten the source coat cards deterministically; preserve the authored anatomical hulls.
 if(n.name.startsWith('fur_')&&sourceMeshes%3!==0)return;
 const originalGeometry=n.geometry.clone();if(n.name.startsWith('fur_'))originalGeometry.scale(.48,.46,.48);const g=clean(originalGeometry.applyMatrix4(n.matrixWorld)); const p=g.attributes.position;
 const regions={coat:[],torso:[],crown:[]};
 for(let i=0;i<p.count;i+=3){const y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;regions[y>.477&&/head|ear|tuft/.test(boneName)?'crown':torso&&y>.135&&y<.36?'torso':'coat'].push(i,i+1,i+2);}
 for(const [region,indices] of Object.entries(regions)){
  if(!indices.length)continue; const small=new T.BufferGeometry();
  for(const name of ['position','normal']){const attr=g.attributes[name];small.setAttribute(name,new T.Float32BufferAttribute(indices.flatMap(i=>[attr.getX(i),attr.getY(i),attr.getZ(i)]),3));}
  const material=n.material.clone();material.name=n.material.name;material.roughness=.87;
  if(material.name==='furWhite')material.color.set('#f3ede0');if(material.name==='furTan')material.color.set('#c6a680');
  bucket(`${region}_${material.name}`,weights(small,boneName,torso),material);
 }
});
function skin(name,g,mat){const merged=mergeVertices(g,1e-5);merged.setAttribute('normal',new T.Int16BufferAttribute(Array.from(merged.attributes.normal.array,value=>Math.round(value*32767)),3,true));const mesh=new T.SkinnedMesh(merged,mat);mesh.name=name;rig.add(mesh);mesh.bind(skeleton,new T.Matrix4());mesh.frustumCulled=false;return mesh;}
for(const [name,geometries] of buckets)skin(name,mergeGeometries(geometries),materials.get(name));
const wool=new T.MeshStandardMaterial({name:'cozy_sweater',color:'#bcb59b',roughness:1});
const hatMat=new T.MeshStandardMaterial({name:'cozy_toque',color:'#bcb59b',roughness:1});
const metal=new T.MeshStandardMaterial({name:'cozy_glasses',color:'#b89a53',metalness:.72,roughness:.3});
const garmentParts=[];
const rings=[[.137,.11,.148,-.07],[.155,.119,.158,-.06],[.19,.12,.155,-.04],[.225,.116,.15,-.018],[.26,.11,.143,.004],[.29,.107,.137,.025],[.325,.099,.12,.045],[.352,.077,.095,.055]];
const positions=[],uv=[],indices=[];const steps=56;
for(let row=0;row<rings.length;row++){const [y,rx,rz,z]=rings[row];for(let j=0;j<=steps;j++){const a=j/steps*Math.PI*2;const rib=1+.012*Math.cos(a*28);positions.push(Math.cos(a)*rx*rib,y,z+Math.sin(a)*rz*rib);uv.push(j/steps,row/(rings.length-1));if(row<rings.length-1&&j<steps){const i=row*(steps+1)+j;indices.push(i,i+steps+1,i+1,i+1,i+steps+1,i+steps+2);}}}
const shell=new T.BufferGeometry();shell.setAttribute('position',new T.Float32BufferAttribute(positions,3));shell.setIndex(indices);shell.computeVertexNormals();garmentParts.push(weights(clean(shell),'rig_chest',true));
function tube(points,radius=.002,segments=32){return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,radius,5,false);}
// Braided cable columns use real relief geometry, including the back of the garment.
for(let column=0;column<16;column++)for(const phase of [0,Math.PI]){
 const points=[];for(let j=0;j<=32;j++){const t=j/32;const y=.15+t*.19;const a=column/16*Math.PI*2+.024*Math.sin(t*10*Math.PI+phase);const k=t*(rings.length-2)+1;const low=Math.floor(k),high=Math.min(rings.length-1,low+1),f=k-low;const r=rings[low].map((v,i)=>T.MathUtils.lerp(v,rings[high][i],f));points.push([Math.cos(a)*(r[1]+.003),y,r[3]+Math.sin(a)*(r[2]+.003)]);}
 garmentParts.push(weights(clean(tube(points,.002)),'rig_chest',true));
}
for(const [y,rx,rz,z] of [rings[0],rings.at(-1)]){const points=Array.from({length:65},(_,j)=>[Math.cos(j/64*Math.PI*2)*rx,y,z+Math.sin(j/64*Math.PI*2)*rz]);garmentParts.push(weights(clean(tube(points,.006,64)),'rig_chest',true));}
// Sleeves follow the same shoulders as the existing front legs, with open ribbed cuffs.
for(const side of ['L','R']){const sign=side==='L'?1:-1;const sleeve=new T.CylinderGeometry(.049,.038,.095,24,5,true);sleeve.translate(sign*.052,.247,.095);garmentParts.push(weights(clean(sleeve),`rig_shoulder_${side}`));const cuff=new T.TorusGeometry(.037,.004,5,24);cuff.rotateX(Math.PI/2);cuff.translate(sign*.052,.198,.095);garmentParts.push(weights(clean(cuff),`rig_shoulder_${side}`));}
skin('item_cozy_sweater',mergeGeometries(garmentParts),wool);
function anchor(name,position){const a=new T.Group();a.name=name;byName.get('rig_head').add(a);rig.updateMatrixWorld(true);a.position.copy(byName.get('rig_head').worldToLocal(new T.Vector3(...position)));return a;}
const hat=anchor('item_cozy_toque',[0,.478,.066]);
const hatGeometry=new T.SphereGeometry(.064,32,18,0,Math.PI*2,0,Math.PI*.5);hatGeometry.scale(1,.85,.84);hat.add(new T.Mesh(hatGeometry,hatMat));
const brim=new T.Mesh(new T.TorusGeometry(.06,.009,8,40),hatMat);brim.rotation.x=Math.PI/2;hat.add(brim);
const pom=new T.Mesh(new T.SphereGeometry(.019,12,10),hatMat);pom.position.y=.066;hat.add(pom);
for(let j=0;j<20;j++){const a=j/20*Math.PI*2;const points=Array.from({length:10},(_,k)=>{const t=k/9*Math.PI/2;return [Math.cos(a)*.064*Math.cos(t),.055*Math.sin(t),Math.sin(a)*.054*Math.cos(t)];});hat.add(new T.Mesh(tube(points,.0014,12),hatMat));}
const glasses=anchor('item_cozy_glasses',[0,.431,.14]);
for(const x of [-.031,.027]){const ring=new T.Mesh(new T.TorusGeometry(.022,.0024,6,32),metal);ring.position.x=x;glasses.add(ring);const arm=new T.Mesh(new T.CylinderGeometry(.0016,.0016,.069,5),metal);arm.rotation.x=Math.PI/2;arm.position.set(x<0?-.052:.049,0,-.034);glasses.add(arm);}
glasses.add(new T.Mesh(tube([[-.009,0,0],[-.002,.006,0],[.005,0,0]],.0018,10),metal));
// Consolidate rigid accessories into one draw call each, while retaining named bone anchors.
for(const group of [hat,glasses]){group.updateMatrixWorld(true);const parts=[];group.traverse(n=>{if(n.isMesh){n.updateMatrix();parts.push(clean(n.geometry.clone().applyMatrix4(n.matrix)));}});group.clear();group.add(new T.Mesh(mergeVertices(mergeGeometries(parts)),group===hat?hatMat:metal));}
// The stage source's front paws sit 50 mm above its hind paws. Correct the delivery
// bind pose without stretching limbs: translate shoulder subtrees AND their vertices.
const forelegDrop=.0500323437154293;
rig.updateMatrixWorld(true);
for(const side of ['L','R']){const bone=byName.get(`rig_shoulder_${side}`),world=bone.getWorldPosition(new T.Vector3());world.y-=forelegDrop;bone.position.copy(bone.parent.worldToLocal(world));}
const forelegJoints=new Set(bones.flatMap((bone,i)=>/^rig_(shoulder_|frontKnee_|frontAnkle_)/.test(bone.name)?[i]:[]));
rig.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const g=mesh.geometry,p=g.attributes.position,ids=g.attributes.skinIndex,w=g.attributes.skinWeight;for(let i=0;i<p.count;i++){let weight=0;for(let c=0;c<4;c++)if(forelegJoints.has(ids.getComponent(i,c)))weight+=w.getComponent(i,c);p.setY(i,p.getY(i)-forelegDrop*weight);}g.computeBoundingBox();g.computeBoundingSphere();});
rig.updateMatrixWorld(true);skeleton.calculateInverses();
const rest=new Map(bones.map(b=>[b.name,{q:b.quaternion.clone(),p:b.position.clone(),s:b.scale.clone()}]));
function clip(name,changes,duration=3){const tracks=[];const rotations=new Map();for(const [bone,axis,amount] of changes){const r=rest.get(bone);if(!r)throw Error(bone);const times=[0,duration*.28,duration*.65,duration];if(axis==='blink'){const shut=r.q.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),1.5));const blinkTimes=(name==='breathe-blink'?[0,.62,.65,.69,.72,1]:[0,.18,.45,.6,.9,1]).map(t=>t*duration);tracks.push(new T.QuaternionKeyframeTrack(`${bone}.quaternion`,blinkTimes,[...r.q.toArray(),...r.q.toArray(),...shut.toArray(),...shut.toArray(),...r.q.toArray(),...r.q.toArray()]));}else if(axis==='y'){tracks.push(new T.VectorKeyframeTrack(`${bone}.position`,times,[...r.p.toArray(),r.p.x,r.p.y+amount,r.p.z,r.p.x,r.p.y+amount,r.p.z,...r.p.toArray()]));}else{const v=axis==='rx'?new T.Vector3(1,0,0):axis==='ry'?new T.Vector3(0,1,0):new T.Vector3(0,0,1);const q=rotations.get(bone)??r.q.clone();q.multiply(new T.Quaternion().setFromAxisAngle(v,amount));rotations.set(bone,q);}}for(const [bone,q] of rotations){const r=rest.get(bone),times=[0,duration*.28,duration*.65,duration];tracks.push(new T.QuaternionKeyframeTrack(`${bone}.quaternion`,times,[...r.q.toArray(),...q.toArray(),...q.toArray(),...r.q.toArray()]));}return new T.AnimationClip(name,duration,tracks);}
// Two alternating, in-place steps; a fitting platform does not translate the cat away.
function strutClip(){
 const times=[0,.35,.7,1.05,1.4,1.75,2.1,2.45,2.8],tracks=[];
 for(const [name,amplitude,phase] of [['rig_shoulder_L',.15,1],['rig_shoulder_R',.15,-1],['rig_hindHip_L',.09,-1],['rig_hindHip_R',.09,1],['rig_frontKnee_L',.09,1],['rig_frontKnee_R',.09,-1],['rig_head',.035,1]]){
  const q=rest.get(name).q,axis=new T.Vector3(1,0,0);tracks.push(new T.QuaternionKeyframeTrack(`${name}.quaternion`,times,times.flatMap(t=>q.clone().multiply(new T.Quaternion().setFromAxisAngle(axis,Math.sin(t/2.8*Math.PI*4)*amplitude*phase)).toArray())));
 }
 const p=rest.get('rig_root').p;tracks.push(new T.VectorKeyframeTrack('rig_root.position',times,times.flatMap(t=>[p.x,p.y+Math.abs(Math.sin(t/2.8*Math.PI*4))*.004,p.z])));
 return new T.AnimationClip('small-strut',2.8,tracks);
}
const clips=[
 clip('breathe-blink',[['rig_chest','y',.003],['rig_eyelid_L','blink',0],['rig_eyelid_R','blink',0]],5),
 clip('head-tilt',[['rig_head','rz',.15],['rig_ear_R','rx',-.1]]),
 clip('ear-perk',[['rig_ear_L','rx',-.15],['rig_ear_R','rx',-.15]],2),
 clip('slow-blink',[['rig_eyelid_L','blink',0],['rig_eyelid_R','blink',0],['rig_head','rx',.035]],3.5),
 clip('pleased',[['rig_chest','rx',-.045],['rig_head','rx',-.06],['rig_tail_04','ry',.11]]),
 strutClip(),
 clip('over-shoulder',[['rig_neck','ry',.13],['rig_head','ry',.35]]),
 clip('inspect-mirror',[['rig_head','ry',-.22],['rig_head','rz',-.07],['rig_tail_06','ry',-.09]]),
 clip('adjust-glasses',[['rig_shoulder_L','rx',-2.15],['rig_frontKnee_L','rx',-.7875],['rig_head','rx',.13]]),
 clip('check-sleeve',[['rig_head','rx',.13],['rig_head','ry',-.18],['rig_shoulder_R','rx',-.13]]),
 clip('admire-cape',[['rig_head','ry',.28],['rig_spine','ry',.07],['rig_tail_03','ry',-.12]]),
 clip('portrait-pose',[['rig_head','rz',-.08],['rig_neck','rx',-.035],['rig_ear_L','rx',-.07]],4),
];
scene.updateMatrixWorld(true);
let glb=await new GLTFExporter().parseAsync(scene,{binary:true,animations:clips,trs:true,copyright:'Hearth. Canonical source geometry + original garment and animation authoring.'});
// Exporter emits one identical skin per mesh. Canonicalize the shared joint palette to one glTF skin.
const packed=Buffer.from(glb), oldJsonLength=packed.readUInt32LE(12), metadata=JSON.parse(packed.subarray(20,20+oldJsonLength).toString());
const first=metadata.skins[0];if(!metadata.skins.every(s=>JSON.stringify(s.joints)===JSON.stringify(first.joints)))throw Error('Multiple joint palettes');
metadata.skins=[first];for(const node of metadata.nodes)if(node.skin!==undefined)node.skin=0;
const encoded=Buffer.from(JSON.stringify(metadata)), padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);encoded.copy(padded);
const tail=packed.subarray(20+oldJsonLength);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+tail.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);glb=Buffer.concat([header,padded,tail]);
await mkdir(output,{recursive:true});await writeFile(new URL('hercules-cozy.v1.glb',output),Buffer.from(glb));
const compressed=gzipSync(glb,{level:9});await writeFile(new URL('hercules-cozy.v1.glb.gz',output),compressed);
const json=JSON.parse(Buffer.from(glb).subarray(20,20+Buffer.from(glb).readUInt32LE(12)).toString());
const report={version:1,source:'models/hercules.source.glb',sourceSha256:createHash('sha256').update(bytes).digest('hex'),outputSha256:createHash('sha256').update(Buffer.from(glb)).digest('hex'),bytes:glb.byteLength,compressedBytes:compressed.byteLength,compressedSha256:createHash('sha256').update(compressed).digest('hex'),sourceMeshes,nodes:json.nodes.length,meshes:json.meshes.length,skins:json.skins.length,bones:bones.length,clips:clips.map(c=>({name:c.name,duration:c.duration})),forelegBindDrop:forelegDrop,rigidAnchors:['item_cozy_toque','item_cozy_glasses'],occludedRegions:['torso','crown'],provenance:'Hearth canonical stage export; original deterministic knit, hat, glasses and animation source in scripts/wardrobe/build.mjs. No external images or household data.'};
await writeFile(new URL('manifest.json',output),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
await import('./thumbnails.mjs');
