import type { HeightQuery, LandCuts, StructureSolid, XY } from '../interfaces';

export interface FoundationSettlement { id:string; part:number; at:XY; originalFoot:number; settledFoot:number; extension:number }
/** Run on authored closed prisms after terrain export, before world mesh compaction.
 * Only the lowest footing at each column is extended; decks, caps and cables keep their fixed elevations. */
export function settleFoundations(cuts:LandCuts,finalHeight:HeightQuery):FoundationSettlement[] {
  const result:FoundationSettlement[]=[];
  for(const solid of cuts.solids.filter(s=>s.role==='support'&&!s.id.endsWith('.posts'))){
    const parts:{offset:number;x:number;z:number;bottom:number}[]=[];
    for(let offset=0;offset+23<solid.positions.length;offset+=24){let x=0,z=0,bottom=Infinity;for(let i=0;i<8;i++){x+=solid.positions[offset+i*3]!/8;z+=solid.positions[offset+i*3+2]!/8;bottom=Math.min(bottom,solid.positions[offset+i*3+1]!);}parts.push({offset,x,z,bottom});}
    for(const part of parts){
      if(parts.some(other=>other.bottom<part.bottom-.001&&Math.hypot(other.x-part.x,other.z-part.z)<1.5))continue;
      let target=finalHeight(part.x,part.z)-.25;
      for(let i=0;i<8;i++)if(Math.abs(solid.positions[part.offset+i*3+1]!-part.bottom)<.001)target=Math.min(target,finalHeight(solid.positions[part.offset+i*3]!,solid.positions[part.offset+i*3+2]!)-.25);
      if(!Number.isFinite(target)||part.bottom<=target)continue;
      lowerFoot(solid,part.offset,part.bottom,target);
      result.push({id:solid.id,part:part.offset/24,at:[part.x,part.z],originalFoot:part.bottom,settledFoot:target,extension:part.bottom-target});
    }
  }
  if(result.length)cuts.diagnostics.push({id:'structures.foundationSettlement',severity:'info',message:`Extended ${result.length} lowest footings to the final terrain; all upper load paths and deck heights remain fixed`,measured:Math.max(...result.map(p=>p.extension))});
  return result;
}
function lowerFoot(solid:StructureSolid,offset:number,old:number,next:number):void {
  for(let i=0;i<8;i++){const at=offset+i*3+1;if(Math.abs(solid.positions[at]!-old)<.001)solid.positions[at]=next;}
}
