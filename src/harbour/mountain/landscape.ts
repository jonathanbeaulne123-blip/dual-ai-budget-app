/**
 * Hearth Mountain, dressed: one painted-card world built from the geography contract.
 *
 * Static card (merged per spatial cell): the road and lane with kerbs, parapets and
 * retaining walls; bridges by type; paths, stairs and overlooks; the river and the town
 * channel; the dam's structure; the funicular's track and stations, the gondola's towers
 * and terminals; the storefronts, the goal pavilion, the observatory, station huts; the
 * branches; signposts, benches, lanterns and the rest of the furniture.
 * Dynamic: the Fund's water and its pulses, the dam glass (frosted when unknown), the
 * cabins, cloth, the waterwheel, smoke, planting growth and wear, and life.
 * Calm view and reduced motion hold every moving thing still.
 */
import * as THREE from 'three';
import type {PlaceDressing,PlaceReading,Anchor,Region} from '../scene/place.ts';
import type {RenderTier} from '../scene/quality.ts';
import {EngravedPlate} from '../court/engraved.ts';
import {groundHeightAt} from '../scene/ground.ts';
import {DISTRICTS,RESERVED_PLOTS,RIVER,DAM_PARTS,KITTY_CHAMBERS,GOAL_PAVILION_SITE,SUMMIT_OBSERVATORY_SITE,DOOR_APRONS,MOUNTAIN_PATH_GRAPH,type Point3,type TransportKind} from './definition.ts';
import {TRANSPORT_LINES} from './transport.ts';
import {basinMoney,createBasinView} from './basin.ts';
import {buildMountainLife} from './lifeScene.ts';
import {PAVILION_COLUMNS} from './artGeometry.ts';
import type {MountainInteractionState} from './life.ts';
import type {MountainRecoveryView} from './recovery.ts';
import {CardBuilder,CARD_CLOCK,shade,mix,type V3} from '../art/cardScene.ts';
import {mountainArtPalette} from './art/palette.ts';
import {buildRouteArt} from './art/routeArt.ts';
import {buildBridgeArt} from './art/bridgeArt.ts';
import {buildWaterArt} from './art/waterArt.ts';
import {buildDamStructure,buildDamWater,DAM_ZERO} from './art/damArt.ts';
import {buildTransportArt,buildCabin,type Cabin} from './art/transportArt.ts';
import {buildTownArt} from './art/townArt.ts';
import {house,pavilion,observatory,type SignSpot} from './art/buildingArt.ts';
import {buildPropArt} from './art/propArt.ts';
import {buildPlantArt} from './art/plantArt.ts';
import {buildBranchArt} from './art/branchArt.ts';
import {buildRockArt} from './art/rockArt.ts';
import {setStreamQuiet} from './streaming.ts';
import {mountainProps} from './art/placements.ts';

const seasonOf=(month:number)=>month<2||month===11?'winter' as const:month<5?'spring' as const:month<8?'summer' as const:'autumn' as const;

/** A single authored scene. Batched card and bounded effects share Harbour's frame owner. */
export function buildMountainLandscape(dressing:PlaceDressing,tier:RenderTier,reading:PlaceReading|null){
  const group=new THREE.Group();group.name='Hearth Mountain';
  const owned:{dispose():void}[]=[],anchors:Anchor[]=[],regions:Region[]=[];
  const track=<T extends {dispose():void}>(v:T)=>{owned.push(v);return v;};
  const pal=mountainArtPalette(dressing);
  const life=buildMountainLife(dressing,tier);group.add(life.group);anchors.push(...life.anchors);regions.push(...life.regions);
  const card=new CardBuilder('Hearth Mountain card',tier,{ink:pal.ink});
  const signSpots:{spot:SignSpot;text:string;anchor:string;board?:boolean}[]=[];
  // ── Routes, bridges, water, branches ──
  buildRouteArt(card,pal,tier);
  buildBridgeArt(card,pal);
  buildWaterArt(card,pal,tier);
  buildBranchArt(card,pal);
  buildRockArt(card,pal,tier);
  // ── The dam ──
  const damGlass=new CardBuilder('Glass Fund dam',tier,{ink:pal.ink,shadows:false});
  const plaques=buildDamStructure(card,damGlass,pal,tier);
  // ── Transport ──
  const transport=buildTransportArt(card,pal,tier);
  for(const hut of transport.huts){house(card,pal,hut.x,hut.z,hut.yaw,1.3,1.05,{wall:pal.walls[1%pal.walls.length]!,wallH:2.4,roofRise:.9,door:{u:0,face:'front'},windows:[{u:0,y:1.1,face:'left'},{u:0,y:1.1,face:'right'}],plinth:.15});
    const c=Math.cos(hut.yaw),s=Math.sin(hut.yaw),g=Math.max(groundHeightAt(hut.x,hut.z),groundHeightAt(hut.x+s*1.1,hut.z+c*1.1));
    signSpots.push({spot:{at:[hut.x+s*1.2,g+2.45,hut.z+c*1.2],yaw:hut.yaw,w:2.3,h:.5},text:`${hut.name} · ${hut.kind}`,anchor:`mountain:transport:${hut.kind}`});}
  for(const [kind,line] of Object.entries(TRANSPORT_LINES) as [TransportKind,typeof TRANSPORT_LINES[TransportKind]][])for(const st of line.stations){
    if(kind==='funicular'&&transport.huts.some(h=>h.name===st.name))continue;
    const p=st.platform,c=Math.cos(p.yaw),s=Math.sin(p.yaw);signSpots.push({spot:{at:[p.at[0]-c*(p.half[1]-.1),p.at[1]+2.5,p.at[2]+s*(p.half[1]-.1)],yaw:p.yaw-Math.PI/2,w:2.6,h:.5},text:`${st.name} · ${kind}`,anchor:`mountain:transport:${kind}`,board:true});}
  // ── Town ──
  const town=buildTownArt(card,pal);for(const t of town.signs)signSpots.push({spot:t.spot,text:t.text,anchor:t.anchor});
  // ── Goal pavilion and observatory ──
  const pav=pavilion(card,pal,GOAL_PAVILION_SITE.at[0],GOAL_PAVILION_SITE.at[2],DOOR_APRONS.find(a=>a.site==='pavilion')?.facing??0,GOAL_PAVILION_SITE.half[0],GOAL_PAVILION_SITE.half[1],PAVILION_COLUMNS);
  const obsDoor=DOOR_APRONS.find(a=>a.site==='observatory')?.facing??0;
  const obs=observatory(card,pal,SUMMIT_OBSERVATORY_SITE.at[0],SUMMIT_OBSERVATORY_SITE.at[2],SUMMIT_OBSERVATORY_SITE.radius,obsDoor);
  signSpots.push({spot:obs.sign,text:'Our journey',anchor:'mountain:journey'});
  {const f=DOOR_APRONS.find(a=>a.site==='pavilion')?.facing??0,at=GOAL_PAVILION_SITE.at;
    signSpots.push({spot:{at:[at[0]+Math.sin(f)*(GOAL_PAVILION_SITE.half[1]+.5),pav.floor+3.35,at[2]+Math.cos(f)*(GOAL_PAVILION_SITE.half[1]+.5)],yaw:f,w:2.6,h:.4},text:'A place in the making',anchor:'mountain:goals'});}
  // ── Furniture (benches, gates and the bell belong to life) ──
  const postSigns:SignSpot[]=[];
  const propLife=buildPropArt(card,pal,tier,postSigns,p=>p.kind==='gate'||p.kind==='bell'||(p.kind==='bench'&&p.id.startsWith('bench:mountain:life:')));
  group.add(propLife.group);owned.push(propLife);
  // Signposts pushed their two faces in placement order; label them here.
  {let k=0;for(const p of mountainProps().filter(p=>p.kind==='signpost')){const front=postSigns[k++],back=postSigns[k++];if(!front||!back)break;
    const anchor=p.district?`mountain:district:${p.district}`:p.id.startsWith('signpost:plot:')?`mountain:plot:${p.id.slice(14)}`:p.id.startsWith('signpost:race')?'mountain:race':'mountain:map';
    signSpots.push({spot:front,text:p.label??'',anchor},{spot:back,text:p.label??'',anchor});}}
  // Reserved plots: survey stakes with a string between them, and the plot's gate post.
  for(const plot of RESERVED_PLOTS){const [x,,z]=plot.at,[ex,ez]=plot.envelope.half,corners:V3[]=[[x-ex,0,z-ez],[x+ex,0,z-ez],[x+ex,0,z+ez],[x-ex,0,z+ez]].map(c=>[c[0]!,groundHeightAt(c[0]!,c[2]!),c[2]!]);
    for(const c of corners)card.box(c[0],c[2],.3,.06,.06,c[1]-.25,c[1]+.75,pal.plank,pal.timber,null);
    for(let i=0;i<4;i++){const a=corners[i]!,b=corners[(i+1)%4]!;for(let k=0;k<8;k++){const t0=k/8,t1=(k+1)/8,P=(t:number):V3=>{const px=a[0]+(b[0]-a[0])*t,pz=a[2]+(b[2]-a[2])*t;return [px,Math.max(groundHeightAt(px,pz)+.25,a[1]+(b[1]-a[1])*t+.6-Math.sin(t*Math.PI)*.12),pz];};card.line(P(t0),P(t1),pal.accent);}}}
  // ── Finish and build ──
  const built=track(card.finish({waterColor:pal.water}));group.add(built.group);
  const glassBuilt=track(damGlass.finish({glassOpacity:.3}));glassBuilt.group.renderOrder=3;group.add(glassBuilt.group);
  const water=buildDamWater(pal,glassBuilt.materials.glass,tier);group.add(water.group);owned.push(water);
  // Signs: engraved plates at their spots; every one is also an anchor and a region.
  const sign=(text:string,at:V3,yaw:number,id:string,width:number,height:number,board=false)=>{
    id=`${id}@${at.map(v=>v.toFixed(1)).join(',')}`;
    const s=track(new EngravedPlate({stone:mix(pal.signBoard,[1,1,1],.12).map(v=>Math.round(Math.min(1,v)*255).toString(16).padStart(2,'0')).reduce((a,h)=>a+h,'#'),highlight:'#fff6d7',ink:pal.signText,size:'small',width:768,fit:true},width,height));
    s.set(text);s.mesh.position.set(...at);s.mesh.rotation.y=yaw;s.mesh.userData.anchor=id;s.mesh.castShadow=false;group.add(s.mesh);
    if(board){const bb=new CardBuilder(`Board ${id}`,tier,{ink:pal.ink,cell:Infinity});const c=Math.cos(yaw),sn=Math.sin(yaw);bb.box(at[0]-sn*.06,at[2]-c*.06,yaw+Math.PI/2,.05,width/2+.08,at[1]-height/2-.08,at[1]+height/2+.08,pal.paperEdge,shade(pal.signBoard,.8));
      for(const e of [-1,1])bb.box(at[0]-sn*.1+c*e*(width/2-.2),at[2]-c*.1-sn*e*(width/2-.2),yaw,.05,.05,at[1]-height/2-2.3,at[1]+height/2,pal.timber,shade(pal.timber,.8),null);const r=track(bb.finish());group.add(r.group);}
    anchors.push({id,position:[at[0],at[1],at[2]],zone:'landmark',label:text});regions.push({id,group:'court',label:text,objects:[s.mesh]});return s;
  };
  for(const s of signSpots)sign(s.text,s.spot.at,s.spot.yaw,s.anchor,s.spot.w,s.spot.h,s.board);
  const gauge=sign('Household Fund · checking',plaques.fund.at,plaques.fund.yaw,'mountain:basin',5.2,1.3);
  const scaleGauge=sign('CAD scale',plaques.scale.at,plaques.scale.yaw,'mountain:basin',5.2,1);
  sign('Kitty reserves',plaques.chambers.at,plaques.chambers.yaw,'mountain:basin',2.4,.6,true);
  sign('Where the Fund flows',channelLectern(card,pal),channelLecternYaw,'mountain:basin',1.8,.6);
  // ── Cabins, idle at their first stations until ridden ──
  const cabins:Record<TransportKind,Cabin>={funicular:buildCabin('funicular',pal,tier,pal.walls[0]!),gondola:buildCabin('gondola',pal,tier,pal.accent)};
  const parked:Record<TransportKind,{at:Point3;yaw:number;pitch:number}>={funicular:parkAt('funicular',0),gondola:parkAt('gondola',0)};
  for(const [kind,cabin] of Object.entries(cabins) as [TransportKind,Cabin][]){group.add(cabin.group);owned.push(cabin);place(kind,parked[kind]);}
  function place(kind:TransportKind,f:{at:Point3;yaw:number;pitch:number},sway=0){const c=cabins[kind];c.group.position.set(...f.at);c.group.rotation.set(0,f.yaw,0);
    if(kind==='funicular'){c.chassis.rotation.set(-f.pitch,0,0);c.body.rotation.set(0,0,0);}else{c.body.rotation.set(sway*.6,0,sway);c.body.position.set(0,0,0);}}
  let riding:TransportKind|null=null,rideSpeed=0,lastRide:Point3|null=null;
  // ── Planting ──
  const planting=buildPlantArt(pal,tier,seasonOf(new Date().getMonth()));group.add(planting.group);owned.push(planting);
  // ── Goal backing details: small brass lamps on the pavilion's inner plinths ──
  const lampMat=track(new THREE.MeshStandardMaterial({color:new THREE.Color(...pal.brass),emissive:new THREE.Color(...pal.lamp),emissiveIntensity:.35,metalness:.4,roughness:.4,flatShading:true}));
  const lampGeo=track(new THREE.OctahedronGeometry(.22,0));
  const goalDetails=pav.inner.map((p,i)=>{const m=new THREE.Mesh(lampGeo,lampMat);m.position.set(p[0],p[1]+.35,p[2]);m.name=`Goal backing lamp ${i}`;m.visible=false;group.add(m);return m;});
  // ── Wear and repair: a few peripheral fence runs whose rails sag with observed wear ──
  const fences=fenceRuns(),railMat=track(new THREE.MeshStandardMaterial({color:new THREE.Color(...pal.timberLight),roughness:.9,flatShading:true}));
  const railGeo=track(new THREE.BoxGeometry(1,.1,.08)),postGeo=track(new THREE.BoxGeometry(.12,1,.12));
  const rails=new THREE.InstancedMesh(railGeo,railMat,fences.length*2),posts=new THREE.InstancedMesh(postGeo,railMat,fences.length*2);rails.name='Weathered fence rails';posts.name='Fence posts';track(rails);track(posts);group.add(rails,posts);
  const bandMat=track(new THREE.MeshStandardMaterial({color:new THREE.Color(...pal.brass),metalness:.5,roughness:.35}));
  const mends=new THREE.InstancedMesh(track(new THREE.BoxGeometry(.16,.18,.14)),bandMat,fences.length);mends.name='Observed repair bindings';mends.count=0;track(mends);group.add(mends);
  const dummy=new THREE.Object3D();
  function paintFences(wear:number,repairs:number){
    fences.forEach((f,i)=>{for(const [k,end] of [[0,-1],[1,1]] as const){dummy.position.set(f.x+Math.sin(f.yaw)*0+Math.cos(f.yaw)*end*f.len/2,f.y+.5,f.z-Math.sin(f.yaw)*end*f.len/2);dummy.rotation.set(0,f.yaw,wear*(i%2?.2:-.14)*(k?1:-1));dummy.scale.set(1,1.1,1);dummy.updateMatrix();posts.setMatrixAt(i*2+k,dummy.matrix);}
      for(const k of [0,1]){dummy.position.set(f.x,f.y+.45+k*.42-wear*(k?.18:.08),f.z);dummy.rotation.set(0,f.yaw,wear*(k?.16:-.1)*(i%2?1:-1));dummy.scale.set(f.len,1,1);dummy.updateMatrix();rails.setMatrixAt(i*2+k,dummy.matrix);}
      if(i<repairs){dummy.position.set(f.x,f.y+.87,f.z);dummy.rotation.set(0,f.yaw,0);dummy.scale.set(1,1,1);dummy.updateMatrix();mends.setMatrixAt(i,dummy.matrix);}});
    mends.count=Math.min(fences.length,repairs);rails.instanceMatrix.needsUpdate=posts.instanceMatrix.needsUpdate=mends.instanceMatrix.needsUpdate=true;
  }
  paintFences(0,0);
  // ── Smoke: a few puffs per chimney, rising and swelling ──
  const smokeSources=[...propLife.smoke,...town.smoke],puffsPer=6;
  const puffMat=track(new THREE.MeshStandardMaterial({color:'#f8f5ee',roughness:1,flatShading:true,transparent:true,opacity:.22,depthWrite:false}));
  const puffs=new THREE.InstancedMesh(track(new THREE.IcosahedronGeometry(.3,1)),puffMat,Math.max(1,smokeSources.length*puffsPer));puffs.name='Chimney smoke';puffs.count=smokeSources.length*puffsPer;track(puffs);group.add(puffs);
  // ── Accepted movement pulse ──
  const pulse=new THREE.Mesh(track(new THREE.OctahedronGeometry(.8,0)),track(new THREE.MeshStandardMaterial({color:'#f7dfa0',emissive:'#e8b567',emissiveIntensity:.45,flatShading:true})));pulse.name='Accepted movement pulse';pulse.visible=false;group.add(pulse);
  let flowPath:readonly Point3[]=RIVER;let phase=0,remaining=0,target=0,current=0,reserveTarget:number|null=0,reserveCurrent=0,known=false,calm=false;
  const readBasin=createBasinView();let last:PlaceReading|null=null;
  let recovery:MountainRecoveryView|null=null,observedWear=0,renderedQuiet=false;
  const isQuiet=()=>calm||(typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  function update(next:PlaceReading|null){const initial=last===null,quiet=isQuiet();renderedQuiet=quiet;life.setQuiet(quiet);setStreamQuiet(quiet);last=next;const b=readBasin(next?.basin);
    known=b.level!==null;if(known)target=b.level!;reserveTarget=b.reserveLevel;
    const basinLabel=`Household Fund · ${basinMoney(next?.basin?.balanceCents)} CAD`;const basinAnchor=anchors.find(a=>a.id===gauge.mesh.userData.anchor);if(basinAnchor)basinAnchor.label=basinLabel;
    gauge.set(`Fund ${basinMoney(next?.basin?.balanceCents)} CAD`);
    scaleGauge.set(`Scale ${basinMoney(b.scaleCents)} CAD${b.scaleChanged?' · expanded':''}`);
    if(b.newFlows.length){
      const flow=b.newFlows[b.newFlows.length-1]!,ch=KITTY_CHAMBERS[0]!,crest=DAM_PARTS.arc[4]!;
      const chambers:readonly Point3[]=[[crest[0],DAM_ZERO+4,crest[2]-3],[ch.at[0],ch.at[1]+3,ch.at[2]]];
      flowPath=flow.kind==='inlet'?[[20,96,-282],[12,88,-262],[8,86,-246]]:flow.kind==='reserve-out'?chambers:flow.kind==='reserve-in'?[...chambers].reverse():RIVER;
      remaining=3;phase=0;
    }
    // Updates also paint at rest: reduced-motion clients need no animation loop.
    if(initial||quiet){current=target;reserveCurrent=reserveTarget??0;}
    water.set(known?current:null,reserveTarget===null?null:reserveCurrent);
    const condition=next?.condition?.state;
    if(recovery)observedWear=recovery.wear;
    else if(next?.freshness==='current'&&condition&&condition!=='checking')observedWear=condition==='weathered'?1:condition==='wilting'?.35:0;
    paintFences(quiet?0:observedWear,recovery?recovery.repairs:0);
    const careDays=recovery?recovery.careDays:next?.freshness==='current'?next.mountainCareDays:undefined;
    planting.setCare(careDays??null);
    if(quiet){pulse.visible=false;remaining=0;planting.bend(null);lastVisitor=null;}
    const goals=next?.tower.shelves.flatMap(s=>s.banks).filter(b=>b.goalId),step=goals?.length?Math.max(...goals.map(b=>b.step)):0;
    goalDetails.forEach((o,i)=>{o.visible=i<step;});
  }
  let lastVisitor:Point3|null=null;
  function setVisitor(at:Point3){
    if(isQuiet()||lastVisitor&&Math.hypot(at[0]-lastVisitor[0],at[2]-lastVisitor[2])<.2)return;
    lastVisitor=at;planting.bend(at);
  }
  update(reading);current=target;water.set(known?current:null,reserveTarget===null?null:reserveCurrent);
  let clock=0,smokeT=0,disposed=false;
  function stillLife(){for(const c of propLife.cloth){c.items.forEach((it,i)=>{dummy.position.set(...it.at);dummy.rotation.set(0,it.yaw,0);dummy.scale.set(it.w,it.h,1);dummy.updateMatrix();c.mesh.setMatrixAt(i,dummy.matrix);});c.mesh.instanceMatrix.needsUpdate=true;}paintSmoke(0,true);}
  function paintSmoke(t:number,hide=false){
    smokeSources.forEach((s,k)=>{for(let j=0;j<puffsPer;j++){const u=((t*.18+j/puffsPer+k*.37)%1),i=k*puffsPer+j;
      if(hide){dummy.scale.setScalar(0.0001);dummy.position.set(...s);}else{const r=1+u*3.4;dummy.position.set(s[0]+u*u*3.4+Math.sin(t*.7+j)*.25,s[1]+.2+u*3.6,s[2]-u*u*1.7);dummy.scale.setScalar(Math.max(.0001,r*(u<.85?1:(1-u)/.15)));}
      dummy.rotation.set(0,u*3,0);dummy.updateMatrix();puffs.setMatrixAt(i,dummy.matrix);}});
    puffs.instanceMatrix.needsUpdate=true;
  }
  paintSmoke(0);
  return {group,anchors,regions,update,setVisitor,setRecovery(value:MountainRecoveryView){recovery=value;update(last);},setInteraction(value:MountainInteractionState){life.setInteraction(value);},setCalm(value:boolean){calm=value;update(last);if(isQuiet())stillLife();},
    /** The cabin's place on its line (the rider's feet), and the ride's yaw and pitch; null leaves it parked. */
    setTransit(at:Point3|null,kind:TransportKind='gondola',frame?:{yaw:number;pitch:number}){
      if(!at){if(riding){parked[riding]={at:lastRide??parked[riding].at,yaw:cabins[riding].group.rotation.y,pitch:0};place(riding,parked[riding]);}riding=null;rideSpeed=0;return;}
      if(riding&&riding!==kind)place(riding,parked[riding]);
      if(lastRide&&riding===kind)rideSpeed=Math.hypot(at[0]-lastRide[0],at[2]-lastRide[2]);
      riding=kind;lastRide=at;const yaw=frame?.yaw??cabins[kind].group.rotation.y;place(kind,{at,yaw,pitch:frame?.pitch??0},isQuiet()?0:Math.sin(clock*1.3)*.02*Math.min(1,rideSpeed*6));
    },
    animate(t:number,dt:number){const quiet=isQuiet();if(quiet!==renderedQuiet){update(last);if(quiet)stillLife();}const step=Math.max(0,Math.min(.1,dt));life.setQuiet(quiet);
      if(quiet){current=target;reserveCurrent=reserveTarget??0;remaining=0;pulse.visible=false;water.set(known?current:null,reserveTarget===null?null:reserveCurrent);return life.animate(t,step);}
      clock=t;CARD_CLOCK.value=t;
      current+=(target-current)*Math.min(1,step*3);reserveCurrent+=((reserveTarget??0)-reserveCurrent)*Math.min(1,step*3);water.set(known?current:null,reserveTarget===null?null:reserveCurrent);
      remaining=Math.max(0,remaining-step);pulse.visible=remaining>0;if(pulse.visible){phase+=step/3;const n=Math.min(flowPath.length-2,Math.floor(phase*(flowPath.length-1))),a=flowPath[n]!,b=flowPath[n+1]!,u=Math.min(1,phase)*(flowPath.length-1)-n;pulse.position.set(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u+.5,a[2]+(b[2]-a[2])*u);pulse.rotation.y=t*2;}
      // Cloth flutters about its string, each piece on its own phase; the wheel turns; smoke rises.
      for(const c of propLife.cloth){c.items.forEach((it,i)=>{const f=Math.sin(t*3.1+it.phase)*.6+Math.sin(t*5.3+it.phase*1.7)*.4;dummy.position.set(...it.at);dummy.rotation.set(f*it.amp,it.yaw,f*it.amp*.25,'YXZ');dummy.scale.set(it.w,it.h,1);dummy.updateMatrix();c.mesh.setMatrixAt(i,dummy.matrix);});c.mesh.instanceMatrix.needsUpdate=true;}
      if(propLife.wheel)propLife.wheel.rotation.x=-t*.8;
      smokeT+=step;paintSmoke(smokeT);
      if(!riding)for(const kind of ['gondola'] as const){const p=parked[kind];place(kind,p,Math.sin(t*.9)*.012);}
      return life.animate(t,step)||true;
    },dispose(){if(disposed)return;disposed=true;group.removeFromParent();life.dispose();owned.forEach(o=>o.dispose());group.clear();}};
}

/** Where a cabin waits: at a station's line point, facing along the line. */
function parkAt(kind:TransportKind,station:number){
  const line=TRANSPORT_LINES[kind],st=line.stations[station]!,f=line.at(st.s),dir=station===0?1:-1;
  return {at:f.at,yaw:Math.atan2(f.tangent[0]*dir,f.tangent[2]*dir),pitch:Math.atan2(f.tangent[1]*dir,Math.hypot(f.tangent[0],f.tangent[2])||1)};
}
/** Peripheral fence runs (wear shows here): beside district paths, clear of the walk. */
function fenceRuns(){
  const out:{x:number;y:number;z:number;yaw:number;len:number}[]=[];
  for(const d of DISTRICTS){const paths=MOUNTAIN_PATH_GRAPH.edges.filter(e=>e.kind==='path'&&Math.hypot(e.points[0]![0]-d.at[0],e.points[0]![2]-d.at[2])<30);
    for(const e of paths.slice(0,2)){const i=Math.floor(e.points.length/2),p=e.points[i]!,q=e.points[Math.min(e.points.length-1,i+1)]!,dx=q[0]-p[0],dz=q[2]-p[2],l=Math.hypot(dx,dz)||1,off=e.halfWidth+.9,x=p[0]-dz/l*off,z=p[2]+dx/l*off;
      out.push({x,y:groundHeightAt(x,z),z,yaw:Math.atan2(dx,dz)-Math.PI/2,len:2.4});}}
  return out;
}
/** The "Where the Fund flows" lectern beside the town channel, facing the square. */
let channelLecternYaw=0;
function channelLectern(card:CardBuilder,pal:ReturnType<typeof mountainArtPalette>):V3{
  const x=-5.2,z=-11.5,g=groundHeightAt(x,z);channelLecternYaw=Math.atan2(-x,-z);
  card.box(x,z,channelLecternYaw,.12,.12,g-.1,g+1.05,pal.timberLight,pal.timber);
  const c=Math.cos(channelLecternYaw),s=Math.sin(channelLecternYaw);card.box(x+s*.05,z+c*.05,channelLecternYaw,.95,.05,g+1.05,g+1.72,pal.brass,shade(pal.brass,.8));
  return [x+s*.12,g+1.38,z+c*.12];
}
