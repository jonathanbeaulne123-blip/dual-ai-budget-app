// @vitest-environment jsdom
import {act,createElement as h, type ComponentProps} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ThemeProvider,useSceneBinding} from '../src/theme/ThemeProvider.tsx';
import {AppearanceStore} from '../src/theme/appearanceStore.ts';
import {parseAppearance} from '../src/theme/scenes.ts';
import {BooksPage} from '../src/Books.tsx';
import {catalogHousehold} from '../src/core/index.ts';
import {ThemeSceneHeading} from '../src/theme/SceneArtwork.tsx';
import {PageWorld,WorldCharm} from '../src/theme/PageWorld.tsx';

it.each(['household','personal'] as const)('preserves the actual Books reconciliation draft and focus across themes in %s without writing',async view=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 const store=new AppearanceStore({read:async()=>parseAppearance(null),write:async()=>parseAppearance(null)},null),write=vi.fn(),household=catalogHousehold();
 const props:ComponentProps<typeof BooksPage>={household,booksHousehold:household,memberId:'MEM-001',view,booksStatus:null,focusedAccountId:null,sourceFocus:null,onFocusAccount:vi.fn(),onClearSource:vi.fn(),onChange:write,onRemove:write,onPayAccount:write,onAddToAccount:write,onCommand:write};
 function Screen(){useSceneBinding('ledger',view,false);return h('div',null,h(PageWorld,{page:'ledger'}),h(ThemeSceneHeading,{books:true}),h(WorldCharm,{page:'ledger'}),h(BooksPage,props));}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(h(ThemeProvider,{store,children:h(Screen)})));
  await act(async()=>host.querySelector<HTMLDetailsElement>('.books-audit-office')!.open=true);
  await act(async()=>[...host.querySelectorAll<HTMLButtonElement>('[data-books-tabs="audit"] button')].find(b=>b.textContent==='Reconcile')!.click());
  const input=host.querySelector<HTMLInputElement>('input[id$="-statement-balance"]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'1234567.89');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();});
  for(const theme of ['classic','taylor','newfoundland'] as const){
   await act(async()=>store.preview(theme));
   expect(host.querySelector('input[id$="-statement-balance"]')).toBe(input);expect(document.activeElement).toBe(input);expect(input.value).toBe('1234567.89');expect(write).not.toHaveBeenCalled();
   expect(host.querySelector('.page-world-art')?.getAttribute('aria-hidden')).toBe('true');
   expect(host.querySelector('.books-audit-office')?.hasAttribute('open')).toBe(true);
  }
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
