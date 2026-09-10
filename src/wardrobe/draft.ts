import { decodeLook,validateLookForWear, type LookV1 } from '../core/herculesCompanionContracts.ts';
import { COZY_LOOK,FITTING_MANIFEST } from './catalogue.ts';
export function fittingDraftKey(environment:string,householdId:string,memberId:string){return `hearth:hercules-fitting:v1:${encodeURIComponent(environment)}:${encodeURIComponent(householdId)}:${encodeURIComponent(memberId)}`;}
export function parseFittingDraft(raw:string|null):LookV1|null{try{if(!raw||raw.length>8000)return null;const look=decodeLook(JSON.parse(raw));validateLookForWear(look,FITTING_MANIFEST);return look;}catch{return null;}}
export function loadFittingDraft(storage:Pick<Storage,'getItem'>|null,key:string):LookV1{try{return parseFittingDraft(storage?.getItem(key)??null)??structuredClone(COZY_LOOK);}catch{return structuredClone(COZY_LOOK);}}
export function saveFittingDraft(storage:Pick<Storage,'setItem'>|null,key:string,look:LookV1):boolean{try{validateLookForWear(look,FITTING_MANIFEST);if(!storage)return false;storage.setItem(key,JSON.stringify(look));return true;}catch{return false;}}
export type FittingHistory={past:LookV1[];present:LookV1;future:LookV1[]};
export function fitEdit(state:FittingHistory,next:LookV1):FittingHistory{validateLookForWear(next,FITTING_MANIFEST);if(JSON.stringify(next)===JSON.stringify(state.present))return state;return {past:[...state.past,state.present].slice(-30),present:next,future:[]};}
export function fitUndo(state:FittingHistory):FittingHistory{return state.past.length?{past:state.past.slice(0,-1),present:state.past.at(-1)!,future:[state.present,...state.future].slice(0,30)}:state;}
export function fitRedo(state:FittingHistory):FittingHistory{return state.future.length?{past:[...state.past,state.present].slice(-30),present:state.future[0]!,future:state.future.slice(1)}:state;}
