// @vitest-environment jsdom
// Jonathan 2026-10-04: the Guide's "Glider launches" (three entries that take the walker to each pad, ready to launch) and the
// desktop offer words for a glider launch ("Glide", keyed E).
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {HorizonGuide} from '../src/harbour/horizon/HorizonGuide.tsx';
import {offerButtonText,offersKeyed} from '../src/harbour/horizon/HorizonStage.tsx';
import {GLIDER_PADS} from '../src/harbour/horizon/runtime/gliderPads.ts';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement,root:Root;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=(props:Partial<Parameters<typeof HorizonGuide>[0]>={})=>act(async()=>root.render(createElement(HorizonGuide,{
  open:true,onClose:vi.fn(),views:[],onView:vi.fn(),onWalk:vi.fn(),onPlace:vi.fn(),skateAvailable:true,skateHere:true,onSkate:vi.fn(),onRace:vi.fn(),
  monorailAvailable:true,onMonorail:vi.fn(),soundOn:false,onSound:vi.fn(),...props,
})));
const button=(name:string)=>[...host.querySelectorAll('button')].find(node=>node.textContent?.trim()===name);
const pads=GLIDER_PADS.map(({id,label})=>({id,label}));

describe('Guide · Glider launches',()=>{
  it('lists The Crown, The Prow and The Lamp and sends the chosen pad',async()=>{
    const onGliderPad=vi.fn();await render({gliderPads:pads,onGliderPad});
    const section=host.querySelector('section[aria-labelledby="horizon-guide-gliders"]')!;
    expect(section.querySelector('h3')?.textContent).toBe('Glider launches');
    expect([...section.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['The Crown','The Prow','The Lamp']);
    expect(button('The Lamp')!.getAttribute('aria-label')).toBe('Glider launch: The Lamp');
    for(const pad of pads)await act(async()=>button(pad.label)!.click());
    expect(onGliderPad.mock.calls.map(c=>c[0])).toEqual(['crown','prow','lampGallery']);
  });
  it('shows no section without the runtime\'s pads (the world not ready)',async()=>{
    await render({gliderPads:[],onGliderPad:vi.fn()});
    expect(host.querySelector('#horizon-guide-gliders')).toBeNull();
  });
  it('the Travel tab points to the launches',async()=>{
    await render({gliderPads:pads,onGliderPad:vi.fn()});
    await act(async()=>button('Travel & play')!.click());
    expect(host.textContent).toContain('The three glider launches are under Explore.');
  });
});

describe('desktop offer words',()=>{
  it('a glider launch is a keyed "Glide" button; other offers keep their own words and stay touch-only',()=>{
    expect(offerButtonText({to:'glider',action:'run off'})).toBe('Glide');
    expect(offerButtonText({to:'gondola',action:'board by offer'})).toBe('board by offer');
    expect(offersKeyed([{to:'glider'}])).toBe(true);expect(offersKeyed([{to:'gondola'},{to:'feet'}])).toBe(false);
  });
});
