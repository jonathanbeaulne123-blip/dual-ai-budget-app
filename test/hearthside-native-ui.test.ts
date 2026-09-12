// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {webcrypto} from 'node:crypto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NativeWidgetSurface} from '../src/hearthside/NativeWidgetSurface.tsx';
import {NativeWidgetController,type NativeWidgetPlugin} from '../src/hearthside/nativeWidget.ts';
const scope={environment:'development' as const,householdId:'house-a',memberId:'a',subject:'user-a'};
const selection={version:1 as const,designId:'d',pieceId:'p',revision:0,pngBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8e0AAAAASUVORK5CYII='};
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('crypto',webcrypto);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
describe('reviewed home-screen sculpture UI',()=>{
 it('requires an explicit checkbox, saves exact reviewed bytes, and clears selection',async()=>{
  const plugin:NativeWidgetPlugin={widgetAvailability:async()=>({supported:true,reason:'Ready'}),setWidget:vi.fn(async()=>{}),clearWidget:vi.fn(async()=>{})},controller=new NativeWidgetController(plugin);await controller.enterScope(scope);
  await act(async()=>root.render(createElement(NativeWidgetSurface,{controller,plugin,scope,selection,onClose:()=>{}})));
  await act(async()=>{await new Promise(r=>setTimeout(r,10));});expect(button('Save widget image').disabled).toBe(true);expect(host.querySelector('img')?.alt).toContain('Exact sculpture');
  act(()=>host.querySelector<HTMLInputElement>('input')!.click());expect(button('Save widget image').disabled).toBe(false);
  await act(async()=>{button('Save widget image').click();await new Promise(r=>setTimeout(r,10));});expect(plugin.setWidget).toHaveBeenCalledOnce();expect(host.textContent).toContain('Image saved.');
  await act(async()=>button('Remove image').click());expect(host.textContent).toContain('private default');
 });
 it('keeps unsupported builds honest and allows keyboard-native return',async()=>{const close=vi.fn(),plugin:NativeWidgetPlugin={widgetAvailability:async()=>({supported:false,reason:'Widget app group is not configured.'}),setWidget:vi.fn(async()=>{}),clearWidget:async()=>{}},controller=new NativeWidgetController(plugin);
  await act(async()=>root.render(createElement(NativeWidgetSurface,{controller,plugin,scope,selection,onClose:close})));await act(async()=>{await new Promise(r=>setTimeout(r,10));});
  expect(button('Save widget image').disabled).toBe(true);expect(host.textContent).toContain('not configured');act(()=>button('Return to Studio').click());expect(close).toHaveBeenCalledOnce();expect(plugin.setWidget).not.toHaveBeenCalled();
 });
});
