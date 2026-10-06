import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {VehicleDressing} from '../movers/shared/vehicleArt.ts';
import type {AircraftState} from './flight.ts';
import {AIRCRAFT,type AircraftId} from './aircraft.ts';
import {AIRPORT,AIRPORT_BOXES,AIRPORT_DECKS,AIRPORT_VAULTS,vaultTop} from './layout.ts';
import {buildingPalette} from '../kit/buildings/palette.ts';
const dispose=(root:THREE.Object3D)=>{const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);}});gs.forEach(g=>g.dispose());ms.forEach(m=>{if('map'in m)(m.map as THREE.Texture|null)?.dispose();m.dispose();});root.removeFromParent();};
/** Static pieces batch by material: the authored detail does not multiply draw calls. */
function builder(root:THREE.Group){const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();return{
 add(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,rx=0,ry=0,rz=0){if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1)));const a=batches.get(m)??[];a.push(g);batches.set(m,a);},
 box(m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,rx=0,ry=0,rz=0){this.add(new THREE.BoxGeometry(w,h,d),m,x,y,z,rx,ry,rz);},
 finish(){for(const [m,gs]of batches){const mesh=new THREE.Mesh(mergeGeometries(gs),m);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);gs.forEach(g=>g.dispose());}batches.clear();}
};}
/**
 * Pictogram boards (STYLE §1.10, RULINGS 4, D-WW161): the airport's signs carry no words — a plane over the horizon for the
 * station, the three aircraft for the flight board and the stands, a cup, binoculars and a stair, a wrench. Board and ink per
 * dressing (Classic engraved timber, Taylor a scrapbook tag, Newfoundland sign-writer paint).
 */
type Icon='station'|'room'|'board'|'hangar'|'terrace'|'cafe'|'kestrel'|'swift'|'heron';
const BOARD:Record<VehicleDressing,{bg:string;ink:string;edge:string}>={classic:{bg:'#193b40',ink:'#f2e6c8',edge:'#9b6747'},taylor:{bg:'#fff4e4',ink:'#6d4a64',edge:'#e8a6bd'},newfoundland:{bg:'#2f5b63',ink:'#f5f3ea',edge:'#f5f3ea'}};
function pictogram(ctx:CanvasRenderingContext2D,icon:Icon,w:number,h:number,ink:string,accent:string,bg:string){
 const plane=(cx:number,cy:number,s:number,kind:'mono'|'bi'|'twin'=  'mono')=>{ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);ctx.beginPath();ctx.ellipse(0,0,7,30,0,0,Math.PI*2);ctx.fill();
  ctx.fillRect(-34,kind==='bi'?-16:-10,68,10);if(kind==='bi')ctx.fillRect(-30,0,60,8);if(kind==='twin')for(const x of [-16,16]){ctx.beginPath();ctx.ellipse(x,-8,5,12,0,0,Math.PI*2);ctx.fill();}
  ctx.fillRect(-14,22,28,6);ctx.restore();};
 const person=(cx:number,cy:number,s:number)=>{ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.arc(0,-26,7,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(2,6);ctx.moveTo(2,6);ctx.lineTo(-8,26);ctx.moveTo(2,6);ctx.lineTo(12,24);ctx.moveTo(0,-10);ctx.lineTo(-12,2);ctx.moveTo(0,-10);ctx.lineTo(12,-2);ctx.stroke();ctx.restore();};
 const arrow=(cx:number,cy:number,s:number,a=0)=>{ctx.save();ctx.translate(cx,cy);ctx.rotate(a);ctx.scale(s,s);ctx.beginPath();ctx.moveTo(-20,-5);ctx.lineTo(6,-5);ctx.lineTo(6,-14);ctx.lineTo(22,0);ctx.lineTo(6,14);ctx.lineTo(6,5);ctx.lineTo(-20,5);ctx.closePath();ctx.fill();ctx.restore();};
 const dots=(cx:number,cy:number,n:number)=>{for(let i=0;i<n;i++){ctx.beginPath();ctx.arc(cx+(i-(n-1)/2)*16,cy,5,0,Math.PI*2);ctx.fill();}};
 ctx.fillStyle=ink;ctx.strokeStyle=ink;const m=h/2;
 if(icon==='station'){ctx.fillRect(w*.2,m+22,w*.6,4);ctx.beginPath();ctx.arc(w/2,m+22,20,Math.PI,0);ctx.fill();ctx.fillStyle=accent;plane(w/2,m-10,.8);}
 else if(icon==='room'){ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(w/2-70,m-24);ctx.lineTo(w/2-70,m+28);ctx.moveTo(w/2-70,m+6);ctx.lineTo(w/2-34,m+6);ctx.lineTo(w/2-34,m+28);ctx.stroke();ctx.beginPath();ctx.arc(w/2+40,m,26,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(w/2+40,m);ctx.lineTo(w/2+40,m-16);ctx.moveTo(w/2+40,m);ctx.lineTo(w/2+52,m+6);ctx.stroke();}
 else if(icon==='board'){plane(w*.18,m,.95,'mono');plane(w*.38,m,.95,'bi');plane(w*.58,m,.95,'twin');ctx.fillStyle=accent;person(w*.78,m+2,1);arrow(w*.9,m,1);}
 else if(icon==='hangar'){ctx.beginPath();ctx.arc(w*.32,m+30,46,Math.PI,0);ctx.lineTo(w*.32+46,m+34);ctx.lineTo(w*.32-46,m+34);ctx.closePath();ctx.lineWidth=7;ctx.stroke();plane(w*.32,m+8,.55);ctx.save();ctx.translate(w*.7,m);ctx.rotate(-.7);ctx.fillRect(-6,-34,12,52);ctx.beginPath();ctx.arc(0,-34,16,0,Math.PI*2);ctx.fill();ctx.fillStyle=bg;ctx.fillRect(-5,-54,10,22);ctx.restore();}
 else if(icon==='terrace'){ctx.lineWidth=6;for(const x of [-18,18]){ctx.beginPath();ctx.arc(w*.3+x,m+8,15,0,Math.PI*2);ctx.stroke();}ctx.fillRect(w*.3-6,m-4,12,10);ctx.beginPath();ctx.moveTo(w*.55,m+30);for(let i=0;i<4;i++){ctx.lineTo(w*.55+i*18,m+30-i*16);ctx.lineTo(w*.55+(i+1)*18,m+30-i*16);}ctx.stroke();arrow(w*.86,m-12,.9,-Math.PI/4);}
 else if(icon==='cafe'){ctx.beginPath();ctx.moveTo(w/2-26,m-10);ctx.lineTo(w/2+22,m-10);ctx.lineTo(w/2+16,m+28);ctx.lineTo(w/2-20,m+28);ctx.closePath();ctx.fill();ctx.lineWidth=6;ctx.beginPath();ctx.arc(w/2+26,m+6,10,-Math.PI/2,Math.PI/2);ctx.stroke();for(const x of [-12,0,12]){ctx.beginPath();ctx.moveTo(w/2+x,m-18);ctx.bezierCurveTo(w/2+x+8,m-26,w/2+x-8,m-34,w/2+x,m-42);ctx.stroke();}}
 else{plane(w*.38,m,1,icon==='kestrel'?'mono':icon==='swift'?'bi':'twin');ctx.fillStyle=accent;dots(w*.75,m,icon==='kestrel'?1:icon==='swift'?2:3);}
}
function board(root:THREE.Group,theme:VehicleDressing,icon:Icon,x:number,y:number,z:number,width:number,height:number,yaw=0,frame?:string){
 if(typeof document==='undefined')return;
 const px=128,c=document.createElement('canvas');c.width=Math.round(px*width/height);c.height=px;const ctx=c.getContext('2d')!,k=BOARD[theme],w=c.width,h=c.height;
 ctx.fillStyle=frame??k.edge;ctx.fillRect(0,0,w,h);ctx.fillStyle=k.bg;ctx.fillRect(6,6,w-12,h-12);
 if(theme==='taylor'){ctx.fillStyle='#f3c4d2';ctx.save();ctx.translate(14,10);ctx.rotate(-.5);ctx.fillRect(-18,-6,36,12);ctx.restore();ctx.save();ctx.translate(w-14,10);ctx.rotate(.5);ctx.fillRect(-18,-6,36,12);ctx.restore();}
 pictogram(ctx,icon,w,h,k.ink,theme==='taylor'?'#c46f8e':'#e8c547',k.bg);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:t,side:THREE.FrontSide}));mesh.position.set(x,y,z);mesh.rotation.y=yaw;root.add(mesh);
}
const hex=(c:readonly [number,number,number])=>new THREE.Color().setRGB(c[0],c[1],c[2]);
/** The Quonset's barrel as triangles (one definition: layout.ts vaultTop), split into alternating tin strips. */
function vaultGeometry(v:typeof AIRPORT_VAULTS[number],strips:number,lift=0){
 const half=(v.z1-v.z0)/2,zc=(v.z0+v.z1)/2,P=(x:number,i:number):[number,number,number]=>{const z=v.z0+(v.z1-v.z0)*i/strips;return [x,vaultTop(v,x,Math.min(v.z1,Math.max(v.z0,z)))!+lift,z];};
 const even:number[]=[],odd:number[]=[],ends:number[]=[];
 for(let i=0;i<strips;i++){const a=P(v.x0,i),b=P(v.x1,i),c=P(v.x1,i+1),d=P(v.x0,i+1),t=i%2?odd:even;t.push(...a,...d,...c,...a,...c,...b);}
 for(const x of [v.x0,v.x1])for(let i=0;i<strips;i++){const a=P(x,i),b=P(x,i+1),o=[x,v.spring+lift,zc];ends.push(...o,...(x===v.x0?b:a),...(x===v.x0?a:b));}
 const geo=(arr:number[])=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(arr.length/3*2).fill(0),2));g.computeVertexNormals();return g;};
 void half;return {even:geo(even),odd:geo(odd),ends:geo(ends)};
}
export function aircraftArt(id:AircraftId,theme:VehicleDressing){
 const spec=AIRCRAFT[id],root=new THREE.Group(),b=builder(root),paint=new THREE.MeshStandardMaterial({color:theme==='taylor'?(id==='swift'?'#d37d99':spec.color):theme==='newfoundland'?(id==='heron'?'#b5d1d8':spec.color):spec.color,roughness:.42,metalness:.15}),trim=new THREE.MeshStandardMaterial({color:spec.trim,roughness:.45}),black=new THREE.MeshStandardMaterial({color:'#252d32',roughness:.8}),glass=new THREE.MeshStandardMaterial({color:'#8fb7c6',roughness:.15,metalness:.3});
 const len=spec.length,wing=spec.wing,twin=id==='heron',bi=id==='swift';
 b.add(new THREE.SphereGeometry(1,12,8).scale(twin?.85:.62,.7,len/2),paint,0,1.3,0);
 b.box(glass,0,1.9,.9,twin?1.45:1.05,.65,1.7, -.13);
 b.box(paint,0,bi?1.1:twin?1.1:2.25,.25,wing,.15,twin?1.9:1.35);
 if(bi){b.box(paint,0,2.7,.1,wing,.14,1.3);for(const x of [-3,3])for(const z of [-.3,.5])b.box(trim,x,1.95,z,.08,1.5,.08);}
 else if(!twin)for(const x of [-1,1])b.box(trim,x*2.1,1.3,.25,.07,2.6,.08,0,0,-x*.85);
 b.box(trim,0,1.5,-len*.39,wing*.35,.13,1.1);
 b.box(paint,0,2,-len*.4,.14,1.9,1.1, .1);
 for(const x of [-1,1]){b.box(trim,x*.95,.65,.5,.08,1.1,.08,0,0,x*.2);b.add(new THREE.CylinderGeometry(.37,.37,.25,12),black,x*1.1,.38,.5,0,0,Math.PI/2);}
 b.add(new THREE.CylinderGeometry(.2,.2,.16,10),black,0,.22,-len*.37,0,0,Math.PI/2);
 const props:THREE.Mesh[]=[];
 for(const x of twin?[-2.8,2.8]:[0]){const nose=twin?1.5:len/2-.1;if(twin)b.add(new THREE.SphereGeometry(1,10,8).scale(.45,.5,1.6),paint,x,1.3,.65);b.add(new THREE.ConeGeometry(.3,.55,12),trim,x,1.3,nose+.2,Math.PI/2);const prop=new THREE.Mesh(new THREE.BoxGeometry(.12,twin?2.3:2.1,.06),black);prop.position.set(x,1.3,nose+.5);root.add(prop);props.push(prop);}
 b.finish();
 return{root,update(s:AircraftState,dt:number,firstPerson=false){root.position.set(s.x,s.y,s.z);root.rotation.set(-s.pitch,s.yaw,-s.bank,'YXZ');root.visible=!(s.disabled&&!s.grounded)&&!firstPerson;for(const p of props)p.rotation.z+=dt*(s.occupied?8+s.throttle*70:0);},dispose:()=>dispose(root)};
}
export function airportArt(theme:VehicleDressing){
 const root=new THREE.Group(),detail=new THREE.Group(),map=new THREE.Group(),roofs=new THREE.Group(),lights=new THREE.Group();root.add(detail,map);detail.add(roofs,lights);
 // The hybrid re-skin (STYLE §2.4, D-WW160): THE hangar is a tin Quonset, the terminal a timber prairie station; the tower's
 // footprint carries the grain elevator, drawn by the Flats dressing (neighbourhoods/flats) over these unchanged boxes. Every
 // colour is the building kit's `flats.prairie` sheet in this dressing (one palette with the elevator and the observatory).
 const pal=buildingPalette(theme,'flats.prairie'),S=(c:readonly [number,number,number],r=.85,extra:THREE.MeshStandardMaterialParameters={})=>new THREE.MeshStandardMaterial({color:hex(c),roughness:r,...extra});
 const floor=theme==='taylor'?'#e5d8c3':theme==='newfoundland'?'#b8bcb4':'#d1c1a5';
 const mats={cedar:S(pal.timber),copper:S(pal.roofs[0]!,.6),stone:new THREE.MeshStandardMaterial({color:floor,roughness:.95}),glass:new THREE.MeshStandardMaterial({color:'#a4c7c2',transparent:true,opacity:.3,roughness:.2,depthWrite:false,side:THREE.DoubleSide}),paving:new THREE.MeshStandardMaterial({color:'#606768',roughness:.98}),paint:new THREE.MeshStandardMaterial({color:'#ead6a1',roughness:.8}),soil:S(pal.plinthDark,1)};
 const tin=S(pal.tin,.5,{metalness:.35,side:THREE.DoubleSide}),tinAlt=S(pal.tinAlt,.5,{metalness:.35,side:THREE.DoubleSide}),tinEnd=S(pal.tinAlt,.55,{metalness:.3,side:THREE.DoubleSide}),ceiling=S(pal.tin,.7,{color:hex(pal.tin).multiplyScalar(.55)});
 const station=S(pal.walls[0]!,.9),batten=S(pal.timberDark,.9),trim=S(pal.trim,.8),canvas=S(pal.canvas,.95,{side:THREE.DoubleSide}),canvasAlt=S(pal.canvas,.95,{side:THREE.DoubleSide,color:hex(pal.canvas).multiplyScalar(.9)}),yellow=S(pal.doorAccent,.6),rust=S(pal.rust,.9),pier=S(pal.plinth,.95),grass=S(theme==='newfoundland'?[.45,.42,.3]:[.7,.48,.25],1),bloom=S(theme==='taylor'?[.92,.7,.85]:[.7,.35,.56],.9),iron=S([.16,.16,.17],.6,{metalness:.4});
 const b=builder(detail),r=builder(roofs),m=builder(map);
 const hangarWalls=new Set(['hangar-west','hangar-north','hangar-south-west','hangar-south-east']),stationWalls=new Set(['terminal-west','terminal-south']),elevatorBoxes=new Set(['tower-base','tower-cabin','tower-cap']);
 for(const q of AIRPORT_BOXES){
  if(elevatorBoxes.has(q.id))continue;   // inside the elevator (neighbourhoods/flats draws it over these boxes; their collision is unchanged)
  const mat=hangarWalls.has(q.id)?tin:stationWalls.has(q.id)?station:q.id==='hangar-roof'?ceiling:q.id==='observation-roof'?mats.cedar:mats[q.material];
  (q.roof?r:b).box(mat,q.x,q.y,q.z,q.w,q.h,q.d);if(q.roof)m.box(mats[q.material],q.x,q.y,q.z,q.w,q.h,q.d);
 }
 for(const d of AIRPORT_DECKS){const dx=d.b[0]-d.a[0],dy=d.b[1]-d.a[1],dz=d.b[2]-d.a[2],length=Math.hypot(dx,dy,dz),yaw=Math.atan2(dx,dz),pitch=-Math.atan2(dy,Math.hypot(dx,dz));for(const target of [b,m])target.box(mats.paving,(d.a[0]+d.b[0])/2,(d.a[1]+d.b[1])/2-.105,(d.a[2]+d.b[2])/2,d.width,.24,length,pitch,yaw);
  // Visible structural piers carry the raised campus (ochre plinths, protos/flats finding 5); no disguised terrain replacement.
  if(d.id!=='arrival-drive')for(const f of [.15,.5,.85]){const x=d.a[0]+dx*f,y=d.a[1]+dy*f,z=d.a[2]+dz*f;b.box(pier,x,y-3,z,.55,6,.55);}
 }
 /* ---- the Quonset: corrugated tin walls, the barrel (layout AIRPORT_VAULTS), ribs, rust, the canvas curtain tied back ---- */
 for(const v of AIRPORT_VAULTS){const g=vaultGeometry(v,16);r.add(g.even,tin,0,0,0);r.add(g.odd,tinAlt,0,0,0);r.add(g.ends,tinEnd,0,0,0);const mg=vaultGeometry(v,8);m.add(mg.even,tin,0,0,0);m.add(mg.odd,tin,0,0,0);m.add(mg.ends,tin,0,0,0);
  // Ribs over the barrel every ~3.25 m and the eave angles; Taylor tapes its lid instead of rusting it.
  for(let i=0;i<=8;i++){const x=v.x0+(v.x1-v.x0)*i/8,pts:THREE.Vector3[]=[];for(let k=0;k<=16;k++){const z=v.z0+(v.z1-v.z0)*k/16;pts.push(new THREE.Vector3(x,vaultTop(v,x,z)!+.06,z));}r.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,.09,4,false),theme==='newfoundland'?trim:tinEnd,0,0,0);}
  for(const z of [v.z0,v.z1])r.box(tinEnd,(v.x0+v.x1)/2,v.spring-.05,z,v.x1-v.x0,.12,.18);
  if(theme==='taylor'){const tapes=pal.tape.map(c=>S(c,.9,{side:THREE.DoubleSide}));for(const [i,x] of [386.5,395,403.5].entries())for(let k=0;k<16;k++){const za=v.z0+(v.z1-v.z0)*k/16,zb=v.z0+(v.z1-v.z0)*(k+1)/16,ya=vaultTop(v,x,za)!,yb=vaultTop(v,x,zb)!;r.box(tapes[i%tapes.length]!,x,(ya+yb)/2+.05,(za+zb)/2,.7,.03,Math.hypot(zb-za,yb-ya)+.02,-Math.atan2(yb-ya,zb-za));}}
  else for(const [x,z,len] of [[386,574,2.2],[391.5,577.5,1.6],[399,595,2.6],[404,573,1.4],[389,592,2]] as const){const y=vaultTop(v,x,z)!;b.box(rust,x,y+.07,z,.5,.05,len,-Math.atan(vaultTop(v,x,z+.5)!-vaultTop(v,x,z-.5)!));}
 }
 // Corrugation: thin standing ribs on the tin walls' outer faces (every 0.6 m) and a few rust runs at their feet.
 for(const q of AIRPORT_BOXES)if(hangarWalls.has(q.id)){const alongX=q.w>q.d,len=alongX?q.w:q.d,n=Math.floor(len/.6),out=q.id==='hangar-west'?-1:q.id==='hangar-north'?-1:1;
  for(let i=1;i<n;i++){const t=-len/2+i*len/n;if(alongX)b.box(tinAlt,q.x+t,q.y,q.z+out*(q.d/2+.03),.07,q.h,.06);else b.box(tinAlt,q.x+out*(q.w/2+.03),q.y,q.z+t,.06,q.h,.07);}
  if(theme!=='taylor')for(let i=0;i<Math.floor(len/7);i++){const t=-len/2+3+i*7;if(alongX)b.box(rust,q.x+t,38.9,q.z+out*(q.d/2+.07),.35,1.6,.02);else b.box(rust,q.x+out*(q.w/2+.07),38.9,q.z+t,.02,1.6,.35);}}
 // The east mouth: a canvas valance under the barrel and the curtain tied back in two tight bundles against the wall ends
 // (inside the walls' own contact band, so nothing stands in the clear span; protos/flats §2.1 "must not close the span").
 b.box(canvas,407.9,44.45,585,.06,.7,25.6);for(const z of [572.4,597.6]){b.add(new THREE.CylinderGeometry(.2,.26,6.6,7),canvasAlt,407.25,41.3,z);for(const y of [40.2,42.4])b.box(iron,407.25,y,z,.48,.08,.48);}
 // The walkers' door on the south (the promenade's end): a timber frame, bush-plane yellow leaves folded back, the lamp housing.
 for(const x of [397,403])b.box(mats.cedar,x,40.3,598.2,.18,4.6,.2);b.box(mats.cedar,400,42.7,598.2,6.3,.25,.22);for(const x of [395.85,404.15])b.box(yellow,x,39.6,598.22,2.1,3.2,.06);
 b.box(iron,400,43.35,598.35,.5,.35,.3);b.box(mats.glass,400,43.1,598.45,.3,.2,.2);
 // Timber trusses under the ceiling, the inner corrugation, the workshop's tools.
 for(let x=383;x<=407;x+=3)b.box(mats.cedar,x,44.5,585,.16,.45,26);
 for(let z=574;z<598;z+=2)b.box(tinAlt,383.25,41,z,.1,5,.06);
 for(let i=0;i<12;i++)b.box(mats.copper,384.4+i*.3,39.7,575.2,.08,.35+(i%3)*.1,.08);
 /* ---- the station: board-and-batten timber, deep eaves on brackets, canvas awnings, yellow doors ---- */
 for(const q of AIRPORT_BOXES)if(stationWalls.has(q.id)){const alongX=q.w>q.d,len=alongX?q.w:q.d,n=Math.floor(len/.7),out=q.id==='terminal-west'?-1:1;
  for(let i=1;i<n;i++){const t=-len/2+i*len/n;if(alongX)b.box(batten,q.x+t,q.y,q.z+out*(q.d/2+.03),.08,q.h,.05);else b.box(batten,q.x+out*(q.w/2+.03),q.y,q.z+t,.05,q.h,.08);}
  if(alongX)b.box(pier,q.x,38.25,q.z+out*(q.d/2+.05),q.w,.5,.08);else b.box(pier,q.x+out*(q.w/2+.05),38.25,q.z,.08,.5,q.d);
  // Windows (flush panes in timber surrounds; the wall stays solid, as its box).
  for(let i=0;i<3;i++){const t=-len/2+len*(i+.5)/3;if(alongX){b.box(trim,q.x+t,40.3,q.z+out*(q.d/2+.05),1.5,1.8,.04);b.box(mats.glass,q.x+t,40.3,q.z+out*(q.d/2+.08),1.2,1.5,.02);}else{b.box(trim,q.x+out*(q.w/2+.05),40.3,q.z+t,.04,1.8,1.5);b.box(mats.glass,q.x+out*(q.w/2+.08),40.3,q.z+t,.02,1.5,1.2);}}}
 // The observation roof's fascia (the deck stays usable at 42.2; the rails are its own) and the deep eaves' brackets.
 b.box(trim,394,41.95,660.97,24.1,.5,.06);b.box(trim,394,41.95,689.03,24.1,.5,.06);b.box(trim,381.97,41.95,675,.06,.5,28.1);b.box(trim,406.03,41.95,675,.06,.5,28.1);
 for(let z=670;z<=686;z+=4){b.box(mats.cedar,382.5,41.15,z,1.2,.12,.12,0,0,-.62);}for(let x=385;x<=403;x+=4){b.box(mats.cedar,x,41.15,688.5,.12,.12,1.2,-.62);}
 // Canvas awnings hung from the roof's edge (no posts: nothing stands on the court or the terrace), ≥ 2.8 eu clear.
 const awning=(x0:number,x1:number,z0:number,z1:number,along:'x'|'z')=>{const n=Math.max(2,Math.round((along==='x'?x1-x0:z1-z0)/1.2));for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n,mat=i%2?canvasAlt:canvas;
  if(along==='x'){const x=x0+(x1-x0)*(t0+t1)/2,w=(x1-x0)/n;b.box(mat,x,41.48,(z0+z1)/2,w,.06,Math.abs(z1-z0),Math.atan2(.55,Math.abs(z1-z0))*Math.sign(z1-z0));b.box(mat,x,41.05,z1,w,.4,.04);}
  else{const z=z0+(z1-z0)*(t0+t1)/2,w=(z1-z0)/n;b.box(mat,(x0+x1)/2,41.48,z,Math.abs(x1-x0),.06,w,0,0,-Math.atan2(.55,Math.abs(x1-x0))*Math.sign(x1-x0));b.box(mat,x1,41.05,z,.04,.4,w);}}};
 awning(386,402,660.9,658.3,'x');awning(406.1,408.9,666,684,'z');
 // The entry: a timber frame and bush-plane yellow door leaves folded against the glass (inside the room).
 for(const x of [391,397])b.box(mats.cedar,x,39.35,662,.16,2.7,.32);b.box(mats.cedar,394,40.75,662,6.2,.2,.32);for(const x of [390.25,397.75])b.box(yellow,x,39.2,662.24,1.4,2.4,.05);
 // Warm timber ceiling and mullions give the room a human scale.
 for(let z=664;z<=687;z+=2)b.box(mats.cedar,394,41.65,z,21,.18,.13);
 for(let x=384;x<406;x+=3)b.box(mats.cedar,x,40,662,.16,4,.25);
 for(let z=663;z<=687;z+=3)b.box(mats.cedar,405.02,40,z,.12,3.8,.1);
 for(const z of [672,678]){b.box(mats.copper,388,38.56,z,3,.08,2);b.box(mats.cedar,387,38.9,z, .18,.8,2);}
 // Airport-owned ramp rails and window ledges frame usable surfaces.
 for(const x of [378.8,381.2])b.box(mats.cedar,x,40.9,668, .09,.09,32,-Math.atan2(4.2,31.75));
 b.box(mats.cedar,404.8,38.9,680,.4,.15,7);
 // Floor furnishings and café cups; the flight board's frame in bush-plane yellow.
 for(const [x,z]of [[389,672],[389,678],[407,671],[407,679]] as const){b.add(new THREE.CylinderGeometry(.7,.7,.12,12),mats.copper,x,38.75,z);b.box(mats.cedar,x,38.4,z,.12,.8,.12);b.add(new THREE.CylinderGeometry(.09,.07,.18,8),mats.stone,x+.2,38.9,z);}
 b.box(yellow,399,40,665.06,8.3,1.15,.05);
 // The garden beds: tallgrass and coneflower drifts (STYLE §2.4) on the soil.
 for(const z of [612,634])for(let i=0;i<14;i++){const x=389.2+(i%5)*1.9+((i*7)%3)*.2,zz=z-3+Math.floor(i/5)*2.6+((i*5)%3)*.3,h=.55+((i*11)%5)*.08;b.add(new THREE.ConeGeometry(.28,h,5),grass,x,38.6+h/2,zz);if(i%3===0)b.add(new THREE.IcosahedronGeometry(.13,0),bloom,x+.3,38.6+h*.8,zz+.2);}
 for(const [x,y,z]of [[377.4,35.3,691.3],[380,37,672]] as const){b.box(mats.copper,x,y+1.5,z,.14,3,.14);}
 // Runway paint follows the existing diagonal strip exactly.
 const a=AIRPORT.runway.a,c=AIRPORT.runway.b,yaw=Math.atan2(c[0]-a[0],c[2]-a[2]);
 for(let i=0;i<16;i++){const f=(i+.5)/16;b.box(mats.paint,a[0]+(c[0]-a[0])*f,38.035,a[2]+(c[2]-a[2])*f,.6,.035,9,0,yaw);}
 for(const f of [.04,.96])for(const side of [-1,1])for(let i=0;i<4;i++)b.box(mats.paint,a[0]+20*f+side*(3+i*2),38.035,a[2]+340*f,1,.035,10,0,yaw);
 // Taxi centreline and the stands (each marked by a pictogram board: its aircraft's shape, one to three dots).
 for(let z=601;z<652;z+=3)b.box(mats.paint,413+(z-600)*3/51,38.035,z,.2,.03,2);
 for(const [id,at]of Object.entries(AIRPORT.stands)){b.box(mats.paint,at.x,38.035,at.z,6,.03,.14);board(detail,theme,id as Icon,at.x-5,39,at.z,3,1,Math.PI/2);}
 // Bounded local illumination: five useful pools, no dynamic shadow maps (pre-existing; LIGHT D-R3 pool flagged in the handoff).
 const glow=new THREE.MeshBasicMaterial({color:'#ffdba1'}),blue=new THREE.MeshBasicMaterial({color:'#77b6ee'}),white=new THREE.MeshBasicMaterial({color:'#fff0c6'}),green=new THREE.MeshBasicMaterial({color:'#71d9a2'}),lb=builder(lights);
 for(const [x,z]of [[390,669],[397,681],[394,581],[386,650]] as const){const light=new THREE.PointLight('#ffcf91',100,23,2);light.position.set(x,41,z);lights.add(light);lb.box(glow,x,41.6,z,2,.08,.4);}
 const approachLight=new THREE.PointLight('#ffcf91',65,20,2);approachLight.position.set(377.4,38.3,691.3);lights.add(approachLight);lb.box(glow,377.4,38.3,691.3,.35,.12,.35);
 for(let z=520;z<=860;z+=20)for(const side of [-1,1]){const x=425+(z-520)/17+side*14.5;lb.box(white,x,38.13,z,.28,.2,.28);}
 for(const z of [522,858])for(let x=-10;x<=10;x+=5)lb.box(green,425+(z-520)/17+x,38.15,z,.3,.2,.3);
 for(let z=600;z<659;z+=8)lb.box(blue,420,38.15,z,.25,.2,.25);
 for(let z=606;z<659;z+=10){b.box(mats.copper,399,38.6,z,.13,1.2,.13);lb.box(glow,399,39.2,z,.23,.12,.23);lb.box(new THREE.MeshBasicMaterial({color:'#ba9c70',transparent:true,opacity:.2,depthWrite:false}),401,38.025,z,3,.012,4);}
 b.finish();r.finish();m.finish();lb.finish();
 // Pictogram boards where the words were (RULINGS 4): no lettering anywhere in the world.
 board(detail,theme,'station',394,41.3,661.75,5,1,Math.PI);
 board(detail,theme,'room',393,40.8,687.8,3.2,1.1,Math.PI);
 board(detail,theme,'board',399,40,665.1,8,1,0,'#e8c547');
 board(detail,theme,'hangar',408.12,46.4,585,5,1.6,Math.PI/2);
 board(detail,theme,'terrace',382,39.4,651,3,1,Math.PI);
 board(detail,theme,'cafe',405.3,40.6,674,1.6,1,Math.PI/2);
 // The island's one windsock stands on the Flats (neighbourhoods/flats, RULINGS 3); the airport draws none of its own.
 return{root,update(journey:boolean,eye:THREE.Vector3,night:number,wind?:readonly[number,number]){detail.visible=!journey;map.visible=journey;lights.visible=!journey&&night>.1;roofs.visible=true;void eye;void wind;},dispose:()=>dispose(root)};
}
