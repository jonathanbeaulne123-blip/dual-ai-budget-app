// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { FeedbackReviewCard } from '../src/workspace/FeedbackReview.tsx';
import { createWorkspaceProject } from '../src/workspace/contracts.ts';
import { normalizeFeedback, feedbackValues } from '../src/workspace/feedback.ts';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement,root:ReturnType<typeof createRoot>,props:any;
const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label)!;
async function click(label:string){await act(async()=>button(label).click());}
async function input(label:string,value:string){const el=[...host.querySelectorAll('label')].find(l=>l.textContent?.startsWith(label))!.querySelector('input,textarea')!;await act(async()=>{Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}
const issue=()=>host.querySelectorAll('textarea')[0] as HTMLTextAreaElement;
async function render(){await act(async()=>root.render(createElement(FeedbackReviewCard,props)));}
beforeEach(async()=>{
 sessionStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const draft=normalizeFeedback({page:'Hercules',feature:'Send',issue:'No reply',expected:'A reply',steps:'Send hello',owner:'Person',urgency:'5',context:{scope:'personal',theme:'classic'}});
 const proposal={id:'proposal',revision:1,artifactVersionId:null,scope:'personal',target:'feedback',actionId:'report-bug',values:feedbackValues(draft),status:'draft',receiptId:null,reviewedRevision:null};
 const project=createWorkspaceProject('p','Bug','MEM-001',new Date().toISOString());project.proposals.push(proposal as any);
 props={project,proposal,records:[],draftKey:'feedback-test-'+crypto.randomUUID(),connected:true,busy:false,onSave:vi.fn().mockResolvedValue(true),onSubmit:vi.fn(async(r:any,d:string)=>({id:r.id,digest:d,status:'uncertain'})),onRefresh:vi.fn()};await render();
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
it('requires reviewed submission; manual edits need save and use the current project revision after progress',async()=>{
 expect(props.onSubmit).not.toHaveBeenCalled();await input('What happened?','Corrected issue');expect(button('Submit this report').disabled).toBe(true);
 props={...props,project:{...props.project,revision:8}};await render();await click('Save report edits for Hercules');expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({issue:'Corrected issue'}),1,8);
});
it('preserves manual edits on stable proposal updates and explicitly lets the user keep them',async()=>{
 await input('What happened?','My manual correction');props={...props,proposal:{...props.proposal,revision:2,values:{...props.proposal.values,issue:'Model update'}}};await render();expect(issue().value).toBe('My manual correction');await click('Keep my edits over Hercules’s update');expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({issue:'My manual correction'}),2,0);
});
it('can remove app context and reports invalid urgency without an unhandled rejection',async()=>{
 await act(async()=>host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());await input('Urgency','11');await click('Save report edits for Hercules');expect(host.textContent).toContain('whole number from 1 to 10');expect(props.onSave).not.toHaveBeenCalled();
 await input('Urgency','7');await click('Save report edits for Hercules');expect(JSON.parse(props.onSave.mock.calls[0][0].contextJson)).toEqual({theme:'classic'});
});
it('retries the original report identity and locks its exact review after an uncertain result',async()=>{
 await click('Submit this report');const first=props.onSubmit.mock.calls[0][0];expect(issue().disabled).toBe(true);await click('Check original report receipt');expect(props.onSubmit.mock.calls[1][0]).toEqual(first);
});
it('renders another device’s pending exact review instead of this device’s unsaved text',async()=>{
 await input('What happened?','Local unsaved');const draft={...normalizeFeedback(props.proposal.values),issue:'Submitted on another device',context:{}};
 props={...props,records:[{review:{id:crypto.randomUUID(),projectId:'p',proposalId:'proposal',proposalRevision:1,instructionRevision:0,draft},receipt:{id:'remote',digest:'remote',status:'uncertain'}}]};await render();expect(issue().value).toBe('Submitted on another device');expect(issue().disabled).toBe(true);
});
it('unlocks a proven-unsent second identity and refreshes the real pending receipt',async()=>{
 props.onSubmit.mockRejectedValue(new Error('FEEDBACK_RECEIPT_PENDING'));await click('Submit this report');expect(issue().disabled).toBe(false);expect(props.onRefresh).toHaveBeenCalled();expect(host.textContent).toContain('Another version');
});
it('keeps missing-connection drafts editable, with no Google access requested',async()=>{
 props={...props,connected:false};await render();expect(button('Submit this report').disabled).toBe(true);await input('What happened?','Keep this draft');expect(issue().value).toBe('Keep this draft');expect(props.onSubmit).not.toHaveBeenCalled();
});
