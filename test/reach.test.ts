// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reach } from '../src/Reach.tsx';
import { addAccount, addRecurrence, catalogHousehold, configureHouseholdFund, confirmHouseholdFundContribution, postEntry, proposeHouseholdFundContribution, recordEarningCadence, householdAsk, type Household } from '../src/core/index.ts';
import { forecastReceiptHousehold } from './fixtures/forecast-receipts.ts';
import type { ScenarioSourceContext } from '../src/scenarioSourceContext.ts';
import * as projection from '../src/core/scenarioProjection.ts';
import * as sources from '../src/core/scenarioSources.ts';
const TODAY='2026-09-08', MEMBER='MEM-002';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
function fixture() {
  let h=configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',openedOn:'2026-01-01',createdBy:'MEM-001'}).household;
  const p=proposeHouseholdFundContribution(h,{memberId:MEMBER,contributorMemberId:MEMBER,amount:'1685',date:'2026-09-07'});
  h=confirmHouseholdFundContribution(p.household,{memberId:'MEM-001',proposalEventId:p.postedIds[0]!}).household;
  for(const [amount,date] of [['586','2026-09-30'],['1650','2026-10-01']] as const) h=addRecurrence(h,{cadence:'monthly',nextDate:date,type:'expense',amount,accountId:'ACC-VISA',subcategoryId:'SUB-HOUSING-ELECTRIC',fundingDefault:{fundId:h.householdFund!.id,fundedCents:'full',destinationAccountId:'ACC-VISA'}}).household;
  const a=addAccount(h,{name:'Own cash',kind:'other',scope:'personal',ownerMemberId:MEMBER}), accountId=a.postedIds[0]!;
  h=postEntry(a.household,{date:TODAY,type:'income',amount:'46',accountId,subcategoryId:'SUB-INCOME-TIPS',createdBy:MEMBER,visibility:'personal',confirmDuplicate:true}).household;
  return {h,accountId};
}
function context(h:Household, isCurrent=()=>true, generation='fixture'):ScenarioSourceContext {return {household:h,isCurrent,accepted:{kind:'accepted',ownBooks:'ready',acceptedRevision:h.revision,acceptedStateId:`fictional:${h.revision}:${generation}`,scope:{environment:h.environment,householdId:h.householdId,memberId:MEMBER,subject:'fictional-own-user',viewerRoom:'personal',targetRoom:'household',fundId:h.householdFund!.id,authorityGeneration:generation}}};}
let root:Root,host:HTMLDivElement;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);Object.assign(HTMLElement.prototype,{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture(){return false;}});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
const field=(label:string)=>host.querySelector<HTMLInputElement|HTMLSelectElement>(`[aria-label="${label}"]`)!;
const button=(text:string)=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
async function change(label:string,value:string){await act(async()=>{const el=field(label);Object.getOwnPropertyDescriptor(el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
async function click(text:string){await act(async()=>button(text).click());}
async function until(predicate:()=>boolean){for(let i=0;i<150&&!predicate();i++)await act(async()=>{await new Promise(r=>setTimeout(r,20));});expect(predicate()).toBe(true);}
async function mount(h:Household,source=context(h)){await act(async()=>root.render(createElement(Reach,{household:h,memberId:MEMBER,today:TODAY,source})));await until(()=>!!host.querySelector('summary'));return source;}
const deficit=()=>host.querySelector('[data-reach-deficit]')?.textContent;
async function cashReceipt(accountId:string,amount='46') {await change('Your cash account',accountId);await change('Assumed remaining CAD',amount);await act(async()=>host.querySelector<HTMLInputElement>('.reach-check input')!.click());await click('Review receipt assumption');await until(()=>!!field('Dated contribution source'));}
async function contribution(tranche:string,amount:string,date=TODAY,kind='fixed'){await change('Dated contribution source',tranche);await change('Contribution rule',kind);await change('Chosen contribution CAD',amount);await change('Contribution date',date);await click('Try this contribution');await until(()=>!host.textContent?.includes('Reviewing this choice'));}
function pointer(type:string, id:number, x=8){const event=new Event(type,{bubbles:true});Object.assign(event,{pointerId:id,isPrimary:true,button:0,clientX:x,clientY:0});return event;}
describe("Claude's Reach consumer",()=>{
  it('keeps receipt consent separate from a fixed46 choice and preserves current Ask and accepted history geometry',async()=>{
    const {h,accountId}=fixture(), before=JSON.stringify(h);await mount(h);
    expect(deficit()).toBe('$551.00');const ask=host.querySelector('[data-ask-figure]')!.textContent;
    const actual=host.querySelector('.reach-actual')!.getAttribute('d'), dot=host.querySelector('.reach-dot')!.getAttribute('cy');
    await cashReceipt(accountId);expect(deficit()).toBe('$551.00');expect(host.querySelector('.reach-lift')).toBeNull();
    await contribution(`cash:${accountId}`,'46');expect(deficit()).toBe('$505.00');expect(host.querySelector('[data-ask-figure]')!.textContent).toBe(ask);
    expect(host.querySelector('.reach-actual')!.getAttribute('d')).toBe(actual);expect(host.querySelector('.reach-dot')!.getAttribute('cy')).toBe(dot);
    expect(host.querySelector('.reach-cone')).toBeNull();expect(host.querySelectorAll('svg')).toHaveLength(1);expect(JSON.stringify(h)).toBe(before);
    await click('Reset scenario');expect(deficit()).toBe('$551.00');expect(host.querySelector('.reach-lift')).toBeNull();
  });
  it('uses true count families, displays named offered dates at zero, and route motion alone never lifts the Fund',async()=>{
    const h=forecastReceiptHousehold();await mount(h);const base=deficit();expect(host.querySelectorAll('.reach-row')).toHaveLength(4);expect(host.querySelectorAll('.reach-row.on')).toHaveLength(0);
    const rail=host.querySelector<HTMLInputElement>('input[type=range]')!;rail.setAttribute('aria-label','rail');
    await change('rail','2');expect(host.querySelectorAll('.reach-row.on')).toHaveLength(2);expect(rail.getAttribute('aria-valuetext')).toContain('Model end deficit');expect(rail.getAttribute('aria-valuetext')).toMatch(/Fri|Sat/);expect(deficit()).toBe(base);expect(host.querySelector('.reach-lift')).toBeNull();
    await change('Receipt source','forecast');await act(async()=>host.querySelector<HTMLInputElement>('.reach-check input')!.click());await click('Review receipt assumption');await until(()=>!!field('Dated contribution source'));
    expect(deficit()).toBe(base);expect(host.querySelector('.reach-lift')).toBeNull();expect(field('Dated contribution source').textContent).toMatch(/Fri|Sat/);expect(field('Dated contribution source').textContent).not.toContain('Shift 1');
  });
  it('retains a named alternative and its consent on a stationary handle, and cancels effort preview',async()=>{
    await mount(forecastReceiptHousehold());const rail=host.querySelector<HTMLInputElement>('input[type=range]')!;rail.setAttribute('aria-label','rail');await change('rail','2');const options=(field('Named route') as HTMLSelectElement).options;expect(options.length).toBeGreaterThan(1);await change('Named route',options[1]!.value);const picked=field('Named route').value;
    Object.defineProperty(rail,'getBoundingClientRect',{value:()=>({left:0,width:200})});
    await act(async()=>{rail.dispatchEvent(pointer('pointerdown',1,100));rail.dispatchEvent(pointer('pointerup',1,100));});expect(field('Named route').value).toBe(picked);
    await act(async()=>rail.dispatchEvent(pointer('pointerdown',2,100)));await act(async()=>rail.dispatchEvent(pointer('pointermove',2,180)));await change('rail','4');expect(rail.value).toBe('4');expect(rail.hasAttribute('data-dialog-escape-boundary')).toBe(true);
    await act(async()=>rail.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(rail.value).toBe('2');expect(field('Named route').value).toBe(picked);
  });
  it('allows a cash-only up-to scenario while forecast evidence is unavailable, and rejects exact over-allocation',async()=>{
    const {h,accountId}=fixture();await mount(h);expect(host.querySelector<HTMLInputElement>('input[type=range]')!.disabled).toBe(true);await cashReceipt(accountId);
    await contribution(`cash:${accountId}`,'46.01');expect(host.textContent).toContain('remaining');expect(host.querySelector('.reach-lift')).toBeNull();
    await contribution(`cash:${accountId}`,'46.01',TODAY,'available-up-to');expect(deficit()).toBe('$505.00');expect(host.querySelector('.reach-cone')).toBeNull();
  });
  it('rejects malformed cents and outside-horizon dates without changing accepted books',async()=>{
    const {h,accountId}=fixture(),before=JSON.stringify(h);await mount(h);await cashReceipt(accountId);await contribution(`cash:${accountId}`,'1.001');expect(host.textContent).toContain('exact CAD');expect(deficit()).toBe('—');
    await contribution(`cash:${accountId}`,'46','2026-09-07');expect(host.textContent).toContain('outside this scenario');expect(JSON.stringify(h)).toBe(before);
  });
  it('draws no invented contribution or cone for an explicit zero',async()=>{
    const {h,accountId}=fixture();await mount(h);await cashReceipt(accountId);await contribution(`cash:${accountId}`,'0');expect(deficit()).toBe('$551.00');expect(host.querySelector('.reach-lift')).toBeNull();expect(host.textContent).toContain('No contribution chosen');
  });
  it('models one explicit forecast source, refuses a contribution before its receipt, and keeps cash results during effort preview',async()=>{
    const h=forecastReceiptHousehold(), spy=vi.spyOn(projection,'projectFundScenario');await mount(h);
    const rail=host.querySelector<HTMLInputElement>('input[type=range]')!;rail.setAttribute('aria-label','rail');await change('rail','2');await change('Receipt source','forecast');
    await act(async()=>host.querySelector<HTMLInputElement>('.reach-check input')!.click());await click('Review receipt assumption');await until(()=>!!field('Dated contribution source'));
    const source=(field('Dated contribution source') as HTMLSelectElement).options[1]!.value;
    await contribution(source,'1000',TODAY,'available-up-to');expect(host.textContent).toContain('before');expect(host.querySelector('.reach-lift')).toBeNull();
    await change('Dated contribution source','');await change('Dated contribution source',source);const received=field('Contribution date').value;await contribution(source,'1000',received,'available-up-to');
    expect(host.querySelector('.reach-lift')).not.toBeNull();expect(host.querySelector('.reach-cone')).not.toBeNull();expect(spy.mock.calls.at(-1)![2].elections).toHaveLength(1);
    await change('Receipt source','cash');const account=h.workJobs[0]!.defaults.cashTipsAccountId;await cashReceipt(account,'1');await contribution(`cash:${account}`,'1');const before=deficit();
    Object.defineProperty(rail,'getBoundingClientRect',{value:()=>({left:0,width:200})});await act(async()=>rail.dispatchEvent(pointer('pointerdown',3,100)));await act(async()=>rail.dispatchEvent(pointer('pointermove',3,180)));await change('rail','4');expect(deficit()).toBe(before);expect(host.querySelector('.reach-lift')).not.toBeNull();await act(async()=>rail.dispatchEvent(pointer('pointercancel',3,180)));expect(rail.value).toBe('2');
  });
  it('keeps exact own estimate replacement unchecked and shows that replacing100 with46 can worsen the deficit',async()=>{
    const f=fixture();let h=recordEarningCadence(f.h,{memberId:MEMBER,createdBy:MEMBER,detailAction:'skip',paySchedule:{cadence:'custom',anchorDate:'2026-08-01',weekday:5,monthDays:[15,30],customDates:['2026-09-15'],reminderTime:'09:00'}}).household;
    for(const date of ['2026-08-20','2026-08-27']) {const p=proposeHouseholdFundContribution(h,{memberId:MEMBER,contributorMemberId:MEMBER,amount:'100',date});h=confirmHouseholdFundContribution(p.household,{memberId:'MEM-001',proposalEventId:p.postedIds[0]!}).household;}
    const spy=vi.spyOn(projection,'projectFundScenario');await mount(h);await cashReceipt(f.accountId);
    const replacement=[...host.querySelectorAll<HTMLInputElement>('.reach-check input')].find(el=>el.parentElement?.textContent?.includes('$100.00'))!;expect(replacement).toBeDefined();expect(replacement.checked).toBe(false);
    await act(async()=>replacement.click());await contribution(`cash:${f.accountId}`,'46','2026-09-16');
    const request=spy.mock.calls.at(-1)![2];expect(request.elections[0]!.replaces).toHaveLength(1);const result=await spy.mock.results.at(-1)!.value;if(result.kind!=='scenario')throw Error(JSON.stringify(result));expect(result.lower.endBalanceCents).toBe(result.baseline.endBalanceCents-5400);expect(result.currentAsk).toEqual(householdAsk(h,TODAY));
  });
  it('never inspects or renders own source data when Personal completeness is unavailable, and omits custodian Reach',async()=>{
    const {h}=fixture();h.accounts.push({...h.accounts[0]!,id:'private-canary',name:'PRIVATE_CANARY',ownerMemberId:MEMBER});const initial=context(h);const source:ScenarioSourceContext={...initial,accepted:{...initial.accepted,ownBooks:'unavailable'}};const spy=vi.spyOn(sources,'reviewScenarioSources');
    await act(async()=>root.render(createElement(Reach,{household:h,memberId:MEMBER,today:TODAY,source})));expect(spy).not.toHaveBeenCalled();expect(host.textContent).not.toContain('PRIVATE_CANARY');expect(host.querySelectorAll('svg')).toHaveLength(1);expect(host.querySelector('.reach-actual')).not.toBeNull();
    await act(async()=>root.render(createElement(Reach,{household:h,memberId:'MEM-001',today:TODAY,source})));expect(host.querySelector('[data-reach]')).toBeNull();
  });
  it('hides prior private results synchronously and rejects a delayed projection after a source change',async()=>{
    const {h,accountId}=fixture();let current=true;const source=context(h,()=>current);await mount(h,source);await cashReceipt(accountId);
    const original=projection.projectFundScenario;let release!:()=>void;const barrier=new Promise<void>(resolve=>release=resolve);vi.spyOn(projection,'projectFundScenario').mockImplementationOnce(async(...args)=>{await barrier;return original(...args);});
    await change('Dated contribution source',`cash:${accountId}`);await change('Chosen contribution CAD','46');await click('Try this contribution');current=false;
    const initial=context(h,()=>true,'new');const next:ScenarioSourceContext={...initial,accepted:{...initial.accepted,ownBooks:'unavailable'}};await act(async()=>root.render(createElement(Reach,{household:h,memberId:MEMBER,today:TODAY,source:next})));expect(host.querySelector('details')).toBeNull();
    await act(async()=>{release();await new Promise(r=>setTimeout(r,30));});expect(host.textContent).not.toContain('$505');expect(host.querySelector('.reach-lift')).toBeNull();
  });
});
