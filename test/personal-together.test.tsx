// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {catalogHousehold,type CommandOutcome,type Household} from '../src/core/index.ts';
import {emptyPersonalLife} from '../src/hearthside/personalLifeContracts.ts';
import type {HouseRoute} from '../src/hearthside/houseRoutes.ts';
import {PersonalTogether} from '../src/house/PersonalTogether.tsx';
import type {KitchenCommand} from '../src/kitchenCommand.ts';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
const A='MEM-001', B='MEM-002';
let host:HTMLDivElement,root:Root;

beforeEach(()=>{
  localStorage.clear();
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});

const route=(householdId:string):HouseRoute=>({room:'together',level:'above',householdId,scope:'personal'});
const button=(label:string)=>{
  const found=[...host.querySelectorAll<HTMLButtonElement>('button')].find(row=>row.textContent?.trim()===label);
  if(!found)throw Error(`Missing button: ${label}`);return found;
};
const input=(label:string)=>{
  const control=[...host.querySelectorAll<HTMLLabelElement>('label')].find(row=>row.childNodes[0]?.textContent?.trim()===label)?.querySelector<HTMLInputElement|HTMLTextAreaElement>('input,textarea');
  if(!control)throw Error(`Missing input: ${label}`);return control;
};
async function change(label:string,value:string){
  const control=input(label),prototype=control instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  await act(async()=>{Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(control,value);control.dispatchEvent(new Event('input',{bubbles:true}));});
}
async function click(label:string){await act(async()=>{button(label).click();await Promise.resolve();await Promise.resolve();});}

function synchronized(household:Household,previous:Household,confirmationId:string):CommandOutcome {
  return {kind:'synchronized',ok:true,household,previous,postedIds:[],confirmationId,identityHash:null,revision:household.revision,
    sharingMode:'synchronized',errorClass:null,userMessage:null,retryable:false,postedExactlyOnce:true,postedNothing:true,recoveryAvailable:false};
}

function harness(initial?:Household,memberId=A,identity='ME'){
  let household=initial??({...catalogHousehold(),personalLife:emptyPersonalLife(memberId)} as Household);
  const submissions:Array<{confirmationId:string;before:Household;after:Household}> = [];
  const command:KitchenCommand=async(fn,options)=>{
    const before=household,result=fn(household);household=result.household;
    submissions.push({confirmationId:options!.confirmationId!,before,after:household});
    render();
    return synchronized(household,before,options!.confirmationId!);
  };
  const render=()=>root.render(createElement(PersonalTogether,{household,memberId,identity,today:'2026-09-19',route:route(household.householdId),busy:false,
    onCommand:command,onNavigate:vi.fn(),onOpenPlan:vi.fn(),onOpenCalendar:vi.fn()}));
  return {render:()=>act(async()=>render()),read:()=>household,submissions,command};
}

describe('PersonalTogether',()=>{
  it('rebases the same editor after synchronized saves, starts a distinct page, and reloads JSON drafts',async()=>{
    const app=harness();await app.render();
    await change('Title','Read by the window');await change('Intention','An unhurried afternoon.');await click('Save private page');
    const first=app.read().personalLife!.wishes[0]!;
    expect(first).toMatchObject({revision:1,title:'Read by the window',intention:'An unhurried afternoon.'});

    await change('Title','Read by the rainy window');await click('Save private page');
    expect(app.read().personalLife!.wishes).toEqual([expect.objectContaining({id:first.id,revision:2,title:'Read by the rainy window'})]);
    expect(app.submissions.map(row=>row.after.personalLife!.wishes[0]!.revision)).toEqual([1,2]);

    await click('Start a new wish');
    await change('Title','A different private page');
    const draftKey=Object.keys(localStorage).find(key=>key.endsWith(':personal:folio:ME:wish'))!;
    const stored=JSON.parse(localStorage.getItem(draftKey)!);
    expect(stored).toMatchObject({title:'A different private page',revision:1});
    expect(stored.id).not.toBe(first.id);
    expect(typeof stored).toBe('object');

    await act(async()=>root.unmount());root=createRoot(host);
    await app.render();
    expect(input('Title').value).toBe('A different private page');
    expect(JSON.parse(localStorage.getItem(draftKey)!)).toEqual(stored);
  });

  it('shows the exact copy boundary and writes a reviewed Shared copy through personal-life authority',async()=>{
    const source={version:1 as const,id:'WISH-private-window',revision:1,title:'Read by the window',intention:'An unhurried afternoon.',horizon:'season' as const,createdBy:A,archived:false,references:[]};
    const app=harness({...catalogHousehold(),personalLife:{...emptyPersonalLife(A),wishes:[source]}} as Household);await app.render();
    await click('Review Share with Our Home');
    expect(host.textContent).toContain('This exact copy creates a new Shared object. Your private source, notes and unrelated references remain private. A shared memory needs each person’s approval of this composition.');
    await click('Share this reviewed copy');
    expect(host.textContent).toContain('Synchronized.');
    expect(app.read().personalLife!.wishes).toEqual([source]);
    expect(app.read().personalLife!.shareReceipts[0]).toMatchObject({sourceId:source.id,sharedId:expect.stringMatching(/^SHARED-EXPERIENCE-/)});
    expect(app.read().hearthside!.experiences).toEqual([expect.objectContaining({title:source.title,intention:source.intention,createdBy:A})]);
  });

  it('retains one pending intent, blocks replacement, and refuses another member’s folio',async()=>{
    const household={...catalogHousehold(),personalLife:emptyPersonalLife(A)} as Household;
    const pendingCommand=vi.fn<KitchenCommand>().mockReturnValue(undefined);
    await act(async()=>root.render(createElement(PersonalTogether,{household,memberId:A,identity:'ME',today:'2026-09-19',route:route(household.householdId),busy:false,
      onCommand:pendingCommand,onNavigate:vi.fn(),onOpenPlan:vi.fn(),onOpenCalendar:vi.fn()})));
    await change('Title','Keep this exact intent');await click('Save private page');
    expect(pendingCommand).toHaveBeenCalledOnce();
    expect(button('Start a new wish').disabled).toBe(true);
    expect(button('Save private page').disabled).toBe(true);
    const intentKey=Object.keys(localStorage).find(key=>key.endsWith(':personal:folio:ME:intent'))!;
    const retained=localStorage.getItem(intentKey);
    await change('Title','Typing cannot replace the pending command');
    button('Start a new wish').click();button('Save private page').click();
    expect(pendingCommand).toHaveBeenCalledOnce();
    expect(localStorage.getItem(intentKey)).toBe(retained);
    expect(host.textContent).toContain('Original intent retained');

    await act(async()=>root.unmount());root=createRoot(host);
    const wrongMember=vi.fn<KitchenCommand>();
    await act(async()=>root.render(createElement(PersonalTogether,{household,memberId:B,identity:'OTHER',today:'2026-09-19',route:route(household.householdId),busy:false,
      onCommand:wrongMember,onNavigate:vi.fn(),onOpenPlan:vi.fn(),onOpenCalendar:vi.fn()})));
    expect(host.textContent).toContain('Your Personal folio could not be read for this member. Nothing can be changed here.');
    expect(wrongMember).not.toHaveBeenCalled();
    expect(host.querySelector('[data-personal-life-owner="unavailable"]')).not.toBeNull();
  });
});
