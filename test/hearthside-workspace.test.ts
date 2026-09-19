import { consumeWorkspaceRpc } from '../src/hearthside/workspaceRpc.ts';
import {describe,it,expect,vi,afterEach} from 'vitest';
import { workspaceExperienceContext, workspaceExperienceDigest, workspaceExperienceKey, workspaceExperienceProjectId, decodeWorkspaceExperienceContext, type WorkspaceExperienceContext } from '../src/hearthside/workspaceContext.ts';
import { createExperienceWorkspaceProject, assertAcceptedWorkspaceExperience, adoptReviewedExperienceCopy } from '../src/hearthside/workspaceAuthority.ts';
import { applyWorkspaceCommand, type WorkspaceProject } from '../src/workspace/contracts.ts';
import { projectContext } from '../src/workspace/runtime.ts';
import { publishExperienceArtifact, withdrawExperienceArtifact, preparedExperienceArtifact, artifactPublication, experienceArtifactReviewDigest, validateArtifactSource, type ExperiencePublicationPorts, type ExperienceArtifactReview, type PreparedExperienceArtifact, type ArtifactPublicationReceipt } from '../src/hearthside/workspacePublication.ts';
import { executeWorkspaceTool } from '../workers/workspace/tools.ts';
import { WorkspaceClient } from '../src/workspace/client.ts';
import { residentWelcome, residentDraft } from '../src/hearthside/resident.ts';
const now='2026-09-12T10:00:00.000Z',scope={identity:'signed-in-subject',environment:'development' as const,householdId:'HH-example',memberId:'MEM-001'};
const experience:WorkspaceExperienceContext={version:1,id:'experience:quiet-evening',revision:3,title:'An evening at home',intention:'A little time for us',state:'dreaming',horizon:'tonight'};
function project(){return createExperienceWorkspaceProject(scope,workspaceExperienceProjectId(scope,experience.id),experience,workspaceExperienceDigest(experience),experience,now);}
function written(){let p=project();p=applyWorkspaceCommand(p,{type:'create-artifact',id:'a1',title:'A small evening',format:'markdown',content:'Tea, a little music, and a walk.'},0,now);return p;}
function reviewFor(p=written()):ExperienceArtifactReview{return {version:1,id:'copy-one',projectId:p.id,artifactVersionId:'a1',experienceId:experience.id,experienceRevision:3,title:'A small evening',format:'markdown',content:'Tea and a little music.'};}
function publicationFixture(){
  let p=written(),current=experience,selected=true,seq=1,accepted:ArtifactPublicationReceipt|null=null;
  const copies=new Map<string,PreparedExperienceArtifact>(),claims=new Map<string,string>(),calls:string[]=[];
  const ports:ExperiencePublicationPorts={assertCurrent(){if(!selected)throw new Error('SCOPE_CHANGED');},async claimReview(id,digest){if(claims.has(id)&&claims.get(id)!==digest)throw new Error('DISCLOSURE_ID_REUSED');claims.set(id,digest);},async prepared(id){return copies.has(id)?structuredClone(copies.get(id)!):null;},async validateSource(r){validateArtifactSource(p,current,r,scope.memberId);},async prepare(copy){calls.push('prepare');copies.set(copy.id,structuredClone(copy));return copy;},async accept(publication){calls.push('accept');if(accepted&&accepted.publication.contentDigest!==publication.contentDigest)throw new Error('REUSED');return accepted??(accepted={version:1,id:publication.id,publication,acceptedSequence:seq++});},async activate(id,receipt){calls.push('activate');expect(receipt).toEqual(accepted);const copy=copies.get(id)!;if(copy.state==='withdrawn')throw new Error('ARTIFACT_WITHDRAWN');copy.state='active';},async revoke(id){calls.push('revoke');const copy=copies.get(id)!;copy.state='withdrawn';return structuredClone(copy);},async withdraw(publication){calls.push('withdraw');return {version:1,id:publication.id,publication,acceptedSequence:seq++};}};
  return {ports,copies,calls,get project(){return p;},set project(v:WorkspaceProject){p=v;},changeExperience(){current={...experience,revision:4};},leave(){selected=false;}};
}
describe('selected intention Workspace authority',()=>{
  it('projects only explicit accepted fields and rejects extra properties, getters and version tampering',()=>{
    const extra={...experience,references:[{kind:'bank',id:'private'}],amount:1200,partnerPrivate:'secret'};
    expect(workspaceExperienceContext(extra)).toEqual(experience);
    expect(()=>decodeWorkspaceExperienceContext(extra)).toThrow();
    expect(()=>decodeWorkspaceExperienceContext({...experience,revision:0})).toThrow();
    let read=false;expect(()=>decodeWorkspaceExperienceContext(Object.defineProperty({...experience},'title',{get(){read=true;return 'secret';}}))).toThrow();expect(read).toBe(false);
    expect(()=>createExperienceWorkspaceProject(scope,workspaceExperienceProjectId(scope,experience.id),experience,workspaceExperienceDigest(experience),{...experience,revision:4},now)).toThrow('EXPERIENCE_CONTEXT_CHANGED');
  });
  it('namespaces projects by environment/household/member/experience and drafts also by signed-in identity',()=>{
    const id=workspaceExperienceProjectId(scope,experience.id);expect(id).toMatch(/^experience_[a-f0-9]{64}$/);
    for(const update of [{environment:'production' as const},{householdId:'HH-other'},{memberId:'MEM-002'}])expect(workspaceExperienceProjectId({...scope,...update},experience.id)).not.toBe(id);
    expect(workspaceExperienceProjectId(scope,'another')).not.toBe(id);
    expect(workspaceExperienceKey({...scope,identity:'another-auth'},experience.id)).not.toBe(workspaceExperienceKey(scope,experience.id));
    expect(()=>createExperienceWorkspaceProject({...scope,memberId:'MEM-002'},id,experience,workspaceExperienceDigest(experience),experience,now)).toThrow('EXPERIENCE_PROJECT_SCOPE_MISMATCH');
  });
  it('makes and revises private authored work without provider permission, then requires exact disclosure before any run',()=>{
    const p=written();expect(p.artifacts[0]?.author).toBe('user');expect(p.runs).toEqual([]);expect(p.experience?.providerApprovalDigest).toBeNull();
    expect(()=>projectContext(p)).toThrow('EXPERIENCE_DISCLOSURE_REQUIRED');
    expect(()=>applyWorkspaceCommand(p,{type:'message',id:'m',text:'Please help'},p.revision,now)).toThrow('EXPERIENCE_DISCLOSURE_REQUIRED');
    const reviewed=applyWorkspaceCommand(p,{type:'approve-experience-disclosure',confirmDigest:workspaceExperienceDigest(experience)},p.revision,now);
    expect(JSON.parse(projectContext(reviewed)).experience).toEqual(experience);
    expect(applyWorkspaceCommand(reviewed,{type:'message',id:'m',text:'Please help'},reviewed.revision,now).messages).toHaveLength(1);
    expect(()=>applyWorkspaceCommand(reviewed,{type:'link',link:{id:'private',kind:'record',recordId:'private',scope:'personal',label:'Private'}},reviewed.revision,now)).toThrow('EXPERIENCE_SCOPE_READ_DENIED');
  });
  it('refreshes exact selected context without losing drafts/artifacts and requires renewed disclosure',()=>{
    let p=written();p=applyWorkspaceCommand(p,{type:'approve-experience-disclosure',confirmDigest:workspaceExperienceDigest(experience)},p.revision,now);
    const changed={...experience,revision:4,title:'A different evening'};
    expect(()=>assertAcceptedWorkspaceExperience(p,changed)).toThrow('EXPERIENCE_CONTEXT_CHANGED');
    const next=applyWorkspaceCommand(p,{type:'refresh-experience',context:changed,previousDigest:p.experience!.digest,confirmDigest:workspaceExperienceDigest(changed)},p.revision,now);
    expect(next.artifacts).toEqual(p.artifacts);expect(next.experience?.providerApprovalDigest).toBeNull();
    expect(()=>applyWorkspaceCommand(next,{type:'approve-experience-disclosure',confirmDigest:p.experience!.digest},next.revision,now)).toThrow('EXPERIENCE_CONTEXT_CHANGED');
  });
  it('denies broad ledger reads even with old broad grants and exposes only selected bounded project context',async()=>{
    let p=written();p=applyWorkspaceCommand(p,{type:'approve-experience-disclosure',confirmDigest:workspaceExperienceDigest(experience)},p.revision,now);
    const read=vi.fn(),context={project:p,id:'tool',now,read,search:vi.fn(),execute:vi.fn()};
    await expect(executeWorkspaceTool('hearth_read',{name:'anything',scope:'personal',argsJson:'{}'},context)).rejects.toThrow('EXPERIENCE_SCOPE_READ_DENIED');expect(read).not.toHaveBeenCalled();
    expect((await executeWorkspaceTool('discover_tools',{},context)).result.reads).toEqual([]);
    expect(JSON.parse(String((await executeWorkspaceTool('project_read',{id:'experience'},context)).result.text))).toEqual(experience);
  });
});
describe('immutable selected-experience artifact copies',()=>{
  it('accepts the exact reviewed copy before activating and excludes private source identity/history',async()=>{
    const f=publicationFixture(),review=reviewFor();const receipt=await publishExperienceArtifact(f.ports,scope,review,experienceArtifactReviewDigest(review));
    expect(f.calls).toEqual(['prepare','accept','activate']);expect(receipt.publication).toEqual(artifactPublication(preparedExperienceArtifact(review,scope.memberId)));
    const payload=JSON.stringify(f.copies.get(review.id));expect(payload).not.toContain(review.projectId);expect(payload).not.toContain('artifactVersionId');expect(payload).not.toContain('Tea, a little music, and a walk.');
  });
  it('recovers a lost acknowledgement using one prepared copy and accepted receipt even after the source is deleted',async()=>{
    const f=publicationFixture(),r=reviewFor();const activate=f.ports.activate;f.ports.activate=vi.fn().mockRejectedValueOnce(new Error('NETWORK')).mockImplementation(activate);
    await expect(publishExperienceArtifact(f.ports,scope,r,experienceArtifactReviewDigest(r))).rejects.toThrow('NETWORK');expect(f.copies.get(r.id)?.state).toBe('prepared');
    f.project=applyWorkspaceCommand(f.project,{type:'delete-artifact',artifactId:'a1',versionId:'a1'},f.project.revision,now);
    await publishExperienceArtifact(f.ports,scope,r,experienceArtifactReviewDigest(r));expect(f.copies.get(r.id)?.state).toBe('active');expect(f.calls.filter(v=>v==='prepare')).toHaveLength(1);
  });
  it('rejects changed source/review/current intention and reuse of a disclosure identity for different private intent',async()=>{
    const f=publicationFixture(),r=reviewFor();f.project=applyWorkspaceCommand(f.project,{type:'edit-artifact',id:'a2',artifactId:'a1',parentId:'a1',content:'Changed privately'},f.project.revision,now);
    await expect(publishExperienceArtifact(f.ports,scope,r,experienceArtifactReviewDigest(r))).rejects.toThrow('ARTIFACT_CHANGED');expect(f.copies.size).toBe(0);
    const g=publicationFixture();g.changeExperience();await expect(publishExperienceArtifact(g.ports,scope,r,experienceArtifactReviewDigest(r))).rejects.toThrow('EXPERIENCE_CONTEXT_CHANGED');
    const h=publicationFixture();await publishExperienceArtifact(h.ports,scope,r,experienceArtifactReviewDigest(r));const changed={...r,artifactVersionId:'different-private-id'};await expect(publishExperienceArtifact(h.ports,scope,changed,experienceArtifactReviewDigest(changed))).rejects.toThrow('DISCLOSURE_ID_REUSED');
    await expect(publishExperienceArtifact(h.ports,scope,{...r,content:'changed'},experienceArtifactReviewDigest(r))).rejects.toThrow('DISCLOSURE_REVIEW_CHANGED');
  });
  it('does not activate on forged or mismatched authoritative receipts',async()=>{
    const f=publicationFixture(),r=reviewFor();f.ports.accept=async publication=>({version:1,id:r.id,publication:{...publication,sharedBy:'MEM-002'},acceptedSequence:1});
    await expect(publishExperienceArtifact(f.ports,scope,r,experienceArtifactReviewDigest(r))).rejects.toThrow('ARTIFACT_RECEIPT_MISMATCH');expect(f.copies.get(r.id)?.state).toBe('prepared');expect(f.calls).not.toContain('activate');
  });
  it('revokes access before recording withdrawal and never resurrects copies on retries or source edits',async()=>{
    const f=publicationFixture(),r=reviewFor();await publishExperienceArtifact(f.ports,scope,r,experienceArtifactReviewDigest(r));f.ports.withdraw=vi.fn().mockRejectedValueOnce(new Error('NETWORK')).mockImplementation(async publication=>({version:1,id:r.id,publication,acceptedSequence:2}));
    await expect(withdrawExperienceArtifact(f.ports,scope,r.id)).rejects.toThrow('NETWORK');expect(f.copies.get(r.id)?.state).toBe('withdrawn');expect(f.project.artifacts).toHaveLength(1);
    expect((await withdrawExperienceArtifact(f.ports,scope,r.id)).publication.state).toBe('withdrawn');await expect(publishExperienceArtifact(f.ports,scope,r,experienceArtifactReviewDigest(r))).rejects.toThrow('ARTIFACT_WITHDRAWN');
    await expect(withdrawExperienceArtifact(f.ports,{...scope,memberId:'MEM-002'},r.id)).rejects.toThrow('ARTIFACT_WITHDRAWAL_FORBIDDEN');
  });
  it('requires exact deliberate review before adding an active shared copy to a private project',()=>{
    const copy={...preparedExperienceArtifact(reviewFor(),scope.memberId),state:'active' as const},p=project();
    expect(()=>adoptReviewedExperienceCopy(p,copy,{type:'adopt-experience-copy',id:'import',copyId:copy.id,contentDigest:'wrong'},0,now)).toThrow();
    const next=adoptReviewedExperienceCopy(p,copy,{type:'adopt-experience-copy',id:'import',copyId:copy.id,contentDigest:copy.contentDigest},0,now);
    expect(next.artifacts[0]?.content).toBe(copy.content);expect(next.evidence[0]?.scope).toBe('household');expect(JSON.stringify(next)).not.toContain('artifactVersionId');
    expect(()=>adoptReviewedExperienceCopy(p,{...copy,state:'withdrawn'},{type:'adopt-experience-copy',id:'import',copyId:copy.id,contentDigest:copy.contentDigest},0,now)).toThrow();
  });
  it('keeps source tombstones without changing shared copies and rejects a scope switch between await stages',async()=>{
    const f=publicationFixture(),r=reviewFor();await publishExperienceArtifact(f.ports,scope,r,experienceArtifactReviewDigest(r));const copy=structuredClone(f.copies.get(r.id));
    f.project=applyWorkspaceCommand(f.project,{type:'delete-artifact',artifactId:'a1',versionId:'a1'},f.project.revision,now);expect(f.project.artifacts).toEqual([]);expect(f.copies.get(r.id)).toEqual(copy);
    expect(()=>applyWorkspaceCommand(f.project,{type:'create-artifact',id:'a1',title:'Reuse',content:'Reuse',format:'markdown'},f.project.revision,now)).toThrow('ARTIFACT_EXISTS');
    const g=publicationFixture();g.ports.validateSource=async()=>{g.leave();};await expect(publishExperienceArtifact(g.ports,scope,r,experienceArtifactReviewDigest(r))).rejects.toThrow('SCOPE_CHANGED');expect(g.copies.size).toBe(0);
  });
});
describe('cancellation and authored resident',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('discards a late parsed response after scope change and cancels in-flight requests',async()=>{
    let resolve!:(v:unknown)=>void;const json=new Promise(r=>{resolve=r;});let signal:AbortSignal|undefined;
    vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{signal=init.signal;return {ok:true,json:()=>json};}));
    const client=new WorkspaceClient('/test',async()=> 'token');const promise=client.request();await new Promise(r=>setTimeout(r,0));client.cancelRequests();resolve({version:1,sequence:1,projects:[],executionEnabled:false});
    await expect(promise).rejects.toThrow('account changed');expect(signal?.aborted).toBe(true);
  });
  it('has free, deterministic, state-aware prompts without partner monitoring or financial inputs',()=>{
    expect(residentWelcome(experience)).toContain('ordinary evening');expect(residentWelcome({...experience,state:'paused'})).toContain('resting');
    expect(residentDraft('possibilities',experience.title).content).toContain('costs nothing');expect(residentWelcome(experience)).toBe(residentWelcome(experience));
  });
});

it('removes only trusted RPC disposal metadata and never weakens the authored-document decoder',()=>{
 const dispose=vi.fn(),symbol=(Symbol as SymbolConstructor&{dispose:symbol}).dispose;
 const dto=Object.defineProperty({...experience},symbol,{value:dispose});expect(()=>decodeWorkspaceExperienceContext(dto)).toThrow();expect(consumeWorkspaceRpc(dto)).toEqual(experience);expect(dispose).toHaveBeenCalledOnce();
 const bad=Object.defineProperty({...experience},'title',{get:()=>{throw new Error('getter executed');}});expect(()=>consumeWorkspaceRpc(bad)).toThrow('INVALID_WORKSPACE_RPC');
 expect(()=>consumeWorkspaceRpc({...experience,[Symbol('unknown')]:true})).toThrow('INVALID_WORKSPACE_RPC');
});
