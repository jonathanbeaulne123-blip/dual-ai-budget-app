import type { BedCut, HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { addFlatPad } from './profiles';
import { box, distance, districtAt, nearestOnPath, plan, slab, solid } from '../structures/mesh';

export interface ComputedCrossing {
  id:string;a:string;b:string;sourceA?:string;sourceB?:string;at:XY;heightA:number;heightB:number;
  resolution:'threshold'|'over'|'under';requiredClearance:number;built?:boolean;clearancePass?:boolean;
}
function clipEdgePrisms(piece:StructureSolid,at:XY,radius:number,height:number):void {
  const positions:number[]=[],indices:number[]=[];
  for(let vertex=0;vertex<piece.positions.length/3;vertex+=8){
    let x=0,z=0,lo=Infinity,hi=-Infinity;
    for(let k=0;k<8;k++){x+=piece.positions[(vertex+k)*3]!/8;z+=piece.positions[(vertex+k)*3+2]!/8;lo=Math.min(lo,piece.positions[(vertex+k)*3+1]!);hi=Math.max(hi,piece.positions[(vertex+k)*3+1]!);}
    // A higher crossing's parapet remains intact; only the intersecting edge gets a gap.
    if(distance([x,z],at)<radius&&lo<height+1.3&&hi>height-.6)continue;
    const offset=positions.length/3;positions.push(...piece.positions.slice(vertex*3,(vertex+8)*3));indices.push(...piece.indices.slice(vertex/8*36,vertex/8*36+36).map(i=>i-vertex+offset));
  }
  piece.positions=positions;piece.indices=indices;
}
function routeFor(cuts:LandCuts,id:string|undefined,logical:string):BedCut|undefined {
  return cuts.beds.find(b=>b.id===id)??cuts.beds.find(b=>b.id===logical);
}
/** Called once after C measures logical routes, before A applies the final terrain cuts. */
export function resolveComputedCrossings(cuts:LandCuts,proofs:readonly ComputedCrossing[],base:HeightQuery):void {
  for(const row of proofs){
    if(row.resolution==='threshold'&&row.built&&row.clearancePass)continue;
    const a=routeFor(cuts,row.sourceA,row.a),b=routeFor(cuts,row.sourceB,row.b),difference=Math.abs(row.heightA-row.heightB);
    if(row.resolution==='threshold'&&difference<=.5){
      const height=(row.heightA+row.heightB)/2,width=Math.max(6,a?.width??0,b?.width??0)+2;
      let pad=cuts.pads.find(p=>p.kind==='threshold'&&distance(plan(p.centre),row.at)<3&&Math.abs(p.centre[1]-height)<.5);
      if(!pad)pad=addFlatPad(cuts,`crossing.${row.id}`,'threshold',row.at,height,[width,width]);
      const markerId=`${pad.id}.marker`;if(!cuts.solids.some(s=>s.id===markerId)){
        const marker=solid(markerId,'threshold','stone','marker',[row.a,row.b],districtAt(...row.at));box(marker,row.at,height+.025,[2,.6],height-.05);cuts.solids.push(marker);
      }
      for(const piece of cuts.solids)if((piece.role==='wall'||piece.role==='rail')&&piece.bedIds.some(id=>[row.a,row.b,a?.id,b?.id].includes(id))&&['kerb','parapet','handrail','retainingWall'].includes(piece.kind))clipEdgePrisms(piece,row.at,width*.7,height);
      continue;
    }
    if(row.resolution==='threshold'){
      cuts.diagnostics.push({id:`junction.${row.id}`,severity:'conflict',message:'The registered at-grade junction has incompatible heights; its fixed grades were preserved',at:row.at,measured:difference,required:.5});continue;
    }
    const upper=row.heightA>=row.heightB?a:b,lower=row.heightA>=row.heightB?b:a,upperHeight=Math.max(row.heightA,row.heightB);
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
