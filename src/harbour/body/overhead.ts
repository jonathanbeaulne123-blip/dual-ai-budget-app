/**
 * What is overhead — shared by the walker, the skater and anything else that
 * asks "can I pass under this?". Kept apart from `geography.ts` so the skate
 * field can read it without pulling in the terrain module (which imports the
 * skate spots back: an import cycle).
 * CONTRACT: `worldCeilingAt` (mountain/surfaces.ts).
 */
import {worldCeilingAt} from '../mountain/surfaces.ts';

/**
 * A deck lower than this above the feet is not somewhere a body can pass
 * beneath — it is a ramp or path mouth, or a ledge's side — so it is never a
 * ceiling (the invisible dead-stop the race met at every branch and footpath
 * mouth). A real overhead passage returns its underside.
 */
export const OVERHEAD_MIN = 1.7;
export function overheadAt(x:number,z:number,feet:number,radius=.2):number{
  let ceiling=worldCeilingAt(x,z,feet,radius);
  // Undersides are deck − 0.28: a deck within OVERHEAD_MIN of the feet is a mouth, not a roof.
  for(let guard=0;guard<4&&Number.isFinite(ceiling)&&ceiling+.28<feet+OVERHEAD_MIN;guard++){
    ceiling=worldCeilingAt(x,z,ceiling+.29,radius);
  }
  return ceiling;
}
