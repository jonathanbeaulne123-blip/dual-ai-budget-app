import * as THREE from 'three';
import type {PlaceDressing,Anchor,Region} from '../scene/place.ts';
import type {RenderTier} from '../scene/quality.ts';
import {groundHeightAt} from '../scene/ground.ts';
import {DISTRICTS} from './definition.ts';
import {MOUNTAIN_INTERACTIONS,initialMountainInteractionState,mountainWildlifePose,type MountainInteractionState} from './life.ts';
import {CardBuilder,shade,mix,type V3} from '../art/cardScene.ts';
import {mountainArtPalette} from './art/palette.ts';
import {drawBench} from './art/propArt.ts';
import {mountainProps,seat} from './art/placements.ts';
import {downhillYaw} from './art/spots.ts';

/**
 * Original, small, non-colliding living details on the painted-card kit: the interaction
 * benches, gates, the summit bell and the overlook boards, resting birds, moths and a
 * gull, plus ambient wildlife that never implies an event — a small flock on a slow loop
 * over the lower terraces and butterflies in the orchard. Uses the world's frame owner;
 * quiet (calm view, reduced motion) holds everything exactly still.
 */
export function buildMountainLife(dressing:PlaceDressing,tier:RenderTier='full') {
  const group=new THREE.Group();group.name='Mountain living details';
  const owned:{dispose():void}[]=[],anchors:Anchor[]=[],regions:Region[]=[];
  const own=<T extends {dispose():void}>(value:T):T=>{owned.push(value);return value;};
  const pal=mountainArtPalette(dressing);
  const material=(color:THREE.ColorRepresentation)=>own(new THREE.MeshStandardMaterial({color,roughness:.84,flatShading:true}));
  const wood=material(dressing.timber),pale=material(new THREE.Color(...pal.plaster)),ink=material(pal.ink),accent=material(new THREE.Color(...pal.accent)),wing=material(new THREE.Color(...mix(pal.flowers[1]!,[1,1,1],.2)));
  const shape=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0)=>{const o=new THREE.Mesh(own(g),m);o.position.set(x,y,z);parent.add(o);return o;};
  const props=new Map(mountainProps().map(p=>[p.id,p]));
  const card=(name:string,parent:THREE.Object3D,draw:(b:CardBuilder)=>void)=>{const b=new CardBuilder(name,tier,{ink:pal.ink,cell:Infinity});draw(b);const built=own(b.finish());parent.add(built.group);return built.group;};
  const gates=new Map<string,THREE.Group>();
  const wildlife:{object:THREE.Group;base:THREE.Vector3;kind:'birds'|'moths'|'gull';index:number;wings:THREE.Mesh[]}[]=[];
  let bell:THREE.Group|null=null,bellTime=0,quiet=false,state=initialMountainInteractionState(),primed=false,disposed=false;
  // A small bird: a round body, a head, a beak and two wings that beat.
  const bird=(parent:THREE.Object3D,body:THREE.Material,size=1)=>{const g=new THREE.Group();parent.add(g);
    const b=shape(new THREE.IcosahedronGeometry(.16*size,0),body,g);b.scale.set(1,.9,1.5);shape(new THREE.IcosahedronGeometry(.11*size,0),body,g,0,.13*size,.2*size);
    const beak=shape(new THREE.ConeGeometry(.04*size,.14*size,4),accent,g,0,.13*size,.33*size);beak.rotation.x=Math.PI/2;
    const wings=[-1,1].map(side=>{const w=shape(new THREE.BoxGeometry(.3*size,.02,.18*size),ink,g,side*.18*size,.04,0);return w;});return {g,wings};};
  for(const item of MOUNTAIN_INTERACTIONS) {
    const root=new THREE.Group();root.name=item.label;group.add(root);
    const placed=props.get(`${item.kind==='bench'?'bench':item.kind==='gate'?'gate':'bell'}:${item.id}`);
    if(item.kind==='bench') {
      // The whole bench is the interaction's object, seated on its ground.
      const p=placed??seat(`bench:${item.id}`,'bench',item.at[0],item.at[2],downhillYaw(item.at[0],item.at[2]),1.5,.45,1.1);
      card(`${item.label} card`,root,b=>drawBench(b,pal,p));
    } else if(item.kind==='gate') {
      const p=placed??seat(`gate:${item.id}`,'gate',item.at[0],item.at[2],0,1.3,.12,1.4);
      root.position.set(p.x,p.bottom,p.z);root.rotation.y=p.yaw;
      card(`${item.label} posts`,root,b=>{for(const x of [-1.25,1.25]){b.box(x,0,0,.09,.09,0,1.35,pal.timberLight,pal.timber);b.cone(x,0,1.35,1.5,.12,0,pal.theme==='newfoundland'?pal.trim:pal.brass,4,'steel');}
        for(const s of [-1,1])b.box(s*2.1,0,0,.8,.05,0,.9,pal.timberLight,pal.timber,null);});
      const gate=new THREE.Group();gate.position.x=-1.15;root.add(gate);gates.set(item.id,gate);
      card(`${item.label} leaf`,gate,b=>{for(const y of [.35,.95])b.box(1.15,0,0,1.1,.05,y-.06,y+.06,pal.timberLight,pal.timber);
        for(let i=0;i<6;i++)b.box(.18+i*.37,0,0,.06,.04,.2,1.08,pal.theme==='taylor'&&i%2?pal.walls[0]!:pal.theme==='newfoundland'?pal.walls[2]!:pal.plank,pal.timber,null);
        b.beam([.1,.3,0],[2.2,1,0],.06,.05,pal.timber,null);});
    } else if(item.kind==='bell') {
      const p=placed??seat(`bell:${item.id}`,'bell',item.at[0],item.at[2],0,.7,.2,2.3);
      root.position.set(p.x,p.bottom,p.z);root.rotation.y=p.yaw;
      card(`${item.label} frame`,root,b=>{for(const x of [-.6,.6])b.box(x,0,0,.09,.09,0,2.2,pal.timberLight,pal.timber);b.box(0,0,0,.85,.14,2.2,2.36,pal.theme==='classic'?pal.brass:pal.timber,pal.timber);
        if(pal.theme==='taylor')b.box(.5,.1,0,.06,.02,1.5,2.1,pal.tape[0]!,pal.tape[0]!,null);
        b.box(0,0,0,.8,.3,-.1,.12,pal.coping,pal.stone);});
      bell=new THREE.Group();bell.position.y=2.15;root.add(bell);
      card(`${item.label} bell`,bell,b=>{b.cone(0,0,-.55,-.08,.36,.2,pal.brass,12,'steel');b.cone(0,0,-.08,.02,.2,.08,pal.brass,10,'steel');b.cone(0,0,-.62,-.55,.4,.36,shade(pal.brass,.8),12,'steel');b.post(0,0,-.72,-.4,.03,pal.iron,4,'steel');});
    } else if(item.kind==='overlook') {
      const y=groundHeightAt(item.at[0],item.at[2]),yaw=downhillYaw(item.at[0],item.at[2]);root.position.set(item.at[0],y,item.at[2]);root.rotation.y=yaw;
      card(`${item.label} board`,root,b=>{b.box(0,0,0,.08,.08,-.2,1.05,pal.timberLight,pal.timber);
        // A tilted map board with a brass edge and a little engraved panorama line.
        const tilt=(u:number,v:number):V3=>[u,1.05+v*.35,-.2+v*.45];b.quad(tilt(-.7,-.5),tilt(.7,-.5),tilt(.7,.5),tilt(-.7,.5),pal.theme==='taylor'?pal.paperEdge:pal.plaster);
        for(const [a,c] of [[tilt(-.7,-.5),tilt(.7,-.5)],[tilt(.7,-.5),tilt(.7,.5)],[tilt(.7,.5),tilt(-.7,.5)],[tilt(-.7,.5),tilt(-.7,-.5)]] as const)b.line(a,c,pal.brass);
        for(let k=0;k<8;k++){const u0=-.6+k*.15,u1=u0+.15,h=(k%3)*.12;b.line([u0,1.05+(-.1+h)*.35+.01,-.2+(-.1+h)*.45],[u1,1.05+(-.1+((k+1)%3)*.12)*.35+.01,-.2+(-.1+((k+1)%3)*.12)*.45],b.ink);}});
    } else {
      const y=groundHeightAt(item.at[0],item.at[2]);root.position.set(item.at[0],y,item.at[2]);
      const kind=item.id.endsWith('moths')?'moths':item.id.endsWith('gull')?'gull':'birds';
      if(kind==='gull')card('Gull stone',root,b=>{b.cone(0,0,-.1,.35,.55,.4,pal.stone,7);b.cone(0,0,.35,.5,.4,.2,shade(pal.stone,1.1),7);});
      if(kind==='birds')card('Bird perch',root,b=>{for(const x of [-.2,1.2])b.box(x,0,0,.06,.06,-.1,.9,pal.timberLight,pal.timber,null);b.beam([-.3,.85,0],[1.35,.85,0],.08,.08,pal.timber);});
      const count=kind==='moths'?3:kind==='birds'?2:1;
      for(let i=0;i<count;i++) {
        let g:THREE.Group,wings:THREE.Mesh[];
        if(kind==='moths'){g=new THREE.Group();root.add(g);g.position.set(i*.6-.6,.8,Math.sin(i)*.4);shape(new THREE.CylinderGeometry(.025,.025,.2,5),ink,g);wings=[-1,1].map(side=>{const w=shape(new THREE.SphereGeometry(.15,5,4),dressing.theme==='taylor'?accent:pale,g,side*.12,0,0);w.scale.set(1,.12,1.3);return w;});}
        else{const b=bird(root,kind==='gull'?pale:wood,kind==='gull'?1.6:1);g=b.g;wings=b.wings;g.position.set(kind==='gull'?0:i*.85,kind==='gull'?.62:.95+i*.02,kind==='gull'?0:0);}
        wildlife.push({object:g,base:g.position.clone(),kind,index:i,wings});
      }
    }
    root.traverse(o=>{o.userData.anchor=item.id;});
    anchors.push({id:item.id,position:[item.at[0],item.at[1]+1,item.at[2]],zone:'mountain-life',label:item.label});
    regions.push({id:item.id,group:'court',label:item.label,objects:[root]});
  }
  // Ambient flight: a small flock over the lower terraces, butterflies in the orchard.
  const hearth=DISTRICTS.find(d=>d.id==='hearth')!,orchard=DISTRICTS.find(d=>d.id==='orchard')!;
  const flock=Array.from({length:tier==='full'?5:3},(_,i)=>{const b=bird(group,wood,1.3);b.g.name='Flying bird';return {...b,i};});
  const butterflies=Array.from({length:tier==='full'?6:3},(_,i)=>{const g=new THREE.Group();g.name='Orchard butterfly';group.add(g);
    const m=material(new THREE.Color(...pal.flowers[i%pal.flowers.length]!)),w=[-1,1].map(side=>{const wm=shape(new THREE.CircleGeometry(.14,5),m,g,side*.1,0,0);wm.rotation.x=-Math.PI/2;(wm.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;return wm;});return {g,w,i};});
  function flight(t:number){
    flock.forEach(({g,wings,i})=>{const a=t*.11+i*.42,r=38+Math.sin(t*.07+i)*6,cx=(hearth.at[0]+orchard.at[0])/2,cz=(hearth.at[2]+orchard.at[2])/2-8;
      const x=cx+Math.cos(a)*r*1.4,z=cz+Math.sin(a)*r*.7;g.position.set(x,Math.max(groundHeightAt(x,z)+14,42)+Math.sin(t*.9+i*1.7)*1.5,z);g.rotation.set(0,-a+Math.PI,Math.sin(t*.5+i)*.15);
      const beat=Math.sin(t*9+i*1.3)*.7;wings.forEach((w,k)=>{w.rotation.z=beat*(k?1:-1);});});
    butterflies.forEach(({g,w,i})=>{const a=t*.35+i*1.1,x=orchard.at[0]+Math.cos(a+i)*(6+i*1.3)+Math.sin(t*1.7+i)*.8,z=orchard.at[2]+Math.sin(a*1.3+i*2)*(5+i)+10;
      g.position.set(x,groundHeightAt(x,z)+.9+Math.sin(t*2.3+i)*.35,z);g.rotation.y=a*2;const beat=Math.abs(Math.sin(t*14+i))*1.2;w.forEach((m,k)=>{m.rotation.z=beat*(k?1:-1);});});
  }
  function paint(t:number) {
    for(const [id,gate] of gates)gate.rotation.y=state.openGates.includes(id)?-Math.PI*.65:0;
    if(bell)bell.rotation.z=quiet?0:Math.sin(bellTime*11)*Math.min(.3,bellTime*.18);
    for(const w of wildlife) {
      const pose=mountainWildlifePose(w.kind,w.index,t,quiet);
      w.object.position.set(w.base.x+pose.x,w.base.y+pose.y,w.base.z+pose.z);
      w.wings.forEach((wing,i)=>{wing.rotation.z=pose.wing*(i?1:-1);});
    }
    // Held still (calm view, reduced motion), nothing hangs in mid-air: the flock and the
    // butterflies are simply not out; the resting birds and moths stay on their perches.
    for(const f of flock)f.g.visible=!quiet;for(const b of butterflies)b.g.visible=!quiet;
    if(!quiet)flight(t);
  }
  paint(0);
  return {group,anchors,regions,
    setInteraction(next:MountainInteractionState){if(primed&&next.bellRings>state.bellRings&&!quiet)bellTime=1.5;state=next;primed=true;paint(0);},
    setQuiet(value:boolean){if(quiet===value)return;quiet=value;if(quiet)bellTime=0;paint(0);},
    animate(t:number,dt:number){if(disposed||quiet)return false;bellTime=Math.max(0,bellTime-Math.max(0,Math.min(.1,dt)));paint(t);return true;},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();owned.forEach(o=>o.dispose());group.clear();},
  };
}
