import type {HouseBodyReturn} from '../../../house/navigation.ts';
import {HORIZON_GEOGRAPHY,HORIZON_PRESENCE_WORLD} from '../../../worldGeography.ts';
import {nearestPathNode,type HorizonPathGraph} from '../world/pathGraph.ts';
/** What the runtime's collision says about a stored body: a walkable floor within a step of it, not blocked, not under water. */
export type HorizonStandCheck=(x:number,z:number,y:number)=>{standY:number}|null;
/** The largest height correction a same-revision restore accepts before it moves to a path node (one body height). */
export const HORIZON_RESTORE_TOLERANCE=1.6;
/**
 * A geometry change returns to a real graph node, never an obsolete buried coordinate. The revision
 * `horizon-geo-1` is kept across Stage A (a handoff boundary), so a same-revision body is VALIDATED against
 * the ground it lands on (R1-91): it keeps its place only where the collision has a walkable, dry, unblocked
 * floor within HORIZON_RESTORE_TOLERANCE of the stored height; otherwise it snaps to the nearest path node.
 */
export function restoreHorizonPosition(saved:HouseBodyReturn,graph:HorizonPathGraph,ground:(x:number,z:number)=>number,stand?:HorizonStandCheck):HouseBodyReturn{
  if(saved.geo===HORIZON_GEOGRAPHY&&saved.world===HORIZON_PRESENCE_WORLD){
    const y=saved.y??ground(saved.x,saved.z);
    if(!stand)return{...saved,y};
    const at=stand(saved.x,saved.z,y);
    if(at&&Math.abs(at.standY-y)<=HORIZON_RESTORE_TOLERANCE)return{...saved,y:at.standY};
  }
  const node=nearestPathNode(graph,[saved.x,saved.y??ground(saved.x,saved.z),saved.z]);
  if(!node)throw new Error('The Horizon has no path node for a saved-position migration.');
  return{world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:node.at[0],y:node.at[1],z:node.at[2],yaw:node.facing??saved.yaw};
}
