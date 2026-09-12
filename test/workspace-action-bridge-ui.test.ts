// @vitest-environment jsdom
import {act,createElement,createRef} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
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
function setup(onWorkspaceConfirm?: (id:string)=>Promise<void>){
 let h=catalogHousehold();h.companionProfile=companionFor(h,'MEM-001');const ref=createRef<HerculesActionHandle>();let domainWrites=0;let lostAck=false;let pendingProjection:typeof h|undefined;
 const receipts=new Map<string,'accepted'>();
 const execute:KitchenCommand=async(fn,options)=>{try{const result=fn(structuredClone(h));const domain=capturedIntent(result.household)?.steps.some(s=>s.kind==='executeHerculesAction');if(domain)domainWrites++;h=result.household;if(h.companionProfile?.workflows?.some(r=>r.value?.submission))pendingProjection=structuredClone(h);receipts.set(options!.confirmationId!,'accepted');render();if(domain&&lostAck)return null;return{kind:'synchronized',ok:true,household:h,confirmationId:options?.confirmationId,postedExactlyOnce:true,postedNothing:false} as any;}catch{options?.onDefinitiveRejected?.({retryable:false});return null;}};
 const service:HerculesCommandService={execute,readSubmission:async id=>receipts.get(id)??'missing'};
 function render(){root.render(createElement(HerculesActionPanel,{ref,context:{household:h,memberId:'MEM-001',view:'household',today:'2026-09-10'},service,identity:'synthetic-user:1',onWorkspaceConfirm,onReply:vi.fn()}));}
 return{ref,render,changeCanonical(fn:(current:typeof h)=>typeof h){h=fn(h);render();},get household(){return h;},get pendingProjection(){return pendingProjection!;},get receipts(){return receipts;},get writes(){return domainWrites;},loseAck(){lostAck=true;}};
}
async function click(label:string){await act(async()=>{const button=[...host.querySelectorAll('button')].find(b=>b.textContent===label);expect(button).toBeDefined();button!.click();});}
it('workspace bridge carries its posting identity and awaits authorization before execution',async()=>{
 let authorize!:()=>void; const called:string[]=[];const s=setup(id=>{called.push(id);return new Promise<void>(r=>authorize=r);});await act(async()=>s.render());
 const id=crypto.randomUUID();await act(async()=>s.ref.current!.propose({workspaceConfirmationId:id,actionId:'expense',values:{amount:'24',date:'2026-09-10',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',split:'MEM-001',note:'Synthetic grocery'}}));await click('Review changes');
 await click('Final Confirm');expect(called).toEqual([id]);expect(s.writes).toBe(0);await act(async()=>authorize());expect(s.writes).toBe(1);expect(s.receipts.get(id)==='accepted').toBe(true);
});
it('workspace authorization rejection keeps the editable review and posts nothing',async()=>{
 const s=setup(async()=>{throw Error('PROPOSAL_CHANGED')});await act(async()=>s.render());await act(async()=>s.ref.current!.propose({workspaceConfirmationId:crypto.randomUUID(),actionId:'expense',values:{amount:'24',date:'2026-09-10',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',split:'MEM-001',note:'Synthetic grocery'}}));await click('Review changes');await click('Final Confirm');expect(s.writes).toBe(0);expect(host.textContent).toContain('PROPOSAL_CHANGED');expect(s.ref.current!.state()?.stage).toBe('review');
});
