import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { addFlatPad, bed } from '../beds/profiles';
import { sampleSpline } from '../beds/solver';
import { buildStair, tunnel } from '../structures/build';
import { box, clamp, distance, mix, nearestOnPath, pathLength, prism, slab, solid } from '../structures/mesh';

export const ROOM_DIMENSIONS:Record<string,{size:XY;floor:number;clear:number}>={lanternCave:{size:[46,32],floor:42,clear:18},deep:{size:[64,60],floor:38,clear:30},bellGallery:{size:[30,26],floor:90,clear:15},sealedDrift:{size:[26,18],floor:42,clear:8}};
/** A passage lining stops at the chamber volume; room walls open only where a passage actually meets them. */
function openRoomConnections(cuts:LandCuts):void {
  const passages=cuts.beds.filter(b=>b.kind==='cave'||b.kind==='rail');
  for(const piece of cuts.solids.filter(s=>s.kind==='cavern'&&s.role==='wall'||s.kind==='tunnel'&&['wall','roof'].includes(s.role))){
    const result={...piece,positions:[] as number[],indices:[] as number[]};
    for(let offset=0;offset<piece.positions.length/3;offset+=8){
      const p=Array.from({length:8},(_,k):XYZ=>[piece.positions[(offset+k)*3]!,piece.positions[(offset+k)*3+1]!,piece.positions[(offset+k)*3+2]!]);
      const start:XYZ=[(p[4]![0]+p[5]![0])/2,(p[4]![1]+p[5]![1])/2,(p[4]![2]+p[5]![2])/2],end:XYZ=[(p[6]![0]+p[7]![0])/2,(p[6]![1]+p[7]![1])/2,(p[6]![2]+p[7]![2])/2];
      if(piece.kind==='cavern'){
        const middle:XY=[(start[0]+end[0])/2,(start[2]+end[2])/2],floor=Math.min(...p.map(v=>v[1])),ceiling=Math.max(...p.map(v=>v[1]));
        if(passages.some(b=>{const hit=nearestOnPath(middle,b.points);return hit.distance<b.width/2+.7&&hit.at[1]<ceiling-.1&&hit.at[1]+b.clearHeight>floor+.1;}))continue;
      }
      let intervals:[number,number][]=[[0,1]];
      if(piece.kind==='tunnel')for(const [id,room]of Object.entries(M.underground.rooms)){
        const d=ROOM_DIMENSIONS[id]!,floor=Math.min(...p.map(v=>v[1])),ceiling=Math.max(...p.map(v=>v[1]));if(floor<d.floor-.01||ceiling>d.floor+d.clear+.6)continue;
        const x=(start[0]-room.xy[0]!)/(d.size[0]/2-.5),z=(start[2]-room.xy[1]!)/(d.size[1]/2-.5),dx=(end[0]-start[0])/(d.size[0]/2-.5),dz=(end[2]-start[2])/(d.size[1]/2-.5),a=dx*dx+dz*dz,b=2*(x*dx+z*dz),c=x*x+z*z-1,disc=b*b-4*a*c;
        if(a<1e-8||disc<=0)continue;const lo=clamp((-b-Math.sqrt(disc))/(2*a),0,1),hi=clamp((-b+Math.sqrt(disc))/(2*a),0,1);if(hi<=lo)continue;
        intervals=intervals.flatMap(([from,to]):[number,number][]=>hi<=from||lo>=to?[[from,to]]:[...(lo>from?[[from,lo] as [number,number]]:[]),...(hi<to?[[hi,to] as [number,number]]:[])]);
      }
      const at=(a:XYZ,b:XYZ,t:number):XYZ=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
      for(const [from,to]of intervals)prism(result,[at(p[4]!,p[7]!,from),at(p[5]!,p[6]!,from),at(p[5]!,p[6]!,to),at(p[4]!,p[7]!,to)],[mix(p[0]![1],p[3]![1],from),mix(p[1]![1],p[2]![1],from),mix(p[1]![1],p[2]![1],to),mix(p[0]![1],p[3]![1],to)]);
    }
    piece.positions=result.positions;piece.indices=result.indices;
  }
  cuts.solids=cuts.solids.filter(s=>s.indices.length>0);
}
/** v2.0: eu the Deep's ceiling (and the collar's underside) rise over the Throat corridor where the passage enters. */
export const THROAT_COFFER=.35;
const THROAT_COFFER_RECT:[number,number,number,number]=[1286.4,1313.6,390,396];
/** Remove a tube's roof prisms over another route's corridor wherever that roof stands lower than the route's clearance. */
function openTubeRoof(cuts:LandCuts,tubeId:string,routes:readonly import('../interfaces').BedCut[]):void {
  const roof=cuts.solids.find(s=>s.id===`${tubeId}.roof`);if(!roof)return;const keep={positions:[] as number[],indices:[] as number[]};
  for(let o=0;o+23<roof.positions.length;o+=24){const v=Array.from({length:8},(_,k):XYZ=>[roof.positions[o+k*3]!,roof.positions[o+k*3+1]!,roof.positions[o+k*3+2]!]),c:XY=[v.reduce((n,q)=>n+q[0],0)/8,v.reduce((n,q)=>n+q[2],0)/8],under=Math.min(...v.map(q=>q[1]));
    const low=routes.some(r=>{const hit=nearestOnPath(c,r.points);return hit.distance<r.width/2+2.4&&hit.at[1]<under&&under<hit.at[1]+r.clearHeight-.01;});
    if(low)continue;const n=keep.positions.length/3;keep.positions.push(...roof.positions.slice(o,o+24));keep.indices.push(...roof.indices.slice(o/24*36,o/24*36+36).map(i=>i-o/3+n));}
  roof.positions=keep.positions;roof.indices=keep.indices;
}
/** A rectangle [x0,x1,z0,z1] less a set of rectangular holes, as disjoint rectangles. */
function rectMinus(r:[number,number,number,number],holes:readonly [number,number,number,number][]):[number,number,number,number][] {
  const xs=[...new Set([r[0],r[1],...holes.flatMap(h=>[h[0],h[1]])].map(v=>clamp(v,r[0],r[1])))].sort((a,b)=>a-b),zs=[...new Set([r[2],r[3],...holes.flatMap(h=>[h[2],h[3]])].map(v=>clamp(v,r[2],r[3])))].sort((a,b)=>a-b),out:[number,number,number,number][]=[];
  for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){const cx=(xs[i-1]!+xs[i]!)/2,cz=(zs[j-1]!+zs[j]!)/2;if(xs[i]!-xs[i-1]!<1e-6||zs[j]!-zs[j-1]!<1e-6||holes.some(h=>cx>h[0]&&cx<h[1]&&cz>h[2]&&cz<h[3]))continue;out.push([xs[i-1]!,xs[i]!,zs[j-1]!,zs[j]!]);}
  return out;
}
export function buildUnderground(cuts:LandCuts,base:HeightQuery):void {
  for(const [id,room]of Object.entries(M.underground.rooms)){
    const p=room.xy as unknown as XY,{size,floor,clear}=ROOM_DIMENSIONS[id]!,pad=addFlatPad(cuts,`underground.${id}`,'place',p,floor,size,0,true);
    const walls=solid(`underground.${id}.walls`,'cavern','rock','wall',[], 'crown'),roof=solid(`underground.${id}.roof`,'cavern','rock','roof',[],'crown');
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12,b=(i+1)*Math.PI/12;
      const p1:XYZ=[p[0]!+Math.cos(a)*size[0]!/2,floor,p[1]!+Math.sin(a)*size[1]!/2],p2:XYZ=[p[0]!+Math.cos(b)*size[0]!/2,floor,p[1]!+Math.sin(b)*size[1]!/2];
      slab(walls,p1,p2,.8,clear,0,clear);
    }
    if(id==='deep'){
      // v1.9 (W3-C A5, P25): the ceiling is closed over the Throat corridor too (the Throat's lining now ends at the
      // room's north wall, z 390); the skylight shaft (MANIFEST skylight.to) is the only hole.
      // v2.0: the ceiling follows the room's ellipse in 15 strips (+1 eu over the wall), not its bounding rectangle: the
      // rectangle's corners hung 0.60 over the Ore Line's tube outside the room ([1270.6,449.4], need 3.2). Strips across
      // the Throat's collar reach the north wall line (z 390). Over the Throat corridor the ceiling is coffered
      // THROAT_COFFER higher, so the passage clears doors.throat.collarAperture_m under the collar (built 10.79 < 10.8).
      const sky=M.underground.rooms.deep.skylight.to as unknown as XY,holes:[number,number,number,number][]=[[sky[0]!-4,sky[0]!+4,sky[1]!-4,sky[1]!+4],THROAT_COFFER_RECT],rx=size[0]!/2,rz=size[1]!/2;
      const strip=2*rx/15;for(let x0=p[0]!-rx;x0<p[0]!+rx-1e-6;x0+=strip){const x1=Math.min(x0+strip,p[0]!+rx),near=Math.min(Math.abs(x0-p[0]!),Math.abs(x1-p[0]!),x0<p[0]!&&x1>p[0]!?0:Infinity),half=rz*Math.sqrt(Math.max(0,1-(near/rx)**2))+1,north=x1>1281&&x0<1319?p[1]!-rz:p[1]!-half;
        for(const [a0,a1,b0,b1] of rectMinus([x0,x1,Math.max(p[1]!-rz,north),Math.min(p[1]!+rz,p[1]!+half)],holes))box(roof,[(a0+a1)/2,(b0+b1)/2],floor+clear+.6,[a1-a0,b1-b0],floor+clear);}
      const [c0,c1,c2,c3]=THROAT_COFFER_RECT;box(roof,[(c0+c1)/2,(c2+c3)/2],floor+clear+.6+THROAT_COFFER,[c1-c0,c3-c2],floor+clear+THROAT_COFFER);
    }else box(roof,p,floor+clear+.6,size,floor+clear);
    cuts.solids.push(walls,roof);
    const cover=base(...p)-(floor+clear+.6);if(cover<.6)cuts.diagnostics.push({id:`underground.${id}.cover`,severity:'conflict',message:`${id}: rock cover above room roof is insufficient`,at:p,measured:cover,required:.6});
    pad.serviceBedId=`underground.${id}`;
  }
  const oreControls=M.rail.ORE.pts as unknown as XY[],oreHeights=[40,42,68,68,40,57,96,110];
  const ore:XYZ[]=[];
  for(let i=1;i<oreControls.length;i++){
    const a=oreControls[i-1]!,b=oreControls[i]!,count=Math.ceil(distance(a,b)/4);
    for(let j=0;j<count;j++){const t=j/count;ore.push([mix(a[0]!,b[0]!,t),mix(oreHeights[i-1]!,oreHeights[i]!,t),mix(a[1]!,b[1]!,t)]);}
  }
  ore.push([1345,110,680]);const oreBed=bed('ORE','rail',ore,false);oreBed.clearHeight=3.2;oreBed.structureIds=['oreTunnel','southPortal'];cuts.beds.push(oreBed);tunnel('oreTunnel',ore,3.6,3.2,cuts,'crown',{base});
  const rails=solid('ORE.rails','rail','rail','rail',['ORE'],'crown');for(let i=1;i<ore.length;i++)for(const offset of [-.45,.45])slab(rails,ore[i-1]!,ore[i]!,.09,.12,offset,.12);cuts.solids.push(rails);
  const siding=bed('ORE.siding','rail',[[1248,68,470],[1270,68,450],[1280,68,454]],false);cuts.beds.push(siding);tunnel('oreSiding',siding.points,3.6,3.2,cuts);
  // v2.0: where the siding leaves the Ore Line (and ORE drops toward the Deep) the Ore Line's roof stood 2.74 over the
  // siding (need 3.2): the Ore Line's roof is opened over the siding's corridor; the siding's own roof closes it.
  const roomPassages:[string,XYZ[]][]=[['lanternCave',[[1160,42,520],[1195,42,492],[1220,42,480]]],['sealedDrift',[[1180,42,500],[1200,42,495],[1220,42,480]]],['bellGallery',[[1220,42,480],[1240,54,515],[1280,68,525],[1320,80,505],[1310,90,470]]],['deepAccess',[[1220,42,480],[1260,42,440],[1300,40.6,440]]]];
  for(const [id,points]of roomPassages){const b=bed(`underground.${id}`,'cave',points,false);b.width=6;cuts.beds.push(b);tunnel(id in ROOM_DIMENSIONS?`underground.${id}.passage`:b.id,points,6,8,cuts,'crown',{bedIds:[b.id]});}
  // v2.0: the lantern cave's passage starts on the Ore Line at [1160,42,520] while ORE climbs away 36 % inside its own
  // tube: ORE's roof stood 3.4 over the passage (need 6). ORE's roof opens over the siding and the passage where it
  // stands lower than their clearance; their own roofs close the junctions.
  openTubeRoof(cuts,'oreTunnel',[siding,cuts.beds.find(b=>b.id==='underground.lanternCave')!]);
  // D-C3 (v2.0): the Throat's mouth is the 26 x 18 aperture on the north face; where the passage enters the Deep under the
  // collar its clearance is doors.throat.collarAperture_m (the clearance report checks the passage against it).
  const throat:XYZ[]=[[1300,110,300],[1300,75,360],[1300,40,420]],throatBed=bed('underground.throat','cave',throat,false);throatBed.width=26;throatBed.clearHeight=(M.underground.doors.throat as unknown as {collarAperture_m?:number}).collarAperture_m??18;cuts.beds.push(throatBed);
  // v1.9 (W3-C A5): the Throat's lining ends at the Deep's north wall (z 390, floor 57.5); inside the room the flight path runs on under the Deep's own ceiling.
  tunnel(throatBed.id,[[1300,110,300],[1300,75,360],[1300,57.5,390]],26,18,cuts);
  // The north buttress carries a deep rock hood; the 26 x 18m flight mouth remains completely open.
  const hood=solid('throat.rockHood','rockHood','rock','roof',[throatBed.id],'crown'),jambs=solid('throat.rockHood.supports','rockButtress','rock','support',[throatBed.id],'crown');
  box(hood,[1300,300],131,[38,12],128);for(const side of [-1,1])box(jambs,[1300+side*16,300],131,[4,12],109.8);cuts.solids.push(hood,jambs);
  const seaXY=sampleSpline(M.water_routes.DEEP_RUN.pts as unknown as XY[],4),sea:XYZ[]=[];let along=0;
  for(let i=0;i<seaXY.length;i++){
    if(i)along+=distance(seaXY[i-1]!,seaXY[i]!);
    // Three 12m chutes occupy the first 120m; the final four metres drain to sea level.
    const h=along<=120?40-36*(along/120):Math.max(0,4*(1-(along-120)/(M.water_routes.DEEP_RUN.length_m-120)));
    sea.push([seaXY[i]![0]!,h,seaXY[i]![1]!]);
  }
  const seaBed=bed('DEEP_RUN','cave',sea,false);seaBed.width=9;seaBed.clearHeight=6;cuts.beds.push(seaBed);tunnel('seaPassage',sea,9,6,cuts);
  buildStair('stepsPortage',[1300,40.6,440],[1420,4,505],3,cuts);
  // Skylight shaft at MANIFEST underground.rooms.deep.skylight (off the Throat centreline), from the Deep's ceiling to topH.
  const sky=M.underground.rooms.deep.skylight,sxy=sky.to as unknown as XY,deepTop=ROOM_DIMENSIONS.deep!.floor+ROOM_DIMENSIONS.deep!.clear,shaft=solid('deep.skylight.shaft','skylight','rock','wall',[],'crown');
  for(const side of [-1,1]){box(shaft,[sxy[0]!+side*4.3,sxy[1]!],sky.topH,[.6,8.6],deepTop);box(shaft,[sxy[0]!,sxy[1]!+side*4.3],sky.topH,[8,.6],deepTop);}cuts.solids.push(shaft);
  cuts.mouths.push({id:'deep.skylight',kind:'skylight',floor:40,ceiling:sky.topH,outline:[[sxy[0]!-4,sxy[1]!-4],[sxy[0]!-4,sxy[1]!+4],[sxy[0]!+4,sxy[1]!+4],[sxy[0]!+4,sxy[1]!-4]]});
  // The Throat collar (v1.9): the Deep's north wall carried up from its ceiling to above the Throat's lining roof across
  // the Throat's width, so the Throat opens into the Deep only below the ceiling (57.5-68) and no sightline leaves the rock.
  const collar=solid('underground.deep.throatCollar','lintel','rock','wall',['underground.throat'],'crown');
  box(collar,[1300,390],57.5+18+1.2,[27.2,.8],deepTop+THROAT_COFFER);cuts.solids.push(collar);
  {const floorAtCollar=75+(40-75)*(390-360)/60,aperture=deepTop+THROAT_COFFER-floorAtCollar;cuts.diagnostics.push({id:'underground.throat.collarAperture',severity:aperture<throatBed.clearHeight-.001?'conflict':'info',message:`the Throat enters the Deep under the collar with ${aperture.toFixed(2)} eu clear (MANIFEST doors.throat.collarAperture_m ${throatBed.clearHeight})`,at:[1300,390],measured:aperture,required:throatBed.clearHeight});}
  // R2-53 (page G): the Deep's north wall was open from its floor to its ceiling across x 1281-1319 (four wall panels
  // absent), so from the jetty the rock's inside — the terrain's underside — showed below and beside the Throat. A
  // headwall closes it: panels on the room's own curve from the floor to under the Throat's floor slab (56.9), and two
  // jambs from there to the ceiling either side of the Throat's lining. Only the Throat's 26 x 18 lining stays open.
  const head=solid('underground.deep.headwall','headwall','rock','wall',['underground.throat'],'crown'),dp=M.underground.rooms.deep.xy as unknown as XY,ds=ROOM_DIMENSIONS.deep!,throatFloor=57.5-.6;
  for(let i=0;i<24;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12,p1:XYZ=[dp[0]!+Math.cos(a)*ds.size[0]!/2,ds.floor,dp[1]!+Math.sin(a)*ds.size[1]!/2],p2:XYZ=[dp[0]!+Math.cos(b)*ds.size[0]!/2,ds.floor,dp[1]!+Math.sin(b)*ds.size[1]!/2];
    if((p1[2]+p2[2])/2>dp[1]!-ds.size[1]!/2+8||Math.abs((p1[0]+p2[0])/2-dp[0]!)>22)continue;slab(head,p1,p2,.8,throatFloor-ds.floor,0,throatFloor-ds.floor);}
  for(const x of [1283.8,1316.2])box(head,[x,392.8],deepTop,[6,6.8],throatFloor);cuts.solids.push(head);
  for(const [id,door]of Object.entries(M.underground.doors)){
    const width=id==='throat'?26:id==='seaDoor'?9:4,depth=id==='throat'?18:6,p=door.xy as unknown as XY;
    cuts.mouths.push({id,kind:'portal',floor:door.h,ceiling:door.h+(id==='throat'?18:id==='seaDoor'?6:3.2),outline:[[p[0]!-width/2,p[1]!-depth/2],[p[0]!-width/2,p[1]!+depth/2],[p[0]!+width/2,p[1]!+depth/2],[p[0]!+width/2,p[1]!-depth/2]]});
    if(id==='adit'||id==='southPortal'){addFlatPad(cuts,`oreStation.${id}`,'landing',p,door.h,[10,6],0,true);const frame=solid(`${id}.portal.frame`,'portal','timber','wall',['ORE'],'crown');for(const side of [-1,1])box(frame,[p[0]!+side*2.2,p[1]!],door.h+3.8,[.5,1],door.h);box(frame,p,door.h+3.8,[4.9,1],door.h+3.2);cuts.solids.push(frame);}
  }
  const link=bed('southPortal.link','walk',[[1345,110,680],[1355,110,685],[1370,110,690]]);cuts.beds.push(link);
  openRoomConnections(cuts);
  // Ignore only the named entrance neighbourhoods when measuring roof cover.
  let low=Infinity,lowAt:XY=[0,0];
  for(const b of cuts.beds.filter(b=>b.kind==='cave'||b.id==='ORE'))for(const p of b.points){
    if(cuts.mouths.some(m=>distance([p[0]!,p[2]!],[m.outline.reduce((s,v)=>s+v[0]!,0)/m.outline.length,m.outline.reduce((s,v)=>s+v[1]!,0)/m.outline.length])<18))continue;
    const cover=base(p[0]!,p[2]!)-(p[1]!+b.clearHeight+.6);if(cover<low){low=cover;lowAt=[p[0]!,p[2]!];}
  }
  if(low<.6)cuts.diagnostics.push({id:'underground.routeCover',severity:'conflict',message:'A tunnel roof breaches the available terrain; rock cover is not fabricated',at:lowAt,measured:low,required:.6});
  cuts.diagnostics.push({id:'underground.seaPassageLength',severity:'info',message:`Solved Sea Passage is ${pathLength(sea).toFixed(1)} eu in plan; manifest route length is 529 m and prose says 504 m`,measured:pathLength(sea),required:529});
}
