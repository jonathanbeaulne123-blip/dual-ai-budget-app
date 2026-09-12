import {captureRoomFurniture} from './roomFurniture.ts';
import type {Household} from '../core/types.ts';
import {decodeHearthside,type HearthsideRoom,type RoomPlacement} from './contracts.ts';
import {RoomScene,type RoomSceneObject} from './RoomScene.tsx';
import {roomContent,roomObjectIdentity} from './roomHistory.ts';
export {roomObjectIdentity} from './roomHistory.ts';
import {SavedPiecePreview} from './MemoryArtwork.tsx';
import type {HearthsideOperation} from './commands.ts';



export function HouseholdRoom({household,memberId,room,theme,paused,canArrange,onOpen,onNavigate,submit,horizon}:{
  household:Household;memberId:string;room:HearthsideRoom;horizon?:'tonight'|'season'|'someday';theme:'classic'|'taylor'|'newfoundland';paused:boolean;canArrange:boolean;
  onOpen:(kind:RoomPlacement['object']['kind'],id:string,designId?:string)=>void;
  onNavigate:(room:HearthsideRoom)=>void;submit:(operation:HearthsideOperation)=>Promise<boolean>;
}){
  const state=decodeHearthside(household.hearthside),references=new Map<string,RoomPlacement['object']>();
  const objects:RoomSceneObject[]=roomContent(household,room,horizon).map(item=>{
    const id=roomObjectIdentity(item.object);references.set(id,item.object);
    return {id,kind:item.object.kind,label:item.label,detail:item.detail,x:item.x??undefined,y:item.y??undefined,preview:item.design?<SavedPiecePreview reference={item.design}/>:undefined,onActivate:()=>onOpen(item.object.kind,item.object.id,item.object.kind==='piece'?item.object.designId:undefined)};
  });
  const intention=state.experiences.map(experience=>{
    const linked=new Set<string>([roomObjectIdentity({kind:'experience',id:experience.id})]);
    for(const note of state.notes)if(note.experienceId===experience.id)linked.add(roomObjectIdentity({kind:'note',id:note.id}));
    for(const memory of state.memories)if(memory.experienceId===experience.id)linked.add(roomObjectIdentity({kind:'memory',id:memory.id}));
    for(const ref of experience.references)if(ref.kind==='piece'&&ref.designId)linked.add(roomObjectIdentity({kind:'piece',id:ref.id,designId:ref.designId}));
    return {label:experience.title,objectIds:objects.filter(o=>linked.has(o.id)).map(o=>o.id)};
  }).find(link=>link.objectIds.length>1);
  async function arrange(id:string,x:number,y:number){
    const target=references.get(id);if(!target||!canArrange)return;
    const old=state.placements.find(p=>p.room===room&&roomObjectIdentity(p.object)===id);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([room,id])));
    const placementId=old?.id??`PLACE-${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}`;
    await submit({kind:'placement.save',expectedRevision:old?.revision??0,value:{id:placementId,revision:(old?.revision??0)+1,room,object:target,x,y}});
  }
  return <RoomScene key={`${household.environment}/${household.householdId}/${memberId}`} scopeKey={`${household.environment}/${household.householdId}/${memberId}`} furniture={captureRoomFurniture(room,state.furniture??[])} furnitureSaveAvailable={canArrange} onArrangeFurniture={async value=>{if(!canArrange||!await submit({kind:'furniture.save',value}))throw Error('HEARTHSIDE_FURNITURE_NOT_CONFIRMED');}} room={room} theme={theme} objects={objects} intention={intention} paused={paused} onNavigate={onNavigate} onArrange={canArrange?(id,x,y)=>void arrange(id,x,y):undefined}/>;
}
