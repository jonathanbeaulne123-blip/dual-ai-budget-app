/** Original deterministic garment construction. Each recipe has its own silhouette and trim. */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {COLLECTIONS,FITTING_ITEMS,WARDROBE_ASSET,fittingColour} from '../../src/wardrobe/catalogue.ts';
class Reader{readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}}
globalThis.FileReader=Reader;
const output=new URL('../../public/hercules-wardrobe/',import.meta.url),base=await readFile(new URL('hercules-cozy.v1.glb',output));
const reports=[];
for(const collection of [...COLLECTIONS.map(c=>c.id),'legacy']){
 const loaded=await new GLTFLoader().parseAsync(base.buffer.slice(base.byteOffset,base.byteOffset+base.byteLength),'');const scene=loaded.scene;let skeleton;scene.traverse(n=>{if(n.isSkinnedMesh&&!skeleton)skeleton=n.skeleton;});const bones=skeleton.bones,rig=scene.getObjectByName('Hercules'),head=scene.getObjectByName('rig_head'),tailBone=scene.getObjectByName('rig_tail_04');
 const remove=[];scene.traverse(n=>{if(n.isMesh||n.name.startsWith('item_'))remove.push(n);});remove.forEach(n=>n.removeFromParent());scene.updateMatrixWorld(true);
 const joint=name=>bones.findIndex(b=>b.name===name),groups=[];
 for(const item of FITTING_ITEMS.filter(p=>p.collection===collection&&p.asset!==WARDROBE_ASSET)){
  const tint=new T.MeshStandardMaterial({name:`tint_${item.id}`,color:fittingColour(item.variants[0],item.id),roughness:['raincoat','sequin','silk','tie','puffer','goggles','tailribbon'].includes(item.shape)?.38:.86,metalness:(item.slot==='charm'&&!['seedpacket'].includes(item.shape))||(item.slot==='eyewear'&&!['sleepmask','goggles'].includes(item.shape))||item.shape==='crown'?.62:0});
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
   const cape=shape==='cape',apron=shape==='apron',long=['raincoat','tailcoat','robe'].includes(shape),vest=['waistcoat','vest','cardigan','puffer'].includes(shape),scale=cape?1.22:apron?1.08:shape==='puffer'?1.11:item.coversBody?1.09:1;
   const rings=[[long?.085:.137,.11,.148,-.07],[.18,.12,.16,-.046],[.24,.115,.15,-.003],[.29,.107,.137,.025],[.352,.077,.095,.055]];
   const pos=[],ix=[],steps=48;
   for(let k=0;k<rings.length;k++){const[y,rx,rz,z]=rings[k];for(let j=0;j<=steps;j++){const a=(cape?Math.PI*.91:apron?Math.PI*.21:0)+(cape?Math.PI*1.18:apron?Math.PI*.58:Math.PI*2)*j/steps;const fold=cape?1+.05*Math.cos(a*12):1;let yy=y;if(vest&&k===rings.length-1&&Math.sin(a)>.55)yy-=.07*(Math.sin(a)-.55)/.45;if(shape==='tailcoat'&&k===0)yy+=Math.sin(a)>.1?.035:0;pos.push(Math.cos(a)*rx*scale*fold,yy,z+Math.sin(a)*rz*scale*fold-(cape?.04*Math.max(0,-Math.sin(a))*Math.min(1,Math.max(0,(y-.16)/.06),Math.max(0,(.37-y)/.05)):0));if(k<rings.length-1&&j<steps){const n=k*(steps+1)+j;ix.push(n,n+steps+1,n+1,n+1,n+steps+1,n+steps+2);}}}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();add(g);
   if(!cape&&!apron&&!['waistcoat','vest','puffer'].includes(shape))for(const side of ['L','R']){const x=(side==='L'?1:-1)*.052,bone=`rig_shoulder_${side}`;add(new T.CylinderGeometry(.05*scale,.039*scale,.095,20,4,true).translate(x,.247-.0500323437154293,.095),false,bone);tube(Array.from({length:25},(_,i)=>[x+Math.cos(i/24*Math.PI*2)*.039*scale,.198-.0500323437154293,.095+Math.sin(i/24*Math.PI*2)*.039*scale]),.003,true,bone);}
   if(['cardigan','waistcoat','pinstripe','raincoat','sequin','tunic','tailcoat','vest'].includes(shape)){
    for(const x of shape==='tunic'?[-.023,.023]:[0])for(let i=0;i<3;i++)ball(x,.20+i*.036,.151+i*.008,.004,.004,.003,true);
    for(const sign of [-1,1]){tube([[sign*.065,.31,.157],[sign*.015,.26,.157],[sign*.034,.30,.173],[sign*.043,.345,.148]],.004,true);box(sign*.061,.19,.13,.034,.024,.005,true);}
   }
   if(shape==='apron'){box(0,.207,.175,.077,.045,.005,true);tube([[-.065,.335,.12],[-.07,.357,.05],[.07,.357,.05],[.065,.335,.12]],.007);}
   if(shape==='cape'){tube([[-.078,.35,.05],[0,.37,.145],[.078,.35,.05]],.005,true);ball(0,.362,.15,.008,.007,.003,true);}
   if(['fisherman','pinstripe','vest'].includes(shape))for(let i=0;i<9;i++){const x=(i-4)*.02;tube(shape==='fisherman'?[[-.09,.16+i*.019,.12],[0,.16+i*.019,.17],[.09,.16+i*.019,.12]]:[[x,.15,.12],[x,.23,.155],[x*.7,.32,.157]],.0017,true);if(shape==='vest')ball(x,.27,.16,.004,.008,.002,true);}
   if(shape==='sequin')for(let y=.17;y<.32;y+=.015)for(let x=-.07;x<=.07;x+=.017)ball(x,y,.145+(.08-Math.abs(x))*.25,.005,.005,.0017,true);
   // Hearth after dark, Garden Sunday and Snow day garments.
   if(shape==='robe'){tube([[-.11,.33,.11],[-.04,.30,.16],[0,.24,.17],[.04,.30,.16],[.11,.33,.11]],.009);tube([[-.12,.19,.10],[0,.185,.175],[.12,.19,.10]],.006,true);ball(0,.185,.178,.012,.008,.005,true);for(const sign of [-1,1])tube([[sign*.012,.18,.176],[sign*.03,.13,.17]],.004,true);}
   if(shape==='pyjama'){tube([[-.07,.335,.12],[-.02,.30,.165],[0,.27,.17],[.02,.30,.165],[.07,.335,.12]],.004,true);for(let i=0;i<2;i++)ball(0,.235+i*.04,.164,.004,.004,.003,true);}
   if(shape==='smock'){box(0,.19,.166,.06,.04,.005,true);tube([[-.08,.30,.14],[0,.29,.17],[.08,.30,.14]],.003,true);}
   if(shape==='waxed'){tube([[-.075,.33,.13],[-.03,.31,.165],[0,.27,.17],[.03,.31,.165],[.075,.33,.13]],.008,true);for(const sign of [-1,1]){box(sign*.06,.19,.135,.038,.03,.006,true);box(sign*.06,.208,.14,.04,.008,.008,true);}for(let i=0;i<3;i++)ball(0,.2+i*.036,.159,.004,.004,.003,true);}
   if(shape==='fleece'){tube([[0,.25,.168],[0,.34,.158]],.003,true);add(new T.CylinderGeometry(.062,.07,.03,24,1,true).translate(0,.355,.05));}
   if(shape==='puffer')for(let i=0;i<6;i++){const y=.17+i*.03;tube(Array.from({length:25},(_,j)=>{const a=j/24*Math.PI*2;return[Math.cos(a)*.126*scale,y,-.01+Math.sin(a)*.145*scale];}),.0022,true);}
  }else if(slot==='head'){
   if(['toque','watchcap','bakercap','beret','souwester'].includes(shape)){const r=shape==='beret'?.077:.064;add(new T.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.5).scale(r,shape==='watchcap'?.035:shape==='beret'?.025:.05,r*.85).translate(shape==='beret'?.012:0,0,0));add(new T.TorusGeometry(.06,.007,6,32).rotateX(Math.PI/2));if(shape==='toque')ball(0,.064,0,.018);if(shape==='beret')box(.012,.031,0,.004,.014,.005);if(shape==='souwester')add(new T.CylinderGeometry(.074,.092,.012,32,1,true).scale(1,1,1.05).translate(0,-.006,-.012));}
   if(shape==='visor'){add(new T.TorusGeometry(.061,.005,6,32).rotateX(Math.PI/2));add(new T.SphereGeometry(1,24,8,0,Math.PI,0,Math.PI*.5).scale(.075,.008,.07).translate(0,-.008,.028));}
   if(shape==='chef'){add(new T.CylinderGeometry(.052,.061,.059,24,1,true).translate(0,.024,0));for(let i=0;i<6;i++)ball(Math.cos(i)*.031,.064+Math.sin(i*3)*.006,Math.sin(i)*.025,.033,.033,.03);for(let i=0;i<16;i++)tube([[Math.cos(i)*.055,-.003,Math.sin(i)*.055],[Math.cos(i)*.05,.051,Math.sin(i)*.05]],.0014,true);}
   if(shape==='nightcap'){add(new T.ConeGeometry(.063,.11,24,1,true).translate(0,.05,0).rotateZ(.45).translate(.012,.0,0));add(new T.TorusGeometry(.06,.008,6,32).rotateX(Math.PI/2));ball(.075,.085,0,.011,.011,.011,true);}
   if(shape==='strawhat'){add(new T.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.5).scale(.062,.03,.056));add(new T.CylinderGeometry(.118,.118,.005,36).translate(0,-.004,-.01));add(new T.TorusGeometry(.061,.004,6,32).rotateX(Math.PI/2).translate(0,.008,0),true);}
   if(shape==='earflap'){add(new T.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.5).scale(.066,.052,.06));add(new T.TorusGeometry(.062,.008,6,32).rotateX(Math.PI/2));ball(0,.052,0,.011,.011,.011,true);for(const sign of [-1,1]){box(sign*.062,-.028,-.01,.018,.05,.04);tube([[sign*.062,-.05,-.01],[sign*.05,-.085,.0]],.002,true);}}
   if(shape==='crown'){add(new T.CylinderGeometry(.049,.049,.015,30,1,true));for(let i=0;i<5;i++){const a=i/5*Math.PI*2;add(new T.ConeGeometry(.012,.037,4).translate(Math.cos(a)*.044,.021,Math.sin(a)*.044));ball(Math.cos(a)*.044,.043,Math.sin(a)*.044,.004,.004,.004,true);}}
  }else if(slot==='eyewear'&&shape==='sleepmask'){
   add(new T.BoxGeometry(.076,.026,.01).translate(-.002,0,0));for(const x of [-.041,.037])ball(x,0,0,.013,.013,.005);for(const x of [-.054,.052])tube([[x,0,0],[x,.004,-.065]],.0025,true);ball(-.03,-.001,.006,.004,.002,.001,true);ball(.026,-.001,.006,.004,.002,.001,true);
  }else if(slot==='eyewear'&&shape==='goggles'){
   add(new T.BoxGeometry(.108,.032,.008).translate(-.002,0,0));tube([[-.056,-.016,.004],[.052,-.016,.004],[.052,.016,.004],[-.056,.016,.004],[-.056,-.016,.004]],.003,true);for(const x of [-.056,.052])tube([[x,0,0],[x,.004,-.065]],.004,true);
  }else if(slot==='eyewear'){
   for(const x of [-.031,.027]){if(shape==='star'){const pts=Array.from({length:11},(_,i)=>{const a=i*Math.PI/5+Math.PI/2,r=i%2?.012:.026;return[x+Math.cos(a)*r,Math.sin(a)*r,0];});tube(pts,.0022);}else if(shape==='rectangle'){tube([[x-.023,-.016,0],[x+.023,-.016,0],[x+.023,.016,0],[x-.023,.016,0],[x-.023,-.016,0]],.0023);}else ring(x,0,0,shape==='oval'?.026:.022,shape==='oval'?.016:.022);tube([[x<0?-.054:.052,0,0],[x<0?-.054:.052,0,-.065]],.0017);}
   tube([[-.009,0,0],[-.002,.006,0],[.005,0,0]],.002);
  }else if(slot==='neckwear'){
   tube(Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return[Math.cos(a)*.085,.345,.047+Math.sin(a)*.106];}),shape==='scarf'?.014:shape==='yarn'?.007:.0045);
   if(['tie','neckerchief','gingham','scarf'].includes(shape)){const g=new T.BufferGeometry(),w=shape==='tie'?.015:.042;g.setAttribute('position',new T.Float32BufferAttribute([-w,.342,.161,0,.26,.17,w,.342,.161],3));g.computeVertexNormals();add(g);ball(0,.34,.16,.012,.009,.007);if(shape==='scarf'){box(.028,.278,.164,.022,.083,.009);for(let i=0;i<5;i++)tube([[.018+i*.005,.237,.164],[.018+i*.005,.225,.164]],.0015,true);}if(shape==='gingham')for(let i=0;i<5;i++){tube([[-.032+i*.014,.337,.164],[0,.276,.174]],.0017,true);tube([[-.025,.322-i*.008,.168],[.025,.322-i*.008,.168]],.0017,true);}}
   if(shape==='daisy')for(let i=0;i<7;i++){const a=(i/7)*Math.PI*1.1+Math.PI*.95,cx=Math.cos(a)*.088,cz=.047+Math.sin(a)*.109,cy=.343;ball(cx,cy,cz,.004,.004,.003,false);for(let k=0;k<5;k++){const b=k/5*Math.PI*2;ball(cx+Math.cos(b)*.007*Math.abs(Math.sin(a)),cy+Math.sin(b)*.007,cz+Math.cos(b)*.007*Math.abs(Math.cos(a)),.0035,.0035,.002,true);}}
   if(shape==='bow')for(const sign of [-1,1])ball(sign*.024,.342,.159,.025,.015,.006);if(['bow','ribbon'].includes(shape))ball(0,.342,.172,.01,.01,.004,true);if(shape==='bell'){ball(0,.329,.162,.012,.014,.01,true);tube([[-.007,.322,.172],[.007,.322,.172]],.0015);}
  }else if(slot==='tail'){
   // Tied on the tail: everything here follows rig_tail_04 rigidly, ring first so the piece reads as fastened.
   const c=tailBone.getWorldPosition(new T.Vector3()),bone='rig_tail_04';
   tube(Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return[c.x,c.y+Math.cos(a)*.042,c.z+Math.sin(a)*.042];}),shape==='tailbell'?.004:.007,false,bone,true);
   if(shape==='tailbell'){ball(c.x,c.y-.06,c.z,.013,.015,.013,true,bone);tube([[c.x,c.y-.042,c.z],[c.x,c.y-.048,c.z]],.003,false,bone);ball(c.x,c.y-.074,c.z,.004,.004,.004,false,bone);}
   else{for(const sign of [-1,1])add(new T.SphereGeometry(1,14,10).scale(.022,.013,.009).rotateZ(sign*.5).translate(c.x,c.y+.05,c.z+sign*.026),false,bone);ball(c.x,c.y+.048,c.z,.009,.008,.009,true,bone);for(const sign of [-1,1])tube([[c.x,c.y+.045,c.z+sign*.006],[c.x-.004*sign,c.y+.01,c.z+sign*.03]],.004,false,bone);
    if(shape==='tailbow'){for(let k=0;k<6;k++){const b=k/6*Math.PI*2;ball(c.x+Math.cos(b)*.011,c.y+.062+Math.sin(b)*.011,c.z,.004,.004,.002,true,bone);}ball(c.x,c.y+.062,c.z+.001,.005,.005,.003,false,bone);}}
  }else{
   tube(Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return[Math.cos(a)*.087,.336-Math.max(0,Math.sin(a))*.055,.047+Math.sin(a)*.112];}),.0018);
   const y=.279,z=.163;
   if(shape==='teacup'){add(new T.CylinderGeometry(.013,.009,.017,16,1,true).translate(0,y,z));ring(.015,y,z,.007,.008,true);add(new T.CylinderGeometry(.019,.019,.002,20).translate(0,y-.011,z));}
   if(['watch','cameo','stamp'].includes(shape)){ball(0,y,z,.017,shape==='cameo'?.023:.017,.005);ring(0,y,z+.005,.014,shape==='cameo'?.019:.014,true);if(shape==='watch')tube([[0,y+.01,z+.007],[0,y,z+.007],[.008,y-.004,z+.007]],.0013,true);else{ball(0,y,z+.007,.006,.008,.002,true);ball(-.004,y+.009,z+.006,.003,.005,.002,true);ball(.004,y+.009,z+.006,.003,.005,.002,true);}}
   if(shape==='starpendant')star(0,y,z,.022);
   if(shape==='moon')add(new T.TorusGeometry(.014,.005,8,20,Math.PI*1.25).rotateZ(Math.PI*.45).translate(0,y,z));
   if(shape==='seedpacket'){box(0,y,z,.022,.028,.004);ball(0,y-.002,z+.003,.006,.007,.002,true);tube([[-.011,y+.011,z],[.011,y+.011,z]],.0015,true);}
   if(shape==='snowflake'){for(let i=0;i<3;i++){const a=i*Math.PI/3;tube([[Math.cos(a)*-.02,y+Math.sin(a)*-.02,z],[Math.cos(a)*.02,y+Math.sin(a)*.02,z]],.0018);for(const sg of [-1,1]){const px=Math.cos(a)*.012*sg,py=y+Math.sin(a)*.012*sg;tube([[px,py,z],[px+Math.cos(a+.9)*.006*sg,py+Math.sin(a+.9)*.006*sg,z]],.0014,true);tube([[px,py,z],[px+Math.cos(a-.9)*.006*sg,py+Math.sin(a-.9)*.006*sg,z]],.0014,true);}}ball(0,y,z,.004,.004,.003,true);}
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
