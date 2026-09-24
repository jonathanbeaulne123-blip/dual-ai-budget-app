import * as THREE from 'three';
import type {PlaceDressing,Anchor,Region} from '../scene/place.ts';
import {MOUNTAIN_INTERACTIONS,initialMountainInteractionState,mountainWildlifePose,type MountainInteractionState} from './life.ts';

/** Original, small, non-colliding props. Uses the world's frame owner and theme materials. */
export function buildMountainLife(dressing:PlaceDressing) {
  const group=new THREE.Group();group.name='Mountain living details';
  const owned:{dispose():void}[]=[],anchors:Anchor[]=[],regions:Region[]=[];
  const own=<T extends {dispose():void}>(value:T):T=>{owned.push(value);return value;};
  const material=(color:string)=>own(new THREE.MeshStandardMaterial({color,roughness:.84,flatShading:true}));
  const wood=material(dressing.timber),brass=material(dressing.metal),pale=material(dressing.plinth),ink=material(dressing.joint),accent=material(dressing.gate);
  const shape=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0)=>{const o=new THREE.Mesh(own(g),m);o.position.set(x,y,z);parent.add(o);return o;};
  const box=(parent:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>shape(new THREE.BoxGeometry(w,h,d),m,parent,x,y,z);
  const gates=new Map<string,THREE.Group>();
  const wildlife:{object:THREE.Group;base:THREE.Vector3;kind:'birds'|'moths'|'gull';index:number;wings:THREE.Mesh[]}[]=[];
  let bell:THREE.Group|null=null,bellTime=0,quiet=false,state=initialMountainInteractionState(),primed=false,disposed=false;
  for(const item of MOUNTAIN_INTERACTIONS) {
    const root=new THREE.Group();root.name=item.label;root.position.set(...item.at);group.add(root);
    if(item.kind==='bench') {
      // The landscape owns the seat; this small backrest is its reachable region.
      box(root,wood,0,.95,-.28,3,.32,.13);
      if(dressing.theme==='taylor')box(root,accent,.7,1.15,-.28,.36,.18,.16);
      else if(dressing.theme==='newfoundland')shape(new THREE.TorusGeometry(.12,.025,4,10),brass,root,.8,.95,-.19);
    } else if(item.kind==='gate') {
      for(const x of [-1.2,1.2])box(root,wood,x,.65,0,.17,1.3,.17);
      const gate=new THREE.Group();gate.position.x=-1.12;root.add(gate);gates.set(item.id,gate);
      for(const y of [.35,.95])box(gate,wood,1.1,y,0,2.2,.12,.1);
      for(let i=0;i<6;i++)box(gate,dressing.theme==='taylor'&&i%2?accent:wood,.16+i*.36,.67,0,.13,.85,.12);
      if(dressing.theme==='newfoundland')shape(new THREE.TorusGeometry(.14,.035,4,10),brass,gate,1.9,.9,.1);
    } else if(item.kind==='bell') {
      for(const x of [-.55,.55])box(root,wood,x,1,0,.15,2,.15);
      box(root,dressing.theme==='classic'?brass:wood,0,2,0,1.4,.15,.45);
      bell=new THREE.Group();bell.position.y=1.8;root.add(bell);
      shape(new THREE.CylinderGeometry(.17,.36,.5,12,1,true),brass,bell,0,-.25,0);
      shape(new THREE.SphereGeometry(.065,8,6),ink,bell,0,-.5,0);
      if(dressing.theme==='taylor')box(root,accent,.48,1.7,.1,.12,.6,.05);
    } else if(item.kind==='overlook') {
      box(root,wood,0,.6,0,.16,1.2,.16);
      const board=box(root,dressing.theme==='taylor'?accent:pale,0,1.15,0,1.5,.12,.65);board.rotation.x=.2;
      for(let i=0;i<3;i++)box(root,brass,-.42+i*.4,1.24,0,.22,.03,.26);
    } else {
      const kind=item.id.endsWith('moths')?'moths':item.id.endsWith('gull')?'gull':'birds';
      const count=kind==='moths'?3:kind==='birds'?2:1;
      for(let i=0;i<count;i++) {
        const bird=new THREE.Group();bird.position.set(i*.85,.25+i*.06,Math.sin(i)*.4);root.add(bird);
        const wings:THREE.Mesh[]=[];
        if(kind==='moths') {
          bird.position.y=.8;shape(new THREE.CylinderGeometry(.025,.025,.2,5),ink,bird);
          for(const side of [-1,1]) {const wing=shape(new THREE.SphereGeometry(.15,5,4),dressing.theme==='taylor'?accent:pale,bird,side*.12,0,0);wing.scale.set(1,.12,1.3);wings.push(wing);}
        } else {
          const body=shape(new THREE.SphereGeometry(kind==='gull'?.24:.16,7,5),kind==='gull'?pale:wood,bird);body.scale.set(1,1,1.4);
          shape(new THREE.SphereGeometry(kind==='gull'?.14:.105,6,4),kind==='gull'?pale:accent,bird,0,.16,.2);
          const beak=shape(new THREE.ConeGeometry(.05,.17,4),brass,bird,0,.16,.35);beak.rotation.x=Math.PI/2;
          for(const side of [-1,1]) {const wing=shape(new THREE.SphereGeometry(.16,5,4),ink,bird,side*.14,0,-.03);wing.scale.set(.3,.7,1.6);wings.push(wing);}
        }
        wildlife.push({object:bird,base:bird.position.clone(),kind,index:i,wings});
      }
    }
    root.traverse(o=>{o.userData.anchor=item.id;});
    anchors.push({id:item.id,position:[item.at[0],item.at[1]+1,item.at[2]],zone:'mountain-life',label:item.label});
    regions.push({id:item.id,group:'court',label:item.label,objects:[root]});
  }
  function paint(t:number) {
    for(const [id,gate] of gates)gate.rotation.y=state.openGates.includes(id)?-Math.PI*.65:0;
    if(bell)bell.rotation.z=quiet?0:Math.sin(bellTime*11)*Math.min(.3,bellTime*.18);
    for(const w of wildlife) {
      const pose=mountainWildlifePose(w.kind,w.index,t,quiet);
      w.object.position.set(w.base.x+pose.x,w.base.y+pose.y,w.base.z+pose.z);
      w.wings.forEach((wing,i)=>{wing.rotation.z=pose.wing*(i?1:-1);});
    }
  }
  return {group,anchors,regions,
    setInteraction(next:MountainInteractionState){if(primed&&next.bellRings>state.bellRings&&!quiet)bellTime=1.5;state=next;primed=true;paint(0);},
    setQuiet(value:boolean){if(quiet===value)return;quiet=value;if(quiet)bellTime=0;paint(0);},
    animate(t:number,dt:number){if(disposed||quiet)return false;bellTime=Math.max(0,bellTime-Math.max(0,Math.min(.1,dt)));paint(t);return true;},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();owned.forEach(o=>o.dispose());group.clear();},
  };
}
