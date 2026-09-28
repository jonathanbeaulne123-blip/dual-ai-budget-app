// @vitest-environment jsdom
import {act,useState,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {HomeBookProvider,HomeBookButton,useHomeBook} from '../src/home/HomeBook.tsx';
import {catalogHousehold} from '../src/core/seed.ts';
import type {Household} from '../src/core/types.ts';
import type {KitchenCommand} from '../src/kitchenCommand.ts';
vi.mock('../src/theme/ThemeProvider.tsx',()=>({useAppearance:()=>({preview:null,saved:{theme:theme}})}));
let theme='classic',root:Root,host:HTMLDivElement,current:Household,opened:string[];
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
beforeEach(()=>{theme='classic';current=catalogHousehold();opened=[];host=document.createElement('div');document.body.append(host);root=createRoot(host);HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
function ContextProbe(){const c=useHomeBook();return createElement('output',{'data-testid':'home-context'},JSON.stringify({editing:c?.editing,plot:c?.plotId,pending:c?.pendingVisit}));}
function Harness(){const [h,setH]=useState(current);const run:KitchenCommand=fn=>{const result=fn(current);current=result.household;setH(current);return {ok:true} as Awaited<ReturnType<KitchenCommand>>;};return createElement(HomeBookProvider,{household:h,memberId:'MEM-001',today:'2026-09-27',run,onVisit:()=>{opened.push('visit');},onOpen:target=>{opened.push(target);},children:[createElement(HomeBookButton,{key:'entry'}),createElement(ContextProbe,{key:'probe'})]});}
const button=(label:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()===label)!;
const click=async(label:string)=>act(async()=>{const b=button(label);expect(b,`button ${label}`).toBeTruthy();b.click();});
const mount=async()=>{await act(async()=>root.render(createElement(Harness)));await click('⌂ Renovation book');};
describe('Connected renovation book',()=>{
 for(const style of ['classic','taylor','newfoundland'])it(`opens and saves an owner home in ${style}`,async()=>{theme=style;await mount();expect(document.querySelector('dialog')?.classList.contains('home-book--'+style)).toBe(true);expect(document.querySelector('output')?.textContent).toContain('"editing":true');await click('Save home & collect blueprints');expect(current.personalLife?.home?.revision).toBe(1);expect(current.hearthside?.homePlots?.[0]?.memberId).toBe('MEM-001');await click('Visit my saved home');expect(opened).toEqual(['visit']);expect(document.querySelector('dialog')).toBeNull();expect(document.querySelector('output')?.textContent).toContain('"pending":true');});
 it('builds in readable stages, undoes and redoes, stores and restores then saves',async()=>{await mount();await click('Preview project');expect(document.querySelector('.home-book__assembly')?.textContent).toContain('Foundation');await click('Raise the frame');await click('Fit the roof');await click('Finish the room');await click('Undo');expect(document.querySelectorAll('.home-plan g[role=button]')).toHaveLength(4);await click('Redo');await click('Store with contents');await click('Restore');await click('Save home & collect blueprints');expect(current.personalLife?.home?.layout.rooms).toHaveLength(2);expect(current.transactions).toEqual(catalogHousehold().transactions);});
 it('keeps locked aspirations provisional and preserves the saved home on discard',async()=>{await mount();await click('Future home · preview');const cards=[...document.querySelectorAll('article')];const library=cards.find(a=>a.querySelector('h3')?.textContent==='Library wing')!;await act(async()=>{(library.querySelector('button') as HTMLButtonElement).click();});await click('Save future blueprint');expect(current.personalLife?.home?.future?.rooms).toHaveLength(2);expect(current.personalLife?.home?.layout.rooms).toHaveLength(1);await click('Discard draft and close');expect(document.querySelector('dialog')).toBeNull();});
 it('selects furniture by keyboard and blocks a world movement key from bubbling',async()=>{await mount();let seen=false;const listener=()=>{seen=true;};window.addEventListener('keydown',listener);await act(async()=>{document.querySelector('[aria-label="Select Entry bench"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));});expect(seen).toBe(false);expect(document.querySelector('.home-book__selection h2')?.textContent).toBe('Entry bench');window.removeEventListener('keydown',listener);});
});
