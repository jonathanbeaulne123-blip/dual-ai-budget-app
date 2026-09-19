import {captureRoomFurniture,decodeRoomFurniture,type RoomFurnitureLayout} from './roomFurniture.ts';
import type {Household} from '../core/types.ts';
import {canonical} from '../ledgerSync/patch.ts';
import {decodeHearthside,decodeDesignReference,decodePlacement,memoryKeptByEveryone,HEARTHSIDE_ROOMS,object,identifier,revisionValue,textValue,choice,type DesignReference,type HearthsideRoom,type RoomPlacement} from './contracts.ts';

export type RoomHorizon='tonight'|'season'|'someday';
export type RoomHistoryItem={object:RoomPlacement['object'];sourceRevision:number;label:string;detail:string;x:number|null;y:number|null;design:DesignReference|null};
export type RecordedRoom={version:1;id:string;revision:number;room:HearthsideRoom;horizon:RoomHorizon|null;title:string;createdBy:string;items:RoomHistoryItem[];furniture?:RoomFurnitureLayout;approvals:{memberId:string;revision:number}[];withdrawn:boolean};
export const roomObjectIdentity=(target:RoomPlacement['object'])=>JSON.stringify(target.kind==='piece'?[target.kind,target.designId,target.id]:[target.kind,target.id]);

/** One source projection serves today's room and deliberate recorded views. It contains no money projection or private content. */
export function roomContent(h:Household,room:HearthsideRoom,horizon?:RoomHorizon):RoomHistoryItem[]{
 const state=decodeHearthside(h.hearthside),members=h.members.filter(m=>m.active).map(m=>m.id),items:RoomHistoryItem[]=[];
 function place(target:RoomPlacement['object'],defaultRoom:HearthsideRoom,value:Omit<RoomHistoryItem,'object'|'x'|'y'>){
  const p=state.placements.find(p=>p.room===room&&roomObjectIdentity(p.object)===roomObjectIdentity(target));
  if(defaultRoom!==room&&!p)return;
  items.push({object:target,...value,x:p?.x??null,y:p?.y??null});
 }
 for(const e of state.experiences.filter(e=>e.state!=='archived'&&(!horizon||e.horizon===horizon)))place({kind:'experience',id:e.id},horizon?'conservatory':e.horizon==='tonight'?'common':'conservatory',{sourceRevision:e.revision,label:e.title,detail:e.state==='paused'?'Resting for now':e.intention,design:null});
 for(const n of state.notes.filter(n=>!n.archived))place({kind:'note',id:n.id},n.room,{sourceRevision:n.revision,label:n.text,detail:h.members.find(m=>m.id===n.authorId)?.name??'',design:null});
 for(const m of state.memories.filter(m=>memoryKeptByEveryone(m,members)))place({kind:'memory',id:m.id},'theatre',{sourceRevision:m.revision,label:m.title,detail:m.date??'A moment we chose to keep',design:m.designs[0]??null});
 for(const d of state.designs){if(!d.displayPieceId)continue;
  place({kind:'piece',id:d.displayPieceId,designId:d.designId},'studio',{sourceRevision:d.revision,label:d.bankId?h.goals.find(g=>g.id===d.bankId&&g.shared)?.name??'Our Studio piece':'Our Studio piece',detail:'The piece we chose to display',design:{version:1,documentId:d.designId,pieceId:d.displayPieceId,revision:d.revision}});
 }
 return items;
}
function decodeItem(input:unknown):RoomHistoryItem{
 const v=object(input,['object','sourceRevision','label','detail','x','y','design']);
 if((v.x===null)!==(v.y===null))throw Error('HEARTHSIDE_ROOM_HISTORY_POSITION');
 const p=decodePlacement({id:'validate',revision:1,room:'common',object:v.object,x:v.x??.5,y:v.y??.5});
 return {object:p.object,sourceRevision:revisionValue(v.sourceRevision,1),label:textValue(v.label,4000),detail:textValue(v.detail,6000,true),x:v.x===null?null:p.x,y:v.y===null?null:p.y,design:v.design===null?null:decodeDesignReference(v.design)};
}
export function decodeRecordedRoom(input:unknown):RecordedRoom{
 const v=object(input,['version','id','revision','room','horizon','title','createdBy','items','approvals','withdrawn','furniture']);
 if(v.version!==1||!Array.isArray(v.items)||v.items.length>100||!Array.isArray(v.approvals)||v.approvals.length>20||typeof v.withdrawn!=='boolean')throw Error('HEARTHSIDE_ROOM_HISTORY_INVALID');
 const items=v.items.map(decodeItem),approvals=v.approvals.map(a=>{const r=object(a,['memberId','revision']);return {memberId:identifier(r.memberId),revision:revisionValue(r.revision,1)};});
 if(new Set(items.map(i=>roomObjectIdentity(i.object))).size!==items.length||new Set(approvals.map(a=>a.memberId)).size!==approvals.length)throw Error('HEARTHSIDE_ROOM_HISTORY_DUPLICATE');
 const furniture=v.furniture===undefined?undefined:decodeRoomFurniture(v.furniture);if(furniture&&furniture.room!==v.room)throw Error('HEARTHSIDE_ROOM_HISTORY_POSITION');
 return {...(furniture?{furniture}:{}),version:1,id:identifier(v.id),revision:revisionValue(v.revision,1),room:choice(v.room,HEARTHSIDE_ROOMS),horizon:v.horizon===null?null:choice(v.horizon,['tonight','season','someday'] as const),title:textValue(v.title,200),createdBy:identifier(v.createdBy),items,approvals,withdrawn:v.withdrawn};
}
export function captureRoom(h:Household,input:{id:string;title:string;room:HearthsideRoom;horizon?:RoomHorizon},actor:string):RecordedRoom{
 return decodeRecordedRoom({version:1,...input,horizon:input.horizon??null,revision:1,createdBy:actor,items:roomContent(h,input.room,input.horizon),furniture:captureRoomFurniture(input.room,h.hearthside?.furniture??[]),approvals:[],withdrawn:false});
}
export function validateRoomCapture(h:Household,raw:unknown,actor:string):RecordedRoom{
 const frame=decodeRecordedRoom(raw);
 if(frame.revision!==1||frame.createdBy!==actor||frame.withdrawn||frame.approvals.length||frame.horizon!==null&&frame.room!=='conservatory')throw Error('HEARTHSIDE_ROOM_HISTORY_REVIEW_REQUIRED');
 if(h.hearthside?.roomHistory?.some(row=>row.id===frame.id))throw Error('HEARTHSIDE_ROOM_HISTORY_ALREADY_EXISTS');
 if(!frame.furniture||canonical(frame.furniture)!==canonical(captureRoomFurniture(frame.room,h.hearthside?.furniture??[])))throw Error('HEARTHSIDE_ROOM_CHANGED');
 if(canonical(frame.items)!==canonical(roomContent(h,frame.room,frame.horizon??undefined)))throw Error('HEARTHSIDE_ROOM_CHANGED');
 return frame;
}
/** A recorded label never reappears after its source is withdrawn, even if its old frame remains in recovery history. */
export function roomHistoryItemAvailable(h:Household,item:RoomHistoryItem):boolean{
 const s=decodeHearthside(h.hearthside),ref=item.object;
 if(ref.kind==='memory')return s.memories.some(m=>m.id===ref.id&&memoryKeptByEveryone(m,h.members.filter(m=>m.active).map(m=>m.id)));
 if(ref.kind==='note')return s.notes.some(n=>n.id===ref.id&&!n.archived);
 if(ref.kind==='experience')return s.experiences.some(e=>e.id===ref.id&&e.state!=='archived');
 return ref.kind==='piece'&&s.designs.some(d=>d.designId===ref.designId&&d.pieceIds.includes(ref.id));
}
export const recordedRoomKept=(frame:RecordedRoom,members:string[])=>!frame.withdrawn&&members.length>=2&&members.every(id=>frame.approvals.some(a=>a.memberId===id&&a.revision===frame.revision));
