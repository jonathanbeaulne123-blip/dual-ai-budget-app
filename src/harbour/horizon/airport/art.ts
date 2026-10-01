import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {VehicleDressing} from '../movers/shared/vehicleArt.ts';
import type {AircraftState} from './flight.ts';
import {AIRCRAFT,type AircraftId} from './aircraft.ts';
import {AIRPORT,AIRPORT_BOXES,AIRPORT_DECKS} from './layout.ts';
const dispose=(root:THREE.Object3D)=>{const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);}});gs.forEach(g=>g.dispose());ms.forEach(m=>{if('map'in m)(m.map as THREE.Texture|null)?.dispose();m.dispose();});root.removeFromParent();};
/** Static pieces batch by material: the authored detail does not multiply draw calls. */
function builder(root:THREE.Group){const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();return{
 add(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,rx=0,ry=0,rz=0){if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1)));const a=batches.get(m)??[];a.push(g);batches.set(m,a);},
 box(m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,rx=0,ry=0,rz=0){this.add(new THREE.BoxGeometry(w,h,d),m,x,y,z,rx,ry,rz);},
 finish(){for(const [m,gs]of batches){const mesh=new THREE.Mesh(mergeGeometries(gs),m);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);gs.forEach(g=>g.dispose());}batches.clear();}
};}
function label(root:THREE.Group,text:string,x:number,y:number,z:number,width:number,yaw=0){const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#193b40';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#f6ead1';ctx.font='600 48px sans-serif';ctx.textAlign='center';ctx.fillText(text,512,80);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/8),new THREE.MeshBasicMaterial({map:t,side:THREE.FrontSide}));mesh.position.set(x,y,z);mesh.rotation.y=yaw;root.add(mesh);}
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
 const palette=theme==='taylor'?{cedar:'#b37e83',copper:'#789a96',stone:'#e5d8c3'}:theme==='newfoundland'?{cedar:'#a85042',copper:'#3b747c',stone:'#b8bcb4'}:{cedar:'#9b6747',copper:'#537c76',stone:'#d1c1a5'};
 const mats={cedar:new THREE.MeshStandardMaterial({color:palette.cedar,roughness:.85}),copper:new THREE.MeshStandardMaterial({color:palette.copper,roughness:.55,metalness:.25}),stone:new THREE.MeshStandardMaterial({color:palette.stone,roughness:.95}),glass:new THREE.MeshStandardMaterial({color:'#a4c7c2',transparent:true,opacity:.3,roughness:.2,depthWrite:false,side:THREE.DoubleSide}),paving:new THREE.MeshStandardMaterial({color:'#606768',roughness:.98}),paint:new THREE.MeshStandardMaterial({color:'#ead6a1',roughness:.8}),soil:new THREE.MeshStandardMaterial({color:'#63765a',roughness:1})};
 const b=builder(detail),r=builder(roofs),m=builder(map);
 for(const q of AIRPORT_BOXES){const target=q.roof?r:b;target.box(mats[q.material],q.x,q.y,q.z,q.w,q.h,q.d);if(q.roof)m.box(mats[q.material],q.x,q.y,q.z,q.w,q.h,q.d);}
 for(const d of AIRPORT_DECKS){const dx=d.b[0]-d.a[0],dy=d.b[1]-d.a[1],dz=d.b[2]-d.a[2],length=Math.hypot(dx,dy,dz),yaw=Math.atan2(dx,dz),pitch=-Math.atan2(dy,Math.hypot(dx,dz));for(const target of [b,m])target.box(mats.paving,(d.a[0]+d.b[0])/2,(d.a[1]+d.b[1])/2-.105,(d.a[2]+d.b[2])/2,d.width,.24,length,pitch,yaw);
  // Visible structural piers carry the raised campus; no disguised terrain replacement.
  if(d.id!=='arrival-drive')for(const f of [.15,.5,.85]){const x=d.a[0]+dx*f,y=d.a[1]+dy*f,z=d.a[2]+dz*f;b.box(mats.stone,x,y-3,z,.55,6,.55);}
 }
 // Copper ribs tie the hangar, terminal and tower together.
 for(let x=383;x<=407;x+=3)b.box(mats.cedar,x,44.5,585,.16,.45,26);
 for(let x=384;x<406;x+=3)b.box(mats.cedar,x,40,662,.16,4,.25);
 // Warm timber ceiling and mullions give the room a human scale.
 for(let z=664;z<=687;z+=2)b.box(mats.cedar,394,41.65,z,21,.18,.13);
 for(let z=574;z<598;z+=2)b.box(mats.stone,383.25,41,z,.1,5,.06);
 for(let z=663;z<=687;z+=3)b.box(mats.cedar,405.02,40,z,.12,3.8,.1);
 for(const z of [672,678]){b.box(mats.copper,388,38.56,z,3,.08,2);b.box(mats.cedar,387,38.9,z, .18,.8,2);}
 // Airport-owned ramp rails and window ledges frame usable surfaces.
 for(const x of [378.8,381.2])b.box(mats.cedar,x,40.9,668, .09,.09,32,-Math.atan2(4.2,31.75));
 b.box(mats.cedar,404.8,38.9,680,.4,.15,7);
 // Floor furnishings, workshop tools, café cups and planted gardens.
 for(const [x,z]of [[389,672],[389,678],[407,671],[407,679]] as const){b.add(new THREE.CylinderGeometry(.7,.7,.12,12),mats.copper,x,38.75,z);b.box(mats.cedar,x,38.4,z,.12,.8,.12);b.add(new THREE.CylinderGeometry(.09,.07,.18,8),mats.stone,x+.2,38.9,z);}
 for(let i=0;i<12;i++)b.box(mats.copper,384.4+i*.3,39.7,575.2,.08,.35+(i%3)*.1,.08);
 for(const z of [612,634])for(let i=0;i<7;i++)b.add(new THREE.IcosahedronGeometry(.8+(i%3)*.15,0),mats.soil,390+(i%3)*2,39, z-2+Math.floor(i/3)*2);
 for(const [x,y,z]of [[377.4,35.3,691.3],[380,37,672]] as const){b.box(mats.copper,x,y+1.5,z,.14,3,.14);}
 // Runway paint follows the existing diagonal strip exactly.
 const a=AIRPORT.runway.a,c=AIRPORT.runway.b,yaw=Math.atan2(c[0]-a[0],c[2]-a[2]);
 for(let i=0;i<16;i++){const f=(i+.5)/16;b.box(mats.paint,a[0]+(c[0]-a[0])*f,38.035,a[2]+(c[2]-a[2])*f,.6,.035,9,0,yaw);}
 for(const f of [.04,.96])for(const side of [-1,1])for(let i=0;i<4;i++)b.box(mats.paint,a[0]+20*f+side*(3+i*2),38.035,a[2]+340*f,1,.035,10,0,yaw);
 // Taxi centreline and numbered stands are visibly distinct from the runway.
 for(let z=601;z<652;z+=3)b.box(mats.paint,413+(z-600)*3/51,38.035,z,.2,.03,2);
 for(const [id,at]of Object.entries(AIRPORT.stands)){b.box(mats.paint,at.x,38.035,at.z,6,.03,.14);label(detail,AIRCRAFT[id as AircraftId].name,at.x-5,39,at.z,3,Math.PI/2);}
 // Bounded local illumination: five useful pools, no dynamic shadow maps.
 const glow=new THREE.MeshBasicMaterial({color:'#ffdba1'}),blue=new THREE.MeshBasicMaterial({color:'#77b6ee'}),white=new THREE.MeshBasicMaterial({color:'#fff0c6'}),green=new THREE.MeshBasicMaterial({color:'#71d9a2'}),lb=builder(lights);
 for(const [x,z]of [[390,669],[397,681],[394,581],[386,650]] as const){const light=new THREE.PointLight('#ffcf91',100,23,2);light.position.set(x,41,z);lights.add(light);lb.box(glow,x,41.6,z,2,.08,.4);}
 const approachLight=new THREE.PointLight('#ffcf91',65,20,2);approachLight.position.set(377.4,38.3,691.3);lights.add(approachLight);lb.box(glow,377.4,38.3,691.3,.35,.12,.35);
 for(let z=520;z<=860;z+=20)for(const side of [-1,1]){const x=425+(z-520)/17+side*14.5;lb.box(white,x,38.13,z,.28,.2,.28);}
 for(const z of [522,858])for(let x=-10;x<=10;x+=5)lb.box(green,425+(z-520)/17+x,38.15,z,.3,.2,.3);
 for(let z=600;z<659;z+=8)lb.box(blue,420,38.15,z,.25,.2,.25);
 for(let z=606;z<659;z+=10){b.box(mats.copper,399,38.6,z,.13,1.2,.13);lb.box(glow,399,39.2,z,.23,.12,.23);lb.box(new THREE.MeshBasicMaterial({color:'#ba9c70',transparent:true,opacity:.2,depthWrite:false}),401,38.025,z,3,.012,4);}
 b.finish();r.finish();m.finish();lb.finish();
 label(detail,'HORIZON  /  AIRPORT',394,41,661.8,15,Math.PI);
 label(detail,'THE DEPARTURE ROOM',393,40.8,687.8,12);
 label(detail,'LOCAL FLIGHTS  ·  WALK TO YOUR AIRCRAFT',399,40,665,8);
 label(detail,'WORKSHOP  /  OPEN HANGAR',407.2,43,585,12,Math.PI/2);
 label(detail,'OBSERVATION TERRACE  ↗',382,39.4,651,5,Math.PI);
 label(detail,'CAFÉ TERRACE',405.3,40.6,674,6,Math.PI/2);
 // A single wind indicator, driven by the same ordinary island wind direction.
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,5,8),mats.copper);pole.position.set(409,40.5,554);detail.add(pole);const sock=new THREE.Mesh(new THREE.ConeGeometry(.35,2.4,10,1,true),new THREE.MeshStandardMaterial({color:'#d47843',side:THREE.DoubleSide}));sock.position.set(410,43,554);sock.rotation.z=-Math.PI/2;detail.add(sock);
 return{root,update(journey:boolean,eye:THREE.Vector3,night:number,wind:readonly[number,number]=[0,-4]){const speed=Math.hypot(...wind);sock.rotation.set(speed>.1?Math.PI/2:Math.PI,speed>.1?Math.atan2(wind[0],wind[1]):0,0,'YXZ');sock.position.set(409+(speed>.1?wind[0]/speed*1.2:0),speed>.1?43:41.8,554+(speed>.1?wind[1]/speed*1.2:0));detail.visible=!journey;map.visible=journey;lights.visible=!journey&&night>.1;roofs.visible=true;void eye;},dispose:()=>dispose(root)};
}
