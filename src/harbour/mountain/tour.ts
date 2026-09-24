import type {Pose} from '../scene/place.ts';
import type {Composition} from '../camera/poses.ts';
import {aimPose,damViewPose,summitViewPose,townArrivalPose,PHONE_ASPECT,DESKTOP_ASPECT,openWorldFov} from '../camera/mountainPoses.ts';
import {CAMERA_DOORS,QUAY,FUND_DOOR,cameraGround,type V3} from '../camera/worldAdapter.ts';

/**
 * Authored viewpoints shared by the ordinary guide and fictional rehearsal.
 *
 * Hearth Mountain v2 (C7, C9): every stop is *derived* from the camera
 * adapter — the arrival is the signature town shot, the water stop stands in
 * front of the dam, the Library and the Glasshouse are framed from in front
 * of their own doors, the summit looks down to the sea, the finish looks back
 * at the quay and the Fund bank's door. `tourPose` gives each stop's phone
 * and desktop compositions; `pose` stays as the desktop one for callers that
 * only know one. The runtime flies between them at a capped speed and
 * pre-streams every district for the length of the tour.
 */
const doorView=(place:string,composition:Composition):Pose=>{
  const door=CAMERA_DOORS[place];
  if(!door)return {target:[0,0,0],r:40,theta:0,phi:1.1};
  const far=composition==='phone'?26:22,eye:V3=[door.at[0]+door.out[0]*far,0,door.at[2]+door.out[1]*far];
  const y=Math.max(door.at[1]+8,cameraGround(eye[0],eye[2])+6);
  return aimPose([eye[0],y,eye[2]],[door.at[0]-door.out[0]*2,door.at[1]+2.6,door.at[2]-door.out[1]*2],far);
};
const finishView=(composition:Composition):Pose=>{
  // From over the water, back at the quay's run-out and the Fund bank's door beyond it.
  const aim:V3=[(QUAY[0]*2+FUND_DOOR[0])/3,1.4,(QUAY[2]*2+FUND_DOOR[2])/3];
  return aimPose([QUAY[0]+4,composition==='phone'?16:13,QUAY[2]+30],aim,40);
};
type Stop={id:string;title:string;words:string;shot:(composition:Composition,aspect:number)=>Pose};
const STOPS=[
  {id:'arrival',title:'A neighbourhood above the harbour',words:'Follow the river uphill: homes, gardens and the shared Fund all belong to the same place.',shot:(c:Composition,a:number)=>townArrivalPose(c,a,openWorldFov(c,a))},
  {id:'water',title:'What the water means',words:'The basin shows accepted operating money. Kitty reserves occupy their own chamber. Open the Fund to review a contribution; only confirmation changes accepted water.',shot:(c:Composition,a:number)=>damViewPose(c,a,openWorldFov(c,a))},
  {id:'library',title:'A working destination',words:'The Library keeps its existing books. Open it, use a tool, and return to the same neighbourhood.',shot:(c:Composition)=>doorView('library',c)},
  {id:'garden',title:'The same garden through time',words:'Shared work supports growth. Verified sustained deficits can affect peripheral details. Missing evidence freezes the picture; roads and homes remain usable.',shot:(c:Composition)=>doorView('glasshouse',c)},
  {id:'summit',title:'Summit to sea',words:'Start the downhill course when you are ready. The broad road is the main line; the architecture offers optional skill branches.',shot:(c:Composition)=>summitViewPose(c)},
  {id:'finish',title:'Back to the town square',words:'The waterfront gives you room to stop. Your financial tools are always available, without finishing a race.',shot:(c:Composition)=>finishView(c)},
] as const satisfies readonly Stop[];
export const MOUNTAIN_TOUR=STOPS.map(s=>({id:s.id,title:s.title,words:s.words,pose:s.shot('desktop',DESKTOP_ASPECT)})) as readonly {id:typeof STOPS[number]['id'];title:string;words:string;pose:Pose}[];
export type MountainTourId=typeof STOPS[number]['id'];
/** A tour stop's pose for this stage. */
export function tourPose(id:string,composition:Composition,aspect=composition==='phone'?PHONE_ASPECT:DESKTOP_ASPECT):Pose|null{
  const stop=STOPS.find(s=>s.id===id);return stop?stop.shot(composition,aspect):null;
}
