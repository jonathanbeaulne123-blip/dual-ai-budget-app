// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Hearthside from '../src/hearthside/Hearthside.tsx';
import { catalogHousehold, addGoal, fundGoal, type CommitResult, type Household, type CommandOutcome } from '../src/core/index.ts';
import { saveNativeEvent } from '../src/core/nativeEvents.ts';
import { splitForSync } from '../src/core/sync.ts';
import { financialAuditHash } from '../src/core/commandIdentity.ts';
import { capturedIntent } from '../src/ledgerSync/capture.ts';
import { commandFromCapture, type Scope } from '../src/ledgerSync/protocol.ts';
import { prepareCommand, type AuthorityState } from '../src/ledgerSync/authority.ts';
import { memoryKeptByEveryone } from '../src/hearthside/contracts.ts';
import type { KitchenCommand } from '../src/kitchenCommand.ts';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); history.replaceState(null,'','/');
  host=document.createElement('div'); document.body.append(host); root=createRoot(host);
  vi.stubGlobal('IntersectionObserver',class {observe(){} disconnect(){}});
  vi.stubGlobal('requestAnimationFrame', (fn:FrameRequestCallback) => {fn(0);return 1;});
});
afterEach(async () => {await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});

function button(label:string) {
  const found=[...host.querySelectorAll('button')].find(b=>{const copy=b.cloneNode(true) as HTMLElement;for(const hidden of copy.querySelectorAll('[aria-hidden="true"]'))hidden.remove();return copy.textContent?.trim()===label;});
  if(!found)throw Error(`Missing button: ${label}`);
  return found;
}
async function settle() { for(let i=0;i<100&&[...host.querySelectorAll('[role="status"]')].some(node=>node.textContent?.includes('Saving…'));i++) await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));}); expect([...host.querySelectorAll('[role="status"]')].map(node=>node.textContent).join(' ')).not.toContain('Saving…'); }
async function click(label:string) { await act(async()=>{button(label).focus();button(label).click();}); await settle(); }
async function field(label:string,value:string) {
  const control=[...host.querySelectorAll('label')].find(l=>l.textContent?.startsWith(label))?.querySelector('input,textarea,select') as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|undefined;
  if(!control)throw Error(`Missing field: ${label}`);
  await act(async()=>{
    const proto=control instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:control instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(control,value);
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement?'change':'input',{bubbles:true}));
  });
}
async function save(label:string) {
  await act(async()=>button(label).closest('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))); await settle();
}
async function householdHarness() {
  let household=catalogHousehold(), memberId='MEM-001', connected=true, loseNextAcknowledgement=false;
  const original=structuredClone(household), first=splitForSync(household,memberId);
  let authority:AuthorityState={sequence:household.revision,shared:first.shared,personal:new Map(household.members.map(m=>[m.id,splitForSync(household,m.id).personal]))};
  const receipts=new Map<string,CommandOutcome>(), submissions:string[]=[];
  const reference=vi.fn();
  const render=()=>root.render(createElement(Hearthside,{household,memberId,identity:`test:${household.householdId}:${memberId}`,connected,onCommand,practical:createElement('section',null,'Shared practical life'),studio:createElement('section',null,'Collaborative Studio'),onReference:reference}));
  const onCommand:KitchenCommand=async(fn,options)=>{
    const id=options!.confirmationId!;submissions.push(id);
    if(options?.recoverConfirmation&&receipts.has(id)){options.onRecoveredConfirmation?.();render();return receipts.get(id);}
    const scope:Scope={environment:household.environment,householdId:household.householdId,memberId,subject:`synthetic-${memberId}`,role:'owner',expires:Date.now()+60000,aclEpoch:1};
    const previous=household, capture=capturedIntent(fn(household).household)!;
    const accepted=await prepareCommand(authority,await commandFromCapture(capture,scope,id),scope,()=>{});
    authority={sequence:accepted.receipt.sequence,shared:accepted.shared,personal:new Map([...authority.personal,[memberId,accepted.personal]])};
    household=accepted.household;
    const outcome:CommandOutcome={kind:'synchronized',ok:true,household,previous,postedIds:accepted.receipt.postedIds,confirmationId:id,identityHash:null,revision:household.revision,sharingMode:'synchronized',errorClass:null,userMessage:null,retryable:false,postedExactlyOnce:true,postedNothing:false,recoveryAvailable:false};
    receipts.set(id,outcome);render();
    if(loseNextAcknowledgement){loseNextAcknowledgement=false;return null;}
    return outcome;
  };
  await act(async()=>render());
  return {read:()=>household,original,submissions,reference,
    accept:async(fn:(current:Household)=>CommitResult)=>{await act(async()=>{await onCommand(fn,{confirmationId:crypto.randomUUID()});});},
    actor:async(id:string)=>{memberId=id;await act(async()=>render());},
    connect:async(value:boolean)=>{connected=value;await act(async()=>render());},
    loseAcknowledgement:()=>{loseNextAcknowledgement=true;},
    reload:async()=>{await act(async()=>root.unmount());root=createRoot(host);await act(async()=>render());},
  };
}

describe('Connected Hearthside room journeys through the command authority',()=>{
  it('takes a free evening through both recollections and exact-version keeping without a bank, task, photo or money post',async()=>{
    const app=await householdHarness(),before=await financialAuditHash(app.original);
    await click('A little time together');await field('Why it matters','Pancakes and a record while the rain falls.');await save('Save our intention');
    const experience=app.read().hearthside!.experiences[0]!;
    expect(location.pathname).toBe(`/hearthside/experiences/${experience.id}`);
    await click('Remember this');await field('A name for this moment','The uneven pancakes');await field('My words','The first pancake looked like a cloud.');await save('Share this composition for us to keep');
    const memory=app.read().hearthside!.memories[0]!;
    expect(memory.experienceId).toBe(experience.id);expect(memory.media).toEqual([]);
    await app.actor('MEM-002');await click('Add or edit my recollection');await field('My words','I remember the rain against the kitchen window.');await save('Share this composition for us to keep');
    await click('Keep this version');await app.actor('MEM-001');await click('Keep this version');
    expect(host.textContent).toContain('We both chose to keep this version.');
    expect(memoryKeptByEveryone(app.read().hearthside!.memories[0]!,['MEM-001','MEM-002'])).toBe(true);
    expect(await financialAuditHash(app.read())).toBe(before);
    for(const key of ['goals','tasks','nativeEvents','transactions'] as const)expect(app.read()[key]??[]).toEqual(app.original[key]??[]);
    await click('Return to the intention');expect(host.textContent).toContain('Pancakes and a record');
  });
  it('deliberately creates one canonical task and Calendar date linked to the same practical intention',async()=>{
    const app=await householdHarness(),before=await financialAuditHash(app.original);
    await click('A little time together');await save('Save our intention');
    await click('Choose a next step');await field('What needs doing','Pick up the library books');await field('Who will take it','MEM-002');await save('Add this connected task');
    let experience=app.read().hearthside!.experiences[0]!;
    const taskId=experience.references.find(ref=>ref.kind==='task')!.id,task=app.read().tasks!.find(t=>t.id===taskId)!;
    expect(task).toMatchObject({title:'Pick up the library books',assigneeId:'MEM-002',completedAt:null});expect(task.acknowledgedBy).not.toContain('MEM-002');
    await click('Make time for this');await field('Starts','2026-09-20');await save('Add this date to Calendar');
    experience=app.read().hearthside!.experiences[0]!;
    const eventId=experience.references.find(ref=>ref.kind==='calendar-event')!.id;
    expect(app.read().nativeEvents!.find(e=>e.id===eventId)).toMatchObject({start:'2026-09-20',end:'2026-09-20',visibility:'household'});
    expect(app.read().tasks!.filter(t=>t.id===taskId)).toHaveLength(1);expect(app.read().nativeEvents!.filter(e=>e.id===eventId)).toHaveLength(1);
    expect(await financialAuditHash(app.read())).toBe(before);
  });
  it('keeps one funded weekend through a changed date, a paused dream, lived memories and later return without duplicate financial or operational records',async()=>{
    const errors=vi.spyOn(console,'error');
    const app=await householdHarness();
    // The existing funding command has its own reviewed UI suite; this harness supplies its accepted authority result.
    await app.accept(h=>addGoal(h,{name:'Our slow weekend',target:'120',shared:true,ownerMemberId:null}));
    const bankId=app.read().goals.at(-1)!.id;
    await app.accept(h=>fundGoal(h,{goalId:bankId,amount:'120',fromAccountId:'ACC-CHEQUING',date:'2026-09-12',createdBy:'MEM-001'}));
    const financial=await financialAuditHash(app.read()),transactions=structuredClone(app.read().transactions),contributions=structuredClone(app.read().goalContributions);
    expect(contributions.filter(c=>c.goalId===bankId)).toHaveLength(1);
    await click('Conservatory');await click('Make something happen');await field('What shall we call it?','Our slow weekend');await field('Why it matters','Time to breathe by the water.');
    await act(async()=>{const input=[...host.querySelectorAll<HTMLLabelElement>('.hearthside-link-choices label')].find(l=>l.textContent?.includes('Our slow weekend'))!.querySelector<HTMLInputElement>('input')!;input.click();});
    await save('Save our intention');const id=app.read().hearthside!.experiences[0]!.id;
    await click('Make time for this');await field('Starts','2026-09-20');await save('Add this date to Calendar');
    const eventId=app.read().hearthside!.experiences[0]!.references.find(r=>r.kind==='calendar-event')!.id;
    const event=app.read().nativeEvents!.find(e=>e.id===eventId)!;
    await app.accept(h=>saveNativeEvent(h,{memberId:'MEM-001',id:eventId,expectedRevision:event.revision,event:{...event,start:'2026-10-04',end:'2026-10-04'}}));
    await click('Shape this intention');await field('Where we are','paused');await save('Save our intention');
    await app.reload();expect(host.textContent).toContain('Resting for now');
    expect(app.read().hearthside!.experiences[0]!.references).toEqual([{kind:'bank',id:bankId},{kind:'calendar-event',id:eventId}]);
    expect(app.read().nativeEvents!.filter(e=>e.id===eventId)).toHaveLength(1);
    expect(app.read().nativeEvents!.find(e=>e.id===eventId)!.start).toBe('2026-10-04');
    await field('We lived this on','2026-10-04');await click('We lived this');
    await click('Remember this');await field('A name for this moment','The windy weekend');await field('My words','We shared the last warm coffee.');await save('Share this composition for us to keep');
    await app.actor('MEM-002');await click('Add or edit my recollection');await field('My words','I remember how loud the water sounded.');await save('Share this composition for us to keep');
    await click('Keep this version');await app.actor('MEM-001');await click('Keep this version');
    const memory=app.read().hearthside!.memories[0]!;
    expect(memory).toMatchObject({experienceId:id,media:[],hideAmounts:true});expect(memoryKeptByEveryone(memory,['MEM-001','MEM-002'])).toBe(true);
    await app.reload();expect(host.textContent).toContain('We both chose to keep this version.');await click('Return to the intention');
    expect(location.pathname).toBe(`/hearthside/experiences/${id}`);expect(app.read().hearthside!.experiences).toHaveLength(1);expect(app.read().hearthside!.memories).toHaveLength(1);
    expect(app.read().transactions).toEqual(transactions);expect(app.read().goalContributions).toEqual(contributions);expect(await financialAuditHash(app.read())).toBe(financial);
    expect(errors.mock.calls.filter(args=>String(args[0]).includes('same key'))).toEqual([]);
  });
  it('prepares each anniversary as a fresh connected intention while retaining the earlier occurrence',async()=>{
    const app=await householdHarness(),before=await financialAuditHash(app.original);
    await click('Theatre');await click('Dates that mean something');await click('Add a meaningful date');
    await field('What this day means','Our first walk');await field('Month and day','05-19');await save('Keep this date');
    await field('Year to prepare','2026');await click('Prepare 2026 together');
    const occasion=app.read().hearthside!.occasions[0]!,first=app.read().hearthside!.experiences[0]!;
    expect(first,host.textContent??'').toBeDefined();
    expect(occasion.occurrences[0]).toMatchObject({id:`${occasion.id}:2026`,date:'2026-05-19',experienceId:first.id});
    await click('Open');await field('Year to prepare','2027');await click('Prepare 2027 together');
    const later=app.read().hearthside!.occasions[0]!;expect(later.occurrences).toHaveLength(2);
    expect(later.occurrences[0]?.experienceId).toBe(first.id);expect(later.occurrences[1]?.experienceId).not.toBe(first.id);
    expect(app.read().hearthside!.experiences).toHaveLength(2);expect(await financialAuditHash(app.read())).toBe(before);
  });
  it('recovers the same accepted request after acknowledgement loss, leaving one intention and no stale draft',async()=>{
    const app=await householdHarness();app.loseAcknowledgement();
    await click('A little time together');await save('Save our intention');
    expect(host.textContent).toContain('Not confirmed yet');expect(app.read().hearthside!.experiences).toHaveLength(1);
    await app.reload();await click('Check and retry this save');
    expect(app.submissions).toHaveLength(2);expect(app.submissions[0]).toBe(app.submissions[1]);
    expect(app.read().hearthside!.experiences).toHaveLength(1);expect(host.querySelector('[aria-label="Intention draft"]')).toBeNull();
    expect(location.pathname).toContain('/hearthside/experiences/');
  });
  it('keeps unfinished words on this device and isolates them from the other member',async()=>{
    const app=await householdHarness();await click('Add an intention');await field('Why it matters','A private unfinished thought.');
    await app.reload();expect(host.querySelector('textarea')?.value).toBe('A private unfinished thought.');
    await app.actor('MEM-002');expect(host.textContent).not.toContain('A private unfinished thought.');expect(host.querySelector('[aria-label="Intention draft"]')).toBeNull();
    await app.actor('MEM-001');expect(host.querySelector('textarea')?.value).toBe('A private unfinished thought.');
    await app.connect(false);expect(button('Save our intention').disabled).toBe(true);expect(app.submissions).toHaveLength(0);
  });
  it('returns from a focused experience to the same room object and tolerates a damaged local draft',async()=>{
    const app=await householdHarness();await click('A little time together');await save('Save our intention');
    await click('← Back to common room');
    const id=app.read().hearthside!.experiences[0]!.id;
    const objectId=`hearthside-index-${encodeURIComponent(JSON.stringify(['experience',id]))}`;
    await act(async()=>{const target=document.getElementById(objectId)!;target.focus();target.click();});
    await click('← Back to common room');
    // rAF runs after React's committed layout in browsers; issue the next frame here.
    expect(location.pathname).toBe('/hearthside/rooms/common');
    sessionStorage.setItem(`hearth:hearthside:drafts:test:${app.read().householdId}:MEM-001`,JSON.stringify({experience:{references:'broken'},memory:null,note:null}));
    await app.reload();expect(host.textContent).toContain('The device draft could not be read');expect(host.querySelector('h1')?.textContent).toBe('Hearthside');
  });
});
