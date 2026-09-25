import type { BedCut, HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { addFlatPad, emitBedGeometry } from './profiles';
import { gradeRoute, type HeightPin } from './solver';
import { box, clamp, distance, districtAt, maxGrade, mix, nearestOnPath, plan, prism, slab, solid } from '../structures/mesh';

export interface ComputedCrossing {
  id:string;a:string;b:string;sourceA?:string;sourceB?:string;at:XY;heightA:number;heightB:number;
  resolution:'threshold'|'over'|'under';requiredClearance:number;built?:boolean;clearancePass?:boolean;
  kind?:string;
}
function clipEdgePrisms(piece:StructureSolid,at:XY,radius:number,height:number):void {
  const kept={...piece,positions:[] as number[],indices:[] as number[]};
  for(let vertex=0;vertex<piece.positions.length/3;vertex+=8){
    const p=Array.from({length:8},(_,k):XYZ=>[piece.positions[(vertex+k)*3]!,piece.positions[(vertex+k)*3+1]!,piece.positions[(vertex+k)*3+2]!]);
    const start:XYZ=[(p[4]![0]+p[5]![0])/2,(p[4]![1]+p[5]![1])/2,(p[4]![2]+p[5]![2])/2],end:XYZ=[(p[6]![0]+p[7]![0])/2,(p[6]![1]+p[7]![1])/2,(p[6]![2]+p[7]![2])/2],hit=nearestOnPath(at,[start,end]);
    const append=(from:number,to:number)=>{const interpolate=(a:XYZ,b:XYZ,t:number):XYZ=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];const top=[interpolate(p[4]!,p[7]!,from),interpolate(p[5]!,p[6]!,from),interpolate(p[5]!,p[6]!,to),interpolate(p[4]!,p[7]!,to)];prism(kept,top,[mix(p[0]![1],p[3]![1],from),mix(p[1]![1],p[2]![1],from),mix(p[1]![1],p[2]![1],to),mix(p[0]![1],p[3]![1],to)]);};
    const thickness=Math.max(...p.slice(4).map(p=>p[1]))-Math.min(...p.slice(0,4).map(p=>p[1]));
    if(hit.distance>=radius||hit.at[1]<height-.6||hit.at[1]-thickness>height+1.3){append(0,1);continue;}
    const half=Math.sqrt(Math.max(0,radius*radius-hit.distance*hit.distance))/(distance(plan(start),plan(end))||1),lo=clamp(hit.t-half,0,1),hi=clamp(hit.t+half,0,1);
    if(lo>1e-5)append(0,lo);if(hi<1-1e-5)append(hi,1);
  }
  piece.positions=kept.positions;piece.indices=kept.indices;
}
function routeFor(cuts:LandCuts,id:string|undefined,logical:string):BedCut|undefined {
  return cuts.beds.find(b=>b.id===id)??cuts.beds.find(b=>b.id===logical);
}
/** Solve ordinary at-grade joins against the same grade cones used for route construction.
 * Existing span heights, station levels, doors and route endpoints remain hard constraints. */
function alignSurfaceJoins(cuts:LandCuts,proofs:readonly ComputedCrossing[],base:HeightQuery):void {
  type Context={bed:BedCut;pins:HeightPin[];arcs:number[];targets:{at:XY;height:number;along:number}[]};
  const contexts=new Map<string,Context>();
  const context=(b:BedCut):Context=>{
    let c=contexts.get(b.id);if(c)return c;
    const arcs=[0];for(let i=1;i<b.points.length;i++)arcs.push(arcs[i-1]!+distance(plan(b.points[i-1]!),plan(b.points[i]!)));
    const pins:HeightPin[]=[{xy:plan(b.points[0]!),height:b.points[0]![1],reason:'fixed start'},{xy:plan(b.points.at(-1)!),height:b.points.at(-1)![1],reason:'fixed finish'}];
    for(const row of proofs)if(row.resolution==='threshold'&&Math.abs(row.heightA-row.heightB)<=.5&&[row.sourceA??row.a,row.sourceB??row.b].includes(b.id))pins.push({xy:row.at,height:nearestOnPath(row.at,b.points).at[1],reason:'existing connected junction'});
    b.points.forEach(p=>{if(b.terrainExclusions?.some(e=>distance(plan(p),e.at)<=e.radius))pins.push({xy:plan(p),height:p[1],reason:'structure profile'});});
    for(const pad of cuts.pads.filter(p=>p.serviceBedId===b.id)){const at=pad.door??pad.centre,hit=nearestOnPath(plan(at),b.points);if(hit.distance<Math.max(5,pad.margin+b.width))pins.push({xy:plan(hit.at),height:hit.at[1],reason:pad.id});}
    c={bed:b,pins,arcs,targets:[]};contexts.set(b.id,c);return c;
  };
  const range=(b:BedCut,at:XY):[number,number]=>{
    const hit=nearestOnPath(at,b.points);if(!b.terrainCut||!['road','walk','trail','skate','boardwalk'].includes(b.kind))return [hit.at[1],hit.at[1]];
    const c=context(b);let lo=-Infinity,hi=Infinity;
    for(const pin of c.pins){const d=Math.abs(nearestOnPath(pin.xy,b.points).along-hit.along)*Math.min(.12,b.maxGrade);lo=Math.max(lo,pin.height-d);hi=Math.min(hi,pin.height+d);}
    return [lo,hi];
  };
  for(const row of proofs.filter(p=>p.resolution==='threshold'&&Math.abs(p.heightA-p.heightB)>.01)){
    const a=routeFor(cuts,row.sourceA,row.a),b=routeFor(cuts,row.sourceB,row.b);if(!a||!b||![a,b].every(b=>['road','walk','trail','skate','boardwalk'].includes(b.kind)))continue;
    const ra=range(a,row.at),rb=range(b,row.at),lo=Math.max(ra[0],rb[0]),hi=Math.min(ra[1],rb[1]);if(lo>hi)continue;
    const preferred=a.kind==='road'?row.heightA:b.kind==='road'?row.heightB:(row.heightA+row.heightB)/2,h=clamp(preferred,lo,hi);
    for(const bed of [a,b])if(bed.terrainCut){const c=context(bed),hit=nearestOnPath(row.at,bed.points);c.pins.push({xy:row.at,height:h,reason:row.id});c.targets.push({at:row.at,height:h,along:hit.along});}
  }
  const markerPositions=cuts.pads.filter(p=>p.kind==='threshold').map(p=>plan(p.centre));
  for(const c of contexts.values()){
    if(!c.targets.length)continue;
    const points=[...c.bed.points.map((p,i)=>({at:plan(p),along:c.arcs[i]!})),...c.targets,...c.pins.map(p=>({at:p.xy,along:nearestOnPath(p.xy,c.bed.points).along}))].sort((a,b)=>a.along-b.along).filter((v,i,all)=>!i||distance(v.at,all[i-1]!.at)>.001).map(p=>p.at);
    const old=c.bed.points,diagnostics:LandCuts['diagnostics']=[],next=gradeRoute(c.bed.id,points,(x,z)=>nearestOnPath([x,z],old).at[1],Math.min(.12,c.bed.maxGrade),c.pins,diagnostics);
    if(maxGrade(next)>Math.min(.12,c.bed.maxGrade)+.00001)continue;
    c.bed.points=next;
    const prefixes=['bed','surface','kerbs','edges','retaining','shoulders'].map(s=>`${c.bed.id}.${s}`);
    cuts.solids=cuts.solids.filter(s=>!prefixes.some(prefix=>s.id===prefix||s.id.startsWith(`${prefix}.`)));
    emitBedGeometry(c.bed,cuts,base,markerPositions);
  }
}
/** Called once after C measures logical routes, before A applies the final terrain cuts. */
export function resolveComputedCrossings(cuts:LandCuts,proofs:readonly ComputedCrossing[],base:HeightQuery):void {
  alignSurfaceJoins(cuts,proofs,base);
  for(const row of proofs){
    if(row.kind==='waterConfluence'||row.kind==='modeTransfer')continue;
    if(row.resolution==='threshold'&&row.built&&row.clearancePass)continue;
    const a=routeFor(cuts,row.sourceA,row.a),b=routeFor(cuts,row.sourceB,row.b),heightA=a?nearestOnPath(row.at,a.points).at[1]:row.heightA,heightB=b?nearestOnPath(row.at,b.points).at[1]:row.heightB,difference=Math.abs(heightA-heightB);
    const wet=[row.sourceA??row.a,row.sourceB??row.b].some(id=>id==='DEEP_RUN'||cuts.waters.some(w=>w.id===id&&w.kind!=='dry'));
    if(row.resolution==='threshold'&&wet){
      cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:'A land or rail route intersects open water without a separated deck or named boarding interface; no dry pad was placed in the channel',at:row.at,measured:difference});continue;
    }
    if(row.resolution==='threshold'&&difference<=.5){
      if(!a&&!b)continue; // A confluence is one water surface, never a dry threshold pad.
      const height=(heightA+heightB)/2,width=Math.max(6,a?.width??0,b?.width??0)+2;
      let pad=cuts.pads.find(p=>p.kind==='threshold'&&distance(plan(p.centre),row.at)<3&&Math.abs(p.centre[1]-height)<.5);
      if(!pad)pad=addFlatPad(cuts,`crossing.${row.id}`,'threshold',row.at,height,[width,width]);
      const markerId=`${pad.id}.marker`;if(!cuts.solids.some(s=>s.id===markerId)){
        const marker=solid(markerId,'threshold','stone','marker',[row.a,row.b],districtAt(...row.at));box(marker,row.at,height+.025,[2,.6],height-.05);cuts.solids.push(marker);
      }
      const footCaveJoin=[a,b].some(b=>b?.kind==='cave')&&[a,b].every(b=>!b||!['rail','cable'].includes(b.kind)&&b.id!=='underground.throat');
      for(const piece of cuts.solids)if((piece.role==='wall'||piece.role==='rail')&&(['kerb','parapet','handrail','retainingWall'].includes(piece.kind)||footCaveJoin&&['tunnel','cavern'].includes(piece.kind)))clipEdgePrisms(piece,row.at,Math.max(8,width*.7),height);
      continue;
    }
    if(row.resolution==='threshold'){
      cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:'The registered at-grade junction has incompatible heights; its fixed grades were preserved',at:row.at,measured:difference,required:.5});continue;
    }
    const upper=heightA>=heightB?a:b,lower=heightA>=heightB?b:a,upperHeight=Math.max(heightA,heightB);
    // Cable load paths and underground linings are already built by their specialised modules.
    if(!upper||upper.kind==='cable'||upper.kind==='cave'||upper.kind==='rail'||lower?.kind==='cave'||lower?.kind==='rail')continue;
    const supported=cuts.solids.some(s=>s.role==='support'&&s.bedIds.includes(upper.id)&&s.positions.some((_,i)=>i%3===0&&distance([s.positions[i]!,s.positions[i+2]!],row.at)<32));
    if(supported&&row.clearancePass)continue;
    if(difference<row.requiredClearance+.6){
      cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:'The crossing cannot fit a thick deck plus lower-route clearance without regrading',at:row.at,measured:difference,required:row.requiredClearance+.6});continue;
    }
    const centre=nearestOnPath(row.at,upper.points),half=Math.max(16,(lower?.width??8)+6),prefix=`crossing.${row.id}`;
    if(cuts.solids.some(s=>s.id===`${prefix}.deck`))continue;
    const deck=solid(`${prefix}.deck`,'bridge',upper.surface,'deck',[upper.id],districtAt(...row.at)),supports=solid(`${prefix}.supports`,'pier','stone','support',[upper.id],deck.districtId),rails=solid(`${prefix}.rails`,'handrail','metal','rail',[upper.id],deck.districtId);
    const distances=[0];for(let i=1;i<upper.points.length;i++)distances.push(distances[i-1]!+distance(plan(upper.points[i-1]!),plan(upper.points[i]!)));
    let previous:XYZ|undefined;
    for(let i=0;i<upper.points.length;i++){
      const p=upper.points[i]!;if(Math.abs(distances[i]!-centre.along)>half+5)continue;
      if(previous){slab(deck,previous,p,upper.width+upper.shoulder*2,.6);for(const side of [-1,1])slab(rails,previous,p,.09,.09,side*(upper.width/2+upper.shoulder),1.05);}
      if(Math.abs(distances[i]!-centre.along)>half-6){
        const next=upper.points[Math.min(i+1,upper.points.length-1)]!,dx=next[0]-p[0],dz=next[2]-p[2],len=Math.hypot(dx,dz)||1;
        for(const side of [-1,1]){const xy:XY=[p[0]-dz/len*side*(upper.width/2+.4),p[2]+dx/len*side*(upper.width/2+.4)],ground=Math.min(base(...xy),p[1]-.8);box(supports,xy,p[1]-.5,[.7,.7],ground-.25);box(supports,xy,ground+.3,[1.5,1.5],ground-.25);}
      }
      previous=p;
    }
    if(!deck.indices.length||!supports.indices.length){cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:'The crossing lies too close to a route endpoint for a supported span',at:row.at});continue;}
    cuts.solids.push(deck,supports,rails);upper.structureIds.push(prefix);(upper.terrainExclusions??=[]).push({at:row.at,radius:half+5});
    cuts.diagnostics.push({id:`junction.${row.id}`,severity:'info',message:`Supported crossing at existing upper bed height ${upperHeight.toFixed(2)} eu`,at:row.at,measured:difference,required:row.requiredClearance+.6});
  }
  cuts.solids=cuts.solids.filter(s=>s.indices.length>0);
}
