import * as THREE from 'three';
import type {PlaceDressing} from '../../scene/place.ts';
import type {RenderTier} from '../../scene/quality.ts';
import {buildMountainCabin} from '../../mountain/architecture.ts';
import {MONORAIL_STOPS,transportPoint} from '../../mountain/definition.ts';
import {advanceMonorail,boardMonorail,monorailPosition,selectMonorailStop,type MonorailState,type MonorailView} from '../../mountain/monorail.ts';
import {MOUNTAIN_V2_OFFSET as O} from '../regions/mountainV2/placement.ts';

export type HorizonMonorail=ReturnType<typeof createHorizonMonorail>;

/** The original train and clock in native Mountain space, translated onto the Horizon with its track. */
export function createHorizonMonorail(scene:THREE.Scene,tier:RenderTier,dressing:PlaceDressing){
  const root=new THREE.Group();root.name='Mountain v2 island monorail';root.position.set(O.x,O.y,O.z);scene.add(root);
  const points:THREE.Vector3[]=[];
  for(let i=1;i<MONORAIL_STOPS.length;i++)for(let k=0;k<=48;k++){
    if(i>1&&k===0)continue;
    const p=transportPoint('monorail',i-1,i,k/48);points.push(new THREE.Vector3(...p));
  }
  const railGeometry=new THREE.BufferGeometry().setFromPoints(points);
  const railMaterial=new THREE.LineBasicMaterial({color:dressing.metal});
  const rail=new THREE.Line(railGeometry,railMaterial);rail.name='Monorail track';root.add(rail);
  let cabin=buildMountainCabin(dressing,tier,'monorail');root.add(cabin.group);cabin.group.visible=false;
  let details:{companion:THREE.Group;doors:THREE.Mesh[];dispose:()=>void};
  function decorate(color:string){
    const material=new THREE.MeshStandardMaterial({color}),bodyGeometry=new THREE.CylinderGeometry(.24,.28,.55,8),headGeometry=new THREE.SphereGeometry(.22,8,6),doorGeometry=new THREE.BoxGeometry(.07,1.55,.7);
    const companion=new THREE.Group();companion.name='Scene companion';cabin.group.add(companion);
    const body=new THREE.Mesh(bodyGeometry,material);body.position.set(.7,-.02,-.55);companion.add(body);
    const head=new THREE.Mesh(headGeometry,material);head.position.set(.7,.42,-.55);companion.add(head);
    const doors=[-1,1].map(side=>{const panel=new THREE.Mesh(doorGeometry,material);panel.name=side<0?'Monorail door left':'Monorail door right';panel.position.set(1.31,.12,side*.38);cabin.group.add(panel);return panel;});
    return {companion,doors,dispose:()=>{companion.removeFromParent();doors.forEach(door=>door.removeFromParent());bodyGeometry.dispose();headGeometry.dispose();doorGeometry.dispose();material.dispose();}};
  }
  details=decorate(dressing.gate);
  let state:MonorailState|null=null;
  const ahead=(s:MonorailState)=>{
    if(s.phase==='moving')return transportPoint('monorail',s.station,s.next,Math.min(1,s.progress+.02));
    const end=MONORAIL_STOPS.length-1,next=s.queue[0]??(s.station===end?end-1:s.station+1);
    return MONORAIL_STOPS[s.station+Math.sign(next-s.station)]?.at??MONORAIL_STOPS[s.station]!.at;
  };
  function pose(){
    if(!state)return null;
    const p=monorailPosition(state),forward=ahead(state),yaw=Math.atan2(forward[0]-p[0],forward[2]-p[2]);
    return {at:[p[0]+O.x,p[1]+O.y,p[2]+O.z] as const,yaw,phase:state.phase};
  }
  function sync(){
    cabin.group.visible=state!==null;
    details.companion.visible=Boolean(state?.companion);
    details.doors.forEach((door,i)=>{door.position.z=(i===0?-1:1)*(.38+.7*(state?.phase==='doors-open'?1:0));});
    const p=pose();if(!p)return;
    cabin.group.position.set(p.at[0]-O.x,p.at[1]-O.y+1,p.at[2]-O.z);
    cabin.group.rotation.y=p.yaw;
  }
  return {
    group:root,
    state:()=>state?{...state,queue:[...state.queue]}:null,
    cancel(){state=null;sync();},
    pose,
    board(station:number,companion=false){state=boardMonorail(station,companion);sync();return pose();},
    select(stop:number){if(state){state=selectMonorailStop(state,stop);sync();}return this.state();},
    control(control:'pause'|'brake'|'seat'|'companion'|'speed'|'view'|'exit'|'bell',value?:number|boolean|MonorailView){
      if(!state)return null;
      if(control==='exit'){if(state.phase==='doors-open'){const at=pose();state=null;sync();return at;}return null;}
      if(control==='pause')state={...state,paused:Boolean(value)};
      if(control==='brake')state={...state,brake:Boolean(value)};
      if(control==='seat')state={...state,seated:Boolean(value)};
      if(control==='companion')state={...state,companion:Boolean(value)};
      if(control==='speed'&&(value===.5||value===1||value===1.5))state={...state,throttle:value};
      if(control==='view'&&(value==='front'||value==='window'||value==='outside'))state={...state,view:value};
      sync();return pose();
    },
    update(dt:number){if(state)state=advanceMonorail(state,dt);sync();return pose();},
    camera(){const p=pose();if(!p||!state)return null;
      const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),[x,y,z]=p.at;
      const eye=state.view==='outside'?[x-fx*9,y+7,z-fz*9]:state.view==='front'?[x+fx*.8,y+2.15,z+fz*.8]:[x-fz*.6,y+2.08,z+fx*.6];
      const target=state.view==='window'?[x-fz*18,y+2,z+fx*18]:[x+fx*12,y+2,z+fz*12];
      return {eye:eye as [number,number,number],target:target as [number,number,number]};
    },
    setTheme(next:PlaceDressing){railMaterial.color.set(next.metal);root.remove(cabin.group);details.dispose();cabin.dispose();cabin=buildMountainCabin(next,tier,'monorail');root.add(cabin.group);details=decorate(next.gate);sync();},
    dispose(){root.removeFromParent();details.dispose();cabin.dispose();railGeometry.dispose();railMaterial.dispose();root.clear();},
  };
}
