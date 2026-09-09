// @vitest-environment jsdom
import {act,createElement as h} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {ThemeProvider,useSceneBinding,useAtmosphereVisibility} from '../src/theme/ThemeProvider.tsx';
import {AppearanceStore} from '../src/theme/appearanceStore.ts';
import {parseAppearance,type SceneRoute} from '../src/theme/scenes.ts';
import {EraBracelet,PageWorld,WorldCharm,ERA_LIGHTS} from '../src/theme/PageWorld.tsx';
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));});
afterEach(()=>{vi.unstubAllGlobals();document.body.innerHTML='';});
it('observes elements that appear after a route change and cleans up replaced elements',async()=>{
 const observe=vi.fn(),disconnect=vi.fn();vi.stubGlobal('IntersectionObserver',class{observe=observe;disconnect=disconnect;});
 const host=document.createElement('div'),root=createRoot(host);
 function Surface({shown}:{shown:boolean}){const ref=useAtmosphereVisibility();return shown?h('aside',{ref}):null;}
 try{await act(async()=>root.render(h(Surface,{shown:false})));expect(observe).not.toHaveBeenCalled();await act(async()=>root.render(h(Surface,{shown:true})));expect(observe).toHaveBeenCalledTimes(1);await act(async()=>root.render(h(Surface,{shown:false})));expect(disconnect).toHaveBeenCalledTimes(1);await act(async()=>root.render(h(Surface,{shown:true})));expect(observe).toHaveBeenCalledTimes(2);}finally{await act(async()=>root.unmount());}
});
it('changes the same light-up bracelet with the era and preserves unrelated draft state',async()=>{
 const store=new AppearanceStore({read:async()=>parseAppearance(null),write:async()=>parseAppearance(null)},null);
 function Screen({route}:{route:SceneRoute}){useSceneBinding(route,'household',false);return h('div',null,h('input',{defaultValue:'Unfinished note'}),h(EraBracelet),h(PageWorld,{page:route}),h(WorldCharm,{page:route}));}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>{store.preview('taylor');root.render(h(ThemeProvider,{store,children:h(Screen,{route:'home'})}));});const draft=host.querySelector('input')!,bracelet=host.querySelector('.era-light')!;draft.value='Still editing';
 await act(async()=>root.render(h(ThemeProvider,{store,children:h(Screen,{route:'calendar'})})));expect(host.querySelector('input')).toBe(draft);expect(draft.value).toBe('Still editing');expect(host.querySelector('.era-light')).toBe(bracelet);expect(bracelet.getAttribute('aria-label')).toContain('Red');expect((bracelet as HTMLElement).style.getPropertyValue('--era-light')).toBe(ERA_LIGHTS.red);expect(document.documentElement.dataset.worldPage).toBe('calendar');
 await act(async()=>root.render(h(ThemeProvider,{store,children:h(Screen,{route:'home'})})));await act(async()=>store.setAtmosphere(false));await act(async()=>host.querySelector<HTMLButtonElement>('.world-charm')!.click());expect(host.querySelector('.world-charm')?.getAttribute('data-moving')).toBeNull();
 }finally{await act(async()=>root.unmount());}
});
