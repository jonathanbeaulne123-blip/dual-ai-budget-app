import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {buildDistrictCards,solidTriangle} from '../src/harbour/horizon/runtime/cards.ts';
import {partitionWorldSolids} from '../src/harbour/horizon/world/districts.ts';
import {CardBuilder,rgb} from '../src/harbour/art/cardScene.ts';
import type {WorldDefinition,District} from '../src/harbour/horizon/world/definition.ts';
import type {LandCuts,TerrainField,StructureSolid,XYZ} from '../src/harbour/horizon/land/interfaces.ts';
// Exact v15 source faces: absolute H Float32 collapsed/inverted/steepened these.
const triangles:XYZ[][]=[[[1293.6525895599116,55.40975507853411,731.2864140613311],[1293.644450087493,55.41228735144559,731.2791789958698],[1293.6525809410352,55.40975513543254,731.2864138987642]],[[1290.9229462391506,55.40271693936747,733.6019326307502],[1290.9216693981236,55.40308854254595,733.6008231629439],[1290.922914405127,55.402717106391265,733.601930980804]],[[1290.2456877810384,55.35641091155131,733.6224331836809],[1290.23703678522,55.35228596306883,733.6319205529184],[1290.2456932956238,55.356406129867615,733.6224495285946]],[[1291.7049727676485,55.65085412364115,732.7203119298885],[1291.3306819012603,55.65085412364115,732.4028414076083],[1291.7049695869816,55.65085412364115,732.7203134822901]],[[1290.2123897608496,55.34050275799998,733.6590443033218],[1289.831275613325,55.38658062739209,733.3496118229921],[1290.2123422243699,55.34050275800002,733.6590279498729]],[[1292.160488577879,55.65085412364115,731.4702737346837],[1292.0619596722286,55.65085412364115,731.3833863765032],[1292.0619550078995,55.65085412364115,731.3833862047211]],[[1292.222327879677,55.65085412364115,731.4007764223603],[1292.2088646480581,55.65085412364116,731.3887967239313],[1292.2088260039684,55.65085412364116,731.3887953007122]],[[1285.5229358960278,54.984561841742554,724.1630711334528],[1285.4584338123693,54.96839432294463,724.1127692634966],[1285.5229257016292,54.9845606827015,724.1630831390593]],[[1285.5765389979874,54.990802503357024,724.0999445306352],[1285.5397636948323,54.98118333592481,724.0672215519402],[1285.5397491088618,54.98118099860202,724.0672297206175]],[[1285.5270815800297,54.97786861765602,724.055972197405],[1285.5397491088618,54.98118099860202,724.0672297206175],[1285.5397636948323,54.98118333592481,724.0672215519402]],[[1285.6317901289212,55.012060276085315,724.2503127091078],[1285.5229358960278,54.984561841742554,724.1630711334528],[1285.5229257016292,54.9845606827015,724.1630831390593]],[[1291.659774636315,55.40014982266826,733.5097493185332],[1291.5098353795981,55.40045990384366,733.5484831924947],[1291.6596350457387,55.400150087764594,733.5097881206563]],[[1289.5737852633843,55.65063958911948,732.06062733918],[1289.577377322266,55.65082976088546,732.0665895284786],[1289.5770658323677,55.65085412364115,732.0659513266507]],[[1286.256432839552,55.17420526614271,724.8157429756014],[1286.2555539682583,55.17397803661814,724.8149609484213],[1286.2555717879952,55.17398737821175,724.8150712191779]],[[1286.2555539682583,55.17397803661814,724.8149609484213],[1286.222241365195,55.165556544488936,724.7890682168706],[1286.2555717879952,55.17398737821175,724.8150712191779]]];
// The region origin also inverted this v20 face; the baked logical origin preserves it.
triangles.push([[1287.1086202103306,55.28072724622705,731.1078805107695],[1287.0115343667242,55.25275616135629,731.1594722782448],[1287.011526764146,55.25275355852482,731.1594777806675]]);
const field={revision:'horizon-geo-1',width:2,depth:2,step:1,columns:3,rows:3,heights:new Float32Array(9),surfaces:new Uint8Array(9)} as TerrainField;
const cuts:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
const degrees=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>{const n=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a));return n.y<=0?Infinity:Math.atan2(Math.hypot(n.x,n.z),n.y)*180/Math.PI;};
describe('funicular apron render precision',()=>{
 it.each(['full','lite'] as const)('preserves %s source geometry through the real local Float32 buffer and parent transform',tier=>{
  for(const explicitSource of[true,false]){
   const id='mountainV2.funicularFoot.apron@lakeside',solid={id,renderOrigin:[1286,55,726] as XYZ,...(explicitSource?{sourceId:'mountainV2.funicularFoot.apron'}:{}),surface:'paved',role:'deck',positions:triangles.flat(2),indices:triangles.flatMap((_,i)=>[i*3,i*3+1,i*3+2])} as StructureSolid;
   const district={id:'lakeside',childOf:'harbour',solidIds:[id]} as District,world={geometry:{solids:[solid]}} as unknown as WorldDefinition;
   const before=JSON.stringify(solid),built=buildDistrictCards(world,field,cuts,district,tier),meshes:THREE.Mesh[]=[];built.group.updateMatrixWorld(true);built.group.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
   expect(meshes).toHaveLength(1);const mesh=meshes[0]!,position=mesh.geometry.getAttribute('position');expect(position.count).toBe(triangles.length*3);expect(mesh.castShadow).toBe(true);expect(mesh.receiveShadow).toBe(true);
   const material=mesh.material as THREE.MeshStandardMaterial;expect(material.roughness).toBe(.9);expect(material.side).toBe(THREE.DoubleSide);expect(material.flatShading).toBe(true);expect(Object.values(built.materials)).toContain(material);
   let oldDefects=0;for(let i=0;i<triangles.length;i++){
    const input=triangles[i]!,actual=input.map((_,j)=>new THREE.Vector3().fromBufferAttribute(position,i*3+j).applyMatrix4(mesh.matrixWorld));
    for(let j=0;j<3;j++)expect(actual[j]!.distanceTo(new THREE.Vector3(...input[j]!))).toBeLessThan(3e-6);
    expect(degrees(actual[0]!,actual[1]!,actual[2]!)).toBeLessThanOrEqual(40);
    const old=input.map(p=>new THREE.Vector3(Math.fround(p[0]),Math.fround(p[1]),Math.fround(p[2])));if(degrees(old[0]!,old[1]!,old[2]!)>40)oldDefects++;
   }expect(oldDefects).toBeGreaterThan(0);
   // Exact world normals, shading and paper phase are computed before translation.
   const original=new CardBuilder('comparison',tier,{ink:'#000000',cell:256});for(const t of triangles)solidTriangle(original,t[0]!,t[1]!,t[2]!,rgb('#c9c2b4'));
   const expected=original.finish(),originalMeshes:THREE.Mesh[]=[];expected.group.traverse(o=>{if(o instanceof THREE.Mesh)originalMeshes.push(o);});expect(originalMeshes).toHaveLength(1);
   for(const attr of['normal','uv','color'])expect(Array.from(mesh.geometry.getAttribute(attr).array)).toEqual(Array.from(originalMeshes[0]!.geometry.getAttribute(attr).array));
   expect(JSON.stringify(solid)).toBe(before);let disposed=0;mesh.geometry.addEventListener('dispose',()=>disposed++);built.dispose();built.dispose();expect(disposed).toBe(1);expected.dispose();
  }
 });

 it('retains one baked origin when fragments load independently',()=>{
  const source={id:'mountainV2.funicularFoot.apron',kind:'landing',surface:'paved',role:'deck',districtId:'lakeside',bedIds:['mountainV2.footLane'],walkable:true,renderOrigin:[1286,55,726] as XYZ,
   positions:[1230,55,820,1230,55,821,1231,55,820,1370,55,470,1370,55,471,1371,55,470],indices:[0,1,2,3,4,5]} as StructureSolid;
  const fragments=JSON.parse(JSON.stringify(partitionWorldSolids([source]))) as StructureSolid[];
  expect(fragments.length).toBeGreaterThan(1);
  for(const fragment of fragments){
   expect(fragment.renderOrigin).toEqual(source.renderOrigin);
   for(const resident of[[fragment],fragments]){
    const district={id:fragment.districtId,childOf:'harbour',solidIds:[fragment.id]} as District;
    const built=buildDistrictCards({geometry:{solids:resident}} as WorldDefinition,field,cuts,district,'full');built.group.updateMatrixWorld(true);
    let meshes=0;built.group.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;expect(o.matrixWorld.elements.slice(12,15)).toEqual(source.renderOrigin);}});
    expect(meshes).toBe(1);built.dispose();
   }
  }
 });
 it('rejects a missing or conflicting logical origin before publishing cards',()=>{
  const id='mountainV2.funicularFoot.apron@lakeside',part={id,sourceId:'mountainV2.funicularFoot.apron',surface:'paved',role:'deck',positions:triangles[0]!.flat(),indices:[0,1,2]} as StructureSolid;
  const build=(solids:StructureSolid[])=>buildDistrictCards({geometry:{solids}} as WorldDefinition,field,cuts,{id:'lakeside',childOf:'harbour',solidIds:solids.map(s=>s.id)} as District,'full');
  expect(()=>build([part])).toThrow('baked logical render origin');
  expect(()=>build([{...part,renderOrigin:[1286,55,726]},{...part,id:id+'.other',renderOrigin:[1287,55,726]}])).toThrow('disagree');
 });
 it('keeps ordinary card vertices in their existing world frame',()=>{
  const b=new CardBuilder('ordinary','full',{ink:'#000000'}),t=triangles[0]!;solidTriangle(b,t[0]!,t[1]!,t[2]!,[1,1,1]);expect(b.at(t[0]![0],t[0]![2]).data.card.positions).toEqual(t.flat());
 });
});
