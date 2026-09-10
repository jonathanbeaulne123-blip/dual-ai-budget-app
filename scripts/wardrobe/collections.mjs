/** Original deterministic garment construction. Each recipe has its own silhouette and trim. */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {FITTING_ITEMS,WARDROBE_ASSET,fittingColour} from '../../src/wardrobe/catalogue.ts';
class Reader{readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}}
globalThis.FileReader=Reader;
const output=new URL('../../public/hercules-wardrobe/',import.meta.url),base=await readFile(new URL('hercules-cozy.v1.glb',output));
const reports=[];
for(const collection of ['cozy','office','rain','applause','kitchen','sunday','legacy']){
 const loaded=await new GLTFLoader().parseAsync(base.buffer.slice(base.byteOffset,base.byteOffset+base.byteLength),'');const scene=loaded.scene;let skeleton;scene.traverse(n=>{if(n.isSkinnedMesh&&!skeleton)skeleton=n.skeleton;});const bones=skeleton.bones,rig=scene.getObjectByName('Hercules'),head=scene.getObjectByName('rig_head');
 const remove=[];scene.traverse(n=>{if(n.isMesh||n.name.startsWith('item_'))remove.push(n);});remove.forEach(n=>n.removeFromParent());scene.updateMatrixWorld(true);
 const joint=name=>bones.findIndex(b=>b.name===name),groups=[];
 for(const item of FITTING_ITEMS.filter(p=>p.collection===collection&&p.asset!==WARDROBE_ASSET)){
  const tint=new T.MeshStandardMaterial({name:`tint_${item.id}`,color:fittingColour(item.variants[0],item.id),roughness:['raincoat','sequin','silk','tie'].includes(item.shape)?.38:.86,metalness:item.slot==='charm'||item.slot==='eyewear'||item.shape==='crown'?.62:0});
  const trim=new T.MeshStandardMaterial({name:`trim_${item.id}`,color:item.shape==='pinstripe'?'#d9d1bd':'#bda876',metalness:.35,roughness:.52});
  const parts=[[],[]],slot=item.slot,rigid=slot==='head'||slot==='eyewear',shape=item.shape;
  if(['neckwear'].includes(slot)||['cape','apron'].includes(shape))tint.side=T.DoubleSide;
  function clean(g){for(const k of Object.keys(g.attributes))if(!['position','normal'].includes(k))g.deleteAttribute(k);return g.index?g.toNonIndexed():g;}
  function add(g,accent=false,bone='soft'){g=clean(g);if(['neckwear','charm'].includes(slot)){const p=g.attributes.position;for(let i=0;i<p.count;i++){const forward=T.MathUtils.smoothstep(p.getZ(i),.11,.15);p.setZ(i,p.getZ(i)+.022*forward);}}if(!rigid){const p=g.attributes.position,ids=[],ws=[];for(let i=0;i<p.count;i++){let a=bone,b=bone,t=0;if(bone==='soft'){const y=p.getY(i);if(y<.22){a='rig_hips';b='rig_spine';t=T.MathUtils.clamp((y-.13)/.09,0,1);}else{a='rig_spine';b='rig_chest';t=T.MathUtils.clamp((y-.22)/.10,0,1);}}ids.push(joint(a),joint(b),0,0);ws.push(1-t,t,0,0);}g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(ws,4));}parts[accent?1:0].push(g);}
  function ball(x,y,z,rx,ry=rx,rz=rx,accent=false,bone='soft'){add(new T.SphereGeometry(1,14,10).scale(rx,ry,rz).translate(x,y,z),accent,bone);}
  function box(x,y,z,w,h,d,accent=false,bone='soft'){add(new T.BoxGeometry(w,h,d).translate(x,y,z),accent,bone);}
  function tube(points,r=.002,accent=false,bone='soft',closed=false){add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed),Math.max(12,points.length*2),r,5,closed),accent,bone);}
  function ring(x,y,z,rx,ry,accent=false){tube(Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return[x+rx*Math.cos(a),y+ry*Math.sin(a),z];}),.0023,accent);}
  function polygon(points,depth=.004,accent=false){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();add(new T.ExtrudeGeometry(s,{depth,bevelEnabled:false}),accent);}
  function star(x,y,z,r,accent=false){const s=new T.Shape();for(let j=0;j<10;j++){const a=j*Math.PI/5+Math.PI/2,q=j%2?r*.44:r;j?s.lineTo(Math.cos(a)*q,Math.sin(a)*q):s.moveTo(Math.cos(a)*q,Math.sin(a)*q);}s.closePath();add(new T.ExtrudeGeometry(s,{depth:.003,bevelEnabled:false}).translate(x,y,z),accent);}
  const garment=['body','outerwear'].includes(slot);
  if(garment){
   const cape=shape==='cape',apron=shape==='apron',long=['raincoat','tailcoat'].includes(shape),vest=['waistcoat','vest','cardigan'].includes(shape),scale=cape?1.22:apron?1.08:item.coversBody?1.09:1;
   const rings=[[long?.085:.137,.11,.148,-.07],[.18,.12,.16,-.046],[.24,.115,.15,-.003],[.29,.107,.137,.025],[.352,.077,.095,.055]];
   const pos=[],ix=[],steps=48;
   for(let k=0;k<rings.length;k++){const[y,rx,rz,z]=rings[k];for(let j=0;j<=steps;j++){const a=(cape?Math.PI*.91:apron?Math.PI*.21:0)+(cape?Math.PI*1.18:apron?Math.PI*.58:Math.PI*2)*j/steps;const fold=cape?1+.05*Math.cos(a*12):1;let yy=y;if(vest&&k===rings.length-1&&Math.sin(a)>.55)yy-=.07*(Math.sin(a)-.55)/.45;if(shape==='tailcoat'&&k===0)yy+=Math.sin(a)>.1?.035:0;pos.push(Math.cos(a)*rx*scale*fold,yy,z+Math.sin(a)*rz*scale*fold-(cape?.04*Math.max(0,-Math.sin(a))*Math.min(1,Math.max(0,(y-.16)/.06),Math.max(0,(.37-y)/.05)):0));if(k<rings.length-1&&j<steps){const n=k*(steps+1)+j;ix.push(n,n+steps+1,n+1,n+1,n+steps+1,n+steps+2);}}}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();add(g);
   if(!cape&&!apron&&!['waistcoat','vest'].includes(shape))for(const side of ['L','R']){const x=(side==='L'?1:-1)*.052,bone=`rig_shoulder_${side}`;add(new T.CylinderGeometry(.05*scale,.039*scale,.095,20,4,true).translate(x,.247-.0500323437154293,.095),false,bone);tube(Array.from({length:25},(_,i)=>[x+Math.cos(i/24*Math.PI*2)*.039*scale,.198-.0500323437154293,.095+Math.sin(i/24*Math.PI*2)*.039*scale]),.003,true,bone);}
   if(['cardigan','waistcoat','pinstripe','raincoat','sequin','tunic','tailcoat','vest'].includes(shape)){
    for(const x of shape==='tunic'?[-.023,.023]:[0])for(let i=0;i<3;i++)ball(x,.20+i*.036,.151+i*.008,.004,.004,.003,true);
    for(const sign of [-1,1]){tube([[sign*.065,.31,.157],[sign*.015,.26,.157],[sign*.034,.30,.173],[sign*.043,.345,.148]],.004,true);box(sign*.061,.19,.13,.034,.024,.005,true);}
   }
   if(shape==='apron'){box(0,.207,.175,.077,.045,.005,true);tube([[-.065,.335,.12],[-.07,.357,.05],[.07,.357,.05],[.065,.335,.12]],.007);}
   if(shape==='cape'){tube([[-.078,.35,.05],[0,.37,.145],[.078,.35,.05]],.005,true);ball(0,.362,.15,.008,.007,.003,true);}
   if(['fisherman','pinstripe','vest'].includes(shape))for(let i=0;i<9;i++){const x=(i-4)*.02;tube(shape==='fisherman'?[[-.09,.16+i*.019,.12],[0,.16+i*.019,.17],[.09,.16+i*.019,.12]]:[[x,.15,.12],[x,.23,.155],[x*.7,.32,.157]],.0017,true);if(shape==='vest')ball(x,.27,.16,.004,.008,.002,true);}
   if(shape==='sequin')for(let y=.17;y<.32;y+=.015)for(let x=-.07;x<=.07;x+=.017)ball(x,y,.145+(.08-Math.abs(x))*.25,.005,.005,.0017,true);
  }else if(slot==='head'){
   if(['toque','watchcap','bakercap','beret','souwester'].includes(shape)){const r=shape==='beret'?.077:.064;add(new T.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.5).scale(r,shape==='watchcap'?.035:shape==='beret'?.025:.05,r*.85).translate(shape==='beret'?.012:0,0,0));add(new T.TorusGeometry(.06,.007,6,32).rotateX(Math.PI/2));if(shape==='toque')ball(0,.064,0,.018);if(shape==='beret')box(.012,.031,0,.004,.014,.005);if(shape==='souwester')add(new T.CylinderGeometry(.074,.092,.012,32,1,true).scale(1,1,1.05).translate(0,-.006,-.012));}
   if(shape==='visor'){add(new T.TorusGeometry(.061,.005,6,32).rotateX(Math.PI/2));add(new T.SphereGeometry(1,24,8,0,Math.PI,0,Math.PI*.5).scale(.075,.008,.07).translate(0,-.008,.028));}
   if(shape==='chef'){add(new T.CylinderGeometry(.052,.061,.059,24,1,true).translate(0,.024,0));for(let i=0;i<6;i++)ball(Math.cos(i)*.031,.064+Math.sin(i*3)*.006,Math.sin(i)*.025,.033,.033,.03);for(let i=0;i<16;i++)tube([[Math.cos(i)*.055,-.003,Math.sin(i)*.055],[Math.cos(i)*.05,.051,Math.sin(i)*.05]],.0014,true);}
   if(shape==='crown'){add(new T.CylinderGeometry(.049,.049,.015,30,1,true));for(let i=0;i<5;i++){const a=i/5*Math.PI*2;add(new T.ConeGeometry(.012,.037,4).translate(Math.cos(a)*.044,.021,Math.sin(a)*.044));ball(Math.cos(a)*.044,.043,Math.sin(a)*.044,.004,.004,.004,true);}}
  }else if(slot==='eyewear'){
   for(const x of [-.031,.027]){if(shape==='star'){const pts=Array.from({length:11},(_,i)=>{const a=i*Math.PI/5+Math.PI/2,r=i%2?.012:.026;return[x+Math.cos(a)*r,Math.sin(a)*r,0];});tube(pts,.0022);}else if(shape==='rectangle'){tube([[x-.023,-.016,0],[x+.023,-.016,0],[x+.023,.016,0],[x-.023,.016,0],[x-.023,-.016,0]],.0023);}else ring(x,0,0,shape==='oval'?.026:.022,shape==='oval'?.016:.022);tube([[x<0?-.054:.052,0,0],[x<0?-.054:.052,0,-.065]],.0017);}
   tube([[-.009,0,0],[-.002,.006,0],[.005,0,0]],.002);
  }else if(slot==='neckwear'){
   tube(Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return[Math.cos(a)*.085,.345,.047+Math.sin(a)*.106];}),shape==='scarf'?.014:shape==='yarn'?.007:.0045);
   if(['tie','neckerchief','gingham','scarf'].includes(shape)){const g=new T.BufferGeometry(),w=shape==='tie'?.015:.042;g.setAttribute('position',new T.Float32BufferAttribute([-w,.342,.161,0,.26,.17,w,.342,.161],3));g.computeVertexNormals();add(g);ball(0,.34,.16,.012,.009,.007);if(shape==='scarf'){box(.028,.278,.164,.022,.083,.009);for(let i=0;i<5;i++)tube([[.018+i*.005,.237,.164],[.018+i*.005,.225,.164]],.0015,true);}if(shape==='gingham')for(let i=0;i<5;i++){tube([[-.032+i*.014,.337,.164],[0,.276,.174]],.0017,true);tube([[-.025,.322-i*.008,.168],[.025,.322-i*.008,.168]],.0017,true);}}
   if(shape==='bow')for(const sign of [-1,1])ball(sign*.024,.342,.159,.025,.015,.006);if(['bow','ribbon'].includes(shape))ball(0,.342,.172,.01,.01,.004,true);if(shape==='bell'){ball(0,.329,.162,.012,.014,.01,true);tube([[-.007,.322,.172],[.007,.322,.172]],.0015);}
  }else{
   tube(Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return[Math.cos(a)*.087,.336-Math.max(0,Math.sin(a))*.055,.047+Math.sin(a)*.112];}),.0018);
   const y=.279,z=.163;
   if(shape==='teacup'){add(new T.CylinderGeometry(.013,.009,.017,16,1,true).translate(0,y,z));ring(.015,y,z,.007,.008,true);add(new T.CylinderGeometry(.019,.019,.002,20).translate(0,y-.011,z));}
   if(['watch','cameo','stamp'].includes(shape)){ball(0,y,z,.017,shape==='cameo'?.023:.017,.005);ring(0,y,z+.005,.014,shape==='cameo'?.019:.014,true);if(shape==='watch')tube([[0,y+.01,z+.007],[0,y,z+.007],[.008,y-.004,z+.007]],.0013,true);else{ball(0,y,z+.007,.006,.008,.002,true);ball(-.004,y+.009,z+.006,.003,.005,.002,true);ball(.004,y+.009,z+.006,.003,.005,.002,true);}}
   if(shape==='starpendant')star(0,y,z,.022);
   if(shape==='whisk'){tube([[0,y-.018,z],[0,y+.025,z]],.002);for(let i=0;i<3;i++)tube([[-.008,y,z+i*.002],[0,y+.023,z+i*.002],[.008,y,z+i*.002],[0,y-.007,z+i*.002]],.0012,true);}
   if(shape==='puffin'){ball(0,y,z,.012,.019,.006);ball(0,y+.017,z,.009);ball(0,y+.006,z+.005,.007,.013,.003,true);add(new T.ConeGeometry(.006,.014,4).rotateX(Math.PI/2).translate(0,y+.018,z+.008),true);}
   if(shape==='fish'){ball(0,y,z,.018,.009,.004);add(new T.ConeGeometry(.009,.015,3).rotateZ(-Math.PI/2).translate(-.023,y,z));ball(.01,y+.003,z+.005,.002,.002,.001,true);}
   if(shape==='tooth')add(new T.ConeGeometry(.011,.032,5).rotateZ(Math.PI).translate(0,y,z));
   if(shape==='clip')tube([[-.006,y-.016,z],[-.006,y+.016,z],[.006,y+.016,z],[.006,y-.016,z],[0,y-.012,z],[0,y+.01,z]],.002);
  }
  const group=new T.Group();group.name=item.node;
  if(rigid){head.add(group);scene.updateMatrixWorld(true);group.position.copy(head.worldToLocal(new T.Vector3(...(slot==='head'?[0,.478,.066]:[0,.431,.14]))));}else rig.add(group);
  parts.forEach((list,i)=>{if(!list.length)return;const geometry=mergeVertices(mergeGeometries(list));const m=rigid?new T.Mesh(geometry,i?trim:tint):new T.SkinnedMesh(geometry,i?trim:tint);group.add(m);if(!rigid)m.bind(skeleton,new T.Matrix4());m.frustumCulled=false;});groups.push(item.node);
 }
 scene.updateMatrixWorld(true);const glb=Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true,trs:true})),gzip=gzipSync(glb,{level:9});await writeFile(new URL(`${collection}.v1.glb`,output),glb);await writeFile(new URL(`${collection}.v1.glb.gz`,output),gzip);reports.push({collection,nodes:groups,bytes:glb.length,compressedBytes:gzip.length,sha256:createHash('sha256').update(glb).digest('hex')});
}
await writeFile(new URL('collections.json',output),JSON.stringify({version:1,baseSha256:createHash('sha256').update(base).digest('hex'),collections:reports,provenance:'Original deterministic garment recipes in scripts/wardrobe/collections.mjs; shared Hearth rig. No external artwork or personal data.'},null,2)+'\n');console.log(reports);
