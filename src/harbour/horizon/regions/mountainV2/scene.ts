/**
 * Mountain v2's scene on the Horizon, stripped down (D-M8, brief §4). Built with v2's own builders in NATIVE space, the
 * whole thing parented under one host group at the offset (translation only; materials are v2's, never re-tinted).
 *
 * Drawn: v2's ground and paint (ground.ts); the swept road with kerbs, parapets, retaining walls and stairs, Orchard Lane,
 * the paths and the overlook platforms (routeArt); the typed gorge bridges, the funicular viaducts and the path footbridges
 * (bridgeArt); the gorge river with its foam and the town channel's water (waterArt, `townFurniture:false`); the skate
 * branches (branchArt, they are routes); the strata (rockArt); the glass dam with abutments, crest promenade, apron, outlet,
 * the Kitty chambers and the reservoir water (damArt); the funicular and the gondola with their stations, huts (canopy,
 * no goods) and cabins parked at their stations (transportArt); the observatory and the goal pavilion as a plain shelter
 * (buildingArt; no goal lamps, no signs); trees, shrubs, hedges, heath, rocks, flowers and tufts as v2 plants them (plantArt,
 * kept only inside the region's footprint); one bench at each overlook (propArt `drawBench`); the flying flock (full tier).
 *
 * Not drawn (source kept): the town square and storefronts (townArt), the road-foot gate, the channel's kerbs, culverts and
 * footbridges, the canal bridge, the monorail, district fixtures and ground props, signposts and every other prop but the
 * overlook benches, pennants and laundry, the waterwheel, chimney smoke, plot stakes and hoardings, engraved sign plates,
 * wear fences, gates and the bell, moths and butterflies, the four tool buildings and the cottage, the Fund pulse.
 *
 * The region reads no money: `setFund(level, reserve)` is fed by the runtime. It never writes `CARD_CLOCK` (the runtime
 * drives it; wind and water sheen follow it). Quiet (calm view or reduced motion): the flock is away, the parked gondola
 * does not sway, the dam water snaps to its level.
 */
import * as THREE from 'three';
import {finishBuild} from '../../../../house/world/buildTask.ts';
import {CardBuilder} from '../../../art/cardScene.ts';
import type {PlaceDressing} from '../../../scene/place.ts';
import {groundHeightAt} from '../../../scene/ground.ts';
import {GOAL_PAVILION_SITE,SUMMIT_OBSERVATORY_SITE,DOOR_APRONS,OVERLOOKS,DISTRICTS,type Point3} from '../../../mountain/definition.ts';
import {TRANSPORT_LINES,type TransportKind} from '../../../mountain/transport.ts';
import {PAVILION_COLUMNS} from '../../../mountain/artGeometry.ts';
import {mountainArtPalette,type MountainArtPalette} from '../../../mountain/art/palette.ts';
import {buildRouteArt} from '../../../mountain/art/routeArt.ts';
import {buildBridgeArt} from '../../../mountain/art/bridgeArt.ts';
import {buildWaterArt} from '../../../mountain/art/waterArt.ts';
import {buildBranchArt} from '../../../mountain/art/branchArt.ts';
import {buildRockArt} from '../../../mountain/art/rockArt.ts';
import {buildDamStructure,buildDamWater} from '../../../mountain/art/damArt.ts';
import {buildTransportArt,buildCabin,type Cabin} from '../../../mountain/art/transportArt.ts';
import {house,pavilion,observatory} from '../../../mountain/art/buildingArt.ts';
import {buildPlantArt} from '../../../mountain/art/plantArt.ts';
import {drawBench} from '../../../mountain/art/propArt.ts';
import {mountainProps,type PropPlacement} from '../../../mountain/art/placements.ts';
import {buildRegionGround,type PreparedGround} from './ground.ts';
import {MOUNTAIN_V2_OFFSET as O,toNativeXYZ} from './placement.ts';

export type RegionTier='full'|'lite';
export type RegionSeason='spring'|'summer'|'autumn'|'winter';
export type RegionCabinPose={at:readonly [number,number,number];yaw:number;pitch:number};
export type RegionMountOptions={contains:(hx:number,hz:number)=>boolean;terrainStep:number;season?:RegionSeason;quiet?:boolean;groundCache?:Map<string,PreparedGround>;/** road (L1): the drawn ground's ceiling under a yielded Horizon deck (Horizon heights). */groundCeiling?:(hx:number,hz:number)=>number|null};
export type RegionScene={
  group:THREE.Group;
  animate(dt:number,clock:number):boolean;
  setTransit(cabin:RegionCabinPose|null,kind:TransportKind):void;
  /** The dam's water picture (0…1 of the session scale; null level = unknown: frosted glass; null reserve = no chamber water). */
  setWater(level:number|null,reserve:number|null):void;
  /** The brief's name for `setWater` (the Fund picture, D-M3): the same function. */
  setFund(level:number|null,reserve:number|null):void;
  setQuiet(quiet:boolean):void;
  stats():{triangles:number;drawCalls:number;groundTriangles:number;benches:number};
  dispose():void;
};

/** Where a cabin waits: at a station's line point, facing along the line (landscape.ts parkAt). Native. */
function parkAt(kind:TransportKind,station:number){
  const line=TRANSPORT_LINES[kind],st=line.stations[station]!,f=line.at(st.s),dir=station===0?1:-1;
  return {at:f.at as Point3,yaw:Math.atan2(f.tangent[0]*dir,f.tangent[2]*dir),pitch:Math.atan2(f.tangent[1]*dir,Math.hypot(f.tangent[0],f.tangent[2])||1)};
}
/** One bench per overlook: the placement nearest each overlook within 16 m, each bench used once. */
export function overlookBenches():PropPlacement[]{
  const benches=mountainProps().filter(p=>p.kind==='bench'),used=new Set<string>(),out:PropPlacement[]=[];
  for(const o of OVERLOOKS){let best:PropPlacement|null=null,d=16;for(const b of benches){if(used.has(b.id))continue;const e=Math.hypot(b.x-o.at[0],b.z-o.at[2]);if(e<d){d=e;best=b;}}if(best){used.add(best.id);out.push(best);}}
  return out;
}
/** Instanced plants outside the drawn footprint are dropped (their ground there is the Horizon's). */
function keepInside(group:THREE.Object3D,inside:(nx:number,nz:number)=>boolean){
  const m=new THREE.Matrix4(),c=new THREE.Color();
  group.traverse(o=>{const mesh=o as THREE.InstancedMesh;if(!mesh.isInstancedMesh)return;
    const total=mesh.instanceMatrix.count,shown=mesh.count,kept:number[]=[];
    for(let i=0;i<total;i++){mesh.getMatrixAt(i,m);if(inside(m.elements[12]!,m.elements[14]!))kept.push(i);}
    if(kept.length===total)return;
    kept.forEach((from,to)=>{mesh.getMatrixAt(from,m);mesh.setMatrixAt(to,m);if(mesh.instanceColor){mesh.getColorAt(from,c);mesh.setColorAt(to,c);}});
    mesh.count=kept.filter(i=>i<shown).length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;});
}
/** v2's flying flock (lifeScene.ts), on its own: a slow loop over the lower terraces. Full tier only. */
function buildFlock(dressing:PlaceDressing,pal:MountainArtPalette){
  const group=new THREE.Group();group.name='Mountain v2 flock';
  const owned:{dispose():void}[]=[],own=<T extends {dispose():void}>(v:T)=>{owned.push(v);return v;};
  const mat=(color:THREE.ColorRepresentation)=>own(new THREE.MeshStandardMaterial({color,roughness:.84,flatShading:true}));
  const wood=mat(dressing.timber),ink=mat(new THREE.Color(...pal.ink)),accent=mat(new THREE.Color(...pal.accent));
  const shape=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0)=>{const o=new THREE.Mesh(own(g),m);o.position.set(x,y,z);parent.add(o);return o;};
  const hearth=DISTRICTS.find(d=>d.id==='hearth')!,orchard=DISTRICTS.find(d=>d.id==='orchard')!,cx=(hearth.at[0]+orchard.at[0])/2,cz=(hearth.at[2]+orchard.at[2])/2-8;
  const flock=Array.from({length:5},(_,i)=>{const g=new THREE.Group();g.name='Flying bird';group.add(g);const size=1.3;
    const b=shape(new THREE.IcosahedronGeometry(.16*size,0),wood,g);b.scale.set(1,.9,1.5);shape(new THREE.IcosahedronGeometry(.11*size,0),wood,g,0,.13*size,.2*size);
    const beak=shape(new THREE.ConeGeometry(.04*size,.14*size,4),accent,g,0,.13*size,.33*size);beak.rotation.x=Math.PI/2;
    const wings=[-1,1].map(side=>shape(new THREE.BoxGeometry(.3*size,.02,.18*size),ink,g,side*.18*size,.04,0));return {g,wings,i};});
  function fly(t:number){flock.forEach(({g,wings,i})=>{const a=t*.11+i*.42,r=38+Math.sin(t*.07+i)*6,x=cx+Math.cos(a)*r*1.4,z=cz+Math.sin(a)*r*.7;
    g.position.set(x,Math.max(groundHeightAt(x,z)+14,42)+Math.sin(t*.9+i*1.7)*1.5,z);g.rotation.set(0,-a+Math.PI,Math.sin(t*.5+i)*.15);
    const beat=Math.sin(t*9+i*1.3)*.7;wings.forEach((w,k)=>{w.rotation.z=beat*(k?1:-1);});});}
  fly(0);
  return {group,fly,dispose(){group.removeFromParent();owned.forEach(o=>o.dispose());group.clear();}};
}

/** The mount, as cooperative steps (one v2 builder per step; the card merge yields inside). The group joins the scene last. */
export function* mountRegionSteps(scene:THREE.Scene,tier:RegionTier,dressing:PlaceDressing,options:RegionMountOptions):Generator<void,RegionScene,void>{
  const host=new THREE.Group();host.name='Mountain v2 region';host.position.set(O.x,O.y,O.z);
  const owned:{dispose():void}[]=[],track=<T extends {dispose():void}>(v:T)=>{owned.push(v);return v;};
  let complete=false;
  try{
    const pal=mountainArtPalette(dressing);
    const ground=track(buildRegionGround(tier,dressing,options.contains,options.terrainStep,options.groundCache,options.groundCeiling));host.add(ground.mesh);yield;
    const card=new CardBuilder('Mountain v2 card',tier,{ink:pal.ink});
    buildRouteArt(card,pal,tier);yield;
    buildBridgeArt(card,pal);yield;
    buildWaterArt(card,pal,tier,{townFurniture:false});yield;
    buildBranchArt(card,pal);yield;
    buildRockArt(card,pal,tier);yield;
    const glass=new CardBuilder('Mountain v2 dam glass',tier,{ink:pal.ink,shadows:false});
    buildDamStructure(card,glass,pal,tier);yield;
    const transport=buildTransportArt(card,pal,tier);
    for(const hut of transport.huts)house(card,pal,hut.x,hut.z,hut.yaw,1.3,1.05,{wall:pal.walls[1%pal.walls.length]!,wallH:2.4,roofRise:.9,door:{u:0,face:'front'},windows:[{u:0,y:1.1,face:'left'},{u:0,y:1.1,face:'right'}],plinth:.15});
    yield;
    pavilion(card,pal,GOAL_PAVILION_SITE.at[0],GOAL_PAVILION_SITE.at[2],DOOR_APRONS.find(a=>a.site==='pavilion')?.facing??0,GOAL_PAVILION_SITE.half[0],GOAL_PAVILION_SITE.half[1],PAVILION_COLUMNS);
    observatory(card,pal,SUMMIT_OBSERVATORY_SITE.at[0],SUMMIT_OBSERVATORY_SITE.at[2],SUMMIT_OBSERVATORY_SITE.radius,DOOR_APRONS.find(a=>a.site==='observatory')?.facing??0);
    const benches=overlookBenches();for(const b of benches)drawBench(card,pal,b);
    yield;
    const built=track(yield* card.finishSteps({waterColor:pal.water}));host.add(built.group);
    const glassBuilt=track(glass.finish({glassOpacity:.3}));glassBuilt.group.renderOrder=3;host.add(glassBuilt.group);
    const water=track(buildDamWater(pal,glassBuilt.materials.glass,tier));host.add(water.group);yield;
    const cabins:Record<TransportKind,Cabin>={funicular:track(buildCabin('funicular',pal,tier,pal.walls[0]!)),gondola:track(buildCabin('gondola',pal,tier,pal.accent))};
    const parked:Record<TransportKind,ReturnType<typeof parkAt>>={funicular:parkAt('funicular',0),gondola:parkAt('gondola',0)};
    const place=(kind:TransportKind,f:{at:readonly [number,number,number];yaw:number;pitch:number},sway=0)=>{const c=cabins[kind];c.group.position.set(f.at[0],f.at[1],f.at[2]);c.group.rotation.set(0,f.yaw,0);
      if(kind==='funicular'){c.chassis.rotation.set(-f.pitch,0,0);c.body.rotation.set(0,0,0);}else{c.body.rotation.set(sway*.6,0,sway);c.body.position.set(0,0,0);}};
    for(const kind of ['funicular','gondola'] as const){host.add(cabins[kind].group);place(kind,parked[kind]);}
    yield;
    const planting=track(buildPlantArt(pal,tier,options.season??'summer'));keepInside(planting.group,(nx,nz)=>options.contains(nx+O.x,nz+O.z));host.add(planting.group);yield;
    const flock=tier==='full'?track(buildFlock(dressing,pal)):null;if(flock)host.add(flock.group);
    // ── State ──
    let quiet=options.quiet===true,riding:TransportKind|null=null,lastRide:readonly [number,number,number]|null=null,rideSpeed=0,clock=0;
    let known=false,target=0,current=0,reserve:number|null=null,reserveCurrent=0,disposed=false;
    water.set(null,null);
    const paintWater=()=>water.set(known?current:null,reserve===null?null:reserveCurrent);
    const setQuiet=(value:boolean)=>{quiet=value;if(flock)flock.group.visible=!quiet;if(quiet){current=target;reserveCurrent=reserve??0;paintWater();if(!riding)place('gondola',parked.gondola);}};
    setQuiet(quiet);
    scene.add(host);complete=true;
    /** Triangles and draw calls of what is drawn now (visible meshes; instanced meshes by their count). */
    const measure=()=>{let triangles=0,drawCalls=0;
      host.traverseVisible(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;const g=m.geometry,n=(g.index?g.index.count:g.getAttribute('position').count)/3;const inst=(m as THREE.InstancedMesh).isInstancedMesh?(m as THREE.InstancedMesh).count:1;if(inst>0){triangles+=n*inst;drawCalls++;}});
      return {triangles,drawCalls};};
    const setWater=(level:number|null,value:number|null)=>{known=level!==null&&Number.isFinite(level);if(known)target=Math.max(0,Math.min(1,level!));reserve=value===null||!Number.isFinite(value)?null:Math.max(0,Math.min(1,value));if(quiet){current=target;reserveCurrent=reserve??0;}paintWater();};
    return {group:host,
      animate(dt,t){if(disposed)return false;const step=Math.max(0,Math.min(.1,dt));clock=t;
        if(quiet){current=target;reserveCurrent=reserve??0;paintWater();return false;}
        current+=(target-current)*Math.min(1,step*3);reserveCurrent+=((reserve??0)-reserveCurrent)*Math.min(1,step*3);paintWater();
        if(!riding)place('gondola',parked.gondola,Math.sin(t*.9)*.012);
        flock?.fly(t);return true;},
      setTransit(cabin,kind){
        if(!cabin){if(riding){const line=TRANSPORT_LINES[riding],at=lastRide??parked[riding].at;let nearest=0,d=Infinity;line.stations.forEach((st,i)=>{const e=Math.hypot(st.at[0]-at[0],st.at[1]-at[1],st.at[2]-at[2]);if(e<d){d=e;nearest=i;}});parked[riding]=parkAt(riding,nearest);place(riding,parked[riding]);}riding=null;rideSpeed=0;return;}
        const at=toNativeXYZ(cabin.at);
        if(riding&&riding!==kind)place(riding,parked[riding]);
        if(lastRide&&riding===kind)rideSpeed=Math.hypot(at[0]-lastRide[0],at[2]-lastRide[2]);
        riding=kind;lastRide=at;place(kind,{at,yaw:cabin.yaw,pitch:cabin.pitch},quiet?0:Math.sin(clock*1.3)*.02*Math.min(1,rideSpeed*6));
      },
      setWater,setFund:setWater,
      setQuiet,
      stats:()=>({...measure(),groundTriangles:ground.triangles,benches:benches.length}),
      dispose(){if(disposed)return;disposed=true;scene.remove(host);for(const o of owned.reverse())o.dispose();host.clear();}};
  }finally{if(!complete)for(const o of owned.reverse())o.dispose();}
}
export function mountRegionScene(scene:THREE.Scene,tier:RegionTier,dressing:PlaceDressing,options:RegionMountOptions):RegionScene{return finishBuild(mountRegionSteps(scene,tier,dressing,options));}
