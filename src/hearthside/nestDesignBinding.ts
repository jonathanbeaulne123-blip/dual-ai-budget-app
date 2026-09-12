import {designAssert,designRecord,type KittyDesignScope} from './designContracts.ts';
export type NestAppearance={version:1;tier:'king'|'plan'|'bill';category:'protect'|'everyday'|'build'|'prepare'|null;theme:'classic'|'taylor'|'newfoundland'};
export type NestDesignSource={version:1;view:'household'|'personal';designKey:string;appearance:NestAppearance};
export function decodeNestAppearance(raw:unknown):NestAppearance{
 designRecord(raw,['version','tier','category','theme']);
 designAssert(raw.version===1&&['king','plan','bill'].includes(raw.tier as string)&&['classic','taylor','newfoundland'].includes(raw.theme as string)&&[null,'protect','everyday','build','prepare'].includes(raw.category as never),'INVALID_NEST_SOURCE','This pottery appearance needs a compatible reader.');
 designAssert(raw.tier==='king'?raw.category===null:raw.category!==null,'INVALID_NEST_SOURCE','The pottery category is invalid.');
 return {version:1,tier:raw.tier as NestAppearance['tier'],category:raw.category as NestAppearance['category'],theme:raw.theme as NestAppearance['theme']};
}
export function decodeNestSource(raw:unknown,scope?:KittyDesignScope):NestDesignSource{
 designRecord(raw,['version','view','designKey','appearance']);
 designAssert(raw.version===1&&['household','personal'].includes(raw.view as string)&&typeof raw.designKey==='string'&&raw.designKey.length<=300&&/^(king|plan:(protect|everyday|build|prepare)|(?:recurrence|potential|appointment|task|plan-line):.+)$/.test(raw.designKey),'INVALID_NEST_SOURCE','Choose an existing Nest source.');
 const appearance=decodeNestAppearance(raw.appearance),key=raw.designKey as string;
 designAssert(appearance.tier===(key==='king'?'king':key.startsWith('plan:')?'plan':'bill')&&(appearance.tier!=='plan'||appearance.category===key.slice(5)),'INVALID_NEST_SOURCE','This appearance belongs to another Nest source.');
 if(scope)designAssert((raw.view==='household')===(scope.ownerMemberId===null),'INVALID_NEST_SOURCE','The pottery belongs to another person’s space.');
 return {version:1,view:raw.view as NestDesignSource['view'],designKey:key,appearance};
}
export function nestSourceKey(source:NestDesignSource,owner:string|null){return JSON.stringify([source.view,owner,source.designKey]);}
