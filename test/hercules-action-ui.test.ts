// @vitest-environment jsdom
import {act,createElement,createRef} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {HerculesActionPanel,type HerculesActionHandle} from '../src/HerculesActionPanel.tsx';
import {catalogHousehold} from '../src/core/index.ts';
import {companionFor} from '../src/core/herculesCompanion.ts';
import {capturedIntent} from '../src/ledgerSync/capture.ts';
import type {KitchenCommand} from '../src/kitchenCommand.ts';
import type {HerculesCommandService} from '../src/herculesCommandService.ts';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,host:HTMLDivElement;
beforeEach(()=>{localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
function setup(){
 let h=catalogHousehold();h.companionProfile=companionFor(h,'MEM-001');const ref=createRef<HerculesActionHandle>();let domainWrites=0;let lostAck=false;let pendingProjection:typeof h|undefined;
 const receipts=new Map<string,'accepted'>();
 const execute:KitchenCommand=async(fn,options)=>{try{const result=fn(structuredClone(h));const domain=capturedIntent(result.household)?.steps.some(s=>s.kind==='executeHerculesAction');if(domain)domainWrites++;h=result.household;if(h.companionProfile?.workflows?.some(r=>r.value?.submission))pendingProjection=structuredClone(h);receipts.set(options!.confirmationId!,'accepted');render();if(domain&&lostAck)return null;return{kind:'synchronized',ok:true,household:h,confirmationId:options?.confirmationId,postedExactlyOnce:true,postedNothing:false} as any;}catch{options?.onDefinitiveRejected?.({retryable:false});return null;}};
 const service:HerculesCommandService={execute,readSubmission:async id=>receipts.get(id)??'missing'};
 function render(){root.render(createElement(HerculesActionPanel,{ref,context:{household:h,memberId:'MEM-001',view:'household',today:'2026-09-10'},service,identity:'synthetic-user:1',onReply:vi.fn()}));}
 return{ref,render,changeCanonical(fn:(current:typeof h)=>typeof h){h=fn(h);render();},get household(){return h;},get pendingProjection(){return pendingProjection!;},get writes(){return domainWrites;},loseAck(){lostAck=true;}};
}
async function click(label:string){await act(async()=>{const button=[...host.querySelectorAll('button')].find(b=>b.textContent===label);expect(button).toBeDefined();button!.click();});}
async function completeDraft(s:ReturnType<typeof setup>){await act(async()=>s.ref.current!.propose({actionId:'expense',values:{amount:'24',date:'2026-09-10',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',split:'MEM-001',note:'Synthetic grocery'}}));await click('Review changes');}
describe('conversational review controls',()=>{
 it('accepts a Plan proposal with reordered dependent fields and confirms one private edit', async()=>{
  const {planLifeFixture}=await import('./fixtures/plan-life.ts');const s=setup();
  await act(async()=>s.changeCanonical(()=>{const h=planLifeFixture('household');h.companionProfile=companionFor(h,'MEM-001');return h;}));
  const before=s.household.transactions;
  await act(async()=>s.ref.current!.propose({actionId:'plan-line-change',values:{planLineId:'life-trip',amount:'150',draftId:'LIFE-DRAFT'}}));
  expect(companionFor(s.household,'MEM-001').workflows?.find(row=>row.id==='task-household')?.value?.values).toMatchObject({draftId:'LIFE-DRAFT',planLineId:'life-trip',amount:'150'});
  await click('Review changes');expect(s.writes).toBe(0);expect(host.textContent).toContain('Keep Friday evenings free.');
  await click('Final Confirm');expect(s.writes).toBe(1);expect(s.household.transactions).toEqual(before);
  expect(s.household.planDrafts![0]!.lines.find(row=>row.id==='life-trip')!.amountCents).toBe(15000);
 });
 it('model details only prepare; ordinary agreement and double confirmation never duplicate a write',async()=>{const s=setup();await act(async()=>s.render());await completeDraft(s);expect(s.writes).toBe(0);await act(async()=>{s.ref.current!.send('yes');s.ref.current!.send('"final confirm"');});expect(s.writes).toBe(0);await act(async()=>{s.ref.current!.send('FINAL CONFIRM');s.ref.current!.send('final confirm');});expect(s.writes).toBe(1);expect(host.textContent).toContain('Saved.');});
 it('edits invalidate review until a fresh review is shown',async()=>{const s=setup();await act(async()=>s.render());await completeDraft(s);expect(document.activeElement?.textContent).toBe('Check your changes');await act(async()=>{s.ref.current!.send('change amount to 25');});expect(host.textContent).not.toContain('Final ConfirmEdit details');await act(async()=>s.ref.current!.send('final confirm'));expect(s.writes).toBe(0);await click('Review changes');await click('Final Confirm');expect(s.household.transactions.at(-1)?.amountCents).toBe(2500);});
 it('keeps newer manual edits when an older model proposal arrives',async()=>{const s=setup();await act(async()=>s.render());await completeDraft(s);const fingerprint=s.ref.current!.fingerprint();await act(async()=>s.ref.current!.send('change amount to 25'));await act(async()=>s.ref.current!.propose({actionId:'expense',values:{amount:'24'}},fingerprint));await click('Review changes');await click('Final Confirm');expect(s.household.transactions.at(-1)?.amountCents).toBe(2500);});
 it('keeps compound actions separate and never carries confirmation into the next task',async()=>{const s=setup();await act(async()=>s.render());await act(async()=>s.ref.current!.send('I spent $24; add a to-do'));expect(host.textContent).toContain('Each task needs its own review');await completeDraft(s);await click('Final Confirm');expect(s.writes).toBe(1);expect(s.ref.current!.state()?.actionId).toBe('task');await act(async()=>s.ref.current!.send('final confirm'));expect(s.writes).toBe(1);expect(host.textContent).toContain('Review a prepared action');});
 it.each(['edited','completed'])('adopts current authoritative queue after lost receipt when the next task was %s elsewhere',async(mode)=>{const s=setup();s.loseAck();await act(async()=>s.render());await act(async()=>s.ref.current!.send('I spent $24; add a to-do'));await completeDraft(s);await click('Final Confirm');expect(s.writes).toBe(1);await act(async()=>s.changeCanonical(h=>({...h,companionProfile:{...h.companionProfile!,workflows:h.companionProfile!.workflows!.map(r=>({...r,revision:r.revision+1,value:mode==='completed'?null:{...r.value!,values:{title:'Changed on another device'}}}))}})));await click('Check action status');expect(s.writes).toBe(1);if(mode==='completed')expect(s.ref.current!.state()).toBeUndefined();else{expect(s.ref.current!.state()?.actionId).toBe('task');expect((host.querySelector('input') as HTMLInputElement).value).toBe('Changed on another device');}await act(async()=>s.ref.current!.send('final confirm'));expect(s.writes).toBe(1);});
 it('waits for a post-claim revision when receipt lookup overtakes the projection after reload',async()=>{
  const s=setup();s.loseAck();await act(async()=>s.render());await completeDraft(s);
  const predecessor=structuredClone(s.household);
  await click('Final Confirm');const accepted=structuredClone(s.household);
  await act(async()=>root.unmount());root=createRoot(host);
  await act(async()=>s.changeCanonical(()=>predecessor));
  await click('Check action status');
  expect(host.textContent).toMatch(/waiting/i);
  await act(async()=>root.unmount());root=createRoot(host);await act(async()=>s.render());
  expect(host.textContent).toMatch(/waiting/i);
  expect(s.ref.current!.state()).toBeUndefined();
  await act(async()=>s.ref.current!.send('final confirm'));expect(s.writes).toBe(1);
  await act(async()=>s.changeCanonical(()=>s.pendingProjection));
  expect(s.ref.current!.state()).toBeUndefined();expect(host.textContent).toMatch(/waiting/i);
  await act(async()=>root.unmount());root=createRoot(host);await act(async()=>s.render());
  expect(s.ref.current!.state()).toBeUndefined();expect(host.textContent).toMatch(/waiting/i);
  await act(async()=>s.changeCanonical(()=>accepted));
  expect(s.ref.current!.state()).toBeUndefined();expect(host.textContent).not.toContain('Check action status');
 });
 it('keeps receipt recovery visible when a pending capability becomes unavailable',async()=>{const s=setup();await act(async()=>s.changeCanonical(h=>({...h,companionProfile:{...h.companionProfile!,workflows:[{id:'task-household',revision:1,value:{version:1,actionId:'future-action',view:'household',generation:0,values:{},updatedAt:new Date().toISOString(),submission:{id:crypto.randomUUID(),review:'{}'}}}]}})));expect(host.textContent).toContain('Check action status');expect(s.ref.current!.state()).toBeUndefined();await act(async()=>s.ref.current!.send('What happened?'));expect(host.textContent).toContain('Check action status');});
 it('retains an unknown acknowledgement until the original receipt is checked',async()=>{const s=setup();s.loseAck();await act(async()=>s.render());await completeDraft(s);await click('Final Confirm');expect(s.writes).toBe(1);expect(host.textContent).toContain('Check action status');await click('Check action status');expect(s.writes).toBe(1);expect(host.textContent).toContain('original confirmation was found');});
});

it('recognizes a Visa, walks through skippable card terms, then requires exact confirmation',async()=>{
 const s=setup();await act(async()=>s.render());
 const send=async(text:string)=>act(async()=>{expect(s.ref.current!.send(text)).toBe(true);});
 await send('Add a visa card');expect(s.ref.current!.state()?.missingFields).toEqual(['Name']);
 await send('Visa Aeroplan');expect(host.textContent).toContain('Account details');
 await send('yes');await send('TD');await send('skip');await send('5000');await send('20.99%');await send('0');await send('skip');await send('15');await send('21');
 expect(s.writes).toBe(0);await click('Review changes');expect(host.textContent).toContain('20.99%');expect(host.textContent).toContain('0%');
 await send('actually, change annual interest rate (%) to 19.99');expect(s.writes).toBe(0);await send('final confirm');expect(s.writes).toBe(0);
 await click('Review changes');await click('Final Confirm');expect(s.writes).toBe(1);
 expect(s.household.accounts.at(-1)).toMatchObject({name:'Visa Aeroplan',kind:'credit',institution:'TD',credit:{aprBps:1999,defaultCashbackBps:0,statementDay:15,creditLimitCents:500000}});
});
it('can skip account details and reviews the actual unverified defaults',async()=>{
 const s=setup();await act(async()=>s.render());for(const message of ['Add a credit card','My Visa','skip'])await act(async()=>{expect(s.ref.current!.send(message)).toBe(true);});
 await click('Review changes');expect(host.textContent).toContain('Hearth default, unverified');expect(host.textContent).toContain('19.99%');expect(s.writes).toBe(0);
 await click('Final Confirm');expect(s.household.accounts.at(-1)?.kind).toBe('credit');expect(s.writes).toBe(1);
});

it('keeps paused planning out of all implicit answer parsing and restores the pause after remount',async()=>{
 const s=setup();await act(async()=>s.render());
 await act(async()=>s.ref.current!.propose({actionId:'plan-guided-draft',values:{monthKey:'2026-09',purpose:'Keep Friday evenings free'}}));
 const before={...s.household.companionProfile!.workflows![0]!.value!.values};
 await act(async()=>{expect(s.ref.current!.send('pause planning')).toBe(true);});
 for(const message of ['What can you do?','Are my shifts posted this week?','Let us talk about something else']){
  await act(async()=>{expect(s.ref.current!.send(message)).toBe(false);});
 }
 expect(s.household.companionProfile!.workflows![0]!.value!.values).toEqual({...before,guidePaused:'true'});
 await act(async()=>root.unmount());root=createRoot(host);await act(async()=>s.render());
 expect(host.textContent).toContain('planning conversation is paused');
 await click('Continue planning');expect(host.textContent).not.toContain('planning conversation is paused');
 expect(s.household.companionProfile!.workflows![0]!.value!.values).toEqual(before);expect(s.writes).toBe(0);
});
it('routes real side questions out of an active guide and keeps its answers intact',async()=>{
 const s=setup();await act(async()=>s.render());
 await act(async()=>s.ref.current!.propose({actionId:'plan-guided-draft',values:{monthKey:'2026-09',purpose:'Keep Friday evenings free'}}));
 const before={...s.household.companionProfile!.workflows![0]!.value!.values};
 for(const message of ['Are my shifts posted this week?','Can you walk me through setup here?','How does a Kitty Bank work?']){
  await act(async()=>{expect(s.ref.current!.send(message)).toBe(false);});
 }
 expect(s.household.companionProfile!.workflows![0]!.value!.values).toEqual(before);
 await act(async()=>{expect(s.ref.current!.send('Put the plan draft aside for a moment. Can we talk about setup?')).toBe(false);});
 expect(s.household.companionProfile!.workflows![0]!.value!.values).toEqual({...before,guidePaused:'true'});
 expect(s.writes).toBe(0);
});
it('the visible action library queues paused Workspace proposals with their original confirmation linkage',async()=>{
 const s=setup();await act(async()=>s.render());
 await act(async()=>s.ref.current!.propose({actionId:'plan-guided-draft',values:{monthKey:'2026-09',purpose:'Keep Friday evenings free'},workspaceConfirmationId:'workspace-confirmation'}));
 await act(async()=>{s.ref.current!.send('pause planning');});
 const original=structuredClone(s.household.companionProfile!.workflows![0]!.value!);
 await click('Things we can do');await click('Add a to-do');
 expect(s.household.companionProfile!.workflows![0]!.value!.queue![0]).toEqual({actionId:original.actionId,values:original.values,workspaceConfirmationId:'workspace-confirmation'});
 await act(async()=>{s.ref.current!.send('cancel');});
 expect(host.textContent).toContain('planning conversation is paused');
 expect(s.household.companionProfile!.workflows![0]!.value!.workspaceConfirmationId).toBe('workspace-confirmation');
 expect(s.writes).toBe(0);
});


it('sets up a missing job with a separate review and resumes the original shift', async () => {
 const s=setup(); await act(async()=>s.render());
 const bridge=crypto.randomUUID();
 await act(async()=>s.ref.current!.propose({actionId:'worked-shift',workspaceConfirmationId:bridge,values:{date:'2026-09-10',workedHours:'6',paidBreakHours:'0'}}));
 await click('Set up a job first');
 expect(s.ref.current!.state()?.actionId).toBe('add-job');
 await act(async()=>s.ref.current!.propose({actionId:'add-job',values:{name:'Cafe Moonbeam',roleName:'Server',effectiveDate:'2026-09-01',grossRate:'18',takeHomeMethod:'deductions',deductionPercent:'22',tipped:'no',wagesAccountId:'ACC-CHEQUING',overtime:'no',payCadence:'irregular'}}));
 await click('Review changes'); expect(s.writes).toBe(0); await click('Final Confirm');
 expect(s.writes).toBe(1);expect(s.household.transactions).toHaveLength(0);
 expect(s.ref.current!.state()?.actionId).toBe('worked-shift');
 const resumed=companionFor(s.household,'MEM-001').workflows!.find(w=>w.id==='task-household')!.value!;
 expect(resumed).toMatchObject({values:{date:'2026-09-10',workedHours:'6',paidBreakHours:'0',jobId:s.household.workJobs[0]!.id,roleId:'ROLE-1'},workspaceConfirmationId:bridge,submission:null});
 await act(async()=>s.ref.current!.send('final confirm'));expect(s.household.shifts).toHaveLength(0);
});
