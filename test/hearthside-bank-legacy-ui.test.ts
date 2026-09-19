// @vitest-environment jsdom
import {webcrypto} from 'node:crypto';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {HouseholdHome} from '../src/HouseholdHome.tsx';
import {KittyBankRoom,type KittyCommandOptions} from '../src/kitty/KittyBankRoom.tsx';
import {acceptHouseholdWrite,catalogHousehold,type Household,type CommitResult} from '../src/core/index.ts';
import {acceptedLegacyCreatedBank,kittyUsesLedgerReceipts} from '../src/hearthside/legacyBankAcceptance.ts';
vi.mock('../src/kitty/KittyStage.tsx',()=>({KittyStage:()=>createElement('div',{'data-kitty-stage':true})}));
vi.mock('../src/kitty/studio/flat.tsx',()=>({KittyFlat:()=>createElement('svg')}));
let root:Root,host:HTMLDivElement,h:Household,entry:'home'|'kitty',reject=false,lose=false,oldLabel=false,uncertain=false;
const calls:string[]=[],persisted:Household[]=[];
const button=(text:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===text)!;
const click=async(text:string)=>{expect(button(text),text).toBeTruthy();await act(async()=>{button(text).click();await new Promise(r=>setTimeout(r,40));});};
async function waitForUi(assertion:()=>void,timeout=5000){const deadline=Date.now()+timeout;let last:unknown=Error('UI condition was not met.');while(Date.now()<deadline){try{assertion();return;}catch(error){last=error;}await act(async()=>{await new Promise(r=>setTimeout(r,15));});}throw last;}
async function input(label:string,value:string){const el=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent?.trim()===label)!.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}
async function command(fn:(current:Household)=>CommitResult,options?:KittyCommandOptions){
 expect(options?.recoverConfirmation).not.toBe(true);const id=options!.confirmationId!;calls.push(id);const result=fn(h);
 const outcome=await acceptHouseholdWrite({previous:h,candidate:result.household,confirmationId:id,postedIds:result.postedIds,actingMemberId:'MEM-001',commandKind:oldLabel?result.undo.label:result.undo.commandKind??result.undo.label,adapters:{persist:async value=>{persisted.push(value);},ingest:async()=>reject?{ok:false,error:'Synthetic books rejection'}:{ok:true},validateCandidate:async()=>reject?{ok:false,error:'Synthetic books rejection'}:{ok:true}}});
 if(outcome.ok){h=outcome.household;draw();}else options?.onDefinitiveRejected?.();if(lose){lose=false;throw Error('Reply lost after actual acceptance');}return uncertain?{...outcome,ok:false,kind:'recovery-available' as const,postedNothing:false}:outcome;
}
function draw(){root.render(entry==='home'?createElement(HouseholdHome,{household:h,memberId:'MEM-001',today:'2026-09-12',freshness:'current',busy:false,onCommand:command,onGo:()=>{},onOpenSetup:()=>{},creationIdentity:'legacy-proof'}):createElement(KittyBankRoom,{household:h,view:'personal',memberId:'MEM-001',identity:'legacy-proof',creationIdentity:'legacy-proof',onCommand:command,onClose:()=>{}}));}
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(0),0));localStorage.clear();sessionStorage.clear();h={...catalogHousehold('production'),goals:[],goalContributions:[]};calls.length=0;persisted.length=0;reject=false;lose=false;oldLabel=false;uncertain=false;entry='home';host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function begin(which:'home'|'kitty'='home'){entry=which;await act(async()=>draw());if(which==='home')await click('Build your King');await click('＋ New bank');await input('Bank name','A little time away');await input('How much (CAD)','120');await click(`Review ${which==='home'?'shared':'personal'} bank`);expect(calls).toEqual([]);expect(document.querySelector('.guard')!.textContent).toContain('No money will be moved.');}
for(const which of ['home','kitty'] as const)it(`accepts existing non-v2 ${which} creation only after Final Confirm and selects the actual accepted goal`,async()=>{
 await begin(which);await click('Final Confirm');await waitForUi(()=>{expect(calls).toHaveLength(1);expect(persisted).toHaveLength(1);expect(h.goals).toHaveLength(1);expect(document.querySelector('.guard')).toBeNull();expect(document.querySelector('.kitty-bank-tabs [aria-pressed=true]')?.textContent).toContain('A little time away');});expect(h.goals[0]).toMatchObject({name:'A little time away',targetCents:12000,shared:which==='home',ownerMemberId:which==='home'?null:'MEM-001'});expect(document.body.textContent).not.toContain('SCOPE_CLOSED');expect([...Object.keys(localStorage)].filter(k=>k.includes('bank-create'))).toEqual([]);
});
it('keeps rejected non-v2 details editable and creates no bank before a new explicit confirmation',async()=>{
 reject=true;await begin();await click('Final Confirm');await waitForUi(()=>expect(document.body.textContent).toContain('This creation was rejected'));expect(h.goals).toEqual([]);expect(persisted).toEqual([]);const rejectedId=calls[0];await click('Cancel');expect((document.querySelector('form.kitty-folio input')as HTMLInputElement).value).toBe('A little time away');reject=false;await click('Review shared bank');await click('Final Confirm');await waitForUi(()=>{expect(calls).toHaveLength(2);expect(h.goals).toHaveLength(1);});expect(calls[1]).not.toBe(rejectedId);
});
it('recovers a previously stuck legacy creation from its actual older receipt after reload without resubmission',async()=>{
 oldLabel=true;lose=true;await begin();await click('Final Confirm');await waitForUi(()=>{expect(h.goals).toHaveLength(1);expect(button('Check saved creation')).toBeTruthy();});const key=Object.keys(localStorage).find(k=>k.includes('bank-create'))!,saved=JSON.parse(localStorage.getItem(key)!);delete saved.authority;localStorage.setItem(key,JSON.stringify(saved));
 await act(async()=>root.unmount());root=createRoot(host);await act(async()=>draw());await click('Build your King');await click('Check saved creation');await waitForUi(()=>{expect(calls).toHaveLength(1);expect(persisted).toHaveLength(1);expect(h.goals).toHaveLength(1);expect(document.querySelector('.guard')).toBeNull();expect(localStorage.getItem(key)).toBeNull();});
});
it('does not downgrade an attempted v2 review when its receipt service disappears',async()=>{
 await begin();const key=Object.keys(localStorage).find(k=>k.includes('bank-create'))!,saved=JSON.parse(localStorage.getItem(key)!);saved.authority='ledger-v2';saved.attempted=true;localStorage.setItem(key,JSON.stringify(saved));await act(async()=>root.unmount());root=createRoot(host);await act(async()=>draw());await click('Build your King');await click('Check saved creation');await waitForUi(()=>expect(document.body.textContent).toContain('belongs to the receipt service'));expect(calls).toEqual([]);expect(h.goals).toEqual([]);
});
it('requires an accepted result and receipt, and selects transport by writer capability rather than live socket availability',()=>{
 const scope={identity:'proof',environment:h.environment,householdId:h.householdId,memberId:'MEM-001'};
 expect(()=>acceptedLegacyCreatedBank({ok:true,kind:'accepted-local',confirmationId:'fake',household:h,postedIds:[]},'fake',scope,'household',{name:'Fake',target:'1'})).toThrow();
 expect(kittyUsesLedgerReceipts(false,{linked:true},null)).toBe(false);expect(kittyUsesLedgerReceipts(true,{linked:false},null)).toBe(false);expect(kittyUsesLedgerReceipts(true,{linked:true},null)).toBe(true);expect(kittyUsesLedgerReceipts(true,{linked:false},'local:MEM-001')).toBe(true);
});

it('does not release a confirmation identity when an accepted write returns an uncertain false outcome',async()=>{
 uncertain=true;await begin();await click('Final Confirm');await waitForUi(()=>{expect(h.goals).toHaveLength(1);expect(document.body.textContent).toContain('Acceptance is not confirmed');expect([...document.querySelectorAll<HTMLButtonElement>('.guard button')].find(b=>b.textContent?.trim()==='Cancel')?.disabled).toBe(true);});const id=calls[0];uncertain=false;await click('Check saved creation');await waitForUi(()=>{expect(calls).toEqual([id]);expect(persisted).toHaveLength(1);expect(document.querySelector('.guard')).toBeNull();});
});
