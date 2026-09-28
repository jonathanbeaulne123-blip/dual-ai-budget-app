import {createKittySculpture} from '../kitty/sculpture.ts';
import type {HomeDisplayContent} from './displays.ts';
import * as THREE from 'three';
import {blueprint,furnishing,FINISHES} from './catalogue.ts';
import {FLOOR_HEIGHT,roomRect,joint,worldObject,visibleObject,contains,type HomeLayout} from './model.ts';
export type HomeWall={roomId:string;x:number;z:number;width:number;depth:number;y:number;height:number;lintel?:boolean};
export function homeWalls(layout:HomeLayout):HomeWall[]{
 const result:HomeWall[]=[];const rooms=layout.rooms.filter(r=>!r.stored);
 for(const r of rooms){const b=blueprint(r.blueprintId),rect=roomRect(r);if(['terrace','pergola'].includes(b.kind))continue;const rail=['balcony','porch'].includes(b.kind),height=rail?1:3.2;
  for(const [axis,side] of [['x',-1],['x',1],['z',-1],['z',1]] as const){const span=axis==='x'?rect.depth:rect.width,wallAt=(axis==='x'?r.x:r.z)+side*(axis==='x'?rect.width:rect.depth)/2,cross=axis==='x'?r.z:r.x;const openings:{a:number;b:number}[]=[];
   for(const p of rooms){if(p.id===r.id)continue;const j=joint(r,p);if(j&&j.axis===axis&&Math.abs(j.at-wallAt)<.01){const centre=(j.from+j.to)/2;openings.push({a:centre-1.2,b:centre+1.2});}}
   if(r.id==='home'&&axis==='z'&&side===1||b.kind==='outbuilding'&&axis==='z'&&side===1)openings.push({a:cross-1.2,b:cross+1.2});
   const add=(a:number,end:number,h:number,dy=0,lintel=false)=>{if(end-a<.01)return;result.push({roomId:r.id,x:axis==='x'?wallAt:(a+end)/2,z:axis==='z'?wallAt:(a+end)/2,width:axis==='x'?.18:end-a,depth:axis==='z'?.18:end-a,y:r.floor*FLOOR_HEIGHT+dy,height:h,lintel});};
   let cursor=cross-span/2;for(const op of openings.sort((a,b)=>a.a-b.a)){const a=Math.max(cursor,op.a),end=Math.min(cross+span/2,op.b);add(cursor,a,height);if(!rail)add(a,end,.6,2.6,true);cursor=Math.max(cursor,end);}add(cursor,cross+span/2,height);
  }
 }return result;
}
export function homeStairs(layout:HomeLayout){return layout.rooms.filter(r=>!r.stored&&r.floor===1).map(r=>{const a=roomRect(r);return{roomId:r.id,x:a.x-a.width/2+1.35,z:a.z-a.depth/2+2.75,width:1.8,depth:4.8};});}
export type HomeArt={group:THREE.Group;roofs:THREE.Group;dispose:()=>void;cutaway:(floor:number|null,walls?:boolean)=>void};
/** Shared mesh projection: local metres at every scale. No random regeneration, financial facts or IO. */
export function buildHomeArt(layout:HomeLayout,options:{detail?:'map'|'full';stage?:0|1|2|3;season?:'spring'|'summer'|'autumn'|'winter';displays?:HomeDisplayContent[]}={}):HomeArt{
 const group=new THREE.Group(),roofs=new THREE.Group();group.name='hearth-custom-home';group.add(roofs);const owned:{dispose():void}[]=[],materials=new Map<string,THREE.MeshStandardMaterial>();
 const mat=(color:string,glass=false)=>{const key=color+glass;let m=materials.get(key);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:glass?.2:.85,metalness:glass?.12:0,transparent:glass,opacity:glass?.42:1,side:THREE.DoubleSide});materials.set(key,m);owned.push(m);}return m;};
 const box=(parent:THREE.Group,name:string,w:number,h:number,d:number,x:number,y:number,z:number,color:string,glass=false)=>{const geo=new THREE.BoxGeometry(w,h,d);owned.push(geo);const mesh=new THREE.Mesh(geo,mat(color,glass));mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const stage=options.stage??3,rooms=layout.rooms.filter(r=>!r.stored),stairs=homeStairs(layout);
 for(const r of rooms){const rect=roomRect(r),b=blueprint(r.blueprintId),finish=FINISHES.find(f=>f.id===r.finish)??FINISHES[0],base=r.floor*FLOOR_HEIGHT;
  const room=new THREE.Group();room.name=`room:${r.id}`;room.userData.floor=r.floor;room.userData.roomId=r.id;group.add(room);
  if(r.floor===0)box(room,'stone foundation',rect.width+.3,.25,rect.depth+.3,r.x,-.125,r.z,'#9b9482');
  const stair=stairs.find(s=>s.roomId===r.id);
  if(stair){const left=r.x-rect.width/2,right=r.x+rect.width/2,front=r.z+rect.depth/2,sright=stair.x+stair.width/2,sfront=stair.z+stair.depth/2;
   box(room,'upper floor beside stair',right-sright,.12,rect.depth,(sright+right)/2,base-.06,r.z,finish.floor);
   box(room,'upper floor landing',sright-left,.12,front-sfront,(left+sright)/2,base-.06,(sfront+front)/2,finish.floor);
   for(let step=0;step<16;step++)box(room,'stair tread',stair.width,(step+1)*FLOOR_HEIGHT/16,stair.depth/16,stair.x,(step+1)*FLOOR_HEIGHT/32,stair.z-stair.depth/2+(step+.5)*stair.depth/16,finish.floor);
   for(const side of [-1,1]){for(let i=0;i<5;i++)box(room,'stair baluster',.07,1,.07,stair.x+side*(stair.width/2+.07),.5+i*FLOOR_HEIGHT/4,stair.z-stair.depth/2+i*stair.depth/4,finish.trim);const rail=box(room,'stair handrail',.09,.09,Math.hypot(stair.depth,FLOOR_HEIGHT),stair.x+side*(stair.width/2+.07),FLOOR_HEIGHT/2+1,stair.z,finish.trim);rail.rotation.x=-Math.atan2(FLOOR_HEIGHT,stair.depth);}
  }else box(room,'floor',rect.width,.12,rect.depth,r.x,base-.06,r.z,finish.floor);
  if(stage===0)continue;
  for(const wall of homeWalls(layout).filter(w=>w.roomId===r.id)){
   const glass=b.kind==='greenhouse';const wallMesh=box(room,wall.lintel?'door lintel':'wall',wall.width,wall.height,wall.depth,wall.x,wall.y+wall.height/2,wall.z,glass?'#aacdcc':finish.wall,glass);wallMesh.userData.cutWall={height:wall.height,y:wall.y};
   box(room,'skirting and trim',wall.width+.035,.12,wall.depth+.035,wall.x,wall.y+.1,wall.z,finish.trim);
   if(!wall.lintel&&wall.height>2&&(wall.width>3||wall.depth>3)){const alongX=wall.width>wall.depth;box(room,'window glass',alongX?1.4:.2,1.1,alongX?.2:1.4,wall.x,base+1.8,wall.z,'#718f99',true);box(room,'window sill',alongX?1.6:.32,.1,alongX?.32:1.6,wall.x,base+1.22,wall.z,finish.trim);}
  }
  if(b.kind==='pergola'||b.kind==='porch'){for(const dx of [-1,1])for(const dz of [-1,1])box(room,'timber post',.2,2.8,.2,r.x+dx*(rect.width/2-.15),base+1.4,r.z+dz*(rect.depth/2-.15),finish.trim);}
  if(stage<2||b.kind==='balcony'||b.kind==='terrace')continue;
  const roof=new THREE.Group();roof.name=`roof:${r.id}`;roof.userData.floor=r.floor;roofs.add(roof);
  if(rooms.some(up=>up.floor>r.floor&&contains(rect,roomRect(up)))){ // Exposed roof terrace around a supported upper room.
   for(const side of [-1,1])box(roof,'roof terrace edge',rect.width,.2,.18,r.x,base+3.3,r.z+side*rect.depth/2,finish.trim);continue;
  }
  if(b.kind==='pergola'){for(let x=-rect.width/2;x<=rect.width/2;x+=.65)box(roof,'pergola beam',.16,.18,rect.depth+.3,r.x+x,base+2.85,r.z,finish.trim);continue;}
  if(r.roof==='flat')box(roof,'flat roof',rect.width+.4,.24,rect.depth+.4,r.x,base+3.25,r.z,finish.roof);
  else if(r.roof==='hip'){const geo=new THREE.CylinderGeometry(0,1,1,4);owned.push(geo);const mesh=new THREE.Mesh(geo,mat(finish.roof));mesh.rotation.y=Math.PI/4;mesh.scale.set((rect.width+.6)/Math.SQRT2,2,(rect.depth+.6)/Math.SQRT2);mesh.position.set(r.x,base+4.2,r.z);roof.add(mesh);}
  else{const rise=1.8,half=(rect.depth+.6)/2;if(r.roof!=='glass')for(const side of [-1,1]){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([r.x+side*rect.width/2,base+3.2,r.z-half,r.x+side*rect.width/2,base+3.2+rise,r.z,r.x+side*rect.width/2,base+3.2,r.z+half],3));geo.computeVertexNormals();owned.push(geo);roof.add(new THREE.Mesh(geo,mat(finish.wall)));}for(const side of [-1,1]){const panel=box(roof,'pitched roof',rect.width+.6,.14,Math.hypot(half,rise),r.x,base+3.2+rise/2,r.z+side*half/2,r.roof==='glass'?'#8bbabc':finish.roof,r.roof==='glass');panel.rotation.x=side*Math.atan2(rise,half);}box(roof,'ridge cap',rect.width+.7,.15,.18,r.x,base+5.04,r.z,finish.trim);}
  if(options.season==='winter')box(roof,'seasonal snow cap',rect.width*.8,.045,.5,r.x,base+5.15,r.z,'#f3f5ef');
 }
 if(stage===3)for(const o of layout.objects){if(!visibleObject(o,layout))continue;const f=furnishing(o.catalogueId),r=rooms.find(r=>r.id===o.roomId);if(options.detail==='map'&&r)continue;const rect=worldObject(o,layout),finish=FINISHES.find(v=>v.id===o.variant)??FINISHES[0],parent=o.supportId?layout.objects.find(p=>p.id===o.supportId):undefined,base=(r?.floor??0)*FLOOR_HEIGHT+(parent?furnishing(parent.catalogueId).height:0),art=new THREE.Group();art.name=`object:${o.id}`;art.userData.floor=r?.floor??0;art.userData.objectId=o.id;group.add(art);
  const x=rect.x,z=rect.z,w=rect.width,d=rect.depth,h=f.height;
  if(['table','display','counter','shelf','cabinet'].includes(f.shape)){box(art,f.name,w,.12,d,x,base+h-.06,z,finish.floor);for(const sx of [-1,1])for(const sz of [-1,1])box(art,'support',.09,h-.1,.09,x+sx*(w/2-.09),base+(h-.1)/2,z+sz*(d/2-.09),finish.trim);if(['shelf','cabinet'].includes(f.shape))for(let y=.3;y<h;y+=.45)box(art,'shelf',w,.08,d,x,base+y,z,finish.floor);}
  else if(f.shape==='seat'||f.shape==='bed'){box(art,'upholstery',w,.3,d,x,base+.45,z,finish.fabric);box(art,'back',w,.6,.12,x,base+.75,z-d/2,finish.floor);}
  else if(f.shape==='plant'){box(art,'planter',w,.3,d,x,base+.15,z,finish.floor);const geo=new THREE.IcosahedronGeometry(Math.max(w,d)*.45,0);owned.push(geo);const mesh=new THREE.Mesh(geo,mat(options.season==='winter'?'#9eafa2':options.season==='autumn'?'#a99259':'#679477'));mesh.position.set(x,base+h*.7,z);art.add(mesh);}
  else if(f.shape==='lamp'){box(art,'lamp stem',.08,h,.08,x,base+h/2,z,finish.trim);box(art,'linen shade',w,.3,d,x,base+h,z,'#f5dfa7');}
  else box(art,f.name,w,h,d,x,base+h/2,z,['rug','curtain'].includes(f.shape)?finish.fabric:finish.floor);
  if(o.display){const display=options.displays?.find(d=>d.id===o.display!.id&&d.revision===o.display!.revision&&d.kind===o.display!.kind&&(d.kind!=='piece'||d.designId===o.display!.designId));if(display?.kind==='piece'){const artPiece=createKittySculpture(display.piece,{brass:finish.trim,wood:finish.floor,reducedMotion:true,ornament:display.appearance});artPiece.group.scale.setScalar(.4);artPiece.group.position.set(x,base+h,z);art.add(artPiece.group);owned.push(artPiece);}else if(display?.kind==='memory'){box(art,'kept memory album',.4,.08,.3,x,base+h+.04,z,finish.fabric);}}

 }
 return{group,roofs,cutaway(floor,cutWalls=true){roofs.visible=floor===null;for(const child of group.children)if(child!==roofs){child.visible=floor===null||typeof child.userData.floor!=='number'||child.userData.floor<=floor;child.traverse(node=>{const wall=node.userData.cutWall;if(wall){const cut=floor!==null&&cutWalls;node.scale.y=cut?Math.min(1,.65/wall.height):1;node.position.y=wall.y+(cut?Math.min(.65,wall.height):wall.height)/2;}if(['door lintel','window glass','window sill'].includes(node.name))node.visible=floor===null||!cutWalls;});}},dispose(){group.removeFromParent();for(const a of owned)a.dispose();}};
}
/** Dynamic collision matches the drawn walls, floors and stair opening. */
export function homeGeography(layout:HomeLayout,origin:{x:number;y:number;z:number;yaw?:number}){
 const angle=origin.yaw??0,c=Math.cos(angle),s=Math.sin(angle),rooms=layout.rooms.filter(r=>!r.stored),walls=homeWalls(layout),stairs=homeStairs(layout);
 const solidObjects=layout.objects.filter(o=>visibleObject(o,layout)&&!o.supportId&&!['rug','art','curtain','path','gate'].includes(furnishing(o.catalogueId).shape));
 const local=(x:number,z:number)=>({x:(x-origin.x)*c-(z-origin.z)*s,z:(x-origin.x)*s+(z-origin.z)*c});
 return{
 surface(x:number,z:number,y=Infinity,step=.48){const p=local(x,z);let best:number|null=null;for(const r of rooms){const rect=roomRect(r);if(!contains(rect,{...p,width:0,depth:0}))continue;const stair=stairs.find(st=>st.roomId===r.id);if(stair&&contains(stair,{...p,width:0,depth:0}))continue;const h=origin.y+r.floor*FLOOR_HEIGHT;if(h<=y+step&&(best===null||h>best))best=h;}
  for(const stair of stairs)if(contains(stair,{...p,width:0,depth:0})){const h=origin.y+Math.ceil(Math.max(0,Math.min(1,(p.z-stair.z+stair.depth/2)/stair.depth))*16)/16*FLOOR_HEIGHT;if(h<=y+step&&(best===null||h>best))best=h;}
  return best===null?null:{id:'custom-home',y:best,nx:0,ny:1,nz:0,material:'wood',slope:0};},
 ceiling(x:number,z:number,y:number){const p=local(x,z);let best=Infinity;for(const r of rooms){const h=origin.y+r.floor*FLOOR_HEIGHT;if(h>y+.1&&contains(roomRect(r),{...p,width:0,depth:0})&&!stairs.some(st=>st.roomId===r.id&&contains(st,{...p,width:0,depth:0})))best=Math.min(best,h-.12);}return best;},
 contact(x:number,z:number,y:number,radius=.3){const p=local(x,z),foot=y-origin.y;for(const wall of walls){if(foot>=wall.y+wall.height-.02||foot+1.25<=wall.y||!contains({x:wall.x,z:wall.z,width:wall.width+2*radius,depth:wall.depth+2*radius},{...p,width:0,depth:0}))continue;const alongX=wall.width>wall.depth,nx=alongX?0:Math.sign(p.x-wall.x)||1,nz=alongX?Math.sign(p.z-wall.z)||1:0;return{id:'home-wall:'+wall.roomId,nx:nx*c+nz*s,nz:-nx*s+nz*c};}for(const o of solidObjects){const r=rooms.find(r=>r.id===o.roomId),base=(r?.floor??0)*FLOOR_HEIGHT,rect=worldObject(o,layout),f=furnishing(o.catalogueId);if(foot>=base+f.height-.02||foot+1.25<=base||!contains({...rect,width:rect.width+2*radius,depth:rect.depth+2*radius},{...p,width:0,depth:0}))continue;const dx=p.x-rect.x,dz=p.z-rect.z,alongX=rect.width/2+radius-Math.abs(dx)<rect.depth/2+radius-Math.abs(dz),nx=alongX?Math.sign(dx)||1:0,nz=alongX?0:Math.sign(dz)||1;return{id:'home-object:'+o.id,nx:nx*c+nz*s,nz:-nx*s+nz*c};}return null;}
 };
}
