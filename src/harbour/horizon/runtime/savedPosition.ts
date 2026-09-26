import type {HouseBodyReturn} from '../../../house/navigation.ts';
import {HORIZON_GEOGRAPHY,HORIZON_PRESENCE_WORLD} from '../../../worldGeography.ts';
import {nearestPathNode,type HorizonPathGraph} from '../world/pathGraph.ts';
/** A geometry change returns to a real graph node, never an obsolete buried coordinate. */
export function restoreHorizonPosition(saved:HouseBodyReturn,graph:HorizonPathGraph,ground:(x:number,z:number)=>number):HouseBodyReturn{
  if(saved.geo===HORIZON_GEOGRAPHY&&saved.world===HORIZON_PRESENCE_WORLD)return{...saved,y:saved.y??ground(saved.x,saved.z)};
  const node=nearestPathNode(graph,[saved.x,saved.y??ground(saved.x,saved.z),saved.z]);
  if(!node)throw new Error('The Horizon has no path node for a saved-position migration.');
  return{world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:node.at[0],y:node.at[1],z:node.at[2],yaw:node.facing??saved.yaw};
}
