import type {ThemeId} from '../../theme/scenes.ts';
import {DISTRICTS,OVERLOOKS,type Point3} from './definition.ts';
import {landHeight as groundHeightAt} from './art/land.ts';
import {findSpot} from './art/spots.ts';

export type MountainInteractionKind = 'bench'|'gate'|'bell'|'overlook'|'wildlife';
export type MountainInteraction = {id:string;kind:MountainInteractionKind;district:string;label:string;at:Point3;words:string};
const district=(id:string)=>DISTRICTS.find(d=>d.id===id)!;
/**
 * Interaction spots are authored as a bearing and a distance from the district's heart;
 * each resolves to the nearest level ground clear of every road, path and building, so a
 * bench or a gate never stands in a walk or on a bank (see art/spots.ts).
 */
function detail(id:string,kind:MountainInteractionKind,area:string,label:string,bearing:number,radius:number,words:string,opts:{near?:number;half?:number}={}):MountainInteraction {
  const d=district(area),[x,z]=findSpot(d.at[0],d.at[2],bearing,radius,opts.half??1.1,{near:opts.near});
  return {id:`mountain:life:${id}`,kind,district:area,label,at:[x,groundHeightAt(x,z),z],words};
}
/** An overlook interaction stands at its authored overlook, a step toward the view. */
function lookout(id:string,area:string,label:string,overlook:string,words:string):MountainInteraction {
  const o=OVERLOOKS.find(v=>v.id===overlook),d=district(area);
  if(!o)return detail(id,'overlook',area,label,0,10,words);
  const [x,z]=findSpot(o.at[0]+Math.sin(o.facing)*1.2,o.at[2]+Math.cos(o.facing)*1.2,o.facing+Math.PI/2,1.8,.5,{level:.8,clear:-.2});void d;
  return {id:`mountain:life:${id}`,kind:'overlook',district:area,label,at:[x,groundHeightAt(x,z),z],words};
}
/** Same explicit actions for a raycast, keyboard button, touch button or reading edition. */
export const MOUNTAIN_INTERACTIONS:readonly MountainInteraction[] = [
  ...DISTRICTS.map(d=>detail(`bench-${d.id}`,'bench',d.id,`${d.name} bench`,Math.atan2(-d.at[0],-d.at[2]),d.radius*.8,`${d.name}: take a moment beside the path.`,{half:1.6})),
  detail('garden-gate','gate','hearth','Kitchen garden gate',-1.9,11,'A little garden gate swings beside the open path.',{near:1.5,half:1.3}),
  detail('orchard-gate','gate','orchard','Orchard wicket',1.2,12,'The orchard wicket opens onto clover.',{near:1.5,half:1.3}),
  detail('summit-bell','bell','summit','Summit bell',.9,9,'A small summit bell. Its ring is optional; the moment is here in words too.',{half:.8}),
  lookout('woods-view','library','Woodland overlook','overlook:gorge-balcony','Birches frame the gorge; the lower road curves toward the harbour.'),
  detail('dam-view','overlook','reservoir','Reservoir overlook',-1.6,12,'The glass dam and its neighbouring reserve chamber stand above the river.',{half:.6}),
  lookout('summit-view','summit','Harbour panorama','overlook:summit','From the summit, the terraces step down to the town and sea.'),
  detail('orchard-birds','wildlife','orchard','Watch the orchard birds',2.4,15,'Two small birds share the orchard verge. They keep their own quiet rhythm.',{half:.8}),
  detail('meadow-moths','wildlife','glasshouse','Watch the meadow moths',-.9,16,'A few pale moths rest among the meadow flowers.',{half:.8}),
  detail('summit-gull','wildlife','summit','Watch the coastal gull',-2.2,11,'A gull rests on a summit stone, looking out toward the sea.',{half:.8}),
];
export type MountainInteractionState = {seated:string|null;openGates:readonly string[];overlook:string|null;bellRings:number};
export const initialMountainInteractionState = ():MountainInteractionState => ({seated:null,openGates:[],overlook:null,bellRings:0});
export type MountainInteractionResult = {state:MountainInteractionState;words:string;cue:'bell'|null;at:Point3;kind:MountainInteractionKind};
export function mountainInteractionLabel(item:MountainInteraction,state:MountainInteractionState):string {
  if(item.kind==='bench')return `${state.seated===item.id?'Leave':'Rest at'} ${item.label}`;
  if(item.kind==='gate')return `${state.openGates.includes(item.id)?'Close':'Open'} ${item.label}`;
  if(item.kind==='bell')return `Ring ${item.label}`;
  return item.label;
}
export function activateMountainInteraction(id:string,state:MountainInteractionState,theme:ThemeId,quiet=false):MountainInteractionResult|null {
  const item=MOUNTAIN_INTERACTIONS.find(i=>i.id===id);if(!item)return null;
  let next=state,words=item.words,cue:'bell'|null=null;
  if(item.kind==='bench') {const seated=state.seated===id?null:id;next={...state,seated,overlook:null};words=seated?`Resting at ${item.label}. Leave whenever you like.`:`Leaving the quiet pause at ${item.label}.`;}
  if(item.kind==='gate') {const open=!state.openGates.includes(id);next={...state,openGates:open?[...state.openGates,id]:state.openGates.filter(g=>g!==id)};words=`${item.label} is ${open?'open':'closed'}. The walking path stays clear.`;}
  if(item.kind==='bell') {next={...state,bellRings:state.bellRings+1};cue=quiet?null:'bell';words=quiet?'The summit bell is still in quiet mode. A quiet moment above the harbour.':theme==='taylor'?'The little brass bell swings beneath its ribbon.':theme==='newfoundland'?'The harbour bell swings from its weathered timber.':'The summit bell swings beneath the copper canopy.';}
  if(item.kind==='overlook')next={...state,seated:null,overlook:id};
  return {state:next,words,cue,at:item.at,kind:item.kind};
}

/** Bounded ambient motion. Quiet scenes retain resting wildlife; no rewards, distress or chase. */
export function mountainWildlifePose(kind:'birds'|'moths'|'gull',index:number,t:number,quiet:boolean) {
  if(quiet)return {x:0,y:0,z:0,wing:0};
  const phase=t*(kind==='moths'?.45:.12)+index*2.4;
  return kind==='moths'?{x:Math.sin(phase)*.35,y:.16+Math.sin(phase*.8)*.12,z:Math.cos(phase)*.2,wing:Math.sin(t*3+index)*.25}
    :{x:0,y:Math.max(0,Math.sin(phase))*.035,z:0,wing:kind==='gull'?Math.sin(phase)*.04:0};
}
