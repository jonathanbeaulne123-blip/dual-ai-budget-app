import {createBodyFigure} from '../../../body/figure.ts';
import * as THREE from 'three';
import {BOARDING,FIXTURES,FLOORS,GALLEY,ROOMS,floorHeight} from './layout.ts';
import {HANDLING,toLocal,type Fleet,type CraftId} from './model.ts';
import type {VehicleDressing} from '../shared/vehicleArt.ts';
const PALETTES={
 classic:{hull:'#f3eee0',trim:'#2b4c57',deck:'#bb8957',cloth:'#dbb574',wall:'#f6edd9',steel:'#71898b',glass:'#89bec7'},
 taylor:{hull:'#f9e6d9',trim:'#9c4c63',deck:'#c59177',cloth:'#cba1be',wall:'#fff0dc',steel:'#ad7d71',glass:'#a8c9c4'},
 newfoundland:{hull:'#e2e6df',trim:'#245e69',deck:'#9d784d',cloth:'#d4a040',wall:'#e8ede2',steel:'#688582',glass:'#73aab7'},
};
export function createFleetArt(fleet:Fleet,theme:VehicleDressing){
 const root=new THREE.Group(),groups=new Map<CraftId,THREE.Group>(),p=PALETTES[theme],materials=new Map<string,THREE.MeshStandardMaterial>(),geometries:THREE.BufferGeometry[]=[],occluders:{mesh:THREE.Object3D;y:number;wall?:boolean}[]=[],doorMeshes=new Map<string,THREE.Mesh>();
 const mat=(color:string)=>{let m=materials.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.8});materials.set(color,m);}return m;};
 function box(parent:THREE.Group,name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string){const g=new THREE.BoxGeometry(w,h,d);geometries.push(g);const mesh=new THREE.Mesh(g,mat(color));mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function hull(parent:THREE.Group,width:number,length:number,height:number,color:string){
  const points=[[-width*.38,-length/2],[width*.38,-length/2],[width/2,length*.24],[0,length/2],[-width/2,length*.24]];
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x!,z!))),g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelSize:width*.08,bevelThickness:.2,bevelSegments:1,steps:1});g.rotateX(Math.PI/2);geometries.push(g);
  const m=new THREE.Mesh(g,mat(color));m.position.y=.28;m.name='hull';m.castShadow=m.receiveShadow=true;parent.add(m);return m;
 }
 for(const v of fleet.vessels){const group=new THREE.Group(),c=HANDLING[v.id];group.name='fleet.'+v.id;root.add(group);groups.set(v.id,group);
  if(v.id==='yacht')continue;
  hull(group,c.width,c.length,.35,v.id==='kayak'?p.cloth:p.hull);
  box(group,'waterline',0,-.05,0,c.width*.65,.12,c.length*.82,p.trim);
  for(const [i,s]of c.seats.entries()){box(group,'seat-'+i,s.x,s.y-.08,s.z,.75,.16,.65,p.deck);box(group,'seat-back-'+i,s.x,s.y+.19,s.z-.36,.75,.4,.13,p.cloth);}
  if(v.id==='dinghy'){for(const x of[-.84,.84]){const g=new THREE.CylinderGeometry(.2,.2,3.1,8);g.rotateX(Math.PI/2);geometries.push(g);const m=new THREE.Mesh(g,mat(p.trim));m.position.set(x,.25,0);group.add(m);}}
  if(v.id!=='kayak'){box(group,'outboard',0,.05,-c.length/2,.4,.9,.4,p.trim);box(group,'console',-.4,.65,.75,.7,.65,.5,p.trim);}
  else{const paddle=new THREE.Group();paddle.name='kayak-paddle';group.add(paddle);box(paddle,'paddle',0,.75,0,2.5,.05,.08,p.trim);for(const x of[-1.15,1.15])box(paddle,'paddle-blade',x,.75,0,.45,.06,.23,p.deck);}
  if(v.id==='motorboat'){box(group,'windscreen',0,1.02,1,.95,.65,.12,p.glass);box(group,'bow-cushion',0,.3,1.8,1.2,.2,1,p.cloth);}
 }
 const guest=createBodyFigure({coat:p.cloth});groups.get('kayak')!.add(guest.group);guest.group.visible=false;
 const yacht=groups.get('yacht')!;
 // Flat-sided displacement hull accommodates the entire real lower floor plan.
 box(yacht,'keel',0,-.28,-1,13.1,1.3,39,p.trim);
 for(const x of[-6.7,6.7]){box(yacht,'hull-sill',x,.3,-1,.45,1.1,39,p.hull);const m=box(yacht,'hull-side',x,1.8,-1,.45,1.9,39,p.hull);occluders.push({mesh:m,y:1.75,wall:true});}
 hull(yacht,13.3,44,.8,p.hull);
 for(const f of FLOORS){
  if(f.rise){const count=16;for(let i=0;i<count;i++){const z=f.z0+(i+.5)*(f.z1-f.z0)/count,y=floorHeight(f,z);const m=box(yacht,f.id+'-'+i,(f.x0+f.x1)/2,y-.08,z,f.x1-f.x0,.16,(f.z1-f.z0)/count,p.deck);occluders.push({mesh:m,y});}}
  else{const m=box(yacht,f.id,(f.x0+f.x1)/2,f.y-.08,(f.z0+f.z1)/2,f.x1-f.x0,.16,f.z1-f.z0,p.deck);occluders.push({mesh:m,y:f.y});}
 }
 for(const f of FIXTURES){const color=f.kind==='wall'?p.wall:f.kind==='rail'?p.steel:f.kind==='door'?p.trim:f.kind==='bed'||f.kind==='seat'?p.cloth:f.kind==='machine'?p.steel:p.deck;
  const low=f.kind==='wall'?.8:f.height;
  const m=box(yacht,f.id,(f.x0+f.x1)/2,f.y+low/2,(f.z0+f.z1)/2,f.x1-f.x0,low,f.z1-f.z0,color);
  occluders.push({mesh:m,y:f.y});if(f.kind==='door')doorMeshes.set(f.id,m);
  if(f.kind==='wall'){const top=box(yacht,f.id+'-cutaway',(f.x0+f.x1)/2,f.y+.8+(f.height-.8)/2,(f.z0+f.z1)/2,f.x1-f.x0,f.height-.8,f.z1-f.z0,color);occluders.push({mesh:top,y:f.y+1.1,wall:true});}
  if(f.kind==='bed')box(yacht,f.id+'-pillow',(f.x0+f.x1)/2,f.y+.7,f.z1-.3,(f.x1-f.x0)*.7,.18,.5,p.wall);
 }
 // Bridge canopy, shaded aft dining, real ladder and small-vessel cleats.
 for(const [name,x,z,w,d,y]of [['bridge-roof',0,7,10,7,9.9],['aft-shade',4.5,-16,4.4,6,6.7]] as const){const m=box(yacht,name,x,y,z,w,.15,d,p.hull);occluders.push({mesh:m,y});for(const xx of[x-w/2,x+w/2]){const post=box(yacht,name+'-post',xx,y-1.4,z,.09,2.8,.09,p.steel);occluders.push({mesh:post,y:y-2.8});}}
 for(const x of[-.65,.65])box(yacht,'ladder-rail',x,.1,-23.15,.09,2,.09,p.steel);
 for(let y=-.7;y<.7;y+=.25)box(yacht,'ladder-rung',0,y,-23.15,1.3,.07,.09,p.steel);
 for(const x of[-4,4])box(yacht,'mooring-cleat',x,.78,BOARDING.z,.5,.16,.16,p.steel);
 for(const s of GALLEY){const detailStart=yacht.children.length;const hook=new THREE.Object3D();hook.name=s.id+'.surface';hook.position.set(s.surface.x,s.surface.y+.02,s.surface.z);hook.userData={stationId:s.id,role:s.role,approach:s.approach,usableSurface:s.size};yacht.add(hook);
  if(!['cold','serve','return'].includes(s.role)){box(yacht,s.id+'.worktop',s.at.x,s.surface.y,s.at.z,1.5,.08,1.15,p.wall);for(const dz of[-.35,.35])box(yacht,s.id+'.cabinet-pull',s.at.x+(s.approach.x>s.at.x?.735:-.735),s.at.y+.6,s.at.z+dz,.045,.055,.25,p.steel);}
  if(s.role==='cook')for(const dx of[-.35,.35])box(yacht,s.id+'.hob',s.at.x+dx,s.surface.y+.02,s.at.z,.25,.04,.55,p.trim);
  if(s.role==='wash')box(yacht,s.id+'.basin',s.at.x,s.surface.y+.02,s.at.z,1,.04,.7,p.steel);
  if(s.role==='cold')box(yacht,s.id+'.chiller',s.at.x,s.at.y+1.2,s.at.z,1.4,2.4,1,p.steel);
  if(s.role==='storage')for(const y of[.25,.5,.75])box(yacht,s.id+'.shelf',s.at.x,s.at.y+y,s.at.z,1.4,.05,1,p.trim);
  if(s.role==='prep')box(yacht,s.id+'.cutting-board',s.at.x,s.surface.y+.065,s.at.z,.7,.035,.5,p.deck);
  if(s.role==='plate')for(let i=0;i<4;i++)box(yacht,s.id+'.plate-'+i,s.at.x,s.surface.y+.065+i*.035,s.at.z,.38,.025,.38,p.wall);
  if(s.role==='wash'){box(yacht,s.id+'.tap',s.at.x+.45,s.surface.y+.25,s.at.z,.04,.45,.04,p.steel);box(yacht,s.id+'.spout',s.at.x+.3,s.surface.y+.46,s.at.z,.34,.04,.04,p.steel);}
  for(const mesh of yacht.children.slice(detailStart))occluders.push({mesh,y:s.at.y});
 }
 const labels=new THREE.Group();labels.name='yacht-room-markers';yacht.add(labels);
 const signs:{mesh:THREE.Sprite;x:number;y:number;z:number}[]=[];
 // Small quiet room plaques remain physical signs, not screen-space room teleport controls.
 if(typeof document!=='undefined')for(const [name,pos]of Object.entries(ROOMS)){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');if(!ctx)continue;ctx.fillStyle=p.trim;ctx.fillRect(0,0,256,64);ctx.fillStyle=p.wall;ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText(name.replace(/([A-Z])/g,' $1').toUpperCase(),128,41);
  const tex=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:tex,depthTest:true}),sprite=new THREE.Sprite(material);sprite.position.set(pos.x,pos.y+1.8,pos.z);sprite.scale.set(1.7,.42,1);labels.add(sprite);signs.push({mesh:sprite,...pos});
 }
 if(typeof document!=='undefined')for(const s of GALLEY){const canvas=document.createElement('canvas');canvas.width=384;canvas.height=64;const ctx=canvas.getContext('2d');if(!ctx)continue;ctx.fillStyle=p.trim;ctx.fillRect(0,0,384,64);ctx.fillStyle=p.wall;ctx.font='26px sans-serif';ctx.textAlign='center';ctx.fillText(s.label,192,42);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:true}));sprite.position.set(s.at.x,s.at.y+(s.role==='cold'?2.65:1.35),s.at.z);sprite.scale.set(1.45,.24,1);labels.add(sprite);signs.push({mesh:sprite,...s.at});}
 return{root,update(body:PointLike,onboard:boolean,map:boolean,cutaway=true,deckY?:number){for(const v of fleet.vessels){const g=groups.get(v.id)!;g.position.set(v.x,v.y,v.z);g.rotation.y=v.yaw;}
   const kayak=fleet.get('kayak');const paddle=groups.get('kayak')!.getObjectByName('kayak-paddle')!;paddle.rotation.z=Math.sin(fleet.time()*3.4)*.28*Math.min(1,Math.abs(kayak.speed)/1.5);const seat=HANDLING.kayak.seats[kayak.seat===0?1:0];guest.group.visible=kayak.passenger===true;guest.group.position.set(seat.x,seat.y,seat.z);guest.pose(0,0,0,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:'sit',emoteAt:1,flourish:0});
   const local=toLocal(fleet.yacht,{...body,y:deckY??body.y});for(const o of occluders)o.mesh.visible=!onboard||!cutaway||map||o.y<=local.y+.8;
   for(const [id,m]of doorMeshes){m.visible=!fleet.doors.has(id)&&(!onboard||!cutaway||m.position.y<local.y+2.8);}
   labels.visible=onboard&&!map;
   for(const s of signs)s.mesh.visible=Math.abs(s.y-local.y)<.6&&Math.hypot(s.x-local.x,s.z-local.z)>1.8;
  },dispose(){guest.dispose();root.removeFromParent();root.traverse(o=>{if(o instanceof THREE.Sprite){o.material.map?.dispose();o.material.dispose();}});for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();}};
}
type PointLike={x:number;y:number;z:number};
