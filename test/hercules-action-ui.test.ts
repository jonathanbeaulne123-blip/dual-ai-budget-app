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
