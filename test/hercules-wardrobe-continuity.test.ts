import {appendRestorePoint,applyRestorePoint} from '../src/core/restorePoints.ts';
import {eraseDevelopmentData,preserveContinuityForStressSeed} from '../src/core/stressSeed.ts';
import {describe,it,expect} from 'vitest';
import {catalogHousehold} from '../src/core/index.ts';
import {companionFor,commitCompanion} from '../src/core/herculesCompanion.ts';
import {commitCompanionGallery} from '../src/core/herculesWardrobe.ts';
import {assembleHousehold,splitForSync,ensureHouseholdShape,mergeShared} from '../src/core/sync.ts';
import {COZY_LOOK,COLLECTION_LOOKS,FITTING_MANIFEST} from '../src/wardrobe/catalogue.ts';
import {decodeCompanionGallery,validateLookForWear,type CompanionOperation,type CompanionGalleryIntentV1} from '../src/core/herculesCompanionContracts.ts';
import {capturedIntent} from '../src/ledgerSync/capture.ts';
import {commandFromCapture,type Scope} from '../src/ledgerSync/protocol.ts';
import {prepareCommand,type AuthorityState} from '../src/ledgerSync/authority.ts';
import {executeIntent} from '../src/ledgerSync/registry.ts';
import {project} from '../src/ledgerSync/patch.ts';
function fixture(){const h=catalogHousehold(),scope:Scope={environment:h.environment,householdId:h.householdId,memberId:'MEM-001',subject:'synthetic',role:'owner',expires:Date.now()+60_000,aclEpoch:1},pair=splitForSync(h,scope.memberId);return {h,scope,state:{sequence:h.revision,shared:pair.shared,personal:new Map([[scope.memberId,pair.personal],['MEM-002',splitForSync(h,'MEM-002').personal]])} as AuthorityState};}
const personal=(h:ReturnType<typeof catalogHousehold>,operation:CompanionOperation,memberId='MEM-001')=>commitCompanion(h,{version:1,id:crypto.randomUUID(),scope:companionFor(h,memberId).scope,operation});
const gallery=(h:ReturnType<typeof catalogHousehold>,operation:CompanionGalleryIntentV1['operation'],memberId='MEM-001')=>commitCompanionGallery(h,{version:1,id:crypto.randomUUID(),scope:companionFor(h,memberId).scope,operation});
describe('Complete wardrobe authority',()=>{
 it('saves independently of worn state and conversation revisions, with tombstones beating stale changes',()=>{
  const {h}=fixture();const saved=personal(h,{kind:'look.save',look:COZY_LOOK,expectedRevision:0});expect(saved.postedIds).toEqual([]);expect(saved.persistenceScope).toBe('member-personal');expect(saved.household.companionProfile?.wornLook.value).toBeNull();
  const chatted=personal(saved.household,{kind:'conversation.append',view:'personal',generation:0,turn:{id:'private-turn',role:'user',text:'PRIVATE-CANARY',createdAt:new Date().toISOString(),sourceReferences:[]}}).household;
  const worn=personal(chatted,{kind:'look.wear',look:COLLECTION_LOOKS.rain!,expectedRevision:0}).household;expect(worn.companionProfile?.savedLooks[0]?.value).toEqual(COZY_LOOK);
  const removed=personal(worn,{kind:'look.remove',lookId:COZY_LOOK.id,expectedRevision:1}).household;expect(removed.companionProfile?.savedLooks[0]).toMatchObject({value:null,revision:2});expect(()=>personal(removed,{kind:'look.save',look:COZY_LOOK,expectedRevision:1})).toThrow('STALE_COMPANION_RESOURCE');
  const split=splitForSync(removed,'MEM-001');expect(JSON.stringify(split.shared)).not.toMatch(/PRIVATE-CANARY|rain-recommended|cozy-fitting/);expect(assembleHousehold(split.shared,split.personal).companionProfile).toEqual(removed.companionProfile);expect(splitForSync(removed,'MEM-002').personal.companionProfile).toBeUndefined();
 });
 it('projects only an explicit public copy, binds creator, and independently copies/renames/removes it',()=>{
  const {h}=fixture();const saved=personal(h,{kind:'look.save',look:COZY_LOOK,expectedRevision:0}).household;
  saved.companionProfile!.conversations[1]!.turns.push({id:'private',role:'user',text:'PRIVATE-CHAT-CANARY',createdAt:new Date().toISOString(),sourceReferences:[]});
  const shared=gallery(saved,{kind:'gallery.publish',galleryId:'public-one',sourceLookId:COZY_LOOK.id,expectedLookRevision:1,expectedRevision:0}).household;
  expect(JSON.stringify(shared.companionGallery)).not.toMatch(/PRIVATE-CHAT|conversations|preferences|cozy-fitting/);expect(shared.companionGallery?.[0]?.creatorMemberId).toBe('MEM-001');
  const partner=assembleHousehold(splitForSync(shared,'MEM-001').shared,splitForSync(h,'MEM-002').personal);const copied=personal(partner,{kind:'look.save',look:{...structuredClone(shared.companionGallery![0]!.value!.look),id:'independent'},expectedRevision:0},'MEM-002').household;
  const renamed=gallery(shared,{kind:'gallery.rename',galleryId:'public-one',name:'Public new name',expectedRevision:1}).household;expect(copied.companionProfile?.savedLooks[0]?.value?.name).toBe(COZY_LOOK.name);expect(renamed.companionProfile?.savedLooks[0]?.value?.name).toBe(COZY_LOOK.name);
  expect(()=>gallery(renamed,{kind:'gallery.remove',galleryId:'public-one',expectedRevision:2},'MEM-002')).toThrow('FOREIGN_GALLERY_RESOURCE');
  const removed=gallery(renamed,{kind:'gallery.remove',galleryId:'public-one',expectedRevision:2}).household;expect(()=>gallery(removed,{kind:'gallery.publish',galleryId:'public-one',sourceLookId:COZY_LOOK.id,expectedLookRevision:1,expectedRevision:2})).toThrow('STALE_COMPANION_RESOURCE');expect(()=>gallery(removed,{kind:'gallery.publish',galleryId:'public-one',sourceLookId:'independent',expectedLookRevision:1,expectedRevision:3},'MEM-002')).toThrow('FOREIGN_GALLERY_RESOURCE');
  const split=splitForSync(removed,'MEM-001');expect(assembleHousehold(split.shared,split.personal).companionGallery).toEqual(removed.companionGallery);expect(ensureHouseholdShape(JSON.parse(JSON.stringify(removed))).companionGallery).toEqual(removed.companionGallery);
 });
 it('enforces capacity, source revisions, unavailable selections and closed public fields without eviction',()=>{
  const {h}=fixture();h.companionProfile=companionFor(h,'MEM-001');h.companionProfile.savedLooks=Array.from({length:50},(_,i)=>({id:`look-${i}`,revision:1,value:{...COZY_LOOK,id:`look-${i}`}}));
  expect(()=>personal(h,{kind:'look.save',look:COZY_LOOK,expectedRevision:0})).toThrow('SAVED_LOOK_LIMIT');expect(personal(h,{kind:'look.save',look:{...COZY_LOOK,id:'look-0'},expectedRevision:1}).household.companionProfile?.savedLooks).toHaveLength(50);
  expect(()=>gallery(h,{kind:'gallery.publish',galleryId:'public',sourceLookId:'look-0',expectedLookRevision:0,expectedRevision:0})).toThrow('STALE_COMPANION_RESOURCE');
  const one=gallery(h,{kind:'gallery.publish',galleryId:'public',sourceLookId:'look-0',expectedLookRevision:1,expectedRevision:0}).household;one.companionGallery=Array.from({length:100},(_,i)=>({...one.companionGallery![0]!,id:`public-${i}`,value:{...one.companionGallery![0]!.value!,id:`public-${i}`,look:{...COZY_LOOK,id:`public-${i}`}}}));
  expect(()=>gallery(one,{kind:'gallery.publish',galleryId:'overflow',sourceLookId:'look-0',expectedLookRevision:1,expectedRevision:0})).toThrow('GALLERY_LOOK_LIMIT');expect(()=>decodeCompanionGallery([{...one.companionGallery![0],privateNote:'secret'}],h)).toThrow();
  const unknown={...COZY_LOOK,selections:{head:{itemId:'unknown',variantId:'unknown'}}};expect(()=>personal(h,{kind:'look.wear',look:unknown,expectedRevision:0})).toThrow('UNAVAILABLE_COSMETIC');h.companionProfile.wornLook.value=unknown;expect(personal(h,{kind:'remembering.set',enabled:false,expectedRevision:0}).household.companionProfile?.wornLook.value).toEqual(unknown);
 });
 it('runs acknowledged personal/shared patches through the real authority and rejects old/spoofed/mixed writers',async()=>{
  const {h,scope,state}=fixture();const candidate=personal(h,{kind:'look.save',look:COZY_LOOK,expectedRevision:0}),command=await commandFromCapture(capturedIntent(candidate.household)!,scope,crypto.randomUUID());
  const accepted=await prepareCommand(state,command,scope,()=>{});expect(accepted.receipt.postedIds).toEqual([]);expect(accepted.shared.transactions).toEqual(state.shared.transactions);expect(accepted.shared.companionGallery).toBeUndefined();
  await expect(prepareCommand(state,{...command,companionWardrobeVersion:undefined},scope,()=>{})).rejects.toThrow('CLIENT_RELOAD_REQUIRED');await expect(prepareCommand(state,command,{...scope,memberId:'MEM-002'},()=>{})).rejects.toThrow('ACTOR_MISMATCH');await expect(prepareCommand(state,{...command,steps:[...command.steps,...command.steps]},scope,()=>{})).rejects.toThrow('WARDROBE_SINGLE_OPERATION_REQUIRED');
  const current=assembleHousehold(accepted.shared,accepted.personal),nextState={...state,sequence:accepted.receipt.sequence,shared:accepted.shared,personal:new Map([...state.personal,[scope.memberId,accepted.personal]])};const publish=gallery(current,{kind:'gallery.publish',galleryId:'public',sourceLookId:COZY_LOOK.id,expectedLookRevision:1,expectedRevision:0});const publicCommand=await commandFromCapture(capturedIntent(publish.household)!,scope,crypto.randomUUID());const result=await prepareCommand(nextState,publicCommand,scope,()=>{});
  expect(result.personal.companionProfile).toEqual(accepted.personal.companionProfile);expect(result.shared.companionGallery?.[0]?.value?.look.name).toBe(COZY_LOOK.name);expect(project(nextState.shared,result.event.shared)).toEqual(result.shared);expect(result.receipt.undoEligible).toBe(false);expect(JSON.stringify(result.event.shared)).not.toMatch(/companionProfile|savedLooks/);
  expect(()=>executeIntent(current,'commitCompanionGallery',[{version:1,id:'forged',scope:companionFor(h,'MEM-002').scope,operation:{kind:'gallery.remove',galleryId:'public',expectedRevision:1}}],'MEM-001','command')).toThrow('ACTOR_MISMATCH');
 });
 it('restoring old books or erasing activity preserves current wardrobe revisions and gallery tombstones',async()=>{
  const {h}=fixture();const pointBefore=(await appendRestorePoint(h,'MEM-001')).restorePoints![0]!;
  const saved=personal(h,{kind:'look.save',look:COZY_LOOK,expectedRevision:0}).household;
  const shared=gallery(saved,{kind:'gallery.publish',galleryId:'public',sourceLookId:COZY_LOOK.id,expectedLookRevision:1,expectedRevision:0}).household;
  const pointWithLook=(await appendRestorePoint(shared,'MEM-001')).restorePoints![0]!;
  const removed=gallery(shared,{kind:'gallery.remove',galleryId:'public',expectedRevision:1}).household;
  for(const point of [pointBefore,pointWithLook]){const restored=applyRestorePoint(removed,point,'MEM-001');expect(restored.companionGallery).toEqual(removed.companionGallery);expect(restored.companionProfile).toEqual(removed.companionProfile);}
  for(const reset of [eraseDevelopmentData(removed),preserveContinuityForStressSeed(removed,catalogHousehold())]){expect(reset.companionGallery).toEqual(removed.companionGallery);expect(reset.companionProfile).toEqual(removed.companionProfile);}
 });
 it('every recommended look is compatible and legacy clock merging cannot drop the gallery',()=>{
  Object.values(COLLECTION_LOOKS).forEach(look=>expect(()=>validateLookForWear(look,FITTING_MANIFEST)).not.toThrow());const {h}=fixture(),saved=personal(h,{kind:'look.save',look:COZY_LOOK,expectedRevision:0}).household,shared=gallery(saved,{kind:'gallery.publish',galleryId:'public',sourceLookId:COZY_LOOK.id,expectedLookRevision:1,expectedRevision:0}).household;expect(()=>mergeShared(splitForSync(shared,'MEM-001').shared,splitForSync(h,'MEM-001').shared)).toThrow('COMPANION_GALLERY_REQUIRES_AUTHORITY');
 });
});
