// @vitest-environment jsdom
import {act, createElement as h, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ThemeProvider,useSceneBinding} from '../src/theme/ThemeProvider.tsx';
import {AppearanceStore} from '../src/theme/appearanceStore.ts';
import {parseAppearance} from '../src/theme/scenes.ts';
import {FundLedge} from '../src/FundLedge.tsx';
import {ShiftCount} from '../src/ShiftCount.tsx';
import {Memorabilia} from '../src/theme/Memorabilia.tsx';
import {MEMORABILIA,missingMemorabilia} from '../src/theme/memorabilia.ts';
import {catalogHousehold,configureHouseholdFund} from '../src/core/index.ts';
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));Object.defineProperty(window,'innerWidth',{value:390,configurable:true});});
afterEach(()=>{vi.unstubAllGlobals();document.body.innerHTML='';});
it('keeps an open Fund stage, its node, reading and focus while previewing and applying every world, without writing',async()=>{
 const household=configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',openedOn:'2026-08-01',createdBy:'MEM-001'}).household;
 const before=JSON.stringify(household),writes=vi.fn(),opens=vi.fn();
 const api={read:vi.fn(async()=>parseAppearance(null)),write:vi.fn(async()=>parseAppearance(null))};const store=new AppearanceStore(api,null);
 function Screen(){useSceneBinding('home','personal',false);return h(FundLedge,{household,today:'2026-09-08',view:'personal',memberId:'MEM-002',busy:false,onOpen:opens,onKitchen:writes,onOpenAccount:opens});}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(h(ThemeProvider,{store,children:h(Screen)})));
 const grip=host.querySelector<HTMLButtonElement>('.fund-ledge-grip')!;grip.focus();await act(async()=>grip.click());await act(async()=>document.querySelector<HTMLButtonElement>('.is-sheet-grip')!.click());
 const waiting=document.querySelector<HTMLButtonElement>('[data-fund-widget="waiting"]')!;await act(async()=>waiting.click());waiting.focus();
 const sheet=document.querySelector('.fund-ledge-sheet');const stage=document.querySelector('.fund-ledge-stage');const reading=stage?.textContent;
 for(const theme of ['taylor','newfoundland','classic'] as const){await act(async()=>{store.preview(theme);store.apply(theme);store.setAtmosphere(false);});expect(document.querySelector('.fund-ledge-sheet')).toBe(sheet);expect(sheet?.getAttribute('data-detent')).toBe('full');expect(document.querySelector('.fund-ledge-stage')).toBe(stage);expect(stage?.textContent).toBe(reading);expect(document.activeElement).toBe(waiting);expect(waiting.getAttribute('aria-selected')).toBe('true');}
 expect(writes).not.toHaveBeenCalled();expect(opens).not.toHaveBeenCalled();expect(api.write).not.toHaveBeenCalled();expect(JSON.stringify(household)).toBe(before);
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.activeElement).toBe(grip);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('preserves the real Count exact editor and unfinished cash draft through theme preview/cancel',async()=>{
 const household=catalogHousehold();const store=new AppearanceStore({read:async()=>parseAppearance(null),write:async()=>parseAppearance(null)},null);const onActive=vi.fn(),onCancel=vi.fn();
 function Count(){useSceneBinding('shift','personal',false);const[cash,setCash]=useState<number|null>(12345);return h(ShiftCount,{household,memberId:'MEM-002',jobId:'',hours:6,cash,card:9000,hoursLocked:false,calculation:null,completeReading:false,onActive,onCancel,onChange:(field,value)=>{if(field==='cash')setCash(value);}});}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(h(ThemeProvider,{store,children:h(Count)})));await act(async()=>host.querySelectorAll<HTMLButtonElement>('.count-value')[1]!.click());const editor=host.querySelector<HTMLInputElement>('.count-exact')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(editor,'137.42');editor.dispatchEvent(new Event('input',{bubbles:true}));});
 for(const theme of ['taylor','newfoundland','classic'] as const){await act(async()=>store.preview(theme));expect(host.querySelector('.count-exact')).toBe(editor);expect(editor.value).toBe('137.42');expect(document.activeElement).toBe(editor);}
 await act(async()=>store.cancelPreview());expect(host.querySelector('.count-exact')).toBe(editor);expect(editor.value).toBe('137.42');expect(onCancel).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('renders reserved fictional keepsakes without marking missing originals as prepared',async()=>{
 const host=document.createElement('div'),root=createRoot(host);
 try{await act(async()=>root.render(h(Memorabilia,{scene:'showgirl',location:'phone-desk'})));expect(host.querySelectorAll('figure[data-placeholder]')).toHaveLength(3);expect(host.querySelector('figure')?.getAttribute('data-asset')).toBe('concert-ticket');for(const img of host.querySelectorAll('img')){expect(img.alt).toContain('Illustrated placeholder');expect(img.getAttribute('width')).toBeTruthy();expect(img.getAttribute('height')).toBeTruthy();}expect(missingMemorabilia()).toHaveLength(MEMORABILIA.length);await act(async()=>root.render(h(Memorabilia,{scene:'jag-lobby'})));expect(host.innerHTML).toBe('');}finally{await act(async()=>root.unmount());}
});
