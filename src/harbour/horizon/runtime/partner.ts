import type {PlaceWalkSource} from '../../scene/place.ts';
/** Presence samples use epoch milliseconds, unlike animation frame timestamps. */
export function horizonPartnerPose(source:PlaceWalkSource|null|undefined,now=Date.now()){
  const pose=source?.pose(now);
  return pose&&pose.opacity>0?pose:null;
}
