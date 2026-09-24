import type {ThemeId} from '../../theme/scenes.ts';
import {DISTRICTS,type Point3} from './definition.ts';

export type MountainInteractionKind = 'bench'|'gate'|'bell'|'overlook'|'wildlife';
export type MountainInteraction = {id:string;kind:MountainInteractionKind;district:string;label:string;at:Point3;words:string};
const district=(id:string)=>DISTRICTS.find(d=>d.id===id)!;
function detail(id:string,kind:MountainInteractionKind,area:string,label:string,offset:Point3,words:string):MountainInteraction {
  const at=district(area).at;
  return {id:`mountain:life:${id}`,kind,district:area,label,at:[at[0]+offset[0],at[1]+offset[1],at[2]+offset[2]],words};
}
/** Same explicit actions for a raycast, keyboard button, touch button or reading edition. */
export const MOUNTAIN_INTERACTIONS:readonly MountainInteraction[] = [
  ...DISTRICTS.map(d=>detail(`bench-${d.id}`,'bench',d.id,`${d.name} bench`,[-6,0,9],`${d.name}: take a moment beside the path.`)),
  detail('garden-gate','gate','hearth','Kitchen garden gate',[-9,0,5],'A little garden gate swings beside the open path.'),
  detail('orchard-gate','gate','orchard','Orchard wicket',[9,0,6],'The orchard wicket opens onto clover.'),
  detail('summit-bell','bell','summit','Summit bell',[10,0,7],'A small summit bell. Its ring is optional; the moment is here in words too.'),
  detail('woods-view','overlook','library','Woodland overlook',[-9,0,10],'Birches frame the gorge; the lower road curves toward the harbour.'),
  detail('dam-view','overlook','reservoir','Reservoir overlook',[-9,0,10],'The glass dam and its neighbouring reserve chamber stand above the river.'),
  detail('summit-view','overlook','summit','Harbour panorama',[-9,0,10],'From the summit, the terraces step down to the town and sea.'),
  detail('orchard-birds','wildlife','orchard','Watch the orchard birds',[12,0,9],'Two small birds share the orchard verge. They keep their own quiet rhythm.'),
  detail('meadow-moths','wildlife','glasshouse','Watch the meadow moths',[-12,0,10],'A few pale moths rest among the meadow flowers.'),
  detail('summit-gull','wildlife','summit','Watch the coastal gull',[12,0,-8],'A gull rests on a summit stone, looking out toward the sea.'),
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
