// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MountainPanel,type MountainAction} from '../src/harbour/mountain/MountainPanel.tsx';
import {MONORAIL_STOPS} from '../src/harbour/mountain/definition.ts';
import {boardMonorail} from '../src/harbour/mountain/monorail.ts';

let host:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const click=async(label:string)=>{const button=[...host.querySelectorAll('button')].find(b=>b.textContent?.includes(label));expect(button).toBeDefined();await act(async()=>button!.click());};

it('boards a selected all-island tour and keeps the train console usable after closing the guide',async()=>{
  const actions:MountainAction[]=[],onAction=(action:MountainAction)=>actions.push(action);
  await act(async()=>root.render(createElement(MountainPanel,{open:true,onOpenChange:vi.fn(),statusLine:null,onAction,onOpen:vi.fn(),partnerName:'Bianca'})));
  await click('Travel & race');
  expect(host.textContent).toContain('Island monorail');
  expect(host.querySelectorAll('.monorail-stops input')).toHaveLength(MONORAIL_STOPS.length);
  await click('Tour every stop');
  await click('Board the monorail');
  expect(actions.at(-1)).toEqual({kind:'monorail-board',from:0,stops:MONORAIL_STOPS.map((_,i)=>i).slice(1),companion:true});
  await act(async()=>root.render(createElement(MountainPanel,{open:false,onOpenChange:vi.fn(),statusLine:null,onAction,onOpen:vi.fn(),partnerName:'Bianca',monorail:{...boardMonorail(0,true),queue:[MONORAIL_STOPS.length-1]}})));
  expect(host.querySelector('[aria-label="Monorail train controls"]')).not.toBeNull();
  await click('Sit by the window');expect(actions.at(-1)).toMatchObject({kind:'monorail-control',control:'seat',value:true});
  await click('Driver’s view');expect(actions.at(-1)).toMatchObject({kind:'monorail-control',control:'view',value:'front'});
  await click('Apply brake');expect(actions.at(-1)).toMatchObject({kind:'monorail-control',control:'brake',value:true});
  await click('Step off');expect(actions.at(-1)).toMatchObject({kind:'monorail-control',control:'exit'});
});

it('opens a tapped station with that station selected for boarding',async()=>{
  await act(async()=>root.render(createElement(MountainPanel,{statusLine:null,onAction:vi.fn(),onOpen:vi.fn(),inspect:{section:'travel',station:6,seq:1}})));
  expect(host.querySelector<HTMLSelectElement>('[aria-label="Monorail boarding station"]')?.value).toBe('6');
});
