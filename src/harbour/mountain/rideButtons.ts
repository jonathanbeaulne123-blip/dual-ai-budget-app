/** Sculpted station and carriage controls. Their meshes, rather than a panel, own the tap targets. */
import * as THREE from 'three';
import type {ThemeId} from '../../theme/scenes.ts';
import {TRANSPORT_LINES,type TransportKind,type Point3} from './definition.ts';

export type RideButtonAction=
  |{action:'board';kind:TransportKind;from:number;to:number}
  |{action:'skip'|'seat';kind:TransportKind};

export function buildRideButtons(theme:ThemeId){
  const group=new THREE.Group();group.name='Physical funicular and gondola controls';
  const cabin=new THREE.Group();cabin.name='Ride carriage buttons';group.add(cabin);cabin.visible=false;
  const owned:(THREE.BufferGeometry|THREE.Material)[]=[];
  const colors=theme==='taylor'?{base:0x75536b,face:0xf2c2d7,mark:0x56314d}:theme==='newfoundland'?{base:0x315c68,face:0xdcc796,mark:0x173d4b}:{base:0x665038,face:0xe1ba6b,mark:0x332619};
  const material=(color:number)=>{const m=new THREE.MeshStandardMaterial({color,metalness:.42,roughness:.38,flatShading:true,side:THREE.DoubleSide});owned.push(m);return m;};
  const base=material(colors.base),face=material(colors.face),mark=material(colors.mark);
  const box=(parent:THREE.Group,size:readonly[number,number,number],at:readonly[number,number,number],mat:THREE.Material)=>{
    const geo=new THREE.BoxGeometry(...size);owned.push(geo);const mesh=new THREE.Mesh(geo,mat);mesh.position.set(...at);parent.add(mesh);return mesh;
  };
  const cap=(parent:THREE.Group,at:readonly[number,number,number],action:RideButtonAction,vertical:boolean)=>{
    const button=new THREE.Group();button.position.set(...at);button.name=`${action.kind} ${action.action}${action.action==='board'?` ${action.from} to ${action.to}`:''}`;
    button.userData.rideButton=action;
    if(vertical){box(button,[.62,.62,.18],[0,0,0],base);box(button,[.47,.47,.1],[0,0,-.12],face);}
    else{box(button,[.64,.18,.64],[0,0,0],base);box(button,[.48,.08,.48],[0,.13,0],face);}
    parent.add(button);return button;
  };
  const arrow=(parent:THREE.Group,up:boolean,vertical:boolean)=>{
    const triangle=new THREE.Shape();triangle.moveTo(0,up?.19:-.19);triangle.lineTo(-.19,up?-.12:.12);triangle.lineTo(.19,up?-.12:.12);triangle.closePath();
    const geo=new THREE.ExtrudeGeometry(triangle,{depth:.045,bevelEnabled:false});owned.push(geo);
    const mesh=new THREE.Mesh(geo,mark);mesh.rotation.x=vertical?0:Math.PI/2;mesh.position.set(0,vertical?0:.185,vertical?-.19:0);parent.add(mesh);
  };
  for(const kind of ['funicular','gondola'] as const){
    const line=TRANSPORT_LINES[kind];line.stations.forEach((station,from)=>{
      const outer=new THREE.Group();outer.name=`${kind} station ${station.id} controls`;outer.position.set(...station.platform.at);outer.rotation.y=station.platform.yaw;group.add(outer);
      const directions=[from-1,from+1].filter(to=>to>=0&&to<line.stations.length);
      directions.forEach((to,i)=>{
        const x=(i-(directions.length-1)/2)*.85;
        box(outer,[.12,.75,.12],[x,.38,0],base);
        const button=cap(outer,[x,.82,0],{action:'board',kind,from,to},false);
        arrow(button,to>from,false);
      });
    });
  }
  const cabinButtons=new Map<TransportKind,THREE.Group>();
  for(const kind of ['funicular','gondola'] as const){
    const set=new THREE.Group();cabinButtons.set(kind,set);cabin.add(set);
    const back=kind==='funicular'?-2.02:-1.28;
    box(set,[kind==='gondola'?1.45:.8,.88,.1],[0,1.34,back+.08],base);
    const skip=cap(set,[kind==='gondola'?.39:0,1.34,back],{action:'skip',kind},true);arrow(skip,true,true);
    if(kind==='gondola'){
      const seat=cap(set,[-.39,1.34,back],{action:'seat',kind},true);
      box(seat,[.23,.08,.04],[0,-.08,-.19],mark);box(seat,[.07,.24,.04],[-.11,.02,-.19],mark);
    }
  }
  return {group,
    setCabin(kind:TransportKind|null,at?:Point3,yaw=0){cabin.visible=kind!==null;if(!kind||!at)return;cabin.position.set(...at);cabin.rotation.y=yaw;for(const [name,set] of cabinButtons)set.visible=name===kind;},
    dispose(){group.removeFromParent();for(const item of owned)item.dispose();group.clear();}
  };
}
