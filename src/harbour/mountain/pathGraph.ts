/**
 * The pedestrian network: nodes (junctions, doors, stations, overlooks, stair ends, plot
 * gates, district hearts) and edges (road, path, stair, bridge, promenade) with arc-length
 * polylines. Every building is reached along its door axis across a level apron. Stairs
 * cut the switchbacks so walking uphill is not a tour of every hairpin.
 */
import {baseHeight} from './terrainBase.ts';
import {islandHeight} from './islandShape.ts';
import {ROAD_CENTRE,ORCHARD_LANE_CENTRE,ROAD_SAMPLE_STEP,ORCHARD_LANE_WAYPOINTS} from './roadLine.ts';
import {DISTRICTS,RESERVED_PLOTS,BUILDING_SITES,buildingDoor,DAM,SUMMIT_OBSERVATORY_SITE,GOAL_PAVILION_SITE,type MountainBuilding} from './places.ts';
import {FUNICULAR_LINE,GONDOLA_LINE} from './transport.ts';
import {arcLengths,mix,type Point3} from './math.ts';

export type PathNodeKind='junction'|'door'|'station'|'overlook'|'stair-top'|'stair-bottom'|'plot-gate'|'district'|'town';
export type PathNode={id:string;kind:PathNodeKind;at:Point3;facing?:number;label?:string;district?:string};
export type PathEdgeKind='road'|'path'|'stair'|'bridge'|'promenade';
export type PathEdge={id:string;kind:PathEdgeKind;from:string;to:string;halfWidth:number;points:readonly Point3[];length:number};

const ground=(x:number,z:number)=>z>-48?islandHeight(x,z):Math.max(islandHeight(x,z),baseHeight(x,z));
const nodes=new Map<string,PathNode>(),edges:PathEdge[]=[];
const node=(id:string,kind:PathNodeKind,at:Point3,extra:Partial<PathNode>={})=>{const n={id,kind,at,...extra};nodes.set(id,n);return n;};
const district=(id:string)=>DISTRICTS.find(d=>d.id===id)!;

/** Road junction nodes sit exactly on the road centreline at a plan arc length. */
const roadAt=(planS:number,line:'road'|'lane'='road'):Point3=>{const pts=line==='road'?ROAD_CENTRE:ORCHARD_LANE_CENTRE;return pts[Math.max(0,Math.min(pts.length-1,Math.round(planS/ROAD_SAMPLE_STEP)))]!;};
const nearestRoadS=(x:number,z:number,line:'road'|'lane'='road')=>{const pts=line==='road'?ROAD_CENTRE:ORCHARD_LANE_CENTRE;let best=0,d=Infinity;pts.forEach((p,i)=>{const e=Math.hypot(p[0]-x,p[2]-z);if(e<d){d=e;best=i;}});return best*ROAD_SAMPLE_STEP;};

/** On a road or lane carriageway (plan only; a body's clearance beyond the edge). */
const onRoadXZ=(x:number,z:number)=>{for(const [pts,hw] of [[ROAD_CENTRE,4.8],[ORCHARD_LANE_CENTRE,3.2]] as const){for(let i=0;i<pts.length;i+=2){const q=pts[i]!;if(Math.hypot(q[0]-x,q[2]-z)<hw+.6)return true;}}return false;};
/** On a station platform (the stair's last run over it is level with the deck). */
const PLATFORMS=[...FUNICULAR_LINE.stations,...GONDOLA_LINE.stations].map(st=>st.platform);
const onPlatformXZ=(x:number,z:number)=>PLATFORMS.some(p=>{const px=x-p.at[0],pz=z-p.at[2],c=Math.cos(p.yaw),s=Math.sin(p.yaw);return Math.abs(px*c-pz*s)<=p.half[0]+.3&&Math.abs(px*s+pz*c)<=p.half[1]+.3;});
/** Half-length of a level landing at a stair's switchback. */
const LANDING=1.6;
/** A polyline from `a` to `b` through plan via-points: stairs rise linearly, paths ease onto the ground. */
function edge(kind:PathEdgeKind,from:string,to:string,via:readonly(readonly[number,number])[]=[],halfWidth=kind==='stair'?1.4:kind==='promenade'?1.8:1.5,id?:string):PathEdge{
  const a=nodes.get(from)!.at,b=nodes.get(to)!.at,plan:[number,number][]=[[a[0],a[2]],...via.map(v=>[v[0],v[1]] as [number,number]),[b[0],b[2]]];
  const dense:[number,number][]=[];for(let i=1;i<plan.length;i++){const p=plan[i-1]!,q=plan[i]!,n=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/1.5));for(let k=0;k<n;k++)dense.push([mix(p[0],q[0],k/n),mix(p[1],q[1],k/n)]);}
  dense.push(plan[plan.length-1]!);
  const hs=[0];for(let i=1;i<dense.length;i++)hs.push(hs[i-1]!+Math.hypot(dense[i]![0]-dense[i-1]![0],dense[i]![1]-dense[i-1]![1]));
  const L=hs[hs.length-1]||1;
  // A stair from a road junction crosses the carriageway level and starts its flight at the road's edge
  // (never a riser at the kerb); its last run over a station platform is level with the deck; and every
  // sharp turn (a switchback) is a level landing. It climbs evenly over the rest of its run.
  let climb:number[]|null=null;
  if(kind==='stair'){
    const turns=plan.slice(1,-1).map((v,k)=>{const p=plan[k]!,q=plan[k+2]!,h1=Math.atan2(v[0]-p[0],v[1]-p[1]),h2=Math.atan2(q[0]-v[0],q[1]-v[1]);return {v,sharp:Math.abs(Math.atan2(Math.sin(h2-h1),Math.cos(h2-h1)))>.6};}).filter(t=>t.sharp).map(t=>t.v);
    const level=(x:number,z:number)=>onRoadXZ(x,z)||onPlatformXZ(x,z)||turns.some(v=>Math.hypot(v[0]-x,v[1]-z)<LANDING);
    const w=dense.map((p,i)=>i===0?0:level((p[0]+dense[i-1]![0])/2,(p[1]+dense[i-1]![1])/2)?0:hs[i]!-hs[i-1]!);
    const total=w.reduce((m,v)=>m+v,0);
    if(total>2){let acc=0;climb=w.map(v=>(acc+=v)/total);}
  }
  let points:Point3[]=dense.map(([x,z],i)=>{
    const t=climb?climb[i]!:hs[i]!/L,lin=mix(a[1],b[1],t);
    if(kind!=='path')return [x,lin,z];
    // Ground paths follow the land away from their ends, which stay exactly on their nodes.
    const w=Math.min(1,Math.min(hs[i]!,L-hs[i]!)/6)*.85;return [x,mix(lin,ground(x,z),w),z];
  });
  if(kind==='path'){for(let pass=0;pass<3;pass++)points=points.map((p,i)=>i===0||i===points.length-1?p:[p[0],(points[i-1]![1]+p[1]*2+points[i+1]![1])/4,p[2]]);}
  const e:PathEdge={id:id??`${kind}:${from}~${to}`,kind,from,to,halfWidth,points,length:arcLengths(points).at(-1)!};
  edges.push(e);return e;
}
/** Level apron in front of a door, and the path's last run along the door axis. */
export type DoorApron={site:MountainBuilding|'pavilion'|'observatory';door:Point3;facing:number;apron:{at:Point3;half:readonly[number,number];yaw:number}};
export const DOOR_APRONS:DoorApron[]=[];
function door(id:MountainBuilding,level:number,label:string){
  const d=buildingDoor(id),door:Point3=[d.at[0],level,d.at[1]],out:Point3=[d.at[0]+d.facing[0]*5.5,level,d.at[1]+d.facing[1]*5.5];
  DOOR_APRONS.push({site:id,door,facing:d.yaw,apron:{at:[d.at[0]+d.facing[0]*2.6,level,d.at[1]+d.facing[1]*2.6],half:[2.4,2.6],yaw:d.yaw}});
  node(`door:${id}`,'door',door,{facing:d.yaw,label});node(`apron:${id}`,'junction',out,{facing:d.yaw});
  edge('path',`apron:${id}`,`door:${id}`,[],1.6);
}
// ——— Town entries ————————————————————————————————————————————————————————————
node('town:north','town',[-3,islandHeight(-3,-43),-43],{label:'North lane'});
node('road:foot','junction',roadAt(0),{label:'Road foot'});
// ——— Stations ——————————————————————————————————————————————————————————————
for(const line of [FUNICULAR_LINE,GONDOLA_LINE])for(const st of line.stations)node(`station:${line.kind}:${st.id}`,'station',st.platform.at,{label:`${st.name} ${line.kind}`,facing:st.platform.yaw});
edge('path','town:north','station:funicular:town',[[-10,-38.5]],1.6);
edge('path','station:funicular:town','road:foot',[],1.8);
// ——— Districts ——————————————————————————————————————————————————————————————
for(const d of DISTRICTS)node(`district:${d.id}`,'district',d.at,{district:d.id,label:d.name});
// Hearth Terrace: home door, the harbour steps, the funicular's lower-neighbourhood station.
door('home',district('hearth').at[1],'Our home');
node('road:hearth','junction',roadAt(nearestRoadS(50,-101)));
edge('path','road:hearth','apron:home');
edge('path','district:hearth','apron:home');
// Each flight climbs diagonally across the bank between two legs, so it rises over its whole run
// (road level at each road edge, ~25° between).
node('road:leg1-steps','stair-bottom',roadAt(nearestRoadS(34,-65.5)));
node('road:leg2-steps','stair-top',roadAt(nearestRoadS(49,-82)));
edge('stair','road:leg1-steps','road:leg2-steps',[[36,-71],[47,-76.6]],1.4,'stair:harbour-steps');
node('road:leg2-steps-b','stair-bottom',roadAt(nearestRoadS(56,-82)));
node('road:leg3-steps','stair-top',roadAt(nearestRoadS(40,-101)));
edge('stair','road:leg2-steps-b','road:leg3-steps',[[55,-87.6],[42,-95.1]],1.4,'stair:hearth-steps');
node('lane:junction','junction',ORCHARD_LANE_CENTRE[0]!);
// Station steps: from the lower leg east of the harbour bridge, a dog-leg up the bank onto the front of the
// raised platform; a level footbridge carries on from the platform to the second hairpin.
node('road:station-steps','stair-bottom',roadAt(nearestRoadS(20.5,-73.4)));
edge('stair','road:station-steps','station:funicular:hearth',[[20.6,-79.2],[11,-84.8]],1.4,'stair:station-steps');
node('road:hairpin-2-west','junction',roadAt(nearestRoadS(19,-93)));
edge('bridge','station:funicular:hearth','road:hairpin-2-west',[[10.8,-89.8]],1.3,'bridge:station-walk');
// The river path from the town station: a footbridge over the stream, up to the road east of the harbour bridge.
node('path:river-west','junction',[-4.5,2.2,-51]);node('path:river-east','junction',[5.5,2.6,-57]);
edge('path','town:north','path:river-west',[[-4,-47]]);
edge('bridge','path:river-west','path:river-east',[],1.3,'bridge:river-footbridge');
edge('path','path:river-east','road:station-steps',[[12,-64]]);
node('overlook:hearth','overlook',[46,district('hearth').at[1],-110],{facing:Math.atan2(-46,110),label:'Harbour lookout'});
edge('path','district:hearth','overlook:hearth');
node('road:library','junction',roadAt(nearestRoadS(46,-161)));
// Woods steps: Hearth Terrace up through the birches to Library Woods (no road on the way).
node('stair:woods-bottom','stair-bottom',[50,district('hearth').at[1],-124]);
node('stair:woods-mid','stair-top',[42,27.5,-140]);
node('stair:woods-top','stair-top',[38,35.5,-156]);
edge('path','district:hearth','stair:woods-bottom');
edge('stair','stair:woods-bottom','stair:woods-mid',[[46,-132]],1.4,'stair:woods-steps-1');
edge('stair','stair:woods-mid','stair:woods-top',[[39,-148]],1.4,'stair:woods-steps-mid');
edge('stair','stair:woods-top','road:library',[],1.4,'stair:woods-steps-2');
// Library Woods: door on the town side, gorge balcony, station, road.
door('library',district('library').at[1],'The Library');
edge('path','district:library','apron:library');
edge('path','road:library','apron:library');
node('overlook:gorge-balcony','overlook',[20.5,baseHeight(20.5,-164),-164],{facing:Math.atan2(-22,-58),label:'Gorge balcony'});
edge('path','road:library','overlook:gorge-balcony',[[30,-160]]);
edge('path','station:funicular:library','overlook:gorge-balcony');

// Orchard Hollow: lane end, cottage door, a wandering path back toward the gorge.
door('cottage',district('orchard').at[1],'Hercules’s cottage');
node('lane:orchard','junction',ORCHARD_LANE_CENTRE[ORCHARD_LANE_CENTRE.length-1]!);
edge('path','lane:orchard','apron:cottage');
edge('path','lane:orchard','district:orchard');
// Glasshouse Meadows: meadow stairs from the bridge, the door, the dam stairs.
door('glasshouse',district('glasshouse').at[1],'The Glasshouse');
node('road:b2-west','junction',roadAt(nearestRoadS(-30,-198)));
// The meadow steps start from a landing at the road's edge (road level) and climb the meadow bank.
node('stair:meadow-mid','stair-top',[-44,roadAt(nearestRoadS(-44,-198.4))[1]+.3,-205.2]);
edge('stair','road:b2-west','stair:meadow-mid',[[-32,-201]],1.4,'stair:meadow-steps-1');
edge('stair','stair:meadow-mid','apron:glasshouse',[[-56,-209]],1.4,'stair:meadow-steps-2');
edge('path','district:glasshouse','apron:glasshouse');
node('road:glasshouse','junction',roadAt(nearestRoadS(-78,-234)));
edge('path','road:glasshouse','district:glasshouse');
node('road:clearing','junction',roadAt(nearestRoadS(-98,-202)));
// The dam: stairs up from the meadow road to the west abutment, the crest promenade, the east abutment.
const damEnd=(side:-1|1):Point3=>[DAM.centre[0]+Math.sin(side*DAM.halfAngle)*DAM.radius,DAM.crest,DAM.centre[2]+Math.cos(side*DAM.halfAngle)*DAM.radius];
node('dam:west','overlook',damEnd(-1),{facing:Math.atan2(20,34),label:'Dam west abutment'});
node('dam:east','junction',damEnd(1));
node('road:dam-stairs','stair-bottom',roadAt(nearestRoadS(-40,-228)));
// A dog-leg up the abutment slope: north off the road, then along the ridge to the crest end.
edge('stair','road:dam-stairs','dam:west',[[-36.5,-235],[-33.5,-243]],1.4,'stair:dam-west-steps');
const crest:(readonly[number,number])[]=[];for(let k=1;k<12;k++){const a=-DAM.halfAngle+2*DAM.halfAngle*k/12;crest.push([DAM.centre[0]+Math.sin(a)*(DAM.radius+1.2),DAM.centre[2]+Math.cos(a)*(DAM.radius+1.2)]);}
edge('promenade','dam:west','dam:east',crest,1.8,'promenade:dam-crest');
// Reservoir Heights: pavilion, station, the overlook on the road, the rim stairs down to the woods.
node('door:pavilion','door',GOAL_PAVILION_SITE.at,{facing:Math.atan2(-1,.4),label:'Goal pavilion'});
DOOR_APRONS.push({site:'pavilion',door:GOAL_PAVILION_SITE.at,facing:Math.atan2(-1,.4),apron:{at:[GOAL_PAVILION_SITE.at[0]-2.5,GOAL_PAVILION_SITE.at[1],GOAL_PAVILION_SITE.at[2]+1],half:[2.4,2.4],yaw:Math.atan2(-1,.4)}});
edge('path','dam:east','door:pavilion');
edge('path','door:pavilion','district:reservoir');
node('road:reservoir','junction',roadAt(nearestRoadS(54,-244)));
edge('path','road:reservoir','district:reservoir');
edge('path','station:funicular:reservoir','dam:east');
node('road:b3-east','junction',roadAt(nearestRoadS(56,-209)));
edge('stair','road:b3-east','station:funicular:reservoir',[[58,-216],[48,-221],[42,-224]],1.4,'stair:reservoir-steps');
node('road:b2-east','junction',roadAt(nearestRoadS(31.5,-174)));
// Rim steps: from the woodland bridge head (north side, where the deck sits on the rim) up the gorge
// rim in four switchback flights to the road beyond the glass bridge. ~34° all the way up.
node('road:rim-steps','stair-bottom',roadAt(nearestRoadS(25.6,-185.2)));
node('road:rim-top','stair-top',roadAt(nearestRoadS(41,-213)));
// Flights 4 apart and 1.9 half-wide, level landings at each turn: a body never falls between flights.
edge('stair','road:rim-steps','road:rim-top',[[27.6,-190.8],[38,-191.4],[38.4,-195],[21.6,-195.3],[21.6,-199.2],[38.4,-199.5],[39.4,-202.4],[40.2,-207.4]],1.9,'stair:rim-steps');
edge('path','district:library','road:b2-east',[[38,-180]]);
// Summit Commons: road end, observatory, gondola, panorama.
node('road:summit','junction',ROAD_CENTRE[ROAD_CENTRE.length-1]!);
edge('path','road:summit','district:summit');
node('door:observatory','door',[SUMMIT_OBSERVATORY_SITE.at[0],SUMMIT_OBSERVATORY_SITE.at[1],SUMMIT_OBSERVATORY_SITE.at[2]+SUMMIT_OBSERVATORY_SITE.radius],{facing:0,label:'Observatory'});
DOOR_APRONS.push({site:'observatory',door:nodes.get('door:observatory')!.at,facing:0,apron:{at:[SUMMIT_OBSERVATORY_SITE.at[0],SUMMIT_OBSERVATORY_SITE.at[1],SUMMIT_OBSERVATORY_SITE.at[2]+SUMMIT_OBSERVATORY_SITE.radius+2.5],half:[2.4,2.4],yaw:0}});
edge('path','district:summit','door:observatory');
edge('path','district:summit','station:gondola:summit');
node('overlook:summit','overlook',[district('summit').at[0]+2,district('summit').at[1],district('summit').at[2]+12],{facing:0,label:'Harbour panorama'});
edge('path','district:summit','overlook:summit');
// Waterfront gondola station joins the town lanes.
node('town:quay','town',[-34,islandHeight(-34,40),40],{label:'Quay'});
edge('path','town:quay','station:gondola:quay',[],1.8);
// Town walking links (drawn on the island's own lanes) so the graph is one network.
edge('path','town:north','town:quay',[[-2,-20],[-12,-2],[-25,4],[-35,14],[-38,30]],1.6,'town:west-lanes');
// Reserved plots: a gate and a spur from the road.
for(const p of RESERVED_PLOTS){node(`gate:${p.id}`,'plot-gate',p.gate,{label:p.name});node(`plot:${p.id}`,'district',p.at,{label:p.name});edge('path',`gate:${p.id}`,`plot:${p.id}`);}
node('road:shelf','junction',roadAt(nearestRoadS(102,-134)));edge('path','road:shelf','gate:sunny-shelf');
edge('path','road:clearing','gate:woodland-clearing');
node('road:high-terrace','junction',roadAt(nearestRoadS(80,-278)));edge('path','road:high-terrace','gate:high-terrace');
// Dam overlook on the road (race line).
node('road:dam-overlook','overlook',roadAt(nearestRoadS(44,-209)),{facing:Math.atan2(8-44,-228+209),label:'Dam overlook'});

// ——— Road edges between consecutive junctions ————————————————————————————————
function roadEdges(line:'road'|'lane'){
  const pts=line==='road'?ROAD_CENTRE:ORCHARD_LANE_CENTRE,prefix=line==='road'?'road:':'lane:';
  const on=[...nodes.values()].filter(n=>n.id.startsWith(prefix)).map(n=>({n,i:pts.findIndex(p=>p===n.at||(p[0]===n.at[0]&&p[2]===n.at[2]))})).filter(e=>e.i>=0).sort((a,b)=>a.i-b.i);
  for(let k=1;k<on.length;k++){const a=on[k-1]!,b=on[k]!;edges.push({id:`${line}:${a.n.id}~${b.n.id}`,kind:'road',from:a.n.id,to:b.n.id,halfWidth:line==='road'?4.8:3.2,points:pts.slice(a.i,b.i+1),length:arcLengths(pts.slice(a.i,b.i+1)).at(-1)!});}
}
node('road:hearth-lane','junction',roadAt(nearestRoadS(ORCHARD_LANE_WAYPOINTS[0]!.at[0],ORCHARD_LANE_WAYPOINTS[0]!.at[1])));
roadEdges('road');roadEdges('lane');
edge('path','road:hearth-lane','lane:junction',[],3,'link:lane-junction');

export const MOUNTAIN_PATH_GRAPH={nodes:[...nodes.values()],edges} as const;
export const OVERLOOKS=[...nodes.values()].filter(n=>n.kind==='overlook').map(n=>({id:n.id,name:n.label??n.id,at:n.at,facing:n.facing??0,look:[n.at[0]+Math.sin(n.facing??0)*40,n.at[1]-8,n.at[2]+Math.cos(n.facing??0)*40] as Point3}));
/** Path and stair decks begin at the road's edge, never over the carriageway (a skater on the road
 * must not be lifted onto a stair). Routing still uses the full polyline to the junction. */
const onRoad=(p:Point3)=>onRoadXZ(p[0],p[2]);
/** How far outside the nearest carriageway edge a plan point is (negative: on the road). */
const beyondRoadEdge=(x:number,z:number)=>{let best=Infinity;for(const [pts,hw] of [[ROAD_CENTRE,4.8],[ORCHARD_LANE_CENTRE,3.2]] as const){for(const q of pts){const d=Math.hypot(q[0]-x,q[2]-z)-hw;if(d<best)best=d;}}return best;};
/** The point between an on-road `inside` and an off-road `outside` that lies just inside the road edge. */
const atRoadEdge=(inside:Point3,outside:Point3):Point3=>{let lo=0,hi=1;for(let k=0;k<18;k++){const m=(lo+hi)/2;if(beyondRoadEdge(mix(inside[0],outside[0],m),mix(inside[2],outside[2],m))< -.15)lo=m;else hi=m;}
  return [mix(inside[0],outside[0],lo),mix(inside[1],outside[1],lo),mix(inside[2],outside[2],lo)];};
/** A deck that leaves the road starts at the road's edge (just inside it, so a body steps straight from the
 * carriageway onto it — no gap of open ground between), never further over the carriageway. */
const trimmed=(e:PathEdge):PathEdge=>{let a=0,b=e.points.length;while(a<b-2&&onRoad(e.points[a]!))a++;while(b>a+2&&onRoad(e.points[b-1]!))b--;
  const points=e.points.slice(a,b);
  if(a>0)points.unshift(atRoadEdge(e.points[a-1]!,e.points[a]!));
  if(b<e.points.length)points.push(atRoadEdge(e.points[b]!,e.points[b-1]!));
  return {...e,points,length:arcLengths(points).at(-1)!};};
/** Paths the ground is cut to (benches) and decks: everything that is not a road, trimmed at road edges. */
export const PATH_EDGES=edges.filter(e=>e.kind!=='road').map(trimmed);
/** Building ground: door aprons as level pads. */
export const BUILDING_PADS=(Object.keys(BUILDING_SITES) as MountainBuilding[]).map(id=>({id,spot:BUILDING_SITES[id]}));

// ——— Routing ——————————————————————————————————————————————————————————————————
export const WALK_SPEED_DEFAULT=2.1;
const STAIR_TIME=1.3;
type Hit={edge:PathEdge;index:number;t:number;d:number;point:Point3};
function project(x:number,z:number):Hit|null{
  let best:Hit|null=null;
  for(const e of edges)for(let i=1;i<e.points.length;i++){
    const a=e.points[i-1]!,b=e.points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(l||1))),px=a[0]+dx*t,pz=a[2]+dz*t,d=Math.hypot(x-px,z-pz);
    if(!best||d<best.d)best={edge:e,index:i,t,d,point:[px,mix(a[1],b[1],t),pz]};
  }
  return best;
}
const cost=(e:PathEdge,len:number,speed:number)=>len/speed*(e.kind==='stair'?STAIR_TIME:1);
export type WalkPlan={points:Point3[];edges:string[];length:number;seconds:number};
/** Shortest-by-time route over the graph (stairs allowed). */
export function mountainWalkPlan(from:{x:number;z:number},to:{x:number;z:number},opts:{speed?:number}={}):WalkPlan|null{
  const speed=opts.speed??WALK_SPEED_DEFAULT,a=project(from.x,from.z),b=project(to.x,to.z);if(!a||!b)return null;
  const partial=(h:Hit,toEnd:boolean)=>{const pts=toEnd?[h.point,...h.edge.points.slice(h.index)]:[...h.edge.points.slice(0,h.index),h.point];return {pts,len:arcLengths(pts).at(-1)!};};
  if(a.edge===b.edge){
    const forward=a.index<b.index||(a.index===b.index&&a.t<=b.t),pts=forward?[a.point,...a.edge.points.slice(a.index,b.index),b.point]:[a.point,...a.edge.points.slice(b.index,a.index).reverse(),b.point];
    const len=arcLengths(pts).at(-1)!;return {points:[...pts,[to.x,b.point[1],to.z]],edges:[a.edge.id],length:len,seconds:cost(a.edge,len,speed)};
  }
  const dist=new Map<string,number>(),prev=new Map<string,{node:string;edge:PathEdge}|null>(),done=new Set<string>();
  const startA=partial(a,false),startB=partial(a,true);
  dist.set(a.edge.from,cost(a.edge,startA.len,speed));prev.set(a.edge.from,null);
  dist.set(a.edge.to,Math.min(dist.get(a.edge.to)??Infinity,cost(a.edge,startB.len,speed)));prev.set(a.edge.to,null);
  const adj=new Map<string,PathEdge[]>();for(const e of edges){for(const n of [e.from,e.to]){const l=adj.get(n)??[];l.push(e);adj.set(n,l);}}
  while(true){
    let u:string|null=null,best=Infinity;for(const [k,v] of dist)if(!done.has(k)&&v<best){best=v;u=k;}
    if(u===null)break;done.add(u);
    for(const e of adj.get(u)??[]){const v=e.from===u?e.to:e.from,c=best+cost(e,e.length,speed);if(c<(dist.get(v)??Infinity)){dist.set(v,c);prev.set(v,{node:u,edge:e});}}
  }
  const endFrom=partial(b,false),endTo=partial(b,true);
  const viaFrom=(dist.get(b.edge.from)??Infinity)+cost(b.edge,endFrom.len,speed),viaTo=(dist.get(b.edge.to)??Infinity)+cost(b.edge,endTo.len,speed);
  const last=viaFrom<=viaTo?b.edge.from:b.edge.to;if(!Number.isFinite(Math.min(viaFrom,viaTo)))return null;
  const chain:{node:string;edge:PathEdge}[]=[];let cur=last;while(prev.get(cur)){const p=prev.get(cur)!;chain.unshift({node:cur,edge:p.edge});cur=p.node;}
  const first=cur,points:Point3[]=[];
  points.push(...(first===a.edge.from?[...startA.pts].reverse():startB.pts));
  for(const step of chain){const e=step.edge,pts=e.to===step.node?e.points:[...e.points].reverse();points.push(...pts.slice(1));}
  points.push(...(last===b.edge.from?endFrom.pts.slice(1):[...endTo.pts].reverse().slice(1)));
  points.push([to.x,points[points.length-1]![1],to.z]);
  const usedEdges=[a.edge.id,...chain.map(c=>c.edge.id),b.edge.id];
  return {points,edges:[...new Set(usedEdges)],length:arcLengths(points).at(-1)!,seconds:Math.min(viaFrom,viaTo)};
}
