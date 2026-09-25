/** The glass dam's parts, the reservoir shore and the Kitty reserve chambers beside it. */
import {DAM,RESERVOIR_BOWL,RESERVOIR_LEVEL_MAX,BASIN} from './places.ts';
import {baseHeight} from './terrainBase.ts';
import type {Point3} from './math.ts';

const onArc=(a:number,radius:number,y:number):Point3=>[DAM.centre[0]+Math.sin(a)*radius,y,DAM.centre[2]+Math.cos(a)*radius];
/** Curved glass between stone abutments, its face toward the town square; an apron below and a crest promenade. */
export const DAM_PARTS={
  centre:DAM.centre,crest:DAM.crest,foot:DAM.foot,radius:DAM.radius,halfAngle:DAM.halfAngle,
  /** Crest line, west to east. */
  arc:Array.from({length:25},(_,k)=>onArc(-DAM.halfAngle+2*DAM.halfAngle*k/24,DAM.radius,DAM.crest)),
  /** Unit horizontal direction the glass faces (toward town). */
  face:DAM.face,
  abutments:[-1,1].map(side=>({side:side<0?'west' as const:'east' as const,at:onArc(side*DAM.halfAngle*1.04,DAM.radius,(DAM.crest+DAM.foot)/2),size:[7,DAM.crest-DAM.foot+4,9] as Point3})),
  apron:{at:[DAM.centre[0],DAM.foot,DAM.centre[2]+DAM.radius+6] as Point3,half:[10,5] as const},
  promenade:Array.from({length:13},(_,k)=>onArc(-DAM.halfAngle+2*DAM.halfAngle*k/12,DAM.radius+1.2,DAM.crest)),
};
/** Reservoir water: level range and the shoreline at full level, traced on the ground. */
export const RESERVOIR={bottom:BASIN.bottom,level:RESERVOIR_LEVEL_MAX,shore:Array.from({length:48},(_,k)=>{
  const a=k/48*Math.PI*2,cx=RESERVOIR_BOWL.at[0],cz=RESERVOIR_BOWL.at[1];
  let r=2;while(r<60&&baseHeight(cx+Math.sin(a)*r,cz+Math.cos(a)*r)<RESERVOIR_LEVEL_MAX)r+=.5;
  return [cx+Math.sin(a)*r,RESERVOIR_LEVEL_MAX,cz+Math.cos(a)*r] as Point3;
})};
/** Kitty reserve chambers: stepped glass cisterns on the west abutment slope, adjoining the basin. */
export const KITTY_CHAMBERS=([[-20,-247],[-25,-254]] as const).map(([x,z],i)=>({id:`kitty-${i+1}`,at:[x,Math.round(baseHeight(x,z)*2)/2,z] as Point3,radius:3.4,depth:7}));
