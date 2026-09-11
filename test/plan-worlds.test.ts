// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
vi.mock('../src/kitty/KittyStage.tsx', () => ({ KittyStage: () => null }));
import { PlanCategories } from '../src/App.tsx';
import { catalogHousehold, setBudget, monthSummary } from '../src/core/index.ts';
import { ThemeProvider, useSceneBinding } from '../src/theme/ThemeProvider.tsx';
import { AppearanceStore } from '../src/theme/appearanceStore.ts';
import { parseAppearance } from '../src/theme/scenes.ts';
import { PageWorld, EraBracelet } from '../src/theme/PageWorld.tsx';

it('retains the real category draft and focus through all themes, validates, cancels and saves through the existing budget command',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 const household=setBudget(catalogHousehold(),{monthKey:'2026-09',subcategoryId:'SUB-FOOD-GROCERIES',amount:'650'}).household;
 const rows=monthSummary(household,'2026-09').categories,save=vi.fn();
 const store=new AppearanceStore({read:async()=>parseAppearance(null),write:async()=>parseAppearance(null)},null);
 function Screen(){useSceneBinding('plan','household',false);return h('div',null,h(PageWorld,{page:'plan'}),h(EraBracelet),h(PlanCategories,{household,rows,monthKey:'2026-09',onSave:save}));}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const click=async(e:Element)=>act(async()=>(e as HTMLElement).click());
 const change=async(e:HTMLInputElement,value:string)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));e.focus();});
 const key=async(e:Element,k:string)=>act(async()=>{e.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));});
 try{
  await act(async()=>root.render(h(ThemeProvider,{store,children:h(Screen)})));
  await click(host.querySelector('.budget-edit-trigger')!);const input=host.querySelector<HTMLInputElement>('.budget-edit input')!;
  await change(input,'1234567.89');
  for(const theme of ['taylor','newfoundland','classic'] as const){await act(async()=>store.preview(theme));expect(host.querySelector('.budget-edit input')).toBe(input);expect(document.activeElement).toBe(input);expect(input.value).toBe('1234567.89');expect(document.documentElement.dataset.worldPage).toBe('plan');}
  expect(save).not.toHaveBeenCalled();
  await change(input,'invalid');await key(input,'Enter');expect(save).not.toHaveBeenCalled();expect(host.querySelector('.budget-edit input')).toBe(input);
  await key(input,'Escape');expect(host.querySelector('.budget-edit input')).toBeNull();expect(document.activeElement).toBe(host.querySelector('.budget-edit-trigger'));
  await click(host.querySelector('.budget-edit-trigger')!);const next=host.querySelector<HTMLInputElement>('.budget-edit input')!;expect(next.value).toBe('650.00');
  await change(next,'700');await key(next,'Enter');expect(save).toHaveBeenCalledTimes(1);expect(save.mock.calls[0]![0].transactions).toEqual(household.transactions);expect(monthSummary(save.mock.calls[0]![0],'2026-09').categories.find(c=>c.subcategoryId==='SUB-FOOD-GROCERIES')?.budgetedCents).toBe(70000);
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});

it('preserves the Kitty Bank room contribution review through theme changes without posting money',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 Object.defineProperty(window,'innerWidth',{value:1440,configurable:true});
 const {KittyBanks}=await import('../src/KittyBanks.tsx');
 const {planLifeFixture}=await import('./fixtures/plan-life.ts');
 const household=planLifeFixture('personal');
 const command=vi.fn(),store=new AppearanceStore({read:async()=>parseAppearance(null),write:async()=>parseAppearance(null)},null);
 function Screen(){useSceneBinding('plan','personal',false);return h(KittyBanks,{household,booksHousehold:household,view:'personal',createdBy:'MEM-001',environment:'development',surface:'plan',onCommand:command});}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(h(ThemeProvider,{store,children:h(Screen)})));
  const click=async(name:string)=>act(async()=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===name)!.click());
  await click('Enter Kitty Banks');await click('Use money');
  const action=document.querySelector('.kitty-money-action')!;
  const amount=action.querySelector<HTMLInputElement>('input')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(amount,'25');amount.dispatchEvent(new Event('input',{bubbles:true}));});
  const source=action.querySelector<HTMLSelectElement>('select')!;
  await act(async()=>{source.value='ACC-CHEQUING';source.dispatchEvent(new Event('change',{bubbles:true}));});
  const review=[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Review contribution')!;
  await act(async()=>review.click());const dialog=document.querySelector('.sheet.guard[role="dialog"]')!;expect(dialog.textContent).toContain('Fund this bank');
  const cancel=[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Cancel')!;
  await act(async()=>cancel.focus());
  for(const theme of ['taylor','newfoundland','classic'] as const){await act(async()=>store.preview(theme));expect(document.querySelector('.sheet.guard[role="dialog"]')).toBe(dialog);expect(document.activeElement).toBe(cancel);expect(source.value).toBe('ACC-CHEQUING');expect(command).not.toHaveBeenCalled();}
  await act(async()=>cancel.click());expect(document.querySelector('.sheet.guard[role="dialog"]')).toBeNull();expect(command).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
