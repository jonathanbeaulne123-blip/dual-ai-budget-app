/** Horizon's local joins to the carried mountain. Native terrain, road and landmarks are never rewritten. */
import V2 from './v2-data.json';
import type {HeightQuery,LandCuts,StructureSolid,XYZ} from '../interfaces';
import {drawnRoadFloor} from '../../regions/mountainV2/drawnRoadFloor';
import {drawnRoadGroundCeiling} from '../../regions/mountainV2/drawnRoadGround';
import {v2GroundAt} from './ground';
import {box,mitredSlab,nearestOnPath,prism,slab,solid} from '../structures/mesh';
import {pier} from '../structures/foundations';

// Read every source RoadSample, including its actual transverse frame. Rebuilding
// a normal from the centreline would lose any authored frame fairing at a bend.
const samples=V2.road.samples;
const roadRows=samples.map(s=>[-s.hw,-s.hw+.55,-.45,.45,s.hw-.55,s.hw].map(w=>
  [s.at[0]!+s.normal[0]!*w,s.at[1]!,s.at[2]!+s.normal[2]!*w] as [number,number,number]));
const roadFloor=drawnRoadFloor(roadRows);
const roadPoints=samples.map(s=>s.at as [number,number,number]);
const roadGroundCeiling=drawnRoadGroundCeiling({id:'mountain-road',kind:'road',points:roadPoints,walkable:true,halfWidth:Math.max(...samples.map(s=>s.hw)),widths:samples.map(s=>s.hw),landingRows:roadRows,material:'path'});
/** Offline source-derived road top, in Horizon coordinates. */
export const mountainJoinRoadTop=(x:number,z:number,ceiling=Infinity):number|null=>roadFloor(x,z,ceiling)?.y??null;

/** A painted offer footprint needs no second floor over the region's graded road. */
function summitThreshold(cuts:LandCuts):void {
  const pad=cuts.pads.find(p=>p.id==='threshold.skateLineStarts.1');if(!pad)return;
  const road=roadFloor(pad.centre[0],pad.centre[2],pad.centre[1]+.5);
  if(!road||Math.abs(road.y-pad.centre[1])>.025)throw new Error('Summit threshold no longer meets the carried road');
  cuts.solids=cuts.solids.filter(s=>s.id!==`${pad.id}.slab`);
  pad.deck=true;pad.blend=0;
}

/** January's outer paving follows its real supporting ground. The level interior
 * remains at the authored terrace height; the final 3m approach becomes a closed
 * apron, with at most 15mm at its ground seam. This changes geometry, not collision
 * tolerances. The native home footway remains the connected entry from the road. */
function januaryApron(cuts:LandCuts,base:HeightQuery):void {
  const pad=cuts.pads.find(p=>p.id==='station.jan');if(!pad)return;
  if(pad.rotationDegrees!==0)throw new Error('January apron needs re-authoring after a pad rotation');
  const original=cuts.solids.find(s=>s.id===`${pad.id}.slab`);if(!original)return;
  const [cx,h,cz]=pad.centre,hx=pad.size[0]/2,hz=pad.size[1]/2,apron=3,step=1;
  const ground=(x:number,z:number)=>Math.min(v2GroundAt(x,z)??base(x,z),roadGroundCeiling(x,z)??Infinity);
  const top=(x:number,z:number)=>{
    const inset=Math.min(hx-Math.abs(x-cx),hz-Math.abs(z-cz));
    const road=roadFloor(x,z,h+4);
    // Never cover a native road top with a level pad. Its visible paint remains
    // higher than this 15mm paving seam, and its source road remains the authority.
    if(road)return Math.min(h,road.y+.015);
    const terrain=ground(x,z)+.015;
    let y=Math.max(terrain,Math.min(h,terrain+Math.max(0,inset)*.18));
    // A real toe, starting on the drawn road edge and falling at 12% until it
    // meets the ground, closes the small drop onto the native home footway.
    const near=nearestOnPath([x,z],roadPoints);
    if(near.distance<samples[near.segment]!.hw+2.5){
      let outside=0,inside=1;
      for(let k=0;k<24;k++){const t=(outside+inside)/2,hit=roadFloor(x+(near.at[0]-x)*t,z+(near.at[2]-z)*t,h+4);if(hit)inside=t;else outside=t;}
      const edge=roadFloor(x+(near.at[0]-x)*inside,z+(near.at[2]-z)*inside,h+4);
      if(edge){
        const border=Math.min(hx+apron-Math.abs(x-cx),hz+apron-Math.abs(z-cz));
        const toe=edge.y+.015-inside*near.distance*.12;
        y+=Math.max(0,toe-y)*Math.min(1,Math.max(0,border/.5));
      }
    }
    return y;
  };
  const out:StructureSolid={...original,positions:[],indices:[]};
  const columns=Math.round((pad.size[0]+2*apron)/step)+1,rows=Math.round((pad.size[1]+2*apron)/step)+1;
  for(let iz=0;iz<rows;iz++)for(let ix=0;ix<columns;ix++){
    const x=cx-hx-apron+ix*step,z=cz-hz-apron+iz*step,y=top(x,z);
    out.positions.push(x,y,z,x,Math.min(y-.18,ground(x,z)-.25),z);
  }
  const v=(x:number,z:number)=>2*(z*columns+x);
  for(let z=0;z<rows-1;z++)for(let x=0;x<columns-1;x++){
    const a=v(x,z),b=v(x,z+1),c=v(x+1,z+1),d=v(x+1,z);
    out.indices.push(a,b,c,a,c,d,a+1,c+1,b+1,a+1,d+1,c+1);
  }
  const side=(a:number,b:number)=>out.indices.push(a,a+1,b+1,a,b+1,b);
  for(let x=0;x<columns-1;x++){side(v(x,0),v(x+1,0));side(v(x+1,rows-1),v(x,rows-1));}
  for(let z=0;z<rows-1;z++){side(v(0,z+1),v(0,z));side(v(columns-1,z),v(columns-1,z+1));}
  cuts.solids[cuts.solids.indexOf(original)]=out;pad.deck=true;pad.blend=0;
}

/** The east side of the Crown deck crosses the final road approach. A visible
 * 1.2m-deep girder spans between two piers beyond the full road +2m envelope.
 * Deck, run-off lip, rails and stair retain their authored geometry. */
function crownRoadSpan(cuts:LandCuts,base:HeightQuery):void {
  const old=cuts.solids.find(s=>s.id==='crownLaunch.columns'),deck=cuts.solids.find(s=>s.id==='crownLaunch.slab');if(!old||!deck)return;
  const top=Math.max(...deck.positions.filter((_,i)=>i%3===1))-.6;
  const columns:StructureSolid={...old,positions:[],indices:[]};
  const bearings=[[1316.6,468.6],[1316.6,475.4],[1327.4,461.5],[1327.4,480.5]] as const;
  for(const at of bearings)pier(columns,at,top,base,[.8,.8],[1.8,1.8]);
  const beam=solid('crownLaunch.roadSpan','capBeam','metal','support',['crownLaunch'],deck.districtId);
  slab(beam,[1327.4,top,461.5],[1327.4,top,480.5],.8,1.2);
  cuts.solids[cuts.solids.indexOf(old)]=columns;cuts.solids.push(beam);
}

/** A supported walk keeps the source plan and endpoint platforms, filling the
 * exposed half-metre step where the short cable-crossing pad previously ended. */
function summitStationWalk(cuts:LandCuts,base:HeightQuery):void {
  const bed=cuts.beds.find(b=>b.id==='walk summitStation');if(!bed)return;
  const out=solid('walk summitStation.join','landing',bed.surface,'deck',[bed.id],'crown');
  for(let i=1;i<bed.points.length;i++){
    const a=bed.points[i-1]!,b=bed.points[i]!,length=Math.hypot(b[0]-a[0],b[2]-a[2]);
    const nx=-(b[2]-a[2])/length,nz=(b[0]-a[0])/length;
    const at=(p:XYZ,side:number):XYZ=>[p[0]+nx*side*bed.width/2,p[1],p[2]+nz*side*bed.width/2];
    const corners=[at(a,-1),at(a,1),at(b,1),at(b,-1)];
    prism(out,corners,corners.map(p=>Math.min(p[1]-.35,(v2GroundAt(p[0],p[2])??base(p[0],p[2]))-.25)));
  }
  cuts.solids=cuts.solids.filter(s=>s.id!=='crossing.walkSummitStation.g1.1.slab');
  cuts.solids.push(out);bed.structureIds.push(out.id);
}

/** L02 remains a level platform at its centre, but its own edge descends to the
 * ground within the original pad footprint. The carried Summit walk can then
 * leave it without stepping off a half-metre slab. */
function summitPlaceEdge(cuts:LandCuts,base:HeightQuery):void {
  const pad=cuts.pads.find(p=>p.id==='place.L02'),original=cuts.solids.find(s=>s.id==='place.L02.slab');if(!pad||!original)return;
  if(pad.rotationDegrees!==0)throw new Error('L02 edge needs re-authoring after a pad rotation');
  const [x,y,z]=pad.centre,hx=pad.size[0]/2,hz=pad.size[1]/2;
  const ground=(x:number,z:number)=>v2GroundAt(x,z)??base(x,z);
  const top=(X:number,Z:number)=>{
    const ix=hx-Math.abs(X-x),iz=hz-Math.abs(Z-z),inset=Math.min(ix,iz);
    const edge=ix<iz?ground(x+Math.sign(X-x)*hx,Z):ground(X,z+Math.sign(Z-z)*hz);
    return Math.max(ground(X,Z)+.015,y+(edge+.015-y)*Math.max(0,1-inset/3));
  };
  const out:StructureSolid={...original,positions:[],indices:[]},columns=pad.size[0]+1,rows=pad.size[1]+1;
  for(let iz=0;iz<rows;iz++)for(let ix=0;ix<columns;ix++){
    const X=x-hx+ix,Z=z-hz+iz,Y=top(X,Z);out.positions.push(X,Y,Z,X,Math.min(Y-.35,ground(X,Z)-.25),Z);
  }
  const v=(c:number,r:number)=>2*(r*columns+c);
  for(let r=0;r<rows-1;r++)for(let c=0;c<columns-1;c++){
    const a=v(c,r),b=v(c,r+1),C=v(c+1,r+1),d=v(c+1,r);out.indices.push(a,b,C,a,C,d,a+1,C+1,b+1,a+1,d+1,C+1);
  }
  const side=(a:number,b:number)=>out.indices.push(a,a+1,b+1,a,b+1,b);
  for(let c=0;c<columns-1;c++){side(v(c,0),v(c+1,0));side(v(c+1,rows-1),v(c,rows-1));}
  for(let r=0;r<rows-1;r++){side(v(0,r+1),v(0,r));side(v(columns-1,r),v(columns-1,r+1));}
  cuts.solids[cuts.solids.indexOf(original)]=out;pad.deck=true;pad.blend=0;
}

/** The real Crown treads carry the flight: a second mitred inclined bed used to
 * put its side wall across the bottom landing. The last landing now follows the
 * existing ground, which is higher than the old buried connector. A short closed
 * fairing meets the unchanged lower treads within the original flight footprint. */
function crownStairLanding(cuts:LandCuts,base:HeightQuery):void {
  const bed=cuts.beds.find(b=>b.id==='crownLaunch.stair');if(!bed||bed.points.length!==3)return;
  const [head,foot,join]=bed.points as [XYZ,XYZ,XYZ],run=Math.hypot(head[0]-foot[0],head[2]-foot[2]);
  const dx=(head[0]-foot[0])/run,dz=(head[2]-foot[2])/run,rise=head[1]-foot[1];
  const steps=Math.ceil(rise/.17),fairingRun=8*run/steps;
  const ground=(x:number,z:number)=>v2GroundAt(x,z)??base(x,z);
  const landingHeight=foot[1]+8*rise/steps,joinHeight=ground(join[0],join[2])+.015;
  const joinDX=foot[0]-join[0],joinDZ=foot[2]-join[2],joinLength2=joinDX*joinDX+joinDZ*joinDZ;
  const top=(x:number,z:number)=>{
    const along=Math.max(0,Math.min(1,((x-join[0])*joinDX+(z-join[2])*joinDZ)/joinLength2));
    return Math.max(ground(x,z)+.015,joinHeight+(landingHeight-joinHeight)*along);
  };
  const end:XYZ=[foot[0]+dx*fairingRun,top(foot[0]+dx*fairingRun,foot[2]+dz*fairingRun),foot[2]+dz*fairingRun];
  const path:XYZ[]=[join,foot,end],sections:{x:number;z:number;nx:number;nz:number;scale:number}[]=[];
  for(let i=0;i<path.length;i++){
    const a=path[Math.max(0,i-1)]!,b=path[Math.min(path.length-1,i+1)]!,l=Math.hypot(b[0]-a[0],b[2]-a[2]);
    const nx=-(b[2]-a[2])/l,nz=(b[0]-a[0])/l;
    const p=path[i]!,q=path[i===path.length-1?i-1:i+1]!,sign=i===path.length-1?-1:1,d=Math.hypot(q[0]-p[0],q[2]-p[2]);
    const scale=1/Math.max(.5,nx*(-(q[2]-p[2])*sign/d)+nz*((q[0]-p[0])*sign/d));
    sections.push({x:p[0],z:p[2],nx,nz,scale});
  }
  // Clip the replacement to the pre-existing deck/flight plan envelopes. A
  // freshly calculated turn miter must not widen a protected stair footprint.
  const template=solid('crown.stair.plan','bed','stone','deck');
  mitredSlab(template,bed.points,1,bed.width,.35);mitredSlab(template,bed.points,2,bed.width,.35);slab(template,head,foot,bed.width,.35);
  const footprints:XYZ[][]=[];for(let k=0;k<template.positions.length;k+=24)footprints.push([4,5,6,7].map(v=>template.positions.slice(k+v*3,k+v*3+3) as XYZ));
  const inPlan=(x:number,z:number)=>footprints.some(poly=>poly.every((p,i)=>{const q=poly[(i+1)%4]!;return(q[0]-p[0])*(z-p[2])-(q[2]-p[2])*(x-p[0])<=1e-7;}));
  const out=solid('crownLaunch.stair.landing','landing','stone','deck',[bed.id],'crown');
  const rows:XYZ[][]=[],across=6;
  for(let i=1;i<sections.length;i++){
    const a=sections[i-1]!,b=sections[i]!,long=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.25);
    for(let j=i===1?0:1;j<=long;j++){
      const u=j/long,row:XYZ[]=[],cx=a.x+(b.x-a.x)*u,cz=a.z+(b.z-a.z)*u,nx=a.nx*a.scale+(b.nx*b.scale-a.nx*a.scale)*u,nz=a.nz*a.scale+(b.nz*b.scale-a.nz*a.scale)*u;
      const edge=(side:number)=>{let hi=bed.width/2,lo=0;if(inPlan(cx+nx*hi*side,cz+nz*hi*side))return hi;for(let k=0;k<28;k++){const mid=(lo+hi)/2;if(inPlan(cx+nx*mid*side,cz+nz*mid*side))lo=mid;else hi=mid;}return lo;};
      const left=Math.max(0,edge(-1)-.1),right=Math.max(0,edge(1)-.1);
      for(let k=0;k<=across;k++){
        const v=k<=across/2?-left*(1-2*k/across):right*(2*k/across-1),x=cx+nx*v,z=cz+nz*v;
        row.push([x,top(x,z),z]);
      }
      rows.push(row);
    }
  }
  for(const row of rows)for(const p of row)out.positions.push(...p,p[0],Math.min(p[1]-.2,ground(p[0],p[2])-.25),p[2]);
  const vertex=(r:number,c:number)=>2*(r*(across+1)+c);
  for(let r=0;r<rows.length-1;r++)for(let c=0;c<across;c++){
    const a=vertex(r,c),b=vertex(r,c+1),C=vertex(r+1,c+1),d=vertex(r+1,c);
    out.indices.push(a,b,C,a,C,d,a+1,C+1,b+1,a+1,d+1,C+1);
  }
  const side=(a:number,b:number)=>out.indices.push(a,a+1,b+1,a,b+1,b);
  for(let c=0;c<across;c++){side(vertex(0,c),vertex(0,c+1));side(vertex(rows.length-1,c+1),vertex(rows.length-1,c));}
  for(let r=0;r<rows.length-1;r++){side(vertex(r+1,0),vertex(r,0));side(vertex(r,across),vertex(r+1,across));}
  // A new raised landing has its own visible guard, joined to the existing
  // flight rail. Its narrow posts stay at the edge, outside the walking width.
  const rail=solid('crownLaunch.stair.landingRails','handrail','metal','rail',[bed.id],'crown');
  for(const side of [0,across]){
    let lastPost=-Infinity;
    for(let r=1;r<rows.length;r++){
      const a=rows[r-1]![side]!,b=rows[r]![side]!;slab(rail,a,b,.09,.09,0,1.05);slab(rail,a,b,.08,.7,0,.95);
      const along=Math.hypot(a[0]-join[0],a[2]-join[2]);
      if(r===1||along-lastPost>=1.75){box(rail,[a[0],a[2]],a[1]+1.05,[.12,.12],a[1]-.1);lastPost=along;}
      if(r===rows.length-1)box(rail,[b[0],b[2]],b[1]+1.05,[.12,.12],b[1]-.1);
    }
  }
  cuts.solids.push(rail);
  bed.carried=[bed.points.map(p=>[p[0],p[2]])];
  bed.points=[head,[foot[0],top(foot[0],foot[2]),foot[2]],[join[0],top(join[0],join[2]),join[2]]];
  bed.structureIds.push(out.id);cuts.solids.push(out);
}

/** Called after the Horizon thresholds and structures exist, before final foundation
 * settlement/serialization. All repaired tops are real rendered collision triangles. */
export function fitMountainHorizonJoins(cuts:LandCuts,base:HeightQuery):void {
  summitThreshold(cuts);januaryApron(cuts,base);crownRoadSpan(cuts,base);
  summitStationWalk(cuts,base);summitPlaceEdge(cuts,base);crownStairLanding(cuts,base);
}
