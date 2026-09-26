// @vitest-environment jsdom
import {createElement} from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeAll,describe,expect,it,vi} from 'vitest';
import type {ThresholdOffer} from '../src/harbour/horizon/movers/shared/threshold.ts';
import type {HorizonMoverState} from '../src/harbour/horizon/runtime/index.ts';

// FLIGHT.md §7: the quick layer (the toolbar: Walk / Look / Island, the page picker, Tools, Journey, Sound) stays
// exactly where it is in every phase — on foot, in the glider, in the corridor, in freefall, after a fade.
// The real stage renders against a fake runtime: only the runtime is faked, the DOM is the stage's own.
const world={
  moverState:{mode:'feet',attached:false,hud:null} as HorizonMoverState,
  offers:[] as ThresholdOffer[],
  moverAction:vi.fn(),accept:vi.fn(),
};
const register=vi.fn(()=>()=>{});
vi.mock('../src/harbour/scene/worldMount.ts',()=>({mountHorizonWorld:async()=>({
  mode:()=>'walk',shotId:()=>'A',offers:()=>world.offers,moverState:()=>world.moverState,moverAction:world.moverAction,accept:world.accept,
  pause(){},setReducedMotion(){},setCalm(){},setMode(){},dispose(){},input(){},look(){},jump(){},enterDoor(){},cutTo(){},world:{views:[]},
})}));
vi.mock('../src/harbour/horizon/movers/glider/index.ts',()=>({registerGliderModes:register}));

beforeAll(()=>{
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  window.matchMedia=((query:string)=>({matches:false,media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null,dispatchEvent:()=>false})) as typeof window.matchMedia;
  globalThis.ResizeObserver??=class{observe(){}unobserve(){}disconnect(){}} as unknown as typeof ResizeObserver;
});
const tick=(ms=260)=>act(async()=>{await new Promise(r=>setTimeout(r,ms));});
let root:ReturnType<typeof createRoot>|null=null,host:HTMLElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;});
async function mount(){
  const {default:HorizonStage}=await import('../src/harbour/horizon/HorizonStage.tsx');
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>{root!.render(createElement(HorizonStage,{onQuickSheet:()=>{},onJourney:()=>{},sound:{on:false,toggle:()=>{}}}));});
  await tick(50);
  return host;
}
const toolbar=(h:HTMLElement)=>h.querySelector('.horizon-toolbar')!;
const labels=(h:HTMLElement)=>[...toolbar(h).querySelectorAll('button')].map(b=>b.textContent);
const hud=(attached:boolean,hudState:HorizonMoverState['hud'],mode:HorizonMoverState['mode']='glider',fade?:string)=>{world.moverState={mode,attached,hud:hudState,...(fade?{fade}:{})};};

describe('the quick layer in every mover phase',()=>{
  it('registers the gliders on the runtime it mounts',async()=>{await mount();expect(register).toHaveBeenCalledTimes(1);});
  it('keeps the same toolbar mounted — Walk, Look, Island, the page, Tools, Journey, Sound — through launch, flight, corridor, freefall and a fade',async()=>{
    const h=await mount(),bar=toolbar(h),before=labels(h);
    expect(before).toEqual(['Walk','Look','Island','Tools','Journey','Sound off']);
    const phases:[boolean,HorizonMoverState['hud'],HorizonMoverState['mode'],string?][]=[
      [true,{place:{label:'Step back',distance:0,action:'fold'}},'glider'],
      [true,{height:62.4,lift:1.2,place:{label:'the Green',distance:410,action:'fold'}},'glider'],
      [true,{height:31,lift:0},'glider'],
      [true,{height:180,place:{label:'Pull',distance:0,action:'pull'}},'parachute'],
      [false,null,'feet','→ the square'],
    ];
    for(const [attached,state,mode,fade] of phases){
      hud(attached,state,mode,fade);await tick();
      expect(toolbar(h)).toBe(bar);expect(bar.isConnected).toBe(true);expect(labels(h)).toEqual(before);
      expect(h.querySelector('select[aria-label="Sketchbook page"]')).not.toBeNull();
    }
  });
  it('hides Jump and Enter while a mover is attached, and shows the two bubbles in their slots',async()=>{
    const h=await mount();
    expect(h.querySelector('.horizon-jump')).not.toBeNull();
    hud(true,{height:62.4,lift:1.2,place:{label:'the Green',distance:410.2,action:'fold'}});await tick();
    expect(h.querySelector('.horizon-jump')).toBeNull();expect([...h.querySelectorAll('.horizon-touch-controls button')].map(b=>b.textContent)).toEqual([]);
    expect(h.querySelector('.horizon-bubble-height')!.textContent).toBe('62 m↑');
    const place=h.querySelector<HTMLButtonElement>('button.horizon-bubble-place')!;expect(place.textContent).toBe('the Green · 410 m');
    act(()=>place.click());expect(world.moverAction).toHaveBeenCalledWith('fold');
    hud(true,{height:12,lift:-.8,place:{label:'Pull',distance:0,action:'pull'}},'parachute');await tick();
    expect(h.querySelector('.horizon-bubble-height')!.textContent).toBe('12 m↓');
    const pull=h.querySelector<HTMLButtonElement>('button.horizon-bubble-place')!;expect(pull.textContent).toBe('Pull');act(()=>pull.click());expect(world.moverAction).toHaveBeenCalledWith('pull');
    hud(true,{place:{label:'Step back',distance:0,action:'fold'}});await tick();
    expect(h.querySelector('button.horizon-bubble-place')!.textContent).toBe('Step back');
  });
  it('after a fade the place bubble reads "→ place" for a moment, not a button',async()=>{
    const h=await mount();hud(false,null,'feet','→ the square');await tick();
    const fade=h.querySelector('.horizon-bubble-fade')!;expect(fade.textContent).toBe('→ the square');expect(fade.tagName).toBe('P');
  });
  it('labels the glider offers as the pads read them, and the plane\'s Jump as a press-and-hold',async()=>{
    const h=await mount();
    world.offers=[{thresholdId:'lampGallery',from:'feet',to:'glider',action:'Run off the gallery',at:[540,1195],height:25}];hud(false,null,'feet');await tick();
    expect([...h.querySelectorAll('.horizon-offer')].map(b=>b.textContent)).toEqual(['Run off the gallery']);
    world.offers=[{thresholdId:'bailOut',from:'plane',to:'parachute',action:'Jump',at:[1040,1000],height:200}];hud(true,{height:180},'plane');await tick();
    const jump=h.querySelector('.horizon-offer')!;expect(jump.textContent).toBe('Jump');expect(jump.classList.contains('horizon-offer--hold')).toBe(true);expect(jump.getAttribute('aria-label')).toBe('Jump (press and hold)');
    world.offers=[];
  });
});
