// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {HorizonGuide} from '../src/harbour/horizon/HorizonGuide.tsx';
import {MONORAIL_STOPS} from '../src/harbour/mountain/definition.ts';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement,root:Root;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=(props:Partial<Parameters<typeof HorizonGuide>[0]>={})=>act(async()=>root.render(createElement(HorizonGuide,{
  open:true,onClose:vi.fn(),views:[],onView:vi.fn(),onWalk:vi.fn(),onPlace:vi.fn(),skateAvailable:true,skateHere:true,onSkate:vi.fn(),onRace:vi.fn(),
  monorailAvailable:true,onMonorail:vi.fn(),soundOn:false,onSound:vi.fn(),...props,
})));
const button=(name:string)=>[...host.querySelectorAll('button')].find(node=>node.textContent?.trim()===name)!;

describe('the old shell guide on Horizon',()=>{
  it('opens the actual travel actions and boards the selected train route',async()=>{
    const onMonorail=vi.fn(),onRace=vi.fn(),onSkate=vi.fn();
    await render({onMonorail,onRace,onSkate});
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    await act(async()=>button('Travel & play').click());
    await act(async()=>button('Start downhill race').click());
    await act(async()=>button('Skate here').click());
    await act(async()=>button('Board the monorail').click());
    expect(onRace).toHaveBeenCalledOnce();expect(onSkate).toHaveBeenCalledOnce();
    expect(onMonorail).toHaveBeenCalledWith(0,[MONORAIL_STOPS.length-1]);
  });
  it('keeps the guide honest when skate or the train is unavailable',async()=>{
    await render({skateAvailable:false,monorailAvailable:false});
    await act(async()=>button('Travel & play').click());
    expect(button('Start downhill race')).toBeUndefined();
    expect(button('Board the monorail')).toBeUndefined();
    expect(button('Walk to the boats')).toBeTruthy();
  });
  // Changed (Jonathan 2026-10-04, "bring back the skateboard anywhere"): this test expected a "Go skate Tideline" trip
  // button. Since #578 the runtime no longer moves the rider to Tideline, so that label promised a trip that never
  // happened. The board now goes down wherever the person stands; off valid ground the guide keeps "Skate here" (which
  // reports the refusal) and says why underneath.
  it('keeps Skate here anywhere on the Horizon and says why the board cannot go down here',async()=>{
    const onSkate=vi.fn();await render({skateHere:false,skateWhy:'Step out of the water to put down the board.',onSkate});
    await act(async()=>button('Travel & play').click());
    expect(button('Go skate Tideline')).toBeUndefined();
    expect(host.querySelector('#horizon-guide-skate-why')?.textContent).toBe('Step out of the water to put down the board.');
    expect(button('Skate here').getAttribute('aria-describedby')).toBe('horizon-guide-skate-why');
    await act(async()=>button('Skate here').click());
    expect(onSkate).toHaveBeenCalledOnce();
    expect(button('Start downhill race')).toBeTruthy();
  });
});
