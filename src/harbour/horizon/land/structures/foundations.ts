import type { HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { box, mix, prism } from './mesh';

/** Every footing sinks this far below the ground it bears on (STYLE §1.6.3: ≥ 0.2 eu). */
export const FOOTING_SINK = .25;
/** A bearing whose underside is within this gap of the ground rests on it directly (STYLE §1.6.6). */
export const GROUND_CONTACT = .02;

/** Lowest ground under a footprint: the centre and the four corners. */
export function groundUnder(base:HeightQuery,at:XY,size:XY=[0,0],rotation=0):number {
  const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);let low=base(at[0]!,at[1]!);
  for(const [x,z] of [[-1,-1],[-1,1],[1,1],[1,-1]] as const){const dx=x*size[0]!/2,dz=z*size[1]!/2;low=Math.min(low,base(at[0]!+dx*c-dz*s,at[1]!+dx*s+dz*c));}
  return low;
}
export interface PierResult { at:XY; top:number; ground:number; foot:number; height:number }
/** The one place a vertical load path meets the ground: a shaft from the bearing underside
 * down to the ground plus a spread footing, both sunk FOOTING_SINK. Returns nothing drawn when
 * the bearing already rests on the ground. */
export function pier(out:StructureSolid,at:XY,top:number,base:HeightQuery,shaft:XY=[.8,.8],footing?:XY,rotation=0):PierResult {
  // Always drawn: the offline height query is not the final terrain, so a bearing that seems to rest on the ground
  // still gets a short buried footing that settleFoundations carries down if the final ground is lower.
  const spread=footing??[shaft[0]!*2.2,shaft[1]!*2.2] as XY,ground=groundUnder(base,at,spread,rotation),foot=Math.min(ground,top-.3)-FOOTING_SINK;
  box(out,at,top,shaft,foot,rotation);box(out,at,Math.min(top,ground+.3),spread,foot,rotation);
  return {at,top,ground,foot,height:top-foot};
}
/** A strip of wall whose top follows a→b (at the given side offset) and whose foot follows the
 * ground under each corner: a cheek wall, an abutment or a tunnel wall on a falling bank. */
export function wallToGround(out:StructureSolid,a0:XYZ,b0:XYZ,width:number,offset:number,base:HeightQuery,minDepth=.3):void {
  const d0=Math.hypot(b0[0]-a0[0],b0[2]-a0[2]);if(d0<.02)return;
  // Each strip is its own closed prism (a 1 cm joint at either end), so every bay is a separate bearing part.
  const k=.005/d0,a:XYZ=[mix(a0[0],b0[0],k),mix(a0[1],b0[1],k),mix(a0[2],b0[2],k)],b:XYZ=[mix(b0[0],a0[0],k),mix(b0[1],a0[1],k),mix(b0[2],a0[2],k)];
  const d=Math.hypot(b[0]-a[0],b[2]-a[2]),nx=-(b[2]-a[2])/d,nz=(b[0]-a[0])/d;
  const corners=([[a,-1],[a,1],[b,1],[b,-1]] as const).map(([p,side]):XYZ=>[p[0]+nx*(offset+side*width/2),p[1],p[2]+nz*(offset+side*width/2)]);
  prism(out,corners,corners.map(p=>Math.min(p[1]-minDepth,base(p[0],p[2])-FOOTING_SINK)));
}

export interface FoundationSettlement { id:string; part:number; at:XY; originalFoot:number; settledFoot:number; extension:number }
/** Prism kinds whose four foot corners follow the ground independently (walls and slabs on grade). */
const CORNER_KINDS=new Set(['cheekWall','abutment','retainingWall','tunnel','tunnelFooting']);
/** Members that bear on other supports, never directly on the ground. */
const HUNG_KINDS=new Set(['beam','stringer','truss']);
/** A pad slab left floating over lower final terrain becomes a plinth on grade up to this depth. */
const PAD_PLINTH_MAX=6;
/** Run on authored closed prisms after terrain export, before world mesh compaction.
 * Columns: only the lowest footing at each column is extended; decks, caps and cables keep their fixed elevations.
 * Walls, pads and cheek walls: each foot corner is carried down to the final ground under it.
 * Offshore rock: the base ring is carried down to the seabed. Nothing is ever raised. */
export function settleFoundations(cuts:LandCuts,finalHeight:HeightQuery):FoundationSettlement[] {
  const result:FoundationSettlement[]=[],floatingPads:{id:string;at:XY;gap:number}[]=[];
  const underground=new Set(cuts.pads.filter(p=>p.underground).map(p=>`${p.id}.slab`));
  for(const solid of cuts.solids.filter(s=>s.role==='support'&&!HUNG_KINDS.has(s.kind)&&!s.id.endsWith('.posts')&&!CORNER_KINDS.has(s.kind))){
    const parts:{offset:number;x:number;z:number;bottom:number}[]=[];
    for(let offset=0;offset+23<solid.positions.length;offset+=24){let x=0,z=0,bottom=Infinity;for(let i=0;i<8;i++){x+=solid.positions[offset+i*3]!/8;z+=solid.positions[offset+i*3+2]!/8;bottom=Math.min(bottom,solid.positions[offset+i*3+1]!);}parts.push({offset,x,z,bottom});}
    for(const part of parts){
      if(parts.some(other=>other.bottom<part.bottom-.001&&Math.hypot(other.x-part.x,other.z-part.z)<1.5))continue;
      let target=finalHeight(part.x,part.z)-FOOTING_SINK;
      for(let i=0;i<8;i++)if(Math.abs(solid.positions[part.offset+i*3+1]!-part.bottom)<.001)target=Math.min(target,finalHeight(solid.positions[part.offset+i*3]!,solid.positions[part.offset+i*3+2]!)-FOOTING_SINK);
      if(!Number.isFinite(target)||part.bottom<=target)continue;
      lowerFoot(solid,part.offset,part.bottom,target);
      result.push({id:solid.id,part:part.offset/24,at:[part.x,part.z],originalFoot:part.bottom,settledFoot:target,extension:part.bottom-target});
    }
  }
  for(const solid of cuts.solids){
    const pad=solid.kind==='pad'&&solid.role==='floor'&&!underground.has(solid.id);
    if(!(CORNER_KINDS.has(solid.kind)&&(solid.role==='support'||solid.role==='wall'))&&!pad)continue;
    if(solid.positions.length%24!==0)continue;
    for(let offset=0;offset+23<solid.positions.length;offset+=24){
      let x=0,z=0,deepest=0,gap=Infinity;const moves:[number,number][]=[];
      for(let i=0;i<4;i++){
        const at=offset+i*3,px=solid.positions[at]!,y=solid.positions[at+1]!,pz=solid.positions[at+2]!,ground=finalHeight(px,pz),target=ground-FOOTING_SINK;x+=px/4;z+=pz/4;gap=Math.min(gap,y-ground);
        if(Number.isFinite(target)&&y>target+.001){moves.push([at+1,target]);deepest=Math.max(deepest,y-target);}
      }
      if(!moves.length)continue;
      // A pad over the sea or a deep drop is not silently turned into a tower: it is reported.
      if(pad&&(deepest>PAD_PLINTH_MAX||moves.some(([,t])=>t<-FOOTING_SINK))){if(gap>GROUND_CONTACT)floatingPads.push({id:solid.id,at:[x,z],gap});continue;}
      const before=Math.max(...moves.map(([i])=>solid.positions[i]!));
      for(const [i,t] of moves)solid.positions[i]=t;
      result.push({id:solid.id,part:offset/24,at:[x,z],originalFoot:before,settledFoot:Math.min(...moves.map(([,t])=>t)),extension:deepest});
    }
  }
  for(const solid of cuts.solids.filter(s=>s.role==='rock')){
    let low=Infinity;for(let i=1;i<solid.positions.length;i+=3)low=Math.min(low,solid.positions[i]!);
    for(let i=0;i+2<solid.positions.length;i+=3){
      if(Math.abs(solid.positions[i+1]!-low)>.001)continue;
      const target=finalHeight(solid.positions[i]!,solid.positions[i+2]!)-FOOTING_SINK;
      if(!Number.isFinite(target)||solid.positions[i+1]!<=target)continue;
      result.push({id:solid.id,part:i/3,at:[solid.positions[i]!,solid.positions[i+2]!],originalFoot:solid.positions[i+1]!,settledFoot:target,extension:solid.positions[i+1]!-target});
      solid.positions[i+1]=target;
    }
  }
  if(result.length)cuts.diagnostics.push({id:'structures.foundationSettlement',severity:'info',message:`Extended ${result.length} footings, wall feet, pad plinths and rock bases to the final terrain; all upper load paths and deck heights remain fixed`,measured:Math.max(...result.map(p=>p.extension))});
  for(const p of floatingPads)cuts.diagnostics.push({id:`structures.padFloating.${p.id}`,severity:'conflict',message:`Pad slab floats over the final terrain beyond a ${PAD_PLINTH_MAX} eu plinth or over the sea; it needs a supported deck or a regrade`,at:p.at,measured:p.gap,required:GROUND_CONTACT});
  return result;
}
function lowerFoot(solid:StructureSolid,offset:number,old:number,next:number):void {
  for(let i=0;i<8;i++){const at=offset+i*3+1;if(Math.abs(solid.positions[at]!-old)<.001)solid.positions[at]=next;}
}
