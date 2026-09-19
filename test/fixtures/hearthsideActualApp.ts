import {completedExistingBooksHousehold} from './existing-books-onboarding.ts';
import {saveTask} from '../../src/core/tasks.ts';
import {saveNativeEvent} from '../../src/core/nativeEvents.ts';
import {commitHearthside,type HearthsideOperation} from '../../src/hearthside/commands.ts';
import {clearCapturedIntent} from '../../src/ledgerSync/capture.ts';
import {financialAuditHash} from '../../src/core/commandIdentity.ts';
import {saveHousehold,loadHousehold} from '../../src/storage.ts';
import {saveSession} from '../../src/session.ts';

export const APP_PROOF = {householdId:'HH-hearthside-app-synthetic',memberId:'MEM-002',experienceId:'EXP-app-proof',taskId:'TASK-app-proof',eventId:'EVENT-app-proof'} as const;
/** Synthetic local fixture only; no auth subject, capability, provider or remote service. */
export async function seedHearthsideActualApp(){
 let h=completedExistingBooksHousehold('2026-09-12T12:00:00.000Z');
 h.householdId=APP_PROOF.householdId;h.name='Alex & Sam — synthetic browser proof';
 h.members=h.members.map((m,i)=>({...m,name:i?'Sam (fictional)':'Alex (fictional)'}));
 clearCapturedIntent(h);
 h=saveTask(h,{memberId:APP_PROOF.memberId,id:APP_PROOF.taskId,expectedRevision:0,task:{title:'Put out the good mugs',notes:'Synthetic next step for our evening.',visibility:'household',listId:null,parentId:null,doDate:'2026-09-12',dueDate:null,repeat:'none',cue:'none',assigneeId:APP_PROOF.memberId,backupId:null,chapterId:null,planReference:null,moneyLink:null,expectedAmountCents:null,deleted:false}}).household;
 clearCapturedIntent(h);
 h=saveNativeEvent(h,{memberId:APP_PROOF.memberId,id:APP_PROOF.eventId,expectedRevision:0,event:{title:'Our quiet evening',visibility:'household',start:'2026-09-12T19:00',end:'2026-09-12T20:00',allDay:false,timezone:'America/Toronto',fold:'earlier',repeat:'none',until:null,location:'At home',notes:'Synthetic local calendar fixture.',exceptions:{},deleted:false}}).household;
 function apply(operation:HearthsideOperation,memberId:string=APP_PROOF.memberId){clearCapturedIntent(h);h=commitHearthside(h,{version:1,id:crypto.randomUUID(),scope:{environment:h.environment,householdId:h.householdId,memberId},operation}).household;}
 apply({kind:'experience.save',expectedRevision:0,value:{version:1,id:APP_PROOF.experienceId,revision:1,title:'An evening just for us',intention:'Tea, a record, and time for each other. Synthetic specimen.',state:'preparing',horizon:'tonight',createdBy:APP_PROOF.memberId,references:[{kind:'task',id:APP_PROOF.taskId},{kind:'calendar-event',id:APP_PROOF.eventId}]}});
 apply({kind:'note.save',expectedRevision:0,value:{version:1,id:'NOTE-app-proof',revision:1,authorId:APP_PROOF.memberId,text:'The mugs are waiting. Synthetic note.',room:'common',experienceId:APP_PROOF.experienceId,archived:false}});
 apply({kind:'note.save',expectedRevision:0,value:{version:1,id:'NOTE-app-studio',revision:1,authorId:APP_PROOF.memberId,text:'Choose a brush together. Synthetic Studio note.',room:'studio',experienceId:APP_PROOF.experienceId,archived:false}});
 apply({kind:'memory.compose',expectedRevision:0,value:{version:1,id:'MEMORY-app-proof',revision:1,title:'The record and the rain',date:'2026-09-12',experienceId:APP_PROOF.experienceId,media:[],designs:[],recollections:[{memberId:APP_PROOF.memberId,text:'A fictional evening for this browser test.'}],hideAmounts:true,approvals:[],withdrawn:false}});
 for(const memberId of h.members.filter(m=>m.active).map(m=>m.id))apply({kind:'memory.keep',id:'MEMORY-app-proof',expectedRevision:1},memberId);
 clearCapturedIntent(h);h.booksAcceptedHash=await financialAuditHash(h);
 await saveHousehold(h,{memberId:APP_PROOF.memberId,activate:true});
 saveSession('development',{householdId:h.householdId,memberId:APP_PROOF.memberId,view:'household'});
 return {scope:APP_PROOF,revision:h.revision,financialHash:h.booksAcceptedHash,receipts:h.commandReceipts.length,sharedLife:JSON.stringify(h.hearthside)};
}
export async function readHearthsideActualApp(){
 const h=await loadHousehold('development',APP_PROOF.householdId,APP_PROOF.memberId);if(!h)throw Error('SYNTHETIC_BOOKS_MISSING');
 return {revision:h.revision,financialHash:await financialAuditHash(h),receipts:h.commandReceipts.length,sharedLife:JSON.stringify(h.hearthside)};
}
