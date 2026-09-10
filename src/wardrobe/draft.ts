import { decodeLook, type LookV1 } from '../core/herculesCompanionContracts.ts';
import { COZY_LOOK } from './catalogue.ts';
export function fittingDraftKey(environment:string,householdId:string,memberId:string){return `hearth:hercules-fitting:v1:${encodeURIComponent(environment)}:${encodeURIComponent(householdId)}:${encodeURIComponent(memberId)}`;}
export function parseFittingDraft(raw:string|null):LookV1|null{try{if(!raw||raw.length>8000)return null;const look=decodeLook(JSON.parse(raw));return look;}catch{return null;}}
export function loadFittingDraft(storage:Pick<Storage,'getItem'>|null,key:string,initial:LookV1=COZY_LOOK):LookV1{try{return parseFittingDraft(storage?.getItem(key)??null)??structuredClone(initial);}catch{return structuredClone(initial);}}
export function saveFittingDraft(storage:Pick<Storage,'setItem'>|null,key:string,look:LookV1):boolean{try{decodeLook(look);if(!storage)return false;storage.setItem(key,JSON.stringify(look));return true;}catch{return false;}}
export type FittingHistory={past:LookV1[];present:LookV1;future:LookV1[]};
export function fitEdit(state:FittingHistory,next:LookV1):FittingHistory{decodeLook(next);if(JSON.stringify(next)===JSON.stringify(state.present))return state;return {past:[...state.past,state.present].slice(-30),present:next,future:[]};}
export function fitUndo(state:FittingHistory):FittingHistory{return state.past.length?{past:state.past.slice(0,-1),present:state.past.at(-1)!,future:[state.present,...state.future].slice(0,30)}:state;}
export function fitRedo(state:FittingHistory):FittingHistory{return state.future.length?{past:[...state.past,state.present].slice(-30),present:state.future[0]!,future:state.future.slice(1)}:state;}
