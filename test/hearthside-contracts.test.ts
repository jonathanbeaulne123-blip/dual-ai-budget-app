import {openChapter,setRitualParticipation} from "../src/core/chapters.ts";
import {assertChapterTaskGraph} from "../src/core/chapterAuthority.ts";
import { describe, expect, it } from 'vitest';
import { catalogHousehold,addGoal } from '../src/core/index.ts';
import { commitHearthside, type HearthsideOperation } from '../src/hearthside/commands.ts';
import { decodeHearthside, decodeExperience, emptyHearthside, memoryKeptByEveryone, occasionDate, type SharedExperience, type MemoryComposition, type PersonalOccasion } from '../src/hearthside/contracts.ts';
import { hearthsidePath, parseHearthsideRoute } from '../src/hearthside/routes.ts';
import { ensureHouseholdShape, splitForSync, assembleHousehold, mergeShared, personalEnvelopeFromPayload } from '../src/core/sync.ts';
import { financialAuditHash } from '../src/core/commandIdentity.ts';
import { householdForAiDisclosure, householdForHerculesContext } from '../src/core/visibility.ts';
import { capturedIntent,clearCapturedIntent } from '../src/ledgerSync/capture.ts';
import { commandFromCapture, type Scope } from '../src/ledgerSync/protocol.ts';
import { prepareCommand, type AuthorityState } from '../src/ledgerSync/authority.ts';
import { difference, project, digest } from '../src/ledgerSync/patch.ts';
import { seal, restoreArchive, type Checkpoint } from '../src/ledgerSync/backup.ts';
import { appendRestorePoint, applyRestorePoint } from '../src/core/restorePoints.ts';
import { eraseDevelopmentData } from '../src/core/stressSeed.ts';
import { undo } from '../src/core/commands.ts';
import { planLifeFixture } from './fixtures/plan-life.ts';
import { observedResources } from '../src/ledgerSync/resources.ts';
import { newKittyPiece } from '../src/core/kittyStudio.ts';
import { defaultGoalEnvelope } from '../src/core/goalEnvelopes.ts';

const experience = (id = 'EXP-free', actor = 'MEM-001'): SharedExperience => ({ version: 1, id, revision: 1, title: 'Sunday breakfast', intention: 'Make pancakes together', state: 'dreaming', horizon: 'tonight', createdBy: actor, references: [] });
const memory = (): MemoryComposition => ({ version: 1, id: 'MEMORY-free', revision: 1, title: 'The uneven pancakes', date: '2026-09-12', experienceId: 'EXP-free', media: [], designs: [], recollections: [{memberId:'MEM-001', text:'We laughed at the first one.'}], hideAmounts: true, approvals: [], withdrawn: false });
function run(h: ReturnType<typeof catalogHousehold>, operation: HearthsideOperation, memberId = 'MEM-001') { return commitHearthside(h, {version:1, id:crypto.randomUUID(), scope:{environment:h.environment,householdId:h.householdId,memberId}, operation}); }
function fixture() {
  const h = catalogHousehold(), one = splitForSync(h, 'MEM-001');
  const scope: Scope = { environment: h.environment, householdId:h.householdId, memberId:'MEM-001', subject:'synthetic', role:'owner', expires:Date.now()+60000, aclEpoch:1 };
  const state: AuthorityState = { sequence:h.revision, shared:one.shared, personal:new Map([['MEM-001',one.personal],['MEM-002',splitForSync(h,'MEM-002').personal]]) };
  return {h,scope,state};
}
const create: HearthsideOperation = {kind:'experience.save',expectedRevision:0,value:experience()};
describe('Hearthside shared identity and authority', () => {
  it('accepts a free intention without creating linked operational records or changing money', async () => {
    const {h,scope,state}=fixture(), result=run(h,create), capture=capturedIntent(result.household)!;
    const accepted=await prepareCommand(state,await commandFromCapture(capture,scope,crypto.randomUUID()),scope,()=>{});
    expect(accepted.shared.hearthside?.experiences).toEqual([experience()]);
    expect(accepted.receipt.postedIds).toEqual([]); expect(accepted.receipt.undoEligible).toBe(false);
    expect(await financialAuditHash(accepted.household)).toBe(await financialAuditHash(h));
    for(const key of ['goals','tasks','nativeEvents','planVersions','transactions'] as const) expect(accepted.household[key] ?? []).toEqual(h[key] ?? []);
  });
  it('round-trips optional data through strict shape, split, patch and another member', () => {
    const {h,state}=fixture(), next=run(h,create).household, parts=splitForSync(next,'MEM-001');
    expect(splitForSync(h,'MEM-001').shared).not.toHaveProperty('hearthside');
    expect(parts.personal).not.toHaveProperty('hearthside');
    const shared=project(state.shared,difference(state.shared,parts.shared));
    const restored=assembleHousehold(shared,state.personal.get('MEM-002')!);
    expect(ensureHouseholdShape(JSON.parse(JSON.stringify(restored))).hearthside).toEqual(next.hearthside);
    expect(()=>personalEnvelopeFromPayload({...parts.personal,hearthside:next.hearthside},'MEM-001')).toThrow('HEARTHSIDE_SHARED_ONLY');
    expect(()=>mergeShared(state.shared,parts.shared)).toThrow('HEARTHSIDE_REQUIRES_AUTHORITY');
  });
  it('rejects scope spoofing, old clients and compound changes at the real authority', async () => {
    const {h,scope,state}=fixture(), c=await commandFromCapture(capturedIntent(run(h,create).household)!,scope,crypto.randomUUID());
    await expect(prepareCommand(state,{...c,hearthsideVersion:undefined},scope,()=>{})).rejects.toThrow('CLIENT_RELOAD_REQUIRED');
    await expect(prepareCommand(state,{...c,hearthsideVersion:2},scope,()=>{})).rejects.toThrow('INVALID_COMMAND');
    await expect(prepareCommand(state,c,{...scope,memberId:'MEM-002'},()=>{})).rejects.toThrow('ACTOR_MISMATCH');
    await expect(prepareCommand(state,{...c,steps:[...c.steps,...c.steps]},scope,()=>{})).rejects.toThrow('HEARTHSIDE_SINGLE_OPERATION_REQUIRED');
    const wrong=structuredClone(c); (wrong.steps[0]!.args[0] as {scope:{householdId:string}}).scope.householdId='HH-other';
    await expect(prepareCommand(state,wrong,scope,()=>{})).rejects.toThrow('HEARTHSIDE_SCOPE_MISMATCH');
  });
  it('composes different-resource edits and preserves a losing same-resource draft', async () => {
    const {h,scope,state}=fixture(), c=await commandFromCapture(capturedIntent(run(h,create).household)!,scope,crypto.randomUUID());
    const actor2={...scope,memberId:'MEM-002'};
    const other=await commandFromCapture(capturedIntent(run(h,{...create,value:experience('EXP-other','MEM-002')},'MEM-002').household)!,actor2,crypto.randomUUID());
    const a=await prepareCommand(state,c,scope,()=>{}), next={sequence:a.receipt.sequence,shared:a.shared,personal:new Map([...state.personal,['MEM-001',a.personal]])};
    const b=await prepareCommand(next,other,actor2,()=>{}); expect(b.shared.hearthside?.experiences).toHaveLength(2);
    await expect(prepareCommand(next,{...c,id:crypto.randomUUID()},scope,()=>{})).rejects.toThrow('HEARTHSIDE_CHANGED');
    expect(create.value.title).toBe('Sunday breakfast');
  });
  it('refuses forged private or absent links and does not disclose shared stories to the model', () => {
    const {h}=fixture();
    expect(()=>run(h,{...create,value:{...experience(),references:[{kind:'bank',id:'PRIVATE-CANARY'}]}})).toThrow('HEARTHSIDE_SHARED_REFERENCE_REQUIRED');
    expect(()=>run(h,{...create,value:{...experience(),references:[{kind:'artifact',id:'PRIVATE-WORKSPACE'}]}})).toThrow('HEARTHSIDE_SHARED_REFERENCE_REQUIRED');
    const next=run(h,create).household;
    for(const payload of [householdForHerculesContext(next,'MEM-001','household'),householdForAiDisclosure(next,'MEM-001')]) expect(payload.hearthside).toBeUndefined();
  });
  it('preserves newer creative state and withdrawals across financial restore, reset and legacy undo', async () => {
    const {h}=fixture(), point=(await appendRestorePoint(h,'MEM-001')).restorePoints![0]!;
    let next=run(h,create).household;
    next=run(next,{kind:'memory.compose',expectedRevision:0,value:memory()}).household;
    next=run(next,{kind:'memory.withdraw',expectedRevision:1,id:'MEMORY-free'}).household;
    for(const restored of [applyRestorePoint(next,point,'MEM-001'),eraseDevelopmentData(next),undo(next,{id:'test',label:'Undo old books',snapshot:h,postedIds:[]})]) expect(restored.hearthside).toEqual(next.hearthside);
    const oldPoint=(await appendRestorePoint(next,'MEM-001')).restorePoints![0]!;
    expect(applyRestorePoint(h,oldPoint,'MEM-001').hearthside).toBeUndefined();
  });
  it('preserves the complete newer Chapter and operational graph during financial recovery',async()=>{
    const original=catalogHousehold(),point=(await appendRestorePoint(original,'MEM-001')).restorePoints![0]!;
    let current=openChapter(original,{memberId:'MEM-001',foundationId:'make-rent-boring',at:'2026-09-12T12:00:00.000Z'}).household;
    current=setRitualParticipation(current,{memberId:'MEM-001',ritualId:current.rituals![0]!.id,expectedMemberRevision:0,paused:true,at:'2026-09-12T12:01:00.000Z'}).household;
    current=run(current,create).household;
    current=run(current,{kind:'experience.save',expectedRevision:1,value:{...experience(),revision:2,references:[{kind:'task',id:current.tasks![0]!.id},{kind:'chapter',id:current.chapters![0]!.id}]}}).household;
    for(const restored of [applyRestorePoint(current,point,'MEM-001'),eraseDevelopmentData(current),undo(current,{id:'old-money',label:'Undo old books',snapshot:original,postedIds:[]})]){
      expect(()=>assertChapterTaskGraph(restored)).not.toThrow();
      for(const key of ['chapters','rituals','moves','tasks','hearthside'] as const)expect(restored[key]).toEqual(current[key]);
    }
    const pointWithLife=(await appendRestorePoint(current,'MEM-001')).restorePoints![0]!;
    const restored=applyRestorePoint(original,pointWithLife,'MEM-001');
    expect(restored.tasks??[]).toEqual([]);expect(restored.chapters??[]).toEqual([]);expect(restored.hearthside).toBeUndefined();
  });
  it('reattaches newer canonical artwork when financial restoration brings a removed bank back',async()=>{
    const {scope}=fixture();
    let original=addGoal(catalogHousehold(),{name:'Weekend jar',target:'100',shared:true}).household;
    const bankId=original.goals.at(-1)!.id,point=(await appendRestorePoint(original,'MEM-001')).restorePoints![0]!;
    const current={...original,goals:original.goals.filter(goal=>goal.id!==bankId)};clearCapturedIntent(current);
    const parts=splitForSync(current,'MEM-001'),state:AuthorityState={sequence:current.revision,shared:parts.shared,personal:new Map([['MEM-001',parts.personal],['MEM-002',splitForSync(current,'MEM-002').personal]])};
    const command={version:2,id:crypto.randomUUID(),environment:scope.environment,householdId:scope.householdId,observedSequence:state.sequence,goalEnvelopeVersion:1,companionProfileVersion:1,companionWorkflowVersion:1,companionPlayVersion:1,companionWardrobeVersion:1,planDecisionVersion:1,taskPlannerVersion:1,nativeCalendarVersion:1,accountHistoryVersion:1,kittyDesignVersion:1,hearthsideVersion:1,steps:[{kind:'restoreSharedPoint',args:[point.id],previewIds:[],reviewed:[],resources:[]}]};
    command.steps[0]!.resources=await Promise.all(observedResources(current,'restoreSharedPoint',[point.id]).map(async r=>({key:r.key,hash:await digest(r.value)}))) as never[];
    const reference={version:1 as const,designId:'DESIGN-restored-bank',revision:8,displayPieceId:'PIECE-newer'};
    const accepted=await prepareCommand(state,command,scope,()=>{},undefined,async()=>point,undefined,id=>id===bankId?{ownerMemberId:null,reference}:null);
    expect(accepted.household.goals.find(goal=>goal.id===bankId)?.envelope?.designRef).toEqual(reference);
    expect(accepted.household.goals.filter(goal=>goal.id===bankId)).toHaveLength(1);
    const privateHistory=()=>({ownerMemberId:'MEM-002',reference});
    await expect(prepareCommand(state,command,scope,()=>{},undefined,async()=>point,undefined,privateHistory)).rejects.toThrow('KITTY_DESIGN_OWNERSHIP_REVIEW_REQUIRED');
  });
  it('archives later shared-life events with retry receipts and rejects damaged archives', async () => {
    const {h,scope,state}=fixture();
    const checkpoint=await seal<Checkpoint>({version:2,scope:`${h.environment}/${h.householdId}`,authorityInstance:crypto.randomUUID(),sequence:h.revision,shared:state.shared,personal:[...state.personal],receipts:[]});
    const c=await commandFromCapture(capturedIntent(run(h,create).household)!,scope,crypto.randomUUID());
    const a=await prepareCommand(state,c,scope,()=>{});
    const record=await seal({scope:checkpoint.data.scope,authorityInstance:checkpoint.data.authorityInstance,event:a.event,receipt:a.receipt});
    const restored=await restoreArchive(checkpoint.data.scope,checkpoint,[record]);
    expect(restored.shared.hearthside?.experiences).toEqual([experience()]); expect(restored.receipts.at(-1)?.id).toBe(c.id);
    await expect(restoreArchive(checkpoint.data.scope,{...checkpoint,sha256:'bad'},[record])).rejects.toThrow('CHECKPOINT_CHECKSUM');
  });
});
describe('Authorship, meaning and recurring occasions', () => {
  it('keeps one accepted placement per room/object and preserves it across themes and replicas',()=>{
    let h=run(catalogHousehold(),create).household;
    const value={id:'PLACE-one',revision:1,room:'common' as const,object:{kind:'experience' as const,id:'EXP-free'},x:.3,y:.7};
    h=run(h,{kind:'placement.save',expectedRevision:0,value}).household;
    expect(()=>run(h,{kind:'placement.save',expectedRevision:0,value:{...value,id:'PLACE-two'}})).toThrow('HEARTHSIDE_PLACEMENT_ALREADY_EXISTS');
    expect(()=>run(h,{kind:'placement.save',expectedRevision:1,value:{...value,revision:2,room:'studio'}})).toThrow('HEARTHSIDE_PLACEMENT_IDENTITY_CHANGED');
    h=run(h,{kind:'placement.save',expectedRevision:1,value:{...value,revision:2,x:.65}},'MEM-002').household;
    const split=splitForSync(h,'MEM-001');expect(assembleHousehold(split.shared,split.personal).hearthside?.placements[0]).toMatchObject({x:.65,y:.7,revision:2});
    const focus='hearthside-scene-%5B%22experience%22%2C%22EXP-free%22%5D';
    const route={version:1 as const,householdId:h.householdId,room:'common' as const,mode:'present' as const,object:{kind:'experience' as const,id:'EXP-free'},returnContext:{path:hearthsidePath({version:1,householdId:h.householdId,room:'common',mode:'present'}),focusId:focus}};
    expect(parseHearthsideRoute(hearthsidePath(route),h.householdId)).toEqual(route);
  });
  it('keeps separately authored recollections and invalidates both approvals on a presentation change', () => {
    let h=run(catalogHousehold(),create).household;
    h=run(h,{kind:'memory.compose',expectedRevision:0,value:memory()}).household;
    expect(()=>run(h,{kind:'memory.compose',expectedRevision:1,value:{...memory(),revision:2,recollections:[{memberId:'MEM-001',text:'Forged'}]}},'MEM-002')).toThrow('HEARTHSIDE_RECOLLECTION_AUTHOR_REQUIRED');
    h=run(h,{kind:'memory.compose',expectedRevision:1,value:{...memory(),revision:2,recollections:[...memory().recollections,{memberId:'MEM-002',text:'Mine looked like a cloud.'}]}},'MEM-002').household;
    for(const actor of ['MEM-001','MEM-002']) h=run(h,{kind:'memory.keep',expectedRevision:2,id:'MEMORY-free'},actor).household;
    const kept=h.hearthside!.memories[0]!; expect(memoryKeptByEveryone(kept,['MEM-001','MEM-002'])).toBe(true);
    h=run(h,{kind:'memory.compose',expectedRevision:2,value:{...kept,revision:3,hideAmounts:false,approvals:[]}}).household;
    expect(memoryKeptByEveryone(h.hearthside!.memories[0]!,['MEM-001','MEM-002'])).toBe(false);
    expect(()=>run(h,{kind:'memory.keep',expectedRevision:2,id:'MEMORY-free'},'MEM-002')).toThrow('HEARTHSIDE_CHANGED');
  });
  it('cannot fabricate approvals, partner notes, media access or re-open withdrawn memories', () => {
    let h=run(catalogHousehold(),create).household;
    expect(()=>run(h,{kind:'memory.compose',expectedRevision:0,value:{...memory(),approvals:[{memberId:'MEM-002',revision:1}]}})).toThrow('HEARTHSIDE_MEMORY_REVIEW_REQUIRED');
    expect(()=>run(h,{kind:'memory.compose',expectedRevision:0,value:{...memory(),media:[{version:1,contentId:'secret',revision:1,kind:'image',alt:''}]}})).toThrow('HEARTHSIDE_CONTENT_PUBLICATION_REQUIRED');
    expect(()=>run(h,{kind:'note.save',expectedRevision:0,value:{version:1,id:'NOTE-test',revision:1,authorId:'MEM-002',text:'Forged',room:'common',experienceId:null,archived:false}})).toThrow('HEARTHSIDE_AUTHOR_REQUIRED');
    h=run(h,{kind:'memory.compose',expectedRevision:0,value:memory()}).household;
    h=run(h,{kind:'memory.withdraw',expectedRevision:1,id:'MEMORY-free'}).household;
    expect(()=>run(h,{kind:'memory.keep',expectedRevision:2,id:'MEMORY-free'})).toThrow('HEARTHSIDE_MEMORY_WITHDRAWN');
  });
  it('retains a separate occasion identity per year with explicit leap-day behavior', () => {
    let h=run(catalogHousehold(),create).household;
    const o:PersonalOccasion={version:1,id:'OCC-birthday',revision:1,title:'Birthday',monthDay:'02-29',leapDay:'march-1',occurrences:[{id:'OCC-birthday:2026',year:2026,date:'2026-03-01',experienceId:'EXP-free',memoryIds:[]}]};
    h=run(h,{kind:'occasion.save',expectedRevision:0,value:o}).household;
    expect(occasionDate(o,2026)).toBe('2026-03-01'); expect(occasionDate(o,2028)).toBe('2028-02-29');
    const next={...o,revision:2,occurrences:[...o.occurrences,{id:'OCC-birthday:2027',year:2027,date:'2027-03-01',experienceId:null,memoryIds:[]}]};
    h=run(h,{kind:'occasion.save',expectedRevision:1,value:next}).household;
    expect(h.hearthside?.occasions[0]?.occurrences[1]?.experienceId).toBeNull();
    expect(()=>run(h,{kind:'occasion.save',expectedRevision:2,value:{...next,revision:3,occurrences:[]}})).toThrow('HEARTHSIDE_OCCURRENCE_HISTORY_REQUIRED');
  });
  it('rejects unknown fields, capabilities, accessors, sparse arrays and invalid calendar dates', () => {
    expect(()=>decodeHearthside({...emptyHearthside(),version:2})).toThrow('HEARTHSIDE_UPDATE_REQUIRED');
    expect(()=>decodeExperience({...experience(),amountCents:100})).toThrow('HEARTHSIDE_INVALID_OBJECT');
    const getter={...experience()}; Object.defineProperty(getter,'title',{get:()=> 'no'}); expect(()=>decodeExperience(getter)).toThrow();
    expect(()=>decodeExperience({...experience(),references:new Array(2)})).toThrow();
    const rows: unknown[] = []; Object.defineProperty(rows, 'map', {get:()=>()=>[experience()]});
    expect(()=>decodeHearthside({...emptyHearthside(),experiences:rows})).toThrow('HEARTHSIDE_INVALID_LIST');
    expect(()=>decodeHearthside({...emptyHearthside(),memories:[{...memory(),date:'2026-02-30'}]})).toThrow('HEARTHSIDE_INVALID_DATE');
  });
  it('round-trips stable object routes and refuses another household or malformed objects', () => {
    const route={version:1 as const,householdId:'HH-one',room:'studio' as const,mode:'present' as const,object:{kind:'piece' as const,id:'PIECE-one',designId:'DESIGN-one'}};
    const path=hearthsidePath(route); expect(parseHearthsideRoute(path,'HH-one')).toEqual(route);
    expect(parseHearthsideRoute(path,'HH-two')).toBeNull();
    for(const path of ['/hearthside/pieces/%2Fbad','/hearthside/pieces/one/extra','/hearthside/rooms/unknown','/hearthside/rooms/common?mode=private','/hearthside-imposter/rooms/common']) expect(parseHearthsideRoute(path,'HH-one')).toBeNull();
    const withReturn={...route,returnContext:{path:hearthsidePath({...route,object:undefined}),focusId:'hearthside-piece-one'}};
    expect(parseHearthsideRoute(hearthsidePath(withReturn),'HH-one')).toEqual(withReturn);
    expect(()=>hearthsidePath({...route,returnContext:{path:'https://elsewhere.invalid/',focusId:'one'}})).toThrow('HEARTHSIDE_INVALID_RETURN');
    expect(()=>hearthsidePath({...route,returnContext:{path:'/hearthside/rooms/common?household=HH-two',focusId:'one'}})).toThrow('HEARTHSIDE_INVALID_RETURN');
  });
  it('binds a Plan line to its exact parent version and rejects an ambiguous or private parent',()=>{
    const h=planLifeFixture('household'),version=h.planVersions![0]!,line=version.lines[0]!;
    const value={...experience(),references:[{kind:'plan-line' as const,id:line.id,planVersionId:version.id}]};
    expect(run(h,{...create,value}).household.hearthside!.experiences[0]!.references[0]).toEqual(value.references[0]);
    expect(()=>decodeExperience({...value,references:[{kind:'plan-line',id:line.id}]})).toThrow('HEARTHSIDE_INVALID_ID');
    expect(()=>run(h,{...create,value:{...value,references:[{kind:'plan-line',id:line.id,planVersionId:'private-parent'}]}})).toThrow('HEARTHSIDE_SHARED_REFERENCE_REQUIRED');
  });
  it('admits bounded UTF-8 metadata and never executes operation or array accessors',()=>{
    expect(()=>decodeHearthside({...emptyHearthside(),experiences:Array.from({length:600},(_,i)=>({...experience(`EXP-${i}`),intention:'🌧'.repeat(1800)}))})).toThrow('HEARTHSIDE_METADATA_LIMIT');
    let calls=0;
    const op={...create};Object.defineProperty(op,'kind',{get:()=>{calls++;return 'experience.save';}});
    expect(()=>run(catalogHousehold(),op)).toThrow('HEARTHSIDE_INVALID_OBJECT');
    const rows=[experience()];Object.defineProperty(rows,'0',{get:()=>{calls++;return experience();}});
    expect(()=>decodeHearthside({...emptyHearthside(),experiences:rows})).toThrow('HEARTHSIDE_INVALID_LIST');
    expect(calls).toBe(0);
  });
  it('keeps painting out of financial review dependencies while target, purpose, owner and backing remain material',()=>{
    const h=planLifeFixture('household');h.goals[0]!.envelope=defaultGoalEnvelope();
    const painting=structuredClone(h);painting.goals[0]!.updatedAt='2026-09-12T12:00:00Z';painting.goals[0]!.envelope={...defaultGoalEnvelope(),glaze:'rose',studio:{version:1,draft:newKittyPiece('PIECE-test','2026-09-12T12:00:00Z'),fired:[]}};
    for(const kind of ['purchaseGoal','fundGoal','releaseHouseholdFundKitty','allocateHouseholdFundSurplus']) {
      const review=observedResources(h,kind,[]);
      expect(observedResources(painting,kind,[])).toEqual(review);
      for(const change of [(h:typeof painting)=>{h.goals[0]!.targetCents++;},(h:typeof painting)=>{h.goals[0]!.ownerMemberId='MEM-002';},(h:typeof painting)=>{h.goals[0]!.envelope!.purpose='Different promise';},(h:typeof painting)=>{h.fundKittyAllocations![0]!.amountCents++;}]) {
        const changed=structuredClone(painting);change(changed);expect(observedResources(changed,kind,[])).not.toEqual(review);
      }
    }
    expect(observedResources(painting,'saveGoalEnvelope',[])).not.toEqual(observedResources(h,'saveGoalEnvelope',[]));
  });
});
