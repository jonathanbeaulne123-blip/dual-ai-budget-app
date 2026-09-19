import type {Household} from '../core/types.ts';
import {nestDesignId,nestSourceVisible,type KittyNestDesign,retainNestReceiptLooks} from '../core/kittyNestDesigns.ts';
import {decodeKittyDesignDocument,migrateLegacyKittyStudio,kittyDesignReference} from './design.ts';
import {canonicalDesignJSON,type KittyDesignDocument} from './designContracts.ts';
import {decodeNestSource,type NestDesignSource} from './nestDesignBinding.ts';

export function visibleNestSource(h:Household,memberId:string,raw:unknown):{source:NestDesignSource;row:KittyNestDesign}{
 const source=decodeNestSource(raw);
 if(!h.members.some(m=>m.id===memberId&&m.active)||!nestSourceVisible(h,memberId,source.view,source.designKey))throw Error('DESIGN_NEST_UNAVAILABLE');
 const row=h.kittyNestDesigns?.find(d=>d.id===nestDesignId(source.view,memberId,source.designKey));
 if(!row||row.visibility!==source.view||(source.view==='personal'&&row.createdBy!==memberId))throw Error('DESIGN_NEST_UNAVAILABLE');
 return {source,row};
}
export function assertNestDocumentVisible(h:Household,memberId:string,document:KittyDesignDocument){
 if(!document.nest)return;
 const {row}=visibleNestSource(h,memberId,document.nest);
 if((document.nest.view==='household'?null:memberId)!==document.scope.ownerMemberId||row.designRef?.designId!==document.id)throw Error('DESIGN_NEST_UNAVAILABLE');
}
export function migrateNestDesign(h:Household,memberId:string,id:string,raw:unknown):KittyDesignDocument{
 const {source,row}=visibleNestSource(h,memberId,raw);
 if(row.designRef)throw Error('DESIGN_NEST_ALREADY_MIGRATED');
 if(source.appearance.category!==(source.designKey==='king'?null:source.designKey.startsWith('plan:')?source.designKey.slice(5):row.category))throw Error('INVALID_NEST_SOURCE');
 const scope={environment:h.environment,householdId:h.householdId,ownerMemberId:source.view==='personal'?memberId:null};
 const legacy=migrateLegacyKittyStudio(id,scope,row.studio,id);
 return decodeKittyDesignDocument({...legacy,nest:source});
}
export function applyNestDesignReference(h:Household,document:KittyDesignDocument,acceptedAt:string):Household{
 if(!document.nest)return h;
 const owner=document.scope.ownerMemberId,source=document.nest;
 const id=nestDesignId(source.view,owner??'',source.designKey),old=h.kittyNestDesigns?.find(row=>row.id===id);
 if(!old||(source.view==='personal'&&old.createdBy!==owner)||old.designRef&&old.designRef.designId!==document.id)throw Error('DESIGN_NEST_UNAVAILABLE');
 const reference=kittyDesignReference(document);
 if(old.designRef&&canonicalDesignJSON(old.designRef)===canonicalDesignJSON(reference))return h;
 const {studio:_studio,...metadata}=old;
 const history=retainNestReceiptLooks(h,old);
 // Metadata remains an accepted source record; its money-independent revision protects concurrent name/setup edits.
 const row:KittyNestDesign={...metadata,designRef:reference,revision:old.revision+1,updatedAt:acceptedAt,designHasFired:nestHasFiredPiece(document),...(history.length?{history}:{})};
 return {...h,kittyNestDesigns:h.kittyNestDesigns!.map(r=>r.id===id?row:r)};
}
/** Authority-only completion evidence; a caller cannot fabricate a fired shelf. */
export function nestHasFiredPiece(document:KittyDesignDocument){return Boolean(document.legacy?.pieces.some(p=>p.firedAt)||document.operations.some(entry=>entry.operation.kind==='fire')); }
