// @vitest-environment jsdom
import {act, createElement as h, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ThemeProvider,useSceneBinding} from '../src/theme/ThemeProvider.tsx';
import {AppearanceStore} from '../src/theme/appearanceStore.ts';
import {parseAppearance} from '../src/theme/scenes.ts';
import {ShiftCount} from '../src/ShiftCount.tsx';
import {Memorabilia} from '../src/theme/Memorabilia.tsx';
import {MEMORABILIA,missingMemorabilia} from '../src/theme/memorabilia.ts';
import {catalogHousehold} from '../src/core/index.ts';
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));Object.defineProperty(window,'innerWidth',{value:390,configurable:true});});
afterEach(()=>{vi.unstubAllGlobals();document.body.innerHTML='';});
// K1 (Tool Atlas §7): the phone's Fund ledge is retired, so its theme-preview case went with it.
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
it('browses labelled placeholders at both Homes without inventing a ticket or marking photos prepared',async()=>{
 const host=document.createElement('div'),root=createRoot(host);
 try {
  for(const scene of ['showgirl','lover']) {
   await act(async()=>root.render(h(Memorabilia,{scene})));
   expect(host.querySelector('.home-scrapbook')).not.toBeNull();
   expect(host.textContent).toContain('Bianca will choose the photographs');
   expect(host.textContent).not.toContain('ticket');
   const next=host.querySelector<HTMLButtonElement>('[aria-label="Next scrapbook page"]')!;
   const previous=host.querySelector<HTMLButtonElement>('[aria-label="Previous scrapbook page"]')!;
   expect(previous.disabled).toBe(true);
   await act(async()=>next.click());
   expect(host.querySelector('[aria-live]')?.textContent).toBe('Page 2 of 3');
   expect(host.querySelector('.scrapbook-sequins')).not.toBeNull();
   await act(async()=>next.click());expect(next.disabled).toBe(true);
   await act(async()=>previous.click());await act(async()=>previous.click());
   expect(previous.disabled).toBe(true);
  }
  expect(MEMORABILIA.some(a=>a.id==='concert-ticket')).toBe(false);
  expect(missingMemorabilia().every(a=>a.status==='awaiting-original')).toBe(true);
  await act(async()=>root.render(h(Memorabilia,{scene:'jag-lobby'})));expect(host.innerHTML).toBe('');
 } finally {await act(async()=>root.unmount());}
});
