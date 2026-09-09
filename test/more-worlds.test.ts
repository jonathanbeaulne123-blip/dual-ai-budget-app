// @vitest-environment jsdom
import {act,createElement as h} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ThemeProvider,useSceneBinding} from '../src/theme/ThemeProvider.tsx';
import {AppearanceStore} from '../src/theme/appearanceStore.ts';
import {parseAppearance} from '../src/theme/scenes.ts';
import {AddCategoryForm} from '../src/AddCategoryForm.tsx';
import {catalogHousehold} from '../src/core/index.ts';
import {ThemeSceneHeading} from '../src/theme/SceneArtwork.tsx';
import {PageWorld,WorldCharm} from '../src/theme/PageWorld.tsx';

it('preserves the real More category draft, focus and validation across all scene changes without saving',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 const store=new AppearanceStore({read:async()=>parseAppearance(null),write:async()=>parseAppearance(null)},null),save=vi.fn(),household=catalogHousehold();
 function Screen({personal=false}:{personal?:boolean}){useSceneBinding('more',personal?'personal':'household',false);return h('div',{className:'world-page'},h(PageWorld,{page:'more'}),h(ThemeSceneHeading,{more:true}),h(WorldCharm,{page:'more'}),h('div',{className:'more-surfaces'},h(AddCategoryForm,{household,onSave:save})));}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(h(ThemeProvider,{store,children:h(Screen)})));
  const input=host.querySelector<HTMLInputElement>('input')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'An unfinished category');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();});
  for(const personal of [false,true]){
   await act(async()=>root.render(h(ThemeProvider,{store,children:h(Screen,{personal})})));
   for(const theme of ['classic','taylor','newfoundland'] as const){
    await act(async()=>store.preview(theme));
    expect(host.querySelector('input')).toBe(input);expect(document.activeElement).toBe(input);expect(input.value).toBe('An unfinished category');expect(save).not.toHaveBeenCalled();
    expect(host.querySelector('.page-world-art')?.getAttribute('aria-hidden')).toBe('true');
   }
  }
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Save category')!.click());
  expect(save).not.toHaveBeenCalled();expect(host.textContent).toContain('Please fill in a name.');
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
