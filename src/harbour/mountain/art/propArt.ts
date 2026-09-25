/**
 * The mountain's small furniture on the painted-card kit, one drawing per prop kind and a
 * theme treatment for each (Classic brass and timber; Taylor paper, washi and pastel;
 * Newfoundland painted plank, rope and primaries). Placements come from
 * `placements.ts`; every foot is at the placement's seated bottom.
 * Moving parts (pennants, laundry, the waterwheel, smoke) are returned for `life`.
 */
import * as THREE from 'three';
import {groundHeightAt} from '../../scene/ground.ts';
import {ORCHARD_LANE_LINE} from '../definition.ts';
import {placementOf,placementToWorld} from '../../scene/place.ts';
import {CardBuilder,shade,mix,inkLift,type V3,type RGB} from '../../art/cardScene.ts';
import {hash2,ICON} from '../../art/cardKit.ts';
import {mountainProps,type PropPlacement} from './placements.ts';
import type {SignSpot} from './buildingArt.ts';
import {riverSamples} from './waterArt.ts';
import type {MountainArtPalette} from './palette.ts';

type F=(lx:number,lz:number,y:number)=>V3;
const frameOf=(p:{x:number;z:number;yaw:number}):F=>{const c=Math.cos(p.yaw),s=Math.sin(p.yaw);return (lx,lz,y)=>[p.x+lx*c+lz*s,y,p.z+lz*c-lx*s];};

export function drawBench(b:CardBuilder,pal:MountainArtPalette,p:PropPlacement){
  const W=frameOf(p),y0=p.bottom,seat=y0+PROP_SEAT;
  // On a slope, a flagged pad levelled into the hillside carries the bench.
  if(p.on==='pad'&&p.padFoot!==undefined){b.box(p.x,p.z,p.yaw,p.half[0]+.3,p.half[1]+.35,p.padFoot,y0,shade(pal.coping,.95),pal.stone,b.ink,.7);
    for(const lx of [-.7,0,.7]){const a=W(lx,-p.half[1]-.35,y0+.004),c=W(lx,p.half[1]+.35,y0+.004);b.line(a,c,b.pencil);}}
  const wood=pal.theme==='taylor'?pal.walls[0]!:pal.theme==='newfoundland'?pal.walls[2]!:pal.plank,end=pal.theme==='classic'?pal.iron:pal.theme==='taylor'?pal.paperEdge:pal.trim;
  for(const lx of [-1.25,1.25]){const q=W(lx,0,0);b.box(q[0],q[2],p.yaw,.07,.32,y0,seat,end,shade(end,.8),null);const r=W(lx,-.3,0);b.box(r[0],r[2],p.yaw,.07,.06,seat,seat+.62,end,shade(end,.8),null);}
  for(let k=0;k<3;k++){const q=W(0,-.22+k*.2,0);b.box(q[0],q[2],p.yaw,1.45,.08,seat-.05,seat,shade(wood,1+k*.02),shade(wood,.8));}
  for(let k=0;k<2;k++){const q=W(0,-.33,0);b.box(q[0],q[2],p.yaw,1.45,.04,seat+.25+k*.22,seat+.4+k*.22,wood,shade(wood,.8));}
  b.shadow(p.x,p.z,1.6,.5,p.yaw,groundHeightAt,.28);
}
export const PROP_SEAT=.52;

function signpost(b:CardBuilder,pal:MountainArtPalette,p:PropPlacement,signs:SignSpot[]){
  const W=frameOf(p),top=p.bottom+2.95,post=pal.theme==='newfoundland'?pal.trim:pal.timber;
  b.box(p.x,p.z,p.yaw,.1,.1,p.bottom,top,shade(post,1.08),post);
  // Finial: a brass ball (Classic), a paper star (Taylor), a red float (Newfoundland).
  if(pal.theme==='taylor'){const c=W(0,0,top+.35);b.flat([[0,-.3],[.09,-.1],[.3,-.1],[.13,.03],[.2,.26],[0,.12],[-.2,.26],[-.13,.03],[-.3,-.1],[-.09,-.1]].map(([u,v])=>[u!+.3,v!+.3] as const),[c[0]-Math.cos(p.yaw)*.3,c[1]-.3,c[2]+Math.sin(p.yaw)*.3],[c[0]+Math.cos(p.yaw)*.3,c[1]-.3,c[2]-Math.sin(p.yaw)*.3],pal.second);}
  else{b.cone(p.x,p.z,top,top+.12,.16,.16,pal.theme==='newfoundland'?pal.accent:pal.brass,8,'steel');b.dome(p.x,top+.12,p.z,.17,pal.theme==='newfoundland'?pal.accent:pal.brass,8,3,'steel');}
  // The board, standing across the approach.
  const w=2.1,h=.62,y=top-.55,c=W(0,.14,y),board=pal.signBoard,edge=pal.theme==='taylor'?pal.paperEdge:shade(board,.8);
  b.box(c[0],c[2],p.yaw,w/2+.06,.05,y-h/2-.06,y+h/2+.06,edge,shade(edge,.8));
  if(pal.theme==='taylor'){for(const e of [-1,1]){const t=W(e*(w/2-.1),.2,y+h/2);b.box(t[0],t[2],p.yaw+e*.6,.2,.02,t[1]-.09,t[1]+.09,pal.tape[1]!,pal.tape[1]!,null);}}
  const front=W(0,.2,y),back=W(0,.08,y);
  signs.push({at:front,yaw:p.yaw,w,h},{at:back,yaw:p.yaw+Math.PI,w,h});
  b.shadow(p.x,p.z,.45,.45,0,groundHeightAt,.25);
}

function lantern(b:CardBuilder,pal:MountainArtPalette,p:PropPlacement){
  const top=p.bottom+2.5,post=pal.theme==='classic'?pal.iron:pal.theme==='taylor'?pal.timberLight:pal.trim;
  b.box(p.x,p.z,0,.16,.16,p.bottom,p.bottom+.3,pal.coping,pal.stone);
  b.post(p.x,p.z,p.bottom+.3,top,.06,post,6,'steel');
  if(pal.theme==='taylor'){b.cone(p.x,p.z,top-.05,top+.25,.26,.3,pal.lamp,8,'card');b.cone(p.x,p.z,top+.25,top+.55,.3,.2,pal.lamp,8,'card');b.cone(p.x,p.z,top+.55,top+.62,.16,.16,pal.roofAlt,6);}
  else{const L=(u:number,v:number,y:number):V3=>[p.x+u,y,p.z+v];
    for(const [a,c] of [[[-.17,-.17],[.17,-.17]],[[.17,-.17],[.17,.17]],[[.17,.17],[-.17,.17]],[[-.17,.17],[-.17,-.17]]] as const)b.glow(L(a[0],a[1],top),L(c[0],c[1],top),L(c[0],c[1],top+.45),L(a[0],a[1],top+.45),pal.lamp);
    for(const [u,v] of [[-.18,-.18],[.18,-.18],[.18,.18],[-.18,.18]] as const)b.post(p.x+u,p.z+v,top,top+.45,.025,pal.theme==='newfoundland'?pal.accent:pal.brass,4,'steel');
    b.cone(p.x,p.z,top+.45,top+.72,.28,0,pal.theme==='newfoundland'?pal.accent:pal.iron,4,'steel');}
  b.shadow(p.x,p.z,.35,.35,0,groundHeightAt,.22);
}

function cairn(b:CardBuilder,pal:MountainArtPalette,p:PropPlacement){
  let y=p.bottom;for(let k=0;k<5;k++){const r=.62-k*.1,h=.28-k*.02,off=(hash2(k,Math.round(p.x))-.5)*.12;b.cone(p.x+off,p.z-off,y,y+h,r,r*.85,shade(pal.stone,.85+hash2(k,3)*.2),7);y+=h;}
  b.shadow(p.x,p.z,.8,.8,0,groundHeightAt,.25);
}
function planter(b:CardBuilder,pal:MountainArtPalette,p:PropPlacement){
  const box=pal.theme==='newfoundland'?pal.walls[1]!:pal.theme==='taylor'?pal.walls[3]!:mix(pal.roofAlt,pal.plank,.2);
  b.box(p.x,p.z,p.yaw,.55,.55,p.bottom,p.bottom+.6,box,shade(box,.8));
  const W=frameOf(p);for(let k=0;k<7;k++){const q=W((hash2(k,1)-.5)*.8,(hash2(k,2)-.5)*.8,0);b.cone(q[0],q[2],p.bottom+.6,p.bottom+.85+hash2(k,3)*.2,.14,0,pal.flowers[k%pal.flowers.length]!,5);}
}
function beehive(b:CardBuilder,pal:MountainArtPalette,p:PropPlacement){
  b.box(p.x,p.z,p.yaw,.35,.35,p.bottom,p.bottom+.35,pal.timber,shade(pal.timber,.8));
  if(pal.theme==='classic'){for(let k=0;k<4;k++)b.cone(p.x,p.z,p.bottom+.35+k*.16,p.bottom+.51+k*.16,.42-k*.08,.36-k*.09,mix([.85,.7,.4],pal.plank,.3),10);}
  else{const c=pal.theme==='taylor'?pal.walls[2]!:pal.trim;for(let k=0;k<2;k++)b.box(p.x,p.z,p.yaw,.3,.3,p.bottom+.35+k*.28,p.bottom+.6+k*.28,c,shade(c,.85));b.box(p.x,p.z,p.yaw,.36,.36,p.bottom+.9,p.bottom+.98,pal.roofTile,shade(pal.roofTile,.8));}
}
function woodpile(b:CardBuilder,pal:MountainArtPalette,p:PropPlacement){
  const W=frameOf(p);
  for(let row=0;row<3;row++)for(let k=0;k<5-row;k++){const q=W(-.7+k*.32+row*.16,0,0),y=p.bottom+.16+row*.28;
    const a=W(-.7+k*.32+row*.16,-.4,y),c=W(-.7+k*.32+row*.16,.4,y);void q;b.beam(a,c,.28,.28,shade(pal.timberLight,.9+hash2(k,row)*.2),null);
    b.cone(c[0],c[2],c[1]-.14,c[1]+.14,.001,.001,pal.plank,6);}
  for(const lx of [-.95,.95]){const q=W(lx,0,0);b.box(q[0],q[2],p.yaw,.06,.5,p.bottom,p.bottom+1.2,pal.timber,shade(pal.timber,.8),null);}
  const r0=W(-1.1,-.6,p.bottom+1.25),r1=W(1.1,-.6,p.bottom+1.25),r2=W(1.1,.6,p.bottom+1.05),r3=W(-1.1,.6,p.bottom+1.05);b.quad(r0,r1,r2,r3,pal.roofTile);b.line(inkLift(r3),inkLift(r2));
}
function viewer(b:CardBuilder,pal:MountainArtPalette,p:PropPlacement){
  b.post(p.x,p.z,p.bottom,p.bottom+1.05,.07,pal.iron,6,'steel');
  const dx=Math.sin(p.yaw),dz=Math.cos(p.yaw),y=p.bottom+1.2;b.beam([p.x-dx*.3,y-.06,p.z-dz*.3],[p.x+dx*.35,y+.06,p.z+dz*.35],.2,.2,pal.brass,b.ink,'steel');
}
function bollard(b:CardBuilder,pal:MountainArtPalette,p:PropPlacement){
  const c=pal.theme==='taylor'?pal.walls[1]!:pal.theme==='newfoundland'?pal.timber:pal.iron;
  b.post(p.x,p.z,p.bottom,p.bottom+.8,.2,c,8,pal.theme==='classic'?'steel':'card');b.dome(p.x,p.bottom+.8,p.z,.21,c,8,2,pal.theme==='classic'?'steel':'card');
  if(pal.theme==='newfoundland'){const ring:V3[]=[];for(let k=0;k<=12;k++){const a=k/12*Math.PI*2;ring.push([p.x+Math.cos(a)*.3,p.bottom+.55+Math.sin(a*2)*.04,p.z+Math.sin(a)*.3]);}b.tube(ring,.05,mix(pal.plank,[.9,.85,.7],.5),4);}
  if(pal.theme==='taylor')b.cone(p.x,p.z,p.bottom+.45,p.bottom+.58,.21,.21,pal.tape[0]!,8);
}

export type Cloth={mesh:THREE.InstancedMesh;items:{at:V3;yaw:number;phase:number;amp:number;w:number;h:number}[]};
export type PropLife={group:THREE.Group;cloth:Cloth[];smoke:V3[];wheel:THREE.Object3D|null;dispose():void};

/** Static props into the shared builder; moving cloth, the waterwheel and smoke sources into `life`. */
export function buildPropArt(b:CardBuilder,pal:MountainArtPalette,tier:'full'|'lite',signs:SignSpot[],skip:(p:PropPlacement)=>boolean=()=>false):PropLife{
  const group=new THREE.Group();group.name='Mountain moving props';
  const owned:{dispose():void}[]=[];const own=<T extends {dispose():void}>(o:T)=>{owned.push(o);return o;};
  // Cloth hangs as instances (one draw per shape) and flutters about its string.
  const pennantItems:{at:V3;yaw:number;phase:number;amp:number;col:RGB;w:number;h:number}[]=[],laundryItems:typeof pennantItems=[];
  for(const p of mountainProps()){
    if(skip(p))continue;
    switch(p.kind){
      case 'signpost':signpost(b,pal,p,signs);break;
      case 'bench':drawBench(b,pal,p);break;
      case 'lantern':lantern(b,pal,p);break;
      case 'cairn':cairn(b,pal,p);break;
      case 'planter':planter(b,pal,p);break;
      case 'beehive':beehive(b,pal,p);break;
      case 'woodpile':woodpile(b,pal,p);break;
      case 'viewer':viewer(b,pal,p);break;
      case 'bollard':bollard(b,pal,p);break;
      case 'laundry':case 'pennants':{
        if(!p.to)break;const W=frameOf(p),len=p.half[0]*2,top=p.bottom+2.25,a=W(-p.half[0],0,0),c=W(p.half[0],0,0);
        const post=p.kind==='laundry'?pal.timber:pal.theme==='newfoundland'?pal.trim:pal.timberLight;
        for(const q of [a,c]){b.box(q[0],q[2],p.yaw,.07,.07,p.bottom,top+.1,shade(post,1.05),post,null);if(p.kind==='laundry')b.beam([q[0]-Math.sin(p.yaw)*.3,top,q[2]-Math.cos(p.yaw)*.3],[q[0]+Math.sin(p.yaw)*.3,top,q[2]+Math.cos(p.yaw)*.3],.06,.06,post,null);}
        // The string sags; each cloth or pennant hangs from it and flutters on its own phase.
        const n=p.kind==='laundry'?5:Math.round(len/.55),sag=.25;
        const at=(t:number):V3=>{const q=W(-p.half[0]+len*t,0,0);return [q[0],top-sag*4*t*(1-t),q[2]];};
        for(let k=0;k<12;k++)b.line(at(k/12),at((k+1)/12),pal.theme==='newfoundland'?mix(pal.plank,[.9,.85,.7],.5):pal.iron);
        const flags=pal.theme==='taylor'?[...pal.tape,pal.accent,pal.second]:pal.theme==='newfoundland'?[pal.walls[0]!,pal.trim,pal.walls[1]!,pal.walls[3]!]:[pal.accent,pal.paperEdge,pal.second];
        for(let k=1;k<n;k++){const t=k/n,q=at(t),laundry=p.kind==='laundry';
          (laundry?laundryItems:pennantItems).push({at:q,yaw:p.yaw,phase:hash2(k,Math.round(p.x))*6.28,amp:laundry?.16:.34,col:laundry?pal.cloth[k%pal.cloth.length]!:flags[k%flags.length]!,w:laundry?.45+hash2(k,5)*.3:.2,h:laundry?.55+hash2(k,6)*.35:.42});}
        break;
      }
      default:break;
    }
  }
  const cloth:Cloth[]=[];
  const clothMesh=(items:typeof pennantItems,shape:'tri'|'quad'|'flag',name:string)=>{
    if(!items.length)return;
    const g=own(new THREE.BufferGeometry()),pos=shape==='tri'?[-1,0,0,1,0,0,0,-1,0]:[-1,0,0,1,0,0,1,-1,0,-1,0,0,1,-1,0,-1,-1,0];
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
    const m=own(new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.85,side:THREE.DoubleSide,flatShading:true}));
    const mesh=new THREE.InstancedMesh(g,m,items.length);mesh.name=name;mesh.castShadow=tier==='full';
    const o=new THREE.Object3D();items.forEach((it,i)=>{o.position.set(...it.at);o.rotation.set(0,it.yaw,0);o.scale.set(it.w,it.h,1);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);mesh.setColorAt(i,new THREE.Color(...it.col));});
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;group.add(mesh);
    cloth.push({mesh,items:items.map(it=>({at:it.at,yaw:it.yaw,phase:it.phase,amp:it.amp,w:it.w,h:it.h}))});
  };
  clothMesh(pennantItems,pal.theme==='newfoundland'?'quad':'tri','Pennants on strings');
  clothMesh(laundryItems,'quad','Laundry on the line');
  // The waterwheel beside Orchard Lane's bridge, in the river.
  let wheel:THREE.Object3D|null=null;
  const lane=ORCHARD_LANE_LINE.samples,bridge=lane.filter(s=>s.bridgeId);
  if(bridge.length){
    const mid=bridge[Math.floor(bridge.length/2)]!,R=riverSamples(1);let k0=0,d=Infinity;R.forEach((r,i)=>{const e=Math.hypot(r.p[0]-mid.at[0],r.p[2]-mid.at[2]);if(e<d){d=e;k0=i;}});
    // Nine units downstream of the bridge, at the river's edge so the paddles dip in the water.
    const r=R[Math.min(R.length-1,k0+9)]!,rr=1.7,wx=r.p[0]+r.side[0]*1.6,wz=r.p[2]+r.side[2]*1.6,wy=r.p[1]+rr-.45,axis=Math.atan2(r.side[0],r.side[2]);
    const frame=new CardBuilder('Waterwheel frame',tier,{ink:pal.ink,cell:Infinity});
    for(const s of [-1,1]){const fx=wx+r.side[0]*s*.75,fz=wz+r.side[2]*s*.75;frame.box(fx,fz,axis,.12,.12,Math.min(r.p[1],groundHeightAt(fx,fz))-.4,wy+.2,pal.timberLight,pal.timber);}
    frame.beam([wx-r.side[0]*.9,wy+.2,wz-r.side[2]*.9],[wx+r.side[0]*.9,wy+.2,wz+r.side[2]*.9],.2,.2,pal.timber);
    const fb=frame.finish();group.add(fb.group);owned.push(fb);
    const hub=new THREE.Group();hub.position.set(wx,wy,wz);hub.rotation.y=axis-Math.PI/2;group.add(hub);
    const w=new THREE.Group();w.name='Orchard waterwheel';hub.add(w);
    const wb=new CardBuilder('Waterwheel',tier,{ink:pal.ink,cell:Infinity});
    for(let k=0;k<10;k++){const a=k/10*Math.PI*2,c=Math.cos(a),s=Math.sin(a);wb.beam([-.35,c*.2,s*.2],[-.35,c*rr,s*rr],.08,.08,pal.timber,null);wb.beam([.35,c*.2,s*.2],[.35,c*rr,s*rr],.08,.08,pal.timber,null);
      wb.beam([0,c*(rr-.4),s*(rr-.4)],[0,c*(rr+.25),s*(rr+.25)],.84,.07,pal.plank,b.pencil);}
    for(const x0 of [-.35,.35]){const ring:V3[]=[];for(let k=0;k<=20;k++){const a=k/20*Math.PI*2;ring.push([x0,Math.cos(a)*rr,Math.sin(a)*rr]);}wb.tube(ring,.06,pal.timber,4);}
    wb.beam([-.7,0,0],[.7,0,0],.18,.18,pal.iron,null,'steel');
    const built=wb.finish();w.add(built.group);owned.push(built);wheel=w;
  }
  // Chimney smoke sources: the home and the pottery kiln (their village exteriors carry the stacks).
  const smoke:V3[]=[];
  const home=placementOf('kitchen'),kiln=placementOf('kiln');
  if(home)smoke.push(placementToWorld(home,[4.5-.7,5.9,-3.5+.55]) as V3);
  if(kiln)smoke.push(placementToWorld(kiln,[3.8-1,5.9,-2.9+.85]) as V3);
  void ICON;
  return {group,cloth,smoke,wheel,dispose(){owned.forEach(x=>x.dispose());group.removeFromParent();group.clear();}};
}
