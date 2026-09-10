import type {CommitResult,Household} from './types.ts';
import {captureCommand} from '../ledgerSync/capture.ts';
import {companionFor} from './herculesCompanion.ts';
import {checkCompanionGalleryPrecondition,decodeCompanionGallery,decodeCompanionGalleryIntent,projectGalleryLook,type CompanionGalleryIntentV1} from './herculesCompanionContracts.ts';
import {FITTING_MANIFEST} from '../wardrobe/catalogue.ts';
/** Explicit public projection. The actor is rebound by the command authority. */
export const commitCompanionGallery=captureCommand('commitCompanionGallery',(household:Household,raw:CompanionGalleryIntentV1):CommitResult=>{
 const scope={environment:household.environment,householdId:household.householdId,memberId:raw.scope?.memberId};
 if(!household.members.some(m=>m.id===scope.memberId&&m.active))throw new Error('COMPANION_MEMBER_REQUIRED');
 const intent=decodeCompanionGalleryIntent(raw,scope),op=intent.operation,profile=companionFor(household,scope.memberId);
 const gallery=decodeCompanionGallery(household.companionGallery??[],scope);
 checkCompanionGalleryPrecondition(profile,intent,scope,gallery,FITTING_MANIFEST);
 const old=gallery.find(row=>row.id===op.galleryId),revision=op.expectedRevision+1;
 const value=op.kind==='gallery.remove'?null:op.kind==='gallery.rename'?{...old!.value!,revision,look:{...old!.value!.look,name:op.name}}:{...projectGalleryLook(profile,scope,op.sourceLookId,op.galleryId,FITTING_MANIFEST),revision};
 const next=decodeCompanionGallery([...gallery.filter(row=>row.id!==op.galleryId),{id:op.galleryId,creatorMemberId:scope.memberId,revision,value}],scope);
 return {household:{...household,companionGallery:next},warnings:[],postedIds:[],undo:{id:intent.id,label:'Hercules household gallery',snapshot:household,postedIds:[],commandKind:'hercules-companion-gallery'}};
});
