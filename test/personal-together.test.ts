// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {catalogHousehold,splitForSync,type CommandOutcome,type Household} from '../src/core/index.ts';
import {emptyPersonalLife} from '../src/hearthside/personalLifeContracts.ts';
import type {HouseRoute} from '../src/hearthside/houseRoutes.ts';
import {PersonalTogether} from '../src/house/PersonalTogether.tsx';
import type {KitchenCommand} from '../src/kitchenCommand.ts';

vi.mock('../src/theme/ThemeProvider.tsx',()=>({
  useAppearance:()=>({preview:null,saved:{theme:'classic'},scene:{theme:'classic'}}),
}));

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
const A='MEM-001', B='MEM-002';
let host:HTMLDivElement,root:Root;

beforeEach(()=>{
  localStorage.clear();
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});

const folioRoute=(householdId:string):HouseRoute=>({room:'together',level:'above',householdId,scope:'personal',surface:'wishes'});
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

function harness(initial?:Household,memberId=A,identity='ME',mode:'synchronized'|'pending'='synchronized',onWorkspace?:Parameters<typeof PersonalTogether>[0]['onWorkspace']){
  let household=initial??({...catalogHousehold(),personalLife:emptyPersonalLife(memberId)} as Household);
  let currentRoute=folioRoute(household.householdId);
  const navigations:HouseRoute[]=[];
  const submissions:Array<{confirmationId:string;before:Household;after:Household}> = [];
  const command=vi.fn<KitchenCommand>(async(fn,options)=>{
    if(mode==='pending')return undefined;
    const before=household,result=fn(household);household=result.household;
    submissions.push({confirmationId:options!.confirmationId!,before,after:household});
    render();
    return synchronized(household,before,options!.confirmationId!);
  });
  const navigate=(next:HouseRoute)=>{currentRoute=next;navigations.push(next);render();};
  const render=()=>root.render(createElement(PersonalTogether,{key:`${identity}:${currentRoute.object??'folio'}`,household,memberId,identity,today:'2026-09-19',route:currentRoute,busy:false,
    onCommand:command,onNavigate:navigate,onOpenPlan:vi.fn(),onOpenCalendar:vi.fn(),onWorkspace}));
  return {
    render:()=>act(async()=>render()),
    navigate:(next:HouseRoute)=>act(async()=>navigate(next)),
    read:()=>household,
    route:()=>currentRoute,
    submissions,navigations,command,
  };
}

async function reload(app:ReturnType<typeof harness>){
  await act(async()=>root.unmount());root=createRoot(host);await app.render();
}

describe('PersonalTogether',()=>{
  it('rebases synchronized saves and keeps independently addressed JSON drafts through route changes and reload',async()=>{
    const app=harness();await app.render();
    await change('Title','Read by the window');await change('Intention','An unhurried afternoon.');await click('Save private page');
    const first=app.read().personalLife!.wishes[0]!;
    expect(first).toMatchObject({revision:1,title:'Read by the window',intention:'An unhurried afternoon.'});

    await change('Title','Read by the rainy window');await click('Save private page');
    expect(app.read().personalLife!.wishes).toEqual([expect.objectContaining({id:first.id,revision:2,title:'Read by the rainy window'})]);
    expect(app.submissions.map(row=>row.after.personalLife!.wishes[0]!.revision)).toEqual([1,2]);

    await click('Edit private page');
    const firstRoute=app.route();
    expect(firstRoute.object).toBe(`wish/${first.id}`);
    await change('Title','First addressed draft');
    await click('Start a new wish');
    const secondRoute=app.route(),secondId=secondRoute.object!.slice('wish/'.length);
    expect(secondId).not.toBe(first.id);
    await change('Title','Second addressed draft');

    const firstKey=Object.keys(localStorage).find(key=>key.endsWith(`:personal:object:wish/${first.id}:wish`))!;
    const secondKey=Object.keys(localStorage).find(key=>key.endsWith(`:personal:object:wish/${secondId}:wish`))!;
    expect(JSON.parse(localStorage.getItem(firstKey)!)).toMatchObject({id:first.id,title:'First addressed draft',revision:3});
    expect(JSON.parse(localStorage.getItem(secondKey)!)).toMatchObject({id:secondId,title:'Second addressed draft',revision:1});

    await app.navigate(firstRoute);expect(input('Title').value).toBe('First addressed draft');
    await app.navigate(secondRoute);expect(input('Title').value).toBe('Second addressed draft');
    await reload(app);expect(input('Title').value).toBe('Second addressed draft');
    await app.navigate(firstRoute);expect(input('Title').value).toBe('First addressed draft');
  });

  it('shows the exact copy boundary and writes only a reviewed Shared copy',async()=>{
    const source={version:1 as const,id:'WISH-private-window',revision:1,title:'Read by the window',intention:'An unhurried afternoon.',horizon:'season' as const,createdBy:A,archived:false,references:[]};
    const app=harness({...catalogHousehold(),personalLife:{...emptyPersonalLife(A),wishes:[source]}} as Household);await app.render();
    await click('Review Share with Our Home');
    expect(host.textContent).toContain('This exact copy creates a new Shared object. Your private source, notes and unrelated references remain private. A shared memory needs each person’s approval of this composition.');
    await click('Share this reviewed copy');
    expect(host.textContent).toContain('Synchronized.');
    expect(app.read().personalLife!.wishes).toEqual([source]);
    expect(app.read().personalLife!.shareReceipts[0]).toMatchObject({sourceId:source.id,sharedId:expect.stringMatching(/^SHARED-EXPERIENCE-/)});
    expect(app.read().hearthside!.experiences).toEqual([expect.objectContaining({title:source.title,intention:source.intention,createdBy:A})]);
    const shared=JSON.stringify(splitForSync(app.read(),A).shared);
    expect(shared).not.toContain(source.id);
    expect(shared).not.toContain('SHARE-REVIEW-');
  });

  it('offers only an explicit owner-bound Workspace callback and names unavailable capability',async()=>{
    const experience={version:1 as const,id:'EXPERIENCE-private',revision:1,title:'A private afternoon',intention:'Make some quiet space.',state:'preparing' as const,horizon:'season' as const,createdBy:A,wishId:null,livedOn:null,references:[]};
    const household={...catalogHousehold(),personalLife:{...emptyPersonalLife(A),experiences:[experience]}} as Household;
    const openWorkspace=vi.fn();const app=harness(household,A,'ME','synchronized',openWorkspace);await app.render();
    await click('Work on this with Hercules');expect(openWorkspace).toHaveBeenCalledWith(experience);
    await act(async()=>root.unmount());root=createRoot(host);
    const unavailable=harness(household);await unavailable.render();
    expect(host.textContent).toContain('Hercules Workspace is not activated for private intentions. Your folio remains available here.');
    expect([...host.querySelectorAll('button')].some(row=>row.textContent==='Work on this with Hercules')).toBe(false);
  });

  it('retains one pending intent across reload, blocks replacement, and refuses another member’s folio',async()=>{
    const household={...catalogHousehold(),personalLife:emptyPersonalLife(A)} as Household;
    const app=harness(household,A,'ME','pending');await app.render();
    await change('Title','Keep this exact intent');await click('Save private page');
    expect(app.command).toHaveBeenCalledOnce();
    expect(button('Start a new wish').disabled).toBe(true);
    expect(button('Save private page').disabled).toBe(true);
    const intentKey=Object.keys(localStorage).find(key=>key.endsWith(':personal:folio:ME:intent'))!;
    const retained=localStorage.getItem(intentKey);
    await change('Title','Typing cannot replace the pending command');
    button('Start a new wish').click();button('Save private page').click();
    expect(app.command).toHaveBeenCalledOnce();
    expect(localStorage.getItem(intentKey)).toBe(retained);
    expect(host.textContent).toContain('Original intent retained');

    await reload(app);
    expect(host.textContent).toContain('Original intent retained');
    expect(button('Start a new wish').disabled).toBe(true);

    await act(async()=>root.unmount());root=createRoot(host);
    const wrong=harness(household,B,'OTHER');await wrong.render();
    expect(host.textContent).toContain('Your Personal folio could not be read for this member. Nothing can be changed here.');
    expect(wrong.command).not.toHaveBeenCalled();
    expect(host.querySelector('[data-personal-life-owner="unavailable"]')).not.toBeNull();
  });
});
