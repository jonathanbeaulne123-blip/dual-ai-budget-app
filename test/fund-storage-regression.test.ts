// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseholdFundPanel, FundContributionMotionCard, fundReviewConfirmation } from '../src/HouseholdFundPanel.tsx';
import { catalogHousehold, configureHouseholdFund, proposeHouseholdFundContribution, householdFundContributionMotions, type Household } from '../src/core/index.ts';
let root:Root;let host:HTMLDivElement;let household:Household;
const memberId='MEM-002';
const storageKey=(action:string)=>JSON.stringify(['hearth:fund-confirm:v1',household.environment,household.householdId,memberId,action]);
const onCommand=vi.fn();
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();onCommand.mockReset();household=configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',createdBy:'MEM-001',openedOn:'2026-09-01'}).household;household.householdId=crypto.randomUUID();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function click(label:string){const b=[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===label);expect(b).toBeDefined();await act(async()=>b!.click());}
async function type(selector:string,value:string){const input=host.querySelector<HTMLInputElement|HTMLTextAreaElement>(selector)!;await act(async()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
async function renderContribution(){await act(async()=>root.render(h(HouseholdFundPanel,{household,memberId,view:'household',onCommand})));await type('#fund-contribution-amount','25');await type('.fund-source-fields textarea','Synthetic untracked savings');}
describe('Fund durable confirmation boundary',()=>{
  it.each(['write','corrupt'] as const)('refuses a contribution before onCommand when receipt storage is %s',async failure=>{
    await renderContribution();if(failure==='write')vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('QuotaExceededError');});else localStorage.setItem(storageKey('propose'),'{broken');
    await click('Propose contribution');expect(onCommand).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]')?.textContent).toMatch(/recovery receipt/);expect(host.querySelector<HTMLInputElement>('#fund-contribution-amount')!.value).toBe('25');
  });
  it('reuses the durable same-review ID after module memory is reset',async()=>{
    const id=fundReviewConfirmation(household,memberId,'propose','unchanged-review');vi.resetModules();const reloaded=await import('../src/HouseholdFundPanel.tsx');expect(reloaded.fundReviewConfirmation(household,memberId,'propose','unchanged-review')).toBe(id);
  });
  it('shows storage refusal at receipt review and sends no command',async()=>{
    household=proposeHouseholdFundContribution(household,{memberId,contributorMemberId:memberId,amount:'25',date:'2026-09-01',source:{version:1,kind:'external-received',explanation:'Synthetic savings'}}).household;
    const motion=householdFundContributionMotions(household)[0]!;await act(async()=>root.render(h(FundContributionMotionCard,{household,memberId:'MEM-001',motion,isCustodian:true,onCommand})));
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('QuotaExceededError');});await click('Review receipt');expect(onCommand).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]')?.textContent).toMatch(/recovery receipt/);expect(host.querySelector('.fund-receipt-review')).toBeNull();
  });
  it('rechecks receipt storage immediately before Confirm received',async()=>{
    household=proposeHouseholdFundContribution(household,{memberId,contributorMemberId:memberId,amount:'25',date:'2026-09-01',source:{version:1,kind:'external-received',explanation:'Synthetic savings'}}).household;
    const motion=householdFundContributionMotions(household)[0]!;await act(async()=>root.render(h(FundContributionMotionCard,{household,memberId:'MEM-001',motion,isCustodian:true,onCommand})));await click('Review receipt');vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('SecurityError');});await click('Confirm received');expect(onCommand).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]')?.textContent).toMatch(/recovery receipt/);
  });
  it('shows storage refusal for legacy source replacement before sending',async()=>{
    household=proposeHouseholdFundContribution(household,{memberId,contributorMemberId:memberId,amount:'25',date:'2026-09-01',source:{version:1,kind:'external-received',explanation:'Synthetic savings'}}).household;
    const motion=householdFundContributionMotions(household)[0]!;delete motion.proposal.sourceDeclaration;
    await act(async()=>root.render(h(FundContributionMotionCard,{household,memberId,motion,isCustodian:false,onCommand})));await type('.fund-source-fields textarea','Synthetic replacement');vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('QuotaExceededError');});await click('Withdraw and replace proposal');expect(onCommand).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]')?.textContent).toMatch(/recovery receipt/);
  });
});
it('does not send a new receipt identity when storage was cleared after Review receipt',async()=>{
  household=proposeHouseholdFundContribution(household,{memberId,contributorMemberId:memberId,amount:'25',date:'2026-09-01',source:{version:1,kind:'external-received',explanation:'Synthetic savings'}}).household;
  const motion=householdFundContributionMotions(household)[0]!;await act(async()=>root.render(h(FundContributionMotionCard,{household,memberId:'MEM-001',motion,isCustodian:true,onCommand})));await click('Review receipt');localStorage.clear();await click('Confirm received');expect(onCommand).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]')?.textContent).toMatch(/Cancel and review/);
});
