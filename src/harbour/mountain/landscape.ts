import {buildMountainArchitecture,buildMountainCabin} from './architecture.ts';
import * as THREE from 'three';
import {mountainTrees} from './planting.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {PlaceDressing,PlaceReading,Anchor,Region} from '../scene/place.ts';
import type {RenderTier} from '../scene/quality.ts';
import {EngravedPlate} from '../court/engraved.ts';
import {BASIN,DISTRICTS,RESERVED_PLOTS,RIVER,FUNICULAR_STOPS,GONDOLA_STOPS,MONORAIL_STOPS,MOUNTAIN_ROAD,nearestOnRoute,mountainBaseHeight,transportPoint,type Point3,type TransportKind} from './definition.ts';
import {WORLD_SURFACES,WORLD_SOLIDS} from './surfaces.ts';
import {MOUNTAIN_GATES} from './race.ts';
import {basinMoney,createBasinView} from './basin.ts';
import {buildMountainLife} from './lifeScene.ts';
import type {MountainInteractionState} from './life.ts';
import type {MountainRecoveryView} from './recovery.ts';

/** A single authored scene. Batched plants and bounded effects share Harbour's frame owner. */
export function buildMountainLandscape(dressing:PlaceDressing,tier:RenderTier,reading:PlaceReading|null){
  const group=new THREE.Group();group.name='Hearth Mountain';
  const owned:{dispose():void}[]=[],anchors:Anchor[]=[],regions:Region[]=[];
  const life=buildMountainLife(dressing);group.add(life.group);anchors.push(...life.anchors);regions.push(...life.regions);
  const track=<T extends {dispose():void}>(v:T)=>{owned.push(v);return v;};
  const mat=(color:string,extra:THREE.MeshStandardMaterialParameters={})=>track(new THREE.MeshStandardMaterial({color,roughness:.86,flatShading:true,...extra}));
  const stone=mat(dressing.stone),wood=mat(dressing.timber),leaf=mat(dressing.lawn),water=mat(dressing.sea,{roughness:.21,metalness:.22}),metal=mat(dressing.metal,{metalness:.35,roughness:.5});
  const paper=mat(dressing.plinth),roof=mat(dressing.gate),glass=mat('#b1e8de',{transparent:true,opacity:.25,roughness:.18,depthWrite:false,side:THREE.DoubleSide});
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,at:Point3,name:string)=>{const o=new THREE.Mesh(track(g),m);o.position.set(...at);o.name=name;o.receiveShadow=true;group.add(o);return o;};
  const box=(at:Point3,size:Point3,m=wood,name='Mountain detail')=>mesh(new THREE.BoxGeometry(...size),m,at,name);
  const beams:THREE.Mesh[]=[];
  function beam(a:Point3,b:Point3,r=.1,m=wood){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),o=mesh(new THREE.CylinderGeometry(r,r,va.distanceTo(vb),6),m,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],'beam');o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());beams.push(o);return o;}
  const sign=(text:string,at:Point3,id:string,width=6)=>{
    id=`${id}@${at.join(',')}`;
    const s=track(new EngravedPlate({stone:dressing.plinth,highlight:'#fff6d7',ink:dressing.joint,size:'small',width:768,fit:true},width,Math.max(1.35,width/4)));s.set(text);s.mesh.position.set(...at);s.mesh.userData.anchor=id;group.add(s.mesh);
    anchors.push({id,position:at,zone:'landmark',label:text});regions.push({id,group:'court',label:text,objects:[s.mesh]});return s;
  };
  function ribbon(points:readonly Point3[],width:number,m:THREE.Material,name:string,offset=.04){
    const positions:number[]=[],indices:number[]=[];
    points.forEach((p,i)=>{const before=points[Math.max(0,i-1)]!,after=points[Math.min(points.length-1,i+1)]!,dx=after[0]-before[0],dz=after[2]-before[2],l=Math.hypot(dx,dz)||1;
      positions.push(p[0]-dz/l*width,p[1]+offset,p[2]+dx/l*width,p[0]+dz/l*width,p[1]+offset,p[2]-dx/l*width);
      if(i)indices.push((i-1)*2,i*2,(i-1)*2+1,(i-1)*2+1,i*2,i*2+1);
    });const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const o=mesh(g,m,[0,0,0],name);o.userData.ground=true;return o;
  }
  for(const s of WORLD_SURFACES){
    ribbon(s.points,s.halfWidth,s.material==='wood'?wood:s.material==='metal'?metal:stone,s.id);
    if(s.id==='mountain-road')for(let i=0;i<s.points.length;i+=6){const p=s.points[i]!;if(p[1]-mountainBaseHeight(p[0],p[2])<2)continue;const n=s.points[Math.min(i+1,s.points.length-1)]!,dx=n[0]-p[0],dz=n[2]-p[2],l=Math.hypot(dx,dz)||1;
      for(const side of [-1,1]){const x=p[0]+dz/l*4.7*side,z=p[2]-dx/l*4.7*side,base=mountainBaseHeight(x,z);beam([x,base,z],[x,p[1]+1,z],.19,stone);}
    }
  }
  for(const solid of WORLD_SOLIDS.filter(s=>!s.id.startsWith('station-art:')&&!s.id.startsWith('district-art:')&&!s.id.startsWith('summit-art:'))){const x=(solid.min[0]+solid.max[0])/2,z=(solid.min[2]+solid.max[2])/2;beam([x,solid.min[1],z],[x,solid.max[1],z],.12,stone);}
  ribbon(RIVER,2.2,water,'River to the town square',.08);
  // Curved transparent retaining face and its water volume share the authored basin radius.
  const arc=mesh(new THREE.CylinderGeometry(BASIN.radius,BASIN.radius,BASIN.top-BASIN.bottom,48,1,true,-BASIN.angle/2,BASIN.angle),glass,[BASIN.x,(BASIN.top+BASIN.bottom)/2,BASIN.z],'Glass Fund dam');arc.userData.anchor='mountain:basin';
  const basinMaterial=mat(dressing.sea,{transparent:true,opacity:.78,depthWrite:false,roughness:.16,metalness:.15});
  const reservoir=mesh(new THREE.CylinderGeometry(BASIN.radius-.3,BASIN.radius-.3,1,48),basinMaterial,[BASIN.x,BASIN.bottom,BASIN.z],'Accepted Fund water');
  const reserve=mesh(new THREE.CylinderGeometry(4,4,1,20),basinMaterial,[BASIN.x+22,BASIN.bottom,BASIN.z],'Kitty reserve chamber');
  mesh(new THREE.CylinderGeometry(4.2,4.2,12,20,1,true),glass,[BASIN.x+22,BASIN.bottom+6,BASIN.z],'Reserve glass');
  for(let i=0;i<=12;i++){const a=-BASIN.angle/2+i/12*BASIN.angle,x=BASIN.x+Math.sin(a)*BASIN.radius,z=BASIN.z+Math.cos(a)*BASIN.radius;beam([x,BASIN.bottom-1,z],[x,BASIN.top+.4,z],i===0||i===12?.8:.11,i===0||i===12?stone:metal);}
  for(const side of [-1,1]){const a=side*BASIN.angle/2;box([BASIN.x+Math.sin(a)*BASIN.radius,80,BASIN.z+Math.cos(a)*BASIN.radius],[3.5,19,4],stone,'Dam stone abutment');}
  const gauge=sign('Household Fund · checking',[25,94,-221],'mountain:basin',11);
  const scaleGauge=sign('CAD scale',[25,90.8,-220.8],'mountain:basin',11);
  sign('Kitty reserves',[49,85,-234],'mountain:basin',5);
  // Source cave is scenery; only discrete accepted events light the financial channel.
  mesh(new THREE.IcosahedronGeometry(6,0),stone,[25,84,-258],'Reservoir source rock');
  const pulse=mesh(new THREE.SphereGeometry(.75,10,8),mat('#f7dfa0',{emissive:'#e8b567',emissiveIntensity:.3}),RIVER[0]!,'Accepted movement pulse');pulse.visible=false;
  sign('Where the Fund flows',[-8,2,-14],'mountain:basin',5);
  let flowPath:readonly Point3[]=RIVER;let phase=0,remaining=0,target=0,current=0,reserveTarget=0,reserveCurrent=0,calm=false;
  const readBasin=createBasinView();let last:PlaceReading|null=null;
  const sheltered:THREE.Object3D[]=[],mends:THREE.Object3D[]=[],goalDetails:THREE.Object3D[]=[];
  let recovery:MountainRecoveryView|null=null,observedWear=0,renderedQuiet=false;
  const isQuiet=()=>calm||(typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  const details=new THREE.Group();details.name='Accepted backing details';group.add(details);
  for(const d of DISTRICTS){
    sign(d.name,[d.at[0]-9,d.at[1]+2,d.at[2]+8],`mountain:district:${d.id}`,8);
    box([d.at[0]-6,d.at[1]+.55,d.at[2]+9],[3,.18,.7],wood,'Lookout bench');
    box([d.at[0]-6,d.at[1]+.25,d.at[2]+9],[.2,.5,.65],stone);
    if(d.id==='reservoir'||d.id==='summit'){
      const cx=d.at[0]-(d.id==='reservoir'?24:0),cz=d.at[2]+(d.id==='reservoir'?0:8);
      if(d.id==='reservoir')for(const dx of [-3,3])for(const dz of [-2.5,2.5])box([cx+dx,d.at[1]+2,cz+dz],[.22,4,.22],wood,'Pavilion column');
      if(d.id==='reservoir'){const cap=mesh(new THREE.ConeGeometry(5,2.3,4),roof,[cx,d.at[1]+5,cz],'Goal pavilion roof');cap.rotation.y=Math.PI/4;}
      if(d.id==='reservoir')for(let i=0;i<10;i++){const o=box([cx-2.5+i*.55,d.at[1]+1,cz],[.35,2,.35],stone,'Goal backing column');details.add(o);goalDetails.push(o);}
      sign(d.id==='summit'?'Our journey':'A place in the making',[cx,d.at[1]+1.6,cz+2.6],d.id==='summit'?'mountain:journey':'mountain:goals',5);
    }
  }
  for(const plot of RESERVED_PLOTS){
    sign(plot.name,[plot.at[0],plot.at[1]+1.6,plot.at[2]+6],`mountain:plot:${plot.id}`,7);
    for(const side of [-1,1])box([plot.at[0]+side*plot.half[0],plot.at[1]+.3,plot.at[2]],[.6,.6,.6],stone,'Reserved plot marker');
  }
  // Deterministic planting. Road, doors, reserved envelopes and the basin remain clear.
  let seed=84731;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const trees:THREE.Matrix4[]=[],flowers:THREE.Matrix4[]=[],trunks:THREE.Matrix4[]=[],flowerColors:THREE.Color[]=[];
  const dummy=new THREE.Object3D();
  for(const tree of mountainTrees(tier)){
    const {x,y:h,z,size:sc,spin}=tree;dummy.position.set(x,h+.7*sc,z);dummy.scale.set(sc,sc,sc);dummy.rotation.set(0,spin,0);dummy.updateMatrix();trunks.push(dummy.matrix.clone());
    dummy.position.y=h+2.6*sc;dummy.scale.set(sc*1.8,sc*1.8,sc*1.8);dummy.updateMatrix();trees.push(dummy.matrix.clone());
  }
  for(const d of DISTRICTS)for(let i=0;i<(tier==='full'?110:55);i++){
    const angle=rand()*6.28,r=10+rand()*18,x=d.at[0]+Math.cos(angle)*r,z=d.at[2]+Math.sin(angle)*r,h=mountainBaseHeight(x,z);
    if(nearestOnRoute(x,z).distance<5.6||Math.hypot(x-BASIN.x,z-BASIN.z)<18||h<1)continue;
    dummy.position.set(x,h+.25,z);dummy.scale.set(.14+rand()*.12,.25,.14+rand()*.12);dummy.updateMatrix();flowers.push(dummy.matrix.clone());flowerColors.push(new THREE.Color([dressing.plinth,dressing.gate,dressing.metal,'#ad91b8'][i%4]!));
  }
  function instanced(g:THREE.BufferGeometry,m:THREE.Material,matrices:THREE.Matrix4[],name:string){const o=new THREE.InstancedMesh(track(g),m,matrices.length);matrices.forEach((v,i)=>o.setMatrixAt(i,v));o.name=name;o.instanceMatrix.needsUpdate=true;group.add(o);owned.push(o);return o;}
  instanced(new THREE.CylinderGeometry(.14,.22,1.4,5),wood,trunks,'Mountain trunks');
  instanced(dressing.theme==='taylor'?new THREE.IcosahedronGeometry(1.3,0):new THREE.ConeGeometry(1.1,dressing.theme==='newfoundland'?2.2:2.8,6),leaf,trees,'Mountain woodland');
  const blossoms=instanced(new THREE.IcosahedronGeometry(1,0),mat('#ffffff'),flowers,'Flower meadows');flowerColors.forEach((c,i)=>blossoms.setColorAt(i,c));if(blossoms.instanceColor)blossoms.instanceColor.needsUpdate=true;blossoms.count=Math.round(flowers.length*.4);
  for(const [kind,stops] of [['funicular',FUNICULAR_STOPS],['gondola',GONDOLA_STOPS],['monorail',MONORAIL_STOPS]] as const){
    for(const stop of stops){sign(`${stop.name} · ${kind}`,[stop.at[0],stop.at[1]+3,stop.at[2]+2.45],`mountain:transport:${kind}:${stop.id}`,5.5);}
    for(let i=1;i<stops.length;i++)for(let k=1;k<=48;k++){
      const a=transportPoint(kind,i-1,i,(k-1)/48),b=transportPoint(kind,i-1,i,k/48),lift=kind==='gondola'?3:.1;
      for(const side of kind==='gondola'?[0]:[-.8,.8])beam([a[0]+side,a[1]+lift,a[2]],[b[0]+side,b[1]+lift,b[2]],kind==='gondola'?.06:.09,metal);
      if(k%8===0){const y=mountainBaseHeight(b[0],b[2]);if(b[1]>y+1)beam([b[0],Math.max(0,y),b[2]],[b[0],b[1]+lift,b[2]],.3,stone);}
    }
  }
  const architecture=buildMountainArchitecture(dressing,tier);group.add(architecture.group);owned.push(architecture);
  const cabins={funicular:buildMountainCabin(dressing,tier,'funicular'),gondola:buildMountainCabin(dressing,tier,'gondola'),monorail:buildMountainCabin(dressing,tier,'monorail')};
  for(const art of Object.values(cabins)){group.add(art.group);art.group.visible=false;owned.push(art);}
  const companionFigure=new THREE.Group();companionFigure.name='Bianca story seat';cabins.monorail.group.add(companionFigure);
  const doors=[-1,1].map(side=>{const panel=mesh(new THREE.BoxGeometry(.07,1.55,.7),metal,[1.31,.12,side*.38],'Monorail sliding door');cabins.monorail.group.add(panel);return panel;});
  const companionCoat=mat(dressing.theme==='taylor'?'#a56e86':dressing.theme==='newfoundland'?'#567887':'#9b806d');
  const companionHead=mat('#d7aa87');
  const companionPart=(geometry:THREE.BufferGeometry,material:THREE.Material,at:Point3)=>{const part=new THREE.Mesh(track(geometry),material);part.position.set(...at);companionFigure.add(part);};
  companionPart(new THREE.SphereGeometry(.22,8,6),companionHead,[.7,.42,-.55]);
  companionPart(new THREE.CylinderGeometry(.24,.28,.55,8),companionCoat,[.7,-.02,-.55]);
  companionPart(new THREE.CylinderGeometry(.18,.15,.5,8),companionCoat,[.7,-.5,-.28]);
  companionFigure.visible=false;
  // Three architectural grind routes are real deck surfaces above terrain.
  for(const [name,x,z] of [['Outfitters',-15,16],['Potter’s Supply',34,25]] as const){box([x,1.6,z],[5,3.2,4],paper,name);const r=mesh(new THREE.ConeGeometry(4,2,4),roof,[x,4.1,z],`${name} roof`);r.rotation.y=Math.PI/4;sign(name,[x,2,z+2.1],name==='Outfitters'?'mountain:outfitters':'mountain:pottery',4.5);}
  for(let i=1;i<MOUNTAIN_GATES.length;i++){const g=MOUNTAIN_GATES[i]!;if(i%3!==0&&i!==MOUNTAIN_GATES.length-1)continue;for(const side of [-1,1]){const x=g.at[0]+g.normal[1]*5*side,z=g.at[2]-g.normal[0]*5*side;beam([x,g.at[1],z],[x,g.at[1]+1.7,z],.08,metal);}}
  sign('Summit to sea · start',[5,112,-280],'mountain:race',8);
  sign('Summit to sea · finish',[31,2,61],'mountain:race',7);
  // Bounded weathering only on non-colliding peripheral stones and timber.
  for(let i=0;i<20;i++){const p=MOUNTAIN_ROAD[Math.floor(i/20*(MOUNTAIN_ROAD.length-1))]!;sheltered.push(box([p[0]+8,p[1]+.3,p[2]],[.5,.6,1.5],wood,'Weathered edge timber'));if(i%5===0){const mend=box([p[0]+8,p[1]+.62,p[2]],[.52,.06,.18],metal,'Observed repair binding');mend.visible=false;mends.push(mend);}}
  // Themes author different non-colliding details over the same routes.
  for(const d of DISTRICTS){
    for(let i=0;i<5;i++){
      const at:Point3=[d.at[0]-7+i*2,d.at[1]+2.5,d.at[2]+8];
      if(dressing.theme==='taylor'){const flag=mesh(new THREE.ConeGeometry(.45,.8,3),i%2?roof:paper,at,'Scrapbook pennant');flag.rotation.z=Math.PI;}
      else if(dressing.theme==='newfoundland'){mesh(new THREE.TorusGeometry(.32,.07,5,12),wood,at,'Coastal rope loop');}
      else {box([at[0],d.at[1]+.4,at[2]],[.6,.8,.6],stone,'Herb planter');}
    }
  }
  function update(next:PlaceReading|null){const initial=last===null,quiet=isQuiet();renderedQuiet=quiet;life.setQuiet(quiet);last=next;const b=readBasin(next?.basin);target=b.level??0;reserveTarget=b.reserveLevel??0;reservoir.visible=b.level!==null;reserve.visible=b.reserveLevel!==null;
    const basinLabel=`Household Fund · ${basinMoney(next?.basin?.balanceCents)} CAD`;const basinAnchor=anchors.find(a=>a.id===gauge.mesh.userData.anchor);if(basinAnchor)basinAnchor.label=basinLabel;
    gauge.set(`Fund ${basinMoney(next?.basin?.balanceCents)} CAD`);
    scaleGauge.set(`Scale ${basinMoney(b.scaleCents)} CAD${b.scaleChanged?' · expanded':''}`);
    if(b.newFlows.length){
      const flow=b.newFlows[b.newFlows.length-1]!;
      const chambers:readonly Point3[]=[[BASIN.x,85,BASIN.z],[BASIN.x+22,85,BASIN.z]];
      flowPath=flow.kind==='inlet'?[[25,90,-263],[25,85,-239]]:flow.kind==='reserve-out'?chambers:flow.kind==='reserve-in'?[...chambers].reverse():RIVER;
      remaining=3;phase=0;
    }
    // Updates also paint at rest: reduced-motion clients need no animation loop.
    if(initial||quiet){current=target;reserveCurrent=reserveTarget;}const depth=Math.max(.03,current*(BASIN.top-BASIN.bottom));reservoir.scale.y=depth;reservoir.position.y=BASIN.bottom+depth/2;reserve.scale.y=Math.max(.03,reserveCurrent*12);reserve.position.y=BASIN.bottom+reserve.scale.y/2;
    const condition=next?.condition?.state;
    if(recovery)observedWear=recovery.wear;
    else if(next?.freshness==='current'&&condition&&condition!=='checking')observedWear=condition==='weathered'?1:condition==='wilting'?.35:0;
    const wear=quiet?0:observedWear;
    sheltered.forEach((o,i)=>{o.rotation.z=wear*(i%2?-.18:.13);o.scale.y=1-wear*.25;});
    mends.forEach((o,i)=>{o.visible=Boolean(recovery&&i<recovery.repairs);});
    const careDays=recovery?recovery.careDays:next?.freshness==='current'?next.mountainCareDays:undefined;
    if(careDays!=null)blossoms.count=Math.min(flowers.length,Math.round(flowers.length*(.4+.6*Math.min(1,careDays/12))));
    if(quiet){pulse.visible=false;remaining=0;blossoms.rotation.z=0;flowers.forEach((matrix,i)=>blossoms.setMatrixAt(i,matrix));blossoms.instanceMatrix.needsUpdate=true;lastVisitor=null;}
    const goals=next?.tower.shelves.flatMap(s=>s.banks).filter(b=>b.goalId),step=goals?.length?Math.max(...goals.map(b=>b.step)):0;
    goalDetails.forEach((o,i)=>{o.visible=i<step;});
  }
  let lastVisitor:Point3|null=null;
  function setVisitor(at:Point3){
    if(isQuiet()||lastVisitor&&Math.hypot(at[0]-lastVisitor[0],at[2]-lastVisitor[2])<.2)return;
    const old=lastVisitor;lastVisitor=at;
    for(let i=0;i<flowers.length;i++){const base=flowers[i]!,px=base.elements[12]!,py=base.elements[13]!,pz=base.elements[14]!;
      const distance=Math.hypot(px-at[0],py-at[1],pz-at[2]);if(distance>2.5&&(!old||Math.hypot(px-old[0],py-old[1],pz-old[2])>2.5))continue;
      base.decompose(dummy.position,dummy.quaternion,dummy.scale);dummy.rotation.z=distance<2.5?(1-distance/2.5)*.45*Math.sign(px-at[0]):0;dummy.updateMatrix();blossoms.setMatrixAt(i,dummy.matrix);
    }blossoms.instanceMatrix.needsUpdate=true;
  }
  // Spatial batches retain frustum culling without one draw per rail segment.
  const batches=new Map<string,THREE.Mesh[]>();
  for(const o of beams){const key=`${(o.material as THREE.Material).uuid}:${Math.floor(o.position.x/64)}:${Math.floor(o.position.z/64)}`,batch=batches.get(key)??[];batch.push(o);batches.set(key,batch);}
  for(const batch of batches.values()){
    const copies=batch.map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);}),merged=mergeGeometries(copies);
    copies.forEach(g=>g.dispose());if(!merged)continue;
    mesh(merged,batch[0]!.material as THREE.Material,[0,0,0],'Mountain rail and bridge batch');
    for(const o of batch){o.removeFromParent();o.geometry.dispose();owned.splice(owned.indexOf(o.geometry),1);}
  }
  update(reading);current=target;
  return {group,anchors,regions,update,setVisitor,setRecovery(value:MountainRecoveryView){recovery=value;update(last);},setInteraction(value:MountainInteractionState){life.setInteraction(value);},setCalm(value:boolean){calm=value;update(last);},setTransit(at:Point3|null,kind:TransportKind='gondola',yaw=0,companion=false,doorGap=0){companionFigure.visible=at!==null&&kind==='monorail'&&companion;doors.forEach((panel,i)=>{panel.position.z=(i===0?-1:1)*(.38+.7*Math.max(0,Math.min(1,doorGap)));});for(const [id,art] of Object.entries(cabins)){art.group.visible=at!==null&&id===kind;if(at&&id===kind){art.group.position.set(at[0],at[1]+1,at[2]);art.group.rotation.y=yaw;}}},
    animate(t:number,dt:number){const quiet=isQuiet();if(quiet!==renderedQuiet)update(last);const step=Math.max(0,Math.min(.1,dt));life.setQuiet(quiet);if(quiet){current=target;reserveCurrent=reserveTarget;remaining=0;pulse.visible=false;blossoms.rotation.z=0;}else{current+=(target-current)*Math.min(1,step*3);reserveCurrent+=(reserveTarget-reserveCurrent)*Math.min(1,step*3);}const depth=Math.max(.03,current*(BASIN.top-BASIN.bottom));reservoir.scale.y=depth;reservoir.position.y=BASIN.bottom+depth/2;reserve.scale.y=Math.max(.03,reserveCurrent*12);reserve.position.y=BASIN.bottom+reserve.scale.y/2;
      remaining=Math.max(0,remaining-step);pulse.visible=remaining>0&&!quiet;if(pulse.visible){phase+=step/3;const n=Math.min(flowPath.length-2,Math.floor(phase*(flowPath.length-1))),a=flowPath[n]!,b=flowPath[n+1]!,u=Math.min(1,phase)*(flowPath.length-1)-n;pulse.position.set(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u+.5,a[2]+(b[2]-a[2])*u);}
      if(!quiet)blossoms.rotation.z=Math.sin(t*.7)*.00012;
      return life.animate(t,step)||Math.abs(current-target)>.001||Math.abs(reserveCurrent-reserveTarget)>.001||remaining>0;
    },dispose(){group.removeFromParent();life.dispose();owned.forEach(o=>o.dispose());group.clear();}};
}
