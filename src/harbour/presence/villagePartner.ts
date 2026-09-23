import type {PlaceDressing,PlaceReading,PlaceWalkSource} from '../scene/place.ts';
import {createWalker} from './walker.ts';
import {BODY_HEIGHT} from '../body/obstacles.ts';
import {placeGround} from '../body/places.ts';

/** The village shares the real ephemeral presenter, never a simulated partner. */
export function createVillagePartner(dressing:PlaceDressing,reading:PlaceReading|null){
  const walker=createWalker({tint:dressing.theme==='taylor'?'#be638b':'#cb9770',skin:'#e7c4a2',height:BODY_HEIGHT,groundHeightAt:placeGround('court')});
  walker.group.name='Harbour live partner';walker.setOpacity(0);
  let source:PlaceWalkSource|null=reading?.partner?.walk??null;
  return {group:walker.group,update(next:PlaceReading|null){source=next?.partner?.walk??null;},
    animate(t:number,dt:number,now=Date.now()){
      const pose=source?.pose(now);
      if(!pose||pose.opacity<=0){walker.setOpacity(0);walker.setMoving(false);walker.setAction?.(null,0);walker.setHeight?.(null);return false;}
      walker.setAction?.(pose.act??null,pose.p??0);walker.setHeight?.(pose.y??null);walker.setPose(pose.x,pose.z,pose.yaw);walker.setMoving(pose.moving);walker.setOpacity(pose.opacity);walker.animate(t,dt);return true;
    },dispose(){walker.dispose();}};
}
