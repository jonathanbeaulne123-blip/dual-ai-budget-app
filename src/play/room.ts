import * as T from 'three';
import type {RoomPalette} from '../wardrobe/roomPalette.ts';
import type {PlayArea,PlayDecor,PlayDiscovery} from '../core/playContracts.ts';
export type PlayPerformance={colour?:string;tempo?:string;portrait?:string};
export type DisplayImage={slot:string;label:string;url?:string;kind:string;id:string;pairing?:"travel"|"home"|"reserve"|"neutral"};
export function createPlayRoom(scene:T.Scene,palette:RoomPalette,onInvalidate:()=>void=()=>{}){
 const root=new T.Group();scene.add(root);const theme=palette.theme;scene.background=new T.Color(theme==='taylor'?'#e7d9d9':theme==='newfoundland'?'#b6c8c6':'#dad0ba');
 const material=(colour:string,metalness=0)=>new T.MeshStandardMaterial({color:colour,roughness:metalness?.35:.83,metalness});
 const wood=material(theme==='taylor'?'#b67686':theme==='newfoundland'?'#345968':'#805940'),trim=material(theme==='taylor'?'#efd4b4':'#bba16b',.45),cloth=material(theme==='taylor'?'#e6ccd3':theme==='newfoundland'?'#b5c8bf':'#d1bc9b'),accent=material(theme==='taylor'?'#a4496f':theme==='newfoundland'?'#dbb558':'#6f8266'),wall=material(theme==='taylor'?'#e7d9d9':theme==='newfoundland'?'#b6c8c6':'#dad0ba');
 const ownedTextures:T.Texture[]=[];
 function grain(kind:'wood'|'cloth'){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,128,128);for(let i=0;i<128;i++){ctx.strokeStyle=kind==='wood'?`rgba(65,35,15,${.03+(i%9)*.008})`:'rgba(30,20,10,.05)';ctx.lineWidth=kind==='wood'?.6:.35;ctx.beginPath();ctx.moveTo(i,0);ctx.bezierCurveTo(i+Math.sin(i)*3,35,i-Math.cos(i)*3,85,i,128);ctx.stroke();if(kind==='cloth'){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke();}}const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(kind==='wood'?2:5,kind==='wood'?1:5);texture.colorSpace=T.SRGBColorSpace;ownedTextures.push(texture);return texture;}
 wood.map=grain('wood');cloth.map=grain('cloth');
 const materials={wood,trim,cloth,accent};
 function box(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material=wood,parent:T.Object3D=root){const node=new T.Mesh(new T.BoxGeometry(w,h,d),m);node.position.set(x,y,z);parent.add(node);return node;}
 function ball(r:number,x:number,y:number,z:number,m:T.Material=trim,parent:T.Object3D=root){const node=new T.Mesh(new T.SphereGeometry(r,20,12),m);node.position.set(x,y,z);parent.add(node);return node;}
 function cyl(r:number,h:number,x:number,y:number,z:number,m:T.Material=wood,parent:T.Object3D=root){const node=new T.Mesh(new T.CylinderGeometry(r,r,h,24),m);node.position.set(x,y,z);parent.add(node);return node;}
 const floor=box(4.1,.04,2.2,0,-.07,-.05,wood);floor.userData.playTarget='dressing';box(4.1,1.9,.05,0,.86,-.77,wall);
 const ambient=new T.HemisphereLight('#fff5dc','#6a655b',2.1);root.add(ambient);const key=new T.DirectionalLight('#fff3d7',2.8);key.position.set(-2,3,4);root.add(key);const glow=new T.PointLight('#ffd79c',1.3,4);glow.position.set(1.4,1,-.2);root.add(glow);
 // Each world has its own spatial architecture and crafted small geometry.
 if(theme==='classic'){
  for(let x=-1.95;x<2;x+=.22){box(.016,.53,.03,x,.21,-.727,trim);box(.2,.37,.018,x+.11,.23,-.729,wood);}
  box(4.05,.025,.04,0,.51,-.72,trim);for(const x of [-1.95,1.95])box(.075,1.85,.06,x,.85,-.72,wood);
  for(let x=-2;x<2;x+=.16)box(.003,.002,2,x,-.046,-.05,trim);
 }else if(theme==='taylor'){
  for(let i=0;i<9;i++){const leaf=box(.56,.92,.025,-1.8+i*.45,1.25,-.76,i%2?cloth:wall);leaf.rotation.z=(i%2?1:-1)*.09;}
  for(const x of [-1.9,1.9]){for(let i=0;i<5;i++){const fold=box(.1,1.72,.09,x+i*.03*(x<0?1:-1),.78,-.53,accent);fold.rotation.y=i*.13;}box(.36,.055,.08,x,.65,-.45,trim);}
  for(let i=0;i<7;i++){const pennant=new T.Mesh(new T.ConeGeometry(.08,.16,3),i%2?accent:cloth);pennant.rotation.z=Math.PI; pennant.position.set(-1.25+i*.4,1.62-Math.sin(i/6*Math.PI)*.12,-.5);root.add(pennant);}
 }else{
  for(let y=0;y<1.85;y+=.115)box(4.05,.006,.025,0,y,-.735,wood);
  const ring=new T.Mesh(new T.TorusGeometry(.25,.027,12,48),trim);ring.position.set(1.53,1.19,-.7);root.add(ring);const sea=new T.Mesh(new T.CircleGeometry(.23,40),material('#81a8b5'));sea.position.set(1.53,1.19,-.703);root.add(sea);
  for(let x=-1.96;x<1.96;x+=.15)box(.004,.002,2,x,-.046,-.05,cloth);
  for(let i=0;i<5;i++){const house=box(.07,.13+(i%2)*.05,.04,1.36+i*.08,1.12,-.65,i%2?accent:wood);house.rotation.z=.01;}
 }
 // Window seat and household desk flank the fitting stage.
 box(.6,.17,.38,1.45,.03,-.36,wood).userData.playTarget='window';box(.64,.07,.4,1.45,.15,-.35,cloth);
 for(let i=0;i<3;i++){const cushion=ball(.1,1.26+i*.19,.23,-.48,i%2?accent:cloth);cushion.scale.set(.95,.65,.7);cushion.rotation.z=(i-1)*.12;}
 const desk=box(.63,.045,.35,-1.45,.3,-.2,wood);desk.userData.playTarget='desk';for(const x of [-1.7,-1.2])box(.035,.35,.25,x,.105,-.2,wood);
 for(let i=0;i<3;i++){const book=box(.16,.025,.18,-1.52+i*.015,.34+i*.027,-.17,i%2?accent:cloth);book.rotation.y=.15;book.userData.playTarget='desk';}
 const bankShelf=box(.82,.045,.3,.98,.5,-.5,wood);bankShelf.userData.playTarget='banks';
 box(.85,.055,.28,-1.25,.72,-.56,wood);box(.85,.055,.28,-1.25,1.05,-.56,wood);
 // Shelf tags, rug and an articulated brass lamp add readable scale.
 for(let i=0;i<3;i++){const rug=cyl(.41-i*.025,.003,0,-.041+i*.004,.25,i%2?cloth:accent);rug.scale.z=.72;}
 cyl(.07,.018,1.05,.535,-.4,trim);cyl(.009,.39,1.05,.73,-.4,trim);const shade=new T.Mesh(new T.ConeGeometry(.12,.15,28,1,true),cloth);shade.position.set(1.05,.97,-.4);shade.userData.playTarget='lamp';root.add(shade);
 const displays=new T.Group();root.add(displays);let textures:T.Texture[]=[],displayMaterials:T.Material[]=[],displayGeometry:T.BufferGeometry[]=[],generation=0;let composition:PlayDecor['composition']='centrepiece';
 function clearDisplays(){generation++;textures.forEach(t=>t.dispose());displayMaterials.forEach(m=>m.dispose());displayGeometry.forEach(g=>g.dispose());textures=[];displayMaterials=[];displayGeometry=[];displays.clear();}
 function anchor(slot:string):[number,number,number]{const i=Number(slot.split('-')[1])-1;
  if(slot.startsWith('portrait')){if(composition==='centrepiece')return [i===0?.1:i<4?-.55+(i-1)*.34:-.65+(i-4)*.4,i===0?1.15:i<4?1.48:.83,-.72];if(composition==='gallery')return [(i%4)*.37-.51,1.0+Math.floor(i/4)*.4,-.72];return [(i%3)*.36-.35,1.48-Math.floor(i/3)*.3,-.72];}
  if(slot.startsWith('bank'))return [.71+i*.25,.63+(composition==='collector'?(i%2)*.035:0),-.47+(composition==='gallery'?i*.025:0)];
  if(slot.startsWith('toy'))return [-1.54+(i%3)*.27,.81+Math.floor(i/3)*.33+(composition==='collector'?i%3*.018:0),-.51+(composition==='centrepiece'&&i===0?.07:0)];
  return [i<2?-1.72+i*.23:1.42+(i-2)*.25,i<2?.4:.35,composition==='collector'?-.12:-.22];
 }
 function setDisplays(items:DisplayImage[]){clearDisplays();const token=generation;
  const complete:DisplayImage[]=[...items,...Array.from({length:8},(_,i)=>({slot:`portrait-${i+1}`,label:'A place for your portrait',kind:'portrait',id:''})).filter(s=>!items.some(i=>i.slot===s.slot))];
  for(const item of complete){const group=new T.Group();group.position.set(...anchor(item.slot));group.userData.playTarget=item.slot;group.userData.rewardId=item.id;group.userData.kind=item.kind;displays.add(group);
   if(item.kind==='portrait'){if(composition==='centrepiece'&&item.slot==='portrait-1')group.scale.setScalar(1.3);
    const frame=box(.27,.32,.035,0,0,0,trim,group);frame.userData.playTarget=item.slot;
    const mat=new T.MeshBasicMaterial({color:'#efe4d2'}),geometry=new T.PlaneGeometry(.239,.287);displayMaterials.push(mat);displayGeometry.push(geometry);const face=new T.Mesh(geometry,mat);face.position.z=.021;face.userData.playTarget=item.slot;group.add(face);
    if(item.url)new T.TextureLoader().load(item.url,t=>{if(token!==generation){t.dispose();return;}t.colorSpace=T.SRGBColorSpace;textures.push(t);mat.map=t;mat.color.set('#ffffff');mat.needsUpdate=true;onInvalidate();},undefined,()=>{});
   }else if(item.kind==='bank'){
    const body=ball(.065,0,0,0,cloth,group);body.scale.set(1,.92,.75);ball(.043,0,.075,0,cloth,group);for(const x of [-.026,.026]){const ear=new T.Mesh(new T.ConeGeometry(.022,.043,3),cloth);ear.position.set(x,.113,0);group.add(ear);ball(.005,x*.65,.08,.04,wood,group);}box(.039,.003,.01,0,.06,-.015,wood,group);body.userData.playTarget=item.slot;
    const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=96;const labelContext=labelCanvas.getContext('2d')!;labelContext.fillStyle='#f4ead6';labelContext.fillRect(0,0,512,96);labelContext.fillStyle='#3b3027';labelContext.font='600 30px Georgia';labelContext.textAlign='center';labelContext.fillText(item.label.length>30?item.label.slice(0,29)+'…':item.label,256,57,480);const labelTexture=new T.CanvasTexture(labelCanvas);labelTexture.colorSpace=T.SRGBColorSpace;textures.push(labelTexture);const labelMaterial=new T.MeshBasicMaterial({map:labelTexture});displayMaterials.push(labelMaterial);const plate=box(.22,.041,.006,0,-.075,.04,labelMaterial,group);plate.userData.playTarget=item.slot;
    if(item.pairing==='travel'){box(.045,.048,.028,.075,-.015,0,wood,group);const handle=new T.Mesh(new T.TorusGeometry(.013,.003,6,12,Math.PI),trim);handle.position.set(.075,.018,0);group.add(handle);}
    if(item.pairing==='home'){box(.042,.041,.035,.077,-.018,0,accent,group);const roof=new T.Mesh(new T.ConeGeometry(.035,.027,4),trim);roof.rotation.y=Math.PI/4;roof.position.set(.077,.019,0);group.add(roof);}
    if(item.pairing==='reserve'){box(.21,.008,.11,0,-.06,-.01,wood,group);box(.012,.16,.1,-.105,.012,-.015,wood,group);box(.012,.16,.1,.105,.012,-.015,wood,group);}

   }else{
    const toy=item.id;cyl(.06,.016,0,-.024,0,trim,group);
    if(toy==='camera'||toy==='projector'){box(.12,.075,.055,0,.025,0,wood,group);const lens=cyl(.027,.04,0,.025,.044,trim,group);lens.rotation.x=Math.PI/2;if(toy==='projector')for(const x of [-.036,.036]){const reel=cyl(.031,.01,x,.083,0,wood,group);reel.rotation.x=Math.PI/2;}}
    else if(toy==='theatre'){box(.17,.15,.055,0,.05,0,wood,group);box(.13,.115,.012,0,.045,.035,cloth,group);for(const x of [-.045,.045]){const curtain=box(.052,.12,.016,x,.047,.047,accent,group);curtain.name=x<0?'curtain-left':'curtain-right';}}
    else if(toy==='orrery'||toy==='globe'){ball(.042,0,.043,0,accent,group);const orbit=new T.Mesh(new T.TorusGeometry(.078,.004,6,28),trim);orbit.rotation.x=.8;orbit.position.y=.04;group.add(orbit);ball(.013,.075,.06,0,cloth,group);}
    else if(toy==='lantern'){box(.065,.11,.065,0,.04,0,trim,group);const lampMaterial=material('#ffe3a0');displayMaterials.push(lampMaterial);box(.051,.08,.069,0,.04,0,lampMaterial,group);}
    else if(toy==='key'){const bow=new T.Mesh(new T.TorusGeometry(.027,.007,6,20),trim);bow.position.y=.07;group.add(bow);box(.012,.075,.013,0,.02,0,trim,group);box(.025,.012,.013,.012,-.01,0,trim,group);}
    else if(toy==='house'){box(.08,.075,.06,0,.025,0,cloth,group);const roof=new T.Mesh(new T.ConeGeometry(.067,.05,4),accent);roof.rotation.y=Math.PI/4;roof.position.y=.08;group.add(roof);}
    else {ball(.043,0,.025,0,accent,group);cyl(.024,.055,0,-.015,0,cloth,group);}
    group.traverse(n=>{if(n instanceof T.Mesh)n.userData.playTarget=item.slot;});
   }
   // Geometry belongs to this display instance; shared materials belong to the room.
   group.traverse(n=>{if(n instanceof T.Mesh&&!displayGeometry.includes(n.geometry))displayGeometry.push(n.geometry);});
  }
 }
 // Small physical discoveries occupy authored surfaces in each environment.
 const discoveryObjects:Record<string,T.Group>={};
 function prop(id:string,x:number,y:number,z:number){const g=new T.Group();g.position.set(x,y,z);g.userData.playTarget=id;root.add(g);discoveryObjects[id]=g;return g;}
 const drawer=prop('drawer',-.48,.105,-.26);box(.27,.048,.08,0,0,0,wood,drawer);ball(.012,0,0,.05,trim,drawer);const mouse=ball(.025,0,.036,-.02,cloth,drawer);mouse.scale.z=1.6;
 const bell=prop('bell',-1.25,.365,-.14);cyl(.04,.009,0,0,0,trim,bell);ball(.027,0,.017,0,trim,bell);ball(.008,0,.045,0,wood,bell);
 const motif=prop('lamp',.49,1.1,-.66);for(let i=0;i<5;i++)ball(.012,Math.sin(i*2.4)*.04,Math.cos(i*2.4)*.04,0,trim,motif);motif.visible=false;
 const latch=prop('latch',-1.74,.91,-.48);box(.17,.25,.025,.085,0,0,wood,latch);ball(.015,.15,0,.025,trim,latch);latch.visible=theme==='classic';
 const tea=prop('tea',-1.67,.38,-.1);cyl(.038,.006,0,-.009,0,cloth,tea);cyl(.022,.035,0,.01,0,cloth,tea);const handle=new T.Mesh(new T.TorusGeometry(.013,.004,6,16),trim);handle.position.set(.027,.015,0);tea.add(handle);tea.visible=theme==='classic';
 const paper=prop('paper',1.48,.25,-.3);for(let i=0;i<5;i++){const page=box(.09,.17,.012,(i-2)*.08,.08,0,i%2?cloth:accent,paper);page.rotation.y=(i%2?1:-1)*.25;}paper.scale.y=.18;paper.visible=theme==='taylor';
 const ribbon=prop('ribbon',1.85,1.3,-.5);box(.06,.5,.025,0,0,0,accent,ribbon);for(const x of [-.04,.04]){const loop=ball(.043,x,0,0,cloth,ribbon);loop.scale.y=.65;}ribbon.visible=theme==='taylor';
 const lighthouse=prop('lighthouse',1.68,.3,-.38);cyl(.025,.16,0,.07,0,cloth,lighthouse);const roof=new T.Mesh(new T.ConeGeometry(.04,.04,12),accent);roof.position.y=.17;lighthouse.add(roof);const beamMaterial=new T.MeshBasicMaterial({color:'#ffeaa7',transparent:true,opacity:.14,depthWrite:false});const beam=new T.Mesh(new T.ConeGeometry(.15,.65,20,1,true),beamMaterial);beam.rotation.z=-Math.PI/2;beam.position.set(.32,.14,0);lighthouse.add(beam);lighthouse.visible=theme==='newfoundland';
 const boat=prop('boat',1.43,.28,-.3);const hull=ball(.05,0,0,0,wood,boat);hull.scale.set(1.6,.35,.5);box(.005,.12,.006,0,.06,0,trim,boat);const sail=new T.Mesh(new T.ConeGeometry(.05,.1,3),cloth);sail.scale.z=.06;sail.position.set(.018,.07,0);boat.add(sail);boat.visible=theme==='newfoundland';
 for(const [id,group] of Object.entries(discoveryObjects))group.traverse(n=>{if(n instanceof T.Mesh)n.userData.playTarget=id;});
 const toyMotion=new T.Group();root.add(toyMotion);const spool=cyl(.025,.05,.38,.03,.32,accent,toyMotion);spool.rotation.z=Math.PI/2;spool.userData.playTarget='spool';let performance:PlayDiscovery|string='',started=0;
 function perform(id:string,still=false,cue?:PlayPerformance){performance=id;started=Date.now()/1000;
 if(cue?.colour&&/^#[a-f0-9]{6}$/i.test(cue.colour))glow.color.set(cue.colour);
 if(cue?.portrait&&(id==='projector'||id==='theatre')){const token=generation;new T.TextureLoader().load(cue.portrait,t=>{if(token!==generation){t.dispose();return;}textures.push(t);t.colorSpace=T.SRGBColorSpace;const mat=new T.MeshBasicMaterial({map:t});displayMaterials.push(mat);const g=displays.children.find(g=>g.userData.rewardId===id);if(g){const old=g.getObjectByName('toy-projection');if(old)g.remove(old);const plane=new T.PlaneGeometry(id==='projector'?.35:.12,id==='projector'?.44:.105);displayGeometry.push(plane);const picture=new T.Mesh(plane,mat);picture.name='toy-projection';picture.position.set(0,id==='projector'?.24:.045,id==='projector'?-.1:.041);g.add(picture);onInvalidate();}});}
 if(still)tick(1.3);
 }
 function tick(stillAge?:number){const age=stillAge??Date.now()/1000-started;if(age>4){spool.position.x=.38;glow.intensity=1.3;return;}const wave=Math.sin(age*Math.PI/4);if(performance==='spool'){spool.position.x=.38+Math.sin(age*2)*.3;spool.rotation.x=age*3;}
 if(performance==='drawer')drawer.position.z=-.26+wave*.14;
 if(performance==='bell')bell.rotation.z=Math.sin(age*12)*.08*(1-age/4);
 if(performance==='lamp')motif.visible=true;
 if(performance==='latch')latch.rotation.y=-wave*1.1;
 if(performance==='tea')tea.rotation.z=wave*.23;
 if(performance==='paper')paper.scale.y=.18+wave*.82;
 if(performance==='ribbon')ribbon.rotation.z=wave*.45;
 if(performance==='boat'){boat.rotation.z=Math.sin(age*4)*.12;boat.position.y=.28+Math.sin(age*3)*.015;}
 if(performance==='lighthouse'){lighthouse.rotation.y=age*1.5;glow.intensity=1.3+Math.sin(age*2)*.6;}
 if(performance==='lantern')glow.intensity=1.3+wave*.7;
 displays.children.forEach(g=>{if((g.userData.rewardId===performance)||performance==='portrait'&&g.userData.kind==='portrait'){g.rotation.y=Math.sin(age*2)*.12;if(performance==='theatre'){const left=g.getObjectByName('curtain-left'),right=g.getObjectByName('curtain-right');if(left)left.position.x=-.045-wave*.025;if(right)right.position.x=.045+wave*.025;}if(performance==='orrery')g.rotation.y=age*.6;if(performance==='key')g.rotation.z=wave*.45;}});
 }
 function apply(p:RoomPalette){key.intensity=p.dark?1.2:2.8;ambient.intensity=p.dark?.65:1.6;scene.background=new T.Color(p.dark?'#343238':theme==='taylor'?'#e7d9d9':theme==='newfoundland'?'#b6c8c6':'#dad0ba');wall.color.set(p.dark?'#6b6260':theme==='taylor'?'#e7d9d9':theme==='newfoundland'?'#b6c8c6':'#dad0ba');}
 function style(d:PlayDecor){composition=d.composition;trim.color.set(d.frame==='wood'?'#76513b':d.frame==='paper'?'#f5e5de':'#bba16b');wood.color.set(d.furnishing==='deep'?'#41464e':d.furnishing==='light'?'#bda88c':theme==='taylor'?'#b67686':theme==='newfoundland'?'#345968':'#805940');key.color.set(d.lighting==='lamplight'?'#ffd494':d.lighting==='studio'?'#eef0ff':'#fff3d7');}
 function dispose(){clearDisplays();ownedTextures.forEach(t=>t.dispose());root.traverse(n=>{if(n instanceof T.Mesh){n.geometry.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});scene.remove(root);}
 return {materials,apply,dispose,setDisplays,style,perform,tick};
}
export const PLAY_CAMERAS:Record<PlayArea|'room',{position:[number,number,number];target:[number,number,number]}>={
 room:{position:[.6,1.03,2.95],target:[0,.76,-.15]},dressing:{position:[.6,.52,1.3],target:[0,.28,0]},gallery:{position:[.15,1.22,1.5],target:[.04,1.18,-.68]},banks:{position:[1.05,.81,1],target:[.99,.63,-.45]},cabinet:{position:[-1.3,1.02,1.2],target:[-1.27,1,-.5]},window:{position:[1.47,.74,1.2],target:[1.46,.67,-.35]},desk:{position:[-1.34,.74,1.2],target:[-1.42,.35,-.17]}};
