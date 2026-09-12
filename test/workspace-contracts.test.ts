import { describe, expect, it, vi } from 'vitest';
import { applyWorkspaceCommand, createWorkspaceProject, disclosedArtifact, latestArtifacts, WORKSPACE_INPUT_LIMIT, type ArtifactVersion } from '../src/workspace/contracts.ts';
import { newWorkspaceRun, projectContext, runCanAdvance } from '../src/workspace/runtime.ts';
import { executeWorkspaceTool } from '../workers/workspace/tools.ts';
import { publicSourceUrl } from '../workers/workspace/research.ts';
import { externalReviewDigest } from '../src/workspace/external.ts';
const now = new Date().toISOString();
const make = () => createWorkspaceProject(crypto.randomUUID(), 'Life around us', 'MEM-001', now);
describe('Hercules workspace contracts and evidence', () => {
  it('pivots naturally while preserving research, original messages, and unrelated tasks', () => {
    let p = make(); p.decisions = ['Keep Saturday morning free']; p.tasks = [{id:'research',title:'Compare three options',done:false}];
    p = applyWorkspaceCommand(p, {type:'message',id:crypto.randomUUID(),text:'Plan the month'}, 0, now);
    p.runs.push(newWorkspaceRun(p,crypto.randomUUID(),'grant',now));
    const previous=p.runs[0]!;
    p=applyWorkspaceCommand(p,{type:'message',id:crypto.randomUUID(),text:'No, I want to save for a date with Bianca. Move it to next Friday and compare cheaper options.'},p.revision,now);
    expect(p.decisions).toEqual(['Keep Saturday morning free']);expect(p.tasks).toHaveLength(1);expect(p.messages).toHaveLength(2);
    expect(p.runs[0]?.status).toBe('superseded');expect(runCanAdvance(p,previous)).toBe(false);
  });
  it('rejects stale edits, duplicate identities, and oversized input without truncation', () => {
    let p=make(); const id=crypto.randomUUID();
    p=applyWorkspaceCommand(p,{type:'message',id,text:'x'.repeat(2000)},0,now);expect(p.messages[0]?.text).toHaveLength(2000);
    expect(()=>applyWorkspaceCommand(p,{type:'message',id:crypto.randomUUID(),text:'changed'},0,now)).toThrow('WORKSPACE_CHANGED');
    expect(()=>applyWorkspaceCommand(p,{type:'message',id,text:'duplicate'},1,now)).toThrow('MESSAGE_EXISTS');
    expect(()=>applyWorkspaceCommand(p,{type:'message',id:crypto.randomUUID(),text:'x'.repeat(WORKSPACE_INPUT_LIMIT+1)},1,now)).toThrow('TEXT_REQUIRED');
  });
  it('changes execution generation on pause and resume and preserves the original budget', () => {
    let p=make();p.runs.push(newWorkspaceRun(p,'run','grant',now));p.runs[0]!.usage.inputTokens=4500;
    p=applyWorkspaceCommand(p,{type:'control',runId:'run',action:'pause'},0,now);expect(p.runs[0]?.generation).toBe(1);
    p=applyWorkspaceCommand(p,{type:'control',runId:'run',action:'resume'},1,now);expect(p.runs[0]?.generation).toBe(2);expect(p.runs[0]?.usage.inputTokens).toBe(4500);
  });
  it('retains originals outside a bounded context packet with explicit retrieval ids',()=>{
    let p=make();for(let i=0;i<6;i++)p=applyWorkspaceCommand(p,{type:'message',id:`message-${i}`,text:'x'.repeat(20000)},p.revision,now);
    const packet=JSON.parse(projectContext(p));expect(packet.omittedMessageIds.length).toBeGreaterThan(0);expect(p.messages).toHaveLength(6);
  });
  it('keeps sharing to an exact reviewed copy, excluding private provenance and ancestry',()=>{
    const a:ArtifactVersion={id:'v1',artifactId:'a',title:'Private draft',format:'markdown',content:'private details',parentId:'private-parent',createdAt:now,author:'hercules',evidenceIds:['personal-source'],validation:{status:'passed',details:'private'}};
    expect(disclosedArtifact(a,'Deliberately shared text','Our plan')).toEqual({title:'Our plan',format:'markdown',content:'Deliberately shared text'});
  });
  it('makes useful documents and checks source versions without a financial writer',async()=>{
    const p=make(), read=vi.fn(), search=vi.fn(), execute=vi.fn();
    const output=await executeWorkspaceTool('artifact_write',{artifactId:'lesson',title:'Study notes',format:'markdown',content:'# Fractions\nA worked example: 1/2 + 1/4 = 3/4.',evidenceIds:[]},{project:p,id:'v1',now,read,search,execute});
    p.artifacts.push(output.effect!.artifact!);
    const verified=await executeWorkspaceTool('verify_artifact',{artifactId:'lesson'},{project:p,id:'v2',now,read,search,execute});
    expect(verified.result.status).toBe('passed');p.artifacts.push(verified.effect!.artifact!);expect(latestArtifacts(p)[0]?.parentId).toBe('v1');expect(read).not.toHaveBeenCalled();
    await expect(executeWorkspaceTool('execute_command',{}, {project:p,id:'bad',now,read,search,execute})).rejects.toThrow('UNKNOWN_TOOL');
  });
  it('prevents injected private canaries from leaving through public search',async()=>{
    const p=make(), search=vi.fn().mockResolvedValue([]), context={project:p,id:'search',now,read:vi.fn(),search,execute:vi.fn()};
    p.publicResearchQueries=['Toronto museum opening hours'];
    const blocked=await executeWorkspaceTool('web_search',{query:'My secret account CANARY-7429'},context);
    expect(blocked.result.error).toBe('PUBLIC_QUERY_REVIEW_REQUIRED');expect(search).not.toHaveBeenCalled();
    await executeWorkspaceTool('web_search',{query:'Toronto museum opening hours'},context);expect(search).toHaveBeenCalledOnce();
  });
  it('checks arithmetic with explicit evidence origin and rejects invalid projections',async()=>{
    const c={project:make(),id:'calculation',now,read:vi.fn(),search:vi.fn(),execute:vi.fn()};
    expect((await executeWorkspaceTool('calculate',{operation:'sum',values:[12000,3500],origin:'hypothetical',explanation:'Example trip costs in cents'},c)).result.value).toBe(15500);
    await expect(executeWorkspaceTool('calculate',{operation:'divide',values:[4,0],origin:'projection',explanation:'test'},c)).rejects.toThrow('INVALID_CALCULATION');
  });
  it('rejects local and credential-bearing research destinations and binds external review edits',()=>{
    for(const url of ['https://127.0.0.1/x','https://localhost/x','https://user:pass@example.com','http://example.com','https://hearth.workers.dev'])expect(()=>publicSourceUrl(url)).toThrow();
    expect(publicSourceUrl('https://example.com/article').hostname).toBe('example.com');
    const review={id:crypto.randomUUID(),projectId:crypto.randomUUID(),action:'document' as const,title:'Research',content:'A reviewed document'};
    expect(externalReviewDigest(review)).not.toBe(externalReviewDigest({...review,content:'Changed'}));
  });
  it('cancels a scheduled follow-up without allowing its queued run to execute later',()=>{
    let p=make();const at=new Date(Date.now()+3600000).toISOString();p.followUp={at,instruction:'Check the research'};
    const run=newWorkspaceRun(p,'scheduled','grant',at);run.scheduledFor=at;p.runs.push(run);
    p=applyWorkspaceCommand(p,{type:'follow-up',at:null,instruction:''},p.revision,now);
    expect(p.runs[0]?.status).toBe('cancelled');expect(runCanAdvance(p,p.runs[0]!)).toBe(false);
  });
  it('bounds large project memory while retaining a retrieval route and proposal receipts',()=>{
    const p=make();p.decisions=Array.from({length:100},()=> 'x'.repeat(4000));p.constraints=[...p.decisions];p.questions=[...p.decisions];
    const packet=projectContext(p);expect(packet.length).toBeLessThan(140000);expect(JSON.parse(packet).contextCounts.decisions).toBe(100);expect(packet).toContain('id=context');expect(p.decisions[99]).toHaveLength(4000);
  });
});
