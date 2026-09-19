// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NativeEventEditor} from '../src/calendar/NativeEventEditor.tsx';
import {catalogHousehold} from '../src/core/index.ts';
import {saveNativeEvent} from '../src/core/nativeEvents.ts';
import {saveTask} from '../src/core/tasks.ts';
import {focusedAgendaTask} from '../src/core/agenda.ts';
import {financialAuditHash} from '../src/core/commandIdentity.ts';
import {splitForSync} from '../src/core/sync.ts';
import {capturedIntent,clearCapturedIntent} from '../src/ledgerSync/capture.ts';
import {prepareCommand,type AuthorityState} from '../src/ledgerSync/authority.ts';
import {commandFromCapture,type Scope} from '../src/ledgerSync/protocol.ts';
import type {KitchenCommand} from '../src/kitchenCommand.ts';
import {nativeReceiptKind} from '../src/hearthside/nativeFundingReview.ts';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement,root:Root;
beforeEach(()=>{sessionStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
function button(name:string){const value=[...host.querySelectorAll('button')].find(b=>b.textContent===name);if(!value)throw Error(name);return value;}
async function click(name:string){await act(async()=>button(name).click());}
async function field(name:string,value:string){const input=[...host.querySelectorAll('label')].find(l=>l.textContent?.startsWith(name))!.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
describe('Hearthside practical continuity',()=>{
  it('changes the same Calendar event and recovers a lost acknowledgement without recreating it',async()=>{
    let h=saveNativeEvent(catalogHousehold(),{id:'EVENT-walk',memberId:'MEM-001',expectedRevision:0,event:{visibility:'household',title:'Our walk',start:'2026-09-20',end:'2026-09-20',allDay:true,timezone:'America/Toronto',fold:'earlier',repeat:'none',until:null,location:'',notes:'',exceptions:{},deleted:false}}).household;
    clearCapturedIntent(h);
    const before=await financialAuditHash(h),eventId=h.nativeEvents![0]!.id,split=splitForSync(h,'MEM-001'),closed=vi.fn(),ids:string[]=[];
    const state:AuthorityState={sequence:h.revision,shared:split.shared,personal:new Map([['MEM-001',split.personal],['MEM-002',splitForSync(h,'MEM-002').personal]])};
    const scope:Scope={environment:h.environment,householdId:h.householdId,memberId:'MEM-001',subject:'synthetic',role:'owner',expires:Date.now()+60000,aclEpoch:1};
    const command:KitchenCommand=async(fn,options)=>{ids.push(options!.confirmationId!);const capture=capturedIntent(fn(h).household)!;const accepted=await prepareCommand(state,await commandFromCapture(capture,scope,options!.confirmationId!),scope,()=>{});h=accepted.household;render();return null;};
    const render=()=>root.render(createElement(NativeEventEditor,{event:h.nativeEvents!.find(e=>e.id===eventId)!,household:h,memberId:'MEM-001',identity:'fixture',busy:false,onCommand:command,onReadSubmission:async id=>ids.includes(id)?'accepted':'missing',onClose:closed}));
    await act(async()=>render());await field('Starts','2026-09-21');await field('Ends','2026-09-21');
    await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    await click('Save this exact date');
    for(let i=0;i<100&&!host.textContent?.includes('Not confirmed yet');i++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
    expect(h.nativeEvents!.find(e=>e.id===eventId),host.textContent??'').toMatchObject({revision:2,start:'2026-09-21'});
    await act(async()=>root.unmount());root=createRoot(host);await act(async()=>render());await click('Check this same receipt');
    expect(ids).toHaveLength(1);expect(closed).toHaveBeenCalledOnce();expect(h.nativeEvents!.filter(e=>e.id===eventId)).toHaveLength(1);expect(await financialAuditHash(h)).toBe(before);
  });
  it('opens a distant Task through the same operational projection without revealing private Tasks',()=>{
    let h=catalogHousehold();const task={title:'Book time off',notes:'',visibility:'household' as const,listId:null,parentId:null,doDate:'2027-03-02',dueDate:null,repeat:'none' as const,cue:'none' as const,assigneeId:'MEM-002',backupId:null,chapterId:null,planReference:null,moneyLink:null,expectedAmountCents:null,deleted:false};
    h=saveTask(h,{memberId:'MEM-001',id:'TASK-nextspring',expectedRevision:0,task}).household;
    h=saveTask(h,{memberId:'MEM-002',id:'TASK-private',expectedRevision:0,task:{...task,visibility:'personal'}}).household;
    expect(focusedAgendaTask(h,'TASK-nextspring',{memberId:'MEM-001',view:'household',today:'2026-09-12'})).toMatchObject({id:'TASK-nextspring',date:'2027-03-02',done:false});
    expect(focusedAgendaTask(h,'TASK-private',{memberId:'MEM-001',view:'household',today:'2026-09-12'})).toBeNull();
  });
  it('classifies actual command kinds so earmarks and target changes cannot look like contributions',()=>{
    const capture=(kind:string,args:unknown[])=>({observedRevision:1,steps:[{kind,args,previewIds:[],reviewed:[],resources:[]}]});
    expect(nativeReceiptKind(capture('fundGoal',[{goalId:'GOAL-one'}]),'GOAL-one')).toBe('contribution');
    expect(nativeReceiptKind(capture('allocateHouseholdFundSurplus',[{allocations:[{goalId:'GOAL-one',amount:25}]}]),'GOAL-one')).toBe('earmark');
    expect(nativeReceiptKind(capture('saveGoalEnvelope',[{goalId:'GOAL-one'}]),'GOAL-one')).toBe('target-change');
    expect(nativeReceiptKind(capture('fundGoal',[{goalId:'GOAL-other'}]),'GOAL-one')).toBeNull();
  });
});
