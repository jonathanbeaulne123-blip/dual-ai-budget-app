import * as THREE from 'three';
import type {PlaceDressing} from '../scene/place.ts';
import {groundHeightAt} from '../scene/ground.ts';
import {EngravedPlate} from '../court/engraved.ts';
import {SKATE_SPOTS,SKATE_RAMPS,SKATE_RAILS,rampRise,rampWorld,railPoint,SKATE_ROUTES,skateSurface} from './park.ts';
import type {SkateSnapshot} from './session.ts';

export function buildSkatePark(dressing:PlaceDressing){
  const group=new THREE.Group();group.name='Harbour skate spots';
  const owned:{dispose():void}[]=[];
  const palette=dressing.theme==='taylor'?{pave:'#d4bdd0',ramp:'#ead6cf',edge:'#aa567d',paint:'#f5d576'}:dressing.theme==='newfoundland'?{pave:'#87999e',ramp:'#c2ced0',edge:'#356574',paint:'#f1b65d'}:{pave:'#b4b0a2',ramp:'#dad4bc',edge:'#356d68',paint:'#eabf61'};
  const mat=(colour:string,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color:colour,roughness:metalness?.35:.88,metalness,side:THREE.DoubleSide});owned.push(m);return m;};
  const pave=mat(palette.pave),ramp=mat(palette.ramp),edge=mat(palette.edge),paint=mat(palette.paint),steel=mat('#93a9ae',.7);
  function mesh(geometry:THREE.BufferGeometry,material:THREE.Material,name:string){owned.push(geometry);const m=new THREE.Mesh(geometry,material);m.name=name;m.receiveShadow=true;m.castShadow=true;group.add(m);return m;}
  function ribbon(name:string,rows:number,cols:number,point:(u:number,v:number)=>THREE.Vector3,material:THREE.Material){
    const positions:number[]=[],indices:number[]=[];
    for(let z=0;z<=rows;z++)for(let x=0;x<=cols;x++){const p=point(x/cols,z/rows);positions.push(p.x,p.y,p.z);}
    for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){const a=z*(cols+1)+x,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return mesh(geometry,material,name);
  }
  for(const spot of SKATE_SPOTS){
    const concrete=ribbon(`skate-pad-${spot.id}`,12,14,(u,v)=>{const x=spot.x+(u-.5)*spot.halfWidth*2,z=spot.z+(v-.5)*spot.halfDepth*2;return new THREE.Vector3(x,groundHeightAt(x,z)+.035,z);},pave);concrete.userData.ground=true;
    const border=new THREE.BufferGeometry().setFromPoints([[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([x,z])=>{const wx=spot.x+x!*(spot.halfWidth-.3),wz=spot.z+z!*(spot.halfDepth-.3);return new THREE.Vector3(wx,groundHeightAt(wx,wz)+.047,wz);}));owned.push(border);
    const lineMaterial=new THREE.LineBasicMaterial({color:palette.paint});owned.push(lineMaterial);group.add(new THREE.Line(border,lineMaterial));
    const plate=new EngravedPlate({stone:palette.edge,highlight:palette.paint,ink:'#fff9e8',width:768,size:'small',fit:true},4,.82);
    plate.set(spot.name.toUpperCase());plate.mesh.name=`skate-sign-${spot.id}`;plate.mesh.position.set(spot.x,groundHeightAt(spot.x,spot.z+spot.halfDepth)+1.05,spot.z+spot.halfDepth);plate.mesh.userData.anchor=`skate:${spot.id}`;group.add(plate.mesh);owned.push(plate);
    for(const dx of [-1.7,1.7]){const post=mesh(new THREE.BoxGeometry(.09,1.15,.09),edge,'skate-sign-post');post.position.set(spot.x+dx,plate.mesh.position.y-.45,plate.mesh.position.z);}
  }
  for(const r of SKATE_RAMPS){
    const top=ribbon(r.id,48,8,(u,v)=>{const [x,z]=rampWorld(r,(u-.5)*r.width,(v-.5)*r.length);return new THREE.Vector3(x,groundHeightAt(x,z)+.035+rampRise(r,(v-.5)*r.length),z);},ramp);top.userData.ground=true;
    for(const side of [-1,1])ribbon(`${r.id}-cheek-${side}`,48,1,(u,v)=>{const [x,z]=rampWorld(r,side*r.width/2,(v-.5)*r.length);return new THREE.Vector3(x,groundHeightAt(x,z)+.035+rampRise(r,(v-.5)*r.length)*u,z);},edge);
    if(r.kind!=='table')for(const side of r.kind==='kicker'?[1]:[-1,1])ribbon(`${r.id}-back-${side}`,1,8,(u,v)=>{const [x,z]=rampWorld(r,(u-.5)*r.width,side*r.length/2);return new THREE.Vector3(x,groundHeightAt(x,z)+.035+r.height*v,z);},edge);
    // Coloured coping makes the lip visible in all three worlds.
    for(const side of r.kind==='halfpipe'?[-1,1]:[1]){const a=rampWorld(r,-r.width/2,side*r.length/2),b=rampWorld(r,r.width/2,side*r.length/2);const y=rampRise(r,side*r.length/2)+.07;
      const path=new THREE.LineCurve3(new THREE.Vector3(a[0],groundHeightAt(...a)+y,a[1]),new THREE.Vector3(b[0],groundHeightAt(...b)+y,b[1]));mesh(new THREE.TubeGeometry(path,6,.04,6,false),paint,`${r.id}-coping`);}
  }
  for(const rail of SKATE_RAILS){
    const a=railPoint(rail,0,groundHeightAt),b=railPoint(rail,1,groundHeightAt),path=new THREE.LineCurve3(new THREE.Vector3(a.x,a.y,a.z),new THREE.Vector3(b.x,b.y,b.z));
    mesh(new THREE.TubeGeometry(path,8,.055,8,false),steel,rail.id);
    for(const t of [.05,.5,.95]){const at=railPoint(rail,t,groundHeightAt);const post=mesh(new THREE.CylinderGeometry(.04,.05,rail.height,6),edge,`${rail.id}-post`);post.position.set(at.x,at.y-rail.height/2,at.z);}
  }
  const checkpoint=mesh(new THREE.TorusGeometry(2.4,.065,6,40),paint,'skate-next-checkpoint');checkpoint.rotation.x=-Math.PI/2;checkpoint.visible=false;
  const beam=mesh(new THREE.ConeGeometry(.28,.65,4),paint,'skate-checkpoint-arrow');beam.visible=false;
  let gateKey='';
  return {group,checkpoint,
    update(s:SkateSnapshot|null){const run=s?.run,route=run?SKATE_ROUTES.find(r=>r.id===run.id):null,at=run&&!run.finished?route?.points[run.checkpoint]:null;checkpoint.visible=beam.visible=Boolean(at);if(at){const key=at.join(',');if(key!==gateKey){
      gateKey=key;const points=Array.from({length:48},(_,i)=>{const angle=i/48*Math.PI*2,x=at[0]+Math.cos(angle)*2.4,z=at[1]+Math.sin(angle)*2.4;return new THREE.Vector3(x,skateSurface(x,z,groundHeightAt).y+.08,z);});
      const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),64,.045,6,true);
      owned[owned.indexOf(checkpoint.geometry)]=geometry;checkpoint.geometry.dispose();checkpoint.geometry=geometry;checkpoint.rotation.set(0,0,0);
      beam.position.set(at[0],skateSurface(at[0],at[1],groundHeightAt).y+2,at[1]);beam.rotation.z=Math.PI;
    }}},
    dispose(){group.removeFromParent();owned.forEach(o=>o.dispose());group.clear();}};
}
