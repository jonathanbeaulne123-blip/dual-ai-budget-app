// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CadPad } from '../src/CadPad.tsx';
import { parsePadDecimal } from '../src/core/cadPad.ts';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let cleanup=()=>{};
afterEach(()=>cleanup());
function mount(onEnter=vi.fn(), props:Record<string,unknown>={}) {
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 function Harness(){const [digits,setDigits]=useState('');return createElement(CadPad,{digits,onDigits:setDigits,label:'Amount',onEnter,...props});}
 act(()=>root.render(createElement(Harness)));cleanup=()=>{act(()=>root.unmount());host.remove();};
 const input=host.querySelector('input')!;
 const fill=(value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 return {host,input,fill,onEnter};
}
describe('decimal CashPad',()=>{
 it.each([['12.50','1250'],['12','1200'],['.05','5'],['$1,234.56','123456'],['CAD 20.1','2010'],['0','0'],['','']])('parses %s without changing cents',(value,digits)=>expect(parsePadDecimal(value)).toEqual({digits,error:''}));
 it.each(['12,34','12.345','-2','1e3','1.2.3','1000000'])('rejects ambiguous or out-of-range %s',value=>{expect(parsePadDecimal(value).error).toBeTruthy();expect(parsePadDecimal(value).digits).toBe('');});
 it('keeps incomplete decimal editing, replaces amounts and blocks invalid Enter',()=>{
  const {host,input,fill,onEnter}=mount();fill('12.');expect(input.value).toBe('12.');fill('12.50');expect(host.querySelector('.cad-pad-display')!.textContent).toContain('12.50');
  act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));expect(onEnter).toHaveBeenCalledTimes(1);
  fill('12.345');expect(input.getAttribute('aria-invalid')).toBe('true');act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));expect(onEnter).toHaveBeenCalledTimes(1);
  fill('25.00');expect(host.querySelector('.cad-pad-display')!.textContent).toContain('25.00');
 });
 it('only advances the focused pad and ignores composition, held and modified Enter',()=>{
  const {input,onEnter}=mount();
  for(const options of [{isComposing:true},{repeat:true},{shiftKey:true},{ctrlKey:true},{metaKey:true}])act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,...options})));
  act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));expect(onEnter).not.toHaveBeenCalled();
 });
 it('retains the touch cents keypad and enforces hour limits for typing',()=>{
  const {host,fill}=mount(vi.fn(),{unit:'hours'});fill('24.01');expect(host.querySelector('[role=status]')).not.toBeNull();
  fill('');for(const key of ['1','2','5','0'])act(()=>(host.querySelector(`.cad-pad-keys button[aria-label="${key}"]`) as HTMLButtonElement).click());
  expect(host.querySelector('.cad-pad-display')!.textContent).toBe('12.50 h');
 });
});
