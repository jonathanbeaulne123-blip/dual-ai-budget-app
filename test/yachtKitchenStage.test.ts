// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {createKitchenEngine} from '../src/harbour/horizon/kitchen/model.ts';
import type {KitchenCommand,KitchenView} from '../src/harbour/horizon/kitchen/types.ts';

// Keep both the stage and KitchenHUD real: the runtime's external keyboard path
// must be reflected after an immediate React button command between two polls.
let engine=createKitchenEngine();
const view=():KitchenView=>({state:engine.snapshot(),stations:[],connections:[{chef:0,kind:'keyboard',label:'Keyboard',connected:true}],available:true,resumable:true,progress:{version:1,completed:{},best:{},unlocks:[]},storageWarning:null,tossTargets:{},targetLabels:{}});
const kitchenCommand=vi.fn((command:KitchenCommand)=>{if(command.type==='exit')engine.exit();else if(command.type==='open')engine.open();return true;});
vi.mock('../src/harbour/scene/worldMount.ts',()=>({mountHorizonWorld:async()=>({
  mode:()=>'walk',shotId:()=>'A',offers:()=>[],moverState:()=>({mode:'feet',attached:false,hud:null,perspective:'activity'}),
  fleetActions:()=>[],fleetState:()=>({vessels:[],swimming:false,perspective:'activity',sitting:null,saveFailed:false}),
  kitchenView:view,kitchenCommand,kitchenInput(){},setKitchenSound(){},
  setTheme(){},setCruiserTheme(){},setCruiserSkin(){},toggleCruiser(){},recoverCruiser(){},cyclePerspective(){},cycleCamera(){},resumeEquipment(){},
  pause(){},setComfort(){},setReducedMotion(){},setCalm(){},setMode(){},dispose(){},input(){},look(){},jump(){},jumpHold(){},enterDoor(){},cutTo(){},world:{views:[]},
})}));
vi.mock('../src/harbour/horizon/movers/glider/index.ts',()=>({registerGliderModes:()=>()=>{}}));

beforeAll(()=>{
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  window.matchMedia=((query:string)=>({matches:false,media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null,dispatchEvent:()=>false})) as typeof window.matchMedia;
  globalThis.ResizeObserver??=class{observe(){}unobserve(){}disconnect(){}} as unknown as typeof ResizeObserver;
});
beforeEach(()=>{vi.useFakeTimers();engine=createKitchenEngine();engine.open();kitchenCommand.mockClear();});
let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.useRealTimers();});

describe('Yacht Kitchen stage snapshot synchronization',()=>{
  it('renders the same menu again when keyboard reopening follows a close before the next poll',async()=>{
    const {default:HorizonStage}=await import('../src/harbour/horizon/HorizonStage.tsx');
    host=document.createElement('div');document.body.append(host);root=createRoot(host);
    await act(async()=>{root!.render(createElement(HorizonStage));});
    await act(async()=>{await vi.dynamicImportSettled();});
    await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
    const initialSnapshot=JSON.stringify(view());
    const close=host.querySelector<HTMLButtonElement>('button[aria-label="Close kitchen menu"]');
    expect(close).not.toBeNull();expect(host.textContent).toContain('Resume service');

    act(()=>close!.click());
    expect(kitchenCommand).toHaveBeenCalledWith({type:'exit'});
    expect(host.querySelector('.kitchen-menu')).toBeNull();
    // E is handled by the runtime, outside the React command callback. Return
    // exactly the previous menu snapshot before another 200 ms poll can run.
    engine.open();
    expect(JSON.stringify(view())).toBe(initialSnapshot);
    await act(async()=>{await vi.advanceTimersByTimeAsync(200);});

    expect(host.querySelector('.kitchen-menu')).not.toBeNull();
    expect([...host.querySelectorAll('button')].some(button=>button.textContent==='Resume service')).toBe(true);
  });
});
